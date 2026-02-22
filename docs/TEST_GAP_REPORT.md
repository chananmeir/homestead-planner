# Homestead Planner: Comprehensive Test & Gap Report

**Date**: 2026-02-22 (updated 2026-02-22)
**Branch**: baseline-buildable-frontend
**Scope**: Discovery + documentation. Bug fixes applied for BUG-01, BUG-02, BUG-04, BUG-05, BUG-07.
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
| 4 | **Property Designer** | `/property-designer` tab | `PropertyDesigner.tsx`, `PropertyFormModal`, `StructureFormModal`, `TrellisManager` | `properties_bp`: `/api/properties/*`, `/api/placed-structures/*`; `trellis_bp`: `/api/trellis-structures/*` | `Property`, `PlacedStructure`, `TrellisStructure` | SVG canvas drag-drop, trellis capacity has no DB overlap constraints |
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
| GET | `/api/trellis-structures/:id/capacity` | `trellis_capacity` | No overlap validation |

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
| GET | `/api/plants` | (data endpoint) | Read-only reference data, **mixed casing** |
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
| CAL-07 | Trellis export | Plan item with trellis assignment | 1. Export | Event created with trellis_structure_id, position_start/end_inches | P1 |
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
| SYNC-01 | Plant count match | 1. Count backend PLANT_DATABASE entries 2. Count frontend PLANT_DATABASE entries | Backend: 113, Frontend: 118 (**5 extra in frontend**) | P1 |
| SYNC-02 | SFG table count match | 1. Count backend SFG_SPACING entries 2. Count frontend SFG_PLANTS_PER_CELL entries | Backend: 49 base plants, Frontend: 105 (base + variants) | P1 |
| SYNC-03 | MIGardener count match | 1. Count backend MIGARDENER_SPACING_OVERRIDES 2. Count frontend | Backend: 54, Frontend: 31 (**23 missing from frontend**) | P0 |
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
| EC-TREL-01 | Overlapping segments | Event A: 0-12", Event B: 6-18" | **No DB constraint** - must validate in app | P1 |
| EC-TREL-02 | Position > trellis length | Trellis=10ft, position_end=15ft | No constraint prevents | P1 |
| EC-TREL-03 | Start > end | position_start=12, position_end=6 | Invalid range, no constraint | P1 |
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
| 7 | `backend/intensive_spacing.py` | Backend intensive overrides |
| 8 | `frontend/src/utils/intensiveSpacing.ts` | Frontend intensive overrides |

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

**Risk:** event_details is TEXT, no JSON schema validation. Each type expects different keys.

**Verify:** Query events of each type, ensure event_details parsing uses try/except and get() with defaults. Check that non-planting events (plant_id=null) don't break queries that assume plant_id exists.

### 5.4 HIGH: Dual Status System

**PlantingEvent fields:** `status` (string), `completed` (bool), `quantity_completed` (int/null)

**Known contradictions possible:**
- `status='harvested'` + `completed=False`
- `completed=True` + `quantity_completed < quantity`

**Verify:** No logic assumes consistency between these fields. Prefer `quantity_completed` for completion tracking.

### 5.5 MEDIUM: Trellis Capacity

**No DB constraints for:** overlapping segments, out-of-range positions, start > end

**Verify:** Application-level validation exists in trellis assignment logic.

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

**Status:** VERIFIED

| Location | Count |
|----------|-------|
| Backend PLANT_DATABASE | **113** entries |
| Frontend PLANT_DATABASE | **118** entries |
| Backend SFG_SPACING (garden_methods.py) | **49** base plant names |
| Frontend SFG_PLANTS_PER_CELL | **105** entries (49 base + variants) |

**Frontend has 5 extra plants** not present in backend. Some naming inconsistencies: backend `'collards'` vs frontend `'collard'`/`'collards'`; frontend has generic `'bean'`/`'bean-1'` entries not in backend.

**Impact:** Plants that exist only in frontend will fail to resolve on backend. Space calculations may use default fallbacks.

**Fix:** Identify the 5 extra frontend entries. Either add to backend or remove from frontend.

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

### Suspicious Patterns (Not Confirmed Bugs)

