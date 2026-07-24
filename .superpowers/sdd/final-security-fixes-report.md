# Final security, branding, and design fixes

Date: 2026-07-24

## Scope completed

- Replaced saved-record HTML string rendering with DOM construction and inert text insertion.
- Added strict backup schema normalization, limits, derived-data recalculation, and cryptographic UUID regeneration.
- Added an executable malicious-backup regression test.
- Removed JSONP and all person-enrichment dynamic script injection.
- Added strict HTTPS Wikipedia/Wikidata host and path allowlisting with credential-free CORS fetch.
- Updated Android app labels and backup filenames to `취명선 만세력`.
- Added final Apple overrides for legacy gold borders/fortune labels, saved-empty contrast, and flow-title sparkles.
- Added first-open local-year calendar initialization, a visible `올해` selected state, and same-session navigation preservation.
- Kept Earth as a distinct pastel semantic color while tests reject only the exact legacy gold values.
- Mirrored runtime and versioned web files byte-identically.

## TDD evidence

1. RED:
   - `TEST_GROUP=final-security node ui-regression.js`
   - Failed at the saved-card HTML sink contract.
2. GREEN:
   - Security-focused regression passed at 390px.
3. Full regression:
   - `node ui-regression.js`
   - Passed at 360, 390, 412, and 768px.

The focused test imports a JSON file containing malicious ID, name, and memo payloads. It asserts:

- no script or event execution;
- no event-handler/script nodes in the saved UI;
- exactly one valid record accepted;
- canonical UUID v4 storage ID;
- unknown fields removed;
- name/memo limits enforced;
- invalid enum rejected.

It also asserts:

- non-allowlisted enrichment URLs are rejected before network access;
- online enrichment creates no `<script>` element;
- legacy exact gold is absent from icon borders and fortune score labels;
- the light saved-empty heading has at least 4.5:1 contrast;
- decorative flow-title pseudo-elements have no content.

The deterministic calendar test injects a local clock at 2034-07-15 and asserts:

- first calendar opening renders 2034년 7월 without a hardcoded year;
- the title exposes `aria-current="date"` and a visible system-blue `올해` capsule;
- navigating to 2035년 1월 and reopening the calendar tab preserves that user-selected month;
- the current-year selection is removed after navigating to a different year.

## Files

- `index.html`
- `apple.css`
- `polish.css`
- `luxury.css`
- `tests/ui-regression.js`
- `security_best_practices_report.md`
- Android `app/src/main/res/values/strings.xml` in the shared project

## Release note

APK/AAB artifacts were intentionally not rebuilt. The next release task must build from this commit and re-run signature, manifest, protected-asset, and artifact hash verification.
