// sw.js — ACONFEX MSP ULTRA-LITE
const VERSION = 'v24';                  // ← cambia cuando deployes
const STATIC_CACHE = `aconfex-static-${VERSION}`;

self.addEventListener('install', (evt) => {
  self.skipWaiting();                           // toma control de inmediato
  evt.waitUntil(caches.open(STATIC_CACHE));     // crea caché vacío (lazy fill)
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil((async () => {
    // borra caches viejos
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    // avisa a las páginas que el SW nuevo está activo
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clients) c.postMessage({ type: 'SW_ACTIVATED', version: VERSION });
  })());
});

// Normaliza URLs (ignora ?v=... para archivos estáticos)
const normalize = (url) => {
  try {
    const u = new URL(url);
    // solo mantenemos ?v para el propio sw.js y el index.html
    if (!u.pathname.endsWith('/sw.js') && !u.pathname.endsWith('/index.html')) {
      u.searchParams.delete('v');
    }
    return u.toString();
  } catch { return url; }
};

// Estrategias:
// - HTML (navigate): NETWORK-FIRST (nunca sirvas index viejo).
// - Estáticos (js/css/img/pdf): STALE-WHILE-REVALIDATE.
self.addEventListener('fetch', (evt) => {
  const req = evt.request;

  // Navegación / HTML
  const isHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    evt.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        const cache = await caches.open(STATIC_CACHE);
        cache.put(normalize(req.url), fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(normalize(req.url));
        return cached || new Response('Sin conexión y sin caché disponible.', { status: 503 });
      }
    })());
    return;
  }

  // Estáticos
  evt.respondWith((async () => {
    const url = normalize(req.url);
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(url);
    const net = fetch(req).then(resp => { cache.put(url, resp.clone()); return resp; })
                          .catch(() => null);
    return cached || await net || new Response('Recurso no disponible.', { status: 504 });
  })());
});

// Permite forzar skipWaiting desde la página
self.addEventListener('message', (evt) => {
  if (evt.data && evt.data.type === 'SKIP_WAITING') self.skipWaiting();
});
