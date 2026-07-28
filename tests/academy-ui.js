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
      'a[href], button, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea, summary, .academy-check-field, .academy-payment-methods label'
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
    const navLinks = [...navViewport.querySelectorAll('a')];
    const navLabelOverflow = [...navViewport.querySelectorAll('a')]
      .filter(node => node.scrollWidth > node.clientWidth)
      .map(node => node.textContent.trim());
    const titleUnderline = getComputedStyle(
      document.querySelector('.academy-title-ink'),
      '::after'
    );
    const masthead = rect('.academy-masthead');
    const seasonStage = document.querySelector('[data-season-slideshow]');
    const seasonScenes = [...document.querySelectorAll('.academy-season-scene')];
    const seasonControls = [...document.querySelectorAll('.academy-season-controls button')];
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
        horizontallyScrollable: navViewport.scrollWidth > navViewport.clientWidth,
        destinationCount: navLinks.length,
        visibleDestinations: navLinks.filter(node => isContained(node.getBoundingClientRect())).length,
        scrollSnapType: getComputedStyle(navViewport).scrollSnapType
      },
      scrollGuide: {
        rect: rect('.academy-scroll-guide'),
        visible: isRendered(document.querySelector('.academy-scroll-guide'))
      },
      titleUnderline: {
        content: titleUnderline.content,
        height: Number.parseFloat(titleUnderline.height) || 0
      },
      sealAnimation: {
        name: getComputedStyle(document.querySelector('.academy-hero-seal')).animationName,
        iterations: getComputedStyle(document.querySelector('.academy-hero-seal')).animationIterationCount
      },
      seasonalHero: {
        rect: toRect(seasonStage.getBoundingClientRect()),
        sceneCount: seasonScenes.length,
        activeScenes: seasonScenes.filter(node => node.classList.contains('is-active')).length,
        loaded: seasonScenes.every(node => {
          const image = node.querySelector('img');
          return image && image.complete && image.naturalWidth > 0;
        }),
        controls: seasonControls.map(node => ({
          rect: toRect(node.getBoundingClientRect()),
          label: node.getAttribute('aria-label')
        })),
        statusRole: document.querySelector('#academySeasonStatus').getAttribute('role'),
        statusLive: document.querySelector('#academySeasonStatus').getAttribute('aria-live'),
        announcementRole: document.querySelector('#academySeasonAnnouncement').getAttribute('role'),
        announcementLive: document.querySelector('#academySeasonAnnouncement').getAttribute('aria-live'),
        orbitCount: document.querySelectorAll(
          '.academy-orbit, .academy-orbit-node, .academy-orbit-core'
        ).length
      },
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
      season: computed('.academy-season-scene.is-active'),
      seasonImage: computed('.academy-season-scene.is-active img'),
      parallax: computed('[data-parallax-layer]'),
      ink: computed('.academy-title-ink'),
      seal: computed('.academy-hero-seal'),
      guide: computed('.academy-scroll-guide'),
      course: computed('.academy-course-card'),
      pillar: computed('.academy-pillar-card'),
      dialog: computed('.academy-dialog-paper'),
      reveal: computed('[data-reveal]'),
      count: document.querySelector('[data-count]').textContent,
      countComplete: document.querySelector('[data-count]').dataset.countComplete,
      pointerX: getComputedStyle(document.querySelector('#academyHome')).getPropertyValue('--pointer-x').trim(),
      pointerY: getComputedStyle(document.querySelector('#academyHome')).getPropertyValue('--pointer-y').trim(),
      scrollDepth: getComputedStyle(document.querySelector('#academyHome')).getPropertyValue('--scroll-depth').trim(),
      seasonIndex: document.querySelector('[data-season-slideshow]').dataset.seasonIndex,
      seasonState: document.querySelector('[data-season-slideshow]').dataset.state,
      seasonControlsDisabled: [...document.querySelectorAll('.academy-season-controls button')]
        .every(node => node.disabled)
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
  const states = await page.evaluate(async () => {
    let hidden = false;
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get() { return hidden; }
    });
    const stage = document.querySelector('[data-season-slideshow]');
    const snapshot = () => ({
      listeners: window.__academyMotionListeners(),
      paused: document.body.classList.contains('is-motion-paused'),
      slideshow: stage.dataset.state
    });
    const active = snapshot();
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    const background = snapshot();
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    const restored = snapshot();
    const engagement = () => ({
      engaged: document.body.classList.contains('is-manse-engaged'),
      mist: getComputedStyle(document.querySelector('.academy-mist')).animationPlayState,
      season: getComputedStyle(
        document.querySelector('.academy-season-scene.is-active img')
      ).animationPlayState,
      slideshow: stage.dataset.state
    });
    document.querySelector('#academyBirth').focus();
    const focused = engagement();
    document.querySelector('.academy-brand').focus();
    const unfocused = engagement();
    document.dispatchEvent(new CustomEvent('academy:manse-result', {
      detail: { open: true }
    }));
    const reading = engagement();
    document.dispatchEvent(new CustomEvent('academy:manse-result', {
      detail: { open: false }
    }));
    const settled = engagement();
    stage.dispatchEvent(new Event('mouseenter'));
    const hovered = engagement();
    stage.dispatchEvent(new Event('mouseleave'));
    const unhovered = engagement();
    document.querySelector('#academySeasonNext').focus();
    const slideshowFocused = engagement();
    const focusedToggleLabel = document.querySelector('#academySeasonToggle').getAttribute('aria-label');
    document.querySelector('.academy-brand').focus();
    const slideshowUnfocused = engagement();
    const initialIndex = stage.dataset.seasonIndex;
    document.querySelector('#academySeasonNext').click();
    await new Promise(window.requestAnimationFrame);
    const nextIndex = stage.dataset.seasonIndex;
    const nextStatus = document.querySelector('#academySeasonStatus').textContent.trim();
    const manualAnnouncement = document.querySelector('#academySeasonAnnouncement').textContent.trim();
    document.querySelector('#academySeasonToggle').click();
    await new Promise(window.requestAnimationFrame);
    const userPaused = engagement();
    const togglePressed = document.querySelector('#academySeasonToggle').getAttribute('aria-pressed');
    const pauseAnnouncement = document.querySelector('#academySeasonAnnouncement').textContent.trim();
    document.querySelector('#academySeasonToggle').click();
    const userResumed = engagement();
    return {
      active,
      background,
      restored,
      focused,
      unfocused,
      reading,
      settled,
      hovered,
      unhovered,
      slideshowFocused,
      slideshowUnfocused,
      focusedToggleLabel,
      initialIndex,
      nextIndex,
      nextStatus,
      manualAnnouncement,
      userPaused,
      togglePressed,
      pauseAnnouncement,
      userResumed
    };
  });

  return states;
}

