# Restrained Premium Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add interruptible, restrained motion to modal transitions, save feedback, calendar month navigation, and compatibility-slot filling without moving dense saju data.

**Architecture:** Keep the existing vanilla HTML/CSS/JavaScript structure. Add a small global motion API inside `index.html`, use the Web Animations API for interruptible modal and calendar transitions, keep CSS for materials and accessibility fallbacks, and make `nav.js` call the shared modal close function. Extend the existing Puppeteer regression test before each behavior is implemented.

**Tech Stack:** Vanilla JavaScript, CSS, Web Animations API, Puppeteer Core, Capacitor 8, Android Gradle.

## Global Constraints

- Animate only `transform` and `opacity`.
- Use `cubic-bezier(.2,.7,.2,1)` for entrance motion.
- Keep each transition between 100ms and 240ms.
- Do not animate original-chart, daeun, seun, monthly-luck, daily-luck, fortune-score, or calendar-day cells individually.
- Do not add a spring or animation dependency.
- Transitions must be interruptible and must not lock input.
- Preserve square hanja cells at 360, 390, 412, and 768px.
- Provide `prefers-reduced-motion`, `prefers-reduced-transparency`, and `prefers-contrast` behavior.
- Keep `app/www` as the Android source and mirror release web files into `app/web`.

---

### Task 1: Backup and shared modal motion

**Files:**
- Create: `backups/2026-07-20-before-motion/www/index.html`
- Create: `backups/2026-07-20-before-motion/www/luxury.css`
- Create: `backups/2026-07-20-before-motion/www/nav.js`
- Modify: `app/ui-regression.js`
- Modify: `app/www/index.html`
- Modify: `app/www/nav.js`

**Interfaces:**
- Produces: `window.openAppModal(modal: Element): boolean`
- Produces: `window.closeAppModal(modal: Element): boolean`
- Produces: `window.closeTopAppModal(): boolean`
- Consumes: existing `.modal-bg`, `.modal`, and `.active` markup.

- [ ] **Step 1: Copy the current release source into the dated backup directory**

Run:

```powershell
$dst='C:\Users\whaak\Desktop\manse\backups\2026-07-20-before-motion\www'
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item app\www\index.html,app\www\luxury.css,app\www\nav.js -Destination $dst -Force
```

Expected: the three files exist under the backup directory and have non-zero length.

- [ ] **Step 2: Add a failing modal-motion contract to `ui-regression.js`**

Inside `inspectWidth`, immediately after dark mode is enabled, add:

```js
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
}
```

- [ ] **Step 3: Run the regression test and verify RED**

Run: `node ui-regression.js`

Expected: FAIL because `window.openAppModal` is `undefined`.

- [ ] **Step 4: Add the minimal interruptible modal API to the main inline script**

Add one shared state map and the following public functions before modal event binding:

