import { chronological, sessionRecord } from './measurements.js'

const DB_NAME = 'pressure'
const DB_VERSION = 1
const STORES = ['readings', 'sessions', 'preferences']
export const defaultSettings = { theme: 'System', morning: '', evening: '' }

const result = request => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

export async function openStorage(factory = indexedDB, name = DB_NAME) {
  const request = factory.open(name, DB_VERSION)
  request.onupgradeneeded = ({ oldVersion }) => {
    if (oldVersion < 1) {
      for (const store of ['readings', 'sessions']) request.result.createObjectStore(store, { keyPath: 'id' })
      request.result.createObjectStore('preferences')
    }
  }
  const db = await result(request)
  db.onversionchange = () => db.close()

  async function transact(mode, operation) {
    const tx = db.transaction(STORES, mode)
    const completed = new Promise((resolve, reject) => {
      tx.oncomplete = resolve
      tx.onabort = () => reject(tx.error ?? new Error('Storage transaction canceled.'))
    })
    const stores = Object.fromEntries(STORES.map(name => [name, tx.objectStore(name)]))
    try {
      const value = await operation(stores)
      await completed
      return value
    } catch (error) {
      try { tx.abort() } catch { /* Transaction already ended. */ }
      await completed.catch(() => {})
      throw error
    }
  }

  async function refreshSessions(stores, affected) {
    const current = await result(stores.readings.getAll())
    for (const id of affected) {
      if (!id) continue
      const entries = current.filter(reading => reading.sessionId === id)
      if (entries.length) stores.sessions.put(sessionRecord(id, entries))
      else stores.sessions.delete(id)
    }
  }

  return {
    close: () => db.close(),
    load: () => transact('readonly', async stores => {
      const [readings, sessions, settings, checkup] = await Promise.all([
        result(stores.readings.getAll()), result(stores.sessions.getAll()),
        result(stores.preferences.get('settings')), result(stores.preferences.get('checkup')),
      ])
      return { readings: chronological(readings).reverse(), sessions, settings: settings ?? defaultSettings, checkup: checkup ?? null }
    }),
    save: (readings, editing = false) => transact('readwrite', async stores => {
      for (const reading of readings) {
        if (editing) {
          if (!await result(stores.readings.get(reading.id))) throw new Error('This reading has already been deleted.')
          stores.readings.put(reading)
        } else {
          stores.readings.add(reading)
        }
      }
      await refreshSessions(stores, new Set(readings.map(reading => reading.sessionId)))
    }),
    remove: id => transact('readwrite', async stores => {
      const reading = await result(stores.readings.get(id))
      if (!reading) return
      stores.readings.delete(id)
      await refreshSessions(stores, [reading.sessionId])
    }),
    merge: backup => transact('readwrite', async stores => {
      const [existing, checkup] = await Promise.all([
        result(stores.readings.getAllKeys()), result(stores.preferences.get('checkup')),
      ])
      const ids = new Set(existing)
      const additions = backup.readings.filter(reading => !ids.has(reading.id))
      for (const reading of additions) stores.readings.add(reading)
      if (!checkup && backup.checkup) stores.preferences.put(backup.checkup, 'checkup')
      await refreshSessions(stores, new Set(additions.map(reading => reading.sessionId)))
      return { added: additions.length, skipped: backup.readings.length - additions.length }
    }),
    settings: patch => transact('readwrite', async stores => {
      const current = await result(stores.preferences.get('settings'))
      stores.preferences.put({ ...(current ?? defaultSettings), ...patch }, 'settings')
    }),
    checkup: date => transact('readwrite', stores => stores.preferences.put(date, 'checkup')),
    clear: () => transact('readwrite', stores => {
      for (const store of Object.values(stores)) store.clear()
    }),
  }
}
