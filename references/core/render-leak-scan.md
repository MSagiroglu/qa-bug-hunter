# Render Leak Scan (raw data showing up in the UI)

A cheap, mechanical scan that runs on **every screen you visit**. It catches serialization and templating mistakes that people stop noticing: raw JSON, object dumps, placeholder tokens, leaked markup. Zero extra scenarios needed; run it as an observation on pages the run already opens.

## What to look for in visible text

| Pattern | Typical cause |
|---|---|
| `{"` or `":"` (JSON fragments), `[{` | A multilingual or structured value rendered without being parsed or localized |
| `[object Object]` | An object concatenated into a string |
| `undefined`, `null`, `NaN`, `Infinity`, `Invalid Date` | Missing value not handled |
| `{{ ... }}`, `${ ... }`, `%s`, `{0}` | Unresolved template or interpolation |
| `<b>`, `</`, `&lt;`, `&amp;`, `&nbsp;` visible as text | HTML escaped or injected where plain text was expected (and the reverse: user text rendered as markup) |
| Translation keys such as `some.module.label` | Missing translation entry |
| Very long unbroken strings, text wider than its container | Overflow; see `references/lenses/web/responsive-layout-attacks.md` |
| Placeholder or test copy ("lorem", "TODO", "xxx") | Left-over content |

## How

Template: `templates/playwright/render-leak-scan.ts` (`scanRenderLeaks(page)`). It reads `innerText` of the main document (not scripts or styles), and also `title`, `aria-label` and `placeholder` values, and returns the matches with a short context and the element path. Save the result as a file per `references/core/evidence-capture.md`.

Run it:
- after every navigation to a screen;
- after every create/update/delete (the re-rendered list is where leaks appear);
- on chart labels and table headers (axis labels often leak first);
- once per role and once per locale when the app is multilingual (`references/lenses/web/i18n-checks.md`).

## Classification

- A leak that appears only after a particular action is a state-dependent defect. Find the action (for example a configuration saved through the new editor, `references/core/parity-sweep.md` round-trip probe) and say so in the ticket.
- If the same leak appears on the reference side, it is a BOTH finding.
- Raw data in a screen the user must read (labels, names, statuses, chart text) is at least Medium, because the screen becomes unusable, not just ugly.
