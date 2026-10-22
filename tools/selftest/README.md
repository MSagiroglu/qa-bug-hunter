# Overlay helper self-test

Validates `templates/playwright/overlay-invariants.ts` against two local demo pages.

## Run
From the repo root (needs `agent/node_modules` and an installed Playwright chromium; `npx playwright install chromium` if missing):

    node tools/selftest/run-selftest.mjs

The runner compiles the real helper with the agent's TypeScript into a temp dir outside the repo, opens `good-modal.html` and `bad-modal.html` via `file://`, and prints one PASS/FAIL row per check. Exit code 0 = self-test passed; non-zero = failed.

## What it proves
- `good-modal.html` (correct accessible modal): every automated check passes (OV1, OV2, OV2-restore, OV3, OV4, OV6, OV7, OV10), OV6 is exercised (page is scrollable), and no helper error occurs.
- `bad-modal.html` (deliberately broken): OV1, OV3, OV4, OV6, OV7 and OV10 are each reported as FAIL. Defects: no role/aria-modal/name, no focus trap, no ESC, no scroll lock, close control is a non-focusable div outside the 320px viewport, every click opens another instance.
- Runner fails if any intended defect is missed or the good page is false-flagged.

## What it does NOT prove
- It validates the helper only, not any real product or UI library.
- Manual-only rows (OV5, OV8, OV9, OV11-OV14) are not covered.
- OV7 at 200% zoom is not measured; only 320px.
- Only one browser engine (chromium), one viewport size, and simple static pages. Real dialogs with backdrops covering the trigger, animations, portals, or iframes are not exercised.

# Rapid-action helper self-test

Validates `templates/playwright/rapid-action.ts` (see `references/core/rapid-action-testing.md`).

## Run

    node tools/selftest/run-rapid-selftest.mjs

The runner starts `rapid-server.mjs` (Node, binds `127.0.0.1` on an OS-chosen port, 300 ms response latency, counts POSTs and records per page variant), compiles the real helper into a temp dir outside the repo, drives `rapid-good.html` and `rapid-bad.html` with chromium, and stops the server at the end. Network access is limited to that local server. Exit code 0 = passed.

## What it proves
- `rapid-good.html` (button disables, `aria-busy` and spinner at once, one request per intent, re-enables after): no false flags in rapidClicks, doubleClick and enterRepeat modes; exactly 1 request and 1 record per burst; guard seen within 150 ms; guard released; delete sends 1 request with no 5xx.
- `rapid-bad.html` (no guard, no spinner, every click posts and creates a record, second delete answers 500 with a stack trace): MULTI_REQUEST, DUPLICATE_RECORDS, NO_UI_GUARD, NO_LOADING_INDICATOR (bursts 2 and 5 produce 2 and 5 requests and records), SERVER_ERROR_5XX on delete, severity hint High.
- `maxTotalClicks` is a hard cap (3 clicks cap yields at most 3 POSTs and `capped: true`).

## What it does NOT prove
- Not the stuck-guard-after-error path (GUARD_STUCK_AFTER_ERROR) or the 429 hint; no page in this suite fails or throttles on purpose.
- One engine (chromium), mouse input only (no touch taps), simple static pages, a server with no real idempotency or version logic.
- Timing-dependent: the 150 ms guard window assumes a normal machine; a heavily loaded host could make the sampler miss it.

# Layout scanner self-test

Validates `templates/playwright/layout-scan.ts` (see `references/core/layout-consistency.md`).

## Run

    node tools/selftest/run-layout-selftest.mjs

The runner compiles the real template with the agent's TypeScript into a temp dir outside the repo, opens `layout-good.html`, `layout-bad.html` and `layout-legit.html` via `file://` (no network), runs `scanLayout` at 1280x800 and `scanViewports` at 375x812 and 812x375, and prints one PASS/FAIL row per seeded defect. Exit code 0 = passed; non-zero = a seeded defect was missed or the good or legit page produced a finding above `info`.

