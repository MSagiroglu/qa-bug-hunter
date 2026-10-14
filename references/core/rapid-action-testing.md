# Rapid-Action / Double-Submit / In-Flight Guard Testing

Fire a write action again and again, fast, and watch what the system does.
Applies most to **create, update and delete**, and to anything that costs
money, sends a message or changes state (pay, approve, send, invite, import).

The four questions, for every write action:

1. **Does the system allow it?** Can a second activation start while the first is in flight?
2. **Is the same request sent repeatedly?** Count requests per user intent (expected: exactly 1).
3. **Is there a loading mechanism?** Spinner, progress, disabled or `aria-busy` trigger, within about 100 ms.
4. **Is a new action blocked until the request returns?** And is the block released on success, on error and on timeout?

A UI guard is a usability measure, not a security control: a user with a
script or a second tab bypasses it. The server must defend independently.
Test both layers and report them separately.

Related: `perturbation.md` (the `doubleClick` fault is one cell of this
technique), `references/lenses/six-directions.md` (Interrupt, State, Data),
`api-ui-crosscheck.md` (three witnesses), `advanced-exploratory-attacks.md`
(double submit, concurrency), `references/load/assertions.md` (duplicate
writes, idempotency, lost update), `references/load/safety-gates.md`.

## Template

`templates/playwright/rapid-action.ts` exports `rapidAction(page, opts)` and
`rapidActionRow(action, burst)`. It fires bursts, counts matching requests
(method plus URL), samples the trigger and loading indicator in the first
150 ms, waits for settle, calls your `verify` for the record count, and
returns structured per-burst results with verdict hints. It never throws and
enforces `maxTotalClicks` (default 12). Self-test: `tools/selftest/README.md`.

```ts
const rep = await rapidAction(page, {
  trigger: page.getByRole('button', { name: 'Save' }),
  request: { method: 'POST', urlPattern: '/api/items' },
  loadingIndicator: page.getByRole('status'),
  bursts: [2, 5],
  verify: async () => ({ recordCount: await countTestRecords(api) }),
});
rep.bursts.forEach((b) => console.log(rapidActionRow('create item', b)));
```

Modes: `rapidClicks` (default), `doubleClick`, `enterRepeat` (Enter pressed N
times with the trigger focused). Hints it can emit: `NO_REQUEST`,
`MULTI_REQUEST`, `NO_UI_GUARD`, `NO_LOADING_INDICATOR`, `GUARD_NOT_RELEASED`,
`GUARD_STUCK_AFTER_ERROR`, `SERVER_ERROR_5XX`, `THROTTLED_429`,
`DUPLICATE_RECORDS`, `OVER_DELETE`, `UI_GUARD_MISSING_BACKEND_DEDUPES`.
Hints are inputs to your judgment, not verdicts: a trigger that stays
disabled because the form legitimately closed is not a stuck guard.

## A. UI in-flight guard checks (web)

Slow the request down first (route delay of 2 to 3 s, see the Network
direction) so the in-flight window is long enough to observe. Without a
delay a fast API hides a missing guard. Then check, per trigger:

| # | Check | Expect |
|---|---|---|
| A1 | Loading indicator appears | within about 100 ms of the first activation (use 150 ms as the measurement tolerance) |
| A2 | Trigger state while in flight | `disabled`, or `aria-disabled="true"`, or `aria-busy="true"`; the user can tell the action is running |
| A3 | Second activation while in flight | no second request until the first settles |
| A4 | Guard release on success | trigger usable again (or form closed / navigated) |
| A5 | Guard release on error and on timeout | trigger usable again, clear error message, input preserved, no endless spinner |
| A6 | Double click | one request |
| A7 | Rapid clicks (bursts 2, 5) | one request per intent |
| A8 | Keyboard: Enter held down (auto-repeat) | one request |
| A9 | Keyboard: Enter plus click combo, Space on a button | one request |
| A10 | Back or refresh right after submit | one record, or a clean error; no duplicate on resubmit prompt |
| A11 | Submit, then navigate away immediately | no orphan request result applied to a different screen; record exists once or not at all |
| A12 | Other triggers of the same action (context menu, toolbar, shortcut, bulk action) | the same guard applies |

A disabled trigger that keeps keyboard focus loses it in some UIs; check
that focus is not dropped to the document body in a way that traps a
keyboard user (see WCAG focus guidance). Prefer `aria-disabled` plus an
in-handler guard where the control must stay focusable.

## B. Mobile

- Tap bursts: 2 and 5 quick taps on the primary action (real device or emulator; tap, not click).
- Double tap and long press on the action.
- Tap, then immediately background the app, lock the screen, rotate, or lose connectivity; return and check one record and a coherent state.
- Tap, then Back (hardware or gesture) while in flight.
- Pull-to-refresh or retry button pressed repeatedly during a failed load.
- Same checks A1 to A5: visible progress, disabled or non-interactive control, release on error.
- Offline queue: an action queued offline and then retried must not duplicate when connectivity returns.

## C. API (no UI)

Drive the endpoint directly with the API request context. Bursts are
sequential-fast and, where the throttle allows, parallel (2 parallel
identical requests is the minimal race).

