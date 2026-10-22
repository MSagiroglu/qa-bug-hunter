# QA Bug Hunter Agent

Standalone CLI tool for automated QA testing of web applications.

## Quick Start

```bash
npm install
npm run build
node dist/cli.js test --url https://example.com
```

## Commands

- `test` — Run QA tests on a URL
- `analyze` — Analyze DOM structure

## Test Suites

- Security (XSS, SQL Injection, HTML Injection)
- Input (Empty, Long, Special chars, Unicode, Type confusion)
- Responsive (Mobile, Tablet, Desktop)
- Accessibility (Alt text, Labels, Headings)
- Navigation (Broken links, Console errors)
- Overlay (dialog invariants OV1-OV4, OV6, OV7, OV10; per-OV pass/fail)
- API (replays only the app's own 2xx writes created by the run or carrying a TEST_ marker: duplicate-write and no-credentials checks; refuses everything else). `-s api` alone runs headless.
- Layout (read-only, in `all`; `-s layout`): settles the page, then measures overflow, off-screen and clipped elements, overlaps, off-center icons, misalignment, uneven gaps, same-role size/color drift, contrast and tap targets at 375x812, 812x375, 768x1024, 1280x800 and 1920x1080 (override: `--viewports 375x812,1280x800`). Annotated screenshot of the worst findings per viewport goes to the report evidence folder. A viewport that never settles is reported as `unsettled` and not compared. Oracle `layout-consistency (measured)`. Findings are candidates: nothing is rated critical, only HSCROLL, OFFSCREEN and OVERLAP can reach high, everything else is capped at medium.
- Health (read-only, in `all`; `-s health`): reloads the URL, waits for settle and reports console errors, uncaught exceptions, HTTP 4xx/5xx, failed, slow (over 3 s), duplicate and never-finished requests. A passive gate is attached for the whole run; when `health` is combined with other suites a run-wide `HLT-RUN` segment summary is added. Findings are leads, classify before filing.
- Rapid (opt-in, not in `all`; `-s rapid`, cap via `--rapid-max-clicks`, default 12): bursts of 2 then 5 rapid clicks on mutating triggers the run can safely drive (TEST_-marked forms it fills itself; delete only on rows carrying its own marker; everything else recorded as `skipped: not safe`). Counts mutating requests, samples guard/loading indicator within 150ms. Results are candidates needing oracle confirmation; a 429 stops the burst.

## Layout and health suites

```bash
# 1) the suites reuse the skill templates; `npm run build` copies them first (prebuild)
npm run build
# 2) read-only, safe to include in -s all
CI=1 node dist/cli.js test --url https://example.com -s layout,health --viewports 375x812,1280x800
```

The scanner code is not duplicated: `scripts/sync-templates.mjs` copies `templates/playwright/{layout-scan,settle,screen-health-gate}.ts` into `src/lib/vendor/` (generated, git-ignored) before every build. After editing a template run `npm run build` (or `npm run sync-templates`); `npm run dev` syncs automatically. Self-test pages: `tools/selftest/layout-*.html`, `health-*.html`.

## Domain packs

`--domain <name>` selects a pack; without it the agent scans `<dir>/*/pack.md` and matches the `Markers:` (or `Alt-Markers:`) paths against the cwd or `--repo <path>`. `<dir>` is `QA_DOMAIN_PACKS_DIR` or `~/.qa-bug-hunter/domains`. A missing directory means `none`. The result is written to the report header (`Mode:`, `Lenses:`, `Domain pack:`).

## Output

Reports saved to `docs/qa-reports/<date>/`
