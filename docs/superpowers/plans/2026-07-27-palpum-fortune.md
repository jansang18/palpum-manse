# Palpum Fortune Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app start at Saju input and generate an evidence-led Palpum fortune for this year, next month, any month, and next year without fixed navigation covering the chart.

**Architecture:** Add a pure Palpum boundary classifier and a separate creative interpretation composer, both exposed as browser/Node UMD modules. Keep existing Four Pillars calculations as the source of natal and timing data, use `LegendEra` only as macro context, and let `index.html` orchestrate rendering and navigation. Extend the existing ink-wash design in `styles/legend-layout.css` rather than introducing another visual system.

**Tech Stack:** Static HTML/CSS/JavaScript, Node.js built-in test runner, Puppeteer UI regression suite, `manseryeok@2.0.0`, GitHub Pages.

## Global Constraints

- Product label is `팔품 운세`; attribution is `팔품 운세 · 취명선 창작 해석`.
- Never describe the result as an official Chang-gwang or school judgment.
- Palpum is the primary personal layer, Daeun/annual/monthly pillars are timing layers, and Samwon Gugun is secondary macro context.
- The primary output is `발현`, `전환`, `조율`, or `축적`, not a single numeric score.
- Preserve the existing ink-wash, paper, seal, ink-black, and muted red visual language.
- The top header, action banner, and bottom navigation must never cover the first or last row of the natal chart, annual flow, monthly flow, or Palpum result at any supported viewport.
- Preserve input, celebrity search, original chart, compatibility, calendar, saved charts, and 1026-2099 support.
- Mark 1026-1799 results as `역사 범위 근사`.
- Unknown birth time on a Palpum boundary must produce an uncertain two-candidate result rather than guessing.
- Add no new runtime dependency.
- Push and deploy only to the `legend` remote and `legend-manse` GitHub Pages site; never push this feature to `origin`.

## File Map

- Create `scripts/legend-palpum.js`: immutable eight-segment definitions and pure boundary classification.
- Create `scripts/legend-palpum-fortune.js`: pure state/evidence/section composition from Palpum, natal chart, timing, Daeun, and era.
- Create `tests/legend-palpum.test.js`: exact boundary, unknown-time, and historical-accuracy tests.
- Create `tests/legend-palpum-fortune.test.js`: state, evidence, deterministic copy, and 9-yun-secondary tests.
- Modify `scripts/manseryeok-adapter.js`: expose precise solar-term instants without changing existing `calculate`.
- Modify `tests/ganji-fixtures.test.js`: independent fixtures for one minute before/at/after all eight Palpum boundaries.
- Modify `index.html`: script loading, input-first markup, calculation routing, period state, Palpum data assembly, and accessible result markup.
- Modify `scripts/legend-nav.js`: input-first fallback and direct fortune activation after calculation.
- Modify `styles/legend-layout.css`: Palpum parchment layout and non-overlap safe areas.
- Modify `tests/pwa-isolation.test.js`: static contracts for startup, script isolation, labels, and source disclosure.
- Modify `tests/ui-regression.js`: end-to-end startup, quick periods, year rollover, contrast, and overlay geometry assertions.
- Modify `sw.js`: cache version and new module assets.

---

### Task 1: Precise Palpum Boundary Classifier

**Files:**
- Create: `scripts/legend-palpum.js`
- Create: `tests/legend-palpum.test.js`

**Interfaces:**
- Produces: `LegendPalpum.PALPUM_DEFINITIONS`
- Produces: `LegendPalpum.classifyPalpum({ instantMs, boundaries, accuracy, unknownTime })`
- Returns: `{ type, ruler, startTerm, endTerm, accuracy, candidates, boundaryUncertain }`
- `boundaries` is an ascending array of `{ name, instantMs }` containing the previous and next occurrences needed to surround the birth instant.

- [ ] **Step 1: Write failing tests for the immutable eight-segment table**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PALPUM_DEFINITIONS,
  classifyPalpum
} = require('../scripts/legend-palpum.js');

