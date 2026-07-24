# Apple Motion Continuity Review Fix Report

## Scope

- Toast re-entry now begins from its current visual opacity and transform.
- Toast, modal, and share-overlay exits use `cubic-bezier(.23,1,.32,1)`.
- Share overlay uses interruptible bottom-sheet motion on mobile and dialog motion on desktop, and is removed only after exit completion.
- Finished toast animations are cancelled so retained fill frames cannot affect later interactions.
- Visible `transition: all` declarations were replaced or overridden with explicit transform, background-color, border-color, opacity, and color properties.
- Hover-only effects are gated by `(hover: hover) and (pointer: fine)`; touch `:active` feedback remains.
- Animated brightness filters were removed in favor of transform and opacity feedback.
- Reduced-motion paths retain fade feedback without spatial displacement.

## TDD Evidence

1. Initial focused test failed as expected:
   - `390px toast re-entry opacity restarted`
2. The strict motion contract was implemented and stabilized.
3. Focused test was run twice consecutively:
   - `TEST_GROUP=motion-contract node tests/ui-regression.js`
   - PASS at 390px on both runs.
4. Full interaction, accessibility, secondary-screen, and motion regression suite:
   - `node tests/ui-regression.js`
   - PASS at 360px, 390px, 412px, and 768px.

## Mirror Verification

SHA-256 byte identity confirmed for:

- `app/www/index.html` ↔ `app/web/index.html`
- `app/www/apple.css` ↔ `app/web/apple.css`
- `app/www/share.js` ↔ `app/web/share.js`
- `app/ui-regression.js` ↔ `app/web/tests/ui-regression.js`

No APK, AAB, or other release artifact was rebuilt.
