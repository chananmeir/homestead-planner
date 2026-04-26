# Indoor Start Post-Placement State Finding

## Area

Indoor Starts -> card action / placement-state labeling

## Expected

After the user has already chosen where an indoor start should go in the garden, the card/action state should clearly indicate that a placement has already been chosen.

Examples of acceptable intent:
- `Placed`
- `Placement chosen`
- another clearly equivalent state label

The exact wording can be decided separately, but the user should not be left thinking placement has not happened yet.

## Actual

After completing the placement flow and choosing the garden location, the card still reads `Plan Placement`.

## Impact

This makes it unclear whether:
- the plant still needs a location chosen, or
- a location has already been selected

Users may re-enter the placement flow unnecessarily or lose confidence about whether the garden location was already decided.

## Notes

- This is a follow-up state-labeling issue after successful placement.
- It is separate from:
  - the earlier banner-copy safety fix
  - the explicit cell-picker placement-flow fix
- The core workflow now exists, but the post-placement state does not yet communicate completion of the placement-choice step clearly enough.