test('defines the eight Palpum segments and their public rulers', () => {
  assert.deepEqual(
    PALPUM_DEFINITIONS.map(({ type, startTerm, endTerm, ruler }) => ({
      type, startTerm, endTerm, ruler
    })),
    [
      { type: '자축품', startTerm: '동지', endTerm: '입춘', ruler: '계수' },
      { type: '인묘품', startTerm: '입춘', endTerm: '춘분', ruler: '갑목' },
      { type: '묘진품', startTerm: '춘분', endTerm: '입하', ruler: '을목' },
      { type: '사오품', startTerm: '입하', endTerm: '하지', ruler: '병화' },
      { type: '오미품', startTerm: '하지', endTerm: '입추', ruler: '정화' },
      { type: '신유품', startTerm: '입추', endTerm: '추분', ruler: '경금' },
      { type: '유술품', startTerm: '추분', endTerm: '입동', ruler: '신금' },
      { type: '해자품', startTerm: '입동', endTerm: '동지', ruler: '임수' }
    ]
  );
  assert.equal(Object.isFrozen(PALPUM_DEFINITIONS), true);
});
```

- [ ] **Step 2: Run the table test and confirm RED**

Run: `node --test tests/legend-palpum.test.js`

Expected: FAIL because `scripts/legend-palpum.js` does not exist.

- [ ] **Step 3: Implement the frozen public definitions**

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LegendPalpum = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const PALPUM_DEFINITIONS = Object.freeze([
    Object.freeze({ type: '자축품', startTerm: '동지', endTerm: '입춘', ruler: '계수' }),
    Object.freeze({ type: '인묘품', startTerm: '입춘', endTerm: '춘분', ruler: '갑목' }),
    Object.freeze({ type: '묘진품', startTerm: '춘분', endTerm: '입하', ruler: '을목' }),
    Object.freeze({ type: '사오품', startTerm: '입하', endTerm: '하지', ruler: '병화' }),
    Object.freeze({ type: '오미품', startTerm: '하지', endTerm: '입추', ruler: '정화' }),
    Object.freeze({ type: '신유품', startTerm: '입추', endTerm: '추분', ruler: '경금' }),
    Object.freeze({ type: '유술품', startTerm: '추분', endTerm: '입동', ruler: '신금' }),
    Object.freeze({ type: '해자품', startTerm: '입동', endTerm: '동지', ruler: '임수' })
  ]);

  return Object.freeze({ PALPUM_DEFINITIONS });
});
```

- [ ] **Step 4: Write failing tests for inclusive starts and exclusive ends**

```js
const boundaries = [
  { name: '동지', instantMs: 0 },
  { name: '입춘', instantMs: 1000 },
  { name: '춘분', instantMs: 2000 },
  { name: '입하', instantMs: 3000 },
  { name: '하지', instantMs: 4000 },
  { name: '입추', instantMs: 5000 },
  { name: '추분', instantMs: 6000 },
  { name: '입동', instantMs: 7000 },
  { name: '동지', instantMs: 8000 }
];

test('uses an inclusive start and exclusive end at every boundary', () => {
  assert.equal(classifyPalpum({ instantMs: 999, boundaries }).type, '자축품');
  assert.equal(classifyPalpum({ instantMs: 1000, boundaries }).type, '인묘품');
  assert.equal(classifyPalpum({ instantMs: 4999, boundaries }).type, '오미품');
  assert.equal(classifyPalpum({ instantMs: 5000, boundaries }).type, '신유품');
  assert.equal(classifyPalpum({ instantMs: 7000, boundaries }).type, '해자품');
});
```

- [ ] **Step 5: Run and confirm RED**

Run: `node --test tests/legend-palpum.test.js`

Expected: FAIL because `classifyPalpum` is not exported.

- [ ] **Step 6: Implement minimal boundary classification**

```js
function classifyPalpum(input) {
  if (!Number.isFinite(input.instantMs)) {
    throw new TypeError('instantMs must be finite');
  }
  const active = input.boundaries
    .filter(boundary => boundary.instantMs <= input.instantMs)
    .at(-1);
  const definition = PALPUM_DEFINITIONS.find(item => item.startTerm === active?.name);
  if (!definition) throw new RangeError('birth instant is outside supplied boundaries');
  return Object.freeze({
    type: definition.type,
    ruler: definition.ruler,
    startTerm: definition.startTerm,
    endTerm: definition.endTerm,
    accuracy: input.accuracy || 'exact',
    candidates: Object.freeze([definition.type]),
    boundaryUncertain: false
  });
}
```

- [ ] **Step 7: Add failing uncertainty and historical-label tests**

