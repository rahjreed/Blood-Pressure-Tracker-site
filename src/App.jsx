import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, CalendarDays, ChartNoAxesCombined, ClipboardList, FileText, LayoutGrid, LockKeyhole, Settings as Gear, WifiOff, X } from 'lucide-react'
import Dashboard, { PageHeader } from './Dashboard.jsx'
import { GuidedForm, ReadingForm } from './ReadingForm.jsx'
import { About, Privacy, Reminder, Reports, Settings, StorageError } from './Settings.jsx'
import { Checkup, History, Insights } from './Tracking.jsx'
import { classify, isLow, dayKey, readingLabel } from './measurements.js'
import { haptic } from './haptics.js'
import { openStorage } from './storage.js'
import { Dialog, InfoLink } from './ui.jsx'

const nav = [
  ['overview', 'Overview', LayoutGrid], ['history', 'History', ClipboardList],
  ['insights', 'Insights', ChartNoAxesCombined], ['checkup', '7-day checkup', CalendarDays],
  ['reports', 'Reports', FileText], ['settings', 'Settings', Gear],
]
const routes = new Set([...nav.map(([key]) => key), 'privacy', 'about'])
const currentRoute = () => {
  const key = window.location.hash.slice(1)
  return routes.has(key) ? key : 'overview'
}
const readingFeedback = readings => readings.some(reading => reading.emergency || isLow(reading) || classify(reading) !== 'normal') ? 'warning' : 'success'
const navigate = key => { window.location.hash = key === 'overview' ? '' : key }

function Brand() {
  return <a href="#" className="brand">
    <span className="brand-icon"><Activity aria-hidden="true" /></span>
    <span><strong>PRESSURE</strong><small>Blood Pressure Tracker</small></span>
  </a>
}

function Shell({ route, children, offline, update, haptics }) {
  return <div className="shell" onClick={event => {
    const target = event.target.closest?.('button:not(:disabled), nav a, .brand')
    if (target && !target.matches('[type="submit"], .danger, [data-haptic="custom"]') && !target.closest('form button:not([type="button"])')) haptic('tap', haptics)
  }}>
    <a href="#main" className="skip-link" onClick={event => {
      event.preventDefault()
      document.querySelector('#main h1')?.focus()
    }}>Skip to content</a>
    <aside className="sidebar">
      <Brand />
      <nav aria-label="Main navigation">{nav.map(([key, label, Icon]) =>
        <a key={key} href={key === 'overview' ? '#' : '#' + key}
          className={key === 'checkup' ? 'nav-checkup' : undefined}
          aria-current={route === key ? 'page' : undefined}>
          <Icon aria-hidden="true" /><span>{label}</span>
        </a>)}</nav>
      <div className="sidebar-footer"><div className="storage-label"><LockKeyhole aria-hidden="true" /> Stored on this device</div><small>By Callista Digital</small></div>
    </aside>
    <main id="main">
      <div className="main-inner">
        {offline && <div className="status-line" role="status"><WifiOff aria-hidden="true" /> Offline · readings are saved on this device</div>}
        {update && <div className="status-line" role="status">Update ready. Finish your work, then close and reopen all PRESSURE tabs to apply it.</div>}
        {children}
        <footer className="main-footer"><span>PRESSURE <span className="footer-divider">/</span> By Callista Digital</span>
          <div><InfoLink go={() => navigate('about')} /><button className="text-button" type="button" onClick={() => navigate('privacy')}>Privacy</button></div>
        </footer>
      </div>
    </main>
  </div>
}

