import { useState } from 'react'
import { Activity, CalendarDays, ChartNoAxesCombined, Check, ClipboardList, Moon, Pencil, Search, Sun, Trash2 } from 'lucide-react'
import { LogButton, Metric, NoReadings, PageHeader, TrendSummary } from './Dashboard.jsx'
import {
  averages, CATEGORIES, checkupSummary, classify, dateLabel, dayKey, displayAverage, displayNumber, inRange,
  offsetLabel, PERIODS, readingDay, readingLabel, recent, sessionCount,
} from './measurements.js'
import { Badge, Empty, RangeFields, TrendChart } from './ui.jsx'

function ReadingRow({ reading, edit, remove }) {
  return <article className="reading-row">
    <div className="reading-numbers"><strong>{reading.systolic}/{reading.diastolic}</strong><small>mmHg</small></div>
    <div className="reading-details">
      <div className="reading-meta"><time dateTime={reading.at}>{readingLabel(reading)}</time><small>{offsetLabel(reading.offset)}</small><Badge reading={reading} /></div>
      <p>{reading.period} · {reading.arm} arm{reading.pulse == null ? '' : ` · ${reading.pulse} BPM`}</p>
      {(reading.tags.length > 0 || reading.emergency) && <div className="tags">{reading.tags.map(tag => <span key={tag}>{tag}</span>)}{reading.emergency && <span>Warning symptoms recorded</span>}</div>}
      {reading.notes && <p className="reading-notes">{reading.notes}</p>}
    </div>
    <div className="row-actions">
      <button className="icon-button" aria-label={`Edit reading from ${readingLabel(reading)}`} onClick={() => edit(reading)}><Pencil aria-hidden="true" /></button>
      <button className="icon-button" aria-label={`Delete reading from ${readingLabel(reading)}`} onClick={() => remove(reading)}><Trash2 aria-hidden="true" /></button>
    </div>
  </article>
}