```js
test('does not guess when an unknown birth time can cross a boundary', () => {
  const result = classifyPalpum({
    instantMs: 1000,
    boundaries,
    unknownTime: true,
    possibleRange: { startMs: 500, endMs: 1499 }
  });
  assert.equal(result.boundaryUncertain, true);
  assert.deepEqual(result.candidates, ['자축품', '인묘품']);
});

test('preserves historical approximation accuracy', () => {
  assert.equal(classifyPalpum({
    instantMs: 2500,
    boundaries,
    accuracy: 'historical-approximation'
  }).accuracy, 'historical-approximation');
});
```

- [ ] **Step 8: Implement candidate classification across the possible time range**

Extend `classifyPalpum` to classify `possibleRange.startMs` and `possibleRange.endMs`, deduplicate candidates in chronological order, and set `boundaryUncertain` when two types differ.

- [ ] **Step 9: Run tests and commit**

Run: `node --test tests/legend-palpum.test.js`

Expected: all PASS.

```bash
git add scripts/legend-palpum.js tests/legend-palpum.test.js
git commit -m "feat: add Palpum boundary classifier"
```

---

### Task 2: Solar-Term Adapter and Independent Boundary Fixtures

**Files:**
- Modify: `scripts/manseryeok-adapter.js`
- Modify: `tests/ganji-fixtures.test.js`

**Interfaces:**
- Consumes: `Manseryeok.getSolarTerm(year, index)`
- Produces: `LegendGanji.getSolarTermInstant(year, index): number`
- Palpum term indexes: 입춘 `2`, 춘분 `5`, 입하 `8`, 하지 `11`, 입추 `14`, 추분 `17`, 입동 `20`, 동지 `23`.

- [ ] **Step 1: Add a failing adapter test**

```js
test('exposes a stable UTC millisecond instant for Palpum boundaries', () => {
  const adapter = createAdapter({
    calculateFourPillars() {},
    lunarToSolar() {},
    solarToLunar() {},
    getSolarTerm(year, index) {
      return { date: new Date(Date.UTC(year, 1, index, 3, 4, 5)) };
    }
  });
  assert.equal(
    adapter.getSolarTermInstant(2026, 2),
    Date.UTC(2026, 1, 2, 3, 4, 5)
  );
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `node --test tests/ganji-fixtures.test.js --test-name-pattern="Palpum boundaries"`

Expected: FAIL because `getSolarTermInstant` is missing.

- [ ] **Step 3: Implement the adapter method**

```js
function getSolarTermInstant(year, index) {
  const term = engine.getSolarTerm(year, index);
  const instantMs = term?.date?.getTime();
  if (!Number.isFinite(instantMs)) throw new RangeError('invalid solar term instant');
  return instantMs;
}

return Object.freeze({ calculate, getSolarTermInstant });
```

Also require `engine.getSolarTerm` in adapter validation.

- [ ] **Step 4: Add eight independent 2026 boundary fixtures**

Record the eight expected instants from the existing independently maintained KASI fixture source already used by `tests/ganji-fixtures.test.js`. For each instant, classify `instant - 60_000`, `instant`, and `instant + 60_000`; assert old/new Palpum types.

```js
for (const fixture of PALPUM_2026_FIXTURES) {
  test(`${fixture.name} changes Palpum at the exact instant`, () => {
    assert.equal(classifyAt(fixture.instantMs - 60_000), fixture.before);
    assert.equal(classifyAt(fixture.instantMs), fixture.after);
    assert.equal(classifyAt(fixture.instantMs + 60_000), fixture.after);
  });
}
```

- [ ] **Step 5: Run focused and full core tests**

Run: `node --test tests/ganji-fixtures.test.js tests/legend-palpum.test.js`

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/manseryeok-adapter.js tests/ganji-fixtures.test.js
git commit -m "feat: expose precise Palpum solar-term boundaries"
```

---

### Task 3: Creative Palpum Interpretation Composer

**Files:**
- Create: `scripts/legend-palpum-fortune.js`
- Create: `tests/legend-palpum-fortune.test.js`

**Interfaces:**
- Consumes: `LegendPalpum` result, natal pillars/ohaeng, active Daeun, selected annual/monthly pillar, `LegendEra.getLegendEra(year)`.
- Produces: `LegendPalpumFortune.composePalpumFortune(input)`.
- Returns:

