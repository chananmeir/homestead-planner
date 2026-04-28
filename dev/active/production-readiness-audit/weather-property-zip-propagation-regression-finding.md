# Weather Property ZIP Propagation Regression Finding

## Area

Property Designer -> Weather & Alerts / weather-aware screens

## Expected

After a user creates or edits a property and validates/saves an address with a ZIP code, that property ZIP should become available to weather-aware surfaces without requiring the user to manually re-enter the same ZIP in Weather & Alerts.

At minimum, when no explicit weather ZIP has been pinned, the app should use the primary property ZIP consistently across:

- Weather & Alerts
- Dashboard weather tile and header location display
- Planting Calendar frost dates / soil temperature / maple-tapping weather helpers
- Garden Designer weather alert banner
- Planting validation flows that currently ask for or depend on `weatherZipCode`

## Actual

Creating a new property does not reliably propagate the ZIP into Weather & Alerts or other weather-aware surfaces.

Observed user report:

- User created a new property.
- User entered/validated the location there.
- Weather & Alerts did not receive/use that property ZIP as expected.

Code inspection shows this is plausible and likely caused by more than one gap.

## Impact

This breaks a foundational location-aware expectation. Users reasonably expect that once they tell the app where the homestead is, weather, frost dates, soil temperature, and planting-readiness checks use that same location.

When this fails, users must enter the same ZIP in multiple places, and they cannot trust whether the weather-aware calculations are using the property they just configured.

## Evidence

### 1. `useProperty` can cache `null` before a new property exists

File: `frontend/src/hooks/useProperty.ts`

The hook memoizes the `/api/properties` request at module scope:

```ts
let cachedPropertyPromise: Promise<PrimaryProperty | null> | null = null;
```

If any weather-aware component calls `useProperty()` before a property exists, the shared promise can resolve to `null` and remain cached for the rest of the page session. Creating a property later does not invalidate this cache.

Result: Weather & Alerts can keep seeing no property ZIP until a full reload, even after the property has been created and saved.

### 2. Property save does not notify weather/location consumers

File: `frontend/src/components/PropertyDesigner/PropertyFormModal.tsx`

After create/edit succeeds, the modal calls:

```ts
await response.json();
showSuccess(...);
onSuccess();
```

It does not:

- clear the `useProperty` module cache
- dispatch a property/location changed event
- seed `localStorage.weatherZipCode` from the saved property ZIP
- dispatch the existing `weatherZipCodeChanged` event

### 3. Several weather consumers still only read `localStorage.weatherZipCode`

Examples:

- `frontend/src/components/Dashboard/WeatherSummaryTile.tsx`
  - initializes from `localStorage.getItem('weatherZipCode') || ''`
  - no property fallback
- `frontend/src/App.tsx`
  - header location info effect reads only `localStorage.weatherZipCode`
  - no property fallback
- `frontend/src/components/PlantingCalendar/index.tsx`
  - frost date fetch reads only `localStorage.weatherZipCode`
  - falls back to `/api/frost-dates`, which may use property zone/frost values but not necessarily the property ZIP path expected by the user
- `frontend/src/components/GardenDesigner.tsx`
  - passes `zipCode={localStorage.getItem('weatherZipCode') || ''}` to the weather alert banner
- `frontend/src/components/common/PlantPalette.tsx`
  - planting-date validation skips when `weatherZipCode` is not in localStorage
- `frontend/src/components/GardenDesigner/PlantConfigModal.tsx`
  - validation and frost copy read `localStorage.weatherZipCode`

Some newer surfaces already use `useProperty` fallback, for example:

- `frontend/src/components/WeatherAlerts.tsx`
- `frontend/src/components/PlantingCalendar/SoilTemperatureCard/index.tsx`
- `frontend/src/components/PlantingCalendar/MapleTappingSeasonCard.tsx`
- `frontend/src/components/PlantingCalendar/AddMapleTappingModal.tsx`

This means the product currently has mixed location-resolution rules.

## Suspected Root Cause

The earlier fix added property-ZIP fallback to some screens, but the app still lacks a single canonical weather ZIP resolver.

Current behavior is split between:

- `localStorage.weatherZipCode`
- `useProperty()` fallback
- backend property latitude/longitude fallback in some endpoints
- direct `/api/frost-dates` property fallback

The `useProperty()` cache also has no app-level invalidation when properties are created or edited.

## Repro Steps

1. Use an account with no property and no `weatherZipCode` pinned in localStorage.
2. Navigate to any weather-aware screen that calls `useProperty()` before creating a property, such as Weather & Alerts.
3. Create a property in Property Designer.
4. Validate and save an address containing a ZIP code.
5. Return to Weather & Alerts.
6. Observe whether the ZIP field and forecast automatically use the new property ZIP.
7. Check dashboard weather tile / app header / Garden Designer weather banner / Planting Calendar frost and soil temperature surfaces for the same ZIP.

Additional stale-pin case to check:

1. Set `localStorage.weatherZipCode` to an old ZIP.
2. Create a new property with a different ZIP.
3. Confirm whether the product intentionally keeps the old pinned ZIP or updates/prompts for the new property ZIP.

## Recommended Fix Direction

Use one canonical frontend resolver for weather ZIP behavior.

Recommended shape:

1. Add or extend a shared hook such as `useWeatherZipCode()` with this explicit precedence:
   - explicit pinned weather ZIP, if product still wants manual override
   - primary property ZIP
   - empty/no location
2. Make `useProperty` cache invalidatable from app code, not only tests.
3. On property create/edit success, invalidate property cache and notify weather consumers.
4. If no manual weather ZIP is pinned, seed `weatherZipCode` from the saved property's ZIP and dispatch `weatherZipCodeChanged` so existing listeners update immediately.
5. Update remaining localStorage-only consumers to use the shared resolver rather than directly calling `localStorage.getItem('weatherZipCode')`.
6. Add regression tests for:
   - new property created after initial `useProperty()` returned `null`
   - Weather & Alerts receives property ZIP without manual weather settings
   - Dashboard weather tile uses property ZIP when no explicit weather ZIP is pinned
   - Garden Designer / Planting Calendar weather helpers follow the same resolver

## Product Decision Needed

Clarify precedence when an existing manual weather ZIP differs from the newly saved property ZIP:

- Option A: manual Weather & Alerts ZIP remains a deliberate override
- Option B: property ZIP becomes canonical and overwrites the weather ZIP on property save
- Option C: prompt the user to choose whether to update the app-wide weather ZIP

Given the user's current expectation, the current behavior is not acceptable without at least clear UI messaging.

