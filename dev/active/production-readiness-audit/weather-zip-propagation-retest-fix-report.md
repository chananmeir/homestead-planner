# Weather ZIP Propagation Retest Fix Report (AUDIT-021)

**Date**: 2026-04-28
**Author**: frontend-debugger
**Spec sources**:
- `weather-zip-propagation-retest-failure.md` (the spec)
- `weather-zip-propagation-fix-report.md` (first-pass shipped)
- `weather-zip-propagation-product-decision.md` (property save is source of truth)

---

## Summary

Two retest failures fixed:

1. **ZIP stripped before save** — when the backend's `formatted_address` does not contain the original ZIP (typical of ZIP-only fallback lookups returning strings like `"Chicago, IL"` for input `60601`), the prior implementation overwrote the form's `address` field via `handleChange`, leaving no ZIP for `extractZipFromAddress(savedAddress)` to find on save. `pinWeatherZip` was never called, so Weather & Alerts and Dashboard kept stale state.
2. **Register inherits prior user's ZIP** — `AuthContext.register()` only called `setUser(data.user)`. Any leftover `localStorage.weatherZipCode` from a previous browser session/user remained, and weather resolvers continued to surface that ZIP for the new account until something explicitly overwrote it.

---

## Files changed

| File | Reason |
|---|---|
| `frontend/src/components/PropertyDesigner/PropertyFormModal.tsx` | Capture validated ZIP from the user-entered address BEFORE awaiting the validate-address backend, persist across renders via two `useRef`s, clear on user-typed address change, and consume in a 4-step ordered chain at save time. Also switched validation auto-populate to `setFormData` directly instead of `handleChange` so the on-change-clear side effect does not wipe the just-captured ZIP. |
| `frontend/src/contexts/AuthContext.tsx` | `register()` now mirrors the login/session-resume pattern: clears `localStorage.weatherZipCode` (or restores from `weatherZipCode__user_${userId}` if a per-user backup exists for the new account), then dispatches `weatherZipCodeChanged` so resolver consumers re-evaluate and fall through to the property fallback. |

No backend changes (per scope). No test changes (deferred to `test-engineer`). No new override UI.

---

## ZIP-resolution chain (exact line numbers)

`PropertyFormModal.tsx`:

- **Capture site** (lines 197–203, inside `handleValidateAddress`): `const capturedZip = extractZipFromAddress(formData.address);` then `lastValidationZipRef.current = capturedZip;` — runs BEFORE `await apiPost(...)`. The user-entered ZIP is captured at the moment Validate is clicked.
- **Backend response 4th source** (lines 222–226): `validationResponseZipRef.current` set from a future explicit `data.zipcode` field if present, otherwise from `extractZipFromAddress(data.formatted_address)` (defensive — covers the case where the backend echoes the ZIP in the formatted address).
- **Clear-on-edit** (lines 184–186, inside `handleChange` for `address`): both refs cleared. The validate handler bypasses `handleChange` for the formatted_address write so the just-captured ZIP survives.
- **Reset-on-modal-open** (lines 86–88): both refs cleared whenever the modal (re)opens — a fresh form session must not carry over a previous attempt's capture.
- **Resolution chain at save** (lines 168–172, inside `handleSubmit`):

```ts
const newZip =
  lastValidationZipRef.current
  || extractZipFromAddress(savedAddress)
  || extractZipFromAddress(formData.address)
  || validationResponseZipRef.current
  || null;
```

