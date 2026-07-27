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

test('maps a modern Asia/Seoul civil-time birth to numeric pillar indexes and legacy daewoon', () => {
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

test('matches the recorded KASI 2024 monthly solar-term boundaries before, at, and after', () => {
  // UTC instants are the KASI-aligned constants shipped by manseryeok 2.0.0.
  // Expected pillars are recorded constants, never generated from the adapter under test.
  const fixtures = [
    [[2024, 1, 6, 5, 49], [9, 3, 0, 0], [9, 3, 1, 1]],
    [[2024, 2, 4, 17, 27], [9, 3, 1, 1], [0, 4, 2, 2]],
    [[2024, 3, 5, 11, 23], [0, 4, 2, 2], [0, 4, 3, 3]],
    [[2024, 4, 4, 16, 2], [0, 4, 3, 3], [0, 4, 4, 4]],
    [[2024, 5, 5, 9, 10], [0, 4, 4, 4], [0, 4, 5, 5]],
    [[2024, 6, 5, 13, 10], [0, 4, 5, 5], [0, 4, 6, 6]],
    [[2024, 7, 6, 23, 20], [0, 4, 6, 6], [0, 4, 7, 7]],
    [[2024, 8, 7, 9, 9], [0, 4, 7, 7], [0, 4, 8, 8]],
    [[2024, 9, 7, 12, 11], [0, 4, 8, 8], [0, 4, 9, 9]],
    [[2024, 10, 8, 4, 0], [0, 4, 9, 9], [0, 4, 0, 10]],
    [[2024, 11, 7, 7, 20], [0, 4, 0, 10], [0, 4, 1, 11]],
    [[2024, 12, 7, 0, 17], [0, 4, 1, 11], [0, 4, 2, 0]]
  ];

  for (const [at, beforeExpected, atExpected] of fixtures) {
    const [year, month, day, hour, minute] = at;
    const boundary = Date.UTC(year, month - 1, day, hour, minute);
    const inputAt = delta => {
      const date = new Date(boundary + delta);
      return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        calendar: 'solar',
        gender: 'F',
        unknown: false,
        dayBoundary: 'midnight'
      };
    };
    const pillarHead = result => [
      result.yStem, result.yBranch, result.mStem, result.mBranch
    ];

    assert.deepEqual(pillarHead(adapter.calculate(inputAt(-60000))), beforeExpected);
    assert.deepEqual(pillarHead(adapter.calculate(inputAt(0))), atExpected);
    assert.deepEqual(pillarHead(adapter.calculate(inputAt(60000))), atExpected);
  }
});

test('requires a birth time only when an unknown-time date contains a solar-term boundary', () => {
  assert.throws(() => adapter.calculate({
    year: 2024, month: 2, day: 4, hour: 0, minute: 0,
    calendar: 'solar', gender: 'F', unknown: true,
    dayBoundary: 'midnight'
  }), error => {
    assert.equal(error.code, 'LEGEND_SOLAR_TERM_TIME_REQUIRED');
    assert.match(error.message, /절입.*태어난 시간|태어난 시간.*절입/);
    return true;
  });

  assert.doesNotThrow(() => adapter.calculate({
    year: 2024, month: 2, day: 5, hour: 0, minute: 0,
    calendar: 'solar', gender: 'F', unknown: true,
    dayBoundary: 'midnight'
  }));
});

test('requires a birth time on every recorded 2024 monthly solar-term date', () => {
  const boundaryDates = [
    [2024, 1, 6],
    [2024, 2, 4],
    [2024, 3, 5],
    [2024, 4, 4],
    [2024, 5, 5],
    [2024, 6, 5],
    [2024, 7, 6],
    [2024, 8, 7],
    [2024, 9, 7],
    [2024, 10, 8],
    [2024, 11, 7],
    [2024, 12, 7]
  ];

  for (const [year, month, day] of boundaryDates) {
    assert.throws(() => adapter.calculate({
      year, month, day, hour: 0, minute: 0,
      calendar: 'solar', gender: 'F', unknown: true,
      dayBoundary: 'midnight'
    }), error => error.code === 'LEGEND_SOLAR_TERM_TIME_REQUIRED',
    `unknown time must be rejected on ${year}-${month}-${day}`);
  }
});

test('honors recorded Asia/Seoul civil offsets without longitude or equation-of-time correction', () => {
  // Solar-term instants: KASI-aligned manseryeok 2.0.0 table.
  // Civil offsets and DST: IANA tzdb Asia/Seoul transition history.
  const fixtures = [
    {
      input: [1908, 9, 8, 10, 30],
      expected: [4, 8, 7, 9, 2, 2, 9, 5]
    },
    {
      input: [1912, 3, 6, 7, 21],
      expected: [8, 0, 9, 3, 7, 5, 8, 4]
    },
    {
      input: [1954, 4, 5, 16, 45],
      expected: [0, 6, 4, 4, 7, 3, 2, 8]
    },
    {
      input: [1955, 6, 6, 20, 58],
      expected: [1, 7, 7, 5, 4, 10, 8, 10]
    },
    {
      input: [1961, 6, 6, 7, 30],
      expected: [7, 1, 0, 6, 6, 6, 6, 4]
    },
    {
      input: [1988, 9, 7, 19, 30],
      expected: [4, 4, 6, 8, 1, 1, 2, 10]
    }
  ];

  for (const fixture of fixtures) {
    const [year, month, day, hour, minute] = fixture.input;
    const result = adapter.calculate({
      year, month, day, hour, minute,
      calendar: 'solar', gender: 'F', unknown: false,
      dayBoundary: 'midnight'
    });
    assert.deepEqual(
      [
        result.yStem, result.yBranch, result.mStem, result.mBranch,
        result.dStem, result.dBranch, result.hStem, result.hBranch
      ],
      fixture.expected,
      `historical Asia/Seoul fixture ${fixture.input.join('-')}`
    );
    assert.equal(result.timeStandard, 'asia-seoul-civil');
    assert.equal(result.trueSolarCorrection, false);
  }
});

test('honors historical Korean DST at recorded 1955 and 1988 solar-term boundaries', () => {
  // These local civil times include the UTC+9:30 (1955) and UTC+10 (1988)
  // daylight-saving offsets recorded for Asia/Seoul in IANA tzdb.
  const fixtures = [
    {
      before: [1955, 6, 6, 21, 12],
      at: [1955, 6, 6, 21, 13],
      beforeExpected: [1, 7, 7, 5, 4, 10, 9, 11],
      atExpected: [1, 7, 8, 6, 4, 10, 9, 11]
    },
    {
      before: [1988, 9, 7, 20, 11],
      at: [1988, 9, 7, 20, 12],
      beforeExpected: [4, 4, 6, 8, 1, 1, 2, 10],
      atExpected: [4, 4, 7, 9, 1, 1, 2, 10]
    }
  ];

  const calculate = input => {
    const [year, month, day, hour, minute] = input;
    const result = adapter.calculate({
      year, month, day, hour, minute,
      calendar: 'solar', gender: 'F', unknown: false,
      dayBoundary: 'midnight'
    });
    return [
      result.yStem, result.yBranch, result.mStem, result.mBranch,
      result.dStem, result.dBranch, result.hStem, result.hBranch
    ];
  };

  for (const fixture of fixtures) {
    assert.deepEqual(calculate(fixture.before), fixture.beforeExpected);
    assert.deepEqual(calculate(fixture.at), fixture.atExpected);
  }
});

test('historical civil offsets do not shift the wall-clock day or hour pillars', () => {
  const fixtures = [
    [1954, 4, 5, 0, 40],
    [1955, 6, 6, 0, 15],
    [1988, 6, 6, 0, 30]
  ];

  for (const [year, month, day, hour, minute] of fixtures) {
    const input = {
      year, month, day, hour, minute,
      calendar: 'solar', gender: 'F', unknown: false,
      dayBoundary: 'midnight'
    };
    const result = adapter.calculate(input);
    const wallClock = manseryeok.calculateFourPillars({
      year, month, day, hour, minute,
      gender: 'female',
      dayBoundary: 'midnight'
    });
    const wallDay = [
      ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계']
        .indexOf(wallClock.day.heavenlyStem),
      ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해']
        .indexOf(wallClock.day.earthlyBranch)
    ];
    const wallHour = [
      ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계']
        .indexOf(wallClock.hour.heavenlyStem),
      ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해']
        .indexOf(wallClock.hour.earthlyBranch)
    ];

    assert.deepEqual(
      [result.dStem, result.dBranch],
      wallDay,
      `day pillar must preserve civil wall time for ${year}-${month}-${day} ${hour}:${minute}`
    );
    assert.deepEqual(
      [result.hStem, result.hBranch],
      wallHour,
      `hour pillar must preserve civil wall time for ${year}-${month}-${day} ${hour}:${minute}`
    );
    assert.equal(result.trueSolarCorrection, false);
  }
});

test('unknown birth time rejects a day-pillar ambiguity under the jasi boundary', () => {
  assert.throws(() => adapter.calculate({
    year: 2024, month: 3, day: 10, hour: 0, minute: 0,
    calendar: 'solar', gender: 'F', unknown: true,
    dayBoundary: 'jasi'
  }), error => {
    assert.equal(error.code, 'LEGEND_SOLAR_TERM_TIME_REQUIRED');
    assert.match(error.message, /일주|태어난 시간/);
    return true;
  });
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

  const splitJasi = adapter.calculate({
    year: 2024, month: 3, day: 10, hour: 23, minute: 30,
    calendar: 'solar', gender: 'M', unknown: false,
    dayBoundary: 'splitJasi'
  });
  assert.deepEqual([midnight.dStem, midnight.dBranch], [9, 9]);
  assert.deepEqual([midnight.hStem, midnight.hBranch], [8, 0]);
  assert.deepEqual([jasi.dStem, jasi.dBranch], [0, 10]);
  assert.deepEqual([jasi.hStem, jasi.hBranch], [0, 0]);
  assert.deepEqual([splitJasi.dStem, splitJasi.dBranch], [9, 9]);
  assert.deepEqual([splitJasi.hStem, splitJasi.hBranch], [0, 0]);
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
  const fallbackResult = adapter.calculate({
    year: 1800, month: 1, day: 1, hour: 12, minute: 0,
    calendar: 'solar', gender: 'M', unknown: false
  });
  assert.equal(fallbackResult.timeStandard, 'kst-fallback');
  assert.equal(fallbackResult.calculationBasis.yearMonth, 'kst-fallback-solar-terms');
  const civilResult = adapter.calculate({
    year: 1908, month: 4, day: 1, hour: 12, minute: 0,
    calendar: 'solar', gender: 'M', unknown: false
  });
  assert.equal(civilResult.calculationMode, 'kasi-precise');
  assert.equal(civilResult.timeStandard, 'asia-seoul-civil');
  assert.deepEqual(civilResult.calculationBasis, {
    yearMonth: 'historical-civil-solar-terms',
    dayHour: 'civil-wall-clock'
  });
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

test('browser labels pre-1908 KASI calculations as UTC+9 approximations', async () => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href, {
      waitUntil: 'networkidle0'
    });
    await page.evaluate(() => {
      document.querySelector('#segCal [data-val="solar"]').click();
      document.getElementById('inBirth').value = '19000101';
      document.getElementById('inTime').value = '1200';
      document.getElementById('calcBtn').click();
    });
    await new Promise(resolve => setTimeout(resolve, 250));

    const result = await page.evaluate(() => ({
      mode: currentSaju?.calculationMode,
      standard: currentSaju?.timeStandard,
      provenance: document.querySelector('.result-source-legend')?.textContent
        .replace(/\s+/g, ' ')
        .trim()
    }));
    assert.equal(result.mode, 'kasi-solar-kst-fallback');
    assert.equal(result.standard, 'kst-fallback');
    assert.match(result.provenance, /1908년 4월 이전 UTC\+9 기준 근사/);
  } finally {
    await page.close();
  }
});

