# Palpum Fortune Final Fix Report

Date: 2026-07-28 KST

## Status

**PASS - local release candidate is ready for the deployment step.**

All Critical/Important final-review findings, the mutable-storage isolation residual, and the requested easy minors were addressed with test-first changes. No remote was pushed, no deployment was created, and `artifacts/` was not touched or staged.

Implementation commit:

```text
e5dfa98f1a63a00fa240ec05b2ddcbb5892e21cc
fix: close Palpum final review findings
```

The final review package's literal `$(git rev-parse HEAD)` was replaced locally with the exact reviewed pre-fix HEAD:

```text
0120f8dfad33902be3e38693e91c9a96be68f9a2
```

The `.superpowers/sdd/` workspace is intentionally ignored by Git, so this report and that audit-package correction are not part of the implementation commit.

## Review Inputs

Read before editing:

- `.superpowers/sdd/2026-07-27-palpum-fortune/final-review.md`
- `docs/superpowers/specs/2026-07-27-palpum-fortune-design.md`
- `docs/superpowers/plans/2026-07-27-palpum-fortune.md`
- `.superpowers/sdd/2026-07-27-palpum-fortune/task-8-report.md`
- `.superpowers/sdd/2026-07-27-palpum-fortune/task-6-report.md`
- `.superpowers/sdd/2026-07-27-palpum-fortune/progress.md`

## RED Evidence

Production code was not edited until the new tests had failed for the expected reasons.

### PWA and storage isolation

Command:

```powershell
node --test tests/pwa-isolation.test.js
```

Observed RED:

- 35 tests
- 25 passed
- 10 failed

Expected failures covered:

- package identity still `legend-manse`
- top grouped tab initially controlled `view-legend` instead of the active input panel
- service-worker version/prefix still used the Legend namespace
- install opened a Legend-owned cache
- activation deleted existing Legend caches
- fetch intercepted a sibling `/legend-manse/` path
- mutable browser state still used `legend-saju:*`
- no read-only legacy-copy contract existed
- exported backups still identified as Legend
- Palpum backup imports were not accepted

### Composer layers and hidden stems

Command:

```powershell
node --test tests/legend-palpum-fortune.test.js
```

Observed RED:

- 15 tests
- 4 passed
- 11 failed

Expected failures covered:

- collapsed `target` still controlled timing
- evidence exposed only `팔품 / 시기 / 시대`
- Daeun, annual, and monthly changes did not independently affect evidence/state
- monthly composition did not include annual and monthly layers
- secondary and residual hidden stems were ignored
- uncertain-boundary output still mentioned Daeun

The four passing baseline cases confirmed that the RED fixtures did not break unrelated opposite-polarity, historical-disclosure, copy-distinctness, or immutability behavior.

### Day-boundary storage namespace

Command:

```powershell
node --test --test-name-pattern="advanced input exposes" tests/final-fix-contracts.test.js
```

Observed RED:

- 1 test
- 0 passed
- 1 failed
- failure showed `palpum-manse:day-boundary` was absent

### Browser result layering

Command:

```powershell
node tests/ui-regression.js --grep "Palpum result rendering"
```

Observed RED:

- annual evidence had `팔품 / 시기 / 시대`
- expected evidence was `팔품 / 대운 / 세운 / 시대`

### Browser period accessibility

Command:

```powershell
node tests/ui-regression.js --grep "Palpum period accessibility"
```

Observed RED:

- `#fortuneUpdateStatus` did not exist
- no stable `role="status"` / `aria-live="polite"` contract was available

### Grouped tab contract

The new static PWA test first failed because `#tab-legend` controlled `view-legend` while `view-input` was active. Browser assertions were then added to exercise dynamic input/result/legend destinations. During the browser run, unrelated stale navigation-layout expectations were corrected to the already-shipped primary navigation structure before the new grouped-control assertion was evaluated.

### Prefixed-path harness

