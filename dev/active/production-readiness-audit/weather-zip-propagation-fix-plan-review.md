# Weather ZIP Propagation Fix Plan Review

**Reviewed plan**: `weather-zip-propagation-fix-plan.md`  
**Related issue**: `AUDIT-021` / `weather-property-zip-propagation-regression-finding.md`  
**Review date**: 2026-04-28

## Verdict

Approve the technical direction, but do not ship the plan with silent Option A behavior unless product explicitly accepts that a stale manual weather ZIP can override a newly validated property ZIP.

The plan correctly identifies the main engineering problems:

- `useProperty()` can cache `null` before a property exists.
- property create/edit does not invalidate or notify weather consumers.
- weather-aware screens still use inconsistent ZIP-resolution rules.
- a shared `useWeatherZipCode()` resolver is the right consolidation point.
- the remaining localStorage-only consumers need to move to the shared resolver.

## Blocking Product Decision

The current plan recommends:

> Option A: manual override wins.

That is technically reasonable only if the UI clearly treats the Weather & Alerts ZIP as an intentional override.

From the user expectation behind `AUDIT-021`, the property ZIP should become the app-wide weather location after property setup. If an old `localStorage.weatherZipCode` remains from previous testing or a previous property, Option A can preserve the exact symptom the user is reporting: the new property ZIP appears not to propagate.

Recommended product behavior for this fix:

1. On property create/edit with a ZIP-bearing validated address, use that ZIP as the app-wide weather ZIP.
2. Update `localStorage.weatherZipCode` and `weatherZipCode__user_${user.id}` from the saved property ZIP.
3. Dispatch `weatherZipCodeChanged` with the property ZIP so header/weather consumers refresh immediately.
4. If the product wants a manual override later, make it explicit in Weather & Alerts copy, for example: `Weather location override active`, with a `Use property ZIP` reset action.

If the team strongly wants Option A now, then the acceptance criteria must add visible override messaging. Silent stale overrides should not pass production readiness.

## Technical Plan Notes

The following plan items should remain:

- Add `useWeatherZipCode()` as the canonical resolver.
- Make `useProperty()` invalidatable from app code.
- Refactor all direct `localStorage.getItem('weatherZipCode')` read sites into the shared resolver, except low-level storage event handling.
- Invalidate property cache on property create/edit/delete.
- Add regression tests for property-created-after-null-cache, Weather & Alerts, Dashboard weather tile, Garden Designer, Planting Calendar, stale-pin behavior, delete behavior, cross-tab storage, and login restore.

One implementation detail to be careful with:

- If property save writes the property ZIP into `localStorage.weatherZipCode`, the resolver's `source` may report `pinned` even though the value was seeded from property. That is acceptable for a minimal fix, but future UI may need a separate source marker such as `weatherZipCodeSource='property' | 'manual'` if the app wants to distinguish seeded property ZIPs from true manual overrides.

## Acceptance Criteria Adjustment

Add these to `AUDIT-021` before closure:

- [ ] Creating or editing a property with a validated ZIP immediately updates Weather & Alerts without reload.
- [ ] Dashboard weather tile, app header, Garden Designer weather banner, and Planting Calendar weather helpers use the same resolved ZIP.
- [ ] A stale old `weatherZipCode` cannot silently mask the newly saved property ZIP unless the UI clearly identifies it as an active manual override.
- [ ] Tests cover the stale-pin case with the product-approved behavior.

