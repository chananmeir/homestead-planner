# Property Setup ZIP-Only Validation — Investigation

**Date**: 2026-04-27
**Finding source**: [property-setup-zip-only-validation-finding.md](property-setup-zip-only-validation-finding.md)
**Status**: Diagnosed (not yet fixed)
**Investigators**: backend-debugger + frontend-debugger (parallel)

---

## TL;DR

Not a code regression. The Geocodio API key in `backend/.env:13` has **exceeded its free-tier quota** and returns HTTP 403. The geocoding service swallows non-200 responses silently and returns `None`, which the endpoint converts into the user-facing 404 error: *"Address not found or geocoding service unavailable. Please check the address and try again."*

ZIP-only entry continues to work for ZIPs that exist in the curated in-memory dict `KNOWN_US_ZIPCODE_COORDS` (~20 demo cities); any ZIP outside that list (like `07055` Passaic, NJ) falls through to Geocodio and currently fails because of the quota.

---

## Root Cause

**Provider-side**: Geocodio free tier exhausted. Verified by direct curl:

```
GET https://api.geocod.io/v1.7/geocode?q=07055&api_key=<key>
→ 403 "You have exceeded the free tier..."
```

**App-side amplifiers** (turn an ops issue into a confusing user-facing bug):

1. `_geocodio_lookup()` in `backend/services/geocoding_service.py:132–153` only branches on `status_code == 200`. Non-200 responses fall through to `return None` with **zero logging** — no `logger.warning`, no `print`. There is no signal that the provider returned 403.
2. `validate_property_address` in `backend/blueprints/properties_bp.py:155–161` treats `None` from `validate_address()` as "address not found" and returns HTTP 404 with the generic message above. It conflates "not found" and "service unavailable" into a single error.

---

## Code Path for ZIP `07055`

1. Frontend: `PropertyFormModal.tsx:160` `handleValidateAddress` → POST `/api/properties/validate-address` with `{ "address": "07055" }` (verbatim, untrimmed, no normalization).
2. `properties_bp.py:155` calls `validate_address("07055")`.
3. `geocoding_service.py:87–90` passes the 5-digit numeric guard, calls `_zipcode_fallback("07055")`.
4. `_zipcode_fallback` returns `None` because `07055` is not in the curated `KNOWN_US_ZIPCODE_COORDS` dict at lines 14–45.
5. `geocoding_service.py:96` calls `_geocodio_lookup("07055")`.
6. Geocodio responds 403. Handler at lines 132–153 has no non-200 branch — falls through silently to `return None`.
7. `validate_address` returns `None`.
8. `properties_bp.py:160` returns 404 with the generic error.
9. Frontend displays the backend's error string verbatim (`PropertyFormModal.tsx:173–178`). No client-side rewriting.

---

## Frontend (no defect)

- File: `frontend/src/components/PropertyDesigner/PropertyFormModal.tsx`
- Only client-side validation is an empty-string guard (lines 161–164). No regex, no ZIP-format check, no comma-required check.
- The error string is **pass-through from backend** — frontend does not rewrite or hide it.
- However, two UX cues mislead users about ZIP-only support:
  - Label: `"Address (Optional)"` (line 258) — implies any input is fine.
  - Placeholder: `"e.g., 123 Farm Road, City, State"` (line 261) — implies full street address is expected. No hint that ZIP-only is supported.

---

## Why "Historically Worked"

Either:
- Previous testing used a ZIP that **is** in `KNOWN_US_ZIPCODE_COORDS` (e.g., `90210`, `60601`, `02101`) so Geocodio was never called and quota irrelevant; **or**
- The Geocodio key was below quota at that time and the same `07055` request succeeded.

Either way, the ZIP-only "feature" has always been thin: only ~20 hardcoded ZIPs work without hitting Geocodio.

---

## Recommended Fix Scope (not yet applied)

### Layer 1 — Operations (highest priority, fixes the immediate user-visible bug)
- Rotate or upgrade the Geocodio key in `backend/.env:13`, **or**
- Set `GEOCODING_PROVIDER=google` if a Google Geocoding API key is available.

### Layer 2 — Backend resilience (prevents this from being silent next time)
- In `backend/services/geocoding_service.py:132–153` (`_geocodio_lookup`), log non-200 responses with status code + body snippet. Mirror the pattern already used in `_lookup_zone_via_api` at lines 240–243.
- In `backend/blueprints/properties_bp.py:155–161`, distinguish "service unavailable" (provider error) from "not found" (provider returned no match). Return 503 in the former case so the user sees a different, more accurate message.

### Layer 3 — Frontend UX (only after backend resumes working)
- Update placeholder at `PropertyFormModal.tsx:261` to e.g. `"e.g., 07055 or 123 Farm Road, City, State"`.
- Optionally add a small helper line under the input clarifying that a ZIP code alone is sufficient.
- **Do not** add a frontend regex that pre-filters ZIP-only input — that creates a second source of truth and re-introduces the original bug shape.

### Layer 4 — Optional (low value)
- Expanding `KNOWN_US_ZIPCODE_COORDS` would mask the underlying bug for more ZIPs but does not fix it. Not recommended as a primary fix.

---

## Files Referenced

- `backend/services/geocoding_service.py:14–45` — curated `KNOWN_US_ZIPCODE_COORDS` (~20 entries)
- `backend/services/geocoding_service.py:75–99` — `validate_address()` entry
- `backend/services/geocoding_service.py:132–153` — silent-failure Geocodio handler (key fix site)
- `backend/blueprints/properties_bp.py:143–182` — `validate_property_address` endpoint
- `backend/.env:13` — exhausted Geocodio API key
- `frontend/src/components/PropertyDesigner/PropertyFormModal.tsx:160–211` — `handleValidateAddress`
- `frontend/src/components/PropertyDesigner/PropertyFormModal.tsx:258–274` — input label, placeholder, button (UX cues)

---

## Verification After Fix

1. With a working Geocodio key (or Google fallback): POST `/api/properties/validate-address` with `{"address":"07055"}` → expect 200 with lat/lng/zone for Passaic, NJ.
2. With an intentionally-bad key (to test resilience): expect 503 + error message "geocoding service unavailable" (distinct from "address not found"), and a backend log line containing the provider's 403 status + body.
3. Frontend: enter `07055` → click Validate → see "Auto-detected hardiness zone: 7a" or similar success state.
