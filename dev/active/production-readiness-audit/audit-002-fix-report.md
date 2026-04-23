# AUDIT-002 Stage 1 Fix Report (2026-04-23)

Implementation of Option A (property ZIP seeds weather when no pin
exists) per `audit-002-fix-decision.md`. Stage 2 ("reset to property
ZIP" affordance) remains deferred.

---

## Commit

```
5a673aa fix: Seed weather ZIP from user's primary property instead of '53209'
```

Not yet pushed at time of writing — will bundle with any other pending
docs in the next push.

---

## Files changed

| File | Type | Change |
|---|---|---|
| `frontend/src/hooks/useProperty.ts` | **new** (~100 lines) | `useProperty()` hook with module-level Promise cache, ZIP extraction from `address`, graceful null-return |
| `frontend/src/components/WeatherAlerts.tsx` | modified | Precedence chain in state initializer + new effect to apply property ZIP post-load |
| `frontend/src/components/PlantingCalendar/SoilTemperatureCard/index.tsx` | modified | Precedence chain in fetch effect + empty-ZIP guard; deps gained `property` (+ `onDataLoaded` as scope-adjacent exhaustive-deps cleanup from pre-existing state) |
| `frontend/src/components/PlantingCalendar/MapleTappingSeasonCard.tsx` | modified | Same pattern, `property` added to mount-effect deps |
| `frontend/src/components/PlantingCalendar/AddMapleTappingModal.tsx` | modified | Same pattern, `fetchSeasonConditions` guarded on empty ZIP |

Total: 5 files changed, 160 insertions / 11 deletions.

---

## Exact fallback behavior implemented

1. **`localStorage.getItem('weatherZipCode')` — pinned weather ZIP wins** when set.
2. **Primary property's ZIP** — extracted from `Property.address` via US-5-digit regex (`/\b(\d{5})(?:-\d{4})?\b/`), mirrors backend's `_extract_zipcode` in `services/geocoding_service.py`. Used when no pin.
3. **Empty string** — when no pin and no property (or property has no 5-digit ZIP in its address). Each consumer now short-circuits its fetch via `if (!zipCode) return;` rather than hitting the backend with `''` and producing a noisy 400.

---

## Hardcoded `'53209'` removal

Grep confirmation:

```
grep -rn "53209" frontend/src --include="*.tsx" --include="*.ts"
→ 0 hits
```

Remaining references are only in `frontend/tests/*.spec.ts` E2E fixtures
where `53209` is typed as user input or passed as query param —
intentional test data, unaffected by this change.

---

## Test + build results

- **Frontend build**: `Compiled successfully.` No TypeScript or ESLint errors. Main bundle +~2 KB gzipped.
- **Jest full suite**: 139/139 passed, 15/15 suites.
- **No targeted unit tests existed** for any of the 4 consumer components or the new hook. None were added in this pass — flagged as a follow-up.

---

## Three-scenario walk-through

1. **Pinned ZIP present** — `localStorage.weatherZipCode = '54321'`, primary property ZIP = `'12345'`. Expression `localStorage.getItem('weatherZipCode') || property?.zipCode || ''` short-circuits on first truthy → returns `'54321'`. Pin wins.
2. **No pin, property has ZIP** — no localStorage entry, `address = "123 Main St, Cityville WI 12345"`. `useProperty()` resolves to `{ zipCode: '12345', ... }`. Expression returns `'12345'`. Effect re-runs when `property` hydrates (added to deps) → fetch fires.
3. **No pin, no property or no ZIP in address** — expression returns `''`. Each consumer's new `if (!zipCode) return;` guard skips the fetch. UI renders the existing empty/no-forecast state without error.

---

## Coverage gap (out of scope for Stage 1)

- No Jest unit tests exist for `useProperty`, `WeatherAlerts`, `SoilTemperatureCard`, `MapleTappingSeasonCard`, or `AddMapleTappingModal`. Recommended future `test-engineer` pass:
  - `useProperty.test.ts` — stub `apiGet`; assert ZIP extraction, null return on 401/network error, caching (two calls → one fetch).
  - Consumer-level tests mocking `useProperty` to assert the skip-fetch-on-empty-ZIP branch for each of the 4 consumers.

---

## Deferred

- **Stage 2** — "Reset to property ZIP" affordance in the Weather-settings UI for users who pinned an explicit override and want to snap back to their property. Per `audit-002-fix-decision.md`.
- **PropertyContext** wrapping the whole app for render perf — not required for Stage 1 since the module-level Promise cache means N consumers share one fetch per page load. Future refactor if needed.
- **International postal codes** — the ZIP regex is US-5-digit. International addresses fall through to empty state (correct for a US-weather-keyed app). Flag if int'l support is planned.

---

## Awaiting user

- Push greenlight — current local commits ready to push: `9c98e88` (retest summary doc) + `5a673aa` (this fix). Both relate to AUDIT-002.
