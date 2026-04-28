# Weather ZIP Propagation Regression Tests Report (AUDIT-021)

**Date**: 2026-04-27
**Author**: test-engineer
**Scope**: Jest/RTL regression tests for the AUDIT-021 fix; closes acceptance criterion #6 ("regression tests cover stale old ZIP case") in `weather-zip-propagation-product-decision.md`.
**Source documents**:
- `weather-property-zip-propagation-regression-finding.md`
- `weather-zip-propagation-fix-plan.md` (section E)
- `weather-zip-propagation-product-decision.md`
- `weather-zip-propagation-fix-report.md`

---

## Files added

| File | Tests | Purpose |
|---|---:|---|
| `frontend/src/hooks/__tests__/useProperty.test.tsx` | 4 | Cache invalidation, late-mount property creation, subscribe API, regex helper edge cases. |
| `frontend/src/hooks/__tests__/useWeatherZipCode.test.tsx` | 9 | Resolver precedence, fallback, same-tab + cross-tab event re-renders, unrelated-key guard, `pinWeatherZip` helper write+dispatch contract. |
| `frontend/src/components/PropertyDesigner/__tests__/PropertyFormModal.test.tsx` | 4 | Save-site integration: create pins ZIP, **stale-pin overwrite**, edit (PUT) pin overwrite, no-ZIP address preserves existing pin. |
| `frontend/src/components/__tests__/PropertyDesigner.deleteCacheInvalidation.test.tsx` | 1 | Delete contract: `useProperty` consumers re-render to `null`, pin survives. |

**Total new tests**: 18.

## Files modified

| File | Reason |
|---|---|
| `frontend/src/components/Dashboard/__tests__/WeatherSummaryTile.test.tsx` | Updated one pre-existing test (`renders "Open →" prompt when no zip code is configured`) that asserted "no fetch fires" before `useWeatherZipCode` existed. After AUDIT-021 the tile pulls property via `useProperty`, which is an expected `/api/properties` call. Test now guards the actual intent: no `/api/weather/*` fetch fires without a resolved ZIP. No production code touched. |

## Scenario-to-test mapping (plan section E + prompt's 11 scenarios)

