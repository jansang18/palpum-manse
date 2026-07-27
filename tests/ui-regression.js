const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');
const TEST_GROUP = process.env.TEST_GROUP || '';

function inspectRepositoryRootInference() {
  const source = fs.readFileSync(__filename, 'utf8');
  assert.match(source, /path\.join\(repoRoot,\s*'index\.html'\)/);
  assert.match(source, /UI_ROOT[\s\S]*repoRoot/);
}

function inspectLegendSourceContracts() {
  const html = fs.readFileSync(path.join(UI_ROOT, 'index.html'), 'utf8');
  const tokens = fs.readFileSync(path.join(UI_ROOT, 'styles', 'legend-tokens.css'), 'utf8');
  const layout = fs.readFileSync(path.join(UI_ROOT, 'styles', 'legend-layout.css'), 'utf8');
  const motion = fs.readFileSync(path.join(UI_ROOT, 'styles', 'legend-motion.css'), 'utf8');
  const shareSource = fs.readFileSync(path.join(UI_ROOT, 'share.js'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(UI_ROOT, 'manifest.webmanifest'), 'utf8'));

  assert.match(html, /<title>취명선 전설의 만세력<\/title>/);
  assert.match(
    html,
    /<h1 class="title"><span class="brand-main">취명선<\/span> <span class="title-sub">전설의 만세력<\/span><\/h1>/
  );
  assert.match(html, /id="aboutModalTitle">취명선 전설의 만세력<\/h3>/);
  assert.match(html, /alt="취명선 전설의 만세력"/);
  assert.equal((html.match(/rel="manifest"/g) || []).length, 1);
  assert.doesNotMatch(html, /data:application\/json/);
  assert.doesNotMatch(html, /정재훈 만세력|신의음성만세력/);
  assert.doesNotMatch(
    html.match(/<head>[\s\S]*?<\/head>/)?.[0] || '',
    /취명선 만세력|취명선만세력/,
    'legacy import aliases must not appear in user-visible app identity'
  );
  assert.doesNotMatch(shareSource, /취명선 만세력|sineum-manse/);
  assert.match(shareSource, /취명선 전설의 만세력/);
  assert.match(shareSource, /jansang18\.github\.io\/legend-manse/);
  assert.deepEqual(
    { name: manifest.name, shortName: manifest.short_name },
    { name: '취명선 전설의 만세력', shortName: '전설의 만세력' }
  );
  assert.match(manifest.description, /취명선 전설의 만세력/);
  for (const stylesheet of [
    'styles/legend-tokens.css',
    'styles/legend-layout.css',
    'styles/legend-motion.css'
  ]) {
    assert.match(html, new RegExp(`<link rel="stylesheet" href="${stylesheet}">`));
  }
  for (const asset of ['assets/legend-landscape.webp', 'assets/legend-seal.webp']) {
    assert.match(html, new RegExp(asset.replace('.', '\\.')));
    assert.ok(fs.statSync(path.join(UI_ROOT, asset)).size > 0, `${asset} must not be empty`);
  }
  for (const token of [
    '--paper',
    '--ink',
    '--seal',
    '--wood',
    '--fire',
    '--earth',
    '--metal',
    '--water'
  ]) {
    assert.match(tokens, new RegExp(token));
  }
  const tokenValue = name => {
    const match = tokens.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i'));
    assert.ok(match, `${name} must be a six-digit hex color`);
    return match[1];
  };
  const rgb = hex => [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16)
  ];
  const luminance = hex => {
    const channels = rgb(hex).map(value => {
      const normalized = value / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const contrast = (foreground, background) => {
    const first = luminance(foreground);
    const second = luminance(background);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  };
  for (const background of ['--paper', '--paper-bright']) {
    assert.ok(
      contrast(tokenValue('--ink-muted'), tokenValue(background)) >= 4.5,
      `--ink-muted must reach 4.5:1 against ${background}`
    );
  }
  assert.match(layout, /env\(safe-area-inset-top\)/);
  assert.match(layout, /env\(safe-area-inset-bottom\)/);
  assert.match(layout, /min-(?:height|block-size):\s*(?:2\.75rem|44px)/);
  assert.match(layout, /font-family:\s*(?:-apple-system|"?SF Pro)/);
  assert.match(motion, /prefers-reduced-motion:\s*reduce/);
  assert.match(motion, /prefers-reduced-transparency:\s*reduce/);
  assert.match(motion, /prefers-contrast:\s*more/);
}

const puppeteer = require('puppeteer-core');

const repoRoot = path.resolve(__dirname, '..');
const inferredUiRoot = fs.existsSync(path.join(repoRoot, 'index.html'))
  ? repoRoot
  : path.join(path.resolve(__dirname, '..', '..'), 'www');
const UI_ROOT = process.env.UI_ROOT
  ? path.resolve(process.cwd(), process.env.UI_ROOT)
  : inferredUiRoot;
const APP_ROOT = process.env.APP_ROOT
  ? path.resolve(process.cwd(), process.env.APP_ROOT)
  : fs.existsSync(path.join(repoRoot, 'index.html'))
    ? repoRoot
    : path.resolve(__dirname, '..', '..');
const ANDROID_ROOT = path.join(APP_ROOT, 'android');
const HAS_ANDROID_PROJECT = fs.existsSync(path.join(ANDROID_ROOT, 'app', 'src', 'main', 'AndroidManifest.xml'));
const WEB_ROOT = process.env.WEB_ROOT
  ? path.resolve(APP_ROOT, process.env.WEB_ROOT)
  : fs.existsSync(path.join(repoRoot, 'index.html'))
    ? repoRoot
    : path.join(APP_ROOT, 'web');

function findChromeExecutable() {
  if (process.env.CHROME_PATH) {
    if (fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
    throw new Error(`CHROME_PATH does not exist: ${process.env.CHROME_PATH}`);
  }

  const candidates = process.platform === 'win32'
    ? [
        process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
        process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Chromium', 'Application', 'chrome.exe'),
        process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
      ]
    : process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
        ]
      : [
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
          '/snap/bin/chromium',
          '/usr/bin/microsoft-edge',
          '/usr/bin/microsoft-edge-stable'
        ];
  const executable = candidates.filter(Boolean).find(candidate => fs.existsSync(candidate));
  if (executable) return executable;
  throw new Error(
    'No installed Chrome, Chromium, or Edge browser found. ' +
    'Set CHROME_PATH to an existing browser executable; browser downloads are disabled.'
  );
}

let URL = pathToFileURL(path.join(UI_ROOT, 'index.html')).href;
const widths = TEST_GROUP === 'result-width-brand' || TEST_GROUP === 'shell-width'
  ? [390, 1220]
  : TEST_GROUP === 'fold-layout'
    ? [720, 884]
  : TEST_GROUP === 'calendar-shell-width'
    ? [390, 520, 600, 700, 768, 900, 1220]
  : TEST_GROUP === 'all-tab-shell-width'
    ? [390, 520, 600, 700, 768, 1220]
  : TEST_GROUP === 'frontend-quality'
    ? [320, 768, 1440]
  : TEST_GROUP === 'legend-flow'
    ? [320, 390]
  : TEST_GROUP === 'legend-accessibility'
    ? [390, 1220]
  : TEST_GROUP === 'legend-navigation'
    ? [390, 1220]
  : TEST_GROUP === 'legend-home'
    ? [390]
  : TEST_GROUP === 'release-audit'
    ? [360, 390, 412, 768, 1220]
  : TEST_GROUP === 'lunar-input' || TEST_GROUP === 'legacy-import'
    ? [390]
  : TEST_GROUP === 'repository-root'
    ? [390]
  : TEST_GROUP ? [390] : [360, 390, 412, 768, 1220];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const activateDestination = (page, tab) => page.evaluate(
  destination => window.activateLegendDestination(destination),
  tab
);
const runsGroup = name => !TEST_GROUP || TEST_GROUP === name;
const runsSecondaryApple = () => !TEST_GROUP || TEST_GROUP === 'task-5' || TEST_GROUP === 'secondary-apple';
const runsAppleMotion = () => !TEST_GROUP || TEST_GROUP === 'motion-contract';
const runsCalendarCurrentYear = () => !TEST_GROUP || TEST_GROUP === 'calendar-current-year';
const runsImportedFieldXss = () => !TEST_GROUP || TEST_GROUP === 'imported-fields-xss';
const runsResultWidthBrand = () => TEST_GROUP === 'result-width-brand';
const runsShellWidth = () => TEST_GROUP === 'shell-width';
const runsFoldLayout = () => TEST_GROUP === 'fold-layout';
const runsResultHeaderCompact = () => !TEST_GROUP || TEST_GROUP === 'result-header-compact';
const runsAndroidSafeArea = () => HAS_ANDROID_PROJECT && (!TEST_GROUP || TEST_GROUP === 'android-safe-area');

function startStaticServer(root) {
  const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.webp': 'image/webp'
  };
  const normalizedRoot = path.resolve(root);
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new globalThis.URL(request.url, 'http://127.0.0.1').pathname);
    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = path.resolve(normalizedRoot, relativePath);
    if (filePath !== normalizedRoot && !filePath.startsWith(`${normalizedRoot}${path.sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    fs.readFile(filePath, (error, content) => {
      if (error) {
        response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
        return;
      }
      response.writeHead(200, {
        'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      response.end(content);
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${address.port}/index.html` });
    });
  });
}

function inspectLegendEraMetadata() {
  const { getLegendEra } = require('../scripts/legend-era.js');
  const expected = [
    [1, '상원', '감', '坎', '수', '심연'],
    [2, '상원', '곤', '坤', '토', '대지'],
    [3, '상원', '진', '震', '목', '천둥'],
    [4, '중원', '손', '巽', '목', '바람'],
    [5, '중원', '중궁', '中', '토', '중심'],
    [6, '중원', '건', '乾', '금', '하늘'],
    [7, '하원', '태', '兌', '금', '호수'],
    [8, '하원', '간', '艮', '토', '산']
  ];

  assert.deepEqual(
    expected.map(([yun], index) => {
      const era = getLegendEra(1864 + index * 20);
      return [era.yun, era.yuan, era.trigram, era.hanja, era.element, era.symbol];
    }),
    expected,
    'periods 1 through 8 must preserve their public metadata'
  );
}

async function inspectCalendarShellWidth(page, width) {
  await activateDestination(page, 'calendar');
  await sleep(100);
  const geometry = await page.evaluate(() => {
    const box = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    };
    return {
      viewport: document.documentElement.clientWidth,
      header: box('.top-bar'),
      tabs: box('.tabs'),
      calendar: box('.cal-grid')
    };
  });
  for (const name of ['header', 'tabs']) {
    assert.ok(
      Math.abs(geometry[name].width - geometry.calendar.width) <= 1,
      `${width}px calendar ${name} width ${geometry[name].width}px must match calendar card ${geometry.calendar.width}px`
    );
    assert.ok(
      Math.abs(geometry[name].left - geometry.calendar.left) <= 1,
      `${width}px calendar ${name} left edge must match calendar card`
    );
  }
  assert.ok(geometry.calendar.left >= 0 && geometry.calendar.right <= geometry.viewport + 1, `${width}px calendar shell overflows viewport`);
}

async function inspectAllTabShellWidths(page, width) {
  const targets = {
    input: '.input-card',
    result: '.oguk-card',
    fortune: '.overall-card',
    match: '.match-intro',
    calendar: '.cal-grid'
  };
  for (const [tab, selector] of Object.entries(targets)) {
    await activateDestination(page, tab);
    await sleep(60);
    const geometry = await page.evaluate(selector => {
      const rect = element => {
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, width: box.width };
      };
      return {
        header: rect(document.querySelector('.top-bar')),
        tabs: rect(document.querySelector('.tabs')),
        target: rect(document.querySelector(selector))
      };
    }, selector);
    for (const name of width < 768 ? ['header'] : ['header', 'tabs']) {
      assert.ok(Math.abs(geometry[name].width - geometry.target.width) <= 1, `${width}px ${tab} ${name} width must match content`);
      assert.ok(Math.abs(geometry[name].left - geometry.target.left) <= 1, `${width}px ${tab} ${name} left edge must match content`);
    }
  }

  await activateDestination(page, 'saved');
  await sleep(60);
  const savedGeometry = await page.evaluate(() => {
    const shell = element => {
      const box = element.getBoundingClientRect();
      return { left: box.left, width: box.width };
    };
    const view = document.getElementById('view-saved');
    const style = getComputedStyle(view);
    const left = view.getBoundingClientRect().left + parseFloat(style.paddingLeft);
    const width = view.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    return { header: shell(document.querySelector('.top-bar')), tabs: shell(document.querySelector('.tabs')), target: { left, width } };
  });
  for (const name of width < 768 ? ['header'] : ['header', 'tabs']) {
    assert.ok(Math.abs(savedGeometry[name].width - savedGeometry.target.width) <= 1, `${width}px saved ${name} width must match content`);
    assert.ok(Math.abs(savedGeometry[name].left - savedGeometry.target.left) <= 1, `${width}px saved ${name} left edge must match content`);
  }
}

async function inspectFrontendQuality(page, width) {
  const state = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.tab')].map(tab => ({
      role: tab.getAttribute('role'),
      selected: tab.getAttribute('aria-selected'),
      controls: tab.getAttribute('aria-controls'),
      id: tab.id
    }));
    const panels = [...document.querySelectorAll('.view')].map(panel => ({
      role: panel.getAttribute('role'),
      labelledBy: panel.getAttribute('aria-labelledby'),
      hidden: panel.hasAttribute('hidden')
    }));
    const labels = [...document.querySelectorAll('label.field-label[for]')].map(label => label.htmlFor);
    const segmentButtons = [...document.querySelectorAll('#segGender button, #segCal button')].map(button => ({
      role: button.getAttribute('role'),
      checked: button.getAttribute('aria-checked')
    }));
    return {
      headingCount: document.querySelectorAll('h1').length,
      tablist: document.querySelector('.tabs').getAttribute('role'),
      tabs,
      panels,
      labels,
      aboutLabel: document.getElementById('aboutBtn').getAttribute('aria-label'),
      prevLabel: document.getElementById('calPrev').getAttribute('aria-label'),
      nextLabel: document.getElementById('calNext').getAttribute('aria-label'),
      genderGroup: document.getElementById('segGender').getAttribute('role'),
      calendarGroup: document.getElementById('segCal').getAttribute('role'),
      segmentButtons
    };
  });

  assert.equal(state.headingCount, 1, `${width}px page must expose one h1`);
  assert.equal(state.tablist, 'tablist', `${width}px primary nav role`);
  assert.ok(state.tabs.every(tab => tab.role === 'tab' && tab.controls && tab.id), `${width}px tabs need complete semantics`);
  assert.equal(state.tabs.filter(tab => tab.selected === 'true').length, 1, `${width}px one selected tab`);
  assert.ok(state.panels.every(panel => panel.role === 'tabpanel' && panel.labelledBy), `${width}px panels need tab semantics`);
  assert.ok(['inputName', 'inBirth', 'inTime'].every(id => state.labels.includes(id)), `${width}px primary fields need associated labels`);
  assert.equal(state.aboutLabel, '앱 정보', `${width}px about button accessible name`);
  assert.equal(state.prevLabel, '이전 달', `${width}px previous month accessible name`);
  assert.equal(state.nextLabel, '다음 달', `${width}px next month accessible name`);
  assert.equal(state.genderGroup, 'radiogroup', `${width}px gender group semantics`);
  assert.equal(state.calendarGroup, 'radiogroup', `${width}px calendar type group semantics`);
  assert.ok(state.segmentButtons.every(button => button.role === 'radio' && ['true', 'false'].includes(button.checked)), `${width}px segmented choices need radio state`);

  await page.evaluate(() => document.querySelector('.tab[data-tab="fortune"]').click());
  const switched = await page.evaluate(() => ({
    selected: document.querySelector('.tab[data-tab="fortune"]').getAttribute('aria-selected'),
    previous: document.querySelector('.tab[data-tab="input"]').getAttribute('aria-selected'),
    panelHidden: document.getElementById('view-fortune').hasAttribute('hidden')
  }));
  assert.deepEqual(switched, { selected: 'true', previous: 'false', panelHidden: false }, `${width}px tab state must update`);

  await page.evaluate(() => document.querySelector('.tab[data-tab="input"]').click());
  await page.evaluate(() => document.querySelector('#segGender button[data-val="F"]').click());
  const selectedGender = await page.evaluate(() => [...document.querySelectorAll('#segGender button')].map(button => button.getAttribute('aria-checked')));
  assert.deepEqual(selectedGender, ['false', 'true'], `${width}px segmented radio state must update`);
}

