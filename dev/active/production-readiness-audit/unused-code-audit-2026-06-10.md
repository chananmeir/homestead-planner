# Unused-Code Audit — 2026-06-10

> **ADDENDUM (same day): dead code permanently removed.** After review, the user asked
> for the commented-out code to be deleted. A follow-up commit removed every
> `[UNUSED-2026-06-10]` block and deleted the 9 fully-dead files outright
> (~4,700 lines net). Rewritten replacement lines (cleaned-up imports) were kept.
> Zero markers remain in the codebase. All verification re-run green after removal
> (backend pytest identical to baseline, frontend tests, tsc, production build).
> The sections below describe the original comment-out pass; the inventory of WHAT
> was dead and WHY remains accurate. The flagged-only items (section D) and latent
> bugs (section E) are still open and untouched.
> History: checkpoint `88d8503` → comment-out `79c8282` → removal (see git log).
>
> **ADDENDUM 2: F-1 + F-2 resolved.** A follow-up commit deleted the three dead
> service modules (`services/planting_service.py`, `services/garden_bed_service.py`,
> `services/conflict_service.py`, ~670 lines) and stripped the zero-consumer
> re-export block + `__all__` from `services/__init__.py` (now a docstring-only
> package marker; all consumers already import submodules directly). The stale
> `utils/helpers.py` pointer and three CLAUDE.md references were updated to match
> (NULL-check example now cites `gardens_bp.py`; succession files-involved cites the
> live `conflict_checker.py`). Backend pytest re-verified identical to baseline.
> Implication: the Phase 2 service-layer refactor those modules anticipated is now
> officially abandoned — the inline blueprint implementations are the single
> implementation. Sections D (F-3 onward) and E remain open.
>
> **ADDENDUM 3: F-3 (partial), F-4, E-1, E-3, E-4 resolved.** A follow-up commit:
> - **F-3**: `fix_transplant_dates.py` and `init_db.py` wrapped in `main()` +
>   `if __name__ == '__main__'` guards — importing them no longer touches the DB.
>   The Plan-44 scripts (`add_gap_plantings.py`, `place_plants.py`,
>   `place_gap_plants.py`, `db_utils.py`) already had guards and were left as-is.
> - **F-4**: dead sync-pair mirror functions removed from BOTH sides together
>   (pairs stay symmetric): intensive plants-per-bed 3-fn chain + hex-position
>   3-fn chain (backend `intensive_spacing.py` + frontend `intensiveSpacing.ts`),
>   `calculate_migardener_plants_per_row`/`_rows` + frontend twins + the three
>   frontend-only row-coordinate helpers (`migardener_spacing.py` /
>   `migardenerSpacing.ts`), `get_plants_by_category`/`get_companion_plants`/
>   `get_incompatible_plants` + frontend `getPlantsByCategory`/`getCompanionPlants`/
>   `getWinterHardyPlants` (plant databases), and frontend-only
>   `getSpaceEstimateForSeed`. KEPT: backend `calculate_intensive_cells_required`
>   (its frontend twin is live via spaceAvailability.ts — mirror preserved) and
>   `HEX_ROW_OFFSET` on both sides (frontend live; backend used by demo + parity).
> - **E-1**: `WEATHER_API_URL` defined (`https://api.weatherapi.com/v1/current.json`,
>   matching the WeatherAPI.com params/response shape the code already used) — the
>   WEATHER_API_KEY branch no longer raises NameError.
> - **E-3**: import-mutates-DB hazard eliminated (same as F-3).
> - **E-4 / F-6**: all data-bearing `pages_bp` legacy routes now require login and
>   filter every query by `current_user.id` (previously unauthenticated `.all()`
>   dumps of every user's beds, events, photos, harvests, seeds, properties,
>   livestock). `/` and `/weather` render no user data and stay public.
> - **F-5 (endpoints with no frontend caller): intentionally NOT removed** — no
>   concrete fix was ever proposed; deleting public API surface is a product call.
> Still open: F-5 (decide endpoint fate), F-7 (import constants from
> utils/constants.py instead of local copies), F-8 (export-keyword-only cleanups),
> F-9 (App.css/logo.svg deletion, tests-only helpers), E-2 footnote (the broken
> conflict_service is deleted; nothing to fix).