async function inspectAutomaticSeasonCycle(page) {
  await page.setViewport({ width: 1280, height: 720 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  const seasonSpeedScript = await page.evaluateOnNewDocument(() => {
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = function (handler, delay, ...args) {
      return nativeSetTimeout(handler, delay === 8200 ? 80 : delay, ...args);
    };
    window.__academySeasonHistory = [];
    document.addEventListener('DOMContentLoaded', () => {
      const stage = document.querySelector('[data-season-slideshow]');
      if (!stage) return;
      window.__academySeasonHistory.push(stage.dataset.seasonIndex);
      new MutationObserver(() => {
        window.__academySeasonHistory.push(stage.dataset.seasonIndex);
      }).observe(stage, { attributes: true, attributeFilter: ['data-season-index'] });
    }, { once: true });
  });
  await page.goto(page.testUrl, { waitUntil: 'networkidle0' });
  await page.waitForFunction(
    () => window.__academySeasonHistory.join(',').includes('0,1,2,3,0'),
    { timeout: 3000 }
  );

  const result = await page.evaluate(() => ({
    history: window.__academySeasonHistory.slice(0, 5),
    state: document.querySelector('[data-season-slideshow]').dataset.state,
    activeScenes: document.querySelectorAll('.academy-season-scene.is-active').length,
    announcement: document.querySelector('#academySeasonAnnouncement').textContent.trim()
  }));
  await page.removeScriptToEvaluateOnNewDocument(seasonSpeedScript.identifier);
  return result;
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

  await page.click('[data-course-id="foundation"]');
  const courseDetail = await page.evaluate(() => ({
    curriculum: [...document.querySelectorAll('[data-course-curriculum] li')]
      .map(node => node.textContent.trim()),
    previewVisible: !document.querySelector('[data-course-preview]').hidden,
    enrollText: document.querySelector('[data-course-enroll]').textContent.trim(),
    paperAnimation: getComputedStyle(document.querySelector('#courseDialog .academy-dialog-paper'))
      .animationName
  }));
  await page.waitForFunction(() => (
    document.querySelector('#courseDialog .academy-dialog-paper')
      .getAnimations()
      .every(animation => animation.playState === 'finished')
  ));
  await page.click('[data-course-enroll]');
  const courseNotice = await page.$eval('#courseDialog .academy-dialog-note', node => node.textContent);
  await page.keyboard.press('Escape');

  const boardTools = await page.evaluate(() => ({
    categories: [...document.querySelectorAll('[data-board-categories] button')]
      .map(node => node.textContent.trim()),
    searchType: document.querySelector('#academyBoardSearch').type,
    listItems: [...document.querySelectorAll('.academy-board-item')].map(item => ({
      tag: item.tagName.toLowerCase(),
      role: item.getAttribute('role'),
      buttonTag: item.querySelector('.academy-board-row').tagName.toLowerCase(),
      buttonRole: item.querySelector('.academy-board-row').getAttribute('role')
    }))
  }));
  await page.click('[data-board-category="대운"]');
  await page.type('#academyBoardSearch', '교운기');
  const filteredBoard = await page.$$eval(
    '.academy-board-item:not([hidden]) .academy-board-title',
    nodes => nodes.map(node => node.textContent.trim())
  );
  await page.click('[data-board-category="전체"]');
  await page.$eval('#academyBoardSearch', input => {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('[data-board-action="read"]');
  const boardRead = await page.evaluate(() => ({
    title: document.querySelector('[data-board-read-title]').textContent.trim(),
    readVisible: !document.querySelector('[data-board-read-view]').hidden,
    writeHidden: document.querySelector('[data-board-write-view]').hidden,
    detail: document.querySelector('[data-board-read-content]').textContent.trim()
  }));
  await page.keyboard.press('Escape');

  await page.click('[data-board-action="write"]');
  const boardWrite = await page.evaluate(() => ({
    readHidden: document.querySelector('[data-board-read-view]').hidden,
    writeVisible: !document.querySelector('[data-board-write-view]').hidden
  }));
  await page.click('#boardDialog button[type="submit"]');
  const boardNotice = await page.$eval('#boardDialog .academy-dialog-note', node => node.textContent);
  await page.keyboard.press('Escape');

  await page.click('[data-plan-id="full"]');
  const paymentDetail = await page.evaluate(() => ({
    methods: [...document.querySelectorAll('#paymentDialog input[name="method"]')]
      .map(node => ({ value: node.value, type: node.type })),
    personalInputs: document.querySelectorAll(
      '#paymentDialog input[name="name"], #paymentDialog input[name="email"]'
    ).length,
    disclosure: document.querySelector('#paymentDialog [data-payment-disclosure]')
      .textContent.trim()
  }));
  await page.waitForFunction(() => (
    document.querySelector('#paymentDialog .academy-dialog-paper')
      .getAnimations()
      .every(animation => animation.playState === 'finished')
  ));
  await page.click('#paymentDialog button[type="submit"]');
  const paymentNotice = await page.$eval('#paymentDialog .academy-dialog-note', node => node.textContent);
  await page.keyboard.press('Escape');

  return {
    course,
    board,
    payment,
    courseDetail,
    courseNotice,
    boardTools,
    filteredBoard,
    boardRead,
    boardWrite,
    boardNotice,
    paymentDetail,
    paymentNotice
  };
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
      const target = node.matches('input[type="checkbox"], input[type="radio"]')
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
        .map(node => {
          const target = node.matches('input[type="radio"]') ? node.closest('label') : node;
          return {
          element: node.id || node.getAttribute('aria-label') || node.name || node.textContent.trim(),
          width: target.getBoundingClientRect().width,
          height: target.getBoundingClientRect().height,
          tabStop: !node.matches('input[type="radio"]') || node.checked
          };
        })
    );
    const tabStopCount = controls.filter(control => control.tabStop).length;

    async function activeDialogStep() {
      return page.evaluate(selector => {
        const active = document.activeElement;
        let identity = active.tagName.toLowerCase();
        if (active.hasAttribute('data-dialog-close')) {
          identity = 'close';
        } else if (active.matches('button[type="submit"]')) {
          identity = 'submit';
        } else if (active.dataset.dialogAction) {
          identity = active.dataset.dialogAction;
        } else if (active.matches('input[type="radio"]')) {
          identity = `input:${active.name}:${active.value}`;
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
    for (let count = 0; count < tabStopCount; count += 1) {
      await page.keyboard.press('Tab');
      forwardCycle.push(await activeDialogStep());
    }

    const reverseCycle = [];
    for (let count = 0; count < tabStopCount + 1; count += 1) {
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
  await page.evaluate(() => {
    const form = document.querySelector('#academyManseForm');
    form.elements.birth.value = '19860219';
    form.elements.time.value = '1430';
  });
  await page.keyboard.press('Enter');
  await page.waitForSelector('#academyPillars:not([hidden])');
  journey.pillarButton = await tabUntil('[data-pillar="year"]');
  dialogs.pillar = await dialogJourney('[data-pillar="year"]', '#pillarDialog');
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
  await page.waitForFunction(() => (
    typeof window.AcademyManse?.calculateFromForm === 'function'
    && typeof window.ManseryeokAdapter?.calculate === 'function'
  ));
  await page.evaluate(() => {
    const form = document.querySelector('#academyManseForm');
    form.elements.birth.value = '19860219';
    form.elements.time.value = '1430';
    const calculate = document.querySelector('#academyCalculate');
    calculate.focus();
    calculate.click();
  });
  await page.waitForFunction(() => (
    !document.querySelector('#academyPillars').hidden
    || !document.querySelector('#academyManseError').hidden
  ));
  const initialError = await page.$eval(
    '#academyManseError',
    node => ({ hidden: node.hidden, text: node.textContent.trim() })
  );
  assert.equal(initialError.hidden, true, `initial Manseryeok calculation failed: ${initialError.text}`);

  const basic = await page.evaluate(() => ({
    pillars: [...document.querySelectorAll('[data-pillar-value]')].map(node => node.textContent),
    luck: [...document.querySelectorAll('#academyLuckFlow > div')].map(node => ({
      age: node.querySelector('span').textContent,
      ganji: node.querySelector('strong').textContent
    })),
    academyApi: typeof window.AcademyManse?.calculateFromForm,
    adapterApi: typeof window.ManseryeokAdapter?.calculate,
    adapterAlias: window.ManseryeokAdapter === window.LegendGanji,
    status: {
      role: document.querySelector('#academyManseStatus').getAttribute('role'),
      live: document.querySelector('#academyManseStatus').getAttribute('aria-live'),
      atomic: document.querySelector('#academyManseStatus').getAttribute('aria-atomic'),
      text: document.querySelector('#academyManseStatus').textContent.trim(),
      focusedId: document.activeElement.id
    },
    provenance: Object.fromEntries(
      [...document.querySelectorAll('[data-provenance]')]
        .map(node => [node.dataset.provenance, node.textContent.trim()])
    ),
    historicalNoticeHidden: document.querySelector('#academyHistoricalNotice').hidden,
    engaged: document.body.classList.contains('is-manse-engaged'),
    pillarCards: [...document.querySelectorAll('.academy-pillar-card')].map(card => ({
      tag: card.tagName.toLowerCase(),
      element: card.dataset.element,
      animation: getComputedStyle(card).animationName
    }))
  }));

  await page.waitForFunction(() => (
    document.querySelector('[data-pillar="year"]')
      .getAnimations()
      .every(animation => animation.playState === 'finished')
  ));
  await page.$eval(
    '[data-pillar="year"]',
    node => node.scrollIntoView({ block: 'center', behavior: 'auto' })
  );
  await page.$eval('[data-pillar="year"]', node => node.click());
  const pillarLearning = await page.evaluate(() => ({
    open: document.querySelector('#pillarDialog').open,
    title: document.querySelector('#pillarDialogTitle').textContent.trim(),
    concepts: [...document.querySelectorAll('[data-pillar-concept]')]
      .map(node => node.dataset.pillarConcept),
    value: document.querySelector('[data-pillar-dialog-value]').textContent.trim()
  }));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (
    !document.querySelector('#pillarDialog').open
    && document.activeElement === document.querySelector('[data-pillar="year"]')
  ));
  const pillarFocusRestored = await page.$eval(
    '[data-pillar="year"]',
    node => document.activeElement === node
  );

  await page.evaluate(() => {
    const form = document.querySelector('#academyManseForm');
    form.elements.calendar.value = 'solar';
    form.elements.calendar.dispatchEvent(new Event('change', { bubbles: true }));
    form.elements.birth.value = '19000101';
    form.elements.time.value = '1200';
    form.elements.unknown.checked = false;
    form.elements.unknown.dispatchEvent(new Event('change', { bubbles: true }));
    window.AcademyManse.calculateFromForm();
  });
  const historicalProvenance = await page.evaluate(() => ({
    resultHidden: document.querySelector('#academyManseResult').hidden,
    fields: Object.fromEntries(
      [...document.querySelectorAll('[data-provenance]')]
        .map(node => [node.dataset.provenance, node.textContent.trim()])
    ),
    noticeHidden: document.querySelector('#academyHistoricalNotice').hidden,
    notice: document.querySelector('#academyHistoricalNotice').textContent.trim()
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
    pillarLearning,
    pillarFocusRestored,
    historicalProvenance,
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
      assert.deepEqual(result.basic.status, {
        role: 'status',
        live: 'polite',
        atomic: 'true',
        text: '계산이 완료되었습니다. 네 기둥 학습표가 열렸습니다.',
        focusedId: 'academyCalculate'
      });
      assert.deepEqual(result.basic.provenance, {
        mode: 'KASI 절기 기반 정밀 계산',
        'time-standard': '한국 표준시 변천 반영',
        'day-boundary': '자정(00:00) 기준',
        basis: '연·월: 당시 민간시 절기 · 일·시: 입력 시계 시각'
      });
      assert.equal(result.basic.historicalNoticeHidden, true);
      assert.equal(result.basic.engaged, true);
      assert.ok(result.basic.pillarCards.every(card => card.tag === 'button'));
      assert.ok(result.basic.pillarCards.every(card => card.element));
      assert.ok(result.basic.pillarCards.every(card => card.animation === 'academy-pillar-drop'));
      assert.deepEqual(result.pillarLearning, {
        open: true,
        title: '년주 병인 학습',
        concepts: ['천간', '지지', '오행', '십성'],
        value: '병인'
      });
      assert.equal(result.pillarFocusRestored, true);
      assert.deepEqual(result.historicalProvenance, {
        resultHidden: false,
        fields: {
          mode: 'KASI 절기 기반 근사 계산',
          'time-standard': 'UTC+9(KST) 고정 근사',
          'day-boundary': '자정(00:00) 기준',
          basis: '연·월: UTC+9 고정 절기 · 일·시: 입력 시계 시각'
        },
        noticeHidden: false,
        notice: '1908년 4월 1일 이전 기록은 당시 전국 표준시 자료가 없어 UTC+9(KST) 고정값으로 근사 계산합니다.'
      });
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
      assert.equal(dialogs.courseDetail.curriculum.length, 3);
      assert.equal(dialogs.courseDetail.previewVisible, true);
      assert.equal(dialogs.courseDetail.enrollText, '수강 흐름 체험하기');
      assert.equal(dialogs.courseDetail.paperAnimation, 'academy-dialog-open');
      assert.match(dialogs.courseNotice, /신청하거나 저장하지 않습니다/);
      assert.deepEqual(dialogs.boardTools.categories, ['전체', '원국', '대운', '오행', '9운', '학습']);
      assert.equal(dialogs.boardTools.searchType, 'search');
      assert.ok(dialogs.boardTools.listItems.every(item => (
        item.tag === 'li'
        && item.role === null
        && item.buttonTag === 'button'
        && item.buttonRole === null
      )));
      assert.deepEqual(dialogs.filteredBoard, ['교운기는 몇 년으로 보고 준비하면 좋을까요?']);
      assert.equal(dialogs.boardRead.readVisible, true);
      assert.equal(dialogs.boardRead.writeHidden, true);
      assert.match(dialogs.boardRead.title, /월지와 일간/);
      assert.match(dialogs.boardRead.detail, /월지의 계절/);
      assert.deepEqual(dialogs.boardWrite, { readHidden: true, writeVisible: true });
      assert.match(dialogs.boardNotice, /저장되지 않/);
      assert.equal(dialogs.paymentDetail.methods.length, 3);
      assert.ok(dialogs.paymentDetail.methods.every(method => method.type === 'radio'));
      assert.equal(dialogs.paymentDetail.personalInputs, 0);
      assert.equal(
        dialogs.paymentDetail.disclosure,
        '현재는 시연 화면이며 결제가 발생하지 않습니다'
      );
      assert.match(dialogs.paymentNotice, /실제 결제가 발생하지 않/);
      assert.deepEqual(errors, [], `browser console errors:\n${errors.join('\n')}`);
      console.log('Academy mockup dialogs passed');
      return;
    }

    for (const viewport of viewports) {
      const result = await inspectLayout(page, viewport);
      assert.equal(result.mastheadPosition, 'fixed', `${viewport.name}: masthead must stay fixed`);
      assert.equal(result.seasonalHero.sceneCount, 4, `${viewport.name}: four seasonal scenes`);
      assert.equal(result.seasonalHero.activeScenes, 1, `${viewport.name}: one seasonal scene`);
      assert.equal(result.seasonalHero.loaded, true, `${viewport.name}: seasonal images loaded`);
      assert.equal(result.seasonalHero.orbitCount, 0, `${viewport.name}: no nine-period orbit`);
      assert.equal(result.seasonalHero.statusRole, null, `${viewport.name}: automatic scene label is silent`);
      assert.equal(result.seasonalHero.statusLive, null, `${viewport.name}: automatic scene label has no live region`);
      assert.equal(result.seasonalHero.announcementRole, 'status', `${viewport.name}: manual control status role`);
      assert.equal(result.seasonalHero.announcementLive, 'polite', `${viewport.name}: manual control polite status`);
      assert.equal(result.seasonalHero.controls.length, 3, `${viewport.name}: restrained controls`);
      assert.ok(
        result.seasonalHero.controls.every(control => (
          control.rect.width >= 44
          && control.rect.height >= 44
          && control.label
        )),
        `${viewport.name}: slideshow controls are labelled 44px targets`
      );
      assert.equal(result.parallaxLayers, 4, `${viewport.name}: four seasonal drift layers`);
      assert.equal(result.mistBands, 2, `${viewport.name}: two mist bands`);
      assert.equal(result.titleText, '취명선 명리학당', `${viewport.name}: readable Korean title`);
      assert.ok(
        result.titleUnderline.content === 'none' || result.titleUnderline.content === 'normal',
        `${viewport.name}: Chwimyeongseon title has no decorative underline`
      );
      assert.equal(result.titleUnderline.height, 0, `${viewport.name}: title underline has no height`);
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
          `${viewport.name}: compact navigation scrolls in one restrained row`
        );
        assert.equal(result.navViewport.destinationCount, 6, `${viewport.name}: all destinations remain available`);
        assert.ok(result.navViewport.visibleDestinations >= 2, `${viewport.name}: navigation keeps nearby destinations visible`);
        assert.match(result.navViewport.scrollSnapType, /^x/, `${viewport.name}: navigation uses horizontal scroll snapping`);
      }
      assert.equal(result.scrollGuide.visible, true, `${viewport.name}: scroll guide remains visible`);
      assert.ok(result.scrollGuide.rect.width >= 44, `${viewport.name}: scroll guide has a 44px target`);
      assert.ok(result.scrollGuide.rect.height >= 44, `${viewport.name}: scroll guide has a 44px target`);
      assert.ok(
        result.scrollGuide.rect.bottom <= viewport.height,
        `${viewport.name}: scroll guide is fully visible in the first viewport`
      );
      const guideOverlapWidth = Math.max(
        0,
        Math.min(result.facts.right, result.scrollGuide.rect.right)
          - Math.max(result.facts.left, result.scrollGuide.rect.left)
      );
      const guideOverlapHeight = Math.max(
        0,
        Math.min(result.facts.bottom, result.scrollGuide.rect.bottom)
          - Math.max(result.facts.top, result.scrollGuide.rect.top)
      );
      assert.equal(
        guideOverlapWidth * guideOverlapHeight,
        0,
        `${viewport.name}: facts and scroll guide do not overlap`
      );
      if (viewport.width >= 768) {
        assert.equal(result.sealAnimation.name, 'academy-seal-stamp', `${viewport.name}: seal stamps once`);
        assert.equal(result.sealAnimation.iterations, '1', `${viewport.name}: seal entrance is one-shot`);
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
        assert.ok(
          result.seasonalHero.rect.top >= result.masthead.bottom - 1,
          `${viewport.name}: seasonal hero below masthead`
        );
        assert.ok(
          result.seasonalHero.rect.right <= viewport.width + 1,
          `${viewport.name}: seasonal hero right edge visible`
        );
        assert.ok(
          result.seasonalHero.rect.bottom <= viewport.height + 1,
          `${viewport.name}: seasonal hero bottom visible`
        );
        assert.ok(
          result.seasonalHero.rect.left >= -1,
          `${viewport.name}: seasonal hero left edge visible`
        );
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
      accessibility.journey.pillarButton,
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
        forward: ['close', 'course-enroll', 'close'],
        reverse: ['course-enroll', 'close', 'course-enroll']
      },
      pillar: {
        forward: ['close', 'close'],
        reverse: ['close', 'close']
      },
      board: {
        forward: ['close', 'input:title', 'textarea:content', 'submit', 'close'],
        reverse: ['submit', 'textarea:content', 'input:title', 'close', 'submit']
      },
      payment: {
        forward: [
          'close',
          'input:method:card',
          'submit',
          'close'
        ],
        reverse: [
          'submit',
          'input:method:card',
          'close',
          'submit'
        ]
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
    assert.deepEqual(lifecycle.focused, {
      engaged: true,
      mist: 'paused',
      season: 'paused',
      slideshow: 'paused'
    });
    assert.deepEqual(lifecycle.unfocused, {
      engaged: false,
      mist: 'running',
      season: 'running',
      slideshow: 'running'
    });
    assert.deepEqual(lifecycle.reading, {
      engaged: true,
      mist: 'paused',
      season: 'paused',
      slideshow: 'paused'
    });
    assert.deepEqual(lifecycle.settled, {
      engaged: false,
      mist: 'running',
      season: 'running',
      slideshow: 'running'
    });
    assert.equal(lifecycle.active.slideshow, 'running');
    assert.equal(lifecycle.background.slideshow, 'paused');
    assert.equal(lifecycle.restored.slideshow, 'running');
    assert.equal(lifecycle.hovered.slideshow, 'paused');
    assert.equal(lifecycle.unhovered.slideshow, 'running');
    assert.equal(lifecycle.slideshowFocused.slideshow, 'paused');
    assert.equal(lifecycle.slideshowUnfocused.slideshow, 'running');
    assert.equal(lifecycle.focusedToggleLabel, '계절 장면 재생');
    assert.equal(lifecycle.initialIndex, '0');
    assert.equal(lifecycle.nextIndex, '1');
    assert.match(lifecycle.nextStatus, /여름.*2\s*\/\s*4/);
    assert.match(lifecycle.manualAnnouncement, /여름.*2\s*\/\s*4/);
    assert.equal(lifecycle.userPaused.slideshow, 'paused');
    assert.equal(lifecycle.togglePressed, 'true');
    assert.equal(lifecycle.pauseAnnouncement, '계절 장면 자동 재생을 멈췄습니다.');
    assert.equal(lifecycle.userResumed.slideshow, 'running');

    const automaticSeason = await inspectAutomaticSeasonCycle(page);
    assert.deepEqual(automaticSeason, {
      history: ['0', '1', '2', '3', '0'],
      state: 'running',
      activeScenes: 1,
      announcement: ''
    });

    const reduced = await inspectReducedMotion(page);
    for (const key of [
      'mist',
      'season',
      'seasonImage',
      'parallax',
      'ink',
      'seal',
      'guide',
      'course',
      'pillar',
      'dialog',
      'reveal'
    ]) {
      assert.equal(reduced[key].animationName, 'none', `${key}: animation disabled`);
      assert.equal(reduced[key].transform, 'none', `${key}: transform disabled`);
    }
    assert.equal(reduced.reveal.transitionDuration, '0s', 'reveal transition disabled');
    assert.equal(reduced.count, '180', 'count-up resolves immediately');
    assert.equal(reduced.countComplete, 'true', 'count-up is marked complete');
    assert.equal(reduced.pointerX, '0');
    assert.equal(reduced.pointerY, '0');
    assert.equal(reduced.scrollDepth, '0');
    assert.equal(reduced.seasonIndex, '0', 'reduced motion keeps the first scene');
    assert.equal(reduced.seasonState, 'reduced', 'reduced motion exposes a static state');
    assert.equal(reduced.seasonControlsDisabled, true, 'reduced motion disables slideshow controls');

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
      '/palpum-manse/academy/assets/season-spring.jpg',
      '/palpum-manse/academy/assets/season-summer.jpg',
      '/palpum-manse/academy/assets/season-autumn.jpg',
      '/palpum-manse/academy/assets/season-winter.jpg',
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
