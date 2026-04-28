# AUDIT-002 Investigation — Property → Weather State Integration (2026-04-23)

Read-only investigation. No code modified.

---

## TL;DR

- The retest user is correct. The main Weather page (`WeatherAlerts.tsx`) and several planting-calendar cards hardcode `'53209'` as a client-side default when `localStorage.weatherZipCode` is not set. This happens regardless of whether the user has filled out Property Designer.
- Property Designer **does** capture + persist `address`, `latitude`, `longitude`, and `zone` on `Property`, and the validate-address flow resolves lat/lon and zone via geocoding. But **no frontend component reads Property.{latitude,longitude,address} to seed weather**. There is no `PropertyContext`, no `useProperty()` hook, and no bridge.
- Backend does have partial property-fallback wiring for **soil temperature** and **maple-tapping** endpoints — they fall back to `current_user.properties[0].{latitude,longitude}` before defaulting to Milwaukee. The `/api/weather/current` and `/api/weather/forecast` endpoints do **not** have this fallback; they 400 if no location is provided.
- Recommended fix: small frontend change (Option A, smallest-safe variant). Property ZIP/lat-lon should seed the weather state when `localStorage.weatherZipCode` is unset, and the `'53209'` literal fallbacks should be removed. No schema change or API change required.

---

## 1. Is the weather page defaulting to a hardcoded ZIP?

**YES — on the frontend, in five places.** The backend does NOT default; it errors out without location.

### Frontend `'53209'` constants (verified)

- `frontend/src/components/WeatherAlerts.tsx:11-14` — main Weather page:
  ```tsx
  const [zipCode, setZipCode] = useState(() => {
    // Load from localStorage or default to '53209'
    return localStorage.getItem('weatherZipCode') || '53209';
  });
  ```
  This is the literal cause of the retest finding. On a fresh account with property set but no explicit Weather-settings save, the component boots with `'53209'`, immediately fires `fetchWeatherData('53209')`, and renders a Milwaukee forecast.
- `frontend/src/components/PlantingCalendar/SoilTemperatureCard/index.tsx:69` — same pattern for the soil-temp card.
- `frontend/src/components/PlantingCalendar/AddMapleTappingModal.tsx:105` — same pattern for maple season estimate.
- `frontend/src/components/PlantingCalendar/MapleTappingSeasonCard.tsx:33` — same pattern.
- Not a hardcoded fallback but related: `frontend/src/App.tsx:166-228` wires the header location-info tile *only* from `localStorage.weatherZipCode`; it shows nothing if that key is empty, and is the reason the header location pill feels disconnected from the property.

### Frontend call sites that correctly do NOT fallback

- `frontend/src/components/Dashboard/WeatherSummaryTile.tsx:22` — reads `localStorage.getItem('weatherZipCode') || ''` and shows the empty-state copy when empty. This is the tile the user-facing-pass #2 copy fix touched.
- `frontend/src/components/common/PlantPalette.tsx:160-167` — no zip → skips validation, logs a warning.
- `frontend/src/components/GardenDesigner/PlantConfigModal.tsx:644-648` — no zip → emits `no_location` warning rather than a fake location.
- `frontend/src/components/GardenDesigner.tsx:2718` — passes `localStorage.getItem('weatherZipCode') || ''` into `WeatherAlertBanner`, which accepts empty and no-ops (`WeatherAlertBanner.tsx:86-89`).

### Backend fallback chain (verified)

- `/api/weather/current` and `/api/weather/forecast` — `backend/blueprints/weather_bp.py:44-46` return **400 "Either zipcode or lat/lon coordinates required"** when neither is provided. **No Milwaukee fallback.**
- `/api/soil-temperature` — `backend/blueprints/utilities_bp.py:457-464` falls through: zipcode → lat/lon → `current_user.properties[0].{latitude,longitude}` → `DEFAULT_LATITUDE/LONGITUDE` (Milwaukee, `43.1361, -87.9456`, `backend/app.py:39-40`).
- `/api/maple-tapping/season-estimate` — `backend/blueprints/utilities_bp.py:689-698` same fallthrough pattern (has `Property.query.filter_by(user_id=current_user.id).first()` before DEFAULT).
- `DEFAULT_LATITUDE/LONGITUDE` is duplicated three times (`backend/app.py:39-40`, `backend/blueprints/utilities_bp.py:66-67`, `backend/utils/constants.py:18-19`). Comment everywhere: "Milwaukee, WI - 53209". Note: these are lat/lon, not the ZIP string — the ZIP string only lives on the frontend.
- `/api/properties/frost-dates` — `backend/blueprints/properties_bp.py:106-140` has its own priority chain (property explicit dates → property zone → ZIP → hardcoded Zone 5b). This is healthy and not the bug.

