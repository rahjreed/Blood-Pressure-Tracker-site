export const TAGS = ['Coffee', 'Exercise', 'Stress', 'Poor sleep', 'Medication', 'Symptoms']
export const PERIODS = ['Morning', 'Evening']
export const CATEGORIES = {
  normal: 'Normal', elevated: 'Elevated', stage1: 'Stage 1 high', stage2: 'Stage 2 high',
  severe: 'Severe range', low: 'Low reading',
}

export const SOURCES = {
  categories: 'https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings',
  home: 'https://www.heart.org/en/health-topics/house-calls/how-to-measure-your-blood-pressure-at-home',
  low: 'https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/low-blood-pressure-when-blood-pressure-is-too-low',
}

export function classify({ systolic, diastolic }) {
  if (systolic > 180 || diastolic > 120) return 'severe'
  if (systolic >= 140 || diastolic >= 90) return 'stage2'
  if (systolic >= 130 || diastolic >= 80) return 'stage1'
  if (isLow({ systolic, diastolic })) return 'low'
  if (systolic >= 120) return 'elevated'
  return 'normal'
}

export function isLow({ systolic, diastolic }) {
  return systolic < 90 || diastolic < 60
}

export const emergencySymptoms = 'chest pain, trouble breathing, back pain, numbness, weakness, vision changes, or difficulty speaking'

export function localInput(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return shifted.toISOString().slice(0, 16)
}

export function dayKey(date = new Date()) {
  return localInput(date).slice(0, 10)
}

export function shiftDay(day, offset) {
  const date = new Date(day + 'T12:00:00Z')
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

export function isDay(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(day)) return false
  const date = new Date(day + 'T00:00:00Z')
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === day
}

export function recordedLocal(reading) {
  return new Date(Date.parse(reading.at) + reading.offset * 60_000).toISOString().slice(0, 16)
}

export function readingDay(reading) {
  return recordedLocal(reading).slice(0, 10)
}

export function dateLabel(day, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' })
    .format(new Date(day + 'T12:00:00Z'))
}

export function readingLabel(reading) {
  const local = recordedLocal(reading)
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC',
  }).format(new Date(local + 'Z'))
}

export function offsetLabel(offset) {
  const absolute = Math.abs(offset)
  return `UTC${offset < 0 ? '-' : '+'}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`
}

export function initialReading(reading, defaults = {}) {
  if (reading) return { ...reading, dateTime: recordedLocal(reading), pulse: reading.pulse ?? '' }
  const dateTime = localInput()
  return {
    systolic: '', diastolic: '', pulse: '', dateTime, arm: 'Left', notes: '', tags: [],
    period: Number(dateTime.slice(11, 13)) < 12 ? 'Morning' : 'Evening',
    emergency: false, ...defaults,
  }
}

const LIMITS = {
  systolic: [40, 300], diastolic: [20, 200], pulse: [20, 250],
}

export function validNumber(field, value) {
  const [min, max] = LIMITS[field]
  return Number.isInteger(value) && value >= min && value <= max
}

export function validateDraft(draft, original, now = new Date()) {
  const errors = {}
  const values = {}
  for (const [field, [min, max]] of Object.entries(LIMITS)) {
    const value = draft[field]
    if (field === 'pulse' && value === '') {
      values[field] = null
      continue
    }
    if (!/^\d+$/.test(String(value)) || !validNumber(field, Number(value))) {
      errors[field] = `Enter a whole number between ${min} and ${max}. Check your monitor if this was its actual reading.`
    }
    values[field] = Number(value)
  }
  if (!errors.systolic && !errors.diastolic && values.systolic <= values.diastolic) {
    errors.diastolic = 'Diastolic must be lower than systolic. Check that the two values are in the right fields.'
  }
  const unchanged = original && draft.dateTime === recordedLocal(original)
  const date = new Date(unchanged ? original.at : draft.dateTime)
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(draft.dateTime) ||
      !Number.isFinite(+date) || (!unchanged && localInput(date) !== draft.dateTime) || +date > +now) {
    errors.dateTime = 'Enter a valid local date and time at or before now.'
  }
  if (Object.keys(errors).length) return { errors }
  return {
    errors,
    reading: {
      id: original?.id ?? crypto.randomUUID(), sessionId: original?.sessionId ?? null,
      ...values, at: date.toISOString(), offset: unchanged ? original.offset : -date.getTimezoneOffset(),
      arm: draft.arm, period: draft.period, notes: draft.notes.trim(), tags: draft.tags,
      emergency: draft.emergency,
    },
  }
}

export function chronological(readings) {
  return [...readings].sort((a, b) => a.at.localeCompare(b.at))
}

export function plotData(readings, fields) {
  const entries = chronological(readings).filter(reading => fields.some(field => reading[field] != null))
  if (!entries.length) return null
  const first = Date.parse(entries[0].at)
  const last = Date.parse(entries.at(-1).at)
  let low = Infinity
  let high = -Infinity
  for (const reading of entries) {
    for (const field of fields) {
      if (reading[field] == null) continue
      low = Math.min(low, reading[field])
      high = Math.max(high, reading[field])
    }
  }
  const min = Math.floor((low - 5) / 10) * 10
  const max = Math.ceil((high + 5) / 10) * 10
  const points = entries.map(reading => ({
    reading,
    x: first === last ? 0.5 : (Date.parse(reading.at) - first) / (last - first),
  }))
  return { points, min, max }
}

export function inRange(readings, from, to) {
  return readings.filter(reading => {
    const day = readingDay(reading)
    return (!from || day >= from) && (!to || day <= to)
  })
}

export function recent(readings, days, today = dayKey()) {
  return inRange(readings, shiftDay(today, 1 - days), today)
}

export function averages(readings) {
  if (!readings.length) return null
  const totals = { systolic: 0, diastolic: 0, pulse: 0, pulses: 0 }
  for (const reading of readings) {
    totals.systolic += reading.systolic
    totals.diastolic += reading.diastolic
    if (reading.pulse != null) {
      totals.pulse += reading.pulse
      totals.pulses++
    }
  }
  return {
    systolic: totals.systolic / readings.length,
    diastolic: totals.diastolic / readings.length,
    pulse: totals.pulses ? totals.pulse / totals.pulses : null,
  }
}

export function displayAverage(average) {
  return average ? `${displayNumber(average.systolic)}/${displayNumber(average.diastolic)}` : '—'
}

export const displayNumber = value => Number(value.toFixed(1)).toString()

export function sessionCount(readings) {
  return new Set(readings.map(reading => reading.sessionId ? `session:${reading.sessionId}` : `reading:${reading.id}`)).size
}

export function sessionRecord(id, readings) {
  return { id, average: averages(readings), count: readings.length }
}

export function checkupSummary(readings, start) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDay(start, index)
    const entries = inRange(readings, date, date)
    return { date, periods: PERIODS.map(period => entries.some(entry => entry.period === period)) }
  })
  const entries = inRange(readings, start, days.at(-1).date)
  return {
    days, entries, completed: days.flatMap(day => day.periods).filter(Boolean).length,
    count: entries.length, sessions: sessionCount(entries), average: averages(entries),
  }
}
