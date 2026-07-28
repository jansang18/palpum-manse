const VERSION = 'v1-20260728';
const CACHE_PREFIX = 'chwimyeongseon-academy-';
const CACHE = CACHE_PREFIX + VERSION;
const SCOPE_URL = new URL(self.registration.scope);

const PRECACHE = [
  './',
  './index.html',
  './styles/academy.css',
  './scripts/academy-nav.js',
  './scripts/academy-motion.js',
  './scripts/academy-mockups.js',
  './scripts/academy-manse.js',
  './manifest.webmanifest',
  '../assets/legend-landscape.webp',
  '../assets/legend-seal.webp',
  '../scripts/vendor/manseryeok.browser.js',
  '../scripts/manseryeok-adapter.js',
  '../icon-192.png',
  '../icon-512.png'
];

// These shared files are used only by the Academy client. Root apps retain their
// own worker and cache namespace even though the files live one directory above.
const SHARED_RUNTIME_PATHS = new Set([
  '../assets/legend-landscape.webp',
  '../assets/legend-seal.webp',
  '../scripts/vendor/manseryeok.browser.js',
  '../scripts/manseryeok-adapter.js',
  '../icon-192.png',
  '../icon-512.png'
].map((asset) => new URL(asset, SCOPE_URL).pathname));

function belongsToAcademy(url) {
  return url.origin === SCOPE_URL.origin && (
    url.pathname.startsWith(SCOPE_URL.pathname)
    || SHARED_RUNTIME_PATHS.has(url.pathname)
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!belongsToAcademy(url)) return;

  const isDocument = request.mode === 'navigate' || request.destination === 'document';
  if (isDocument) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request, { ignoreSearch: true })
          .then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true })
      .then((cached) => cached || fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      }))
  );
});