### Full fallback chain summary

| Surface | When `localStorage.weatherZipCode` unset | Effect |
|---|---|---|
| Weather page (`WeatherAlerts.tsx`) | Constant `'53209'` | Shows Milwaukee forecast silently |
| Soil temp card | Constant `'53209'` | Shows Milwaukee soil temps |
| Maple tapping modal/card | Constant `'53209'` | Shows Milwaukee season |
| Dashboard WeatherSummaryTile | Empty string → empty-state branch | Correct empty state, click-through |
| App.tsx header location pill | Hides pill | Correct empty state |
| PlantPalette / PlantConfigModal validation | Skips + warns | Correct empty state |
| `/api/weather/*` backend | 400 error if called with no args | Never happens today: frontend always sends `?zipcode=53209` |

The hardcoded `'53209'` is the proximate cause of the user-facing retest finding. Even if a user fills Property Designer with address `"Austin, TX 78701"`, the Weather page still boots with `'53209'` because nothing has written `weatherZipCode` to localStorage.

---

## 2. Is Property Designer location data wired into the weather state?

### Property location storage

`Property` model — `backend/models.py:578-617`:

- `address` (String(200), nullable) — free text; populated from the validate-address response's `formatted_address` in `PropertyFormModal.tsx:183-184`.
- `latitude` (Float, nullable) — populated from geocoding, `PropertyFormModal.tsx:186-188`.
- `longitude` (Float, nullable) — populated from geocoding, `PropertyFormModal.tsx:189-191`.
- `zone` (String(10), nullable) — populated from `get_hardiness_zone`, `PropertyFormModal.tsx:192-194`.
- `last_frost_date` / `first_frost_date` (Date, nullable) — optional user overrides.

**There is no explicit `zip_code` column.** Grep confirms: `zip_code` is not present anywhere in `models.py`. A ZIP can be parsed out of `address` via regex, which the backend already does — `backend/services/geocoding_service.py:191-207` (`_extract_zipcode`) — but only inside `get_hardiness_zone`, not exposed as a first-class field on Property.

`Property.to_dict()` (`backend/models.py:600-617`) returns `address`, `latitude`, `longitude`, `zone` in camelCase, so consumers have everything they need.

### Property creation flow (verified)

1. User opens `PropertyFormModal` (`frontend/src/components/PropertyDesigner/PropertyFormModal.tsx`).
2. User enters address, clicks "Validate Address" → `apiPost('/api/properties/validate-address', ...)` at line 169.
3. Backend (`backend/blueprints/properties_bp.py:143-182`) → `geocoding_service.validate_address` → `geocoding_service.get_hardiness_zone`. Returns `{latitude, longitude, formatted_address, zone}`.
4. Frontend stuffs all four into formData (`PropertyFormModal.tsx:182-194`).
5. User clicks Create/Update → `POST /api/properties` or `PUT /api/properties/:id` with `{address, latitude, longitude, zone, ...}` (line 111-126).
6. Backend persists on `Property` row (`properties_bp.py:32-54`).

So after a successful Property Designer save with address validation, the user's Property row has `latitude`, `longitude`, `zone`, and an `address` containing a ZIP string. Nothing writes to `localStorage.weatherZipCode`.

### Wiring between Property and Weather

**Backend consumption of Property.latitude/longitude — partial:**

- `/api/soil-temperature` falls back to `current_user.properties[0].{latitude, longitude}` (`backend/blueprints/utilities_bp.py:457-460`). Only if caller passes neither zipcode nor lat/lon, which no frontend caller currently does because the frontend always provides `'53209'`.
- `/api/maple-tapping/season-estimate` — same (`backend/blueprints/utilities_bp.py:689-694`).
- `/api/properties/frost-dates` — uses `Property.last_frost_date`/`first_frost_date` directly; optional ZIP override via query string (`frost_date_lookup.py` + `properties_bp.py:106-140`). This is the healthy example.
- `/api/weather/current`, `/api/weather/forecast` — **no** property fallback (`weather_bp.py:16-48`). They error without explicit location.

**Frontend consumption of Property location — essentially none:**

