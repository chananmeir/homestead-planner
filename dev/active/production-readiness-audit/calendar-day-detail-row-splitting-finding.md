# Calendar Day-Detail Row-Splitting Finding

## Status

- **Priority**: `P1`
- **Status**: `New follow-up finding`

## Area

- **Feature**: Planting Calendar -> calendar view -> day-detail modal

## Finding

### Expected

When one logical row or grouped planting spans multiple cells, the calendar day-detail modal should summarize that work in a user-friendly way.

### Actual

The day-detail modal lists each cell-level event separately.

Example observed:

- one row of beans
- 24 beans total
- 6 plants in 4 cells
- the calendar day modal showed 4 separate events

### Important distinction

This is **not** the same as the earlier ListView issue.

- ListView now appears to behave correctly after the grouping fix
- the remaining problem is specifically in the **calendar day-detail modal**

## Why this is confusing

From the user perspective, this is one planned row/grouped planting task.

The modal currently exposes the storage/event granularity too literally, which makes the calendar feel inflated and repetitive.

## Impact

- one logical planting task can appear as multiple repetitive calendar items
- busy planting days look noisier than they should
- calendar view still feels harder to interpret even after the ListView fix

## Suggested developer framing

Treat this as a calendar day-detail summarization / grouping issue.

Key question:

> Should the day-detail modal summarize same-day, same-bed, same-plant row/grouped placements the way ListView and CalendarGrid now do, instead of listing every per-cell event separately?