The first full `/palpum-manse/` run failed before browser launch because the older VM harness passed a URL string as the `URL` global. The harness was updated to use Node's real `URL` constructor, preserving the production worker's registration-scope check. The complete prefixed run then passed.

## Implemented Fixes

### 1. Deployment and service-worker isolation

- Changed cache ownership from `legend-manse-*` to `palpum-manse-*`.
- Bumped the service-worker version to `v12-20260728-final-review`.
- Limited fetch interception to the service worker's exact same-origin registration scope.
- Preserved all simultaneous `legend-manse-*`, `sineum-manse-*`, and unrelated caches during Palpum activation.
- Added behavior-level VM tests for install, activate, network-first code, cached assets, offline document fallback, cross-origin requests, and sibling same-origin paths.
- Changed package and lockfile identity to `palpum-manse`.
- Added manifest `id: "./"` while preserving the visible brand `취명선 전설의 만세력`.
- Updated share-card/share-text and deployment guidance to `/palpum-manse/`.

### 2. Mutable storage isolation

- Moved records, fallback records, theme, day-boundary preference, and storage probes to `palpum-manse:*`.
- Added one-time read-only discovery of:
  - `legend-saju:record:*`
  - `legend-saju:records`
- Copied valid legacy records into Palpum-owned primary/fallback storage.
- Added `palpum-manse:legacy-copy-v1` so deleting or editing a copied Palpum chart does not mutate or continually resurrect the original Legend record.
- Never calls `set`, `delete`, or `setItem` with a legacy Legend key.
- Changed current backup metadata to:
  - `product: "palpum-manse"`
  - `schemaVersion: 2`
  - `ruleVersion: "palpum-1"`
- Kept read-only import compatibility for Legend v2 and approved v1 products.

### 3. Unknown-time boundary

- Provisional noon calculation now returns `daeun: null`.
- The Daeun fallback calculator is skipped when `palpumProvisional` is true.
- Annual scoring safely omits Daeun weights when Daeun is unavailable.
- The composer input omits Daeun for provisional results.
- Uncertain evidence does not contain a Daeun layer or Daeun claim.
- The visible timing summary suppresses Daeun and day-stem-dependent Sipsin labels, replacing them with an explicit relationship-pending message.
- Existing original-chart, Legend, match, save, and share entry points remain unavailable for provisional charts through the existing `hasCurrentSaju` boundary.

### 4. Explicit timing composition

- Replaced the deprecated collapsed timing `target` with:
  - `daeun`
  - `annual`
  - optional `monthly`
- Annual results compose Daeun plus annual evidence.
- Monthly and next-month results compose Daeun plus annual plus monthly evidence.
- Each layer has its own label, pillar, bounded relationship signal, and evidence item.
- Result disclosure text is generated from the evidence kinds actually composed.
- 9-yun remains weak context and cannot override a strong Palpum/timing state.
- Added deterministic tests proving each timing layer can independently change evidence and bounded state.

### 5. Ruler visibility

- Replaced the main-hidden-stem-only lookup with the complete immutable 12-branch hidden-stem table.
- Inspects main, middle, and residual hidden stems.
- Counts direct heavenly-stem occurrences individually.
- Counts each natal branch at most once even if an exact ruler could appear in more than one hidden layer.
- Added secondary, residual, and opposite-polarity fixtures.

### 6. Period accessibility

- Added stable `#fortuneUpdateStatus` outside the rerendered `#fortuneContent`.
- Added `role="status"`, `aria-live="polite"`, and `aria-atomic="true"`.
- Captures and restores equivalent focus for:
  - quick-period buttons
  - previous/next year controls
  - month buttons
- Announces the exact updated year/month and period type.
- Added keyboard and pointer browser checks.

### 7. Easy minors

- Initial grouped top tab now controls `view-input`.
- Grouped top tab dynamically updates `aria-controls` for active input/result/legend panels.
- Canonical design states are now consistently `발현 / 전환 / 조율 / 축적`.
- Canonical design documents full hidden-stem binary counting.
- Added an exact 1026 lower-bound visible historical-disclosure assertion.
- Pinned the reviewed HEAD in the local final-review package.
- Updated deployment and security guidance to the Palpum identity and isolation model.

