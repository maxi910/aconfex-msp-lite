// sw.js — NO STATIC CACHE
const VERSION = 'no-cache-2025-11-08-1'; // ← cambia en cada deploy

self.addEventListener('install', (evt) => {
  // activa de inmediato
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil((async () => {
    // limpia cualquier cache viejo creado por SWs anteriores
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.clients.claim();

    // avisa a las páginas controladas
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clients) c.postMessage({ type: 'SW_ACTIVATED', version: VERSION });
  })());
});

// SIEMPRE red, sin cache del navegador (no-store).
// Si no hay conexión, responde con 503 simple.
self.addEventListener('fetch', (evt) => {
  evt.respondWith(
    fetch(evt.request, { cache: 'no-store' }).catch(() =>
      new Response('Sin conexión.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      })
    )
  );
});

// Permite forzar activación desde la página
self.addEventListener('message', (evt) => {
  if (evt.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
