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

## New here? Start in 5 minutes

You do not need to know anything about this skill beforehand.

**What it is.** A set of instructions plus helper scripts that make an AI
coding tool (Claude Code, Cursor, Codex CLI, Windsurf, Gemini CLI, ...) test
like a careful exploratory tester: form a hypothesis, try to break the app,
prove what you saw with saved files, and say honestly what was *not* covered.

**What you need.** An AI coding tool that can read files and run commands.
Node 18+ only if you want the helper scripts, self-tests or the standalone
agent. Playwright is always the browser engine for web work; the skill
provisions it in a scratch folder (`~/.qa-bug-hunter/playwright`), so your
project needs no changes.

**1. Install (once).**

    git clone https://github.com/MSagiroglu/qa-bug-hunter.git

Link the clone as a skill so your tool reads straight from it (details in
"Using this in Claude Code" below), then restart the tool:

    # Windows (cmd.exe)      mklink /J "%USERPROFILE%\.claude\skills\senior-qa-explorer" "<path-to-clone>"
    # Windows (PowerShell)   New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\senior-qa-explorer" -Target "<path-to-clone>"
    # macOS / Linux          ln -s "<path-to-clone>" "$HOME/.claude/skills/senior-qa-explorer"

**2. Check that the helpers work (optional, 1 minute).** From the clone:

    cd agent && npm install && npx playwright install chromium && cd ..
    node tools/lint-references.mjs
    node tools/selftest/run-selftest.mjs
    node tools/selftest/run-rapid-selftest.mjs

Each should end with `0 finding(s)` / `SELFTEST PASSED` / `RAPID SELFTEST PASSED`.
These prove the helpers on local demo pages; they do not test your product.

**3. Run your first session.** Pick ONE small, risky screen and give a charter,
a one-sentence mission with three parts: *what to explore / with what / to find
what*. In your AI tool:

    /qa-session "Explore the Create form / with empty, very long and rapid repeated submits / to find duplicate records and missing loading states"

(The templates use the Turkish labels "Keşfet … / Şununla … / Bulmak için …";
either language works.) Not sure what to type? Use natural language:
`test the login page for bugs`, or `/qa-explore <module>` for a full sweep.

**4. Read what you get.** The agent writes a one-page summary and, for each
finding, a ticket-ready write-up with its evidence files (screenshots, network
logs, video/trace). Read the **"Kapsanmayan"** (not covered) line first: it
tells you what was *not* checked. Findings are labelled:

| Label | Meaning | What you do |
|---|---|---|
| CONFIRMED DEFECT | an oracle establishes the expected behavior | file it, add a regression test |
| POTENTIAL DEFECT | suspicious, oracle is weak | ask the owner or find a stronger oracle |
| BEHAVIOR REQUIRING CLARIFICATION | might be intentional | ask, do not assert |
| candidate finding | a heuristic fired (e.g. empty submit accepted) | investigate; it is not a verdict |
| TEST GAP | not covered | schedule it |

**5. Repeat with a new charter.** Ideas noticed during a session go to the
charters backlog; each becomes the next session.

**Rules of the road (read these once).**
- Test only environments you are allowed to test. Never run load, injection or
  rapid-click bursts on production or on a shared environment without approval.
- Use data the run creates (`TEST_...`) and two test users of your own for
  permission checks. Existing data is read-only.
- Credentials: you log in yourself or supply them through environment
  variables. The skill never writes secrets into the repo or reports.
- A human watching the run means headed browser; unattended or CI means
  headless (`CI` or `QA_HEADLESS=1`). Playwright is used in both.
- Everything the skill derives from reading source code is a candidate until
  it is reproduced and confirmed with evidence.

### Prompts that work

