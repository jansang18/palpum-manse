const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const share = fs.readFileSync('share.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
const protectedBuild = fs.readFileSync('scripts/build-protected.ps1', 'utf8');

const runtimeAssets = [
  'polish.css',
  'luxury.css',
  'apple.css',
  'styles/legend-tokens.css',
  'styles/legend-layout.css',
  'styles/legend-motion.css',
  'main-logo.png',
  'cosmos.jpg',
  'assets/legend-landscape.webp',
  'assets/legend-seal.webp',
  'scripts/vendor/manseryeok.browser.js',
  'scripts/manseryeok-adapter.js',
  'scripts/legend-era.js',
  'scripts/legend-resonance.js',
  'scripts/legend-copy.js',
  'scripts/legend-view.js',
  'scripts/legend-nav.js',
  'share.js',
  'nav.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png'
];

function escaped(path) {
  return new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

test('uses legend-specific PWA identity and colors', () => {
  assert.equal(manifest.name, '취명선 전설의 만세력');
  assert.equal(manifest.short_name, '전설의 만세력');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.background_color, '#F2ECDD');
  assert.equal(manifest.theme_color, '#F2ECDD');
  assert.match(serviceWorker, /legend-manse-/);
  assert.doesNotMatch(serviceWorker, /chwimyeongseon-manse-/);
});

test('precaches every legend runtime asset for an offline first visit', () => {
  assert.match(serviceWorker, /const\s+PRECACHE\s*=\s*\[/);
  assert.match(serviceWorker, /c\.addAll\(PRECACHE\)/);
  for (const asset of runtimeAssets) {
    assert.match(serviceWorker, escaped(`./${asset}`), `${asset} must be precached`);
  }
});

test('activation preserves caches owned by other deployments', () => {
  assert.match(serviceWorker, /startsWith\(CACHE_PREFIX\)/);
  assert.doesNotMatch(serviceWorker, /startsWith\(['"]chwimyeongseon-manse-/);
  assert.doesNotMatch(serviceWorker, /keys\.filter\(\s*\(?[a-z]\)?\s*=>\s*[a-z]\s*!==\s*CACHE\s*\)/);
});

test('protects every legend runtime asset in the release inventory', () => {
  for (const asset of runtimeAssets.filter(asset => ![
    'manifest.webmanifest',
    'icon-192.png',
    'icon-512.png',
    'apple-touch-icon.png'
  ].includes(asset))) {
    assert.match(protectedBuild, escaped(`'${asset}'`), `${asset} must be in the protected inventory`);
  }
});

test('isolates live records in the legend storage namespace', () => {
  assert.match(html, /const\s+LEGEND_STORAGE_PREFIX\s*=\s*['"]legend-saju:['"]/);
  assert.match(html, /const\s+LEGEND_FALLBACK_KEY\s*=\s*['"]legend-saju:records['"]/);
  assert.match(html, /const\s+LEGEND_THEME_KEY\s*=\s*['"]legend-saju:theme['"]/);
  assert.doesNotMatch(html, /window\.storage\.(?:get|set|delete|list)\(\s*['"`]saju:/);
  assert.doesNotMatch(html, /localStorage\.(?:getItem|setItem|removeItem)\(\s*['"]saju_list['"]/);
  assert.doesNotMatch(html, /saju_theme/);
});

test('exports exact product schema and rule metadata', () => {
  assert.match(html, /product:\s*['"]legend-manse['"]/);
  assert.match(html, /schemaVersion:\s*2/);
  assert.match(html, /ruleVersion:\s*['"]legend-1['"]/);
  assert.match(html, /exportedAt:\s*new Date\(\)\.toISOString\(\)/);
  assert.match(html, /\brecords:\s*list\b/);
});

test('normalizes validated legacy backups into the legend namespace', () => {
  assert.match(html, /function\s+normalizeImportedBackup\(/);
  assert.match(html, /function\s+normalizeImportedRecord\(/);
  assert.match(html, /data\.product\s*===\s*['"]legend-manse['"]/);
  assert.match(html, /data\.schemaVersion\s*===\s*2/);
  assert.match(html, /data\.version\s*===\s*1/);
  assert.match(html, /window\.storage\.set\(`\$\{LEGEND_STORAGE_PREFIX\}\$\{record\.id\}`/);
});

test('shares era, resonance relation, and all four pillars without guarantees', () => {
  assert.match(share, /function\s+buildLegendShareText\(/);
  assert.match(share, /LegendEra\.getLegendEra/);
  assert.match(share, /resonance\.relation/);
  assert.match(share, /하원/);
  assert.match(share, /시주.*일주.*월주.*년주/s);
  assert.doesNotMatch(share, /완치|치료|수명|질병|대박|부자\s*보장|재물\s*보장|확실한\s*수익/);
});
