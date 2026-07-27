// 취명선 전설의 만세력 서비스워커
// 전략: HTML/CSS/JS = 네트워크 우선(항상 최신 디자인), 이미지/아이콘 = 캐시 우선(빠름).
// 오프라인일 때만 캐시로 폴백한다. 배포 시 VERSION만 올리면 옛 캐시는 자동 삭제됨.
const VERSION = 'v11-20260727-palpum-saved-offline';
const CACHE_PREFIX = 'legend-manse-';
const CACHE = CACHE_PREFIX + VERSION;

// 오프라인 첫 진입에도 동작하도록 핵심 자원을 미리 캐시(이후 온라인이면 네트워크본으로 갱신)
const PRECACHE = [
  './',
  './index.html',
  './polish.css',
  './luxury.css',
  './apple.css',
  './styles/legend-tokens.css',
  './styles/legend-layout.css',
  './styles/legend-motion.css',
  './main-logo.png',
  './cosmos.jpg',
  './assets/legend-landscape.webp',
  './assets/legend-seal.webp',
  './scripts/vendor/manseryeok.browser.js',
  './scripts/manseryeok-adapter.js',
  './scripts/legend-storage.js',
  './scripts/legend-palpum.js',
  './scripts/legend-palpum-fortune.js',
  './scripts/legend-era.js',
  './scripts/legend-resonance.js',
  './scripts/legend-copy.js',
  './scripts/legend-view.js',
  './scripts/legend-nav.js',
  './share.js',
  './nav.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 외부(위키백과·네이버 등)는 SW가 개입하지 않음

  const path = url.pathname;
  const isDoc = req.mode === 'navigate' || req.destination === 'document'
    || path.endsWith('/') || path.endsWith('.html');
  const isCode = path.endsWith('.css') || path.endsWith('.js') || path.endsWith('.webmanifest');

  if (isDoc || isCode) {
    // 네트워크 우선 + 서버 재검증(no-cache) → 변경 시 즉시 최신본, 실패 시 캐시 폴백
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // 이미지/아이콘/폰트 등 → 캐시 우선(속도), 없으면 네트워크 후 캐시
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});
