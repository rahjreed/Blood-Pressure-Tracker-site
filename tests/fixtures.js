export function fixture(id, overrides = {}) {
  return {
    id, sessionId: null, systolic: 120, diastolic: 76, pulse: null, at: '2026-11-16T12:00:00.000Z',
    offset: -300, arm: 'Left', period: 'Morning', notes: '', tags: [], emergency: false, ...overrides,
  }
}
