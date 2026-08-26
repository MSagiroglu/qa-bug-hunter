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
  check what's actually in the database). When a database connection is
  already available, it queries it directly instead of trusting an API
  re-fetch that could share the same bug as the thing it's checking.
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
- **Accessibility gaps** — missing alt text, unlabeled form inputs,
  keyboard traps, broken focus management in modals. Found by accident
  once (see below) and now checked on purpose, once per screen.
- **i18n/localization defects** in multi-language apps — text overflow in
  longer translations, locale-wrong date/number/currency formatting,
  half-done RTL layouts, pluralization edge cases.
- **Observational security hygiene issues** — API responses exposing
  fields a role shouldn't see, error responses leaking stack traces, a
  missing HTTP→HTTPS redirect. Passive only: this reads traffic the run
  already produces, it never crafts attack input — that's a different,
  separately-authorized kind of engagement, not this skill.
- **Empty submission defects** — forms that accept all-empty input and
  persist to database, missing backend validation entirely. The fastest
  way to find backend validation gaps with zero effort.
- **Existing data collision defects** — system data that can be deleted
  despite downstream references, duplicated despite uniqueness constraints,
  or accessed across authorization boundaries (IDOR).
- **Type confusion defects** — non-numeric values in numeric fields, HTML
  in plain text fields, script tags in input fields, wrong data types
  causing crashes or data corruption.
- **Race condition defects** — lost updates from concurrent editing,
  duplicate records from parallel creation, inconsistent state from
  simultaneous operations.
- **API contract violations** — mass assignment via unknown fields, missing
  required field validation, wrong Content-Type handling, null vs empty
  distinction failures.
- **Copy-paste and Unicode defects** — HTML injection via rich-format
  pasting, layout breaks from emoji/RTL text, truncation from null bytes,
  normalization issues creating duplicate representations.

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

For every confirmed defect, it also asks whether to lock it in as a
permanent regression test in your existing suite — finding a bug once and
writing it up is half the job; making sure it can't come back silently is
the other half.

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

## Recently added

A previous version of this README carried a "what I'd add next" wishlist
of five gaps found by reviewing the skill the way a senior QA/dev hybrid
would. All five are now built: accessibility checks (prompted by a real
find — the dogfooding run's five broken images all had `alt=""`, and
nothing was checking for that on purpose), a database-level verification
tier for persistence claims stronger than an API re-fetch, i18n/
localization checks, observational (non-pentest) security hygiene, and a
rule to offer permanent regression coverage for every confirmed defect
instead of just reporting it once.

No specific gap is queued right now. The architecture (one reference
file per concern, wired into the existing seven phases) is built to take
the next one whenever it turns up — issues and PRs welcome.

## Standalone Agent (NEW)

The QA Bug Hunter is now also a **standalone CLI agent** that can run
independently without any AI coding tool. It uses Playwright to test
web applications and generates reports automatically.

### Advantage

| Feature | Skill (AI Agent) | Standalone Agent |
|---------|------------------|------------------|
| Requires AI tool | Yes (Claude, Cursor, etc.) | No |
| Runs independently | No | Yes |
| Automated CI/CD | No | Yes |
| Scheduled runs | No | Yes |
| No AI cost | No | Yes |
| Full AI reasoning | Yes | No |

**Use the Skill when:** You need AI to understand context, reason about
business logic, and make judgment calls.

**Use the Agent when:** You need fast, repeatable, automated testing
without AI costs — CI/CD pipelines, nightly regression runs, quick
smoke tests.

### Installation

```bash
# Clone the repository
git clone https://github.com/MSagiroglu/qa-bug-hunter.git
cd qa-bug-hunter/agent

# Install dependencies
npm install

# Build
npm run build
```

### Usage

```bash
# Basic test
node dist/cli.js test --url https://example.com

# Headless mode (for CI/CD)
node dist/cli.js test --url https://example.com --headless

# Custom timeout
node dist/cli.js test --url https://example.com --timeout 120000

# DOM analysis only
node dist/cli.js analyze --url https://example.com
```

### Test Suites

| Suite | Tests | What it checks |
|-------|-------|----------------|
| Security | 3 | XSS (10 payloads), SQL Injection (10 payloads), HTML Injection (8 payloads) |
| Input | 5 | Empty submit, Long strings (up to 50K), Special chars, Unicode, Type confusion |
| Responsive | 3 | Mobile (375px), Tablet (768px), Desktop (1920px) |
| Accessibility | 3 | Alt text, Form labels, Heading hierarchy |
| Navigation | 2 | Broken links (internal only), Console errors |

### Features

- **Video Recording:** Every test session is recorded
- **Headed Mode:** Tests run in full-screen headed mode by default
- **Evidence Collection:** Screenshots and video for every test
- **Jira-Ready Tickets:** Formatted tickets with steps, actual/expected, evidence
- **Technical Details:** JSON details for each test result

### Output

Reports are saved to `docs/qa-reports/<date>/`:
- `report.markdown` — Full test report with video link
- `tickets/tickets.md` — Jira-format tickets for failures
- `evidence/` — Screenshots and evidence files

## 🇹🇷 Türkçe Kullanım Rehberi

### Kurulum

