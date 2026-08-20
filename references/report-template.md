# QA Report Template

Save as `docs/qa-reports/YYYY-MM-DD-<module>.md` in the target repo.

```markdown
# Exploratory QA Report — <Module / Feature>

Date: YYYY-MM-DD
Scope: <what was tested>
Oracles used: <which levels from oracle-hierarchy.md were available>

## 1. Coverage Summary
- Discovery findings: <key constraints found, frontend/backend
  validation divergences noted>
- Scenarios designed: <count, grouped by technique>
- Scenarios executed: <count>

## 2. Scenarios Executed
| # | Hypothesis | Technique | Result |
|---|-----------|-----------|--------|
| 1 | ... | BVA | Pass |
| 2 | ... | Error guessing | CONFIRMED DEFECT #1 |

## 3. Confirmed Defects
(one ticket per defect, formatted per jira-ticket-template.md — TEST SET
ID/TEST CASE ID, Title, 📋 Steps to Reproduce, 🖼️ Actual Result,
🎯 Expected Result)

## 4. Potential Defects
(same ticket format, lower confidence, state why)

## 5. Behaviors Requiring Clarification
(what's ambiguous and what oracle would resolve it)

## 6. Environment / Automation Issues
(anything that blocked testing rather than being a product defect)

## 7. Risk Assessment
<what's still untested and why it matters>

## 8. Recommended Additional Tests
<highest-value next scenarios, if effort were unbounded>
```

Keep section 3 (Confirmed Defects) first among findings — that's what the
reader needs fastest. Don't pad sections with scenarios that passed and add
no information; a coverage count is enough for those.
