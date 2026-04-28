## Status

- **Tracking ID**: `AUDIT-011`
- **Push status**: `Completed`

Proceed with the push for the AUDIT-011 commits:

- `1781270` docs: AUDIT-011 retest investigation + decision summary
- `a33b921` fix: Scope import-events endpoint to active plan (AUDIT-011)
- `f0cd53a` docs: Record AUDIT-011 fix report

## Reason

- the fix addresses both the cross-plan scoping problem and the stale re-fetch problem
- the null / unattributed row behavior matches the approved decision
- test/build results are sufficient for this pass

## After push

I will run a targeted user-side re-test of AUDIT-011 to confirm:

- switching the active plan actually changes the rows shown
- rows from other known plans no longer appear under the wrong active plan
- any unattributed rows are clearly labeled as `Unknown plan`

## Outcome

The push was completed later with the final bundle including:

- `1781270`
- `a33b921`
- `f0cd53a`
- `ab155f5`

User re-test afterward indicated that active-plan scoping now appears to work correctly, so this note is now historical.
