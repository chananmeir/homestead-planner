# Homestead Planner: Comprehensive Test & Gap Report

**Date**: 2026-02-22 (updated 2026-02-28e)
**Branch**: baseline-buildable-frontend
**Scope**: Discovery + documentation. Bug fixes applied for BUG-01, BUG-02, BUG-04, BUG-05, BUG-06, BUG-07, BUG-08, BUG-09. Automated test suites for backlog #8 (space calc), #9 (succession export), #10 (auth + user isolation), #16 (conflict detection). Security fixes: health-records user isolation, export-garden-plan auth gate. Backlog #12: JSON schema validation for event_details (mulch + maple-tapping write-path validation, ~40 unit tests). Backlog #13: 4 DB CHECK constraints on trellis position fields (migration + 10 tests). Backlog #14: intensive spacing formula harmonized (backend now matches frontend `onCenter²/144`). **Playwright E2E**: 3 core E2E tests implemented (`e2e-core.spec.ts`) covering login+bed+plant placement, conflict detection (409), and plan-export-to-calendar verification. Config made CI-aware. 4 `data-testid` selectors added. **Garden Planner E2E**: 13 lifecycle tests implemented in `garden-planner.spec.ts` covering plan CRUD, succession (4x/8x), multi-bed allocation (even/custom), export-to-calendar, idempotent re-export, crop rotation conflict, and nutrition estimates. 8 `data-testid` selectors added. All 13 passing (~32s). **Garden Beds E2E**: 12 serial tests implemented in `garden-beds.spec.ts` covering all 6 planning methods, custom dimensions, edit flow, season extension (cold frame), clear bed, API listing, and API-only deletion. 4 `data-testid` selectors added. All 12 passing. **Garden Designer E2E**: 14 serial tests implemented in `garden-designer.spec.ts` covering plant placement & verification (API+UI), conflict detection (409), plant removal (API/UI/clear bed), seed saving lifecycle (toggle ON/OFF, collect seeds), cross-bed isolation, future plantings toggle, and season progress linkage. 9 `data-testid` selectors added across 3 files. All 14 passing (~50s). **Planting Calendar E2E**: 14 serial tests implemented in `planting-calendar.spec.ts` covering event CRUD for all 3 event types (planting/mulch/maple-tapping), succession creation, list/grid/timeline view toggling, event update + mark-as-harvested + deletion, soil temperature card toggle, and Garden Event/Maple Tapping button visibility. 7 `data-testid` selectors added. All 14 passing (~25s). **Seed Inventory E2E**: 12 serial tests implemented in `seed-inventory.spec.ts` covering seed CRUD via API (custom create, update quantity/notes, update agronomic overrides, delete), agronomic override NULL vs 0 validation, UI verification (seed cards, search filtering, Add New Seed modal), seed catalog pagination, and catalog-to-personal clone workflow. 7 `data-testid` selectors added across 3 files. 11 passing + 1 conditional skip (~21s). **Harvest Tracker E2E**: 10 serial tests implemented in `harvest-tracker.spec.ts` covering harvest CRUD via API (create with quality ratings excellent/good/fair, update quantity+quality, delete), GET all harvests verification, stats aggregation endpoint validation (total/count per plant), UI verification (harvest rows with count stat, search filtering, Log New Harvest modal open). 7 `data-testid` selectors added across 3 files. All 10 passing. **Livestock E2E**: 14 serial tests implemented in `livestock.spec.ts` covering chickens CRUD (create, update quantity, GET all), egg production record, duck creation, beehive CRUD + hive inspection + honey harvest, general livestock (goat) + health record, delete verification, UI tab switching (chickens/ducks/bees/other with card visibility), and category-specific Add New modal forms. 9 `data-testid` selectors added across 2 files. All 14 passing (~26s). **Compost Tracker E2E**: 11 serial tests implemented in `compost.spec.ts` covering pile CRUD via API (create, create second + GET both, update status/moisture/turned), ingredients & C:N ratio recalculation (add brown dried-leaves, add green grass-clippings, add more green food-scraps with directional ratio assertions), status lifecycle (building→cooking→curing→ready), delete with cascade verification, UI verification (pile card with C:N ratio display, status dropdown changes, Add Compost Pile form toggle). 6 `data-testid` selectors added to CompostTracker.tsx. All 11 passing (~23s). **Admin User Management E2E**: 13 serial tests implemented in `admin.spec.ts` covering access control (non-admin 403, unauthenticated 401), admin CRUD (list users with stats, search/filter, create user, duplicate username rejection, update email + admin status, reset password with login verification), self-protection constraints (cannot delete self, cannot reset own password, short password rejection), and delete with verification (cascade delete, 404 on non-existent user). 3 `data-testid` selectors added to AdminUserManagement/index.tsx. All 13 passing (~14s). **Property Designer E2E**: 13 serial tests implemented in `property-designer.spec.ts` covering property CRUD (create, create second + GET both, update), placed structure CRUD (place chicken-coop-small-1, place tool-shed-small-1 with rotation, update position, delete + verify gone), trellis CRUD with capacity tracking (create post_wire with Pythagorean length calc, get empty capacity, update coords recalculates length, delete), cascade delete (property deletion cascades structures), and UI verification (property selector, Add Structure + Manage Trellises buttons). 4 `data-testid` selectors added to PropertyDesigner.tsx. All 13 passing (~16s). **Weather Module E2E**: 12 serial tests implemented in `weather.spec.ts` covering weather API endpoint validation (GET current weather with zipcode, missing params 400, GET forecast with 7 days, days parameter clamping min=1/max=10, lat/lon coordinates), UI rendering (all main sections visible, 7-day forecast grid with Today highlighted, current conditions temperature + wind cards), settings panel (open/close toggle, ZIP code save triggers re-fetch), and GDD chart (chart rendering with forecast data, GDD formula verification against temperatures). 9 `data-testid` selectors added to WeatherAlerts.tsx. All 12 passing (~33s).
**Verification**: All bugs independently verified against source code.

---

## Table of Contents