| You want | Say |
|---|---|
| A modal that will not close, background scrolls | `/qa-session "Explore the <name> modal / with keyboard, small viewport and scroll / to find close, focus and scroll-lock failures"` |
| Double-click / loading-state bugs | `Run the rapid-action burst on every create, update and delete in <module>` |
| Who can do what | `Build a role x endpoint authorization matrix for <module> using my two test users` |
| Something with no spec | `Use metamorphic or differential checks on <feature>` |
| API only | `Test <endpoint list> as API-only` |
| Under load | `Plan a load check for <module>; dry-run first` (needs an allowlisted target) |
| What did we miss | `Run the second-opinion pass on the findings and list what was not covered` |

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
  *(Illustrative account from earlier development runs; no evidence
  artifacts from it are shipped in this repository.)*
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
- **Data collision and authorization defects** — duplicates accepted despite
  uniqueness constraints and access across authorization boundaries (IDOR),
  tested only with data the run created and two test users of your own;
  existing data is treated as read-only.
- **Double-submit and missing in-flight guards** — fast repeated clicks on
  create/update/delete: is there a loading state, is the control blocked
  until the request returns, does the same API request go out twice, are
  duplicate records created, does a second delete fail cleanly.
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

## What changed in this release (October 2026)

An independent assessment of the previous version scored it **68/100** against
ISTQB CTFL 4.0 and the exploratory-testing literature (see `docs/evaluation/`).
This release closes most of the gaps it found. A fresh, independent reviewer
(a separate model instance, same rubric, previous scores hidden until after it
scored) re-scored it at **92/100**; see `docs/evaluation/2026-10-14-rescore.md`,
and `docs/evaluation/2026-10-14-readme-audit.md` for a claim-by-claim audit of
this README. Read the +24 as indicative, not precise: the two scores come from
different reviewers without calibration, and nothing was run against a
production-like application (see "How it maps to the literature" below).

- **Structure:** one core engine, platform lenses (web, mobile, API), UI
  invariants, load method, and optional private domain packs.
  `SKILL.md` is now a router that picks mode, lenses and pack.
- **Session mode:** charter, 60-minute timebox, tagged notes, one-page summary
  with a mandatory "not covered" line, charters backlog.
- **New techniques:** risk register and assumptions register, rapid-action
  (double-submit / in-flight guard) testing, three-witness API+UI check,
  role x endpoint authorization matrix, metamorphic/differential testing,
  second-opinion pass, heuristics and tours, time/data/concurrency/locale
  dimensions, planning and exit criteria, ISTQB technique mapping and
  principles, overlay/modal invariants (WAI-ARIA dialog).
- **Safety:** active injection testing is reduced to a detection-only posture
  (one benign metacharacter, observe error leakage) behind an authorization
  banner; the XSS payload catalog is gated behind that banner (owned,
  non-shared targets, written authorization) and must never be run on shared
  environments. Load and authorization-matrix tools refuse non-allowlisted
  targets and default to dry-run.
- **Fixes:** assertion-alone "CONFIRMED DEFECT" verdicts became candidate
  findings routed through the oracle; the hygiene-vs-collision contradiction
  was resolved; corrupted characters and a duplicate checklist line removed;
  headed/headless is now "headed when watched, headless when unattended".
- **Standalone agent:** `--domain`/`--repo` pack detection, `overlay`, `api`
  and `rapid` suites, no hardcoded site selectors, reflection is not reported
  as XSS, unsafe browser flags are opt-in.
- **Self-tests:** the overlay and rapid-action helpers are proven on local
  good/bad demo pages; the self-test found and fixed two real helper bugs.
- **Not changed on purpose:** Playwright remains the engine for web work;
  existing Turkish reference files were not translated.

## Modes, lenses and domain packs

**Which mode when**

| Situation | Mode | How to start |
|---|---|---|
| New feature, first look, "what could break?" | Session | `/qa-session "<charter>"` |
| Systematic pass over a module before release | Sweep (default) | `/qa-explore <module>` |
| No UI in scope, or API is the main risk | API-only | "test <endpoints> as API-only" (no browser needed) |
| Capacity, throttling, behavior under load | Load | dry-run first; needs an allowlisted target and approval |

