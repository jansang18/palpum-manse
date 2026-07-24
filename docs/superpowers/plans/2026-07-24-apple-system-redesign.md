# Apple System Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visible gold/cosmic interface with a complete Apple-system-inspired light and dark UI while preserving all manse calculation features and enforcing precise box/text alignment.

**Architecture:** Keep the existing HTML and calculation code stable. Add a final, reversible `apple.css` presentation layer after `polish.css` and `luxury.css`, then extend the existing Puppeteer regression runner to verify theme colors, geometry, alignment, accessibility, and overflow. Mirror all runtime assets to `app/web`, update PWA/release inventories, and rebuild the protected Android artifacts.

**Tech Stack:** HTML5, CSS custom properties, CSS Grid/Flexbox, JavaScript, Puppeteer Core, Capacitor 8, PowerShell release tooling, Gradle Android build.

## Global Constraints

- Both light and dark themes must be complete.
- No visible gold gradient, gold border, gold glow, or gold selection state may remain.
- Use system blue `#007AFF` in light mode and `#0A84FF` in dark mode.
- Render five-element Hanja and status text with the approved pastel palette only where they encode saju data; keep body copy neutral for contrast.
- Preserve all calculation, storage, sharing, match, calendar, and back-button behavior.
- Express a pretty, cute, and soft personality through rounded geometry, pastel element colors, calm spacing, and restrained motion; do not add mascots, decorative sparkles, or childish ornament.
- All touch targets must be at least 44×44px.
- CJK boxes must keep `aspect-ratio: 1 / 1`; width/height error must be at most 1px.
- Same-row box height error must be at most 1px.
- Single-label visual center deviation must be at most 2px.
- No horizontal overflow at 360, 390, 412, or 768px.
- Maintain reduced-motion, reduced-transparency, high-contrast, focus, dialog, and Android `allowBackup=false` behavior.

---

## File Structure

- Create `app/www/apple.css`: final Apple-system visual layer and component geometry.
- Modify `app/www/index.html`: load `apple.css` after prior theme files and add only semantic hooks required by the visual layer.
- Modify `app/ui-regression.js`: automated Apple token, no-gold, alignment, square, contrast, overflow, and interaction checks.
- Mirror `apple.css`, `index.html`, and `ui-regression.js` into `app/web`.
- Modify `app/web/sw.js`: bump cache version and precache `apple.css`.
- Modify `app/web/scripts/build-protected.ps1`: include `apple.css` in the shared release inventory.
- Create `backups/2026-07-24-before-apple/www`: immutable pre-redesign runtime backup.
- Regenerate `app/shots/*_light.png` and `app/shots/*_dark.png`.
- Regenerate protected APK/AAB in `outputs/2026-07-24-apple-redesign`.

---

### Task 1: Baseline Backup and Failing Apple Contract

**Files:**
- Create: `backups/2026-07-24-before-apple/www/*`
- Modify: `app/ui-regression.js`
- Test: `app/ui-regression.js`

**Interfaces:**
- Consumes: current `app/www` runtime and existing `inspectWidth(browser, width)`.
- Produces: `TEST_GROUP=apple-design` contract used by all later tasks.

- [ ] **Step 1: Copy the current runtime to the dated backup**

Use PowerShell `Copy-Item -Recurse` after resolving both paths under `C:\Users\whaak\Desktop\manse`.

- [ ] **Step 2: Add failing Apple-theme assertions**

Add an `apple-design` test group that checks:

```js
const appleCss = fs.readFileSync(path.join(UI_ROOT, 'apple.css'), 'utf8');
assert.match(appleCss, /--apple-accent:\s*#007aff/i);
assert.match(appleCss, /body\.dark[\s\S]*--apple-accent:\s*#0a84ff/i);
assert.doesNotMatch(appleCss, /#d8b56a|#f0d69a|#a97732/i);
```

In `inspectWidth`, collect top bar, active tab, primary button, form fields, pillar blocks, and luck blocks in both themes. Assert that the active accent resolves to the expected system blue and that no visible border/text/background equals the prior gold palette.

- [ ] **Step 3: Add failing geometry assertions**

For each `.pillar-block`, `.luck-block`, `.segmented button`, `.tab`, and `.primary-btn`, measure:

```js
const rect = element.getBoundingClientRect();
const center = {
  x: Math.abs((textRect.left + textRect.right) / 2 - (rect.left + rect.right) / 2),
  y: Math.abs((textRect.top + textRect.bottom) / 2 - (rect.top + rect.bottom) / 2)
};
```

Require square blocks within 1px, same-row heights within 1px, and single-label center deviation within 2px.

- [ ] **Step 4: Run the contract and verify RED**

Run:

```powershell
$env:TEST_GROUP='apple-design'
node ui-regression.js
```

Expected: FAIL because `app/www/apple.css` does not exist.

- [ ] **Step 5: Commit test and backup metadata**

Commit only the versioned test changes in `app/web` after mirroring the test runner. Keep the filesystem backup outside the Git repository.

---

### Task 2: Apple Theme Foundation, Typography, and Navigation

