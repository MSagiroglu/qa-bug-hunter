# Heuristics Cheatsheet

Compact prompts for choosing what to check and how to justify a verdict. Named heuristics are fallible aids, not requirements. Every finding still states its oracle level (`references/core/oracle-hierarchy.md`). Mnemonics come from the exploratory-testing literature (M. Bach, J. Bach, M. Bolton, and others); standards are referenced by name only, never by invented clause number.

## 1. FEW HICCUPPS (consistency oracles)

Each letter is a kind of consistency. Disagreement is a hint, not proof. Rows are weak-to-medium oracles unless they map to a documented source.

| Consistency with | Ask | Oracle level (oracle-hierarchy) |
|---|---|---|
| Familiar problems | Does it look like a failure class seen before (off-by-one, stale cache, duplicate submit)? | 9 inference |
| Explainability | Can I explain the behavior to a colleague without hand-waving? | 9 inference |
| World | Does it match real-world facts (dates, units, currency, names)? | 8 domain convention |
| History | Did it behave differently in the previous release or earlier in this session? | 6 existing tests if any, else 7 |
| Image | Does it match the product's brand and quality image? | 7 elsewhere in the app |
| Comparable products | Do similar products behave this way? | 8 domain convention |
| Claims | Does it match what docs, help text, marketing or tickets say? | 1 or 2 |
| User expectations | Would a reasonable user expect this? | 8 or 9 |
| Product | Is it consistent with the same app's other screens and fields? | 7 |
| Purpose | Does it serve the evident purpose of the feature? | 1 if stated, else 9 |
| Statutes | Does it satisfy laws, regulations, standards (accessibility, privacy)? | 2, or 1 when a requirement cites it |

Rule: if the only disagreement is Familiar problems, Image, User expectations or Explainability, report as Potential Defect, not confirmed.

## 2. SFDIPOT (product-element coverage prompts)

Use during Phase 2 to find areas no test idea touches yet.

| Element | Prompt | Example move |
|---|---|---|
| Structure | What is it made of (modules, services, files, DB tables)? | Check each integration seam: UI to API to store |
| Function | What does it do, including error handling and defaults? | List every user-visible action and its failure path |
| Data | What goes in, out, persists? Types, limits, formats | Boundary and empty/null/huge values |
| Interfaces | UI, API, import/export, other systems | Replay a UI action through the API directly |
| Platform | Browser, OS, device, runtime, locale, timezone | Second browser, 320 px viewport, other timezone |
| Operations | Who uses it, how, in what real conditions? | Run as the least-privileged real role |
| Time | Timing, ordering, expiry, concurrency, scheduling | See `references/core/perturbation-dimensions.md` |

## 3. CRUSSPIC STMPL mapped to ISO/IEC 25010

Quality criteria prompts, mapped to the product quality characteristics of ISO/IEC 25010 (edition wording varies; widely known characteristic names are used).

| Criterion | ISO/IEC 25010 characteristic | Quick probe |
|---|---|---|
| Capability | Functional suitability | Does each feature do the job completely and correctly? |
| Reliability | Reliability | Recovers after offline, reload, kill? |
| Usability | Usability | First-time user completes the task without help? |
| Charisma | Usability (user satisfaction) | Does it feel polished or confusing? |
| Security | Security | Passive observation only (section 6.2) |
| Scalability | Performance efficiency | Large lists, long sessions, many records |
| Performance | Performance efficiency | Perceived latency, spinner behavior |
| Installability | Portability | Fresh install, upgrade, uninstall (mobile) |
| Compatibility | Compatibility; Portability | Other browsers, OS versions, co-existing apps |
| Supportability | Maintainability | Are errors diagnosable (ids, messages)? |
| Testability | Maintainability | Stable selectors, seed data, observable state |
| Maintainability | Maintainability | Mostly code review; note only if visible |
| Portability | Portability | Move data or environment between setups |
| Localizability | Portability (adaptability); Usability | Turkish casing, long translations, RTL, date/number formats |

## 4. RCRCRC (regression selection)

When time is short, choose regression checks by these prompts.

