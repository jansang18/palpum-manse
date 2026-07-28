const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const repoRoot = path.resolve(__dirname, '..');
const academyRoot = path.join(repoRoot, 'academy');
const viewports = [
  { name: 'full-hd', width: 1920, height: 1080 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'hd', width: 1280, height: 720 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 360, height: 800 }
];

function chromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium'
  ].filter(Boolean);
  const executable = candidates.find(candidate => fs.existsSync(candidate));
  if (!executable) throw new Error('Chrome or Edge executable was not found');
  return executable;
}

function contentType(filePath) {
  return {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.webp': 'image/webp'
  }[path.extname(filePath)] || 'application/octet-stream';
}

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const deploymentPrefix = '/palpum-manse/';
      const academyPrefix = `${deploymentPrefix}academy/`;
      const relative = pathname === academyPrefix || pathname === academyPrefix.slice(0, -1)
        ? 'academy/index.html'
        : pathname.startsWith(deploymentPrefix)
          ? pathname.slice(deploymentPrefix.length)
          : '';
      const filePath = path.resolve(repoRoot, relative);

      if (!filePath.startsWith(repoRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }

      response.writeHead(200, { 'Content-Type': contentType(filePath) });
      fs.createReadStream(filePath).pipe(response);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function inspectOfflineRelease(page) {
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(page.testUrl, { waitUntil: 'networkidle0' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  const online = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const manifestUrl = document.querySelector('link[rel="manifest"]').href;
    const manifest = await fetch(manifestUrl).then(response => response.json());
    const cacheNames = await caches.keys();
    const academyCache = cacheNames.find(name => name.startsWith('chwimyeongseon-academy-'));
    const cache = await caches.open(academyCache);
    const requests = await cache.keys();

    return {
      scope: registration.scope,
      controller: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL,
      manifest: {
        id: manifest.id,
        startUrl: new URL(manifest.start_url, manifestUrl).pathname,
        scope: new URL(manifest.scope, manifestUrl).pathname
      },
      cacheNames,
      cachedPaths: requests.map(request => new URL(request.url).pathname).sort()
    };
  });

  await page.setOfflineMode(true);
  try {
    await page.goto(`${page.testUrl}?offline-release-audit=1`, { waitUntil: 'domcontentloaded' });
    return {
      online,
      offlineTitle: await page.$eval('#academyHomeTitle', node => node.textContent.replace(/\s+/g, ' ').trim())
    };
  } finally {
    await page.setOfflineMode(false);
  }
}

async function inspectLayout(page, viewport) {
  await page.setViewport(viewport);
  await page.goto(page.testUrl, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.academy-home-copy.is-revealed');
  await page.waitForSelector('[data-count-complete="true"]');

  return page.evaluate(() => {
    const toRect = box => ({
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      left: box.left,
      width: box.width,
      height: box.height
    });
    const rect = selector => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return toRect(box);
    };
    const isRendered = node => {
      const computed = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return computed.display !== 'none'
        && computed.visibility !== 'hidden'
        && box.width > 0
        && box.height > 0;
    };
    const isContained = box => (
      box.top >= 0
      && box.left >= 0
      && box.right <= window.innerWidth
      && box.bottom <= window.innerHeight
    );
    const identify = node => (
      node.id
      || (typeof node.className === 'string' && node.className.trim())
      || `${node.tagName.toLowerCase()}:${node.textContent.trim().slice(0, 24)}`
    );
    const intersectsViewport = box => (
      box.right > 0
      && box.left < window.innerWidth
      && box.bottom > 0
      && box.top < window.innerHeight
    );
    const horizontalContainmentFailures = [...document.querySelectorAll('body *')]
      .filter(node => {
        if (!isRendered(node)) return false;
        if (node.closest('[aria-hidden="true"]')) return false;
        const navigation = node.closest('.academy-navigation');
        if (navigation && node !== navigation) return false;
        const box = node.getBoundingClientRect();
        if (!intersectsViewport(box) && box.bottom <= 0) return false;
        return box.left < 0 || box.right > window.innerWidth;
      })
      .map(node => ({
        element: identify(node),
        rect: toRect(node.getBoundingClientRect())
      }));
    const touchTargetFailures = [...document.querySelectorAll(
      'a[href], button, input:not([type="hidden"]):not([type="checkbox"]), select, textarea, summary, .academy-check-field'
    )]
      .filter(isRendered)
      .filter(node => {
        const box = node.getBoundingClientRect();
        return box.width < 44 || box.height < 44;
      })
      .map(node => ({
        element: identify(node),
        rect: toRect(node.getBoundingClientRect())
      }));
    const ctaRects = [...document.querySelectorAll('.academy-home-actions a')]
      .map(node => ({
        element: identify(node),
        rect: toRect(node.getBoundingClientRect()),
        contained: isContained(node.getBoundingClientRect())
      }));
    const navViewport = document.querySelector('.academy-navigation');
    const navViewportRect = navViewport.getBoundingClientRect();
    const navLabelOverflow = [...navViewport.querySelectorAll('a')]
      .filter(node => node.scrollWidth > node.clientWidth)
      .map(node => node.textContent.trim());
    const masthead = rect('.academy-masthead');
    const protectedSelectors = [
      '#academyHomeTitle',
      '.academy-home-actions',
      '.academy-home-facts'
    ];
    const fixedOverlap = protectedSelectors.reduce((largest, selector) => {
      const box = rect(selector);
      return Math.max(largest, masthead.bottom - box.top);
    }, 0);
    return {
      title: rect('#academyHomeTitle'),
      actions: rect('.academy-home-actions'),
      ctaRects,
      facts: rect('.academy-home-facts'),
      hero: rect('#academyHome'),
      masthead,
      navViewport: {
        rect: toRect(navViewportRect),
        contained: (
          navViewportRect.left >= 0
          && navViewportRect.right <= window.innerWidth
          && navViewportRect.top >= 0
          && navViewportRect.bottom <= window.innerHeight
        ),
        horizontallyScrollable: navViewport.scrollWidth > navViewport.clientWidth
      },
      orbit: rect('.academy-orbit'),
      orbitNodes: document.querySelectorAll('.academy-orbit-node').length,
      parallaxLayers: document.querySelectorAll('[data-parallax-layer]').length,
      mistBands: document.querySelectorAll('.academy-mist').length,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      fixedOverlap: Math.max(0, fixedOverlap),
      horizontalContainmentFailures,
      touchTargetFailures,
      navLabelOverflow,
      mastheadPosition: getComputedStyle(document.querySelector('.academy-masthead')).position,
      titleText: document.querySelector('#academyHomeTitle').textContent.replace(/\s+/g, ' ').trim()
    };
  });
}

async function inspectReducedMotion(page) {
  await page.setViewport({ width: 1280, height: 720 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(page.testUrl, { waitUntil: 'networkidle0' });
  await page.mouse.move(1100, 600);
  await page.evaluate(() => window.scrollTo(0, 400));
  await new Promise(resolve => setTimeout(resolve, 80));

  return page.evaluate(() => {
    const computed = selector => {
      const styles = getComputedStyle(document.querySelector(selector));
      return {
        animationName: styles.animationName,
        transform: styles.transform,
        transitionDuration: styles.transitionDuration
      };
    };
    return {
      mist: computed('.academy-mist'),
      orbit: computed('.academy-orbit-ring'),
      parallax: computed('[data-parallax-layer]'),
      ink: computed('.academy-title-ink'),
      reveal: computed('[data-reveal]'),
      count: document.querySelector('[data-count]').textContent,
      countComplete: document.querySelector('[data-count]').dataset.countComplete,
      pointerX: getComputedStyle(document.querySelector('#academyHome')).getPropertyValue('--pointer-x').trim(),
      pointerY: getComputedStyle(document.querySelector('#academyHome')).getPropertyValue('--pointer-y').trim(),
      scrollDepth: getComputedStyle(document.querySelector('#academyHome')).getPropertyValue('--scroll-depth').trim()
    };
  });
}

async function inspectMotionLifecycle(page) {
  await page.evaluateOnNewDocument(() => {
    const trackedTypes = new Set(['pointermove', 'scroll']);
    const listeners = new Map([...trackedTypes].map(type => [type, new Set()]));
    const originalAdd = window.addEventListener.bind(window);
    const originalRemove = window.removeEventListener.bind(window);

    window.addEventListener = function (type, listener, options) {
      if (trackedTypes.has(type)) listeners.get(type).add(listener);
      return originalAdd(type, listener, options);
    };
    window.removeEventListener = function (type, listener, options) {
      if (trackedTypes.has(type)) listeners.get(type).delete(listener);
      return originalRemove(type, listener, options);
    };
    window.__academyMotionListeners = function () {
      return Object.fromEntries(
        [...listeners].map(([type, handlers]) => [type, handlers.size])
      );
    };
  });

  await page.setViewport({ width: 1280, height: 720 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.goto(page.testUrl, { waitUntil: 'networkidle0' });
  const states = await page.evaluate(() => {
    let hidden = false;
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get() { return hidden; }
    });
    const snapshot = () => ({
      listeners: window.__academyMotionListeners(),
      paused: document.body.classList.contains('is-motion-paused')
    });
    const active = snapshot();
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    const background = snapshot();
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    const restored = snapshot();
    return { active, background, restored };
  });

  return states;
}

async function inspectMockupDialogs(page) {
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(page.testUrl, { waitUntil: 'networkidle0' });

  async function openAndClose(trigger, dialog) {
    await page.evaluate(selector => document.querySelector(selector).scrollIntoView(), trigger);
    await page.click(trigger);
    await page.waitForSelector(`${dialog}[open]`);
    const opened = await page.evaluate(selector => ({
      open: document.querySelector(selector).open,
      focused: document.activeElement.matches(`${selector} [data-dialog-close]`)
    }), dialog);
    await page.click(`${dialog} [data-dialog-close]`);
    await page.waitForFunction(selector => !document.querySelector(selector).open, {}, dialog);
    const restored = await page.evaluate(selector => document.activeElement.matches(selector), trigger);
    return { opened, restored };
  }

  const course = await openAndClose('[data-course-id="foundation"]', '#courseDialog');
  const board = await openAndClose('[data-board-action="write"]', '#boardDialog');
  const payment = await openAndClose('[data-plan-id="full"]', '#paymentDialog');

  await page.click('[data-board-action="write"]');
  await page.click('#boardDialog button[type="submit"]');
  const boardNotice = await page.$eval('#boardDialog .academy-dialog-note', node => node.textContent);
  await page.keyboard.press('Escape');

  await page.click('[data-plan-id="full"]');
  await page.click('#paymentDialog button[type="submit"]');
  const paymentNotice = await page.$eval('#paymentDialog .academy-dialog-note', node => node.textContent);
  await page.keyboard.press('Escape');

  return { course, board, payment, boardNotice, paymentNotice };
}

async function inspectAccessibility(page) {
  await page.setViewport({ width: 767, height: 900 });
  await page.goto(page.testUrl, { waitUntil: 'networkidle0' });
  const compactColumns = await page.evaluate(() => {
    const columns = selector => getComputedStyle(document.querySelector(selector))
      .gridTemplateColumns
      .split(' ')
      .filter(Boolean)
      .length;
    return {
      courses: columns('.academy-course-grid'),
      cases: columns('.academy-case-grid'),
      plans: columns('.academy-plan-grid'),
      fields: columns('.academy-manse-fields')
    };
  });

  await page.setViewport({ width: 360, height: 800 });
  await page.goto(page.testUrl, { waitUntil: 'networkidle0' });

  async function focusSnapshot(expectedSelector) {
    return page.evaluate(selector => {
      const node = document.activeElement;
      const computed = getComputedStyle(node);
      const ownRect = node.getBoundingClientRect();
      const target = node.matches('input[type="checkbox"]')
        ? node.closest('label')
        : node;
      const targetRect = target.getBoundingClientRect();
      return {
        expectedSelector: selector,
        matches: node.matches(selector),
        body: node === document.body,
        label: node.textContent.replace(/\s+/g, ' ').trim(),
        id: node.id,
        focusVisible: node.matches(':focus-visible'),
        outlineStyle: computed.outlineStyle,
        outlineWidth: Number.parseFloat(computed.outlineWidth),
        ownRect: {
          width: ownRect.width,
          height: ownRect.height
        },
        targetRect: {
          width: targetRect.width,
          height: targetRect.height
        }
      };
    }, expectedSelector);
  }

  async function tabUntil(selector, maxTabs = 40) {
    for (let count = 0; count < maxTabs; count += 1) {
      await page.keyboard.press('Tab');
      const snapshot = await focusSnapshot(selector);
      if (snapshot.matches) return snapshot;
      assert.notEqual(snapshot.body, true, `${selector}: focus reached body before target`);
    }
    throw new Error(`${selector}: keyboard journey did not reach target`);
  }

  async function dialogJourney(triggerSelector, dialogSelector) {
    const triggerBeforeOpen = await focusSnapshot(triggerSelector);
    assert.equal(triggerBeforeOpen.matches, true, `${triggerSelector}: exact trigger is focused`);
    await page.keyboard.press('Enter');
    await page.waitForSelector(`${dialogSelector}[open]`);

    const initial = await focusSnapshot(`${dialogSelector} [data-dialog-close]`);
    const controls = await page.$$eval(
      `${dialogSelector} button:not([disabled]), ${dialogSelector} input:not([disabled]), ${dialogSelector} textarea:not([disabled]), ${dialogSelector} select:not([disabled]), ${dialogSelector} a[href]`,
      nodes => nodes
        .filter(node => {
          const computed = getComputedStyle(node);
          const box = node.getBoundingClientRect();
          return computed.display !== 'none'
            && computed.visibility !== 'hidden'
            && box.width > 0
            && box.height > 0;
        })
        .map(node => ({
          element: node.id || node.getAttribute('aria-label') || node.name || node.textContent.trim(),
          width: node.getBoundingClientRect().width,
          height: node.getBoundingClientRect().height
        }))
    );

    async function activeDialogStep() {
      return page.evaluate(selector => {
        const active = document.activeElement;
        let identity = active.tagName.toLowerCase();
        if (active.hasAttribute('data-dialog-close')) {
          identity = 'close';
        } else if (active.matches('button[type="submit"]')) {
          identity = 'submit';
        } else if (active.name) {
          identity = `${active.tagName.toLowerCase()}:${active.name}`;
        }
        return {
          identity,
          body: active === document.body,
          inside: document.querySelector(selector).contains(active),
          focusVisible: active.matches(':focus-visible'),
          outlineWidth: Number.parseFloat(getComputedStyle(active).outlineWidth)
        };
      }, dialogSelector);
    }

    const forwardCycle = [await activeDialogStep()];
    for (let count = 0; count < controls.length; count += 1) {
      await page.keyboard.press('Tab');
      forwardCycle.push(await activeDialogStep());
    }

    const reverseCycle = [];
    for (let count = 0; count < controls.length + 1; count += 1) {
      await page.keyboard.down('Shift');
      await page.keyboard.press('Tab');
      await page.keyboard.up('Shift');
      reverseCycle.push(await activeDialogStep());
    }

    await page.keyboard.press('Escape');
    await page.waitForFunction(selector => !document.querySelector(selector).open, {}, dialogSelector);
    const restored = await focusSnapshot(triggerSelector);
    return {
      triggerBeforeOpen,
      initial,
      controls,
      backwardBoundary: reverseCycle[0],
      forwardCycle,
      forwardOrder: forwardCycle.map(step => step.identity),
      reverseCycle,
      reverseOrder: reverseCycle.map(step => step.identity),
      restored
    };
  }

  const journey = {
    skip: await tabUntil('.academy-skip-link'),
    masthead: await tabUntil('.academy-brand'),
    heroCta: await tabUntil('.academy-home-actions a:first-child'),
    courseButton: await tabUntil('[data-course-id="foundation"]')
  };
  journey.courseTitle = await page.evaluate(
    () => document.activeElement.closest('.academy-course-card').querySelector('h3').textContent.trim()
  );
  const dialogs = {
    course: await dialogJourney('[data-course-id="foundation"]', '#courseDialog')
  };

  journey.form = [];
  for (const selector of [
    '#academyName',
    '#academyGender',
    '#academyCalendar',
    '#academyBirth',
    '#academyTime',
    '#academyUnknown',
    '#academyCalculate'
  ]) {
    journey.form.push(await tabUntil(selector));
  }
  journey.boardTrigger = await tabUntil('[data-board-action="write"]');
  dialogs.board = await dialogJourney('[data-board-action="write"]', '#boardDialog');
  journey.paymentTrigger = await tabUntil('[data-plan-id="foundation"]');
  dialogs.payment = await dialogJourney('[data-plan-id="foundation"]', '#paymentDialog');

  await page.evaluate(() => {
    const form = document.querySelector('#academyManseForm');
    form.elements.birth.value = '19860219';
    form.elements.time.value = '1430';
    form.requestSubmit();
    document.documentElement.style.scrollBehavior = 'auto';
  });
  const fixedIntersections = [];
  for (const selector of ['#academyManseResult', '#academyLuckFlow']) {
    await page.$eval(
      selector,
      node => node.scrollIntoView({ behavior: 'auto', block: 'start' })
    );
    fixedIntersections.push(...await page.$eval(selector, node => {
      const fixedOrSticky = [...document.querySelectorAll('*')].filter(candidate => {
        const computed = getComputedStyle(candidate);
        const box = candidate.getBoundingClientRect();
        return ['fixed', 'sticky'].includes(computed.position)
          && computed.display !== 'none'
          && computed.visibility !== 'hidden'
          && box.width > 0
          && box.height > 0;
      });
      const box = node.getBoundingClientRect();
      return fixedOrSticky.map(fixedNode => {
        const fixedBox = fixedNode.getBoundingClientRect();
        const width = Math.max(0, Math.min(box.right, fixedBox.right) - Math.max(box.left, fixedBox.left));
        const height = Math.max(0, Math.min(box.bottom, fixedBox.bottom) - Math.max(box.top, fixedBox.top));
        return {
          target: node.id || node.className,
          overlay: fixedNode.id || fixedNode.className || fixedNode.tagName,
          area: width * height
        };
      }).filter(result => result.area > 0);
    }));
  }

  return {
    compactColumns,
    journey,
    dialogs,
    fixedIntersections
  };
}

async function inspectAcademyManse(page) {
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(page.testUrl, { waitUntil: 'networkidle0' });
  await page.type('#academyBirth', '19860219');
  await page.type('#academyTime', '1430');
  await page.click('#academyCalculate');
  await page.waitForSelector('#academyPillars:not([hidden])');

  const basic = await page.evaluate(() => ({
    pillars: [...document.querySelectorAll('[data-pillar-value]')].map(node => node.textContent),
    luck: [...document.querySelectorAll('#academyLuckFlow > div')].map(node => ({
      age: node.querySelector('span').textContent,
      ganji: node.querySelector('strong').textContent
    })),
    academyApi: typeof window.AcademyManse?.calculateFromForm,
    adapterApi: typeof window.ManseryeokAdapter?.calculate,
    adapterAlias: window.ManseryeokAdapter === window.LegendGanji
  }));

  const solarLunarControl = await page.evaluate(() => ({
    hidden: document.querySelector('#academyLeapField').hidden,
    disabled: document.querySelector('#academyLeap').disabled
  }));
  await page.select('#academyCalendar', 'lunar');
  const lunarControl = await page.evaluate(() => ({
    hidden: document.querySelector('#academyLeapField').hidden,
    disabled: document.querySelector('#academyLeap').disabled
  }));
  await page.select('#academyLeap', 'leap');
  await page.evaluate(() => {
    const verifiedAdapter = window.LegendGanji;
    window.__academyOriginalAdapter = window.ManseryeokAdapter;
    window.__academyLeapSolar = null;
    window.ManseryeokAdapter = Object.freeze({
      ...verifiedAdapter,
      calculate(input) {
        const result = verifiedAdapter.calculate(input);
        window.__academyLeapSolar = result.solar;
        return result;
      }
    });
    const form = document.querySelector('#academyManseForm');
    form.elements.birth.value = '20200401';
    form.elements.time.value = '0530';
  });
  await page.click('#academyCalculate');
  const validLeap = await page.evaluate(() => ({
    resultHidden: document.querySelector('#academyManseResult').hidden,
    errorHidden: document.querySelector('#academyManseError').hidden,
    summary: document.querySelector('#academyManseSummary').textContent,
    solar: window.__academyLeapSolar
      ? [window.__academyLeapSolar.y, window.__academyLeapSolar.m, window.__academyLeapSolar.d]
      : null
  }));
  await page.evaluate(() => {
    document.querySelector('#academyBirth').value = '20210401';
  });
  await page.click('#academyCalculate');
  const impossibleLeap = await page.evaluate(() => ({
    resultHidden: document.querySelector('#academyManseResult').hidden,
    errorHidden: document.querySelector('#academyManseError').hidden,
    error: document.querySelector('#academyManseError').textContent
  }));
  await page.evaluate(() => {
    if (window.__academyOriginalAdapter === undefined) {
      delete window.ManseryeokAdapter;
    } else {
      window.ManseryeokAdapter = window.__academyOriginalAdapter;
    }
    delete window.__academyOriginalAdapter;
    delete window.__academyLeapSolar;
  });

  const routing = await page.evaluate(() => {
    const originalAdapter = window.ManseryeokAdapter;
    const originalLegend = window.LegendGanji;
    const originalEngine = window.Manseryeok;
    let adapterCalls = 0;
    let legendGlobalReads = 0;
    let rawEngineCalls = 0;
    const compatibilitySpy = Object.freeze({
      ...originalAdapter,
      calculate(input) {
        adapterCalls += 1;
        return originalAdapter.calculate(input);
      }
    });
    window.ManseryeokAdapter = compatibilitySpy;
    window.LegendGanji = new Proxy(originalLegend, {
      get(target, property, receiver) {
        legendGlobalReads += 1;
        return Reflect.get(target, property, receiver);
      }
    });
    window.Manseryeok = new Proxy(originalEngine, {
      get(target, property, receiver) {
        rawEngineCalls += 1;
        return Reflect.get(target, property, receiver);
      }
    });
    try {
      const form = document.querySelector('#academyManseForm');
      form.elements.calendar.value = 'solar';
      form.elements.calendar.dispatchEvent(new Event('change', { bubbles: true }));
      form.elements.birth.value = '19860219';
      form.elements.time.value = '1430';
      window.AcademyManse.calculateFromForm();
      return { adapterCalls, legendGlobalReads, rawEngineCalls };
    } finally {
      window.ManseryeokAdapter = originalAdapter;
      window.LegendGanji = originalLegend;
      window.Manseryeok = originalEngine;
    }
  });

  const invalidIndex = await page.evaluate(() => {
    const originalAdapter = window.ManseryeokAdapter;
    window.ManseryeokAdapter = Object.freeze({
      ...originalAdapter,
      calculate(input) {
        return { ...originalAdapter.calculate(input), yStem: 10 };
      }
    });
    try {
      window.AcademyManse.calculateFromForm();
      return {
        resultHidden: document.querySelector('#academyManseResult').hidden,
        errorHidden: document.querySelector('#academyManseError').hidden,
        error: document.querySelector('#academyManseError').textContent,
        pillars: [...document.querySelectorAll('[data-pillar-value]')].map(node => node.textContent)
      };
    } finally {
      window.ManseryeokAdapter = originalAdapter;
    }
  });

  const calendarCases = await page.evaluate(() => {
    const form = document.querySelector('#academyManseForm');
    function submit({ birth, time, calendar = 'solar', leap = 'normal', unknown = false }) {
      form.elements.calendar.value = calendar;
      form.elements.calendar.dispatchEvent(new Event('change', { bubbles: true }));
      form.elements.leap.value = leap;
      form.elements.birth.value = birth;
      form.elements.time.value = time;
      form.elements.unknown.checked = unknown;
      form.elements.unknown.dispatchEvent(new Event('change', { bubbles: true }));
      window.AcademyManse.calculateFromForm();
      return {
        resultHidden: document.querySelector('#academyManseResult').hidden,
        errorHidden: document.querySelector('#academyManseError').hidden,
        error: document.querySelector('#academyManseError').textContent,
        summary: document.querySelector('#academyManseSummary').textContent
      };
    }

    const invalidDate = submit({ birth: '20240230', time: '1430' });
    const invalidTime = submit({ birth: '20240220', time: '2460' });
    const normalLunar = submit({
      birth: '20200401',
      time: '1200',
      calendar: 'lunar',
      leap: 'normal'
    });
    const unknownAmbiguity = submit({
      birth: '20240204',
      time: '',
      unknown: true
    });

    return {
      invalidDate,
      invalidTime,
      normalLunar,
      unknownAmbiguity
    };
  });

  const unknown = await page.evaluate(() => {
    const form = document.querySelector('#academyManseForm');
    form.elements.calendar.value = 'solar';
    form.elements.calendar.dispatchEvent(new Event('change', { bubbles: true }));
    form.elements.birth.value = '19860219';
    form.elements.unknown.checked = true;
    form.elements.unknown.dispatchEvent(new Event('change', { bubbles: true }));
    form.requestSubmit();
    return {
      timeDisabled: form.elements.time.disabled,
      hour: document.querySelector('[data-pillar="hour"] [data-pillar-value]').textContent,
      summary: document.querySelector('#academyManseSummary').textContent,
      errorHidden: document.querySelector('#academyManseError').hidden
    };
  });

  const safeText = await page.evaluate(() => {
    const form = document.querySelector('#academyManseForm');
    form.elements.name.value = '<img src=x onerror="window.__academyXss=true">';
    form.requestSubmit();
    return {
      summary: document.querySelector('#academyManseSummary').textContent,
      imageCount: document.querySelectorAll('#academyManseSummary img').length,
      executed: window.__academyXss === true
    };
  });

  const validation = await page.evaluate(() => {
    const form = document.querySelector('#academyManseForm');
    form.elements.unknown.checked = false;
    form.elements.unknown.dispatchEvent(new Event('change', { bubbles: true }));
    form.elements.birth.value = '198602';
    form.elements.time.value = '1430';
    window.AcademyManse.calculateFromForm();
    return {
      resultHidden: document.querySelector('#academyManseResult').hidden,
      errorHidden: document.querySelector('#academyManseError').hidden,
      error: document.querySelector('#academyManseError').textContent
    };
  });

  const desktop = await page.evaluate(() => ({
    formTitleHeight: document.querySelector('.academy-manse-form-heading h3')
      .getBoundingClientRect()
      .height
  }));

  await page.setViewport({ width: 360, height: 800 });
  await page.reload({ waitUntil: 'networkidle0' });
  const mobile = await page.evaluate(() => {
    const form = document.querySelector('#academyManseForm');
    form.elements.birth.value = '19860219';
    form.elements.time.value = '1430';
    form.requestSubmit();
    document.documentElement.style.scrollBehavior = 'auto';
    document.querySelector('#academyManse').scrollIntoView({ behavior: 'auto' });
    const masthead = document.querySelector('.academy-masthead').getBoundingClientRect();
    const title = document.querySelector('#academyManseTitle').getBoundingClientRect();
    const flow = document.querySelector('#academyLuckFlow');
    const scrollable = flow.scrollWidth > flow.clientWidth + 1;
    flow.scrollLeft = flow.scrollWidth;
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pillarColumns: getComputedStyle(document.querySelector('#academyPillars')).gridTemplateColumns
        .split(' ')
        .filter(Boolean)
        .length,
      resultVisible: !document.querySelector('#academyManseResult').hidden,
      titleClearance: title.top - masthead.bottom,
      luckScrollable: scrollable,
      luckScrollLeft: flow.scrollLeft
    };
  });

  const notes = await page.$$eval('.academy-learning-notes details', nodes => nodes.map(node => ({
    label: node.querySelector('summary').textContent,
    text: node.querySelector('p').textContent
  })));

  return {
    basic,
    solarLunarControl,
    lunarControl,
    validLeap,
    impossibleLeap,
    routing,
    invalidIndex,
    calendarCases,
    unknown,
    safeText,
    validation,
    desktop,
    mobile,
    notes
  };
}

async function main() {
  assert.ok(fs.existsSync(path.join(academyRoot, 'index.html')));
  const server = await startServer();
  const browser = await puppeteer.launch({
    executablePath: chromeExecutable(),
    headless: true,
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  page.testUrl = `${origin}/palpum-manse/academy/`;
  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));

  try {
    for (const missingPath of ['/palpum-manse/academy/assets/not-created.webp']) {
      const response = await fetch(`${origin}${missingPath}`);
      assert.equal(response.status, 404, `${missingPath}: missing assets must return 404`);
    }
    const mockups = await fetch(`${origin}/palpum-manse/academy/scripts/academy-mockups.js`);
    assert.equal(mockups.status, 200, 'academy mockup controller must load');
    const manse = await fetch(`${origin}/palpum-manse/academy/scripts/academy-manse.js`);
    assert.equal(manse.status, 200, 'academy Manseryeok controller must load');

    if (process.env.TEST_GROUP === 'academy-manse') {
      const result = await inspectAcademyManse(page);
      assert.deepEqual(result.basic.pillars, ['병인', '경인', '갑오', '신미']);
      assert.deepEqual(result.basic.luck, [
        { age: '태어난 때', ganji: '경인' },
        { age: '5세', ganji: '신묘' },
        { age: '15세', ganji: '임진' },
        { age: '25세', ganji: '계사' },
        { age: '35세', ganji: '갑오' },
        { age: '45세', ganji: '을미' },
        { age: '55세', ganji: '병신' },
        { age: '65세', ganji: '정유' },
        { age: '75세', ganji: '무술' },
        { age: '85세', ganji: '기해' },
        { age: '95세', ganji: '경자' }
      ]);
      assert.equal(result.basic.academyApi, 'function');
      assert.equal(result.basic.adapterApi, 'function');
      assert.equal(result.basic.adapterAlias, true);
      assert.deepEqual(result.solarLunarControl, {
        hidden: true,
        disabled: true
      });
      assert.deepEqual(result.lunarControl, {
        hidden: false,
        disabled: false
      });
      assert.deepEqual(result.validLeap, {
        resultHidden: false,
        errorHidden: true,
        summary: '음력 윤달 · 시간 입력',
        solar: [2020, 5, 23]
      });
      assert.equal(result.impossibleLeap.resultHidden, true);
      assert.equal(result.impossibleLeap.errorHidden, false);
      assert.match(result.impossibleLeap.error, /윤4월이 존재하지 않습니다/);
      assert.deepEqual(result.routing, {
        adapterCalls: 1,
        legendGlobalReads: 0,
        rawEngineCalls: 0
      });
      assert.equal(result.invalidIndex.resultHidden, true);
      assert.equal(result.invalidIndex.errorHidden, false);
      assert.match(result.invalidIndex.error, /간지 인덱스/);
      assert.ok(result.invalidIndex.pillars.every(value => !value.includes('undefined')));
      assert.equal(result.calendarCases.invalidDate.resultHidden, true);
      assert.match(result.calendarCases.invalidDate.error, /유효하지 않은 양력 날짜/);
      assert.equal(result.calendarCases.invalidTime.resultHidden, true);
      assert.match(result.calendarCases.invalidTime.error, /시\(hour\).*0~23/);
      assert.equal(result.calendarCases.normalLunar.resultHidden, false);
      assert.equal(result.calendarCases.normalLunar.errorHidden, true);
      assert.equal(result.calendarCases.normalLunar.summary, '음력 평달 · 시간 입력');
      assert.equal(result.calendarCases.unknownAmbiguity.resultHidden, true);
      assert.match(result.calendarCases.unknownAmbiguity.error, /태어난 시간을 알아야/);
      assert.deepEqual(result.unknown, {
        timeDisabled: true,
        hour: '시간 미상',
        summary: '양력 · 시간 미상',
        errorHidden: true
      });
      assert.equal(result.safeText.imageCount, 0);
      assert.equal(result.safeText.executed, false);
      assert.match(result.safeText.summary, /<img src=x/);
      assert.equal(result.validation.resultHidden, true);
      assert.equal(result.validation.errorHidden, false);
      assert.match(result.validation.error, /생년월일 8자리/);
      assert.ok(result.desktop.formTitleHeight < 80, 'desktop form title must not wrap to three lines');
      assert.equal(result.mobile.overflow, 0);
      assert.equal(result.mobile.pillarColumns, 2);
      assert.equal(result.mobile.resultVisible, true);
      assert.ok(result.mobile.titleClearance >= -1, 'mobile Manseryeok title clears fixed masthead');
      assert.equal(result.mobile.luckScrollable, true);
      assert.ok(result.mobile.luckScrollLeft > 0, 'mobile luck row can scroll horizontally');
      assert.equal(result.notes.length, 4);
      assert.deepEqual(result.notes.map(note => note.label), [
        '천간은 무엇인가요?',
        '지지는 무엇인가요?',
        '오행은 어떻게 보나요?',
        '십성은 무엇인가요?'
      ]);
      assert.ok(result.notes.every(note => !/반드시|확정된 미래|운명이다/.test(note.text)));
      assert.deepEqual(errors, [], `browser console errors:\n${errors.join('\n')}`);
      console.log('Academy Manseryeok passed');
      return;
    }

    if (process.env.TEST_GROUP === 'academy-dialogs') {
      const dialogs = await inspectMockupDialogs(page);
      for (const [name, result] of Object.entries({ course: dialogs.course, board: dialogs.board, payment: dialogs.payment })) {
        assert.equal(result.opened.open, true, `${name}: dialog opens`);
        assert.equal(result.opened.focused, true, `${name}: close button receives focus`);
        assert.equal(result.restored, true, `${name}: trigger focus restores after close`);
      }
      assert.match(dialogs.boardNotice, /저장되지 않/);
      assert.match(dialogs.paymentNotice, /실제 결제가 발생하지 않/);
      assert.deepEqual(errors, [], `browser console errors:\n${errors.join('\n')}`);
      console.log('Academy mockup dialogs passed');
      return;
    }

    for (const viewport of viewports) {
      const result = await inspectLayout(page, viewport);
      assert.equal(result.mastheadPosition, 'fixed', `${viewport.name}: masthead must stay fixed`);
      assert.equal(result.orbitNodes, 9, `${viewport.name}: nine orbit nodes`);
      assert.equal(result.parallaxLayers, 3, `${viewport.name}: three mountain layers`);
      assert.equal(result.mistBands, 2, `${viewport.name}: two mist bands`);
      assert.equal(result.titleText, '취명선 명리학당', `${viewport.name}: readable Korean title`);
      assert.ok(result.hero.top >= result.masthead.bottom - 1, `${viewport.name}: hero below masthead`);
      assert.ok(result.title.top >= result.masthead.bottom - 1, `${viewport.name}: title below masthead`);
      assert.equal(result.ctaRects.length, 2, `${viewport.name}: renders both hero CTAs`);
      assert.ok(
        result.ctaRects.every(cta => (
          cta.rect.width > 0
          && cta.rect.height > 0
          && cta.contained
        )),
        `${viewport.name}: each hero CTA has size and full viewport containment:\n${JSON.stringify(result.ctaRects, null, 2)}`
      );
      assert.ok(result.facts.top >= result.masthead.bottom - 1, `${viewport.name}: facts below masthead`);
      assert.ok(result.facts.bottom <= viewport.height + 1, `${viewport.name}: facts visible`);
      assert.equal(result.fixedOverlap, 0, `${viewport.name}: fixed masthead covers no hero content`);
      assert.equal(result.navViewport.contained, true, `${viewport.name}: navigation viewport is contained`);
      if (viewport.width < 768) {
        assert.equal(
          result.navViewport.horizontallyScrollable,
          true,
          `${viewport.name}: compact navigation preserves intentional internal scrolling`
        );
      }
      assert.deepEqual(
        result.touchTargetFailures,
        [],
        `${viewport.name}: interactive targets must be at least 44px`
      );
      assert.deepEqual(
        result.navLabelOverflow,
        [],
        `${viewport.name}: navigation labels must not overlap their touch targets`
      );
      assert.deepEqual(
        result.horizontalContainmentFailures,
        [],
        `${viewport.name}: visible non-decorative elements stay within the viewport:\n${JSON.stringify(result.horizontalContainmentFailures, null, 2)}`
      );
      if (viewport.width >= 768) {
        assert.ok(result.orbit.top >= result.masthead.bottom - 1, `${viewport.name}: orbit below masthead`);
        assert.ok(result.orbit.right <= viewport.width + 1, `${viewport.name}: orbit right edge visible`);
        assert.ok(result.orbit.bottom <= viewport.height + 1, `${viewport.name}: orbit bottom visible`);
        assert.ok(result.orbit.left >= -1, `${viewport.name}: orbit left edge visible`);
      }
      assert.equal(result.horizontalOverflow, 0, `${viewport.name}: no horizontal overflow`);

      await page.screenshot({
        path: path.join(os.tmpdir(), `academy-task2-${viewport.name}.png`),
        fullPage: false
      });
    }

    const accessibility = await inspectAccessibility(page);
    assert.deepEqual(
      accessibility.compactColumns,
      { courses: 1, cases: 1, plans: 1, fields: 1 },
      '767px layout uses one-column cards and Manseryeok fields'
    );
    const journeyStops = [
      accessibility.journey.skip,
      accessibility.journey.masthead,
      accessibility.journey.heroCta,
      accessibility.journey.courseButton,
      ...accessibility.journey.form,
      accessibility.journey.boardTrigger,
      accessibility.journey.paymentTrigger
    ];
    assert.equal(accessibility.journey.courseTitle, '명리의 기초');
    assert.ok(
      journeyStops.every(stop => (
        stop.matches
        && !stop.body
        && stop.focusVisible
        && stop.outlineStyle !== 'none'
        && stop.outlineWidth === 3
        && stop.targetRect.width >= 44
        && stop.targetRect.height >= 44
      )),
      `keyboard journey requires exact targets, 3px focus, and 44px hit areas:\n${JSON.stringify(journeyStops, null, 2)}`
    );
    const expectedDialogOrders = {
      course: {
        forward: ['close', 'close'],
        reverse: ['close', 'close']
      },
      board: {
        forward: ['close', 'input:title', 'textarea:content', 'submit', 'close'],
        reverse: ['submit', 'textarea:content', 'input:title', 'close', 'submit']
      },
      payment: {
        forward: ['close', 'input:name', 'input:email', 'submit', 'close'],
        reverse: ['submit', 'input:email', 'input:name', 'close', 'submit']
      }
    };
    for (const [name, dialog] of Object.entries(accessibility.dialogs)) {
      assert.deepEqual(
        dialog.forwardOrder,
        expectedDialogOrders[name].forward,
        `${name}: forward Tab visits every control once, then wraps to first`
      );
      assert.deepEqual(
        dialog.reverseOrder,
        expectedDialogOrders[name].reverse,
        `${name}: reverse Tab visits every control once, then wraps to last`
      );
      assert.equal(dialog.initial.matches, true, `${name}: close button receives initial focus`);
      assert.equal(dialog.initial.body, false, `${name}: initial focus is never body`);
      assert.equal(dialog.initial.focusVisible, true, `${name}: initial focus is visible`);
      assert.equal(dialog.initial.outlineWidth, 3, `${name}: initial focus uses 3px outline`);
      assert.ok(
        dialog.controls.every(control => control.width >= 44 && control.height >= 44),
        `${name}: every visible dialog control is at least 44px:\n${JSON.stringify(dialog.controls, null, 2)}`
      );
      assert.deepEqual(
        dialog.backwardBoundary,
        {
          identity: expectedDialogOrders[name].reverse[0],
          body: false,
          inside: true,
          focusVisible: true,
          outlineWidth: 3
        },
        `${name}: reverse Tab stays visibly inside`
      );
      assert.ok(
        dialog.forwardCycle.every(stop => (
          !stop.body
          && stop.inside
          && stop.focusVisible
          && stop.outlineWidth === 3
        )),
        `${name}: forward Tab never leaves dialog:\n${JSON.stringify(dialog.forwardCycle, null, 2)}`
      );
      assert.ok(
        dialog.reverseCycle.every(stop => (
          !stop.body
          && stop.inside
          && stop.focusVisible
          && stop.outlineWidth === 3
        )),
        `${name}: reverse Tab never leaves dialog:\n${JSON.stringify(dialog.reverseCycle, null, 2)}`
      );
      assert.equal(dialog.restored.matches, true, `${name}: exact trigger focus restores`);
      assert.equal(dialog.restored.body, false, `${name}: restored focus is never body`);
      assert.equal(dialog.restored.outlineWidth, 3, `${name}: restored focus uses 3px outline`);
    }
    assert.deepEqual(
      accessibility.fixedIntersections,
      [],
      `fixed or sticky UI must not intersect Manseryeok result or luck content:\n${JSON.stringify(accessibility.fixedIntersections, null, 2)}`
    );

    const lifecycle = await inspectMotionLifecycle(page);
    assert.deepEqual(lifecycle.active.listeners, { pointermove: 1, scroll: 1 });
    assert.deepEqual(lifecycle.background.listeners, { pointermove: 0, scroll: 0 });
    assert.equal(lifecycle.background.paused, true);
    assert.deepEqual(lifecycle.restored.listeners, { pointermove: 1, scroll: 1 });
    assert.equal(lifecycle.restored.paused, false);

    const reduced = await inspectReducedMotion(page);
    for (const key of ['mist', 'orbit', 'parallax', 'ink', 'reveal']) {
      assert.equal(reduced[key].animationName, 'none', `${key}: animation disabled`);
      assert.equal(reduced[key].transform, 'none', `${key}: transform disabled`);
    }
    assert.equal(reduced.reveal.transitionDuration, '0s', 'reveal transition disabled');
    assert.equal(reduced.count, '180', 'count-up resolves immediately');
    assert.equal(reduced.countComplete, 'true', 'count-up is marked complete');
    assert.equal(reduced.pointerX, '0');
    assert.equal(reduced.pointerY, '0');
    assert.equal(reduced.scrollDepth, '0');

    const release = await inspectOfflineRelease(page);
    assert.match(release.online.scope, /\/palpum-manse\/academy\/$/, 'academy worker scope stays under academy');
    assert.match(release.online.controller, /\/palpum-manse\/academy\/sw\.js$/, 'academy page is controlled by its own worker');
    assert.deepEqual(release.online.manifest, {
      id: '/palpum-manse/academy/',
      startUrl: '/palpum-manse/academy/',
      scope: '/palpum-manse/academy/'
    }, 'academy manifest resolves inside the deployed Palpum prefix');
    assert.ok(
      release.online.cacheNames.every(name => !name.startsWith('palpum-manse-') && !name.startsWith('legend-manse-')),
      `academy release audit must not create sibling caches: ${JSON.stringify(release.online.cacheNames)}`
    );
    for (const asset of [
      '/palpum-manse/academy/',
      '/palpum-manse/academy/index.html',
      '/palpum-manse/academy/styles/academy.css',
      '/palpum-manse/academy/scripts/academy-nav.js',
      '/palpum-manse/academy/scripts/academy-motion.js',
      '/palpum-manse/academy/scripts/academy-mockups.js',
      '/palpum-manse/academy/scripts/academy-manse.js',
      '/palpum-manse/academy/manifest.webmanifest',
      '/palpum-manse/assets/legend-landscape.webp',
      '/palpum-manse/assets/legend-seal.webp',
      '/palpum-manse/scripts/vendor/manseryeok.browser.js',
      '/palpum-manse/scripts/manseryeok-adapter.js'
    ]) {
      assert.ok(
        release.online.cachedPaths.includes(asset),
        `academy offline cache must include ${asset}: ${JSON.stringify(release.online.cachedPaths)}`
      );
    }
    assert.equal(release.offlineTitle, '취명선 명리학당', 'academy home opens from cache while offline');
    assert.deepEqual(errors, [], `browser console errors:\n${errors.join('\n')}`);

    console.log(`Academy UI passed at ${viewports.map(item => `${item.width}x${item.height}`).join(', ')}`);
    console.log(`Visual captures: ${path.join(os.tmpdir(), 'academy-task2-{full-hd,desktop,laptop,hd,tablet,mobile}.png')}`);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
