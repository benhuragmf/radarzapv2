/* Radar Chat — service worker (shell cache + assets estáticos) */
const CACHE = 'radar-chat-shell-v2.17.2'
const SHELL = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest', '/icons.svg']

function isApiLike(url) {
  return (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/socket.io') ||
    url.pathname.startsWith('/webchat') ||
    url.pathname.startsWith('/leads')
  )
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(SHELL).catch(() => {
        /* offline durante install — ignora */
      }),
    ),
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (isApiLike(url)) return

  const isNavigation = request.mode === 'navigate'
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webmanifest')

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone()
          caches.open(CACHE).then(cache => cache.put('/index.html', copy))
          return res
        })
        .catch(() =>
          caches.match('/index.html').then(cached => cached || caches.match('/')),
        ),
    )
    return
  }

  if (!isStaticAsset) return

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(res => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then(cache => cache.put(request, copy))
          }
          return res
        })
        .catch(() => cached)

      return cached || network
    }),
  )
})
