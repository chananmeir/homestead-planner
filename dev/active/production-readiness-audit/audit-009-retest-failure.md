# AUDIT-009 Re-test Failure

## Status

- **Tracking ID**: `AUDIT-009`
- **Priority**: `P1`
- **Status**: `Resolved and verified closed`

## Area

- **Feature**: Garden Designer / Save for Seed workflow

## Expected

After marking a plant **Save for Seed**, that state should persist when closing and reopening the plant.

## Actual

After enabling **Save for Seed** and closing the plant detail box, the plant no longer shows the saved-for-seed state when reopened.

## Impact

The seed-saving workflow still does not appear persistent or trustworthy from the user side.

## Repro summary

1. Open a planted item in Garden Designer.
2. Enable **Save for Seed**.
3. Close the plant detail box.
4. Reopen the same plant.
5. Observe that the seed-saving state is no longer shown as active.

## Suggested developer framing

Treat this as a still-open user-facing workflow failure, not as verified fixed.

## Resolution

Resolved on 2026-04-24.

- backend persistence had already been correct
- final frontend fix `44cc572` refreshed `activeBed` / `visibleBeds` after seed-saving writes so close-and-reopen reads canonical state instead of stale bed props
- user re-test afterward reported that the flow now appears to pass

This file should now be treated as historical context for the failed retest that led to the final fix, not as the current issue state.
