# AUDIT-011 Re-test Failure

## Status

- **Tracking ID**: `AUDIT-011`
- **Priority**: `P1`
- **Status**: `Re-test failed`

## Area

- **Feature**: Indoor Starts -> Import From Garden Plan

## Re-test result

- The modal now displays plan-context text about what plan it is importing from.
- However, the rows shown in the modal did **not** match the newly active plan during re-test.

## Expected

When a new active plan is selected, the import modal should show rows that match that active plan.

## Actual

The modal now says what plan it is importing from, but after switching the active plan to a different plan with different crops, the rows shown still reflected the earlier plan's crops.

Observed example from re-test:

- original plan used lettuce
- a new plan was created and set active using basil instead
- the modal header reflected the new active plan
- but the rows shown still reflected the first plan's lettuce-based data

## Impact

The UI now gives plan-context text, but the underlying data shown does not appear to match that plan.

This is still a user-trust issue and can cause the user to import the wrong work.

## Suggested developer framing

Treat this as a still-open `AUDIT-011` failure, not as a copy-only issue.

The remaining problem appears to be:

- plan context text updates
- but the data source feeding the modal rows is still stale, cross-plan, cached, or otherwise not correctly scoped to the newly active plan

## Recommended next check

Investigate whether:

1. the modal query is still returning a broader all-plans result set
2. the active-plan change is not invalidating/reloading the modal data
3. stale client state is persisting rows from the prior active plan
4. backend plan attribution is correct per row, but frontend filtering/rendering is still wrong