**Files:**
- Create: `app/www/apple.css`
- Modify: `app/www/index.html`
- Modify: `app/ui-regression.js`
- Test: `app/ui-regression.js`

**Interfaces:**
- Consumes: existing DOM class names and theme toggle using `body.dark`.
- Produces: semantic tokens `--apple-bg`, `--apple-surface`, `--apple-surface-2`, `--apple-label`, `--apple-secondary`, `--apple-separator`, `--apple-accent`, `--apple-focus`, `--apple-cjk-offset`.
- Produces pastel element tokens for wood/fire/earth/metal/water surfaces and foregrounds in both themes.

- [ ] **Step 1: Load the final style layer**

Add after the existing theme links:

```html
<link rel="stylesheet" href="apple.css">
```

- [ ] **Step 2: Implement light/dark tokens and system typography**

Create `apple.css` with:

```css
:root {
  color-scheme: light dark;
  --apple-bg: #f2f2f7;
  --apple-surface: #fff;
  --apple-surface-2: #f7f7fa;
  --apple-label: #111113;
  --apple-secondary: #636366;
  --apple-tertiary: #8e8e93;
  --apple-separator: rgba(60, 60, 67, .16);
  --apple-accent: #007aff;
  --apple-focus: rgba(0, 122, 255, .28);
  --apple-cjk-offset: -.035em;
  font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo",
    "Noto Sans KR", sans-serif;
}
body.dark {
  --apple-bg: #000;
  --apple-surface: #1c1c1e;
  --apple-surface-2: #2c2c2e;
  --apple-label: #f5f5f7;
  --apple-secondary: #aeaeb2;
  --apple-tertiary: #8e8e93;
  --apple-separator: rgba(84, 84, 88, .58);
  --apple-accent: #0a84ff;
  --apple-focus: rgba(10, 132, 255, .34);
}
```

Override body backgrounds, remove radial/space gradients, remove gold text clipping, and render `main-logo.png` monochromatically with theme-sensitive CSS filters.

Add the exact approved element tokens from the design spec. Light mode uses pastel surfaces with deeper matching foregrounds; dark mode uses deep tinted surfaces with bright pastel foregrounds. Do not apply these tokens to body copy, navigation, or generic cards.

- [ ] **Step 3: Rebuild top bar and six-tab rail**

Use sticky translucent surfaces, blur only on navigation chrome, 44px icon buttons, a capsule selected tab, and no underline/glow:

```css
.tab.active {
  color: var(--apple-accent) !important;
  background: color-mix(in srgb, var(--apple-accent) 12%, transparent);
}
.tab.active::after { display: none !important; }
```

- [ ] **Step 4: Run focused Apple tests**

Run:

```powershell
$env:TEST_GROUP='apple-design'
node ui-regression.js
```

Expected: token and navigation assertions PASS; component assertions may remain failing until later tasks.

- [ ] **Step 5: Commit**

Commit `apple.css`, `index.html`, and test changes as `feat: add Apple system theme foundation`.

---

### Task 3: Forms, Buttons, Cards, and Feedback

**Files:**
- Modify: `app/www/apple.css`
- Test: `app/ui-regression.js`

**Interfaces:**
- Consumes: Task 2 semantic tokens.
- Produces: unified form, grouped-card, button, press, focus, toast, and modal visual contracts.

- [ ] **Step 1: Add failing component style assertions**

Assert 52px input height, 54px primary button height, 44px minimum interactive target, 12/14/18px radii, visible focus ring, and no decorative pseudo-element on `.primary-btn`.
Assert that each element-colored Hanja resolves to its theme-specific pastel foreground/background pair and meets 3:1 contrast for large Hanja.

- [ ] **Step 2: Verify RED**

Run `TEST_GROUP=apple-design`; expect form/button geometry failures.

- [ ] **Step 3: Implement grouped forms and controls**

Use flat inset surfaces, hairline separators, system-blue focus, iOS segmented controls, and remove gradients, star glyphs, gold borders, and oversized shadows.

- [ ] **Step 4: Implement card hierarchy**

Unify `.input-card`, `.oguk-card`, `.luck-section`, `.overall-card`, `.f-card`, `.match-total-card`, `.cal-grid`, `.saved-card`, and modal surfaces under the same Apple surface/radius system. Keep two-line body text left aligned; center only single labels, section headers required by the product, and numeric/state indicators.

- [ ] **Step 5: Implement press and accessibility states**

Add pointer-down scale/brightness response, `:focus-visible`, reduced-motion cross-fades, reduced-transparency solid surfaces, and high-contrast borders.

- [ ] **Step 6: Run focused tests and commit**

Expected: component geometry, focus, and contrast checks PASS.

Commit as `feat: restyle Apple forms and surfaces`.

---

### Task 4: Pillars, Hanja Geometry, and Luck Flow Alignment

**Files:**
- Modify: `app/www/apple.css`
- Modify: `app/ui-regression.js`
- Test: `app/ui-regression.js`

**Interfaces:**
- Consumes: existing `.pillar-grid`, `.pillar-block`, `.luck-item`, `.luck-block`, `.jijanggan`, and flow containers.
- Produces: one reusable geometric system for pillars and all luck periods.

