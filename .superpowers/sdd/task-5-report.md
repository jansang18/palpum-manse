# Task 5 Report — Apple Secondary Screens, Sheets, and Motion

## Scope

- Restyled fortune, match, calendar, and saved views with Apple grouped surfaces and system labels.
- Preserved the pastel five-element palette while removing visible gold and cosmic decoration.
- Restyled every existing app modal as a mobile bottom sheet and desktop centered dialog.
- Added a 36×5px mobile grabber without replacing the existing modal interruption, focus, Escape, or back-button logic.
- Restyled the share overlay with semantic CSS classes, adaptive Apple surfaces, and 44px-or-larger controls.
- Removed automatic view-entry cascades and decorative looping motion while retaining press feedback, tabs, calendar direction motion, first match fill, toast, and sheet transitions.

## TDD Evidence

The Task 5 browser contract was added before the production styling.

Initial expected RED:

```text
390px light matchSlot must use the Apple grouped surface
actual: rgb(255, 244, 241)
expected: rgb(255, 255, 255)
```

Visual review then exposed two additional regressions and tests were added before their fixes:

```text
390px light match decoration retains legacy gold: rgb(216, 181, 106)
360px dark today calendar retains legacy gold: rgba(240, 214, 154, 0.7)
```

The final contract checks both themes for secondary surface consistency, system-blue calendar selection, all calendar decoration colors, 44×44px controls, modal focus, mobile/desktop sheet geometry, 36×5px grabbers, share-dialog focus, and removal of automatic/looping view motion.

## Interaction and Accessibility

- Existing `openAppModal`, `closeAppModal`, `closeTopAppModal`, and overlay focus-management code was preserved.
- Escape closes dialogs and restores the opener.
- Android/web back dismisses the share overlay before changing tabs.
- Focus trapping and inert background behavior remain intact.
- Reduced motion keeps short opacity/color feedback and removes displacement.
- Reduced transparency uses solid surfaces and disables blur.
- Light/dark text contrast checks remain at least 4.5:1.

## Animation Review

| Before | After | Why |
| --- | --- | --- |
| Automatic `.view` fade/translate entry | `.view { animation: none !important; }` | Frequent tab navigation should respond immediately instead of replaying decorative entrance motion. |
| Gold glow on today/selected calendar cells | System-blue border with no outline or shadow | Selection remains clear without decorative glow or legacy brand color. |
| Inline metallic share-dialog styling | CSS-driven Apple sheet with transform/opacity modal behavior | Keeps the overlay interruptible through the existing modal system and removes non-cohesive metallic decoration. |
| Broad inherited transitions on match/saved/calendar UI | Explicit press/state properties in the Apple layer | Avoids accidentally animating layout or unrelated properties. |

Verdict: **Approve**. No feel-breaking motion remains in the Task 5 diff. Meaningful feedback is short and interruptible, layout properties are not animated by the new layer, and reduced-motion behavior is preserved.

## Verification

Focused Task 5:

```text
TEST_GROUP=task-5 node tests/ui-regression.js
UI regression PASS: 390
```

Focused interaction/accessibility groups passed:

- `modal-a11y`
- `modal-continuity`
- `modal-ownership`
- `share-back`
- `theme-contrast`
- `transparency-contrast`
- `reduced-match`

Full regression:

```text
node tests/ui-regression.js
UI regression PASS: 360, 390, 412, 768
```

Mirror verification:

- `app/www/apple.css` and `app/web/apple.css`: SHA-256 identical
- `app/www/share.js` and `app/web/share.js`: SHA-256 identical
- `app/ui-regression.js` and `app/web/tests/ui-regression.js`: SHA-256 identical
- `git diff --check`: pass

## Files

- `app/www/apple.css`
- `app/www/share.js`
- `app/ui-regression.js`
- byte-identical mirrors under `app/web`

