# Geocode Overuse / ZIP Cache — Code Review

**Sibling docs**: `geocode-overuse-repeated-zip-lookup-finding.md`, `geocode-overuse-fix-scope.md`
**Date**: 2026-04-27
**Reviewer**: `code-review` subagent
**Verdict**: **APPROVE WITH MINOR FOLLOW-UP**

## Build Status

- Backend `py_compile` PASS on all three modified files (`services/geocoding_service.py`, `blueprints/weather_bp.py`, `blueprints/utilities_bp.py`)
- New test file (`tests/test_geocoding_zip_cache.py`) — 21/21 PASS in 0.78s
- Full backend suite — 1386 passed, 2 failed, 1 xfailed. The 2 failures are pre-existing phzmapi.org upstream API drift (`test_api_lookup_washington_dc`, `test_chicago_api_lookup`) confirmed reproducible on a clean tree. Unrelated.

## Findings

### Warnings (should fix)

1. **Malformed ZIP input misclassified as `PROVIDER_ERROR` → HTTP 503**
   - `geocoding_service.py:267-271` (and consumers `weather_bp.py:44-48`, `utilities_bp.py:456-460,699-703,2015-2019`)
   - User typing `"abc"`, `"123"`, or `"53703-1234"` gets a 503 `"Geocoding provider unavailable"` instead of a 400 `"bad ZIP"`. Misleading for users and ops (503 alerts fire on bad client input).
   - Test `test_invalid_input_surfaces_provider_error` (line 222-230) actively asserts the misclassification, locking in the bug.
   - **Suggested fix**: introduce `ZIP_STATUS_INVALID_INPUT`, map it to HTTP 400 with `errorCode: 'invalid_zipcode_format'` at every blueprint call site, update the test.

2. **Missing API key cached as `PROVIDER_ERROR` (transient) but actually permanent**
   - `geocoding_service.py:175-182`
   - `print()` at line 104 instead of `logger.error()` makes deployment misconfig invisible in real logs.
   - **Suggested fix**: bump to `logger.error`. No need to raise at construction; just make it observable.

### Suggestions (nice to have, optional)

- Constant duplication: `ZIP_STATUS_*` module constants vs `_ZipLookupOutcome` class strings happen to use the same literals but are independent definitions. Could drift. (`geocoding_service.py:30-35` and class internals.)
- Generic `except Exception as e: ... str(e)` exposes raw exception text to clients in 4 sites in `weather_bp.py` / `utilities_bp.py`. Pre-existing, not introduced by this change.
- Thundering-herd-of-2 between expiry and refill (`_zip_cache_get` / `_zip_cache_set`). Not worth fixing for single-process Flask.

### Strengths (positive patterns observed)

- `time.monotonic()` for TTL math (immune to NTP/DST corrections).
- `dict(value)` shallow-copy on cache hit so callers can't poison the cache.
- Legacy `_geocodio_lookup` / `_google_lookup` kept as thin wrappers — backwards compatible for `frost_date_lookup.py` and `season_validator.py`, both of which now get cached transparently.
- Geocodio non-200 (incl. 403/422 quota) and Google `OVER_QUERY_LIMIT` / `REQUEST_DENIED` / `UNKNOWN_ERROR` / `INVALID_REQUEST` all correctly mapped to `PROVIDER_ERROR`. Symmetric across providers.
- Success-path JSON shape unchanged — frontend has no contract impact.
- Batch site at `utilities_bp.py:1842-1847` correctly best-effort (discards sentinel, leaves coords `None` on failure).
- Headline regression test `test_repeated_lookup_calls_provider_once` (line 82-107) uses Evansville `'47712'` (not in `KNOWN_US_ZIPCODE_COORDS`) to force the provider path, asserts exactly 1 provider call across 10 lookups. Strong test.
- TTL expiry test (line 234-260) mutates `_zip_cache` directly under the lock to fast-forward expiry — fast and deterministic, no `time.sleep()`.
- 21 tests cover normalization, cache hit/miss counting, TTL expiry, three status sentinels, provider failure mapping for both providers.

## Sync Check

- Frontend sync **NOT REQUIRED**. `errorCode` is additive; frontend only reads `error` (human string). Verified `errorCode` / `error_code` produce zero matches in `frontend/src/`.
- Plant database / SFG / MIGardener / Intensive sync groups not touched.

## CLAUDE.md Compliance

- No DB schema changes — confirmed (no migrations, no model edits).
- No `datetime.fromisoformat` introduced on inbound API dates.
- No hardcoded URLs (`http://localhost:5000`) introduced.
- Falsy checks on nullable fields: `if geo_result:` is correct here — value is dict-or-None, not int/0.
- Multi-process safety already flagged in fix-scope as known follow-up.

## File References

- `backend/services/geocoding_service.py`
- `backend/blueprints/weather_bp.py`
- `backend/blueprints/utilities_bp.py`
- `backend/tests/test_geocoding_zip_cache.py`
- `backend/frost_date_lookup.py` (legacy `validate_address` consumer — verified still works via cache)
- `backend/season_validator.py` (same)

## Overall Recommendation

**APPROVE WITH MINOR FOLLOW-UP.** Core fix is solid — cache mechanism, TTLs, status sentinels, success-path preservation, and test coverage all check out. Two warnings worth a paired follow-up commit before this ships to production. No reason to revert anything.