- Grep results for `/api/properties` from the frontend (five hits): all in `PropertyDesigner.tsx`, `PropertyFormModal.tsx`, and `AddMapleTappingModal.tsx`. Only the third reads properties for non-designer purposes, and it reads `placedStructures` for tree filtering — it does **not** consume `latitude/longitude/address`.
- No `PropertyContext`, no `useProperty()` hook, no global fetched-once-and-reused property state. Grep for `PropertyContext|useProperty|primary_property|is_primary|primaryProperty` returns zero matches anywhere in the repo.
- `WeatherAlerts.tsx`, `WeatherSummaryTile.tsx`, `SoilTemperatureCard`, `AddMapleTappingModal`, `MapleTappingSeasonCard`, `App.tsx` header pill, `PlantPalette`, `PlantConfigModal` all read `localStorage.weatherZipCode` directly and have no awareness of the user's property.
- The `weatherZipCodeChanged` CustomEvent (`WeatherAlerts.tsx:198`, listened by `App.tsx:223`) is a local synchronization bus between the Weather page and the header — it is not fed by the property store.

**Multi-property / primary property concept:** there is no `is_primary` flag on Property. The user can have multiple properties (`User.properties` relationship, `backend/models.py:597`). Both backend fallbacks pick `properties[0]` (first returned, unordered) — which is usable as a convention but under-specified if a user has more than one property. Flag this as an open product decision below.

### Verdict on question 2

Property location is **captured and persisted but not wired to any weather consumer on the frontend**. On the backend it is partially wired to soil-temperature and maple-tapping endpoints, but (a) those fallbacks are dead code today because the frontend always sends the `'53209'` default, and (b) the core weather endpoints (`/api/weather/current` and `/api/weather/forecast`) have no property fallback at all.

---

## 3. Recommended fix shape

### Option A — State reuse (property drives weather by default)

- **Change**: On app bootstrap (e.g., in `AuthContext` or a new `PropertyContext`), fetch `GET /api/properties`, pick the first one, and seed `localStorage.weatherZipCode` if it's empty. Derive the ZIP from either `address` (regex-extract 5 digits, reuse `geocoding_service._extract_zipcode` pattern) or store it explicitly.
  - Alternatively: stop reading `localStorage` directly in weather components; instead, read from a `PropertyContext` that supplies `{zipCode, latitude, longitude, zone}`, falling back to `localStorage.weatherZipCode` only when no property exists.
- **Files touched** (indicative):
  - New: `frontend/src/contexts/PropertyContext.tsx` (~80 lines).
  - Edit: `WeatherAlerts.tsx` (remove hardcode + consume context).
  - Edit: `WeatherSummaryTile.tsx` (consume context instead of localStorage).
  - Edit: `SoilTemperatureCard/index.tsx`, `AddMapleTappingModal.tsx`, `MapleTappingSeasonCard.tsx` (remove hardcodes).
  - Edit: `App.tsx` header-pill effect (consume context).
  - Optional backend: add ZIP field on `Property` (migration) so we don't have to regex `address`.
- **Scope**: medium. Pure frontend if we stay with localStorage-seeding; medium-cross-stack if we add an explicit `zip_code` column.
- **UX**: User fills Property Designer → Weather page and dashboard tile immediately show their location's forecast without a second settings trip. Matches the retester's mental model.
- **Risk**: If a user wants to watch a secondary location's weather (travel, cabin), this change would fight them until they explicitly set a different ZIP. Mitigated by still honoring `localStorage.weatherZipCode` when present — property is only the default.

### Option B — Clearer separation (weather ZIP is explicit, property is informational)

- **Change**: Leave property data as "property-informational only," but fix the `'53209'` hardcode to render an "unset location" empty state identical to what the dashboard tile already shows. Weather page would refuse to fetch until the user picks a ZIP.
- **Scope**: small. Change the five `|| '53209'` lines in `WeatherAlerts.tsx`, two soil-temp / maple files, plus two maple files, to empty-string fallbacks and add empty-state renders.
- **UX**: No more Milwaukee surprise, but user still has to enter their ZIP a second time (once for property, once for weather). This is what the retester said they would *not* expect.
- **Risk**: Low technically, but doubles down on a workflow the retest explicitly called "still feels disconnected." This is probably not what we want.

### Option C — Both (property is default; explicit weather override is preserved with a "reset to property" affordance)

- **Change**: Same as Option A, plus the Weather settings modal gets a "Reset to property location" link when `weatherZipCode !== property.zip`.
- **Scope**: Option A + small UI affordance (~15 lines in `WeatherAlerts.tsx` settings panel).
- **UX**: Cleanest — property seeds weather by default, user can override for travel/secondary locations, one-click to return to property default. Matches the "state reuse… with clearer separation" language in the retester's recommendation.
- **Risk**: Slightly more UX surface to test. The "which wins" question is answered unambiguously (pinned ZIP always wins once set; reset returns to property).

