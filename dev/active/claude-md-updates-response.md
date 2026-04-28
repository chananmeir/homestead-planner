The proposed CLAUDE.md additions are directionally good, but I would not merge them exactly as written.

## Decision

### 1. IndoorSeedStart ↔ PlantingEvent completion-sync additions

Approved in principle.

Please proceed with a cleaned-up version of:

- the new **High-Risk Area** entry
- the new **Common AI Mistake** entry

These belong in CLAUDE.md because they document a real repo-specific failure mode.

### 2. Dashboard stale-needs-attention addition

Do **not** merge this into CLAUDE.md yet unless the stale-needs-attention implementation is actually shipped.

Reason:
the proposed text assumes concrete implementation details are already true, including payload shape, constants, and test counts.

So:

- if the feature is not yet merged, keep this as a proposed note only
- once the feature is actually shipped, then add a cleaned-up version to CLAUDE.md

## Required cleanup before merging anything

1. Remove encoding artifacts / mojibake

Examples in the draft include:

- `â†”`
- `Â§`

Please normalize these before any CLAUDE.md update.

2. Avoid fragile line-number references

Prefer:

- function / helper / module names

instead of:

- exact or approximate line numbers

3. Use adoption-time wording

Do not preserve stale proposal dates if the text is being added now.
Either:

- use the actual adoption date

or:

- remove the date heading and keep the instruction timeless

## Summary

Please:

- prepare a cleaned version of the IndoorSeedStart completion-sync additions for CLAUDE.md now
- hold the dashboard staleness note until that implementation is actually shipped
- avoid copying the current proposal verbatim
