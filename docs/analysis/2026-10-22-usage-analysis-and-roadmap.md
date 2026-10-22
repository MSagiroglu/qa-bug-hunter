# Usage analysis and roadmap (2026-10-22)

Scope: how the skill was actually used over ten days of daily work on one private product, what it found, what it missed, and what it should do next. All product detail is anonymized: the evidence is "a multi-module legacy-vs-rewrite parity effort over one shared backend" that produced twelve written reports, one exploratory session folder and roughly eighty tracker tickets (filed or drafted) in ten days. No product, module, ticket key, host or person is named in this file; the per-module version of this analysis lives in the owner's private domain pack.

Companion documents: `docs/evaluation/2026-10-14-rescore.md` (the 92/100 methodology score), `docs/evaluation/2026-10-14-gap-backlog.md` (closed backlog). This file is the first assessment based on field use rather than on reading the methodology.

---

## (a) What the skill does today, per mode and per call form

| Mode | Call forms | Used in the ten days | Honest strengths | Honest weaknesses |
|---|---|---|---|---|
| **Sweep** (default) | `/senior-qa-explorer sweep <module>`, `/qa-explore <module>`, natural language | 2 runs (one single-environment, one two-environment end-to-end) | Discovery from source plus live DOM; network witnessing (wrong content type, 401 shown as session expiry, escaping bug in a search payload, stack traces in error bodies); calculation verification by hand on real fixtures; data hygiene and cleanup proof; paste-ready tickets | Function-first: the visual axis is the last thing checked and is eyeballed; no state matrix (hover/focus/checked/error/empty/loading); viewports tested portrait-only when at all; "not tested" list used as a closing note rather than a to-do |
| **Session** | `/senior-qa-explorer session "<charter>"`, `/qa-session` | 1 run (60-minute timebox, deny-by-default write guard, private session folder) | Charter discipline; second-opinion pass removed three automation artefacts before the report; reproduction rates stated; findings merged by root cause | Write guard setup cost ~22% of the timebox; all findings stayed POTENTIAL (no level 1-6 oracle without a reference side); layout check limited to one width and one zoom level |
| **Parity** | `/senior-qa-explorer parity <module>`, `/qa-parity <module>` | 9 runs, the dominant mode | The reference side is a strong oracle, so most findings are CONFIRMED; scope classes NEW-ONLY / BOTH / REFERENCE-ONLY / INTENDED kept shared-backend defects from being filed as regressions; round-trip save, wire-format and role-chain probes each produced high-value findings; export file diffing became routine in the second week | First passes compared the main flow and the visible layout only; the two sides were often captured at different window sizes, so side-by-side images were not comparable; states, sub-views, dialogs opened from the page, orientation and small heights were left to a second pass that the owner had to request; "large differences only, do not file faint color shades" was applied too broadly (a blue native checkbox against a green brand checkbox was initially waved through) |
| **API-only** | `/senior-qa-explorer api <endpoints>` | 0 runs | Lens exists; two-user rule, env-var credentials, dry-run defaults | Not exercised; anti-forgery tokens on cookie-authenticated routes blocked direct calls in every run that tried one, and the lens has no recipe for that |
| **Load** | `/senior-qa-explorer load <profile>` | 0 runs | Seven ordered safety gates, allowlist, dry-run | Not exercised; slow endpoints (10-160 s) were observed by the other modes and recorded as BOTH findings, which is the right outcome without a load run |

Call forms: the three preset commands and the skill call behave identically; the presets were used in the field together with a private per-product command that pins environments, roles and ticket conventions. That private layer is where the product-specific setup belongs and it worked well.

What changed in the repository during the period (committed 2026-10-19 plus uncommitted work): Parity mode, calculation verification, render-leak scan with a Playwright helper, automation reliability, causal attribution in the second-opinion pass, annotated-image rules, filing workflow; then (uncommitted) a parity coverage matrix (tab x control x state), a UI element and state inventory checklist, a select/multi-select control reference, and matching enforcement lines. Every one of these was written **after** a miss in the field, which is the correct feedback loop but also the point of this document: the next additions should be designed ahead of the next miss.

