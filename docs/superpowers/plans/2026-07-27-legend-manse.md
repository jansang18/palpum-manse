# 취명선 전설의 만세력 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 취명선 만세력을 KASI 기반 정밀 계산, 삼원구운 개인 공명 해석, 수묵 두루마리 인터페이스를 갖춘 별도 PWA로 완성하고 `https://jansang18.github.io/legend-manse/`에 배포한다.

**Architecture:** 기존 정적 PWA와 저장 형식을 유지하되, 새 계산과 해석은 독립적인 UMD 모듈로 분리한다. `manseryeok@2.0.0`을 고정 버전 브라우저 번들로 만들고 어댑터가 기존 `calcSaju` 결과 형식으로 변환한다. 삼원구운, 공명 점수, 서사 생성은 순수 함수로 구현하고 DOM 계층은 계산 결과만 소비한다.

**Tech Stack:** HTML5, CSS, vanilla JavaScript, Node.js 18+, Node test runner, Puppeteer Core, esbuild, `manseryeok@2.0.0`, GitHub Pages

## Global Constraints

- 기존 `jansang18/sineum-manse` 저장소와 `https://jansang18.github.io/sineum-manse/` 배포는 변경하지 않는다.
- 새 저장소와 배포 슬러그는 `jansang18/legend-manse`와 `/legend-manse/`를 사용한다.
- 건물, 좌향, 방위, 현공비성 계산은 포함하지 않는다.
- 20년 원운은 시대 배경, 10년 대운은 개인 명리 흐름으로 분리한다.
- 전통 계산은 `명리 계산`, 결합 해석은 `취명선 전설 해석`으로 표시한다.
- 기본 시간대는 `Asia/Seoul`, 기본 일 경계는 자정, 진태양시는 기본 끔이다.
- 런타임에서 출생 정보를 외부 서버로 전송하지 않는다.
- `prefers-reduced-motion`, `prefers-reduced-transparency`, 키보드 탐색, WCAG AA 대비를 유지한다.
- 생산 코드는 대응하는 실패 테스트를 먼저 확인한 뒤 작성한다.

---

## File Map

### New runtime modules

- `scripts/vendor/manseryeok.browser.js`: `manseryeok@2.0.0` 고정 브라우저 번들
- `scripts/manseryeok-adapter.js`: 패키지 결과를 기존 숫자 인덱스 명반 형식으로 변환
- `scripts/legend-era.js`: 180년 삼원과 20년 구운 계산
- `scripts/legend-resonance.js`: 원운과 개인 오행의 공명 관계 및 근거 계산
- `scripts/legend-copy.js`: 계산 결과를 안전한 구조화 서사로 변환
- `scripts/legend-view.js`: 전설 표지, 시간 두루마리, 상세 근거 DOM 렌더링
- `scripts/legend-nav.js`: 모바일 하단 탐색과 더보기 메뉴
- `styles/legend-tokens.css`: 한지, 먹, 낙관, 오행 디자인 토큰
- `styles/legend-layout.css`: 전설 화면 레이아웃과 반응형 규칙
- `styles/legend-motion.css`: 먹 번짐, 안개, 계층 전환과 감소 모드
- `assets/legend-landscape.webp`: 앱 전용 수묵 산수 배경
- `assets/legend-seal.webp`: 취명선 전설 낙관

### Modified application files

- `index.html`: 새 브랜드, 탭, 입력 옵션, 스크립트 로드, 전설 화면 마운트
- `share.js`: 전설 공유 카드
- `nav.js`: 새 탭과 브라우저/Android 뒤로가기
- `manifest.webmanifest`: 독립 PWA 이름, 색상, scope
- `sw.js`: 독립 캐시 이름과 새 자산 프리캐시
- `tests/ui-regression.js`: 저장소 루트 자동 감지와 전설 UI 회귀 검사
- `scripts/build-protected.ps1`: 새 모듈과 자산을 배포 목록에 포함

### New tests and tooling

- `package.json`: 고정 의존성과 테스트/빌드 명령
- `package-lock.json`: 재현 가능한 설치
- `scripts/build-vendor.mjs`: manseryeok 브라우저 번들 생성
- `tests/ganji-fixtures.test.js`: 절기, 자시, 음력 변환 검증
- `tests/legend-era.test.js`: 20년/180년 경계 검증
- `tests/legend-resonance.test.js`: 점수와 근거 검증
- `tests/legend-copy.test.js`: 서사 구조와 안전한 문자열 검증
- `tests/pwa-isolation.test.js`: 원본과 분리된 PWA 설정 검증

---

