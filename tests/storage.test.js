import assert from 'node:assert/strict'
import { test } from 'node:test'
import { IDBFactory } from 'fake-indexeddb'
import { defaultSettings, openStorage } from '../src/storage.js'
import { fixture } from './fixtures.js'

test('persists readings, settings, and the checkup across connections', async () => {
  const factory = new IDBFactory()
  const first = await openStorage(factory)
  assert.deepEqual((await first.load()).readings, [])
  await first.save([fixture('one')])
  await first.settings({ theme: 'Dark' })
  await first.checkup('2026-11-16')
  first.close()
  const reopened = await openStorage(factory)
  const state = await reopened.load()
  assert.deepEqual(state.readings, [fixture('one')])
  assert.equal(state.settings.theme, 'Dark')
  assert.equal(state.checkup, '2026-11-16')
  await reopened.clear()
  assert.deepEqual(await reopened.load(), { readings: [], sessions: [], settings: defaultSettings, checkup: null })
  reopened.close()
})

test('persists a separate session average and updates it after edits and deletions', async () => {
  const store = await openStorage(new IDBFactory())
  const a = fixture('a', { sessionId: 'group', systolic: 112, pulse: 66 })
  const b = fixture('b', { sessionId: 'group', systolic: 119, diastolic: 77 })
  await store.save([a, b])
  assert.deepEqual((await store.load()).sessions, [
    { id: 'group', count: 2, average: { systolic: 115.5, diastolic: 76.5, pulse: 66 } },
  ])
  await store.save([{ ...b, systolic: 125 }], true)
  assert.equal((await store.load()).sessions[0].average.systolic, 118.5)
  await store.remove('a')
  assert.equal((await store.load()).sessions[0].count, 1)
  assert.equal((await store.load()).sessions[0].average.pulse, null)
  await store.remove('b')
  assert.deepEqual((await store.load()).sessions, [])
  await assert.rejects(store.save([b], true), /already been deleted/)
  store.close()
})

test('merges atomically without replacing or duplicating existing records', async () => {
  const store = await openStorage(new IDBFactory())
  await store.save([fixture('old')])
  await store.checkup('2026-11-15')
  const backup = {
    readings: [fixture('old', { systolic: 132 }), fixture('new', { sessionId: 'restored' })],
    checkup: '2026-11-16',
  }
  const [first, second] = await Promise.all([store.merge(backup), store.merge(backup)])
  assert.deepEqual(first, { added: 1, skipped: 1 })
  assert.deepEqual(second, { added: 0, skipped: 2 })
  await assert.rejects(store.save([fixture('extra'), fixture('old')]))
  const state = await store.load()
  assert.equal(state.readings.length, 2)
  assert.equal(state.readings.find(reading => reading.id === 'old').systolic, 120)
  assert.equal(state.sessions[0].id, 'restored')
  assert.equal(state.checkup, '2026-11-15')
  store.close()
})
