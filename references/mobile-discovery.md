# Mobile Discovery

Applies when the target is a mobile app (React Native, Flutter, or native
iOS/Android). Run this alongside `discovery.md` — everything there about
tracing UI → validation → API → business logic → DB → response → UI state
still applies; this file adds what's mobile-specific.

## 1. Stack and test-tool detection

- **React Native**: `package.json` with `react-native` dependency. Test
  tooling: `.detoxrc.*` (Detox), `wdio.conf.*` + Appium capabilities
  (Appium), `maestro/*.yaml` (Maestro), or Jest + `@testing-library/react-native`
  for component-level tests only (not full E2E — note this distinction,
  it matters for what Phase 4 can actually exercise).
- **Flutter**: `pubspec.yaml` with a `flutter` SDK constraint. Test tooling:
  `integration_test/` directory (Flutter's own driver), `test_driver/`
  (legacy flutter_driver), or `patrol.yaml` / `patrol` dependency (Patrol).
- **Native iOS**: `.xcodeproj`/`.xcworkspace`. Test tooling: an `*UITests`
  target (XCUITest) — check the Xcode project's test targets.
- **Native Android**: `build.gradle`/`build.gradle.kts` with an
  `androidTest` source set. Test tooling: Espresso (`androidx.test.espresso`
  dependency) or UI Automator.
- **Cross-platform runner present regardless of app stack**: Appium or
  Maestro can drive any of the above — check for these configs first since
  they override the stack-specific default.
- **No E2E tooling found**: don't scaffold one to answer a single
  exploratory question. A manual pass with the device/simulator and network
  inspection (proxy, or the platform's own network inspector) is a valid
  substitute — say so in the report.

Whichever tool is found, reuse it exactly as `discovery.md` says for web:
don't introduce a second one for a one-off check.

## 2. Feature trace, mobile-specific parts

Same end-to-end trace as web (UI → client validation → API → backend →
DB → response → UI state), plus:

- **Local persistence**: does this feature read/write local storage
  (AsyncStorage, SQLite, Realm, Core Data, Room, SharedPreferences/
  UserDefaults)? A bug can live entirely in the local↔server sync layer,
  invisible from either side alone.
- **Permissions**: does the flow depend on a runtime permission (camera,
  location, notifications, contacts, biometrics)? Find where the permission
  is requested and what the code does on denial/not-yet-asked/permanently-
  denied — these are three distinct states, often only one is handled.
- **Deep links / universal links**: does this feature have an entry point
  via deep link or push notification tap? Check the route/link handler
  separately from the in-app navigation path — they frequently diverge in
  what state they assume the app is in.
- **Background/foreground lifecycle hooks**: does the feature register
  anything on app background/foreground/kill (timers, listeners, upload
  queues)? Find the lifecycle handler.
- **Platform divergence**: is the feature's logic shared or duplicated
  between iOS and Android (or is one platform using a native module the
  other doesn't)? A frontend/backend-style divergence can also exist
  between iOS and Android implementations of the "same" feature — check
  both platforms' code paths, not just one.

## 3. Highest-yield signal (mobile equivalent)

For web, the highest-yield discovery finding is a constraint enforced only
in the frontend. For mobile, the equivalent — and just as high-yield — is:
**a constraint enforced only in the client, where the client is the mobile
app**, tested the same way as web (find it in source, then confirm via
Phase 4 whether the backend independently enforces it, e.g. by replaying a
captured request with the constraint violated). Mobile apps talk to the
same kind of backend APIs as web apps do, so this check transfers directly
once you have the request/response captured (proxy the device/simulator
traffic, or read it from the app's own network layer/logs).
