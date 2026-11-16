const prefix = 'pressure-shell-'
const cacheName = prefix + '__BUILD_VERSION__'
const files = /* __APP_FILES__ */ []
const appFiles = new Set(files)

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName)
    await cache.addAll(files.map(file => new Request(file, { cache: 'reload' })))
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith(prefix) && key !== cacheName).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html')) {
    event.respondWith(caches.open(cacheName).then(async cache => await cache.match('/index.html') ?? fetch(request)))
  } else if (appFiles.has(url.pathname)) {
    event.respondWith(caches.open(cacheName).then(async cache => await cache.match(url.pathname) ?? fetch(request)))
  }
})