test('browser famous-person search auto-fills a complete local profile and calculates it', async () => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href, {
      waitUntil: 'networkidle0'
    });
    await page.click('#personSearchBtn');
    await page.evaluate(() => {
      document.getElementById('psQuery').value = '반기문';
      psSearch('반기문');
    });
    await page.waitForSelector('.ps-item[data-kind="local"][data-ymd="19440613"]');
    await page.click('.ps-item[data-kind="local"][data-ymd="19440613"]');
    await page.waitForSelector('#pcbApply');

    const confirmation = await page.evaluate(() => ({
      source: document.querySelector('.ps-confirm-box')?.textContent.replace(/\s+/g, ' ').trim(),
      namuHref: document.querySelector('.ps-confirm-box .ps-namuwiki')?.href
    }));
    assert.match(confirmation.source, /앱 내장 정보\(Wikidata\)/);
    assert.match(confirmation.namuHref, /^https:\/\/namu\.wiki\/Search\?q=/);

    await page.click('#pcbApply');
    await page.waitForFunction(() => currentSaju?.name === '반기문');
    const applied = await page.evaluate(() => ({
      name: document.getElementById('inputName').value,
      birth: document.getElementById('inBirth').value,
      time: document.getElementById('inTime').value,
      gender: document.querySelector('#segGender .active')?.dataset.val,
      genderChecked: document.querySelector('#segGender .active')?.getAttribute('aria-checked'),
      calendar: document.querySelector('#segCal .active')?.dataset.val,
      calendarChecked: document.querySelector('#segCal .active')?.getAttribute('aria-checked'),
      resultName: currentSaju?.name,
      unknown: currentSaju?.unknown
    }));
    assert.deepEqual(applied, {
      name: '반기문',
      birth: '19440613',
      time: '',
      gender: 'M',
      genderChecked: 'true',
      calendar: 'solar',
      calendarChecked: 'true',
      resultName: '반기문',
      unknown: true
    });
  } finally {
    await page.close();
  }
});