- **Lenses:** `references/lenses/` for web, mobile and API, plus
  `six-directions.md` (Interrupt, Network, Screen/Shape, State, Data,
  Permission). When stuck, pick one direction and go deep instead of running
  every check.
- **Core techniques:** see the file list below; each is a short reference the
  agent reads only when the target needs it.
- **Domain packs (optional, private):** product-specific knowledge (modules,
  roles, safety rules, generated inventories) lives OUTSIDE this repo in
  `QA_DOMAIN_PACKS_DIR` or `%USERPROFILE%\.qa-bug-hunter\domains\`
  (`~/.qa-bug-hunter/domains/` on macOS/Linux). A pack is detected
  automatically when the `Markers:` listed in its `pack.md` exist in the repo
  being tested. No pack means the skill still works. Never commit a pack.
- **Self-tests:** `node tools/selftest/run-selftest.mjs` (overlay helper) and
  `node tools/selftest/run-rapid-selftest.mjs` (rapid-action helper).
- **Evaluation:** `docs/evaluation/` holds the scored assessment and gap backlog.

**Create your own domain pack** (for the product you test every day):

1. Copy `references/domains/_template/` to
   `<packs-dir>/<your-product>/`.
2. In `pack.md`, set `Markers:` (paths that exist at the product repo root,
   e.g. a solution file and a test-id folder) and the reading order.
3. Fill `roles.md` (roles and contextual authorities), `modules.md` (modules to
   routes/controllers/test ids), `env-safety.md` (shared environments,
   throttling, what must be mocked).
4. Optionally add a role x module x action matrix, a settings impact map and a
   charters backlog. Mark every claim you did not verify as `?` or
   `unverified`; a static reading of code gives candidates, not defects.
5. Keep it out of version control. Re-verify evidence references when the
   product changes.

**Safety in one place**
- Active injection/XSS material is out of default scope: it needs written
  authorization on an owned, non-shared target.
- Load tooling and the authorization-matrix runner require an allowlisted
  target, send nothing in dry-run mode and respect request budgets.
- Rapid-action bursts are capped and use only data created by the run.
- Never place credentials in the repo, in evidence files or in reports.

## How it maps to the literature

Taken from the independent re-score (`docs/evaluation/2026-10-14-rescore.md`).
"Covered" means a reference file or phase implements it; it does not mean it was
validated on a production system.

**ISTQB CTFL 4.0 areas**

| Area | Status | Where |
|---|---|---|
| 7 principles | Covered | `references/core/principles.md` |
| Planning, monitoring and control, completion/exit criteria, traceability | Covered | `references/core/planning-and-completion.md` |
| Analysis, design, execution | Covered | `SKILL.md` phases 1-4, `test-design-techniques.md` |
| Test implementation (environment/suite build) | Partial | implied in phase 4 and templates, not a named activity |
| Equivalence partitioning, boundary values, decision table, state transition, use case, pairwise | Covered | `test-design-techniques.md` (with an ISTQB cross-reference table) |
| White-box concepts | Partial | offered as a code-reading lens (which branches does no test exercise), not measured coverage, by design |
| Experience-based (error guessing, exploratory, checklist), collaboration-based | Covered | `test-design-techniques.md`, session mode |
| Risk-based (likelihood x impact, product vs project risk) | Covered | `references/core/risk-register.md` |
| Defect management and independence | Covered | `defect-classification.md`, `second-opinion.md` |
| Tool support | Covered | Playwright, k6, standalone agent, helper self-tests |

**Exploratory-testing literature**

| Source | Status |
|---|---|
| Kaner (oracles), J. Bach (session-based test management), Whittaker (tours), Hendrickson (heuristics), property-based testing | Covered |
| Weinberg, Myers, chaos/resilience framing | Partial (spirit present, not cited or not framed that way) |
| Beizer bug taxonomy, Crispin-Gregory agile testing quadrants, test pyramid | Not covered |

**Known limits (stated plainly)**
- Nothing here was exercised against a production-like application; helpers are
  proven only on local good/bad demo pages. Findings derived from reading code
  are candidates until reproduced.
- Some reference files are in Turkish on purpose (this repository is also used
  by a Turkish-speaking team): session mode, charters, parts of the test-design
  and attack catalogs. A reader or agent that does not read Turkish loses that
  content.
- `PORTABLE.md` is a hand-maintained snapshot and is stale; `SKILL.md` is
  authoritative.
- Mobile has guidance but no runnable harness like the web helpers; mobile
  black-box exploration is a known gap.
- "Playwright is always provisioned" is the intent; an AI agent cannot
  guarantee it, so the skill requires it to say so when provisioning fails.

## Standalone Agent (NEW)

The QA Bug Hunter is now also a **standalone CLI agent** that can run
independently without any AI coding tool. It is a **smoke-test harness**,
not a universal tester: the input/security suites discover a search box by
role/type/placeholder, and when none is found the test is reported as
`skipped: no target element` (some sites need per-site selector
configuration in `agent/src/lib/executor.ts`). Findings are heuristic: XSS is a
`fail` only when a dialog or execution flag is observed (reflection alone is a
`warning`), SQL-error detection is keyword-based (low confidence), and every
ticket carries an oracle and confidence field. Browser web security stays on
unless you pass the opt-in `--insecure` flag. Use the skill for judgment-heavy
testing.

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

# Overlay and API suites, domain pack (optional)
node dist/cli.js test --url http://localhost:3000 --suites overlay,api --domain <name> --repo <path>
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
- **Headed Mode:** Tests run in full-screen headed mode by default; headless automatically when `CI` or `QA_HEADLESS=1` is set
- **Evidence Collection:** Screenshots and video for every test
- **Jira-Ready Tickets:** Formatted tickets with steps, actual/expected, evidence
- **Technical Details:** JSON details for each test result

### Output

Reports are saved to `docs/qa-reports/<date>/`:
- `report.markdown` — Full test report with video link
- `tickets/tickets.md` — Jira-format tickets for failures
- `evidence/` — Screenshots and evidence files

## 🇹🇷 Türkçe Kullanım Rehberi

### Hızlı Başlangıç (Skill'i Hiç Bilmeyenler İçin)

1. **Kur:** depoyu klonla, `~/.claude/skills/senior-qa-explorer` yoluna bağla
   (aşağıdaki "Claude Code ile Kullanım"), aracı yeniden başlat.
2. **Yardımcıları doğrula (isteğe bağlı):**
   `cd agent && npm install && npx playwright install chromium && cd ..`, sonra
   `node tools/lint-references.mjs`, `node tools/selftest/run-selftest.mjs`,
   `node tools/selftest/run-rapid-selftest.mjs`. Çıktılar `0 finding(s)`,
   `SELFTEST PASSED`, `RAPID SELFTEST PASSED` olmalı.
3. **İlk oturum:** küçük ve riskli tek bir ekran seç, üç parçalı bir görev yaz:
   *Keşfet ne / Şununla ne / Bulmak için ne.*

       /qa-session "Keşfet: Kayıt oluştur formu / Şununla: boş, çok uzun girdi ve hızlı art arda tıklama / Bulmak için: çift kayıt ve eksik loading durumu"

   Ne yazacağını bilmiyorsan: `login sayfasını test et` ya da tam tarama için
   `/qa-explore <modül>`.
4. **Çıktıyı oku:** önce **"Kapsanmayan"** satırına bak (neye bakılmadığı).
   Bulgular `CONFIRMED DEFECT`, `POTENTIAL DEFECT`, `BEHAVIOR REQUIRING
   CLARIFICATION`, aday bulgu (sezgisel, hüküm değil) ve `TEST GAP` olarak
   etiketlenir. Aday bulguyu yeniden üret ve kanıtla, sonra raporla.
5. **Yeni görev:** oturumda fark edilen fikirler charter backlog'una gider,
   her biri bir sonraki oturum olur.

**Kurallar:** yalnızca test etmeye yetkili olduğun ortamlarda çalış; prod ve
paylaşımlı ortamda onaysız yük, enjeksiyon veya hızlı tıklama yapma; yalnızca
oturumun kendi oluşturduğu `TEST_` verisini ve kendi iki test kullanıcını
kullan; mevcut veri salt okunurdur; giriş bilgilerini sen girersin veya ortam
değişkeniyle verirsin; kimse izliyorsa headed, gözetimsiz/CI ise headless
(`CI` veya `QA_HEADLESS=1`), Playwright ikisinde de kullanılır.

**Hızlı tıklama / çift gönderim testi:** her ekleme, güncelleme ve silmede
eylemi önce 2, sonra 5 kez hızlı tekrarla. Loading göstergesi var mı, istek
dönene kadar buton kilitleniyor mu, aynı API isteği birden fazla gidiyor mu,
çift kayıt oluşuyor mu, ikinci silme temiz hata veriyor mu? Ayrıntı:
`references/core/rapid-action-testing.md`.

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
```bat
:: Windows (cmd.exe) — mklink bir cmd komutudur, PowerShell'de çalışmaz
mklink /J "%USERPROFILE%\.claude\skills\senior-qa-explorer" "<klon-yolu>"
```

```powershell
# Windows (PowerShell)
New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\senior-qa-explorer" -Target "<klon-yolu>"
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
example.test'yi exploratory test et
login modülünü test et, hataları bul
```

Veya explicit komut ile:
```
/qa-explore example.test
/qa-explore login-page
```

### Doğal Dil ile Kullanım (hangi AI aracı olursa olsun)

AI aracına doğrudan söyle:
```
app.example.test'i test et
```

Veya:
```
app.example.test'i exploratory test et, bulgu raporu çıkar
Login sayfasını test et, XSS açığı bul
Responsive test et, mobil uyumluluğu kontrol et
```

### Cursor / Windsurf / Codex CLI ile Kullanım

Proje kökünde `AGENTS.md` oluştur:
```markdown
## Exploratory QA testing