| ID | Location | Concern | Severity |
|----|----------|---------|----------|
| SUS-01 | `gardens_bp.py` clear-bed endpoint | ~~Deletes PlantingEvents with `str(bed_id)`~~ - FIXED with BUG-05 | Resolved |
| SUS-02 | `IndoorSeedStart.get_current_garden_plan_count()` | Potential N+1 query when checking all plans | Low |
| SUS-03 | Frontend `migardenerSpacing.ts:154` | Comment `\ Traditional row-based crops` has backslash instead of `//` | Low (syntax) |
| SUS-04 | `/api/plants` returns raw dicts with mixed casing | `daysToMaturity` (camelCase) but `days_to_seed` (snake_case) | Medium |
| SUS-05 | Livestock sub-resource endpoints are top-level | `/api/egg-production` instead of `/api/chickens/:id/egg-production` | Low (design) |

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
| 5 | **BUG-06**: Verify plant DB count alignment (5 extras) | 1 hr | 2 files | Low - investigation + sync |
| 6 | ~~**BUG-05**: Remove str(bed_id) wrappers (5 locations)~~ FIXED | — | — | — |
| 7 | Add trellis overlap validation | 2 hr | 1-2 files | Medium - new validation logic |

### P2 - Needs Planning Mode (Multi-file, Architectural)

| # | Issue | Effort | Files | Risk |
|---|-------|--------|-------|------|
| 8 | Automated test suite: space calc sync | 4 hr | 2+ new test files | Low - additive |
| 9 | Automated test suite: succession export | 3 hr | 1+ new test file | Low - additive |
| 10 | Automated test suite: auth + user isolation | 3 hr | 1+ new test file | Low - additive |
| 11 | Clean up dual status system | 8+ hr | 5+ files | HIGH - behavioral change |
| 12 | Add JSON schema for event_details | 4 hr | 2-3 files | Medium - validation layer |
| 13 | Add DB CHECK constraints for trellis positions | 2 hr | migration + model | Low - additive |
| 14 | Intensive spacing frontend/backend sync audit | 2 hr | 2 files | Low - data alignment |
| 15 | Fix mixed casing in /api/plants response | 4 hr | 1 backend + all frontend consumers | HIGH - breaking change |

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

**Automated verification that should exist but doesn't:**

| What | Why It Matters |
|------|----------------|
| Backend pytest for space_calculator.py | No way to detect backend-only calculation regressions |
| Frontend jest for gardenPlannerSpaceCalculator.ts | No way to detect frontend-only calculation regressions |
| Cross-check script comparing backend vs frontend plant counts | Sync drift goes undetected |
| Integration test: export_to_calendar round-trip | Most complex business logic, zero test coverage |
| Auth isolation test hitting all endpoints | Data leakage would go undetected |

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
# Backend
cd backend && python -m pytest       # Run if tests/ exists

# Frontend
cd frontend && npm test              # Run if tests exist
cd frontend && npm run build         # TypeScript compilation check (always available)
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

**Existing setup:** `frontend/playwright.config.js` - Chromium, 1920x1080, screenshots on, video on, slowMo 800ms, ports 3000/5000.

**Existing test:** `frontend/test-seed-import.spec.js` - CSV seed import only.

