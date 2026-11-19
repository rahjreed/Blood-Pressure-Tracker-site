import { haptic, supportsHaptics } from './haptics.js'
import { useEffect, useRef, useState } from 'react'
import { Bell, Download, FileText, HardDrive, Info, LockKeyhole, Monitor, ShieldCheck, Upload } from 'lucide-react'
import { download, makeBackup, makeCsv, maxBackupBytes, readBackup } from './backups.js'
import { PageHeader } from './Dashboard.jsx'
import {
  averages, CATEGORIES, dayKey, displayAverage, displayNumber, inRange, offsetLabel, readingLabel, sessionCount, SOURCES,
} from './measurements.js'
import { createReport, reportNote, reportPeriod } from './report.js'
import { Dialog, Empty, RangeFields, TrendChart } from './ui.jsx'

export function Reports({ readings, headingRef }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [patient, setPatient] = useState('')
  const [preview, setPreview] = useState(null)
  const [pending, setPending] = useState(false)
  const [reportError, setReportError] = useState('')
  const [downloaded, setDownloaded] = useState(false)
  const invalidRange = from && to && from > to
  const entries = invalidRange ? [] : inRange(readings, from, to)
  async function saveReport() {
    setPending(true)
    setReportError('')
    setDownloaded(false)
    try {
      download(await createReport(preview), `pressure-report-${dayKey()}.pdf`, 'application/pdf')
      setDownloaded(true)
    } catch {
      setReportError('The PDF could not be generated. Try again.')
    } finally {
      setPending(false)
    }
  }
  return <>
    <PageHeader title="Reports" headingRef={headingRef}>Prepare a blood pressure record to share at your next appointment.</PageHeader>
    <section className="card settings-card">
      <header className="section-intro"><span className="icon-tile"><FileText aria-hidden="true" /></span><div><h2>Blood pressure report</h2><p>Include all readings or choose a date range.</p></div></header>
      <label>Patient name <small>Optional</small><input value={patient} maxLength={100} autoComplete="off" onChange={event => setPatient(event.target.value)} /></label>
      <div className="form-grid"><RangeFields {...{ from, to, setFrom, setTo }} /></div>
      {invalidRange && <p className="field-error" role="alert">The start date must be on or before the end date.</p>}
      {entries.length > 0 ? <>
        <p className="muted">{entries.length} {entries.length === 1 ? 'reading' : 'readings'} in range</p>
        <div className="actions"><button className="primary" onClick={() => {
          setReportError('')
          setDownloaded(false)
          setPreview({ readings: entries, patient: patient.trim(), from, to })
        }}>
          <FileText aria-hidden="true" /> Preview report</button>
          <button onClick={() => download(makeCsv(entries), `pressure-readings-${dayKey()}.csv`, 'text/csv;charset=utf-8')}><Download aria-hidden="true" /> Export CSV</button>
        </div>
      </> : <p className="muted">{readings.length ? 'No readings in this range.' : 'Log a reading to create a report.'}</p>}
    </section>
    {preview && <Dialog title="Report preview" close={() => { if (!pending) setPreview(null) }}>
      <ReportPreview report={preview} />
      {reportError && <p className="field-error" role="alert">{reportError}</p>}
      {downloaded && <p className="muted" role="status">PDF report prepared.</p>}
      <div className="actions end">
        <button disabled={pending} onClick={() => setPreview(null)}>Close preview</button>
        <button disabled={pending} className="primary" onClick={saveReport}><Download aria-hidden="true" /> {pending ? 'Preparing PDF…' : 'Download PDF'}</button>
      </div>
    </Dialog>}
  </>
}

function ReportPreview({ report }) {
  const { readings, patient } = report
  const average = averages(readings)
  return <section className="report-preview">
    <h3>Blood pressure report</h3>
    {patient && <p>Patient: {patient}</p>}
    <p>{reportPeriod(report)}</p>
    <p><strong>Average {displayAverage(average)} mmHg</strong> · {readings.length} readings · {sessionCount(readings)} sessions</p>
    {average?.pulse != null && <p>Average pulse {displayNumber(average.pulse)} BPM</p>}
    <p className="muted">{reportNote}</p>
    <h3>Blood pressure trend</h3><TrendChart readings={readings} />
    {average?.pulse != null && <><h3>Pulse trend</h3><TrendChart readings={readings} pulse /></>}
    <h3>Measurement log</h3>
    {readings.slice().reverse().map(reading => <article className="report-entry" key={reading.id}>
      <div><strong>{reading.systolic}/{reading.diastolic} mmHg</strong>{reading.pulse != null && ` · ${reading.pulse} BPM`}</div>
      <p>{readingLabel(reading)} · {offsetLabel(reading.offset)} · {reading.period} · {reading.arm} arm</p>
      {reading.tags.length > 0 && <p>{reading.tags.join(', ')}</p>}
      {reading.emergency && <p>Warning symptoms reported.</p>}
      {reading.notes && <p className="reading-notes">{reading.notes}</p>}
    </article>)}
  </section>
}