For exploratory / bug-hunting test requests on this repo, read and follow:

    <klon-yolu>/SKILL.md
```

Sonra doğal dilde:
```
test the login page for bugs
login modülünü test et
```

### Terminal'den (AI Gerektirmez)

```bash
cd <klon-yolu>/agent

# Tam test
node dist/cli.js test --url https://app.example.test

# Headless (CI/CD için)
node dist/cli.js test --url https://app.example.test --headless

# Sadece DOM analizi
node dist/cli.js analyze --url https://app.example.test
```

### Örnek Kullanım Komutları

| Komut (Doğal Dil) | Ne Olur |
|-------------------|---------|
| `app.example.test'i test et` | Tam exploratory test |
| `XSS açığı bul` | Güvenlik testleri odaklı |
| `Responsive test et` | Mobil/tablet uyumluluk |
| `Accessibility kontrol et` | Erişilebilirlik testleri |
| `Login sayfasını test et` | Modül bazlı test |
| `Hata bul, ticket çıkar` | Bulgu + Jira ticket |

| Komut (Claude Code) | Ne Olur |
|---------------------|---------|
| `/qa-explore example.test` | URL bazlı test |
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

Router and rules
- `SKILL.md` — router and the phases: picks mode, lenses and domain pack.
- `ENFORCEMENT.md` — checklist that must be completed before and after a run.
- `PORTABLE.md` — frozen snapshot of the methodology for tools that cannot
  read files (`SKILL.md` is authoritative where they differ).

