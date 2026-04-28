# Weather ZIP Propagation Fix Plan

**Source of truth**: `dev/active/production-readiness-audit/weather-property-zip-propagation-regression-finding.md`
**Status**: Plan only — no code changes yet.
**Date**: 2026-04-27

---

## 1. Goal

When a user creates or edits a property containing a ZIP, every weather-aware surface should pick up that ZIP without a page reload and without the user re-entering it in Weather & Alerts. Today the resolution rule is split across three patterns (`localStorage` only, `localStorage` + `useProperty` fallback, backend property fallback), and the `useProperty` module-level promise cache cannot be invalidated from app code.

---

## 2. Investigation Results

### 2.1 `useProperty` cache shape and callers

`frontend/src/hooks/useProperty.ts`:
- Module-scoped `let cachedPropertyPromise: Promise<PrimaryProperty | null> | null = null` (line 32).
- Single fetch site: `getPrimaryPropertyPromise()` reuses the resolved promise forever.
- Existing test-only invalidator: `__resetPrimaryPropertyCacheForTests()` (line 79) — explicitly marked "not used by app code".

Callers of `useProperty()` (5 components):
1. `frontend/src/components/WeatherAlerts.tsx`
2. `frontend/src/components/PlantingCalendar/SoilTemperatureCard/index.tsx`
3. `frontend/src/components/PlantingCalendar/MapleTappingSeasonCard.tsx`
4. `frontend/src/components/PlantingCalendar/AddMapleTappingModal.tsx`
5. `frontend/src/hooks/useProperty.ts` (self-reference)

Each caller renders once on initial `null`, then re-renders when its own `useState` updates. Because the cache holds the *resolved promise*, even a cache reset does not retroactively notify mounted components — they need a re-fetch trigger.

### 2.2 Direct `localStorage.getItem('weatherZipCode')` consumers

The finding listed 6; grep confirms **7 distinct read sites** (one component reads it twice):

| # | File | Line | Notes |
|---|---|---|---|
| 1 | `frontend/src/App.tsx` | 166 | Header `locationInfo` effect |
| 2 | `frontend/src/App.tsx` | 195 | `storage` event handler — keep, it's the cross-tab listener |
| 3 | `frontend/src/components/Dashboard/WeatherSummaryTile.tsx` | 22 | `useState` initializer; no fallback |
| 4 | `frontend/src/components/GardenDesigner.tsx` | 2824 | Inline read passed to `WeatherAlertBanner` |
| 5 | `frontend/src/components/common/PlantPalette.tsx` | 160 | Validation gate — early-returns on null |
| 6 | `frontend/src/components/GardenDesigner/PlantConfigModal.tsx` | 644 | Validation gate — same pattern |
| 7 | `frontend/src/components/GardenDesigner/PlantConfigModal.tsx` | 2019 | UI copy in frost-default warning banner |
| 8 | `frontend/src/components/PlantingCalendar/index.tsx` | 191 | Frost-dates fetch (already falls back to `/api/frost-dates`) |
| 9 | `frontend/src/components/WeatherAlerts.tsx` | 16, 22 | Already uses property fallback inline |

(Sites 6, 8, 9 have nearby property/backend fallbacks. The "6 sites" in the finding is correct as a count of distinct fallback-less reads.)

Writers / per-user backup of `weatherZipCode`:
- `frontend/src/components/WeatherAlerts.tsx:203, 206` — sets `weatherZipCode` and `weatherZipCode__user_${user.id}` then dispatches `weatherZipCodeChanged`.
- `frontend/src/contexts/AuthContext.tsx:22, 31` — clears on logout, restores on login.

### 2.3 Existing property-fallback consumers (already mid-migration)

Already use `localStorage.getItem('weatherZipCode') || property?.zipCode` inline (no shared helper):

- `WeatherAlerts.tsx`
- `PlantingCalendar/SoilTemperatureCard/index.tsx`
- `PlantingCalendar/MapleTappingSeasonCard.tsx`
- `PlantingCalendar/AddMapleTappingModal.tsx`

Each rolls its own — same expression, four copies. Safe to converge on a single hook.

### 2.4 `weatherZipCodeChanged` event listeners and dispatchers

- **Listener**: `App.tsx:223` (header `locationInfo` only).
- **Dispatcher**: `WeatherAlerts.tsx:209` (only on manual save in Weather & Alerts).

This event is currently scoped to "manual ZIP entry in Weather & Alerts". Most components do *not* listen to it, so they only refresh on a route change or hook re-mount. We will reuse and broaden it.

### 2.5 Property save sites

