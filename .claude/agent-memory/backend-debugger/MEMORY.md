# Backend Debugger - Agent Memory

## Critical File Sizes & Locations
- `backend/models.py`: 54+ SQLAlchemy models, ~1449 lines
- `backend/services/garden_planner_service.py`: export_to_calendar at ~line 642, most complex service
- `backend/blueprints/gardens_bp.py`: GET planting-events at line 1099, date parsing at 1316-1317
- `backend/blueprints/garden_planner_bp.py`: season planner + garden snapshot endpoints
- `backend/services/space_calculator.py`: space calculations (MUST sync with frontend)
- `backend/utils/helpers.py`: `parse_iso_date()` -- canonical date parser

## Export to Calendar Gotchas
- ALWAYS sets `direct_seed_date` (never transplant_date or seed_start_date)
- Sets `garden_bed_id` only when bed_allocations exist
- Legacy path (no bed_allocations) creates events WITHOUT garden_bed_id
- `GardenPlanItem.first_plant_date` is `db.Date` -> returns `datetime.date`, NOT string
- Guard `strptime()` with `isinstance(value, str)` before calling

## Schema-Model Observations
- `export_key` column provides idempotency for calendar export (migration `de0b8c7ef792`)
- PlantingEvent has NO `status` column and NO `planted_date` column
- PlantedItem.source_plan_item_id is the ONLY reliable link to GardenPlanItem

## Common Bug Patterns
- Falsy check on nullable fields: `if value:` rejects 0. Always use `if value is not None:`
- JavaScript 'Z' suffix: `datetime.fromisoformat()` fails. Always use `parse_iso_date()`
- UUID queries without user_id filter -> data leakage risk
- event_type not checked before accessing plant_id -> None for non-planting events

## Planting Events Endpoint Filters
- In-ground filter: `transplant_date <= end_dt OR direct_seed_date <= end_dt`
- Tracking mode harvest filter: `expected_harvest_date >= start_dt OR both null`
- Planning mode harvest filter: different date logic at lines 1339-1345

## /api/planted-items/batch Per-Position Dates
- Each position in `positions[]` may carry its own `plantedDate`, overriding the request-level `plantedDate` (gardens_bp.py:716-717: `pos_planted_date = parse_iso_date(pos['plantedDate']) or planted_date`).
- Per-position derived values (`pos_expected_harvest`, completion flag) MUST be computed from `pos_planted_date`, not the outer `planted_date`. Mixed past/future batches are a real call shape — date-staggered planting uses it.
- Auto-created PlantingEvent.completed is now date-aware (past/today=True, future=False) per Layer 1 fix.

