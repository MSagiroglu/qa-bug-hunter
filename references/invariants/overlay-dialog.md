# Overlay / Dialog Invariants (OV1-OV14)

## Why this exists
Two failures dominate overlay bugs: a modal that opens but cannot be closed (no reachable close control, ESC ignored, stuck on a load error), and a modal that lets the page behind it scroll or take focus. These checks replace per-product guesswork with one repeatable list. Measure each one; do not assume the UI library handles it.

Source for every row: per the APG dialog pattern (WAI-ARIA Authoring Practices, "Dialog (Modal)"). Automated helper: `templates/playwright/overlay-invariants.ts` (`assertOverlayInvariants`). Automated rows: OV1, OV2, OV3, OV4, OV6, OV7, OV10. Manual-only rows: OV5, OV8, OV9, OV11-OV14.

| ID | Check | How to measure | Expected | Severity if violated | Source |
|----|-------|----------------|----------|----------------------|--------|
| OV1 | Role, modality, accessible name | Read `role`, `aria-modal`, `aria-label`/`aria-labelledby` on the dialog root | `role` is `dialog` or `alertdialog`; `aria-modal="true"`; non-empty accessible name | Medium (High if role is missing entirely) | APG dialog pattern |
| OV2 | Focus moves in on open, returns on close | Compare `document.activeElement` after open and after close | Focus inside dialog on open; back on the trigger on close | Medium | APG dialog pattern |
| OV3 | Focus trap | Press Tab and Shift+Tab 25 times each; check focus stays inside | Focus cycles within the dialog | High | APG dialog pattern |
| OV4 | ESC closes | Press Escape with focus inside | Closes without data loss, or asks for confirmation when the form is dirty | High if no other close path exists, else Medium | APG dialog pattern |
| OV5 | Backdrop click policy | Click the backdrop on a clean and on a dirty form | Policy is defined and consistent; a dirty form is never silently discarded | High if data is lost, else Low | APG dialog pattern |
| OV6 | Background scroll lock | Scroll the page first, open, wheel over the backdrop, compare `document.scrollingElement.scrollTop` | Unchanged; `body` overflow hidden or background `inert`. Not applicable when the page is not scrollable | Medium | APG dialog pattern |
| OV7 | Close reachable at 320px and 200% zoom | Viewport 320x568 and browser zoom 200%; locate close and primary action | Close is visible, enabled, inside the viewport, clickable | Critical if the dialog cannot be dismissed, else High | APG dialog pattern |
| OV8 | Nested stacking | Open a dialog from inside a dialog; press ESC once; click inner close | Top dialog closes, lower one stays; ESC closes only the top one; focus returns to the lower dialog | High | APG dialog pattern |
| OV9 | Open before data loaded | Throttle or hold the data request, open, then fail it | Skeleton or loading state; closable throughout; error state does not lock the UI | High | APG dialog pattern |
| OV10 | Double open | Double-click the trigger | Exactly one visible dialog instance | Medium | APG dialog pattern |
| OV11 | Mobile keyboard overlap | Emulated or real device; focus the last input | Primary action stays reachable (scrolls into view or stays above the keyboard) | High | APG dialog pattern |
| OV12 | No residue after close | After close, inspect the DOM for leftover overlay/backdrop nodes, `aria-hidden`, `inert`, body overflow/padding | Nothing left; page behind is interactive and scrollable again | High | APG dialog pattern |
| OV13 | Background inert / aria-hidden | While open, inspect siblings of the dialog; try Tab and the accessibility tree | Content behind is `inert` or `aria-hidden="true"` and unreachable | Medium | APG dialog pattern |
| OV14 | Route change closes | Open, then navigate (back button, link, deep link) | Dialog closes; no orphaned overlay; scroll lock released | Medium | APG dialog pattern |

## Running it
1. Pick every modal, drawer, side panel and popover touched in the session.
2. Run the helper for OV1-OV4, OV6, OV7, OV10; run OV5, OV8, OV9, OV11-OV14 by hand.
3. Record each violated row as its own finding with the OV ID in the title. Classify with `references/core/defect-classification.md`.

## Product-specific mechanisms
If a domain pack provides `modals.md` (see the pack contract in `references/domains/`), read it and treat its known deviations as expected-violation candidates to verify, not as facts. Re-measure each against the running build before reporting; the code may have changed.
