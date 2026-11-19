const patterns = { tap: 12, success: [25, 45, 25], warning: [45, 55, 35], timer: [30, 70, 30], delete: 45 }
export function supportsHaptics() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}
export function haptic(kind, enabled) {
  if (!enabled || !supportsHaptics() || typeof document === 'undefined' || document.hidden) return false
  try { return navigator.vibrate(patterns[kind] ?? patterns.tap) } catch { return false }
}
