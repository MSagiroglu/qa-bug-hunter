# Parity Coverage Matrix (tab x control x state) — mandatory in Parity mode

Lessons from several legacy-vs-rewrite parity runs on different modules. In each of them the
user had to ask a second time ("tüm ikonlara, butonlara, boş durumlara tekrar bak") because the
first pass compared the main flow and the visible layout only. A parity run is not finished until
this matrix exists in the report and every cell is either compared on both sides or marked
"not tested" with the reason.

## 1. Build the matrix before the first screenshot

Rows = every tab, sub-view, dialog, drawer and report view reachable from the page (including the
"Raporlar"/report switch, row expanders and confirm dialogs). Columns = the controls below.
Fill it from a DOM harvest of both sides (`ui-state-parity-checklist.md`), not from memory.

| Column | What to compare on both sides |
|---|---|
| Header and column set | Column headers present, order, secondary text under names (title vs department), avatars, fallback avatar |
| Search | Same terms (partial, case, diacritics, non-matching, `<b>`), result counts, clear |
| Every filter | Options list and order, blank/duplicate options, "All" option, result count after choosing, reset |
| Date range | Display format, picker structure, one-date-only, start after end, far past/future |
| Pagination | Total text, page 2 and last page, rows per page |
| Export (Excel/CSV) | **Download on both sides and diff the cells**: row count, headers, HTML or entity leakage (`<div>`, `&lt;br&gt;`), trailing spaces, date/number format, whether filters are honored |
| Icon-only buttons | `title`, `aria-label`, tooltip on hover, size, position (a trash icon with no label is a finding) |
| Row actions | Delete/confirm dialog text and buttons (cancel only on real data), expand/collapse content |
| Navigation | Breadcrumb, close (X), tab switch keeps/resets filters, link to the report page and back |
| Empty states | **Per tab, per search, per filter and per date range**: message text, illustration, header row still shown or not, stat cards behaviour. A side with no message at all is recorded (REFERENCE-ONLY if the rewrite is better) |
| Loading / error | Skeleton or spinner, retry, error text |
| Roles | Admin, the lower role that may open the page, and a role that must NOT (direct URL): redirect vs error dialog vs blank page |
| Responsive | Portrait and landscape at the same window size on both sides |

## 2. Rules that came out of the runs

1. **Dropdown and multi-select**: open the list on both sides and read every option. Blank option, raw JSON/ID text and
   missing "All" are visible only there.
2. **Exports are screens too.** Open the downloaded file; do not assume the label "Excel'e aktar" means equal content.
3. **Tab panels stay mounted.** Hidden tabs keep their own search input and buttons in the DOM; always target
   `:visible` elements or you test the wrong tab.
4. **Sub-views that look similar still differ.** Check header row, inline vs column placement and truncation separately on each tab;
   do not generalize from the first tab.
5. **Classify before filing**: NEW-ONLY / BOTH / INTENDED / REFERENCE-ONLY. A rewrite that shows an empty-state message where
   the reference shows nothing is REFERENCE-ONLY, not a defect. Redesign choices (date format, chip style, colors) are INTENDED unless
   the content is lost.
6. **Data a field shows is content, not decoration**: the reference shows department under the name, the rewrite shows job title →
   report as data difference, low severity.
7. Declare coverage honestly: end the report with the matrix and a "not tested" list. Never write "page fully explored" without it.

## 3. Tooling lessons (browser automation over CDP)

- Chrome background tabs get frozen: `Page.enable`/`Runtime.evaluate` time out and `connectOverCDP` hangs even though the websocket
  connects. Fix: `GET /json/activate/<targetId>` for every page tab, then retry; call `bringToFront()` before each step.
- Use a dedicated automation Chrome profile (separate port). If a tab keeps navigating on its own, another process or the user is
  driving it: move to the second profile.
- Session expiry on the rewrite host is common: when pages show the login screen, ask the user to log in again; never type credentials.
- Never trigger framework handlers with programmatic `.click()`; use real mouse/locator clicks. Write scripts with a file-writing tool
  (shell heredocs and `sed` strip backslashes in regexes).
- Python reading Turkish text: run with `-X utf8`.
- Excel checks: save the download, compare with openpyxl; normalize only trailing whitespace before declaring a mismatch.
