# Calendar / Indoor Starts Consistency Finding

## Status

- **Priority**: `P1`
- **Status**: `New Wave 2A finding`

## Area

- **Feature**: Planting Calendar day view ↔ Indoor Starts planned state

## Finding

### Expected

If the Planting Calendar shows a large number of indoor-start actions for a date, the user should be able to reconcile those items with the Indoor Starts planned state.

### Actual

In the calendar day view, one date showed many indoor-start-looking events.

However, when checking the Indoor Starts side under the planned view, the user did not see a clear corresponding planned state that matched what the calendar appeared to be asking them to do.

### Why this is confusing

From the user perspective, the two screens should tell a consistent story:

- Calendar: what needs to happen on that date
- Indoor Starts: what planned indoor-start records exist

Right now, they do not clearly line up.

## Impact

Users cannot trust whether the calendar is showing:

- real planned indoor-start work
- duplicate / expanded event rows
- or a different layer of data than the Indoor Starts page

This reduces trust in both the calendar and the Indoor Starts workflow.

## Repro context

Observed during Wave 2A testing:

- the calendar cell showed a small number at first glance
- opening the day detail modal showed many indoor-start-looking events
- the user could identify them as indoor starts
- but then could not clearly reconcile those events with what appeared under Indoor Starts -> Planned

## Suggested developer framing

Treat this as a cross-view consistency / explainability problem, not just a calendar crowding issue.

Key question:

> Are the calendar's indoor-start events and the Indoor Starts planned records representing the same underlying work in different views, or are they intentionally different layers that need clearer explanation in the UI?
