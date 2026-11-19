const tag = 'pressure-guided-timer'
let context
let queue = Promise.resolve()
export async function enableTimerNotifications() {
  try {
    if (!('Notification' in window) || !navigator.serviceWorker) return false
    return (await Notification.requestPermission()) === 'granted'
  } catch { return false }
}
export function notifyTimer(label, deadline, complete = false) {
  queue = queue.then(async () => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const registration = await navigator.serviceWorker?.getRegistration()
    if (!registration?.active) return
    await registration.showNotification(complete ? 'PRESSURE · Timer complete' : 'PRESSURE · Timer running', {
      tag, icon: '/icon-192.png', silent: true, requireInteraction: !complete,
      body: complete ? label + ' complete. Return to PRESSURE when ready.' :
        label + ' ends at ' + new Date(deadline).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit', second: '2-digit'}),
      data: { pressureTimer: true },
    })
  }).catch(() => {})
}
export function clearTimerNotification() {
  queue = queue.then(async () => {
    const registration = await navigator.serviceWorker?.getRegistration()
    for (const item of await registration?.getNotifications({tag}) ?? []) item.close()
  }).catch(() => {})
}
export function prepareTimerSound() {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext
    if (!Audio) return
    context ??= new Audio()
    context.resume().catch(() => {})
  } catch { /* Sound is optional. */ }
}
export function playTimerSound() {
  try {
    if (!context || context.state !== 'running') return
    const start = context.currentTime
    for (const [index, frequency] of [523.25, 659.25].entries()) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const time = start + index * 0.24
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0, time)
      gain.gain.linearRampToValueAtTime(0.12, time + 0.035)
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(time)
      oscillator.stop(time + 0.24)
    }
  } catch { /* Sound is optional. */ }
}
