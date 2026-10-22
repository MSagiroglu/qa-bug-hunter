# Layout and Visual Consistency Scan (measure, do not eyeball)

A senior tester notices that "something is a bit off" and then cannot prove it. This method turns the feeling into numbers: element rectangles and computed styles are read from the page, compared with an oracle for "what should be equal", and reported with the offset in pixels. It works on new development (no reference exists, siblings and tokens are the oracle), on existing software (regression: compare against an earlier build or a style guide) and on two sides (parity: compare the style signature of the same screen on reference and rewrite, `references/core/parity-sweep.md`).

Mobile and native specifics: `references/lenses/mobile/mobile-layout.md`. Responsive attack ideas (Turkish): `references/lenses/web/responsive-layout-attacks.md`. Template: `templates/playwright/layout-scan.ts` (`scanLayout`, `scanViewports`, `annotateFindings`, `styleSignature`, `diffSignatures`, `toMarkdown`). Self-test: `tools/selftest/run-layout-selftest.mjs`.

## 1. What is measured, and why measurement beats eyeballing

| Eyeballing misses | Measurement catches |
|---|---|
| 1-4 px misalignment between neighbors (the eye sees "slightly off" but cannot say which one) | Left/top/center coordinates of every member of a row or column, outlier named with its offset |
| Colors that look the same (`#2563eb` vs `#2564ee`) | Distinct computed values with a tiny color distance (deltaE), counted, with example elements |
| A button 6 px shorter in a toolbar | Height spread among same-role controls |
| Uneven gaps (16 px among 8 px) | Gap before each sibling vs the median gap of the group |
| Icon 3-4 px off the center of its round button | Center of the child box vs center of the container |
| Text clipped by `overflow:hidden`, content cut under a container edge | `scrollWidth > clientWidth` on clipping boxes |
| Horizontal scroll or an element beyond the viewport at one width only | Document scroll width and each element's right edge at every viewport in the matrix |
| Faint grey text, tiny tap targets | Contrast ratio and target box in CSS px |

Eyeballing is still needed for what a number cannot say (is this the right icon, does the page look intentional). Use the scan to produce the candidates and the evidence, then judge them.

All measurements are CSS pixels, taken from the live DOM (`getBoundingClientRect`, `getComputedStyle`), in document coordinates so they can be drawn back onto a full-page screenshot. Geometry is exact; colors are computed values, not rendered pixels.

## 2. Check catalogue

Default tolerances live in the exported `DEFAULTS` object of the template and can be overridden per run. Severity is a starting point; adjust by section 7.

