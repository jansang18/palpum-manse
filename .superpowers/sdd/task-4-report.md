# Task 4 Report: Pillars, Hanja Geometry, and Luck Flow Alignment

## Result

Implemented one shared geometric system for the natal pillars and the
daeun, seun, wolun, and ilun flows.

## TDD evidence

1. Added browser geometry assertions before changing production CSS.
2. Focused test failed as expected:
   - `390px light ilun block not square: 46x76.9375`
3. Added the minimal shared square and optical-centering rules.
4. Focused Apple-design regression passed at 390px.
5. Full regression passed at 360, 390, 412, and 768px.

## Implementation

- Enforced `aspect-ratio: 1 / 1`, zero padding, and grid centering for
  `.pillar-block` and `.luck-block`.
- Applied the shared `--apple-cjk-offset` to every pillar and luck Hanja.
- Separated pillar metadata/readings from the square Hanja cells with a
  fixed grid-row structure.
- Normalized daeun, seun, and wolun to equal-column grids.
- Kept horizontal overflow contained inside each fortune row when the
  minimum readable cell width cannot fit.
- Converted ilun day cells to compact 1:1 grids with fixed reading rows.
- Replaced inherited gold selection styling with Apple system blue.
- Added regression checks for:
  - square tolerance of 1px;
  - same-row height tolerance of 1px;
  - text-center tolerance of 2px;
  - one common computed CJK transform;
  - absence of inline `top`, `margin-top`, or transform corrections.

## Verification

```text
TEST_GROUP=apple-design (390px): PASS
Full UI regression (360, 390, 412, 768px): PASS
app/www/apple.css == app/web/apple.css: SHA-256 identical
app/ui-regression.js == app/web/tests/ui-regression.js: SHA-256 identical
git diff --check: PASS
```
