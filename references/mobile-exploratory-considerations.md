# Mobile Exploratory Considerations

Error-guessing prompts specific to mobile, used in Phase 3/4 alongside
`test-design-techniques.md`. Same rule as the web input-mutation catalog:
gate each one on whether it's actually reachable for the feature under
test — don't run the full list against every screen.

## Lifecycle interruptions

- Background the app mid-flow (e.g. mid-form, mid-upload, mid-payment),
  then foreground it. Does state survive? Does an in-flight request
  complete, get retried, or get silently dropped?
- Kill the app mid-flow and relaunch. Same questions — does it resume,
  restart, or land in a broken intermediate state?
- Incoming call, SMS, or another app's notification interrupts mid-flow.
- Device rotates (if orientation change is supported) mid-flow — does
  input or scroll position survive?
- OS-level low-memory kill and relaunch (harder to trigger manually, but
  worth a note in the report as untested if you can't force it).

## Connectivity

- Airplane mode / connectivity loss mid-request. Does the UI show a
  correct error, retry, or hang silently?
- Connectivity returns after a loss — does a queued action fire once, or
  duplicate?
- Slow/flaky connection (if you can throttle it) — does a timeout produce
  a sane error, or a stuck spinner?

## Permissions

- Permission denied, "don't ask again"/permanently denied, and not-yet-
  requested are three different states — test the one the feature's code
  actually branches on (see `mobile-discovery.md` §2). Revoking a
  permission from OS settings mid-session (if a real device/simulator is
  available) tests a fourth state most apps don't handle: permission
  revoked *after* the app already assumed it had it.

## Deep links / push notifications

- Deep link opened while the app is: not running, backgrounded, already
  open on an unrelated screen, already open on the *same* screen with
  different data loaded.
- Push notification tapped in each of those same states.
- Malformed or unexpected deep link parameters (missing ID, ID for an
  object the current user can't access).

## Auth / biometrics

- Biometric prompt cancelled or failed (wrong fingerprint/face) — does
  the app fall back correctly, or get stuck?
- Session/token expiry while the app was backgrounded — does the next
  foreground action fail gracefully or crash/loop?

## Input and device fragmentation

- Small screen sizes: does critical UI (submit button, error message) get
  pushed off-screen or behind the keyboard?
- OS version at the low end of what the app claims to support.
- System font-size / accessibility text-scaling set to maximum — does
  layout break?
- Locale/RTL if the app supports a right-to-left language.

## Store/update state (lower priority, note if relevant)

- Fresh install vs. update-from-previous-version — does local data
  migrate correctly, or does the updated app choke on old-shape local
  storage?
