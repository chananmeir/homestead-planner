# Future Placement Reservation Gap

## Status

- **Priority**: `P1`
- **Status**: `New follow-up after AUDIT-013 re-test`

## Area

- **Feature**: Indoor Seed Starts -> exact bed placement workflow

## What is now improved

The `AUDIT-013` fix appears to have improved the earlier ambiguity:

- the flow now starts from a specific indoor-start record
- the user is directed to pick an exact cell in the destination bed
- the old ambiguous path that marked a start transplanted without exact placement has been replaced

## What is still missing

The app still does **not** appear to support a true:

- **future exact placement reservation**

That is:

> "I want to decide now exactly where this indoor start will go in the bed later, when it is actually ready to be transplanted."

## Current behavior observed

During re-test:

- user selected **Plan Placement** for a basil start that is still `planned`
- user was taken into the bed and asked to pick a cell
- before completing that flow, the app showed a confirm dialog stating that continuing would also mark the start as transplanted

This means the current flow is still:

- exact placement **plus** transplant-status advancement now

not:

- reserve exact future placement now, while leaving transplant status for later

## Why this matters

From the user perspective, these are different operations:

1. **Reserve the future spot**
   - "This basil will go in this exact cell later."

2. **Actually transplant now**
   - "This basil is ready today, and I am putting it in the bed now."

The app now handles the second more clearly than before, but still does not provide the first.

## Suggested developer framing

Treat this as a product/workflow gap, not as a rollback of the `AUDIT-013` fix.

The `AUDIT-013` fix improved record-to-cell linkage.
This new finding is about whether the product should also support:

- planning the exact future position
- without immediately marking the indoor start as transplanted

## Recommended next question

Please clarify whether the intended product model is:

1. **Placement means transplant now**
   - exact cell selection should always advance the indoor start to transplanted

or

2. **Placement can be future reservation**
   - exact cell selection can reserve the future spot without advancing transplant status yet

If option 2 is intended, this needs a new workflow/state design.
