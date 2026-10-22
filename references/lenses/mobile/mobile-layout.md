# Mobile Layout and Visual Consistency

The mobile counterpart of `references/core/layout-consistency.md` (read that first for the check catalogue, oracles, severity and evidence rules). It applies to native apps (iOS, Android, cross-platform) and to mobile web. Same principle: read element bounds and styles from the running app and compare them with an oracle, instead of judging screenshots by eye.

## 1. What changes on a phone

| Area | What to check | Typical defect |
|---|---|---|
| Safe areas | Content stays out of the notch / cutout, the status bar area, rounded corners and the home indicator or gesture bar; backgrounds still extend edge to edge | Header text under the notch; bottom button covered by the home indicator; landscape content cut by the cutout |
| Status bar | Style (light/dark icons) readable against the screen background; no overlap with the top bar | White icons on a white header |
| Keyboard | With the keyboard open, the focused field and its primary action stay visible; the layout resizes or scrolls | Submit button hidden behind the keyboard; focused field under it; sticky footer jumping above the keyboard and covering content |
| Dynamic type / font scale | At 200% (Android font scale 2.0, iOS largest accessibility size) text is not clipped, controls grow, nothing overlaps | Fixed-height buttons clipping labels; truncated titles; overlapping rows |
| Orientation | Portrait and landscape; rotate while a dialog, menu or keyboard is open; state survives | Dialog taller than the landscape screen; bottom bar eating half the height |
| Split-screen / multi-window / foldables | Narrow window (about 320-400 dp wide) and resizing at runtime | Layout assumes full screen; truncated tablet layout in a half window |
| Dark mode | Every screen in light and dark: text contrast, borders, icons, images with transparent backgrounds | Black text on dark surface; invisible dividers; white logo box |
| RTL | Right-to-left locale: layout mirrors, directional icons flip, alignment and padding use start/end | Back arrow pointing the wrong way; margin only on the left; text aligned left |
| Touch targets | Size and spacing of every tappable element (section 2) | 16 dp icon buttons, adjacent links 4 dp apart |
| Locale length | Longest translation (German, Finnish) and shortest | Clipped button labels |

## 2. Touch target size

- **Minimum (a pass or fail check):** WCAG 2.2 SC 2.5.8, Target Size (Minimum): at least 24 x 24 CSS px, or a smaller target with enough spacing that a 24 px circle centered on it touches no other target. Inline links inside a sentence and user-agent default controls are exempt. The template's TAP_TARGET check implements this, including the spacing exception, and treats a label as part of its checkbox or radio.
- **Guideline (a recommendation, report as info or Low):** about 44 x 44 pt on iOS (Human Interface Guidelines) and 48 x 48 dp on Android (Material). WCAG 2.5.5 (enhanced) asks for 44 CSS px at level AAA. Say "below the platform guideline", not "fails the standard".
- Measure the touchable area, not the drawn icon: a 24 px icon with 12 px of padding inside a 48 px frame passes; the same icon with a 24 px frame does not.
- 1 dp equals 1 CSS px at a viewport of device-width and initial-scale 1; compare in the unit the oracle uses and state the conversion.

## 3. Reading element bounds without eyeballing

| Platform | How | Notes |
|---|---|---|
| Android (any app) | `adb shell uiautomator dump /sdcard/ui.xml` then `adb pull /sdcard/ui.xml`; every node has `bounds="[left,top][right,bottom]"` in physical pixels, plus `class`, `resource-id`, `clickable`, `text`, `content-desc` | Divide by density (`adb shell wm density`; dpi / 160 = scale) to get dp. Width is `right - left`. Visible nodes only; custom-drawn views and canvases appear as one node |
| Android (emulator or device screenshot) | `adb exec-out screencap -p > shot.png` to pair the numbers with a picture | Do the dump and the screenshot in the same state |
| iOS (XCUITest) | `element.frame` (points) for every element of `app.descendants(matching: .any)`; `app.debugDescription` prints the hierarchy with frames | Frames are in points in screen coordinates; the safe area is `window.safeAreaInsets` read through the app, or the known device inset |
| Appium (either platform) | `driver.find_elements(...)` then `element.rect` (x, y, width, height) or `getRect`; page source (`driver.page_source`) contains bounds for all nodes | One call per element is slow; take page source once and parse it |
| Maestro | `maestro hierarchy` dumps the view tree with bounds | Good for a quick scan; assert with `assertVisible` and coordinates |
| Flutter | Inspector or `tester.getRect(find.byKey(...))` in a widget or integration test; `debugDumpRenderTree()` | Sizes in logical pixels, comparable to dp |
| React Native | Accessibility tree through Appium/Detox; `measure()` in a debug build | Prefer the accessibility tree: it is what the test tool sees |
| Mobile web | Playwright device emulation: `browser.newContext({ ...playwright.devices['iPhone 13'] })` (viewport, device scale factor, touch, mobile user agent) then `scanLayout(page, { profile: 'mobile' })` | Emulation is not a real device: no real safe areas, keyboard, font scaling or rendering engine |

