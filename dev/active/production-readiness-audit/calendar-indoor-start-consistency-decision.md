Proceed with Option A1.

## Decision

Do not change `Export to Calendar` semantics in this pass.
Do not auto-create `IndoorSeedStart` rows during export yet.

Instead:

- make the calendar clearly distinguish tracked vs plan-only indoor-start items
- provide a clear `Start tracking` action for plan-only items
- add a corresponding affordance on the Indoor Starts side so users can reconcile scheduled work with tracked records

## Reason

This addresses the user confusion directly without introducing the larger semantic change of making export auto-create tracking records.

Do not do A2 in this pass.
Treat A2 as a possible later product decision if we decide export should also create tracking records by default.

## Report back with

- proposed UI shape for the calendar distinction
- where the `Start tracking` action will live on the Indoor Starts side
- whether any new deep-link target or target-kind is needed
- implementation scope before coding if that scope grows beyond the expected frontend-first work
