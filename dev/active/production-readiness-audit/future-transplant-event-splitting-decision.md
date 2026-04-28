Proceed with option (b): implement A + C.

## Decision

1. Implement ListView grouping so it matches the grouping behavior already present in CalendarGrid for the same underlying work.
2. Add the transplant guardrail for plants with `weeksIndoors=0`.

Do **not** implement Option B in this pass.
Treat `row_group_id` expansion as a separate future improvement if it is still needed after A + C land.

## Reason

- A directly addresses the user-facing inconsistency and should make the two calendar views tell a more consistent story.
- C is a small, useful guardrail that prevents obviously confusing planning input.
- B is more semantically complete, but it is not necessary to solve the immediate problem.

## Report back with

- exact ListView grouping rule implemented
- exact transplant guardrail behavior
- commit hash(es)
- build/test results