## GREEN Evidence

### Focused unit and contract gates

```text
tests/pwa-isolation.test.js                 35/35 PASS
tests/legend-palpum-fortune.test.js         15/15 PASS
day-boundary focused contract                1/1 PASS
```

### Focused browser gates

```text
Palpum result rendering                     390px PASS
Palpum period accessibility                 390px PASS
Legend grouped navigation                   390px, 1220px PASS
```

### Complete core gate

Command:

```powershell
npm run test:core
```

Result:

```text
112 tests
112 passed
0 failed
0 skipped
```

This includes compatibility, precise/lunar calculation, calendar boundaries, saved normalization, backup rollback, original chart, celebrity search, public evidence, PWA behavior, storage isolation, composer layers, and hidden-stem coverage.

### Supported release audit

Command:

```powershell
$env:TEST_GROUP='release-audit'; node tests/ui-regression.js
```

Result:

```text
PASS: 360, 390, 412, 768, 1220
```

### Task 6 geometry matrix

Command:

```powershell
node tests/ui-regression.js --grep "Palpum ink wash|navigation never covers"
```

Result:

```text
PASS: 412x915, 1152x768, 1440x1000
```

### `/palpum-manse/` prefixed local verification

Command:

```powershell
$env:UI_BASE_PATH='/palpum-manse/'; node tests/ui-regression.js
```

Result:

```text
PASS: 360, 390, 412, 768, 1220
PASS: Palpum layout 412x915, 1152x768, 1440x1000
Elapsed: 118.3 seconds
```

The prefixed run exercised relative assets, service-worker inventory/lifecycle, offline startup, original chart, compatibility, calendar, saved records, celebrity search, period navigation, focus behavior, and responsive geometry.

### Required combined gate

Command:

```powershell
npm test
```

Result:

```text
Core: 112/112 PASS
UI: 360, 390, 412, 768, 1220 PASS
Geometry: 412x915, 1152x768, 1440x1000 PASS
Elapsed: 133.4 seconds
```

### Repository checks

- `git diff --check`: clean for committed files.
- Commit contains 17 intended files.
- No `artifacts/` path was staged or committed.
- No dependency was added.
- No remote was pushed.

## Committed Files

- `docs/superpowers/specs/2026-07-27-palpum-fortune-design.md`
- `index.html`
- `manifest.webmanifest`
- `package-lock.json`
- `package.json`
- `scripts/legend-nav.js`
- `scripts/legend-palpum-fortune.js`
- `scripts/legend-storage.js`
- `security_best_practices_report.md`
- `share.js`
- `sw.js`
- `tests/final-fix-contracts.test.js`
- `tests/ganji-fixtures.test.js`
- `tests/legend-palpum-fortune.test.js`
- `tests/pwa-isolation.test.js`
- `tests/ui-regression.js`
- `웹배포_안내.md`

Local ignored review records updated:

- `.superpowers/sdd/2026-07-27-palpum-fortune/final-review-package.md`
- `.superpowers/sdd/2026-07-27-palpum-fortune/final-fix-report.md`

## Self-Review

### Correctness

- Confirmed unknown-time boundary results cannot dereference a missing Daeun.
- Confirmed provisional results contain no `현재 대운` or `대운 관계` copy.
- Confirmed annual and monthly composer calls carry the intended separate layers.
- Confirmed evidence/disclosure does not name absent layers.
- Confirmed all ruler checks use exact stem polarity and the complete hidden-stem table.

### Isolation

- Enumerated every production storage write/delete call.
- All mutable keys resolve to `palpum-manse:*`.
- Legacy keys are used only by `get`, `list`, or fallback `getItem`.
- Palpum activation filters only `palpum-manse-*`.
- Palpum fetch interception requires both matching origin and registration-scope path.

### Accessibility