function useBrowserState() {
  const [offline, setOffline] = useState(() => !navigator.onLine)
  const [update, setUpdate] = useState(false)
  const [prompt, setPrompt] = useState(null)
  useEffect(() => {
    const connection = () => setOffline(!navigator.onLine)
    const install = event => {
      event.preventDefault()
      setPrompt(event)
    }
    const installed = () => setPrompt(null)
    const available = () => setUpdate(true)
    window.addEventListener('online', connection)
    window.addEventListener('offline', connection)
    window.addEventListener('beforeinstallprompt', install)
    window.addEventListener('appinstalled', installed)
    window.addEventListener('pressure-update', available)
    return () => {
      window.removeEventListener('online', connection)
      window.removeEventListener('offline', connection)
      window.removeEventListener('beforeinstallprompt', install)
      window.removeEventListener('appinstalled', installed)
      window.removeEventListener('pressure-update', available)
    }
  }, [])
  return { offline, update, install: prompt && (async () => {
    setPrompt(null)
    await prompt.prompt()
  }) }
}

export default function App() {
  const [route, setRoute] = useState(currentRoute)
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [dialogError, setDialogError] = useState('')
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState(null)
  const [today, setToday] = useState(dayKey)
  const store = useRef(null)
  const channel = useRef(null)
  const headingRef = useRef(null)
  const browser = useBrowserState()
  const notify = useCallback((message, error = false) => setNotice({ message, error }), [])

  useEffect(() => {
    let alive = true
    async function init() {
      try {
        const db = await openStorage()
        if (!alive) return db.close()
        store.current = db
        const value = await db.load()
        if (alive) setData(value)
      } catch {
        if (alive) setFailed(true)
      }
    }
    async function reload() {
      if (!store.current) return
      try {
        const value = await store.current.load()
        if (alive) setData(value)
      } catch {
        if (alive) setFailed(true)
      }
    }
    const onFocus = () => { setToday(dayKey()); reload() }
    const timer = setInterval(() => setToday(dayKey()), 30_000)
    const listener = typeof BroadcastChannel === 'function' ? new BroadcastChannel('pressure-data') : null
    channel.current = listener
    listener?.addEventListener('message', reload)
    window.addEventListener('focus', onFocus)
    init()
    return () => {
      alive = false
      clearInterval(timer)
      listener?.close()
      window.removeEventListener('focus', onFocus)
      store.current?.close()
      store.current = null
    }
  }, [])

  useEffect(() => {
    const onRoute = () => {
      setRoute(currentRoute())
      setDialog(null)
      window.scrollTo(0, 0)
      requestAnimationFrame(() => headingRef.current?.focus())
    }
    window.addEventListener('hashchange', onRoute)
    return () => window.removeEventListener('hashchange', onRoute)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = data?.settings.theme.toLowerCase() ?? 'system'
  }, [data?.settings.theme])

  useEffect(() => {
    if (!notice || notice.error) return
    const timer = setTimeout(() => setNotice(null), 5500)
    return () => clearTimeout(timer)
  }, [notice])

  async function change(operation, success) {
    try {
      const result = await operation(store.current)
      setData(await store.current.load())
      channel.current?.postMessage('changed')
      const message = typeof success === 'function' ? success(result) : success
      if (message) notify(message)
      return true
    } catch (error) {
      const message = error.message === 'This reading has already been deleted.' ? error.message : 'The change could not be saved. Check that your browser allows local storage and try again.'
      setDialogError(message)
      notify(message, true)
      return false
    }
  }

  const showDialog = value => { setDialogError(''); setDialog(value) }
  const log = defaults => showDialog({ kind: 'log', defaults: defaults?.period ? defaults : undefined })
  const guided = defaults => showDialog({ kind: 'guided', defaults: defaults?.period ? defaults : undefined })
  const close = () => { if (!pending) setDialog(null) }
  async function confirm(operation, message, feedback = 'success') {
    setDialogError('')
    setPending(true)
    if (await change(operation, message)) {
      haptic(feedback, data.settings.haptics)
      setDialog(null)
    }
    setPending(false)
  }

  let page
  if (route === 'about') page = <About headingRef={headingRef} />
  else if (route === 'privacy') page = <Privacy headingRef={headingRef} />
  else if (failed) page = <><PageHeader title="PRESSURE" headingRef={headingRef} /><StorageError /></>
  else if (!data) page = <><PageHeader title="PRESSURE" headingRef={headingRef} /><p role="status">Loading your local record…</p></>
  else {
    const { readings, checkup } = data
    switch (route) {
      case 'history':
        page = <History {...{ data, log, headingRef }} edit={reading => showDialog({ kind: 'edit', reading })}
          remove={reading => showDialog({ kind: 'delete', reading })} />
        break
      case 'insights':
        page = <Insights {...{ readings, headingRef, today }} />
        break
      case 'checkup':
        page = <Checkup {...{ readings, log, guided, headingRef, today }} start={checkup}
          saveStart={start => change(db => db.checkup(start), 'Checkup started.')}
          reset={() => showDialog({ kind: 'reset-checkup' })} />
        break
      case 'reports':
        page = <Reports {...{ readings, headingRef }} />
        break
      case 'settings':
        page = <Settings {...{ data, headingRef, navigate, notify }} install={browser.install}
          saveSettings={patch => change(db => db.settings(patch))}
          merge={backup => change(db => db.merge(backup), ({ added, skipped }) => `Imported ${added} readings. Skipped ${skipped} existing records.`)}
          clear={() => change(db => db.clear(), 'Local data cleared.')} />
        break
      default:
        page = <Dashboard {...{ readings, log, guided, navigate, headingRef, checkup, today }} />
    }
  }

  const titles = { log: 'Log a reading', edit: 'Edit reading', guided: 'Guided measurement', delete: 'Delete this reading?', 'reset-checkup': 'Clear this checkup?' }
  return <Shell route={route} offline={browser.offline} update={browser.update} haptics={data?.settings.haptics === true}>
    {data && !failed && <Reminder settings={data.settings} readings={data.readings} onLog={log} />}
    {page}
    {dialog && <Dialog key={dialog.kind} title={titles[dialog.kind]} close={close}>
      {dialogError && <p className="field-error" role="alert">{dialogError}</p>}
      {(dialog.kind === 'log' || dialog.kind === 'edit') && <ReadingForm
        haptics={data.settings.haptics} original={dialog.reading} defaults={dialog.defaults} pending={pending} cancel={close}
        submitLabel={dialog.kind === 'edit' ? 'Save changes' : 'Save reading'}
        submit={reading => confirm(db => db.save([reading], dialog.kind === 'edit'), dialog.kind === 'edit' ? 'Reading updated.' : 'Reading saved.', readingFeedback([reading]))} />}
      {dialog.kind === 'guided' && <GuidedForm timerSound={data.settings.timerSound} haptics={data.settings.haptics} defaults={dialog.defaults} pending={pending} cancel={close}
        submit={readings => confirm(db => db.save(readings), 'Guided session saved.', readingFeedback(readings))} />}
      {dialog.kind === 'delete' && <>
        <p>Delete {dialog.reading.systolic}/{dialog.reading.diastolic} mmHg from {readingLabel(dialog.reading)}?</p>
        <div className="actions end"><button autoFocus disabled={pending} onClick={close}>Cancel</button>
          <button className="danger" disabled={pending} onClick={() => confirm(db => db.remove(dialog.reading.id), 'Reading deleted.', 'delete')}>Delete reading</button></div>
      </>}
      {dialog.kind === 'reset-checkup' && <>
        <p>This clears the checkup dates and progress. Your measurements stay in History.</p>
        <div className="actions end"><button autoFocus disabled={pending} onClick={close}>Cancel</button>
          <button className="danger" disabled={pending} onClick={() => confirm(db => db.checkup(null), 'Checkup cleared.')}>Clear checkup</button></div>
      </>}
    </Dialog>}
    {notice && <div className={`toast ${notice.error ? 'error' : ''}`} role={notice.error ? 'alert' : 'status'}>
      {notice.message}<button className="icon-button" aria-label="Dismiss message" onClick={() => setNotice(null)}><X aria-hidden="true" /></button>
    </div>}
  </Shell>
}
