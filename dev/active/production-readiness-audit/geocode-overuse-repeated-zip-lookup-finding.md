# Geocode Overuse / Repeated ZIP Lookup Finding

## Area

Location-aware backend flows  
Primary surface: weather / ZIP-based coordinate resolution  
Secondary surfaces: utility endpoints that geocode ZIP repeatedly

## Expected

When the app repeatedly needs coordinates for the same ZIP code during one session, it should avoid re-hitting the external geocoding provider unnecessarily.

Especially for a pinned weather ZIP, the app should not consume a fresh geocoding lookup every time multiple weather/frost/location-aware screens ask for the same location.

## Actual

The app appears to geocode the same ZIP repeatedly across multiple backend endpoints and frontend surfaces.

Observed user concern:
- only a small number of addresses were manually created/validated
- but Geocodio usage climbed far beyond that (roughly 48 calls)

Code inspection strongly suggests the main repeated path is:

- `backend/blueprints/weather_bp.py`
  - `/api/weather/current?zipcode=...`
  - `/api/weather/forecast?zipcode=...`
  - both call `geocoding_service.validate_address(zipcode)` when only a ZIP is provided

Additional ZIP-geocode call sites exist in utility endpoints as well, including paths in:
- `backend/blueprints/utilities_bp.py`

This means one browsing session can trigger multiple identical ZIP lookups across:
- app/header weather
- dashboard weather tile
- Weather & Alerts page
- Garden Designer weather banner
- other ZIP-aware utility calls

## Impact

The app can consume external geocoding quota much faster than users would reasonably expect based on their visible address-entry actions.

That creates:
- quota exhaustion risk
- misleading user understanding of where calls are coming from
- avoidable provider dependence for repeated same-ZIP requests

## Likely Root Cause

- no shared caching / memoization for ZIP -> lat/lon resolution
- repeated backend geocode calls for the same ZIP across weather and utility endpoints
- provider-failure handling currently masks quota exhaustion as generic lookup failure

## Recommendation

Prioritize backend fixes first:

1. Add ZIP-level caching or memoization in `GeocodingService` for repeated 5-digit ZIP lookups.
2. Stop re-geocoding the same ZIP on every `/api/weather/current` and `/api/weather/forecast` request.
3. Return a truthful provider-failure response when quota/provider issues occur instead of collapsing everything into an address-not-found style failure.

Frontend deduplication can be considered later, but backend ZIP caching is the highest-leverage first fix because it helps all calling surfaces at once.

## Notes

- This is separate from the earlier property-validation finding about the Geocodio key being out of quota.
- That quota issue exposed the overuse more clearly, but the repeated-lookup behavior appears to be a real efficiency problem on its own.