| Id | Detects | Default tolerance | Typical cause | Starting severity |
|---|---|---|---|---|
| HSCROLL | Document scrolls horizontally (`scrollWidth > clientWidth`) | 1 px | Fixed-width element, missing `max-width: 100%`, long unbroken string, table without a scroll wrapper | High |
| OFFSCREEN | Visible element extends past the viewport edge (outermost offender only; fixed and fully off-left off-canvas elements excluded) | 1 px | Same as above; negative margins; absolutely positioned popups | High; Critical when fully outside and the page cannot scroll to it |
| CONTAINER_OVERFLOW | In-flow child wider than a non-scrolling parent, or a clipping box (`overflow: hidden`) whose content is larger than the box | 1 px | Fixed child width in a flexible parent, `min-width` on flex children, `box-sizing` mix-ups | Medium; High for a control |
| CLIPPED_TEXT | Text truncated by ellipsis, `overflow: hidden` or line clamp, where the content really is larger than the box | 1 px | Fixed-width label, long translation, large font scale | Medium; High for a button or link label; Low when a tooltip or `aria-label` carries the full text |
| OVERLAP | Two interactive elements whose boxes intersect (nesting and label/control pairs excluded) | 15% of the smaller box and more than 2 px in both axes | Negative margins, absolute positioning, wrapping toolbar, sticky/fixed bars over content | High |
| CENTER | Icon-only buttons and badges (automatic) and any `centerPairs` you name: child center vs container center. Also a generic near-miss heuristic: a small box (both sides at most 64 px) with a visible background or border and exactly one visible element child of at most 70% of the box per axis, whose center is off by 1 to 6 px (offsets above 25% of the box are intentional placements such as corner badges and are not reported) | 1.5 px; near-miss window 1 to 6 px, box 64 px, child 70%, intentional above 25% (`centerNearMin`, `centerNearMax`, `centerNearMaxBox`, `centerNearChildRatio`, `centerNearIntentional`) | Inline svg on the text baseline, asymmetric padding, translate leftovers | Low up to 2 px, Medium beyond |
| ALIGN | Member of a row or column group sits 0.75-4 px off the line shared by the majority (top, center, bottom, baseline for rows; left, center for columns). A member that matches on any valid axis is not flagged; offsets above 4 px are treated as intentional | 0.75 px lower bound, 4 px upper bound | Stray margin or padding, different border width, one wrapper too many | Low up to 2 px, Medium beyond |
| GAP | Gap before a member differs from the median gap of same-kind siblings (same tag and class), when most gaps agree | 1 px (larger gaps up to 3x median + 8 px are reported; spacers beyond that are treated as intentional) | Margin on one item, an element hidden by CSS that still has a margin | Low up to 2 px, Medium beyond |
| SIZE_VARIANCE | Same-role interactive elements under one parent differ in height (and in width when they have no text) | 1 px, up to 50% of the median | Different padding, border, line-height or icon size on one variant | Low up to 2 px, Medium beyond |
| COLOR_NEAR_MISS | Two distinct computed text, background or border colors with 0 < deltaE76 < 6; both values, counts and examples are reported. Two NEUTRAL colors (Lab chroma below 8 for both, e.g. white, `#f9fafb`, `#f3f4f6`) are a normal surface ramp and are reported only below deltaE76 1.5 (e.g. `#f5f5f5` vs `#f6f6f6`) | deltaE 6 (`colorDeltaE`); neutral pairs deltaE 1.5 (`neutralDeltaE`), neutral chroma limit 8 (`neutralChroma`) | A copied hex with a typo, a token bypassed by a literal, an opacity/blend instead of a token | Low |
| COLOR_ROLE_VARIANCE | Elements you declared as one role (`roles`) differ in color, background, border color/width/radius, font family/size/weight | exact match | One variant styled by hand, wrong class, stale CSS | Medium |
| FONT_NEAR_MISS | Distinct font sizes 0.5-1.5 px apart; more than 12 family/size/weight combinations | 0.5-1.5 px | A size set in rem in one place and px in another, an unscaled heading | Low |
| CONTRAST | Text against its effective background below 4.5:1 (3:1 for large text: 24 px, or 18.66 px bold) | WCAG 2.x AA | Grey-on-white secondary text, text on a tinted or disabled-looking surface | Medium; High below 2.5:1; Critical below 1.3:1 |
| TAP_TARGET | Interactive element below 24x24 CSS px (WCAG 2.2 SC 2.5.8) without the spacing exception; in the mobile profile also below 44 px as info | 24 px (44 px guideline) | Icon-only controls, dense tables, inline icons | Medium; info for the guideline |

Every check reports a stable selector, the rectangle (x, y, width, height), a one-line detail with the measured numbers, and a `values` object for the report table. Findings are grouped and capped (25 per check by default) while `stats.counts` keeps the real totals: read the counts, not only the rows.

## 3. Oracles: what should be equal

Pick the strongest available, in this order, and write the level in the finding (`references/core/oracle-hierarchy.md`).

1. **Design tokens or style guide supplied for this project** (colors, spacing scale, type scale, control heights). Compare measured values to the tokens. Level 1-2: a confirmed defect when the value is not in the set.
2. **The reference side in parity mode.** Capture `styleSignature` for the same screen, state and viewport on both sides and run `diffSignatures`. Differences are classed NEW-ONLY, BOTH, INTENDED as in `references/core/parity-sweep.md`. Level 6-7 in the hierarchy (accepted product behavior); strong in practice.
3. **Sibling consistency inside the same screen.** Same-role elements should look the same: buttons in one toolbar, fields in one form, rows in one list. This is oracle level 7 (consistent behavior elsewhere in the application). The scan's ALIGN, GAP, SIZE_VARIANCE and `roles` checks use it. Without a written rule the finding is a **Potential Defect / Behavior Requiring Clarification**; with a token file or reference side it is confirmed.
4. **Domain convention** (the 8 px grid, 4.5:1 contrast, 24 px minimum target, left-aligned labels). Level 8: report as potential.

