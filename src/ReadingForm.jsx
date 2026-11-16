import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Timer } from 'lucide-react'
import { averages, displayAverage, emergencySymptoms, initialReading, localInput, PERIODS, TAGS, validateDraft } from './measurements.js'
import { Safety } from './ui.jsx'

export function ReadingForm({ original, defaults, submit, submitLabel = 'Save reading', cancel, pending }) {
  const [draft, setDraft] = useState(() => initialReading(original, defaults))
  const [errors, setErrors] = useState({})
  const form = useRef(null)
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  const field = (key, options = {}) => ({
    id: `reading-${key}`,
    name: key,
    value: draft[key],
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `error-${key}` : undefined,
    onChange: event => set(key, event.target.value),
    ...options,
  })
  const errorFor = key => errors[key] && <span className="field-error" id={`error-${key}`}>{errors[key]}</span>
  const warning = {
    systolic: draft.systolic === '' ? Infinity : Number(draft.systolic),
    diastolic: draft.diastolic === '' ? Infinity : Number(draft.diastolic),
    emergency: draft.emergency,
  }
  // Missing values should never trigger a warning on their own.
  if (!Number.isFinite(warning.systolic)) warning.systolic = 110
  if (!Number.isFinite(warning.diastolic)) warning.diastolic = 70
  return <form ref={form} noValidate className="form-stack" onSubmit={event => {
    event.preventDefault()
    const result = validateDraft(draft, original)
    setErrors(result.errors)
    if (result.reading) submit(result.reading)
    else form.current.elements.namedItem(Object.keys(result.errors)[0])?.focus()
  }}>
    <div className="pressure-fields">
      {[['systolic', 'Systolic', 'mmHg'], ['diastolic', 'Diastolic', 'mmHg'], ['pulse', 'Pulse', 'BPM · optional']].map(([key, label, unit]) =>
        <label key={key}>{label}<small>{unit}</small>
          <input {...field(key, { inputMode: 'numeric', required: key !== 'pulse', autoComplete: 'off', maxLength: 6 })} />
          {errorFor(key)}
        </label>)}
    </div>
    <label className="warning-checkbox"><input type="checkbox" checked={draft.emergency} onChange={event => set('emergency', event.target.checked)} />
      <span>I experienced one or more warning symptoms<span className="helper">{emergencySymptoms}.</span></span>
    </label>
    <Safety reading={warning} live />
    <div className="form-grid">
      <label className="wide">Date and time<input {...field('dateTime', { type: 'datetime-local', required: true })} />{errorFor('dateTime')}</label>
      <label>Arm<select {...field('arm')}><option>Left</option><option>Right</option></select></label>
      <label>Time of day<select {...field('period')}>{PERIODS.map(period => <option key={period}>{period}</option>)}</select></label>
    </div>
    <fieldset className="tag-field">
      <legend>Context <small>Optional</small></legend>
      <div>{TAGS.map(tag => <label className="check-chip" key={tag}>
        <input type="checkbox" checked={draft.tags.includes(tag)}
          onChange={event => set('tags', event.target.checked ? [...draft.tags, tag] : draft.tags.filter(value => value !== tag))} />
        <span>{tag}</span>
      </label>)}</div>
    </fieldset>
    <label>Notes <small>Optional</small><textarea {...field('notes', { rows: 3, maxLength: 1000, placeholder: 'Anything you’d like to remember?' })} /></label>
    <div className="actions end">
      <button type="button" onClick={cancel}>Cancel</button>
      <button className="primary" disabled={pending} type="submit">{submitLabel}</button>
    </div>
  </form>
}

function Countdown({ seconds, label }) {
  const [deadline, setDeadline] = useState(0)
  const [remaining, setRemaining] = useState(seconds)
  useEffect(() => {
    if (!deadline) return
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setRemaining(left)
      if (!left) clearInterval(interval)
    }, 200)
    return () => clearInterval(interval)
  }, [deadline])
  return <div className="countdown">
    <Timer aria-hidden="true" />
    <span role="timer" aria-label={label}>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>
    <button type="button" disabled={deadline > 0 && remaining > 0} onClick={() => {
      setRemaining(seconds)
      setDeadline(Date.now() + seconds * 1000)
    }}>{deadline ? 'Restart timer' : 'Start timer'}</button>
    <span className="sr-only" role="status">{remaining === 0 ? `${label} complete.` : ''}</span>
  </div>
}

export function GuidedForm({ defaults, submit, cancel, pending }) {
  const [step, setStep] = useState(0)
  const [first, setFirst] = useState(null)
  const [second, setSecond] = useState(null)
  const title = useRef(null)
  useEffect(() => { if (step > 0) title.current?.focus() }, [step])
  const steps = ['Prepare', 'First reading', 'Pause', 'Second reading', 'Review']
  return <div className="form-stack">
    <p className="step-label" ref={title} tabIndex="-1">Step {step + 1} of {steps.length} · {steps[step]}</p>
    {step === 0 && <>
      <p>Follow your healthcare professional’s instructions for measuring your blood pressure at home.</p>
      <ul className="instructions">
        <li>Use a validated upper-arm monitor with the correct cuff size. Avoid caffeine, smoking, alcohol, and exercise in the 30 minutes beforehand. Empty your bladder.</li>
        <li>Sit with your back supported and both feet flat. Keep your legs uncrossed and your bare arm supported at heart level.</li>
        <li>Rest quietly for at least five minutes. Stay still and avoid talking while measuring.</li>
      </ul>
      <Countdown seconds={300} label="Rest timer" />
    </>}
    {step === 1 && <ReadingForm key="first" defaults={defaults} submitLabel="Continue" cancel={cancel} submit={reading => {
      setFirst(reading)
      setStep(2)
    }} />}
    {step === 2 && <>
      <Safety reading={first} />
      <p>Stay seated and wait at least one minute between readings.</p>
      <Countdown key="interval" seconds={60} label="Interval timer" />
    </>}
    {step === 3 && <ReadingForm key="second" defaults={{ ...defaults, dateTime: localInput(), arm: first.arm, period: first.period }}
      submitLabel="Review session" cancel={cancel} submit={reading => {
        setSecond(reading)
        setStep(4)
      }} />}
    {step === 4 && <>
      <div className="session-review">
        <div><span>First reading</span><strong>{first.systolic}/{first.diastolic}</strong></div>
        <div><span>Second reading</span><strong>{second.systolic}/{second.diastolic}</strong></div>
        <div><span>Session average</span><strong>{displayAverage(averages([first, second]))}</strong></div>
      </div>
      <p className="muted">Both measurements and their session average will be saved.</p>
      <Safety reading={second} />
      <div className="actions end"><button onClick={() => setStep(3)}>Re-enter second reading</button>
        <button className="primary" disabled={pending} onClick={() => {
          const sessionId = first.id
          submit([{ ...first, sessionId }, { ...second, sessionId }])
        }}><Check aria-hidden="true" /> Save session</button></div>
    </>}
    {(step === 0 || step === 2) && <div className="actions end"><button onClick={cancel}>Cancel</button>
      <button className="primary" onClick={() => setStep(step + 1)}>{step === 0 ? 'Enter first reading' : 'Enter second reading'} <ArrowRight aria-hidden="true" /></button></div>}
  </div>
}