## What it proves
- `layout-bad.html` carries 14 seeded defects, each with a stable id, and every one is reported by the intended check: HSCROLL and OFFSCREEN (600 px element at 375 px), CONTAINER_OVERFLOW, CENTER (icon 4 px off), ALIGN (field 3 px off), GAP (16 px among 8 px), COLOR_NEAR_MISS and COLOR_ROLE_VARIANCE (`#2563eb` vs `#2564ee`), SIZE_VARIANCE (button 6 px shorter), TAP_TARGET (16x16), CONTRAST (`#999` on `#fff`), OVERLAP, CLIPPED_TEXT, and D14 (CENTER by the generic heuristic: a plain `div` round box with an absolutely positioned icon 5 px low).
- `layout-good.html` (same page without the defects) yields no finding above `info` at 1280x800, 375x812 and 812x375.
- `layout-legit.html` is a page of legitimate patterns that must stay clean (nothing above `info`) at the same three viewports: sticky header, off-canvas fixed drawer (`translateX(-100%)`), screen-reader-only text, `display:none` block, horizontal carousel, status badges in green/amber/red, disabled muted button, neutral surface ramp (white, `#f9fafb`, `#f3f4f6`), 44x44 buttons at AA contrast, and an avatar with an intentional corner badge (not a CENTER near-miss).
- The scan is read-only (DOM identical before and after), `scanViewports` restores the viewport, `annotateFindings` writes a screenshot and removes its overlay, `styleSignature`/`diffSignatures` find the seeded differences between the two pages and none between a page and itself, `toMarkdown` renders, `maxPerCheck` caps rows but keeps real counts.

## What it does NOT prove
- It validates the scanner on two small static pages, not any product. Real sites are noisier: expect false positives from intentional variants, subtle surface tints (COLOR_NEAR_MISS), design systems with several near sizes (FONT_NEAR_MISS) and third-party widgets; the noise level on real software is not measured here.
- FONT_NEAR_MISS is not seeded; open shadow roots, iframes, canvas, gradient backgrounds (CONTRAST skips them) and pseudo-elements are not exercised.
- Geometry is exact layout units, colors are computed values: antialiasing, sub-pixel text rendering, image content and real device pixel ratios above 1 are not analyzed. Offsets below 0.75 px are treated as equal on purpose.
- One engine (chromium), emulated viewports only: no real device, safe area, keyboard or font scaling. States (hover, open menus, dialogs) are not driven by this test.

# Health gate, settle and export-diff self-test

Validates `templates/playwright/screen-health-gate.ts`, `templates/playwright/settle.ts` and `tools/export-diff.mjs` (see `references/core/screen-health-and-export.md`).

## Run

    node tools/selftest/run-health-selftest.mjs

The runner compiles the real templates with the agent's TypeScript into a temp dir outside the repo, starts a local server on 127.0.0.1 (random port), opens `health-good.html` and `health-bad.html`, and creates seeded CSV files in a temp dir. It takes about 25 seconds. Exit code 0 = passed; non-zero = a seeded problem was missed or the good page was flagged.

## What it proves
- `health-bad.html` triggers a console error, an uncaught exception, a 500, a 404, a 4 s endpoint, the same POST twice within 200 ms, a 1.5 s animation and a late font and image: the gate reports each one, lists the pending request as unfinished until it completes, and no secret (query value, console token, request body) appears in any output. `stop()` removes all six listeners and nothing is recorded afterwards.
- `health-good.html` (same shape, none of the problems, plus an infinite spinner and two GETs that differ only by query) yields zero errors, http failures, slow, duplicates and unfinished.
- Settle: the bad page is `unsettled` at t=0 and settled later, `sampleLayoutTwice` sees the movement and then none, the good page settles in well under 1.5 s, the hard timeout returns instead of throwing.
- Export diff: header case, a `<br>` in a cell, decimal comma vs dot, thousand/decimal swap, date pattern, a trailing space, mojibake, empty vs missing cell and a missing row are each reported with row and column; quoted commas and quotes do not create false diffs; BOM and CRLF compare identical to plain files (exit 0); `--trim` and `--ignore-cols` work; semicolon vs comma delimiters are auto-detected; no arguments, an unknown key and an xlsx input exit 2.

## What it does NOT prove
- Real applications are noisier: extensions, analytics, third-party warnings and polling produce leads that need classifying. The noise level on real software is not measured.
- One engine (chromium), no CDP-attached user browser, no service workers, WebSockets or iframes.
- Timing-dependent: the slow, duplicate-gap and settle checks assume a normal machine; a loaded host can shift them.
- Export diff is exercised on small CSVs only: no xlsx, no very large files, no locales beyond the patterns listed in the reference.