const categories = [
  ['normal', 'Below 120 and below 80'],
  ['elevated', '120–129 and below 80'],
  ['stage1', '130–139 or 80–89'],
  ['stage2', '140 or higher, or 90 or higher'],
  ['severe', 'Above 180 or above 120'],
  ['low', 'A low-value flag applies below 90 systolic or 60 diastolic'],
]

export function About({ headingRef }) {
  return <>
    <PageHeader title="Understanding your readings" headingRef={headingRef}>About PRESSURE and the guidance used in the app.</PageHeader>
    <section className="card settings-card">
      <h2>Adult blood pressure categories</h2>
      <p>Values are shown in systolic / diastolic order, in mmHg. When the values fall into different high ranges, PRESSURE displays the higher category. A separate warning appears for any low value. Only a healthcare professional can diagnose a condition. These thresholds are intended for adults and may differ during pregnancy.</p>
      <dl className="category-table">{categories.map(([key, threshold]) => <div key={key}><dt><span className={`badge ${key}`}>{CATEGORIES[key]}</span></dt><dd>{threshold}</dd></div>)}</dl>
      <ul className="source-links">
        <li><a href={SOURCES.categories}>American Heart Association — Understanding blood pressure readings</a></li>
        <li><a href={SOURCES.home}>American Heart Association — How to measure at home</a></li>
        <li><a href={SOURCES.low}>American Heart Association — When blood pressure is too low</a></li>
      </ul>
    </section>
    <section className="card settings-card"><h2>PRESSURE by Callista Digital</h2><p>A free, account-free utility for keeping a personal blood pressure record. Follow your healthcare professional’s measurement instructions.</p></section>
  </>
}

export function Privacy({ headingRef }) {
  return <>
    <PageHeader title="Privacy" headingRef={headingRef}>Your health record stays in your browser.</PageHeader>
    <section className="card settings-card">
      <header className="section-intro"><span className="icon-tile"><ShieldCheck aria-hidden="true" /></span><h2>Local storage</h2></header>
      <p>Readings, notes, checkup progress, and settings are stored in this browser’s IndexedDB. PRESSURE has no account system, advertising trackers, or measurement analytics. The website host receives standard requests for app files. Measurements and report details are never included in those requests.</p>
      <p>Storage is tied to this site and browser profile. Clearing website data, using a private window, switching browsers, changing the site address, or resetting a device may remove or hide your record. Export a JSON backup to move or restore readings and checkup progress.</p>
      <p>Anyone with access to this browser profile can open your record. CSV, JSON, and PDF files can contain sensitive health details. Save and share them with care.</p>
    </section>
  </>
}

