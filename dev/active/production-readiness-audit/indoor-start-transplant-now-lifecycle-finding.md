# Indoor Starts Transplant-Now Lifecycle Finding

## Status

- **Priority**: `P1`
- **Status**: `New re-test finding`

## Area

- **Feature**: Indoor Seed Starts -> destination bed / transplant workflow

## Finding

### Expected

If an indoor start is still in a planned or not-yet-started state, the UI should not present this as an actual **`Transplant Now`** action.

At this stage, the user expectation is closer to:

- planning the future placement
- reserving the exact future spot in the destination bed
- or moving the record through indoor-start stages until it is truly transplant-ready

### Actual

The card offers **`Transplant Now`** even before the seed has actually progressed through indoor-start stages and is ready for transplant.

Clicking it opens the bed-placement UI, which feels like execution of a transplant rather than planning a future exact spot.

## Why this is a problem

The current behavior appears to conflate three different concepts:

1. destination-bed assignment
2. future exact placement planning
3. actual transplant execution

From a real-user perspective, those are not the same thing.

## Impact

- lifecycle/state logic feels misleading
- user may think they are recording a real transplant too early
- planning the future exact spot in the bed is not clearly separated from executing the transplant
- trust in the indoor-start workflow is reduced

## Repro context

Observed during verification re-test on 2026-04-23:

- indoor-start cards showed basil assigned to bed `first`
- clicking **`Transplant Now`** opened the exact bed placement screen
- user expectation was that this stage should be about planning or reserving the future placement, not executing the transplant before the seed has even been started

## Suggested developer framing

Treat this as a lifecycle / action-semantics issue, not just a button-label nit.

Questions to evaluate:

- should this action be gated by indoor-start stage/state?
- should there be a separate **Plan Placement** or **Reserve Spot** action before real transplant readiness?
- should **Transplant Now** only appear once the record is actually transplant-ready?
