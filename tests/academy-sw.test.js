const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const serviceWorker = fs.readFileSync(path.join(__dirname, '..', 'academy', 'sw.js'), 'utf8');
const scope = 'https://example.test/palpum-manse/academy/';
const academyCacheName = 'chwimyeongseon-academy-v3-20260728-seasonal-hero';

function response(body, init = {}) {
  const status = init.status ?? 200;
  return {
    body,
    status,
    ok: status >= 200 && status < 300,
    clone() {
      return response(body, { status });
    }
  };
}

function disturbableResponse(body) {
  let disturbed = false;
  let cloneCalls = 0;
  return {
    value: {
      body,
      status: 200,
      ok: true,
      clone() {
        if (disturbed) throw new Error('response body is already disturbed');
        cloneCalls += 1;
        return response(body);
      }
    },
    disturb() {
      disturbed = true;
    },
    cloneCalls: () => cloneCalls
  };
}

function deferred() {
  let resolve;
  return {
    promise: new Promise(next => { resolve = next; }),
    resolve
  };
}

function createWorkerRuntime(options = {}) {
  const handlers = new Map();
  const stores = new Map();
  const deleted = [];
  const globalMatches = [];
  const events = [];
  let skipWaitingCalls = 0;
  let openCount = 0;

  const requestUrl = request => new URL(
    typeof request === 'string' ? request : request.url,
    scope
  ).href;
  const normalizedUrl = (request, ignoreSearch) => {
    const url = new URL(requestUrl(request));
    if (ignoreSearch) url.search = '';
    return url.href;
  };
  const getStore = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  };
  const cacheFor = name => ({
    addAll(entries) {
      events.push({ type: 'addAll', name, entries: [...entries] });
      if (options.rejectAddAll) return Promise.reject(new Error('precache failed'));
      for (const entry of entries) getStore(name).set(normalizedUrl(entry), response(`precache:${entry}`));
      return Promise.resolve();
    },
    match(request, matchOptions = {}) {
      return Promise.resolve(getStore(name).get(normalizedUrl(request, matchOptions.ignoreSearch)));
    },
    put(request, value) {
      events.push({ type: 'put', name, url: normalizedUrl(request) });
      if (options.rejectPut) return Promise.reject(new Error('runtime cache write failed'));
      getStore(name).set(normalizedUrl(request), value);
      return Promise.resolve();
    }
  });
  const caches = {
    open(name) {
      openCount += 1;
      events.push({ type: 'open', name });
      if (options.deferOpenAt === openCount) {
        return options.openGate.promise.then(() => cacheFor(name));
      }
      return Promise.resolve(cacheFor(name));
    },
    keys() {
      return Promise.resolve([...stores.keys()]);
    },
    delete(name) {
      deleted.push(name);
      stores.delete(name);
      return Promise.resolve(true);
    },
    match(request) {
      globalMatches.push(requestUrl(request));
      return Promise.resolve(options.globalFallback);
    }
  };
  const self = {
    registration: { scope },
    clients: { claim: () => Promise.resolve() },
    skipWaiting() {
      skipWaitingCalls += 1;
      return Promise.resolve();
    },
    addEventListener(type, handler) {
      handlers.set(type, handler);
    }
  };

  vm.runInNewContext(serviceWorker, {
    self,
    caches,
    URL,
    Promise,
    Set,
    fetch: options.fetch || (() => Promise.reject(new Error('network unavailable')))
  });

  function seed(cacheName, request, value) {
    getStore(cacheName).set(normalizedUrl(request), value);
  }

  async function dispatchLifecycle(type) {
    let lifetime;
    handlers.get(type)({
      waitUntil(promise) {
        lifetime = Promise.resolve(promise);
      }
    });
    assert.ok(lifetime, `${type} must attach work to event lifetime`);
    await lifetime;
  }

  async function dispatchFetch(request, afterResponse) {
    let responsePromise;
    const lifetimes = [];
    handlers.get('fetch')({
      request,
      respondWith(promise) {
        responsePromise = Promise.resolve(promise);
      },
      waitUntil(promise) {
        lifetimes.push(Promise.resolve(promise));
      }
    });
    const value = responsePromise && await responsePromise;
    if (afterResponse) afterResponse(value);
    return {
      intercepted: Boolean(responsePromise),
      value,
      settle: Promise.all(lifetimes),
      waitUntilCount: lifetimes.length
    };
  }

  return {
    deleted,
    events,
    globalMatches,
    seed,
    dispatchLifecycle,
    dispatchFetch,
    cacheValue(cacheName, request) {
      return getStore(cacheName).get(normalizedUrl(request));
    },
    cacheNames() {
      return [...stores.keys()];
    },
    skipWaitingCalls: () => skipWaitingCalls
  };
}