- **Single save site**: `frontend/src/components/PropertyDesigner/PropertyFormModal.tsx:124-126` handles both create (`POST /api/properties`) and edit (`PUT /api/properties/:id`).
- Mounted from: `frontend/src/components/PropertyDesigner.tsx:1849` only.
- Delete site: `PropertyDesigner.tsx:570` (`apiDelete`) — not relevant for ZIP propagation but should also invalidate the cache (deleting the only property invalidates the ZIP fallback).

No other create/edit modal exists. No settings screen mutates property ZIP today.

### 2.6 Backend property ZIP exposure

- `Property` model has no dedicated `zip_code` column. ZIP is extracted from `address` in two places:
  - Backend `services/geocoding_service.py::_extract_zipcode` (regex `\b\d{5}\b`)
  - Frontend `useProperty.ts::extractZipFromAddress` (regex matches the same shape)
- `/api/properties` returns the raw `address` string; the frontend hook does the extraction client-side.
- Weather endpoints (`/api/weather/current`, `/api/weather/forecast`, `/api/maple-tapping/season-estimate`, `/api/soil-temperature/...`) all take `zipcode=` query params. They do **not** auto-resolve from property latitude/longitude.
- `/api/frost-dates` already accepts an optional `zipcode` and falls back to property zone server-side (priority: property frost dates > property zone > zipcode-derived zone > Zone 5b default).

Implication: the bug is purely client-side. There is no backend "use the property ZIP" path for the weather endpoints — every fetch must pass an explicit ZIP from the frontend resolver.

---

## 3. Plan

### A. Canonical resolver: `useWeatherZipCode()`

**New file**: `frontend/src/hooks/useWeatherZipCode.ts`

**Public API**:
```ts
export interface WeatherZipResolution {
  zipCode: string;            // '' if no zip available
  source: 'pinned' | 'property' | 'none';
  isLoading: boolean;         // true until useProperty resolves
}

export function useWeatherZipCode(): WeatherZipResolution;
```

**Precedence (encoded as a single ordered array, swap order to flip policy)**:
```ts
const RESOLUTION_ORDER: ResolutionStep[] = [
  () => readPinnedZip(),       // localStorage.getItem('weatherZipCode')
  (prop) => prop?.zipCode,     // primary property ZIP
];
```
Changing precedence is a one-line array reorder.

**Internal behavior**:
- Calls `useProperty()` internally.
- Subscribes to: `weatherZipCodeChanged` (CustomEvent) and the `storage` event (for `weatherZipCode` key, cross-tab).
- Returns `''` and `source: 'none'` when nothing is available; consumers gate fetches on `zipCode` truthiness.
- `isLoading` is `true` while `useProperty()` is still resolving AND there is no pinned ZIP (so consumers can avoid a flash of empty state).

**Recommendation: Option A (manual override wins)** — keep current behavior. Rationale: the per-user pinned ZIP is the only place users have ever been able to override the property ZIP (e.g., to check weather at a different homestead site). Silently overwriting it on property save (Option B) is a destructive action; prompting (Option C) adds modal UX work outside this fix's scope. Option A also matches what existing fallback consumers already do. The resolver array makes a future swap a one-line change.

### B. `useProperty` invalidation API

**Edits to**: `frontend/src/hooks/useProperty.ts`.

**New exports** (rename the existing test-only helper to be the real API):
```ts
/** Clears the cached property promise so the next render re-fetches. */
export function invalidatePrimaryPropertyCache(): void;

/** Subscribe to invalidation events; returns unsubscribe. */
export function subscribePrimaryPropertyChanged(listener: () => void): () => void;
```

**Internal changes**:
- Replace the module-scoped `cachedPropertyPromise` with a `cacheVersion` counter and a `propertyChangedListeners: Set<() => void>`.
- `invalidatePrimaryPropertyCache()` clears the cached promise, bumps `cacheVersion`, and notifies listeners.
- `useProperty()` adds `cacheVersion` to its `useEffect` deps via `useSyncExternalStore` (or a simple `useState` + subscribe pattern) so all mounted instances re-render with the new fetch result.
- Keep `__resetPrimaryPropertyCacheForTests` as an alias that delegates to `invalidatePrimaryPropertyCache` for backward compat with existing tests.

**Callers of `invalidatePrimaryPropertyCache()`**:
1. `PropertyFormModal.tsx` — after successful create or edit response.
2. `PropertyDesigner.tsx` — after successful delete (`handleDeleteConfirm`).
3. (Future) any settings screen that mutates property data.

### C. Notification mechanism on property save

**Reuse `weatherZipCodeChanged`** — do not add a new event. Justification:
- The existing event is already wired for "header should refresh weather". Dispatching it on property save with the new ZIP makes every existing listener "just work" without per-listener refactor.
- Adding a second event (`propertyChanged`) would force every weather consumer to register two listeners with overlapping semantics.
- The event's `detail` already conveys the new ZIP string, which is the only datum consumers need for re-fetching weather.