---

## (b) Usage evidence summary

Method: every numbered finding, BOTH and REFERENCE-ONLY item and explicitly listed observation in the twelve reports and the session summary was classified by type, by whether it was found in the first pass or only after the owner pushed back, by detection method and by scope class. Candidates taken from code reading only, INTENDED differences and "same on both sides" rows were not counted. N = 198.

**Finding types**

| Type | Share | Found only after push-back |
|---|---|---|
| Visual / layout (icons, colors, spacing, truncation, menu size, empty-state visuals) | 29% | 30% of this type |
| Behavior / function | 28% | 11% |
| Data / calculation (raw JSON labels, date shifted by one day, missing fields, wrong average) | 16% | 19% |
| Text / format (decimal separator, headings, placeholders, "Error / Error" toasts) | 9% | 29% |
| Responsive (375/320 px, landscape, dialog overflow, sidebar not collapsing) | 7% | **50%** |
| Accessibility (missing `aria-label`/`title`, focus, dialog role) | 4% | 12% |
| Export / file (spreadsheet content, header case, HTML leakage, no download) | 4% | 0% |
| Role / permission (direct URL, visibility rule, endpoint permission level) | 3% | 17% |
| Performance / slow environment | 1% | 0% |

Visual + responsive + text together are **44%** of everything found. In Parity runs alone visual is 32%.

**First pass vs push-back.** 78% first pass, **22% only after the owner pushed back**. The push-back share rose from 0% in the first six runs to 36% in the last six, which tracks both the owner's rising expectations and the fact that the checklists were only written in the second week. Of the push-back findings, 56% are visual or responsive, and roughly 63% could have been produced mechanically (rect measurement, computed styles, DOM harvest of icon-only controls and native inputs, viewport matrix, render-leak scan); another 28% by an interaction checklist (Esc closes, sort first-click direction, search focus on open, warning visible without scrolling); the rest were scope decisions (sub-views, configuration screens and role checks left in the "not tested" list).

**Detection method (primary).** Visual comparison of side-by-side screenshots 50%; measurement (rects, pixels, emulated viewports) 11%; DOM harvest 8%; network 8%; interaction 7%; code reading 2% primary (15% as a secondary witness); file diff 2.5%. Measurement and DOM harvest appear almost only in the second week and mostly after push-back: the tooling existed, the first pass did not run it.

**Scope class.** NEW-ONLY 63%, BOTH 21%, single-environment 11%, REFERENCE-ONLY 6%. One finding in five is a shared-backend defect; without the scope rule these would have been filed as regressions of the rewrite.

**False positives.** About four retracted findings out of ~200 (2%): an average that the code defines per item rather than per person; an export column that was intentional; a menu item "not opening" because the test used a programmatic click instead of a real one; a panel "loading forever" that loaded after 15 s. Three more automation artefacts were removed by the second-opinion pass before the report. All share one root: writing "expected" before reading the code path, or not separating automation from product.

**Top miss causes, ranked by how many push-back findings they explain**

1. No state matrix per control (default, hover, focus, checked, error, empty, loading). A checked checkbox in the wrong color, a validation state with `aria-invalid` but no visible marker, and empty-state cards were only seen when the state was opened on purpose.
2. No viewport x orientation x zoom matrix. Portrait at one width was treated as "responsive tested"; landscape phones, short windows and high zoom produced dialog footers and row menus outside the viewport.
3. Screenshots used as evidence, not as a discovery surface. The defect was already in the image (an empty 36 px strip, a menu twice the reference height) and nobody measured it.
4. Scope self-narrowed: configuration screens, sub-views, dialogs opened from the page and role variants were listed as "not tested" and the report closed.
5. Two sides captured at different window sizes, which made eyeballing unreliable and discouraged pixel comparison.
6. Controls tested with a single value; option content, secondary text and "select all" never compared.
7. "Probably intended" bias plus a "faint color shades" rule used to dismiss semantic color differences (brand green vs browser default blue, destructive action in the confirm color).
8. Slow shared environment and thin fixtures (3 actors, 45-160 s saves) shrank the scenario count; a fixed wait made one "search does nothing" look true.