test('browser persists the advanced day-boundary choice and explains calculation provenance', async () => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const url = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.removeItem('legend-saju:day-boundary');
    });
    await page.reload({ waitUntil: 'networkidle0' });

    const initial = await page.evaluate(() => {
      document.getElementById('advancedCalculationSettings').open = true;
      return {
        selected: document.querySelector('#segDayBoundary .active')?.dataset.val,
        buttons: [...document.querySelectorAll('#segDayBoundary button')].map(button => ({
          role: button.getAttribute('role'),
          checked: button.getAttribute('aria-checked'),
          height: button.getBoundingClientRect().height
        }))
      };
    });
    assert.equal(initial.selected, 'midnight');
    assert.ok(initial.buttons.every(button => button.role === 'radio'));
    assert.equal(initial.buttons.filter(button => button.checked === 'true').length, 1);
    assert.ok(initial.buttons.every(button => button.height >= 44));

    await page.evaluate(() => {
      document.querySelector('#segDayBoundary [data-val="jasi"]').click();
      document.getElementById('inBirth').value = '20240310';
      document.getElementById('inTime').value = '2330';
      document.getElementById('calcBtn').click();
    });
    await new Promise(resolve => setTimeout(resolve, 250));

    const calculated = await page.evaluate(() => ({
      preference: localStorage.getItem('legend-saju:day-boundary'),
      dayBoundary: currentSaju?.dayBoundary,
      day: [currentSaju?.dStem, currentSaju?.dBranch],
      hour: [currentSaju?.hStem, currentSaju?.hBranch],
      sources: document.querySelector('.result-source-legend')?.textContent.replace(/\s+/g, ' ').trim()
    }));
    assert.deepEqual(calculated.day, [0, 10]);
    assert.deepEqual(calculated.hour, [0, 0]);
    assert.equal(calculated.preference, 'jasi');
    assert.equal(calculated.dayBoundary, 'jasi');
    assert.match(calculated.sources, /명리 계산 · KASI/);
    assert.match(calculated.sources, /취명선 창작 규칙/);

    await page.reload({ waitUntil: 'networkidle0' });
    assert.equal(
      await page.evaluate(() => document.querySelector('#segDayBoundary .active')?.dataset.val),
      'jasi'
    );
  } finally {
    await page.close();
  }
});