async function inspectShellWidth(page, width) {
  await activateDestination(page, 'input');
  await sleep(50);
  const geometry = await page.evaluate(() => {
    const box = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    };
    return {
      viewport: document.documentElement.clientWidth,
      header: box('.top-bar'),
      tabs: box('.tabs'),
      introMarginTop: parseFloat(getComputedStyle(document.querySelector('.input-intro')).marginTop),
      inputView: box('#view-input'),
      search: box('.person-search-btn'),
      card: box('.input-card'),
      action: box('.primary-btn'),
      note: box('#view-input .note-text')
    };
  });

  const reference = geometry.tabs;
  for (const [name, rect] of Object.entries(geometry)) {
    if (name === 'viewport' || name === 'tabs' || name === 'introMarginTop') continue;
    assert.ok(
      Math.abs(rect.width - reference.width) <= 1,
      `${width}px ${name} width ${rect.width}px must match tabs ${reference.width}px`
    );
    assert.ok(
      Math.abs(rect.left - reference.left) <= 1,
      `${width}px ${name} left ${rect.left}px must match tabs ${reference.left}px`
    );
  }
  assert.ok(
    geometry.introMarginTop >= -38.5 && geometry.introMarginTop <= -37.5,
    `${width}px intro must move up by about 1cm/38px, got ${geometry.introMarginTop}px`
  );
  assert.ok(reference.left >= 0 && reference.right <= geometry.viewport + 1, `${width}px shared shell overflows viewport`);
}

async function inspectFoldLayout(page, width) {
  await activateDestination(page, 'input');
  await sleep(50);
  const geometry = await page.evaluate(() => {
    const rect = selector => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width };
    };
    return {
      viewport: document.documentElement.clientWidth,
      header: rect('.top-bar'),
      tabs: rect('.tabs'),
      card: rect('.input-card'),
      action: rect('.primary-btn')
    };
  });
  const expected = Math.min(720, geometry.viewport - 32);
  for (const name of ['header', 'tabs', 'card', 'action']) {
    const rect = geometry[name];
    assert.ok(Math.abs(rect.width - expected) <= 1, `${width}px unfolded ${name} must use the wider fold measure`);
    assert.ok(Math.abs(rect.left - (geometry.viewport - expected) / 2) <= 1, `${width}px unfolded ${name} must remain centered`);
  }
}

async function inspectResultWidthAndBrand(page, width) {
  const state = await page.evaluate(() => {
    const bottomBar = document.getElementById('bottomBar').getBoundingClientRect();
    const card = document.querySelector('.oguk-card').getBoundingClientRect();
    const tabs = document.querySelector('.tabs').getBoundingClientRect();
    const brand = getComputedStyle(document.querySelector('.top-bar .brand-main'));
    const suffix = getComputedStyle(document.querySelector('.top-bar .title-sub'));
    const typography = style => ({
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing
    });
    const pillars = [...document.querySelectorAll('.pillar-block')].map(block => {
      const rect = block.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(block.querySelector('.han'));
      const glyph = range.getBoundingClientRect();
      const matrix = new DOMMatrixReadOnly(getComputedStyle(block.querySelector('.han')).transform);
      return {
        width: rect.width,
        height: rect.height,
        fontSize: parseFloat(getComputedStyle(block.querySelector('.han')).fontSize),
        transformY: matrix.m42,
        glyphCenterY: Math.abs((glyph.top + glyph.bottom) / 2 - (rect.top + rect.bottom) / 2)
      };
    });
    return {
      bottomBar: { left: bottomBar.left, right: bottomBar.right, width: bottomBar.width },
      card: { left: card.left, right: card.right, width: card.width },
      tabs: { left: tabs.left, right: tabs.right, width: tabs.width },
      viewportWidth: document.documentElement.clientWidth,
      brand: typography(brand),
      suffix: typography(suffix),
      pillars
    };
  });

  assert.ok(
    Math.abs(state.bottomBar.width - state.card.width) <= 1,
    `${width}px bottom bar width ${state.bottomBar.width}px must match natal card ${state.card.width}px`
  );
  assert.ok(
    Math.abs(state.bottomBar.left - state.card.left) <= 1,
    `${width}px bottom bar and natal card must share the same left edge`
  );
  assert.ok(
    state.bottomBar.left >= 0 && state.bottomBar.right <= state.viewportWidth + 1,
    `${width}px bottom bar overflows viewport`
  );
  assert.ok(
    Math.abs(state.tabs.width - state.card.width) <= 1,
    `${width}px tabs width ${state.tabs.width}px must match natal card ${state.card.width}px`
  );
  assert.ok(
    Math.abs(state.tabs.left - state.card.left) <= 1,
    `${width}px tabs and natal card must share the same left edge`
  );
  assert.deepEqual(state.brand, state.suffix, `${width}px 취명선 and 만세력 typography must match`);
  assert.equal(state.pillars.length, 8, `${width}px natal Hanja block count`);
  for (const pillar of state.pillars) {
    assert.ok(pillar.width >= 83 && pillar.width <= 85, `${width}px natal block must be about 84px, got ${pillar.width}px`);
    assert.ok(Math.abs(pillar.width - pillar.height) <= 1, `${width}px natal block must stay square`);
    assert.ok(pillar.fontSize >= 51 && pillar.fontSize <= 55, `${width}px natal Hanja must be about 52px, got ${pillar.fontSize}px`);
    assert.ok(pillar.transformY <= -2.8 && pillar.transformY >= -3.2, `${width}px natal Hanja optical offset must be about -3px, got ${pillar.transformY}px`);
    assert.ok(pillar.glyphCenterY <= 4, `${width}px natal glyph line-box center delta ${pillar.glyphCenterY}px`);
  }
}

function parseCssColor(value) {
  const match = String(value).match(/rgba?\(([^)]+)\)/i);
  if (match) {
    const parts = match[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }
  const srgb = String(value).match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/i);
  assert.ok(srgb, `unsupported computed color: ${value}`);
  return {
    r: Number(srgb[1]) * 255,
    g: Number(srgb[2]) * 255,
    b: Number(srgb[3]) * 255,
    a: srgb[4] === undefined ? 1 : Number(srgb[4])
  };
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
      return Promise.resolve([
        'sineum-manse-previous',
        'legend-manse-previous',
        openedCache
      ].filter(Boolean));
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
  assert.deepEqual(successfulInstall.deletedCaches, ['legend-manse-previous']);
  assert.equal(successfulInstall.events.at(-1).type, 'claim');
}

