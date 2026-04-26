# Indoor Start Location vs Destination Clarity Finding

## Area

Indoor Starts -> card field labeling

## Expected

The Indoor Starts card should make it obvious which place refers to:

- where the seedlings are **currently** located
- where they are **intended to go later** in the garden

If exact placement has already been chosen, that should also be distinguishable from a merely planned destination.

## Actual

The card shows both `Location` and `Destination`, but the labels are too generic and easy to confuse.

Examples from current cards:
- `Location: windowsill` / `repalica`
- `Destination: not assigned` / `firstbed`

This makes it unclear whether:
- `Location` means the current indoor growing location
- `Destination` means the planned future bed
- or one of the fields refers to exact placement already chosen

## Impact

Users can misread the card as having two competing place fields instead of one current-location field and one future-garden-placement field.

That weakens trust in the Indoor Starts workflow and makes the later placement state harder to understand.

## Notes

- This is a wording / semantics issue, not necessarily a backend-state issue.
- Likely candidate label directions:
  - `Current location`
  - `Planned bed` / `Garden destination`
- If exact placement has already been chosen, that should remain a separate explicit confirmation state rather than being implied by the generic `Destination` label.
