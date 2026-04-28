# Weather ZIP Propagation Fix — Code Review (AUDIT-021)

**Reviewer:** code-review agent
**Date:** 2026-04-27
**Scope:** the migration list in the user prompt (the AUDIT-021 fix). Pre-existing working-tree noise (CLAUDE.md, backend bp diffs, etc.) is intentionally ignored.

---

## Build & Test Status

| Check | Result |
|---|---|
| `cd frontend && npm run build` | **PASS** — "Compiled successfully." (exit 0) |
| `cd frontend && CI=true npx react-scripts test` (in-scope suites) | **PASS** — 19/19 in 4 suites (`useWeatherZipCode`, `PropertyFormModal`, `WeatherSummaryTile`, `PropertyDesigner.deleteCacheInvalidation`) |

---

## CLAUDE.md Compliance

| Rule | Status | Notes |
|---|---|---|
| Case conversion at API boundary | PASS | `PropertyFormModal` builds an explicit snake_case payload (`soil_type`, etc.). Backend response is read as both `address` and `formatted_address` defensively. |
| No hardcoded URLs | PASS | `App.tsx` header effect uses `${API_BASE_URL}/api/weather/current`; `WeatherSummaryTile` uses `${API_BASE_URL}/...`. All other call sites in scope go through `apiGet`/`apiPost` or relative `/api/...` paths consistent with the rest of the codebase. |
| `parseLocalDate` for date strings | N/A — fix touches no date strings |
| NULL-vs-falsy on nullable numerics | One MINOR (see F-MIN-1) |

---

## Single-Source-of-Truth Verification

Grep results (`localStorage.(getItem\|setItem).*weatherZip`, excluding tests):

- **Writes to `localStorage.weatherZipCode`** — only `useWeatherZipCode.ts::pinWeatherZip` (lines 118, 120). PASS.
- **Reads of `localStorage.weatherZipCode`** — only `useWeatherZipCode.ts::readPinnedZip` (line 44). PASS.
- **`weatherZipCodeChanged` dispatch** — only `useWeatherZipCode.ts::pinWeatherZip` (line 126). PASS.
- **`weatherZipCodeChanged` listeners** — only `useWeatherZipCode.ts` subscribe effect (lines 85–89). PASS.

`AuthContext.tsx` (lines 22, 31, 64–69, 91–96, 105–110, 119) reads/writes `weatherZipCode` and the per-user backup as part of the login/logout/session-resume lifecycle. This is **out of scope of the resolver SSOT** by design: it's the auth lifecycle owner of those keys, not a weather consumer. Acceptable — but worth a note (see F-MIN-2).

`WeatherAlerts.tsx` no longer touches localStorage directly; the manual save now calls `pinWeatherZip(zipCode, user?.id ?? null)` (line 200). PASS.

---

## Race Conditions & Event Leaks

### `useWeatherZipCode` (subscribe effect, lines 80–91)

- Both `weatherZipCodeChanged` and `storage` listeners are removed in the cleanup return. No leak.
- Empty deps `[]` is correct — `bump` is stable and the resolver re-reads on every render.
- The `setPinTick((t) => t + 1)` callback form avoids stale-closure issues on the unrelated-key test.
- **Duplicate dispatch risk**: `pinWeatherZip` dispatches exactly once per call. The PropertyFormModal save flow calls it at most once per save. The hook test (`writes both pin keys and dispatches weatherZipCodeChanged exactly once`) explicitly asserts cardinality. PASS.

### `useProperty` (`useSyncExternalStore`)

- `subscribe` adds the listener to `propertyChangedListeners`; the returned cleanup deletes it. No leak.
- `getSnapshot` returns the module-scoped `cachedProperty` reference. Identity stays stable across renders unless `invalidatePrimaryPropertyCache` runs and a fresh fetch resolves to a new object. `useSyncExternalStore` requires snapshot identity stability — that's satisfied.
- `getServerSnapshot` returns `null`, which matches the loading-state contract.
- **Subtle but acceptable**: between `invalidatePrimaryPropertyCache()` and the fetch resolving, `cachedProperty` is `null`. Consumers see a transient `null`, then re-render with the new value when the fetch's `.then` runs and notifies. This is the documented intent and matches the test (`PropertyDesigner.deleteCacheInvalidation` asserts the consumer transitions to `null`). PASS.

### Cross-tab `storage` event

- The listener guards `e.key === 'weatherZipCode'` (line 83) — confirmed correct by the explicit "unrelated key does NOT trigger re-render" test (lines 149–178). PASS.

---

## Stale-Pin Overwrite Trace

`PropertyFormModal.tsx::handleSubmit` (lines 104–162):

1. POST/PUT to `/api/properties` (line 128–130).
2. `await response.json()` → `savedProperty` (line 137).
3. `invalidatePrimaryPropertyCache()` (line 147).
4. Resolve address: `savedProperty.address ?? savedProperty.formatted_address ?? formData.address` (line 148).
5. `extractZipFromAddress(savedAddress)` (line 149).
6. `if (newZip) pinWeatherZip(newZip, user?.id ?? null)` (lines 150–152).

