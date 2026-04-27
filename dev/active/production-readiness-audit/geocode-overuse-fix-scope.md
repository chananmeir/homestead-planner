# Geocode Overuse / Repeated ZIP Lookup — Fix Scope

**Sibling finding**: `geocode-overuse-repeated-zip-lookup-finding.md`
**Date**: 2026-04-27
**Branch**: working tree only — not committed

## Summary

- Added a process-level TTL cache to `GeocodingService` keyed on normalized 5-digit ZIP, so repeated lookups of the same ZIP across the session pay external-provider quota at most once per cache window.
- Reworked provider lookup to distinguish "ZIP not found" from "provider unavailable / quota exhausted" via a new `validate_zipcode(zip) -> (result, status)` method, and rewired the user-facing weather/utility endpoints to surface a 503 with `errorCode: geocoding_provider_unavailable` when the provider itself is the failure.
- Did NOT change wire format on the success path; existing frontend code continues to read `latitude`/`longitude`/`formatted_address` exactly as before.

## Files Changed

| File | What changed |
|------|--------------|
| `backend/services/geocoding_service.py` | Added `_zip_cache` (dict keyed on normalized ZIP), `_zip_cache_lock` (threading.Lock), TTL constants, `_normalize_zipcode` / `_lookup_zipcode_cached` / `_zip_cache_get` / `_zip_cache_set` / `_zip_cache_clear` helpers, and new public `validate_zipcode(zip) -> (result, status)`. Refactored `validate_address` so ZIP-shaped input is now served via the cache. Added `_geocodio_lookup_with_status` / `_google_lookup_with_status` that return both the result and a status string (`ok` / `not_found` / `provider_error`). Kept legacy `_geocodio_lookup` / `_google_lookup` as thin wrappers for backwards compat. Exported public status constants `ZIP_STATUS_OK`, `ZIP_STATUS_NOT_FOUND`, `ZIP_STATUS_PROVIDER_ERROR`. |
| `backend/blueprints/weather_bp.py` | Switched `_get_coordinates_from_request` to `validate_zipcode`. Provider error now returns 503 with `errorCode: geocoding_provider_unavailable`; ZIP-not-found stays at 400 but now carries `errorCode: zipcode_not_found`. |
| `backend/blueprints/utilities_bp.py` | Switched all four ZIP-geocode call sites (`/api/soil-temperature`, `/api/maple-tapping/season-estimate`, batch validate-plants, validate-planting-date) to `validate_zipcode` with the same 503/400 disambiguation. The batch site stays best-effort (no return code change, just cached). |
| `backend/tests/test_geocoding_zip_cache.py` | **NEW** — 21 tests covering normalization, cache hits, TTL expiry, provider-error sentinel, no-API-key behavior, and provider status mapping (Geocodio non-200 / parse error / timeout, Google OVER_QUERY_LIMIT). |

Other ZIP-geocode call sites that automatically benefit from the cache (no code change required):
- `backend/frost_date_lookup.py::_get_zone_from_zipcode` — calls `validate_address(zipcode)` which now caches transparently.
- `backend/season_validator.py` — same pattern.
- `backend/blueprints/properties_bp.py::validate_property_address` — passes a free-form address (often a full street address), so it goes straight to the provider as before. Only ZIP-shaped inputs would hit the cache there.

## Caching Design Choices

- **Storage**: in-process dict on the `GeocodingService` singleton, guarded by a `threading.Lock`. No external dependency, no DB schema change.
- **Key normalization**: `_normalize_zipcode(value)` strips whitespace and accepts exactly 5 digits (rejects ZIP+4, alphanumerics, non-strings). Cache is keyed on the normalized form so `'53703'`, `'  53703 '`, `'53703\n'` all hit the same entry.
- **TTLs** (in `geocoding_service.py`):
  - Success: **7 days** (`60 * 60 * 24 * 7`). ZIP-to-coords is geographically stable — long TTL maximizes quota savings.
  - Not-found: **30 minutes**. Short enough that a user typo recovery doesn't get punished for hours, long enough to avoid hammering the provider on repeat bad input.
  - Provider error: **60 seconds**. Deliberately short so a transient quota burst or network blip clears fast. Long enough that one outage doesn't trigger N retries inside one page render.
