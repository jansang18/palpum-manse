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
  { name: 'hd', width: 1280, height: 720 },
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
      if (pathname === '/favicon.ico') {
        response.writeHead(204);
        response.end();
        return;
      }
      const relative = pathname === '/' || pathname === '/academy/' || pathname === '/academy'
        ? 'academy/index.html'
        : pathname.replace(/^\/+/, '');
      const filePath = path.resolve(repoRoot, relative);

      if (!filePath.startsWith(repoRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        if (relative === 'academy/scripts/academy-manse.js' || relative === 'academy/scripts/academy-mockups.js') {
          response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
          response.end('');
          return;
        }
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
      hero: rect('#academyHome'),
      masthead: rect('.academy-masthead'),
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
      pointerX: getComputedStyle(document.documentElement).getPropertyValue('--pointer-x').trim(),
      pointerY: getComputedStyle(document.documentElement).getPropertyValue('--pointer-y').trim(),
      scrollDepth: getComputedStyle(document.documentElement).getPropertyValue('--scroll-depth').trim()
    };
  });
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
  page.testUrl = `http://127.0.0.1:${address.port}/academy/`;
  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));

  try {
    for (const viewport of viewports) {
      const result = await inspectLayout(page, viewport);
      assert.equal(result.mastheadPosition, 'fixed', `${viewport.name}: masthead must stay fixed`);
      assert.equal(result.orbitNodes, 9, `${viewport.name}: nine orbit nodes`);
      assert.equal(result.parallaxLayers, 3, `${viewport.name}: three mountain layers`);
      assert.equal(result.mistBands, 2, `${viewport.name}: two mist bands`);
      assert.equal(result.titleText, '취명선 명리학당', `${viewport.name}: readable Korean title`);
      assert.ok(result.title.top >= result.masthead.bottom - 1, `${viewport.name}: title below masthead`);
      assert.ok(result.actions.bottom <= viewport.height + 1, `${viewport.name}: both CTAs visible`);
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
    console.log(`Visual captures: ${path.join(os.tmpdir(), 'academy-task2-{full-hd,hd,mobile}.png')}`);
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