### Task 1: Reproducible Test and Vendor Build Foundation

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `scripts/build-vendor.mjs`
- Modify: `tests/ui-regression.js:1-24`

**Interfaces:**
- Produces: `npm run build:vendor`, `npm run test:core`, `npm run test:ui`
- Produces: `scripts/vendor/manseryeok.browser.js`

- [ ] **Step 1: Write the failing repository-root inference test**

Add a source contract near the existing test bootstrap:

```js
function inspectRepositoryRootInference() {
  const source = fs.readFileSync(__filename, 'utf8');
  assert.match(source, /path\.join\(repoRoot,\s*'index\.html'\)/);
  assert.match(source, /UI_ROOT[\s\S]*repoRoot/);
}
```

Call it before browser launch. It must fail because the current inference skips from `tests` two levels upward.

- [ ] **Step 2: Run the failing test**

Run:

```powershell
$env:TEST_GROUP='repository-root'; node tests/ui-regression.js
```

Expected: FAIL on `path.join(repoRoot, 'index.html')`.

- [ ] **Step 3: Add package and build contracts**

Create `package.json`:

```json
{
  "name": "legend-manse",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build:vendor": "node scripts/build-vendor.mjs",
    "test:core": "node --test tests/*.test.js",
    "test:ui": "node tests/ui-regression.js",
    "test": "npm run test:core && npm run test:ui"
  },
  "dependencies": {
    "manseryeok": "2.0.0"
  },
  "devDependencies": {
    "esbuild": "0.25.8",
    "puppeteer-core": "24.16.0"
  }
}
```

Create `scripts/build-vendor.mjs`:

```js
import { build } from 'esbuild';

await build({
  stdin: {
    contents: `
      import * as api from 'manseryeok';
      globalThis.Manseryeok = Object.freeze(api);
    `,
    resolveDir: process.cwd(),
    sourcefile: 'manseryeok-entry.js'
  },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  outfile: 'scripts/vendor/manseryeok.browser.js',
  minify: true,
  legalComments: 'eof'
});
```

Run `npm install` and `npm run build:vendor`.

- [ ] **Step 4: Fix the UI test root inference**

Use:

```js
const repoRoot = path.resolve(__dirname, '..');
const inferredUiRoot = fs.existsSync(path.join(repoRoot, 'index.html'))
  ? repoRoot
  : path.join(path.resolve(__dirname, '..', '..'), 'www');
const UI_ROOT = process.env.UI_ROOT
  ? path.resolve(process.cwd(), process.env.UI_ROOT)
  : inferredUiRoot;
```

Add `repository-root` to the one-width test-group path and exit after the contract passes.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm run build:vendor
$env:TEST_GROUP='repository-root'; npm run test:ui
```

Expected: vendor bundle exists and repository-root test passes.

Commit:

```powershell
git add package.json package-lock.json scripts/build-vendor.mjs scripts/vendor/manseryeok.browser.js tests/ui-regression.js
git commit -m "build: add reproducible legend test foundation"
```

---

### Task 2: KASI-Backed Ganji Adapter

**Files:**
- Create: `scripts/manseryeok-adapter.js`
- Create: `tests/ganji-fixtures.test.js`
- Modify: `index.html:12309-12606`

**Interfaces:**
- Consumes: `globalThis.Manseryeok.calculateFourPillars`
- Produces: `LegendGanji.calculate(input)`
- Produces: the current chart shape with `yStem`, `yBranch`, `mStem`, `mBranch`, `dStem`, `dBranch`, `hStem`, `hBranch`, `daeun`

- [ ] **Step 1: Write failing ordinary and boundary fixtures**

Create:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const manseryeok = require('manseryeok');
const { createAdapter } = require('../scripts/manseryeok-adapter.js');

const adapter = createAdapter(manseryeok);

test('maps a normal KST birth to numeric pillar indexes', () => {
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
  assert.notDeepEqual([before.yStem, before.yBranch], [after.yStem, after.yBranch]);
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
  assert.notDeepEqual([midnight.dStem, midnight.dBranch], [jasi.dStem, jasi.dBranch]);
});
```

- [ ] **Step 2: Run the tests and verify missing-module failure**

Run:

```powershell
node --test tests/ganji-fixtures.test.js
```

Expected: FAIL because `scripts/manseryeok-adapter.js` does not exist.

- [ ] **Step 3: Implement the adapter**