## Test Suites
- `tests/test_space_calculation_sync.py`: space calc sync (row/migardener assertions updated to sq-ft on 2026-04-22)
- `tests/test_succession_export.py`: 36 tests for succession export
- `tests/test_planting_event_status.py`: 36 tests for completion state
- `tests/test_dashboard_endpoint.py`: 22 tests for /api/dashboard/today
- `tests/test_cross_stack_parity.py`: frontend-canonical parity (694 pass / 1 xfail post-2026-04-22 data alignment; xfail = strawberry-1 Group H deferred perennial semantics)
- `tests/test_sfg_spacing_resolver.py`: 10 tests guarding digit-suffix + multi-segment fallback in `get_sfg_cells_required`
- `tests/test_save_for_seed_persistence.py`: 7 tests covering saveForSeed PUT → GET round-trip via /api/garden-beds (Phase B smoke #10)
- Full suite: `python -m pytest` (1390 pass / 2 fail / 1 xfail as of 2026-04-27 post-review; the 2 fails are pre-existing phzmapi.org drift in `test_geocoding_service.py::TestAPILookup::test_api_lookup_washington_dc` + `TestMultiTierOrchestration::test_chicago_api_lookup` — upstream USDA-zone API returns 8a/6b instead of expected 7a/6a; reproducible on clean tree, NOT related to local changes)
- Test client fixtures in conftest.py: `auth_client_a`/`auth_client_b` (logged-in), `client` (unauth), `user_a`/`user_b`; full_app registers all blueprints

## Indoor Seed Start Import Overdue Modes (utilities_bp.py, Phase B #6)
- POST `/api/indoor-seed-starts/from-planting-event` accepts `overdueMode: 'skip' | 'import_anyway' | 'reschedule_today'` + `dryRun: boolean` (2026-04-22).
- **Default when omitted = 'skip'** (policy: never silently backdate). Past-due row + skip → 200 with `{skipped: true, skippedReason, calculation}` — NOT 201.
- `'reschedule_today'` clamps start_date to today (via `datetime.combine(today_dt.date(), computed_start_date.time())`), slides germination/transplant dates forward, sets `rescheduled: true` in calculation payload.
- `'import_anyway'` = previous behavior: creates backdated row, returns warning string.
- `dryRun: true` → 200 preview with `{dryRun: true, wouldSkip, skippedReason, calculation}`, never persists.
- Invalid `overdueMode` → 400.
- Simulation-aware via `simulation_clock.get_utc_now()`.
- Validation order in endpoint: destinationBedIds (~1371) → overdueMode (~1438). Test `test_indoor_seed_start_overdue_modes.py` pins `set_simulated_date()` for deterministic past/future dates.
- **Gotcha**: existing #7/#8 tests used `transplantDate: '2026-05-15'` which computes a past-due start → added `'overdueMode': 'import_anyway'` to all 6 #7/#8 test payloads so they still hit 201 create path.

## IndoorSeedStart destination_bed_ids (models.py + utilities_bp.py)
- Column: `IndoorSeedStart.destination_bed_ids` (db.Text, JSON-encoded list of ints, nullable). Set → manual override (tier 1 of three-tier resolver in `get_current_garden_plan_count()`).
- Three-tier resolver order: (1) manual override `destination_bed_ids`, (2) bed_ids from matching PlantingEvents by (plant_id+variety+transplant_date±1d), (3) fallback to GardenPlanItem.bed_assignments within ±30 days of transplant_date.
- Tier 3 date-window is why single-planting crops (tomato) miss but succession crops (lettuce) hit — first_plant_date outside ±30d window fails matching.
- `to_dict()` surfaces `destinationBedDetails` (list of {id, name}) → UI gates "Destination" row and "Transplant Now" button on `destinationBedDetails.length > 0`.
- `POST /api/indoor-seed-starts/from-planting-event` (utilities_bp.py:1308+) accepts optional `destinationBedIds: int[]`; validates positive ints + user ownership, JSON-encodes to `destination_bed_ids`. Auto-fills `[linked_event.garden_bed_id]` when payload omits/empty + linked event has bed set.
- Sibling `POST /api/indoor-seed-starts` (line 798) uses looser validation — intentional: from-planting-event is stricter (Phase B smoke #7/#8 fix, 2026-04-22).
- Tests: `tests/test_indoor_seed_start_from_planting_event.py` (6 tests covering explicit, autofill, no-bed, cross-user rejection, malformed input, empty list).

## Save-for-Seed Toggle (gardens_bp.py:1299-1362)
- PUT /api/planted-items/:id with {saveForSeed: true} sets item.save_for_seed=True, status='saving-seed', computes seed_maturity_date = base_date + plant.days_to_seed.
- Round-trip confirmed working end-to-end: written at line 1302, serialized as camelCase saveForSeed at models.py:147, surfaced via GardenBed.to_dict nested plantedItems (models.py:97).
- Status transitions: growing → saving-seed on toggle-on; on toggle-off, restored by lifecycle (harvested > transplanted > growing > planned).
- **Frontend gotcha (Phase B #10)**: GardenDesigner.tsx::getActivePlantedItems has an explicit branch for 'harvested' but NOT for 'saving-seed'. Plants being saved for seed fall through to the DTM-based harvest-window filter and get hidden from the grid when planted+DTM < viewDate — which is the exact condition under which save-for-seed is used. Fix lives in the frontend (treat 'saving-seed' as non-harvested, keep visible until seedsCollected).

## Space Calculator Contract (canonical 2026-04-22)
- `services/space_calculator.py::calculate_space_requirement` returns SQ-FT-EQUIVALENT area per unit (1 SFG cell = 1 sq ft).
- `row` branch: `rowSpacing * spacing / 144` (rowSpacing falls back to spacing via `plant.get('rowSpacing') or spacing` — mirrors frontend `plant.rowSpacing || spacing`).
- `migardener` branch: row-based `plantSp * rowSp / 144`; broadcast (rowSp=None) `plantSp^2 / 144`; seed-density `1 / seedsPerSqFt` (per seed).
- `intensive`/`permaculture`/`square-foot` unchanged.
- Frontend canonical ref: `frontend/src/utils/gardenPlannerSpaceCalculator.ts::calculateSpaceRequirement`.
- For int cell counts (grid-highlighting/storage UI), introduce a separate helper — DO NOT overload the shared contract.
- The `grid_size` param is only consulted for unknown-plant fallback; parity assumes grid_size=12.
- Contract doc: `dev/active/production-readiness-audit/calculator-contract.md`.

## Parity Suite xfail Cleanup Convention
- After data-alignment pass fixes drift, DO NOT delete xfail groups — empty the frozenset and rewrite reason as "(legacy)" anchor.
- Full pattern: `.claude/agent-memory/backend-debugger/parity-suite-cleanup-pattern.md`
- When a subset stays deferred (product-model issue), split into a new letter group (H, I, ...) with its own reason — never mix "resolved" and "deferred" in one group.

## Dashboard Signals (/api/dashboard/today)
- Blueprint: `blueprints/dashboard_bp.py`, service: `services/dashboard_service.py`
- Composes 9 signal categories from existing models (no schema changes)
- Weather sourced via `simulation_weather.get_forecast_for_simulation(lat, lon, days=2)` using Property.latitude/longitude
- No `turn_frequency_days` column on CompostPile — default to 7 days hardcoded in service
- No per-user timezone field — response returns `'UTC'` placeholder
- Low stock threshold: < 2 packets (SeedInventory.quantity)
- Seed expiry window: 30 days; per-category cap: 20 rows
- Date resolution precedence: query param → simulation clock → real date.today()

## Geocoding ZIP Cache (services/geocoding_service.py, 2026-04-27)
- Process-level TTL cache inside `GeocodingService` keyed on normalized 5-digit ZIP (whitespace-stripped, exact 5-digit-isdigit). Layout: `_zip_cache: Dict[zip, (value, expires_at_monotonic)]`. Lock: `_zip_cache_lock`. Cleared via `_zip_cache_clear()` (test/admin hook).
- TTLs: success = 7 days, not-found = 30 min, provider-error = 60 sec. Provider error TTL is short on purpose so transient outages clear fast; success TTL is long because ZIP→lat/lon is stable.
- `validate_address(addr)` short-circuits ZIP-shaped input through `_lookup_zipcode_cached` — every existing callsite (`weather_bp`, `utilities_bp`, `frost_date_lookup._get_zone_from_zipcode`, `season_validator`) now caches automatically.
- `validate_zipcode(zip) -> (result_or_None, status)` returns one of FOUR public sentinels: `ZIP_STATUS_OK`, `ZIP_STATUS_NOT_FOUND`, `ZIP_STATUS_PROVIDER_ERROR`, **`ZIP_STATUS_INVALID_INPUT`** (added 2026-04-27 post-review). Blueprints map: OK→200, NOT_FOUND→400 zipcode_not_found, PROVIDER_ERROR→503 geocoding_provider_unavailable, **INVALID_INPUT→400 invalid_zipcode_format**.
- **Pre-2026-04-27 bug**: bad-shape input (`'abc'`, `'53703-1234'`) collapsed into `PROVIDER_ERROR` → HTTP 503. A user typo looked like a transient outage. Fixed: bad shape → `INVALID_INPUT` → HTTP 400. All 4 user-facing call sites mapped: weather_bp `_get_coordinates_from_request`, utilities_bp soil-temperature (~452), maple-tapping (~695), validate-planting-date (~2014). Batch site (~1842) intentionally stays best-effort (returns no HTTP error from malformed batch ZIP).
- Status mapping inside provider lookups: non-200 (incl. 403/422 quota), `requests.RequestException`, parse errors → `PROVIDER_ERROR`. Empty results array → `NOT_FOUND`. Google `OVER_QUERY_LIMIT`/`REQUEST_DENIED`/`UNKNOWN_ERROR`/`INVALID_REQUEST` → `PROVIDER_ERROR`.
- KNOWN_US_ZIPCODE_COORDS short-circuits before provider call AND populates cache, so well-known ZIPs cost zero quota. **Watchout**: when adding a ZIP to the fallback table, the cache will pin to the fallback for 7 days even after the table changes — call `_zip_cache_clear()` in dev / restart Flask.
- Missing-API-key startup logs at `logger.error()` (not `print()`) — visible in real log aggregation. Permanent misconfig won't clear via 60s TTL, so loud at startup matters.
- Tests: `tests/test_geocoding_zip_cache.py` (25 tests post-2026-04-27, was 21). Includes blueprint-level `TestBlueprintInvalidZipMapping` class using `auth_client_a` fixture for end-to-end 400-vs-503 verification. Mocks via `patch.object(_requests, 'get', ...)` — patching `services.geocoding_service.requests.get` does NOT work because the singleton `geocoding_service = GeocodingService()` shadows the module name in the dotted lookup.
- **Multi-process caveat**: cache is per-process. If Flask is ever moved behind gunicorn/uwsgi with multiple workers, each worker has its own cache (worst case = N quota hits per ZIP per worker, still vastly better than per-request). Note in followups when introducing multi-worker deployment.

## Dashboard Signal Grouping (2026-04-25)
- Per-PlantingEvent builders group same-key events into ONE signal row.
- Composite keys (per builder):
  - `_build_harvest_ready`: `(expected_harvest_date, plant_id, variety, garden_bed_id)`
  - `_build_indoor_starts_due` (PE/ISS): `(seed_start_date|start_date, plant_id, variety)` — NO bed
  - `_build_transplants_due`: `(transplant_date, plant_id, variety, garden_bed_id)`
  - `_build_direct_seed_due`: `(direct_seed_date, plant_id, variety, garden_bed_id)`
  - `_build_germination_check`: `(direct_seed_date, plant_id, variety, garden_bed_id)`
  - `_build_indoor_germination_check` (PE/ISS): `(seed_start_date|start_date, plant_id, variety)` — NO bed
- Variety normalization: `e.variety if e.variety else None` (empty string → None at key level).
- Representative event = lowest event id; rows sorted by date then min member id (deterministic).
- Grouped row payload adds `plantingEventIds: int[]` (PE-based) or `indoorSeedStartIds: int[]` (ISS-based). Singletons emit length-1 list. `quantity` is summed (None → 0). `harvestReady` uses MAX(daysPastExpected) and ANY(isStale).
- Snooze stays per-signalKey on representative; frontend fans-out POSTs across `plantingEventIds` for grouped dismiss.
- Out-of-scope (kept linear): `_build_frost_risk`, `_build_rain_alert`, `_build_livestock_actions`, `_build_compost_overdue`, `_build_seed_low_stock`, `_build_seed_expiring`.
- Tests: `tests/test_dashboard_service_grouping.py` (22 tests).
- Existing tests untouched (every legacy test creates a singleton, so payload-shape additions are additive).
