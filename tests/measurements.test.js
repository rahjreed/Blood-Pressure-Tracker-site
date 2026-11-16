import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { makeBackup, makeCsv, readBackup } from '../src/backups.js'
import { averages, checkupSummary, classify, initialReading, inRange, isLow, plotData, recent, sessionCount, validateDraft } from '../src/measurements.js'
import { fixture } from './fixtures.js'

test('classifies strict thresholds, mixed values, and low readings', () => {
  const cases = [
    [90, 60, 'normal'], [119, 79, 'normal'], [120, 79, 'elevated'], [129, 79, 'elevated'],
    [130, 79, 'stage1'], [139, 79, 'stage1'], [119, 80, 'stage1'], [119, 89, 'stage1'],
    [140, 79, 'stage2'], [119, 90, 'stage2'], [180, 120, 'stage2'],
    [181, 78, 'severe'], [179, 121, 'severe'], [89, 60, 'low'], [120, 59, 'low'],
    [138, 59, 'stage1'], [182, 59, 'severe'],
  ]
  for (const [systolic, diastolic, category] of cases) {
    assert.equal(classify({ systolic, diastolic }), category, `${systolic}/${diastolic}`)
  }
  assert.equal(isLow({ systolic: 182, diastolic: 59 }), true)
})

test('uses inclusive calendar dates and averages individual readings and recorded pulse values', () => {
  const readings = [
    fixture('excluded', { at: '2026-11-10T04:59:00.000Z' }),
    fixture('start', { at: '2026-11-10T05:00:00.000Z', systolic: 110, diastolic: 70, pulse: 60 }),
    fixture('middle', { at: '2026-11-11T06:04:00.000Z', systolic: 125, diastolic: 80 }),
    fixture('end', { at: '2026-11-17T04:59:00.000Z', systolic: 131, diastolic: 81, pulse: 71 }),
    fixture('future', { at: '2026-11-17T05:00:00.000Z' }),
  ]
  const result = recent(readings, 7, '2026-11-16')
  assert.deepEqual(result.map(item => item.id), ['start', 'middle', 'end'])
  assert.deepEqual(averages(result), { systolic: 122, diastolic: 77, pulse: 65.5 })
  assert.deepEqual(inRange(readings, '2026-11-11', '2026-11-15').map(item => item.id), ['middle'])
  assert.equal(averages([]), null)
})

test('validates numeric form values, swapped measurements, and invalid timestamps', () => {
  const valid = { ...initialReading(), systolic: '121', diastolic: '80', pulse: '', dateTime: '2026-11-15T07:00' }
  const now = new Date('2026-11-16T12:00:00Z')
  assert.equal(validateDraft(valid, null, now).reading.pulse, null)
  assert.ok(validateDraft({ ...valid, systolic: '12e1' }, null, now).errors.systolic)
  assert.ok(validateDraft({ ...valid, systolic: 80 }, null, now).errors.diastolic)
  assert.ok(validateDraft({ ...valid, pulse: '0' }, null, now).errors.pulse)
  assert.ok(validateDraft({ ...valid, dateTime: '2026-02-30T07:00' }, null, now).errors.dateTime)
  assert.ok(validateDraft({ ...valid, dateTime: '2027-11-15T07:00' }, null, now).errors.dateTime)
  assert.equal(validateDraft({ ...valid, systolic: '181' }, null, now).reading.systolic, 181)
})

test('preserves original local dates across zones and rejects nonexistent times at DST transitions', () => {
  const module = new URL('../src/measurements.js', import.meta.url).href
  const code = `
    import assert from 'node:assert/strict'
    import { initialReading, validateDraft, recordedLocal, localInput, shiftDay } from '${module}'
    const reading = ${JSON.stringify(fixture('id', { offset: 330 }))}
    assert.equal(recordedLocal(reading), '2026-11-16T17:30')
    assert.equal(validateDraft(initialReading(reading), reading, new Date('2026-11-17')).reading.at, reading.at)
    assert.equal(validateDraft(initialReading(reading), reading, new Date('2026-11-17')).reading.offset, 330)
    assert.equal(localInput(new Date('2026-03-08T06:55:00Z')), '2026-03-08T01:55')
    assert.equal(localInput(new Date('2026-03-08T07:05:00Z')), '2026-03-08T03:05')
    const draft = { ...initialReading(reading), dateTime: '2026-03-08T02:30' }
    assert.ok(validateDraft(draft, reading, new Date('2026-11-17')).errors.dateTime)
    assert.equal(shiftDay('2026-03-08', 1), '2026-03-09')
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    env: { ...process.env, TZ: 'America/New_York' }, encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
})

test('plots same-day measurements at distinct time positions and counts guided sessions once', () => {
  const readings = [
    fixture('first', { sessionId: 'session' }),
    fixture('repeat', { sessionId: 'session', at: '2026-11-16T12:01:00.000Z' }),
    fixture('evening', { at: '2026-11-16T23:00:00.000Z', period: 'Evening' }),
  ]
  const plot = plotData(readings, ['systolic', 'diastolic'])
  assert.ok(plot.points[1].x > plot.points[0].x)
  assert.equal(plot.points.at(-1).x, 1)
  assert.equal(sessionCount(readings), 2)
  const summary = checkupSummary(readings, '2026-11-16')
  assert.equal(summary.completed, 2)
  assert.equal(summary.count, 3)
  assert.equal(summary.sessions, 2)
  assert.deepEqual(summary.days[1].periods, [false, false])
})

test('round-trips backup, rejects invalid records, and protects CSV cells', () => {
  const readings = [fixture('one', { notes: '=SUM(1,1)\n"follow up"', tags: ['Coffee'] })]
  const checkup = '2026-11-16'
  const json = makeBackup({ readings, checkup })
  assert.deepEqual(readBackup(json), { readings, checkup })
  assert.throws(() => readBackup('garbage'), /JSON/)
  assert.throws(() => readBackup(makeBackup({ readings: [readings[0], readings[0]], checkup })), /Duplicate/)
  assert.throws(() => readBackup(makeBackup({ readings: [fixture('bad', { diastolic: 122 })], checkup })), /Invalid reading/)
  assert.throws(() => readBackup(makeBackup({ readings, checkup: '2026-02-30' })), /Invalid checkup/)
  assert.match(makeCsv(readings), /"'=SUM\(1,1\)\n""follow up"""/)
  assert.match(makeCsv(readings), /,-300,/)
})