test('browser asks for time on a solar-term date but accepts an ordinary unknown-time date', async () => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href, {
      waitUntil: 'networkidle0'
    });
    await page.evaluate(() => {
      document.querySelector('#segDayBoundary [data-val="midnight"]').click();
      document.getElementById('inBirth').value = '20240204';
      document.getElementById('inTime').value = '';
      document.getElementById('calcBtn').click();
    });
    await new Promise(resolve => setTimeout(resolve, 100));

    const ambiguous = await page.evaluate(() => ({
      message: document.getElementById('inErr').textContent.trim(),
      focused: document.activeElement?.id,
      hasResult: Boolean(currentSaju)
    }));
    assert.match(ambiguous.message, /절입.*태어난 시간|태어난 시간.*절입/);
    assert.equal(ambiguous.focused, 'inTime');
    assert.equal(ambiguous.hasResult, false);

    await page.evaluate(() => {
      document.getElementById('inBirth').value = '20240205';
      document.getElementById('calcBtn').click();
    });
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.deepEqual(await page.evaluate(() => ({
      hasResult: Boolean(currentSaju),
      unknown: currentSaju?.unknown,
      hour: [currentSaju?.hStem, currentSaju?.hBranch]
    })), {
      hasResult: true,
      unknown: true,
      hour: [-1, -1]
    });
  } finally {
    await page.close();
  }
});