---

## (c) Design: a senior-grade layout and visual consistency capability

Measurement tooling (`templates/playwright/layout-scan.ts`, `references/core/layout-consistency.md`) is being built separately; this section designs the strategy it plugs into and does not restate its implementation.

### Principles

1. **Measure, do not eyeball.** Every visual claim in a ticket carries a number: rect, offset, computed color, font size, line height, overflow delta, viewport. "Looks faded" becomes "text color `#9CA3AF` on `#FFFFFF`, contrast 2.5:1; reference `#374151`, 10.3:1". Human judgement decides whether the number matters, never whether it exists.
2. **Oracle ladder for appearance**, strongest first:
   1. **Design tokens** read from the project (CSS custom properties, Tailwind config, theme file, style guide). A color, radius, spacing or font value that is not in the token set is a candidate by itself.
   2. **Reference side** (Parity): the same element on the legacy or approved implementation, captured at the same CSS viewport, DPR and state.
   3. **Sibling consistency**: elements with the same role on the same screen (all primary buttons, all table headers, all cards in a grid) must share computed styles and alignment; the odd one out is the candidate. This is the oracle for products without tokens or a reference.
   4. **Convention**: WCAG contrast and target size, platform conventions (destructive actions red, native controls not leaking into a themed UI), common responsive behavior. Lowest level; findings here are POTENTIAL unless 1-3 also apply.
   Every layout finding states which rung it stands on, exactly as functional findings state their oracle level.
3. **State matrix.** For every control: default, hover, focus-visible, active, checked/selected, disabled, read-only, error/invalid, loading, empty, long content, overflow. Capture and measure per state, not per screen. A screen is "visually compared" only when its controls' states have been.
4. **Viewport, orientation and zoom matrix.** Minimum: 1920x1080, 1366x768, 1280x720, 1024x768, 768x1024, 812x375, 375x812, 320x568, plus one short-height desktop (1280x600) and browser zoom 150% and 200% at 1366 width. Both sides of a parity run at identical CSS viewport and DPR; emulation on the agent's own session, restored afterwards.
5. **Tolerance policy.** Position and size: 1 px at 1x DPR, 2 px at 2x; alignment of siblings: 1 px; color: identical hex after rounding, or a stated delta (Delta E < 2) when anti-aliasing is involved; contrast: WCAG AA thresholds; font: exact family and size, line-height within 1 px. Tolerances are configuration, printed in the report header, never silently widened to make a run pass.
6. **False-positive control.** Dynamic regions (clocks, avatars, charts with live data, counters) are masked by selector list before diffing; fonts are waited for (`document.fonts.ready`); animations are settled (see motion detection below); layout shift is sampled twice 500 ms apart and a diff between the two samples is an "unsettled page" result, not a finding. Every candidate from a scan goes through the existing second-opinion pass: is it on the token/reference/sibling rung, is it reproducible on a fresh load, is it INTENDED (a documented redesign), is it a duplicate of a layout-shell issue (one sidebar bug, not thirty page bugs).
7. **Annotated evidence.** One image per finding, both sides labeled by environment, measured values burned into the caption, the offending rect boxed, a link to the JSON signature next to it. The signature is the evidence a developer can act on; the image is the evidence a reviewer can read.
8. **Parity signature diff.** A layout signature is a per-element record (stable locator, role, text hash, rect, computed style subset, state) harvested at a given viewport and state. Diffing two signatures (reference vs rewrite, or build N vs N+1) yields structured differences: moved, resized, recolored, missing, extra, reordered. This finds what pixel diffing cannot name and survives small content differences that would drown a pixel diff.
9. **Mobile specifics and honest limits.** Emulated viewports and user agents cover layout; they do not cover safe-area insets on notched devices, on-screen keyboard resizing, font scaling set in the OS, split-screen, real touch target behavior, or GPU-specific rendering. An agent without a device or a device farm says so in the report and limits claims to "at emulated viewport X". Native mobile apps need a screenshot and accessibility-tree dump from the platform tool (Maestro, Appium, XCUITest, Espresso) and then the same signature diff.
10. **Pixel diff as an optional layer.** Useful for "did anything change" between two builds of the same side with masked dynamic regions; weak for legacy-vs-rewrite because fonts, icon sets and spacing scales differ by design. It never classifies; it only points. Threshold and mask list are printed with the result.