Full-codebase sweep for unused code (backend + frontend), per request: *find code that is
not needed and comment it out*. Every commented block carries a greppable
**`[UNUSED-2026-06-10]`** marker. Nothing was deleted; everything is restorable by
un-commenting.

**Method**: 6 parallel read-only analysis agents (one per code area) produced candidates
with evidence; every REMOVE candidate was then independently re-verified by repo-wide
greps (bare symbol, quoted/dynamic references, import-path search, `.bat`/script/migration
references) before edits. Mechanical categories cross-checked with `pyflakes` (backend)
and ESLint + `tsc` (frontend).

**Hard exclusions (never touched)**: `backend/migrations/**`, `models.py` schema
definitions, Flask route handlers, the five synchronized backend↔frontend pairs
(space calculators, SFG/MIGardener/intensive spacing tables, plant databases), pytest
fixtures/conftest, data tables looked up by string keys.

**Safety**: checkpoint commit `88d8503` captured the pre-audit working tree; audit edits
are isolated on top of it.

---

## Verification results

| Check | Before audit | After audit |
|---|---|---|
| Backend `pytest` | 1471 passed, 5 failed*, 1 xfailed | 1471 passed, 5 failed*, 1 xfailed — **identical** |
| Frontend tests (`CI=true`) | 264 passed / 29 suites | see final summary (run post-edit) |
| `tsc --noEmit` | — | clean (after restoring one swallowed `export default`) |
| `pyflakes` (non-migration) | 84 findings | 0 findings in handled categories |

\* The 5 backend failures are pre-existing in `test_geocoding_service.py` (live-API
tests) — identical before and after; not caused by this audit.

---

## A. Commented out — whole files (9 files, ~2,990 lines)

| File | Lines | Why dead |
|---|---|---|
| `frontend/.../GardenDesigner/ConflictAuditModal.tsx` | 532 | Named-export component, zero importers anywhere |
| `frontend/.../GardenDesigner/TrellisManagerModal.tsx` | 991 | Zero importers; superseded by `PropertyDesigner/TrellisManager.tsx` |
| `frontend/.../GardenDesigner/MIGardenerRowPlanner.tsx` | 296 | Zero importers; MIGardener flow lives in GardenDesigner/PlantConfigModal |
| `frontend/.../GardenDesigner/RowScheduleModal.tsx` | 249 | Only importer was dead MIGardenerRowPlanner |
| `frontend/.../GardenDesigner/RowStrip.tsx` | 157 | Only importer was dead MIGardenerRowPlanner |
| `frontend/.../GardenDesigner/RowVarietyModal.tsx` | 73 | Zero importers (not even MIGardenerRowPlanner) |
| `frontend/src/components/NutritionalDataAdmin.tsx` | 546 | Never wired into App routing ('nutrition' tab renders NutritionalDashboard) |
| `frontend/.../PlantingCalendar/ErrorBoundary.tsx` | 95 | Duplicate of `common/ErrorBoundary.tsx` (the one App.tsx uses); never imported |
| `backend/config.py` | 48 | Whole config module orphaned — `app.py` configures Flask inline with the same values |

Fully-commented `.tsx` files end with `export {};` to stay valid modules under
`isolatedModules`.

## B. Commented out — backend functions / blocks

- **`app.py`**: dead duplicates `get_mulch_type_on_date` (canonical:
  `services/garden_bed_service.py`; utilities_bp uses its own local copy) and
  `admin_required` (canonical: `utils/decorators.py`); 7 dead module constants
  (`VALID_SUN_EXPOSURES`, `EMAIL_REGEX`, `USERNAME_REGEX`, `MIN_PASSWORD_LENGTH`,
  `DEFAULT_LATITUDE/LONGITUDE`, `ALLOWED_EXTENSIONS` — nothing does
  `from app import <constant>`; live copies in `utils/constants.py` / blueprint-local);
  orphaned imports (`Settings`, `datetime`, `parse_iso_date`, `wraps`, `re`, `current_user`).