Use a UMD wrapper and explicit maps:

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LegendGanji = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const stems = ['갑','을','병','정','무','기','경','신','임','계'];
  const branches = ['자','축','인','묘','진','사','오','미','신','유','술','해'];

  function indexPillar(pillar) {
    return {
      stem: stems.indexOf(pillar.heavenlyStem),
      branch: branches.indexOf(pillar.earthlyBranch)
    };
  }

  function createAdapter(engine) {
    function calculate(input) {
      const result = engine.calculateFourPillars({
        year: input.year,
        month: input.month,
        day: input.day,
        hour: input.unknown ? 12 : input.hour,
        minute: input.unknown ? 0 : input.minute,
        isLunar: input.calendar === 'lunar',
        isLeapMonth: Boolean(input.isLeapMonth),
        dayBoundary: input.dayBoundary || 'midnight',
        gender: input.gender === 'M' ? 'male' : 'female'
      });
      const y = indexPillar(result.year);
      const m = indexPillar(result.month);
      const d = indexPillar(result.day);
      const h = input.unknown ? { stem: -1, branch: -1 } : indexPillar(result.hour);
      return {
        yStem: y.stem, yBranch: y.branch,
        mStem: m.stem, mBranch: m.branch,
        dStem: d.stem, dBranch: d.branch,
        hStem: h.stem, hBranch: h.branch,
        engineResult: result
      };
    }
    return Object.freeze({ calculate });
  }

  return Object.freeze({ createAdapter });
});
```

Extend it to map `luckPillars` into the existing `{ num, forward, list }` shape and to preserve converted solar/lunar dates from the package APIs.

- [ ] **Step 4: Integrate without deleting legacy derived analysis**

Load scripts before the inline application script:

```html
<script src="scripts/vendor/manseryeok.browser.js"></script>
<script src="scripts/manseryeok-adapter.js"></script>
```

At the start of `calcSaju`, use the adapter for 1800–2099 and retain the existing functions only for the unsupported historical solar range. Continue calculating current `sipsin`, `sipsinJi`, `ohaeng`, `interactions`, `shinsal`, and `gongmang` from the adapter's pillar indexes.

Return:

```js
calculationMode: year >= 1800 ? 'kasi-precise' : 'legacy-approximate'
```

Show `정밀 계산` or `역사 범위 근사 계산` beside the result date.

- [ ] **Step 5: Verify all fixtures and commit**

Run:

```powershell
npm run test:core
$env:TEST_GROUP='frontend-quality'; npm run test:ui
```

Expected: all ganji fixtures pass and the standard input flow still renders eight pillar glyphs.

Commit:

```powershell
git add scripts/manseryeok-adapter.js tests/ganji-fixtures.test.js index.html
git commit -m "feat: use KASI-backed ganji calculations"
```

---

### Task 3: Samwon Gugun Era Engine

**Files:**
- Create: `scripts/legend-era.js`
- Create: `tests/legend-era.test.js`

**Interfaces:**
- Produces: `LegendEra.getLegendEra(year)`
- Produces: `{ cycle, cycleStart, cycleEnd, yuan, yun, yunStart, yunEnd, trigram, element, symbol, progress }`

- [ ] **Step 1: Write failing boundary tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { getLegendEra } = require('../scripts/legend-era.js');

test('maps the current lower yuan ninth period', () => {
  assert.deepEqual(
    getLegendEra(2024),
    {
      cycle: 1, cycleStart: 1864, cycleEnd: 2043,
      yuan: '하원', yun: 9, yunStart: 2024, yunEnd: 2043,
      trigram: '리', hanja: '離', element: '화',
      symbol: '빛', progress: 0.025
    }
  );
});

test('changes period at every twenty-year boundary', () => {
  assert.equal(getLegendEra(2023).yun, 8);
  assert.equal(getLegendEra(2024).yun, 9);
  assert.equal(getLegendEra(2043).yun, 9);
  assert.equal(getLegendEra(2044).yun, 1);
});

test('repeats safely before the 1864 anchor', () => {
  assert.equal(getLegendEra(1684).yun, 1);
  assert.equal(getLegendEra(1863).yun, 9);
});
```

- [ ] **Step 2: Run and verify missing-module failure**

Run: `node --test tests/legend-era.test.js`

Expected: FAIL because `scripts/legend-era.js` is absent.

- [ ] **Step 3: Implement the pure era calculation**

Use floor division that handles negative years:

```js
const anchor = 1864;
const periodData = [
  ['상원', 1, '감', '坎', '수', '심연'],
  ['상원', 2, '곤', '坤', '토', '대지'],
  ['상원', 3, '진', '震', '목', '천둥'],
  ['중원', 4, '손', '巽', '목', '바람'],
  ['중원', 5, '중궁', '中', '토', '중심'],
  ['중원', 6, '건', '乾', '금', '하늘'],
  ['하원', 7, '태', '兌', '금', '호수'],
  ['하원', 8, '간', '艮', '토', '산'],
  ['하원', 9, '리', '離', '화', '빛']
];

const cycleOffset = Math.floor((year - anchor) / 180);
const cycleStart = anchor + cycleOffset * 180;
const yearInCycle = year - cycleStart;
const periodIndex = Math.floor(yearInCycle / 20);
```