### How it plugs into the modes

- **Sweep:** after the render-leak scan on each screen, run the layout scan at the viewport matrix with the sibling and token oracles; per-state capture for every control the test model lists; findings classified on the oracle ladder; the report gets a "layout coverage" table (screen x viewport x state: scanned / not scanned).
- **Session:** a "layout" direction added to the six directions; a 60-minute layout session is "explore screen X with the layout scan and the state matrix to find drift, overflow and token violations"; the summary carries the same coverage table.
- **Parity:** both sides emulated to the same viewport before the first screenshot; signature harvested per screen, per dialog and per state on both sides; signature diff drives the visual axis instead of eyeballing; "large differences only" is replaced by "differences outside tolerance, classified by oracle rung and by INTENDED/NEW-ONLY/BOTH"; the coverage matrix gains a "layout signature compared" column.
- **Reporting:** a visual finding always has measured values, the viewport and state, the oracle rung, and the scope class. Shell-level defects (sidebar, header, dialog component) are filed once with the list of affected screens, not once per screen.

---

## (d) Prioritized roadmap

Effort: S = one reference file or a small template change; M = reference + runnable template + self-test; L = several files, code and a benchmark. Value is judged against the evidence above (what was missed, how often, and whether a tool would have caught it).

| # | Item | Value | Effort | Depends on | How it is verified |
|---|---|---|---|---|---|
| 1 | **Per-state screenshot and style harvest** (hover/focus/checked/error/empty/loading/long text) per control, with a state-coverage table in the report | Highest: miss cause 1, explains the largest share of push-back findings | M | layout-scan.ts | Self-test page with a native checkbox, a hidden-error input and an empty list; harvest must list all three states with computed styles; a field run shows zero second-pass state findings on one module |
| 2 | **Viewport x orientation x zoom matrix automation** for both sides (emulate, capture, scan, restore) | Highest: miss cause 2; 50% of responsive findings came late | M | layout-scan.ts | Self-test with a fixed sidebar and a tall dialog: matrix must flag overflow at 375x812 and 812x375 and footer unreachability at 1280x600; report prints the matrix |
| 3 | **Parity signature diff** (structured diff of layout signatures, both sides same viewport) | High: replaces eyeballing; miss causes 3 and 5 | M | layout-scan.ts, item 2 | Two local demo pages differing in one moved button, one recolored badge and one missing icon: diff must report exactly those three, classified moved/recolored/missing |
| 4 | **Design-token conformance audit** from CSS variables / Tailwind config / style guide: every computed color, radius, spacing and font on a screen mapped to a token or flagged | High: gives a level-1 appearance oracle for non-parity work and settles "faint shade" arguments mechanically | M | item 1 (state harvest) | Demo page with one off-palette color and one off-scale padding: audit flags both and nothing else; false-positive rate on a real token-based page below 5% after masking |
| 5 | **Export / file content diffing** (xlsx/csv/pdf-text): download on both sides with the same filter, normalize whitespace, diff headers, rows, cell text, detect HTML/entity leakage and number/date formats | High: 4% of findings, 0% missed once the owner insisted on it; make it default | S-M | none | Template with two sample workbooks differing in one header case and one HTML cell; diff output names both; a run that reports "download did not happen" as a finding |
| 6 | **Console and network health gate per screen** (errors, 4xx/5xx, failed requests, slow responses above a stated budget, duplicate requests per action) recorded automatically on every navigation and attached to the coverage table | High: slow-endpoint findings and duplicate-request bugs were found ad hoc | S | none | Self-test page emitting a console error and a 500: gate output lists both with URL and timing; a page with a 12 s response produces a "slow" row, not a false "does nothing" |
| 7 | **Keyboard-only walkthrough** per screen and dialog: Tab order recorded, focus visibility measured, Esc/Enter behavior, focus trap and return, elements reachable only by mouse | Medium-high: accessibility findings were sound but sparse (4%) because they were sampled, not swept | M | item 1 | Demo dialog without a trap and a button with `tabindex=-1`: walkthrough reports the escape point and the unreachable control; output is a table, not prose |
| 8 | **Motion and animation settle detection** (sample layout twice, wait for transitions and `document.fonts.ready`, report "unsettled" instead of diffing) | Medium: prerequisite for items 3 and 4 to stay trustworthy | S | layout-scan.ts | A page with a 2 s entrance animation: first sample marked unsettled, second sample stable; no diff emitted before settle |
| 9 | **i18n expansion and long-text stress** (pseudo-locale with +40% length, 2600-character single token, RTL toggle) combined with the layout scan | Medium: long text overflowed a rating dialog; locale switch was never tested in the period | S-M | items 1-2 | Demo form at pseudo-locale: scan flags the truncated label and the overflowing column; report lists which labels were not expanded (hard-coded) |
| 10 | **Dark-mode and theme sweep** (`prefers-color-scheme`, theme toggle, high-contrast): rerun the token audit and contrast checks per theme | Medium: not relevant to the product tested this month, relevant to most products the skill targets | S | item 4 | Demo page with one color hard-coded in dark mode: audit flags it only in dark mode |
| 11 | **Bug-class memory** (private per project): a list of recurring classes (date shifted by one day, raw multilingual JSON, native control leaking through a theme, sidebar not collapsing, oversized row menu, decimal separator, placeholder-less search box, "Error / Error" toast) run first on every new screen; each confirmed defect appends to it | High value, low cost: the same classes recurred across at least four modules | S | none | Pack template file plus a SKILL.md hook; a run on a new screen shows the class list in the report with hit/no-hit per class |
| 12 | **Flaky-run detection** (reproduce three times from clean state automatically for scan-derived candidates; record rate; mark FLAKY; separate automation artefacts) | Medium: four retractions in the period were automation or timing | S | items 3, 6 | Candidate that appears in 1 of 3 runs is reported as FLAKY with the rate and never as CONFIRMED |
| 13 | **HTML report generator** (coverage matrix, state matrix, viewport matrix, findings with annotated images and signature links, "not tested" list) from the run folder | Medium: reports are hand-written Markdown today; owners read them, developers want the images and numbers | M | items 1-3 | Generated from a self-test run folder; opens offline; every image referenced exists |
| 14 | **Tracker integration safety rules** (de-duplicate by module query, one ticket at a time on request, evidence delivered with each, no credentials, edit instead of duplicate, never auto-file from a scan) written as a hard reference and enforced in the checklist | Medium: the filing workflow worked in the field; it must stay explicit as automation grows | S | none | Checklist line present; a dry run of the filing step shows the ordered list and files nothing until asked |
| 15 | **Mobile device-farm recipe** (one documented path each for Maestro, Appium and a cloud farm: install, run a screen, dump accessibility tree, screenshot, apply the signature diff; plus the explicit "cannot verify without a device" list) | Medium: the skill claims web and mobile; mobile layout has no runnable path today | L | item 3 | Recipe executed once on a sample app in an emulator; signature produced; the limits list appears in the report template |
| 16 | **Seeded-defect layout benchmark** (a demo app with planted drift, overflow, off-token color, missing icon, oversized menu, unreachable footer) used to score every release of the scanners on recall and false positives | High for trust, medium urgency | L | items 1-4 | Recall and false-positive numbers printed by a self-test script; regressions block a release |