**New behavior on property save** (in `PropertyFormModal.tsx` success path):
1. Call `invalidatePrimaryPropertyCache()` first (synchronous, no I/O).
2. Compute the new ZIP from the saved property's `address` using the same regex helper as `useProperty`. Export `extractZipFromAddress` from `useProperty.ts` so save sites and the resolver share one regex.
3. **Option A semantics** (recommended): if `localStorage.weatherZipCode` is empty AND a property ZIP was extracted, seed `localStorage.weatherZipCode` with it and dispatch `weatherZipCodeChanged` with `detail: newZip`. If a pinned ZIP already exists, leave it alone but **still dispatch the event with `detail: pinnedZip`** so subscribers re-render (`useProperty` invalidation alone is enough for property-fallback consumers; the dispatch is for resolver consistency and the `App.tsx` location header).
4. Edge case: edit changes the property ZIP and the user has *no* pinned ZIP. Property-fallback path activates automatically once `useProperty` re-fetches.
5. Edge case: edit *removes* the address (so no ZIP). `invalidatePrimaryPropertyCache()` runs; resolver returns `source: 'none'` for unpinned users.

The per-user backup key (`weatherZipCode__user_${user.id}`) should also be written when seeding, mirroring `WeatherAlerts.tsx:206`. Centralize this write in a small helper (`pinWeatherZip(zip, userId)`) co-located with the resolver hook so future writers don't drift.

### D. Migration list

**(a) Trivial swap to the new resolver** — replace `const z = localStorage.getItem('weatherZipCode') || ''` with `const { zipCode } = useWeatherZipCode()`:

| File | Site |
|---|---|
| `frontend/src/components/Dashboard/WeatherSummaryTile.tsx` | line 22, the `useState` initializer becomes the hook return |
| `frontend/src/App.tsx` | lines 166, 195 — header `locationInfo` effect; keep the storage listener for cross-tab, but the primary read uses the resolver |
| `frontend/src/components/GardenDesigner.tsx` | line 2824 — pass `zipCode` from the hook to `WeatherAlertBanner` |
| `frontend/src/components/common/PlantPalette.tsx` | line 160 — validation gate |
| `frontend/src/components/GardenDesigner/PlantConfigModal.tsx` | lines 644, 2019 — validation gate and frost-default warning copy |
| `frontend/src/components/PlantingCalendar/index.tsx` | line 191 — frost-dates fetch |

**(b) Needs care because of existing fallback logic** — collapse the inline `|| property?.zipCode` into the new hook (drop the local `useProperty()` call when the resolver already covers it):

| File | Notes |
|---|---|
| `frontend/src/components/WeatherAlerts.tsx` | Replace the dual `useState` + property effect (lines 13–25) with a single `useWeatherZipCode()` call. **Keep** the manual save handler (lines 203–209) — it remains the single canonical ZIP-pinning UI. Change it to use the new `pinWeatherZip()` helper. |
| `frontend/src/components/PlantingCalendar/SoilTemperatureCard/index.tsx` | Replace inline expression at line 67. |
| `frontend/src/components/PlantingCalendar/MapleTappingSeasonCard.tsx` | Replace inline expression at line 39 and remove the `[property]` dep manual workaround. |
| `frontend/src/components/PlantingCalendar/AddMapleTappingModal.tsx` | Replace inline expression at line 112; same `[property]` dep cleanup. |

**(c) Save sites** — invalidate cache + seed/dispatch:

| File | Change |
|---|---|
| `frontend/src/components/PropertyDesigner/PropertyFormModal.tsx` | After `await response.json()` on success: `invalidatePrimaryPropertyCache()`, extract ZIP from saved address, conditionally pin + dispatch per Option A rules (section C). |
| `frontend/src/components/PropertyDesigner.tsx` | After delete success (around line 581 where `loadData()` is called): `invalidatePrimaryPropertyCache()`. Do not auto-clear the pinned ZIP — Option A says manual override survives. |

### E. Regression test list

Test environment: React Testing Library + Jest. New test file: `frontend/src/hooks/__tests__/useWeatherZipCode.test.tsx`. Augment existing `WeatherSummaryTile.test.tsx` and add `PropertyFormModal.test.tsx`.

