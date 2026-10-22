# Parity Sweep (old implementation vs new implementation)

Use when the same product exists twice over one backend or one dataset: a legacy front-end and its rewrite, web and mobile, a migrated module and the original. The old side is the **reference**, the new side is **under test**. This is the strongest oracle available short of a written spec (`references/core/oracle-hierarchy.md`: an existing, accepted product behavior), so most findings can be CONFIRMED instead of POTENTIAL.

Mode name in the report header: `Mode: Parity (Sweep variant)`. Everything in `SKILL.md` Phases 1-7 still applies; this file adds what is specific to two sides.

## 1. Setup

1. Name the two sides and the environment each one is served from. State which is the reference and which is under test. Verify the mapping (which build runs where) from the repo or deploy config, never from memory. Testing a build against the wrong backend gives misleading results.
2. Confirm whether both sides share data. If they do, one fixture serves both and every difference is a front-end difference. If they do not, create equal fixtures on both.
3. Log in with the same role on both sides. For role chains (employee -> manager -> admin) use the product's own impersonation or two own test users; never real users' data.
4. Attach to an already logged-in browser session when one exists (`references/core/automation-reliability.md`); never type credentials into forms.

## 2. Procedure per screen or flow

1. Build the fixture **once**, fresh and disposable (`TEST_` names), so neither side is influenced by leftovers of earlier scenarios.
2. Run the same steps on both sides in the same order. Capture for each: screenshot, network calls (method, URL, status, request body, content type), console, and the persisted result by an independent re-read (`references/core/api-ui-crosscheck.md`).
3. Compare along five axes:
   - **Function**: same actions available, same validation, same outcome.
   - **Data**: same numbers, labels, dates, ordering, empty values.
   - **Visual**: layout position, icons, colors, button style and size, spacing, truncation, overflow. Large differences only; do not file faint color shades.
   - **Feedback**: toasts, error text, loading states, disabled states.
   - **Network**: same endpoint, verb and payload shape; request count per action.
   - **Controls**: for every dropdown, multi-select and autocomplete compare option content and structure (secondary text, order, empty state, default), run the same search terms on both sides, and repeat the multi-select with 1, 6 and select-all (`references/lenses/web/select-controls.md`).
4. Classify every difference with the table below. Undefined differences are leads, not defects (`references/core/metamorphic-differential.md`): ask whether the difference is intended before escalating.

## 3. Scope classification (decides ticket title, label and environment row)

| Class | Meaning | Title prefix | Environment row |
|---|---|---|---|
| NEW-ONLY | Reference behaves correctly, new side does not | "In the rewrite ..." | New side only |
| BOTH | Both sides show it (pre-existing, or shared backend) | none | Both sides |
| REFERENCE-ONLY | Reference has a defect the new side already fixed | do not file against the rewrite | note in report |
| INTENDED | Documented or confirmed product change | do not file | note in report |

Never file a BOTH defect as a regression of the rewrite, and never leave a shared-backend defect out because "the old one has it too". When unsure, run the step on both sides again from clean data.

## 3b. Coverage matrix (mandatory)

Before comparing anything, build and later report the tab x control x state matrix in `references/core/parity-coverage-matrix.md` (headers, search, every filter, date range, pagination, export file diff, icon-only buttons, row actions, navigation, empty states per tab/filter/search, loading/error, roles incl. direct URL, responsive). Cells not compared are listed as "not tested".

## 4. Mandatory probes that the two-side view makes cheap

- **Round-trip save**: open a record created on the reference side in the new side's editor, change nothing meaningful, save, then read it on both sides. The new editor must not alter fields it does not own (serialization of multilingual values, dates, flags). A stored value that changes shape is a high-yield finding.
- **Cross-surface figures**: any number shown on several screens (score, count, average, total) must agree on both sides and between screens; see `references/core/calculation-verification.md`.
- **Role chain**: the same record viewed as employee, manager and admin on both sides.
- **Wire format**: compare the request content type and body of the same write on both sides; a client that sends a different content type or a bare object instead of an array often fails only on one side.
- **Date/time boundary**: the same end-of-window setting on both sides (`references/core/perturbation-dimensions.md`, "Date vs datetime on the boundary day").

## 5. Evidence for pairs

Follow "Annotated comparison images" in `references/core/evidence-capture.md`. One image per finding, the two sides labeled by environment, never by position alone.

## 6. Reporting

- Report section per class (NEW-ONLY, BOTH, INTENDED, REFERENCE-ONLY) with a counts line.
- Exclude anything already tracked: query the tracker for existing tickets on the module before filing and record the exclusion list in the report (`references/core/jira-ticket-template.md`, "Filing workflow").
- Order NEW-ONLY first by severity, BOTH last and separate.