**Order is correct**: invalidate THEN pin. A consumer that re-renders from the invalidate notification reads the new pin (because `pinWeatherZip` then dispatches `weatherZipCodeChanged` after writing to localStorage). The two notifications collapse into at most two re-renders, both producing the same final `{ zipCode: <newZip>, source: 'pinned' }` resolution.

**Unconditional**: there is NO guard like `if (oldPin !== newZip)` — the pin runs every save where the address yields a ZIP. PASS.

The integration test `STALE PIN OVERWRITE` (test #2 in `PropertyFormModal.test.tsx`, lines 125–160) asserts the symptom directly: pre-pins `99999`, saves a property whose address contains `03301`, asserts both `weatherZipCode` and the per-user backup end up `03301`. **This is not tautological** — it tests the full handler path through real `pinWeatherZip` (not a mock). PASS.

---

## Findings

### BLOCKER
None.

### MAJOR

**F-MAJ-1 — `useWeatherZipCode.isLoading` is permanently true when there is no pin and no property** *(known issue, confirmed)*
- **Location:** `frontend/src/hooks/useWeatherZipCode.ts:99–100`
- **Symptom:** When `localStorage.weatherZipCode` is unset AND `useProperty()` resolves to `null` (no property exists OR `/api/properties` failed), `isLoading` evaluates to `!zip && !pinned && property === null` → `true && true && true` → `true`. The fetch has resolved (with `null`), but the hook cannot distinguish "still loading" from "loaded, no result".
- **Root cause:** `useProperty()` collapses three states (loading, resolved-empty, error) into a single `null` snapshot. `isLoading` therefore has no way to flip to `false`.
- **Impact assessment:** The hook test at lines 85–101 explicitly documents this — `zipCode === ''` and `source === 'none'` are asserted; `isLoading` is intentionally NOT asserted because the contract is broken. Audit of in-scope consumers shows **no consumer reads `isLoading`**:
  - `App.tsx` only destructures `zipCode`.
  - `WeatherSummaryTile.tsx` only destructures `zipCode`.
  - `PlantingCalendar/*` only destructure `zipCode`.
  - `WeatherAlerts.tsx`, `PlantPalette.tsx`, `PlantConfigModal.tsx` only destructure `zipCode`.
- **Verdict:** **Not a shipping blocker** for AUDIT-021 because no consumer relies on the field. The user-visible UX is correct. Demote to MAJOR (not BLOCKER) with an explicit follow-up.
- **Smallest viable fix (do not implement now):** Have `useProperty` expose a tri-state — either return `{ data, status: 'loading' | 'resolved' | 'error' }`, or expose a sibling `usePropertyStatus()` hook. Then `useWeatherZipCode` computes `isLoading = !zip && !pinned && propertyStatus === 'loading'`. Cheaper alternative: add a module-scoped `propertyResolved: boolean` flag in `useProperty.ts` that flips to `true` after the first fetch settles (success OR failure), expose `__getPrimaryPropertyResolved()`, and use it in the `isLoading` calc.
- **Recommendation:** ship as-is; file follow-up to fix before any consumer reads `isLoading`.

### MINOR

**F-MIN-1 — Falsy-coercion on `latitude`/`longitude` in PropertyFormModal payload**
- **Location:** `frontend/src/components/PropertyDesigner/PropertyFormModal.tsx:120–121`
- **Code:** `latitude: formData.latitude || null, longitude: formData.longitude || null`
- **Issue:** `0 || null` → `null`. Lat 0 / Lng 0 (Gulf of Guinea, "Null Island") gets coerced. CLAUDE.md explicitly forbids falsy checks on nullable numeric fields (Constraint #5).
- **Real-world impact:** ~0 — no homestead is at lat 0,lng 0.
- **Suggested fix:** `latitude: formData.latitude != null ? formData.latitude : null` (or `?? null` since the form types lat/lng as `number | undefined`).
- **Pre-existing or new?** Pre-existing — not introduced by this fix. Flagging because it sits in a file the fix touched.

**F-MIN-2 — `AuthContext` knows the literal key `'weatherZipCode'`**
- **Location:** `frontend/src/contexts/AuthContext.tsx:22, 31`
- **Issue:** The auth lifecycle hardcodes `'weatherZipCode'` and the `__user_${id}` suffix shape, duplicating knowledge that lives in `useWeatherZipCode.ts`. If the key name ever changes, both files must update.
- **Why this isn't a blocker:** AuthContext is the lifecycle owner (login/logout/session-resume) — it has a legitimate need to manipulate the keys. The fix didn't introduce this.
- **Suggested follow-up:** Export `WEATHER_ZIP_KEY` and `weatherZipPerUserKey(userId)` constants from `useWeatherZipCode.ts` and have AuthContext consume them. Out-of-scope for AUDIT-021.

### NIT

**F-NIT-1 — Empty-string ZIP from localStorage is treated as absent**
- **Location:** `useWeatherZipCode.ts:57` — `pinned && pinned.trim() ? pinned.trim() : null`
- **Note:** Empty string is correctly treated as no-pin (falls through to property). `pinWeatherZip('')` is also a no-op (line 116). Consistent. No change needed.

**F-NIT-2 — `void pinTick` (line 94)**
- **Location:** `useWeatherZipCode.ts:94`
- **Note:** The comment makes it clear this is to satisfy lint; the actual re-render happens via `setPinTick`. Slightly unusual idiom but not wrong. Could replace with a `useReducer(x => x + 1, 0)` "rev" pattern for clarity. NIT only.

**F-NIT-3 — `PropertyFormModal` resolves saved address with `??` then falls back to `formData.address`**
- **Location:** `PropertyFormModal.tsx:148`
- **Note:** If the backend response omits `address` entirely, the modal falls back to the user-typed address. Reasonable fallback. The integration tests cover both ZIP-bearing and no-ZIP branches. PASS.

---

## Test Quality

| # | Test | Asserts the right invariant? |
|---|---|---|
| 1 | `useWeatherZipCode` — pinned wins over property | YES — checks both source and zipCode |
| 2 | `useWeatherZipCode` — falls back to property ZIP | YES |
| 3 | `useWeatherZipCode` — empty zip + 'none' when neither | YES (explicitly punts on `isLoading` — see F-MAJ-1) |
| 4 | `useWeatherZipCode` — re-renders on `weatherZipCodeChanged` | YES — same-tab event path |
| 5 | `useWeatherZipCode` — re-renders on `storage` event | YES — cross-tab path |
| 6 | `useWeatherZipCode` — unrelated key does NOT re-render | YES — guards against over-broad listener (regression guard) |
| 7 | `pinWeatherZip` — both keys + dispatch exactly once | YES — cardinality assertion is the right level of paranoia |
| 8 | `pinWeatherZip` — null userId skips per-user backup | YES |
| 9 | `pinWeatherZip` — empty zip is no-op | YES |
| 10 | `PropertyFormModal` — create with ZIP pins + dispatches | YES — full integration, real `pinWeatherZip` |
| 11 | **`PropertyFormModal` — STALE PIN OVERWRITE** | **YES — asserts user-reported symptom** (see Stale-Pin Overwrite Trace above). Pre-pins `99999`, saves `03301`, asserts post-state is `03301`. Not tautological. |
| 12 | `PropertyFormModal` — edit (PUT) overwrites pin | YES — separate path from create |
| 13 | `PropertyFormModal` — no-ZIP address preserves pin + no dispatch | YES — negative-path coverage |
| 14–16 | `WeatherSummaryTile` no-zip / has-zip / both-fetches | YES — the no-zip case correctly asserts no `/api/weather/...` fetch fires |
| 17 | `WeatherSummaryTile` — frost-risk above 36°F | YES (orthogonal but in-scope) |
| 18 | `PropertyDesigner` delete contract | YES — asserts both halves of the documented contract: cache invalidates AND pin survives |

**Tautology check:** Test 11 (stale-pin overwrite) is the user's reported bug. It asserts the symptom (pin value after save) end-to-end, not "pinWeatherZip was called". GOOD.

The 19th test (test #16's helper variant in WeatherSummaryTile) is fine; counted in totals.

---

## Out-of-Scope Drift

In-scope files match the migration list 1:1. The other modified files in `git diff --name-only` (backend blueprints, `GardenDesigner/PlannedPlantsSection.tsx`, `GardenPlanner.tsx`, `IndoorSeedStarts.tsx`, etc.) are pre-existing working-tree state from prior unrelated work — **not** introduced by AUDIT-021 and explicitly excluded per the user's prompt.

No drift detected.

---

## GOOD Patterns Observed

- `useWeatherZipCode` uses a `RESOLUTION_ORDER` array with explicit comments — future precedence flips are a one-line array reorder. Idiomatic and self-documenting.
- `useProperty` uses `useSyncExternalStore` correctly: `getSnapshot` returns a stable reference, `subscribe` returns a real cleanup, `getServerSnapshot` returns `null` for SSR safety.
- `pinWeatherZip` swallows quota / disabled-storage errors silently and STILL dispatches the event — degrades gracefully without breaking same-tab listeners.
- `PropertyFormModal` defensively reads `savedProperty.address ?? savedProperty.formatted_address ?? formData.address` so it works whether the backend echoes the typed address or normalizes it.
- The tests do NOT mock `useWeatherZipCode` — the real resolver observes the real localStorage writes and event dispatches. This is exactly the right test depth for an integration contract.
- `App.tsx` header effect uses `cancelled` flag for fetch cleanup — no setState-after-unmount.

---

## Verdict

**APPROVE WITH FOLLOW-UPS**

The fix is correct, the SSOT contract holds, the stale-pin overwrite is properly tested, and both build and test suites pass. F-MAJ-1 (`isLoading` permanently true) is real but harmless because no consumer reads the field — file as a follow-up before any consumer starts depending on it. F-MIN-1 (falsy lat/lng coercion) is pre-existing and not in scope.

Ship it.