Do not upgrade level 3 or 4 findings silently. Say "no style guide supplied; sibling consistency used".

### Avoiding false positives

| Source of noise | What to do |
|---|---|
| Intentional variants (primary vs secondary, destructive, compact density) | The scan groups by tag and class; declare roles explicitly with `roles` and only compare what must match. Add `[data-layout-ignore]` or the `ignore` option for decorative areas |
| Hover, focus, active, disabled, pressed | Scan them as their own states (section 5), never mix them into the default pass. Disabled controls are excluded from contrast, tap target and size checks |
| Animated or transitioning elements | The scanner skips elements with running animations and counts them in `stats.skippedAnimated`. Wait for transitions to end, or freeze them, then re-scan |
| Hidden, off-canvas and screen-reader-only elements | Skipped (`display:none`, `visibility:hidden`, zero opacity, 1x1 clip, fixed off-canvas drawers, elements fully left of the viewport). Open the drawer and scan it as its own state |
| Sub-pixel rounding (fractional widths, device pixel ratio) | Equal means within 0.75 px for alignment and 1 px for sizes and gaps. A reported 1 px offset is a real layout-unit difference, not antialiasing; a 0.5 px offset is not reported |
| Intentionally subtle surfaces (page `#fff` vs card tint with a small color distance) | They show as COLOR_NEAR_MISS (Low). Record the pair once in `allowColorPairs` and say so in the report; do not delete the finding silently |
| Third-party widgets, maps, embeds, iframes | Not traversed (iframes, shadow roots). Treat as a coverage gap and say so |
| Gradient or image backgrounds | CONTRAST skips them (`stats.contrastSkipped`); measure those by hand on a screenshot sample |
| Content-dependent differences (long names, wrapped text) | Compare with the same fixture data on both sides; a wrapped label is a content effect, not a style defect |

## 4. Viewport, orientation and zoom matrix

Run the scan once per row. Record viewport, orientation, device pixel ratio, zoom, scan time, the per-check counts, and the screenshot path.

| Viewport | Why |
|---|---|
| 320 x 568 | Smallest supported phone; WCAG reflow width |
| 375 x 812 | Common phone, portrait |
| 812 x 375 | The same phone in landscape (height is the scarce dimension: sticky bars, dialogs, menus) |
| 414 x 896 | Large phone |
| 768 x 1024 | Tablet portrait; breakpoint boundary |
| 1024 x 768 | Tablet landscape; small laptop; breakpoint boundary |
| 1280 x 800 | Common laptop |
| 1536 x 739 | Scaled laptop display (125% scaling on a 1920 screen) |
| 1920 x 1080 | Full HD desktop; content must not stretch or float |
| 200% zoom | Set the viewport to half the CSS size (1280 x 800 becomes 640 x 400; 320 CSS px wide = 400% of a 1280 window). Also scan at the browser's real zoom when the tool supports it |

`scanViewports(page, prepare)` runs `prepare` after each resize (re-navigate or re-open the state), scans, aggregates a check-by-viewport count matrix and restores the original viewport. Test the boundary widths just below and above each CSS breakpoint of the product (read them from the stylesheet), not only the standard list.

Record per viewport:

`viewport | HSCROLL | OFFSCREEN | CONTAINER_OVERFLOW | CLIPPED_TEXT | OVERLAP | worst severity | screenshot`

A defect that exists at one width only is still a defect; name the width range (for example "below 560 px") by bisecting between the passing and failing widths.

## 5. State coverage

Layout is state-dependent. Scan each state, not only the default one:

| State | How to reach it | Typical layout defects |
|---|---|---|
| Default | Load | Baseline |
| Hover, focus, active | Hover or Tab onto the control, then scan | Focus ring clipped by `overflow`, hover state that changes size and shifts neighbors |
| Disabled | A form with a disabled control | Different height or font from the enabled variant |
| Error / validation | Submit invalid data | Message pushes the layout, overlaps the next field, is cut off, is out of view in a long form |
| Empty | No data, no search result | Collapsed card, different container, misaligned illustration |
| Loading | Throttled or delayed response | Skeleton and final content differ in size (layout shift), spinner not centered |
| Open dropdown, menu, date picker, tooltip | Open it, then scan | List wider than the viewport, covered by the footer, clipped by a scroll container |
| Open dialog, drawer | Open it, scan the dialog subtree with the `root` option | Dialog taller than the viewport in landscape, close button off-screen (see `references/invariants/overlay-dialog.md` if present) |
| Long and short content | Maximum-length names, many items, a single item | Overflow, uneven row heights, truncation without a tooltip |
| Locale and direction | Longest translation, right-to-left | Clipped labels, mirrored icons not mirrored |