Clamp and round progress to three decimals:

```js
progress: Math.round(((year - yunStart + 0.5) / 20) * 1000) / 1000
```

- [ ] **Step 4: Verify and commit**

Run: `node --test tests/legend-era.test.js`

Expected: all boundary cases pass.

Commit:

```powershell
git add scripts/legend-era.js tests/legend-era.test.js
git commit -m "feat: add samwon gugun era engine"
```

---

### Task 4: Personal Resonance and Explainable Legend Copy

**Files:**
- Create: `scripts/legend-resonance.js`
- Create: `scripts/legend-copy.js`
- Create: `tests/legend-resonance.test.js`
- Create: `tests/legend-copy.test.js`

**Interfaces:**
- Consumes: `LegendEra.getLegendEra(year)`
- Consumes: chart `{ dStem, ohaeng, daeun }`
- Produces: `LegendResonance.calculateResonance(context)`
- Produces: `LegendCopy.buildNarrative(context)`

- [ ] **Step 1: Write failing scoring tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateResonance } = require('../scripts/legend-resonance.js');

test('returns a transparent five-part score', () => {
  const result = calculateResonance({
    eraElement: '화',
    dayElement: '목',
    usefulElement: '화',
    elements: { 목: 3, 화: 0, 토: 2, 금: 2, 수: 1 },
    daeunElement: '목',
    shortElement: '토'
  });
  assert.equal(result.relation, '표출');
  assert.equal(result.parts.useful.max, 35);
  assert.equal(result.parts.day.max, 25);
  assert.equal(result.parts.balance.max, 20);
  assert.equal(result.parts.daeun.max, 15);
  assert.equal(result.parts.short.max, 5);
  assert.equal(
    result.score,
    Object.values(result.parts).reduce((sum, part) => sum + part.score, 0)
  );
  assert.match(result.parts.useful.reason, /용신 후보/);
});

test('never exceeds the declared score range', () => {
  const result = calculateResonance({
    eraElement: '화', dayElement: '화', usefulElement: '화',
    elements: { 목: 0, 화: 0, 토: 0, 금: 0, 수: 8 },
    daeunElement: '화', shortElement: '화'
  });
  assert.ok(result.score >= 0 && result.score <= 100);
});
```

- [ ] **Step 2: Write failing narrative safety tests**

```js
const { buildNarrative } = require('../scripts/legend-copy.js');

test('builds six structured sections without HTML', () => {
  const result = buildNarrative({
    name: '<img src=x onerror=alert(1)>',
    era: { yun: 9, element: '화', symbol: '빛' },
    resonance: { relation: '생조', score: 78 }
  });
  assert.equal(result.sections.length, 6);
  assert.ok(result.sections.every(section => section.title && section.summary && section.body));
  assert.equal(JSON.stringify(result).includes('<img'), false);
  assert.match(result.heroTitle, /빛의 시대/);
});
```

- [ ] **Step 3: Run and verify both modules are missing**

Run:

```powershell
node --test tests/legend-resonance.test.js tests/legend-copy.test.js
```

Expected: FAIL with missing module errors.

- [ ] **Step 4: Implement deterministic element relations**

Represent the generating cycle as:

```js
const GENERATES = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
const CONTROLS = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' };
```

Return one of `동조`, `생조`, `표출`, `압력`, `제어`. Each score part must contain `{ score, max, reason }`, and the final score must be the exact sum of the five clamped parts.

- [ ] **Step 5: Implement structured copy templates**

Return plain strings only:

```js
{
  heroTitle: '빛의 시대에 선 홍길동',
  heroSummary: '...',
  sections: [
    { key: 'era', hanja: '時', title: '시대와 나', summary: '...', body: '...' },
    { key: 'work', hanja: '業', title: '일과 역할', summary: '...', body: '...' },
    { key: 'wealth', hanja: '財', title: '재물과 기반', summary: '...', body: '...' },
    { key: 'relation', hanja: '情', title: '관계와 마음', summary: '...', body: '...' },
    { key: 'rhythm', hanja: '身', title: '몸과 리듬', summary: '...', body: '...' },
    { key: 'action', hanja: '行', title: '이번 운의 한 수', summary: '...', body: '...' }
  ]
}
```

Sanitize user names by removing control characters and `<`, `>`, `"`, `'`, then limit them to 40 characters.