```js
const appModalMotion = new WeakMap();

function reducedMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function stopElementAnimation(el) {
  const animation = appModalMotion.get(el);
  if (!animation) return;
  try { animation.commitStyles(); } catch (e) {}
  animation.cancel();
  appModalMotion.delete(el);
}

function runElementAnimation(el, keyframes, options) {
  stopElementAnimation(el);
  if (!el || typeof el.animate !== 'function') return null;
  const animation = el.animate(keyframes, options);
  appModalMotion.set(el, animation);
  animation.finished.catch(() => {}).finally(() => {
    if (appModalMotion.get(el) === animation) appModalMotion.delete(el);
  });
  return animation;
}

window.openAppModal = function openAppModal(modal) {
  if (!modal) return false;
  const panel = modal.querySelector('.modal');
  modal.classList.add('active');
  modal.classList.remove('is-closing');
  const reduce = reducedMotion();
  const centered = window.matchMedia && window.matchMedia('(min-width: 768px)').matches;
  runElementAnimation(modal, [{ opacity: 0 }, { opacity: 1 }], {
    duration: reduce ? 100 : 180,
    easing: 'linear',
    fill: 'both'
  });
  if (panel) runElementAnimation(panel, [
    { opacity: 0, transform: reduce ? 'translateY(0)' : centered ? 'translateY(8px)' : 'translateY(100%)' },
    { opacity: 1, transform: 'translateY(0)' }
  ], {
    duration: reduce ? 120 : 240,
    easing: 'cubic-bezier(.2,.7,.2,1)',
    fill: 'both'
  });
  return true;
};

window.closeAppModal = function closeAppModal(modal) {
  if (!modal || !modal.classList.contains('active')) return false;
  const panel = modal.querySelector('.modal');
  const reduce = reducedMotion();
  const centered = window.matchMedia && window.matchMedia('(min-width: 768px)').matches;
  modal.classList.add('is-closing');
  const bg = runElementAnimation(modal, [
    { opacity: parseFloat(getComputedStyle(modal).opacity) || 1 },
    { opacity: 0 }
  ], { duration: reduce ? 100 : 180, easing: 'linear', fill: 'both' });
  const sheet = panel && runElementAnimation(panel, [
    { opacity: parseFloat(getComputedStyle(panel).opacity) || 1, transform: getComputedStyle(panel).transform === 'none' ? 'translateY(0)' : getComputedStyle(panel).transform },
    { opacity: reduce ? 0 : .9, transform: reduce ? 'translateY(0)' : centered ? 'translateY(8px)' : 'translateY(100%)' }
  ], { duration: reduce ? 120 : 220, easing: 'cubic-bezier(.4,0,1,1)', fill: 'both' });
  const token = sheet || bg;
  Promise.resolve(token ? token.finished : null).catch(() => {}).then(() => {
    if (!modal.classList.contains('is-closing')) return;
    modal.classList.remove('active', 'is-closing');
    modal.style.opacity = '';
    if (panel) { panel.style.opacity = ''; panel.style.transform = ''; }
  });
  return true;
};

window.closeTopAppModal = function closeTopAppModal() {
  const modals = document.querySelectorAll('.modal-bg.active');
  return modals.length ? window.closeAppModal(modals[modals.length - 1]) : false;
};
```

Replace direct modal `classList.add('active')` calls with `window.openAppModal(modal)` and direct close calls with `window.closeAppModal(modal)`.

In `nav.js`, change `closeTopModal()` to:

```js
function closeTopModal() {
  if (typeof window.closeTopAppModal === 'function') return window.closeTopAppModal();
  var modals = document.querySelectorAll('.modal-bg.active');
  if (modals.length) { modals[modals.length - 1].classList.remove('active'); return true; }
  return false;
}
```

- [ ] **Step 5: Run the regression test and verify GREEN**

Run: `node ui-regression.js`

Expected: PASS for 360, 390, 412, and 768px.

- [ ] **Step 6: Commit the modal behavior**

```powershell
git -C app\web add docs/superpowers/plans/2026-07-20-restrained-premium-motion.md
git -C app\web commit -m "docs: add premium motion implementation plan"
```

Production source is committed after it is mirrored in Task 5.

---

### Task 2: Accessible save-completion toast

**Files:**
- Modify: `app/ui-regression.js`
- Modify: `app/www/index.html`
- Modify: `app/www/luxury.css`

**Interfaces:**
- Produces: `window.showAppToast(message: string): void`
- Consumes: static `#appToast[role="status"][aria-live="polite"]`.

- [ ] **Step 1: Add a failing toast test**

For width 390, evaluate the toast contract:

```js
const toastContract = await page.evaluate(() => ({
  fn: typeof window.showAppToast,
  role: document.getElementById('appToast')?.getAttribute('role'),
  live: document.getElementById('appToast')?.getAttribute('aria-live')
}));
assert.deepEqual(toastContract, { fn: 'function', role: 'status', live: 'polite' });
```

Also read `index.html` and assert that the save handler does not contain `alert('저장되었습니다')`.

- [ ] **Step 2: Run the test and verify RED**

Run: `node ui-regression.js`

Expected: FAIL because `#appToast` and `window.showAppToast` do not exist.

- [ ] **Step 3: Add static toast markup, behavior, and style**

Before the modal markup, add:

