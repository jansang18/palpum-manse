# Task 6 Report — Apple Redesign Release

Date: 2026-07-24
Branch: `codex/luxury-ui-redesign`

## Release source

- Runtime and web mirror are byte-identical for `index.html`, `apple.css`,
  `share.js`, `nav.js`, `polish.css`, `luxury.css`, and
  `manifest.webmanifest`.
- `app/ui-regression.js` and `app/web/tests/ui-regression.js` are
  byte-identical.
- Service worker cache version is `v8-20260724-apple-redesign`.
- `apple.css` is included in the PWA `PRECACHE` inventory.
- `apple.css` is included in the protected Android release inventory.
- Protected output basename is `취명선만세력_애플리디자인_보호`.

## Visual QA

Captured at 390px in light and dark:

- `app/shots/1_input_{light,dark}.png`
- `app/shots/2_result_{light,dark}.png`
- `app/shots/3_fortune_{light,dark}.png`
- `app/shots/4_match_{light,dark}.png`
- `app/shots/5_calendar_{light,dark}.png`
- `app/shots/6_saved_{light,dark}.png`

Manual inspection covered visible gold, labels, row heights, clipping, and
legacy cosmic decoration. The remaining decorative gold was removed from
section titles, search, save controls, and the saved-empty mark. Earth-element
blocks retain the specified pastel yellow semantic palette.

## Tests

- Source UI regression: PASS at 360, 390, 412, and 768.
- Web mirror UI regression: PASS at 360, 390, 412, and 768.
- Protected Android asset UI regression: PASS at 360, 390, 412, and 768.
- JavaScript syntax checks: PASS.
- PowerShell release script parse: PASS.
- `git diff --check`: PASS.
- Android post-build clean asset hash comparison: PASS.

## Protected Android build

Output directory:

`C:\Users\whaak\Desktop\manse\outputs\2026-07-24-apple-redesign`

Artifacts:

- `취명선만세력_애플리디자인_보호.apk`
  - SHA-256:
    `F531B9325B3088E4BDA9EA5F98E0C137FBA7C969289C39528B6E69E9A30828F6`
- `취명선만세력_애플리디자인_보호.aab`
  - SHA-256:
    `94C67CCF827A5A01093A18813A26109B55A64FDCFF24825961912C000C46AC7D`

Verification:

- Gradle: `BUILD SUCCESSFUL`
- APK Signature Scheme v2: `true`
- APK signer count: `1`
- AAB JAR signature: verified
- Pinned signer SHA-256:
  `da1950eab27b62b7c0ac92a21b34a2fab32ff582f0e68be0d6e72d56488508aa`
- APK manifest `android:allowBackup`: `false`
- Protected assets restored to clean source state after build: verified
- Independent artifact `VerifyOnly`: PASS

Package ID and existing signing configuration were not changed.
