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