test('browser match form accepts a real leap month and rejects an impossible one', async () => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href, {
      waitUntil: 'networkidle0'
    });
    const controlState = await page.evaluate(() => {
      matchPickerTarget = 'A';
      openMatchNewForm();
      document.querySelector('#mnfCal [data-val="lunar"]').click();
      return {
        hidden: document.getElementById('mnfLunarMonthTypeField').hidden,
        groupRole: document.getElementById('mnfLeapMonth').getAttribute('role'),
        labelledBy: document.getElementById('mnfLeapMonth').getAttribute('aria-labelledby'),
        controls: [...document.querySelectorAll('#mnfLeapMonth button')].map(button => ({
          disabled: button.disabled,
          role: button.getAttribute('role'),
          height: button.getBoundingClientRect().height
        }))
      };
    });
    assert.equal(controlState.hidden, false);
    assert.equal(controlState.groupRole, 'radiogroup');
    assert.equal(controlState.labelledBy, 'mnfLeapMonthLabel');
    assert.ok(controlState.controls.every(control => !control.disabled));
    assert.ok(controlState.controls.every(control => control.role === 'radio' && control.height >= 44));

    await page.evaluate(() => {
      document.querySelector('#mnfLeapMonth [data-val="leap"]').click();
      document.getElementById('mnfBirth').value = '20200401';
      document.getElementById('mnfTime').value = '0530';
      submitMatchNewForm();
    });
    await page.waitForFunction(
      () => !document.getElementById('matchNewModal').classList.contains('active')
    );
    assert.deepEqual(await page.evaluate(() => ({
      isLeapMonth: matchSlotA?.isLeapMonth,
      solar: [matchSlotA?.year, matchSlotA?.month, matchSlotA?.day],
      modalOpen: document.getElementById('matchNewModal').classList.contains('active')
    })), {
      isLeapMonth: true,
      solar: [2020, 5, 23],
      modalOpen: false
    });

    let dialogMessage = '';
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });
    await page.evaluate(() => {
      matchPickerTarget = 'B';
      openMatchNewForm();
      document.querySelector('#mnfCal [data-val="lunar"]').click();
      document.querySelector('#mnfLeapMonth [data-val="leap"]').click();
      document.getElementById('mnfBirth').value = '20240201';
      document.getElementById('mnfTime').value = '0530';
      submitMatchNewForm();
    });
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.match(dialogMessage, /윤2월이 존재하지 않습니다/);
    assert.equal(await page.evaluate(() => matchSlotB === null), true);
  } finally {
    await page.close();
  }
});

test('browser keeps saved UI indeterminate and labels all legend evidence sources on failures and results', async () => {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href, {
      waitUntil: 'networkidle0'
    });
    const storageState = await page.evaluate(async () => {
      const content = document.getElementById('savedContent');
      content.textContent = '기존 명반 화면 유지';
      window.storage.list = async () => { throw new Error('temporary primary failure'); };
      await renderSaved();
      return {
        content: content.textContent.trim(),
        toast: document.getElementById('appToast').textContent.trim()
      };
    });
    assert.equal(storageState.content, '기존 명반 화면 유지');
    assert.match(storageState.toast, /저장소 상태를 확인할 수 없습니다/);

    await page.reload({ waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      document.getElementById('inputName').value = '근거검증';
      document.getElementById('inBirth').value = '19921024';
      document.getElementById('inTime').value = '0530';
      document.getElementById('calcBtn').click();
    });
    await new Promise(resolve => setTimeout(resolve, 250));
    await page.evaluate(() => {
      window.activateLegendDestination('legend');
      document.querySelector('.legend-evidence-button').click();
    });
    await new Promise(resolve => setTimeout(resolve, 50));
    const evidence = await page.evaluate(() => ({
      open: document.getElementById('legendEvidenceModal').open,
      scrollTop: document.getElementById('legendEvidenceModal').scrollTop,
      focused: document.activeElement?.id,
      text: document.getElementById('legendEvidenceModal').textContent.replace(/\s+/g, ' ').trim(),
      kinds: [...document.querySelectorAll('.legend-evidence-kind')].map(node => node.textContent.trim())
    }));
    assert.equal(evidence.open, true);
    assert.equal(evidence.scrollTop, 0);
    assert.equal(evidence.focused, 'legendEvidenceTitle');
    assert.match(evidence.text, /명리 계산 · KASI/);
    assert.match(evidence.text, /간이 용신 후보/);
    assert.match(evidence.text, /취명선 창작 규칙/);
    assert.match(evidence.text, /지지 \d+, 소모 \d+/);
    assert.equal(evidence.kinds.length, 5);
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
