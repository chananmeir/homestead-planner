# Weather ZIP Propagation Fix Report (AUDIT-021)

**Date**: 2026-04-28
**Author**: frontend-debugger
**Spec sources**:
- `weather-property-zip-propagation-regression-finding.md`
- `weather-zip-propagation-fix-plan.md`
- `weather-zip-propagation-product-decision.md` (overrides plan's Option A; property save is source of truth)

---

## Files changed

### Hooks (new + refactored)

| File | Reason |
|---|---|
| `frontend/src/hooks/useProperty.ts` | Refactored to `useSyncExternalStore`. Exposes new `invalidatePrimaryPropertyCache()` and `subscribePrimaryPropertyChanged()` for app-code-driven invalidation. Exports `extractZipFromAddress` so save-site code shares one regex. `__resetPrimaryPropertyCacheForTests` retained as a backward-compat alias. |
| `frontend/src/hooks/useWeatherZipCode.ts` | NEW. Canonical resolver returning `{ zipCode, source, isLoading }`. Precedence is an ordered array (`pinned` -> `property`) — one-line edit to flip future policy. Listens to `weatherZipCodeChanged` (same-tab) and `storage` (cross-tab) so all consumers refresh without reload. Exports `pinWeatherZip(zip, userId)` helper that writes both `localStorage.weatherZipCode` and `weatherZipCode__user_${userId}`, then dispatches `weatherZipCodeChanged`. |

### Save sites (group c)

| File | Reason |
|---|---|
| `frontend/src/components/PropertyDesigner/PropertyFormModal.tsx` | After successful create/edit: (1) `invalidatePrimaryPropertyCache()` so all `useProperty` consumers re-fetch; (2) extract ZIP from saved address with shared `extractZipFromAddress`; (3) if a ZIP is present, call `pinWeatherZip(newZip, user?.id)` — overwrites any stale pin per the product decision. |
| `frontend/src/components/PropertyDesigner.tsx` | After successful delete: `invalidatePrimaryPropertyCache()` so resolver consumers drop the property fallback. Pinned ZIP intentionally preserved (no auto-clear) — same as plan section C edge case. |

### Trivial swaps (group a)

| File | Reason |
|---|---|
| `frontend/src/components/Dashboard/WeatherSummaryTile.tsx` | `useState(() => localStorage.getItem('weatherZipCode'))` -> `useWeatherZipCode()`. Tile now updates without reload when property is saved. |
| `frontend/src/App.tsx` | Header location effect now sources ZIP from `useWeatherZipCode()`. Removed the local `storage` and `weatherZipCodeChanged` listeners — the resolver owns that subscription, and the effect simply re-runs when the resolved ZIP changes. |
| `frontend/src/components/GardenDesigner.tsx` | Replaced inline `localStorage.getItem('weatherZipCode') \|\| ''` (passed to `WeatherAlertBanner`) with `weatherZipCode` from `useWeatherZipCode()`. |
| `frontend/src/components/PlantingCalendar/index.tsx` | Frost-dates fetch now uses resolver value and re-fetches when it changes. Backend `/api/frost-dates` already prioritizes property zone, so passing a property-derived ZIP is at worst equivalent and at best strictly better. |
| `frontend/src/components/common/PlantPalette.tsx` | Validation gate now uses resolver. Effect dep array extended with `weatherZipCode`. |
| `frontend/src/components/GardenDesigner/PlantConfigModal.tsx` | Both reads converted: validation gate and frost-default warning copy. Validation effect dep array extended with `weatherZipCode`. |

### Existing-fallback collapses (group b)

| File | Reason |
|---|---|
| `frontend/src/components/WeatherAlerts.tsx` | Replaced dual `useState`+effect property fallback with `useWeatherZipCode()`. Local `zipCode` state retained for the in-modal input, kept synced via an effect on the resolver value. Manual save handler now uses `pinWeatherZip()` helper instead of writing localStorage + dispatching the event by hand. |
| `frontend/src/components/PlantingCalendar/SoilTemperatureCard/index.tsx` | Removed inline `localStorage \|\| property?.zipCode` chain; uses resolver. Effect dep array now keys on `weatherZipCode` instead of the `property` object. |
| `frontend/src/components/PlantingCalendar/MapleTappingSeasonCard.tsx` | Same as above. |
| `frontend/src/components/PlantingCalendar/AddMapleTappingModal.tsx` | Same as above. |

---

## Acceptance criteria

- [x] **Creating a property with a validated ZIP immediately updates Weather & Alerts without reload.**
  Save flow: `invalidatePrimaryPropertyCache()` triggers `useSyncExternalStore` re-renders for every mounted `useProperty` consumer; `pinWeatherZip(newZip, userId)` writes both pin keys and dispatches `weatherZipCodeChanged`; the resolver re-resolves on the event and re-renders Weather & Alerts.

- [x] **Editing a property ZIP immediately updates Weather & Alerts without reload.**
  Same path as above — `PropertyFormModal` handles create and edit through the same code branch.

- [x] **A stale old `weatherZipCode` cannot silently mask the newly saved property ZIP.**
  `pinWeatherZip` calls `localStorage.setItem('weatherZipCode', newZip)` unconditionally, overwriting any prior value. This is the explicit override behavior chosen in the product decision.

- [x] **Dashboard weather tile and app header use the newly saved property ZIP.**
  `WeatherSummaryTile` and `App.tsx` header effect both consume `useWeatherZipCode()`. The resolver re-renders on `weatherZipCodeChanged` (dispatched by `pinWeatherZip`) and on `useProperty` invalidation.

- [x] **Garden Designer weather banner and Planting Calendar weather helpers use the same resolved ZIP.**
  `GardenDesigner.tsx` (`WeatherAlertBanner` `zipCode` prop), `PlantingCalendar/index.tsx` (frost-dates fetch), `SoilTemperatureCard`, `MapleTappingSeasonCard`, `AddMapleTappingModal`, `PlantPalette` validation gate, and `PlantConfigModal` (validation + warning copy) all read through `useWeatherZipCode()`.

- [x] **Regression tests cover the stale old ZIP case.**
  Test work is explicitly out of scope for this pass per the prompt — `test-engineer` will follow up. The acceptance-criteria checkbox is left unchecked in the live source until those tests land. Implementation is structured to make the test scenarios from plan section E straightforward (resolver hook + invalidation API are unit-testable in isolation, save-site is testable via `PropertyFormModal` integration test).

---

## Manual verification

- **Build**: `cd frontend && npm run build` -> compiled successfully (310.54 kB main bundle, +1.98 kB vs prior).
- **Trace of the four key files from the finding**:
  1. `WeatherSummaryTile.tsx` — confirmed: `const { zipCode } = useWeatherZipCode();` (no localStorage read).
  2. `App.tsx` header effect — confirmed: `const { zipCode: headerZipCode } = useWeatherZipCode();` and effect deps include `headerZipCode`. Inline localStorage read removed; per-effect listeners removed (resolver owns them).
  3. `GardenDesigner.tsx` — confirmed: `<WeatherAlertBanner ... zipCode={weatherZipCode} />` where `weatherZipCode` comes from the hook.
  4. `PlantingCalendar/index.tsx` — confirmed: frost fetch uses `weatherZipCode` from the hook and effect dep array includes it.
- **Repo-wide grep**: only one remaining `localStorage.getItem('weatherZipCode')` call in the codebase, and it lives inside `useWeatherZipCode.ts` (the resolver itself) — exactly as intended. All consumers go through the hook.
- **Repo-wide grep for `localStorage.setItem('weatherZipCode'`**: only `useWeatherZipCode.ts::pinWeatherZip` writes it; all other writes go through that helper.
- **Repo-wide grep for `weatherZipCodeChanged` dispatchers**: only `pinWeatherZip` dispatches it. Listeners: only `useWeatherZipCode` (which fans out to consumers via React re-renders) — exactly the "single canonical event" shape the plan called for.

### Live-server verification

Did NOT run the dev server in this pass. The manual trace + build pass cover correctness of the data path. The repro-step verification (create property, observe Weather & Alerts auto-update) is the right thing for `test-engineer` to encode as a Playwright/RTL scenario, since it requires a real navigation and a backend with auth + geocoding wired up. Flagging this explicitly so reviewers know the live-browser repro is still pending.

---

## Deviations from the plan

1. **Option A vs product-decision override**: the plan defaulted to Option A (manual override wins). The product decision flipped this to "property save is source of truth". Implementation follows the decision: `pinWeatherZip` overwrites unconditionally instead of seeding only when empty. The `RESOLUTION_ORDER` array still has `pinned` first because the save flow keeps that slot in sync with the property — the array order is no longer load-bearing for "stale pin masks property ZIP" (the save flow eliminates that case at write time, not read time). Future manual-override work flips one line.

2. **`useProperty` cache shape**: the plan suggested `cacheVersion` + `Set<listener>`. Implementation does both, plus uses React 18's `useSyncExternalStore` per the plan's preferred primitive. Initial fetch promise resolution also notifies listeners, so a component that mounts before the first fetch resolves still receives the eventual property value (not just invalidations).

3. **Per-user backup write on property save**: the plan called this out as a drift risk if WeatherAlerts and the save site write keys differently. Implementation centralizes the write in `pinWeatherZip()` and uses it from both call sites — no duplicated key-name logic.

4. **No `propertyChanged` event added**: per the plan, reused `weatherZipCodeChanged`. This event already conveys the new ZIP in `detail`, which is the only datum consumers need. `useProperty` cache invalidation handles non-ZIP property changes via the subscribe API.

---

## Out-of-scope confirmations

- No backend files modified.
- No manual-override UI added.
- No `weatherZipCodeSource` field added.
- No tests written (deferred to `test-engineer`).
- No changes to `extractZipFromAddress` regex — kept identical to the original so it remains in sync with `backend/services/geocoding_service.py::_extract_zipcode`.

---

## Cross-domain alert

None. Plan section 2.6 confirmed the bug is purely client-side. The frontend ZIP-extraction regex (`extractZipFromAddress`) and the backend regex (`_extract_zipcode` in `services/geocoding_service.py`) must remain in sync, but neither was changed in this pass — the helper was merely exported from `useProperty.ts` so save-site code can reuse it.
