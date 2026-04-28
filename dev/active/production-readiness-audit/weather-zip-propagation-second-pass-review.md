# Weather ZIP Propagation Second-Pass Review

**Date**: 2026-04-28  
**Related issue**: `AUDIT-021`  
**Reviewed files**:
- `weather-zip-propagation-retest-fix-report.md`
- `weather-zip-propagation-tests-report.md`
- `weather-zip-propagation-retest-code-review.md`

## Verdict

Approve for user retest.

The second pass addresses the failure reported in `weather-zip-propagation-retest-failure.md`:

- ZIP-only validation now captures the ZIP before backend validation can rewrite the visible address.
- Save-time ZIP resolution now checks the captured validation ZIP before the saved/formatted address.
- Validation retry behavior is covered: first failure followed by second success should still pin the ZIP.
- Fresh registration now clears or restores weather ZIP state instead of inheriting a prior user's un-namespaced `weatherZipCode`.
- Tests were expanded to cover the exact second-pass failure modes.
- Code review reports no blockers or major findings.

## Evidence Summary

Reported verification:

- `npm run build` passed.
- Targeted tests for `PropertyFormModal` and `AuthContext` passed.
- Full frontend suite passed: `207` tests.
- Code review verdict: `APPROVE`.

New test coverage includes:

- ZIP-only validation where `formatted_address` loses the ZIP.
- Captured ZIP cleared when the user manually retypes the address.
- First validation failure followed by successful retry.
- Future backend `zipcode` response fallback.
- New-user registration clearing stale weather ZIP state.
- New-user registration restoring per-user weather ZIP backup when present.
- `weatherZipCodeChanged` dispatch on register.

## Remaining Closure Requirement

Do not close `AUDIT-021` until the user retests the exact failed path:

1. Create a brand-new user.
2. Create a new property.
3. Enter a ZIP/address and validate it.
4. If first validation fails, try validation again without refreshing.
5. Save the property.
6. Without refreshing the browser, confirm:
   - Dashboard weather/location updates.
   - Weather & Alerts shows/uses the new ZIP.

If that passes, `AUDIT-021` can move to `Verified closed`.

## Non-Blocking Follow-Ups

- Backend `/api/properties/validate-address` could eventually return an explicit `zipcode` field. This would make the frontend fallback chain stronger for all clients. Not required for this fix.
- Pre-existing `latitude || null` / `longitude || null` falsy coercion remains out of scope.

