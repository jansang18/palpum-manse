# Chwimyeongseon Academy Mockup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a Full HD-first animated ink-wash education homepage with a working basic Manseryeok and clearly labeled board and payment mockups.

**Architecture:** Add a self-contained `academy/` static application so the existing Palpum Manse app remains unchanged. Reuse the verified browser Manseryeok engine through parent-relative script URLs, while keeping academy rendering, motion, and interaction code in small dedicated modules.

**Tech Stack:** Semantic HTML, CSS custom properties and keyframes, vanilla JavaScript, Web Animations API, IntersectionObserver, requestAnimationFrame, existing `ManseryeokAdapter`, Node test runner, Puppeteer UI regression tests, GitHub Pages.

## Global Constraints

- The primary artboard is 1920x1080 Full HD.
- The page must remain complete at 1440x900, 1366x768, 1280x720, tablet, and 360px mobile widths.
- The existing Palpum Manse root application and its state namespace must remain unchanged.
- Real authentication, persistent board writes, payment processing, refunds, admin tools, streaming, and course progress storage are excluded.
- Every payment affordance must state that it is a demonstration and no payment occurs.
- Continuous animation is limited to mist and the nine-period orbit.
- `prefers-reduced-motion: reduce` must remove parallax, rotation, ink spread, and count-up motion.
- Fixed navigation and CTAs must never cover chart or luck-cycle content.

---

### Task 1: Academy Semantic Shell and Navigation

**Files:**
- Create: `academy/index.html`
- Create: `academy/styles/academy.css`
- Create: `academy/scripts/academy-nav.js`
- Test: `tests/academy-contract.test.js`

**Interfaces:**
- Produces: section IDs `academyHome`, `academyCourses`, `academyManse`, `academyCases`, `academyBoard`, and `academyPlans`.
- Produces: `window.AcademyNav.init(): void`.
- Consumes: shared images at `../assets/legend-landscape.webp` and `../assets/legend-seal.webp`.

- [ ] **Step 1: Write the failing structural test**

