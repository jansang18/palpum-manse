const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const academyPath = path.join(__dirname, '..', 'academy', 'index.html');
const html = fs.readFileSync(academyPath, 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'academy', 'styles', 'academy.css'), 'utf8');
const navigation = fs.readFileSync(
  path.join(__dirname, '..', 'academy', 'scripts', 'academy-nav.js'),
  'utf8'
);
const mockups = fs.readFileSync(
  path.join(__dirname, '..', 'academy', 'scripts', 'academy-mockups.js'),
  'utf8'
);
const manse = fs.readFileSync(
  path.join(__dirname, '..', 'academy', 'scripts', 'academy-manse.js'),
  'utf8'
);
const manifestPath = path.join(__dirname, '..', 'academy', 'manifest.webmanifest');
const serviceWorkerPath = path.join(__dirname, '..', 'academy', 'sw.js');
const rawEngineAccessPatterns = [
  /\b(?:root|window|globalThis|self)\s*(?:\.|\?\.)\s*Manseryeok(?!Adapter)\b/,
  /\b(?:root|window|globalThis|self)\s*\[\s*['"]Manseryeok['"]\s*\]/,
  /(?:^|[^\w$.])Manseryeok\s*(?:\.|\?\.)\s*(?:calculate|calculateFourPillars)\b/m,
  /(?:^|[^\w$.])Manseryeok\s*\[\s*['"](?:calculate|calculateFourPillars)['"]\s*\]/m
];

function accessesRawManseryeok(source) {
  return rawEngineAccessPatterns.some(pattern => pattern.test(source));
}

test('academy service worker owns only academy scope, cache keys, and runtime assets', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const sw = fs.readFileSync(serviceWorkerPath, 'utf8');

  assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
  assert.match(html, /serviceWorker\.register\('\.\/sw\.js', \{ scope: '\.\/' \}\)/);
  assert.match(sw, /const CACHE_PREFIX = 'chwimyeongseon-academy-'/);
  assert.match(sw, /startsWith\(CACHE_PREFIX\)/);
  assert.doesNotMatch(sw, /caches\.match\(/);
  assert.doesNotMatch(sw, /caches\.delete\([^)]*palpum-manse/);
  assert.doesNotMatch(sw, /caches\.delete\([^)]*legend-manse/);
  assert.equal(manifest.id, '/palpum-manse/academy/');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');

  for (const asset of [
    './', './index.html', './styles/academy.css', './scripts/academy-nav.js',
    './scripts/academy-motion.js', './scripts/academy-mockups.js',
    './scripts/academy-manse.js', './assets/season-spring.jpg',
    './assets/season-summer.jpg', './assets/season-autumn.jpg',
    './assets/season-winter.jpg', '../assets/legend-seal.webp',
    '../scripts/vendor/manseryeok.browser.js',
    '../scripts/manseryeok-adapter.js', './manifest.webmanifest',
    '../icon-192.png', '../icon-512.png'
  ]) {
    assert.match(sw, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('hero uses four academy-owned seasonal scenes and no nine-period orbit', () => {
  const assets = [
    'season-spring.jpg',
    'season-summer.jpg',
    'season-autumn.jpg',
    'season-winter.jpg'
  ];

  assert.equal((html.match(/class="academy-season-scene/g) || []).length, 4);
  assert.equal((html.match(/class="academy-season-scene is-active"/g) || []).length, 1);
  assert.doesNotMatch(html, /academy-orbit|academy-orbit-node|academy-orbit-core/);
  assert.doesNotMatch(css, /academy-orbit|academy-orbit-turn/);

  for (const asset of assets) {
    assert.match(html, new RegExp(`assets/${asset}`));
    assert.ok(
      fs.existsSync(path.join(__dirname, '..', 'academy', 'assets', asset)),
      `${asset} must be copied into Academy-owned assets`
    );
  }

  assert.match(
    html,
    /data-season-slideshow[^>]*role="region"[^>]*aria-label="사계절 수묵 장면"/
  );
  assert.match(
    html,
    /id="academySeasonStatus">봄 수묵 장면 · 1 \/ 4/
  );
  assert.match(
    html,
    /id="academySeasonAnnouncement"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/
  );
  assert.doesNotMatch(html, /id="academySeasonStatus"[^>]*(?:role="status"|aria-live=)/);
  assert.match(html, /id="academySeasonPrevious"[^>]*aria-label="이전 계절 장면"/);
  assert.match(html, /id="academySeasonNext"[^>]*aria-label="다음 계절 장면"/);
  assert.match(
    html,
    /id="academySeasonToggle"[^>]*aria-label="계절 장면 일시정지"[^>]*aria-pressed="false"/
  );
});

test('academy exposes every approved section and mockup disclosure', () => {
  for (const id of [
    'academyHome',
    'academyCourses',
    'academyManse',
    'academyCases',
    'academyBoard',
    'academyPlans'
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  assert.match(html, /실제 결제가 발생하지 않습니다/);
  assert.match(html, /prefers-reduced-motion/);
});

test('academy shell uses readable Korean and balanced semantic section markup', () => {
  for (const label of [
    '취명선 명리학당',
    '본문으로 건너뛰기',
    '기본 만세력',
    '질문 게시판'
  ]) {
    assert.match(html, new RegExp(label));
  }

  assert.doesNotMatch(html, /�|\?{2,}/);
  for (const tag of ['a', 'h2', 'p', 'section']) {
    assert.equal(
      (html.match(new RegExp(`<${tag}(?:\\s|>)`, 'g')) || []).length,
      (html.match(new RegExp(`</${tag}>`, 'g')) || []).length,
      `${tag} elements must have matching closing tags`
    );
  }
});

test('academy reserves space for a fixed masthead and supports skip-link focus', () => {
  assert.match(html, /<main id="academyMain" tabindex="-1">/);
  assert.match(css, /--academy-masthead-height:/);
  assert.match(css, /\.academy-masthead\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /main\s*\{[^}]*padding-top:\s*var\(--academy-masthead-height\)/s);
  assert.match(navigation, /academyMain\.focus\(\{ preventScroll: true \}\)/);
});

test('academy navigation initialization is idempotent', () => {
  assert.match(navigation, /var initialized = false;/);
  assert.match(navigation, /if \(initialized\) return;/);
  assert.match(navigation, /initialized = true;/);
});

test('academy main keeps a visible focus treatment for skip-link users', () => {
  assert.doesNotMatch(css, /#academyMain:focus\s*\{\s*outline:\s*none;/);
  assert.match(css, /#academyMain:focus-visible\s*\{[^}]*outline:/s);
});

test('academy skip-link focus marker starts below the fixed masthead', () => {
  assert.match(css, /#academyMain:focus-visible::before\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /#academyMain:focus-visible::before\s*\{[^}]*top:\s*var\(--academy-masthead-height\)/s);
  assert.match(css, /#academyMain:focus-visible::before\s*\{[^}]*pointer-events:\s*none/s);
});

test('academy includes four curriculum tracks and safely disclosed mockup dialogs', () => {
  for (const title of [
    '명리의 기초',
    '사주 원국 읽기',
    '대운·세운·월운',
    '삼원구운과 시대 해석'
  ]) {
    assert.match(html, new RegExp(title));
  }

  for (const dialogId of ['courseDialog', 'boardDialog', 'paymentDialog']) {
    assert.match(html, new RegExp(`id="${dialogId}"`));
  }

  assert.match(html, /현재는 시연 화면이며 결제가 발생하지 않습니다/);
  assert.match(html, /작성 내용은 저장되지 않습니다/);
  assert.match(html, /scripts\/academy-mockups\.js/);
  assert.match(mockups, /window\.AcademyMockups\s*=/);
  assert.match(
    mockups,
    /flow:\s*\{[\s\S]*?title:\s*'대운·세운·월운'/,
    'course dialog data must use the approved third-course title'
  );
});

test('academy implements the complete nonpersistent learning mockups', () => {
  assert.match(html, /data-course-curriculum/);
  assert.match(html, /data-course-preview/);
  assert.match(html, /data-course-enroll/);
  assert.match(html, /data-board-categories/);
  assert.match(html, /id="academyBoardSearch"[^>]*type="search"/);
  assert.match(html, /data-board-read-view/);
  assert.match(html, /data-board-write-view/);
  assert.match(html, /name="method"[^>]*type="radio"/);
  assert.doesNotMatch(html, /data-payment-form[\s\S]*name="(?:name|email)"/);
  assert.match(html, /id="pillarDialog"/);
  for (const concept of ['천간', '지지', '오행', '십성']) {
    assert.match(html, new RegExp(`data-pillar-concept="${concept}"`));
  }
  assert.doesNotMatch(mockups, /\b(?:localStorage|sessionStorage|fetch|XMLHttpRequest)\b/);
});

test('board list semantics preserve native button roles', () => {
  assert.match(html, /<ul class="academy-board-list"[^>]*>/);
  assert.equal((html.match(/<li class="academy-board-item"/g) || []).length, 5);
  assert.equal((html.match(/class="academy-board-row"[^>]*role=/g) || []).length, 0);
  assert.equal((html.match(/class="academy-board-row"/g) || []).length, 5);
});

test('successful Manseryeok output has a concise status and calculation provenance', () => {
  assert.match(
    html,
    /id="academyManseStatus"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/
  );
  for (const field of ['mode', 'time-standard', 'day-boundary', 'basis']) {
    assert.match(html, new RegExp(`data-provenance="${field}"`));
  }
  assert.match(html, /id="academyHistoricalNotice"/);
  assert.match(manse, /calculationMode/);
  assert.match(manse, /timeStandard/);
  assert.match(manse, /dayBoundary/);
  assert.match(manse, /calculationBasis/);
  assert.match(manse, /1908년 4월 1일 이전/);
  assert.match(manse, /UTC\+9\(KST\)/);
});

test('hero emphasis does not use a red underline beneath Chwimyeongseon', () => {
  assert.doesNotMatch(css, /\.academy-title-ink::after/);
});

test('academy loads a working basic Manseryeok after the verified browser adapter', () => {
  for (const id of [
    'academyManseForm',
    'academyBirth',
    'academyTime',
    'academyUnknown',
    'academyPillars',
    'academyLuckFlow',
    'academyManseError'
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  const adapterIndex = html.indexOf('../scripts/manseryeok-adapter.js');
  const academyIndex = html.indexOf('scripts/academy-manse.js');
  assert.ok(adapterIndex >= 0 && academyIndex > adapterIndex);
  assert.match(manse, /root\.AcademyManse\s*=/);
  assert.match(manse, /root\.ManseryeokAdapter\s*=\s*root\.LegendGanji/);
  assert.match(manse, /const existing = root\.ManseryeokAdapter/);
  assert.equal(accessesRawManseryeok(manse), false);
  for (const forbidden of [
    'root.Manseryeok.calculate()',
    'window.Manseryeok.calculateFourPillars()',
    'globalThis?.Manseryeok?.calculate()',
    'self["Manseryeok"].calculateFourPillars()',
    'Manseryeok.calculateFourPillars()',
    'Manseryeok["calculateFourPillars"]()'
  ]) {
    assert.equal(accessesRawManseryeok(forbidden), true, forbidden);
  }
  for (const allowed of [
    'root.LegendGanji.calculate(input)',
    'window.ManseryeokAdapter.calculate(input)',
    'const label = "Manseryeok";'
  ]) {
    assert.equal(accessesRawManseryeok(allowed), false, allowed);
  }
  assert.doesNotMatch(html, /�|\?{2,}/);
});