Suggested order: 8 (settle) and 6 (health gate) first because they are small and everything else depends on stable captures; then 1, 2, 3 as one wave with layout-scan.ts; then 4, 5, 11; then 7, 9, 12, 13; then 10, 14, 15, 16.

---

## (e) Risks and what not to build

- **Do not turn pixel diff into the verdict.** Legacy and rewrite differ by design in fonts, icon sets and spacing scales; a pixel diff will flag everything and teach the team to ignore the tool. Pixel diff stays an optional pointer; the signature diff and the oracle ladder classify.
- **Do not auto-file tickets from scans.** Every scan output is a candidate; the second-opinion pass and a human decision stay between candidate and ticket. The 2% retraction rate was achieved with that gate in place.
- **Do not build a design-system linter for the whole codebase.** The audit runs on rendered screens the test visits; static CSS linting belongs to the product repository's tooling.
- **Do not add a universal "AI visual judgement" step** ("does this look right?") as an oracle. It produced the "probably intended" bias in the field. Judgement is allowed only on top of a measured difference with a stated rung.
- **Do not widen tolerances to make runs green.** Tolerance is configuration printed in the report; a noisy page gets masks and settle detection, not looser thresholds.
- **Do not promise device coverage the agent does not have.** Emulated viewports are stated as such; the device-farm recipe is the path to real claims.
- **Do not grow the mandatory read list again.** New references attach to the scan outputs (read when a scan fires) rather than to Phase 3's numbered list; context cost was already the lowest-scoring dimension in the methodology review.
- **Do not duplicate the measurement tooling** being built in parallel; this document is its strategy, the coverage tables and the oracle ladder are its contract.
- **Shared-environment risk remains the top operational risk:** slow saves, leftovers from earlier runs, other people's data changes. The automation-reliability rules (fresh fixtures, wait on conditions, one cleanup list) must apply to scan runs too, which create no data but do emulate viewports on a live session and must always restore them.