function inspectAndroidBackupPolicy() {
  const manifestPath = path.join(APP_ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  const manifest = fs.readFileSync(manifestPath, 'utf8');
  assert.match(manifest, /android:allowBackup="false"/, 'saved chart data must be excluded from Android backup');
  assert.doesNotMatch(manifest, /android:allowBackup="true"/);
}

function inspectAndroidSafeAreaContract() {
  const appleCss = fs.readFileSync(path.join(UI_ROOT, 'apple.css'), 'utf8');
  const capacitorConfig = JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'capacitor.config.json'), 'utf8'));

  assert.match(
    appleCss,
    /--app-safe-top\s*:\s*var\(--safe-area-inset-top,\s*env\(safe-area-inset-top,\s*0px\)\)/,
    'the header must consume Capacitor Android safe-area CSS variables'
  );
  assert.match(
    appleCss,
    /\.top-bar\s*\{[\s\S]*?padding-top:\s*calc\(8px\s*\+\s*var\(--app-safe-top\)\)/,
    'the title bar must reserve space for the Android status bar'
  );
  assert.match(
    appleCss,
    /\.tabs\s*\{[\s\S]*?top:\s*calc\(76px\s*\+\s*var\(--app-safe-top\)\)/,
    'the tab rail must begin below the status-bar-safe title bar'
  );
  assert.equal(capacitorConfig.plugins?.SystemBars?.style, 'DARK', 'dark app must request light status-bar icons');
  assert.equal(capacitorConfig.plugins?.SystemBars?.insetsHandling, 'css', 'Capacitor must expose Android safe-area insets to CSS');
}

function inspectResultHeaderCompactContract() {
  const indexHtml = fs.readFileSync(path.join(UI_ROOT, 'index.html'), 'utf8');
  const appleCss = fs.readFileSync(path.join(UI_ROOT, 'apple.css'), 'utf8');
  assert.doesNotMatch(indexHtml, /<div class="card-title">&#10022; 사주 원국<\/div>/, 'result card must not repeat the "사주 원국" heading');
  assert.match(appleCss, /\.oguk-card \.result-head\s*\{[\s\S]*?padding:\s*0 0 8px !important/, 'result identity header must use compact vertical spacing');
  assert.match(appleCss, /#seunScroll \.luck-item\s*\{[\s\S]*?grid-template-rows:\s*34px 22px auto auto 22px/, 'yearly-flow labels must reserve separate rows for year, age, and ten-god text');
}

function inspectFinalSecuritySourceContracts() {
  const indexHtml = fs.readFileSync(path.join(UI_ROOT, 'index.html'), 'utf8');
  const appleCss = fs.readFileSync(path.join(UI_ROOT, 'apple.css'), 'utf8');
  const renderSavedSource = indexHtml.match(
    /async function renderSaved\(\)\s*\{[\s\S]*?\r?\n\}\r?\n\r?\nasync function updateSavedRecord/
  );

  assert.ok(renderSavedSource, 'renderSaved source contract missing');
  assert.doesNotMatch(
    renderSavedSource[0],
    /\.innerHTML\s*=|insertAdjacentHTML\(/,
    'saved records must be rendered with DOM APIs rather than HTML parsing sinks'
  );
  const compatibilityRendererSource = indexHtml.match(
    /function renderCompatibilityDescription\([^)]*\)\s*\{[\s\S]*?\n\}/
  );
  assert.ok(compatibilityRendererSource, 'compatibility description DOM renderer is required');
  assert.match(compatibilityRendererSource[0], /\.textContent\s*=/);
  assert.match(compatibilityRendererSource[0], /document\.createTextNode\(/);
  assert.doesNotMatch(
    compatibilityRendererSource[0],
    /\.innerHTML\s*=|insertAdjacentHTML\(/,
    'imported names must never reach an HTML parsing sink in compatibility descriptions'
  );
  assert.doesNotMatch(
    indexHtml,
    /function genCompatText\(/,
    'the legacy name-interpolating compatibility HTML generator must not return'
  );
  assert.doesNotMatch(
    indexHtml,
    /data-id="\$\{(?:rec|r)\.id(?:\s*\|\|\s*['"]{2})?\}"/,
    'saved-record IDs must not be interpolated raw into downstream HTML attributes'
  );
  assert.match(indexHtml, /crypto\.randomUUID\(\)/, 'imported records must receive cryptographic UUIDs');
  assert.match(indexHtml, /function normalizeImportedRecord\(/, 'strict imported-record normalization is required');
  assert.doesNotMatch(indexHtml, /function jsonpFetch\(|psJsonpCounter|callback=['"]?\s*\+\s*cb/);
  assert.doesNotMatch(
    indexHtml,
    /createElement\(\s*['"]script['"]\s*\)[\s\S]{0,1200}(?:script\.src|appendChild\(script\))/,
    'person enrichment must not create executable third-party script elements'
  );
  assert.match(indexHtml, /const ALLOWED_ENRICHMENT_HOSTS\s*=\s*new Set/);
  assert.match(indexHtml, /function fetchAllowedJson\(/);
  assert.match(indexHtml, /취명선_전설의_만세력_백업_/);
  assert.doesNotMatch(indexHtml, /신의음성만세력_백업_/);
  if (HAS_ANDROID_PROJECT) {
    const stringsXml = fs.readFileSync(
      path.join(ANDROID_ROOT, 'app', 'src', 'main', 'res', 'values', 'strings.xml'),
      'utf8'
    );
    assert.match(stringsXml, /<string name="app_name">취명선 전설의 만세력<\/string>/);
    assert.match(stringsXml, /<string name="title_activity_main">취명선 전설의 만세력<\/string>/);
  }
  assert.match(
    appleCss,
    /\.result-right \.luck-title::before[\s\S]*\.sub-luck-label::before[\s\S]*content:\s*none\s*!important/,
    'flow-title sparkle pseudo-elements must be disabled by the final Apple layer'
  );
}

async function inspectFinalSecurityRuntime(page, width) {
  const state = await page.evaluate(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const listSavedKeys = async () => {
      const result = await window.storage.list('legend-saju:record:');
      return result && Array.isArray(result.keys) ? result.keys : [];
    };

    for (const key of await listSavedKeys()) await window.storage.delete(key);
    localStorage.removeItem('saju_list');

    const sample = {
      ...currentSaju,
      id: `unsafe"><img src=x onerror="window.__backupXssExecuted=1">`,
      name: `<img src=x onerror="window.__backupXssExecuted=2">`,
      memo: `<svg onload="window.__backupXssExecuted=3"></svg>`,
      fav: true,
      unexpected: 'must be removed'
    };
    const invalid = { ...sample, id: 'also-unsafe', gender: 'X' };
    window.__backupXssExecuted = 0;
    window.__lastImportAlert = '';
    window.alert = message => { window.__lastImportAlert = String(message); };

    document.querySelector('.tab[data-tab="saved"]').click();
    await renderSaved();
    const input = document.getElementById('savedImportFile');
    const file = new File(
      [JSON.stringify({ app: '취명선 전설의 만세력', version: 1, records: [sample, invalid] })],
      'malicious-backup.json',
      { type: 'application/json' }
    );
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    const deadline = Date.now() + 2500;
    let keys = [];
    while (Date.now() < deadline) {
      keys = await listSavedKeys();
      if (keys.length) break;
      await wait(25);
    }
    await wait(100);
    await renderSaved();
    await wait(50);

    keys = await listSavedKeys();
    const stored = keys[0] ? JSON.parse((await window.storage.get(keys[0])).value) : null;
    const cards = [...document.querySelectorAll('#savedContent .saved-card')];
    const importState = {
      xssExecuted: window.__backupXssExecuted,
      keys,
      stored,
      cardIds: cards.map(card => card.dataset.id),
      cardText: cards.map(card => card.textContent),
      executableNodes: document.querySelectorAll('#savedContent [onerror], #savedContent [onload], #savedContent script').length,
      alertText: window.__lastImportAlert
    };

    let blockedFetchCalls = 0;
    const originalFetch = window.fetch;
    window.fetch = async () => {
      blockedFetchCalls++;
      throw new Error('network should not be reached');
    };
    let disallowedHostRejected = false;
    let fetchApiType = typeof window.fetchAllowedJson;
    try {
      await window.fetchAllowedJson('https://evil.example.invalid/data.json', 50);
    } catch (error) {
      disallowedHostRejected = /허용되지 않은|allowlisted|allowed/i.test(String(error && error.message));
    }

    let scriptCreates = 0;
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = function (tagName, ...args) {
      if (String(tagName).toLowerCase() === 'script') scriptCreates++;
      return originalCreateElement(tagName, ...args);
    };
    try {
      await wikiQuery('generator=search&gsrsearch=test&gsrlimit=1');
    } catch (error) {
      // CORS/network failure must gracefully disable online enrichment.
    } finally {
      document.createElement = originalCreateElement;
      window.fetch = originalFetch;
    }

    for (const key of keys) await window.storage.delete(key);
    localStorage.removeItem('saju_list');
    document.body.classList.remove('dark');
    document.querySelector('.tab[data-tab="saved"]').click();
    await renderSaved();
    const savedEmpty = document.querySelector('.saved-empty');
    const savedHeading = savedEmpty.querySelector('h3');
    const savedContrast = {
      foreground: getComputedStyle(savedHeading).color,
      background: getComputedStyle(savedEmpty).backgroundColor,
      canvas: getComputedStyle(document.body).backgroundColor
    };

    document.querySelector('.tab[data-tab="fortune"]').click();
    renderFortune();
    await wait(40);
    const fortuneColors = [
      ...document.querySelectorAll('.f-score-num, .overall-card .ov-label, .overall-card .ov-grade')
    ].map(element => getComputedStyle(element).color);
    const iconBorders = [...document.querySelectorAll('.icon-btn')]
      .filter(element => element.getClientRects().length)
      .map(element => getComputedStyle(element).borderTopColor);

    document.querySelector('.tab[data-tab="result"]').click();
    renderResult();
    await wait(40);
    document.querySelector('#daeunScroll .luck-item')?.click();
    await wait(20);
    document.querySelector('#seunScroll .luck-item')?.click();
    await wait(20);
    const flowDecorations = [
      ...document.querySelectorAll('.result-right .luck-title, .sub-luck-label')
    ].map(element => getComputedStyle(element, '::before').content);

    return {
      importState,
      fetchSecurity: {
        fetchApiType,
        blockedFetchCalls,
        disallowedHostRejected,
        scriptCreates
      },
      savedContrast,
      fortuneColors,
      iconBorders,
      flowDecorations
    };
  });

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.equal(state.importState.xssExecuted, 0, `${width}px malicious backup executed script`);
  assert.equal(state.importState.executableNodes, 0, `${width}px imported markup became executable DOM`);
  assert.equal(state.importState.keys.length, 1, `${width}px invalid imported schemas must be rejected`);
  assert.ok(uuid.test(state.importState.stored.id), `${width}px imported id is not a UUID: ${state.importState.stored.id}`);
  assert.equal(state.importState.keys[0], `legend-saju:record:${state.importState.stored.id}`);
  assert.deepEqual(state.importState.cardIds, [state.importState.stored.id]);
  assert.match(state.importState.cardText[0], /<img src=x onerror=/, 'malicious display text must remain inert text');
  assert.equal(Object.hasOwn(state.importState.stored, 'unexpected'), false, 'unknown import fields must be dropped');
  assert.ok(state.importState.stored.name.length <= 40, 'imported name length limit');
  assert.ok(state.importState.stored.memo.length <= 240, 'imported memo length limit');
  assert.match(state.importState.alertText, /1개 가져왔습니다/);

  assert.equal(state.fetchSecurity.fetchApiType, 'function', 'allowlisted CORS fetch API missing');
  assert.equal(state.fetchSecurity.disallowedHostRejected, true, 'non-allowlisted enrichment host was not rejected');
  assert.equal(state.fetchSecurity.blockedFetchCalls, 1, 'only the allowlisted Wikipedia request may reach fetch');
  assert.equal(state.fetchSecurity.scriptCreates, 0, 'online enrichment created a dynamic script element');

  assert.ok(
    contrastRatio(
      state.savedContrast.foreground,
      state.savedContrast.background,
      state.savedContrast.canvas
    ) >= 4.5,
    `${width}px light saved-empty heading contrast is below 4.5:1`
  );
  const legacyGold = /rgb(?:a)?\(\s*(?:216\s*,\s*181\s*,\s*106|240\s*,\s*214\s*,\s*154|169\s*,\s*119\s*,\s*50)(?:\s*,[^)]*)?\)/i;
  for (const color of [...state.fortuneColors, ...state.iconBorders]) {
    assert.ok(!legacyGold.test(color), `${width}px visible legacy gold remains: ${color}`);
  }
  for (const content of state.flowDecorations) {
    assert.ok(content === 'none' || content === 'normal' || content === '""', `${width}px flow title sparkle remains: ${content}`);
  }
}

async function inspectCalendarCurrentYear(page, width) {
  if (!runsCalendarCurrentYear() || width !== 390) return;
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const state = await page.evaluate(async () => {
    const readTitle = () => {
      const title = document.getElementById('calTitle');
      const match = title.textContent.match(/(\d+)년\s+(\d+)월/);
      return {
        year: Number(match && match[1]),
        month: Number(match && match[2]),
        ariaCurrent: title.getAttribute('aria-current'),
        selectedClass: title.classList.contains('is-current-year'),
        badge: title.querySelector('.cal-current-year')?.textContent || null,
        color: getComputedStyle(title).color,
        background: getComputedStyle(title).backgroundColor
      };
    };

    window.__calendarNow = () => new Date(2034, 6, 15, 12, 0, 0);
    document.querySelector('.tab[data-tab="calendar"]').click();
    const initial = readTitle();
    for (let index = 0; index < 6; index++) document.getElementById('calNext').click();
    document.querySelector('.tab[data-tab="input"]').click();
    document.querySelector('.tab[data-tab="calendar"]').click();
    const reopened = readTitle();
    return {
      initializerType: typeof window.initializeCalendarSession,
      initial,
      reopened
    };
  });
  await page.emulateMediaFeatures([]);

  assert.equal(state.initializerType, 'function', `${width}px calendar session initializer missing`);
  assert.deepEqual(
    { year: state.initial.year, month: state.initial.month },
    { year: 2034, month: 7 },
    `${width}px first calendar opening must derive its local year and month from the injected clock`
  );
  assert.equal(state.initial.ariaCurrent, 'date', `${width}px current calendar year must expose aria-current`);
  assert.equal(state.initial.selectedClass, true, `${width}px current calendar year must be visibly selected`);
  assert.equal(state.initial.badge, '올해', `${width}px current calendar year badge`);
  assert.equal(state.initial.color, 'rgb(10, 132, 255)', `${width}px current calendar year must use system blue`);
  assert.notEqual(state.initial.background, 'rgba(0, 0, 0, 0)', `${width}px current calendar year selection needs a visible fill`);
  assert.deepEqual(
    { year: state.reopened.year, month: state.reopened.month },
    { year: 2035, month: 1 },
    `${width}px reopening the calendar in the same session must preserve user navigation`
  );
  assert.equal(state.reopened.ariaCurrent, null);
  assert.equal(state.reopened.selectedClass, false);
  assert.equal(state.reopened.badge, null);
}

async function inspectImportedFieldDownstreamSafety(page, width) {
  if (!runsImportedFieldXss() || width !== 390) return;
  const state = await page.evaluate(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const listKeys = async () => {
      const result = await window.storage.list('legend-saju:record:');
      return result && Array.isArray(result.keys) ? result.keys : [];
    };
    const attackerNodes = root => [
      ...root.querySelectorAll('img[src="x"], [onerror], [onload], script[data-attacker]')
    ].map(element => element.outerHTML);
    const snapshot = (name, root) => ({
      name,
      executed: window.__x,
      attackerNodes: attackerNodes(root),
      text: root.textContent
    });

    for (const key of await listKeys()) await window.storage.delete(key);
    localStorage.removeItem('saju_list');
    window.__x = 0;
    window.alert = () => {};
    const maliciousName = '홍길동<img src=x onerror=__x=1>';
    const maliciousMemo = '메모<svg onload=__x=2>';
    const record = {
      ...currentSaju,
      id: 'attacker-controlled-id',
      name: maliciousName,
      memo: maliciousMemo,
      fav: true
    };

    document.querySelector('.tab[data-tab="saved"]').click();
    await renderSaved();
    const input = document.getElementById('savedImportFile');
    const file = new File(
      [JSON.stringify({ app: '취명선 전설의 만세력', version: 1, records: [record] })],
      'downstream-xss.json',
      { type: 'application/json' }
    );
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const deadline = Date.now() + 2500;
    let keys = [];
    while (Date.now() < deadline) {
      keys = await listKeys();
      if (keys.length === 1) break;
      await wait(25);
    }
    await renderSaved();
    await wait(30);

    const snapshots = [snapshot('saved', document.getElementById('savedContent'))];
    document.querySelector('#savedContent .saved-card').click();
    await wait(40);
    snapshots.push(snapshot('result', document.getElementById('view-result')));

    document.querySelector('.tab[data-tab="fortune"]').click();
    renderFortune();
    await wait(40);
    snapshots.push(snapshot('fortune', document.getElementById('fortuneContent')));

    window.shareCard(currentSaju);
    await wait(60);
    snapshots.push(snapshot('share', document.getElementById('shareCardModal')));
    window.closeShareCardModal();
    await wait(230);

    await findSimilarSaju();
    await wait(60);
    snapshots.push(snapshot('similar', document.getElementById('similarModal')));
    window.closeAppModal(document.getElementById('similarModal'));
    await wait(230);

    document.querySelector('.tab[data-tab="match"]').click();
    await wait(30);
    document.querySelector('.match-slot.a').click();
    await wait(30);
    document.querySelector('#matchPickerBody .pick-item').click();
    await wait(240);
    document.querySelector('.match-slot.b').click();
    await wait(30);
    document.querySelector('#matchPickerBody .pick-item').click();
    await wait(240);
    snapshots.push(snapshot('match', document.getElementById('matchContent')));

    const finalNameText = document.querySelector('#matchContent .mt-text')?.textContent || '';
    for (const key of await listKeys()) await window.storage.delete(key);
    localStorage.removeItem('saju_list');
    return {
      maliciousName,
      snapshots,
      finalNameText,
      finalExecuted: window.__x
    };
  });

  for (const snapshot of state.snapshots) {
    assert.equal(snapshot.executed, 0, `${width}px imported name executed in ${snapshot.name}`);
    assert.deepEqual(snapshot.attackerNodes, [], `${width}px attacker node reached ${snapshot.name}`);
  }
  assert.equal(state.finalExecuted, 0, `${width}px imported name executed during compatibility calculation`);
  assert.match(state.finalNameText, /홍길동/, 'legitimate Korean name characters must be preserved');
  assert.match(state.finalNameText, /<img src=x onerror=/, 'malicious markup must remain inert visible text');
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
    [/\$env:SKIP_SOURCE_CONTRACTS\s*=\s*['"]1['"]/, 'protected regression must explicitly skip only source-shape contracts'],
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
  assert.match(
    fs.readFileSync(versionedRunner, 'utf8'),
    /process\.env\.SKIP_SOURCE_CONTRACTS\s*!==\s*['"]1['"]\s*&&\s*runsGroup\(['"]final-security['"]\)/,
    'source-shape security contracts must remain enabled except for explicitly protected assets'
  );
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

async function inspectExactReleaseAssertions(page, width) {
  await activateDestination(page, 'legend');
  await sleep(80);
  const release = await page.evaluate(() => ({
    title: document.title,
    timeLayers: document.querySelectorAll('[data-time-layer]').length,
    hourBranches: document.querySelectorAll('[data-hour-branch]').length,
    selectedTabs: document.querySelectorAll('.tab[aria-selected="true"]').length,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth
  }));

  assert.equal(release.title, '취명선 전설의 만세력');
  assert.equal(release.timeLayers, 8, `${width}px release time-layer count`);
  assert.equal(release.hourBranches, 12, `${width}px release hour-branch count`);
  assert.equal(release.selectedTabs, 1, `${width}px release selected-tab count`);
  assert.ok(
    release.documentWidth <= release.viewportWidth + 1,
    `${width}px release document overflows by ${release.documentWidth - release.viewportWidth}px`
  );
}

async function inspectLunarMonthInput(page, width) {
  await activateDestination(page, 'input');
  await page.click('#segCal [data-val="solar"]');
  const solarState = await page.evaluate(() => {
    const field = document.getElementById('lunarMonthTypeField');
    return {
      hidden: field.hidden,
      disabled: [...field.querySelectorAll('button')].map(button => button.disabled)
    };
  });
  assert.deepEqual(solarState, { hidden: true, disabled: [true, true] });

  await page.click('#segCal [data-val="lunar"]');
  await page.focus('#segLeapMonth [data-val="normal"]');
  await page.keyboard.press('ArrowRight');
  const lunarState = await page.evaluate(() => {
    const field = document.getElementById('lunarMonthTypeField');
    const group = document.getElementById('segLeapMonth');
    return {
      hidden: field.hidden,
      role: group.getAttribute('role'),
      selected: group.querySelector('[aria-checked="true"]')?.dataset.val,
      buttons: [...group.querySelectorAll('button')].map(button => {
        const rect = button.getBoundingClientRect();
        return {
          role: button.getAttribute('role'),
          disabled: button.disabled,
          width: rect.width,
          height: rect.height
        };
      })
    };
  });
  assert.equal(lunarState.hidden, false);
  assert.equal(lunarState.role, 'radiogroup');
  assert.equal(lunarState.selected, 'leap');
  for (const button of lunarState.buttons) {
    assert.equal(button.role, 'radio');
    assert.equal(button.disabled, false);
    assert.ok(button.width >= 44, `${width}px lunar month button width ${button.width}`);
    assert.ok(button.height >= 44, `${width}px lunar month button height ${button.height}`);
  }

  await page.evaluate(() => {
    document.getElementById('inputName').value = '윤달fixture';
    document.getElementById('inBirth').value = '20230201';
    document.getElementById('inTime').value = '1200';
    document.getElementById('calcBtn').click();
  });
  await sleep(400);
  const calculated = await page.evaluate(() => ({
    calendar: currentSaju?.calendar,
    isLeapMonth: currentSaju?.isLeapMonth,
    lunar: currentSaju?.lunar,
    solar: [currentSaju?.year, currentSaju?.month, currentSaju?.day]
  }));
  assert.deepEqual(calculated, {
    calendar: 'lunar',
    isLeapMonth: true,
    lunar: { y: 2023, m: 2, d: 1, isLeap: true },
    solar: [2023, 3, 22]
  });

  await page.$eval('#saveBtn', button => button.click());
  await page.$eval('#saveName', input => { input.value = '윤달 저장'; });
  await page.$eval('#saveConfirm', button => button.click());
  await sleep(150);
  const persistence = await page.evaluate(async () => {
    const records = await recordStore.listRecords();
    window.activateLegendDestination('saved');
    await renderSaved();
    window.__lunarExportBlob = null;
    URL.createObjectURL = blob => {
      window.__lunarExportBlob = blob;
      return 'blob:lunar-export';
    };
    HTMLAnchorElement.prototype.click = function () {};
    document.getElementById('savedExportBtn').click();
    const payload = JSON.parse(await window.__lunarExportBlob.text());
    const keys = (await window.storage.list('legend-saju:record:')).keys;
    for (const key of keys) await window.storage.delete(key);
    return {
      saved: records.map(record => ({
        calendar: record.calendar,
        isLeapMonth: record.isLeapMonth,
        lunar: record.lunar
      })),
      exported: payload.records.map(record => ({
        calendar: record.calendar,
        isLeapMonth: record.isLeapMonth,
        lunar: record.lunar
      }))
    };
  });
  assert.deepEqual(persistence.saved, [{
    calendar: 'lunar',
    isLeapMonth: true,
    lunar: { y: 2023, m: 2, d: 1, isLeap: true }
  }]);
  assert.deepEqual(persistence.exported, persistence.saved);

  await activateDestination(page, 'input');
  await page.$eval('#segCal [data-val="solar"]', button => button.click());
  const hiddenAgain = await page.evaluate(() => ({
    hidden: document.getElementById('lunarMonthTypeField').hidden,
    disabled: [...document.querySelectorAll('#segLeapMonth button')].every(button => button.disabled)
  }));
  assert.deepEqual(hiddenAgain, { hidden: true, disabled: true });

  await page.$eval('#segCal [data-val="lunar"]', button => button.click());
  await page.$eval('#segLeapMonth [data-val="leap"]', button => button.click());
  await page.evaluate(() => {
    document.getElementById('inBirth').value = '20240201';
    document.getElementById('inTime').value = '1200';
    document.getElementById('calcBtn').click();
  });
  await sleep(100);
  const invalidLeap = await page.evaluate(() => ({
    message: document.getElementById('inErr').textContent.trim(),
    inputActive: document.getElementById('view-input').classList.contains('active')
  }));
  assert.match(invalidLeap.message, /2024년에는 윤2월이 존재하지 않습니다/);
  assert.equal(invalidLeap.inputActive, true);
}

async function inspectLegacyBackupImport(page) {
  const state = await page.evaluate(async () => {
    const existing = (await window.storage.list('legend-saju:record:')).keys;
    for (const key of existing) await window.storage.delete(key);
    const sample = {
      id: 'legacy-id',
      name: '구 백업',
      year: 1989,
      month: 3,
      day: 19,
      hour: 14,
      minute: 30,
      gender: 'M',
      unknown: false,
      memo: '정규화',
      fav: true,
      savedAt: 1700000000000,
      unexpected: '<script>must be dropped</script>'
    };
    const arrayResult = await importSavedRecords(normalizeImportedBackup([sample]));
    const objectResult = await importSavedRecords(normalizeImportedBackup({
      app: '취명선 만세력',
      version: 1,
      records: [{ ...sample, id: 'legacy-object', name: '구 객체 백업' }]
    }));
    const historicalResult = await importSavedRecords(normalizeImportedBackup({
      app: '신의 음성 만세력',
      version: 1,
      records: [{ ...sample, id: 'historical-object', name: '실제 구형 백업' }]
    }));
    const malformedResult = await importSavedRecords(normalizeImportedBackup({
      app: '취명선 만세력',
      version: 1,
      records: [{ ...sample, gender: 'X' }]
    }));
    const rejected = [];
    for (const payload of [
      { app: 'untrusted-product', version: 1, records: [sample] },
      { app: '신의음성만세력', version: 1, records: [sample] },
      { app: '취명선 만세력', records: [sample] },
      { app: '취명선 만세력', version: 1, records: 'not-an-array' }
    ]) {
      try {
        normalizeImportedBackup(payload);
      } catch (error) {
        rejected.push(error.message);
      }
    }
    const records = await recordStore.listRecords();
    const keys = (await window.storage.list('legend-saju:record:')).keys;
    for (const key of keys) await window.storage.delete(key);
    return {
      arrayResult,
      objectResult,
      historicalResult,
      malformedResult,
      rejected,
      keys,
      records: records.map(record => ({
        id: record.id,
        name: record.name,
        unexpected: record.unexpected,
        calculationMode: record.calculationMode
      }))
    };
  });

  assert.deepEqual(state.arrayResult, { added: 1, skipped: 0 });
  assert.deepEqual(state.objectResult, { added: 1, skipped: 0 });
  assert.deepEqual(state.historicalResult, { added: 1, skipped: 0 });
  assert.deepEqual(state.malformedResult, { added: 0, skipped: 1 });
  assert.equal(state.rejected.length, 4);
  assert.ok(state.rejected.every(message => /지원하지 않는 백업/.test(message)));
  assert.equal(state.keys.length, 3);
  assert.ok(state.keys.every(key => key.startsWith('legend-saju:record:')));
  assert.equal(state.records.length, 3);
  assert.ok(state.records.every(record => (
    record.id !== 'legacy-id' &&
    record.id !== 'legacy-object' &&
    record.id !== 'historical-object'
  )));
  assert.ok(state.records.every(record => record.unexpected === undefined));
  assert.ok(state.records.every(record => record.calculationMode));
}

async function inspectLegendFlow(page, width) {
  await page.evaluate(() => {
    document.getElementById('inputName').value = '전설<img src=x onerror="window.__legendXss=1">';
    document.getElementById('inBirth').value = '19921024';
    document.getElementById('inTime').value = '0530';
    document.getElementById('calcBtn').click();
  });
  await sleep(500);
  await activateDestination(page, 'legend');
  await sleep(100);

  const state = await page.evaluate(() => ({
    hero: document.querySelector('[data-legend-hero]')?.textContent,
    layers: [...document.querySelectorAll('[data-time-layer]')]
      .map(node => node.getAttribute('data-time-layer')),
    hourlyCount: document.querySelectorAll('[data-hour-branch]').length,
    evidenceButtons: document.querySelectorAll('[data-legend-evidence]').length,
    interpretationGroups: [...document.querySelectorAll('[data-legend-story-group]')]
      .map(node => node.getAttribute('data-legend-story-group')),
    storyCount: document.querySelectorAll('[data-legend-story]').length,
    storySources: [...new Set(
      [...document.querySelectorAll('[data-legend-story-source]')]
        .map(node => node.getAttribute('data-legend-story-source'))
    )],
    interpretationText: document.querySelector('.legend-narrative')?.textContent,
    highlights: document.querySelectorAll('.legend-highlight').length,
    highlightsBeforeTimeline: Boolean(
      document.querySelector('.legend-highlights')?.compareDocumentPosition(
        document.querySelector('.legend-timeline')
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ),
    narrativeAfterTimeline: Boolean(
      document.querySelector('.legend-timeline')?.compareDocumentPosition(
        document.querySelector('.legend-narrative')
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ),
    timelineDisclosureExists: Boolean(document.getElementById('legendTimelineDetails')),
    layerReadings: [...document.querySelectorAll('[data-layer-reading]')]
      .map(node => node.textContent.trim()),
    horizontalOverflow: document.querySelector('.legend-shell')?.scrollWidth
      > document.querySelector('.legend-shell')?.clientWidth + 1,
    unsafeElementCount: document.querySelectorAll('#legendContent img').length,
    xss: window.__legendXss || 0,
    hourlyApi: typeof window.getHourlyFortunes
  }));
  assert.match(state.hero, /시대/);
  assert.deepEqual(
    state.layers,
    ['cycle', 'yun', 'natal', 'daeun', 'seun', 'month', 'day', 'hour'],
    `${width}px legend time layers`
  );
  assert.equal(state.hourlyCount, 12, `${width}px hourly fortune count`);
  assert.ok(state.evidenceButtons >= 1, `${width}px legend evidence trigger`);
  assert.deepEqual(state.interpretationGroups, [
    '명식의 뼈대',
    '시간의 작용',
    '삶의 주제'
  ]);
  assert.equal(state.storyCount, 17, `${width}px rich interpretation count`);
  assert.deepEqual(state.storySources, ['명리 계산', '간이 해석', '전통 표지', '창작 공명']);
  assert.match(state.interpretationText, /오행의 균형/);
  assert.match(state.interpretationText, /십신의 언어/);
  assert.match(state.interpretationText, /합과 충의 구조/);
  assert.match(state.interpretationText, /신살과 공망/);
  assert.match(state.interpretationText, /대운의 계절/);
  assert.match(state.interpretationText, /일운의 선택/);
  assert.equal(state.highlights, 3, `${width}px interpretation highlights`);
  assert.equal(state.highlightsBeforeTimeline, true, `${width}px core interpretation must appear before the time flow`);
  assert.equal(state.narrativeAfterTimeline, true, `${width}px detailed chapters must follow the interpreted time flow`);
  assert.equal(state.timelineDisclosureExists, false, `${width}px interpreted time flow must be visible by default`);
  assert.equal(state.layerReadings.length, 8, `${width}px every time layer needs an interpretation`);
  assert.ok(
    state.layerReadings.every(reading => reading.length >= 35),
    `${width}px time-layer interpretation is too short`
  );
  assert.equal(state.horizontalOverflow, false, `${width}px legend interpretation overflow`);
  assert.equal(state.unsafeElementCount, 0, `${width}px user name must remain plain text`);
  assert.equal(state.xss, 0, `${width}px user name executed markup`);
  assert.equal(state.hourlyApi, 'function', `${width}px hourly fortune API`);

  await activateDestination(page, 'result');
  await page.$eval('#seunScroll .luck-item', element => element.click());
  await sleep(60);
  await page.$eval('#woonScroll .luck-item', element => element.click());
  await sleep(60);
  await page.$eval('#dayArea [data-legend-day="18"]', element => element.click());
  const selectedDay = await page.evaluate(() => {
    const selected = document.querySelector('#dayArea [data-legend-day="18"]');
    const style = getComputedStyle(selected);
    const before = getComputedStyle(selected, '::before');
    const after = getComputedStyle(selected, '::after');
    const selectedRect = selected.getBoundingClientRect();
    const number = value => Number.parseFloat(value) || 0;
    const pseudoRect = pseudo => {
      if (pseudo.content === 'none' || pseudo.display === 'none') return null;
      const width = number(pseudo.width) + number(pseudo.borderLeftWidth) + number(pseudo.borderRightWidth);
      const height = number(pseudo.height) + number(pseudo.borderTopWidth) + number(pseudo.borderBottomWidth);
      const left = selectedRect.left + number(pseudo.left);
      const top = selectedRect.top + number(pseudo.top);
      return { left, right: left + width, top, bottom: top + height };
    };
    const cueRects = [
      { name: 'before', rect: pseudoRect(before) },
      { name: 'after', rect: pseudoRect(after) }
    ].filter(cue => cue.rect);
    const inset = number(style.getPropertyValue('--selected-day-inset'));
    if (inset > 0) {
      cueRects.push(
        { name: 'inset-top', rect: { left: selectedRect.left, right: selectedRect.right, top: selectedRect.top, bottom: selectedRect.top + inset } },
        { name: 'inset-right', rect: { left: selectedRect.right - inset, right: selectedRect.right, top: selectedRect.top, bottom: selectedRect.bottom } },
        { name: 'inset-bottom', rect: { left: selectedRect.left, right: selectedRect.right, top: selectedRect.bottom - inset, bottom: selectedRect.bottom } },
        { name: 'inset-left', rect: { left: selectedRect.left, right: selectedRect.left + inset, top: selectedRect.top, bottom: selectedRect.bottom } }
      );
    }
    const textNodes = [...selected.querySelectorAll('.d-num, .d-s, .d-b, .d-kor-t, .d-kor')];
    const intersections = [];
    textNodes.forEach(node => {
      const textRect = node.getBoundingClientRect();
      cueRects.forEach(cue => {
        const overlapWidth = Math.max(0, Math.min(cue.rect.right, textRect.right) - Math.max(cue.rect.left, textRect.left));
        const overlapHeight = Math.max(0, Math.min(cue.rect.bottom, textRect.bottom) - Math.max(cue.rect.top, textRect.top));
        if (overlapWidth * overlapHeight > 0) {
          intersections.push({ text: node.className, cue: cue.name, area: overlapWidth * overlapHeight });
        }
      });
    });
    const rgb = value => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const luminance = value => {
      const [red, green, blue] = rgb(value).map(channel => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const foreground = luminance(style.outlineColor);
    const background = luminance(style.backgroundColor);
    const contrast = (Math.max(foreground, background) + 0.05)
      / (Math.min(foreground, background) + 0.05);
    return {
      ariaPressed: selected.getAttribute('aria-pressed'),
      outlineStyle: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth),
      boxShadow: style.boxShadow,
      transform: style.transform,
      beforeContent: before.content,
      afterContent: after.content,
      textCount: textNodes.length,
      intersections,
      contrast
    };
  });
  assert.equal(selectedDay.ariaPressed, 'true', `${width}px selected day aria state`);
  assert.equal(selectedDay.outlineStyle, 'solid', `${width}px selected day outline cue`);
  assert.ok(selectedDay.outlineWidth >= 2, `${width}px selected day outline width`);
  assert.ok(selectedDay.textCount >= 5, `${width}px selected day text descendants`);
  assert.deepEqual(selectedDay.intersections, [], `${width}px selected cue intersects text`);
  assert.notEqual(selectedDay.boxShadow, 'none', `${width}px selected day double boundary`);
  assert.notEqual(selectedDay.transform, 'none', `${width}px selected day persistent shape cue`);
  assert.equal(selectedDay.beforeContent, 'none', `${width}px selected day before overlay`);
  assert.equal(selectedDay.afterContent, 'none', `${width}px selected day after overlay`);
  assert.ok(selectedDay.contrast >= 3, `${width}px selected day outline contrast ${selectedDay.contrast}`);

  await activateDestination(page, 'legend');
  const ownership = await page.evaluate(() => {
    const trigger = document.querySelector('[data-legend-evidence]');
    const dialog = document.querySelector('[data-legend-evidence-dialog]');
    return {
      controlledId: trigger?.getAttribute('aria-controls'),
      dialogId: dialog?.id,
      titleId: dialog?.querySelector('h2')?.id
    };
  });
  assert.ok(ownership.dialogId, `${width}px evidence dialog id`);
  assert.equal(ownership.controlledId, ownership.dialogId, `${width}px evidence dialog ownership`);
  assert.notEqual(ownership.controlledId, ownership.titleId, `${width}px evidence trigger must not control the title`);

  await page.click('[data-legend-evidence]');
  const evidence = await page.evaluate(() => ({
    open: document.querySelector('[data-legend-evidence-dialog]')?.open,
    partCount: document.querySelectorAll('[data-legend-evidence-part]').length
  }));
  assert.equal(evidence.open, true, `${width}px evidence dialog must open`);
  assert.equal(evidence.partCount, 5, `${width}px evidence score part count`);

  await page.evaluate(() => {
    document.querySelector('[data-legend-evidence-dialog]')?.close();
    document.querySelector('.tab[data-tab="input"]').click();
    document.getElementById('inTime').value = '';
    document.getElementById('calcBtn').click();
  });
  await sleep(500);
  await activateDestination(page, 'legend');
  await sleep(100);
  const unknownTime = await page.evaluate(() => ({
    natal: document.querySelector('[data-time-layer="natal"]')?.textContent,
    hourlyCount: document.querySelectorAll('[data-hour-branch]').length
  }));
  assert.match(unknownTime.natal, /시각 미상/);
  assert.equal(unknownTime.hourlyCount, 12, `${width}px unknown natal time hourly choices`);
}

async function inspectLegendAccessibility(page, width) {
  await page.evaluate(() => {
    document.body.classList.remove('dark');
    document.getElementById('inputName').value = '???';
    document.getElementById('inBirth').value = '19921024';
    document.getElementById('inTime').value = '0530';
    document.getElementById('calcBtn').click();
  });
  await sleep(500);
  await activateDestination(page, 'legend');
  await sleep(100);

  const inspectTheme = async dark => page.evaluate(isDark => {
    document.body.classList.toggle('dark', isDark);
    const parse = value => {
      if (/^#[0-9a-f]{6}$/i.test(value)) {
        return [
          Number.parseInt(value.slice(1, 3), 16),
          Number.parseInt(value.slice(3, 5), 16),
          Number.parseInt(value.slice(5, 7), 16)
        ];
      }
      return (value.match(/[\d.]+/g) || []).map(Number);
    };
    const luminance = value => {
      const [red, green, blue] = parse(value).slice(0, 3).map(channel => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const contrast = (foreground, background) => {
      const first = luminance(foreground);
      const second = luminance(background);
      return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
    };
    const rootStyle = getComputedStyle(document.documentElement);
    const backgrounds = [
      rootStyle.getPropertyValue('--paper').trim(),
      rootStyle.getPropertyValue('--paper-bright').trim()
    ];
    const selectors = [
      '.legend-layer-detail',
      '.legend-hour-time',
      '.legend-hour-sipsin',
      '.legend-story-body',
      '.legend-dialog-intro',
      '.legend-evidence-part p'
    ];
    return {
      heroTitle: document.querySelector('[data-legend-hero] h2')?.textContent,
      contrast: selectors.map(selector => {
        const color = getComputedStyle(document.querySelector(selector)).color;
        return {
          selector,
          color,
          ratios: backgrounds.map(background => contrast(color, background))
        };
      })
    };
  }, dark);

  for (const dark of [false, true]) {
    const state = await inspectTheme(dark);
    assert.equal(state.heroTitle, '빛의 시대에 선 당신', `${width}px normalized hero name`);
    for (const sample of state.contrast) {
      for (const ratio of sample.ratios) {
        assert.ok(
          ratio >= 4.5,
          `${width}px ${dark ? 'dark' : 'light'} ${sample.selector} contrast ${ratio}`
        );
      }
    }
  }

  const client = await page.target().createCDPSession();
  await client.send('Emulation.setEmulatedMedia', {
    media: '',
    features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }]
  });
  const reducedTransparency = await page.evaluate(() => {
    const alpha = value => {
      const values = value.match(/[\d.]+/g) || [];
      return values.length < 4 ? 1 : Number(values[3]);
    };
    const selectors = [
      '.legend-score',
      '.legend-layer',
      '.legend-story',
      '.legend-evidence-dialog'
    ];
    return selectors.map(selector => {
      const style = getComputedStyle(document.querySelector(selector));
      return {
        selector,
        alpha: alpha(style.backgroundColor),
        backdropFilter: style.backdropFilter || style.webkitBackdropFilter
      };
    });
  });
  for (const surface of reducedTransparency) {
    assert.equal(surface.alpha, 1, `${width}px ${surface.selector} must be opaque`);
  }
  const dialog = reducedTransparency.find(surface => surface.selector === '.legend-evidence-dialog');
  assert.equal(dialog.backdropFilter, 'none', `${width}px dialog blur must be removed`);
}

async function inspectLegendNavigation(page, width) {
  await page.evaluate(() => {
    document.body.classList.remove('dark');
    document.getElementById('inputName').value = '길잡이';
    document.getElementById('inBirth').value = '19921024';
    document.getElementById('inTime').value = '0530';
    document.getElementById('calcBtn').click();
  });
  await sleep(500);

  const source = await page.evaluate(() => ({
    activate: typeof window.activateLegendDestination,
    evidence: typeof window.openLegendEvidence,
    primary: [...document.querySelectorAll('[data-legend-primary-nav]')]
      .map(node => node.dataset.tab),
    more: [...document.querySelectorAll('[data-legend-more-nav]')]
      .map(node => node.dataset.tab),
    secondary: [...document.querySelectorAll('[data-legend-secondary-nav]')]
      .map(node => ({ tab: node.dataset.tab, role: node.getAttribute('role') })),
    targets: [...document.querySelectorAll('[data-legend-primary-nav]')].map(node => ({
      tab: node.dataset.tab,
      height: node.getBoundingClientRect().height,
      controls: node.getAttribute('aria-controls')
    })),
    primaryDisplay: document.getElementById('legendMobileNav')
      ? getComputedStyle(document.getElementById('legendMobileNav')).display
      : null,
    topDisplay: getComputedStyle(document.querySelector('.tabs')).display
  }));
  assert.equal(source.activate, 'function');
  assert.equal(source.evidence, 'function');
  assert.deepEqual(source.primary, ['input', 'result', 'legend', 'calendar', 'saved']);
  assert.deepEqual(source.more, ['match', 'about']);
  assert.deepEqual(source.secondary, [{ tab: 'fortune', role: 'menuitem' }]);
  source.targets.forEach(target => {
    assert.equal(target.controls, `view-${target.tab}`);
    if (width < 768) assert.ok(target.height >= 44, `${target.tab} mobile target is ${target.height}px`);
  });
  assert.equal(source.primaryDisplay === 'none', width >= 768, `${width}px mobile navigation visibility`);
  assert.equal(source.topDisplay === 'none', width < 768, `${width}px desktop tab visibility`);

  await page.evaluate(() => window.activateLegendDestination('legend'));
  await sleep(100);
  const synchronized = await page.evaluate(() => ({
    top: document.querySelector('.tab.active')?.dataset.tab,
    topSelected: document.querySelector('.tab[data-tab="legend"]')?.getAttribute('aria-selected'),
    bottom: document.querySelector('[data-legend-primary-nav][aria-current="page"]')?.dataset.tab,
    panel: document.querySelector('.view.active')?.id,
    hidden: document.getElementById('view-legend')?.hidden
  }));
  assert.deepEqual(synchronized, {
    top: 'legend',
    topSelected: 'true',
    bottom: 'legend',
    panel: 'view-legend',
    hidden: false
  });

  if (width >= 768) {
    await page.focus('.tab[data-tab="legend"]');
    await page.keyboard.press('ArrowRight');
    const keyboardTab = await page.evaluate(() => ({
      active: document.querySelector('.tab.active')?.dataset.tab,
      focused: document.activeElement?.dataset?.tab
    }));
    assert.deepEqual(keyboardTab, { active: 'fortune', focused: 'fortune' });
  } else {
    await page.focus('[data-legend-primary-nav][data-tab="calendar"]');
    await page.keyboard.press('Enter');
    assert.equal(
      await page.evaluate(() => document.querySelector('.tab.active')?.dataset.tab),
      'calendar',
      'mobile destination must activate from the keyboard'
    );
  }
  await page.evaluate(() => window.activateLegendDestination('legend'));

  const moreButton = '#legendMoreButton';
  await page.click(moreButton);
  const menuOpen = await page.evaluate(() => {
    const button = document.getElementById('legendMoreButton');
    const menu = document.getElementById('legendMoreMenu');
    const trigger = button.getBoundingClientRect();
    const panel = menu.getBoundingClientRect();
    return {
      expanded: button.getAttribute('aria-expanded'),
      hidden: menu.hidden,
      role: menu.getAttribute('role'),
      focused: document.activeElement?.dataset?.tab,
      anchored: panel.right <= innerWidth + 1
        && panel.top >= trigger.bottom - 2
        && Math.abs(panel.right - trigger.right) <= 24
    };
  });
  assert.deepEqual(menuOpen, {
    expanded: 'true',
    hidden: false,
    role: 'menu',
    focused: 'fortune',
    anchored: true
  });
  await page.keyboard.press('Escape');
  await sleep(180);
  const menuClosed = await page.evaluate(() => ({
    expanded: document.getElementById('legendMoreButton').getAttribute('aria-expanded'),
    hidden: document.getElementById('legendMoreMenu').hidden,
    focus: document.activeElement?.id
  }));
  assert.deepEqual(menuClosed, { expanded: 'false', hidden: true, focus: 'legendMoreButton' });

  await page.click(moreButton);
  await page.focus('[data-legend-more-nav][data-tab="match"]');
  await page.keyboard.press('Enter');
  await sleep(100);
  const matchDestination = await page.evaluate(() => ({
    active: document.querySelector('.tab.active')?.dataset.tab,
    current: document.getElementById('legendMoreButton')?.getAttribute('aria-current'),
    focused: document.activeElement?.id || document.activeElement?.dataset?.tab || ''
  }));
  assert.deepEqual(matchDestination, {
    active: 'match',
    current: 'page',
    focused: width < 768 ? 'legendMoreButton' : 'tab-match'
  }, `${width}px more-menu match destination`);

  await page.click(moreButton);
  await page.focus('[data-legend-secondary-nav][data-tab="fortune"]');
  await page.keyboard.press('Enter');
  await sleep(100);
  const fortuneDestination = await page.evaluate(() => ({
    active: document.querySelector('.tab.active')?.dataset.tab,
    current: document.getElementById('legendMoreButton')?.getAttribute('aria-current'),
    focused: document.activeElement?.id || document.activeElement?.dataset?.tab || ''
  }));
  assert.deepEqual(fortuneDestination, {
    active: 'fortune',
    current: 'page',
    focused: width < 768 ? 'legendMoreButton' : 'tab-fortune'
  }, `${width}px mobile fortune destination`);
  await page.evaluate(() => window.activateLegendDestination('legend'));

  const evidenceTrigger = '[data-legend-evidence]';
  await page.focus(evidenceTrigger);
  await page.keyboard.press('Enter');
  await sleep(80);
  const dialog = await page.evaluate(() => {
    const modal = document.getElementById('legendEvidenceModal');
    const focusables = [...modal.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
    return {
      open: modal.open,
      role: modal.getAttribute('role'),
      modal: modal.getAttribute('aria-modal'),
      labelledBy: modal.getAttribute('aria-labelledby'),
      activeInside: modal.contains(document.activeElement),
      first: focusables[0]?.className,
      last: focusables.at(-1)?.className
    };
  });
  assert.deepEqual(dialog, {
    open: true,
    role: 'dialog',
    modal: 'true',
    labelledBy: 'legendEvidenceTitle',
    activeInside: true,
    first: 'legend-dialog-close',
    last: 'legend-dialog-close'
  });
  await page.keyboard.press('Tab');
  assert.equal(
    await page.evaluate(() => document.activeElement?.classList.contains('legend-dialog-close')),
    true,
    `${width}px evidence focus must wrap`
  );
  await page.keyboard.press('Escape');
  await sleep(80);
  const restored = await page.evaluate(() => ({
    open: document.getElementById('legendEvidenceModal').open,
    focus: document.activeElement?.hasAttribute('data-legend-evidence')
  }));
  assert.deepEqual(restored, { open: false, focus: true });

  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.handleAppBack()), true);
  await sleep(80);
  const evidenceBack = await page.evaluate(() => ({
    open: document.getElementById('legendEvidenceModal').open,
    active: document.querySelector('.tab.active')?.dataset.tab
  }));
  assert.deepEqual(evidenceBack, { open: false, active: 'legend' });

  await page.click(moreButton);
  assert.equal(await page.evaluate(() => window.handleAppBack()), true);
  await sleep(180);
  const menuBack = await page.evaluate(() => ({
    hidden: document.getElementById('legendMoreMenu').hidden,
    active: document.querySelector('.tab.active')?.dataset.tab
  }));
  assert.deepEqual(menuBack, { hidden: true, active: 'legend' });

  await page.click(moreButton);
  await page.focus('[data-legend-more-nav][data-tab="about"]');
  await page.keyboard.press('Enter');
  assert.equal(
    await page.evaluate(() => document.getElementById('aboutModal').classList.contains('active')),
    true,
    `${width}px about form overlay opens from more`
  );
  assert.equal(await page.evaluate(() => window.handleAppBack()), true);
  await sleep(360);
  assert.equal(
    await page.evaluate(() => document.getElementById('aboutModal').classList.contains('active')),
    false,
    `${width}px back closes an existing form overlay`
  );

  await page.evaluate(() => {
    window.activateLegendDestination('result');
    window.shareCard(window.getCurrentSaju());
  });
  assert.equal(await page.evaluate(() => window.handleAppBack()), true);
  await sleep(260);
  const shareBack = await page.evaluate(() => ({
    open: !!document.getElementById('shareCardModal'),
    active: document.querySelector('.tab.active')?.dataset.tab
  }));
  assert.deepEqual(shareBack, { open: false, active: 'result' });

  await page.evaluate(() => {
    window.activateLegendDestination('legend');
    window.activateLegendDestination('calendar');
    window.activateLegendDestination('saved');
  });
  assert.equal(await page.evaluate(() => window.handleAppBack()), true);
  assert.equal(
    await page.evaluate(() => document.querySelector('.tab.active')?.dataset.tab),
    'calendar',
    `${width}px back must restore the previous destination`
  );

  const overflow = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyX: document.body.scrollWidth - document.body.clientWidth
  }));
  assert.ok(overflow.x <= 1, `${width}px document overflow ${overflow.x}px`);
  assert.ok(overflow.bodyX <= 1, `${width}px body overflow ${overflow.bodyX}px`);

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.click(moreButton);
  const reducedFrames = await page.evaluate(() => (
    document.getElementById('legendMoreMenu').getAnimations()
      .flatMap(animation => animation.effect?.getKeyframes() || [])
      .map(frame => frame.transform || 'none')
  ));
  assert.ok(reducedFrames.length >= 2, `${width}px reduced-motion menu frames`);
  assert.equal(new Set(reducedFrames).size, 1, `${width}px reduced-motion menu must not move`);
  await page.keyboard.press('Escape');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
}

async function inspectLegendHome(page, width) {
  const initial = await page.evaluate(() => {
    const era = window.LegendEra.getLegendEra(new Date().getFullYear());
    const landing = document.getElementById('legendLanding');
    return {
      selectedTab: document.querySelector('.tab.active')?.dataset.tab,
      selectedMobile: document.querySelector('[data-legend-primary-nav][aria-current="page"]')?.dataset.tab,
      activePanel: document.querySelector('.view.active')?.id,
      hasLanding: Boolean(landing),
      hasEra: document.getElementById('legendEraPeriod')?.textContent.includes(String(era.yun)) || false,
      hasOpenButton: Boolean(document.getElementById('legendStartButton')),
      hasPersonButton: Boolean(document.getElementById('legendPersonButton')),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      currentEra: {
        yuan: era.yuan,
        yun: era.yun,
        yunStart: era.yunStart,
        yunEnd: era.yunEnd,
        element: era.element
      },
      visibleEra: landing?.textContent.replace(/\s+/g, ' ').trim() || ''
    };
  });

  assert.deepEqual(
    {
      selectedTab: initial.selectedTab,
      selectedMobile: initial.selectedMobile,
      activePanel: initial.activePanel,
      hasLanding: initial.hasLanding,
      hasEra: initial.hasEra,
      hasOpenButton: initial.hasOpenButton,
      hasPersonButton: initial.hasPersonButton
    },
    {
      selectedTab: 'legend',
      selectedMobile: 'legend',
      activePanel: 'view-legend',
      hasLanding: true,
      hasEra: true,
      hasOpenButton: true,
      hasPersonButton: true
    }
  );
  assert.ok(initial.overflow <= 1, `${width}px legend home overflows by ${initial.overflow}px`);
  assert.match(initial.visibleEra, new RegExp(initial.currentEra.yuan));
  assert.match(initial.visibleEra, new RegExp(`${initial.currentEra.yunStart}.*${initial.currentEra.yunEnd}`));
  assert.match(initial.visibleEra, new RegExp(initial.currentEra.element));

  assert.deepEqual(
    await page.evaluate(() => ({
      handled: window.handleAppBack(),
      selectedTab: document.querySelector('.tab.active')?.dataset.tab
    })),
    { handled: false, selectedTab: 'legend' },
    'back at the first-load legend home must leave navigation to the browser'
  );

  await page.click('#legendStartButton');
  await sleep(80);
  assert.deepEqual(
    await page.evaluate(() => ({
      selectedTab: document.querySelector('.tab.active')?.dataset.tab,
      activePanel: document.querySelector('.view.active')?.id,
      focused: document.activeElement?.id
    })),
    { selectedTab: 'input', activePanel: 'view-input', focused: 'inBirth' }
  );

  const inputDesign = await page.evaluate(() => {
    const color = selector => getComputedStyle(document.querySelector(selector)).backgroundColor;
    return {
      hasTitle: Boolean(document.getElementById('legendInputTitle')),
      hasSeal: Boolean(document.querySelector('.legend-input-seal')?.offsetParent),
      legacyLogoWidth: document.querySelector('.intro-logo-img').getBoundingClientRect().width,
      view: color('#view-input'),
      card: color('#view-input .input-card'),
      primary: color('#view-input .primary-btn'),
      selected: color('#view-input .segmented button.active'),
      inputText: getComputedStyle(document.querySelector('#view-input .input')).color
    };
  });
  assert.deepEqual(inputDesign, {
    hasTitle: true,
    hasSeal: true,
    legacyLogoWidth: 1,
    view: 'rgb(242, 236, 221)',
    card: 'rgb(250, 247, 238)',
    primary: 'rgb(158, 62, 50)',
    selected: 'rgb(158, 62, 50)',
    inputText: 'rgb(32, 35, 31)'
  });

  await page.reload({ waitUntil: 'networkidle0' });
  await page.click('#legendPersonButton');
  await sleep(80);
  assert.deepEqual(
    await page.evaluate(() => ({
      selectedTab: document.querySelector('.tab.active')?.dataset.tab,
      activePanel: document.querySelector('.view.active')?.id,
      modalActive: document.getElementById('personSearchModal').classList.contains('active'),
      focused: document.activeElement?.id
    })),
    {
      selectedTab: 'input',
      activePanel: 'view-input',
      modalActive: true,
      focused: 'psQuery'
    }
  );
}

async function collectAppleInspection(page, selectors) {
  return page.evaluate(({ styleSelectors, geometrySelectors }) => {
    const visualProperties = [
      'background', 'backgroundColor', 'backgroundImage',
      'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
      'color', 'outlineColor', 'boxShadow', 'textShadow'
    ];
    const styleSnapshot = (element, pseudo = null) => {
      const computed = getComputedStyle(element, pseudo);
      return {
        values: Object.fromEntries(visualProperties.map(property => [property, computed[property]])),
        rendered: !pseudo || (
          computed.content !== 'none' &&
          computed.display !== 'none' &&
          computed.visibility !== 'hidden' &&
          Number(computed.opacity) > 0
        )
      };
    };
    const styles = selector => [...document.querySelectorAll(selector)]
      .filter(element => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0)
      .map(element => ({
        base: styleSnapshot(element),
        before: styleSnapshot(element, '::before'),
        after: styleSnapshot(element, '::after')
      }));
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
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      styles: Object.fromEntries(Object.entries(styleSelectors).map(([name, selector]) => [name, styles(selector)])),
      geometry: Object.fromEntries(Object.entries(geometrySelectors).map(([name, selector]) => [name, geometry(selector)]))
    };
  }, selectors);
}

async function collectAppleComponentInspection(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const element = document.querySelector(selector);
      const bounds = element?.getBoundingClientRect();
      return bounds ? { width: bounds.width, height: bounds.height } : null;
    };
    const style = (selector, pseudo = null) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const computed = getComputedStyle(element, pseudo);
      return {
        backgroundColor: computed.backgroundColor,
        borderRadius: computed.borderRadius,
        boxShadow: computed.boxShadow,
        outlineColor: computed.outlineColor,
        outlineStyle: computed.outlineStyle,
        outlineWidth: computed.outlineWidth,
        content: computed.content,
        display: computed.display,
        opacity: computed.opacity,
        color: computed.color,
        cursor: computed.cursor,
        pointerEvents: computed.pointerEvents
      };
    };

    const probeHost = document.createElement('div');
    probeHost.id = 'apple-element-probes';
    probeHost.style.cssText = 'position:fixed;left:-1000px;top:0;display:flex;gap:8px;';
    for (const element of ['wood', 'fire', 'earth', 'metal', 'water']) {
      const block = document.createElement('div');
      block.className = `pillar-block el-${element}`;
      block.innerHTML = '<span class="han">漢</span>';
      probeHost.appendChild(block);
    }
    document.body.appendChild(probeHost);

    const input = document.querySelector('.input');
    input?.focus();
    const focusedInput = style('.input');
    const primary = document.querySelector('.primary-btn');
    const enabledPrimary = style('.primary-btn');
    primary.disabled = true;
    const disabledPrimary = style('.primary-btn');
    primary.disabled = false;
    const elementColors = Object.fromEntries(
      ['wood', 'fire', 'earth', 'metal', 'water'].map(element => [
        element,
        {
          surface: style(`#apple-element-probes .el-${element}`).backgroundColor,
          foreground: style(`#apple-element-probes .el-${element} .han`).color
        }
      ])
    );
    const canvasColor = getComputedStyle(document.body).backgroundColor;
    probeHost.remove();

    return {
      geometry: {
        input: rect('.input'),
        primary: rect('.primary-btn'),
        segmented: rect('.segmented'),
        tabs: [...document.querySelectorAll('.tab, [data-legend-primary-nav]')]
          .filter(element => element.getBoundingClientRect().width > 0)
          .map(element => ({
            width: element.getBoundingClientRect().width,
            height: element.getBoundingClientRect().height
          })),
        iconButtons: [...document.querySelectorAll('.icon-btn')]
          .filter(element => element.getBoundingClientRect().width > 0)
          .map(element => ({
            width: element.getBoundingClientRect().width,
            height: element.getBoundingClientRect().height
          })),
        segmentedButtons: [...document.querySelectorAll('.segmented button')]
          .filter(element => element.getBoundingClientRect().width > 0)
          .map(element => ({
            width: element.getBoundingClientRect().width,
            height: element.getBoundingClientRect().height
          }))
      },
      radii: {
        input: style('.input').borderRadius,
        segmented: style('.segmented').borderRadius,
        card: style('.input-card').borderRadius
      },
      primaryAfter: style('.primary-btn', '::after'),
      enabledPrimary,
      disabledPrimary,
      focusedInput,
      focusColor: getComputedStyle(document.body).getPropertyValue('--apple-focus').trim(),
      elementColors,
      canvasColor
    };
  });
}

async function collectHanjaGeometry(page) {
  return page.evaluate(() => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 &&
        style.display !== 'none' && style.visibility !== 'hidden';
    };
    const measure = (selector, glyphSelector = '.han') =>
      [...document.querySelectorAll(selector)].filter(visible).map(element => {
        const rect = element.getBoundingClientRect();
        const glyph = element.querySelector(glyphSelector);
        const range = document.createRange();
        if (glyph) range.selectNodeContents(glyph);
        const glyphRect = glyph ? range.getBoundingClientRect() : null;
        const inline = element.style;
        const glyphInline = glyph?.style;
        return {
          rect: {
            left: rect.left, top: rect.top,
            width: rect.width, height: rect.height
          },
          center: glyphRect ? {
            x: Math.abs((glyphRect.left + glyphRect.right) / 2 - (rect.left + rect.right) / 2),
            y: Math.abs((glyphRect.top + glyphRect.bottom) / 2 - (rect.top + rect.bottom) / 2),
            signedY: (glyphRect.top + glyphRect.bottom) / 2 - (rect.top + rect.bottom) / 2
          } : null,
          transform: glyph ? getComputedStyle(glyph).transform : 'none',
          inlineHack: Boolean(
            inline.top || inline.marginTop || inline.transform ||
            glyphInline?.top || glyphInline?.marginTop || glyphInline?.transform
          )
        };
      });

    return {
      pillars: measure('.pillar-block'),
      daeun: measure('#daeunScroll .luck-block'),
      seun: measure('#seunScroll .luck-block'),
      wolun: measure('#woonScroll .luck-block'),
      ilun: measure('#dayArea .day-item:not(.empty)', '.d-han')
    };
  });
}

async function collectLuckFlowReachability(page) {
  return page.evaluate(() => {
    const specs = {
      daeun: ['#daeunScroll', '.luck-item'],
      seun: ['#seunScroll', '.luck-item'],
      wolun: ['#woonScroll', '.luck-item'],
      ilun: ['#dayArea .day-grid', '.day-item']
    };
    const tolerance = 1;
    const bounds = element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    };

    return Object.fromEntries(Object.entries(specs).map(([name, [containerSelector, itemSelector]]) => {
      const container = document.querySelector(containerSelector);
      const items = container ? [...container.querySelectorAll(itemSelector)] : [];
      if (!container || items.length === 0) return [name, null];
      const containerRect = bounds(container);
      const first = items[0];
      const last = items.at(-1);
      const initialFirst = bounds(first);
      const initialLast = bounds(last);
      const initialScrollLeft = container.scrollLeft;
      const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
      container.scrollLeft = maxScrollLeft;
      const endFirst = bounds(first);
      const endLast = bounds(last);
      const reachedEnd = Math.abs(container.scrollLeft - maxScrollLeft) <= tolerance;
      container.scrollLeft = initialScrollLeft;
      const itemWidths = items.map(item => item.getBoundingClientRect().width);
      return [name, {
        clientWidth: container.clientWidth,
        scrollWidth: container.scrollWidth,
        itemCount: items.length,
        minItemWidth: Math.min(...itemWidths),
        initialFirst,
        initialLast,
        endFirst,
        endLast,
        containerRect,
        maxScrollLeft,
        reachedEnd
      }];
    }));
  });
}

async function inspectAppleDesign(page, width) {
  const expectedAccents = { light: '#007aff', dark: '#0a84ff' };
  const expectedAccentColors = { light: 'rgb(0, 122, 255)', dark: 'rgb(10, 132, 255)' };
  const expectedAccentTints = { light: { r: 0, g: 122, b: 255 }, dark: { r: 10, g: 132, b: 255 } };
  const expectedPastels = {
    light: {
      wood: ['rgb(221, 246, 232)', 'rgb(35, 122, 75)'],
      fire: ['rgb(255, 227, 223)', 'rgb(184, 68, 56)'],
      earth: ['rgb(255, 241, 199)', 'rgb(122, 98, 0)'],
      metal: ['rgb(236, 239, 244)', 'rgb(80, 91, 107)'],
      water: ['rgb(226, 231, 255)', 'rgb(64, 84, 163)']
    },
    dark: {
      wood: ['rgb(20, 54, 41)', 'rgb(123, 224, 168)'],
      fire: ['rgb(65, 32, 29)', 'rgb(255, 154, 143)'],
      earth: ['rgb(58, 48, 20)', 'rgb(242, 211, 111)'],
      metal: ['rgb(43, 48, 56)', 'rgb(200, 208, 220)'],
      water: ['rgb(32, 40, 74)', 'rgb(167, 180, 255)']
    }
  };
  const legacyGold = /#(?:d8b56a|f0d69a|a97732)\b|rgba?\(\s*(?:216\s*,\s*181\s*,\s*106|240\s*,\s*214\s*,\s*154|169\s*,\s*119\s*,\s*50)\b/i;
  const inputSelectors = {
    styleSelectors: {
      topBar: '.top-bar',
      activeTab: width < 768
        ? '[data-legend-primary-nav].active'
        : '.tab.active',
      primaryButton: '.primary-btn',
      formFields: '.input'
    },
    geometrySelectors: {
      segmentedButtons: '.segmented button',
      tabs: width < 768 ? '[data-legend-primary-nav]' : '.tab',
      primaryButtons: '.primary-btn'
    }
  };
  const resultSelectors = {
    styleSelectors: {
      pillarBlocks: '.pillar-block',
      luckBlocks: '.luck-block'
    },
    geometrySelectors: {
      pillarBlocks: '.pillar-block',
      luckBlocks: '.luck-block'
    }
  };

  for (const [theme, accent] of Object.entries(expectedAccents)) {
    await page.evaluate(isDark => document.body.classList.toggle('dark', isDark), theme === 'dark');
    await activateDestination(page, 'input');
    await page.waitForFunction(() => document.querySelector('#view-input')?.classList.contains('active'));
    await sleep(250);
    const inputInspection = await collectAppleInspection(page, inputSelectors);
    const componentInspection = await collectAppleComponentInspection(page);

    await fillAndCalculate(page);
    await page.evaluate(() => {
      document.querySelector('#daeunScroll .luck-item')?.click();
      document.querySelector('#seunScroll .luck-item')?.click();
      document.querySelector('#woonScroll .luck-item')?.click();
    });
    await sleep(250);
    const resultInspection = await collectAppleInspection(page, resultSelectors);
    const hanjaGeometry = await collectHanjaGeometry(page);
    const flowReachability = await collectLuckFlowReachability(page);
    const inspection = {
      accent: inputInspection.accent,
      overflow: Math.max(inputInspection.overflow, resultInspection.overflow),
      styles: { ...inputInspection.styles, ...resultInspection.styles },
      geometry: { ...inputInspection.geometry, ...resultInspection.geometry }
    };

    assert.equal(inspection.accent, accent, `${width}px ${theme} --apple-accent`);
    assert.ok(inspection.overflow <= 1, `${width}px ${theme} horizontal overflow: ${inspection.overflow}px`);
    assert.ok(Math.abs(componentInspection.geometry.input.height - 52) <= 1, `${width}px ${theme} input height must be 52px`);
    assert.ok(Math.abs(componentInspection.geometry.primary.height - 54) <= 1, `${width}px ${theme} primary button height must be 54px`);
    assert.ok(componentInspection.geometry.primary.height >= 44, `${width}px ${theme} primary target is below 44px`);
    assert.ok(componentInspection.geometry.tabs.length > 0, `${width}px ${theme} tab target collection is empty`);
    for (const { width: targetWidth, height } of componentInspection.geometry.tabs) {
      assert.ok(targetWidth >= 44 && height >= 44, `${width}px ${theme} tab target is below 44px: ${targetWidth}x${height}px`);
    }
    assert.ok(componentInspection.geometry.iconButtons.length > 0, `${width}px ${theme} icon target collection is empty`);
    for (const { width: targetWidth, height } of componentInspection.geometry.iconButtons) {
      assert.ok(targetWidth >= 44 && height >= 44, `${width}px ${theme} icon target is below 44px: ${targetWidth}x${height}px`);
    }
    assert.ok(componentInspection.geometry.segmentedButtons.length > 0, `${width}px ${theme} segmented target collection is empty`);
    for (const { width: targetWidth, height } of componentInspection.geometry.segmentedButtons) {
      assert.ok(targetWidth >= 43.99 && height >= 43.99, `${width}px ${theme} segmented target is below 44px: ${targetWidth}x${height}px`);
    }
    assert.equal(componentInspection.radii.input, '12px', `${width}px ${theme} input radius`);
    assert.equal(componentInspection.radii.segmented, '14px', `${width}px ${theme} segmented radius`);
    assert.equal(componentInspection.radii.card, '18px', `${width}px ${theme} card radius`);
    assert.equal(componentInspection.primaryAfter.content, 'none', `${width}px ${theme} primary button must not render decorative pseudo-content`);
    const focusOutline = parseCssColor(componentInspection.focusedInput.outlineColor);
    const expectedFocus = parseCssColor(componentInspection.focusColor);
    assert.notEqual(componentInspection.focusedInput.outlineStyle, 'none', `${width}px ${theme} focused input outline style`);
    assert.ok(parseFloat(componentInspection.focusedInput.outlineWidth) > 0, `${width}px ${theme} focused input outline width`);
    assert.ok(focusOutline.a > 0, `${width}px ${theme} focused input outline is transparent`);
    assert.deepEqual(
      [focusOutline.r, focusOutline.g, focusOutline.b],
      [expectedFocus.r, expectedFocus.g, expectedFocus.b],
      `${width}px ${theme} focused input outline must use the Apple focus color`
    );
    assert.ok(
      componentInspection.disabledPrimary.pointerEvents === 'none' &&
      componentInspection.disabledPrimary.cursor === 'not-allowed',
      `${width}px ${theme} disabled primary must block pointer interaction`
    );
    assert.ok(
      Number(componentInspection.disabledPrimary.opacity) < Number(componentInspection.enabledPrimary.opacity) ||
      componentInspection.disabledPrimary.backgroundColor !== componentInspection.enabledPrimary.backgroundColor ||
      componentInspection.disabledPrimary.color !== componentInspection.enabledPrimary.color,
      `${width}px ${theme} disabled primary is not visually distinguishable`
    );
    for (const [element, [surface, foreground]] of Object.entries(expectedPastels[theme])) {
      const actual = componentInspection.elementColors[element];
      assert.deepEqual([actual.surface, actual.foreground], [surface, foreground], `${width}px ${theme} ${element} pastel pair`);
      assert.ok(
        contrastRatio(actual.foreground, actual.surface, componentInspection.canvasColor) >= 3,
        `${width}px ${theme} ${element} Hanja contrast is below 3:1`
      );
    }
    for (const [surface, elements] of Object.entries(inspection.styles)) {
      assert.ok(elements.length > 0, `${width}px ${theme} ${surface} missing`);
      for (const element of elements) {
        for (const [part, snapshot] of Object.entries(element)) {
          if (part !== 'base' && !snapshot.rendered) continue;
          for (const [property, value] of Object.entries(snapshot.values)) {
            assert.ok(!legacyGold.test(value), `${width}px ${theme} ${surface} ${part} ${property} retains legacy gold: ${value}`);
          }
        }
      }
    }

    const activeTab = inspection.styles.activeTab[0];
    const activeTabTint = parseCssColor(activeTab.base.values.backgroundColor);
    assert.ok(activeTabTint.a > 0.08, `${width}px ${theme} active tab capsule background is transparent: ${activeTab.base.values.backgroundColor}`);
    if (width >= 768) {
      assert.equal(activeTab.base.values.color, 'rgb(250, 247, 238)', `${width}px ${theme} active tab text color`);
      assert.deepEqual(
        [activeTabTint.r, activeTabTint.g, activeTabTint.b],
        [158, 62, 50],
        `${width}px ${theme} active tab must use the legend seal color`
      );
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

    for (const [group, blocks] of Object.entries(hanjaGeometry)) {
      assert.ok(blocks.length > 0, `${width}px ${theme} ${group} geometry missing`);
      const transforms = new Set();
      const rows = [];
      for (const block of blocks) {
        assert.ok(
          Math.abs(block.rect.width - block.rect.height) <= 1,
          `${width}px ${theme} ${group} block not square: ${block.rect.width}x${block.rect.height}`
        );
        assert.ok(!block.inlineHack, `${width}px ${theme} ${group} uses an inline alignment correction`);
        if (block.center) {
          const verticallyAligned = group === 'pillars'
            ? block.center.signedY >= -4 && block.center.signedY <= -2.5
            : block.center.y <= 2;
          assert.ok(
            block.center.x <= 2 && verticallyAligned,
            `${width}px ${theme} ${group} Hanja is off-center: ${block.center.x}x${block.center.y} (signedY ${block.center.signedY})`
          );
        }
        if (group !== 'ilun') transforms.add(block.transform);
        const row = rows.find(candidate => Math.abs(candidate.top - block.rect.top) <= 1);
        (row || rows[rows.push({ top: block.rect.top, heights: [] }) - 1]).heights.push(block.rect.height);
      }
      for (const row of rows) {
        assert.ok(
          Math.max(...row.heights) - Math.min(...row.heights) <= 1,
          `${width}px ${theme} ${group} row heights differ: ${row.heights.join(', ')}`
        );
      }
      if (group !== 'ilun') {
        assert.equal(transforms.size, 1, `${width}px ${theme} ${group} uses differing CJK transforms: ${[...transforms]}`);
      }
    }

    for (const [group, flow] of Object.entries(flowReachability)) {
      assert.ok(flow, `${width}px ${theme} ${group} flow container missing`);
      const hasOverflow = flow.scrollWidth - flow.clientWidth > 1;
      assert.ok(
        flow.initialFirst.left >= flow.containerRect.left - 1 &&
        flow.initialFirst.right <= flow.containerRect.right + 1,
        `${width}px ${theme} ${group} first item is clipped initially`
      );
      if (!hasOverflow) {
        assert.ok(
          flow.initialLast.left >= flow.containerRect.left - 1 &&
          flow.initialLast.right <= flow.containerRect.right + 1,
          `${width}px ${theme} ${group} last item is clipped without overflow`
        );
      } else {
        assert.ok(
          flow.clientWidth / flow.itemCount < 25,
          `${width}px ${theme} ${group} scrolls although all items can fit readably`
        );
        assert.ok(flow.reachedEnd, `${width}px ${theme} ${group} cannot reach its maximum scroll position`);
        assert.ok(
          flow.endLast.left >= flow.containerRect.left - 1 &&
          flow.endLast.right <= flow.containerRect.right + 1,
          `${width}px ${theme} ${group} last item is inaccessible at scroll end`
        );
      }
    }
  }
}

async function inspectAppleSecondaryScreens(page, width) {
  if (!runsSecondaryApple()) return;

  const legacyGold = /rgb(?:a)?\(\s*(?:216\s*,\s*181\s*,\s*106|240\s*,\s*214\s*,\s*154|169\s*,\s*119\s*,\s*50)(?:\s*,[^)]*)?\)/i;
  const themes = ['light', 'dark'];
  for (const theme of themes) {
    const state = await page.evaluate(async ({ theme, width }) => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      document.body.classList.toggle('dark', theme === 'dark');

      const css = element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          background: style.backgroundColor,
          color: style.color,
          borderTop: style.borderTopColor,
          outlineColor: style.outlineColor,
          boxShadow: style.boxShadow,
          animationName: style.animationName,
          iterationCount: style.animationIterationCount,
          transitionProperty: style.transitionProperty,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          bottom: rect.bottom
        };
      };

      document.querySelector('.tab[data-tab="match"]').click();
      await wait(180);
      const matchSlot = document.querySelector('.match-slot');
      const matchControl = css(matchSlot);
      const matchDecorations = [...document.querySelectorAll('.match-slot .plus, .match-slot .slot-ico')]
        .flatMap(element => [getComputedStyle(element).color, getComputedStyle(element, '::before').color]);

      document.querySelector('.tab[data-tab="calendar"]').click();
      await wait(180);
      const calendarCell = document.querySelector('.cal-day.clickable');
      calendarCell.click();
      const calendarSelected = css(document.querySelector('.cal-day.selected'));
      const calendarToday = document.querySelector('.cal-day.today') ? css(document.querySelector('.cal-day.today')) : null;
      const calendarDecorations = [...document.querySelectorAll('.cal-day')].map(css);
      const calendarControl = css(document.getElementById('calNext'));

      document.querySelector('.tab[data-tab="saved"]').click();
      const savedId = `task5-${theme}`;
      await window.storage.set(`legend-saju:record:${savedId}`, JSON.stringify({
        ...currentSaju,
        id: savedId,
        name: `실제저장-${theme}`,
        memo: 'Task 5 QA',
        fav: true,
        savedAt: Date.now()
      }));
      await renderSaved();
      await wait(180);
      const savedCardElement = document.querySelector(`.saved-card[data-id="${savedId}"]`);
      const savedCard = css(savedCardElement);
      const savedControl = css(savedCardElement.querySelector('button'));
      const savedContent = savedCardElement.textContent;

      document.querySelector('.tab[data-tab="fortune"]').click();
      await wait(180);
      renderFortune();
      await wait(60);
      const fortuneCardElement = document.querySelector('#fortuneContent .f-card');
      const fortuneCard = css(fortuneCardElement);
      const fortuneCount = document.querySelectorAll('#fortuneContent .f-card').length;

      const modalStates = [];
      for (const modal of document.querySelectorAll('.modal-bg')) {
        window.openAppModal(modal);
        await wait(260);
        const panel = modal.querySelector('.modal');
        const grabber = getComputedStyle(panel, '::before');
        const controls = [...panel.querySelectorAll('button')].filter(button => button.getClientRects().length).map(css);
        modalStates.push({
          id: modal.id,
          backdrop: css(modal),
          panel: css(panel),
          grabber: {
            content: grabber.content,
            width: parseFloat(grabber.width),
            height: parseFloat(grabber.height)
          },
          controls,
          focusedInside: modal.contains(document.activeElement)
        });
        window.closeAppModal(modal);
        await wait(230);
      }

      window.shareCard(window.currentSaju || currentSaju);
      await wait(40);
      const share = document.getElementById('shareCardModal');
      const shareImage = share.querySelector('.share-card-preview');
      await shareImage.decode();
      const pixelCanvas = document.createElement('canvas');
      pixelCanvas.width = shareImage.naturalWidth;
      pixelCanvas.height = shareImage.naturalHeight;
      const pixelContext = pixelCanvas.getContext('2d', { willReadFrequently: true });
      pixelContext.drawImage(shareImage, 0, 0);
      const corner = [...pixelContext.getImageData(4, 4, 1, 1).data];
      let darkSamples = 0;
      let legacyGoldSamples = 0;
      let samples = 0;
      const legacy = [[216, 181, 106], [240, 214, 154], [169, 119, 50]];
      for (let y = 4; y < pixelCanvas.height; y += 24) {
        for (let x = 4; x < pixelCanvas.width; x += 24) {
          const data = pixelContext.getImageData(x, y, 1, 1).data;
          samples++;
          if ((data[0] + data[1] + data[2]) / 3 < 45) darkSamples++;
          if (legacy.some(rgb => Math.hypot(data[0] - rgb[0], data[1] - rgb[1], data[2] - rgb[2]) < 12)) {
            legacyGoldSamples++;
          }
        }
      }
      window.__task5Share = null;
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async payload => {
          window.__task5Share = {
            text: payload.text,
            filename: payload.files && payload.files[0] && payload.files[0].name
          };
        }
      });
      const shareButtons = [...share.querySelectorAll('button')].map(css);
      const sharePanel = share.querySelector('.share-card-sheet');
      const shareState = {
        shell: css(share),
        hasPanel: !!sharePanel,
        panel: sharePanel ? css(sharePanel) : null,
        buttons: shareButtons,
        focusedInside: share.contains(document.activeElement)
      };
      document.getElementById('shareCardDo').click();
      await wait(80);
      shareState.image = {
        width: pixelCanvas.width,
        height: pixelCanvas.height,
        corner,
        darkSamples,
        legacyGoldSamples,
        samples
      };
      shareState.payload = window.__task5Share;
      window.closeShareCardModal();

      const activeView = document.querySelector('.view.active');
      const surfaceProbe = document.createElement('div');
      surfaceProbe.style.backgroundColor = 'var(--apple-surface)';
      document.body.appendChild(surfaceProbe);
      const result = {
        surface: getComputedStyle(surfaceProbe).backgroundColor,
        accent: getComputedStyle(document.documentElement).getPropertyValue('--apple-accent').trim(),
        matchControl,
        matchDecorations,
        calendarSelected,
        calendarToday,
        calendarDecorations,
        calendarControl,
        savedCard,
        savedControl,
        savedContent,
        fortuneCard,
        fortuneCount,
        modalStates,
        shareState,
        activeView: css(activeView),
        viewportHeight: window.innerHeight,
        width
      };
      await window.storage.delete(`legend-saju:record:${savedId}`);
      surfaceProbe.remove();
      return result;
    }, { theme, width });

    for (const [name, surface] of Object.entries({
      matchSlot: state.matchControl,
      savedCard: state.savedCard,
      fortuneCard: state.fortuneCard
    })) {
      assert.equal(surface.background, state.surface, `${width}px ${theme} ${name} must use the Apple grouped surface`);
    }
    assert.match(state.savedContent, new RegExp(`실제저장-${theme}`), `${width}px ${theme} actual saved record was not rendered`);
    assert.ok(state.fortuneCount >= 1, `${width}px ${theme} actual fortune cards were not rendered`);
    for (const color of state.matchDecorations) {
      assert.ok(!legacyGold.test(color), `${width}px ${theme} match decoration retains legacy gold: ${color}`);
    }
    assert.equal(
      state.calendarSelected.borderTop.toLowerCase(),
      theme === 'dark' ? 'rgb(10, 132, 255)' : 'rgb(0, 122, 255)',
      `${width}px ${theme} selected calendar day must use system blue`
    );
    for (const value of [state.calendarSelected.outlineColor, state.calendarSelected.boxShadow]) {
      assert.ok(!legacyGold.test(value), `${width}px ${theme} selected calendar retains legacy gold: ${value}`);
    }
    if (state.calendarToday) {
      for (const value of [state.calendarToday.borderTop, state.calendarToday.outlineColor, state.calendarToday.boxShadow]) {
        assert.ok(!legacyGold.test(value), `${width}px ${theme} today calendar retains legacy gold: ${value}`);
      }
    }
    for (const cell of state.calendarDecorations) {
      for (const value of [cell.borderTop, cell.outlineColor, cell.boxShadow]) {
        assert.ok(!legacyGold.test(value), `${width}px ${theme} calendar cell retains legacy gold: ${value}`);
      }
      assert.equal(cell.boxShadow, 'none', `${width}px ${theme} calendar cells must not glow`);
    }
    for (const [name, control] of Object.entries({
      matchSlot: state.matchControl,
      calendarNext: state.calendarControl,
      savedDelete: state.savedControl
    })) {
      assert.ok(control.width >= 43.5 && control.height >= 43.5, `${width}px ${theme} ${name} is below 44x44px: ${control.width}x${control.height}`);
    }
    for (const modal of state.modalStates) {
      assert.equal(modal.panel.background, state.surface, `${width}px ${theme} ${modal.id} panel surface`);
      assert.ok(modal.focusedInside, `${width}px ${theme} ${modal.id} must receive focus`);
      assert.deepEqual(
        { width: modal.grabber.width, height: modal.grabber.height },
        { width: 36, height: 5 },
        `${width}px ${theme} ${modal.id} grabber`
      );
      for (const control of modal.controls) {
        assert.ok(control.width >= 43.5 && control.height >= 43.5, `${width}px ${theme} ${modal.id} control is below 44x44px`);
      }
      if (width < 768) {
        assert.ok(Math.abs(modal.panel.bottom - state.viewportHeight) <= 1, `${width}px ${theme} ${modal.id} must be a bottom sheet`);
      } else {
        const center = modal.panel.top + modal.panel.height / 2;
        assert.ok(Math.abs(center - state.viewportHeight / 2) <= 2, `${width}px ${theme} ${modal.id} must be centered`);
      }
    }
    assert.ok(state.shareState.hasPanel, `${width}px ${theme} share dialog must expose an Apple sheet`);
    assert.equal(state.shareState.panel.background, state.surface, `${width}px ${theme} share sheet surface`);
    assert.ok(state.shareState.focusedInside, `${width}px ${theme} share dialog must receive focus`);
    assert.deepEqual(state.shareState.image.corner, [242, 242, 247, 255], `${width}px ${theme} share PNG must use the Apple light canvas`);
    assert.ok(
      state.shareState.image.darkSamples / state.shareState.image.samples < 0.01,
      `${width}px ${theme} share PNG still contains a dark/cosmic field`
    );
    assert.equal(state.shareState.image.legacyGoldSamples, 0, `${width}px ${theme} share PNG retains legacy gold pixels`);
    assert.match(state.shareState.payload.filename, /취명선_전설의_만세력\.png$/, `${width}px ${theme} share filename branding`);
    assert.match(state.shareState.payload.text, /취명선 전설의 만세력/, `${width}px ${theme} share text branding`);
    for (const control of state.shareState.buttons) {
      assert.ok(control.width >= 43.5 && control.height >= 43.5, `${width}px ${theme} share control is below 44x44px`);
    }
    assert.equal(state.activeView.animationName, 'none', `${width}px ${theme} views must not auto-cascade`);
    assert.notEqual(state.activeView.iterationCount, 'infinite', `${width}px ${theme} views must not loop`);
    for (const [name, element] of Object.entries({
      matchSlot: state.matchControl,
      calendarDay: state.calendarSelected,
      savedCard: state.savedCard
    })) {
      assert.notEqual(element.transitionProperty, 'all', `${width}px ${theme} ${name} must not animate all properties`);
    }
  }

  const transparencySession = await page.createCDPSession();
  try {
    await transparencySession.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }]
    });
    const reducedTransparency = await page.evaluate(async () => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      document.body.classList.add('dark');
      const inspect = element => {
        const style = getComputedStyle(element);
        return {
          background: style.backgroundColor,
          backdropFilter: style.backdropFilter || style.webkitBackdropFilter
        };
      };
      const modal = document.getElementById('aboutModal');
      window.openAppModal(modal);
      await wait(40);
      const modalState = {
        backdrop: inspect(modal),
        sheet: inspect(modal.querySelector('.modal'))
      };
      window.closeAppModal(modal);
      await wait(230);
      window.shareCard(currentSaju);
      await wait(40);
      const share = document.getElementById('shareCardModal');
      const shareState = {
        backdrop: inspect(share),
        sheet: inspect(share.querySelector('.share-card-sheet'))
      };
      window.closeShareCardModal();
      return { modalState, shareState };
    });
    for (const [name, overlay] of Object.entries(reducedTransparency)) {
      assert.equal(parseCssColor(overlay.sheet.background).a, 1, `${name} reduced-transparency sheet must be solid`);
      assert.equal(overlay.sheet.backdropFilter, 'none', `${name} reduced-transparency sheet must remove blur`);
      assert.equal(overlay.backdrop.backdropFilter, 'none', `${name} reduced-transparency backdrop must remove blur`);
    }
  } finally {
    await transparencySession.send('Emulation.setEmulatedMedia', { features: [] }).catch(() => {});
    await transparencySession.detach().catch(() => {});
  }
}

