# Property Setup ZIP-Only Validation Finding

## Area

Property Designer / Create New Property -> location validation

## Expected

Entering a ZIP code alone in the property location/address field should either:

- work as a valid location shortcut, if ZIP-only input is supported
- or the UI should clearly state that a full address is required before the user attempts validation

Historically, ZIP-only entry was a valid workflow for property setup.

## Actual

Entering `07055` in the property `Address (Optional)` field and clicking `Validate Address` produced:

`Address not found or geocoding service unavailable. Please check the address and try again.`

## Impact

Property setup feels unreliable and confusing.

If ZIP-only input is supposed to work, this appears to be a regression or broken fallback.
If ZIP-only input is no longer supported, the UI is not communicating that clearly and still invites the user to try it.

## Notes

- This may be either:
  - a real ZIP-only geocoding regression
  - or a product/UX mismatch between what the field accepts and what users reasonably expect
- Because ZIP-only setup was previously used successfully, this should be investigated as a likely real regression first.