```html
<div id="appToast" class="app-toast" role="status" aria-live="polite" aria-atomic="true"></div>
```

Add the behavior:

```js
let appToastTimer = 0;
let appToastAnimation = null;
window.showAppToast = function showAppToast(message) {
  const toast = document.getElementById('appToast');
  if (!toast) return;
  clearTimeout(appToastTimer);
  if (appToastAnimation) { appToastAnimation.cancel(); appToastAnimation = null; }
  toast.textContent = String(message || '');
  toast.classList.add('show');
  const reduce = reducedMotion();
  if (toast.animate) appToastAnimation = toast.animate([
    { opacity: 0, transform: reduce ? 'translateY(0)' : 'translateY(12px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ], { duration: reduce ? 100 : 180, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' });
  appToastTimer = setTimeout(() => {
    const out = toast.animate ? toast.animate([
      { opacity: 1, transform: 'translateY(0)' },
      { opacity: 0, transform: reduce ? 'translateY(0)' : 'translateY(6px)' }
    ], { duration: reduce ? 100 : 140, easing: 'ease-in', fill: 'both' }) : null;
    Promise.resolve(out ? out.finished : null).catch(() => {}).then(() => {
      toast.classList.remove('show');
      toast.textContent = '';
    });
  }, 1800);
};
```

Replace `alert('저장되었습니다')` with `window.showAppToast('명반을 저장했습니다')`.

Add CSS:

```css
.app-toast {
  position: fixed;
  z-index: 120;
  left: 50%;
  bottom: calc(82px + env(safe-area-inset-bottom));
  max-width: min(360px, calc(100vw - 32px));
  padding: 12px 18px;
  border: 1px solid rgba(240, 214, 154, .34);
  border-radius: 999px;
  color: #171108;
  background: rgba(240, 214, 154, .96);
  box-shadow: 0 12px 32px rgba(0, 0, 0, .38);
  font-size: 13px;
  font-weight: 800;
  text-align: center;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 12px);
}
.app-toast.show { opacity: 1; transform: translate(-50%, 0); }
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node ui-regression.js`

Expected: PASS and no blocking save-success alert remains.

---

### Task 3: Directional, interruptible calendar-month transition

**Files:**
- Modify: `app/ui-regression.js`
- Modify: `app/www/index.html`

**Interfaces:**
- Produces: `changeCalendarMonth(delta: -1 | 1): void`
- Consumes: existing `renderCalendar()`, `calY`, `calM`, and `#calGrid`.

- [ ] **Step 1: Add failing calendar-direction tests**

For width 390, switch to the calendar tab, record the title, click next twice, and assert:

```js
const calendarMotion = await page.evaluate(async () => {
  document.querySelector('.tab[data-tab="calendar"]').click();
  const before = document.getElementById('calTitle').textContent;
  document.getElementById('calNext').click();
  document.getElementById('calNext').click();
  await new Promise(resolve => setTimeout(resolve, 320));
  return {
    before,
    after: document.getElementById('calTitle').textContent,
    direction: document.getElementById('calGrid').dataset.motionDirection,
    activeAnimations: document.getElementById('calGrid').getAnimations().length
  };
});
assert.notEqual(calendarMotion.after, calendarMotion.before);
assert.equal(calendarMotion.direction, 'next');
assert.equal(calendarMotion.activeAnimations, 0);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node ui-regression.js`

Expected: FAIL because `data-motion-direction` is absent.

- [ ] **Step 3: Implement `changeCalendarMonth` with cancellable WAAPI animations**

Add:

