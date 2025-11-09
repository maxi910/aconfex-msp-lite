// sw.js  — ACONFEX MSP · cache busting + actualización inmediata
const SW_VERSION = 'v2025-11-08-01';
const CACHE = `aconfex-${SW_VERSION}`;

// Calcula el path base correctamente en GitHub Pages (p.ej. /aconfex-msp-lite/)
const ROOT = new URL(self.registration.scope).pathname.replace(/\/$/, '/') || '/';
const APP_SHELL = [ `${ROOT}`, `${ROOT}index.html` ];

// Instala: precache mínimo y activa altiro la nueva versión
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)));
});

// Activa: borra caches viejos, toma control, y avisa a las páginas que se recarguen
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.startsWith('aconfex-') && k !== CACHE)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) client.postMessage({ type: 'SW_ACTIVATED', version: SW_VERSION });
  })());
});

// Fetch:
// - Navegación (HTML): network-first, fallback a caché (agarra siempre la versión nueva si hay internet)
// - Archivos del mismo origen: stale-while-revalidate
// - CDN (pdf-lib): network-first, fallback a caché
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((r) => {
        const clone = r.clone();
        caches.open(CACHE).then((c) => c.put(`${ROOT}index.html`, clone));
        return r;
      }).catch(() => caches.match(`${ROOT}index.html`))
    );
    return;
  }

  if (req.method === 'GET' && url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const fetchP = fetch(req).then((r) => {
          caches.open(CACHE).then((c) => c.put(req, r.clone()));
          return r;
        }).catch(() => cached || Promise.reject('offline'));
        return cached || fetchP;
      })
    );
    return;
  }

  if (url.hostname.includes('cdn.jsdelivr.net')) {
    e.respondWith(
      fetch(req).then((r) => {
        caches.open(CACHE).then((c) => c.put(req, r.clone()));
        return r;
      }).catch(() => caches.match(req))
    );
  }
});
