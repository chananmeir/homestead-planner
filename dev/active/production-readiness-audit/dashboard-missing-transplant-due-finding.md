# Dashboard Missing Transplant-Due Finding

## Area

Dashboard -> Needs Attention Today  
Cross-check against Grow -> Indoor Starts

## Expected

If an indoor start is ready to transplant on the currently viewed simulation date, Dashboard `Needs Attention Today` should surface that transplant task as actionable work.

## Actual

On the simulation date `2024-03-24`, Indoor Starts showed beet starts as ready to transplant that day, but Dashboard `Needs Attention Today` did not include the corresponding transplant task.

## Contrast / Supporting Observation

On a later simulation date (`2024-04-14`), the dashboard did correctly show a different actionable task (`direct sowing of beans`), so the problem does not appear to be that Dashboard is universally empty or that simulation mode is entirely broken.

## Impact

Users cannot fully trust Dashboard as the daily task hub if time-sensitive transplant work shown on the Indoor Starts screen does not also surface in `Needs Attention Today`.

## Notes

- This appears to be a cross-surface consistency problem between Indoor Starts and Dashboard task generation.
- It may be specific to `transplantsDue`, simulation-date handling, or completion-state filtering for indoor-start-derived work.
