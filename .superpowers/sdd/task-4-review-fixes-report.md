# Task 4 Review Fixes Report

## Review items resolved

1. Replaced `.han` layout-box measurements with
   `Range.getBoundingClientRect()` measurements of the rendered glyph text.
2. Changed ilun verification to compare the actual `.d-han` glyph range
   against its containing square `.day-item`.
3. Added per-flow container verification for daeun, seun, wolun, and ilun:
   - `clientWidth` and `scrollWidth`;
   - initial first-item visibility;
   - last-item visibility when no scrolling is required;
   - maximum-scroll reachability and last-item visibility at the end;
   - rejection of overflow when the items can fit at the readable threshold.

## TDD evidence

- The strengthened focused test first failed on the real pillar glyph:
  `390px light pillars Hanja is off-center: 0x2.454620361328125`.
- After the shared CJK offset was corrected, it exposed the real ilun error:
  `390px light ilun Hanja is off-center: 0x5.84375`.
- After centering the ilun Hanja, the full-width run exposed unnecessary
  wolun overflow at 360px.
- Production CSS was changed only for those observed failures.

## CSS corrections

- Adjusted the single shared `--apple-cjk-offset` to `-.023em`.
- Centered ilun Hanja in the square while keeping date and Korean readings
  in independent anchored rows.
- Made all 12 wolun columns fit at supported widths; retained contained
  horizontal scrolling below 340px where the readable minimum requires it.

## Verification

```text
Focused Apple-design regression (390px): PASS
Full UI regression (360, 390, 412, 768px): PASS
Authoritative and web CSS: byte-identical
Authoritative and web test runner: byte-identical
git diff --check: PASS
```