This matches the failure doc's "Expected Fix Direction #4" exactly:
1. ZIP captured from the validation request input (highest priority).
2. ZIP extracted from the saved property address (current behavior, now downgraded to #2).
3. ZIP extracted from the current form address.
4. ZIP from the backend validation response, only if exposed.

`AuthContext.tsx` `register()` (lines 131–150): clears the un-namespaced `weatherZipCode` key when no per-user backup exists, restores it when one does, and unconditionally dispatches `weatherZipCodeChanged` so `useWeatherZipCode` consumers re-evaluate.

---

## Acceptance criteria

- [x] **ZIP-only validated property setup pins the ZIP even if the displayed formatted address does not include the ZIP.**
  Source #1 of the chain (`lastValidationZipRef`) is captured from `formData.address` BEFORE the backend response can rewrite the form. For input `60601`, that capture is `"60601"`. Even when the backend response replaces the form's address with `"Chicago, IL"`, `pinWeatherZip("60601", userId)` runs at save time.

- [x] **Freshly registered users do not inherit prior users' weather ZIP state.**
  `register()` removes `localStorage.weatherZipCode` (or restores from a per-user backup if one exists) and dispatches `weatherZipCodeChanged`. The resolver re-evaluates immediately. With no pin and no property yet, `useWeatherZipCode()` returns `{ zipCode: '', source: 'none' }`. Once the new property is created, the save flow's chain pins the new ZIP.

- [x] **A first validation failure followed by a successful retry still pins the ZIP on property save.**
  The capture happens at the START of every validate click (line 198, inside `handleValidateAddress`, before `await`). The first failed validate writes the captured ZIP into the ref. The second successful validate overwrites the ref with the same (or refined) capture from the unchanged form input. The ref retains the value through save. Any address edit between attempts clears the ref via `handleChange` — captured ZIP describes the input that was actually sent for validation, never a stale prior input.

- [ ] **User retest confirms the fresh-user/new-property path updates Dashboard and Weather & Alerts without reload.**
  User-driven; cannot be completed by the agent. Left unchecked per the prompt instruction.

---

## Manual scenario traces

**(a) `90210 Beverly Hills` — typical with-ZIP input**
1. User types `"90210 Beverly Hills"`. `handleChange('address', ...)` clears `lastValidationZipRef`.
2. User clicks Validate. `extractZipFromAddress("90210 Beverly Hills")` returns `"90210"` -> `lastValidationZipRef.current = "90210"`.
3. Backend returns `formatted_address: "Beverly Hills, CA 90210, USA"`. `setFormData(prev => ({ ...prev, address: "Beverly Hills, CA 90210, USA" }))`. Note: bypasses `handleChange`, so the ref is preserved.
4. User clicks Save. Resolution chain: source 1 = `"90210"` -> `pinWeatherZip("90210", userId)` runs. Pass.

**(b) `60601` — ZIP-only input where formatted_address loses the ZIP**
1. User types `"60601"`. ref stays null.
2. User clicks Validate. `extractZipFromAddress("60601")` returns `"60601"` -> ref captured.
3. Backend returns `formatted_address: "Chicago, IL"` (no ZIP). `setFormData(...)` writes `"Chicago, IL"` to the form.
4. User clicks Save.
   - `savedProperty.address = "Chicago, IL"` -> `extractZipFromAddress(savedAddress)` is `null`.
   - `extractZipFromAddress(formData.address)` is `null`.
   - But source 1 = `"60601"` from the ref -> `pinWeatherZip("60601", userId)` runs. Pass.

**(c) First validate fails, second succeeds**
1. User types `"90210 Beverly Hills"`. ref null.
2. Click Validate (first). ref captured to `"90210"`. Backend returns 404 / network error. Modal shows error. ref retains `"90210"`.
3. User clicks Validate again WITHOUT editing. `handleValidateAddress` re-captures `"90210"` (idempotent overwrite of the same value). Backend succeeds, returns `formatted_address`. setFormData runs.
4. User clicks Save. Source 1 = `"90210"` -> pinned. Pass.

**Variant of (c)**: user edits address between attempts — `handleChange('address', ...)` clears the ref, second validate captures fresh ZIP from the new input. Stale capture cannot mispin.

**(d) Register flow with stale prior pin**
1. Browser has `localStorage.weatherZipCode = "60601"` from a previous user/session.
2. User registers as new account, id 42. No `weatherZipCode__user_42` backup exists.
3. `register()` removes `weatherZipCode`, dispatches `weatherZipCodeChanged` with empty detail.
4. `useWeatherZipCode` re-resolves: pinned = null, property = null (new account, no property yet) -> `{ zipCode: '', source: 'none', isLoading: false }`. Dashboard/Weather & Alerts show empty state.
5. New user creates property with ZIP `"33101"`. PropertyFormModal save flow runs the resolution chain and pins `"33101"`. Resolver re-renders with the new ZIP. Pass.

---

## Constraint compliance

- **Reused `pinWeatherZip`**: yes — the only new call site is the existing one in PropertyFormModal save flow. Did not duplicate the localStorage-write/dispatch logic.
- **Reused `extractZipFromAddress`**: yes — three call sites in PropertyFormModal (capture, savedAddress, formData.address) and one defensive call in the validate response path. No new regex.
- **No backend changes**: confirmed. Investigated `backend/blueprints/properties_bp.py::validate_property_address` (lines 143–182): the response shape is `{ valid, latitude, longitude, formatted_address, zone, accuracy, accuracy_type, confidence }`. No `zipcode` field exposed today. The 4th source in the chain handles a future `data.zipcode` field if added, AND defensively extracts a ZIP from `data.formatted_address` (cheap, harmless when absent). See "Future improvement" below.
- **No new override UI**: confirmed.
- **No test files touched**: confirmed.

### Note on direct localStorage writes in AuthContext

`register()` writes/clears `localStorage.weatherZipCode` directly rather than via `pinWeatherZip`. Justification:

1. `pinWeatherZip` is designed for the "set a real ZIP" case — it returns early when given an empty value, so it cannot perform the *clear* operation needed in the no-backup branch.
2. The login/session-resume paths in the same file already use raw `localStorage.setItem(key, saved)` for symmetric session-state management. Routing register through `pinWeatherZip` while leaving login on raw localStorage would create a different drift risk.
3. `pinWeatherZip` is the single writer for the **property-save** code path, which is the contract that matters: any "user gave us a new ZIP via the property form" must go through the helper. Session-lifecycle bookkeeping (login/logout/register restoring per-user backups) is a separate concern.

The dispatch of `weatherZipCodeChanged` after the register clear/restore is the load-bearing piece — without it, resolver consumers would not re-evaluate until the next storage event or property cache invalidation.

---

## Verification

- `cd frontend && npm run build` -> `Compiled successfully.` (310.69 kB main, +154 B vs prior fix-report).
- Repo-wide grep `localStorage.(setItem|removeItem)('weatherZipCode'`: production writers are `useWeatherZipCode.ts::pinWeatherZip` (sole save-path writer) and `AuthContext.tsx` (session-lifecycle). No drift.
- Repo-wide grep for `weatherZipCodeChanged` dispatchers: `pinWeatherZip` (property save flow) and `AuthContext.register()` (clear-or-restore). Both are intentional; both feed the same single listener (`useWeatherZipCode`).

---

## Deviations

None from the spec.

---

## Future improvement (out of scope)

Add a `zipcode` field to the `/api/properties/validate-address` response. Source: `geocoding_service` already runs `_extract_zipcode(formatted_address)` to compute the hardiness zone. Returning that ZIP explicitly would make the 4th-source step in the frontend chain authoritative rather than defensive, and would benefit any future client (mobile, third-party) without re-deriving the regex. File: `backend/blueprints/properties_bp.py::validate_property_address` (lines 170–179). Trivial change; deferred per the no-backend-changes rule for this pass.

---

## Cross-domain alert

None. Bug and fix are entirely client-side. The frontend `extractZipFromAddress` regex and the backend `_extract_zipcode` regex must remain in sync, but neither was modified.