- [ ] **Step 6: Verify and commit**

Run: `npm run test:core`

Expected: era, resonance, and copy tests all pass.

Commit:

```powershell
git add scripts/legend-resonance.js scripts/legend-copy.js tests/legend-resonance.test.js tests/legend-copy.test.js
git commit -m "feat: add explainable legend resonance"
```

---

### Task 5: Legend Data Flow and Hourly Fortune

**Files:**
- Create: `scripts/legend-view.js`
- Modify: `index.html:1986-2110`
- Modify: `index.html:12451-12606`
- Modify: `index.html:13000-13520`
- Modify: `tests/ui-regression.js`

**Interfaces:**
- Consumes: `currentSaju`, selected daewoon, seun, woon, day
- Produces: `window.renderLegend(currentSaju)`
- Produces: `getHourlyFortunes(year, month, day, dayStem)`

- [ ] **Step 1: Add failing UI and hourly contracts**

Add a `legend-flow` test group:

```js
async function inspectLegendFlow(page, width) {
  await page.type('#inBirth', '19921024');
  await page.type('#inTime', '0530');
  await page.click('#calcBtn');
  await page.click('.tab[data-tab="legend"]');
  const state = await page.evaluate(() => ({
    hero: document.querySelector('[data-legend-hero]')?.textContent,
    layers: [...document.querySelectorAll('[data-time-layer]')]
      .map(node => node.getAttribute('data-time-layer')),
    hourlyCount: document.querySelectorAll('[data-hour-branch]').length,
    evidenceButtons: document.querySelectorAll('[data-legend-evidence]').length
  }));
  assert.match(state.hero, /시대/);
  assert.deepEqual(state.layers, ['cycle','yun','natal','daeun','seun','month','day','hour']);
  assert.equal(state.hourlyCount, 12);
  assert.ok(state.evidenceButtons >= 1);
}
```

- [ ] **Step 2: Run and verify the legend tab is absent**

Run:

```powershell
$env:TEST_GROUP='legend-flow'; npm run test:ui
```

Expected: FAIL because `.tab[data-tab="legend"]` does not exist.

- [ ] **Step 3: Add the legend view mount and script loading**

Add:

```html
<button type="button" class="tab" id="tab-legend" role="tab"
  aria-selected="false" aria-controls="view-legend" data-tab="legend">전설</button>
<section class="view" id="view-legend" role="tabpanel"
  aria-labelledby="tab-legend" hidden>
  <div id="legendContent" aria-live="polite"></div>
</section>
```

Load the modules in dependency order before `share.js`:

```html
<script src="scripts/legend-era.js"></script>
<script src="scripts/legend-resonance.js"></script>
<script src="scripts/legend-copy.js"></script>
<script src="scripts/legend-view.js"></script>
```

- [ ] **Step 4: Implement hourly fortune generation**

Use the existing `getHourStem(dayStem, branch)` for twelve branches:

```js
function getHourlyFortunes(year, month, day, dayStem) {
  return BRANCH.map((branch, branchIndex) => ({
    branchIndex,
    branch,
    startHour: branchIndex === 0 ? 23 : branchIndex * 2 - 1,
    stem: getHourStem(dayStem, branchIndex),
    sipsin: getSipsin(currentSaju.dStem, getHourStem(dayStem, branchIndex))
  }));
}
```

The selected day must feed this function. If birth time is unknown, natal hour remains unknown while daily hourly fortune remains available.

- [ ] **Step 5: Implement DOM rendering with safe APIs**

`legend-view.js` must create user-derived text with `textContent`, not template interpolation. The eight time layers must use:

```html
<article class="legend-layer" data-time-layer="cycle"></article>
```