- **Eviction**: lazy. On `_zip_cache_get`, expired entries are dropped. There is no LRU cap because the keyspace is bounded (≈42k US ZIPs) and entries are tiny dicts; in practice a session touches at most a handful.
- **Negative caching**: yes, both for "not found" (truly invalid ZIP, e.g. `'00000'`) and for "provider error" (timeout, 403/422 quota, bad config). Distinct sentinels mean a transient provider outage doesn't poison the cache as a permanent "not found".
- **Local fallback path**: `KNOWN_US_ZIPCODE_COORDS` (the existing 19-entry table for major cities) is consulted before the provider, AND its hits are stored in the success cache. So well-known ZIPs cost zero quota even on cold start.
- **Threading**: `_zip_cache_lock` is held only during dict mutation; `time.monotonic()` reads outside the lock. Good enough for Flask's threaded request handler.
- **Test hook**: `_zip_cache_clear()` flushes the cache deterministically between tests.

## Provider-Failure Surfacing

Before this fix, every `validate_address(zipcode)` failure (whether the provider was down, out of quota, returned malformed JSON, or actually didn't have the ZIP) collapsed into `return None`, and callers responded with a generic 400 `"Could not geocode zipcode"`. Operators couldn't tell quota exhaustion apart from a typo.

After this fix:

- `validate_zipcode(zip)` returns `(None, 'provider_error')` when the underlying provider call failed (timeout, non-200 incl. 403/422, parse error, missing API key, Google `OVER_QUERY_LIMIT`/`REQUEST_DENIED`/`UNKNOWN_ERROR`/`INVALID_REQUEST`).
- It returns `(None, 'not_found')` only when the provider responded successfully with an empty `results` array.
- The four user-facing endpoints (`/api/weather/current`, `/api/weather/forecast`, `/api/soil-temperature`, `/api/maple-tapping/season-estimate`, `/api/validate-planting-date`) translate `provider_error` to:
  - HTTP **503**
  - `error: "Geocoding provider unavailable. Please try again shortly."`
  - `errorCode: "geocoding_provider_unavailable"`
- "Bad ZIP" still returns HTTP 400 but now carries `errorCode: "zipcode_not_found"` so the frontend / log scrapers can tell the two apart.

The success-path response shape (200, `latitude`/`longitude`/`zone`/`zipcode`) is unchanged — the frontend keeps working without any TypeScript type updates.

## Tests Added

`backend/tests/test_geocoding_zip_cache.py` (21 tests, all passing):

- **TestZipNormalization** (5): whitespace stripping, non-string rejection, ZIP+4 rejection, length rejection, alphanumeric rejection.
- **TestZipCacheBehavior** (5): known-ZIP fallback short-circuits provider; repeated lookup invokes provider exactly once; whitespace variants share a cache entry; `validate_address` (legacy API) transparently uses the ZIP cache; full street addresses bypass the cache.
- **TestProviderErrorSurfacing** (5): provider-error returns distinct status; provider-error caches short-term; not-found returns distinct status; missing API key surfaces as `provider_error` (not `not_found`); non-ZIP input to `validate_zipcode` surfaces as `provider_error`.
- **TestCacheTtl** (2): manually-expired entries trigger a fresh provider call; `_zip_cache_clear()` works.
- **TestProviderLookupStatusMapping** (4): Geocodio non-200 → provider_error; Geocodio empty results → not_found; Geocodio `RequestException` → provider_error; Google `OVER_QUERY_LIMIT` → provider_error.

### Pytest result

```
backend $ python -m pytest
==== 2 failed, 1386 passed, 1 xfailed, 1583 warnings in 104.88s (0:01:44) =====
```

The two failures (`test_geocoding_service.py::TestAPILookup::test_api_lookup_washington_dc` and `TestMultiTierOrchestration::test_chicago_api_lookup`) are **pre-existing** upstream drift in the phzmapi.org USDA-zone API (returns 8a/6b vs expected 7a/6a). Confirmed reproducible on clean tree before any of my changes — see agent memory and `git stash` verification. They are unrelated to the geocoding cache work.

## Follow-ups / Risks

- **Multi-process deployment**: the cache is per-process. If this app is ever moved behind a multi-worker WSGI runner (gunicorn `--workers N`, uwsgi processes), each worker holds its own copy. Worst case is N×quota cost per unique ZIP, still vastly better than the current per-request cost. If/when that happens, consider Redis or a shared SQLite-backed cache table. Not required today: Flask runs single-process for this app.
- **Cache invalidation when adding to KNOWN_US_ZIPCODE_COORDS**: a ZIP that's already cached as a provider result will keep returning the provider value for up to 7 days even after the maintainer adds it to the local fallback table. Workaround: restart Flask, or expose `_zip_cache_clear()` via an admin endpoint if this becomes painful. Not currently a real workflow.
- **Frontend errorCode wiring**: the new `errorCode` field on error responses is purely additive — the frontend currently only reads `error` (a human string). If the UI wants to render different copy for "provider down" vs "bad ZIP", a frontend ticket can pick up `errorCode`. Not a blocking change.
- **`validate_address` non-ZIP path is uncached**: full street addresses (typed into the property-validate form) still cost one provider call each. That's intentional — street-level coords don't dedupe well across users. If this becomes a quota concern, we'd add a normalized-string cache, but it's a much smaller burn than the ZIP problem.
- **Pre-existing phzmapi.org test failures**: `test_geocoding_service.py::TestAPILookup::test_api_lookup_washington_dc` and `test_chicago_api_lookup` are flaky against upstream API drift. Worth either pinning expected zones to a wider set or mocking the API entirely. Out of scope here.

## Verification Commands

```bash
# Run new cache tests
cd backend && python -m pytest tests/test_geocoding_zip_cache.py -v

# Run full geocoding-related tests
cd backend && python -m pytest tests/test_geocoding_service.py tests/test_geocoding_zip_cache.py tests/test_frost_date_lookup.py

# Full backend suite
cd backend && python -m pytest
```

## Code Review Follow-up (2026-04-27)

Code-review verdict: **APPROVE WITH MINOR FOLLOW-UP**. Two real warnings filed; both fixed in the working tree. No new behavior beyond what's described below.

### Warning #1 — Malformed ZIP misclassified as PROVIDER_ERROR → HTTP 503 (FIXED)

**Symptom**: `validate_zipcode("abc")`, `validate_zipcode("123")`, `validate_zipcode("53703-1234")` all returned `(None, ZIP_STATUS_PROVIDER_ERROR)` because the `_normalize_zipcode` failure branch reused the provider-error sentinel. Every blueprint mapped that to HTTP 503 `"Geocoding provider unavailable"` — a user typo looked like a transient outage and would have triggered ops alerts on 5xx-rate dashboards.

**Fix**:

1. Added a fourth public sentinel in `services/geocoding_service.py`:
   ```python
   ZIP_STATUS_INVALID_INPUT = 'invalid_input'
   ```
   Exported alongside `ZIP_STATUS_OK` / `ZIP_STATUS_NOT_FOUND` / `ZIP_STATUS_PROVIDER_ERROR`.
2. Reworked `validate_zipcode` so a normalization failure returns `(None, ZIP_STATUS_INVALID_INPUT)` instead of `PROVIDER_ERROR`.
3. Updated all four user-facing `validate_zipcode` consumers to map `INVALID_INPUT` → **HTTP 400** with `errorCode: 'invalid_zipcode_format'` and message `"ZIP code must be 5 digits."`:
   - `weather_bp.py::_get_coordinates_from_request` (covers `/api/weather/current` and `/api/weather/forecast`)
   - `utilities_bp.py` `/api/soil-temperature` site (~line 452)
   - `utilities_bp.py` `/api/maple-tapping/season-estimate` site (~line 695)
   - `utilities_bp.py` `/api/validate-planting-date` site (~line 2014)
4. The batch `/api/validate-plants/batch` site (~line 1842) stays best-effort (consumes `_status` but does not return an HTTP error from a malformed batch ZIP). Added a comment noting `INVALID_INPUT` deliberately does NOT upgrade to 503 there.

### Warning #2 — Missing API key logged via `print()` (FIXED)

**Symptom**: `GeocodingService.__init__` used `print("WARNING: GEOCODING_API_KEY not set...")`, which goes to stdout and is easily lost in real log aggregation. Missing API key is a permanent deployment misconfig (60s `PROVIDER_ERROR` TTL doesn't help since it never clears) and must be loud at startup.

**Fix**: Replaced `print(...)` with `logger.error(...)` (the module-level `logger = logging.getLogger(__name__)` already exists). Did not raise at construction; the misconfig still allows the known-ZIP fallback table to serve common ZIPs and surfaces `PROVIDER_ERROR` for the rest, but it's now visible in any log feed that captures ERROR-level records.

### Tests Added

| Test | What it asserts |
|------|-----------------|
| `test_invalid_input_surfaces_invalid_input` (replaces `test_invalid_input_surfaces_provider_error`) | `'not-a-zip'`, `'abc'`, `'123'`, `'53703-1234'` all return `ZIP_STATUS_INVALID_INPUT`, distinct from `PROVIDER_ERROR`. |
| `test_invalid_input_does_not_consume_provider_quota` | Bad-shape input must short-circuit before any `_provider_lookup_with_status` call. |
| `test_no_api_key_treats_unknown_zip_as_provider_error` (extended with `caplog`) | Confirms a missing `GEOCODING_API_KEY` produces an ERROR-level log record (not a `print()`). |
| `TestBlueprintInvalidZipMapping::test_weather_current_with_malformed_zip_returns_400` | End-to-end: `GET /api/weather/current?zipcode=abc` returns HTTP 400 with `errorCode: invalid_zipcode_format`, NOT 503. |
| `TestBlueprintInvalidZipMapping::test_weather_current_with_zip_plus_4_returns_400` | Same, for `?zipcode=53703-1234`. |
| `TestBlueprintInvalidZipMapping::test_weather_current_with_short_zip_returns_400` | Same, for `?zipcode=123`. |

Total in `test_geocoding_zip_cache.py`: **25 tests** (was 21, +4 new + 2 renamed/extended).

### Updated File-Changed Table

| File | What changed (this follow-up) |
|------|--------------|
| `backend/services/geocoding_service.py` | Added `ZIP_STATUS_INVALID_INPUT` constant. `validate_zipcode` now returns it for bad-shape input. Replaced startup `print()` with `logger.error(...)` for missing API key. |
| `backend/blueprints/weather_bp.py` | Added `ZIP_STATUS_INVALID_INPUT` import; mapped it to HTTP 400 `invalid_zipcode_format` in `_get_coordinates_from_request`. |
| `backend/blueprints/utilities_bp.py` | Added `ZIP_STATUS_INVALID_INPUT` import; mapped it to HTTP 400 `invalid_zipcode_format` at three call sites (soil-temperature, maple-tapping, validate-planting-date). Annotated batch site (no behavior change there). |
| `backend/tests/test_geocoding_zip_cache.py` | Renamed `test_invalid_input_surfaces_provider_error` → `test_invalid_input_surfaces_invalid_input`; extended `test_no_api_key_*` with `caplog` assertion; added `test_invalid_input_does_not_consume_provider_quota` and 3-test `TestBlueprintInvalidZipMapping` class for end-to-end 400 mapping. |

### Pytest Result (after follow-up)

```
backend $ python -m pytest tests/test_geocoding_zip_cache.py -v
======================= 25 passed, 24 warnings in 2.39s =======================

backend $ python -m pytest
==== 2 failed, 1390 passed, 1 xfailed, 1587 warnings in 122.19s (0:02:02) =====
```

The 2 failures are the same pre-existing phzmapi.org drift (`test_api_lookup_washington_dc`, `test_chicago_api_lookup`) noted in the original section. Pass count grew from 1386 to 1390 (+4 new tests).

### Suggestions From Review — Deliberately Deferred

- **Constant duplication** (`ZIP_STATUS_*` module constants vs `_ZipLookupOutcome` class strings): the literal strings happen to overlap (`'not_found'`, `'provider_error'`) but the two layers serve different purposes — the class sentinels live INSIDE the cache, the public constants are part of the API contract. Unifying would require a public-facing class import and add coupling for callers. Skipped.
- **Raw exception text in 4 catch blocks** (`weather_bp.py` `_get_coordinates_from_request`, three `utilities_bp.py` sites): pre-existing pattern, leaks `str(e)` in the response body. Not introduced by either the original fix or this follow-up. Worth a separate cleanup pass; not in scope here.
- **Thundering-herd-of-2 between `_zip_cache_get` expiry and `_zip_cache_set` refill**: fine for single-process Flask. Would matter if/when this app moves to a multi-worker WSGI runner; addressed in the original "Multi-process deployment" follow-up note above.
