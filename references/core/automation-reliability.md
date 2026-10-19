# Automation Reliability (drive real apps without producing false findings)

A large share of "failures" in browser-driven exploration are the automation, not the product. This file lists the habits that keep findings trustworthy. It complements the AUTOMATION ISSUE class in `references/core/defect-classification.md` and the benign-explanation check in `references/core/second-opinion.md`.

## 1. Sessions and credentials

- **Prefer attaching to the user's own logged-in browser** (Chrome DevTools Protocol, `chromium.connectOverCDP`) when the user has one open on the target. Start it with a remote debugging port and a dedicated profile directory. This avoids handling credentials at all.
- Never type, print or store passwords, tokens or auth-state files. If login is required and no session exists, ask the user to log in themselves in the automated browser window, then continue.
- Role switching: use the product's own impersonation or a second test user. After a role chain, always return the session to the original user and verify who you are (header name) before the next scenario.

## 2. Waiting

- Wait for a condition (a selector, a specific response), not a fixed sleep. Prefer `waitUntil: 'commit'` plus an explicit element wait on slow or heavy pages.
- Single-page apps with hash routes: a direct deep link may redirect; navigate from a stable page through the app's own router, and wait until the page is settled before navigating again (a "transition prevented" or ignored navigation usually means a modal or pending transition is still open: dismiss it, wait, retry).
- Eventually consistent lists (newly created items appear after a delay, caches): poll with a cap and record how long it took. A delay that always resolves is an observation; "never appears" is a candidate finding.
- After creating many records the server can be slow for a minute: back off and retry before concluding a failure.

## 3. Independence of scenarios

- Create fresh, disposable data for each scenario (unique `TEST_` names). Do not reuse records that earlier scenarios rated, approved, edited or re-saved: leftover state is the most common cause of confusing results.
- When a result looks wrong, **rebuild the fixture from scratch and repeat once** before investigating the product. If the user suggests deleting and recreating the data, do it.
- Change one variable at a time; write down which variable.

## 4. Evidence hygiene

- Keep a script per scenario in the run folder; a result you cannot re-run is weak evidence.
- Record time and environment in the file name or log. Take the screenshot after the page settled, not mid-transition.
- Encoding: run scripts and tools with UTF-8 explicitly on Windows (`PYTHONIOENCODING=utf-8`, `open(..., encoding='utf-8')`), or non-ASCII text in reports and tickets gets corrupted.

## 5. Flake vs defect

- Reproduce at least three times from clean state (`references/core/second-opinion.md`). State the rate.
- If a selector or wait was changed to make it pass, the original failure was an AUTOMATION ISSUE; do not file it.
- Shared environments: other people may change data while you test. If numbers drift for no reason you caused, note it and re-create the fixture.

## 6. Cleanup

Track every created record in one list the moment it is created (name, id, type, environment). At the end delete only items from that list, verify the deletion in the UI and by re-read, and report what remained and why.