Required scenarios (from the finding's section 6 + Repro Steps stale-pin):

1. **Late-mount property creation**: render a weather-aware component first (gets `null` from `useProperty`), then create a property; assert the resolver re-resolves to the new ZIP and the consumer re-fetches with it.
2. **Weather & Alerts no-manual-pin**: account with a property and no pinned ZIP. Mount `WeatherAlerts`, assert it uses the property ZIP without user input.
3. **Dashboard tile uses property ZIP**: `WeatherSummaryTile` renders with property ZIP when no pinned ZIP exists; today it returns the empty-state card.
4. **Garden Designer / Planting Calendar follow same resolver**: both pass property ZIP to weather banner / frost fetch when no pin.
5. **Stale-pin case**: pinned ZIP `12345`, edit property to ZIP `54321`. Under Option A, pinned `12345` survives. Add an assertion that `weatherZipCodeChanged` still fires (so subscribers can no-op refresh) and that `useProperty` cache invalidates so a future un-pin reveals `54321` immediately.
6. **Delete property**: with no pinned ZIP, after deleting the only property, resolver returns `source: 'none'` and consumers degrade to empty state without reload.
7. **Cross-tab `storage` event**: pinning ZIP in tab A still propagates to tab B (existing behavior must not regress).
8. **Login restoration**: per-user backup `weatherZipCode__user_${id}` still restores on login (existing AuthContext path must keep working).

### F. Risk callouts

1. **Precedence flip risk**: If product later picks Option B (property overwrites manual pin on save), users with intentionally-different pinned ZIPs (testing, secondary location) will silently lose them. The resolver order array isolates this to one line, but a destructive change still warrants a confirmation modal and an audit-log entry. Defer until product confirms.
2. **`useSyncExternalStore` vs simple subscription**: React 18 ships `useSyncExternalStore` and it's the correct primitive for module-scoped caches. If the codebase isn't already using it elsewhere, a `useState` + custom subscribe pattern works but tearing is theoretically possible during transitions. Low risk for this app (no concurrent rendering features in use), but `useSyncExternalStore` is preferred.
3. **Backend assumes a specific ZIP source**: weather endpoints take any ZIP via query param — no backend refactor needed. `/api/frost-dates` independently consults property zone first (priority 1–2) before falling back to the supplied ZIP, so frontend changes cannot regress its property-aware behavior.
4. **Multi-property support**: `useProperty()` is hardcoded to "first property in `/api/properties`" (`properties[0]`). If multi-property selection lands later, the resolver must take a `propertyId` argument or read an "active property" context. This plan does not block that — keep the resolver signature stable now and add an `activePropertyId` hook input later.
5. **Per-user backup key drift**: `WeatherAlerts.tsx` writes both `weatherZipCode` and `weatherZipCode__user_${user.id}`. The new save-site seeding logic must do the same (or both writers must call a shared `pinWeatherZip(zip, userId)` helper) — otherwise login-time restoration breaks for users seeded by property save but never by manual pin.
6. **`PlantingCalendar/index.tsx` frost fetch**: switching this site to the resolver subtly changes when the fetch fires (previously: only when localStorage had a value, otherwise no-zip path; after: when resolver has any ZIP, including property fallback). The backend already prioritizes property zone over `zipcode` param, so behavior should be at worst equivalent and at best strictly better. Add a regression test that frost-date source resolution still prefers `'property'` over `'zipcode'` when both are available.
7. **`PropertyDesigner.tsx` already calls `loadData()` on save success**: this re-fetches the local property list but does NOT touch the `useProperty` module cache. Make sure the invalidation hook is called in addition to `loadData()`, not as a substitute.

---

## 4. Sequencing for implementation

Sequential because frontend hooks must exist before consumers swap to them:

1. Backend-debugger: no work. (Skip.)
2. Frontend-debugger #1: create `useWeatherZipCode.ts`; refactor `useProperty.ts` to expose `invalidatePrimaryPropertyCache()` and a subscribe API; add `pinWeatherZip` helper. No call-site changes yet.
3. Frontend-debugger #2 (parallelizable in two halves): swap call sites in groups (a) and (b).
4. Frontend-debugger #3: update save sites in group (c) — `PropertyFormModal.tsx` and `PropertyDesigner.tsx` delete path.
5. Test-engineer: write the 8 regression scenarios in section E.
6. `sync-validator`: confirm no backend/frontend ZIP-extraction regex drift (the two `_extract_zipcode` regexes must remain in sync; consider a comment in both files cross-referencing each other).
7. `code-review` and `build-check` to close.

---

## 5. Open product question (block before step 4)

Before merging the save-site changes (group c), confirm Option A is acceptable. If product chooses Option B or C:

- Option B: change the `RESOLUTION_ORDER` array order in step 2 *and* change save logic to overwrite-instead-of-seed. Both are one-line edits in the prepared resolver design.
- Option C: add a confirmation modal between save success and the dispatch. Modal lives in `PropertyFormModal.tsx` (or a small shared `ConfirmZipUpdateModal`).