The scan is read-only: it never clicks. The tester (or the test script) puts the page into the state, then calls `scanLayout`.

## 6. Procedure

1. Pick the screen, the states (section 5) and the viewports (section 4). State the oracle (section 3) before the run.
2. Put the page in the state, wait for data, fonts and transitions, then call `scanLayout(page, { roles, centerPairs })` or `scanViewports`.
3. For parity, call `styleSignature(page, selector)` on both sides for the same container, then `diffSignatures(reference, underTest)`; compare at the same viewport and with the same fixture.
4. Read `stats.counts` first. A check with a huge count usually means one shared cause (one wrong class); report the cause once with the count and three examples, not hundreds of rows.
5. Confirm each candidate: open the element, inspect the computed style, and decide intentional or defect. Remove false positives with a reason; never delete a finding without one.
6. Capture evidence (section 8), classify (section 7), report (section 9).

## 7. Classify and rank

| Severity | Layout meaning | Examples |
|---|---|---|
| Critical | Content is unreachable or unreadable | Primary action completely off-screen with no scroll; text at contrast below 1.3:1; dialog buttons beyond the viewport |
| High | Overlap or clipping of a primary action; the page scrolls sideways on a phone | Two buttons overlapping; "Save" label truncated; horizontal scroll at 375 px |
| Medium | Misalignment, inconsistent spacing or size, contrast below AA, undersized tap target | Field 3 px off its column; one button 6 px shorter; 2.85:1 secondary text |
| Low | 1-2 px offsets, near-miss colors or font sizes | `#2563eb` vs `#2564ee`; 15 px vs 16 px text; icon 2 px off center |

Parity classes (`references/core/parity-sweep.md`): **NEW-ONLY** (rewrite differs, reference is correct), **BOTH** (the same flaw on both sides; file it as an existing defect), **INTENDED** (documented design change; cite the source), **REFERENCE-ONLY** (rewrite is better). Do not file faint color differences in parity unless they exceed the visual-parity tolerance of the project; list near-miss shades in an appendix.

Raise severity when the defect hits a primary flow, appears at the most common viewport of the product's users, or blocks input. Lower it when a tooltip carries the clipped text or the element is decorative. A pile of Low findings with one shared cause becomes one Medium "design token not applied" finding.

## 8. Evidence rules

- One annotated screenshot per viewport and state: `annotateFindings(page, findings, path)` draws numbered boxes (color by severity) onto a full-page screenshot and removes its overlay afterwards. Keep the returned legend next to the image.
- Every finding quotes the numbers: the measured values, the expected values (sibling median, reference value, token), the difference in px or deltaE, the selector, the viewport, the state, the build or URL.
- Save the raw scan result (JSON) and the `toMarkdown` table as files per `references/core/evidence-capture.md`.
- For parity, include both screenshots with the same crop and the diff table from `diffSignatures`.
- Do not report a number you did not measure ("looks about 4 px"). If a check could not run (iframe, canvas, gradient background), list it under "not covered".

## 9. Reporting table

Group by cause; one row per distinct problem.

| ID | Screen / state | Viewport | Check | Element | Measured | Expected (oracle, level) | Severity | Parity class | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| L-01 | Profile form, default | 375 x 812 | ALIGN | `#field-offset` | left edge 3 px right of 4 siblings | sibling consistency (7) | Medium | NEW-ONLY | `shots/profile-375.png` #5 |
| L-02 | Toolbar, default | 1280 x 800 | SIZE_VARIANCE | `#btn-short` | 38 px high | 44 px (siblings' median, 7) | Medium | BOTH | `shots/toolbar-1280.png` #7 |

After the table, state what was scanned (screens, states, viewports), what was not (iframes, canvas, gradients, states not reachable) and the false positives removed with reasons. End the run with the honest done / not done list.