```js
{
  version: 'palpum-v1',
  state: '발현' | '전환' | '조율' | '축적',
  headline: string,
  opportunity: string,
  burden: string,
  preparation: string,
  areas: { relationship, career, money, health },
  evidence: [{ kind, label, detail }],
  tags: string[]
}
```

- [ ] **Step 1: Write failing deterministic-result tests**

```js
test('returns role-led sections and at least three distinct evidence layers', () => {
  const result = composePalpumFortune(fixtureInput({
    palpum: { type: '신유품', ruler: '경금', accuracy: 'exact' },
    target: { year: 2026, month: null, stem: 2, branch: 6 },
    era: { yun: 9, element: '화', symbol: '빛' }
  }));
  assert.match(result.headline, /역할|기준|성과/);
  assert.ok(['발현', '전환', '조율', '축적'].includes(result.state));
  assert.equal(typeof result.opportunity, 'string');
  assert.equal(typeof result.burden, 'string');
  assert.equal(typeof result.preparation, 'string');
  assert.deepEqual(
    new Set(result.evidence.map(item => item.kind)),
    new Set(['팔품', '시기', '시대'])
  );
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `node --test tests/legend-palpum-fortune.test.js`

Expected: FAIL because the composer module does not exist.

- [ ] **Step 3: Add focused immutable copy data**

Define one compact record per Palpum with `scene`, `role`, `opportunity`, `burden`, `preparation`, and four area observations. Do not copy lecture prose. Freeze the table.

- [ ] **Step 4: Implement state selection**

Use explicit bounded signals:

```js
const signal = {
  rulerVisible: countRulerPresence(input.saju, input.palpum.ruler),
  timingSupport: relationScore(input.palpum.ruler, input.target),
  daeunSupport: relationScore(input.palpum.ruler, input.daeun),
  eraPressure: eraRelationScore(input.palpum.ruler, input.era)
};

const state = signal.timingSupport >= 2 && signal.rulerVisible > 0
  ? '발현'
  : signal.timingSupport <= -2
    ? '전환'
    : signal.eraPressure < 0
      ? '조율'
      : '축적';
```

Keep 9-yun as a tie-breaker/context signal only; it cannot override both Palpum and timing.

- [ ] **Step 5: Write failing tests proving 9-yun is secondary**

```js
test('changing only the era changes context evidence but not a strong timing state', () => {
  const fireEra = composePalpumFortune(fixtureInput({ era: era(9, '화') }));
  const waterEra = composePalpumFortune(fixtureInput({ era: era(1, '수') }));
  assert.equal(fireEra.state, waterEra.state);
  assert.notEqual(
    fireEra.evidence.find(item => item.kind === '시대').detail,
    waterEra.evidence.find(item => item.kind === '시대').detail
  );
});
```

- [ ] **Step 6: Add uncertainty and disclaimer behavior**

For `boundaryUncertain`, return a shared headline, both candidate labels, no false single-type assertion, and an evidence entry asking for birth time. For `historical-approximation`, include `역사 범위 근사`.

- [ ] **Step 7: Run tests and commit**

Run: `node --test tests/legend-palpum-fortune.test.js`

Expected: all PASS.

```bash
git add scripts/legend-palpum-fortune.js tests/legend-palpum-fortune.test.js
git commit -m "feat: compose evidence-led Palpum fortunes"
```

---

### Task 4: Input-First Startup and Calculation Routing

**Files:**
- Modify: `index.html`
- Modify: `scripts/legend-nav.js`
- Modify: `tests/pwa-isolation.test.js`

**Interfaces:**
- Consumes: `window.activateLegendDestination(tabName)`.
- Produces: startup destination `input`.
- Produces: successful calculation destination `fortune` with default quick period `this-year`.

- [ ] **Step 1: Add failing static startup contracts**

```js
test('starts at Saju input and labels calculation as Palpum fortune', () => {
  assert.match(html, /<section class="view active" id="view-input"/);
  assert.match(html, /<section class="view" id="view-legend"[^>]*hidden/);
  assert.match(html, /id="calcBtn"[^>]*>팔품 운세 펼치기</);
});

