const VERSION = 'v3-20260728-seasonal-hero';
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
  './assets/season-spring.jpg',
  './assets/season-summer.jpg',
  './assets/season-autumn.jpg',
  './assets/season-winter.jpg',
  './manifest.webmanifest',
  '../assets/legend-seal.webp',
  '../scripts/vendor/manseryeok.browser.js',
  '../scripts/manseryeok-adapter.js',
  '../icon-192.png',
  '../icon-512.png'
];

// These shared files are used only by the Academy client. Root apps retain their
// own worker and cache namespace even though the files live one directory above.
const SHARED_RUNTIME_PATHS = new Set([
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

function matchAcademyCache(request) {
  return caches.open(CACHE)
    .then((academyCache) => academyCache.match(request, { ignoreSearch: true }));
}

function writeAcademyCache(event, request, responseCopy) {
  // Keep cache writes alive after the response returns, without allowing a
  // transient storage failure to surface as an unhandled rejection.
  event.waitUntil(
    caches.open(CACHE)
      .then((academyCache) => academyCache.put(request, responseCopy))
      .catch(() => undefined)
  );
}

function cloneAndWriteAcademyCache(event, request, response) {
  if (!response.ok) return;
  let responseCopy;
  try {
    // Clone before any asynchronous cache operation can yield the response body.
    responseCopy = response.clone();
  } catch {
    return;
  }
  writeAcademyCache(event, request, responseCopy);
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
          cloneAndWriteAcademyCache(event, request, response);
          return response;
        })
        .catch(() => matchAcademyCache(request)
          .then((cached) => cached || matchAcademyCache('./index.html')))
    );
    return;
  }

  event.respondWith(
    matchAcademyCache(request)
      .then((cached) => cached || fetch(request).then((response) => {
        cloneAndWriteAcademyCache(event, request, response);
        return response;
      }))
  );
});
