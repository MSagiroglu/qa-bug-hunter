# Test Design Techniques

Use these to decide *what* to test, not to justify testing everything.
Prioritize by risk, business impact, complexity, number of dependencies, and
data-integrity/security implications — a small set of well-chosen scenarios
beats a large set of arbitrary ones.

## Equivalence Partitioning (EP)

Split each input's possible values into partitions that should behave the
same way (valid range, below-range, above-range, wrong-type, empty). Test
one representative value per partition rather than every value in it.

## Boundary Value Analysis (BVA)

For any range found in discovery (min/max from schema, UI constraint, API
contract, or domain semantics), test:

```
min - 1, min, min + 1, max - 1, max, max + 1
```

If no explicit range exists, infer one from the field's DB type, UI
constraint, or domain convention, and **label it as inferred**, not
confirmed — see `references/core/oracle-hierarchy.md`. Don't report an inferred boundary
violation as a confirmed defect.

## Decision Table Testing

Use when a feature's behavior depends on a combination of conditions (e.g.
role + status + date-range). Build a table of condition combinations and
expected actions; test combinations most likely to be under-handled
(usually the ones the implementation's conditional logic doesn't explicitly
branch on).

## State Transition Testing

Use for anything with a lifecycle (draft → submitted → approved → closed,
etc.). Test: valid transitions, invalid/skipped transitions, transitions
attempted twice, and transitions attempted from a stale/cached state
(e.g. after another tab or user changed the state).

## Pairwise / Combinatorial Testing

Use only when a feature has several independent fields that can combine
(e.g. goal type × measurement type × employee role) and testing every
combination is infeasible. Cover each pair of values at least once instead
of the full cross-product.

## Error Guessing

Apply domain experience and the "what could go wrong here" prompts below
after any significant action:

- What happens if this action is performed twice, rapidly, or out of order?
- What happens if the backend receives something the UI normally prevents?
- What happens if a valid value becomes invalid after another field
  changes?
- What happens if the operation partially succeeds (network drop
  mid-request, duplicate submit)?
- What happens on cancel-and-reopen, refresh mid-flow, or browser
  back/forward?

## Use-Case Testing

Use when requirements are written as user goals (actor + main flow +
alternative/exception flows). Derive one scenario for the main success path,
then one per alternative and exception flow (e.g. cancel, validation
failure, permission denied, timeout). Check preconditions and postconditions
explicitly, not just the screens in between.

## White-Box Coverage (review lens)

When source is readable, ask: *which branches does no test exercise?*
Statement coverage asks "was every line run?"; branch coverage asks "was
every true/false outcome of every decision taken?". Use this as a reading
lens to spot untested conditions, error handlers, and else-paths and turn
them into scenarios — not a mandate to instrument or measure coverage.

## Collaboration-Based Testing

When working with a team, derive tests together before building: example
mapping (rule -> concrete examples -> open questions), ATDD/BDD
(Given/When/Then examples agreed as acceptance criteria). Agreed examples
are level-1 oracle input (`references/core/oracle-hierarchy.md`); open
questions are discovery gaps to resolve, not to guess.

## Technique Cross-Reference (ISTQB)

| Technique | Use when |
|---|---|
| Equivalence partitioning | Input has classes of values that should behave alike |
| Boundary value analysis | Ordered ranges/limits exist (stated or inferred) |
| Decision table | Outcome depends on a combination of conditions/rules |
| State transition | Entity has a lifecycle or modes |
| Pairwise | Many independent parameters; full cross-product infeasible |
| Error guessing | Experience-based; after any significant action, to probe likely faults |
| Exploratory | Little/poor specification, time-boxed learning plus testing |
| Checklist-based | Repeatable coverage of known risks (a11y, i18n, security hygiene) |
| Use-case | Requirements expressed as actor goals and flows |

## Responsive / Viewport Testing (web)

For any screen with a viewport-dependent layout, resize/test at minimum:
narrow mobile width (~375px), tablet (~768px), and standard desktop
(~1280px+). At each size, confirm the critical actions for the feature
under test (submit button, validation/error messages, primary CTA) are
still reachable and visible — not clipped, not pushed below the fold, not
hidden behind a collapsed nav that never gets checked. Also check for
horizontal scroll/content overflow, which usually indicates a fixed-width
element that wasn't meant to be there. This is cheap to run (a viewport
resize, not a new device) and frequently uncovers layout defects nobody
uses a debugger to find because they never manually resize the window.

## Cross-Browser Verification (web)

Run the initial exploratory pass in one browser (whatever the target's
config defaults to) — don't multiply every scenario by 4 browsers from
the start, that's cost without signal for most findings. Once a finding
looks rendering/layout/JS-engine-related (visual defects, CSS behavior,
JS API quirks like the one this skill's own dogfooding run hit — an
`<img>` reporting `complete` with `naturalWidth: 0`), verify it across
whatever other browser engines the target's execution tool already has
configured before finalizing severity or classification.