test('loads Palpum modules before the inline app controller', () => {
  assert.match(html, /scripts\/legend-palpum\.js[\s\S]+scripts\/legend-palpum-fortune\.js/);
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `node --test tests/pwa-isolation.test.js --test-name-pattern="starts at Saju input|loads Palpum"`

Expected: FAIL against current legend-first markup.

- [ ] **Step 3: Change markup and fallback navigation**

- Make `view-input` active and visible.
- Make `view-legend` hidden and inactive.
- Make `사주 입력` the active sub-navigation item.
- Change `currentDestination()` fallback in `scripts/legend-nav.js` from `legend` to `input`.
- Change button copy to `팔품 운세 펼치기`.
- Add the two Palpum module script tags before inline controller code.

- [ ] **Step 4: Add a failing successful-calculation routing contract**

Assert the calculate handler sets the period to this year, renders result data, activates `fortune`, and does not activate `result`.

```js
assert.match(html, /setFortuneQuickPeriod\(['"]this-year['"]\)/);
assert.match(html, /activateLegendDestination\(['"]fortune['"]\)/);
```

- [ ] **Step 5: Route calculation to this year**

Replace the old `renderResult(); activateLegendDestination('result')` success path with:

```js
currentSaju = saju;
currentPalpum = buildCurrentPalpum(saju);
setFortuneQuickPeriod('this-year', { render: false });
window.activateLegendDestination('fortune');
window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
```

Keep original chart available through `전설사주 > 원국`.

- [ ] **Step 6: Run tests and commit**

Run: `node --test tests/pwa-isolation.test.js`

Expected: all PASS.

```bash
git add index.html scripts/legend-nav.js tests/pwa-isolation.test.js
git commit -m "feat: open Palpum fortune from Saju input"
```

---

### Task 5: Four-Period Navigation and Palpum Result Rendering

**Files:**
- Modify: `index.html`
- Modify: `tests/ui-regression.js`

**Interfaces:**
- Produces: `setFortuneQuickPeriod(mode, options)`.
- Modes: `this-year`, `next-month`, `monthly`, `next-year`.
- Produces: `buildCurrentPalpum(saju)` using precise terms for 1800+ and legacy approximate terms for 1026-1799.
- Produces: `renderFortune()` with Palpum state, role, opportunity, burden, preparation, areas, evidence, and source disclosure.

- [ ] **Step 1: Add failing browser tests for the four quick periods**

```js
await calculateFixture(page, { birth: '19860219', time: '1430' });
assert.equal(await activeDestination(page), 'fortune');
assert.equal(await selectedQuickPeriod(page), 'this-year');

await page.click('[data-palpum-period="next-month"]');
assert.equal(await selectedQuickPeriod(page), 'next-month');

await page.click('[data-palpum-period="monthly"]');
assert.equal(await page.$eval('#palpumMonthGrid', el => el.children.length), 12);

await page.click('[data-palpum-period="next-year"]');
assert.equal(await selectedQuickPeriod(page), 'next-year');
```

- [ ] **Step 2: Run the focused UI test and confirm RED**

Run: `node tests/ui-regression.js --grep "Palpum quick periods"`

Expected: FAIL because the period controls do not exist.

- [ ] **Step 3: Implement normalized period state**

Replace `fortunePeriodMode = 'month'` with:

```js
let fortuneQuickPeriod = 'this-year';
let fortuneCursorYear = fortuneToday.getFullYear();
let fortuneCursorMonth = fortuneToday.getMonth() + 1;

function setFortuneQuickPeriod(mode, options = {}) {
  fortuneQuickPeriod = mode;
  if (mode === 'this-year') {
    fortuneCursorYear = fortuneToday.getFullYear();
  } else if (mode === 'next-month') {
    const next = new Date(fortuneToday.getFullYear(), fortuneToday.getMonth() + 1, 1);
    fortuneCursorYear = next.getFullYear();
    fortuneCursorMonth = next.getMonth() + 1;
  } else if (mode === 'next-year') {
    fortuneCursorYear = Math.min(2099, fortuneToday.getFullYear() + 1);
  }
  if (options.render !== false) renderFortune();
}
```

- [ ] **Step 4: Build exact or approximate birth boundaries**

For 1800+, collect the eight relevant term instants from `LegendGanji.getSolarTermInstant` across birth year - 1 through birth year + 1. For 1026-1799, convert `findJeolgiJD(year, longitude)` results to milliseconds and mark `historical-approximation`. When birth time is unknown, pass the full local calendar day as `possibleRange`.

- [ ] **Step 5: Replace score-first markup with semantic Palpum markup**

Render:

```html
<section class="palpum-hero" aria-labelledby="palpumResultTitle">
  <span class="palpum-attribution">팔품 운세 · 취명선 창작 해석</span>
  <div class="palpum-seal" aria-hidden="true">品</div>
  <p class="palpum-type">신유품 · 당령 경금</p>
  <h2 id="palpumResultTitle">기준을 세우고 성과의 결을 다듬는 때</h2>
  <span class="palpum-state">발현</span>
</section>
<section class="palpum-triad">
  <article><h3>기회</h3>...</article>
  <article><h3>부담</h3>...</article>
  <article><h3>준비</h3>...</article>
</section>
```

Add relationship, career, money, and health cards. Keep old numeric score calculations available only as non-leading internal signals; do not render the old giant total score.

- [ ] **Step 6: Add month-grid and rollover tests**

Test December `next-month` becomes January of the next year, year navigation clamps at 1026/2099, and selecting a month preserves the current chart.

- [ ] **Step 7: Add evidence and source disclosure**

`왜 이렇게 보나요?` must show at least three items with labels `팔품`, `시기`, and `시대`. `해석 기준과 출처` must include `취명선 창작 해석`, the non-official disclaimer, and links to the public primary videos listed in the design.

- [ ] **Step 8: Run focused and full tests**

Run: `node --test tests/legend-palpum*.test.js tests/pwa-isolation.test.js`

Run: `node tests/ui-regression.js`

Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add index.html tests/ui-regression.js
git commit -m "feat: render navigable Palpum fortune periods"
```

---

### Task 6: Ink-Wash Visual System and Non-Overlap Safe Areas

**Files:**
- Modify: `styles/legend-layout.css`
- Modify: `tests/ui-regression.js`

**Interfaces:**
- Consumes: `.palpum-*` markup from Task 5.
- Produces: one coherent parchment surface with ink-black text and muted seal-red accents.
- Produces: layout geometry where fixed/sticky controls do not intersect content.

- [ ] **Step 1: Add failing computed-style and geometry tests**

At mobile `412x915`, tablet `1152x768`, and desktop `1440x1000`, assert:

```js
const overlap = (a, b) =>
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) > 0 &&
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) > 0;

