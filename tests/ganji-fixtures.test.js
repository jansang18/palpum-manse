const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const puppeteer = require('puppeteer-core');
const manseryeok = require('manseryeok');
const { createAdapter } = require('../scripts/manseryeok-adapter.js');

const adapter = createAdapter(manseryeok);
let browserPromise = null;

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
        process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
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
          '/snap/bin/chromium'
        ];
  const executable = candidates.filter(Boolean).find(candidate => fs.existsSync(candidate));
  if (!executable) {
    throw new Error('Chrome/Chromium executable not found. Set CHROME_PATH to run browser Ganji fixtures.');
  }
  return executable;
}

function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      executablePath: findChromeExecutable(),
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browserPromise;
}

test.after(async () => {
  if (browserPromise) await (await browserPromise).close();
});

test('maps a normal KST birth to numeric pillar indexes and legacy daewoon', () => {
  const result = adapter.calculate({
    year: 1992, month: 10, day: 24, hour: 5, minute: 30,
    calendar: 'solar', gender: 'M', unknown: false,
    dayBoundary: 'midnight'
  });

  assert.deepEqual(
    [result.yStem, result.yBranch, result.mStem, result.mBranch,
      result.dStem, result.dBranch, result.hStem, result.hBranch],
    [8, 8, 6, 10, 9, 9, 1, 3]
  );
  assert.equal(result.calculationMode, 'kasi-precise');
  assert.deepEqual(result.solar, { y: 1992, m: 10, d: 24 });
  assert.deepEqual(result.lunar, {
    y: 1992, m: 9, d: 29, isLeap: false
  });
  assert.equal(result.daeun.num, 5);
  assert.equal(result.daeun.forward, true);
  assert.deepEqual(result.daeun.list.slice(0, 2), [
    { age: 0, stem: 6, branch: 10, isInitial: true },
    { age: 5, stem: 7, branch: 11 }
  ]);
  assert.equal(result.daeun.list.length, 11);
});

test('preserves lunar input and its converted solar date', () => {
  const result = adapter.calculate({
    year: 1992, month: 9, day: 29, hour: 5, minute: 30,
    calendar: 'lunar', isLeapMonth: false, gender: 'M', unknown: false,
    dayBoundary: 'midnight'
  });

  assert.deepEqual(result.solar, { y: 1992, m: 10, d: 24 });
  assert.deepEqual(result.lunar, {
    y: 1992, m: 9, d: 29, isLeap: false
  });
  assert.deepEqual(
    [result.yStem, result.yBranch, result.mStem, result.mBranch,
      result.dStem, result.dBranch, result.hStem, result.hBranch],
    [8, 8, 6, 10, 9, 9, 1, 3]
  );
});

test('requires an explicit normal or leap month choice for lunar input', () => {
  assert.throws(() => adapter.calculate({
    year: 2023, month: 2, day: 1, hour: 12, minute: 0,
    calendar: 'lunar', gender: 'F', unknown: false
  }), /평달.*윤달|isLeapMonth/);
});

test('rejects a leap month that does not exist instead of using the normal month', () => {
  assert.throws(() => adapter.calculate({
    year: 2024, month: 2, day: 1, hour: 12, minute: 0,
    calendar: 'lunar', isLeapMonth: true, gender: 'F', unknown: false
  }), /윤2월이 존재하지 않습니다/);
});

test('changes the year pillar across the exact 2024 ipchun boundary', () => {
  const before = adapter.calculate({
    year: 2024, month: 2, day: 4, hour: 17, minute: 26,
    calendar: 'solar', gender: 'F', unknown: false,
    dayBoundary: 'midnight'
  });
  const after = adapter.calculate({
    year: 2024, month: 2, day: 4, hour: 17, minute: 28,
    calendar: 'solar', gender: 'F', unknown: false,
    dayBoundary: 'midnight'
  });

  assert.notDeepEqual(
    [before.yStem, before.yBranch],
    [after.yStem, after.yBranch]
  );
});

test('preserves the selected 23:30 day-boundary convention', () => {
  const midnight = adapter.calculate({
    year: 2024, month: 3, day: 10, hour: 23, minute: 30,
    calendar: 'solar', gender: 'M', unknown: false,
    dayBoundary: 'midnight'
  });
  const jasi = adapter.calculate({
    year: 2024, month: 3, day: 10, hour: 23, minute: 30,
    calendar: 'solar', gender: 'M', unknown: false,
    dayBoundary: 'jasi'
  });

  assert.notDeepEqual(
    [midnight.dStem, midnight.dBranch],
    [jasi.dStem, jasi.dBranch]
  );
});

test('hides the hour pillar when birth time is unknown', () => {
  const result = adapter.calculate({
    year: 1992, month: 10, day: 24, hour: 0, minute: 0,
    calendar: 'solar', gender: 'F', unknown: true,
    dayBoundary: 'midnight'
  });

  assert.deepEqual([result.hStem, result.hBranch], [-1, -1]);
});