```js
let calendarAnimation = null;
let calendarMotionToken = 0;

function shiftCalendarValue(delta) {
  calM += delta;
  if (calM < 1) { calM = 12; calY--; }
  if (calM > 12) { calM = 1; calY++; }
  selectedCalDay = null;
  selectedSijuBranch = null;
}

function changeCalendarMonth(delta) {
  const grid = document.getElementById('calGrid');
  shiftCalendarValue(delta);
  const direction = delta > 0 ? 'next' : 'prev';
  if (!grid || typeof grid.animate !== 'function' || reducedMotion()) {
    renderCalendar();
    if (grid) grid.dataset.motionDirection = direction;
    return;
  }
  const token = ++calendarMotionToken;
  if (calendarAnimation) {
    try { calendarAnimation.commitStyles(); } catch (e) {}
    calendarAnimation.cancel();
  }
  const outX = delta > 0 ? -8 : 8;
  calendarAnimation = grid.animate([
    { opacity: parseFloat(getComputedStyle(grid).opacity) || 1, transform: getComputedStyle(grid).transform === 'none' ? 'translateX(0)' : getComputedStyle(grid).transform },
    { opacity: .62, transform: `translateX(${outX}px)` }
  ], { duration: 100, easing: 'ease-in', fill: 'both' });
  calendarAnimation.finished.catch(() => {}).then(() => {
    if (token !== calendarMotionToken) return;
    renderCalendar();
    grid.dataset.motionDirection = direction;
    const inX = delta > 0 ? 8 : -8;
    calendarAnimation = grid.animate([
      { opacity: .62, transform: `translateX(${inX}px)` },
      { opacity: 1, transform: 'translateX(0)' }
    ], { duration: 140, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' });
    calendarAnimation.finished.catch(() => {}).finally(() => {
      if (token === calendarMotionToken) {
        calendarAnimation = null;
        grid.style.opacity = '';
        grid.style.transform = '';
      }
    });
  });
}
```

Replace the two calendar handlers with:

```js
onTap($('#calPrev'), () => changeCalendarMonth(-1));
onTap($('#calNext'), () => changeCalendarMonth(1));
```

Do not call `changeCalendarMonth` from date selection; it continues to call `renderCalendar()` directly.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node ui-regression.js`

Expected: two rapid next clicks advance two months, direction is `next`, and no animation remains after 320ms.

---

### Task 4: One-time match-slot fill transition

**Files:**
- Modify: `app/ui-regression.js`
- Modify: `app/www/index.html`

**Interfaces:**
- Produces: `animateNewMatchSlot(key: 'a' | 'b'): void`
- Consumes: existing `setMatchSlot`, `renderMatchPicker`, and `.match-slot` elements.

- [ ] **Step 1: Add a failing match-slot marker test**

For width 390, call `setMatchSlot('A', currentSaju)` and assert the filled A slot records a single entry:

```js
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
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node ui-regression.js`

Expected: FAIL because `data-motion-count` is absent.

- [ ] **Step 3: Implement one-time slot animation**

Add:

```js
let pendingMatchSlotMotion = null;

