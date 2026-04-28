# Weather ZIP Propagation Product Decision

**Date**: 2026-04-28
**Related issue**: `AUDIT-021`
**Developer prompt**: `respons0428.txt`

## Decision

Proceed with option **(a)**:

- Adopt the reviewer recommendation as-is.
- On property create/edit with a ZIP-bearing validated address, seed/update the app-wide weather ZIP from the saved property ZIP.
- Write the ZIP into both:
  - `localStorage.weatherZipCode`
  - `weatherZipCode__user_${user.id}`
- Dispatch `weatherZipCodeChanged` with the property ZIP so Weather & Alerts, dashboard/header, calendar helpers, and designer weather consumers refresh without reload.
- Do **not** add explicit manual-override UI in this fix.

## Reasoning

The current user-facing problem is that a newly created property ZIP does not appear to propagate to Weather & Alerts. Keeping a stale old manual `weatherZipCode` as a silent override would preserve the same failure mode.

For this production-readiness fix, property setup should be treated as the source of truth for weather location. If the product later wants a manual override feature, that should be explicit UI work with clear copy such as `Weather location override active` and a `Use property ZIP` reset action.

## Implementation Expectation

The technical scaffolding from `weather-zip-propagation-fix-plan.md` remains approved:

- add the canonical `useWeatherZipCode()` resolver
- make `useProperty()` invalidatable from app code
- migrate direct `localStorage.weatherZipCode` readers to the resolver
- invalidate property cache on property create/edit/delete
- add regression tests for stale cache, stale old ZIP, Weather & Alerts, dashboard tile/header, Garden Designer, Planting Calendar helpers, cross-tab storage, and login restore

## Acceptance Criteria

- [ ] Creating a property with a validated ZIP immediately updates Weather & Alerts without reload.
- [ ] Editing a property ZIP immediately updates Weather & Alerts without reload.
- [ ] A stale old `weatherZipCode` cannot silently mask the newly saved property ZIP.
- [ ] Dashboard weather tile and app header use the newly saved property ZIP.
- [ ] Garden Designer weather banner and Planting Calendar weather helpers use the same resolved ZIP.
- [ ] Regression tests cover the stale old ZIP case with property save winning for this fix.

