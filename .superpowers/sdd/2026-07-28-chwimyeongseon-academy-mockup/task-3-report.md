# Task 3 Report: Education, Cases, Board, and Payment Mockups

## Status

Complete.

## Scope Delivered

- Added four curriculum tracks with level, duration, lecture count, and sample progress.
- Added three ink-wash study case cards and five community-board examples.
- Added two course-package cards with a clearly labelled payment mockup flow.
- Added native dialogs for course previews, board actions, and payment previews.
- Added `window.AcademyMockups.init()` as an idempotent public controller.
- Added the `academy-mockups.js` script only after the implementation exists.

## Safety and Accessibility

- Board actions never submit, persist, or publish any entered content.
- Payment actions never charge, transmit, or store payment information.
- Every board and payment surface visibly discloses that it is a nonpersistent education mockup.
- Native dialogs support Escape, focus the close control on opening, and restore focus to the triggering control after close.
- The fixed masthead and existing reduced-motion behavior remain unchanged.

## TDD Evidence

1. Added content, dialog, and mockup-disclosure contract coverage before implementation.
2. Ran `node --test tests/academy-contract.test.js` and observed the expected RED state for missing curriculum content and dialogs.
3. Implemented the markup, styles, controller, and dialog behavior.
4. Added focused browser coverage for opening, closing, focus restoration, and nonpersistent form submission.
5. Updated the prior-task future-module guard because `academy-mockups.js` is now intentionally present while `academy-manse.js` remains absent.

## Verification

- `node --test tests/academy-contract.test.js`: PASS, 7/7.
- `node --check academy/scripts/academy-mockups.js`: PASS.
- `$env:TEST_GROUP='academy-dialogs'; node tests/academy-ui.js`: PASS.
- `node tests/academy-ui.js`: PASS at 1920x1080, 1440x900, 1366x768, 1280x720, 768x1024, and 360x800.
- `npm test`: PASS, core 132/132, existing UI regression, and academy UI regression.
- `git diff --check`: PASS.

## Changed Paths

- `academy/index.html`
- `academy/styles/academy.css`
- `academy/scripts/academy-mockups.js`
- `tests/academy-contract.test.js`
- `tests/academy-motion.test.js`
- `tests/academy-ui.js`
- `.superpowers/sdd/2026-07-28-chwimyeongseon-academy-mockup/task-3-report.md`

## Concerns

- The basic manseoryeok learning tool remains a later task; no `academy-manse.js` request is made yet.
- Board and payment are intentionally UI-only mockups. Real publishing, accounts, and payments require separate backend, privacy, and security work.
- The unrelated untracked `artifacts/` directory was not read, modified, or staged.
