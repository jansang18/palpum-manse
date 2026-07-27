const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

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

test('shares era, resonance relation, and all four pillars without guarantees', () => {
  assert.match(share, /function\s+buildLegendShareText\(/);
  assert.match(share, /LegendEra\.getLegendEra/);
  assert.match(share, /resonance\.relation/);
  assert.match(share, /하원/);
  assert.match(share, /시주.*일주.*월주.*년주/s);
  assert.doesNotMatch(share, /완치|치료|수명|질병|대박|부자\s*보장|재물\s*보장|확실한\s*수익/);
});
