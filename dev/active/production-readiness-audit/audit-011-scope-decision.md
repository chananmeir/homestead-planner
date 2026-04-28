# AUDIT-011 Scope Decision

## Status

- **Tracking ID**: `AUDIT-011`
- **Decision status**: `Implemented and verified`

Proceed with Option A using null-handling option (ii).

## Decision

When the modal requests `?planId=<activePlan.id>`, return:

- rows attributable to that plan
- plus rows with null / missing `export_key`, labeled `Unknown plan`

Do **not** return rows attributable to other known plans.

Also include the frontend re-fetch fix so the modal reloads when `activePlan?.id` changes.

## Reason

- this matches the user expectation that switching the active plan changes the rows shown
- it preserves legitimate planting events that have no plan attribution
- it avoids silently hiding real work
- it keeps the scope tight without introducing a broader “show all” UX pass

## Implementation direction

Please proceed:

1. backend first
2. frontend second
3. then commit/push the cross-stack fix

Also keep the docs commit bundled with the implementation if that is your current working pattern.

## Report back with

- exact backend filter behavior implemented
- exact frontend re-fetch behavior implemented
- how `Unknown plan` rows appear under scoped mode
- commit hash(es)
- test results

## Outcome

Implemented in fix commit `a33b921` and verified from the user side on 2026-04-23. The modal now appears to scope correctly to the active plan while still surfacing unattributed rows as `Unknown plan`.
