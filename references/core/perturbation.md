# Perturbation Testing

Take an existing, passing end-to-end flow and inject a fault after (or at) each step. The goal is to find flows that only work on the happy path.

## Algorithm
1. Write the flow as an ordered list of steps (`s1..sn`), each independently runnable, for example open form, fill, submit, confirm.
2. Choose a fault set. Defaults: `offline`, `reload`, `back` (goBack then goForward), `doubleClick`, `slowRoute` (delay a route 3 s).
3. For each fault F and each step index i:
   - start from a clean state (fresh page or fresh data);
   - run steps `s1..s(i-1)` normally;
   - inject F, then run `si`;
   - restore the environment (go online, remove the route delay);
   - run the remaining steps `s(i+1)..sn`;
   - run the oracle check.
4. Record one cell per (step, fault) in the matrix. That is steps x faults runs; keep the fault set small for long flows and prioritize steps that write data.
5. `doubleClick` is applied inside the step itself (use `dblclick` or two rapid clicks); there is no separate injection.

The template is `templates/playwright/perturb.ts`. It takes the step list, the fault list, an optional route glob and delay, and a `verify` callback that is the oracle. The fault catalogue comes from the Interrupt, Network and State directions in `references/lenses/six-directions.md`.

## Oracle
After each run, one of the following must hold:
- the flow completes and exactly one record exists, or
- the flow stops with a clean, understandable error and no record (or a clearly marked draft) exists.

Always a defect:
- two records (duplicate from retry or double click);
- silent loss: the user saw success but nothing was stored, or input vanished without a message;
- a stuck state: spinner forever, disabled button that never recovers, orphaned modal or backdrop;
- a raw stack trace or technical error shown to the user.

Count records through the UI or, preferably, through an independent source (API read or database check), not only from what the page says.

## Reporting matrix
Report one row per step and one column per fault.

| Step | offline | reload | back | doubleClick | slowRoute |
|---|---|---|---|---|---|
| open form | ok | ok | ok | n/a | ok |
| submit | clean error | DEFECT: 2 records | ok | DEFECT: 2 records | ok |
| confirm | ok | silent loss | ok | ok | ok |

For each DEFECT cell attach: the step, the fault, the observed record count, the evidence file and the reproduction order. Classify using `references/core/defect-classification.md` and `references/core/impact-analysis.md`.