- **`season_validator.py`**: `get_season_from_date`, `validate_heat_conditions` +
  `HEAT_THRESHOLDS` (heat alerts are client-side in WeatherAlertBanner.tsx),
  `suggest_optimal_date_range` (134-line orphan superseded by
  `calculate_optimal_planting_dates`/`calculate_cooler_planting_dates`); 6 dead locals;
  unused imports (`get_now`, `db`).
- **`blueprints/gardens_bp.py`**: 6 debug-print blocks (`[DRAG-DROP FIX]`, `[DEBUG]`,
  `=== BACKEND BATCH DEBUG ===`, `[STATS]` before/after, `[ERROR] CONFLICT`,
  `[SUCCESS]`, per-item `Creating PlantedItem...`). **Two of these ran a wasted DB
  query per batch request** purely to feed prints. Also dead `expected_harvest`
  batch-level calc (superseded by per-position calc) and `conflicts` local.
- **`blueprints/utilities_bp.py`**: `calculate_heat_protection_offset` (never wired;
  sibling cold-protection offset IS used), `explicit_bed_id_list` (written twice, never
  read), unused imports (`Settings`, 2 non-all-depths soil-temp functions).
- **`blueprints/properties_bp.py`**: dead `effective_width/length` computation block —
  fed a placement re-validation that was never implemented ("For brevity, assuming
  validation passes"); plus its now-orphaned `get_structure_by_id` import.
- **`conflict_checker.py`**: `[CONFLICT CHECK]` debug-print block (fired on every
  conflict validation); function-local `db` import.
- **Root modules**: `collision_rules.get_collision_rules`,
  `garden_methods.get_method_grid_size` + `bed_area_inches` local,
  `historical_soil_temp.clear_historical_cache`, `soil_temperature.get_mock_air_temp` +
  `DEFAULT_MOCK_AIR_TEMP`, `weather_service.clear_cache`,
  `structures_database.get_structures_by_category` / `get_all_categories`.
- **Services**: `nutritional_service` 3 module-level wrappers (class methods remain
  live), `usda_api_service` 2 wrappers, `seed_import_service.EXPECTED_COLUMNS`
  (implementation validates via HEADER_ALIASES instead),
  `garden_planner_service._calculate_trellis_space_for_seed` + function-local
  `import logging` + unused `Tuple`/`GardenPlanItem` imports.
- **Utils**: `constants.py` `VALID_SUN_EXPOSURES`/`DEFAULT_LATITUDE`/`DEFAULT_LONGITUDE`
  (consumers duplicated them locally instead of importing — see flag F-7),
  `plant_id_resolver` `is_deprecated_plant_id`/`get_all_valid_plant_ids`/`get_aliases_for_canonical_id`.
- **Unused imports** across `nutrition_bp` (sqlite3, db), `trellis_bp` (func), `pages_bp`
  (Settings), `livestock_bp` (datetime), `data_bp` (get_structure_by_id), `seeds_bp`
  (is_deprecated_plant_id), `openmeteo_service` (math + `interval` local),
  `forward_planting_validator`, `breed_service`, `csv_import_service` (5 names),
  `event_details_validator`, `rotation_checker`, `planting_service`,
  `plant_database_updater`, `garden_bed_service`, and **15 test files**.

## C. Commented out — frontend functions / blocks

- **`types.ts`**: `Location`, `ValidationResult`, `COMPOST_MATERIALS` (runtime const that
  shipped in the bundle unused), `CalculatePlanRequest`, `ShoppingListItem`,
  `ExportToCalendarResponse`, `RotationConflict`+`BedRotationStatus` chain,
  `BedHistoryEntry`, and the 4-type `NutritionSummary` chain.
- **`footprintCalculator.ts`**: dead subtree — `isCellInFootprintBedAware` + private
  MIGardener/Intensive variants + `isCellInFootprint` + `formatFootprintSize` +
  `FootprintCheckParams` (~230 lines). Live API untouched: `calculateSpacingBuffer`,
  `calculateFootprint`, `calculateFootprintBedAware`.
- **`FuturePlantingsOverlay.tsx`**: 3 orphaned exported helpers
  (`getFuturePlantingPositions`, `getFutureEventsAtPosition`,
  `getUnpositionedFutureEvents`) + 3 imports that served only them. The live component
  and its default export are untouched.
- **`autoPlacement.ts`**: local `calculateSpaceRequirement` (name-collides with the live
  synchronized calculator in `utils/gardenPlannerSpaceCalculator.ts` — that one is NOT
  touched) + orphaned `getSFGCellsRequired`/`calculateIntensiveCellsRequired` imports.
- **Small items**: `rowContinuity.calculateTotalRowLength`,
  `successionCalculations.isSuitableForSuccession`, `TimelineView/utils.formatDateRange`,
  `AddMapleTappingModal` `SyrupYield`/`TreeHealth` (authors had eslint-disable-marked
  them as known-unused), `permacultureZones` 3 helpers, `plantIdResolver` 2 helpers,
  `plantUtils.getVarietyOptions`+`VarietyOption`, `raisedBedHeight.getHeightPreset`/
  `getConstructionRecommendation`, `config.ts` wrapper object + default export
  (`API_BASE_URL` stays), `useProperty.__resetPrimaryPropertyCacheForTests` (test seam
  no test imported).
- **Debug leftovers**: `PlantIcon.tsx` 6 success-path `console.log`s that fired per grid
  cell (incl. one on a 100 ms timer per icon). The error-path `console.warn`s were kept.
  (`GardenPlanner.tsx` console.logs were left alone — they are intentionally gated
  behind the `DEBUG_SEASON_PLANNER` localStorage opt-in.)
- **Test files**: unused `React` import (useFocusHighlight.test), unused `props`
  destructure (HarvestPlantModal.test), superseded `makeRoutes` helper
  (IndoorSeedStarts.banner.test).

---

## D. Flagged only — NOT touched (needs your decision)

**F-1. Three entire backend service modules are dead** (zero runtime callers):
`services/planting_service.py` (386 lines — the POST `/api/planted-items[/batch]`
endpoints have their own inline implementations; the docstrings claiming otherwise are
stale), `services/garden_bed_service.py` (157 lines — blueprints kept local copies of
`get_mulch_type_on_date`), `services/conflict_service.py` (123 lines — also broken:
`find_conflicts_in_bed` calls `has_conflict()` with a wrong signature, per
TEST_GAP_REPORT SUS-06). Left alone because `services/__init__.py` re-exports them,
CLAUDE.md names them, and `planting_service.py` was modified in your current WIP —
commenting them out is a bigger architectural decision (finish the service-layer
refactor vs. drop it).

**F-2. `services/__init__.py` re-export block + `__all__`** — zero consumers (every
import in the repo goes directly to submodules). Removable together with F-1.

**F-3. One-off scripts** (runnable, so not "dead", but stale):
`add_gap_plantings.py`, `place_plants.py`, `place_gap_plants.py` (all hardcoded to
Plan 44; `place_plants.py` bypasses export_key idempotency), `init_db.py`, `db_utils.py`
(written for migration scripts that never adopted it). **Hazard**:
`fix_transplant_dates.py` and `init_db.py` execute at module level with **no
`__main__` guard** — merely importing `fix_transplant_dates` mutates the database.
Recommend moving to a `scripts/archive/` folder or adding guards.

**F-4. Sync-pair mirrors (policy: never auto-touch)** — unused on both sides but kept
for backend↔frontend parity per CLAUDE.md:
- `intensive_spacing.py` ↔ `intensiveSpacing.ts`: `calculate_intensive_cells_required`
  (backend only — frontend twin IS used), plants-per-bed 3-function chain, hex-position
  3-function chain (both sides).
- `migardener_spacing.py` ↔ `migardenerSpacing.ts`: `calculate_migardener_plants_per_row`,
  `calculate_migardener_rows` (both sides) + frontend-only `displayRowToPhysicalRow`,
  `physicalRowToDisplayRow`, `physicalRowToGridY`.
- `plant_database.py` ↔ `plantDatabase.ts`: `get_plants_by_category`,
  `get_companion_plants` (both sides), `get_incompatible_plants` (backend only),
  `getWinterHardyPlants` (frontend only).
- `gardenPlannerSpaceCalculator.ts`: `getSpaceEstimateForSeed` (no backend counterpart).
If you want these commented too, say so — each was verified zero-reference.

**F-5. API endpoints with no frontend caller** (left active — could serve external
tools/curl): `GET /api/plants/<id>`, `GET /api/plant-guilds/<id>` (redundant alias of
`/api/guilds/<id>`), `GET /api/garden-methods[/<id>]`, `GET /api/bed-templates[/<id>]`,
`GET|DELETE /api/planting-events/orphaned` (ghost-conflict repair tool),
`GET /api/export-garden-plan/<bed_id>` (PDF export with no UI entry point).

**F-6. `pages_bp.py` legacy server-rendered HTML routes** (11 routes, pre-React UI on
port 5000). ⚠️ Several queries there lack `user_id` filtering (e.g.
`GardenBed.query.all()`) — a cross-user data exposure if anyone browses those pages.
Recommend deciding: delete the legacy UI or fix its queries.

**F-7. Duplicated-constant smell**: `VALID_SUN_EXPOSURES`, `DEFAULT_LATITUDE/LONGITUDE`
existed in 3 places (app.py, utils/constants.py, blueprint-local). The unused copies are
now commented; the *better* fix is for `gardens_bp`/`utilities_bp` to import from
`utils/constants.py` instead of keeping local literals.

**F-8. Export-keyword-only candidates (frontend)** — symbols used in-file whose `export`
modifier is dead (removing the keyword is an edit, not a comment-out, so skipped):
`PlantedItemDisplayStatus(Tone)`, `GridCoordinate`, `GridValidationResult`,
`getMaxColumnLabel`, `PlacementRequest`, `PlacementResult`, 4 rowContinuity helpers,
`FootprintCell`, `calculateFootprint`, `DashboardTodayMeta`, `toSafeDate`,
`DateFilterMode`, `FormFileInputRef`, `FilterOption`, `ActiveFilter`, `Wrap`
(testUtils). Also 5 dual default+named exports where the named form is never imported
(PlacementPreview, SuccessionWizard, TimelineView, PlantIcon, StructureIcon).

**F-9. Misc**: `App.css` is imported but every rule in it is unused (CRA boilerplate;
app is Tailwind) — delete candidate. `logo.svg` is never imported (an asset can't be
commented out) — delete candidate. `breed_service.calculate_livestock_production` is
tests-only. `geocoding_service._geocodio_lookup`/`._google_lookup` are zero-reference
but dev docs record they were deliberately retained for backwards compat.

**F-10. Unused-but-side-effectful test locals** (left): `result = export_to_calendar(...)`
×5 in `test_succession_export.py`, `r1` in `test_planting_event_status.py:237` — the
calls are the test; only the binding is unused. Similarly `except ... as e:` unused
bindings in seeds_bp/nutrition_bp/maple_tapping_calculator (fixing means editing the
except clause, not commenting).

---

## E. Latent bugs discovered (not fixed — separate decisions)

1. **`weather_service.py:142`** references `WEATHER_API_URL`, which is defined nowhere
   (only `OPEN_METEO_URL` exists). The real-API branch raises `NameError` whenever
   `WEATHER_API_KEY` is set; callers survive only via a broad try/except that falls
   back to mock data. Real weather lookups silently never work through that path.
2. **`conflict_service.find_conflicts_in_bed`** would crash if ever called (wrong
   positional signature into `has_conflict()`); corroborates F-1.
3. **`fix_transplant_dates.py` mutates the DB on import** (no `__main__` guard) — see F-3.
4. **Legacy pages_bp queries without user_id filter** — see F-6.

---

## F. How to review / revert

- Find every change: `git grep -n "UNUSED-2026-06-10"`
- The audit is a single commit on top of checkpoint `88d8503`; revert with
  `git revert <audit-commit>` or restore any single block by deleting the marker lines
  and un-commenting.
