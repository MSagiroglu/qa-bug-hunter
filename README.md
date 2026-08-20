# Sn-QA-Bug-Hunter (senior-qa-explorer)

A skill for AI coding agents that turns "test module X" into what a
senior QA engineer would actually do: find out where it breaks, prove it,
and hand you a ticket you can file — not just confirm the happy path
works.

Most agents, told to test something, click through it once and say "looks
good." This skill exists to not stop there. Point it at a feature — a
form, a modal, a whole module, a live URL — and it runs a systematic
pipeline: read the code (or observe the running app if there's no code),
design test scenarios the way ISTQB test-design techniques would, execute
each one as a hypothesis to disprove, collect real evidence when
something looks wrong, and write up every confirmed defect as a
paste-ready ticket with the files to attach already sitting next to it.

## What it actually finds

Not "the button is misaligned." The classes of bug this is built to catch
are the ones that survive normal manual testing because they don't show
up on the happy path:

- **Frontend-only validation gaps.** A rule the UI enforces that the
  backend never checks — meaning anyone bypassing the UI (a direct API
  call, a different client) can violate it. In one real run against a
  production SaaS app's goal-tracking feature, this skill traced a
  boundary-value rule through the frontend source, found the backend
  endpoint had zero corresponding server-side check, and flagged it
  before writing a single line of test code — because it read where the
  constraint actually lived, not just whether the form looked right.
- **Ghost successes.** The UI shows a success toast, but the write never
  actually persisted — or the reverse: it shows an error, but the data
  went in anyway. Neither is visible unless you deliberately verify
  persistence independently of what the screen claims, which this skill
  does for every write-capable feature (refresh mid-save, drop the
  connection mid-request, double-submit, throttle the connection — then
  check what's actually in the database).
- **Ripple-effect defects.** A shared/library record gets created,
  edited, deleted, or deactivated — does every other screen that consumes
  it reflect that correctly? This is the class of bug that only shows up
  when you think past the screen you're looking at.
- **Boundary, equivalence-partition, and negative-input defects** the
  standard way — but only where the actual constraint (type, min/max,
  regex, business rule) was found in source or observed live, never
  guessed.
- **Mobile-specific classes**: state lost on backgrounding, permission
  states other than the one path someone tested, deep links opened into
  the wrong app state, connectivity loss mid-write.
- **Responsive/layout defects** at mobile/tablet/desktop widths nobody
  manually resizes a window to check.
- **Cross-browser rendering/engine defects** — a finding that looks
  rendering- or JS-engine-related gets verified across whatever browser
  engines are available (Chromium, Firefox/Gecko, WebKit/Safari — Edge
  too, though it shares Chromium's engine so it's checked for its own
  quirks, not counted as independent diversity) before being finalized.
  Runs headed when you're watching live, headless for unattended batches.

## What it produces

A markdown report per run (coverage summary, what was tested, what
passed) plus one ticket per confirmed defect in this format:

```
TEST SET ID / TEST CASE ID
Title
📋 Steps to Reproduce
🖼️ Actual Result
🎯 Expected Result
📎 Ekler / Attachments
```

Steps to Reproduce include the verification steps that actually surfaced
the bug (Network tab checks, console errors, cross-account comparisons),
not just the click path. Actual/Expected separate observed fact from
root-cause assessment. Ekler/Attachments lists real files — screenshots,
saved network request/response JSON, console logs, video/trace when
enabled — written to `docs/qa-reports/evidence/<date>-<module>/`, ready
to drag into Jira or any tracker (no ticket-tracker API is assumed).

It never rounds a maybe up to a confirmed bug: every finding states which
oracle it's based on (an explicit spec beats a backend contract beats a
source-code business rule beats "consistent with the rest of the app"
beats a QA guess), and anything below a confident oracle gets filed as
"Behavior Requiring Clarification," not asserted as a defect.

## What it needs from you

As little as possible. It works with:

- **A full source repo**, any stack — it detects what's there (Playwright/
  Cypress/Jest for web; Detox/Appium/Maestro/Patrol/XCUITest/Espresso for
  mobile) and reuses it.