1. [Feature Map](#1-feature-map)
2. [Endpoint Catalog](#2-endpoint-catalog)
3. [Test Matrix](#3-test-matrix)
4. [Edge Case Suite](#4-edge-case-suite)
5. [Known Risk Areas & What to Verify](#5-known-risk-areas--what-to-verify)
6. [Observed Bugs / Suspicious Code Paths](#6-observed-bugs--suspicious-code-paths)
7. [Backlog Recommendations](#7-backlog-recommendations)
8. [Regression Watchlist](#8-regression-watchlist)
9. [Smoke Test & Build Verification](#9-smoke-test--build-verification)
10. [Playwright E2E Test Suites](#10-playwright-e2e-test-suites)

---

## 1. Feature Map

| # | Feature Area | UI Entry Point | Key Components | Backend Endpoints | Models | Notes/Risks |
|---|---|---|---|---|---|---|
| 1 | **Garden Season Planner** | `/garden-planner` tab | `GardenPlanner.tsx`, `PlanNutritionCard`, `GardenSnapshot.tsx` | `garden_planner_bp`: `/api/garden-plans/*`, `/api/garden-planner/*` | `GardenPlan`, `GardenPlanItem` | COMPLEX: succession, multi-bed allocation, nutrition estimation, export-to-calendar |
| 2 | **Garden Visual Designer** | `/garden-designer` tab | `GardenDesigner.tsx` (2200+ lines), `PlantPalette`, `PlantConfigModal`, `BedFormModal`, `FootprintCalculator`, `FuturePlantingsOverlay`, `PlannedPlantsSection` | `gardens_bp`: `/api/garden-beds/*`, `/api/planted-items/*` | `GardenBed`, `PlantedItem` | COMPLEX: drag-drop (@dnd-kit), footprint buffer calc, date-aware progress, seed saving |
| 3 | **Planting Calendar** | `/planting-calendar` tab | `PlantingCalendar.tsx`, `CropsSidebar`, `ListView/CalendarGrid/TimelineView`, `AddCropModal`, `SoilTemperatureCard` | `gardens_bp`: `/api/planting-events/*`; `utilities_bp`: `/api/soil-temperature`, `/api/validate-planting` | `PlantingEvent` | Event type polymorphism (planting/mulch/fertilizing/irrigation/maple-tapping) |
| 4 | **Property Designer** | `/property-designer` tab | `PropertyDesigner.tsx`, `PropertyFormModal`, `StructureFormModal`, `TrellisManager` | `properties_bp`: `/api/properties/*`, `/api/placed-structures/*`; `trellis_bp`: `/api/trellis-structures/*` | `Property`, `PlacedStructure`, `TrellisStructure` | SVG canvas drag-drop, trellis has app-level overlap validation + 4 DB CHECK constraints (backlog #13 DONE) |
| 5 | **Indoor Seed Starts** | `/indoor-seed-starts` tab | `IndoorSeedStarts.tsx`, `ImportFromGardenModal` | `utilities_bp`: `/api/indoor-seed-starts/*` | `IndoorSeedStart` | Links to GardenPlanItem for needed-vs-started sync |
| 6 | **Seed Inventory** | `/seed-inventory` tab | `MySeedInventory.tsx`, `AddSeedModal`, `EditSeedModal`, `CSVImportModal` | `seeds_bp`: `/api/seeds/*` | `SeedInventory` (14 agronomic override fields) | NULL vs falsy critical on override fields |
| 7 | **Seed Catalog** | `/seed-catalog` tab | `SeedCatalog.tsx`, `AddFromCatalogModal` | `seeds_bp`: `/api/seed-catalog/*`, `/api/my-seeds/*` | `SeedInventory` (is_global=True) | Read-only browse + clone to personal |
| 8 | **Harvest Tracker** | `/harvest-tracker` tab | `HarvestTracker.tsx`, `LogHarvestModal`, `EditHarvestModal` | `harvests_bp`: `/api/harvests/*` | `HarvestRecord` | Quality ratings, date range filtering, yield stats |
| 9 | **Livestock** | `/livestock` tab | `Livestock.tsx`, `AnimalFormModal` | `livestock_bp`: `/api/chickens/*`, `/api/ducks/*`, `/api/beehives/*`, `/api/livestock/*` | `Chicken`, `Duck`, `Beehive`, `Livestock`, `EggProduction`, `DuckEggProduction`, `HiveInspection`, `HoneyHarvest`, `HealthRecord` | 4 sub-categories with different models |
| 10 | **Compost Tracker** | `/compost-tracker` tab | `CompostTracker.tsx` | `compost_bp`: `/api/compost-piles/*` | `CompostPile`, `CompostIngredient` | C:N ratio calculation, status lifecycle |
| 11 | **Weather Alerts** | `/weather` tab | `WeatherAlerts.tsx` | `weather_bp`: `/api/weather/*` | None (OpenMeteo API) | No auth required, zipcode in localStorage |
| 12 | **Nutritional Dashboard** | `/nutrition` tab | `NutritionalDashboard.tsx` | `nutrition_bp`: `/api/nutrition/*` | `NutritionalData` | Aggregates garden + livestock + trees; USDA search/import |
| 13 | **Photo Gallery** | `/photos` tab | `PhotoGallery.tsx` | `photos_bp`: `/api/photos/*` | `Photo` | File upload (PIL optimization), 16MB limit |
| 14 | **Admin User Mgmt** | `/admin` tab | `AdminUserManagement/` | `admin_bp`: `/api/admin/users/*` | `User` | @admin_required decorator |

---

## 2. Endpoint Catalog

*Verified against actual blueprint source files on 2026-02-22.*

### 2.1 Auth (`auth_bp` - prefix: `/api/auth`)

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | `/api/auth/check` | `check_auth` | Session check on mount |
| GET | `/api/auth/me` | `get_current_user` | Get current user details |
| POST | `/api/auth/login` | `login` | Sets HTTP-only cookie |
| POST | `/api/auth/logout` | `logout` | Clears session |
| POST | `/api/auth/register` | `register` | Creates User |

### 2.2 Garden Planner (`garden_planner_bp`)

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET, POST | `/api/garden-plans` | `api_garden_plans` | List/create plans |
| GET, PUT, DELETE | `/api/garden-plans/:id` | `api_garden_plan_detail` | Single plan CRUD (POST items via this) |
| POST | `/api/garden-plans/calculate` | `api_calculate_plan` | Quantity calculation |
| POST | `/api/garden-plans/:id/optimize` | `api_optimize_plan` | Plan optimization |
| GET | `/api/garden-plans/:id/feasibility` | `api_check_feasibility` | Space feasibility check |
| POST | `/api/garden-plans/:id/export-to-calendar` | `api_export_to_calendar` | **CRITICAL**: Creates PlantingEvents |
| GET | `/api/garden-plans/:id/shopping-list` | `api_shopping_list` | Generate shopping list |
| GET | `/api/garden-plans/:id/nutrition` | `api_plan_nutrition` | Plan nutrition estimate |
| POST | `/api/garden-plans/:id/designer-sync` | `api_designer_sync` | Sync plan to designer |
| POST | `/api/rotation/check` | `api_check_rotation` | Crop rotation validation |
| POST | `/api/rotation/suggest-beds` | `api_suggest_beds` | Suggest safe beds for crop |
| GET | `/api/rotation/bed-history/:bed_id` | `api_bed_history` | Bed rotation history |
| GET | `/api/garden-plans/:pid/beds/:bid/items` | `api_get_planned_items_for_bed` | Items for specific bed |
| GET | `/api/garden-planner/season-progress` | `api_season_progress` | Progress via source_plan_item_id |
| GET | `/api/garden-planner/garden-snapshot` | `api_garden_snapshot` | Point-in-time inventory |

**Foot-guns**: `firstPlantDate` is `db.Date` -> SQLAlchemy returns `datetime.date`, not string. Must guard with `isinstance(str)` before `strptime()`. Export key idempotency depends on exact string matching.

### 2.3 Gardens (`gardens_bp`)

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET, POST | `/api/garden-beds` | `garden_beds` | List/create beds |
| GET, PUT, DELETE | `/api/garden-beds/:id` | `garden_bed` | Single bed CRUD |
| POST | `/api/planted-items` | `add_planted_item` | Place single item |
| POST | `/api/planted-items/batch` | `batch_add_planted_items` | Batch place (drag-drop) |
| PUT, PATCH, DELETE | `/api/planted-items/:id` | `planted_item` | Update/delete item (includes seed saving) |
| POST | `/api/planted-items/:id/collect-seeds` | `collect_seeds` | Mark seeds collected |
| DELETE | `/api/garden-beds/:id/planted-items` | `clear_bed` | Clear all items from bed |
| DELETE | `/api/garden-beds/:id/planted-items/date/:date` | `clear_bed_by_date` | Clear items by date |
| DELETE | `/api/garden-beds/:id/planted-items/plant/:plant_id` | `remove_all_by_plant` | Remove all of a plant type |
| GET, POST | `/api/planting-events` | `planting_events` | List/create events |
| PUT, DELETE | `/api/planting-events/:id` | `planting_event` | Update/delete event |
| GET, DELETE | `/api/planting-events/orphaned` | `orphaned_planting_events` | Find/clean orphaned events |
| PATCH | `/api/planting-events/:id/harvest` | `mark_event_harvested` | Mark event as harvested |
| PATCH | `/api/planting-events/bulk-update` | `bulk_update_events` | Bulk update events |
| POST | `/api/planting-events/check-conflict` | `check_planting_conflict_route` | Check for conflicts |
| GET | `/api/planting-events/needs-indoor-starts` | `get_planting_events_needing_indoor_starts` | Events needing ISS |
| GET | `/api/planting-events/audit-conflicts` | `audit_conflicts` | Audit all conflicts |

**Foot-guns**: ~~`str(bed_id)` used in 5 PlantingEvent queries (BUG-05)~~ FIXED. ~~`daysToMaturity` falsy check at 3 locations (BUG-01)~~ FIXED.

### 2.4 Seeds (`seeds_bp`)

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET, POST | `/api/seeds` | `api_seeds` | Personal seeds |
| PUT, DELETE | `/api/seeds/:id` | `seed_item` | Update/delete seed |
| GET | `/api/seeds/varieties/:plant_id` | `get_varieties_by_plant` | Varieties for a plant |
| GET | `/api/seed-catalog` | `get_seed_catalog` | Global catalog |
| GET | `/api/seed-catalog/available-crops` | `get_available_crops` | Available crop list |
| GET | `/api/my-seeds` | `get_my_seeds` | Personal seed inventory |
| POST | `/api/my-seeds/from-catalog` | `add_seed_from_catalog` | Clone catalog seed to personal |
| POST | `/api/my-seeds/:id/sync-from-catalog` | `sync_seed_from_catalog` | Sync personal seed from catalog |
| POST | `/api/varieties/import` | `import_varieties` | Import varieties |

**Foot-guns**: 14 agronomic override fields are nullable. `to_dict()` correctly uses `is not None` guards. CSV import must match expected column format.

### 2.5 Properties (`properties_bp`)

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET, POST | `/api/properties` | `properties` | CRUD |
| GET, PUT, DELETE | `/api/properties/:id` | `property_detail` | Single ops |
| POST | `/api/properties/validate-address` | `validate_property_address` | Geocoding |
| POST | `/api/placed-structures` | `add_placed_structure` | Uses collision_validator |
| PUT, DELETE | `/api/placed-structures/:id` | `placed_structure` | Modify/delete |

### 2.6 Trellis (`trellis_bp`)

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET, POST | `/api/trellis-structures` | `trellis_structures` | CRUD |
| GET, PUT, DELETE | `/api/trellis-structures/:id` | `trellis_structure_detail` | Single ops |
| GET | `/api/trellis-structures/:id/capacity` | `trellis_capacity` | Reports occupied segments; overlap validation in `trellis_validation.py` |

### 2.7 Livestock (`livestock_bp`)

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET, POST | `/api/chickens` | `chickens_api` | Chicken CRUD |
| GET, PUT, DELETE | `/api/chickens/:id` | `chicken_detail` | Single chicken |
| GET, POST | `/api/egg-production` | `egg_production` | Top-level endpoint (not nested) |
| GET, POST | `/api/ducks` | `ducks_api` | Duck CRUD |
| GET, PUT, DELETE | `/api/ducks/:id` | `duck_detail` | Single duck |
| GET, POST | `/api/duck-egg-production` | `duck_egg_production` | Top-level endpoint |
| GET, POST | `/api/beehives` | `beehives_api` | Beehive CRUD |
| GET, PUT, DELETE | `/api/beehives/:id` | `beehive_detail` | Single beehive |
| GET, POST | `/api/hive-inspections` | `hive_inspections` | Top-level endpoint |
| GET, POST | `/api/honey-harvests` | `honey_harvests` | Top-level endpoint |
| GET, POST | `/api/livestock` | `livestock_api` | General livestock CRUD |
| GET, PUT, DELETE | `/api/livestock/:id` | `livestock_detail` | Single livestock |
| GET, POST | `/api/health-records` | `health_records` | Top-level endpoint |

**Note**: Livestock sub-resources (egg-production, hive-inspections, etc.) are top-level endpoints, NOT nested under the parent resource.

### 2.8 Harvests (`harvests_bp`)

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET, POST | `/api/harvests` | `api_harvests` | CRUD |
| PUT, DELETE | `/api/harvests/:id` | `harvest_record` | Single ops |
| GET | `/api/harvests/stats` | `harvest_stats` | Aggregate stats |

### 2.9 Compost (`compost_bp`)

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET, POST | `/api/compost-piles` | `compost_piles` | CRUD |
| GET, PUT, DELETE | `/api/compost-piles/:id` | `compost_pile` | Single ops |
| POST | `/api/compost-piles/:id/ingredients` | `add_compost_ingredient` | Recalculates C:N |

### 2.10 Weather (`weather_bp`)

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | `/api/weather/current` | `weather_current` | OpenMeteo API, no auth |
| GET | `/api/weather/forecast` | `weather_forecast` | OpenMeteo API, no auth |

### 2.11 Nutrition (`nutrition_bp`)

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | `/api/nutrition/dashboard` | `get_nutrition_dashboard` | Aggregate dashboard |
| POST | `/api/nutrition/estimate` | `estimate_nutrition` | Plan nutrition estimate |
| GET | `/api/nutrition/garden` | `get_garden_nutrition` | Garden-only breakdown |
| GET | `/api/nutrition/livestock` | `get_livestock_nutrition` | Livestock-only breakdown |
| GET | `/api/nutrition/trees` | `get_tree_nutrition` | Tree-only breakdown |
| GET | `/api/nutrition/data` | `get_nutritional_data_list` | List nutritional data |
| POST | `/api/nutrition/data` | `create_or_update_nutritional_data` | Create/update entries |
| DELETE | `/api/nutrition/data/:id` | `delete_nutritional_data` | Delete entry |
| GET | `/api/nutrition/usda/search` | `search_usda` | USDA food search |
| POST | `/api/nutrition/usda/import` | `import_from_usda` | Import from USDA DB |

### 2.12 Utilities (`utilities_bp`)

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| POST | `/api/spacing-calculator` | `calculate_spacing` | Space calculation API |
| GET | `/api/export-garden-plan/:id` | `export_garden_plan` | Export plan data |
| GET | `/api/soil-temperature` | `get_soil_temperature` | Soil temp data |
| GET | `/api/maple-tapping/season-estimate` | `get_maple_tapping_season` | Maple season estimate |
| GET, POST | `/api/indoor-seed-starts` | `indoor_seed_starts` | ISS list/create |
| GET, PUT, DELETE | `/api/indoor-seed-starts/:id` | `indoor_seed_start_detail` | ISS single ops |
| POST | `/api/indoor-seed-starts/:id/transplant` | `transplant_indoor_seed_start` | Mark transplanted |
| POST | `/api/indoor-seed-starts/calculate-quantity` | `calculate_indoor_quantity` | Calculate needed ISS quantity |
| POST | `/api/indoor-seed-starts/from-planting-event` | `create_indoor_start_from_planting_event` | Create ISS from event |
| POST | `/api/validate-planting` | `validate_planting` | Validate planting |
| POST | `/api/validate-plants-batch` | `validate_plants_batch` | Batch validation |
| POST | `/api/validate-planting-date` | `validate_planting_date_api` | Date-specific validation |

### 2.13 Photos (`photos_bp`)

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET, POST | `/api/photos` | `photos` | Multipart upload, PIL optimization |
| PUT, DELETE | `/api/photos/:id` | `manage_photo` | Single ops |

### 2.14 Admin (`admin_bp`)

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | `/api/admin/users` | `list_users` | @admin_required |
| POST | `/api/admin/users` | `create_user` | @admin_required |
| GET, PUT, DELETE | `/api/admin/users/:id` | `manage_user` | @admin_required |
| POST | `/api/admin/users/:id/reset-password` | `reset_user_password` | @admin_required |

### 2.15 Data (`data_bp`)

| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| GET | `/api/plants` | (data endpoint) | Read-only reference data, camelCase normalized |
| GET | `/api/garden-methods` | (data endpoint) | Planning method metadata |
| GET | `/api/bed-templates` | (data endpoint) | Bed template definitions |
| GET | `/api/structures` | (data endpoint) | Structure definitions + user's garden beds. **@login_required**, filtered by user_id (BUG-07 fix) |

### Endpoint Summary

**Total: ~122 endpoints across 14 blueprints + 1 data blueprint**

---

## 3. Test Matrix (Manual)

### 3.1 Authentication & Multi-User Isolation

| ID | Test Case | Preconditions | Steps | Expected Result | Priority |
|----|-----------|---------------|-------|-----------------|----------|
| AUTH-01 | Register new user | App running, no existing user "testuser1" | 1. POST `/api/auth/register` `{username:"testuser1", email:"t1@test.com", password:"Password1!"}` 2. Verify response | 200 with user object, password_hash NOT in response | P0 |
| AUTH-02 | Login with valid creds | AUTH-01 complete | 1. POST `/api/auth/login` `{username:"testuser1", password:"Password1!"}` 2. Verify session cookie set | 200, `{user: {username:"testuser1"}}`, HTTP-only cookie | P0 |
| AUTH-03 | Login with wrong password | AUTH-01 complete | 1. POST `/api/auth/login` `{username:"testuser1", password:"wrong"}` | 401 error | P0 |
| AUTH-04 | Auth check with session | Logged in | 1. GET `/api/auth/check` | `{authenticated: true, user: {...}}` | P0 |
| AUTH-05 | Auth check without session | Not logged in | 1. GET `/api/auth/check` (no cookie) | `{authenticated: false}` | P0 |
| AUTH-06 | Protected endpoint without auth | Not logged in | 1. GET `/api/garden-beds` (no cookie) | 401 or redirect | P0 |
| AUTH-07 | Data isolation - beds | User A and User B exist, each has beds | 1. Login as User A 2. GET `/api/garden-beds` 3. Login as User B 4. GET `/api/garden-beds` | Each sees only own beds, zero overlap | P0 |
| AUTH-08 | Data isolation - all models | Both users have data in all features | 1. For each endpoint (seeds, plans, livestock, harvests, compost, photos): verify user A cannot see user B's data | Complete isolation | P0 |

### 3.2 Garden Beds CRUD + Planning Methods

| ID | Test Case | Preconditions | Steps | Expected Result | Priority |
|----|-----------|---------------|-------|-----------------|----------|
| BED-01 | Create SFG bed | Logged in | 1. POST `/api/garden-beds` `{name:"Test SFG", width:4, length:8, planningMethod:"square-foot", gridSize:12}` | Bed created, gridSize=12 | P0 |
| BED-02 | Create MIGardener bed | Logged in | 1. POST with `planningMethod:"migardener"` | Bed created | P0 |
| BED-03 | Create Row bed | Logged in | 1. POST with `planningMethod:"row"` | Bed created | P1 |
| BED-04 | Create Intensive bed | Logged in | 1. POST with `planningMethod:"intensive"` | Bed created | P1 |
| BED-05 | Update bed dimensions | BED-01 exists | 1. PUT bed with `width:3, length:6` | Updated, planted items still valid | P1 |
| BED-06 | Delete bed cascades | BED-01 has planted items | 1. DELETE bed 2. Query PlantedItems for that bed | Bed + all PlantedItems deleted | P0 |
| BED-07 | Season extension JSON | Logged in | 1. Create bed with `seasonExtension:{type:"cold-frame", layers:2}` 2. GET bed | JSON stored and returned correctly | P1 |
| BED-08 | Grid size affects spacing | SFG bed exists | 1. Place tomato (SFG: 1 per cell) 2. Verify grid respects 12" cells | Tomato occupies exactly 1 cell | P0 |
| BED-09 | Clear bed | Bed with items + events | 1. DELETE `/api/garden-beds/:id/planted-items` | All PlantedItems + PlantingEvents removed, bed preserved | P1 |
| BED-10 | Permaculture bed type | Logged in | 1. Create bed with `planningMethod:"permaculture"` | Creates successfully | P2 |

### 3.3 Season Planner - Full Lifecycle (CRITICAL)

| ID | Test Case | Preconditions | Steps | Expected Result | Priority |
|----|-----------|---------------|-------|-----------------|----------|
| PLAN-01 | Create garden plan | Logged in | 1. POST `/api/garden-plans` `{name:"2026 Plan", season:"year-round", year:2026, strategy:"balanced"}` | Plan created with ID | P0 |
| PLAN-02 | Add plan item (simple) | PLAN-01, seed "tomato-1" exists | 1. POST item: `{plantId:"tomato-1", unitType:"plants", targetValue:12, successionEnabled:false, bedAssignments:[{bedId:1, quantity:12}]}` | Item created, spaceRequiredCells computed | P0 |
| PLAN-03 | Add item with succession=0 | Plan exists | 1. Add item with `successionEnabled:false` | Single planting, no succession splitting | P0 |
| PLAN-04 | Add item with succession=1 | Plan exists | 1. Add item with `successionEnabled:true, successionCount:1` | Acts like single planting (qty/1 = full qty) | P0 |
| PLAN-05 | Add item with succession=4 | Plan, bed exist | 1. Add item: `{plantId:"lettuce-1", targetValue:100, successionEnabled:true, successionCount:4, successionIntervalDays:14, firstPlantDate:"2026-04-15"}` | Item saved with all succession fields | P0 |
| PLAN-06 | Add item with succession=8 | Plan, bed exist | 1. Same as PLAN-05 but `successionCount:8` | 8 succession slots, quantity divided by 8 | P1 |
| PLAN-07 | Manual quantity override | Plan, seed exist | 1. Use `/calculate` then override `targetValue` manually | Override preserved, not recalculated | P1 |
| PLAN-08 | Multi-bed allocation EVEN | Plan, 3 beds exist | 1. Add item: `{targetValue:90, bedAssignments:[{bedId:1,quantity:30},{bedId:2,quantity:30},{bedId:3,quantity:30}], allocationMode:"even"}` | 30 per bed | P0 |
| PLAN-09 | Multi-bed allocation CUSTOM | Plan, 3 beds | 1. Add item: `{targetValue:100, bedAssignments:[{bedId:1,quantity:60},{bedId:2,quantity:25},{bedId:3,quantity:15}], allocationMode:"custom"}` | Unequal distribution preserved | P0 |
| PLAN-10 | Export to calendar (simple) | PLAN-02 done | 1. POST `/api/garden-plans/:id/export-to-calendar` 2. GET `/api/planting-events` | PlantingEvents created with correct dates, quantities, export_key set | P0 |
| PLAN-11 | Export with succession=4 | PLAN-05 done | 1. Export to calendar | 4 PlantingEvents created, each with qty=25, dates offset by 14 days, all share succession_group_id | P0 |
| PLAN-12 | Export idempotency | PLAN-10 done | 1. Export same plan again | No duplicate events (export_key prevents), response indicates already exported | P0 |
| PLAN-13 | Preview export conflicts | Plan with items targeting occupied bed | 1. POST `/api/garden-plans/:id/feasibility` | Returns conflict details | P1 |
| PLAN-14 | Sidebar progress tracking | Plan exported, designer open | 1. Place plants from sidebar 2. Check `GET /api/garden-planner/season-progress?year=2026` | `byPlanItemId[itemId].placedSeason` increments per source_plan_item_id | P0 |
| PLAN-15 | Progress per plan-item, not per variety | 2 plan items for same plant/variety in different beds | 1. Place from plan item A in bed 1 2. Check progress | Only plan item A progress increases, not plan item B (even though same plant) | P0 |

### 3.4 Space Calculation Consistency (CRITICAL)

| ID | Test Case | Plant | Method | Qty | Expected Cells | Check Both | Priority |
|----|-----------|-------|--------|-----|----------------|------------|----------|
| SPACE-01 | Tomato SFG | tomato-1 | square-foot | 4 | 4 cells (1/plant) | Backend `calculate_space_requirement` + Frontend `calculateSpaceRequirement` | P0 |
| SPACE-02 | Lettuce SFG | lettuce-1 | square-foot | 16 | 4 cells (4/cell = 0.25 cell/plant) | Both | P0 |
| SPACE-03 | Carrot SFG | carrot-1 | square-foot | 32 | 2 cells (16/cell) | Both | P0 |
| SPACE-04 | Watermelon SFG | watermelon-1 | square-foot | 2 | 4 cells (0.5/cell = 2 cells/plant) | Both | P0 |
| SPACE-05 | Tomato MIGardener | tomato-1 | migardener | 4 | Verify row/plant spacing (24", 18") | Both must use same spacing | P0 |
| SPACE-06 | Lettuce MIGardener (seed-density) | lettuce-1 | migardener | 36 | Seed-density calc path | Both | P0 |
| SPACE-07 | Potato MIGardener | potato-1 | migardener | 10 | Both use (20,9) - Luke Marion reference | Both | P0 |
| SPACE-08 | Pepper MIGardener | pepper-1 | migardener | 6 | ~~BUG-03~~: FIXED - Frontend now has override (21,18) matching backend | Both | P0 |
| SPACE-09 | Tomato Row | tomato-1 | row | 4 | Traditional spacing calc | Both | P1 |
| SPACE-10 | Tomato Intensive | tomato-1 | intensive | 4 | Hexagonal packing calc | Both | P1 |
| SPACE-11 | Trellis plant | tomato-1 (trellis) | trellis_linear | 3 | 3 * linearFeetPerPlant (default 5) = 15 linear ft | Both | P1 |
| SPACE-12 | Seed-density broadcast | spinach-1 | migardener | 100 | seedDensityPerSqFt path (no row restriction) | Both | P1 |

### 3.5 Conflict Detection

**Automated coverage:** `backend/tests/test_conflict_detection.py` — 70 tests covering CONF-01 through CONF-07. CONF-08 (audit endpoint) is NOT covered (the `find_conflicts_in_bed()` function has a known bug — see SUS-06 below).

| ID | Test Case | Preconditions | Steps | Expected Result | Priority |
|----|-----------|---------------|-------|-----------------|----------|
| CONF-01 | Spatial conflict - same cell | Bed with tomato at (0,0) | 1. Try placing pepper at (0,0) | Conflict detected, type='spatial' | P0 |
| CONF-02 | Spatial conflict - spacing overlap | Bed with tomato at (0,0), spacing 12" | 1. Try placing at (0,1) in 12" grid | Conflict (within spacing radius) | P0 |
| CONF-03 | No conflict - sufficient distance | Bed with tomato at (0,0) | 1. Place lettuce at (3,3) in 12" grid | No conflict | P1 |
| CONF-04 | Temporal conflict - overlapping dates | Bed pos (0,0) has event Apr-Jul | 1. Try placing event at (0,0) Jun-Sep | Conflict detected, type='temporal' | P0 |
| CONF-05 | No temporal conflict - sequential | Bed pos (0,0) has event Apr-Jun | 1. Place event at (0,0) Jul-Sep | No conflict | P1 |
| CONF-06 | Combined spatial+temporal | Same cell, overlapping dates | 1. Validate | type='both' | P1 |
| CONF-07 | Conflict override | Conflict exists | 1. Place with `conflictOverride:true` | Placed despite conflict, warning returned | P1 |
| CONF-08 | Audit all conflicts in bed | Bed with multiple items | 1. GET `/api/planting-events/audit-conflicts` | List of all conflicts | P1 |

### 3.6 Calendar Export & Planting Events

| ID | Test Case | Preconditions | Steps | Expected Result | Priority |
|----|-----------|---------------|-------|-----------------|----------|
| CAL-01 | Export creates events | Plan with 1 item, no events | 1. Export to calendar | PlantingEvent created with correct plantId, variety, dates | P0 |
| CAL-02 | Succession dates correct | Plan item: 4 successions, 14-day interval, first=Apr 15 | 1. Export 2. Check events | 4 events: Apr 15, Apr 29, May 13, May 27 | P0 |
| CAL-03 | Succession group UUID | CAL-02 | 1. Query events by succession_group_id | All 4 events share same UUID, filtered by user_id | P0 |
| CAL-04 | Space division per succession | 100 plants, 4 successions | 1. Export | Each event has quantity=25 | P0 |
| CAL-05 | Re-export same plan | Already exported | 1. Export again | No new events created (export_key prevents), appropriate response | P0 |
| CAL-06 | Multi-bed export | Plan item with 3 bed assignments | 1. Export | Events created per-bed with correct per-bed quantities | P0 |
| CAL-07 | Trellis export | Plan item with trellis assignment | 1. Export | Event created with trellis_structure_id, linear_feet_allocated, AND position_start/end_inches (positions assigned sequentially) | P1 |
| CAL-08 | Non-planting event types | - | 1. Create event with eventType:"mulch", event_details JSON | Event saved, event_details parsed on retrieval | P1 |
| CAL-09 | Maple tapping event | - | 1. Create eventType:"maple-tapping" with tap_count in event_details | Event created, details preserved | P2 |
| CAL-10 | Delete single event | Events exist | 1. DELETE one event | Only that event removed, succession chain still valid | P1 |

### 3.7 Seed Saving Lifecycle

| ID | Test Case | Preconditions | Steps | Expected Result | Priority |
|----|-----------|---------------|-------|-----------------|----------|
| SEED-01 | Toggle save-for-seed ON | PlantedItem exists, plant has days_to_seed | 1. PUT `saveForSeed:true` | status='saving-seed', seed_maturity_date calculated, PlantingEvent harvest date extended | P0 |
| SEED-02 | Toggle save-for-seed OFF | SEED-01 done | 1. PUT `saveForSeed:false` | Status restored (harvested>transplanted>growing>planned), seed_maturity_date cleared | P0 |
| SEED-03 | Seed maturity date calc | Plant with days_to_seed=60, harvest_date=Jul 1 | 1. Toggle ON | seed_maturity_date = Aug 30 (Jul 1 + 60 days) | P0 |
| SEED-04 | No days_to_seed | Plant without days_to_seed field | 1. Toggle ON | seed_maturity_date = null (frontend prompts manual entry) | P1 |
| SEED-05 | Collect seeds | save_for_seed=true | 1. POST collect-seeds `{seedsCollectedDate:"2026-08-30"}` | seeds_collected=true, status='harvested' | P0 |
| SEED-06 | Base date priority | Plant with no harvest_date but has transplant_date | 1. Toggle ON | seed_maturity_date = transplant_date + daysToMaturity + days_to_seed | P1 |

### 3.8 Crop Rotation

| ID | Test Case | Preconditions | Steps | Expected Result | Priority |
|----|-----------|---------------|-------|-----------------|----------|
| ROT-01 | No conflict - first planting | Empty bed, no history | 1. POST `/api/rotation/check` for tomato in bed | hasConflict=false | P0 |
| ROT-02 | Conflict - same family same year | Tomato planted in bed in 2025 | 1. Check pepper (Solanaceae) in same bed 2026 | hasConflict=true, conflictYears=[2025], recommendation provided | P0 |
| ROT-03 | No conflict after 3 years | Tomato in bed 2022 | 1. Check pepper in 2026 | hasConflict=false (4 year gap) | P1 |
| ROT-04 | Safe bed suggestion | Tomato history in beds 1,2 | 1. POST `/api/rotation/suggest-beds` for pepper | Returns beds without Solanaceae history | P1 |
| ROT-05 | Different family OK | Tomato in bed 2025 | 1. Check carrot (Apiaceae) in same bed 2026 | hasConflict=false (different family) | P1 |

### 3.9 Plant Database & SFG Spacing Sync

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| SYNC-01 | Plant count match | 1. Count backend PLANT_DATABASE entries 2. Count frontend PLANT_DATABASE entries | Backend: 118, Frontend: 118 (**matched**) | P1 |
| SYNC-02 | SFG table count match | 1. Count backend SFG_SPACING entries 2. Count frontend SFG_PLANTS_PER_CELL entries | Backend: 49 base plants, Frontend: 105 (base + variants) | P1 |
| SYNC-03 | MIGardener count match | 1. Count backend MIGARDENER_SPACING_OVERRIDES 2. Count frontend | Backend: 54, Frontend: 54 (**synced**) — verified by automated tests | P0 |
| SYNC-04 | Spot-check 10 plants | 1. For tomato, lettuce, carrot, watermelon, pepper, broccoli, bean, spinach, onion, radish: compare all fields between frontend and backend | Identical spacing, DTM, tolerance values | P0 |

### 3.10 Livestock CRUD

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| LIVE-01 | Create chicken | POST `/api/chickens` `{name:"Henrietta", breed:"Rhode Island Red", quantity:1, purpose:"eggs"}` | Created with ID | P1 |
| LIVE-02 | Log egg production | POST `/api/egg-production` `{chickenId:X, date:"2026-02-22", count:3}` | Record saved | P1 |
| LIVE-03 | Create beehive | POST `/api/beehives` `{name:"Hive A", type:"Langstroth"}` | Created | P1 |
| LIVE-04 | Log hive inspection | POST `/api/hive-inspections` `{beehiveId:X, date, queenSeen:true, broodPattern:"good"}` | Inspection recorded | P2 |
| LIVE-05 | Create general livestock | POST `/api/livestock` `{name:"Daisy", species:"goat", breed:"Nigerian Dwarf"}` | Created | P1 |

### 3.11 Compost CRUD

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| COMP-01 | Create pile | POST `{name:"Pile 1", location:"Back yard"}` | Created, status="building" | P1 |
| COMP-02 | Add brown ingredient | POST ingredients `{name:"Leaves", amount:2, type:"brown", cnRatio:60}` | Added, pile C:N recalculated | P1 |
| COMP-03 | Add green ingredient | POST `{name:"Grass clippings", amount:1, type:"green", cnRatio:20}` | C:N ratio updates toward target 25-30 | P1 |
| COMP-04 | Status transition | PUT `{status:"cooking"}` then "curing" then "ready" | Valid transitions | P2 |

### 3.12 Harvest Tracker

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| HARV-01 | Log harvest | POST `{plantId:"tomato-1", harvestDate:"2026-07-15", quantity:5, unit:"lbs", quality:"excellent"}` | Record created | P1 |
| HARV-02 | Get harvest stats | GET `/api/harvests/stats` | Totals by plant, correct aggregation | P1 |
| HARV-03 | Date range filter | GET `/api/harvests?startDate=X&endDate=Y` | Only harvests in range returned | P2 |

### 3.13 Weather

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| WEATH-01 | Get current weather | GET `/api/weather/current?zipcode=49503` | Temperature, conditions returned from OpenMeteo | P1 |
| WEATH-02 | Get forecast | GET `/api/weather/forecast?zipcode=49503&days=7` | 7-day forecast array | P1 |
| WEATH-03 | Invalid zipcode | GET `/api/weather/current?zipcode=99999` | Graceful error or empty response | P2 |

### 3.14 Photos

| ID | Test Case | Steps | Expected Result | Priority |
|----|-----------|-------|-----------------|----------|
| PHOTO-01 | Upload photo | POST multipart with image file | Photo saved, PIL optimized, filepath returned | P1 |
| PHOTO-02 | List photos | GET `/api/photos` | User's photos returned | P1 |
| PHOTO-03 | Delete photo | DELETE `/api/photos/:id` | Removed from DB and filesystem | P1 |

---

## 4. Edge Case Suite

### 4.1 Succession Planting Edge Cases

| ID | Scenario | Input | Risk | Priority |
|----|----------|-------|------|----------|
| EC-SUC-01 | Zero successions | `successionCount:0` or `successionEnabled:false` | Division by zero in space calc | P0 |
| EC-SUC-02 | Single succession | `successionCount:1` | Should equal full quantity (100/1=100) | P0 |
| EC-SUC-03 | Max successions (8) | `successionCount:8` | Quantity per succession very small (100/8=12.5 -> rounding) | P0 |
| EC-SUC-04 | Remainder distribution | 25 plants / 4 successions | 7+6+6+6 or 6+6+6+7? Verify consistency | P1 |
| EC-SUC-05 | Interval = 0 days | `successionIntervalDays:0` | All successions on same date? | P1 |
| EC-SUC-06 | No firstPlantDate | `firstPlantDate:null` with succession | Fallback behavior for date calculation | P1 |

### 4.2 Quantity & Space Edge Cases

| ID | Scenario | Input | Risk | Priority |
|----|----------|-------|------|----------|
| EC-QTY-01 | Zero quantity | `targetValue:0` | Empty plan item? Division by zero? | P1 |
| EC-QTY-02 | One plant | `targetValue:1` | Minimum viable allocation | P1 |
| EC-QTY-03 | Very large quantity | `targetValue:10000` | Performance, overflow | P2 |
| EC-QTY-04 | daysToMaturity = 0 | Plant with DTM=0 | **BUG-01**: Falsy check fails at gardens_bp.py:234 | P0 |
| EC-QTY-05 | Fractional SFG cells | 0.5 plants/cell (watermelon) | 2 cells per plant, verify rounding | P1 |

### 4.3 Date Handling Edge Cases

| ID | Scenario | Input | Risk | Priority |
|----|----------|-------|------|----------|
| EC-DATE-01 | ISO date with Z suffix | `"2026-04-15T00:00:00Z"` | parse_iso_date must handle | P0 |
| EC-DATE-02 | Date without time | `"2026-04-15"` | Must parse correctly | P0 |
| EC-DATE-03 | Null dates | `firstPlantDate:null` | Graceful handling | P1 |
| EC-DATE-04 | Past date | `firstPlantDate:"2020-01-01"` | Should still work (historical data) | P2 |
| EC-DATE-05 | Far future | `firstPlantDate:"2050-12-31"` | No overflow | P2 |

### 4.4 Multi-Bed Allocation Edge Cases

| ID | Scenario | Input | Risk | Priority |
|----|----------|-------|------|----------|
| EC-BED-01 | Single bed assignment | `bedAssignments:[{bedId:1, quantity:50}]` | Normal case | P1 |
| EC-BED-02 | 10+ bed assignments | Large farm scenario | Performance, UI display | P2 |
| EC-BED-03 | Assignment with qty=0 | `bedAssignments:[{bedId:1, quantity:0}]` | Empty allocation, should skip or warn | P1 |
| EC-BED-04 | Assignment with null bedId | `bedAssignments:[{bedId:null, quantity:10}]` | Must guard in JSON parsing | P1 |
| EC-BED-05 | Mismatched totals | Sum of bed quantities != targetValue | Validation needed | P1 |

### 4.5 Trellis Edge Cases

| ID | Scenario | Input | Risk | Priority |
|----|----------|-------|------|----------|
| EC-TREL-01 | Overlapping segments | Event A: 0-12", Event B: 6-18" | App-level validation (`check_trellis_overlaps` returns 409) + DB CHECK constraints (backlog #13 DONE). Cross-row overlap stays app-level only. | P1 |
| EC-TREL-02 | Position > trellis length | Trellis=10ft, position_end=15ft | App-level validation added (`validate_trellis_segment` returns 400). Export path logs warning but doesn't block. | P1 |
| EC-TREL-03 | Start > end | position_start=12, position_end=6 | App-level validation added (`validate_trellis_segment` rejects end <= start). | P1 |
| EC-TREL-04 | Zero-length trellis | total_length_feet=0 | Division by zero in capacity calc | P2 |

### 4.6 Agronomic Override Edge Cases

| ID | Scenario | Field | Risk | Priority |
|----|----------|-------|------|----------|
| EC-AGR-01 | Override = 0 | days_to_maturity = 0 | Must use `is not None`, not falsy check | P0 |
| EC-AGR-02 | Override = NULL | days_to_maturity = NULL | Fall back to plant default | P0 |
| EC-AGR-03 | All 14 overrides set | Every agronomic field populated | Verify all included in to_dict() response | P1 |
| EC-AGR-04 | Mixed NULL and values | Some overrides set, others NULL | Only non-NULL included in response | P1 |

### 4.7 Event Details JSON Edge Cases

| ID | Scenario | Input | Risk | Priority |
|----|----------|-------|------|----------|
| EC-JSON-01 | Malformed JSON | event_details = "{invalid" | try/except must catch | P0 |
| EC-JSON-02 | Empty string | event_details = "" | json.loads("") fails | P1 |
| EC-JSON-03 | Missing expected keys | event_details = "{}" for mulch event | get() with defaults required | P1 |
| EC-JSON-04 | NULL event_details | event_details = None | Type check before json.loads | P1 |

---

## 5. Known Risk Areas & What to Verify

### 5.1 CRITICAL: Space Calculation Synchronization

**Files that must stay synchronized:**

| # | File | Purpose |
|---|------|---------|
| 1 | `backend/services/space_calculator.py` (165 lines) | Backend calculation engine |
| 2 | `backend/garden_methods.py` (SFG_SPACING dict, 49 base plants) | Backend SFG lookup |
| 3 | `frontend/src/utils/gardenPlannerSpaceCalculator.ts` | Frontend calculation engine |
| 4 | `frontend/src/utils/sfgSpacing.ts` (105 entries incl. variants) | Frontend SFG lookup |

**Also synchronized:**

| 5 | `backend/migardener_spacing.py` | Backend MIGardener overrides (**54 entries**) |
| 6 | `frontend/src/utils/migardenerSpacing.ts` | Frontend MIGardener overrides (**54 entries**) - synced with backend |
| 7 | `backend/intensive_spacing.py` | Backend intensive overrides (formula harmonized: `onCenter²/144`) |
| 8 | `frontend/src/utils/intensiveSpacing.ts` | Frontend intensive overrides (formula harmonized: `onCenter²/144`) |

**What to verify:** Run space calculations for 10 representative plants across all 4 methods on both backend and frontend. Compare results. BUG-02 (potato spacing) and BUG-03 (23 missing MIGardener overrides) are both FIXED.

### 5.2 CRITICAL: Succession Planting

**Files:** `garden_planner_service.py::export_to_calendar()` (3 code paths: bed-allocated, trellis, legacy)

**Verify:**
- Space division: total_qty / succession_count per event
- Date offsets: event[i].date = firstPlantDate + i * intervalDays
- UUID linking: all events in series share succession_group_id
- Idempotency: export_key prevents re-export duplicates
- Remainder handling: 25/4 = how distributed?

### 5.3 HIGH: Event Type Polymorphism

**Model:** `PlantingEvent.event_type` discriminates: planting | mulch | fertilizing | irrigation | maple-tapping

**Risk:** event_details is TEXT. Write-path validation added (backlog #12 DONE) via `backend/services/event_details_validator.py` for mulch and maple-tapping event types. Read paths remain defensive (try-except + `.get()` defaults).

**Verify:** Query events of each type, ensure event_details parsing uses try/except and get() with defaults. Check that non-planting events (plant_id=null) don't break queries that assume plant_id exists. Write-path validation tested in `backend/tests/test_event_details_validator.py` (~40 tests).

### 5.4 HIGH: Dual Status System

**PlantingEvent fields:** `status` (string), `completed` (bool), `quantity_completed` (int/null)

**Known contradictions possible:**
- `status='harvested'` + `completed=False`
- `completed=True` + `quantity_completed < quantity`

**Verify:** No logic assumes consistency between these fields. Prefer `quantity_completed` for completion tracking.

### 5.5 MEDIUM: Trellis Capacity

**DB CHECK constraints added (backlog #13 DONE):**
- `ck_pe_trellis_start_nonneg` — `trellis_position_start_inches >= 0`
- `ck_pe_trellis_end_gt_start` — `trellis_position_end_inches > trellis_position_start_inches`
- `ck_pe_linear_feet_nonneg` — `linear_feet_allocated >= 0`
- `ck_pe_trellis_fields_together` — start and end must both be NULL or both non-NULL

**Remaining app-level only (cannot express in SQLite CHECK):** overlapping segments (cross-row), out-of-range positions (end > trellis length, requires cross-table check).

**Application-level validation (2026-02-22):**
- `backend/services/trellis_validation.py` — `validate_trellis_segment()` rejects negative starts, end <= start, and out-of-range ends; `check_trellis_overlaps()` detects overlapping segments via DB query (always filtered by user_id)
- **Path A** (`gardens_bp.py`): Direct placement greedy algorithm now filters out NULL-position events and has a validation safety net (returns 400/409 on invalid/overlapping segments)
- **Path B** (`garden_planner_service.py`): Export-to-calendar now assigns `trellis_position_start_inches` / `trellis_position_end_inches` on exported events (previously only set `linear_feet_allocated`). Logs warnings for out-of-range but doesn't block export.

**Test coverage:** `backend/tests/test_trellis_check_constraints.py` — 10 tests (4 positive + 6 negative) verifying all 4 CHECK constraints.

**Verify:** Both paths produce positioned events. Manual placement after export should correctly find gaps via the greedy algorithm.

### 5.6 MEDIUM: UUID Linking Without FK

**Fields:** `succession_group_id`, `row_group_id` (TEXT strings, not FK)

**Verify:** All queries filtering by these UUIDs also filter by user_id. UUID generation uses uuid.uuid4().

### 5.7 ~~LOW: Settings User Isolation Bug (see BUG-04)~~ FIXED

**File:** `models.py:350-362` - `Settings.get_setting()` and `set_setting()` now accept and filter by `user_id`. Fixed in commit `c72cfee`.

---

## 6. Observed Bugs / Suspicious Code Paths

*All bugs independently verified against source code on 2026-02-22.*

### Confirmed Bugs

#### BUG-01: daysToMaturity Falsy Check (P0 - Data Correctness)

**Status:** FIXED (commit `c72cfee`)

**Location:** `backend/blueprints/gardens_bp.py` lines 234, 391, 423

**Code (all 3 instances):**
```python
if plant and plant.get('daysToMaturity'):  # WRONG: 0 is falsy
    expected_harvest = planted_date + timedelta(days=plant['daysToMaturity'])
```

**Impact:** Any plant with `daysToMaturity=0` will skip harvest date calculation. Harvest date remains unset or stale.

**Fix:** Changed to `if plant and plant.get('daysToMaturity') is not None:`

---

#### BUG-02: Potato MIGardener Spacing Divergence (P1 - Calculation Divergence)

**Status:** FIXED (2026-02-22)

**Location:**
- Backend `migardener_spacing.py:40`: `'potato-1': (20, 9)`
- Frontend `migardenerSpacing.ts:46`: `'potato-1': [20, 9]`

**Resolution:** Both files updated to (20, 9) per authoritative Luke Marion reference (`docs/references/MIGARDENER_REFERENCE.md`): 20" rows (7 rows per 12' bed), 9" in-row ("Potatoes: Crowding encouraged for yield").

---

#### BUG-03: Frontend Missing 23 MIGardener Overrides (P1 - Calculation Divergence)

**Status:** FIXED (2026-02-22) - All 23 missing entries added to `frontend/src/utils/migardenerSpacing.ts`. Both files now have 54 entries.

**Resolution:** Added all 23 backend overrides to the frontend MIGARDENER_SPACING_OVERRIDES map. Values match backend exactly. Build passes.

---

#### BUG-04: Settings Model Missing User ID Filter (P1 - Data Leakage)

**Status:** FIXED (commit `c72cfee`)

**Location:** `backend/models.py` lines 350-362

**Code (before fix):**
```python
@staticmethod
def get_setting(key, default=None):
    setting = Settings.query.filter_by(key=key).first()  # No user_id!
    return setting.value if setting else default

@staticmethod
def set_setting(key, value):
    setting = Settings.query.filter_by(key=key).first()  # No user_id!
    if setting:
        setting.value = value
    else:
        setting = Settings(key=key, value=value)  # No user_id set!
        db.session.add(setting)
    db.session.commit()
```

**Impact:** Multi-user: User A's setting returned for User B. `set_setting` creates rows without `user_id` (violates NOT NULL if constraint exists, or leaks if nullable). The table has `UniqueConstraint('user_id', 'key')` but queries don't use user_id.

**Fix:** Added `user_id` parameter to both methods. Updated all callers to pass `current_user.id`.

---

#### BUG-05: str(bed_id) Type Mismatch (P2 - Potential Query Failure)

**Status:** FIXED (2026-02-22)

**Location:** `backend/blueprints/gardens_bp.py` (formerly at lines 590, 721, 737, 807, 820)

**Resolution:** Removed `str()` wrapper from all 5 `PlantingEvent.query.filter_by(garden_bed_id=str(bed_id))` calls. The column is `db.Integer`, so passing a string was only working due to SQLite's loose typing and would break on PostgreSQL.

---

#### BUG-06: Plant Database Count Mismatch (P2 - Data Sync)

**Status:** FIXED (2026-02-22)

| Location | Count |
|----------|-------|
| Backend PLANT_DATABASE | **118** entries |
| Frontend PLANT_DATABASE | **118** entries |
| Backend SFG_SPACING (garden_methods.py) | **49** base plant names |
| Frontend SFG_PLANTS_PER_CELL | **105** entries (49 base + variants) |

**Resolution:** Added 5 missing plants to backend `plant_database.py`: `mache-1`, `claytonia-1`, `zucchini-1`, `clover-1`, `rye-1`. Values match frontend exactly. Added `'cover-crop'` to `validate_plant_database()` valid categories. Updated stale sync comment in `frontend/src/data/plantDatabase.ts`.

---

#### BUG-07: `/api/structures` Data Leak - No Auth, No User Filter (P0 - Data Leakage)

**Status:** FIXED (commit `061b9ae`)

**Location:** `backend/blueprints/data_bp.py` line 133

**Code (before fix):**
```python
@data_bp.route('/structures')
def get_structures():       # No @login_required!
    beds = GardenBed.query.all()  # No user_id filter!
```

**Impact:** Every user (including unauthenticated visitors) could see all users' garden bed names, dimensions, locations, and planning methods in the Property Designer structures list.

**Fix:** Added `@login_required` decorator and changed query to `GardenBed.query.filter_by(user_id=current_user.id).all()`. Only frontend consumer is `PropertyDesigner.tsx:224`, which is already gated behind auth.

---

#### BUG-08: `/api/health-records` GET Returns All Users' Records (P0 - Data Leakage)

**Status:** FIXED (2026-02-24)

**Location:** `backend/blueprints/livestock_bp.py` line 447

**Code (before fix):**
```python
records = HealthRecord.query.order_by(HealthRecord.date.desc()).limit(50).all()
```

**Impact:** Any authenticated user could see all users' health records. `HealthRecord` has no direct `user_id` column — must join through `Livestock` to enforce isolation.

**Fix:** Changed to `HealthRecord.query.join(Livestock).filter(Livestock.user_id == current_user.id).order_by(...)`.

---

#### BUG-09: `/api/export-garden-plan/<id>` Missing @login_required (P0 - Auth Bypass)

**Status:** FIXED (2026-02-24)

**Location:** `backend/blueprints/utilities_bp.py` line 198

**Code (before fix):**
```python
@utilities_bp.route('/export-garden-plan/<int:bed_id>')
def export_garden_plan(bed_id):
    bed = GardenBed.query.get_or_404(bed_id)
```

**Impact:** Unauthenticated users could export any garden plan PDF by guessing bed IDs.

**Fix:** Added `@login_required` decorator and ownership check (`bed.user_id != current_user.id` → 404).

---

### Suspicious Patterns (Not Confirmed Bugs)

| ID | Location | Concern | Severity |
|----|----------|---------|----------|
| SUS-01 | `gardens_bp.py` clear-bed endpoint | ~~Deletes PlantingEvents with `str(bed_id)`~~ - FIXED with BUG-05 | Resolved |
| SUS-02 | `IndoorSeedStart.get_current_garden_plan_count()` | Potential N+1 query when checking all plans | Low |
| SUS-03 | Frontend `migardenerSpacing.ts:154` | Comment `\ Traditional row-based crops` has backslash instead of `//` | Low (syntax) |
| SUS-04 | ~~`/api/plants` returns raw dicts with mixed casing~~ | RESOLVED: `_normalize_plant_keys()` in `data_bp.py` converts to camelCase | Resolved |
| SUS-05 | Livestock sub-resource endpoints are top-level | `/api/egg-production` instead of `/api/chickens/:id/egg-production` | Low (design) |
| SUS-06 | `conflict_service.py::find_conflicts_in_bed()` calls `has_conflict()` with positional args `(event1.position_x, event1.position_y, ...)` but `has_conflict()` expects `(new_event, existing_events, garden_bed)`. Dead/broken code. The `audit-conflicts` endpoint in `gardens_bp.py` has its own working implementation that doesn't use this function. | Low (dead code) |

---

## 7. Backlog Recommendations

### P0 - Fix Immediately (Data Correctness, Safe Small Wins)

| # | Issue | Effort | Files | Risk | Status |
|---|-------|--------|-------|------|--------|
| 1 | **BUG-01**: Fix daysToMaturity falsy checks (3 locations) | 5 min | 1 file, 3 lines | None | **FIXED** (`c72cfee`) |
| 2 | **BUG-04**: Fix Settings user_id filter | 15 min | 1 file, 2 methods + callers | Low | **FIXED** (`c72cfee`) |
| 2b | **BUG-07**: Fix `/api/structures` data leak | 5 min | 1 file, 3 lines | None | **FIXED** (`061b9ae`) |

### P1 - Fix Soon (Calculation Divergence)

| # | Issue | Effort | Files | Risk |
|---|-------|--------|-------|------|
| 3 | ~~**BUG-03**: Sync MIGardener frontend <- backend (23 entries)~~ FIXED | — | — | — |
| 4 | ~~**BUG-02**: Resolve potato spacing conflict~~ FIXED | — | — | — |
| 5 | ~~**BUG-06**: Verify plant DB count alignment (5 extras)~~ FIXED | — | — | — |
| 6 | ~~**BUG-05**: Remove str(bed_id) wrappers (5 locations)~~ FIXED | — | — | — |
| 7 | ~~Add trellis overlap validation~~ FIXED | — | — | — |

### P2 - Needs Planning Mode (Multi-file, Architectural)

| # | Issue | Effort | Files | Risk |
|---|-------|--------|-------|------|
| 8 | ~~Automated test suite: space calc sync~~ **DONE** | — | `backend/tests/test_space_calculation_sync.py` (114 tests), `frontend/src/utils/__tests__/gardenPlannerSpaceCalculator.test.ts` (55 tests) | — |
| 9 | ~~Automated test suite: succession export~~ **DONE** | — | `backend/tests/test_succession_export.py` (36 tests), `backend/tests/conftest.py` (shared fixtures) | — |
| 10 | ~~Automated test suite: auth + user isolation~~ **DONE** | — | `backend/tests/test_auth_isolation.py` (51 tests, 0 xfail), `backend/tests/conftest.py` (auth fixtures) | — |
| 11 | ~~Clean up dual status system~~ **DEFERRED** | 8+ hr | 5+ files | HIGH - behavioral change. **Intentionally deferred**: no user-facing bugs today; fix touches seed saving, calendar export, harvest marking, and designer placement with no status-transition test coverage as safety net. Risk/reward ratio too high. |
| 12 | ~~Add JSON schema for event_details~~ **DONE** | — | `backend/services/event_details_validator.py` (validator), `backend/blueprints/gardens_bp.py` (2 call sites), `backend/tests/test_event_details_validator.py` (~40 tests) | — |
| 13 | ~~Add DB CHECK constraints for trellis positions~~ **DONE** | — | `backend/models.py` (4 CheckConstraints), `migrations/versions/8b2eca933349_...py`, `backend/tests/test_trellis_check_constraints.py` (10 tests) | — |
| 14 | ~~Intensive spacing frontend/backend sync audit~~ **DONE** | — | Backend `intensive_spacing.py` formula harmonized to `onCenter²/144` (matching frontend). 20 new backend + 22 new frontend tests added. | — |
| 15 | ~~Fix mixed casing in /api/plants response~~ **DONE** | — | `backend/blueprints/data_bp.py` (`_normalize_plant_keys()`), `frontend/src/types.ts`, `frontend/src/data/plantDatabase.ts`, 6 component files updated. CLAUDE.md exception removed. | — |
| 16 | ~~Automated test suite: conflict detection~~ **DONE** | — | `backend/tests/test_conflict_detection.py` (70 tests: 12 spatial overlap, 10 temporal overlap, 8 sun exposure, 6 date helpers, 13 composite has_conflict, 4 PlantedItem conversion, 12 validate_planting_conflict pipeline, 5 query_candidate_items) | — |

---

## 8. Regression Watchlist

**Files that MUST be modified together:**

| Pair | Backend File | Frontend File | When Modified |
|------|-------------|---------------|---------------|
| **Space Calc** | `services/space_calculator.py` | `utils/gardenPlannerSpaceCalculator.ts` | Any space calculation change |
| **SFG Lookup** | `garden_methods.py` (SFG_SPACING) | `utils/sfgSpacing.ts` | Adding/changing SFG plant density |
| **MIGardener** | `migardener_spacing.py` | `utils/migardenerSpacing.ts` | Adding/changing MIGardener spacing |
| **Plant DB** | `plant_database.py` | `data/plantDatabase.ts` | Adding/modifying any plant |
| **Intensive** | `intensive_spacing.py` | `utils/intensiveSpacing.ts` | Adding/changing intensive spacing |

**Single files with outsized regression risk:**

| File | Why |
|------|-----|
| `services/garden_planner_service.py` | export_to_calendar has 3 code paths (bed, trellis, legacy). Change one, must verify all 3. |
| `models.py::PlantingEvent.to_dict()` | camelCase conversion for 30+ fields. Missing one breaks frontend. |
| `models.py::GardenPlanItem.to_dict()` | JSON field parsing (bed_assignments, trellis_assignments). Must handle malformed JSON. |
| `blueprints/garden_planner_bp.py` | Season progress endpoint aggregates across models. source_plan_item_id linkage is critical. |
| `blueprints/gardens_bp.py` | Plant placement + seed saving + event CRUD. Touches PlantedItem + PlantingEvent simultaneously. |
| `conflict_checker.py` | Spatial/temporal overlap detection used by multiple features. False positives block users. |
| `types.ts` | Frontend type definitions. Type mismatch causes silent data loss. |

**Automated verification status:**

| What | Status | Details |
|------|--------|---------|
| Backend pytest for space_calculator.py | **EXISTS** | `backend/tests/test_space_calculation_sync.py` — 114 tests covering all 5 methods (SFG, MIGardener, Intensive, Row, Permaculture) + lookup table sync checks + intensive formula parity |
| Frontend jest for gardenPlannerSpaceCalculator.ts | **EXISTS** | `frontend/src/utils/__tests__/gardenPlannerSpaceCalculator.test.ts` — 55 tests covering all 5 methods + lookup table sync checks + intensive formula parity |
| Cross-check script comparing backend vs frontend plant counts | Missing | Sync drift goes undetected |
| Integration test: export_to_calendar round-trip | **EXISTS** | `backend/tests/test_succession_export.py` — 36 tests covering all 3 code paths (legacy, bed-allocated, trellis), idempotent re-export, DTM/harvest-date resolution, remainder distribution, and edge cases |
| Auth isolation test hitting all endpoints | **EXISTS** | `backend/tests/test_auth_isolation.py` — 51 tests (all passing): 5 auth flow, 22 auth-required (17 protected + 3 public + 1 export-garden-plan + 1 structures), 12 user isolation (including health-records), 8 ownership protection, 5 admin access |
| Backend pytest for conflict_checker.py | **EXISTS** | `backend/tests/test_conflict_detection.py` — 70 tests covering spatial overlap (Chebyshev distance), temporal overlap (strict < boundary), sun exposure compatibility, date helpers, composite has_conflict(), PlantedItem-to-event conversion, validate_planting_conflict pipeline, and query_candidate_items DB queries |
| Playwright E2E: smoke tests | **EXISTS** | `frontend/tests/smoke.spec.ts` — 11 tests: register, login, create bed, navigate all 13 tabs, verify persistence, logout |
| Playwright E2E: auth isolation | **EXISTS** | `frontend/tests/auth-isolation.spec.ts` — multi-user data isolation |
| Playwright E2E: core user journeys | **EXISTS** | `frontend/tests/e2e-core.spec.ts` — 3 serial tests: login+bed+plant, conflict 409, plan+export+calendar verify. ~17s CI runtime |

---

## 9. Smoke Test & Build Verification

### Backend Boot

```bash
cd backend
python -m venv venv          # Create venv if needed
venv\Scripts\activate         # Windows
pip install -r requirements.txt
flask db upgrade              # Apply migrations
python app.py                 # Start on port 5000
# Verify: curl http://localhost:5000/api/auth/check -> {"authenticated": false}
```

### Frontend Boot

```bash
cd frontend
npm install
npm run build                 # Verify: exit code 0, no TypeScript errors
npm start                     # Start on port 3000
# Verify: http://localhost:3000 loads React app
```

### Existing Test Commands

```bash
# Backend space calc tests (114 tests)
cd backend && python -m pytest tests/test_space_calculation_sync.py -v

# Backend succession export tests (36 tests)
cd backend && python -m pytest tests/test_succession_export.py -v

# Frontend space calc tests (55 tests)
cd frontend && CI=true npx react-scripts test --testPathPattern="gardenPlannerSpaceCalculator" --watchAll=false

# Frontend build (TypeScript compilation check)
cd frontend && npm run build

# Playwright E2E tests (requires both servers running)
cd frontend && npx playwright test                          # All suites (headed locally, headless in CI)
cd frontend && npx playwright test tests/e2e-core.spec.ts   # Core 3 tests only
cd frontend && npx playwright test tests/smoke.spec.ts      # Smoke tests (11 tests)
cd frontend && CI=true npx playwright test                  # Force CI mode (headless, no slowMo)
```

### Minimal Smoke Checklist

1. Open http://localhost:3000
2. Register new user (testuser / test@test.com / TestPass1!)
3. Login with new user
4. Navigate to Garden Designer tab
5. Create a garden bed (name: "Test Bed", 4x8 ft, Square Foot method)
6. Verify bed appears on canvas
7. Navigate to Garden Planner tab
8. Create a plan for 2026
9. Add plan item: Tomato, 4 plants, assign to Test Bed
10. Export to calendar
11. Navigate to Planting Calendar tab
12. Verify tomato planting event appears
13. Navigate back to Garden Designer
14. Drag tomato from sidebar to bed
15. Verify sidebar progress shows "1/4" or similar
16. Navigate to Seed Inventory
17. Add a seed: Tomato, Beefsteak variety
18. Navigate to Harvest Tracker
19. Log a harvest: Tomato, 2 lbs
20. Verify harvest appears in list

---

## 10. Playwright E2E Test Suites

### 10.0 Infrastructure & Conventions

**Config:** `frontend/playwright.config.js` — Chromium, 1920x1080, screenshots on, video on. **CI-aware**: `headless: !!process.env.CI` (headed locally, headless in CI), `slowMo: process.env.CI ? 0 : 250` (watchable locally, fast in CI). Ports 3000/5000.

**Implemented test suites:**
```
frontend/tests/
  helpers/
    auth.ts              # ensureTestUser(), login(), loginViaAPI(), logout(), registerViaAPI()
    navigation.ts        # navigateTo(), TABS constant
  smoke.spec.ts          # 11 tests — navigation, login/logout, bed creation, tab traversal
  auth-isolation.spec.ts # Multi-user data isolation
  e2e-core.spec.ts       # 3 serial tests — critical user journeys (see 10.1a below)
  garden-beds.spec.ts    # 12 serial tests — garden bed CRUD & planning methods (see 10.2 below)
  garden-planner.spec.ts # 13 serial tests — garden planner full lifecycle (see 10.3 below)
  garden-designer.spec.ts # 14 serial tests — plant placement, removal, seed saving, cross-bed (see 10.4 below)
  planting-calendar.spec.ts # 14 serial tests — event CRUD, view toggling, soil temp (see 10.5 below)
  seed-inventory.spec.ts   # 12 serial tests — seed CRUD, agronomic overrides, search, catalog (see 10.8 below)
  harvest-tracker.spec.ts  # 10 serial tests — harvest CRUD, stats, UI (see 10.9 below)
  livestock.spec.ts        # 14 serial tests — chickens, ducks, beehives, goats, health records (see 10.10 below)
```

**data-testid selectors (implemented):**
| Selector | Component | Purpose |
|----------|-----------|---------|
| `data-testid="toast-{type}"` | `Toast.tsx` | Match toast by type (success/error/info/warning) |
| `data-testid="add-bed-btn"` | `GardenDesigner.tsx` | Add Bed button |
| `data-testid="create-bed-submit"` | `BedFormModal.tsx` | Create/Update Bed submit button |
| `data-testid="planting-event-item"` | `ListView/index.tsx` | Planting event row in calendar list view |
| `data-testid="create-plan-btn"` | `GardenPlanner.tsx` | Create Plan button |
| `data-testid="plan-card-{id}"` | `GardenPlanner.tsx` | Plan card in list |
| `data-testid="plan-view-{id}"` | `GardenPlanner.tsx` | View plan button |
| `data-testid="plan-delete-{id}"` | `GardenPlanner.tsx` | Delete plan button |
| `data-testid="export-to-calendar-btn"` | `GardenPlanner.tsx` | Export to Calendar button |
| `data-testid="confirm-dialog-confirm"` | `ConfirmDialog.tsx` | Confirm button in dialog |
| `data-testid="plan-nutrition-card"` | `PlanNutritionCard.tsx` | Nutrition card container |
| `data-testid="bed-selector"` | `GardenDesigner.tsx` | Bed filter/selector dropdown |
| `data-testid="active-bed-indicator"` | `GardenDesigner.tsx` | Active bed name indicator |
| `data-testid="btn-add-seed"` | `MySeedInventory.tsx` | Add New Seed button |
| `data-testid="seed-count"` | `MySeedInventory.tsx` | Varieties in Stock stat |
| `data-testid="seed-card-{id}"` | `MySeedInventory.tsx` | Individual seed card |
| `data-testid="btn-edit-seed-{id}"` | `MySeedInventory.tsx` | Edit seed button |
| `data-testid="btn-delete-seed-{id}"` | `MySeedInventory.tsx` | Delete seed button |
| `data-testid="add-seed-submit"` | `AddSeedModal.tsx` | Add Seed submit button |
| `data-testid="edit-seed-submit"` | `EditSeedModal.tsx` | Edit Seed submit button |
| `data-testid="edit-bed-btn"` | `GardenDesigner.tsx` | Edit active bed button |
| `data-testid="clear-bed-btn"` | `GardenDesigner.tsx` | Clear active bed button |
| `data-testid="add-bed-btn-empty"` | `GardenDesigner.tsx` | Create First Bed button (empty state) |
| `data-testid="planted-item-{id}"` | `GardenDesigner.tsx` | SVG group for a planted item on grid |
| `data-testid="future-plantings-toggle"` | `GardenDesigner.tsx` | Toggle future plantings overlay |
| `data-testid="plant-detail-panel"` | `GardenDesigner.tsx` | Plant detail side panel |
| `data-testid="plant-status-badge"` | `GardenDesigner.tsx` | Status badge in detail panel |
| `data-testid="seed-saving-toggle"` | `GardenDesigner.tsx` | Save-for-seed toggle button |
| `data-testid="collect-seeds-btn"` | `GardenDesigner.tsx` | Collect Seeds button in detail panel |
| `data-testid="delete-plant-btn"` | `GardenDesigner.tsx` | Delete button in detail panel |
| `data-testid="seed-date-input"` | `SetSeedDateModal.tsx` | Seed maturity date input |
| `data-testid="seed-date-submit"` | `SetSeedDateModal.tsx` | Set Date submit button |
| `data-testid="collect-seeds-submit"` | `CollectSeedsModal.tsx` | Collect Seeds submit button |
| `data-testid="view-toggle-list"` | `PlantingCalendar/index.tsx` | Switch to list view |
| `data-testid="view-toggle-grid"` | `PlantingCalendar/index.tsx` | Switch to calendar grid view |
| `data-testid="view-toggle-timeline"` | `PlantingCalendar/index.tsx` | Switch to timeline view |
| `data-testid="btn-add-garden-event"` | `PlantingCalendar/index.tsx` | Open Garden Event modal |
| `data-testid="btn-add-maple-tapping"` | `PlantingCalendar/index.tsx` | Open Maple Tapping modal |
| `data-testid="soil-temp-toggle"` | `SoilTemperatureCard/index.tsx` | Expand/collapse soil temp card |
| `data-testid="harvest-count"` | `HarvestTracker.tsx` | Total Harvests stat |
| `data-testid="btn-log-harvest"` | `HarvestTracker.tsx` | Log New Harvest button |
| `data-testid="harvest-row-{id}"` | `HarvestTracker.tsx` | Individual harvest table row |
| `data-testid="btn-edit-harvest-{id}"` | `HarvestTracker.tsx` | Edit harvest button |
| `data-testid="btn-delete-harvest-{id}"` | `HarvestTracker.tsx` | Delete harvest button |
| `data-testid="log-harvest-submit"` | `LogHarvestModal.tsx` | Log Harvest submit button |
| `data-testid="edit-harvest-submit"` | `EditHarvestModal.tsx` | Edit Harvest submit button |
| `data-testid="livestock-tab-{id}"` | `Livestock.tsx` | Category tab button (chickens/ducks/bees/other) |
| `data-testid="btn-add-livestock"` | `Livestock.tsx` | Add New animal/beehive button |
| `data-testid="animal-card-{id}"` | `Livestock.tsx` | Animal card (chickens/ducks/other) |
| `data-testid="btn-edit-animal-{id}"` | `Livestock.tsx` | Edit animal button |
| `data-testid="btn-delete-animal-{id}"` | `Livestock.tsx` | Delete animal button |
| `data-testid="hive-card-{id}"` | `Livestock.tsx` | Beehive card |
| `data-testid="btn-edit-hive-{id}"` | `Livestock.tsx` | Edit beehive button |
| `data-testid="btn-delete-hive-{id}"` | `Livestock.tsx` | Delete beehive button |
| `data-testid="animal-form-submit"` | `AnimalFormModal.tsx` | Add/Edit animal submit button |
| `data-testid="btn-add-planting-event"` | `ListView/index.tsx` | Add Planting Event button in list view |

**Legacy test:** `frontend/test-seed-import.spec.js` — CSV seed import only (pre-existing, outside `tests/` directory).

**Proposed test file structure (not yet implemented):**
```
tests/
    auth.spec.ts         # Authentication & user isolation
    planting-calendar.spec.ts # Calendar views, events, soil temp
    space-calculations.spec.ts # Frontend space calc verification
    seed-inventory.spec.ts # Seed CRUD, CSV import, overrides
    seed-catalog.spec.ts  # Catalog browse, clone to personal
    harvest-tracker.spec.ts # Harvest logging, stats
    livestock.spec.ts     # Chickens, ducks, beehives, general
    compost.spec.ts       # Compost pile CRUD, C:N ratio
    weather.spec.ts       # Weather fetch, alerts, zipcode
    nutrition.spec.ts     # Dashboard, plan nutrition
    property-designer.spec.ts # Properties, structures, trellis
    photos.spec.ts        # Upload, list, delete
    admin.spec.ts         # User management (admin role)
    indoor-seed-starts.spec.ts # ISS CRUD, import from plan
```

**Shared helpers (implemented):**
```typescript
// helpers/auth.ts
export async function ensureTestUser(request: APIRequestContext) { /* idempotent register via API */ }
export async function login(page: Page, username?, password?) { /* UI login: clear cookies, fill form, submit */ }
export async function loginViaAPI(context: APIRequestContext, username, password) { /* API login, stores session cookie */ }
export async function logout(page: Page) { /* click logout button */ }

// helpers/navigation.ts
export async function navigateTo(page: Page, tabName: string) { /* click tab button, wait networkidle */ }
export const TABS = { GARDEN_PLANNER, GARDEN_DESIGNER, PLANTING_CALENDAR, ... } as const;
```

---

### 10.1a Implemented: Core E2E Tests (`e2e-core.spec.ts`) — 3 tests, serial

**Status: IMPLEMENTED AND PASSING** (commit `ea3ac71`, 2026-02-23)

**Runtime:** ~17s (CI mode, headless)

| Test | Strategy | What It Covers | Test IDs Exercised |
|------|----------|----------------|-------------------|
| **E2E-01: Login + Create Bed + Place Plant** | UI login + UI bed creation + API plant placement + API verification | AUTH-02, BED-01, full planted-item roundtrip | AUTH-01, AUTH-02, BED-01, BED-08 |
| **E2E-02: Conflict Detection** | API-only (loginViaAPI + POST planted-item at same cell) | Backend 409 conflict with `conflicts[]` array referencing existing plant | CONF-01 |
| **E2E-03: Plan + Export + Calendar** | API plan creation + API export + UI calendar verification | Plan → export → PlantingEvent appears in Planting Calendar list view | PLAN-01, PLAN-02, PLAN-10, CAL-01 |

**Key patterns used:**
- `ensureTestUser(request)` + `loginViaAPI(request)` for API auth (Playwright `request` fixture has separate cookie jar from `page`)
- `login(page)` for UI auth (clears cookies first for clean session)
- `Date.now()` suffix on resource names to avoid collisions across runs
- Bed visibility asserted via `.bg-green-50` "Active:" indicator (not hidden `<option>`)
- `conflictOverride: true` on export (E2E-03) since bed already has tomato from E2E-01

**Run commands:**
```bash
cd frontend
npx playwright test tests/e2e-core.spec.ts --headed   # Local (visible)
CI=true npx playwright test tests/e2e-core.spec.ts     # CI (headless, no slowMo)
```

---

### 10.1 Auth E2E Tests (`auth.spec.ts`) — PROPOSED

```
Suite: Authentication
  test: Register new user
    - Fill register form, submit
    - Verify redirect to main app
    - Verify username shown in header

  test: Login with valid credentials
    - Fill login form, submit
    - Verify authenticated state
    - Verify auth check returns user

  test: Login with invalid password
    - Fill login form with wrong password
    - Verify error message shown
    - Verify not redirected

  test: Logout
    - Login first, then click logout
    - Verify returned to login screen
    - Verify protected pages redirect to login

  test: Protected routes require auth
    - Without logging in, navigate to /garden-designer
    - Verify login prompt or redirect

  test: User data isolation
    - Register User A, create a garden bed "User A Bed"
    - Logout, register User B
    - Navigate to garden designer
    - Verify User A's bed is NOT visible
    - Create User B bed, verify it shows
    - Logout, login as User A
    - Verify only "User A Bed" visible
```

### 10.2 Garden Beds — CRUD & Planning Methods (`garden-beds.spec.ts`) — IMPLEMENTED AND PASSING

**Status**: All 12 tests passing. Implemented 2026-02-26.

**Test user**: Dedicated `gb_test_${RUN_ID}` (registered at suite start, beds cleaned up in `afterAll`) for full isolation from other test suites.

**Setup**: UI-driven bed creation with API verification for data integrity. Helper `createBedViaUI()` encapsulates modal interaction. API-only setup for fixtures (season extension, planted items).

| # | Test Name | Type | What It Verifies |
|---|-----------|------|-----------------|
| GB-01 | Create Square Foot bed | UI+API | 4x4 preset, `planningMethod='square-foot'`, `gridSize=12`, active indicator shows name |
| GB-02 | Create MIGardener bed | UI+API | 4x8 preset, `planningMethod='migardener'`, `gridSize=3` |
| GB-03 | Create Row bed | UI+API | 3x6 preset, `planningMethod='row'`, `gridSize=6` |
| GB-04 | Create Intensive bed | UI+API | 4x8 preset, `planningMethod='intensive'`, `gridSize=6` |
| GB-05 | Create Raised Bed | UI+API | 4x8 preset, `planningMethod='raised-bed'`, `gridSize=6` |
| GB-06 | Create Permaculture bed | UI+API | 4x4 preset, `planningMethod='permaculture'`, `gridSize=12`, `zone='zone1'` |
| GB-07 | Create custom-dimension bed | UI+API | `custom` preset radio, `width=6`, `length=14` |
| GB-08 | Edit bed name, dims, method | UI+API | Select bed → edit → change name, 4x8, intensive → API verify updated fields + `gridSize=6` |
| GB-09 | Season extension (cold frame) | UI+API | Create bed via API → edit in UI → `cold-frame`, 2 layers, material, notes → API verify `seasonExtension` JSON |
| GB-10 | All beds visible via API | API | `GET /api/garden-beds` → filter by RUN_ID → 8 beds with correct structure |
| GB-11 | Clear bed removes all plants | UI+API | Place tomato via API → Clear Bed button → confirm → API verify 0 `plantedItems` |
| GB-12 | Delete bed via API, verify UI | API+UI | API DELETE → reload UI → bed gone from selector (no delete-bed button in UI) |

**Planning method → gridSize mapping verified:**
| Method | gridSize | Tested In |
|--------|----------|-----------|
| `square-foot` | 12 | GB-01 |
| `migardener` | 3 | GB-02 |
| `row` | 6 | GB-03 |
| `intensive` | 6 | GB-04 |
| `raised-bed` | 6 | GB-05 |
| `permaculture` | 12 | GB-06 |

**Key patterns:**
- `test.describe.serial` — beds created in order, reused by later tests (GB-08 edits GB-01's bed)
- API-driven verification: every UI bed creation confirmed via `GET /api/garden-beds` matching on name
- `createBedViaUI()` helper handles modal open, form fill, preset/custom toggle, method, zone, submit
- 4 `data-testid` selectors: `bed-selector`, `active-bed-indicator`, `edit-bed-btn`, `clear-bed-btn`

**Run commands:**
```bash
cd frontend
npx playwright test tests/garden-beds.spec.ts             # Run this suite only
npx playwright test tests/garden-beds.spec.ts --headed     # Visible browser
npx playwright test tests/garden-beds.spec.ts --debug      # Step-through debug
```

### 10.3 Garden Planner - Full Lifecycle (`garden-planner.spec.ts`) — IMPLEMENTED AND PASSING

**Status**: All 13 tests passing (~32s). Implemented in commit `1f14641`.

**Test user**: Dedicated `gp_test_user` (registered at suite start, cleaned up after) for full isolation from other test suites.

**Setup**: API-driven — beds and plan items created via direct API calls in `beforeAll`/`beforeEach` to keep tests focused on the feature under test.

| # | Test Name | What It Verifies |
|---|-----------|-----------------|
| GP-01 | Create new garden plan | POST plan via UI, verify plan card appears with `data-testid="plan-card-{id}"` |
| GP-02 | View plan details | Click view button, verify plan detail view loads with item list |
| GP-03 | Add plan item — tomato, no succession | Add item via UI form, verify it appears in plan item list |
| GP-04 | Add plan item — lettuce, 4x succession | Enable succession, set count=4, interval=14d, verify succession fields saved |
| GP-05 | Add plan item — carrot, 8x succession | 8 successions, verify high succession count stored correctly |
| GP-06 | Multi-bed allocation — even mode | 90 plants across 3 beds, allocationMode=even, verify 30 per bed |
| GP-07 | Multi-bed allocation — custom mode | 100 plants, custom split (60/25/15), verify unequal distribution |
| GP-08 | Edit plan item quantity | Change quantity from 12→20, verify updated value persists |
| GP-09 | Delete plan item | Delete item, confirm dialog, verify removed from list |
| GP-10 | Export to calendar | Export plan with items, navigate to Planting Calendar, verify events created |
| GP-11 | Idempotent re-export | Export twice, verify no duplicate events (toast or event count unchanged) |
| GP-12 | Crop rotation conflict | API-seed 2025 tomato in bed, add 2026 pepper (Solanaceae) → verify rotation warning |
| GP-13 | Nutrition estimate | Add items to plan, verify `data-testid="plan-nutrition-card"` shows calorie/protein estimates |

**Key patterns:**
- `test.describe.serial` — tests run in order within the suite (plan created in GP-01 is reused)
- API-driven setup: `loginViaAPI()` + direct fetch to `/api/garden-beds`, `/api/garden-plans` for fixtures
- Cleanup: `afterAll` deletes test user's plans, beds, and the user account
- 8 `data-testid` selectors for reliable element targeting (see table in 10.0)

**Run commands:**
```bash
cd frontend
npx playwright test tests/garden-planner.spec.ts       # Run this suite only
npx playwright test tests/garden-planner.spec.ts -g "succession"  # Filter by name
npx playwright test tests/garden-planner.spec.ts --debug           # Step-through debug
```

### 10.4 Garden Designer - Plant Placement & Removal (`garden-designer.spec.ts`) — IMPLEMENTED AND PASSING

**File**: `frontend/tests/garden-designer.spec.ts` (~506 lines)
**User**: `gd_test_{RUN_ID}` — unique per run for isolation
**Strategy**: API-first setup (plant placement via `/api/planted-items`) + UI verification. @dnd-kit drag-drop is unreliable in Playwright, so placement uses the API and tests verify the UI renders correctly.
**Setup**: `beforeAll` creates 2 SFG beds (4x4 + 4x8); `afterAll` deletes them.
**Timing note**: Uses `pastDate(7)` helper for `plantedDate` to avoid a pre-existing timezone edge case in `getActivePlantedItems()` where date-only strings (UTC) vs datetime strings (local time) can filter out same-day plants in timezones behind UTC.

```
Suite: Plant Placement & Verification (4 tests)
  GD-01: Place single plant via API, verify on grid
    - POST /api/planted-items with tomato at (0,0)
    - Navigate to Garden Designer, verify planted-item-{id} visible in SVG
    - Verify bed detail shows plant via API

  GD-02: Place plant with variety, verify detail panel
    - POST /api/planted-items with pepper + variety "California Wonder" at (2,0)
    - Click planted item → verify detail panel shows variety and status

  GD-03: Batch place 3 carrots via API, verify count
    - POST /api/planted-items/batch with 3 carrots at (0,2),(1,2),(2,2)
    - Verify 201, bed detail shows 3 additional items, legend visible

  GD-04: Conflict detection at occupied cell
    - POST another plant at (0,0) — already occupied
    - Verify 409 response with conflicts array

Suite: Plant Removal (3 tests)
  GD-05: Remove single plant via API, verify gone
    - DELETE /api/planted-items/{id}, verify 204
    - Bed detail confirms fewer items

  GD-06: Remove plant via UI detail panel Delete button
    - Click planted item → click delete-plant-btn → confirm
    - Verify item removed from API

  GD-07: Clear entire bed via UI
    - Click clear-bed-btn → confirm
    - Verify 0 plantedItems in API response

Suite: Seed Saving Lifecycle (4 tests)
  GD-08: Toggle save-for-seed ON via API
    - Place fresh tomato, PATCH saveForSeed=true
    - Verify status='saving-seed', saveForSeed=true

  GD-09: Toggle save-for-seed ON via UI
    - Place fresh pepper, click item → click seed-saving-toggle
    - Verify API confirms saveForSeed=true

  GD-10: Toggle save-for-seed OFF via API
    - PATCH saveForSeed=false on GD-08 item
    - Verify saveForSeed=false, status restored, seedMaturityDate=null

  GD-11: Collect seeds via API
    - Place fresh item, toggle seed saving ON, POST collect-seeds
    - Verify 201, seedsCollected=true, status='harvested', seedInventory returned

Suite: Cross-Bed Isolation & Visual Feedback (3 tests)
  GD-12: Plants on one bed don't affect another
    - Clear bed1, verify bed2 plants still intact via API

  GD-13: Future plantings toggle
    - Click future-plantings-toggle, verify button text changes

  GD-14: Season progress endpoint with placed plants
    - Create plan with bed assignment, place plant with sourcePlanItemId
    - GET /api/garden-planner/season-progress → verify placedSeason >= 1
```

**Results**: 14/14 passing (~50s). 9 `data-testid` selectors added across `GardenDesigner.tsx` (7), `SetSeedDateModal.tsx` (2), `CollectSeedsModal.tsx` (1).

### 10.5 Planting Calendar (`planting-calendar.spec.ts`) — IMPLEMENTED AND PASSING

**File**: `frontend/tests/planting-calendar.spec.ts` (~365 lines)
**User**: `pc_test_{RUN_ID}` — unique per run for isolation
**Strategy**: API-first event creation + UI verification in list/grid/timeline views. All 3 event types tested (planting, mulch, maple-tapping).
**Setup**: `beforeAll` creates 1 SFG bed (4x4); `afterAll` deletes it.

```
Suite: Event Creation via API (5 tests)
  PC-01: Create planting event (transplant) via API
    - POST with seedStartDate + transplantDate + expectedHarvestDate + variety
    - Verify all fields returned correctly, completed=false

  PC-02: Create planting event (direct seed) via API
    - POST with directSeedDate only (no transplant/seedStart)
    - Verify transplantDate and seedStartDate are null

  PC-03: Create succession planting (3 carrot events) via API
    - POST 3 events sharing successionGroupId, 21-day interval
    - Verify all 3 have successionPlanting=true and same groupId

  PC-04: Create mulch event via API
    - POST with eventType='mulch', mulchType='straw', depthInches=3
    - Verify eventType='mulch', eventDetails contains mulch_type

  PC-05: Create maple tapping event via API
    - POST with eventType='maple-tapping', treeType='sugar', tapCount=2
    - Verify eventDetails contains tree_type and tap_count

Suite: List Events & View Verification (3 tests)
  PC-06: GET /api/planting-events returns all created events
    - Verify >= 5 planting events, tomato event found by ID with correct variety

  PC-07: List view shows planting events in UI
    - Navigate to calendar, verify planting-event-item elements visible
    - Count >= 3 items (mulch/maple may not appear in list view)

  PC-08: View toggle switches between List, Calendar, and Timeline
    - Click each toggle, verify active class (bg-green-600)
    - Calendar view: month name visible; Timeline view: toggles; List view: event items

Suite: Event Updates & Deletion (4 tests)
  PC-09: Update event via API (change harvest date)
    - PUT new expectedHarvestDate + notes on tomato event
    - Verify updated fields in response

  PC-10: Mark event as harvested via API
    - PATCH /harvest on pepper event
    - Verify actualHarvestDate is set

  PC-11: Delete planting event via API
    - DELETE carrot event, verify 204
    - GET all events, verify deleted event not in list

  PC-12: Delete mulch event via API
    - DELETE mulch event, verify 204
    - GET all events, verify deleted event not in list

Suite: Soil Temperature & UI Features (2 tests)
  PC-13: Soil temperature card renders and toggles
    - Verify soil-temp-toggle visible with "Soil Temperature" text
    - Click to collapse, click to expand — card still visible

  PC-14: Garden Event and Maple Tapping buttons are visible
    - Verify btn-add-garden-event and btn-add-maple-tapping visible
    - Click Garden Event button, verify modal opens with "Add Garden Event" title
```

**Results**: 14/14 passing (~25s). 7 `data-testid` selectors added across `PlantingCalendar/index.tsx` (5), `SoilTemperatureCard/index.tsx` (1), `ListView/index.tsx` (1).

### 10.6 Weather Module (`weather.spec.ts`) — IMPLEMENTED

**Status**: All 12 tests passing (~33s). Implemented 2026-02-28.

**data-testid selectors added (9)**: `weather-settings-btn`, `weather-settings-panel`, `weather-zipcode-input`, `weather-zipcode-save`, `weather-forecast-grid`, `weather-forecast-day-{index}`, `weather-temp-card`, `weather-wind-card`, `weather-gdd-chart` (WeatherAlerts.tsx).

```
Suite 1: Weather API Endpoint Validation (5 tests)
  WX-01: GET current weather with valid zipcode (structure + range checks)
  WX-02: GET current weather missing params returns 400
  WX-03: GET forecast with valid zipcode returns 7 days (all fields validated)
  WX-04: GET forecast days parameter clamped (min=1, max=10, over-max=10)
  WX-05: GET current weather with lat/lon coordinates

Suite 2: Weather UI — Page Rendering & Sections (3 tests)
  WX-06: Weather page renders all main sections (header, forecast, conditions, GDD, tips)
  WX-07: Forecast grid shows 7 day cards with Today highlighted (blue border)
  WX-08: Current conditions cards show temperature and wind (°F, mph)

Suite 3: Settings Panel & ZIP Code (2 tests)
  WX-09: Settings panel opens and closes (toggle, input, save button visibility)
  WX-10: Save ZIP code updates forecast display (re-fetch, 7 cards remain)

Suite 4: GDD Chart & Forecast Data Integrity (2 tests)
  WX-11: GDD chart renders with forecast data (title, description, content)
  WX-12: Forecast data has valid GDD values via API (formula: max(0, (high+low)/2 - 50))
```

**Note**: No auth required for weather API endpoints. Live Open-Meteo API with mock fallback — assertions use range checks for temperatures, not exact values. Weather-dependent alerts (frost/heat) not tested directly since they depend on real-time conditions.

### 10.7 Nutrition Module (`nutrition.spec.ts`)

```
Suite: Nutritional Dashboard
  test: Dashboard loads with year selector
  test: Garden nutrition from plan items
  test: Livestock nutrition from production
  test: Year filtering
  test: Missing nutrition data notification
  test: Plan nutrition card (in Garden Planner)
  test: Person-days of self-sufficiency
  test: Export nutrition to CSV (if feature exists)
```

### 10.8 Seed Inventory & Catalog (`seed-inventory.spec.ts`) — IMPLEMENTED

**File**: `frontend/tests/seed-inventory.spec.ts` (12 serial tests, ~21s)
**Commit**: `bf1823a`

```
Suite 1: Seed CRUD via API (4 tests)
  SI-01: Create custom seed via API                          ✅ PASSING
  SI-02: Create second seed with different category via API  ✅ PASSING
  SI-03: Create seed with agronomic override of 0 (NULL vs 0) ✅ PASSING
  SI-04: GET /api/my-seeds returns all created seeds         ✅ PASSING

Suite 2: Update & Delete via API (3 tests)
  SI-05: Update seed via API (quantity + notes)              ✅ PASSING
  SI-06: Update seed with agronomic overrides via API        ✅ PASSING
  SI-07: Delete seed via API                                 ✅ PASSING

Suite 3: UI Verification (3 tests)
  SI-08: My Seeds page shows seed cards                      ✅ PASSING
  SI-09: Search filters seed cards                           ✅ PASSING
  SI-10: Add New Seed button opens modal                     ✅ PASSING

Suite 4: Seed Catalog (2 tests)
  SI-11: GET /api/seed-catalog returns paginated catalog     ✅ PASSING
  SI-12: Clone catalog seed to personal inventory            ⏭ CONDITIONAL SKIP (no catalog seeds in test DB)
```

**Strategy**: API-first for data setup + UI verification in My Seeds tab. Dedicated `si_test_user` for isolation. Agronomic override NULL vs 0 test validates that `daysToMaturity=0` is preserved (not treated as null) and unset fields are omitted from response (to_dict omits null fields → undefined in JSON).

**data-testid selectors added (7)**: `btn-add-seed`, `seed-count`, `seed-card-{id}`, `btn-edit-seed-{id}`, `btn-delete-seed-{id}` (MySeedInventory.tsx), `add-seed-submit` (AddSeedModal.tsx), `edit-seed-submit` (EditSeedModal.tsx).

**Run commands:**
```bash
npx playwright test tests/seed-inventory.spec.ts          # Just seed inventory
npx playwright test tests/seed-inventory.spec.ts --headed  # Watch mode
```

### 10.9 Harvest Tracker (`harvest-tracker.spec.ts`) — IMPLEMENTED

**Commit**: `de222cf` | **Tests**: 10 serial | **Status**: All 10 passing

```
Suite 1: Harvest CRUD via API (4 tests)
  HT-01: Create harvest via API (tomato, 5.5 lbs, excellent quality)
  HT-02: Create harvest with different quality and unit (pepper, 12 count, good)
  HT-03: Create third harvest for stats testing (carrot, 3 lbs, fair)
  HT-04: GET /api/harvests returns all created harvests

Suite 2: Update, Delete & Stats (3 tests)
  HT-05: Update harvest via API (quantity 5.5→8.0, quality excellent→good)
  HT-06: GET /api/harvests/stats returns aggregated stats (total/count per plant)
  HT-07: Delete harvest via API (204 + verify gone)

Suite 3: UI Verification (3 tests)
  HT-08: Harvests page shows harvest rows (count stat = 2, both rows visible)
  HT-09: Search filters harvest rows (Tomato → 1 visible, clear → both)
  HT-10: Log New Harvest button opens modal (Plant select visible, Escape closes)
```

**Strategy**: API-first CRUD + UI verification. Dedicated `ht_test_user` for isolation. afterAll cleanup deletes all harvests. Quality ratings tested: excellent, good, fair. Stats endpoint validates total/count aggregation per plantId.

### 10.10 Livestock (`livestock.spec.ts`) — IMPLEMENTED

**Commit**: `2109be7` | **Tests**: 14 serial | **Status**: All 14 passing (~26s)

```
Suite 1: Chickens CRUD + Egg Production (4 tests)
  LS-01: Create chicken via API (Rhode Island Red, qty 6, eggs purpose)
  LS-02: Create second chicken, verify GET returns both
  LS-03: Update chicken via API (quantity 6→8, notes updated)
  LS-04: Add egg production record via API (5 collected, 1 sold, 3 eaten)

Suite 2: Ducks & Beehives (4 tests)
  LS-05: Create duck via API (Pekin, qty 4, eggs purpose)
  LS-06: Create beehive via API (Langstroth, queen marked yellow, South Field)
  LS-07: Log hive inspection via API (queen seen, excellent brood, calm, strong)
  LS-08: Log honey harvest via API (4 frames, 12.5 lbs honey, 1.2 lbs wax)

Suite 3: General Livestock & Health Records (3 tests)
  LS-09: Create goat (general livestock) via API (Nigerian Dwarf, dairy, 75 lbs)
  LS-10: Add health record via API (CDT vaccination, Dr. Smith, $45)
  LS-11: Delete livestock via API (204 + verify gone from GET)

Suite 4: UI Verification (3 tests)
  LS-12: Chickens tab shows animal cards (default tab, card with name visible)
  LS-13: Tab switching shows correct category (ducks→beehives→other, card per tab)
  LS-14: Add New button opens modal with category-specific form (chicken vs beehive fields)
```

**Strategy**: API-first CRUD + UI verification. Dedicated `ls_test_user` for isolation. afterAll cleanup deletes all animals across 4 endpoints. All 4 animal categories tested: chickens (CRUD + egg production), ducks (create), beehives (CRUD + inspection + honey harvest), general livestock (goat + health record). UI tests verify tab switching renders correct cards and modal adapts to category.

### 10.11 Compost Tracker (`compost.spec.ts`) — IMPLEMENTED

**Status**: All 11 tests passing (~23s). Implemented 2026-02-28.

**data-testid selectors added (6)**: `btn-add-pile`, `btn-create-pile`, `compost-pile-{id}`, `pile-status-{id}`, `btn-delete-pile-{id}`, `pile-cn-ratio-{id}` (CompostTracker.tsx).

```
Suite 1: Pile CRUD via API (3 tests)
  CP-01: Create compost pile via API (name, location, size, defaults)
  CP-02: Create second pile, GET returns both
  CP-03: Update pile status, moisture, and mark turned via API

Suite 2: Ingredients & C:N Ratio Recalculation (3 tests)
  CP-04: Add brown ingredient (dried-leaves), C:N ratio increases to 60
  CP-05: Add green ingredient (grass-clippings), C:N ratio decreases (range assertion)
  CP-06: Add more green (food-scraps), C:N moves toward ideal range (range assertion)

Suite 3: Status Lifecycle & Delete (2 tests)
  CP-07: Status lifecycle (building → cooking → curing → ready)
  CP-08: Delete pile via API, verify gone with ingredients (cascade)

Suite 4: UI Verification (3 tests)
  CP-09: Compost page shows pile card with C:N ratio display
  CP-10: Status dropdown changes pile status (UI → API roundtrip)
  CP-11: Add Compost Pile button toggles form (show/hide)
```

**Note**: C:N ratio tests use directional/range assertions (lessThan/greaterThan) rather than exact values because the backend formula is not a simple weighted average.

### 10.12 Property Designer (`property-designer.spec.ts`) — IMPLEMENTED

**Status**: All 13 tests passing (~16s). Implemented 2026-02-28.

**data-testid selectors added (4)**: `btn-create-property`, `property-selector`, `btn-add-structure`, `btn-manage-trellises` (PropertyDesigner.tsx).

```
Suite 1: Property CRUD via API (3 tests)
  PD-01: Create property via API (name, width, length, soilType, slope)
  PD-02: Create second property, GET returns both
  PD-03: Update property via API (name, width; unchanged fields preserved)

Suite 2: Placed Structures CRUD + Collision Detection (4 tests)
  PD-04: Place structure on property via API (chicken-coop-small-1)
  PD-05: Place second structure at different position (tool-shed-small-1, rotation=90)
  PD-06: Update structure position via API (nested { position: { x, y } } format)
  PD-07: Delete structure via API, verify gone from property

Suite 3: Trellis CRUD + Capacity (4 tests)
  PD-08: Create trellis structure via API (post_wire, Pythagorean length calc)
  PD-09: Get trellis capacity (empty — 0 allocated, 100% available)
  PD-10: Update trellis coordinates, length recalculates (10ft → 20ft)
  PD-11: Delete trellis via API (no plants allocated)

Suite 4: Property Delete (Cascade) + UI Verification (2 tests)
  PD-12: Delete property cascades structures (rain-barrel-1 placed first)
  PD-13: Property Designer shows property selector and buttons (selector, Add Structure, Manage Trellises)
```

**Note**: API-first strategy since SVG drag-drop is unreliable in Playwright. Structure IDs use `-1` suffix convention (e.g., `chicken-coop-small-1`). Position updates use nested `{ position: { x, y } }` format.

### 10.13 Indoor Seed Starts (`indoor-seed-starts.spec.ts`)

```
Suite: Indoor Seed Starting
  test: Create seed start
  test: Track germination (rate calculation)
  test: Status lifecycle (seeded -> germinating -> growing -> ready -> transplanted)
  test: Import from garden plan
  test: Transplant to outdoor event
```

### 10.14 Admin User Management (`admin.spec.ts`) — IMPLEMENTED

**Status**: All 13 tests passing (~14s). Implemented 2026-02-28.

**data-testid selectors added (3)**: `btn-add-user`, `user-row-{id}`, `btn-delete-user-{id}` (AdminUserManagement/index.tsx).

```
Suite 1: Access Control (2 tests)
  ADM-01: Non-admin cannot access admin endpoints (403)
  ADM-02: Unauthenticated request returns 401

Suite 2: Admin CRUD Operations (6 tests)
  ADM-03: Admin can list users with statistics
  ADM-04: Admin can search and filter users (search, admins, regular)
  ADM-05: Admin can create user via API
  ADM-06: Duplicate username rejected (400)
  ADM-07: Admin can update user email and admin status
  ADM-08: Admin can reset user password (verified via login)

Suite 3: Self-Protection & Last-Admin Constraints (3 tests)
  ADM-09: Admin cannot delete own account (403)
  ADM-10: Admin cannot reset own password via admin endpoint (403)
  ADM-11: Password validation rejects short passwords (400)

Suite 4: Delete with Verification (2 tests)
  ADM-12: Admin can delete user via API, verify gone
  ADM-13: Delete non-existent user returns 404
```

**Note**: Uses bootstrap admin (seeded on startup) to promote test admin user. API-first strategy since Admin tab is not in main navigation bar.

### 10.15 Space Calculation Verification (`space-calculations.spec.ts`)

```
Suite: Space Calculation Frontend-Backend Parity
  // Uses page.evaluate() for frontend calc + request.post() for backend

  test: SFG - tomato (1 per cell) -> Both return 1.0
  test: SFG - lettuce (4 per cell) -> Both return 0.25
  test: SFG - carrot (16 per cell) -> Both return 0.0625
  test: SFG - watermelon (2 cells per plant) -> Both return 2.0
  test: MIGardener - tomato (24, 18) -> Both agree
  test: MIGardener - potato (20,9) -> Both agree (FIXED)
  test: MIGardener - pepper (21,18) -> Both agree (FIXED)
  test: Row - standard calculation
  test: Intensive - hexagonal packing
  test: Trellis linear - feet per plant
```

### 10.16 Cross-Feature Integration Tests

```
Suite: End-to-End User Journey
  test: Complete garden planning journey
    Register -> Login -> Create bed -> Add seeds -> Create plan ->
    Add items -> Verify nutrition -> Export -> Place plants ->
    Verify progress -> Log harvest -> Check weather -> Screenshot

  test: Multi-bed succession workflow
    3 beds -> Plan with lettuce across all 3 -> 4 successions ->
    Export -> Verify 12 total events -> Place some -> Verify per-bed progress

  test: Seed saving full lifecycle
    Create bed -> Place tomato -> Toggle save-for-seed ->
    Verify maturity date -> Collect seeds -> Verify inventory
```

### 10.17 Running the Tests

```bash
# Prerequisites: both servers running
cd backend && python app.py &
cd frontend && npm start &

# Run all E2E tests
npx playwright test

# Run specific suite
npx playwright test tests/e2e/auth.spec.ts
npx playwright test tests/e2e/garden-planner.spec.ts

# Run with headed browser (visible)
npx playwright test --headed

# Run with debug mode (step through)
npx playwright test --debug

# Generate HTML report
npx playwright test --reporter=html
npx playwright show-report

# Run only tests matching pattern
npx playwright test -g "succession"
npx playwright test -g "MIGardener"
```

**Config note:** `playwright.config.js` is CI-aware: `headless: !!process.env.CI` (headed locally for debugging, headless in CI), `slowMo: process.env.CI ? 0 : 250` (watchable locally, fast in CI). No manual config changes needed.

---

### Coverage Summary

**Implemented Playwright E2E tests:**

| Suite | File | Tests | Status |
|-------|------|-------|--------|
| Smoke | `tests/smoke.spec.ts` | 11 | **PASSING** |
| Auth Isolation | `tests/auth-isolation.spec.ts` | varies | **PASSING** |
| Core E2E | `tests/e2e-core.spec.ts` | 3 | **PASSING** (~17s CI) |
| Garden Beds | `tests/garden-beds.spec.ts` | 12 | **PASSING** |
| Garden Planner | `tests/garden-planner.spec.ts` | 13 | **PASSING** (~32s) |
| Garden Designer | `tests/garden-designer.spec.ts` | 14 | **PASSING** (~50s) |
| Planting Calendar | `tests/planting-calendar.spec.ts` | 14 | **PASSING** (~25s) |
| Seed Inventory | `tests/seed-inventory.spec.ts` | 12 | **PASSING** (~21s) |
| Harvest Tracker | `tests/harvest-tracker.spec.ts` | 10 | **PASSING** |
| Livestock | `tests/livestock.spec.ts` | 14 | **PASSING** (~26s) |
| Compost Tracker | `tests/compost.spec.ts` | 11 | **PASSING** (~23s) |
| Admin User Mgmt | `tests/admin.spec.ts` | 13 | **PASSING** (~14s) |
| Property Designer | `tests/property-designer.spec.ts` | 13 | **PASSING** (~16s) |
| Weather Module | `tests/weather.spec.ts` | 12 | **PASSING** (~33s) |
| **Total implemented** | | **152+** | |

**Full coverage map (manual + implemented + proposed):**

| Feature Area | Section 3 (Manual) | Implemented E2E | Proposed E2E (Sec 10.1+) | Total |
|---|---|---|---|---|
| Authentication | 8 | 2 (smoke) | 6 | 16 |
| Garden Beds (all methods) | 10 | 14 (smoke+core+garden-beds) | 0 | 24 |
| Garden Planner (succession, multi-bed) | 15 | 14 (core + garden-planner) | 0 | 29 |
| Garden Designer (placement, removal, seed saving) | - | 15 (core E2E-01 + garden-designer) | 0 | 15 |
| Planting Calendar (event CRUD, views, soil temp) | - | 15 (core E2E-03 + planting-calendar) | 0 | 15 |
| Space Calculations | 12 | - | 10 | 22 |
| Conflict Detection | 8 | 1 (core E2E-02) | - | 9 + 70 backend pytest† |
| Calendar Export | 10 | 1 (core E2E-03) | - | 11 |
| Seed Saving | 6 | 4 (GD-08 through GD-11) | 0 | 10 |
| Crop Rotation | 5 | 1 (GP-12) | - | 6 |
| Seed Inventory & Catalog | - | 12 (seed-inventory) | 0 | 12 |
| Harvest Tracker | 3 | 10 (harvest-tracker) | 0 | 13 |
| Livestock (all types) | 5 | 14 (livestock) | 0 | 19 |
| Compost | 4 | 11 (compost) | 0 | 15 |
| Weather | 3 | 12 (weather) | 0 | 15 |
| Nutrition | - | - | 8 | 8 |
| Property Designer | - | 13 (property-designer) | 0 | 13 |
| Indoor Seed Starts | - | - | 5 | 5 |
| Admin | - | 13 (admin) | 0 | 13 |
| Photos | 3 | - | - | 3 |
| Plant DB Sync | 4 | - | - | 4 |
| Integration Journeys | - | - | 3 | 3 |
| Edge Cases (Sec 4) | 30+ | - | - | 30+ |
| **TOTAL** | **~125** | **~152+** | **~26** | **~303+** |

†Conflict detection has 70 automated backend pytest tests (`test_conflict_detection.py`) in addition to the manual + E2E test cases. These are unit/integration tests, not Playwright E2E.

---

*Report generated 2026-02-22. Updated 2026-02-23 with BUG-01/BUG-04/BUG-07 fixes, backlog #7 (trellis overlap validation), backlog #8 (automated space calc test suite — 94 backend + 33 frontend tests), backlog #9 (succession export integration tests — 36 tests covering all 3 export paths + DTM=0 falsy bug fix), and backlog #10 (auth + user isolation tests — 51 tests covering auth flow, 401 enforcement on 17 protected endpoints, user data isolation across 11 resource types, ownership protection on 8 CRUD operations, and admin access control). Updated 2026-02-24: BUG-08 (health-records user isolation) and BUG-09 (export-garden-plan auth gate) fixed — 2 former xfail tests now pass normally (51 passed, 0 xfail). Updated 2026-02-25: backlog #14 (intensive spacing formula harmonization — backend `onCenter²/144` now matches frontend; 20 new backend + 22 new frontend tests; totals: 114 backend + 55 frontend space calc tests). Updated 2026-02-23: backlog #13 (4 DB CHECK constraints on trellis position fields — migration `8b2eca933349`, 10 tests in `test_trellis_check_constraints.py`). Updated 2026-02-26: backlog #12 (event_details JSON validation — `event_details_validator.py` validates mulch + maple-tapping write paths; ~40 unit tests in `test_event_details_validator.py`; 2 call sites in `gardens_bp.py`). Updated 2026-02-23: backlog #16 (conflict detection automated test suite — 70 tests in `test_conflict_detection.py` covering spatial/temporal overlap, sun exposure, date helpers, has_conflict composite, PlantedItem conversion, validate_planting_conflict pipeline, and query_candidate_items; maps to CONF-01 through CONF-07). Updated 2026-02-23: Playwright E2E — 3 core E2E tests implemented in `e2e-core.spec.ts` (login+bed+plant, conflict 409, plan+export+calendar); `playwright.config.js` made CI-aware (headless + no slowMo when `CI=true`); 4 `data-testid` selectors added (Toast, Add Bed, Create Bed submit, planting event item); smoke.spec.ts (11 tests) and auth-isolation.spec.ts documented in section 10.0; Settings startup bug fixed (user_id NOT NULL). All bugs verified against branch `baseline-buildable-frontend`. Endpoint catalog verified against actual blueprint source files (122 routes across 15 blueprints). Updated 2026-02-26: Garden Planner E2E — 13 lifecycle tests implemented in `garden-planner.spec.ts` (plan CRUD, 4x/8x succession, even/custom multi-bed allocation, export-to-calendar, idempotent re-export, crop rotation conflict, nutrition estimate); 8 data-testid selectors added; dedicated `gp_test_user` for isolation; all 13 passing (~32s). Updated 2026-02-26: Garden Beds E2E — 12 serial tests implemented in `garden-beds.spec.ts` covering all 6 planning methods (SFG/MIG/row/intensive/raised-bed/permaculture), custom dimensions, edit flow (name+dims+method), season extension (cold frame with layers/material/notes), clear bed, API listing, and API-only deletion; 4 data-testid selectors added (bed-selector, active-bed-indicator, edit-bed-btn, clear-bed-btn); dedicated `gb_test_user` for isolation; all 12 passing. Updated 2026-02-26: Garden Designer E2E — 14 serial tests implemented in `garden-designer.spec.ts` covering plant placement & API verification (GD-01 through GD-03), conflict detection 409 (GD-04), plant removal via API/UI/clear-bed (GD-05 through GD-07), seed saving lifecycle: toggle ON/OFF + collect seeds (GD-08 through GD-11), cross-bed isolation (GD-12), future plantings toggle (GD-13), season progress linkage (GD-14); 9 data-testid selectors added across GardenDesigner.tsx (7), SetSeedDateModal.tsx (2), CollectSeedsModal.tsx (1); dedicated `gd_test_user` for isolation; API-first strategy (placement via `/api/planted-items` not drag-drop); `pastDate(7)` workaround for timezone date filter edge case; all 14 passing (~50s). Updated 2026-02-26: Planting Calendar E2E — 14 serial tests implemented in `planting-calendar.spec.ts` covering event creation via API for all 3 event types (planting transplant/direct-seed, succession 3x carrot, mulch, maple-tapping); GET all events verification; list view UI with planting-event-item visibility; view toggle (list/grid/timeline) with active-class assertions; event update (harvest date), mark-as-harvested (PATCH), delete planting + mulch events; soil temperature card toggle; Garden Event + Maple Tapping button visibility + modal open; 7 data-testid selectors added across PlantingCalendar/index.tsx (5), SoilTemperatureCard/index.tsx (1), ListView/index.tsx (1); dedicated `pc_test_user` for isolation; all 14 passing (~25s). Updated 2026-02-26: Seed Inventory E2E — 12 serial tests implemented in `seed-inventory.spec.ts` covering seed CRUD via API (custom create, update quantity/notes, update agronomic overrides, delete), agronomic override NULL vs 0 validation (daysToMaturity=0 preserved, unset fields omitted from to_dict), UI verification (seed cards with count stat, search filtering, Add New Seed modal), seed catalog pagination, and catalog-to-personal clone (conditional skip if no catalog seeds in test DB); 7 data-testid selectors added across MySeedInventory.tsx (5), AddSeedModal.tsx (1), EditSeedModal.tsx (1); dedicated `si_test_user` for isolation; 11 passing + 1 conditional skip (~21s). Updated 2026-02-27: Harvest Tracker E2E — 10 serial tests implemented in `harvest-tracker.spec.ts` covering harvest CRUD via API (create 3 harvests with quality ratings excellent/good/fair, update quantity+quality, delete), GET all harvests verification, stats aggregation endpoint validation (total/count per plantId), UI verification (harvest rows with count stat, search filtering by plant name, Log New Harvest modal open); 7 data-testid selectors added across HarvestTracker.tsx (5), LogHarvestModal.tsx (1), EditHarvestModal.tsx (1); dedicated `ht_test_user` for isolation; all 10 passing. Updated 2026-02-28: Livestock E2E — 14 serial tests implemented in `livestock.spec.ts` covering chickens CRUD + egg production (create 2 chickens, update quantity, add egg record), duck creation (Pekin), beehive CRUD + hive inspection + honey harvest (Langstroth, queen marked, inspection with brood/temperament/population, honey with frames/weight/wax), general livestock goat (Nigerian Dwarf) + health record (CDT vaccination), delete verification, UI tab switching (4 categories with card visibility per tab), and category-specific Add New modal (chicken breed vs beehive hive type fields); 9 data-testid selectors added across Livestock.tsx (8) and AnimalFormModal.tsx (1); dedicated `ls_test_user` for isolation; all 14 passing (~26s). Updated 2026-02-28: Compost Tracker E2E — 11 serial tests implemented in `compost.spec.ts` covering pile CRUD via API (create, create second + GET both, update status/moisture/turned), ingredients & C:N ratio recalculation with directional assertions (add brown dried-leaves C:N=60, add green grass-clippings ratio decreases, add more green food-scraps ratio moves toward ideal), status lifecycle (building→cooking→curing→ready), delete with cascade (ingredients removed), UI verification (pile card with C:N ratio display, status dropdown changes pile status via UI→API roundtrip, Add Compost Pile form toggle show/hide); 6 data-testid selectors added to CompostTracker.tsx (btn-add-pile, btn-create-pile, compost-pile-{id}, pile-status-{id}, btn-delete-pile-{id}, pile-cn-ratio-{id}); dedicated `cp_test_user` for isolation; all 11 passing (~23s). Updated 2026-02-28: Admin User Management E2E — 13 serial tests implemented in `admin.spec.ts` covering access control (non-admin 403 on GET+POST, unauthenticated 401), admin CRUD (list users with statistics, search by username, filter by admins/regular, create user with validation, duplicate username 400, update email + admin status, reset password with login verification), self-protection constraints (cannot delete own account 403, cannot reset own password 403, short password 400), delete with cascade verification (user gone from list, 404 on non-existent); 3 data-testid selectors added to AdminUserManagement/index.tsx (btn-add-user, user-row-{id}, btn-delete-user-{id}); uses bootstrap admin to promote dedicated `adm_test_user`; API-first strategy (Admin tab not in main nav bar); all 13 passing (~14s).*