---

## Recommendation

**Recommended: Option C**, implemented in two stages:

1. **Stage 1 (smallest safe fix, see next section)**: seed weather ZIP from property on first read, so the retest is no longer failing. Ship this now.
2. **Stage 2 (follow-up)**: add the "Reset to property location" affordance once stage 1 is verified and we've seen whether users actually want the override.

Rationale: Option A is strictly better than Option B — the retester's plain-language expectation is that "after entering property ZIP/location data, the weather experience should reflect that same property location" (`audit-002-retest-update.md:16`). Option B preserves the friction the retest is calling a bug. Option C is Option A plus a minor affordance that the retester's "clearer separation" language hints at.

Option A alone is sufficient if we trust that most users will not need a travel-location override — the existing Weather settings panel already lets them type a different ZIP if they want, and pinned ZIPs win. The "Reset to property" button is a polish item, not a correctness item.

Key evidence from the code supporting Option A as the low-risk path: the backend already has this exact pattern wired for soil-temperature and maple-tapping. The wiring works, but the frontend never exercises it because it always sends `'53209'` rather than blank. Removing the `'53209'` literals and letting the backend's existing property-fallback path take over is a *subtractive* change for soil-temp and maple, and an *additive* change for the weather page (which needs explicit property fallback because `/api/weather/*` endpoints don't have it).

---

## Smallest safe fix

If we want to resolve the retest finding with the minimal diff before undertaking the full context/refactor:

