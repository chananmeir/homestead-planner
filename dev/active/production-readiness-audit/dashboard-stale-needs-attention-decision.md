Proceed with the plan using these product decisions.

## Approved decisions

### 1. Use a `Missed` bucket

- keep it on the dashboard
- default it to collapsed
- label it `Missed (N)`

Reason:
silent drop would make the dashboard cleaner, but it would also make users feel like the app lost their tasks. A collapsed `Missed` section keeps the dashboard usable without pretending stale items are still “today” work.

### 2. Use simple uniform thresholds in v1

Use:

- `indoorStartsDue`: **14 days**
- `transplantsDue`: **14 days**
- `directSeedDue`: **14 days**
- `germinationCheck`: **14 days past expected germination**
- `indoorGerminationCheck`: **14 days past expected germination**
- `harvestReady`: **never hide**, optionally demote visually after **14 days**

Reason:
plant-type-aware thresholds are not worth the extra complexity yet.
Also, `10` days for transplants feels a little too aggressive for real use.

### 3. Keep `Missed` on the dashboard

- do not move it to a separate page for v1

### 4. Do not allow `Skip 3d` on `Missed` items

- keep `Cancel task`
- keep `Dismiss forever`

### 5. Do not scope creep into snooze-table cleanup now

- leave snooze-row cleanup out of this pass

### 6. Harvest policy

- keep harvests visible
- do not auto-complete or auto-hide them
- visual demotion only is fine for now
- no extra stale-harvest banner in this pass

## Summary

Greenlight the stale-needs-attention implementation with the above choices.

Main adjustment from the draft plan:

- use **14 days** for `transplantsDue`, not 10

## Report back with

- final threshold constants implemented
- backend payload shape changes
- frontend `Missed` bucket behavior
- commit hash(es)
- test/build results
