# Evidence Capture

Evidence is a real, saved artifact — not a sentence describing one. "The
API returned 201" is a claim; `network-1-save-request.json` sitting next
to the ticket is evidence. This file covers how to actually produce those
files, for every execution tool this skill might be driving.

## Storage convention

`docs/qa-reports/evidence/<date>-<module>/` in the target repo, next to
that date/module's report from `references/core/report-template.md`. Inside:

- `screenshot-<n>-<label>.png`
- `network-<n>-<label>.json` — the request and response for one exchange
  (method, URL, status, request payload, response payload)
- `console-<n>-<label>.log` — raw console output relevant to the finding
- `video-<n>-<label>.<ext>` or `trace-<n>.zip` — only when video/trace
  capture is enabled (see `SKILL.md` Phase 5's ask-before-enabling rule;
  this file doesn't change that rule, it just says where the output goes
  once it exists)
- `db-query-<n>-<label>.json`/`.txt` — only when a database connection
  was already available (`references/core/database-verification.md`); the query text and
  the specific row(s) relevant to the finding, not a full table dump

`<n>` increments per finding within the run; `<label>` is a short slug
(`save-request`, `blocked-toast`, `min-target-network`). Every filename
referenced in a ticket's Ekler/Attachments section (`jira-ticket-
template.md`) must exist at that path — don't reference a file you didn't
actually write.

## Two capture paths

### 1. Scripted (preferred — whenever an execution tool is driving the test)

Write to disk from inside the script itself, not to stdout only:

- **Screenshot**: use the tool's native screenshot call with an explicit
  path into the evidence folder (e.g. Playwright's
  `page.screenshot({ path: ... })`).
- **Network**: attach a response/request listener and, on the exchange
  relevant to the finding, write the captured method/URL/status/payloads
  to a JSON file with `fs.writeFileSync` (or your language's equivalent).
  Logging it with `console.log` is not evidence capture — that only
  appears in the terminal output of that one run and isn't a file anyone
  can attach to a ticket. (This was the actual gap in this skill's own
  first live run: the exploratory spec captured network data via
  `console.log` only, so nothing was left to attach afterward.)
- **Console**: same — collect via the tool's console-event listener and
  write the relevant lines to a `.log` file, don't rely on the test
  runner's own stdout capture being retrievable later.
- **Video/trace**: only if already enabled or the user approved enabling
  it this run (Phase 5's rule). Save/copy the tool's output into the
  evidence folder using the naming convention above — most tools default
  to their own output directory (e.g. Playwright's `test-results/`);
  copy or move the relevant file rather than leaving it findable only by
  someone who knows that tool's default location.

### 2. Interactive (fallback — ad-hoc investigation, or black-box mode with no script to write capture code into)

Use the host environment's own screenshot/console/network inspection
tool. Two sub-cases:

- **It can write bytes to disk** — save into the evidence folder with the
  same naming convention. Treat it exactly like the scripted path from
  here on.
- **It can't (output is view-only in the conversation/session)** — don't
  invent a file path that doesn't exist. In the ticket's Ekler section,
  say explicitly that the artifact was captured interactively during the
  session and isn't a saved file, so the reader isn't sent looking for a
  path with nothing behind it. Weaker evidence than a saved file — say so
  (`references/core/jira-ticket-template.md` and `references/core/defect-classification.md`'s confidence
  field both expect this to be stated, not hidden).

## Annotated comparison images (Parity mode, before/after pairs)

A side-by-side image is evidence only if a reader can tell which side is which at a glance. Rules:

1. **Label by environment, never by position.** Every panel header names the environment or state ("Rewrite (new UI)", "Reference (old UI)", "Before save", "After save").
2. **One color per environment, used consistently across all images** (for example purple = rewrite, blue = reference). Two panels from the **same** environment (before/after) use the **same** color and differ only in the label text. A header color that contradicts the environment shown inside the screenshot (a blue "reference" bar over a screenshot whose own banner says "rewrite") is wrong; check this on every image before attaching.
3. Burn an environment banner into each screenshot at capture time (a small bar with the host name) so the label survives cropping.
4. Mark the difference with a box and a short caption; red for the defective state, green for the correct state, regardless of side.
5. One image per finding when possible, named `<id>-<label>.png`; the ticket names the same file. Re-open the finished image and read every label before delivering it.
6. If the tracker has no upload tool, deliver the image file to the person filing the ticket in the same message as the ticket link.

## Applying this

Phase 5 (`SKILL.md`) is where this runs — for every suspicious or
confirmed finding, produce the files this describes before writing the
finding up as a ticket. The ticket's Ekler/Attachments section is just a
manifest of what this phase actually wrote.