Know what you're actually testing: Chrome and Edge share the same
rendering engine (Chromium/Blink) — running both catches Edge-specific
behavior (its PDF viewer, enterprise policy defaults, some CSS interop
edge cases), not a second independent engine. The real engine diversity
is Chromium, **Firefox** (Gecko), and **WebKit** (Safari's engine) — three
distinct engines, not four. Don't report "reproduced in all 4 browsers"
as if that's 4x the independent evidence a single-engine reproduction
would be; it's closer to 3 (plus one Chromium variant).

**Reuse what's configured, ask before adding what isn't** — same pattern
as the video/trace rule (`SKILL.md` Phase 5): if the target's Playwright
(or equivalent) config already has other browser projects set up (even if
currently commented out/disabled), enabling them costs only run time —
just use them for cross-browser verification of a relevant finding. If
verifying would require installing a new browser engine that isn't
present at all (e.g. `playwright install firefox webkit`), that's a real
setup cost — ask the user first, the same way video/trace capture does,
rather than silently installing browser binaries.

A cross-browser mismatch (bug reproduces in one engine, not another) is
itself worth reporting even when it's not the original finding —
capture which engines it did and didn't reproduce in as part of that
defect's evidence.

## Interrupted-Write / Persistence Verification

See `references/core/critical-defect-patterns.md` — for any feature that writes data, never
classify a write as successful based on the UI's own success signal alone.
Run the interrupted-write scenarios there (refresh mid-write, network drop
timed to the write, double-submit, throttled connection) and verify actual
persistence independently of what the UI displayed.

## Exploratory Testing

After scripted scenarios, spend a bounded amount of effort deviating from
the model: try the workflow in an order a user actually might but the
happy-path spec didn't anticipate. Time-box this — exploratory testing
without a stop condition doesn't converge into a report.

## Negative Testing (cross-cutting)

Apply across all of the above: required fields left empty, wrong data
type, values outside allowed range, values over/under length limits,
duplicate submissions, incomplete form submitted, dependent fields changed
out of order.

## Empty Form Submission Testing

Her formda çalıştırılması gereken en hızlı, en yüksek-yield test.
Backend validasyon gap'lerini bulmanın en temel yolu.

**Uygulama:**
- Tüm alanları boş/varsayılan bırakarak Submit tıkla
- Sadece zorunlu alanları boş bırakarak submit et
- Tüm alanları boşluk ("   ") ile doldurarak submit et
- Dropdown'ları seçimsiz bırakarak submit et
- Tarih alanlarını boş bırakarak submit et

**Sinyal:**
- Submit başarılıysa → aday bulgu (backend validasyon eksik olabilir)
- Hata mesajı yoksa → aday bulgu (kullanıcı bilgilendirilmiyor olabilir)
- Aday bulgu = candidate finding: Phase 4'e göre araştır ve `references/core/oracle-hierarchy.md` ile sınıflandır; CONFIRMED yalnız uygun seviyedeki bir oracle boş/geçersiz değerin reddedilmesi gerektiğini kanıtlarsa
- Backend'de 400/500 varsa → backend validasyon var ama frontend'de mesaj yok

## Bu Koşuda Oluşturulan Veriyle Hata Tekrarı

Bu koşuda oluşturduğun `TEST_*` kayıtlarıyla hata tekrarı. Mevcut veriyi
manipüle etme; yalnız oku.

**Kurallar (hijyen):**
- Mevcut veri yalnız OKUNUR; değiştirilmez, silinmez.
- Duplicate/çarpışma testleri yalnız bu koşuda oluşturulan `TEST_*` kayıtlarıyla yapılır.
- IDOR testleri iki kendi test kullanıcısıyla yapılır; gerçek kullanıcı verisi hedeflenmez.
- "Mevcut veriyle" yazma hedefi seçilmez.

**Uygulama (yalnız `TEST_*` kayıtlarıyla):**
- Referans alınan bir `TEST_*` kaydını silmeye çalış
- Bir `TEST_*` kaydını başka bir `TEST_*` kaydının duplicate ismiyle güncellemeye çalış
- Silinmiş/deaktif edilmiş bir `TEST_*` kaydını referans alan yerlere ekleme yapmaya çalış
- Bir test kullanıcısının email'ini diğer test kullanıcısına atamaya çalış
- A test kullanıcısının kaydını B test kullanıcısıyla değiştirmeye çalış (IDOR)
- Sistem/bootstrap kayıtları için yalnız gözlem yap

## Type Confusion Attacks

Her alana beklenmeyen veri tipini gönder.

**Uygulama:**
- Sayısal alanlara: harf, emoji, Unicode, bozuk karakter
- Tarih alanına: sayı, harf, 100 yıl sonrası, 1900 öncesi
- Email alanına: URL, telefon numarası, script tag
- Dropdown'a: HTML injection, script injection
- Boolean alanlara: "true", "false", 0, 1, "", null
- ID alanlarına: negatif, sıfır, decimal, harf karışımı

## Concurrent Access Testing

Aynı anda birden fazla istemci erişimi testleri.

**Uygulama:**
- Aynı kaydı iki farklı sekmede aç ve ikisini de güncelle
- API ile aynı anda create + delete yap
- Kullanıcı rolünü değiştirirken aynı anda veri erişimi
- Import devam ederken aynı tabloyu sorgula
- Batch operation devam ederken tekil kayıt değiştir

## API Contract Violations

API'yi sözleşmeye aykırı kullanma.

**Uygulama:**
- Zorunlu alanları eksik gönder
- Fazla alan gönder (unknown fields → mass assignment)
- Yanlış tipte değerler (string yerine array)
- Null değer gönder (boşluksuz)
- Bozuk JSON
- Wrong Content-Type
- Missing Authorization header
- Expired token
- Wrong HTTP method (GET yerine POST)

## Prioritization

Before executing, rank candidate scenarios by:

1. **Empty form submission** — always run, zero cost, highest yield
2. **Data collision** — run using only `TEST_*` data created in this run
3. Business impact if broken (data integrity, money, permissions > cosmetic)
4. **Type confusion** — fast, high defect detection rate
5. **API contract violations** — backend validation gap detection
6. Complexity / number of dependencies (more moving parts → more likely to
   have an untested interaction)
7. Whether frontend and backend validation appear to diverge (see
   `references/core/discovery.md` §3 — this is the highest-yield signal)
8. **Race condition/concurrent** — critical, harder to reproduce
9. Security implications (authorization, data leakage between users)

Execute the top of that ranking first. Stop generating more scenarios once
you're producing variations that don't change the risk profile.
