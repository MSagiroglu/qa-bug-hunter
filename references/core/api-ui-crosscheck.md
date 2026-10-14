# API + UI Cross-Check (Three Witnesses)

A UI that says "Saved" proves nothing. After every **write action**
(create, update, delete, status change) collect three independent
witnesses and require that they agree.

## The three witnesses

1. **UI state** - what the user sees after the action (row appears, toast, counter, field value).
2. **Network response** - the response to the write request, captured with
   `page.waitForResponse` matched by **URL and method** (not "the next response"). Start listening before the click.
3. **Independent re-read** - fetch the record again without trusting the UI:
   `request.get(...)` with the same session (API request context), or reload the page and read it.

Template: `templates/playwright/api-ui-crosscheck.ts` (`threeWitness`). It
returns status, body, UI value, re-read value and a `mismatches` list, and
never throws on a mismatch. Put the returned evidence in the finding.

## Mismatch classes and severity

| Witnesses | Class | Severity |
|---|---|---|
| UI shows success, API returned 4xx/5xx | Silent failure / false success | High |
| API 2xx, UI stale or not updated (re-read shows new value) | Stale UI (also breaks the "synchronized UI" rule) | High |
| UI validates (blocks input) but the backend accepts the same invalid input via a direct request | Frontend-only validation, bypassable | Critical |
| UI hides or disables an action for a role but the API allows it | Broken access control (BOLA/BFLA) | Critical |
| Error response body leaks internals (stack trace, SQL, file paths, internal hosts) | Information disclosure | Medium - see `references/core/security-hygiene.md` |

For the bypass class: replay the same write with the API request context
using a value the UI rejects (own test data only, `TEST_` prefix). Only
send values the UI would also let a user type; this is QA, not attack crafting.

## Response-shape check

Compare the response to a hand-written JSON shape: required keys, types,
nullability, enum values, no unexpected extra fields (extra fields feed the
overexposure check in `security-hygiene.md`). A small inline checker is enough:

```ts
const ok = typeof j.id === 'number' && typeof j.name === 'string' && !('passwordHash' in j);
```

Use Schemathesis **only if** an OpenAPI spec exists for the target; do not
generate a spec just to run it.

## Role mismatch (BOLA) method

Use **two of your own test users** (A and B, ideally different roles). Never use real users' data.

1. As A, create a `TEST_` record; note its ID.
2. As B (separate API request context with B's session), request/modify/delete A's record by ID.
3. Compare to the UI: if B's UI does not offer the action but the API allows it, that is "UI hides / API allows" (Critical).
4. Repeat per role pair for read, update, delete. Clean up A's records at the end.

## Mobile note

Same rule. The network witness comes from an intercepting proxy (e.g.
mitmproxy or Charles) on the device or emulator; the re-read witness is
an API call with the captured session, or pulling the screen fresh after a restart.
