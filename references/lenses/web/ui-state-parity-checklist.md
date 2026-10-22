# UI Element and State Inventory (Parity and Redesign Sweeps)

A flow that works is not a screen that matches. In parity mode the reference
screen is the oracle for **everything visible**, not only for the flows you
happen to click. Build an inventory of the screen's elements and states and
compare each row on both sides. Anything you did not compare is untested; say so
in the report.

Lessons from a parity run on a people-list screen with dialogs. The user found each of these
after the agent had declared the page "explored". Every row below is now a
mandatory check:

| Missed | What the user saw | Check that would have caught it |
|---|---|---|
| Empty search result | Reference shows an illustration in a white card plus two lines; the rewrite showed plain text only | Search a non-matching term on both sides and compare the whole empty state (illustration, card, title, hint, button) |
| Multi-select | Many selected values stretched the field and the open list beyond the dialog | `select-controls.md`: 0/1/2/6/many/select all |
| Option content | Manager search lacked the position line under each name | Compare option text and secondary text on both sides |
| Search in list | Search box not focused on open; no match highlight | Open, type immediately, compare |
| Tooltips and info icons | Reference had an (i) icon with explanation next to a checkbox; rewrite had none | Harvest icons, `title`, `aria-label` and tooltips per container on both sides |
| Button icons | Download and Excel icons missing; close X glued to the notice box | Compare icon count and spacing per dialog |
| Scrollbar | Dialog scrollbar sat outside the dialog edge | Measure scrollbar x against the dialog rect |
| Row menu | Menu 2.2x taller, covered the header; cut in landscape | Measure menu rect vs viewport at several scroll positions and in landscape |
| Warnings | Error text out of view in a long form; "Error / Error" toast | Submit invalid data, check what the user sees, where, and the wording |
| Responsive | Orientation: only portrait looked at | Portrait and landscape (375x812, 812x375, 414x896, 896x414, 768x1024, 1024x768, 320x568) |
| Empty state per tab/filter | Search, department filter and date range each end in a different empty state (message vs bare header) | Run a non-matching search AND a no-data filter on every tab; see `parity-coverage-matrix.md` |
| Export content | Excel opened fine but a text column held raw HTML tags | Download from both sides and diff cells |
| Icon-only buttons | Trash icon had no title/aria-label in the rewrite | Harvest `title`/`aria-label` of every icon-only control |
| Direct URL, wrong role | Reference redirected home, rewrite showed blank page with error dialog | Open the admin URL as a role that must not see it |
| Layout order | Search under the filters instead of in the toolbar row | Compare row layout of the toolbar at desktop width |
| Sub-views | A page's "Settings" and "Employees" views were opened but not compared; the user asked "did you go there?" | Every view, tab and dialog reachable from the page gets its own inventory and the full checklist (search, sort first-click direction, pager, empty, tooltip, button style via computed styles, portrait and landscape) |
| Slow endpoints | A fixed 3 s wait made "search does nothing" look true; the endpoint takes 11-21 s | Wait for the matching response, record its duration; slowness on both sides is a BOTH finding |
| Self-audit | Declaring "all checked" while measuring styles, row menus and landscape were skipped | End every run with an honest done / not done list before the user has to ask |

## 1. Inventory columns

For each screen and for each dialog, drawer and popup opened from it:

`element | reference | new | class (NEW-ONLY / BOTH / INTENDED / REFERENCE-ONLY) | evidence`

Fill it from a DOM harvest, not from memory. Harvest per container: visible text
nodes, buttons with text, icon-only controls, count of `svg`/`img`/`i` icons,
`title`, `aria-label`, `data-tooltip`, tooltip elements after hover, placeholders,
helper text, required markers, default values, disabled state.

## 2. State list (open each one on both sides)

- Loaded with data, loaded empty (no records), empty after search/filter (non-matching term), loading (skeleton, spinner, disabled controls), error (API 4xx/5xx, offline), no permission.
- Hover, focus, active, selected, disabled, read-only.
- First page, last page, one row, one page, many pages; long names and long values (ellipsis and tooltip), emoji, RTL, diacritics.
- Dirty form (unsaved changes) and close; success and failure after submit.

## 3. Feedback (what the user is told)

- Toast: text, title, position, duration, icon, close button, stacking, "Error / Error" style placeholders.
- Inline validation: wording, which field, whether it is visible without scrolling, scroll-to-first-error, focus moves to the first invalid field, error clears when fixed.
- Confirm dialogs: wording, required checkbox, which button is primary, cancel path.
- Loading indicator and in-flight guard on submit (`rapid-action-testing.md`).

## 4. Controls and containers

- Dropdown, multi-select, autocomplete, menu popup: `select-controls.md`.
- Dialogs: close control position and spacing, footer sticky or not, scrollbar inside the dialog edge, background scroll lock (`references/invariants/overlay-dialog.md`).
- Tables: column set, widths, truncation, sticky header, horizontal scroll container, row action column reachable, pager (first/last/ellipsis).
- Toolbars: order and alignment of search, filters, view toggles and action buttons; wrap behaviour as width shrinks.

## 5. Responsive (portrait and landscape, always both)

For every screen and every dialog: 375x812, 812x375, 414x896, 896x414,
768x1024, 1024x768, 320x568, 568x320. Check sidebar collapse to a hamburger,
horizontal overflow, clipped controls, popup menus that exceed the viewport
height (landscape), touch targets, dialog footer reachability. Use CDP emulation
on your own session and clear it with the same session; never resize the user's
window by hand.

## 6. Completeness gate

Before writing "done" or "all explored":

1. The inventory table exists for every screen and dialog visited.
2. Every state in section 2 was either opened on both sides or listed under "not tested".
3. Every dropdown and multi-select went through `select-controls.md`.
4. Portrait and landscape were run.
5. Searches were run with the same terms on both sides and the result lists compared.
6. The report lists what was NOT covered. A claim of full coverage is wrong by default.
