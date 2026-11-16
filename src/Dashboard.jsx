import { useState } from 'react'
import { Activity, ArrowRight, CalendarDays, ChartNoAxesCombined, HeartPulse, Plus, ShieldCheck, Timer } from 'lucide-react'
import { averages, dateLabel, dayKey, displayAverage, readingLabel, recent, sessionCount } from './measurements.js'
import { Badge, Empty, Safety, TrendChart } from './ui.jsx'

const windows = [7, 30, 90]

export function PageHeader({ eyebrow, title, children, action, headingRef }) {
  return <header className="page-heading">
    <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1 tabIndex="-1" ref={headingRef}>{title}</h1>
      {children && <p className="page-description">{children}</p>}</div>
    {action}
  </header>
}

export function Metric({ icon: Icon, title, value, unit, detail }) {
  return <section className="metric card">
    <div className="metric-top"><span className="icon-tile"><Icon aria-hidden="true" /></span><h2>{title}</h2></div>
    <div className="metric-number">{value}{unit && <small>{unit}</small>}</div>
    <p>{detail}</p>
  </section>
}

function TrendPanel({ readings, today }) {
  const [period, setPeriod] = useState(7)
  return <section className="card trend-card">
    <header className="panel-heading"><div><h2>Blood pressure trend</h2><p>Systolic and diastolic over time</p></div>
      <div className="segments" role="group" aria-label="Trend period">{windows.map(days =>
        <button type="button" key={days} aria-pressed={period === days} onClick={() => setPeriod(days)}>{days}D</button>)}</div>
    </header>
    <TrendChart readings={recent(readings, period, today)} />
  </section>
}

function QuickActions({ guided, navigate, hasCheckup }) {
  return <section className="card quick-card">
    <header><h2>Quick actions</h2><p>Build a routine that works for you.</p></header>
    <button className="quick-action" onClick={guided}>
      <span className="icon-tile"><Timer aria-hidden="true" /></span>
      <span><strong>Guided measurement</strong><small>Rest, measure, and log two readings.</small></span>
      <ArrowRight aria-hidden="true" />
    </button>
    <button className="quick-action" onClick={() => navigate('checkup')}>
      <span className="icon-tile aqua"><CalendarDays aria-hidden="true" /></span>
      <span><strong>7-day checkup</strong><small>{hasCheckup ? 'See your tracking progress.' : 'Track morning and evening readings.'}</small></span>
      <ArrowRight aria-hidden="true" />
    </button>
    <div className="private-note"><ShieldCheck aria-hidden="true" /><span><strong>Private by design</strong><small>Your readings stay on this device.</small></span></div>
  </section>
}

export function LogButton({ onClick }) {
  return <button className="primary log-button" onClick={onClick}><Plus aria-hidden="true" /> Log a reading</button>
}

export default function Dashboard({ readings, log, guided, navigate, headingRef, checkup, today = dayKey() }) {
  const latest = readings[0]
  const week = recent(readings, 7, today)
  return <>
    <PageHeader eyebrow={dateLabel(today, { weekday: 'long', month: 'long', day: 'numeric' })} title="Overview" action={<LogButton onClick={log} />} headingRef={headingRef}>
      Your blood pressure, at a glance.
    </PageHeader>
    <section className="latest">
      <svg viewBox="0 0 470 235" className="hero-art" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <defs><pattern id="monitor-grid" width="33" height="33" patternUnits="userSpaceOnUse"><path d="M 33 0 L 0 0 0 33" fill="none" stroke="white" strokeOpacity=".18" /></pattern>
          <linearGradient id="trace"><stop stopColor="#a2dcff" stopOpacity="0" /><stop offset=".28" stopColor="#a2dcff" stopOpacity=".46" /><stop offset=".76" stopColor="#c1ecff" stopOpacity=".95" /><stop offset="1" stopColor="#b1e6ff" stopOpacity=".12" /></linearGradient></defs>
        <rect width="470" height="235" fill="url(#monitor-grid)" />
        <path d="M0 143H109l21-21 18 21h37l19 25 31-105 25 119 25-39h45l20-23 21 23h99" fill="none" stroke="url(#trace)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="latest-content">
        <div className="latest-label"><span className="icon-tile"><HeartPulse aria-hidden="true" /></span><h2>Latest blood pressure</h2></div>
        <div className={`latest-values ${latest ? '' : 'unrecorded'}`}>{latest ? <><span>{latest.systolic}</span><span className="slash">/</span><span>{latest.diastolic}</span></> : <span aria-label="No measurement">— / —</span>} <small>mmHg</small></div>
        {latest ? <div className="latest-meta"><Badge reading={latest} /><span>{readingLabel(latest)}</span></div>
          : <><strong className="latest-empty">No readings yet</strong><p>Log your first reading to begin.</p></>}
      </div>
    </section>
    {latest && <Safety reading={latest} />}
    <div className="metrics">
      <Metric icon={ChartNoAxesCombined} title="7-day average" value={displayAverage(averages(week))} unit="mmHg"
        detail={week.length ? `Based on ${week.length} ${week.length === 1 ? 'reading' : 'readings'}` : 'No readings this week'} />
      <Metric icon={Activity} title="Latest pulse" value={latest?.pulse ?? '—'} unit="BPM"
        detail={latest?.pulse != null ? 'From your latest reading' : 'Optional with each reading'} />
      <Metric icon={CalendarDays} title="Measurement sessions" value={sessionCount(readings)}
        detail={readings.length ? `${readings.length} total ${readings.length === 1 ? 'reading' : 'readings'}` : 'Across all recorded readings'} />
    </div>
    <div className="dashboard-lower">
      <TrendPanel readings={readings} today={today} />
      <QuickActions guided={guided} navigate={navigate} hasCheckup={Boolean(checkup)} />
    </div>
  </>
}

export function TrendSummary({ readings }) {
  const entries = [...readings].sort((a, b) => a.at.localeCompare(b.at))
  if (entries.length < 2) return <p className="muted">At least two readings are needed to compare measurements.</p>
  const earlier = entries[0]
  const later = entries.at(-1)
  const describe = (label, difference) => difference === 0 ? `${label} stayed the same` :
    `${label} was ${Math.abs(difference)} mmHg ${difference > 0 ? 'higher' : 'lower'}`
  return <p className="muted">From the first reading to the latest in this period, {describe('systolic', later.systolic - earlier.systolic)} and {describe('diastolic', later.diastolic - earlier.diastolic)}.</p>
}

export function NoReadings({ log, history = false }) {
  return <Empty title={history ? 'Your history is empty' : 'No readings in this period'} action={log && <LogButton onClick={log} />}>
    {history ? 'Readings you log will appear here.' : 'Choose a different date range or add a reading.'}
  </Empty>
}