export function History({ data, log, edit, remove, headingRef }) {
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [period, setPeriod] = useState('')
  const [category, setCategory] = useState('')
  const sessions = new Map(data.sessions.map(session => [session.id, session]))
  const match = query.trim().toLowerCase()
  const invalidRange = from && to && from > to
  const readings = invalidRange ? [] : inRange(data.readings, from, to).filter(reading => {
    const classification = classify(reading)
    const searchable = [reading.notes, ...reading.tags, reading.period, reading.arm, CATEGORIES[classification],
      readingLabel(reading), readingDay(reading), `${reading.systolic}/${reading.diastolic}`, reading.pulse]
      .join(' ').toLowerCase()
    return (!period || reading.period === period) && (!category || classification === category) && searchable.includes(match)
  })
  const groups = new Map()
  for (const reading of readings) {
    const key = reading.sessionId ? `session-${reading.sessionId}` : `reading-${reading.id}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(reading)
  }
  return <>
    <PageHeader title="History" headingRef={headingRef} action={<LogButton onClick={log} />}>Find and manage your recorded measurements.</PageHeader>
    <section className="card filter-card" aria-label="Filter readings">
      <label className="search-field">Search
        <span><Search aria-hidden="true" /><input type="search" value={query} placeholder="Search notes, tags, or values" onChange={event => setQuery(event.target.value)} /></span>
      </label>
      <div className="filter-grid">
        <RangeFields {...{ from, to, setFrom, setTo }} />
        <label>Time of day<select value={period} onChange={event => setPeriod(event.target.value)}><option value="">All times</option>{PERIODS.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Category<select value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{Object.entries(CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      {invalidRange && <p className="field-error" role="alert">The start date must be on or before the end date.</p>}
    </section>
    <section className="card history-list" aria-label="Recorded measurements">
      {!data.readings.length ? <NoReadings log={log} history /> : !readings.length ? <Empty icon={Search} title="No matching readings">Change your search or filters to see more readings.</Empty> : <>
        <div className="results" role="status">{readings.length} {readings.length === 1 ? 'reading' : 'readings'}</div>
        {[...groups.entries()].map(([key, entries]) => {
          const session = sessions.get(entries[0].sessionId)
          return <div className={session ? 'reading-group' : undefined} key={key}>
            {session && <div className="group-heading"><strong>Guided session</strong><span>Full session average {displayAverage(session.average)} mmHg · {session.count} {session.count === 1 ? 'reading' : 'readings'}</span></div>}
            {entries.map(reading => <ReadingRow key={reading.id} {...{ reading, edit, remove }} />)}
          </div>
        })}
      </>}
    </section>
  </>
}

export function Insights({ readings, headingRef, today }) {
  const [windowDays, setWindowDays] = useState(30)
  const entries = recent(readings, windowDays, today)
  const days = new Set(entries.map(readingDay)).size
  return <>
    <PageHeader title="Insights" headingRef={headingRef}>Review averages and patterns across your readings.</PageHeader>
    <div className="metrics">
      {[7, 30, 90].map(days => {
        const values = recent(readings, days, today)
        return <Metric key={days} icon={ChartNoAxesCombined} title={`${days}-day average`} unit="mmHg"
          value={displayAverage(averages(values))} detail={`${values.length} ${values.length === 1 ? 'reading' : 'readings'}`} />
      })}
    </div>
    <section className="card insights-card">
      <header className="panel-heading"><div><h2>Blood pressure trend</h2><p>Recent readings by measurement time</p></div>
        <div className="segments" role="group" aria-label="Insights period">{[7, 30, 90].map(days =>
          <button key={days} aria-pressed={windowDays === days} onClick={() => setWindowDays(days)}>{days}D</button>)}</div>
      </header>
      <TrendChart readings={entries} /><TrendSummary readings={entries} />
    </section>
    <div className="content-grid">
      <section className="card insights-card"><h2>Morning and evening</h2><p className="muted">Last {windowDays} days · averages in mmHg</p>
        {PERIODS.map(period => {
          const group = entries.filter(reading => reading.period === period)
          const Icon = period === 'Morning' ? Sun : Moon
          return <div className="comparison" key={period}><Icon aria-hidden="true" /><div><strong>{period}</strong><small>{group.length} {group.length === 1 ? 'reading' : 'readings'}</small></div><strong>{displayAverage(averages(group))}</strong></div>
        })}
        <p className="muted">{entries.length ? `${sessionCount(entries)} sessions on ${days} of the past ${windowDays} days.` : 'Record a reading to see measurement frequency.'}</p>
      </section>
      <section className="card insights-card"><h2>Pulse trend</h2><p className="muted">Last {windowDays} days{averages(entries)?.pulse != null ? ` · Average ${displayNumber(averages(entries).pulse)} BPM` : ''}</p>
        <TrendChart readings={entries} pulse />
      </section>
    </div>
  </>
}

export function Checkup({ readings, start, saveStart, reset, log, guided, headingRef, today = dayKey() }) {
  const summary = start && checkupSummary(readings, start)
  const ended = summary && today > summary.days.at(-1).date
  const active = summary && !ended && summary.completed < 14
  const track = (period, type) => type === 'guided' ? guided({ period }) : log({ period })
  return <>
    <PageHeader title="7-day checkup" headingRef={headingRef}>Build a record of morning and evening sessions to share with your healthcare professional.</PageHeader>
    {!summary ? <section className="card">
      <Empty icon={CalendarDays} title="Start a seven-day checkup" action={<button className="primary" onClick={() => saveStart(today)}>Start today</button>}>
        Aim for one session each morning and evening. Readings logged during the seven days count automatically.
      </Empty>
    </section> : <>
      <section className="card insights-card">
        <header className="panel-heading"><div><h2>{active ? 'Your progress' : 'Checkup complete'}</h2>
          <p>{dateLabel(start)} – {dateLabel(summary.days.at(-1).date)}</p></div>
          <span className="badge normal">{summary.completed} of 14 slots</span>
        </header>
        <progress aria-label="Checkup progress" max="14" value={summary.completed} />
        <div className="checkup-days">{summary.days.map(day => <div key={day.date} className="checkup-day">
          <strong>{dateLabel(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
          {day.periods.map((done, index) => <div key={PERIODS[index]} className={done ? 'done' : ''}>
            {done ? <Check aria-hidden="true" /> : index === 0 ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            <span>{PERIODS[index]} <small>{done ? 'Logged' : 'Open'}</small></span>
          </div>)}
        </div>)}</div>
        {active && <div className="actions">
          <button className="primary" onClick={() => track(Number(new Date().getHours()) < 12 ? 'Morning' : 'Evening', 'guided')}>Start guided session</button>
          {PERIODS.map(period => <button key={period} onClick={() => track(period, 'manual')}>Log {period.toLowerCase()} reading</button>)}
        </div>}
      </section>
      <div className="metrics">
        <Metric icon={ChartNoAxesCombined} title="Checkup average" value={displayAverage(summary.average)} unit="mmHg" detail="Across individual readings" />
        <Metric icon={Activity} title="Readings" value={summary.count} detail="Recorded during the checkup" />
        <Metric icon={CalendarDays} title="Sessions" value={summary.sessions} detail="Recorded during the checkup" />
      </div>
      <section className="card insights-card"><header className="panel-heading"><h2><ClipboardList aria-hidden="true" /> Checkup summary</h2>
        <button onClick={reset}>{active ? 'End checkup' : 'Clear checkup'}</button></header>
        <TrendSummary readings={summary.entries} />
        {summary.entries.length > 0 && <TrendChart readings={summary.entries} />}
      </section>
    </>}
  </>
}