- Live region is stable across `innerHTML` replacement.
- Focus restoration targets newly created equivalent controls, not detached nodes.
- Keyboard Enter and pointer click paths are both covered.
- Grouped top-tab control ownership follows the active panel.

### Compatibility

- Existing Ganji, lunar, compatibility, calendar, saved chart, backup, match, and celebrity-search tests pass.
- Relative assets and offline first load pass under `/palpum-manse/`.
- Visible app branding remains unchanged.

### Scope control

- `artifacts/` remains untracked and untouched.
- No remote configuration or remote branch was changed.
- No push or deployment action was performed.

## Remaining Concerns

These are non-blocking for the local release candidate:

- Production `/palpum-manse/` has not yet been created or verified because this wave explicitly prohibited pushing. A cache-busted production check and side-by-side offline check with `/legend-manse/` remain deployment tasks.
- Legacy chart discovery is intentionally a one-time copy, not ongoing synchronization. Legend edits made after the copy marker will not alter Palpum data, which is the required isolation behavior.
- Existing inline script/style architecture still prevents a strict CSP without a separate refactor.
- Historical pre-1800 results remain explicitly approximate by design.
- Public source/video availability remains external.
- `artifacts/` is still present as an unrelated untracked directory and must remain excluded from deployment commits unless separately approved.

## Release Decision

**Ready for the deployment-only step to the new `palpum` remote and `/palpum-manse/` address.**

Do not push to `origin` or `legend`, and do not modify the existing Legend or Sineum deployments.

---

## Human-Approved Residual Corrections - 2026-07-28

The user explicitly approved this narrow follow-up after the final fix wave. Scope was limited to the two remaining deployment blockers and the straightforward legacy-copy validation minor:

1. Fail closed for every unknown-time Palpum boundary, including the legacy 1026-1799 calculator path.
2. Give the `/palpum-manse/` PWA a stable, path-specific manifest install identity.
3. Reject malformed optional fields while discovering read-only legacy records.

### RED Evidence

Tests were changed before production code.

#### Manifest identity and legacy-copy validation

Command:

```powershell
node --test tests/pwa-isolation.test.js
```

Observed failures:

- Manifest contract expected `/palpum-manse/` but production still returned `./`.
- Legacy discovery copied records whose `name` was an object or whose `fav` was a string.
- Result: 34 passed, 2 failed.

#### Historical unknown-time Daeun boundary

Command:

```powershell
node tests/ui-regression.js --grep "Palpum result rendering"
```

The new 1799-02-04 unknown-time regression observed:

- `boundaryUncertain: true` but `palpumProvisional: false`.
- One calculated Daeun remained attached to `currentSaju`.
- Timing copy still claimed a current Daeun.
- `hasCurrentSaju()` returned true.
- Original-chart navigation opened the result.
- Save, share, and match-current workflows all exposed the uncertain chart.

The paired 1799-02-04 14:30 known-time control was added to protect valid historical behavior.

### Implemented Corrections

#### Boundary certainty contract

- `rebuildCurrentPalpum()` now records `palpumBoundaryUncertain` on the chart and removes Daeun whenever classification spans a Palpum boundary.
- `hasCurrentSaju()` now rejects both modern provisional charts and all boundary-uncertain charts.
- Save open, save confirmation, share, similar-chart matching, original-chart navigation, and match-current selection now use that certainty gate.
- Fortune composition and timing summary use `boundaryUncertain` as well as `palpumProvisional`, preventing Daeun evidence or copy from leaking from the legacy calculator.
- The 1799 unknown-time browser regression proves Daeun is null and absent from evidence/copy/save/share/match/result.
- The known-time 1799 control proves Daeun, evidence, and original-chart access remain available.

#### Manifest install identity

- `manifest.webmanifest` now uses `"id": "/palpum-manse/"`.
- `start_url` and `scope` remain `"./"` so project-hosted navigation and relative assets retain their existing deployment behavior.
- The contract resolves the ID against the hosted manifest URL and proves its pathname is distinct from `/`, `/legend-manse/`, and any origin-root identity.

