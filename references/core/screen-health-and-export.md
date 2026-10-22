# Screen Health Gate, Settle, and Export Diff

Three small, mechanical tools that remove three recurring blind spots: problems that only show in the network and console, measurements taken while a page is still moving, and exported files nobody opened.

| Need | Tool |
|---|---|
| What did this screen or step do behind the scenes? | `templates/playwright/screen-health-gate.ts` |
| Is the page still moving? Can I measure or screenshot now? | `templates/playwright/settle.ts` |
| Does the exported file match the other side or the screen? | `tools/export-diff.mjs` (logic in `tools/export-diff-lib.mjs`) |

Self-test: `node tools/selftest/run-health-selftest.mjs` (see `tools/selftest/README.md`).

## 1. Screen health gate

Passive observer. `attachHealthGate(page, opts?)` returns `{ start, snapshot(label), stop }`. Attach once, work normally, call `snapshot('screen or step')` after each screen, step or action. Each snapshot covers the time since the previous one.

Recorded per snapshot:
- console errors and warnings (deduplicated with a count; `ignoreConsole` allowlist of regexes),
- uncaught page errors,
- failed requests (network errors; aborted navigations are listed but not counted),
- HTTP 4xx and 5xx (method, path, status),
- slow responses over the budget (default 3000 ms, `slowMs`),
- duplicate requests (same method, same normalized URL, same body, within `duplicateWindowMs`, default 1000 ms),
- requests that had not finished at snapshot time (older than `unfinishedMinMs`, default 1000),
- `summary: { errors, httpFailures, slow, duplicates, counts }`.

`toMarkdown(snapshot)` renders it for an evidence file (`references/core/evidence-capture.md`). Duplicate, slow and unfinished checks look at `document`, `xhr` and `fetch` only (`resourceTypes`), so images and scripts do not drown the signal.

Attaching: the gate only uses `page.on` and `page.off`. It adds no route, no init script and no extra CDP session, so it is safe on a page attached over CDP to a person's own browser. `stop()` removes every listener. Call `start()` before the navigation or action you want to observe; it sees nothing earlier.

When to use it:
- **Sweep**: attach for the whole run, snapshot after every screen. A non-empty snapshot is a lead to classify, not a finding.
- **Session**: attach at session start, snapshot at each charter step and after each write action; put the Markdown in the session notes.
- **Parity** (`references/core/parity-sweep.md`): attach the same gate, with the same options, to both sides, take one snapshot per matching action, and compare the `counts`. A side that fires 6 requests for the action where the other fires 2, or that shows a 4xx the other does not, is a difference even when the screens look identical. Use the same account, role and data on both sides.

Defaults are starting points. Raise `slowMs` for known heavy reports, lower it for interactive controls. Record the values you used with the evidence.

## 2. Settle before you measure

`waitForSettled(page, opts?)` returns `{ settled, waitedMs, reason, notes }` and never throws. It waits until, over two samples `intervalMs` apart (default 150): fonts are loaded, visible images are decoded, no finite animation or transition is running (`document.getAnimations()`), the main landmark and a sample of elements have not moved, and no request started or finished for `networkQuietMs` (default 300). Hard timeout 8000 ms. Infinite animations (spinners) are ignored and noted.

`sampleLayoutTwice(page, selectors?)` returns the diff between two samples, useful as proof that a page is still moving.

Rule: a layout measurement, screenshot or visual comparison taken while `settled === false` is reported as **unsettled** and is not compared. Re-run it, or say what kept the page moving (`reason`: fonts, images, animations, layout, network). Call it right after the navigation or action: it only tracks requests that start after the call, so a request already in flight is not waited for; use the health gate's unfinished list for those. Use it before `scanLayout` and before every parity screenshot pair.

## 3. Export diff workflow

