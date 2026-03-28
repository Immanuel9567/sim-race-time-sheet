const CACHE = 'srn-v2';
const PRECACHE = ['./', './index.html', './game.html', './auth.js', './hub.js', './app.js', './css/style.css', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
  ).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      caches.open(CACHE).then(c => c.put(e.request, res.clone()));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : { title:'NGN Sim Racers', body:'New activity!' };
  e.waitUntil(self.registration.showNotification(d.title, { body:d.body, icon:'icons/icon-192.png', tag:'srn', renotify:true }));
});
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(clients.openWindow('./')); });
self.addEventListener('message', e => {
  if (e.data?.type === 'NOTIFY') {
    self.registration.showNotification(e.data.title, { body:e.data.body, icon:'icons/icon-192.png', tag:'srn', renotify:true });
  }
});
