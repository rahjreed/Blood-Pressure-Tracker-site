import { CATEGORIES, classify, isDay, PERIODS, recordedLocal, TAGS, validNumber } from './measurements.js'

const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value)
const isText = (value, max) => typeof value === 'string' && value.length <= max
const backupVersion = 1
export const maxBackupBytes = 15 * 1024 * 1024

export function makeBackup({ readings, checkup }) {
  return JSON.stringify({ app: 'PRESSURE', version: backupVersion, exportedAt: new Date().toISOString(), readings, checkup }, null, 2)
}

function parseReading(value) {
  if (!value || typeof value !== 'object') throw new Error('Invalid reading.')
  const { id, sessionId, systolic, diastolic, pulse, at, offset, arm, period, notes, tags, emergency } = value
  const timestamp = typeof at === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(at) && Date.parse(at)
  if (!validId(id) || (sessionId !== null && !validId(sessionId)) ||
      !validNumber('systolic', systolic) || !validNumber('diastolic', diastolic) || systolic <= diastolic ||
      (pulse !== null && !validNumber('pulse', pulse)) ||
      !Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== at ||
      !Number.isInteger(offset) || Math.abs(offset) > 840 ||
      !['Left', 'Right'].includes(arm) || !PERIODS.includes(period) ||
      !isText(notes, 1000) || !Array.isArray(tags) || tags.length > TAGS.length ||
      tags.some(tag => !TAGS.includes(tag)) || new Set(tags).size !== tags.length ||
      typeof emergency !== 'boolean') throw new Error('Invalid reading.')
  return { id, sessionId, systolic, diastolic, pulse, at, offset, arm, period, notes, tags, emergency }
}

export function readBackup(json) {
  let backup
  try {
    backup = JSON.parse(json)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  if (backup?.app !== 'PRESSURE' || backup.version !== backupVersion || !Array.isArray(backup.readings)) {
    throw new Error('Choose a supported PRESSURE JSON backup.')
  }
  if (backup.checkup !== null && !isDay(backup.checkup)) throw new Error('Invalid checkup date.')
  const ids = new Set()
  const readings = backup.readings.map((value, index) => {
    try {
      const reading = parseReading(value)
      if (ids.has(reading.id)) throw new Error('Duplicate reading ID.')
      ids.add(reading.id)
      return reading
    } catch (error) {
      throw new Error(`Backup reading ${index + 1}: ${error.message}`)
    }
  })
  return { readings, checkup: backup.checkup }
}

function csvCell(value) {
  let text = String(value ?? '')
  if (/^(\s*[=+\-@＝＋－＠]|[\t\r\n])/.test(text)) text = "'" + text
  return '"' + text.replaceAll('"', '""') + '"'
}

export function makeCsv(readings) {
  const header = ['Recorded local time', 'UTC offset (minutes)', 'Timestamp UTC', 'Systolic (mmHg)',
    'Diastolic (mmHg)', 'Pulse (BPM)', 'Category', 'Arm', 'Period', 'Context tags', 'Notes',
    'Emergency symptoms reported', 'Session ID']
  const rows = readings.map(reading => [
    recordedLocal(reading), reading.offset, reading.at, reading.systolic, reading.diastolic, reading.pulse,
    CATEGORIES[classify(reading)], reading.arm, reading.period, reading.tags.join('; '), reading.notes,
    reading.emergency ? 'Yes' : 'No', reading.sessionId,
  ])
  return '\ufeff' + [header, ...rows].map(row => row.map(value => typeof value === 'number' ? value : csvCell(value)).join(',')).join('\r\n')
}

export function download(content, name, type) {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
