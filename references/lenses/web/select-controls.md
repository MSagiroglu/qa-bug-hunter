# Select, Multi-select, Autocomplete and Dropdown Controls

Run this on **every** dropdown, select, multi-select, autocomplete, combobox, tag
input and menu popup a screen contains. These controls break in ways a single
happy-path pick never shows. A 2026-10 parity run missed all of the following
because every test picked exactly one value and never compared option content:

- 6 selected values rendered as one non-wrapping line, the control grew to
  1100 px inside a 720 px dialog, and "select all" stretched the open list to
  17 000 px and broke the dialog layout.
- Manager search results lacked the second line (position) the reference shows.
- The search box inside a list did not receive focus on open, so typing did
  nothing until the user clicked it.
- The dialog's scrollbar sat outside the dialog edge.

## 1. Selection-count matrix (multi-select, tag inputs, checkbox lists)

Never stop at one selection. For each multi-select run **0, 1, 2, 6, many, and
all** (use the header "select all" if it exists, and the largest real list):

| Check | Expected |
|---|---|
| Selected-value display | Wraps into tags/chips or collapses to "N selected"; never one clipped line |
| Control width | Stays inside its container; only height may grow |
| Neighbouring fields | Do not move, shrink or disappear (check the field next to it in a two-column row) |
| Open panel width/height | Inside the container or viewport; internal scroll, not page growth |
| Remove one value | A per-value remove control (x) or deselect works; display updates at once |
| Select all / clear all | Works, count is right, layout intact, header checkbox shows the right state (checked, indeterminate, empty) |
| Search + select all | "Select all" applies to the filtered result or says clearly it applies to all |
| Reopen after selection | Previous selection is shown as checked; scroll position sensible |
| Submit | Payload contains exactly the selected ids; re-read the saved record |
| Long labels | Wrap or truncate with a tooltip; never push the layout |
| Raw data | No raw JSON, ids or `[object Object]` in labels (see `references/core/render-leak-scan.md`) |

Measure, do not eyeball: control rect vs container rect, panel rect vs viewport,
`scrollWidth > clientWidth` on the dialog, and the position of the next field
before and after the selection.

## 2. Option content parity (parity mode and any redesign)

For each control open it and compare **option text and structure** against the
reference, not only the option count:

- Same options, same order, same count (record counts for large lists).
- **Secondary text**: two-line options (name + position/department/email),
  icons, avatars, badges, group headings, "recently used" blocks.
- Selected value display after choosing (full text, with secondary text?).
- Disabled, inactive and system entries shown or hidden the same way.
- Empty state text ("No results") and loading state.
- Placeholder text, default selected value ("0", first item) and whether it is
  really submitted.

Run the same **search terms** on both sides for every searchable list and compare
the result lists, not just that "something appeared": partial (`ali`), uppercase,
Turkish characters (`i`/`İ`, `ı`, `ş`), no-diacritic spelling, a term with no
match, leading/trailing space, one character, special characters (`'`, `%`, `<b>`).

## 3. Search inside a list

- Does the search box get focus on open? Typing right after opening must filter.
- Do matches get highlighted when the reference highlights them?
- Debounce, minimum characters, "no result" message, clear (x) behaviour.
- Result list keeps the secondary text of the unfiltered list.
- Keyboard: Arrow Up/Down, Enter selects, Esc closes without losing the form,
  Tab leaves, type-ahead jumps.

## 4. Panel placement and containment

- Opens below when there is room, above when the control is near the bottom of
  the viewport or dialog; stays inside the viewport at 375 and 320 px wide and in
  landscape (812x375).
- Not clipped by the dialog (`overflow: hidden`), not hidden behind it, z-index
  above sticky headers.
- Width: not wider than the viewport; long labels do not stretch it.
- Open panel follows the control on scroll, closes on outside click and on
  route change; page behind does not scroll under a wheel over the panel.
- The dialog or page **scrollbar** must be inside the dialog edge, not outside
  its rounded corner or padding.

## 5. Evidence

Capture the panel open (with selections), the control closed after selecting,
and the measured rects. In parity mode label both sides and box the difference
(`references/core/evidence-capture.md`). One image per finding.

## 6. Classification hints

| Observation | Severity |
|---|---|
| Layout breaks or form unusable after select all / many selections | High |
| Selected values clipped so the user cannot see what is chosen | High |
| Panel clipped so options are unreachable (landscape, small viewport) | High |
| Missing secondary text that identifies the option (position under a name) | Medium |
| Search box not focused / no highlight / no empty state | Low to Medium |
| Scrollbar outside the container | Low |