assert.equal(overlap(chartFirstRow, topHeader), false);
assert.equal(overlap(chartLastRow, mobileNav), false);
assert.equal(overlap(annualLastRow, actionBar), false);
assert.equal(overlap(palpumLastCard, mobileNav), false);
assert.ok(parseFloat(getComputedStyle(lastContent).paddingBottom) >= mobileNav.height + 24);
```

Also assert input text and core Hanja contrast ratio is at least `4.5:1`.

- [ ] **Step 2: Run and confirm RED**

Run: `node tests/ui-regression.js --grep "Palpum ink wash|navigation never covers"`

Expected: FAIL because new classes/safe-zone assertions are absent.

- [ ] **Step 3: Implement the Palpum parchment composition**

Use existing CSS variables and assets:

- Warm paper gradient, faint fiber/noise, and one restrained landscape wash.
- Ink-black main copy.
- Muted red only for seal, active period, state border, and small rules.
- No blue controls, dark cards, neon gradients, or separate banner aesthetic.
- Serif display for titles; existing Korean body font for long copy.
- Keep every interactive period, disclosure, and navigation target at least `44px` high.
- Respect `prefers-reduced-motion` and remove decorative transitions when reduced motion is requested.

- [ ] **Step 4: Eliminate content-covering banners**

Use document-flow or sticky containers rather than fixed content banners. Keep the bottom navigation fixed only where already established, and reserve space centrally:

```css
:root {
  --legend-mobile-nav-height: 92px;
  --legend-content-safe-bottom: calc(
    var(--legend-mobile-nav-height) + env(safe-area-inset-bottom) + 32px
  );
}

.app {
  padding-bottom: var(--legend-content-safe-bottom);
}

#view-result,
#view-fortune,
#view-calendar {
  scroll-padding-top: var(--legend-header-offset);
  padding-bottom: var(--legend-content-safe-bottom);
}

