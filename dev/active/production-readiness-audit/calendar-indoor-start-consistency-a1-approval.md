Proceed with the A1 plan.

## Approved choices

1. Use the drafted banner copy:

`planned seedings from your garden plan are not yet tracked`

2. Omit source bed in the Indoor Starts banner for this pass.
Keep the banner lighter and avoid adding the extra garden-beds fetch.

3. Use `overdueMode='reschedule_today'` for the calendar inline `Start tracking` action.

4. Keep dismiss client-only for now.
No server-side dismiss persistence in this pass.

## Reason

This keeps the fix safely scoped and addresses the user confusion directly without turning it into an export-semantics change or a larger data-model pass.

## Report back with

- files changed
- final UI copy used
- whether any scope changed during implementation
- commit hash(es)
- build/test results
