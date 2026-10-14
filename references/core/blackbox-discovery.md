# Black-Box Discovery & Self-Provisioned Tooling

Two related situations covered here, both about operating without full
source access: (1) mapping an app's structure and consumer surfaces by
observing it live instead of reading code, and (2) what to do when there's
no execution tooling at all — not even a repo — and you were only handed
a URL and credentials.

Web only in this version. Mobile black-box exploration (accessibility-
tree-driven mapping of an unfamiliar app with no source) is a known gap,
not covered here — mobile's source-aware path (`references/lenses/mobile/mobile-discovery.md`)
still applies when mobile source *is* available.

## When this file applies

Phase 1 discovery normally starts by reading source. Use this file
instead of (or alongside) `references/core/discovery.md` when:

- There's no repo at all — you were given a URL, credentials, and
  instructions ("go here, do this, find bugs").
- There's a repo but you don't have read access to the parts that matter
  (a backend you can't see, a monorepo permission boundary, etc.).

## Black-box feature tracing

Without source, reconstruct the same UI → validation → API → response →
UI-state picture `references/core/discovery.md` gets from code, using observation instead:

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

## Black-box consumer discovery (for `references/core/impact-analysis.md`)

When source isn't available for finding an entity's consumers via grep:

1. Perform the target change (create/edit/delete/deactivate) on one
   screen; capture the resulting entity's id/name from that screen's own
   API response.
2. Read the app's navigation DOM to enumerate its other major sections.
3. Visit each; watch network responses (and rendered text) for that same
   id/name appearing. A hit is a consumer surface — apply
   `references/core/impact-analysis.md`'s verification matrix to it exactly as you would
   with a source-discovered one.

This will under-find relative to source-based discovery: a consumer
surface that only displays a *derived* value (never the literal id/name)
won't turn up this way. Say so in the report rather than implying the
sweep was exhaustive.

## Self-provisioned execution tooling (MANDATORY for web)

**Playwright is ALWAYS installed and used for web testing.** This is not
optional. The target project's own test framework (Cypress, Jest, etc.)
is noted but never used as a substitute.

### Mandatory Playwright Setup (every run, no exceptions)

```bash
# Step 1: Create scratch location
mkdir -p ~/.qa-bug-hunter/playwright
cd ~/.qa-bug-hunter/playwright

# Step 2: Initialize project
npm init -y

# Step 3: Install Playwright
npm install @playwright/test

# Step 4: Install Chrome (Chromium) only
npx playwright install chromium

# Step 5: Create playwright.config.ts — Chrome (headed when watched, headless when unattended)
cat > playwright.config.ts << 'EOF'
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: {
    headless: !!process.env.CI || process.env.QA_HEADLESS === '1',  // headed when watched
    browserName: 'chromium',  // Chrome browser
    screenshot: 'on',
    trace: 'on',
    video: 'on',
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
  },
  timeout: 60000,
  retries: 0,
});
EOF
```

**When a human is watching, run headed (`headless: false`) so the window is visible.**
In unattended runs (CI / `QA_HEADLESS=1`) run headless; evidence capture stays on.
When headed, the user sees every action in real-time:
- Browser opens Chrome window
- Navigation to target URL is visible
- Every click, input, form fill is visible
- Screenshots are captured automatically
- The user can intervene or stop at any time

### Why Playwright Always (not the target's framework)

1. **Multi-browser**: Chromium, Firefox, WebKit — three distinct engines
2. **Network interception**: capture/modify API requests
3. **Screenshot/Video/Trace**: built-in evidence capture
4. **DOM access**: direct page evaluation, locator API
5. **No integration needed**: drives any URL, no app-specific setup

### Execution Flow

1. Install Playwright (if not already installed)
2. Navigate to target URL
3. Capture DOM structure
4. If source code provided → read it for constraint analysis
5. If no source → use DOM observation + network traffic
6. Execute all test scenarios using Playwright
7. Capture evidence (screenshots, network logs, console)

### Where it goes

`~/.qa-bug-hunter/playwright/` — a scratch location, never committed
to the target repo. Treat as a session artifact.

### If provisioning fails

Only if `npm install` or `playwright install` fails (no network, no
install permissions) — say so explicitly in the report and fall back
to manual checking. Never silently skip Playwright.