- **Just a URL and credentials**, no source at all — it reads the live
  DOM and network traffic instead of code, and if there's no execution
  tooling reachable, it provisions a minimal throwaway one itself
  (Playwright for web, Appium for mobile) in a scratch location, never
  touching your repo.
- **Anything in between.**

## Honest scope — what this does *not* do

This is a methodology an AI agent follows, not a device lab. It drives
whatever tooling already exists or that it can provision — it does not
open a physical device or a simulator/emulator that isn't already
reachable from wherever it's running. If it can't reach a working
execution path for the target platform, it's required to say so
explicitly rather than quietly downgrading to a source-only pass without
flagging it as incomplete.

## What I'd add next

This is a working system, not a finished one. If I were running this as
an actual QA practice instead of a weekend build, these are the gaps I'd
close next — in the order I'd close them:

1. **Accessibility (a11y) checks.** There's currently no WCAG pass at
   all — no alt-text check, no keyboard-only navigation walk, no focus-
   trap detection in modals, no contrast-ratio check. This isn't
   hypothetical: the dogfooding run against a live public site (see the
   frontend-only-validation example above) turned up broken images with
   empty `alt=""` on every one of them — exactly the kind of thing an
   a11y pass catches automatically and this skill currently just walks
   past. Wiring in something like axe-core wherever Playwright/Cypress is
   already driving the browser is a small addition for a real gap.
2. **A database-level verification tier.** Ghost-success checking
   (`critical-defect-patterns.md`) currently confirms persistence by
   re-fetching through the UI/API. That's good, but it's not the
   strongest possible evidence — if the API layer itself has a caching
   bug, a re-fetch can agree with a wrong UI state and both be wrong
   together. When a test/staging database connection is actually
   available, querying it directly is stronger evidence than going back
   through the same API that might be the thing lying. Right now nothing
   in this skill reaches for that even when it's sitting right there.
3. **Close the loop: offer to lock a confirmed defect in as a regression
   test.** Finding a bug once is half the job — a senior QA instinct is
   to make sure it can't come back silently. This session's own
   dogfooding run did exactly this by hand (wrote a permanent Playwright
   spec for a confirmed finding), but the skill doesn't say to do that
   anywhere — it's not a rule yet, just something that happened to happen
   once.
4. **i18n/localization checks.** The real app this was dogfooded against
   ships 15+ language files. Nothing here checks for text overflow in
   longer translations, locale-correct date/number formatting, or RTL
   layout on the web side (mobile's exploratory-considerations file
   mentions RTL in passing; web has nothing).
5. **Observational security hygiene — not penetration testing.** Staying
   well inside QA territory (no exploitation, no authorization needed
   beyond what testing the app already implies): does an API response
   include fields the current role shouldn't see at all (not a UI-hiding
   problem, a response-body problem), do error messages leak stack
   traces or internal paths, does the app actually enforce HTTPS
   (this session's own dogfooding run happened to hit a correct
   http→https redirect — worth checking for the *failure* case too,
   which is easy to miss when the one example you saw worked).

None of these are built yet. If you want one of them, that's a smaller,
well-scoped addition on top of what's already here — the architecture
(one reference file per concern, wired into the existing seven phases)
is built to take exactly this kind of extension.

## Files

- `SKILL.md` — orchestration: the phases, in order, what to read when.
- `references/discovery.md` — repo/stack discovery checklist (web).
- `references/mobile-discovery.md` — same, for React Native/Flutter/
  native iOS/Android.
- `references/blackbox-discovery.md` — discovery without source access
  (DOM/network observation), plus the rule for provisioning your own
  minimal Playwright/Appium tooling when none exists.
- `references/impact-analysis.md` — ripple-effect testing for shared/
  library entities: consumer-surface discovery and the created/edited/
  deleted/deactivated verification matrix.