| Letter | Prompt |
|---|---|
| Recent | What was just changed or added? |
| Core | What must always work (login, save, pay)? |
| Risky | Which areas are complex or historically buggy? |
| Configuration | What differs by environment, flag, role, locale? |
| Repaired | What was recently fixed (fixes regress and disturb neighbours)? |
| Chronic | What keeps breaking release after release? |

## 5. Tours (one concrete move each)

| Tour | Intent | Web | Mobile | API |
|---|---|---|---|---|
| Feature | Touch every advertised feature once | Click each menu entry, submit each form | Open every tab and setting | Call every documented endpoint once |
| Money | Exercise what the business earns or loses by | Complete the purchase or booking flow, check totals | Run the in-app purchase sandbox flow | Create then total an order; verify amounts |
| Landmark | Visit key waypoints in varied orders | Dashboard, detail, settings, then back | Deep link to landmark screens in odd order | Call list, get, update in shuffled order |
| Back-alley | Use rarely visited corners | Footer pages, old export, admin help | Settings submenus, legal screens | Deprecated or undocumented-but-reachable routes |
| All-nighter | Leave it running a long time | Keep a session open for hours, then act | Background app overnight, return | Hold a token past expiry, then call |
| Saboteur | Make dependencies fail | Block a route, go offline mid-step | Airplane mode mid-request | Force 5xx on the second dependent call |
| Antisocial | Misuse inputs and flow | Empty, huge, Turkish I/i, rapid double submit | Paste huge text, deny permission | Wrong types, nulls, missing fields |
| Supermodel | Judge appearance only | Zoom 200%, dark mode, 320 px, alignment | Rotation, large font | Consistency of response shape across endpoints |

## 6. Standards index (by name)

### 6.1 WCAG 2.2 level AA (checks in `references/lenses/web/accessibility-checks.md`)

| Existing a11y check | WCAG criterion name |
|---|---|
| Images need meaningful `alt` (empty only if decorative) | Non-text Content |
| Inputs have label or aria-label | Labels or Instructions; Name, Role, Value |
| Keyboard reachable and operable | Keyboard |
| No keyboard traps; modal focus in and out | No Keyboard Trap; Focus Order |
| Visible focus when tabbing | Focus Visible; Focus Not Obscured (new in 2.2) |
| Heading hierarchy | Info and Relationships; Headings and Labels |
| Color contrast (verify with real ratio math) | Contrast (Minimum) |
| Zoom 200% and 400% reflow (six-directions Screen/Shape) | Resize Text; Reflow |
| Small tap targets (mobile) | Target Size (Minimum) (new in 2.2) |

WCAG is a published standard, so it is a level 2 oracle for the criteria it covers; severity still reflects real impact.

### 6.2 OWASP resources (passive observation only)

| Resource | Use here | Out of scope |
|---|---|---|
| OWASP WSTG (Web Security Testing Guide) | Vocabulary for what you saw: information leakage, error handling, cookie attributes | Executing its active tests |
| OWASP ASVS (Application Security Verification Standard) | Reference when a requirement cites a level | Verification audits |
| OWASP API Security Top 10 | Name issues seen in normal use (excessive data exposure, object-level authorization symptoms) | Crafting attacks, bypass attempts, fuzzing |

Active security testing is out of scope per `references/core/security-hygiene.md`. Record only what normal feature testing already showed (overexposed fields, leaked stack traces, missing Secure/HttpOnly cookies, no HTTPS redirect). Oracle is usually level 8 unless a security requirement exists.

### 6.3 Nielsen's 10 usability heuristics

| Heuristic | Quick probe |
|---|---|
| Visibility of system status | Spinner, progress, success feedback after save |
| Match between system and real world | Wording a user would use; no raw codes |
| User control and freedom | Cancel, undo, back without losing input |
| Consistency and standards | Same action named and placed the same everywhere (FEW HICCUPPS: Product) |
| Error prevention | Confirm destructive actions; disable impossible choices |
| Recognition rather than recall | Options visible; labels not only placeholders |
| Flexibility and efficiency of use | Shortcuts, defaults, bulk actions |
| Aesthetic and minimalist design | No noise hiding the primary action |
| Help users recognize, diagnose, and recover from errors | Plain-language message with next step |
| Help and documentation | Findable, task-oriented help |

Usability findings rest on level 8 or 9 oracles: report as Potential Defect unless a requirement says otherwise.
