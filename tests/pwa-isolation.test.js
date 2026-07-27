const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const share = fs.readFileSync('share.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
const protectedBuild = fs.readFileSync('scripts/build-protected.ps1', 'utf8');
const ganjiFixtures = fs.readFileSync('tests/ganji-fixtures.test.js', 'utf8');
const uiRegression = fs.readFileSync('tests/ui-regression.js', 'utf8');
const deploymentGuide = fs.readFileSync('웹배포_안내.md', 'utf8');
const legendView = fs.readFileSync('scripts/legend-view.js', 'utf8');

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
  'scripts/legend-storage.js',
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

test('opens on a distinct current-era legend home instead of the inherited input screen', () => {
  assert.match(
    html,
    /class="tab active"[^>]*aria-selected="true"[^>]*data-tab="legend"/
  );
  assert.match(
    html,
    /<section class="view" id="view-input"[^>]*hidden/
  );
  assert.match(
    html,
    /<section class="view active" id="view-legend"[^>]*>/
  );
  assert.match(serviceWorker, /const VERSION = 'v5-20260727-input'/);
  assert.match(serviceWorker, /const CACHE_PREFIX = 'legend-manse-'/);
  assert.match(legendView, /id\s*=\s*['"]legendLanding['"]/);
  assert.match(legendView, /id\s*=\s*['"]legendStartButton['"]/);
  assert.match(legendView, /id\s*=\s*['"]legendPersonButton['"]/);
  assert.match(legendView, /LegendEra\.getLegendEra\(new Date\(\)\.getFullYear\(\)\)/);
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
  assert.doesNotMatch(serviceWorker, /sineum-manse-/);
  assert.doesNotMatch(serviceWorker, /chwimyeongseon-manse-/);
  assert.doesNotMatch(serviceWorker, /keys\.filter\(\s*\(?[a-z]\)?\s*=>\s*[a-z]\s*!==\s*CACHE\s*\)/);
});

test('activation deletes only stale legend caches', async () => {
  const handlers = new Map();
  const deleted = [];
  let activeCache = '';
  const caches = {
    open(name) {
      activeCache = name;
      return Promise.resolve({ addAll: () => Promise.resolve(), put: () => Promise.resolve() });
    },
    keys() {
      return Promise.resolve([
        'legend-manse-previous',
        'sineum-manse-previous',
        'chwimyeongseon-manse-previous',
        activeCache
      ]);
    },
    delete(name) {
      deleted.push(name);
      return Promise.resolve(true);
    },
    match: () => Promise.resolve()
  };
  const self = {
    location: { origin: 'https://example.test' },
    clients: { claim: () => Promise.resolve() },
    addEventListener: (type, handler) => handlers.set(type, handler),
    skipWaiting: () => Promise.resolve()
  };
  vm.runInNewContext(serviceWorker, {
    self,
    caches,
    URL,
    fetch: () => Promise.reject(new Error('network unavailable')),
    Promise
  });
  const dispatch = async type => {
    let lifetime;
    handlers.get(type)({ waitUntil: promise => { lifetime = promise; } });
    await lifetime;
  };

  await dispatch('install');
  await dispatch('activate');

  assert.deepEqual(deleted, ['legend-manse-previous']);
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
  assert.match(html, /const\s+LEGEND_RECORD_PREFIX\s*=\s*['"]legend-saju:record:['"]/);
  assert.match(html, /const\s+LEGEND_FALLBACK_KEY\s*=\s*['"]legend-saju:records['"]/);
  assert.match(html, /const\s+LEGEND_THEME_KEY\s*=\s*['"]legend-saju:theme['"]/);
  assert.doesNotMatch(html, /window\.storage\.(?:get|set|delete|list)\(\s*['"`]saju:/);
  assert.doesNotMatch(html, /localStorage\.(?:getItem|setItem|removeItem)\(\s*['"]saju_list['"]/);
  assert.doesNotMatch(html, /saju_theme/);
});

test('record listing ignores theme and fallback configuration keys', async () => {
  const { createRecordStore, RECORD_PREFIX, FALLBACK_KEY, THEME_KEY } =
    require('../scripts/legend-storage.js');
  const values = new Map([
    [`${RECORD_PREFIX}primary`, JSON.stringify({ id: 'primary', name: '기본' })],
    [THEME_KEY, 'dark'],
    [FALLBACK_KEY, JSON.stringify([{ id: 'fallback', name: '보조' }])]
  ]);
  const storage = {
    list: async prefix => ({ keys: [...values.keys()].filter(key => key.startsWith(prefix)) }),
    get: async key => values.has(key) ? { value: values.get(key) } : null,
    set: async (key, value) => { values.set(key, value); },
    delete: async key => { values.delete(key); }
  };
  const fallbackStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };

  const records = await createRecordStore(storage, fallbackStorage).listRecords();

  assert.deepEqual(records.map(record => record.id).sort(), ['fallback', 'primary']);
});

test('partial import failure rolls back written records and rejects', async () => {
  const { createRecordStore, RECORD_PREFIX } = require('../scripts/legend-storage.js');
  const values = new Map();
  let writes = 0;
  const storage = {
    list: async prefix => ({ keys: [...values.keys()].filter(key => key.startsWith(prefix)) }),
    get: async key => values.has(key) ? { value: values.get(key) } : null,
    set: async (key, value) => {
      writes++;
      if (writes === 2) throw new Error('quota exceeded');
      values.set(key, value);
    },
    delete: async key => { values.delete(key); }
  };
  const fallbackStorage = {
    getItem: () => null,
    setItem: () => { throw new Error('fallback must not claim a partial import'); }
  };
  const recordStore = createRecordStore(storage, fallbackStorage);

  await assert.rejects(
    recordStore.importRecords([{ id: 'first' }, { id: 'second' }]),
    /가져오기를 저장하지 못했습니다/
  );

  assert.deepEqual([...values.keys()].filter(key => key.startsWith(RECORD_PREFIX)), []);
});

test('failed primary update makes the newer fallback authoritative', async () => {
  const { createRecordStore, RECORD_PREFIX, FALLBACK_KEY } =
    require('../scripts/legend-storage.js');
  const primary = new Map([
    [`${RECORD_PREFIX}same`, JSON.stringify({ id: 'same', memo: 'old', fav: false })]
  ]);
  let fallbackValue = '[]';
  const storage = {
    list: async prefix => ({ keys: [...primary.keys()].filter(key => key.startsWith(prefix)) }),
    get: async key => primary.has(key) ? { value: primary.get(key) } : null,
    set: async () => { throw new Error('primary unavailable'); },
    delete: async key => { primary.delete(key); }
  };
  const fallbackStorage = {
    getItem: key => key === FALLBACK_KEY ? fallbackValue : null,
    setItem: (key, value) => {
      if (key === FALLBACK_KEY) fallbackValue = value;
    }
  };
  const recordStore = createRecordStore(storage, fallbackStorage);

  await recordStore.updateRecord('same', { memo: 'new', fav: true });

  assert.deepEqual(await recordStore.getRecord('same'), {
    id: 'same',
    memo: 'new',
    fav: true
  });
});

test('successful primary write clears the superseded fallback afterward', async () => {
  const { createRecordStore, RECORD_PREFIX, FALLBACK_KEY } =
    require('../scripts/legend-storage.js');
  const primary = new Map([
    [`${RECORD_PREFIX}same`, JSON.stringify({ id: 'same', memo: 'old' })]
  ]);
  let fallbackValue = JSON.stringify([{ id: 'same', memo: 'fallback' }]);
  const storage = {
    list: async prefix => ({ keys: [...primary.keys()].filter(key => key.startsWith(prefix)) }),
    get: async key => primary.has(key) ? { value: primary.get(key) } : null,
    set: async (key, value) => { primary.set(key, value); },
    delete: async key => { primary.delete(key); }
  };
  const fallbackStorage = {
    getItem: key => key === FALLBACK_KEY ? fallbackValue : null,
    setItem: (key, value) => {
      if (key === FALLBACK_KEY) fallbackValue = value;
    }
  };
  const recordStore = createRecordStore(storage, fallbackStorage);

  await recordStore.saveRecord({ id: 'same', memo: 'primary-new' });

  assert.deepEqual(JSON.parse(fallbackValue), []);
  assert.equal((await recordStore.getRecord('same')).memo, 'primary-new');
});

test('failed primary deletion preserves the latest fallback record', async () => {
  const { createRecordStore, RECORD_PREFIX, FALLBACK_KEY } =
    require('../scripts/legend-storage.js');
  const primary = new Map([
    [`${RECORD_PREFIX}same`, JSON.stringify({ id: 'same', memo: 'old' })]
  ]);
  let fallbackValue = JSON.stringify([{ id: 'same', memo: 'new' }]);
  const storage = {
    list: async prefix => ({ keys: [...primary.keys()].filter(key => key.startsWith(prefix)) }),
    get: async key => primary.has(key) ? { value: primary.get(key) } : null,
    set: async (key, value) => { primary.set(key, value); },
    delete: async () => { throw new Error('primary delete failed'); }
  };
  const fallbackStorage = {
    getItem: key => key === FALLBACK_KEY ? fallbackValue : null,
    setItem: (key, value) => {
      if (key === FALLBACK_KEY) fallbackValue = value;
    }
  };
  const recordStore = createRecordStore(storage, fallbackStorage);

  await assert.rejects(recordStore.deleteRecord('same'), /삭제하지 못했습니다/);

  assert.deepEqual(JSON.parse(fallbackValue), [{ id: 'same', memo: 'new' }]);
  assert.equal((await recordStore.getRecord('same')).memo, 'new');
});

test('incomplete import rollback reports residual count and ids', async () => {
  const { createRecordStore, RECORD_PREFIX } = require('../scripts/legend-storage.js');
  const primary = new Map();
  let writes = 0;
  const storage = {
    list: async prefix => ({ keys: [...primary.keys()].filter(key => key.startsWith(prefix)) }),
    get: async key => primary.has(key) ? { value: primary.get(key) } : null,
    set: async (key, value) => {
      writes++;
      if (writes === 2) throw new Error('second write failed');
      primary.set(key, value);
    },
    delete: async () => { throw new Error('rollback delete failed'); }
  };
  const fallbackStorage = {
    getItem: () => null,
    setItem: () => {}
  };
  const recordStore = createRecordStore(storage, fallbackStorage);

  const error = await recordStore
    .importRecords([{ id: 'first' }, { id: 'second' }])
    .then(() => null, reason => reason);

  assert.equal(error.rollbackIncomplete, true);
  assert.deepEqual(error.residualIds, ['first']);
  assert.match(error.message, /롤백이 완료되지 않았습니다/);
  assert.match(error.message, /1개/);
  assert.match(error.message, /first/);
  assert.equal(primary.has(`${RECORD_PREFIX}first`), true);
});

test('fallback read failure blocks get, list, and delete decisions', async () => {
  const { createRecordStore, RECORD_PREFIX } = require('../scripts/legend-storage.js');
  const primary = new Map([
    [`${RECORD_PREFIX}same`, JSON.stringify({ id: 'same', memo: 'stale' })]
  ]);
  let deleteCalls = 0;
  const storage = {
    list: async prefix => ({ keys: [...primary.keys()].filter(key => key.startsWith(prefix)) }),
    get: async key => primary.has(key) ? { value: primary.get(key) } : null,
    set: async (key, value) => { primary.set(key, value); },
    delete: async key => {
      deleteCalls++;
      primary.delete(key);
    }
  };
  const fallbackStorage = {
    getItem: () => { throw new Error('local storage blocked'); },
    setItem: () => {}
  };
  const recordStore = createRecordStore(storage, fallbackStorage);

  for (const operation of [
    () => recordStore.getRecord('same'),
    () => recordStore.listRecords(),
    () => recordStore.deleteRecord('same')
  ]) {
    await assert.rejects(operation, error => {
      assert.equal(error.code, 'LEGEND_STORAGE_UNAVAILABLE');
      return true;
    });
  }

  assert.equal(deleteCalls, 0);
  assert.equal(primary.has(`${RECORD_PREFIX}same`), true);
});

test('storage read failures are not rendered as empty UI state', () => {
  assert.doesNotMatch(
    html,
    /recordStore\.listRecords\(\);\s*\}\s*catch\s*\(error\)\s*\{\s*\}/
  );
  assert.doesNotMatch(
    html,
    /recordStore\.getRecord\(id\);\s*\}\s*catch\s*\(error\)\s*\{\s*\}/
  );
  assert.match(html, /function\s+reportLegendStorageError\(error\)/);
});

test('primary list failure propagates instead of accepting an empty fallback as authoritative', async () => {
  const { createRecordStore } = require('../scripts/legend-storage.js');
  const recordStore = createRecordStore({
    list: async () => { throw new Error('primary list unavailable'); },
    get: async () => null,
    set: async () => {},
    delete: async () => {}
  }, {
    getItem: () => null,
    setItem: () => {}
  });

  await assert.rejects(recordStore.listRecords(), error => {
    assert.equal(error.code, 'LEGEND_STORAGE_UNAVAILABLE');
    assert.match(error.message, /저장소 상태/);
    return true;
  });
});

test('primary entry read failure aborts the list instead of hiding one record', async () => {
  const { createRecordStore, RECORD_PREFIX } = require('../scripts/legend-storage.js');
  const recordStore = createRecordStore({
    list: async () => ({ keys: [`${RECORD_PREFIX}kept`] }),
    get: async () => { throw new Error('primary record unavailable'); },
    set: async () => {},
    delete: async () => {}
  }, {
    getItem: () => JSON.stringify([{ id: 'fallback-only' }]),
    setItem: () => {}
  });

  await assert.rejects(recordStore.listRecords(), error => {
    assert.equal(error.code, 'LEGEND_STORAGE_UNAVAILABLE');
    return true;
  });
});

test('primary get failure propagates even when the fallback has no matching record', async () => {
  const { createRecordStore } = require('../scripts/legend-storage.js');
  const recordStore = createRecordStore({
    list: async () => ({ keys: [] }),
    get: async () => { throw new Error('primary get unavailable'); },
    set: async () => {},
    delete: async () => {}
  }, {
    getItem: () => '[]',
    setItem: () => {}
  });

  await assert.rejects(recordStore.getRecord('kept'), error => {
    assert.equal(error.code, 'LEGEND_STORAGE_UNAVAILABLE');
    return true;
  });
});

test('a successful primary read still lets a newer fallback record win', async () => {
  const { createRecordStore, RECORD_PREFIX, FALLBACK_KEY } =
    require('../scripts/legend-storage.js');
  const primary = new Map([
    [`${RECORD_PREFIX}same`, JSON.stringify({ id: 'same', memo: 'primary-old' })]
  ]);
  const recordStore = createRecordStore({
    list: async () => ({ keys: [...primary.keys()] }),
    get: async key => primary.has(key) ? { value: primary.get(key) } : null,
    set: async () => {},
    delete: async () => {}
  }, {
    getItem: key => key === FALLBACK_KEY
      ? JSON.stringify([{ id: 'same', memo: 'fallback-new' }])
      : null,
    setItem: () => {}
  });

  assert.equal((await recordStore.getRecord('same')).memo, 'fallback-new');
  assert.equal((await recordStore.listRecords())[0].memo, 'fallback-new');
});

test('write-then-throw import rolls back every attempted id', async () => {
  const { createRecordStore, RECORD_PREFIX } = require('../scripts/legend-storage.js');
  const primary = new Map();
  let deleteCalls = 0;
  const storage = {
    list: async prefix => ({ keys: [...primary.keys()].filter(key => key.startsWith(prefix)) }),
    get: async key => primary.has(key) ? { value: primary.get(key) } : null,
    set: async (key, value) => {
      primary.set(key, value);
      throw new Error('persisted then rejected');
    },
    delete: async key => {
      deleteCalls++;
      primary.delete(key);
    }
  };
  const recordStore = createRecordStore(storage, {
    getItem: () => null,
    setItem: () => {}
  });

  const error = await recordStore
    .importRecords([{ id: 'write-then-throw' }])
    .then(() => null, reason => reason);

  assert.equal(error.rollbackIncomplete, undefined);
  assert.equal(deleteCalls, 1);
  assert.equal(primary.has(`${RECORD_PREFIX}write-then-throw`), false);
});

test('post-rollback verification reports write-then-throw residual values', async () => {
  const { createRecordStore, RECORD_PREFIX } = require('../scripts/legend-storage.js');
  const primary = new Map();
  const storage = {
    list: async prefix => ({ keys: [...primary.keys()].filter(key => key.startsWith(prefix)) }),
    get: async key => primary.has(key) ? { value: primary.get(key) } : null,
    set: async (key, value) => {
      primary.set(key, value);
      throw new Error('persisted then rejected');
    },
    delete: async () => {}
  };
  const recordStore = createRecordStore(storage, {
    getItem: () => null,
    setItem: () => {}
  });

  const error = await recordStore
    .importRecords([{ id: 'write-then-throw' }])
    .then(() => null, reason => reason);

  assert.equal(error.rollbackIncomplete, true);
  assert.equal(error.residualCount, 1);
  assert.deepEqual(error.residualIds, ['write-then-throw']);
  assert.match(error.message, /1/);
  assert.match(error.message, /write-then-throw/);
  assert.equal(primary.has(`${RECORD_PREFIX}write-then-throw`), true);
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
  assert.match(html, /recordStore\.importRecords\(accepted\)/);
});

test('runs browser Ganji integration fixtures in the default cross-platform gate', () => {
  assert.doesNotMatch(ganjiFixtures, /RUN_UI_GANJI|skip:\s*process\.env/);
  assert.match(ganjiFixtures, /process\.platform/);
  assert.match(ganjiFixtures, /CHROME_PATH/);
  assert.match(ganjiFixtures, /test\.after/);
});

test('discovers an installed UI browser across supported desktop platforms', () => {
  assert.match(uiRegression, /function\s+findChromeExecutable\(/);
  assert.match(uiRegression, /process\.env\.CHROME_PATH/);
  assert.match(uiRegression, /process\.platform\s*===\s*['"]win32['"]/);
  assert.match(uiRegression, /process\.platform\s*===\s*['"]darwin['"]/);
  for (const browserName of ['Google Chrome', 'Chromium', 'Microsoft Edge']) {
    assert.match(uiRegression, new RegExp(browserName));
  }
  for (const linuxCandidate of [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/microsoft-edge'
  ]) {
    assert.match(uiRegression, new RegExp(linuxCandidate.replaceAll('/', '\\/')));
  }
  assert.match(uiRegression, /fs\.existsSync/);
  assert.match(uiRegression, /Set CHROME_PATH/);
  assert.doesNotMatch(
    uiRegression,
    /const CHROME\s*=\s*process\.env\.CHROME_PATH\s*\|\|\s*['"]C:\\\\/
  );
  assert.doesNotMatch(uiRegression, /puppeteer\s+browsers\s+install|npx\s+puppeteer/i);
});

test('shares era, resonance relation, and all four pillars without guarantees', () => {
  assert.match(share, /function\s+buildLegendShareText\(/);
  assert.match(share, /LegendEra\.getLegendEra/);
  assert.match(share, /resonance\.relation/);
  assert.match(share, /하원/);
  assert.match(share, /시주.*일주.*월주.*년주/s);
  assert.doesNotMatch(share, /완치|치료|수명|질병|대박|부자\s*보장|재물\s*보장|확실한\s*수익/);
});

test('discloses pre-1908 UTC+9 approximation in About and every share surface', () => {
  assert.match(html, /· 1800년 ~ 1908년 3월 : KASI 절기 · UTC\+9 기준 근사/);
  assert.match(html, /· 1026년 ~ 1799년 : 역사 범위 근사/);
  assert.match(share, /function\s+calculationProvenance\(/);
  assert.match(share, /1908년 4월 이전 UTC\+9 기준 근사/);
  assert.ok(
    (share.match(/calculationProvenance\(s\)/g) || []).length >= 2,
    'share image and text must use the same calculation provenance'
  );
});

test('uses Wikimedia for structured people data and NamuWiki for detail lookup', () => {
  assert.match(html, /function\s+buildNamuWikiUrl\(/);
  assert.match(html, /https:\/\/namu\.wiki\/Search\?q=/);
  assert.match(html, /class="ps-namuwiki"/);
  assert.match(html, /나무위키에서 보기|나무위키 🔍/);
  assert.match(html, /위키백과·위키데이터[^<]*생년월일/);
  assert.match(html, /class="ps-item"[^>]*role="button"[^>]*tabindex="0"/);
  assert.match(html, /addEventListener\('keydown'/);
  assert.match(html, /<label[^>]*for="psQuery"[^>]*>[^<]*인물 이름[^<]*<\/label>/);
  assert.match(html, /id="psStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /function\s+setPersonSearchStatus\(/);
  assert.match(html, /class="ps-item-shell"[\s\S]*?class="ps-item"[\s\S]*?<\/div>\s*<a class="ps-namuwiki"/);
  assert.doesNotMatch(html, /function\s+buildNaverUrl\(|class="ps-naver"|네이버 🔍/);
  assert.match(deploymentGuide, /브라우저[^.\n]*통합 회귀 8개/);
});
