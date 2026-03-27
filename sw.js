/* ═══════════════════════════════════════════════════════════════
   NGN Sim Racers Club — Service Worker v1
   Handles: offline caching, background sync readiness
═══════════════════════════════════════════════════════════════ */

const CACHE = 'srn-v1';
const PRECACHE = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network-first for same-origin, cache fallback
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Handle push notifications sent from the page via showNotification
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'NGN Sim Racers Club', body: 'New activity!' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: 'nrh-activity',
      renotify: true,
      data: data
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('./'));
});