**Proposed test file structure:**
```
tests/
  e2e/
    helpers/
      auth.ts            # Login/register helpers, test user factory
      navigation.ts      # Tab navigation helpers
      api.ts             # Direct API call helpers for setup/teardown
      fixtures.ts        # Test data factories (beds, plans, plants)
    auth.spec.ts         # Authentication & user isolation
    garden-beds.spec.ts  # Bed CRUD, all planning methods
    garden-planner.spec.ts  # Season plan lifecycle, succession, multi-bed
    garden-designer.spec.ts # Visual designer, plant placement, removal
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

**Shared helpers pattern:**
```typescript
// helpers/auth.ts
export async function loginAs(page, username = 'testuser', password = 'TestPass1!') {
  await page.goto('/');
  await page.getByRole('button', { name: /log in/i }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL('**/');
}

export async function registerUser(page, username, email, password) {
  // Register flow
}

// helpers/navigation.ts
export async function navigateTo(page, tabName: string) {
  await page.getByRole('tab', { name: tabName }).click();
  await page.waitForLoadState('networkidle');
}

// helpers/api.ts
export async function apiPost(request, path, body) {
  return request.post(`http://localhost:5000${path}`, { data: body });
}
```

---

### 10.1 Auth E2E Tests (`auth.spec.ts`)

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

### 10.2 Garden Beds - All Planning Methods (`garden-beds.spec.ts`)

```
Suite: Garden Bed CRUD
  test: Create Square Foot bed
    - Login, Navigate to Garden Designer
    - Click "Add Bed", fill: name="SFG Bed", width=4, length=8, method=Square Foot
    - Submit, verify bed appears on canvas with 12" grid

  test: Create MIGardener bed
    - method=MIGardener, verify bed created

  test: Create Row bed
    - method=Row, verify bed shows row-based layout

  test: Create Intensive bed
    - method=Intensive, verify hexagonal/intensive grid

  test: Create Permaculture bed
    - method=Permaculture, verify creates successfully

  test: Create Container bed
    - method=Container, verify creates successfully

  test: Edit bed dimensions
    - Select existing bed, click edit, change width from 4 to 3
    - Save, verify dimensions updated in display

  test: Edit bed planning method
    - Change method from Square Foot to MIGardener
    - Verify grid/display updates accordingly

  test: Delete bed with confirmation
    - Select bed, click delete, confirm, verify bed removed from canvas

  test: Delete bed with planted items - cascade
    - Create bed, place items, delete bed
    - Verify all planted items also removed

  test: Season extension options
    - Create bed with seasonExtension: cold-frame, 2 layers
    - Verify season extension stored and displayed

  test: Bed list shows all user beds
    - Create 3 beds with different methods
    - Verify all 3 appear in bed selector/list
```

### 10.3 Garden Planner - Full Lifecycle (`garden-planner.spec.ts`)

```
Suite: Season Plan Lifecycle
  test: Create new plan for current year
    - Navigate to Garden Planner, click "New Plan"
    - Verify plan shows in UI

  test: Add plan item - tomato, no succession
    - Select Tomato, set quantity: 12 plants
    - Assign to bed, successionEnabled: false
    - Save, verify item appears in plan list

  test: Add plan item - lettuce, 4 successions
    - Add Lettuce, quantity: 100
    - successionEnabled: true, successionCount: 4
    - successionIntervalDays: 14, firstPlantDate: 2026-04-15
    - Assign to 1 bed, save, verify succession fields shown

  test: Add plan item - carrot, 8 successions
    - successionCount: 8
    - Verify UI shows 8 succession slots
    - Verify quantity per succession displayed (100/8 = 12-13)

  test: Multi-bed allocation - even mode
    - Add item: 90 plants, assign to 3 beds, allocationMode: even
    - Verify 30 per bed displayed

  test: Multi-bed allocation - custom mode
    - Add item: 100 plants
    - Assign beds: bed1=60, bed2=25, bed3=15, allocationMode: custom
    - Verify unequal distribution shown

  test: Edit plan item
    - Click edit on existing item, change quantity from 12 to 20
    - Save, verify updated

  test: Delete plan item
    - Click delete on item, confirm, verify removed from list

  test: Export to calendar - simple
    - Plan has 1 tomato item (no succession)
    - Click "Export to Calendar"
    - Navigate to Planting Calendar, verify 1 event

  test: Export to calendar - succession
    - Plan has lettuce with 4 successions, 14-day interval, start Apr 15
    - Export, navigate to calendar
    - Verify 4 events: Apr 15, Apr 29, May 13, May 27, each qty=25

  test: Export idempotency - re-export doesn't duplicate
    - Export plan, export again
    - Verify no new events, appropriate message

  test: Crop rotation warning
    - Plant tomato in bed in 2025 (via API setup)
    - In 2026 plan, add pepper (Solanaceae) to same bed
    - Verify rotation warning shown

  test: Plan nutrition estimate
    - Add several items, verify PlanNutritionCard shows calorie/protein estimates

  test: Garden snapshot - point in time
    - Have placed items with dates, open Garden Snapshot
    - Set date to mid-season, verify shows items in ground on that date
```

### 10.4 Garden Designer - Plant Placement & Removal (`garden-designer.spec.ts`)

```
Suite: Plant Placement Methods
  test: Drag plant from palette to bed
    - Select bed, drag Tomato from PlantPalette to cell
    - Verify plant icon appears at drop location
    - Verify PlantedItem created via API

  test: Place plant via PlantConfigModal
    - Click on plant in palette or bed cell
    - Configure plantId, variety, quantity, click "Place"
    - Verify placed on grid

  test: Batch place from sidebar planned items
    - Have active plan with items assigned to this bed
    - Click "Place" on a plan item in PlannedPlantsSection
    - Verify plants placed and progress counter updates (e.g., "4/12")

  test: Place with variety selection
    - Drag plant with varieties (Tomato), select Beefsteak
    - Verify correct variety stored

  test: Place seed-density plant (lettuce broadcast)
    - Select MIGardener bed, place lettuce
    - Verify seed-density calculation and footprint buffer

  test: Place trellis plant
    - Have trellis structure, place tomato with trellis_linear style
    - Verify linear feet allocated and trellis capacity updated

Suite: Plant Removal Methods
  test: Remove single planted item
    - Click placed plant, click "Remove"
    - Verify removed from grid and API, progress counter decrements

  test: Clear entire bed
    - Bed has 5+ plants, click "Clear Bed", confirm
    - Verify all plants removed

  test: Remove doesn't affect other beds
    - Bed A and B have plants, clear Bed A
    - Verify Bed B plants untouched

Suite: Visual Feedback
  test: Footprint preview during drag
    - Start dragging, verify spacing buffer cells highlighted
    - Verify circular spacing pattern (not square)

  test: Conflict highlight on placement
    - Place tomato at (0,0), try placing at adjacent cell within spacing
    - Verify conflict warning

  test: Future plantings overlay
    - Have PlantingEvents with future dates
    - Enable "Show Future Plantings" toggle
    - Verify future events shown with FUTURE badge

  test: Date-aware progress sidebar
    - Have plan with succession items, change view date
    - Verify sidebar "X/Y" updates based on active successions

Suite: Seed Saving via Designer
  test: Toggle save-for-seed on planted item
    - Click placed plant, toggle "Save for Seed" ON
    - Verify status='saving-seed', seed maturity date shown

  test: Toggle save-for-seed off
    - Toggle OFF, verify status reverts

  test: Collect seeds
    - Have plant with save_for_seed=true
    - Click "Collect Seeds", enter date
    - Verify seeds_collected=true, status='harvested'
```

### 10.5 Planting Calendar (`planting-calendar.spec.ts`)

```
Suite: Calendar Views
  test: List view shows all events
  test: Calendar grid view with month navigation
  test: Timeline view with horizontal bars
  test: Filter by crop in sidebar
  test: Search crops

Suite: Event CRUD
  test: Add new planting event
  test: Add non-planting event (mulch)
  test: Edit existing event
  test: Delete event
  test: Add maple tapping event

Suite: Soil Temperature
  test: View soil temperature card
  test: Planting readiness indicator
```

### 10.6 Weather Module (`weather.spec.ts`)

```
Suite: Weather Alerts
  test: Set zipcode and fetch weather
  test: 7-day forecast display
  test: Frost alert detection
  test: Heat alert detection
  test: Zipcode persistence in localStorage
  test: Invalid zipcode handling
  test: No auth required
  test: Dismiss alert
  test: Growing degree days display
```

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

### 10.8 Seed Inventory & Catalog (`seed-inventory.spec.ts`, `seed-catalog.spec.ts`)

```
Suite: Seed Inventory CRUD
  test: Add seed manually
  test: Edit seed with agronomic overrides
  test: Agronomic override NULL vs 0
  test: Delete seed
  test: Search seeds
  test: Filter by category
  test: Sort seeds
  test: CSV import

Suite: Seed Catalog
  test: Browse global catalog
  test: Clone seed to personal inventory
```

### 10.9 Harvest Tracker (`harvest-tracker.spec.ts`)

```
Suite: Harvest Logging
  test: Log a harvest
  test: Edit harvest
  test: Delete harvest
  test: Harvest stats aggregation
  test: Date range filtering
  test: Quality distribution
```

### 10.10 Livestock (`livestock.spec.ts`)

```
Suite: Chickens
  test: Add chicken
  test: Edit chicken
  test: Delete chicken (cascade egg records)

Suite: Ducks
  test: Add duck

Suite: Beehives
  test: Add beehive
  test: Log hive inspection
  test: Log honey harvest

Suite: General Livestock
  test: Add goat
  test: Add health record
```

### 10.11 Compost Tracker (`compost.spec.ts`)

```
Suite: Compost Management
  test: Create compost pile
  test: Add brown ingredient, verify C:N recalc
  test: Add green ingredient, verify C:N moves toward balanced
  test: Status lifecycle (building -> cooking -> curing -> ready)
  test: Delete pile (cascade ingredients)
```

### 10.12 Property Designer (`property-designer.spec.ts`)

```
Suite: Property Management
  test: Create property
  test: Place structure with collision check
  test: Edit structure position
  test: Delete structure

Suite: Trellis Management
  test: Create trellis
  test: View trellis capacity
  test: Assign plant to trellis
```

### 10.13 Indoor Seed Starts (`indoor-seed-starts.spec.ts`)

```
Suite: Indoor Seed Starting
  test: Create seed start
  test: Track germination (rate calculation)
  test: Status lifecycle (seeded -> germinating -> growing -> ready -> transplanted)
  test: Import from garden plan
  test: Transplant to outdoor event
```

### 10.14 Admin User Management (`admin.spec.ts`)

```
Suite: Admin Functions
  test: Non-admin cannot access admin page
  test: Admin can list users
  test: Admin can create user
  test: Admin can reset password
  test: Admin can delete user
```

### 10.15 Space Calculation Verification (`space-calculations.spec.ts`)

```
Suite: Space Calculation Frontend-Backend Parity
  // Uses page.evaluate() for frontend calc + request.post() for backend

  test: SFG - tomato (1 per cell) -> Both return 1.0
  test: SFG - lettuce (4 per cell) -> Both return 0.25
  test: SFG - carrot (16 per cell) -> Both return 0.0625
  test: SFG - watermelon (2 cells per plant) -> Both return 2.0
  test: MIGardener - tomato (24, 18) -> Both agree
  test: MIGardener - potato (KNOWN BUG) -> Document discrepancy, expect failure
  test: MIGardener - pepper (KNOWN BUG - missing from frontend) -> expect failure
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

**Config note:** Current `playwright.config.js` has `headless: false` and `slowMo: 800`. For CI, change to `headless: true` and remove `slowMo`.

---

### Coverage Summary

| Feature Area | Section 3 (Manual) | Section 10 (Playwright) | Total |
|---|---|---|---|
| Authentication | 8 | 6 | 14 |
| Garden Beds (all methods) | 10 | 12 | 22 |
| Garden Planner (succession, multi-bed) | 15 | 13 | 28 |
| Garden Designer (placement, removal) | - | 15 | 15 |
| Planting Calendar | - | 10 | 10 |
| Space Calculations | 12 | 10 | 22 |
| Conflict Detection | 8 | - | 8 |
| Calendar Export | 10 | - | 10 |
| Seed Saving | 6 | 3 | 9 |
| Crop Rotation | 5 | - | 5 |
| Seed Inventory | - | 10 | 10 |
| Seed Catalog | - | 2 | 2 |
| Harvest Tracker | 3 | 6 | 9 |
| Livestock (all types) | 5 | 9 | 14 |
| Compost | 4 | 5 | 9 |
| Weather | 3 | 9 | 12 |
| Nutrition | - | 8 | 8 |
| Property Designer | - | 6 | 6 |
| Indoor Seed Starts | - | 5 | 5 |
| Admin | - | 5 | 5 |
| Photos | 3 | - | 3 |
| Plant DB Sync | 4 | - | 4 |
| Integration Journeys | - | 3 | 3 |
| Edge Cases (Sec 4) | 30+ | - | 30+ |
| **TOTAL** | **~125** | **~137** | **~260+** |

---

*Report generated 2026-02-22. Updated 2026-02-22 with BUG-01/BUG-04/BUG-07 fixes. All bugs verified against branch `baseline-buildable-frontend`. Endpoint catalog verified against actual blueprint source files (122 routes across 15 blueprints).*
