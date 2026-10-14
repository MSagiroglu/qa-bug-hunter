# Observational Security Hygiene

**This is QA, not security testing.** Everything in this file is passive
observation of traffic and responses already produced by normal,
authorized feature testing — reading what the application sends back
when you use it the way this skill already uses it elsewhere in the
pipeline. Nothing here involves crafting attack payloads, attempting to
bypass authentication or authorization, probing for injection
vulnerabilities, scanning ports, fuzzing, or any action whose purpose is
to compromise the system rather than observe it. If genuine security
testing is wanted (penetration testing, vulnerability scanning), that's a
different, separately-scoped and separately-authorized engagement — not
this skill, and not this file. Do not extend the checks below into
anything that sends deliberately malicious or attack-crafted input.

## Response overexposure

While doing normal feature testing (`SKILL.md`'s existing phases already
capture network responses per `references/core/evidence-capture.md`), look at what an API
response actually contains versus what the UI displays. A field present
in the response but never shown — another user's data, an internal
ID/flag not meant for this role, cost/margin figures a non-privileged
role shouldn't see — is an overexposure defect: the access control lives
in the frontend (deciding not to render it) instead of the backend
(deciding not to send it), which is exactly the frontend-only-constraint
pattern this skill already treats as high-yield elsewhere
(`references/core/discovery.md` §3) — same root cause, different consequence (data
exposure instead of a bypassable validation rule).

## Error message hygiene

When an error occurs naturally during testing (a validation failure, an
occasional 500, an edge case that wasn't handled) — not one you
deliberately induced with attack input — check what the error response
actually contains. A stack trace, an internal file path, a raw database
error message, or a framework/library version number in a response body
or a rendered error page is information a production error response
shouldn't leak, regardless of how the error was triggered.

## Transport and cookie basics

Passive checks only:

- Does the app enforce HTTPS (does an `http://` request actually redirect
  to `https://`, not just happen to have been accessed via https this
  time)? Check the failure case specifically — a working redirect you
  happened to observe once isn't the same as confirming it's enforced.
- Are session/auth cookies marked `Secure` and `HttpOnly` (observable
  from response headers or, for the `HttpOnly` case, the fact that
  `document.cookie` in the browser console doesn't include them)? This is
  a one-line header check, not an attack.

## Classification

Same pipeline as everything else. Oracle is usually general security
best-practice/domain convention (`references/core/oracle-hierarchy.md` level 8) unless
the target has an explicit security requirement documented somewhere —
state that plainly rather than inflating an observational finding into
something it isn't. Severity for a genuine overexposure or leaked stack
trace should reflect real impact (what's actually exposed, to whom) —
don't default to Critical just because "security" is in the name; don't
default to Low either if the finding is a real data leak.
