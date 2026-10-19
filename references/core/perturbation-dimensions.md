# Perturbation Dimensions

Four named amplifier techniques: Time travel, Data shape and volume, Concurrency probes, and Locale/Turkish casing. This file consolidates; it does not repeat the flow-fault matrix (`references/core/perturbation.md`) or the six-direction cell lists (`references/lenses/six-directions.md`). Pick the technique here, then run the cell or matrix there. Concurrency thresholds live in `references/load/assertions.md`. State the oracle level (`references/core/oracle-hierarchy.md`) for every finding. Test data must be disposable and follow the project's cleanup rules.

## 1. Time travel

| Technique | Web | Mobile | API | Oracle | Typical defect |
|---|---|---|---|---|---|
| Timezone and DST boundary | Emulate far-offset browser timezones; use dates around the DST switch (the missing and the repeated hour) | Change device timezone and region, relaunch | Send ISO dates with and without offset; compare stored vs returned | Stored instant unchanged; displayed date matches the user's zone (levels 1-3, else 8 world) | Date shifts a day, duplicate or missing 02:30 entry, all-day event moves |
| Clock skew client vs server | Set client clock ahead or behind; act on time-limited items | Change device clock manually | Send client timestamps in the future and past; compare server validation | Server is the source of truth for validity (levels 3-5) | Expired token accepted or valid one rejected; negative durations |
| Token or session expiry while backgrounded | Leave a tab idle past expiry, return, act | Background the app past session lifetime, return | Call with expired and refreshable tokens | Clean re-auth or clear message, no lost input, no stale data (levels 1-2, else 8) | Silent save failure, raw 401 shown, action runs as old user |
| **Date vs datetime on the boundary day** | Configure a window that ends (or a rule that starts) **today**; open the screen at the start, at midday and just before midnight; compare with a window ending tomorrow | Same here | Read the window flag over the API at several times of day | Product rule, else "a date-only end date is valid until the end of that day" (level 8 world, confirm with the owner) | Window closes at the time of day the setting was saved, "ended" shows hours early, one flag compares dates while its sibling compares full timestamps; read the code for `date` vs `datetime` comparisons on the same entity |
| Month-end and leap day | Create items on 28-31 Jan/Feb, 29 Feb, 31st into a 30-day month, year end; "add one month" actions | Same through the date picker | Recurring or due-date calculations via API | Calendar arithmetic of the real world (level 8) or the documented rule | Invalid date errors, due date skipped, week/year mismatch at year boundary |

Combine with the Interrupt and State cells in six-directions (background, expired reset link) and the offline/reload faults from `perturbation.md`.

## 2. Data shape and volume

| Technique | Web | Mobile | API | Oracle | Typical defect |
|---|---|---|---|---|---|
| 0 / 1 / many / huge | Empty list, one row, a full page, thousands of rows | Same, with scroll and memory pressure | Empty collection, single item, max page, large result | Contract and UI states for empty/single/many exist and agree (levels 1-3, 7) | Missing empty state, singular/plural wrong, slow or truncated list without notice |
| Empty vs null vs missing | Clear a field vs never touching it | Same | `""`, `null`, absent key, `[]`, `{}` | Each case handled consistently per contract (level 3) | 500 on null, empty string stored as value, missing key resets other fields on PATCH |
| Deeply nested or long | 10000+ chars, very long single word, nested rich text | Long paste | Deeply nested JSON, arrays of thousands | Rejected cleanly or handled within a stated limit (level 3, else 8) | Layout break, timeout, stack trace, silent truncation |
| Pagination extremes | Go to last page then delete items; page beyond end | Infinite scroll to the end | `page=0`, `-1`, `999999`, `pageSize=0`, `100000` | Defined bounds and consistent totals (level 3) | Duplicate or skipped rows across pages, total mismatch, unbounded pageSize accepted |

Concrete value lists: Data and Screen/Shape rows of six-directions; mutation sets: `references/core/input-mutation-catalog.md`.

## 3. Concurrency probes

| Technique | Web | Mobile | API | Oracle | Typical defect |
|---|---|---|---|---|---|
| Double-submit | Double click, Enter plus click, resubmit after slow response | Rapid taps on the submit control | Two parallel identical requests | Exactly one record, counted independently (assertions.md) | Duplicate records, double charge |
| Lost update | Edit the same record in two tabs, save both | Edit on two devices | Two parallel PUT/PATCH; stale `ETag` in `If-Match` | Conflict detected (409/412) or documented (assertions.md; level 3) | Last write silently wins, first editor's field erased |
| Idempotency | Refresh after submit; Back then resubmit | Retry after timeout | Retry POST after timeout; same `Idempotency-Key` with same and with different body; omit the key | One record or 409; do not assume a key exists (assertions.md) | Retry creates a second record; key reused with different body accepted |

For step-by-fault injection use the matrix in `perturbation.md`. Keep parallelism small (a handful of requests); heavy load belongs to the load lens.

## 4. Locale and Turkish casing

The trap: `'ISIK'.toLocaleLowerCase('tr')` gives `ısık` (dotless ı), while `'ISIK'.toLowerCase()` gives `isik`; and `'İ'.toLowerCase()` gives `i` plus a combining dot. Code that lowercases with one rule on write and another on read, or in one layer and not another, breaks. Base facts: six-directions Data row 1.

| Surface | Web | Mobile | API | Oracle | Typical defect |
|---|---|---|---|---|---|
| Search | Search "ISIK", "ışık", "isik", "İSİK" | Same in app search | Query parameter with each spelling | Matches follow the product's stated rule, consistent across spellings (levels 1-2, else 7) | One spelling finds nothing; UI and API results differ |
| Uniqueness | Register "Ismail", then "ısmail" and "İsmail" | Same | Create twice with case variants | Duplicate rule consistent with login and search (levels 3-4) | Both accepted (later lookup ambiguous) or a distinct valid name rejected |
| Sort | Sort a list with names starting I, ı, İ, i | Same | Sorted endpoint output | Order matches the declared locale (level 2, else 8) | Dotted/dotless letters sorted to the end or mixed |
| Login and email | Log in with differently cased username or email (incl. I vs ı) | Same | Auth endpoint with case variants | Same normalization on register, login, reset (levels 3-5) | Cannot log in after registering; reset mail goes to wrong or no account |
| Display | Uppercase CSS transforms and headings with "i" | Same | Server-formatted strings | "İ" and "I" preserved as written (level 8) | "i" shown as "I" in a Turkish UI |

Also check date, number and currency formats in the tr locale (decimal comma, thousands dot). Compare the UI value with the API value, and with the database value where available.

## Reporting
Per technique run, record platform, exact trigger, observed result, oracle level and evidence path; classify with `references/core/defect-classification.md` and `references/core/impact-analysis.md`.
