# Future Transplant Event-Splitting Finding

## Status

- **Priority**: `P1`
- **Status**: `New follow-up finding`

## Area

- **Feature**: Future-dated placement planning / generated transplant events

## Context

This was observed while re-testing the future-transplant completion bug fix.

The original completed-vs-planned contradiction may be improved, but the resulting future planning behavior still looks questionable from the user side.

## Finding

### Expected

When placing a future-dated row or grouped planting, the resulting future transplant scheduling should be understandable and should match the user’s planning intent.

### Actual

In the observed case:

- a future row of **48 radishes** was planted
- the system generated **4 transplant events**
- all 4 transplant events were scheduled on the **same day**

### Why this is confusing

From the user perspective, it is not clear:

- why one planned row became four separate events
- whether those four events are intentional bed/section splits
- or whether the event generation is fragmenting the plan in a way that does not reflect how the user thinks about the task

## Impact

- users may not trust the future-planning output
- event counts and calendar workload can look inflated or fragmented
- even if the completion-state bug is fixed, the resulting future schedule may still feel wrong or unexplained

## Suggested developer framing

Treat this as a follow-up to the future-transplant bug fix, focused on **event generation / planning semantics**, not on completion-state alone.

Key questions:

1. Why was one future row/grouped planting split into four events?
2. Is that split intentional based on bed cells/sections/methodology?
3. If intentional, does the UI explain the split well enough?
4. If not intentional, is there still a bug in how future-dated row/grouped plantings are converted into transplant events?