#### Legacy-copy validation

- Legacy discovery now applies a dedicated validator in addition to the existing nonempty string ID check.
- Optional `name` and `memo` fields must be strings.
- Optional `fav` must be boolean.
- Optional `savedAt` must be a finite nonnegative number.
- Validation is limited to read-only legacy discovery; normal Palpum record APIs and backup normalization were not broadened.

### Verification Evidence

#### Focused GREEN

```text
node --test tests/pwa-isolation.test.js
36/36 PASS

node tests/ui-regression.js --grep "Palpum result rendering"
UI regression PASS: 390
```

#### Required combined gate

Command:

```powershell
npm test
```

Result:

```text
Core: 113/113 PASS
UI widths: 360, 390, 412, 768, 1220 PASS
Geometry: 412x915, 1152x768, 1440x1000 PASS
```

The first combined run exposed an old test-fixture defect: the save-feedback test attempted to save with no chart, relying on the former unguarded confirmation handler to create an empty ID-only record. The test was corrected to calculate a known-time chart before exercising save feedback. The complete combined gate then passed.

#### Supported release audit

```powershell
$env:TEST_GROUP='release-audit'; node tests/ui-regression.js
```

Result: 360, 390, 412, 768, and 1220 passed.

#### Task 6 geometry matrix

```powershell
node tests/ui-regression.js --grep "Palpum ink wash|navigation never covers"
```

Result: 412x915, 1152x768, and 1440x1000 passed.

#### `/palpum-manse/` prefixed full verification

```powershell
$env:UI_BASE_PATH='/palpum-manse/'; node tests/ui-regression.js
```

Result:

```text
UI widths: 360, 390, 412, 768, 1220 PASS
Geometry: 412x915, 1152x768, 1440x1000 PASS
```

This reran relative assets, offline first load, original chart, compatibility, calendar, saved records, celebrity search, service-worker behavior, accessibility, and responsive layout under the final deployment prefix.

### Files Changed

- `index.html`
- `manifest.webmanifest`
- `scripts/legend-storage.js`
- `tests/pwa-isolation.test.js`
- `tests/ui-regression.js`
- `.superpowers/sdd/2026-07-27-palpum-fortune/final-fix-report.md`

### Commit

- Parent final-fix commit: `e5dfa98f1a63a00fa240ec05b2ddcbb5892e21cc`
- This human-approved correction wave: commit subject `fix: close approved Palpum deployment residuals`

### Self-Review

- Certainty is derived during every new calculation and every saved-record load because both paths call `rebuildCurrentPalpum()`.
- Unknown historical charts away from a Palpum boundary remain usable; only `boundaryUncertain` charts fail closed.
- Known-time historical charts retain their calculated Daeun and all normal chart workflows.
- Daeun is removed before an uncertain chart can be saved or shared, and every current-chart action independently checks certainty.
- Composer evidence and timing prose use the same uncertainty decision, so they cannot disagree with the action gates.
- The manifest ID is stable for the intended production pathname while `start_url`, `scope`, relative assets, and offline behavior remain unchanged.
- Legacy validation is read-only and narrow; no existing Legend key is written, updated, or deleted.
- `git diff --check` passed for tracked source changes.
- No dependency, remote, deployment, or push operation was performed.
- `artifacts/` remained unrelated, untracked, unstaged, and untouched.

### Remaining Concerns

- Production remains unverified until the separately authorized deployment step; this correction wave intentionally did not push.
- Historical pre-1800 solar calculations remain explicitly approximate by design. Boundary uncertainty is now handled safely, but the underlying historical astronomical model is not made exact.
- Legacy discovery remains a one-time copy. Later Legend edits intentionally do not synchronize into Palpum.
- Existing inline script/style architecture still limits strict CSP adoption.

### Correction Decision

**The two human-approved deployment blockers are closed locally. The corrected release candidate is ready for the separately authorized deployment-only step.**