- [ ] **Step 1: Add per-row alignment tests**

Measure the four natal pillars and visible fortune rows. Assert:

```js
assert.ok(Math.abs(width - height) <= 1);
assert.ok(Math.max(...rowHeights) - Math.min(...rowHeights) <= 1);
assert.ok(centerDeltaX <= 2 && centerDeltaY <= 2);
```

Also assert no individual block uses an inline `top`, `margin-top`, or differing transform correction.

- [ ] **Step 2: Verify RED**

Run `TEST_GROUP=apple-design`; expect current vertical-center and mixed-height assertions to fail.

- [ ] **Step 3: Implement shared square geometry**

Use:

```css
.pillar-block,
.luck-block {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  padding: 0;
}
.pillar-block .han,
.luck-block .han {
  line-height: 1;
  transform: translateY(var(--apple-cjk-offset));
}
```

Separate the Hanja and Korean reading into fixed grid rows so the reading cannot push the Hanja off center.

- [ ] **Step 4: Normalize all luck rows**

Use explicit equal-column grids for daeun, seun, wolun, and ilun; preserve all-visible behavior where it fits and permit contained horizontal scrolling only when text would become unreadable. Center section titles, keep item labels geometrically centered, and use the system-blue selection state.

- [ ] **Step 5: Verify at all widths and commit**

Run full 360/390/412/768 regression. Expected: square, alignment, and overflow assertions PASS.

Commit as `fix: unify hanja and luck alignment`.

---

### Task 5: Secondary Screens, Sheets, and Motion Polish

**Files:**
- Modify: `app/www/apple.css`
- Modify only if needed: `app/www/index.html`, `app/www/share.js`, `app/www/nav.js`
- Test: `app/ui-regression.js`

**Interfaces:**
- Consumes: existing interruptible modal API, calendar animation, share overlay, toast, and match slot animation.
- Produces: visually consistent Apple-style secondary screens without changing behavior.

- [ ] **Step 1: Add failing visual-state tests**

Check match slots, calendar cells, saved cards, share dialog, toast, and each `.modal` in both themes. Require consistent surface tokens, blue selection, 44px controls, and dialog focus behavior.

- [ ] **Step 2: Restyle fortune, match, calendar, and saved views**

Remove gold/cosmic decorations, use grouped lists and system labels, preserve meaningful five-element colors, and align titles and empty states.

- [ ] **Step 3: Restyle sheets and dialogs**

Use a dimmed backdrop, translucent/solid adaptive material, centered desktop dialog, mobile bottom sheet, 36×5px grabber, and symmetric enter/exit paths. Do not reimplement the existing interruption/focus logic.

- [ ] **Step 4: Remove gratuitous animation**

Disable automatic shimmer, staggered view-entry cascades, and looping decoration. Keep immediate press feedback, tab selection, calendar direction, first match fill, toast, and sheet transitions.

- [ ] **Step 5: Run interaction and accessibility tests**

Expected: Android/web back closes overlays, Escape works, focus restores, reduced-motion uses fades, and theme contrast is at least 4.5:1.

- [ ] **Step 6: Commit**

Commit as `feat: finish Apple secondary screens and sheets`.

---

### Task 6: Mirror, PWA, Visual QA, and Protected Android Build

**Files:**
- Modify: `app/web/index.html`
- Create: `app/web/apple.css`
- Modify: `app/web/sw.js`
- Modify: `app/web/scripts/build-protected.ps1`
- Modify: `app/web/tests/ui-regression.js`
- Create: `outputs/2026-07-24-apple-redesign/*`

**Interfaces:**
- Consumes: completed `app/www` runtime and existing protected release script.
- Produces: byte-identical web mirror, updated PWA cache, fresh screenshots, signed protected APK/AAB.

- [ ] **Step 1: Mirror runtime assets**

Copy `index.html`, `apple.css`, and any changed JS/CSS byte-for-byte to `app/web`. Copy `app/ui-regression.js` to `app/web/tests/ui-regression.js`.

- [ ] **Step 2: Update PWA and release inventories**

Add `apple.css` to `PRECACHE`, bump `VERSION`, and add `apple.css` to `$ReleaseWebFiles`.

- [ ] **Step 3: Run source and mirror tests**

Run:

```powershell
node ui-regression.js
$env:UI_ROOT='web'
node ui-regression.js
```

Expected: both PASS at 360, 390, 412, and 768.

- [ ] **Step 4: Capture both themes**

Run the capture workflow for light and dark. Review input, result, fortune, match, calendar, and saved screenshots for visible gold, off-center labels, inconsistent row heights, clipped content, or stale cosmic decoration.

- [ ] **Step 5: Build protected APK/AAB**

Run the protected release script with output directory `outputs/2026-07-24-apple-redesign`. Require protected regression PASS, Gradle `BUILD SUCCESSFUL`, APK v2 true, AAB signature verified, `allowBackup=false`, and clean asset restore.

- [ ] **Step 6: Final verification and commit**

Run syntax checks, `git diff --check`, mirror hash comparison, artifact `VerifyOnly`, and an independent final review. Commit final release-source changes as `release: prepare Apple redesign`.