- `references/test-design-techniques.md` — ISTQB techniques and how to
  prioritize scenarios by risk instead of maximizing count.
- `references/input-mutation-catalog.md` — mutation menu per semantic
  input type (web forms).
- `references/mobile-exploratory-considerations.md` — mobile-specific
  error-guessing (lifecycle, connectivity, permissions, deep links,
  biometrics, device fragmentation).
- `references/critical-defect-patterns.md` — ghost-success/persistence
  verification and the interrupted-write scenarios to run it against.
- `references/oracle-hierarchy.md` — how to decide what "correct
  behavior" means when there's no spec.
- `references/defect-classification.md` — taxonomy, severity rubric,
  required evidence fields.
- `references/evidence-capture.md` — how evidence actually gets written
  to disk (not just described) for both scripted and interactive tools.
- `references/jira-ticket-template.md` — the per-defect ticket format,
  field-by-field rules, and a worked example.
- `references/report-template.md` — the overall QA report structure.
- `PORTABLE.md` — the entire methodology in one self-contained file, no
  external references — paste it as a system/custom instruction into any
  AI tool that can't read local files.

## Install

```bash
git clone https://github.com/MSagiroglu/qa-bug-hunter.git
cd qa-bug-hunter
```

Put it wherever you keep tools you don't want tied to one project — it's
not meant to live inside a project repo.

## Using this in Claude Code

Claude Code loads skills from `~/.claude/skills/<name>/SKILL.md`. Link
this cloned repo there so Claude Code reads straight from it — one source
of truth, `git pull` updates it everywhere, no copy to keep in sync.

**Windows (PowerShell, run as the same user):**
```powershell
mklink /J "%USERPROFILE%\.claude\skills\senior-qa-explorer" "<path-to-cloned-repo>"
```

**macOS / Linux:**
```bash
ln -s "<path-to-cloned-repo>" "$HOME/.claude/skills/senior-qa-explorer"
```

**No symlink support / don't want one:** just copy the folder to
`~/.claude/skills/senior-qa-explorer` instead — it'll work, you'll just
need to re-copy after pulling updates.

Restart Claude Code (or start a new session) so it picks up the new
skill. Invoke with natural language ("test the Create Goal modal for
bugs") or `/qa-explore <module>`.

## Using this in other AI coding tools

Most agentic coding tools (Cursor, Codex CLI, Windsurf, Gemini CLI) read a
convention file from the *target project* you're working in, not a
global skills folder — so for these, add a short pointer file to each
project where you want this available, pointing at wherever you cloned
this repo. Replace `<path-to-cloned-repo>` with the real path.

**`AGENTS.md`** (repo root — Codex CLI, Windsurf, and others converging
on this standard):
```markdown
## Exploratory QA testing

For exploratory / bug-hunting test requests on this repo, read and follow:

    <path-to-cloned-repo>/SKILL.md

It's stack-agnostic and lives outside this repo — read it from that path,
don't assume its content. For *how* to write/run tests in this repo once
you know what to test, use this repo's own existing conventions/docs.
```

**`GEMINI.md`** (repo root — Gemini CLI): same content as `AGENTS.md`
above.

**`.cursor/rules/qa-explorer.mdc`** (Cursor):
```markdown
---
description: Senior QA exploratory/bug-hunting testing methodology — apply when asked to test a module for bugs or find defects
globs:
alwaysApply: false
---

For exploratory / bug-hunting test requests on this repo, read and follow:

    <path-to-cloned-repo>/SKILL.md
```

For tools with no file-convention support at all (a plain chat UI), paste
`PORTABLE.md` as a custom instruction — it's self-contained.

## Updating

`git pull` in your clone. If you linked (junction/symlink), that's it —
every tool reading through the link sees the update immediately. If you
copied the folder instead, re-copy it. Pointer files in other projects
(`AGENTS.md`, etc.) don't need to change unless you move the clone.

## License

MIT — see `LICENSE`. Use it, fork it, adapt it.
