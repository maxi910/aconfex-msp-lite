// sw.js — ACONFEX MSP · cache busting + actualización inmediata
const SW_VERSION = 'v10.2';
const CACHE = `aconfex-${SW_VERSION}`;
const ROOT = new URL(self.registration.scope).pathname.replace(/\/$/, '/') || '/';
const APP_SHELL = [ `${ROOT}`, `${ROOT}index.html` ];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('aconfex-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) client.postMessage({ type: 'SW_ACTIVATED', version: SW_VERSION });
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((r) => { caches.open(CACHE).then(c => c.put(`${ROOT}index.html`, r.clone())); return r; })
                .catch(() => caches.match(`${ROOT}index.html`))
    );
    return;
  }

  if (req.method === 'GET' && url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const fetchP = fetch(req).then((r) => { caches.open(CACHE).then(c => c.put(req, r.clone())); return r; }).catch(() => cached || Promise.reject('offline'));
        return cached || fetchP;
      })
    );
    return;
  }

  if (url.hostname.includes('cdn.jsdelivr.net')) {
    e.respondWith(
      fetch(req).then((r) => { caches.open(CACHE).then(c => c.put(req, r.clone())); return r; })
                .catch(() => caches.match(req))
    );
  }
});
