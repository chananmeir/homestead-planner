# Dashboard Needs Attention Row-Splitting Finding

## Area

Dashboard -> Needs Attention Today

## Expected

When one logical seeding task exists, the dashboard should present it as one understandable task, or at least group the underlying per-cell events clearly enough that the user reads it as one piece of work.

## Actual

A planned beet-start task for 32 total starts was surfaced as 4 separate events of 8 plants each instead of one clear grouped task.

## Impact

The dashboard workload feels inflated and noisy. Users may think they have more distinct tasks than they really do, which reduces trust in the Needs Attention summary and makes quick triage harder.

## Notes

- This appears related to the same broader per-cell event splitting pattern already found on calendar surfaces.
- The user expectation here is task-level grouping, not raw event-level repetition.