For CSV and TSV only (delimiter auto-detected among comma, semicolon, tab and pipe; quotes per RFC 4180; BOM and CRLF handled; UTF-16 by BOM; non-UTF-8 is read as latin1 and flagged).

    node tools/export-diff.mjs <fileA> <fileB> [--key <colNumberOrName>] [--ignore-cols 1,3] [--trim] [--json] [--delimiter <char|tab>]

Columns are 1-based (numbers) or names; rows are spreadsheet rows (the header is row 1). Exit code 0 = identical after normalization, 1 = differences, 2 = usage error (also for xlsx).

Workflow:
1. Apply the **same filter, sort, language, role and date range** on both sides. Say which in the report.
2. Download the export from each side (a download is an action: use test data, store files outside the repository).
3. Run the diff with `--key` set to a stable identifier column. Without a key rows are matched by position, and one missing row shifts everything after it.
4. Report each difference with its coordinate (row, column letter and name, both values) and its type.
5. Also compare a few cells with what the screen shows for the same record (screen vs file is its own oracle).

What it reports: row count difference, header differences (order, case, whitespace, renamed, missing, extra), per-cell differences, number format (decimal comma vs dot, thousand separators, percent), date pattern (ISO, `dd.mm.yyyy`, `dd/mm/yyyy`, ambiguous day/month), leading and trailing spaces, HTML tags and entities (`<div>`, `<br>`, `&lt;`, `&amp;`, `&nbsp;`), mojibake, empty cell vs missing cell (short row). "Findings inside files" lists problems in each file on its own: markup, mojibake and stray spaces in both files are a BOTH defect even when the diff is clean.

### xlsx
The tool does not parse xlsx (it is a zip of XML, and the text a user sees depends on number formats). Convert a **copy** of each workbook to CSV UTF-8 with the same settings on both sides: either "Save As" CSV in a spreadsheet application (the CSV keeps the displayed text, which is what a user sees), or headless: `soffice --headless --convert-to csv --outdir <empty-folder> <copy>.xlsx`. Do not open untrusted workbooks with macros enabled. Say in the report that the comparison is of the converted CSV.

## Oracle guidance (`references/core/oracle-hierarchy.md`)

- A health-gate hit is a **lead until classified**. Say what it is: a real defect (an unhandled 500, a console error tied to a visible failure), noise (extension, analytics, a known third-party warning, a prefetch), or expected.
- **Duplicate requests are expected for some endpoints** (idempotent reads re-fetched by design, polling, a token refresh, a retry after 401). A duplicate is a defect when it comes from one user action (double submit, redundant fetch of the same list on load), costs something (writes twice, slow screen), or the other side does not do it. State the evidence: action, endpoint, count, gap, and the record count or visible effect.
- A 4xx can be a deliberate answer (validation, a permission probe you caused). Check that you did not cause it.
- Slow is relative: compare with the other side, with the stated budget and with a second run before reporting.
- Unsettled evidence is not evidence of a layout defect.

## Not verified

- xlsx internals (styles, formulas, hidden sheets, merged cells) and PDF text or layout. Say so in the report when the export is one of those.
- The gate sees one page. Other tabs, workers' own fetches, WebSocket frames and server-side errors are outside it.
- Response correctness: the gate does not read bodies. A 200 with wrong data is for the other oracles.
- Settle checks a sample of elements, not every pixel, and ignores infinite animations by design. Canvas content and video frames are not analyzed.
- Number and date format detection recognizes common patterns only; ambiguous values such as `03/04/2024` are flagged as ambiguous, not decided.

## Privacy

- The gate never reads headers, so `Authorization`, `Cookie` and anti-forgery headers are not stored. Query-string values are replaced by `*`, token-like path segments by `:tok`, and bearer tokens, JWTs and `password=`, `token=`, `cookie=` style text in console messages are masked. Request and response bodies are never stored; only an in-memory hash is used for duplicate detection and it is not written out.
- Exports usually contain real personal data. Use test records, keep downloaded files and diff output in the run's evidence folder, and never commit evidence. Share only coordinates and types when a ticket does not need full rows.
- The self-tests use local files and `127.0.0.1` only.