| # | Check | Expect |
|---|---|---|
| C1 | Same create sent twice | one record, or second rejected with 409 (or equivalent); or the same stored resource returned for a repeated `Idempotency-Key` |
| C2 | Same create with the same `Idempotency-Key` twice | same result, one record; a different body with the same key is rejected with a clear 4xx |
| C3 | Delete twice | first 2xx, second a clean 404 or 409 (or documented idempotent 2xx), never 500, never a stack trace or internal path |
| C4 | Update twice with different values (parallel) | version or ETag conflict (409/412), or documented behavior; silent last-write-wins is a finding |
| C5 | Rapid create-delete-create of the same natural key | consistent final state, no orphan, no 500, no unique-constraint leak in the body |
| C6 | Update after delete in a burst | clean 404/409, not 500 |
| C7 | Optimistic UI plus failure | UI rolls back the optimistic change and tells the user; re-read matches |
| C8 | Safe methods repeated | GET repeated has no side effects (no counter, no record) |

Natural-key dedupe means the server rejects or merges a second record with
the same business identity (for example same email, same order reference).
Do not assume an `Idempotency-Key` header exists; if neither a key, a natural
key, nor a 409 stops the duplicate, that is the finding.

## D. Network witness

Count requests, not clicks. Register `page.on('request')` before the first
activation and count requests matching **method plus URL** (not "any
request"). One burst is one user intent; expected count is exactly 1.
Also record statuses: a 429 inside a burst is an observation (the server
throttles), not a retry trigger. Corroborate with the independent re-read
(`api-ui-crosscheck.md`): the request count says what was sent, the record
count says what was stored. Both are needed:

| Requests | Records | Reading |
|---|---|---|
| 1 | 1 | Healthy |
| more than 1 | 1 | Backend dedupes; UI guard missing |
| more than 1 | more than 1 | No guard and no dedupe |
| 1 | more than 1 | Server-side fan-out or retry layer duplicating; investigate |
| 0 | 0 | Trigger did nothing (check it was enabled before the burst) |

## E. Classification matrix

| Observation | Severity | Note |
|---|---|---|
| UI guard missing, backend dedupes (one record) | Medium | Visibility of status and error prevention; user sees no feedback, wasted calls |
| Neither guard nor dedupe, duplicate records created | High | Raise to Critical when the duplicate has financial, legal or irreversible effect (matches `references/load/assertions.md`) |
| Destructive double action returns 5xx or leaks a stack trace or internals | High if data is damaged or an internal error is exposed; Medium if only a noisy 500 with clean state | See `security-hygiene.md` for leakage |
| Guard stuck after error or timeout (user locked out, needs reload) | High | Data entered may be lost |
| Loading indicator missing but guard present | Low | Visibility of system status |
| Loading indicator appears late (clearly over 1 s) | Low to Medium | |
| Update twice silently last-write-wins, no version check | High | Lost update |
| Optimistic UI not rolled back on failure | High | UI and server disagree |
| Burst gets 429 with an understandable message | Observation | Not a defect; record the message quality |
| Burst gets 429 with no message, or raw error | Medium | |

Severity here is a starting point; confirm it with `defect-classification.md`
and the product context.

## F. Oracles and literature (by name)

Use `oracle-hierarchy.md` for precedence; requirements and API contract
first. Where those are silent, these published sources justify the expected
behavior:

- **Nielsen usability heuristics**: "Visibility of system status" (loading feedback) and "Error prevention" (blocking a repeat of a costly action).
- **WCAG 2.2** status messages (aria-live regions, `role="status"`) and the name/role/value requirement for the busy and disabled state (`aria-busy`, `aria-disabled`).
- **HTTP semantics, RFC 9110**: method safety and idempotency (GET, PUT, DELETE are idempotent; POST is not). A repeated DELETE should leave the same state; a repeated POST needs another mechanism.
- **The IETF Idempotency-Key HTTP header field draft**: a client-supplied key makes a non-idempotent POST safe to retry.
- **OWASP Web Security Testing Guide**, business logic testing (including testing for race conditions and for the limits on the number of times a function can be used).
- **ISTQB** experience-based techniques (error guessing, exploratory testing) and state transition testing for in-flight and released states.

Do not cite clause numbers from memory. Cite the document name in the
finding and quote the observed behavior.

## G. Safety (mandatory)

- Only `TEST_`-marked data created in this run. Never act on pre-existing business records; for delete, create the record first.
- Never on production. Shared environments need the gates in `references/load/safety-gates.md` (allowlist, environment statement, window and approval).
- Burst caps: start with 2, then 5; use 10 only when the throttle limit is known and has headroom. Keep a hard total cap (the template defaults to 12 activations across all bursts).
- Duplicate requests consume the throttle budget. Count burst requests against the ceiling in the load safety gates; stop when 429 appears and record it.
- Do not loop retries to "make it reproduce". A race that needs many tries is reported as intermittent, with the counts observed.
- Cleanup: delete every record created, including duplicates, then verify with a count or list that none remain (before and after counts in the report). Leave no `TEST_` residue; if cleanup fails, list the ids.
- Never paste real credentials or personal data into the test records.

## H. Reporting

One row per action tested, in the findings report:

| action | clicks | requests sent | records created | UI state during flight | verdict |
|---|---|---|---|---|---|
| create item (button) | 5 | 5 | 5 | no guard, no loading | High: duplicates, no dedupe |
| create item (button) | 5 | 1 | 1 | guard@56ms, loading@56ms | OK |
| delete item | 2 | 2 | -1 | no guard | High: second DELETE returned 500 with stack trace |

`rapidActionRow` prints exactly these columns. Attach the network list
(method, URL, status, timing) and the before/after record counts as
evidence. When filing a defect, give the expected-vs-actual in terms of the
four questions at the top, the burst size that reproduced it, and the oracle
named in section F.
