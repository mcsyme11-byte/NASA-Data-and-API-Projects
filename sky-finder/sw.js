// NASA and ESA Data Projects · Sky Finder · offline copy · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Keeps Sky Finder working with a weak or no connection out in the dark:
//   the app's own files     served from the saved copy, refreshed in the background (stale while revalidate)
//   the data files          fetched fresh when online; the saved copy is used when the network fails
// Only this site's own files are saved, in this browser's cache. Nothing about the visitor is stored or sent.
// Raise VERSION when the list of app files changes.

const VERSION = 'sky-finder-2026111304';
const APP = [
  './', './index.html', './how-to.html', './sky-finder.css', './app.js', './view.js', './orient.js', './targets.js',
  './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './data/stars.json',
  '../shared/theme.css', '../shared/footer.js', '../shared/sky.js', '../shared/passes.js', '../shared/place.js',
  '../shared/sats.js', '../shared/vendor/satellite.min.js', '../asteroid-tracker/orbit.js', '../shared/emblem.svg',
];
const DATA = ['/asteroid-tracker/data/sky.json', '/spacecraft/data/tle.json', '/image-explorer/data/places.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.allSettled(APP.map((u) => c.add(new Request(u, { cache: 'reload' }))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('sky-finder-') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const isData = DATA.some((d) => url.pathname.endsWith(d));
  if (isData) {
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || Response.error())));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => {
    const net = fetch(req).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return r; }).catch(() => hit || Response.error());
    return hit || net;
  }));
});
