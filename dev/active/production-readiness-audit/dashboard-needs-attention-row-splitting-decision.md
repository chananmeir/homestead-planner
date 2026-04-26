Proceed with option (a): implement Option 1.

Approved defaults:
- D1: use the composite grouping key `(date, plantId, variety, bedId)` to match the calendar surfaces
- D2: use a representative event id for the deep-link target in this pass
- D3: use frontend snooze fan-out across the grouped `plantingEventIds`; no bulk-snooze endpoint in this pass

Reason:
This is the smallest reasonable fix and keeps Dashboard aligned with the grouping behavior already established on the calendar surfaces.
Do not add the bulk-snooze endpoint yet.

Please report back with:
- exact builders grouped
- exact grouped payload shape
- how snooze behaves on grouped rows
- commit hash(es)
- test results