1. **Frontend, `WeatherAlerts.tsx:11-14`**: on first mount, if `localStorage.weatherZipCode` is unset, call `GET /api/properties`, extract a ZIP from `properties[0].address` (via a `/\b(\d{5})\b/` regex — mirror the backend's `_extract_zipcode` pattern), and use that as the initial ZIP. Drop `|| '53209'`. If no property or no ZIP extractable, render an empty state matching the dashboard tile.
2. **Same pattern** for `SoilTemperatureCard/index.tsx:69`, `AddMapleTappingModal.tsx:105`, `MapleTappingSeasonCard.tsx:33`. Better: pull the logic into a single `useResolvedZipCode()` hook.
3. **No backend changes.** The existing soil-temp and maple-tapping fallback chains remain; they'll become reachable once the frontend stops always sending `'53209'`.
4. **No migration.** `Property.address` already contains the ZIP from geocoding; regex extraction is fine for a first cut. Adding an explicit `Property.zip_code` column is a nice-to-have that can be a follow-up if address parsing is flaky for non-US / partial addresses.

Estimated scope: one new ~40-line hook file, four call-site edits of 1-3 lines each, one empty-state branch added to `WeatherAlerts.tsx`. ~100 lines of frontend diff.

Caveats to flag in the fix PR:

- The regex `/\b(\d{5})\b/` matches any 5-digit token. A street address like "12345 Main St" would match `12345`. The backend uses the same regex (`geocoding_service.py:207`) and has the same limitation. Real fix: add `Property.zip_code` column. For the smallest-safe fix, this is acceptable because the formatted address from geocoding reliably places the ZIP after state (e.g., `"Milwaukee, WI 53209"`).
- If the user has multiple properties, we'd use `properties[0]`. Consistent with existing backend behavior, but worth noting (see "Open product decisions" below).

---

## Is this cross-stack, frontend-only, or backend-only?

**Frontend-only** for the recommended smallest-safe fix and Option A. Backend already has the pieces needed (Property stores lat/lon/address, `/api/properties` returns them, soil-temp and maple endpoints have property fallbacks).

**Cross-stack** only if we add Option C's "Reset to property" or add a real `Property.zip_code` column. Neither is required for correctness.

File list for smallest-safe fix:

- `frontend/src/components/WeatherAlerts.tsx` (edit)
- `frontend/src/components/PlantingCalendar/SoilTemperatureCard/index.tsx` (edit)
- `frontend/src/components/PlantingCalendar/AddMapleTappingModal.tsx` (edit)
- `frontend/src/components/PlantingCalendar/MapleTappingSeasonCard.tsx` (edit)
- `frontend/src/hooks/useResolvedZipCode.ts` (new, optional but recommended for DRY)

Tests to update/add:

- `frontend/src/components/Dashboard/__tests__/WeatherSummaryTile.test.tsx` (5 tests — already assert on empty-state behavior; may need a new "seeds from property" test if the tile is also updated)
- `frontend/tests/weather.spec.ts` and `p2-photo-compost-weather-journey.spec.ts` — current test data uses `'53209'` as the VALID_ZIP; fine to keep, but add one E2E that verifies property ZIP seeds weather when no `weatherZipCode` is pinned.

---

## Open product decisions

These questions should be answered before starting implementation of Option C; Option A / smallest-safe-fix can proceed by picking the "default" answer for each:

1. **When both `localStorage.weatherZipCode` and a property ZIP exist and differ, which wins?** Default recommendation: the pinned `weatherZipCode` wins (user's last explicit choice). Only seed from property when `weatherZipCode` is empty. This preserves the travel/secondary-location override.
2. **Which property if the user has more than one?** Default recommendation: match existing backend behavior — `properties[0]`. Adding an `is_primary` flag on Property is a larger product decision (multi-property UX is thin today), out of scope for this fix.
3. **Do we want an explicit `zip_code` column on `Property`?** Default recommendation: no for stage 1, yes for stage 2 if we observe any user whose address geocodes without a parseable ZIP. Would require an Alembic migration + backfill via `_extract_zipcode`.
4. **Should the `'53209'` → "empty state" change be mirrored on the soil-temp and maple cards?** Default recommendation: yes, but the soil-temp card already falls back server-side to the user's first property, so the user may not see a Milwaukee leak there today. Still worth removing the magic string for consistency.
5. **Is the `/api/weather/*` backend fallback (property → Milwaukee) a change we want to make?** Default recommendation: no. Frontend seeding is cleaner — backend errors clearly instead of silently using Milwaukee. Only add backend fallback if we want the same behavior server-side for scripted / direct-API-client consumers.

---

## Appendix: code references

### The hardcoded ZIP
- `frontend/src/components/WeatherAlerts.tsx:11-14` — primary offender: main Weather page default
- `frontend/src/components/PlantingCalendar/SoilTemperatureCard/index.tsx:69` — soil-temp default
- `frontend/src/components/PlantingCalendar/AddMapleTappingModal.tsx:105` — maple modal default
- `frontend/src/components/PlantingCalendar/MapleTappingSeasonCard.tsx:33` — maple card default

### Backend Milwaukee coords (not the bug, but related)
- `backend/app.py:38-40` — `DEFAULT_LATITUDE / DEFAULT_LONGITUDE`
- `backend/utils/constants.py:17-19` — duplicated
- `backend/blueprints/utilities_bp.py:65-67` — duplicated
- `backend/blueprints/utilities_bp.py:457-464` — soil-temp fallback chain (reaches property before Milwaukee)
- `backend/blueprints/utilities_bp.py:689-698` — maple-tapping fallback chain (same)

### Property model + flow
- `backend/models.py:578-617` — `Property` model; fields `address`, `latitude`, `longitude`, `zone`; `to_dict()` emits all four in camelCase
- `backend/blueprints/properties_bp.py:26-58` — POST/GET /api/properties
- `backend/blueprints/properties_bp.py:143-182` — POST /api/properties/validate-address (populates lat/lon/zone via geocoding)
- `backend/services/geocoding_service.py:191-207` — `_extract_zipcode` regex `\b(\d{5})\b`
- `frontend/src/components/PropertyDesigner/PropertyFormModal.tsx:160-211` — Validate-address handler; writes lat/lon/zone into formData
- `frontend/src/components/PropertyDesigner/PropertyFormModal.tsx:100-141` — Form submit; POSTs address/latitude/longitude/zone to backend

### Weather consumers
- `backend/blueprints/weather_bp.py:16-48` — `_get_coordinates_from_request`, no property fallback
- `frontend/src/components/WeatherAlerts.tsx:7-105` — Weather page; reads `localStorage.weatherZipCode` only
- `frontend/src/components/Dashboard/WeatherSummaryTile.tsx:22` — tile; same; has empty-state branch
- `frontend/src/components/GardenDesigner.tsx:2718` — passes localStorage value into `WeatherAlertBanner`
- `frontend/src/components/GardenDesigner/WeatherAlertBanner.tsx:86-89` — correctly no-ops on empty location
- `frontend/src/App.tsx:160-228` — header location-pill effect; reads localStorage only

### Known callers not touched
- `frontend/src/components/common/PlantPalette.tsx:160-167` — no-fallback validation skip
- `frontend/src/components/GardenDesigner/PlantConfigModal.tsx:644-648` — no-fallback warning
- `frontend/src/contexts/AuthContext.tsx:22,31` — persists `weatherZipCode` per-user across logout/login