Evidence buttons set `data-legend-evidence` and open a dialog containing the five resonance parts and their reasons.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
$env:TEST_GROUP='legend-flow'; npm run test:ui
npm run test:core
```

Expected: eight layers render, twelve hourly items exist, and at least one evidence dialog trigger is present.

Commit:

```powershell
git add index.html scripts/legend-view.js tests/ui-regression.js
git commit -m "feat: add legend timeline and hourly fortune"
```

---

### Task 6: Ink-Wash Brand System and Original Assets

**Files:**
- Create: `styles/legend-tokens.css`
- Create: `styles/legend-layout.css`
- Create: `styles/legend-motion.css`
- Create: `assets/legend-landscape.webp`
- Create: `assets/legend-seal.webp`
- Modify: `index.html:1-30`
- Modify: `index.html:1966-1968`
- Modify: `tests/ui-regression.js`

**Interfaces:**
- Produces: CSS variables `--paper`, `--ink`, `--seal`, `--wood`, `--fire`, `--earth`, `--metal`, `--water`
- Produces: `[data-legend-hero]`, `.legend-scroll`, `.legend-section`, `.legend-seal`

- [ ] **Step 1: Add failing visual token and accessibility contracts**

```js
function inspectLegendSourceContracts() {
  const html = fs.readFileSync(path.join(UI_ROOT, 'index.html'), 'utf8');
  const tokens = fs.readFileSync(path.join(UI_ROOT, 'styles', 'legend-tokens.css'), 'utf8');
  const motion = fs.readFileSync(path.join(UI_ROOT, 'styles', 'legend-motion.css'), 'utf8');
  assert.match(html, /<title>취명선 전설의 만세력<\/title>/);
  for (const token of ['--paper','--ink','--seal','--wood','--fire','--earth','--metal','--water']) {
    assert.match(tokens, new RegExp(token.replace('--', '--')));
  }
  assert.match(motion, /prefers-reduced-motion:\s*reduce/);
  assert.match(motion, /prefers-reduced-transparency:\s*reduce/);
}
```

- [ ] **Step 2: Run and verify missing style files**

Run:

```powershell
$env:TEST_GROUP='legend-source'; npm run test:ui
```

Expected: FAIL because the legend styles do not exist.

- [ ] **Step 3: Generate original app assets**

Use the image-generation tool with this art direction:

```text
Wide Korean ink-wash landscape for a web application, warm ivory hanji paper,
layered misty mountains, a narrow river winding from distance to foreground,
one small vermilion sun, charcoal and desaturated mineral pigments, generous
negative space on the left for typography, subtle paper fibers, refined
editorial illustration, no text, no logos, no border, 16:9.
```

Generate a separate square seal:

```text
Minimal Korean-style vermilion seal mark on transparent background, abstract
combination of mountain, river, and the character 傳, hand-carved irregular
edges, one-color dark vermilion, no surrounding text, square composition.
```

Export the files to the exact asset paths above and inspect them at desktop and mobile crops.

- [ ] **Step 4: Implement the design tokens**

Use:

```css
:root {
  --paper: #f2ecdd;
  --paper-bright: #faf7ee;
  --ink: #20231f;
  --ink-muted: #77786f;
  --seal: #9e3e32;
  --wood: #3e6b57;
  --fire: #a94732;
  --earth: #9a742f;
  --metal: #6d7372;
  --water: #355d6b;
  --legend-radius: 2px;
  --legend-shadow: 0 18px 60px rgb(45 38 25 / 0.12);
}
```

Use paper texture through the generated image and lightweight CSS noise, not a repeated large bitmap.

- [ ] **Step 5: Implement responsive scroll and motion**

Desktop legend sections alternate typography and illustration while preserving a single reading column. Mobile sections stack with the large Hanja above the title. Add only:

```css
@keyframes legend-mist-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .legend-section, .legend-layer { animation: none !important; transform: none !important; }
}

