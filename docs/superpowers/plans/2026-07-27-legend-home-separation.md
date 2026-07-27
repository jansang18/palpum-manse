# Legend Home Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the separately deployed Legend Manse app visibly and structurally distinct from the original manse app on first load.

**Architecture:** Keep the verified calculation, storage, and result views unchanged. Start on the existing `legend` destination and replace its no-profile empty state with a public current-era home that reads from `LegendEra.getLegendEra()`, then routes into the existing input or person-search flows.

**Tech Stack:** Static HTML, CSS, browser JavaScript, Node test runner, Puppeteer Core, GitHub Pages PWA.

## Global Constraints

- Preserve solar support for 1026 through 2099 and existing historical provenance behavior.
- Do not modify the original `jansang18/sineum-manse` repository or deployment.
- Keep all existing element IDs used by calculation and browser tests.
- Keep touch targets at least 44px and provide keyboard focus states.
- Hide decorative orbit graphics from assistive technology and expose equivalent text.
- Disable decorative entrance motion under `prefers-reduced-motion`.

---

### Task 1: Lock the distinct first-load contract

**Files:**
- Modify: `tests/pwa-isolation.test.js`
- Modify: `tests/ui-regression.js`

**Interfaces:**
- Consumes: existing DOM destinations and `window.LegendEra.getLegendEra(year)`
- Produces: regression coverage for the default `legend` destination and both landing actions

- [ ] **Step 1: Add source-level failing assertions**

Assert that the initial active tab is `data-tab="legend"`, `#view-legend` is initially visible, `#view-input` is initially hidden, and the service-worker cache uses the next release identity.

- [ ] **Step 2: Add a browser failing scenario**

At 390px, load the app and assert:

```js
{
  selectedTab: 'legend',
  hasLanding: true,
  hasEra: true,
  hasOpenButton: true,
  hasPersonButton: true
}
```

Click `#legendStartButton` and require the input destination plus focus on `#inBirth`. Reload, click `#legendPersonButton`, and require the person-search modal plus focus on `#psQuery`.

- [ ] **Step 3: Run focused tests and confirm failure**

Run:

```powershell
node --test tests/pwa-isolation.test.js
node tests/ui-regression.js
```

Expected: failure because the input destination still owns the initial state and the landing controls do not exist.

### Task 2: Build the current-era legend home

**Files:**
- Modify: `scripts/legend-view.js`
- Modify: `styles/legend-layout.css`
- Modify: `styles/legend-motion.css`

**Interfaces:**
- Consumes: `LegendEra.getLegendEra(year)` and `activateLegendDestination(tabName, options)`
- Produces: `#legendLanding`, `#legendStartButton`, and `#legendPersonButton`

- [ ] **Step 1: Replace the empty renderer**

Have `emptyView(mount)` read the current year and render:

```js
const era = root.LegendEra.getLegendEra(new Date().getFullYear());
```

The text output must include `era.yuan`, `era.period`, `era.periodStart`, `era.periodEnd`, `era.element`, and `era.progress`.

- [ ] **Step 2: Wire the two actions**

`#legendStartButton` activates `input` and focuses `#inBirth`. `#legendPersonButton` activates `input`, invokes `#personSearchBtn.click()`, and focuses `#psQuery` after the modal opens.

- [ ] **Step 3: Add the distinct visual composition**

Create a paper-and-ink landing with:

- asymmetric landscape hero
- decorative nine-node orbit with the current period marked
- current period fact block
- seven temporal scales
- two high-contrast actions
- source disclosure

Ensure 360px collapses to one column with no horizontal overflow.

- [ ] **Step 4: Add purposeful and reduced motion**

Use a short mist entrance and slow orbit drift only for visual hierarchy. Remove both in `prefers-reduced-motion`.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
node --test tests/pwa-isolation.test.js
node tests/ui-regression.js
```

Expected: PASS.

### Task 3: Change initial navigation and release identity

**Files:**
- Modify: `index.html`
- Modify: `sw.js`
- Test: `tests/pwa-isolation.test.js`

**Interfaces:**
- Consumes: existing `syncDestination(currentDestination())`
- Produces: first-load `legend` destination and a cache identity that cannot serve the previous shell

- [ ] **Step 1: Change initial ARIA and hidden states**

Set only `#tab-legend` to `class="tab active"`, `aria-selected="true"`, and `tabindex="0"`. Set `#view-legend` visible and active; set `#view-input` hidden.

- [ ] **Step 2: Clarify navigation copy**

Change the input destination label from `입력` to `내 사주` in both desktop and mobile navigation while preserving `data-tab="input"`.

- [ ] **Step 3: Bump the service-worker cache**

Change the cache identity from:

```js
legend-manse-v3-20260727-final
```

to:

```js
legend-manse-v4-20260727-home
```

- [ ] **Step 4: Run focused tests**

Run:

```powershell
node --test tests/pwa-isolation.test.js
node tests/ui-regression.js
```

Expected: PASS.

### Task 4: Full verification and deployment

**Files:**
- No source changes expected

**Interfaces:**
- Consumes: the finished release commit
- Produces: verified `legend/main` and GitHub Pages deployment

- [ ] **Step 1: Run the complete local gate**

```powershell
npm test
npm audit --omit=dev
git diff --check
git fsck --connectivity-only
```

Expected: all tests pass, zero vulnerabilities, and no repository errors.

- [ ] **Step 2: Compare fresh mobile screenshots**

Capture the first viewport at 390x844 for both deployment sources. Confirm the new app starts with the paper-and-ink era home while the original starts with the black input form.

- [ ] **Step 3: Push only the separate remote**

```powershell
git push legend HEAD:main
```

Confirm `origin` remains `https://github.com/jansang18/sineum-manse.git`.

- [ ] **Step 4: Wait for Pages and verify production**

Require the Pages build to reference the pushed commit. In a fresh browser context verify the title, selected `legend` destination, current-era text, both entry actions, PWA cache `legend-manse-v4-20260727-home`, and zero console/page/request errors.