```bash
# 1. Depoyu klonla
git clone https://github.com/MSagiroglu/qa-bug-hunter.git
cd qa-bug-hunter

# 2. Agent'ı kur (terminalde test etmek için)
cd agent
npm install
npm run build
cd ..
```

### Skill Nedir?

Skill, AI araçlarına test metodolojisini öğretir. Siz natural language ile "test et" dersiniz, AI aracınız SKILL.md'yi okuyarak:
1. Keşif yapar (Discovery)
2. Test senaryoları tasarlar
3. Testleri çalıştırır
4. Kanıtları toplar
5. Rapor ve ticket oluşturur

### Claude Code ile Kullanım

**Adım 1: Skill'i kur**
```powershell
# PowerShell'de çalıştır (Windows)
mklink /J "%USERPROFILE%\.claude\skills\senior-qa-explorer" "C:\Users\musta\Desktop\Sn-QA-Bug-Hunter"
```

```bash
# macOS / Linux
ln -s "/path/to/qa-bug-hunter" "$HOME/.claude/skills/senior-qa-explorer"
```

**Adım 2: Claude Code'u yeniden başlat**

**Adım 3: Test ettir**

Doğal dil ile:
```
test the login page for bugs
amazon.com.tr'yi exploratory test et
login modülünü test et, hataları bul
```

Veya explicit komut ile:
```
/qa-explore amazon.com.tr
/qa-explore login-page
```

### OpenCode (Bu Araç) ile Kullanım

Doğrudan bana söyle:
```
Amazon.com.tr'yi test et
```

Veya:
```
Amazon.com.tr'yi exploratory test et, bulgu raporu çıkar
Login sayfasını test et, XSS açığı bul
Responsive test et, mobil uyumluluğu kontrol et
```

### Cursor / Windsurf / Codex CLI ile Kullanım

Proje kökünde `AGENTS.md` oluştur:
```markdown
## Exploratory QA testing

For exploratory / bug-hunting test requests on this repo, read and follow:

    C:\Users\musta\Desktop\Sn-QA-Bug-Hunter\SKILL.md
```

Sonra doğal dilde:
```
test the login page for bugs
login modülünü test et
```

### Terminal'den (AI Gerektirmez)

```bash
cd C:\Users\musta\Desktop\Sn-QA-Bug-Hunter\agent

# Tam test
node dist/cli.js test --url https://www.amazon.com.tr

# Headless (CI/CD için)
node dist/cli.js test --url https://www.amazon.com.tr --headless

# Sadece DOM analizi
node dist/cli.js analyze --url https://www.amazon.com.tr
```

### Örnek Kullanım Komutları

| Komut (Doğal Dil) | Ne Olur |
|-------------------|---------|
| `Amazon.com.tr'yi test et` | Tam exploratory test |
| `XSS açığı bul` | Güvenlik testleri odaklı |
| `Responsive test et` | Mobil/tablet uyumluluk |
| `Accessibility kontrol et` | Erişilebilirlik testleri |
| `Login sayfasını test et` | Modül bazlı test |
| `Hata bul, ticket çıkar` | Bulgu + Jira ticket |

| Komut (Claude Code) | Ne Olur |
|---------------------|---------|
| `/qa-explore amazon.com.tr` | URL bazlı test |
| `/qa-explore login` | Modül bazlı test |

| Komut (Terminal) | Ne Olur |
|------------------|---------|
| `node dist/cli.js test --url URL` | Hızlı otomatik test |
| `node dist/cli.js test --url URL --headless` | Arka plan testi |

### Ne Zaman Ne Kullanılır?

| Durum | Kullanım |
|-------|----------|
| Hızlı test istiyorsan | Bana söyle (SKILL.md) |
| CI/CD'de otomatik istiyorsan | Agent (`node dist/cli.js`) |
| Gece test etsin istiyorsan | Agent + cron |
| AI maliyeti olmasın istiyorsan | Agent |
| Akıllı kararlar versin istiyorsan | Bana söyle (SKILL.md) |

---

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
- `references/advanced-exploratory-attacks.md` — senior QA attack vectors:
  empty form submission, existing data collision, type confusion, copy-paste
  attacks, Unicode edge cases, concurrent access, API contract violations.
- `references/mobile-exploratory-considerations.md` — mobile-specific
  error-guessing (lifecycle, connectivity, permissions, deep links,
  biometrics, device fragmentation).
- `references/critical-defect-patterns.md` — ghost-success/persistence
  verification and the interrupted-write scenarios to run it against.
- `references/database-verification.md` — using a database connection
  (when one's already available) as a stronger persistence oracle than
  an API/UI re-fetch — read-only, always.
- `references/accessibility-checks.md` — the a11y pass run once per
  screen: alt text, labels, keyboard reachability, focus management,
  heading hierarchy, contrast.
- `references/i18n-checks.md` — text-overflow, locale-formatting, RTL,
  and pluralization checks for multi-language apps.
- `references/security-hygiene.md` — observational (non-pentest)
  security checks: response overexposure, error-message leakage,
  transport/cookie basics. Explicitly scoped away from anything
  resembling penetration testing.
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
- `agent/` — Standalone CLI agent (Node.js + Playwright).

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