function animateNewMatchSlot(key) {
  const slot = document.querySelector(`.match-slot.${key}.filled`);
  if (!slot) return;
  slot.dataset.motionCount = String((parseInt(slot.dataset.motionCount || '0', 10)) + 1);
  if (!slot.animate) return;
  const reduce = reducedMotion();
  slot.animate([
    { opacity: 0, transform: reduce ? 'scale(.99)' : 'scale(.97)' },
    { opacity: 1, transform: 'scale(1)' }
  ], { duration: reduce ? 100 : 180, easing: 'cubic-bezier(.2,.7,.2,1)' });
}
```

At the end of `renderMatchPicker()`, add:

```js
if (pendingMatchSlotMotion) {
  const key = pendingMatchSlotMotion;
  pendingMatchSlotMotion = null;
  requestAnimationFrame(() => animateNewMatchSlot(key));
}
```

Change `setMatchSlot` to:

```js
function setMatchSlot(target, person) {
  const wasEmpty = target === 'A' ? !matchSlotA : !matchSlotB;
  if (target === 'A') matchSlotA = person;
  else matchSlotB = person;
  pendingMatchSlotMotion = wasEmpty ? target.toLowerCase() : null;
  renderMatch();
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node ui-regression.js`

Expected: only slot A reports one entrance and square-layout checks remain green.

---

### Task 5: Apple accessibility materials and source mirroring

**Files:**
- Modify: `app/ui-regression.js`
- Modify: `app/www/luxury.css`
- Modify: `app/web/index.html`
- Modify: `app/web/luxury.css`
- Modify: `app/web/nav.js`
- Modify: `app/web/sw.js`

**Interfaces:**
- Consumes: modal and toast classes from Tasks 1 and 2.
- Produces: high-contrast and reduced-transparency material fallbacks.

- [ ] **Step 1: Add failing static accessibility assertions**

Read `www/luxury.css` and assert:

```js
const luxuryCss = fs.readFileSync(path.resolve(__dirname, 'www/luxury.css'), 'utf8');
assert.match(luxuryCss, /prefers-reduced-transparency:\s*reduce/);
assert.match(luxuryCss, /prefers-contrast:\s*more/);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node ui-regression.js`

Expected: FAIL because those media queries are absent.

- [ ] **Step 3: Add the accessibility material fallbacks**

Append:

```css
@media (prefers-reduced-motion: reduce) {
  .modal-bg,
  .modal,
  .app-toast { transition-duration: 100ms !important; }
}

@media (prefers-reduced-transparency: reduce) {
  body.dark .modal,
  .app-toast {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    background: #11141d !important;
  }
}

@media (prefers-contrast: more) {
  body.dark .modal,
  .app-toast {
    border-color: #f0d69a !important;
    background: #08090e !important;
    color: #fff8e7 !important;
  }
}
```

- [ ] **Step 4: Mirror source files and bump the service-worker cache**

Copy `www/index.html`, `www/luxury.css`, and `www/nav.js` into `web`. Change the service-worker version to:

```js
const VERSION = 'v6-20260720-premium-motion';
```

- [ ] **Step 5: Run source checks and commit**

Run:

```powershell
node --check www\nav.js
node --check ui-regression.js
node ui-regression.js
git -C web diff --check
git -C web add index.html luxury.css nav.js sw.js
git -C web commit -m "feat: add restrained premium motion"
```

Expected: syntax checks and UI regression pass; commit succeeds.

---

### Task 6: Visual QA, protected Android build, and delivery

**Files:**
- Modify: `app/android/app/src/main/assets/public/*` through Capacitor sync.
- Create: `outputs/2026-07-20-premium-motion/신의음성만세력_프리미엄모션_보호.apk`
- Create: `outputs/2026-07-20-premium-motion/신의음성만세력_프리미엄모션_보호.aab`
- Create: `outputs/2026-07-20-premium-motion/검증결과.md`

**Interfaces:**
- Consumes: verified `app/www` source.
- Produces: signed protected APK and Play Store AAB.

- [ ] **Step 1: Capture all six dark-theme screens**

Run: `node capture.js dark 390`

Expected: input, result, fortune, match, calendar, and saved screenshots are refreshed without clipping or horizontal overflow.

- [ ] **Step 2: Synchronize clean web assets into Android**

Run: `npx.cmd cap sync android`

Expected: Capacitor reports successful asset copy and plugin update.

- [ ] **Step 3: Obfuscate Android-only assets and verify them**

Run:

```powershell
node obfuscate_assets.js android\app\src\main\assets\public
$env:UI_ROOT='android\app\src\main\assets\public'
node ui-regression.js
```

Expected: obfuscation completes and all four viewport tests pass.

- [ ] **Step 4: Build signed release APK and AAB**

Run:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
Set-Location android
.\gradlew.bat assembleRelease bundleRelease --no-daemon
```

Expected: `BUILD SUCCESSFUL` and both release artifacts exist.

- [ ] **Step 5: Copy deliverables, verify signing, and restore clean Android assets**

Copy the APK/AAB to the dated output directory, run `apksigner verify --verbose --print-certs` on the APK, record SHA-256 hashes in `검증결과.md`, then run `npx.cmd cap sync android` again.

Expected: APK Signature Scheme v2 is true, hashes are recorded, and Android assets match clean `www` source after restoration.

- [ ] **Step 6: Run final verification**

Run:

```powershell
node ui-regression.js
node --check www\nav.js
node --check ui-regression.js
git -C web diff --check
```

Expected: all commands pass with no syntax errors or layout regressions.
