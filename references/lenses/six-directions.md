# Six Directions Lens

Use this lens during test design (Phase 2) to push on a feature from six independent directions. Pick at least one try per direction per charter; record which cells you skipped and why.

| Direction | Web | Mobile | API |
|---|---|---|---|
| Interrupt | switch tab, reload, back, double click | incoming call, background app, screen lock, memory pressure | client timeout, retry, aborted upload |
| Network | offline, slow 3G, delayed route | airplane mode, wifi to cellular handover | 5xx, 429, partial response, out-of-order response |
| Screen/Shape | viewport 320-2560, zoom 200%, dark mode | rotation, split-screen, dynamic font size | pagination limits, large payload |
| State | navigate while modal open, stale cache | return after process death | version/ETag lost update, state-machine order |
| Data | Turkish I/i, emoji, 500+ chars, whitespace | keyboard autocorrect, paste | type confusion, null/empty, boundaries, idempotency key |
| Permission | hidden button but reachable route | behavior after permission denial | BOLA/IDOR, role escalation, tenant leak |

## 1. Interrupt
1. Web: click Save, then reload before the response arrives. Expect one record or a clean error.
2. Web: double click the primary submit button (also try Enter plus click).
3. Web: press browser Back mid-wizard, then Forward; check form state.
4. Web: switch to another tab for 60 s during a polling screen, then return.
5. Mobile: lock the screen during upload, unlock, check resume or clean failure.
6. Mobile: receive a call while the camera or payment sheet is open.
7. API: abort the request client-side after the body is sent, then check whether the write happened.
8. API: retry the same POST three times after a timeout; count resulting records.

## 2. Network
1. Web: `context.setOffline(true)` right after clicking submit, restore, observe retry behavior.
2. Web: delay the main API route by 3-10 s (`page.route`) and click twice.
3. Web: throttle to slow 3G, check spinners, timeouts, duplicate submits.
4. Mobile: toggle airplane mode mid-request, then re-enable.
5. Mobile: switch wifi to cellular during a download.
6. API: force a 503 on the second of two dependent calls; check partial state.
7. API: return 429 with `Retry-After`; check client backoff.
8. API: truncated body or dropped connection mid-response.
9. API: responses arriving out of order for rapid successive updates.

## 3. Screen/Shape
1. Web: viewport 320, 375, 768, 1280, 2560; look for clipped or overlapping controls.
2. Web: browser zoom 200% and 400%; check reflow and reachable buttons.
3. Web: dark mode and forced-colors; check unreadable text and invisible icons.
4. Web: very long single-word strings in table cells and titles.
5. Mobile: rotate mid-form; check lost input.
6. Mobile: split-screen and largest dynamic font size.
7. API: `page=0`, `page=-1`, `page=999999`, `pageSize=0`, `pageSize=100000`.
8. API: payload at, one below and one above the documented size limit.
9. API: deeply nested JSON and arrays with thousands of items.

## 4. State
1. Web: open a modal, navigate via menu or Back, check the modal and backdrop are cleaned up.
2. Web: edit a record in two tabs, save both; check for a lost update.
3. Web: stale cache after logout and login as another user.
4. Mobile: kill the process mid-flow, relaunch, check restoration or clean reset.
5. Mobile: background for a long period, return with an expired session.
6. API: `GET` an entity, change it elsewhere, then `PUT` with the old `ETag` in `If-Match`; expect 412, not a silent overwrite. Also `PUT` without `If-Match`.
7. API: call state transitions out of order (ship before pay, delete then update).
8. API: replay a consumed one-time token or an expired reset link.

## 5. Data
1. Web/API: Turkish casing. Search "ISIK" and "ışık": `'ISIK'.toLocaleLowerCase('tr')` gives `ısık` (dotless), while `'ISIK'.toLowerCase()` gives `isik`, so the two spellings differ. Also `'İ'.toLowerCase()` yields `i̇` (i plus combining dot). Check search, uniqueness checks, sorting and email/username matching for I/ı İ/i.
2. Web: emoji, ZWJ sequences, RTL text, combining characters.
3. Web: 500+ and 10000+ character strings in every text field.
4. Web: leading/trailing whitespace, only whitespace, tabs and newlines.
5. Mobile: keyboard autocorrect changing a code or name; pasted text with trailing newline.
6. Mobile: pasted rich text and very long clipboard content.
7. API: type confusion (`"5"` vs `5`, `true` vs `"true"`, array vs scalar).
8. API: `null`, `""`, `[]`, `{}`, missing field, unknown extra field.
9. API: boundary numbers: 0, -1, 2^31, 2^53+1, numeric-looking strings, 0.1+0.2.
10. API: idempotency key: send the same `Idempotency-Key` twice with the same body (expect one record, same response), and with a different body (expect 409/422); omit the key and retry.

## 6. Permission
1. Web: hidden or disabled button, but the route or action is reachable by URL.
2. Web: low-privilege user opens a direct URL of an admin screen.
3. Web: role downgrade in one tab while another tab stays open; act in the old tab.
4. Mobile: deny the permission (camera, location, notifications), proceed, check fallback and no crash.
5. Mobile: revoke the permission in settings while the app is backgrounded.
6. Mobile: deep link into a protected screen when logged out.
7. API: BOLA/IDOR: user A requests `/orders/{id}` of user B by swapping the id; also on PUT/DELETE and nested resources.
8. API: role escalation: send `role=admin` or `isAdmin=true` in a profile update (mass assignment).
9. API: tenant leak: change tenant header or id; list endpoints without a tenant filter.
10. API: expired, malformed and other-tenant tokens against every method.

## Reporting
For each charter, note the matrix cells exercised (direction x surface), result, and evidence path. Classify findings with the standard defect classification. For flow-level fault injection on web, see `references/core/perturbation.md`; for API-only work see `references/lenses/api/api-lens.md`.
