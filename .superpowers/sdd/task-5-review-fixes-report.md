# Task 5 Review Fixes Report

## Review Items Completed

1. The generated share PNG now uses an Apple light canvas (`#F2F2F7`), white grouped card, system blue, and the approved soft pastel five-element palette.
2. Stars, radial cosmos effects, metallic gradients, gold borders, and the previous dark-card palette were removed from the canvas renderer.
3. Canvas title, footer, shared filename, and share text now use `취명선 만세력`.
4. Browser tests decode the actual generated PNG and inspect its dimensions, corner pixel, sampled dark-pixel ratio, and sampled legacy-gold pixels.
5. Browser tests invoke the actual share action and inspect the generated `File.name` and Web Share text.
6. Saved-view tests write a real record through `window.storage`, invoke the actual `renderSaved()`, inspect the resulting `.saved-card`, and clean up the record.
7. Fortune tests invoke the actual `renderFortune()` and inspect real `.f-card` output instead of injected fixtures.
8. Reduced-transparency tests emulate `prefers-reduced-transparency: reduce`, open the real app modal and real share sheet, and verify solid sheet backgrounds with no backdrop blur on either sheet or backdrop.
9. Actual saved-card favorite/delete controls were found below the 44px target and corrected to 44×44px.

## TDD Evidence

The strengthened tests failed against the previous implementation:

```text
390px light savedDelete is below 44x44px: 28x24
```

After correcting actual saved controls, the PNG test exposed the legacy card:

```text
390px light share PNG must use the Apple light canvas
actual corner: [9, 10, 13, 255]
expected corner: [242, 242, 247, 255]
```

The production renderer was then updated to satisfy the new behavior contract.

## Share PNG Contract

- Canvas: `1080×1350`
- Corner pixel: `[242, 242, 247, 255]`
- Dark/cosmic sampled-pixel ratio: below 1%
- Legacy gold sampled pixels: `0`
- Filename suffix: `취명선_만세력.png`
- Share text contains: `취명선 만세력`

## Verification

Focused review group:

```text
TEST_GROUP=secondary-apple node tests/ui-regression.js
UI regression PASS: 390
```

Full regression:

```text
node tests/ui-regression.js
UI regression PASS: 360, 390, 412, 768
```

Additional checks:

- `app/www/apple.css` ↔ `app/web/apple.css`: SHA-256 identical
- `app/www/share.js` ↔ `app/web/share.js`: SHA-256 identical
- `app/ui-regression.js` ↔ `app/web/tests/ui-regression.js`: SHA-256 identical
- No previous product name, legacy gold hex values, radial cosmos gradient, or star renderer remains in `share.js`
- `git diff --check`: pass