async function inspectAppleMotion(page, width) {
  if (!runsAppleMotion()) return;
  const exitEase = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const motion = await page.evaluate(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const presentation = element => {
      const style = getComputedStyle(element);
      const matrix = style.transform === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(style.transform);
      return { opacity: Number(style.opacity), x: matrix.m41, y: matrix.m42 };
    };
    const firstFrame = animation => {
      const frame = animation?.effect?.getKeyframes()?.[0] || {};
      let x = 0;
      let y = 0;
      try {
        const matrix = !frame.transform || frame.transform === 'none'
          ? new DOMMatrixReadOnly()
          : new DOMMatrixReadOnly(frame.transform);
        x = matrix.m41;
        y = matrix.m42;
      } catch {
        const values = String(frame.transform || '').match(/translate\([^,]+,\s*(-?[\d.]+)px\)/);
        y = values ? Number(values[1]) : 0;
      }
      return { opacity: Number(frame.opacity), x, y };
    };

    window.showAppToast('first');
    await wait(60);
    const toast = document.getElementById('appToast');
    const toastBefore = presentation(toast);
    window.showAppToast('second');
    const toastEntry = toast.getAnimations().find(animation =>
      !(animation instanceof CSSTransition) &&
      animation.effect?.getTiming().easing === 'cubic-bezier(0.2, 0.7, 0.2, 1)'
    );
    const toastRestart = {
      before: toastBefore,
      first: firstFrame(toastEntry)
    };
    await wait(1820);
    const toastExitAnimation = toast.getAnimations().find(animation =>
      !(animation instanceof CSSTransition) &&
      animation.playState !== 'finished'
    );
    const toastExit = toastExitAnimation ? {
      easing: toastExitAnimation.effect.getTiming().easing,
      frames: toastExitAnimation.effect.getKeyframes()
    } : null;
    await wait(180);

    const modal = document.getElementById('aboutModal');
    window.openAppModal(modal);
    await wait(260);
    window.closeAppModal(modal);
    const modalPanel = modal.querySelector('.modal');
    const modalExit = {
      backdrop: modal.getAnimations()[0]?.effect?.getTiming().easing,
      sheet: modalPanel.getAnimations()[0]?.effect?.getTiming().easing
    };
    await wait(40);
    window.openAppModal(modal);
    await wait(260);
    window.closeAppModal(modal);
    await wait(260);

    window.shareCard(currentSaju);
    await wait(60);
    const share = document.getElementById('shareCardModal');
    const shareSheet = share.querySelector('.share-card-sheet');
    const shareOpenAnimations = {
      backdrop: share.getAnimations()[0]?.effect?.getTiming(),
      sheet: shareSheet.getAnimations()[0]?.effect?.getTiming()
    };
    window.closeShareCardModal();
    const existsDuringClose = !!document.getElementById('shareCardModal');
    const closingShare = document.getElementById('shareCardModal');
    const shareExit = closingShare ? {
      backdrop: closingShare.getAnimations()[0]?.effect?.getTiming().easing,
      sheet: closingShare.querySelector('.share-card-sheet').getAnimations()[0]?.effect?.getTiming().easing
    } : null;
    await wait(60);
    const closePresentation = closingShare ? {
      backdrop: presentation(closingShare),
      sheet: presentation(closingShare.querySelector('.share-card-sheet'))
    } : null;
    window.shareCard(currentSaju);
    const reopened = document.getElementById('shareCardModal');
    const reopenFirst = {
      backdrop: firstFrame(reopened?.getAnimations()[0]),
      sheet: firstFrame(reopened?.querySelector('.share-card-sheet')?.getAnimations()[0])
    };
    await wait(280);
    window.closeShareCardModal();
    await wait(280);
    const removedAfterClose = !document.getElementById('shareCardModal');

    const visibleTransitionAll = [...document.querySelectorAll('body *')]
      .filter(element => element.getClientRects().length)
      .filter(element => getComputedStyle(element).transitionProperty.split(',').map(value => value.trim()).includes('all'))
      .map(element => element.id || element.className || element.tagName);

    const hoverViolations = [];
    const inspectRules = (rules, finePointer) => {
      for (const rule of [...(rules || [])]) {
        if (rule instanceof CSSMediaRule) {
          const condition = rule.conditionText.replace(/\s+/g, '').toLowerCase();
          inspectRules(rule.cssRules, finePointer || (
            condition.includes('(hover:hover)') &&
            condition.includes('(pointer:fine)')
          ));
        } else if (rule instanceof CSSStyleRule && rule.selectorText?.includes(':hover') && !finePointer) {
          hoverViolations.push(rule.selectorText);
        } else if (rule.cssRules) {
          inspectRules(rule.cssRules, finePointer);
        }
      }
    };
    for (const sheet of [...document.styleSheets]) {
      try { inspectRules(sheet.cssRules, false); }
      catch (error) {
        if (error.name !== 'SecurityError') throw error;
      }
    }

    document.querySelector('.tab[data-tab="input"]').click();
    const pressTarget = document.getElementById('calcBtn');
    const beforePress = getComputedStyle(pressTarget);
    pressTarget.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    const duringPress = getComputedStyle(pressTarget);
    const press = {
      beforeFilter: beforePress.filter,
      duringFilter: duringPress.filter,
      transitionProperty: duringPress.transitionProperty
    };
    pressTarget.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));

    return {
      toastRestart,
      toastExit,
      modalExit,
      shareOpenAnimations,
      existsDuringClose,
      shareExit,
      closePresentation,
      reopenFirst,
      removedAfterClose,
      visibleTransitionAll,
      hoverViolations,
      press
    };
  });

  assert.ok(Math.abs(motion.toastRestart.first.opacity - motion.toastRestart.before.opacity) <= 0.08, `${width}px toast re-entry opacity restarted: ${JSON.stringify(motion.toastRestart)}`);
  assert.ok(Math.abs(motion.toastRestart.first.y - motion.toastRestart.before.y) <= 2, `${width}px toast re-entry position restarted`);
  assert.equal(motion.toastExit.easing, exitEase, `${width}px toast exit easing`);
  assert.equal(motion.modalExit.backdrop, exitEase, `${width}px modal backdrop exit easing`);
  assert.equal(motion.modalExit.sheet, exitEase, `${width}px modal sheet exit easing`);
  assert.ok(motion.shareOpenAnimations.backdrop && motion.shareOpenAnimations.sheet, `${width}px share enter animations missing`);
  assert.equal(motion.existsDuringClose, true, `${width}px share overlay was removed before its exit animation`);
  assert.deepEqual(motion.shareExit, { backdrop: exitEase, sheet: exitEase }, `${width}px share exit easing`);
  assert.ok(Math.abs(motion.reopenFirst.backdrop.opacity - motion.closePresentation.backdrop.opacity) <= 0.08, `${width}px share backdrop reopen jumped`);
  assert.ok(Math.abs(motion.reopenFirst.sheet.y - motion.closePresentation.sheet.y) <= 12, `${width}px share sheet reopen jumped`);
  assert.equal(motion.removedAfterClose, true, `${width}px share overlay remained after exit animation`);
  assert.deepEqual(motion.visibleTransitionAll, [], `${width}px visible elements retain transition: all`);
  assert.deepEqual(motion.hoverViolations, [], `${width}px hover rules must be fine-pointer gated`);
  assert.equal(motion.press.duringFilter, 'none', `${width}px active feedback must not animate filter`);
  assert.ok(!motion.press.transitionProperty.split(',').map(value => value.trim()).includes('filter'), `${width}px press transition includes filter`);

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const reduced = await page.evaluate(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    window.showAppToast('reduced');
    const toastFrames = document.getElementById('appToast').getAnimations()
      .find(animation => !(animation instanceof CSSTransition))?.effect?.getKeyframes() || [];
    const modal = document.getElementById('aboutModal');
    window.openAppModal(modal);
    const modalFrames = modal.querySelector('.modal').getAnimations()
      .find(animation => !(animation instanceof CSSTransition))?.effect?.getKeyframes() || [];
    await wait(130);
    window.closeAppModal(modal);
    await wait(140);
    window.shareCard(currentSaju);
    const shareFrames = document.querySelector('.share-card-sheet').getAnimations()
      .find(animation => !(animation instanceof CSSTransition))?.effect?.getKeyframes() || [];
    window.closeShareCardModal();
    await wait(140);
    const transforms = frames => frames.map(frame => frame.transform || 'none');
    return {
      toast: transforms(toastFrames),
      modal: transforms(modalFrames),
      share: transforms(shareFrames)
    };
  });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  for (const [name, transforms] of Object.entries(reduced)) {
    assert.ok(transforms.length >= 2, `${width}px reduced-motion ${name} frames missing`);
    assert.equal(new Set(transforms).size, 1, `${width}px reduced-motion ${name} must fade without displacement: ${JSON.stringify(transforms)}`);
  }
}

