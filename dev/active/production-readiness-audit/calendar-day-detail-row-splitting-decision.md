Proceed with option (a): implement Option 1 now.

## Decision

Apply the same grouping pattern in `DayDetailModal` that is already used by ListView and CalendarGrid pills.

## Expected behavior

- singleton row stays unchanged
- grouped row shows an `(N)` badge
- grouped row opens `GroupedEventsModal`
- singleton-only actions such as trash / `Start tracking` stay hidden on grouped rows

## Reason

This is the smallest-risk path and gives consistent behavior across all three calendar surfaces.

Do not defer it, and do not do the heavier inline-expansion variant in this pass.

## Report back with

- exact grouping rule used
- files changed
- commit hash
- build/test results