| # | Scenario | Test |
|---:|---|---|
| 1 | `useProperty` returns `null`, then resolves after invalidation | `useProperty.test.tsx` -> `null cache from "no properties yet" updates after invalidation when a property is created` |
| 2 | Pinned ZIP wins over property ZIP (current policy) | `useWeatherZipCode.test.tsx` -> `pinned ZIP wins over property ZIP (precedence)` |
| 3 | Falls back to property ZIP when no pin | `useWeatherZipCode.test.tsx` -> `falls back to property ZIP when no pin is present` |
| 4 | Re-renders on `weatherZipCodeChanged` (same-tab) | `useWeatherZipCode.test.tsx` -> `re-renders consumers when weatherZipCodeChanged fires (same-tab)` |
| 5 | Re-renders on `storage` event (cross-tab) | `useWeatherZipCode.test.tsx` -> `re-renders on storage event (cross-tab)` plus negative case `storage event for unrelated keys does NOT trigger a re-render` |
| 6 | `pinWeatherZip(zip, userId)` writes both keys + dispatches once | `useWeatherZipCode.test.tsx` -> `writes both pin keys and dispatches weatherZipCodeChanged exactly once` (+ null-userId variant + empty-zip no-op) |
| 7 | Successful create pins ZIP, dispatches event | `PropertyFormModal.test.tsx` -> `successful create with ZIP-bearing address pins the new ZIP and dispatches event` |
| 8 | **Stale-pin overwrite (acceptance criterion #6)** | `PropertyFormModal.test.tsx` -> `STALE PIN OVERWRITE — saving a property with a different ZIP replaces the old pinned ZIP` |
| 9 | Edit (PUT) overwrites pin | `PropertyFormModal.test.tsx` -> `edit (PUT) path overwrites the pin with the edited address ZIP` |
| 10 | Save with no ZIP preserves existing pin | `PropertyFormModal.test.tsx` -> `saving a property with NO ZIP in address preserves the existing pin and does not dispatch` |
| 11 | Delete invalidates cache, pin preserved | `PropertyDesigner.deleteCacheInvalidation.test.tsx` -> sole test |

All 11 prompt-required scenarios are covered. No scenarios skipped.

## Implementation notes

- **No production code modified.** Only the existing `WeatherSummaryTile.test.tsx` assertion (one line) was relaxed to reflect the legitimate behavior change introduced by the fix.
- **`useWeatherZipCode.isLoading` quirk**: under the current resolver implementation, `isLoading` stays `true` indefinitely when there is no pin AND no property exists. The resolver cannot distinguish "property fetch in flight" from "property fetch resolved to null". The `returns empty zip + source "none"` test explicitly documents this in a comment so future readers don't think it's a test bug. Production code untouched per the constraint.
- **Delete-site test scope**: PropertyDesigner.tsx is 1900+ lines with dnd-kit, simulation context, and multi-fetch initialization — not feasible to render meaningfully in a unit test. The delete test instead exercises the cache contract that `handleDeleteConfirm` depends on (mounted `useProperty` consumers re-render to `null` after `invalidatePrimaryPropertyCache()`, pinned ZIP survives). The test header documents this approach explicitly. A future Playwright spec covering the live delete flow is tracked under the implementer's flagged out-of-scope item.
- **No Playwright E2E added**: per the prompt's constraint, this pass is Jest/RTL only. The implementer flagged the live-server repro as separate scope.
- **Save-site integration tests do NOT mock `useWeatherZipCode`**: the real resolver runs, the real localStorage writes happen, the real `weatherZipCodeChanged` event fires. Only the network boundary (fetch) is mocked. This makes the stale-pin overwrite assertion an actual end-to-end behavior assertion, not a mock-pattern check.

## Verification

- **Targeted run**: `cd frontend && CI=true npx react-scripts test --watchAll=false -- --testPathPattern="useWeatherZipCode|useProperty|PropertyFormModal|PropertyDesigner.deleteCacheInvalidation"` -> 4 suites, 18 tests, all pass.
- **Full frontend suite**: `cd frontend && CI=true npx react-scripts test --watchAll=false` -> 25 suites, 200 tests, all pass. No regressions in unrelated suites. Pre-existing test count was 182; the +18 delta matches the new-test count exactly.

## Acceptance criterion #6

Before this pass: unchecked, with the fix-report explicitly stating "test work is explicitly out of scope for this pass; `test-engineer` will follow up".

After this pass: the stale-pin overwrite case is covered by `PropertyFormModal.test.tsx -> STALE PIN OVERWRITE`. That test pre-pins `weatherZipCode = '99999'`, drives the modal through a property create with a different ZIP (`03301`), and asserts that both `localStorage.weatherZipCode` and `weatherZipCode__user_7` end up as `'03301'`. Acceptance criterion #6 is now satisfied.

---

## Retest-failure additions (AUDIT-021 second pass)

**Date**: 2026-04-28
**Source documents**:
- `weather-zip-propagation-retest-failure.md` — "Expected Fix Direction" #6 lists three required test scenarios.
- `weather-zip-propagation-retest-fix-report.md` — implementation reference for the validation-zip capture chain (`PropertyFormModal.tsx`) and the `register()` reset (`AuthContext.tsx`).

### Files touched (additions only — nothing replaced)

| File | New tests | Purpose |
|---|---:|---|
| `frontend/src/components/PropertyDesigner/__tests__/PropertyFormModal.test.tsx` | 4 | Validation-ZIP capture chain: capture survives backend formatted_address rewrite, capture cleared on user retype, idempotent on retry after first failure, response-zipcode 4th-source fallback. |
| `frontend/src/contexts/__tests__/AuthContext.test.tsx` (new file) | 3 | `register()` clears stale un-namespaced ZIP, restores per-user backup when present, dispatches `weatherZipCodeChanged` exactly once. |

**Total new tests this pass**: 7. Combined with the prior pass (18), the AUDIT-021 regression coverage is 25 tests across 5 suites.

### Scenario-to-test mapping

| Scenario (from retest-failure spec §"Expected Fix Direction" #6) | Test |
|---|---|
| 1. ZIP-only validation, formatted_address loses the ZIP | `PropertyFormModal.test.tsx` -> `ZIP-only validation: formatted_address loses ZIP, capture-time ref still pins` |
| 2. Validation captured ZIP cleared on user retype | `PropertyFormModal.test.tsx` -> `captured ZIP cleared when user retypes the address without re-validating` |
| 3. First validation fails, second succeeds | `PropertyFormModal.test.tsx` -> `first validation fails, second succeeds: captured ZIP from second attempt pins on save` |
| 4. Backend response zipcode field used as fallback | `PropertyFormModal.test.tsx` -> `backend response zipcode field used as 4th-source fallback when input has no ZIP` |
| 5. Register clears stale un-namespaced ZIP | `AuthContext.test.tsx` -> `register clears stale un-namespaced ZIP when no per-user backup exists` |
| 6. Register restores per-user backup if present | `AuthContext.test.tsx` -> `register restores per-user backup when one exists for the new user id` |
| 7. Register dispatches `weatherZipCodeChanged` exactly once | `AuthContext.test.tsx` -> `register dispatches weatherZipCodeChanged exactly once with post-register state` |

All seven prompt-required scenarios covered. None skipped.

### Production-code findings

**Scenario #4 — backend response zipcode field is consumed.** `PropertyFormModal.tsx` line 254 reads `(data as any).zipcode` from the validate-address response and stores it in `validationResponseZipRef`, the 4th source of the resolution chain. The test exercises this path explicitly: it sends a `formatted_address` with NO 5-digit run AND no input ZIP, so neither the capture-time ref, the saved address, nor the form address can supply a ZIP — only the explicit `zipcode` field can. The pin lands at `60601`, proving the field is read. **No production-code finding needed**: forward-compat path is wired correctly even though the backend doesn't expose `zipcode` today.

**Scenario #2 — `setFormData` bypass for validate-time autofill.** The test confirms that `handleChange` clears the ref when the user retypes, but the validate handler's switch to direct `setFormData` (line 263) means the auto-populate of `formatted_address` does NOT trigger the clear. This is the load-bearing detail for scenario #1 to pass — verified together. **No finding.**

**Scenario #3 — capture is pre-await.** The test asserts `validateCallCount` reaches 1 and the form shows the error UI BEFORE the second click, then re-validates without editing. This confirms the capture happens at the START of every validate click (line 229), not gated behind a successful response. **No finding.**

### Verification

- **Targeted run**: `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="PropertyFormModal|AuthContext"` -> 2 suites, 11 tests (8 PropertyFormModal + 3 AuthContext), all pass.
- **Full frontend suite**: `cd frontend && CI=true npx react-scripts test --watchAll=false` -> 26 suites, 207 tests, all pass.
- **Full-suite count delta**: pre-existing was 200 tests (prior pass baseline). Post-pass 207. Delta +7, matches the new-test count exactly. Zero regressions in unrelated suites.

### Implementation notes

- **No production code modified.** Every assertion runs against the shipped `PropertyFormModal.tsx` and `AuthContext.tsx` after the retest-failure fix.
- **`useWeatherZipCode` not mocked** — the real localStorage writes and `weatherZipCodeChanged` event flow are exercised end-to-end. Only `fetch` is mocked. (Same constraint as the prior test pass.)
- **Fetch route ordering**: `installFetchMock` matches with `routes.find` over substrings. `/api/properties` is a substring of `/api/properties/validate-address`, so validate-address routes are listed first in every PropertyFormModal test that mocks both endpoints. Documented inline in the test file.
- **Retry test (scenario #3) uses a manual fetch mock** instead of `installFetchMock` because it needs call-count-dependent behavior (first call fails, second succeeds). Pattern documented inline.
- **`AuthContext` test harness**: `RegisterHarness` exposes `register` via a controller ref because `AuthProvider` does not render its register function as a UI element. The hook is exercised through the controller, exactly mirroring how a real consumer (the registration form) would call it.
- **`act()` wrapping**: register is wrapped in `await act(async () => ...)` because it issues a fetch and ends with `setUser`, both of which are state updates that React expects inside `act`.
- **`AuthProvider` mount also issues a `/api/auth/check` GET**: each test mocks that endpoint as `401` so the provider settles into an unauthenticated state before the test drives `register`.

