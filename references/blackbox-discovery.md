# Black-Box Discovery & Self-Provisioned Tooling

Two related situations covered here, both about operating without full
source access: (1) mapping an app's structure and consumer surfaces by
observing it live instead of reading code, and (2) what to do when there's
no execution tooling at all — not even a repo — and you were only handed
a URL and credentials.

Web only in this version. Mobile black-box exploration (accessibility-
tree-driven mapping of an unfamiliar app with no source) is a known gap,
not covered here — mobile's source-aware path (`mobile-discovery.md`)
still applies when mobile source *is* available.

## When this file applies

Phase 1 discovery normally starts by reading source. Use this file
instead of (or alongside) `discovery.md` when:

- There's no repo at all — you were given a URL, credentials, and
  instructions ("go here, do this, find bugs").
- There's a repo but you don't have read access to the parts that matter
  (a backend you can't see, a monorepo permission boundary, etc.).

## Black-box feature tracing

Without source, reconstruct the same UI → validation → API → response →
UI-state picture `discovery.md` gets from code, using observation instead:

1. Read the page via the host's DOM/accessibility-tree tool to enumerate
   inputs, actions, and visible constraints (required markers, visible
   min/max hints, disabled states).
2. Drive the feature through its states while watching network traffic —
   the request/response pairs *are* the API contract when you can't read
   its source. Note status codes, payload shapes, and anything the
   client validates that never shows up as a corresponding server-side
   rejection when you probe past it (this is still the highest-yield
   signal — frontend-only constraint — just detected by observation
   instead of by reading two files side by side).
3. Read visible error/success messages as your only window into backend
   behavior when a request fails — there's no source to explain *why*,
   only what got reported.

Everything downstream (test design, execution loop, evidence,
classification, ticket) works the same once you have this picture — this
section only changes how Phase 1 gets built.

## Black-box consumer discovery (for `impact-analysis.md`)

When source isn't available for finding an entity's consumers via grep:

1. Perform the target change (create/edit/delete/deactivate) on one
   screen; capture the resulting entity's id/name from that screen's own
   API response.
2. Read the app's navigation DOM to enumerate its other major sections.
3. Visit each; watch network responses (and rendered text) for that same
   id/name appearing. A hit is a consumer surface — apply
   `impact-analysis.md`'s verification matrix to it exactly as you would
   with a source-discovered one.

This will under-find relative to source-based discovery: a consumer
surface that only displays a *derived* value (never the literal id/name)
won't turn up this way. Say so in the report rather than implying the
sweep was exhaustive.

## Self-provisioned execution tooling

"No source access" doesn't mean "no automated actions." Distinguish two
shapes of request:

- **A single, narrow hypothesis check** (you have *some* environment
  access, this is one specific question) — don't scaffold anything, use
  the host's interactive browser/device tool directly for that one check.
- **A full testing engagement with zero reachable execution tooling** —
  no repo, or a repo with no test framework, and the ask is "test this
  and find bugs," not one narrow question — provision a minimal,
  throwaway automation project yourself:
  - **Web**: a minimal **Playwright** project. It needs no integration
    with the target app at all — it drives any URL, which is exactly
    what "just handed a URL" requires.
  - **Mobile**: **Appium**. Chosen specifically over Detox/Espresso/
    XCUITest because those require build-time instrumentation of the
    target app's source — unavailable by definition in this scenario.
    Appium drives a running app/APK/IPA over the standard WebDriver
    protocol without needing anything built into the app.

**Defaults for a freshly-provisioned web project:** since there's no
existing config to defer to, set up Playwright projects for Chromium,
Firefox, and WebKit from the start (see `test-design-techniques.md`'s
Cross-Browser Verification — these are the three genuinely distinct
engines; add an Edge/msedge channel project too if worth the extra run
time for this engagement) rather than Chromium-only. Default to headed
if this is an interactive session someone's watching; headless if it's
an unattended batch run.

**Where it goes:** a scratch/temporary location — never the target repo
(there may not be one, and this skill doesn't commit new infrastructure
into a project without being asked). Treat it as a session artifact: set
up, use for the rest of this engagement's scenarios, and don't assume it
should persist or get committed anywhere unless the user says so.

**If provisioning itself isn't possible** (no package-manager/install
access in this environment, the target genuinely isn't reachable from
here, no way to get a mobile app onto anything Appium can attach to) —
that's when `SKILL.md`'s Capability Boundaries rule applies: say so
explicitly, fall back to whatever manual/interactive checking is still
possible, and flag the pass as incomplete rather than silently narrowing
scope.