@media (prefers-reduced-transparency: reduce) {
  .legend-paper-panel { background: var(--paper-bright); backdrop-filter: none; }
}
```

- [ ] **Step 6: Verify responsive output and commit**

Run:

```powershell
$env:TEST_GROUP='legend-source'; npm run test:ui
$env:TEST_GROUP='legend-flow'; npm run test:ui
```

Capture 390px and 1220px screenshots through Puppeteer and inspect text contrast, asset crop, and horizontal overflow.

Commit:

```powershell
git add styles assets index.html tests/ui-regression.js
git commit -m "feat: apply ink wash legend art direction"
```

---

### Task 7: Navigation, Evidence Dialog, and Responsive Accessibility

**Files:**
- Create: `scripts/legend-nav.js`
- Modify: `index.html`
- Modify: `nav.js`
- Modify: `styles/legend-layout.css`
- Modify: `tests/ui-regression.js`

**Interfaces:**
- Produces: `window.openLegendEvidence(data)`
- Produces: mobile destinations `input`, `result`, `legend`, `calendar`, `saved`
- Produces: more-menu destinations `match`, `about`

- [ ] **Step 1: Add failing keyboard and mobile navigation tests**

```js
async function inspectLegendNavigation(page, width) {
  const state = await page.evaluate(() => ({
    primary: [...document.querySelectorAll('[data-legend-primary-nav]')]
      .map(node => node.dataset.tab),
    more: [...document.querySelectorAll('[data-legend-more-nav]')]
      .map(node => node.dataset.tab),
    dialog: {
      role: document.getElementById('legendEvidenceModal')?.getAttribute('role'),
      modal: document.getElementById('legendEvidenceModal')?.getAttribute('aria-modal')
    }
  }));
  assert.deepEqual(state.primary, ['input','result','legend','calendar','saved']);
  assert.deepEqual(state.more, ['match','about']);
  assert.deepEqual(state.dialog, { role: 'dialog', modal: 'true' });
}
```

- [ ] **Step 2: Run and verify missing navigation**

Run:

```powershell
$env:TEST_GROUP='legend-navigation'; npm run test:ui
```

Expected: FAIL because the primary and more navigation do not exist.

- [ ] **Step 3: Implement navigation and dialog ownership**

Use one `activateLegendDestination(tabName)` function for top tabs and bottom navigation. Reuse the existing modal focus trap and `closeTopAppOverlay` ownership model. `nav.js` must close, in order:

1. evidence dialog
2. more menu
3. existing share and form dialogs
4. return to previous tab

The evidence dialog must restore focus to its opening button.

- [ ] **Step 4: Verify keyboard, back action, and 200% zoom**

Run:

```powershell
$env:TEST_GROUP='legend-navigation'; npm run test:ui
$env:TEST_GROUP='viewport-zoom'; npm run test:ui
```

Expected: navigation order is stable, modal semantics are present, and no horizontal overflow appears.

- [ ] **Step 5: Commit**

```powershell
git add scripts/legend-nav.js index.html nav.js styles/legend-layout.css tests/ui-regression.js
git commit -m "feat: add accessible legend navigation"
```

---

### Task 8: Storage, Sharing, and PWA Isolation

**Files:**
- Create: `tests/pwa-isolation.test.js`
- Modify: `index.html`
- Modify: `share.js`
- Modify: `manifest.webmanifest`
- Modify: `sw.js`
- Modify: `scripts/build-protected.ps1`

**Interfaces:**
- Produces: storage prefix `legend-saju:`
- Produces: export metadata `{ product: 'legend-manse', schemaVersion: 2, ruleVersion: 'legend-1' }`
- Produces: PWA cache prefix `legend-manse-`

- [ ] **Step 1: Write failing PWA isolation tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('uses legend-specific PWA identity and cache', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
  const sw = fs.readFileSync('sw.js', 'utf8');
  assert.equal(manifest.name, '취명선 전설의 만세력');
  assert.equal(manifest.short_name, '전설의 만세력');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.match(sw, /legend-manse-/);
  assert.doesNotMatch(sw, /chwimyeongseon-manse-/);
});

test('precaches every legend runtime asset', () => {
  const sw = fs.readFileSync('sw.js', 'utf8');
  for (const asset of [
    'styles/legend-tokens.css',
    'styles/legend-layout.css',
    'styles/legend-motion.css',
    'scripts/legend-era.js',
    'scripts/legend-resonance.js',
    'scripts/legend-copy.js',
    'scripts/legend-view.js',
    'assets/legend-landscape.webp',
    'assets/legend-seal.webp'
  ]) assert.match(sw, new RegExp(asset.replaceAll('.', '\\.')));
});
```

- [ ] **Step 2: Run and verify identity mismatch**

Run: `node --test tests/pwa-isolation.test.js`

Expected: FAIL on the old manifest name and cache prefix.

- [ ] **Step 3: Migrate storage without reading the original app namespace**

Use `legend-saju:` for new records. Imports may accept old backup JSON after schema validation, but the live app must not enumerate or modify `saju:` keys created by the original deployment.

Export:

```js
{
  product: 'legend-manse',
  schemaVersion: 2,
  ruleVersion: 'legend-1',
  exportedAt: new Date().toISOString(),
  records
}
```

- [ ] **Step 4: Update share and PWA files**

Share card title:

```text
취명선 전설의 만세력
```

Share body must include current `하원 9운`, the resonance relation, and the existing four pillars without adding health or wealth predictions.

