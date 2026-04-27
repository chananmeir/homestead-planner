# Indoor Start Auto-Create Missing Planned Bed Finding

> **Status (2026-04-27): FIXED.** See [`indoor-start-auto-create-missing-planned-bed-fix-report.md`](indoor-start-auto-create-missing-planned-bed-fix-report.md). Root cause: `_auto_create_indoor_seed_start` did not write `destination_bed_ids`, and the resolution chain intentionally excludes the self-linked event from tier-2 matching. Now writes `destination_bed_ids = [planting_event.garden_bed_id]` at create time. Regression test added.

## Area

Indoor Starts -> auto-created indoor starts from Garden Designer / transplant planning

## Expected

When an indoor start is auto-created from a Garden Designer placement/planning flow where the user already picked a specific garden bed, the Indoor Starts card should preserve that planned bed assignment.

Example expected card state:
- `Current location: windowsill`
- `Planned bed: replica` (or the chosen bed name)

## Actual

After creating a broccoli indoor start via Garden Designer by choosing an exact bed/location:

- `Current location` is now correctly `windowsill`
- but `Planned bed` shows `not assigned`

even though the user already selected the destination bed during the creation flow.

## Impact

The card loses the destination-bed information that the user already provided.

That makes the Indoor Starts record incomplete and undermines trust in whether the planning/placement flow actually carried the chosen bed through into the seed-start record.

## Likely Cause

The auto-create path appears to fix `location` but not persist `destination_bed_ids` from the chosen `garden_bed_id`.

The card's planned-bed display depends on:
- manual `destination_bed_ids`, or
- matching event/plan fallback logic

but the self-linked planting event is excluded from the garden-sync matching path, so the auto-created record can end up with no recoverable planned-bed value unless `destination_bed_ids` is explicitly written at creation time.

## Notes

- This appears to be a stronger backend/data-link bug, not just wording.
- It is closely related to the just-fixed `Current location` issue, but distinct:
  - `Current location` was wrongly using the bed name
  - now `Current location` is right, but the actual `Planned bed` assignment is missing
