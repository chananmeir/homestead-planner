Proceed with option (a): implement Layer 1 only.

## Decision

This is a clear bug fix, not a product-model decision.

The immediate problem is the contradiction where future/planned placement is stored correctly on the `PlantedItem` side but the auto-created `PlantingEvent` is still hardcoded as completed.

## Scope for this pass

Please fix Layer 1 only:

- compute completion from whether `planted_date <= today`
- do not hardcode future-dated planting events as completed

## Not in scope for this pass

Do not implement:

- Layer 2a (`I purchased this transplant` checkbox)
- Layer 2b (full `plant_source` enum / model)

Those can be decided separately after the bug is fixed.

## Report back with

- exact backend behavior change
- whether both create paths were covered
- commit hash
- test results
