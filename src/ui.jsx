import { useEffect, useRef, useState } from 'react'
import { Activity, AlertTriangle, CircleHelp, X } from 'lucide-react'
import {
  CATEGORIES, classify, dateLabel, emergencySymptoms, isLow, plotData, readingDay, readingLabel,
} from './measurements.js'

export function Badge({ reading }) {
  const category = classify(reading)
  return <span className={`badge ${category}`}>{CATEGORIES[category]}</span>
}

export function Safety({ reading, live = false }) {
  const severe = classify(reading) === 'severe'
  const low = isLow(reading)
  if (!reading.emergency && !severe && !low) return null
  return <div className={`notice ${severe || reading.emergency ? 'urgent' : ''}`} role={live ? 'alert' : undefined}>
    <AlertTriangle aria-hidden="true" />
    <div>
      {reading.emergency ? <>
        <strong>Call emergency services now (911 in the U.S.).</strong>
        <p>If these symptoms are happening now, get emergency help immediately. If you’re logging past symptoms, this warning applies if they recur.</p>
      </> : severe ? <>
        <strong>This reading is in the severe range.</strong>
        <p>If this just happened and you have {emergencySymptoms}, call emergency services immediately (911 in the U.S.). Otherwise, wait at least one minute and measure again. If the repeat reading is still above 180 systolic or 120 diastolic, contact your healthcare professional right away.</p>
      </> : null}
      {low && <p>One or both values are low. If you feel dizzy, nauseated, or otherwise unwell, contact your healthcare professional.</p>}
    </div>
  </div>
}

export function Dialog({ title, children, close }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement
    dialog.showModal()
    return () => {
      dialog.close()
      if (previous?.isConnected) previous.focus()
      else document.querySelector('main h1')?.focus()
    }
  }, [])
  return <dialog ref={ref} aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); close() }}>
    <header className="panel-heading"><h2 id="dialog-title">{title}</h2>
      <button className="icon-button" type="button" aria-label="Close dialog" onClick={close}><X aria-hidden="true" /></button>
    </header>
    {children}
  </dialog>
}

export function Empty({ icon: Icon = Activity, title, children, action }) {
  return <div className="empty">
    <span className="icon-tile"><Icon aria-hidden="true" /></span>
    <strong>{title}</strong>
    {children && <p>{children}</p>}
    {action}
  </div>
}

export function RangeFields({ from, to, setFrom, setTo }) {
  return <>
    <label>From<input type="date" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} /></label>
    <label>Through<input type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} /></label>
  </>
}

const SERIES = { systolic: 'Systolic', diastolic: 'Diastolic', pulse: 'Pulse' }

export function TrendChart({ readings, pulse = false }) {
  const [active, setActive] = useState(null)
  const fields = pulse ? ['pulse'] : ['systolic', 'diastolic']
  const plot = plotData(readings, fields)
  if (!plot) return <Empty title={pulse ? 'No pulse readings yet' : 'No trend data yet'}>
    {pulse ? 'Add pulse to a reading to see it here.' : 'Log a reading to start tracking changes over time.'}
  </Empty>
  const { points, min, max } = plot
  const selected = points.find(({ reading }) => reading.id === active) ?? points.at(-1)
  const x = point => 8 + point.x * 264
  const y = value => 8 + (max - value) / (max - min) * 126
  const unit = pulse ? 'BPM' : 'mmHg'
  const ticks = Array.from({ length: 5 }, (_, index) => Math.round(max - (max - min) * index / 4))
  const firstDay = readingDay(points[0].reading)
  const lastDay = readingDay(points.at(-1).reading)
  const shortDate = day => dateLabel(day, { month: 'short', day: 'numeric' })
  return <div className="chart">
    <div className="chart-legend">{fields.map(field => <span key={field}><i className={field} />{SERIES[field]}</span>)}<span>{unit}</span></div>
    <div className="chart-body">
      <div className="chart-scale" aria-hidden="true">{ticks.map((tick, index) => <span key={index}>{tick}</span>)}</div>
      <svg viewBox="0 0 280 142" preserveAspectRatio="none" className="chart-svg" role="img" aria-label={`${pulse ? 'Pulse' : 'Blood pressure'} by measurement time`}
        onPointerMove={event => {
          const bounds = event.currentTarget.getBoundingClientRect()
          const position = ((event.clientX - bounds.left) / bounds.width * 280 - 8) / 264
          const nearest = points.reduce((best, point) => Math.abs(point.x - position) < Math.abs(best.x - position) ? point : best)
          setActive(nearest.reading.id)
        }}>
        {ticks.map((_, index) => <line key={index} className="gridline" x1="8" x2="272" y1={8 + index * 31.5} y2={8 + index * 31.5} />)}
        <line className="cursorline" x1={x(selected)} x2={x(selected)} y1="8" y2="134" />
        {fields.map(field => {
          const available = points.filter(({ reading }) => reading[field] != null)
          return <g key={field} className={field}>
            <polyline points={available.map(point => `${x(point)},${y(point.reading[field])}`).join(' ')} />
            {available.map(point => <ellipse key={point.reading.id} cx={x(point)} cy={y(point.reading[field])} rx={point === selected ? 3.6 : 2} ry={point === selected ? 3.6 : 2} />)}
          </g>
        })}
      </svg>
    </div>
    <div className="chart-dates"><span>{shortDate(firstDay)}</span>{firstDay !== lastDay && <span>{shortDate(lastDay)}</span>}</div>
    <label className="chart-picker">Inspect reading
      <select value={selected.reading.id} onChange={event => setActive(event.target.value)}>
        {points.map(({ reading }, index) => <option key={reading.id} value={reading.id}>
          {index + 1}. {readingLabel(reading)} · {pulse ? `${reading.pulse} BPM` : `${reading.systolic}/${reading.diastolic} mmHg`}
        </option>)}
      </select>
    </label>
  </div>
}

export function InfoLink({ go }) {
  return <button className="text-button" type="button" onClick={go}><CircleHelp aria-hidden="true" /> Understanding your readings</button>
}