.result-action-bar {
  position: static;
}
```

If an action bar must remain sticky, place it above the mobile navigation and add equal content padding; tests still decide acceptance.

- [ ] **Step 5: Verify long chart content, not only empty states**

Populate a chart with full Daeun and annual rows, scroll to the final row, and capture screenshots at all three viewport classes. Confirm the first/last visible cards remain outside header/nav rectangles.

- [ ] **Step 6: Run UI regression and commit**

Run: `node tests/ui-regression.js`

Expected: all PASS with no overlap or contrast failures.

```bash
git add styles/legend-layout.css tests/ui-regression.js
git commit -m "style: unify Palpum ink wash layout without overlays"
```

---

### Task 7: Saved Charts, Error States, and PWA Cache

**Files:**
- Modify: `index.html`
- Modify: `sw.js`
- Modify: `tests/pwa-isolation.test.js`
- Modify: `tests/ui-regression.js`

**Interfaces:**
- Existing saved records remain unchanged.
- Derived Palpum result uses `version: 'palpum-v1'`.
- PWA cache includes both new modules.

- [ ] **Step 1: Add failing saved-record derivation test**

Open an existing pre-Palpum saved fixture, select it, navigate to fortune, and assert a Palpum result appears without mutating or deleting the stored birth record.

- [ ] **Step 2: Run and confirm RED**

Run: `node tests/ui-regression.js --grep "legacy saved chart derives Palpum"`

Expected: FAIL until saved-chart fortune navigation builds `currentPalpum`.

- [ ] **Step 3: Derive Palpum on load and preserve source data**

Call `buildCurrentPalpum(currentSaju)` when a saved chart becomes current. Do not add a mandatory storage migration. If a cache object is stored, include only `version`, `type`, `ruler`, and `accuracy`.

- [ ] **Step 4: Add and implement visible uncertainty/error states**

Test and render:

- Missing birth time away from a boundary: `시주 제외` note.
- Missing birth time crossing a boundary: two Palpum candidates and time-request note.
- 1026-1799: `역사 범위 근사`.
- Calculation error: input retained and retry available.

- [ ] **Step 5: Add failing cache contract**

```js
assert.match(serviceWorker, /scripts\/legend-palpum\.js/);
assert.match(serviceWorker, /scripts\/legend-palpum-fortune\.js/);
```

- [ ] **Step 6: Bump the cache version and add both assets**

Use a new cache name and append the module paths to the existing static asset list. Do not change fetch isolation rules.

- [ ] **Step 7: Run tests and commit**

Run: `npm run test:core`

Run: `node tests/ui-regression.js`

Expected: all PASS.

```bash
git add index.html sw.js tests/pwa-isolation.test.js tests/ui-regression.js
git commit -m "feat: preserve Palpum results across saved and offline flows"
```

---

### Task 8: Full Verification and Legend-Only Deployment

**Files:**
- Verify only; update files only if a failing test requires a TDD fix.

**Interfaces:**
- Production URL: `https://jansang18.github.io/legend-manse/`
- Deployment remote: `legend`

- [ ] **Step 1: Run all automated tests**

Run: `npm test`

Expected: `test:core` and `test:ui` both PASS with no unhandled browser console errors.

- [ ] **Step 2: Run static integrity checks**

Run: `git diff --check`

Run: `rg -n "TBD|TODO|FIXME|창광 팔품|공식 팔품" scripts index.html styles tests`

Expected: no placeholders and no misleading official attribution.

- [ ] **Step 3: Perform production-width browser verification**

Verify:

- First load opens `사주 입력`.
- `팔품 운세 펼치기` opens this-year result.
- `올해`, `다음 달`, `월별`, and `내년` work.
- Original chart remains at `전설사주 > 원국`.
- The full Daeun/annual rows and the final Palpum card are visible above the bottom navigation.
- Header does not cover the chart top.
- No dark-mode control returns.
- Numeric input and Hanja are ink-black and readable.

- [ ] **Step 4: Review git scope**

Run: `git status --short`

Run: `git diff --stat eabe5e0..HEAD`

Expected: only intended source, test, plan, and spec changes; `artifacts/` remains untracked and unstaged.

- [ ] **Step 5: Push only to the legend remote**

```bash
git push legend feat/legend-manse-implementation:main
```

Never run `git push origin`.

- [ ] **Step 6: Verify GitHub Pages production**

Open `https://jansang18.github.io/legend-manse/` with a cache-busting query, wait for the service worker update, and repeat the startup, calculation, period, and non-overlap checks against production.

- [ ] **Step 7: Record deployment commit**

Run: `git rev-parse --short HEAD`

Report the production URL, commit, test results, and the three non-overlap viewport sizes.