test('academy activation removes only stale academy caches and never consumes sibling fallback caches', async () => {
  const academyFallback = response('academy fallback');
  const palpumFallback = response('palpum fallback');
  const legendFallback = response('legend fallback');
  const runtime = createWorkerRuntime({ globalFallback: palpumFallback });

  runtime.seed(academyCacheName, './index.html', academyFallback);
  runtime.seed('chwimyeongseon-academy-old', './index.html', response('stale academy'));
  runtime.seed('palpum-manse-live', './index.html', palpumFallback);
  runtime.seed('legend-manse-live', './index.html', legendFallback);

  await runtime.dispatchLifecycle('activate');

  assert.deepEqual(runtime.deleted, ['chwimyeongseon-academy-old']);
  assert.deepEqual(runtime.cacheNames().sort(), [
    academyCacheName,
    'legend-manse-live',
    'palpum-manse-live'
  ].sort());
  assert.equal(runtime.cacheValue('palpum-manse-live', './index.html'), palpumFallback);
  assert.equal(runtime.cacheValue('legend-manse-live', './index.html'), legendFallback);

  const result = await runtime.dispatchFetch({
    url: `${scope}?offline=1`,
    method: 'GET',
    mode: 'navigate',
    destination: 'document'
  });

  assert.equal(result.intercepted, true);
  assert.equal(result.value, academyFallback);
  assert.deepEqual(runtime.globalMatches, []);
});

test('academy install fails closed when precache addAll rejects', async () => {
  const runtime = createWorkerRuntime({ rejectAddAll: true });

  await assert.rejects(runtime.dispatchLifecycle('install'), /precache failed/);
  assert.equal(runtime.skipWaitingCalls(), 0);
});

test('academy runtime cache writes use fetch lifetime and do not fail the response', async () => {
  const networkResponse = response('network asset');
  const runtime = createWorkerRuntime({
    rejectPut: true,
    fetch: () => Promise.resolve(networkResponse)
  });
  const request = {
    url: `${scope}styles/academy.css`,
    method: 'GET',
    mode: 'cors',
    destination: 'style'
  };

  const result = await runtime.dispatchFetch(request);

  assert.equal(result.intercepted, true);
  assert.equal(result.value, networkResponse);
  assert.equal(result.waitUntilCount, 1);
  await result.settle;
  assert.ok(runtime.events.some(event => event.type === 'put' && event.name === academyCacheName));
});

test('academy never caches unsuccessful document, code, or asset responses', async () => {
  const scenarios = [
    {
      name: '404 document',
      network: response('missing document', { status: 404 }),
      request: {
        url: `${scope}missing/`,
        method: 'GET',
        mode: 'navigate',
        destination: 'document'
      }
    },
    {
      name: '500 document',
      network: response('document error', { status: 500 }),
      request: {
        url: `${scope}broken/`,
        method: 'GET',
        mode: 'navigate',
        destination: 'document'
      }
    },
    {
      name: '404 code',
      network: response('missing code', { status: 404 }),
      request: {
        url: `${scope}scripts/missing.js`,
        method: 'GET',
        mode: 'cors',
        destination: 'script'
      }
    },
    {
      name: '500 code',
      network: response('code error', { status: 500 }),
      request: {
        url: `${scope}scripts/broken.js`,
        method: 'GET',
        mode: 'cors',
        destination: 'script'
      }
    },
    {
      name: '404 asset',
      network: response('missing asset', { status: 404 }),
      request: {
        url: `${scope}assets/missing.webp`,
        method: 'GET',
        mode: 'cors',
        destination: 'image'
      }
    },
    {
      name: '500 asset',
      network: response('asset error', { status: 500 }),
      request: {
        url: `${scope}assets/broken.webp`,
        method: 'GET',
        mode: 'cors',
        destination: 'image'
      }
    }
  ];

  for (const scenario of scenarios) {
    const runtime = createWorkerRuntime({
      fetch: () => Promise.resolve(scenario.network)
    });
    const result = await runtime.dispatchFetch(scenario.request);

    assert.equal(result.intercepted, true, `${scenario.name}: request is handled`);
    assert.equal(result.value, scenario.network, `${scenario.name}: network status is returned`);
    await result.settle;
    assert.equal(result.waitUntilCount, 0, `${scenario.name}: no cache write lifetime is added`);
    assert.equal(
      runtime.events.some(event => event.type === 'put'),
      false,
      `${scenario.name}: unsuccessful response is not cached`
    );
  }
});

test('academy clones network responses before delayed cache writes for documents and assets', async () => {
  const cases = [
    {
      name: 'document',
      deferOpenAt: 1,
      request: {
        url: `${scope}?network-document=1`,
        method: 'GET',
        mode: 'navigate',
        destination: 'document'
      }
    },
    {
      name: 'asset',
      deferOpenAt: 2,
      request: {
        url: `${scope}styles/academy.css`,
        method: 'GET',
        mode: 'cors',
        destination: 'style'
      }
    }
  ];

  for (const scenario of cases) {
    const networkResponse = disturbableResponse(scenario.name);
    const openGate = deferred();
    const runtime = createWorkerRuntime({
      deferOpenAt: scenario.deferOpenAt,
      openGate,
      fetch: () => Promise.resolve(networkResponse.value)
    });

    const result = await runtime.dispatchFetch(scenario.request, () => networkResponse.disturb());

    assert.equal(result.value, networkResponse.value, `${scenario.name}: response returns immediately`);
    assert.equal(
      networkResponse.cloneCalls(),
      1,
      `${scenario.name}: response is cloned before delayed cache open and respondWith resolution`
    );
    openGate.resolve();
    await result.settle;
    assert.ok(
      runtime.events.some(event => event.type === 'put' && event.name === academyCacheName),
      `${scenario.name}: cloned response is written after the cache becomes available`
    );
  }
});
