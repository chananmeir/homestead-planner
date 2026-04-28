# Weather ZIP Propagation Ship Response

**Date**: 2026-04-28  
**Related issue**: `AUDIT-021`

## Decision

Proceed, but run the live-browser repro before closing `AUDIT-021`.

The implementation reports, test report, and code-review report support shipping:

- canonical `useWeatherZipCode()` resolver added
- `useProperty()` cache invalidation added
- property create/edit overwrites stale weather ZIP per product decision
- remaining weather consumers migrated to the resolver
- stale old ZIP overwrite covered by Jest integration test
- frontend suite reported `200/200` passing
- build reported passing
- code review found no blockers

## Required Before Closure

Run the live-browser repro because it matches the exact user-reported failure:

1. Start backend and frontend dev servers.
2. Use an account with no current property, or clear existing property/location state for the test user.
3. Ensure `localStorage.weatherZipCode` contains a stale different ZIP first.
4. Create a new property with a validated ZIP-bearing address.
5. Save the property.
6. Confirm Weather & Alerts updates to the new property ZIP without reload.
7. Confirm Dashboard weather tile/header and at least one secondary weather helper use the same new ZIP.

If that passes, commit only the `AUDIT-021` files and leave unrelated working-tree changes alone.

## Follow-ups

Do not block the user-facing fix on these, but log follow-up tickets:

- `F-MAJ-1`: `useWeatherZipCode.isLoading` remains true when both pin and property are absent. No current consumer reads it, so it is not a live production bug, but it should be fixed before future code relies on the field.
- `F-MIN-2`: centralize `weatherZipCode` key constants between `useWeatherZipCode.ts` and `AuthContext`.

`F-MIN-1` is pre-existing latitude/longitude falsy coercion in the property form. Track separately if desired, but do not mix it into the AUDIT-021 commit.

## Commit Guidance

Commit after the live repro passes.

Suggested commit scope:

- `frontend/src/hooks/useWeatherZipCode.ts`
- `frontend/src/hooks/useProperty.ts`
- all migrated frontend consumers for weather ZIP resolution
- new/updated tests for `AUDIT-021`
- `weather-zip-propagation-*.md` audit reports directly related to this issue

Do not sweep in unrelated backend, Garden Planner, Indoor Starts, CLAUDE.md, or other dirty working-tree changes.

