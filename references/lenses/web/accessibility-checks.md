# Accessibility (a11y) Checks

Run once per screen/feature under test (a page-level pass, not something
repeated per input mutation) as part of Phase 3/4. Not exhaustive WCAG
auditing — the checks below catch the defect classes that are both common
and cheap to verify without specialized tooling.

## Why this is here at all

The first live dogfooding run of this skill (a black-box pass against a
public site with no source access) found five broken images — and every
one of them had `alt=""`. Nothing in the original pipeline was looking for
that; it was noticed by accident while investigating an unrelated
rendering bug. A dedicated a11y pass catches this class of defect on
purpose instead of by accident.

## If an a11y scanning tool is available or can be added

If the execution tool is Playwright/Cypress/Selenium and something like
axe-core is already a dependency, run it against the screen and treat its
violations as findings the same way any other defect is: investigated,
evidenced, classified — not dumped raw into the report. If it isn't
present, adding it (`@axe-core/playwright` or equivalent) is a new
dependency, not just more run time — same rule as adding a new browser
engine: reuse what's there, ask before adding what isn't.

## Manual checks (no extra tooling needed)

These work with nothing more than DOM access, so run them even when no
a11y tool is available or approved:

- **Images**: every `<img>` that conveys information has non-empty
  `alt` text; purely decorative images have `alt=""` *deliberately* (empty
  is only correct when decorative — check which case you're actually in,
  don't assume empty is fine by default).
- **Form inputs**: every input has an associated `<label>` (via `for`/`id`
  or wrapping) or an `aria-label`/`aria-labelledby`. An input a sighted
  user identifies only by nearby placeholder text is invisible to a
  screen reader.
- **Keyboard reachability**: every interactive control (buttons, links,
  custom dropdowns, modal close buttons) is reachable via Tab and
  operable via Enter/Space, in a sensible order. Specifically check
  modals: does focus move into the modal on open, and back to the
  trigger on close? Is there a keyboard-reachable way to close it (not
  just an X that requires a mouse)?
- **No keyboard traps**: once inside a modal/menu, Tab cycles within it
  (or the whole page) — it never gets stuck unable to reach a control
  that's visibly there.
- **Heading hierarchy**: headings don't skip levels in a way that breaks
  screen-reader navigation (an `h1` followed directly by an `h4` with
  nothing between, when the visual hierarchy implies intermediate
  sections).
- **Color contrast** (best-effort without a dedicated tool): for text
  that looks low-contrast to the eye, pull the computed foreground/
  background colors and note it as worth a proper contrast-ratio check
  rather than asserting a pass/fail without the real WCAG math.

## Classification

Treat a11y findings through the same pipeline as anything else —
`references/core/oracle-hierarchy.md` and `references/core/defect-classification.md` apply unchanged.
WCAG itself is a strong oracle (a published standard) for the criteria it
covers (alt text, labels, keyboard operability); severity should reflect
real impact (a completely unlabeled required form field blocking
submission via keyboard is High, not Low, even though nothing about it
looks broken to a sighted mouse user).
