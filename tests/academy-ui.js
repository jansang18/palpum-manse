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
    '.webp': 'image/webp'
  }[path.extname(filePath)] || 'application/octet-stream';
}

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const relative = pathname === '/' || pathname === '/academy/' || pathname === '/academy'
        ? 'academy/index.html'
        : pathname.replace(/^\/+/, '');
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

async function inspectLayout(page, viewport) {
  await page.setViewport(viewport);
  await page.goto(page.testUrl, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.academy-home-copy.is-revealed');
  await page.waitForSelector('[data-count-complete="true"]');

  return page.evaluate(() => {
    const rect = selector => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return {
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        left: box.left,
        width: box.width,
        height: box.height
      };
    };
    const style = selector => getComputedStyle(document.querySelector(selector));
    return {
      title: rect('#academyHomeTitle'),
      actions: rect('.academy-home-actions'),
      facts: rect('.academy-home-facts'),
      hero: rect('#academyHome'),
      masthead: rect('.academy-masthead'),
      orbit: rect('.academy-orbit'),
      orbitNodes: document.querySelectorAll('.academy-orbit-node').length,
      parallaxLayers: document.querySelectorAll('[data-parallax-layer]').length,
      mistBands: document.querySelectorAll('.academy-mist').length,
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      mastheadPosition: style('.academy-masthead').position,
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

async function inspectAcademyManse(page) {
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(page.testUrl, { waitUntil: 'networkidle0' });
  await page.type('#academyBirth', '19860219');
  await page.type('#academyTime', '1430');
  await page.click('#academyCalculate');
  await page.waitForSelector('#academyPillars:not([hidden])');

  const basic = await page.evaluate(() => ({
    pillars: [...document.querySelectorAll('[data-pillar]')].map(node => node.textContent.trim()),
    luckCount: document.querySelector('#academyLuckFlow').children.length,
    academyApi: typeof window.AcademyManse?.calculateFromForm,
    adapterApi: typeof window.ManseryeokAdapter?.calculate,
    directEngineCalls: window.ManseryeokAdapter === window.Manseryeok
  }));

  const leap = await page.evaluate(() => {
    const form = document.querySelector('#academyManseForm');
    form.elements.calendar.value = 'lunar';
    form.elements.calendar.dispatchEvent(new Event('change', { bubbles: true }));
    form.elements.leap.value = 'leap';
    form.elements.calendar.value = 'solar';
    form.elements.calendar.dispatchEvent(new Event('change', { bubbles: true }));
    form.elements.calendar.value = 'lunar';
    form.elements.calendar.dispatchEvent(new Event('change', { bubbles: true }));
    form.elements.birth.value = '20200401';
    form.elements.time.value = '1200';
    form.requestSubmit();
    return {
      leapVisible: !document.querySelector('#academyLeapField').hidden,
      leapChoice: form.elements.leap.value,
      summary: document.querySelector('#academyManseSummary').textContent,
      errorHidden: document.querySelector('#academyManseError').hidden
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
  await page.evaluate(() => {
    const form = document.querySelector('#academyManseForm');
    form.elements.birth.value = '19860219';
    form.elements.time.value = '1430';
    form.requestSubmit();
  });
  const mobile = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    pillarColumns: getComputedStyle(document.querySelector('#academyPillars')).gridTemplateColumns
      .split(' ')
      .filter(Boolean)
      .length,
    resultVisible: !document.querySelector('#academyManseResult').hidden
  }));

  const notes = await page.$$eval('.academy-learning-notes details', nodes => nodes.map(node => ({
    label: node.querySelector('summary').textContent,
    text: node.querySelector('p').textContent
  })));

  return { basic, leap, unknown, safeText, validation, desktop, mobile, notes };
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
  page.testUrl = `${origin}/academy/`;
  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));

  try {
    for (const missingPath of ['/academy/assets/not-created.webp']) {
      const response = await fetch(`${origin}${missingPath}`);
      assert.equal(response.status, 404, `${missingPath}: missing assets must return 404`);
    }
    const mockups = await fetch(`${origin}/academy/scripts/academy-mockups.js`);
    assert.equal(mockups.status, 200, 'academy mockup controller must load');
    const manse = await fetch(`${origin}/academy/scripts/academy-manse.js`);
    assert.equal(manse.status, 200, 'academy Manseryeok controller must load');

    if (process.env.TEST_GROUP === 'academy-manse') {
      const result = await inspectAcademyManse(page);
      assert.equal(result.basic.pillars.length, 4);
      assert.ok(result.basic.pillars.every(Boolean));
      assert.ok(result.basic.luckCount > 1, 'luck flow renders calculated cycles');
      assert.equal(result.basic.academyApi, 'function');
      assert.equal(result.basic.adapterApi, 'function');
      assert.equal(result.basic.directEngineCalls, false, 'academy uses the adapter, not the raw engine');
      assert.deepEqual(result.leap, {
        leapVisible: true,
        leapChoice: 'leap',
        summary: '음력 윤달 · 시간 입력',
        errorHidden: true
      });
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
      assert.deepEqual(result.mobile, {
        overflow: 0,
        pillarColumns: 2,
        resultVisible: true
      });
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
      assert.ok(result.actions.bottom <= viewport.height + 1, `${viewport.name}: both CTAs visible`);
      assert.ok(result.facts.top >= result.masthead.bottom - 1, `${viewport.name}: facts below masthead`);
      assert.ok(result.facts.bottom <= viewport.height + 1, `${viewport.name}: facts visible`);
      if (viewport.width >= 768) {
        assert.ok(result.orbit.top >= result.masthead.bottom - 1, `${viewport.name}: orbit below masthead`);
        assert.ok(result.orbit.right <= viewport.width + 1, `${viewport.name}: orbit right edge visible`);
        assert.ok(result.orbit.bottom <= viewport.height + 1, `${viewport.name}: orbit bottom visible`);
        assert.ok(result.orbit.left >= -1, `${viewport.name}: orbit left edge visible`);
      }
      assert.ok(result.horizontalOverflow <= 1, `${viewport.name}: no horizontal overflow`);

      await page.screenshot({
        path: path.join(os.tmpdir(), `academy-task2-${viewport.name}.png`),
        fullPage: false
      });
    }

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
