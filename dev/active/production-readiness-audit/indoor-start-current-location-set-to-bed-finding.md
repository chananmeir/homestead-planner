# Indoor Start Current Location Set To Garden Bed Finding

> **Status (2026-04-27): FIXED.** See [`indoor-start-current-location-set-to-bed-fix-report.md`](indoor-start-current-location-set-to-bed-fix-report.md). Root cause was `backend/blueprints/gardens_bp.py:210` defaulting `IndoorSeedStart.location` to the destination bed name; now defaults to `'windowsill'`.

## Area

Indoor Starts -> current-location value on auto-created indoor starts

## Expected

When an indoor seed start is auto-created from a transplant-planning flow, its **current location** should reflect where the seedlings are currently being started indoors, or fall back to a sensible indoor default.

Examples:
- `windowsill`
- `grow lights`
- another indoor-start location value

It should not use the destination garden bed name as the current indoor location.

## Actual

For a broccoli indoor start created from the planning/placement flow, the Indoor Starts card showed:

- `Current location: replica`

where `replica` is the garden bed / destination context, not the current indoor growing location.

## Impact

This makes the card logically wrong:
- the plant is still in the indoor-start phase
- but the app presents the outdoor garden bed as if it were the current indoor location

That weakens trust in the Indoor Starts record and makes the current-location field unreliable.

## Notes

- This appears stronger than a pure wording issue.
- Likely cause: the auto-create flow is assigning `IndoorSeedStart.location` from the linked `garden_bed_id` / bed name instead of using an indoor default.
- Separate follow-up issue may still exist for the `Started:` label on future planned starts, but this current-location bug should be fixed first.
