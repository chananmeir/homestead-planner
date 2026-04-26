Proceed with option (a): implement Option 1 now.

Decision:
Replace the current stale proxy guard in `_build_transplants_due` with an `IndoorSeedStart.status`-aware check.

Use the guard only when:
- there is no linked `IndoorSeedStart`, or
- the linked `IndoorSeedStart.status == 'planned'`

Do not implement Option 2 or 3 in this pass.

Reason:
This preserves the original intent of suppressing transplant reminders when the seed-start phase never actually began, but fixes the current false suppression for starts that have legitimately progressed through Indoor Starts without mutating `linked_event.completed`.

Please report back with:
- exact guard behavior implemented
- whether PE-only events preserve current behavior
- commit hash(es)
- test results