`references/core/` — platform-neutral engine
- Discovery and design: `discovery.md`, `blackbox-discovery.md`,
  `impact-analysis.md`, `test-design-techniques.md` (ISTQB techniques and
  mapping), `input-mutation-catalog.md`, `search-testing-patterns.md`,
  `advanced-exploratory-attacks.md`, `critical-defect-patterns.md`,
  `database-verification.md`, `security-hygiene.md`, `principles.md`.
- Oracles and judgment: `oracle-hierarchy.md`, `metamorphic-differential.md`,
  `heuristics-cheatsheet.md`, `second-opinion.md`.
- Risk and process: `risk-register.md`, `planning-and-completion.md`,
  `session-mode.md`, `charters-backlog.md`, `diff-to-charter.md`.
- Newer techniques: `rapid-action-testing.md`, `perturbation.md`,
  `perturbation-dimensions.md`, `api-ui-crosscheck.md`, `authz-matrix.md`.
- Evidence and reporting: `evidence-capture.md`, `defect-classification.md`,
  `jira-ticket-template.md`, `report-template.md`.

`references/lenses/` — platform specifics
- `web/` (accessibility, i18n, responsive, shadow DOM, XSS patterns),
  `mobile/` (discovery, exploratory considerations), `api/` (API lens,
  backend manipulation tests, active ones behind an authorization banner),
  `six-directions.md`.

