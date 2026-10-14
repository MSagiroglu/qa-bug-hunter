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
- Rapid (opt-in, not in `all`; `-s rapid`, cap via `--rapid-max-clicks`, default 12): bursts of 2 then 5 rapid clicks on mutating triggers the run can safely drive (TEST_-marked forms it fills itself; delete only on rows carrying its own marker; everything else recorded as `skipped: not safe`). Counts mutating requests, samples guard/loading indicator within 150ms. Results are candidates needing oracle confirmation; a 429 stops the burst.

## Domain packs

`--domain <name>` selects a pack; without it the agent scans `<dir>/*/pack.md` and matches the `Markers:` (or `Alt-Markers:`) paths against the cwd or `--repo <path>`. `<dir>` is `QA_DOMAIN_PACKS_DIR` or `~/.qa-bug-hunter/domains`. A missing directory means `none`. The result is written to the report header (`Mode:`, `Lenses:`, `Domain pack:`).

## Output

Reports saved to `docs/qa-reports/<date>/`
