# Dashboard Stale Needs-Attention Finding

## Status

- **Priority**: `P1`
- **Status**: `New finding`

## Area

- **Feature**: Dashboard -> Needs Attention Today

## Finding

### Expected

`Needs Attention Today` should primarily surface items that are meaningfully actionable **today**.

If an item is far in the past and the user never explicitly acted on it, the dashboard should not keep presenting it forever as if it were a normal current-day action.

### Actual

On April 24, the dashboard still shows stale items from February 1 / February 2 in `Needs Attention Today`, especially indoor-start-related tasks that were never explicitly updated by the user.

### Why this is a problem

From the user perspective, this makes the dashboard feel noisy and unrealistic:

- it can look like the app is always demanding old cleanup work
- users may feel they must manually click through every old task just to make the dashboard usable
- truly current work is harder to see

## Suggested product direction

Do **not** silently assume everything happened.

Instead, introduce stale-task handling by type:

- some time-sensitive reminders should age out of `Needs Attention Today`
- overdue items can move into a lower-priority `Missed`, `Expired`, or `Stale` state
- high-integrity actions should not be auto-marked completed if that would change historical truth

## Suggested examples

Likely candidates to age out or expire from `Needs Attention Today`:

- indoor seed start reminders
- germination checks
- hardening-off reminders
- one-time transplant reminders

Likely candidates that should **not** be silently auto-completed:

- harvest records
- seed-saving records
- anything that changes inventory or historical outcomes

## Suggested developer framing

Treat this as a dashboard task-lifecycle / stale-attention issue, not just a sorting problem.

The question is:

> After how much time, and by what rule set, should overdue tasks stop appearing in `Needs Attention Today` and move into a different state or bucket?