Set manifest colors to `#F2ECDD`, cache prefix to `legend-manse-`, and include every new runtime file in `PRECACHE` and the protected-release inventory.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
node --test tests/pwa-isolation.test.js
$env:TEST_GROUP='service-worker'; npm run test:ui
$env:TEST_GROUP='imported-fields-xss'; npm run test:ui
```

Expected: isolated identity passes, service worker install contract passes, and imported strings remain inert.

Commit:

```powershell
git add index.html share.js manifest.webmanifest sw.js scripts/build-protected.ps1 tests/pwa-isolation.test.js
git commit -m "feat: isolate legend storage and PWA"
```

---

### Task 9: Full Regression and Release Audit

**Files:**
- Modify: `tests/ui-regression.js`
- Modify: `security_best_practices_report.md`
- Modify: `웹배포_안내.md`

**Interfaces:**
- Consumes: all previous runtime modules and UI
- Produces: a clean `npm test` release gate

- [ ] **Step 1: Add exact release assertions**

Add checks for:

```js
assert.equal(document.title, '취명선 전설의 만세력');
assert.equal(document.querySelectorAll('[data-time-layer]').length, 8);
assert.equal(document.querySelectorAll('[data-hour-branch]').length, 12);
assert.equal(document.querySelectorAll('.tab[aria-selected="true"]').length, 1);
assert.ok(document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
```

Run these at 360, 390, 412, 768, and 1220px.

- [ ] **Step 2: Run the full suite before documentation edits**

Run:

```powershell
npm test
```

Expected: PASS with no uncaught page errors, failed requests, console errors, or horizontal overflow.

- [ ] **Step 3: Run source and security checks**

Run:

```powershell
git diff --check
rg -n "innerHTML.*(?:name|memo)|insertAdjacentHTML.*(?:name|memo)|eval\\(|new Function" index.html scripts share.js
rg -n "sineum-manse|chwimyeongseon-manse" manifest.webmanifest sw.js scripts styles
```

Expected: no unsafe user-derived HTML sink, no dynamic code execution, and no old PWA identity in runtime files.

- [ ] **Step 4: Update release documentation**

Document:

- precise calculation range and historical approximate mode
- default KST and midnight boundary
- how to switch the day-boundary option
- `npm ci`, `npm run build:vendor`, `npm test`
- separate repository and GitHub Pages URL
- how the original app remains untouched

Update the security report with local-only storage, imported-record normalization, third-party package pinning, and CSP limitations of the current single-file app.

- [ ] **Step 5: Commit**

```powershell
git add tests/ui-regression.js security_best_practices_report.md 웹배포_안내.md
git commit -m "test: complete legend release audit"
```

---

### Task 10: Separate Repository and GitHub Pages Deployment

**Files:**
- No production file changes expected

**Interfaces:**
- Produces: `https://github.com/jansang18/legend-manse`
- Produces: `https://jansang18.github.io/legend-manse/`

- [ ] **Step 1: Verify release state before external changes**

Run:

```powershell
git status --short
git log --oneline --decorate -10
npm ci
npm run build:vendor
npm test
```

Expected: clean worktree and complete passing test suite.

- [ ] **Step 2: Create or connect the separate repository**

Check:

```powershell
gh repo view jansang18/legend-manse --json name,url,isPrivate
```

If it does not exist:

```powershell
gh repo create jansang18/legend-manse --public --description "취명선 전설의 만세력"
```

Add the separate remote:

```powershell
git remote add legend https://github.com/jansang18/legend-manse.git
git remote -v
```

The existing `origin` must still point to `jansang18/sineum-manse`; no push is made to it.

- [ ] **Step 3: Push the exact tested state**

```powershell
git push --set-upstream legend HEAD:main
```

Record the pushed commit:

```powershell
git rev-parse HEAD
```

- [ ] **Step 4: Enable GitHub Pages**

Inspect:

```powershell
gh api repos/jansang18/legend-manse/pages
```

If Pages is absent:

```powershell
gh api --method POST repos/jansang18/legend-manse/pages -f "source[branch]=main" -f "source[path]=/"
```

If Pages exists with a different source:

```powershell
gh api --method PUT repos/jansang18/legend-manse/pages -f "source[branch]=main" -f "source[path]=/"
```

- [ ] **Step 5: Verify production**

Poll the deployment endpoint until it is built:

```powershell
gh api repos/jansang18/legend-manse/pages --jq '{status:.status,url:.html_url,source:.source}'
```

Open `https://jansang18.github.io/legend-manse/` with Puppeteer and assert:

```js
assert.equal(await page.title(), '취명선 전설의 만세력');
assert.ok(await page.$('#calcBtn'));
assert.ok(await page.$('link[rel="manifest"]'));
```

Calculate one fixture, open the legend tab, reload once, and verify the service worker does not serve files from the original app.

- [ ] **Step 6: Final deployment record**

Create a final non-code commit only if the deployment guide needs the confirmed production URL or commit hash:

```powershell
git add 웹배포_안내.md
git commit -m "docs: record legend production deployment"
git push legend HEAD:main
```

The handoff must report the production URL, repository URL, deployed commit, full test result, and confirmation that the original `sineum-manse` remote was not pushed.
