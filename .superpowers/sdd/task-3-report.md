# Task 3 Report — Forms, Buttons, Cards, and Feedback

## Result

Implemented the Task 3 Apple component system while preserving the Task 2 theme foundation and the visible product name `취명선 만세력`.

## TDD Evidence

1. Added rendered-geometry, focus, pseudo-element, pastel-pair, and contrast assertions before production CSS changes.
2. Verified RED with:
   - `390px light input height must be 52px`
3. Implemented the minimum Apple component layer in `apple.css`.
4. Kept the strict 44px target assertion when Chromium reported a fractional `43.99993896484375px`; increased segmented controls to 45px rather than weakening the assertion.
5. Verified focused and full suites GREEN.

## Files

- `apple.css`
  - 52px inputs and 54px primary actions
  - 44px-or-larger navigation and primary interactive targets
  - 12/14/18px control, grouped-control, and card radii
  - flat inset forms, Apple segmented controls, unified card surfaces
  - immediate press feedback and visible focus rings
  - reduced-motion, reduced-transparency, and high-contrast adaptations
  - exact light/dark pastel five-element foreground and surface pairs
- `tests/ui-regression.js`
  - strict rendered target-size assertions for tabs, icon buttons, segmented buttons, and primary actions
  - exact component geometry and radius assertions
  - focus-ring and primary-button pseudo-content assertions
  - exact pastel pair and 3:1 large-Hanja contrast assertions
- `.superpowers/sdd/task-3-report.md`
  - this implementation and verification record

The authoritative files were mirrored byte-identically:

- `app/www/apple.css` ↔ `app/web/apple.css`
- `app/ui-regression.js` ↔ `app/web/tests/ui-regression.js`

No `index.html`, manifest, or unrelated `.superpowers/sdd-tools/` file was modified.

## Verification

- Focused: `TEST_GROUP=apple-design node app/ui-regression.js`
  - PASS: 390px
- Full: `node app/ui-regression.js`
  - PASS: 360px, 390px, 412px, 768px
- `git diff --check`
  - PASS
- Byte identity checks
  - PASS for CSS and regression runner

## Review Fixes

The Task 3 review follow-up added and verified:

- strict nonempty collections and minimum `44px × 44px` rendered geometry for tabs, icon buttons, and segmented buttons
- a visually distinct `.primary-btn:disabled` state with blocked pointer interaction and `not-allowed` cursor
- immediate, nontransparent system-blue focus outlines with positive outline width
- the updated `취명선 만세력` dialog accessibility name
- static document-title, Apple web-app-title, and PWA manifest naming contracts

Follow-up verification:

- `TEST_GROUP=apple-design node app/ui-regression.js`
  - PASS: 390px
- `TEST_GROUP=modal-a11y node app/ui-regression.js`
  - PASS: 390px
- `node app/ui-regression.js`
  - PASS: 360px, 390px, 412px, 768px