```js
test('academy exposes every approved section and mockup disclosure', () => {
  for (const id of ['academyHome', 'academyCourses', 'academyManse', 'academyCases', 'academyBoard', 'academyPlans']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /현재는 시연 화면이며 결제가 발생하지 않습니다/);
  assert.match(html, /prefers-reduced-motion/);
});
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `node --test tests/academy-contract.test.js`
Expected: FAIL because `academy/index.html` does not exist.

- [ ] **Step 3: Create the semantic page shell**

Create a skip link, fixed masthead, six navigation links, six matching sections, and a footer. Load `academy.css`, `academy-nav.js`, the future `academy-motion.js`, `academy-manse.js`, and `academy-mockups.js` with `defer`.

- [ ] **Step 4: Implement anchor navigation**

```js
function init() {
  document.querySelectorAll('[data-academy-target]').forEach(link => {
    link.addEventListener('click', event => {
      const target = document.getElementById(link.dataset.academyTarget);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
    });
  });
}
```

- [ ] **Step 5: Run the contract test and commit**

Run: `node --test tests/academy-contract.test.js`
Expected: PASS.

Commit:

```bash
git add academy/index.html academy/styles/academy.css academy/scripts/academy-nav.js tests/academy-contract.test.js
git commit -m "feat: add academy page shell"
```

### Task 2: Cinematic Ink-Wash Hero and Motion Controller

**Files:**
- Modify: `academy/index.html`
- Modify: `academy/styles/academy.css`
- Create: `academy/scripts/academy-motion.js`
- Test: `tests/academy-motion.test.js`
- Test: `tests/academy-ui.js`

**Interfaces:**
- Produces: `window.AcademyMotion.init(): void`.
- Produces: DOM hooks `[data-parallax-layer]`, `[data-reveal]`, `[data-count]`, `.academy-orbit`, and `.academy-mist`.
- Consumes: `matchMedia('(prefers-reduced-motion: reduce)')`.

- [ ] **Step 1: Write failing motion-source tests**

```js
test('motion controller is frame-bounded and honors reduced motion', () => {
  assert.match(motion, /requestAnimationFrame/);
  assert.match(motion, /prefers-reduced-motion:\s*reduce/);
  assert.match(motion, /IntersectionObserver/);
  assert.doesNotMatch(motion, /setInterval/);
});
```

- [ ] **Step 2: Run motion tests and verify RED**

Run: `node --test tests/academy-motion.test.js`
Expected: FAIL because the controller is missing.

- [ ] **Step 3: Build the Full HD hero composition**

Add three decorative mountain depth layers, two mist bands, the title `취명선 명리학당`, two CTA buttons, a seal, and a nine-node orbit. Keep all decorative elements `aria-hidden="true"` and preserve a readable text layer.

- [ ] **Step 4: Implement bounded pointer and scroll motion**

```js
function scheduleFrame() {
  if (framePending || reduced) return;
  framePending = true;
  requestAnimationFrame(() => {
    framePending = false;
    root.style.setProperty('--pointer-x', pointerX.toFixed(3));
    root.style.setProperty('--pointer-y', pointerY.toFixed(3));
    root.style.setProperty('--scroll-depth', Math.min(scrollY / innerHeight, 3).toFixed(3));
  });
}
```

Use IntersectionObserver to add `.is-revealed` once to educational sections and count-up nodes. Pause decorative motion while the document is hidden.

- [ ] **Step 5: Add reduced-motion and reduced-transparency fallbacks**

```css
@media (prefers-reduced-motion: reduce) {
  .academy-mist,
  .academy-orbit-ring,
  [data-reveal] {
    animation: none !important;
    transform: none !important;
    transition: none !important;
  }
}
```

- [ ] **Step 6: Run tests and commit**

Run: `node --test tests/academy-motion.test.js`
Expected: PASS.

Commit:

```bash
git add academy/index.html academy/styles/academy.css academy/scripts/academy-motion.js tests/academy-motion.test.js tests/academy-ui.js
git commit -m "feat: animate academy ink wash hero"
```

### Task 3: Education, Cases, Board, and Payment Mockups

**Files:**
- Modify: `academy/index.html`
- Modify: `academy/styles/academy.css`
- Create: `academy/scripts/academy-mockups.js`
- Modify: `tests/academy-contract.test.js`
- Modify: `tests/academy-ui.js`

**Interfaces:**
- Produces: `window.AcademyMockups.init(): void`.
- Produces: accessible dialog IDs `courseDialog`, `boardDialog`, and `paymentDialog`.
- Consumes: buttons carrying `data-course-id`, `data-board-action`, or `data-plan-id`.

- [ ] **Step 1: Write failing content and dialog tests**

```js
test('academy includes four curriculum tracks and safe mockups', () => {
  for (const title of ['명리의 기초', '사주 원국 읽기', '대운·세운·월운', '삼원구운과 시대 해석']) {
    assert.match(html, new RegExp(title));
  }
  assert.match(html, /id="courseDialog"/);
  assert.match(html, /id="boardDialog"/);
  assert.match(html, /id="paymentDialog"/);
  assert.match(html, /결제가 발생하지 않습니다/);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/academy-contract.test.js`
Expected: FAIL because curriculum and dialogs are not present.

- [ ] **Step 3: Implement cards and dialog markup**

Add four curriculum cards with level, duration, lecture count, and example progress. Add three case-study cards, five board rows, and two course package cards. Every nonfunctional action must open the matching mockup dialog rather than navigate or submit.

- [ ] **Step 4: Implement accessible dialog behavior**

```js
function openDialog(dialog, trigger) {
  activeTrigger = trigger;
  dialog.showModal();
  dialog.querySelector('[data-dialog-close]')?.focus();
}

function closeDialog(dialog) {
  dialog.close();
  activeTrigger?.focus();
}
```

Add Escape support through the native dialog behavior and prevent payment form submission.

- [ ] **Step 5: Run contract and browser dialog tests**

Run: `node --test tests/academy-contract.test.js`
Expected: PASS.

Run: `TEST_GROUP=academy-dialogs node tests/academy-ui.js`
Expected: PASS with trigger focus restored after closing.

- [ ] **Step 6: Commit**

```bash
git add academy/index.html academy/styles/academy.css academy/scripts/academy-mockups.js tests/academy-contract.test.js tests/academy-ui.js
git commit -m "feat: add academy content mockups"
```

### Task 4: Working Basic Manseryeok Learning Tool

**Files:**
- Modify: `academy/index.html`
- Modify: `academy/styles/academy.css`
- Create: `academy/scripts/academy-manse.js`
- Modify: `tests/academy-contract.test.js`
- Modify: `tests/academy-ui.js`

**Interfaces:**
- Consumes: `window.ManseryeokAdapter.calculate(input)`.
- Loads: `../scripts/vendor/manseryeok.browser.js` and `../scripts/manseryeok-adapter.js`.
- Produces: `window.AcademyManse.calculateFromForm(): void`.
- Produces: result nodes `academyPillars`, `academyLuckFlow`, and `academyManseError`.

- [ ] **Step 1: Write failing basic-calculation browser test**

```js
await page.type('#academyBirth', '19860219');
await page.type('#academyTime', '1430');
await page.click('#academyCalculate');
await page.waitForSelector('#academyPillars:not([hidden])');
const pillars = await page.$$eval('[data-pillar]', nodes => nodes.map(node => node.textContent.trim()));
assert.equal(pillars.length, 4);
assert.ok(pillars.every(Boolean));
```

- [ ] **Step 2: Run the Manseryeok UI group and verify RED**

Run: `TEST_GROUP=academy-manse node tests/academy-ui.js`
Expected: FAIL because the form and result do not exist.

- [ ] **Step 3: Add the basic form and result shell**

Use fields for name, gender, calendar, leap-month choice when lunar, `YYYYMMDD`, `HHMM`, and unknown time. Keep submit and error output adjacent. Add four empty pillar cards and a horizontally scrollable luck-cycle row.

- [ ] **Step 4: Parse and calculate through the verified adapter**

```js
function buildInput(form) {
  const birth = form.elements.birth.value.replace(/\D/g, '');
  const time = form.elements.time.value.replace(/\D/g, '');
  if (!/^\d{8}$/.test(birth)) throw new Error('생년월일 8자리를 입력해 주세요.');
  if (!form.elements.unknown.checked && !/^\d{4}$/.test(time)) {
    throw new Error('태어난 시간을 4자리로 입력해 주세요.');
  }
  return {
    year: Number(birth.slice(0, 4)),
    month: Number(birth.slice(4, 6)),
    day: Number(birth.slice(6, 8)),
    hour: form.elements.unknown.checked ? 12 : Number(time.slice(0, 2)),
    minute: form.elements.unknown.checked ? 0 : Number(time.slice(2, 4)),
    calendar: form.elements.calendar.value,
    isLeapMonth: form.elements.leap.value === 'leap',
    gender: form.elements.gender.value,
    unknown: form.elements.unknown.checked,
    dayBoundary: 'midnight'
  };
}
```

Render only text with `textContent`. Show hour as `시간 미상` when unknown. Add short expandable learning notes for 천간, 지지, 오행, and 십성 without deterministic life claims.

- [ ] **Step 5: Run engine and browser tests**

Run: `node --test tests/ganji-fixtures.test.js tests/academy-contract.test.js`
Expected: PASS.

Run: `TEST_GROUP=academy-manse node tests/academy-ui.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add academy/index.html academy/styles/academy.css academy/scripts/academy-manse.js tests/academy-contract.test.js tests/academy-ui.js
git commit -m "feat: add academy basic manseryeok"
```

### Task 5: Responsive Geometry, Accessibility, and Performance

**Files:**
- Modify: `academy/styles/academy.css`
- Modify: `academy/scripts/academy-motion.js`
- Modify: `tests/academy-ui.js`

**Interfaces:**
- Consumes all academy section and dialog hooks.
- Produces no new public JavaScript API.

- [ ] **Step 1: Add failing viewport assertions**

Test viewports `1920x1080`, `1440x900`, `1366x768`, `1280x720`, `768x1024`, and `360x800`. Assert:

```js
assert.equal(metrics.horizontalOverflow, 0);
assert.ok(metrics.heroCtasVisible);
assert.equal(metrics.fixedOverlap, 0);
assert.equal(metrics.consoleErrors.length, 0);
```

- [ ] **Step 2: Run geometry tests and verify RED**

Run: `TEST_GROUP=academy-layout node tests/academy-ui.js`
Expected: FAIL at one or more constrained viewports before responsive tuning.

- [ ] **Step 3: Tune responsive layouts**

At 1199px collapse hero to a narrower two-column composition. At 767px switch all cards and Manseryeok fields to one column, reduce decorative layers, and keep touch targets at least 44px high. Add bottom safe-area padding without a fixed bottom navigation.

- [ ] **Step 4: Add keyboard and reduced-motion checks**

Use Puppeteer emulation for reduced motion and assert computed animation names are `none` for mist and orbit. Tab through the masthead, CTA, form, cards, and dialogs and assert focus visibility.

- [ ] **Step 5: Run all academy tests and commit**

Run: `node --test tests/academy-*.test.js`
Expected: PASS.

Run: `node tests/academy-ui.js`
Expected: PASS at all six viewports.

Commit:

```bash
git add academy/styles/academy.css academy/scripts/academy-motion.js tests/academy-ui.js
git commit -m "fix: harden academy responsive experience"
```

### Task 6: Offline Scope, Release Audit, and Deployment

**Files:**
- Create: `academy/manifest.webmanifest`
- Create: `academy/sw.js`
- Modify: `academy/index.html`
- Modify: `tests/academy-contract.test.js`
- Modify: `tests/academy-ui.js`

**Interfaces:**
- Produces: service-worker scope `/palpum-manse/academy/`.
- Produces: cache prefix `chwimyeongseon-academy-`.
- Must not consume or delete caches beginning with `palpum-manse-` or `legend-manse-`.

- [ ] **Step 1: Write failing isolation tests**

```js
test('academy service worker owns only academy scope and cache keys', () => {
  assert.match(sw, /const CACHE_PREFIX = 'chwimyeongseon-academy-'/);
  assert.match(sw, /startsWith\(CACHE_PREFIX\)/);
  assert.doesNotMatch(sw, /caches\.delete\([^)]*palpum-manse/);
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
});
```

- [ ] **Step 2: Run isolation tests and verify RED**

Run: `node --test tests/academy-contract.test.js`
Expected: FAIL because manifest and service worker are missing.

- [ ] **Step 3: Add isolated PWA assets**

Precache the academy HTML, CSS, scripts, shared landscape and seal, and existing Manseryeok browser engine. Delete only stale keys that start with `chwimyeongseon-academy-`.

- [ ] **Step 4: Run the complete local release gate**

Run: `npm test`
Expected: existing 114+ core tests and existing UI tests PASS.

Run: `node --test tests/academy-*.test.js`
Expected: PASS.

Run: `node tests/academy-ui.js`
Expected: PASS.

- [ ] **Step 5: Commit and push only the Palpum remote**

```bash
git add academy tests/academy-contract.test.js tests/academy-motion.test.js tests/academy-ui.js
git commit -m "feat: ship Chwimyeongseon academy mockup"
git push palpum feat/legend-manse-implementation:main
```

- [ ] **Step 6: Verify GitHub Pages production**

Open `https://jansang18.github.io/palpum-manse/academy/?verify=<commit>` at `1920x1080`, `1280x720`, and `360x800`. Calculate `19860219` at `1430`, open every mockup dialog, verify no console errors, and confirm the existing root app remains available at `https://jansang18.github.io/palpum-manse/`.