---

## (f) Metrics to know whether the skill is improving

Collected per run from the report and the run folder, aggregated monthly in the private pack and, anonymized, in `docs/analysis/`.

| Metric | Definition | Baseline (this period) | Target |
|---|---|---|---|
| Second-pass find rate | findings found only after the owner pushed back / all findings | 22% overall, 36% in the last six runs | below 10% within two months; below 5% after the state and viewport matrices are default |
| Visual-and-responsive late share | push-back findings that are visual or responsive / push-back findings | 56% | below 25% |
| Mechanical catch rate | findings whose evidence is a measured value, DOM harvest, file diff or network record / all findings | about 40% (measurement 11%, DOM 8%, network 8%, file 2.5%, plus mixed) | above 60% |
| False-positive rate | retracted or downgraded-to-NOT-A-DEFECT after filing / filed findings | about 2% | stay at or below 2% while volume grows |
| Automation-artefact rate | candidates removed by the second-opinion pass as automation issues / candidates | 3 of ~200 recorded; likely under-counted | recorded every run; below 5% |
| Coverage honesty | runs whose report ends with the coverage matrix and a "not tested" list / runs | about half of the runs in the period (all of the last three) | 100% |
| State coverage | controls with at least five states captured / controls in the test model | not measured | above 80% per screen |
| Viewport coverage | screens scanned at the full viewport matrix on both sides / screens visited | not measured; portrait at one width was common | 100% of screens, both sides, same viewport |
| Time per screen | wall-clock minutes from first navigation to coverage matrix complete, split into setup, scan, exploration, investigation | not recorded consistently; single runs took 3-5 hours per module including push-back rounds | recorded every run; falling setup share; no second-pass rounds |
| Findings per hour by type | counts per type / hours | not recorded | tracked to see whether mechanical scans shift effort from visual to behavior and data |
| Regression lock-in rate | confirmed defects that produced a permanent check (regression test, bug-class entry) / confirmed defects | near zero (bug-class memory did not exist) | above 50% |
| Shell-defect de-duplication | shell-level defects filed once with an affected-screen list rather than per screen | one sidebar defect was correctly filed once and referenced from later reports | always |

A release of the skill is considered an improvement when the second-pass find rate and the visual-and-responsive late share fall without the false-positive rate rising, and when the seeded-defect benchmark (item 16) shows recall at or above the previous release.
