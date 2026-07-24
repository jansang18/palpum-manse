const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');
const puppeteer = require('puppeteer-core');

const inferredAppRoot = fs.existsSync(path.join(__dirname, 'www', 'index.html'))
  ? __dirname
  : path.resolve(__dirname, '..', '..');
const APP_ROOT = process.env.APP_ROOT
  ? path.resolve(process.cwd(), process.env.APP_ROOT)
  : inferredAppRoot;
const WEB_ROOT = process.env.WEB_ROOT
  ? path.resolve(APP_ROOT, process.env.WEB_ROOT)
  : path.join(APP_ROOT, 'web');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const UI_ROOT = process.env.UI_ROOT
  ? path.resolve(APP_ROOT, process.env.UI_ROOT)
  : path.join(APP_ROOT, 'www');
const URL = pathToFileURL(path.join(UI_ROOT, 'index.html')).href;
const TEST_GROUP = process.env.TEST_GROUP || '';
const widths = TEST_GROUP ? [390] : [360, 390, 412, 768];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const runsGroup = name => !TEST_GROUP || TEST_GROUP === name;

function parseCssColor(value) {
  const match = String(value).match(/rgba?\(([^)]+)\)/i);
  assert.ok(match, `unsupported computed color: ${value}`);
  const parts = match[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
  return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
}

function compositeColor(foreground, background) {
  const alpha = foreground.a + background.a * (1 - foreground.a);
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
    g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
    b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha,
    a: alpha
  };
}