Turn the dump into the same checks as on the web: build rectangles, group siblings by parent and role, and compare left/top/center, gaps, heights and sizes with the tolerances of `layout-consistency.md` (use dp or points consistently; 1 px tolerance on a density-3 screen is 1/3 dp, so convert before comparing). Colors and fonts are usually not in the dump; read them from design tokens, from the accessibility inspector, or sample a screenshot at the element center and state that this is sampled.

## 4. Device and state matrix

Pick from this list, noting what the product supports (minimum OS, minimum screen):

| Class | Example profiles | Why |
|---|---|---|
| Small phone | 320 x 568 pt (older iPhone SE class); 360 x 640 dp Android | Everything must still fit |
| Common phone | 375 x 812 / 390 x 844 pt; 360 x 800 / 412 x 915 dp | The main audience |
| Large phone | 414 x 896 / 430 x 932 pt | Wide controls drift, thumb reach |
| Notch / cutout | Phone with a notch, a punch-hole and a gesture bar | Safe areas |
| Tablet | 768 x 1024 / 820 x 1180 pt; 800 x 1280 dp | Layout switches, two-pane |
| Foldable or split window | Half-width window, folded and unfolded | Runtime resize |

For each device, scan: portrait, landscape, font scale default and 200%, light and dark, LTR and RTL (at least one RTL locale), keyboard open on the screens with inputs, and the key states of `layout-consistency.md` section 5 (error, empty, loading, open menu or dialog).

Mobile web adds: the page at 320, 375, 414 CSS px; with the browser toolbar collapsed and expanded (viewport height changes, check `100vh` usage); with text size increased in the browser setting; at 200% zoom.

## 5. What an AI agent can and cannot verify without a device

Be honest about this in the report.

| Can verify | Cannot verify (say so) |
|---|---|
| Mobile web layout at emulated viewports, orientations and device pixel ratios: overflow, overlap, alignment, gaps, sizes, colors, contrast, tap target size | Real device rendering, real browser chrome (address bar collapsing), real safe-area insets and notch behavior, the real software keyboard |
| Bounds, text, content descriptions and clickable flags of a running Android emulator or device through `uiautomator dump`, and of iOS through a configured XCUITest/Appium session | Anything on a device or simulator the agent cannot start or reach; tests cannot be inferred from source code alone |
| Font scale and dark mode through the platform settings, when the agent can drive the emulator or simulator | How text looks to a person with low vision on a real screen; haptics; true color rendering of panels |
| Touch target size and spacing from the bounds | Whether a target is comfortable for a thumb, one-handed reach, fat-finger error rates |
| RTL mirroring of a screen after switching locale on a reachable build | Whether the translation is correct or natural |
| Differences between two builds with the same fixture (parity) | Which one is intended, unless a spec or design source says so |

If no device or emulator is available, do not claim mobile coverage from a desktop browser: report "mobile web emulation only" with the profile used, and list native-only checks (safe areas, keyboard, font scale, gestures) as not covered. If the build needs a device farm or a signed install, ask the user rather than guessing.

## 6. Findings and evidence

Use the severity and parity classes of `references/core/layout-consistency.md` section 7. Mobile specifics:

- A primary action hidden by the keyboard, notch or home indicator is High; Critical if the user cannot complete the flow.
- Clipping at font scale 200% on a form or checkout screen is High (accessibility), on a decorative title Medium.
- Tap targets: below 24 px without spacing exception is Medium; below the platform guideline only is Low or info.
- Evidence: device or emulator model, OS version, screen size and density, font scale, theme, orientation, locale, app build; the screenshot plus the dump (`ui.xml` or frames) taken in the same state; the numbers measured, converted to the unit the oracle uses.
