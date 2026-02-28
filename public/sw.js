// Self-unregistering service worker — clears stale cache that causes client crashes
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((name) => caches.delete(name)))
    ).then(() => self.registration.unregister())
     .then(() => self.clients.matchAll())
     .then((clients) => clients.forEach((client) => client.navigate(client.url)))
  )
})
