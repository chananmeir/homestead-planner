# Weather ZIP Propagation Retest Failure

**Date**: 2026-04-28  
**Related issue**: `AUDIT-021`

## User Retest Result

Partial pass, then failure on a fresh-user scenario.

### Passed

The user created a property, validated the ZIP code, and the ZIP propagated correctly:

- Dashboard showed the weather/location behavior.
- Weather & Alerts showed the weather/location behavior.

### Failed

The user then created a new user and a new property with a new ZIP:

- First validation attempt did not validate.
- Second validation attempt did validate.
- After save, the ZIP did **not** show on the Dashboard.
- It also did **not** show in Weather & Alerts.

This means `AUDIT-021` should remain open. The current implementation is not reliable enough across fresh-user/property setup.

## Likely Remaining Failure Modes

### 1. ZIP-only validation can erase the ZIP before save

Current save flow in `frontend/src/components/PropertyDesigner/PropertyFormModal.tsx`:

```ts
const savedAddress = (savedProperty && (savedProperty.address ?? savedProperty.formatted_address)) || formData.address || null;
const newZip = extractZipFromAddress(savedAddress);
if (newZip) {
  pinWeatherZip(newZip, user?.id ?? null);
}
```

This only works if `savedAddress` still contains a ZIP.

However, the address-validation path can replace the user's entered value with `data.formatted_address`:

```ts
if (data.formatted_address) {
  handleChange('address', data.formatted_address);
}
```

For ZIP-only fallback lookups, the backend fallback can return formatted strings like `Chicago, IL` with no `60601`. If the form value is replaced with that string, the later save has no ZIP to extract, so `pinWeatherZip()` is never called.

This exactly matches a scenario where validation visibly succeeds but Weather & Alerts / Dashboard do not update.

### 2. New-user registration does not reset/restore weather ZIP storage

`frontend/src/contexts/AuthContext.tsx` handles per-user weather ZIP restoration on login/session resume and clearing on logout, but the `register()` path only calls:

```ts
setUser(data.user);
```

It does not clear any existing `weatherZipCode` from the prior browser user/session, and it does not initialize per-user storage for the newly registered user.

If a new account is created in the same browser session, it may inherit stale weather-location state until property save overwrites it. If property save fails to extract a ZIP, the new user remains with blank/stale weather state.

## Expected Fix Direction

The fix should not rely only on the final saved address string containing a ZIP.

Recommended changes:

1. Track the ZIP that was entered/submitted for validation before the validation response rewrites the address field.
2. Prefer the validated ZIP when pinning weather ZIP on save.
3. Alternatively or additionally, have `/api/properties/validate-address` return a normalized `zipcode` field when the input or resolved address contains one.
4. On save, resolve ZIP from this ordered chain:
   - validated ZIP captured from the validation request
   - ZIP extracted from saved property address
   - ZIP extracted from current form address
   - ZIP extracted from backend validation response if exposed
5. Update `AuthContext.register()` so a newly registered user does not inherit a prior user's `weatherZipCode` state.
6. Add tests for:
   - ZIP-only property validation where the validated/formatted address no longer contains the ZIP
   - new-user registration followed by property creation
   - first validation failure followed by second validation success

## Acceptance Criteria Addendum

Add these before closing `AUDIT-021`:

- [ ] ZIP-only validated property setup pins the ZIP even if the displayed formatted address does not include the ZIP.
- [ ] Freshly registered users do not inherit prior users' weather ZIP state.
- [ ] A first validation failure followed by a successful retry still pins the ZIP on property save.
- [ ] User retest confirms the fresh-user/new-property path updates Dashboard and Weather & Alerts without reload.