Other
- `references/invariants/overlay-dialog.md` — 14 modal/overlay checks.
- `references/load/` — load method, scenarios, assertions, safety gates.
- `references/domains/` — domain pack contract and an empty template.
- `templates/` — report/session/charter/risk templates, Playwright helpers
  (`overlay-invariants`, `rapid-action`, `api-ui-crosscheck`, `authz-matrix`,
  `metamorphic`, `perturb`, `ui-under-load`) and gated k6 load templates.
- `tools/` — `lint-references.mjs` and `selftest/` (helper self-tests).
- `docs/evaluation/` — scored assessment and gap backlog.
- `agent/` — standalone CLI agent (Node.js + Playwright).

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

**Windows (Command Prompt / cmd.exe — `mklink` is a cmd builtin, not PowerShell):**
```bat
mklink /J "%USERPROFILE%\.claude\skills\senior-qa-explorer" "<path-to-cloned-repo>"
```

**Windows (PowerShell):**
```powershell
New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\senior-qa-explorer" -Target "<path-to-cloned-repo>"
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

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| The tool ignores the skill | The link is missing or the tool was not restarted. Check that `~/.claude/skills/senior-qa-explorer/SKILL.md` resolves, then start a new session. |
| `/qa-session` or `/qa-explore` does nothing | Slash commands depend on the tool; say it in natural language instead ("run a QA session on ..."). |
| Browser does not open | Unattended mode is active (`CI` or `QA_HEADLESS=1` set) or Playwright browsers are not installed: `npx playwright install chromium`. |
| Self-test fails to start | Run `cd agent && npm install && npx playwright install chromium` first. |
| `Domain pack: none` but you have a pack | The pack folder is not in the packs directory, or its `Markers:` paths do not all exist at the repo root. Use `--domain <name>` to force it. |
| k6 run is refused | The target is not in the allow file, `LOAD_WINDOW_OK` is not `1`, or credentials are missing. That is the safety gate working. Start with `DRY_RUN=1`. |
| Rapid-action test hit HTTP 429 | The burst consumed the throttle budget. Lower the burst size; a 429 is itself an observation. |
| Many findings marked "candidate" | Intended: a heuristic fired. Reproduce each one and state the oracle before filing. |

## Glossary

- **Charter:** one-sentence mission: explore what, with what, to find what.
- **Session (SBTM):** time-boxed exploratory run with notes and a debrief.
- **Oracle:** the source that says what "correct" is (spec, contract, source,
  consistency with the rest of the app, or a guess). Weak oracle = lower
  confidence.
- **Lens:** platform-specific guidance (web, mobile, API).
- **Domain pack:** private, product-specific knowledge outside the repo.
- **Three witnesses:** UI state, network response and an independent re-read
  must agree after every write.
- **Rapid action:** repeating a create/update/delete quickly to check the
  in-flight guard, loading state and duplicate requests.
- **Candidate finding:** a heuristic fired; not yet a verdict.
- **Kapsanmayan:** "not covered", the mandatory line in every session summary.

## License

MIT — see `LICENSE`. Use it, fork it, adapt it.
