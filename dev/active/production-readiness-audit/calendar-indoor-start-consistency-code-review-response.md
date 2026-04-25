A1 looks good overall.

## Decision

Proceed with A1, but address **R1** before finalizing it:

- split the unrelated `SearchBar` / search / sort changes in `IndoorSeedStarts.tsx` into a separate commit
- or revert those hunks from the A1 work

## Reason

The tracked/plan-only distinction, `Start tracking` action, and client-only dismiss behavior all look correctly scoped.

The code-review outcome is acceptable once the scope-creep item is cleaned up.

## Priority

Do not block on the nits.

Only the scope-creep item needs to be cleaned up before this should be treated as a clean A1 implementation.
