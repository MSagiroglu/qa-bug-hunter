# Critical Defect Patterns

A short list of defect shapes that are disproportionately common, high
severity, and easy to miss because the UI *looks* fine. Check these
explicitly for any feature that writes data (create/update/delete/upload) —
don't rely on stumbling into them via generic error-guessing.

## The core rule: never trust the UI's own success signal

A success toast, a green checkmark, or a redirect only prove the *client*
believes the write succeeded. They are not evidence the write actually
persisted. For any write operation you test, verify the outcome from a
source independent of the UI feedback that triggered it — reload the page/
screen from scratch and re-fetch, call the read API directly, or check the
list/detail view the record should now appear in. Treat "UI said success"
and "data actually persisted" as two separate facts to confirm, not one.

This produces a 2×2 you should have an answer for on every write scenario
you test, especially the interrupted ones below:

| | Persisted | Not persisted |
|---|---|---|
| **UI showed success** | correct | **ghost success — CONFIRMED DEFECT, usually High/Critical: user believes data is saved and walks away** |
| **UI showed error** | **CONFIRMED DEFECT — orphaned/duplicate data risk, and a confusing retry could double-submit** | correct |

## Interrupted-write scenarios to run this check against

- **Submit, then immediately reload/refresh** before any response could
  plausibly have arrived. Does the record exist after reload? Does the UI
  now show it, or still show the pre-submit state?
- **Submit, then immediately navigate away** to another screen, then back.
  Same check.
- **Network drop timed to land mid-request** (disconnect/airplane-mode
  right after triggering the action, before a response is possible).
  Reconnect, then check both the UI state and the actual persisted state.
  Does a retry after reconnecting create a duplicate, or correctly resume/
  replace?
- **Throttled/slow connection** where the request is slow but eventually
  succeeds. Does a client-side timeout fire and show an error *while the
  server still commits the write* — producing a false "it failed" that's
  actually a ghost success in reverse (user retries a write that already
  happened)?
- **Double-submit**: rapid double-click/double-tap on the same submit
  control, or submit twice from two tabs/sessions. Does it create two
  records, reject the second cleanly, or silently overwrite?
- **Do nothing and just leave**: open the form, fill nothing (or partial),
  navigate away or close the tab/app without submitting. Confirm nothing
  was persisted — some autosave/draft implementations get this wrong in
  both directions (saving a blank draft nobody wanted, or losing a draft
  the user expected to be kept).

## Applying this

This is not a separate phase — run it as part of Phase 3/4 test design and
execution (`SKILL.md`) for every scenario that writes data, and treat any
ghost-success or orphaned-error finding as high-priority regardless of how
minor the field itself seemed.