test('uses the complete precise solar and lunar input ranges from the engine', () => {
  assert.equal(adapter.calculate({
    year: 1800, month: 1, day: 1, hour: 12, minute: 0,
    calendar: 'solar', gender: 'M', unknown: false
  }).calculationMode, 'kasi-precise');
  assert.equal(adapter.calculate({
    year: 2300, month: 1, day: 1, hour: 12, minute: 0,
    calendar: 'solar', gender: 'M', unknown: false
  }).calculationMode, 'kasi-precise');
  assert.throws(() => adapter.calculate({
    year: 2301, month: 1, day: 1, hour: 12, minute: 0,
    calendar: 'solar', gender: 'M', unknown: false
  }), /1800~2300/);

  assert.equal(adapter.calculate({
    year: 2100, month: 1, day: 1, hour: 12, minute: 0,
    calendar: 'lunar', isLeapMonth: false, gender: 'F', unknown: false
  }).calculationMode, 'kasi-precise');
  assert.throws(() => adapter.calculate({
    year: 2101, month: 1, day: 1, hour: 12, minute: 0,
    calendar: 'lunar', isLeapMonth: false, gender: 'F', unknown: false
  }), /1800~2100/);
});

test('browser calculation renders the precise KASI result contract', async () => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href, {
      waitUntil: 'networkidle0'
    });
    await page.evaluate(() => {
      document.getElementById('inputName').value = '정밀fixture';
      document.querySelector('#segGender [data-val="M"]').click();
      document.querySelector('#segCal [data-val="solar"]').click();
      document.getElementById('inBirth').value = '19921024';
      document.getElementById('inTime').value = '0530';
      document.getElementById('calcBtn').click();
    });
    await new Promise(resolve => setTimeout(resolve, 300));

    const result = await page.evaluate(() => ({
      adapter: typeof globalThis.LegendGanji?.calculate,
      mode: currentSaju?.calculationMode,
      modeLabel: document.querySelector('[data-calculation-mode]')?.textContent.trim(),
      glyphCount: document.querySelectorAll('.pillar-block').length,
      sipsin: currentSaju?.sipsin,
      sipsinJi: currentSaju?.sipsinJi,
      ohaeng: currentSaju?.ohaeng,
      gongmang: currentSaju?.gongmang
    }));
    assert.deepEqual(result, {
      adapter: 'function',
      mode: 'kasi-precise',
      modeLabel: '정밀 계산',
      glyphCount: 8,
      sipsin: { year: 1, month: 9, hour: 2 },
      sipsinJi: { year: 9, month: 7, day: 8, hour: 2 },
      ohaeng: [2, 0, 1, 3, 2],
      gongmang: [10, 11]
    });
  } finally {
    await page.close();
  }
});

test('browser rejects pre-1800 lunar dates but preserves solar legacy mode', async () => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href, {
      waitUntil: 'networkidle0'
    });

    const direct = await page.evaluate(() => {
      let lunarError = null;
      try {
        calcSaju({
          year: 1799, month: 1, day: 1, hour: 12, minute: 0,
          calendar: 'lunar', gender: 'M', unknown: false
        });
      } catch (error) {
        lunarError = { name: error.name, message: error.message };
      }
      const solar = calcSaju({
        year: 1799, month: 1, day: 1, hour: 12, minute: 0,
        calendar: 'solar', gender: 'M', unknown: false
      });
      return {
        lunarError,
        solarMode: solar.calculationMode,
        solarDate: [solar.year, solar.month, solar.day]
      };
    });
    assert.deepEqual(direct, {
      lunarError: {
        name: 'RangeError',
        message: '1800년 이전 음력 생년월일은 지원하지 않습니다. 양력으로 입력해주세요.'
      },
      solarMode: 'legacy-approximate',
      solarDate: [1799, 1, 1]
    });

    await page.evaluate(() => {
      document.querySelector('#segCal [data-val="lunar"]').click();
      document.getElementById('inBirth').value = '17990101';
      document.getElementById('inTime').value = '1200';
      document.getElementById('calcBtn').click();
    });
    await new Promise(resolve => setTimeout(resolve, 100));

    const userFacing = await page.evaluate(() => ({
      message: document.getElementById('inErr').textContent.trim(),
      inputActive: document.getElementById('view-input').classList.contains('active'),
      birthInvalid: document.getElementById('inBirth').classList.contains('field-err')
    }));
    assert.deepEqual(userFacing, {
      message: '1800년 이전 음력 생년월일은 지원하지 않습니다. 양력으로 입력해주세요.',
      inputActive: true,
      birthInvalid: true
    });
  } finally {
    await page.close();
  }
});
