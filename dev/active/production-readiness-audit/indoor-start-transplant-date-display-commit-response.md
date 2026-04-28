Proceed with the commit.

Use:
- one `fix:` commit for the Indoor Starts card date-display change
- include the two related doc files with it

Suggested summary:
`fix: Indoor Starts card show absolute transplant date with relative-days tooltip`

Reason:
This is a clean, scoped UX improvement and the implementation shape is correct.

Do not pull the deferred follow-ups into this commit:
1. date-format unification with `EditSeedStartModal`
2. `getDaysUntil` TZ-helper cleanup

Those can be filed separately if needed.