function collectPageIssues(page) {
  const issues = [];
  page.on('pageerror', error => {
    issues.push(`pageerror: ${error.message}`);
  });
  page.on('console', message => {
    if (message.type() === 'error') issues.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', request => {
    issues.push(`request: ${request.url()} (${request.failure()?.errorText || 'failed'})`);
  });
  return issues;
}

async function closeCleanPage(page, width, issues) {
  await sleep(50);
  assert.deepEqual(issues, [], `${width}px emitted browser errors`);
  await page.close();
}

async function inspectWidth(browser, width) {
  console.log(`[ui] ${width}px: opening page`);
  const page = await browser.newPage();
  const pageIssues = collectPageIssues(page);
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

  if (TEST_GROUP === 'lunar-input' || (!TEST_GROUP && width === 390)) {
    await inspectLunarMonthInput(page, width);
    if (TEST_GROUP === 'lunar-input') {
      await closeCleanPage(page, width, pageIssues);
      return;
    }
    await page.reload({ waitUntil: 'networkidle0' });
    await page.evaluate(() => document.body.classList.add('dark'));
  }

  if (TEST_GROUP === 'legacy-import' || (!TEST_GROUP && width === 390)) {
    await inspectLegacyBackupImport(page);
    if (TEST_GROUP === 'legacy-import') {
      await closeCleanPage(page, width, pageIssues);
      return;
    }
    await page.reload({ waitUntil: 'networkidle0' });
    await page.evaluate(() => document.body.classList.add('dark'));
  }

  if (TEST_GROUP === 'legend-flow') {
    await inspectLegendFlow(page, width);
    await closeCleanPage(page, width, pageIssues);
    return;
  }

  if (TEST_GROUP === 'legend-accessibility') {
    await inspectLegendAccessibility(page, width);
    await closeCleanPage(page, width, pageIssues);
    return;
  }

  if (TEST_GROUP === 'legend-navigation') {
    await inspectLegendNavigation(page, width);
    await closeCleanPage(page, width, pageIssues);
    return;
  }

  if (TEST_GROUP === 'legend-home' || (!TEST_GROUP && width === 390)) {
    await inspectLegendHome(page, width);
    if (TEST_GROUP === 'legend-home') {
      await closeCleanPage(page, width, pageIssues);
      return;
    }
    await page.reload({ waitUntil: 'networkidle0' });
    await page.evaluate(() => document.body.classList.add('dark'));
  }

  if (TEST_GROUP === 'frontend-quality') {
    await inspectFrontendQuality(page, width);
    await closeCleanPage(page, width, pageIssues);
    return;
  }

  if (TEST_GROUP === 'calendar-shell-width') {
    await inspectCalendarShellWidth(page, width);
    await closeCleanPage(page, width, pageIssues);
    return;
  }

  await inspectCalendarCurrentYear(page, width);
  if (TEST_GROUP === 'calendar-current-year') {
    await closeCleanPage(page, width, pageIssues);
    return;
  }
  if (!TEST_GROUP && width === 390) {
    await page.reload({ waitUntil: 'networkidle0' });
    await page.evaluate(() => document.body.classList.add('dark'));
  }

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

      await page.click('#legendMoreButton');
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
        document.getElementById('legendMoreButton').focus();
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
          about: { role: 'dialog', ariaModal: 'true', name: '취명선 전설의 만세력' },
          save: { role: 'dialog', ariaModal: 'true', name: '명반 저장' }
        },
        aboutEntry: { activeId: 'aboutClose', inside: true, appInert: true, bottomBarInert: true },
        aboutTrappedId: 'aboutClose',
        aboutExit: { active: false, restoredId: 'legendMoreButton', appInert: false },
        saveEntryId: 'saveName',
        saveForwardTrapId: 'saveName',
        saveBackwardTrapId: 'saveConfirm',
        saveExit: { active: false, restoredId: 'legendMoreButton', appInert: false }
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
        const before = new Set((await window.storage.list('legend-saju:record:')).keys || []);
        document.getElementById('saveBtn').click();
        document.getElementById('saveConfirm').click();
        await new Promise(resolve => setTimeout(resolve, 100));
        const toast = document.getElementById('appToast');
        const after = await window.storage.list('legend-saju:record:');
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
  assert.equal(inputPolish.cardBorder, 'rgba(32, 35, 31, 0.14)', `${width}px input card border`);
  assert.equal(inputPolish.collapsedErrorBorder, 'rgba(0, 0, 0, 0)', `${width}px collapsed error line`);

  if (runsShellWidth()) {
    await inspectShellWidth(page, width);
    await closeCleanPage(page, width, pageIssues);
    return;
  }

  if (runsFoldLayout()) {
    await inspectFoldLayout(page, width);
    await closeCleanPage(page, width, pageIssues);
    return;
  }

  await fillAndCalculate(page);
  if (runsGroup('release-audit')) await inspectExactReleaseAssertions(page, width);

  if (TEST_GROUP === 'all-tab-shell-width') {
    await inspectAllTabShellWidths(page, width);
    await closeCleanPage(page, width, pageIssues);
    return;
  }

  if (runsResultWidthBrand()) {
    await inspectResultWidthAndBrand(page, width);
    await closeCleanPage(page, width, pageIssues);
    return;
  }

  if (runsImportedFieldXss()) {
    await inspectImportedFieldDownstreamSafety(page, width);
    if (TEST_GROUP === 'imported-fields-xss') {
      await closeCleanPage(page, width, pageIssues);
      return;
    }
  }

  if (runsGroup('final-security')) {
    await inspectFinalSecurityRuntime(page, width);
    if (TEST_GROUP === 'final-security') {
      await closeCleanPage(page, width, pageIssues);
      return;
    }
  }

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

  if (runsGroup('apple-design') || runsSecondaryApple() || runsAppleMotion()) {
    await inspectAppleDesign(page, width);
    await inspectAppleSecondaryScreens(page, width);
    await inspectAppleMotion(page, width);
    await closeCleanPage(page, width, pageIssues);
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
  assert.equal(resultPalette.selectedOutline, 'rgb(10, 132, 255)', `${width}px selected luck outline`);
  assert.equal(resultPalette.bottomBarBackground, 'rgba(7, 8, 13, 0.96)', `${width}px bottom bar background`);

  await page.evaluate(() => document.querySelector('.tab[data-tab="fortune"]').click());
  await sleep(200);
  const fortunePalette = await page.evaluate(() => ({
    tag: getComputedStyle(document.querySelector('.fortune-head .year-tag')).backgroundColor,
    inset: getComputedStyle(document.querySelector('.f-text')).backgroundColor
  }));
  assert.equal(fortunePalette.tag, fortunePalette.inset, `${width}px fortune tag must use the grouped inset surface`);

  await page.evaluate(() => document.querySelector('.tab[data-tab="match"]').click());
  await sleep(200);
  assert.equal(
    await page.$eval('.match-intro em', element => getComputedStyle(element).color),
    'rgb(10, 132, 255)'
  );
  await page.evaluate(() => document.querySelector('.tab[data-tab="result"]').click());
  await sleep(150);

  await page.evaluate(() => window.shareCard(currentSaju));
  await sleep(150);
  const sharePreview = await page.evaluate(() => ({
    src: document.querySelector('#shareCardModal img')?.getAttribute('src') || '',
    buttonBackground: getComputedStyle(document.getElementById('shareCardDo')).backgroundImage,
    buttonColor: getComputedStyle(document.getElementById('shareCardDo')).backgroundColor
  }));
  assert.ok(sharePreview.src.startsWith('data:image/png'), `${width}px share preview missing`);
  assert.equal(sharePreview.buttonBackground, 'none', `${width}px share button must not use a metallic gradient`);
  assert.equal(sharePreview.buttonColor, 'rgb(10, 132, 255)', `${width}px share button must use system blue`);
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

  await closeCleanPage(page, width, pageIssues);
}

