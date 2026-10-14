// Grimoire Ascent service worker. One cache per build; network-first so an online player always gets the newest build,
// with the cached copy of the same build as the offline fallback. Old builds' caches are deleted on activate.
const BUILD = '__BUILD__', CACHE = 'ga-' + BUILD, ASSETS = __ASSETS__;
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).catch(() => { }).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('ga-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || ['/ws', '/sw.js', '/healthz', '/version'].includes(u.pathname)) return;
  e.respondWith(fetch(r).then(res => { if (res.ok && res.type === 'basic') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; })
    .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || (r.mode === 'navigate' ? caches.match('/index.html') : Response.error()))));
});