function contrastRatio(foregroundValue, backgroundValue, canvasValue) {
  const canvas = parseCssColor(canvasValue);
  const background = compositeColor(parseCssColor(backgroundValue), canvas);
  const foreground = compositeColor(parseCssColor(foregroundValue), background);
  const luminance = color => {
    const channels = [color.r, color.g, color.b].map(channel => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function createServiceWorkerHarness(source, addAllFailure = null) {
  const handlers = new Map();
  const events = [];
  const deletedCaches = [];
  let openedCache = '';
  const caches = {
    open(name) {
      openedCache = name;
      return Promise.resolve({
        addAll(entries) {
          events.push({ type: 'addAll', entries: [...entries] });
          return addAllFailure ? Promise.reject(addAllFailure) : Promise.resolve();
        },
        put() { return Promise.resolve(); }
      });
    },
    keys() {
      return Promise.resolve(['sineum-manse-previous', openedCache].filter(Boolean));
    },
    delete(name) {
      deletedCaches.push(name);
      events.push({ type: 'delete', name });
      return Promise.resolve(true);
    },
    match() { return Promise.resolve(undefined); }
  };
  const self = {
    location: { origin: 'https://example.test' },
    clients: {
      claim() {
        events.push({ type: 'claim' });
        return Promise.resolve();
      }
    },
    addEventListener(type, handler) { handlers.set(type, handler); },
    skipWaiting() {
      events.push({ type: 'skipWaiting' });
      return Promise.resolve();
    }
  };
  vm.runInNewContext(source, {
    self,
    caches,
    URL,
    fetch: () => Promise.reject(new Error('fetch is outside this lifecycle test')),
    Promise
  }, { filename: 'sw.js' });
  return {
    events,
    deletedCaches,
    dispatch(type) {
      const handler = handlers.get(type);
      assert.equal(typeof handler, 'function', `service worker ${type} handler missing`);
      let lifetime = null;
      handler({
        waitUntil(promise) { lifetime = Promise.resolve(promise); },
        request: { method: 'GET' },
        respondWith() {}
      });
      assert.ok(lifetime, `${type} handler must call waitUntil`);
      return lifetime;
    }
  };
}

async function inspectServiceWorkerInstall(source) {
  const failure = new Error('precache failed');
  const failedInstall = createServiceWorkerHarness(source, failure);
  await assert.rejects(failedInstall.dispatch('install'), /precache failed/, 'failed core precache must reject service-worker installation');
  assert.deepEqual(
    failedInstall.events.map(event => event.type),
    ['addAll'],
    'failed core precache must not call skipWaiting or activate cache cleanup'
  );
  assert.deepEqual(failedInstall.deletedCaches, [], 'the previous cache must survive a failed install');

  const successfulInstall = createServiceWorkerHarness(source);
  await successfulInstall.dispatch('install');
  assert.deepEqual(
    successfulInstall.events.map(event => event.type),
    ['addAll', 'skipWaiting'],
    'skipWaiting must follow successful addAll'
  );
  await successfulInstall.dispatch('activate');
  assert.deepEqual(successfulInstall.deletedCaches, ['sineum-manse-previous']);
  assert.equal(successfulInstall.events.at(-1).type, 'claim');
}

function inspectAndroidBackupPolicy() {
  const manifestPath = path.join(APP_ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  const manifest = fs.readFileSync(manifestPath, 'utf8');
  assert.match(manifest, /android:allowBackup="false"/, 'saved chart data must be excluded from Android backup');
  assert.doesNotMatch(manifest, /android:allowBackup="true"/);
}

function inspectReleaseContract() {
  const versionedRunner = path.join(WEB_ROOT, 'tests', 'ui-regression.js');
  const externalRunner = path.join(APP_ROOT, 'ui-regression.js');
  const buildScript = path.join(WEB_ROOT, 'scripts', 'build-protected.ps1');
  assert.ok(fs.existsSync(versionedRunner), 'web/tests/ui-regression.js must be versioned in the web repository');
  assert.deepEqual(
    fs.readFileSync(versionedRunner),
    fs.readFileSync(externalRunner),
    'external and web-repo regression runners must be byte-identical'
  );
  assert.ok(fs.existsSync(buildScript), 'web/scripts/build-protected.ps1 must provide the single protected-release command');

  const script = fs.readFileSync(buildScript, 'utf8');
  const releaseFilesBlock = script.match(/\$ReleaseWebFiles\s*=\s*@\(([\s\S]*?)\)/);
  assert.ok(releaseFilesBlock, 'release source inventory must be declared');
  const releaseFiles = [...releaseFilesBlock[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.ok(releaseFiles.length > 0, 'release source inventory must not be empty');
  for (const relativePath of releaseFiles) {
    assert.ok(fs.existsSync(path.join(APP_ROOT, 'www', relativePath)), `release source inventory points outside app/www ownership: ${relativePath}`);
    assert.ok(fs.existsSync(path.join(WEB_ROOT, relativePath)), `release mirror is missing: ${relativePath}`);
  }
  const webOnlyFilesBlock = script.match(/\$WebOnlyFiles\s*=\s*@\(([\s\S]*?)\)/);
  assert.ok(webOnlyFilesBlock, 'web-only release inventory must be declared separately from Android-owned files');
  const webOnlyFiles = [...webOnlyFilesBlock[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.deepEqual(
    webOnlyFiles.sort(),
    ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest', 'sw.js'].sort(),
    'web-only PWA assets must be complete and explicit'
  );
  for (const relativePath of webOnlyFiles) {
    assert.ok(fs.existsSync(path.join(WEB_ROOT, relativePath)), `web-only release asset is missing: ${relativePath}`);
  }
  for (const [pattern, message] of [
    [/\$ErrorActionPreference\s*=\s*['"]Stop['"]/, 'PowerShell errors must fail the release'],
    [/Assert-SigningConfiguration/, 'signing configuration must be preflighted'],
    [/Assert-WebOnlyAssets/, 'web-only PWA assets must be preflighted'],
    [/const\\s\+PRECACHE\\s\*\=\\s\*\\\[\(\?<entries>/, 'service-worker validation must inspect the active PRECACHE array body'],
    [/Sync-CleanAssets/, 'clean Capacitor sync must be explicit'],
    [/obfuscate_assets\.js/, 'Android assets must be obfuscated'],
    [/tests[\\/]ui-regression\.js/, 'the versioned protected regression must run'],
    [/assembleRelease/, 'the release APK must be built'],
    [/bundleRelease/, 'the release AAB must be built'],
    [/apksigner/, 'APK signature verification must run'],
    [/jarsigner/, 'AAB signature verification must run'],
    [/Verified using v2 scheme/, 'APK v2 verification must be asserted'],
    [/da1950eab27b62b7c0ac92a21b34a2fab32ff582f0e68be0d6e72d56488508aa/i, 'the expected signing identity must be pinned'],
    [/apkanalyzer/, 'the delivered APK manifest must be inspected'],
    [/android:allowBackup="false"/, 'the delivered APK must disable backup'],
    [/Get-FileHash/, 'artifact SHA-256 hashes must be calculated'],
    [/finally\s*\{[\s\S]*Restore-CleanAssets/, 'clean Android assets must be restored even after failure']
  ]) assert.match(script, pattern, message);
  assert.doesNotMatch(script, /storePassword\s*=\s*['"][^'"]+['"]/, 'credentials must not be committed in release tooling');
  assert.doesNotMatch(script, /keyPassword\s*=\s*['"][^'"]+['"]/, 'credentials must not be committed in release tooling');

  const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'manse-release-contract-'));
  try {
    const missingProperties = path.join(tempRoot, 'missing-keystore.properties');
    const missingCredentials = childProcess.spawnSync(powershell, [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', buildScript,
      '-PreflightOnly', '-SigningPropertiesPath', missingProperties
    ], { cwd: WEB_ROOT, encoding: 'utf8', timeout: 30000 });
    assert.notEqual(missingCredentials.status, 0, 'release preflight must fail without signing configuration');
    assert.match(
      `${missingCredentials.stdout}\n${missingCredentials.stderr}`,
      /Signing properties file not found/,
      'missing signing configuration must produce a closed failure'
    );

    const unsignedApk = path.join(tempRoot, 'unsigned.apk');
    const unsignedAab = path.join(tempRoot, 'unsigned.aab');
    fs.writeFileSync(unsignedApk, 'not a signed APK');
    fs.writeFileSync(unsignedAab, 'not a signed AAB');
    const missingSignature = childProcess.spawnSync(powershell, [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', buildScript,
      '-VerifyOnly', '-ApkPath', unsignedApk, '-AabPath', unsignedAab
    ], { cwd: WEB_ROOT, encoding: 'utf8', timeout: 30000 });
    assert.notEqual(missingSignature.status, 0, 'artifact verification must fail for unsigned payloads');
    assert.match(
      `${missingSignature.stdout}\n${missingSignature.stderr}`,
      /APK signature verification failed/,
      'an unavailable APK signature must produce a closed failure'
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function fillAndCalculate(page) {
  await page.evaluate(() => {
    document.getElementById('inputName').value = '홍길동';
    document.querySelector('#segGender [data-val="M"]').click();
    document.querySelector('#segCal [data-val="solar"]').click();

    const birth = document.getElementById('inBirth');
    birth.value = '19890319';
    birth.dispatchEvent(new Event('input', { bubbles: true }));

    const time = document.getElementById('inTime');
    time.value = '1430';
    time.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('calcBtn').click();
  });
  await sleep(600);
}

async function inspectAppleDesign(page, width) {
  const expectedAccents = { light: '#007aff', dark: '#0a84ff' };
  const legacyGold = new Set(['rgb(216, 181, 106)', 'rgb(240, 214, 154)', 'rgb(169, 119, 50)']);

  for (const [theme, accent] of Object.entries(expectedAccents)) {
    const inspection = await page.evaluate(isDark => {
      document.body.classList.toggle('dark', isDark);
      const colorProperties = ['backgroundColor', 'borderTopColor', 'color', 'outlineColor'];
      const styles = selector => [...document.querySelectorAll(selector)]
        .filter(element => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0)
        .map(element => {
          const computed = getComputedStyle(element);
          return Object.fromEntries(colorProperties.map(property => [property, computed[property]]));
        });
      const geometry = selector => [...document.querySelectorAll(selector)]
        .filter(element => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0)
        .map(element => {
          const rect = element.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(element);
          const textRect = range.getBoundingClientRect();
          return {
            rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
            textRect: { left: textRect.left, top: textRect.top, right: textRect.right, bottom: textRect.bottom },
            textLines: range.getClientRects().length,
            center: {
              x: Math.abs((textRect.left + textRect.right) / 2 - (rect.left + rect.right) / 2),
              y: Math.abs((textRect.top + textRect.bottom) / 2 - (rect.top + rect.bottom) / 2)
            }
          };
        });
      return {
        accent: getComputedStyle(document.body).getPropertyValue('--apple-accent').trim(),
        styles: {
          topBar: styles('.top-bar'),
          activeTab: styles('.tab.active'),
          primaryButton: styles('.primary-btn'),
          formFields: styles('.input'),
          pillarBlocks: styles('.pillar-block'),
          luckBlocks: styles('.luck-block')
        },
        geometry: {
          pillarBlocks: geometry('.pillar-block'),
          luckBlocks: geometry('.luck-block'),
          segmentedButtons: geometry('.segmented button'),
          tabs: geometry('.tab'),
          primaryButtons: geometry('.primary-btn')
        }
      };
    }, theme === 'dark');

    assert.equal(inspection.accent, accent, `${width}px ${theme} --apple-accent`);
    for (const [surface, elements] of Object.entries(inspection.styles)) {
      assert.ok(elements.length > 0, `${width}px ${theme} ${surface} missing`);
      for (const colors of elements) {
        for (const [property, value] of Object.entries(colors)) {
          assert.ok(!legacyGold.has(value), `${width}px ${theme} ${surface} ${property} retains legacy gold: ${value}`);
        }
      }
    }

    for (const [group, blocks] of Object.entries({
      pillarBlocks: inspection.geometry.pillarBlocks,
      luckBlocks: inspection.geometry.luckBlocks
    })) {
      assert.ok(blocks.length > 0, `${width}px ${theme} ${group} missing`);
      for (const { rect } of blocks) {
        assert.ok(Math.abs(rect.width - rect.height) <= 1, `${width}px ${theme} ${group} not square: ${rect.width}x${rect.height}`);
      }
    }

    for (const [group, elements] of Object.entries(inspection.geometry)) {
      assert.ok(elements.length > 0, `${width}px ${theme} ${group} missing`);
      const rows = [];
      for (const element of elements) {
        const row = rows.find(candidate => Math.abs(candidate.top - element.rect.top) <= 1);
        (row || rows[rows.push({ top: element.rect.top, heights: [] }) - 1]).heights.push(element.rect.height);
        if (element.textLines === 1) {
          assert.ok(element.center.x <= 2 && element.center.y <= 2, `${width}px ${theme} ${group} label is off-center: ${element.center.x}x${element.center.y}`);
        }
      }
      for (const row of rows) {
        const [first, ...rest] = row.heights;
        for (const height of rest) {
          assert.ok(Math.abs(height - first) <= 1, `${width}px ${theme} ${group} same-row heights differ: ${first}px vs ${height}px`);
        }
      }
    }
  }
}

async function inspectWidth(browser, width) {
  console.log(`[ui] ${width}px: opening page`);
  const page = await browser.newPage();
  await page.setViewport({
    width,
    height: 900,
    deviceScaleFactor: 1,
    isMobile: width < 768,
    hasTouch: true
  });
  console.log(`[ui] ${width}px: navigating`);
  await page.goto(URL, { waitUntil: 'networkidle0' });
  console.log(`[ui] ${width}px: loaded`);
  await page.evaluate(() => document.body.classList.add('dark'));

  if (width === 390) {
    const modalContract = await page.evaluate(() => ({
      open: typeof window.openAppModal,
      close: typeof window.closeAppModal,
      closeTop: typeof window.closeTopAppModal
    }));
    assert.deepEqual(modalContract, {
      open: 'function',
      close: 'function',
      closeTop: 'function'
    });

    if (runsGroup('modal-continuity')) {
      const continuity = await page.evaluate(async () => {
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const modal = document.getElementById('aboutModal');
        const panel = modal.querySelector('.modal');
        const presentation = element => {
          const style = getComputedStyle(element);
          const matrix = style.transform === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(style.transform);
          return { opacity: Number(style.opacity), translateY: matrix.m42 };
        };

        window.openAppModal(modal);
        await wait(260);
        window.closeAppModal(modal);
        await wait(60);
        const beforeReopen = { backdrop: presentation(modal), panel: presentation(panel) };
        window.openAppModal(modal);
        const afterReopen = { backdrop: presentation(modal), panel: presentation(panel) };
        await wait(260);
        window.closeAppModal(modal);
        await wait(240);

        window.openAppModal(modal);
        const exactZeroBeforeClose = presentation(modal).opacity;
        window.closeAppModal(modal);
        const closeAnimation = modal.getAnimations().find(animation => animation.effect?.target === modal);
        const exactZeroCloseStart = Number(closeAnimation?.effect?.getKeyframes()?.[0]?.opacity);
        await wait(240);

        return {
          backdropOpacityJump: Math.abs(afterReopen.backdrop.opacity - beforeReopen.backdrop.opacity),
          panelOpacityJump: Math.abs(afterReopen.panel.opacity - beforeReopen.panel.opacity),
          panelTransformJump: Math.abs(afterReopen.panel.translateY - beforeReopen.panel.translateY),
          exactZeroBeforeClose,
          exactZeroCloseStart
        };
      });
      assert.ok(continuity.backdropOpacityJump <= 0.08, `modal backdrop opacity jumped by ${continuity.backdropOpacityJump}`);
      assert.ok(continuity.panelOpacityJump <= 0.08, `modal panel opacity jumped by ${continuity.panelOpacityJump}`);
      assert.ok(continuity.panelTransformJump <= 12, `modal panel transform jumped by ${continuity.panelTransformJump}px`);
      assert.ok(continuity.exactZeroBeforeClose <= 0.05, `immediate close did not start near zero: ${continuity.exactZeroBeforeClose}`);
      assert.ok(continuity.exactZeroCloseStart <= 0.05, `exact-zero opacity was rewritten to ${continuity.exactZeroCloseStart}`);
    }

    if (runsGroup('modal-ownership')) {
      const ownership = await page.evaluate(async () => {
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const modal = document.getElementById('aboutModal');
        const exercise = async close => {
          window.openAppModal(modal);
          await wait(260);
          close();
          await wait(40);
          close();
          await Promise.resolve();
          await Promise.resolve();
          const afterReplacement = {
            active: modal.classList.contains('active'),
            closing: modal.classList.contains('is-closing')
          };
          await wait(80);
          const midReplacement = modal.classList.contains('active');
          await wait(180);
          return {
            afterReplacement,
            midReplacement,
            finalActive: modal.classList.contains('active'),
            finalClosing: modal.classList.contains('is-closing')
          };
        };

        return {
          direct: await exercise(() => window.closeAppModal(modal)),
          backEquivalent: await exercise(() => window.closeTopAppModal())
        };
      });
      const expectedOwnership = {
        afterReplacement: { active: true, closing: true },
        midReplacement: true,
        finalActive: false,
        finalClosing: false
      };
      assert.deepEqual(ownership.direct, expectedOwnership, 'a stale direct-close completion must not own modal teardown');
      assert.deepEqual(ownership.backEquivalent, expectedOwnership, 'repeated back-equivalent closes must not allow stale teardown');
    }

    if (runsGroup('modal-a11y')) {
      const semantics = await page.evaluate(() => {
        const inspect = id => {
          const modal = document.getElementById(id);
          const dialog = modal.querySelector('[role="dialog"]');
          const labelId = dialog?.getAttribute('aria-labelledby');
          return {
            role: dialog?.getAttribute('role') || null,
            ariaModal: dialog?.getAttribute('aria-modal') || null,
            name: dialog?.getAttribute('aria-label') || (labelId ? document.getElementById(labelId)?.textContent.trim() : null)
          };
        };
        return { about: inspect('aboutModal'), save: inspect('saveModal') };
      });

      await page.click('#aboutBtn');
      await sleep(30);
      const aboutEntry = await page.evaluate(() => ({
        activeId: document.activeElement?.id || '',
        inside: document.getElementById('aboutModal').contains(document.activeElement),
        appInert: document.querySelector('.app').inert,
        bottomBarInert: document.getElementById('bottomBar').inert
      }));
      await page.keyboard.press('Tab');
      const aboutTrappedId = await page.evaluate(() => document.activeElement?.id || '');
      await page.keyboard.press('Escape');
      await sleep(260);
      const aboutExit = await page.evaluate(() => ({
        active: document.getElementById('aboutModal').classList.contains('active'),
        restoredId: document.activeElement?.id || '',
        appInert: document.querySelector('.app').inert
      }));
      if (aboutExit.active) {
        await page.evaluate(() => window.closeAppModal(document.getElementById('aboutModal')));
        await sleep(240);
      }

      await page.evaluate(() => {
        document.getElementById('aboutBtn').focus();
        window.openAppModal(document.getElementById('saveModal'));
      });
      await sleep(30);
      const saveEntryId = await page.evaluate(() => document.activeElement?.id || '');
      await page.evaluate(() => document.getElementById('saveConfirm').focus());
      await page.keyboard.press('Tab');
      const saveForwardTrapId = await page.evaluate(() => document.activeElement?.id || '');
      await page.evaluate(() => document.getElementById('saveName').focus());
      await page.keyboard.down('Shift');
      await page.keyboard.press('Tab');
      await page.keyboard.up('Shift');
      const saveBackwardTrapId = await page.evaluate(() => document.activeElement?.id || '');
      await page.keyboard.press('Escape');
      await sleep(260);
      const saveExit = await page.evaluate(() => ({
        active: document.getElementById('saveModal').classList.contains('active'),
        restoredId: document.activeElement?.id || '',
        appInert: document.querySelector('.app').inert
      }));
      if (saveExit.active) {
        await page.evaluate(() => window.closeAppModal(document.getElementById('saveModal')));
        await sleep(240);
      }

      assert.deepEqual({ semantics, aboutEntry, aboutTrappedId, aboutExit, saveEntryId, saveForwardTrapId, saveBackwardTrapId, saveExit }, {
        semantics: {
          about: { role: 'dialog', ariaModal: 'true', name: '신의 음성 만세력' },
          save: { role: 'dialog', ariaModal: 'true', name: '명반 저장' }
        },
        aboutEntry: { activeId: 'aboutClose', inside: true, appInert: true, bottomBarInert: true },
        aboutTrappedId: 'aboutClose',
        aboutExit: { active: false, restoredId: 'aboutBtn', appInert: false },
        saveEntryId: 'saveName',
        saveForwardTrapId: 'saveName',
        saveBackwardTrapId: 'saveConfirm',
        saveExit: { active: false, restoredId: 'aboutBtn', appInert: false }
      });
    }

    if (runsGroup('theme-contrast')) {
      const themeColors = await page.evaluate(async () => {
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const measure = () => {
          const label = document.querySelector('#view-input .field-label');
          const labelSurface = label.closest('.input-card');
          const day = document.querySelector('#calGrid .cal-day.clickable .d');
          const daySurface = day.closest('.cal-day');
          return {
            canvas: getComputedStyle(document.body).backgroundColor,
            label: {
              foreground: getComputedStyle(label).color,
              background: getComputedStyle(labelSurface).backgroundColor
            },
            day: {
              foreground: getComputedStyle(day).color,
              background: getComputedStyle(daySurface).backgroundColor
            }
          };
        };

        document.querySelector('.tab[data-tab="calendar"]').click();
        document.body.classList.remove('dark');
        await wait(350);
        const light = measure();
        document.body.classList.add('dark');
        await wait(350);
        const dark = measure();
        document.querySelector('.tab[data-tab="input"]').click();
        return { light, dark };
      });

      for (const [theme, colors] of Object.entries(themeColors)) {
        const labelContrast = contrastRatio(colors.label.foreground, colors.label.background, colors.canvas);
        const dayContrast = contrastRatio(colors.day.foreground, colors.day.background, colors.canvas);
        assert.ok(labelContrast >= 4.5, `${theme} form-label contrast is ${labelContrast.toFixed(2)}:1 (${colors.label.foreground} on ${colors.label.background})`);
        assert.ok(dayContrast >= 4.5, `${theme} calendar-day contrast is ${dayContrast.toFixed(2)}:1 (${colors.day.foreground} on ${colors.day.background})`);
      }
    }

    if (runsGroup('transparency-contrast')) {
      const session = await page.createCDPSession();
      let transparencyStyle = null;
      try {
        await session.send('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }]
        });
        transparencyStyle = await page.evaluate(() => {
          document.body.classList.add('dark');
          const toast = document.getElementById('appToast');
          const style = getComputedStyle(toast);
          return {
            foreground: style.color,
            background: style.backgroundColor,
            canvas: getComputedStyle(document.body).backgroundColor,
            backdropFilter: style.backdropFilter || style.webkitBackdropFilter
          };
        });
      } catch (error) {
        const css = fs.readFileSync(path.join(UI_ROOT, 'luxury.css'), 'utf8');
        const start = css.search(/@media\s*\(prefers-reduced-transparency:\s*reduce\)/);
        const end = css.indexOf('@media', start + 1);
        const block = css.slice(start, end < 0 ? css.length : end);
        assert.ok(start >= 0, 'reduced-transparency media query must exist');
        assert.match(block, /\.app-toast[\s\S]*?color\s*:/, 'reduced-transparency toast must declare a foreground');
        const foreground = block.match(/color\s*:\s*([^;!]+)/)?.[1].trim();
        const background = block.match(/background\s*:\s*([^;!]+)/)?.[1].trim();
        transparencyStyle = await page.evaluate(({ foreground, background }) => {
          const toast = document.getElementById('appToast');
          toast.style.color = foreground;
          toast.style.background = background;
          const style = getComputedStyle(toast);
          const result = {
            foreground: style.color,
            background: style.backgroundColor,
            canvas: getComputedStyle(document.body).backgroundColor,
            backdropFilter: 'none'
          };
          toast.style.color = '';
          toast.style.background = '';
          return result;
        }, { foreground, background });
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] }).catch(() => {});
        await session.detach().catch(() => {});
      }
      const transparencyContrast = contrastRatio(
        transparencyStyle.foreground,
        transparencyStyle.background,
        transparencyStyle.canvas
      );
      assert.ok(transparencyContrast >= 4.5, `reduced-transparency toast contrast is ${transparencyContrast.toFixed(2)}:1`);
      assert.equal(parseCssColor(transparencyStyle.background).a, 1, 'reduced-transparency toast background must be solid');
      assert.equal(transparencyStyle.backdropFilter, 'none', 'reduced-transparency toast must disable backdrop blur');
    }

    if (runsGroup('viewport-zoom')) {
      const viewport = await page.$eval('meta[name="viewport"]', element => element.content);
      assert.match(viewport, /(?:^|,)\s*width=device-width(?:,|$)/);
      assert.match(viewport, /(?:^|,)\s*initial-scale=1(?:\.0)?(?:,|$)/);
      assert.match(viewport, /(?:^|,)\s*viewport-fit=cover(?:,|$)/);
      assert.doesNotMatch(viewport, /user-scalable\s*=\s*no/i);
      assert.doesNotMatch(viewport, /maximum-scale\s*=/i);
      const session = await page.createCDPSession();
      await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
      await sleep(50);
      const zoom = await page.evaluate(() => ({
        scale: window.visualViewport?.scale || 1,
        layoutOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }));
      await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
      await session.detach();
      assert.ok(zoom.scale >= 1.9, `viewport did not accept 200% zoom: ${zoom.scale}`);
      assert.ok(zoom.layoutOverflow <= 1, `layout viewport overflowed by ${zoom.layoutOverflow}px before pan/zoom`);
    }
    const modalAnimationNames = await page.evaluate(() => ({
      backdrop: getComputedStyle(document.getElementById('aboutModal')).animationName,
      panel: getComputedStyle(document.querySelector('#aboutModal .modal')).animationName
    }));
    assert.deepEqual(modalAnimationNames, {
      backdrop: 'none',
      panel: 'none'
    });

    const toastContract = await page.evaluate(() => ({
      fn: typeof window.showAppToast,
      role: document.getElementById('appToast')?.getAttribute('role'),
      live: document.getElementById('appToast')?.getAttribute('aria-live')
    }));
    assert.deepEqual(toastContract, {
      fn: 'function',
      role: 'status',
      live: 'polite'
    });

    const toastAnimation = await page.evaluate(() => {
      window.showAppToast('saved');
      const toast = document.getElementById('appToast');
      const animation = toast.getAnimations()[0];
      return {
        className: toast.className,
        text: toast.textContent,
        transforms: animation?.effect?.getKeyframes().map(frame => frame.transform) || []
      };
    });
    assert.match(toastAnimation.className, /\bshow\b/);
    assert.equal(toastAnimation.text, 'saved');
    assert.ok(
      toastAnimation.transforms.length > 0 &&
      toastAnimation.transforms.every(transform => transform.includes('-50%')),
      'toast animation must preserve horizontal centering'
    );

    const saveFeedback = await page.evaluate(async () => {
      const nativeAlert = window.alert;
      let alerts = 0;
      window.alert = () => { alerts++; };
      try {
        const before = new Set((await window.storage.list('saju:')).keys || []);
        document.getElementById('saveBtn').click();
        document.getElementById('saveConfirm').click();
        await new Promise(resolve => setTimeout(resolve, 100));
        const toast = document.getElementById('appToast');
        const after = await window.storage.list('saju:');
        await Promise.all((after.keys || [])
          .filter(key => !before.has(key))
          .map(key => window.storage.delete(key)));
        return { alerts, className: toast.className, text: toast.textContent };
      } finally {
        window.alert = nativeAlert;
      }
    });
    assert.equal(saveFeedback.alerts, 0, 'save feedback must not use a native alert');
    assert.match(saveFeedback.className, /\bshow\b/, 'save feedback must display the app toast');
    assert.equal(saveFeedback.text, '명반이 저장되었습니다');

    const calendarDirection = await page.evaluate(async () => {
      document.querySelector('.tab[data-tab="calendar"]').click();
      document.getElementById('calNext').click();
      await new Promise(resolve => setTimeout(resolve, 320));
      return document.getElementById('calGrid').dataset.motionDirection;
    });
    assert.equal(calendarDirection, 'next', 'calendar next transition must expose its direction');

    const calendarDirectRender = await page.evaluate(() => {
      const grid = document.getElementById('calGrid');
      const calendarAnimations = () => grid.getAnimations().filter(animation => animation.constructor.name !== 'CSSAnimation');
      const title = document.getElementById('calTitle').textContent;
      grid.querySelector('.cal-day.clickable').click();
      return {
        titleUnchanged: document.getElementById('calTitle').textContent === title,
        activeAnimations: calendarAnimations().length
      };
    });
    assert.equal(calendarDirectRender.titleUnchanged, true, 'date selection must not change the calendar month');
    assert.equal(calendarDirectRender.activeAnimations, 0, 'date selection must render without calendar month motion');

    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const reducedCalendarMotion = await page.evaluate(() => {
      const grid = document.getElementById('calGrid');
      const calendarAnimations = () => grid.getAnimations().filter(animation => animation.constructor.name !== 'CSSAnimation');
      const before = document.getElementById('calTitle').textContent;
      document.getElementById('calNext').click();
      return {
        titleChanged: document.getElementById('calTitle').textContent !== before,
        direction: grid.dataset.motionDirection,
        activeAnimations: calendarAnimations().length
      };
    });
    await page.emulateMediaFeatures([]);
    assert.equal(reducedCalendarMotion.titleChanged, true, 'reduced-motion month changes must render immediately');
    assert.equal(reducedCalendarMotion.direction, 'next');
    assert.equal(reducedCalendarMotion.activeAnimations, 0, 'reduced-motion month changes must not animate');

    const calendarDurations = await page.evaluate(async () => {
      const grid = document.getElementById('calGrid');
      const calendarAnimations = () => grid.getAnimations().filter(animation => animation.constructor.name !== 'CSSAnimation');
      document.getElementById('calNext').click();
      const outgoing = calendarAnimations()[0]?.effect?.getTiming().duration;
      await new Promise(resolve => setTimeout(resolve, 120));
      const incoming = calendarAnimations()[0]?.effect?.getTiming().duration;
      return { outgoing, incoming };
    });
    assert.deepEqual(calendarDurations, { outgoing: 100, incoming: 140 }, 'calendar transition must use the 100ms/140ms timing budget');

    const calendarMotion = await page.evaluate(async () => {
      const grid = document.getElementById('calGrid');
      const calendarAnimations = () => grid.getAnimations().filter(animation => animation.constructor.name !== 'CSSAnimation');
      const titleMonth = () => {
        const match = document.getElementById('calTitle').textContent.match(/(\d+)년\s+(\d+)월/);
        return { year: Number(match[1]), month: Number(match[2]) };
      };
      const addMonths = ({ year, month }, delta) => {
        const date = new Date(year, month - 1 + delta, 1);
        return { year: date.getFullYear(), month: date.getMonth() + 1 };
      };

      const initial = titleMonth();
      document.getElementById('calNext').click();
      document.getElementById('calNext').click();
      const activeDuringRapidNext = calendarAnimations().length;
      await new Promise(resolve => setTimeout(resolve, 320));
      const afterRapidNext = titleMonth();
      const afterRapidNextDirection = grid.dataset.motionDirection;
      const activeAfterRapidNext = calendarAnimations().length;

      document.getElementById('calNext').click();
      document.getElementById('calPrev').click();
      const activeDuringOppositeDirections = calendarAnimations().length;
      await new Promise(resolve => setTimeout(resolve, 320));
      return {
        expectedAfterRapidNext: addMonths(initial, 2),
        afterRapidNext,
        afterRapidNextDirection,
        activeDuringRapidNext,
        activeAfterRapidNext,
        afterOppositeDirections: titleMonth(),
        afterOppositeDirectionsDirection: grid.dataset.motionDirection,
        activeDuringOppositeDirections,
        activeAfterOppositeDirections: calendarAnimations().length
      };
    });
    assert.ok(calendarMotion.activeDuringRapidNext > 0, 'calendar month changes must begin a WAAPI transition');
    assert.deepEqual(calendarMotion.afterRapidNext, calendarMotion.expectedAfterRapidNext, 'two rapid next clicks must advance two months');
    assert.equal(calendarMotion.afterRapidNextDirection, 'next');
    assert.equal(calendarMotion.activeAfterRapidNext, 0, 'rapid next clicks must leave no running calendar animation');
    assert.ok(calendarMotion.activeDuringOppositeDirections > 0, 'opposite-direction clicks must replace the active calendar transition');
    assert.deepEqual(calendarMotion.afterOppositeDirections, calendarMotion.expectedAfterRapidNext, 'next then previous must retain the correct final month');
    assert.equal(calendarMotion.afterOppositeDirectionsDirection, 'prev');
    assert.equal(calendarMotion.activeAfterOppositeDirections, 0, 'opposite-direction clicks must leave no running calendar animation');

    if (runsGroup('calendar-snapshot')) {
      const calendarSnapshot = await page.evaluate(async () => {
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const titleMonth = () => {
          const match = document.getElementById('calTitle').textContent.match(/(\d+)년\s+(\d+)월/);
          return { year: Number(match[1]), month: Number(match[2]) };
        };
        const grid = document.getElementById('calGrid');
        const calendarAnimations = () => grid.getAnimations().filter(animation => animation.constructor.name !== 'CSSAnimation');
        const rendered = titleMonth();
        document.getElementById('calNext').click();
        await wait(30);
        const outgoingDay = grid.querySelector('.cal-day.clickable[data-day="15"]');
        const outgoingSnapshot = {
          year: Number(outgoingDay?.dataset.year),
          month: Number(outgoingDay?.dataset.month),
          day: Number(outgoingDay?.dataset.day)
        };
        outgoingDay?.click();
        const immediate = {
          title: titleMonth(),
          selected: {
            year: Number(grid.querySelector('.cal-day.selected')?.dataset.year),
            month: Number(grid.querySelector('.cal-day.selected')?.dataset.month),
            day: Number(grid.querySelector('.cal-day.selected')?.dataset.day)
          },
          detail: document.querySelector('#calDayDetail .ttl')?.textContent.trim() || '',
          activeAnimations: calendarAnimations().length
        };
        await wait(280);
        return {
          rendered,
          outgoingSnapshot,
          immediate,
          finalTitle: titleMonth(),
          finalActiveAnimations: calendarAnimations().length
        };
      });
      const expectedDate = { ...calendarSnapshot.rendered, day: 15 };
      assert.deepEqual(calendarSnapshot.outgoingSnapshot, expectedDate, 'outgoing cells must carry their rendered year/month snapshot');
      assert.deepEqual(calendarSnapshot.immediate.title, calendarSnapshot.rendered, 'outgoing-date selection must restore the visible month');
      assert.deepEqual(calendarSnapshot.immediate.selected, expectedDate, 'the visible outgoing date must remain selected in its rendered month');
      assert.match(calendarSnapshot.immediate.detail, new RegExp(`^${expectedDate.year}년 ${expectedDate.month}월 ${expectedDate.day}일`));
      assert.equal(calendarSnapshot.immediate.activeAnimations, 0, 'outgoing-date selection must cancel stale month motion immediately');
      assert.deepEqual(calendarSnapshot.finalTitle, calendarSnapshot.rendered, 'stale completion must not reinterpret the selected date in the next month');
      assert.equal(calendarSnapshot.finalActiveAnimations, 0);
    }

    if (runsGroup('exit-curves')) {
      const exitCurves = await page.evaluate(async () => {
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        window.showAppToast('exit curve probe');
        await wait(1820);
        const toastExit = document.getElementById('appToast').getAnimations()
          .find(animation => animation.effect?.getTiming().duration === 140);
        const toast = toastExit ? {
          duration: toastExit.effect.getTiming().duration,
          easing: toastExit.effect.getTiming().easing
        } : null;

        const grid = document.getElementById('calGrid');
        document.getElementById('calNext').click();
        const calendarExit = grid.getAnimations()
          .find(animation => animation.effect?.getTiming().duration === 100);
        const calendar = calendarExit ? {
          duration: calendarExit.effect.getTiming().duration,
          easing: calendarExit.effect.getTiming().easing
        } : null;
        await wait(260);
        return { toast, calendar };
      });
      for (const [name, timing] of Object.entries(exitCurves)) {
        assert.ok(timing, `${name} exit animation was not created`);
        assert.ok(timing.duration >= 100 && timing.duration <= 240, `${name} exit duration ${timing.duration}ms is outside the motion budget`);
        assert.match(timing.easing, /^cubic-bezier\(/, `${name} exit must use a deliberate custom curve, got ${timing.easing}`);
      }
    }

    const matchMotion = await page.evaluate(async () => {
      document.querySelector('.tab[data-tab="match"]').click();
      setMatchSlot('A', { ...currentSaju });
      await new Promise(resolve => setTimeout(resolve, 220));
      const a = document.querySelector('.match-slot.a.filled');
      const b = document.querySelector('.match-slot.b.filled');
      return { aCount: a?.dataset.motionCount, bExists: !!b };
    });
    assert.equal(matchMotion.aCount, '1');
    assert.equal(matchMotion.bExists, false);

    const replacementMotion = await page.evaluate(async () => {
      document.getElementById('matchResetBtn').click();
      const person1 = { ...currentSaju, name: 'person1' };
      const person2 = { ...currentSaju, name: 'person2' };
      setMatchSlot('A', person1);
      setMatchSlot('A', person2);
      await new Promise(resolve => requestAnimationFrame(resolve));
      const a = document.querySelector('.match-slot.a.filled');
      return {
        name: a?.querySelector('.slot-name')?.textContent.trim(),
        motionCount: a?.dataset.motionCount,
        animations: a?.getAnimations().length || 0
      };
    });
    assert.match(replacementMotion.name, /^person2/);
    assert.equal(replacementMotion.motionCount, undefined);
    assert.equal(replacementMotion.animations, 0);

    if (runsGroup('reduced-match')) {
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      const reducedMatch = await page.evaluate(async () => {
        document.getElementById('matchResetBtn')?.click();
        setMatchSlot('A', { ...currentSaju, name: 'reduced motion' });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const slot = document.querySelector('.match-slot.a.filled');
        const animation = slot?.getAnimations()[0];
        const frames = animation?.effect?.getKeyframes() || [];
        return {
          transforms: frames.map(frame => frame.transform),
          opacities: frames.map(frame => Number(frame.opacity)),
          duration: animation?.effect?.getTiming().duration
        };
      });
      await page.emulateMediaFeatures([]);
      assert.deepEqual(reducedMatch.opacities, [0, 1], 'reduced-motion slot feedback must retain the opacity cue');
      assert.equal(new Set(reducedMatch.transforms).size, 1, `reduced-motion slot transforms differ: ${reducedMatch.transforms.join(' → ')}`);
      assert.equal(reducedMatch.duration, 100);
    }
  }

  assert.equal(await page.$eval('link[href="luxury.css"]', () => true), true);
  const bg = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--obsidian-bg').trim());
  assert.equal(bg, '#07080d');
  const introLogo = await page.$eval('.intro-logo-img', element => ({
    src: element.getAttribute('src'),
    width: element.naturalWidth,
    height: element.naturalHeight,
    boxShadow: getComputedStyle(element).boxShadow
  }));
  assert.equal(introLogo.src, 'main-logo.png', `${width}px intro logo source`);
  assert.ok(introLogo.width > 0 && introLogo.height > 0, `${width}px intro logo failed to load`);
  assert.equal(introLogo.boxShadow, 'none', `${width}px intro logo must not have a rectangular background shadow`);
  const inputPolish = await page.evaluate(() => ({
    logoWidth: document.querySelector('.intro-logo-img').getBoundingClientRect().width,
    cardBorder: getComputedStyle(document.querySelector('.input-card')).borderTopColor,
    collapsedErrorBorder: getComputedStyle(document.getElementById('inErr')).borderTopColor
  }));
  assert.ok(inputPolish.logoWidth <= 190, `${width}px intro logo is too large: ${inputPolish.logoWidth}`);
  assert.equal(inputPolish.cardBorder, 'rgba(255, 255, 255, 0.08)', `${width}px input card border`);
  assert.equal(inputPolish.collapsedErrorBorder, 'rgba(0, 0, 0, 0)', `${width}px collapsed error line`);

  await fillAndCalculate(page);

  const metrics = await page.evaluate(() => {
    const rects = selector => [...document.querySelectorAll(selector)].map(element => {
      const rect = element.getBoundingClientRect();
      return {
        w: rect.width,
        h: rect.height,
        font: parseFloat(getComputedStyle(element.querySelector('.han') || element).fontSize)
      };
    });

    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pillars: rects('.pillar-block'),
      daeun: rects('#daeunScroll .luck-block'),
      seun: rects('#seunScroll .luck-block')
    };
  });

  assert.ok(metrics.overflow <= 1, `${width}px horizontal overflow: ${metrics.overflow}px`);
  assert.equal(metrics.pillars.length, 8, `${width}px pillar count`);

  if (runsGroup('apple-design')) {
    await inspectAppleDesign(page, width);
    await page.close();
    return;
  }

  for (const [group, rects] of Object.entries({
    pillars: metrics.pillars,
    daeun: metrics.daeun,
    seun: metrics.seun
  })) {
    assert.ok(rects.length > 0, `${width}px ${group} missing`);
    rects.forEach(({ w, h }) => {
      assert.ok(Math.abs(w - h) <= 1, `${width}px ${group} not square: ${w}x${h}`);
    });
    const fonts = new Set(rects.map(({ font }) => font.toFixed(2)));
    assert.equal(fonts.size, 1, `${width}px ${group} font sizes differ: ${[...fonts]}`);
  }

  const resultPalette = await page.evaluate(() => ({
    selectedOutline: getComputedStyle(document.querySelector('#daeunScroll .luck-item.selected')).outlineColor,
    bottomBarBackground: getComputedStyle(document.getElementById('bottomBar')).backgroundColor
  }));
  assert.equal(resultPalette.selectedOutline, 'rgb(240, 214, 154)', `${width}px selected luck outline`);
  assert.equal(resultPalette.bottomBarBackground, 'rgba(7, 8, 13, 0.96)', `${width}px bottom bar background`);

  await page.evaluate(() => document.querySelector('.tab[data-tab="fortune"]').click());
  await sleep(200);
  assert.equal(
    await page.$eval('.fortune-head .year-tag', element => getComputedStyle(element).backgroundColor),
    'rgb(216, 181, 106)'
  );

  await page.evaluate(() => document.querySelector('.tab[data-tab="match"]').click());
  await sleep(200);
  assert.equal(
    await page.$eval('.match-intro em', element => getComputedStyle(element).color),
    'rgb(240, 214, 154)'
  );
  await page.evaluate(() => document.querySelector('.tab[data-tab="result"]').click());
  await sleep(150);

  await page.evaluate(() => window.shareCard(currentSaju));
  await sleep(150);
  const sharePreview = await page.evaluate(() => ({
    src: document.querySelector('#shareCardModal img')?.getAttribute('src') || '',
    buttonBackground: getComputedStyle(document.getElementById('shareCardDo')).backgroundImage
  }));
  assert.ok(sharePreview.src.startsWith('data:image/png'), `${width}px share preview missing`);
  assert.match(sharePreview.buttonBackground, /rgb\(216, 181, 106\)/, `${width}px share button is not gold`);
  if (width === 390 && runsGroup('share-back')) {
    const overlayContract = await page.evaluate(() => ({
      closeShare: typeof window.closeShareCardModal,
      closeTopOverlay: typeof window.closeTopAppOverlay,
      handleBack: typeof window.handleAppBack
    }));
    assert.deepEqual(overlayContract, {
      closeShare: 'function',
      closeTopOverlay: 'function',
      handleBack: 'function'
    });
    const backResult = await page.evaluate(() => {
      const tabBefore = document.querySelector('.tab.active')?.dataset.tab;
      const handled = window.handleAppBack();
      return {
        handled,
        shareOpen: !!document.getElementById('shareCardModal'),
        tabBefore,
        tabAfter: document.querySelector('.tab.active')?.dataset.tab
      };
    });
    assert.deepEqual(backResult, {
      handled: true,
      shareOpen: false,
      tabBefore: 'result',
      tabAfter: 'result'
    }, 'Android/web back must dismiss the share overlay before changing tabs');

    const centralizedClose = await page.evaluate(() => {
      window.shareCard(currentSaju);
      const handled = window.closeTopAppOverlay();
      return { handled, shareOpen: !!document.getElementById('shareCardModal') };
    });
    assert.deepEqual(centralizedClose, { handled: true, shareOpen: false });
  } else {
    await page.evaluate(() => document.getElementById('shareCardModal')?.remove());
  }

  await page.evaluate(() => document.querySelector('.tab[data-tab="saved"]').click());
  await sleep(250);
  assert.equal(
    await page.$eval('[data-go-input]', element => element.textContent.trim()),
    '명반 만들러 가기'
  );

  await page.close();
}

(async () => {
  if (runsGroup('android-backup')) inspectAndroidBackupPolicy();
  if (runsGroup('release-contract')) inspectReleaseContract();
  if (TEST_GROUP === 'android-backup' || TEST_GROUP === 'release-contract') {
    console.log(`${TEST_GROUP} regression PASS`);
    return;
  }

  if (runsGroup('apple-design')) {
    const appleCss = fs.readFileSync(path.join(UI_ROOT, 'apple.css'), 'utf8');
    assert.match(appleCss, /--apple-accent:\s*#007aff/i);
    assert.match(appleCss, /body\.dark[\s\S]*--apple-accent:\s*#0a84ff/i);
    assert.doesNotMatch(appleCss, /#d8b56a|#f0d69a|#a97732/i);
  }

  const luxuryCss = fs.readFileSync(path.join(UI_ROOT, 'luxury.css'), 'utf8');
  assert.match(luxuryCss, /prefers-reduced-transparency:\s*reduce/);
  assert.match(luxuryCss, /prefers-contrast:\s*more/);

  const serviceWorker = fs.readFileSync(path.join(WEB_ROOT, 'sw.js'), 'utf8');
  assert.match(serviceWorker, /'\.\/luxury\.css'/, 'web service worker must precache luxury.css');
  assert.match(serviceWorker, /'\.\/main-logo\.png'/, 'web service worker must precache main-logo.png');
  if (runsGroup('service-worker')) {
    await inspectServiceWorkerInstall(serviceWorker);
    assert.doesNotMatch(serviceWorker, /addAll\(PRECACHE\)\.catch/, 'core addAll rejection must not be swallowed');
  }
  if (TEST_GROUP === 'service-worker') {
    console.log('Service-worker regression PASS');
    return;
  }
  console.log('[ui] launching Chrome');
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--hide-scrollbars']
  });
  console.log('[ui] Chrome launched');
  try {
    for (const width of widths) await inspectWidth(browser, width);
    console.log('UI regression PASS:', widths.join(', '));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