(async () => {
  if (runsGroup('repository-root')) inspectRepositoryRootInference();
  if (runsGroup('legend-source')) inspectLegendSourceContracts();
  if (runsGroup('legend-era-metadata')) inspectLegendEraMetadata();
  if (HAS_ANDROID_PROJECT && runsGroup('android-backup')) inspectAndroidBackupPolicy();
  if (runsAndroidSafeArea()) inspectAndroidSafeAreaContract();
  if (runsResultHeaderCompact()) inspectResultHeaderCompactContract();
  if (HAS_ANDROID_PROJECT && runsGroup('release-contract')) inspectReleaseContract();
  if (process.env.SKIP_SOURCE_CONTRACTS !== '1' && runsGroup('final-security')) inspectFinalSecuritySourceContracts();
  if (!HAS_ANDROID_PROJECT && ['android-backup', 'android-safe-area', 'release-contract'].includes(TEST_GROUP)) {
    console.log(`${TEST_GROUP} regression SKIP: standalone web repository has no Android project`);
    return;
  }
  if (TEST_GROUP === 'repository-root' || TEST_GROUP === 'legend-source' || TEST_GROUP === 'legend-era-metadata' || TEST_GROUP === 'android-backup' || TEST_GROUP === 'android-safe-area' || TEST_GROUP === 'result-header-compact' || TEST_GROUP === 'release-contract') {
    console.log(`${TEST_GROUP} regression PASS`);
    return;
  }

  if (runsGroup('apple-design')) {
    const appleCss = fs.readFileSync(path.join(UI_ROOT, 'apple.css'), 'utf8');
    const indexHtml = fs.readFileSync(path.join(UI_ROOT, 'index.html'), 'utf8');
    const webManifest = JSON.parse(fs.readFileSync(path.join(WEB_ROOT, 'manifest.webmanifest'), 'utf8'));
    assert.match(appleCss, /--apple-accent:\s*#007aff/i);
    assert.match(appleCss, /body\.dark[\s\S]*--apple-accent:\s*#0a84ff/i);
    assert.doesNotMatch(appleCss, /#d8b56a|#f0d69a|#a97732/i);
    assert.match(indexHtml, /<title>취명선 전설의 만세력<\/title>/, 'document title must use the current product name');
    assert.match(indexHtml, /<meta name="apple-mobile-web-app-title" content="전설의 만세력">/, 'Apple web app title must use the current product name');
    assert.deepEqual(
      { name: webManifest.name, shortName: webManifest.short_name },
      { name: '취명선 전설의 만세력', shortName: '전설의 만세력' },
      'PWA manifest names must use the current product name'
    );
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
  const staticSite = await startStaticServer(UI_ROOT);
  URL = staticSite.url;
  console.log('[ui] launching Chrome');
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: findChromeExecutable(),
      headless: 'new',
      args: ['--hide-scrollbars']
    });
    console.log('[ui] Chrome launched');
    for (const width of widths) await inspectWidth(browser, width);
    console.log('UI regression PASS:', widths.join(', '));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => staticSite.server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