export function Settings({ data, headingRef, saveSettings, merge, clear, navigate, notify, install }) {
  const [backup, setBackup] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [pending, setPending] = useState(false)
  const [operationError, setOperationError] = useState('')
  const [reminders, setReminders] = useState({ morning: data.settings.morning, evening: data.settings.evening })
  const file = useRef(null)
  const { theme } = data.settings
  async function readFile(event) {
    const selection = event.target.files[0]
    event.target.value = ''
    if (!selection) return
    try {
      if (selection.size > maxBackupBytes) throw new Error('Choose a JSON backup smaller than 15 MB.')
      setOperationError('')
      setBackup(readBackup(await selection.text()))
    } catch (error) {
      notify(error.message, true)
    }
  }
  return <>
    <PageHeader title="Settings" headingRef={headingRef}>Manage your preferences and local data.</PageHeader>
    <div className="content-grid">
      <section className="card settings-card">
        <header className="section-intro"><span className="icon-tile"><Monitor aria-hidden="true" /></span><h2>Appearance</h2></header>
        <label>Theme<select value={theme} onChange={event => saveSettings({ theme: event.target.value })}><option>System</option><option>Light</option><option>Dark</option></select></label>
      </section>
      <section className="card settings-card">
        <h2>Haptic feedback</h2>
        <p>Subtle vibrations for actions and timer completion on supported devices.</p>
        <label>Vibration<select value={data.settings.haptics ? 'On' : 'Off'} onChange={async event => {
          const enabled = event.target.value === 'On'
          if (!enabled && supportsHaptics()) { try { navigator.vibrate(0) } catch { /* Optional feedback. */ } }
          if (await saveSettings({ haptics: enabled }) && enabled) haptic('tap', true)
        }}><option>On</option><option>Off</option></select></label>
        {supportsHaptics() ? <button data-haptic="custom" disabled={!data.settings.haptics} onClick={() => haptic('success', true)}>Test vibration</button> : <p className="muted">Vibration is not available in this browser.</p>}
      </section>
      <section className="card settings-card">
        <header className="section-intro"><span className="icon-tile"><Download aria-hidden="true" /></span><h2>Install PRESSURE</h2></header>
        <p>Open your browser’s menu and choose Install app or Add to Home Screen. On iPhone, use Safari’s Share menu and tap Add to Home Screen.</p>
        {install && <button onClick={install}>Install app</button>}
      </section>
    </div>
    <section className="card settings-card">
      <header className="section-intro"><span className="icon-tile"><Bell aria-hidden="true" /></span><div><h2>Reminders</h2><p>Reminders appear while you’re using PRESSURE. Leave a time blank to turn it off.</p></div></header>
      <form className="form-stack" onSubmit={async event => {
        event.preventDefault()
        if (await saveSettings(reminders)) notify('Reminder preferences saved.')
      }}>
        <div className="form-grid">
          <label>Morning reminder<input type="time" max="11:59" value={reminders.morning} onChange={event => setReminders({ ...reminders, morning: event.target.value })} /></label>
          <label>Evening reminder<input type="time" min="12:00" value={reminders.evening} onChange={event => setReminders({ ...reminders, evening: event.target.value })} /></label>
        </div>
        <div><button type="submit">Save reminders</button></div>
      </form>
    </section>
    <section className="card settings-card">
      <header className="section-intro"><span className="icon-tile"><HardDrive aria-hidden="true" /></span><div><h2>Data and backups</h2><p>Keep a JSON backup in case you clear your browser data or switch devices.</p></div></header>
      <div className="actions">
        <button onClick={() => download(makeBackup(data), `pressure-backup-${dayKey()}.json`, 'application/json')}><Download aria-hidden="true" /> Download JSON backup</button>
        <button onClick={() => file.current.click()}><Upload aria-hidden="true" /> Import JSON backup</button>
        <button onClick={() => navigate('reports')}><FileText aria-hidden="true" /> PDF and CSV exports</button>
        <input ref={file} type="file" accept=".json,application/json" onChange={readFile} hidden />
      </div>
    </section>
    <section className="card settings-card">
      <header className="section-intro"><span className="icon-tile"><Info aria-hidden="true" /></span><h2>About and privacy</h2></header>
      <div className="actions"><button onClick={() => navigate('about')}>About PRESSURE</button><button onClick={() => navigate('privacy')}><LockKeyhole aria-hidden="true" /> Privacy information</button></div>
    </section>
    <section className="card settings-card">
      <h2>Clear all data</h2><p>Delete all readings, checkup progress, and preferences stored by this app on this browser.</p>
      <div><button className="danger" onClick={() => { setOperationError(''); setConfirmClear(true) }}>Clear all data</button></div>
    </section>
    {backup && <Dialog title="Import backup?" close={() => { if (!pending) setBackup(null) }}>
      <p>This backup contains {backup.readings.length} {backup.readings.length === 1 ? 'reading' : 'readings'}. New readings will be added. Existing IDs will be skipped, and your current checkup takes priority.</p>
      {operationError && <p className="field-error" role="alert">{operationError}</p>}
      <div className="actions end"><button disabled={pending} onClick={() => setBackup(null)}>Cancel</button>
        <button className="primary" disabled={pending} onClick={async () => {
          setPending(true)
          if (await merge(backup)) setBackup(null)
          else setOperationError('Import could not be saved. Try again.')
          setPending(false)
        }}>Import readings</button></div>
    </Dialog>}
    {confirmClear && <Dialog title="Permanently clear local data?" close={() => { if (!pending) setConfirmClear(false) }}>
      <p>All readings, checkup progress, and preferences will be removed from this browser. A saved JSON backup is required to restore deleted readings.</p>
      {operationError && <p className="field-error" role="alert">{operationError}</p>}
      <div className="actions end"><button disabled={pending} autoFocus onClick={() => setConfirmClear(false)}>Cancel</button>
        <button className="danger" disabled={pending} onClick={async () => {
          setPending(true)
          if (await clear()) {
            setConfirmClear(false)
            setReminders({ morning: '', evening: '' })
          } else setOperationError('Local data could not be cleared. Try again.')
          setPending(false)
        }}>Yes, clear all data</button></div>
    </Dialog>}
  </>
}

export function Reminder({ settings, readings, onLog }) {
  const [now, setNow] = useState(() => new Date())
  const [dismissed, setDismissed] = useState('')
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 20_000)
    return () => window.clearInterval(timer)
  }, [])
  const date = dayKey(now)
  const period = now.getHours() < 12 ? 'Morning' : 'Evening'
  const time = settings[period.toLowerCase()]
  const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const key = date + period
  const seen = inRange(readings, date, date).some(reading => reading.period === period)
  if (!time || current < time || seen || dismissed === key) return null
  return <section className="notice reminder"><Bell aria-hidden="true" /><div><strong>{period} reminder</strong><p>It’s time to log your reading.</p></div>
    <button onClick={() => onLog({ period })}>Log now</button><button onClick={() => setDismissed(key)}>Dismiss</button></section>
}

export function StorageError() {
  return <section className="card"><Empty icon={HardDrive} title="Local storage is unavailable">
    Reload PRESSURE in a browser profile that allows website storage to access your readings.
  </Empty></section>
}
