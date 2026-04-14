# Homestead Tracker Feature Test Plan

## Purpose

This test plan verifies that every user capability listed in `SITE_REVIEW.md` actually works in the running site and backend API.

## Test Strategy

- Run backend API/integration tests with `pytest` for business logic, auth isolation, conflict detection, seed import, space calculation, and succession export.
- Run Playwright E2E tests for browser workflows and full-stack API/UI verification.
- Run a production frontend build to catch TypeScript and bundling failures.
- Use one fresh test user per E2E suite so user data isolation can be verified safely.

## Required Commands

```powershell
# Terminal 1
.\start-backend.bat

# Terminal 2
.\start-frontend.bat

# Terminal 3
cd backend
python -m pytest

# Terminal 4
cd frontend
npm run build
npx playwright test
```

## Feature Acceptance Matrix

| Review claim | What must be verified | Current automated coverage | Missing / add next |
|---|---|---|---|
| Create account and log in | Register, log in, log out, block protected pages when unauthenticated, keep each user's data isolated | `frontend/tests/auth.spec.ts`, `frontend/tests/auth-isolation.spec.ts`, `frontend/tests/smoke.spec.ts`, `backend/tests/test_auth_isolation.py` | None obvious |
| Design a whole property map with gardens, coops, sheds, greenhouses, trellises, orchards, and trees | Property CRUD, place/edit/delete structures, collision validation, trellis CRUD/capacity, tree cards render | `frontend/tests/property-designer.spec.ts`, `backend/tests/test_trellis_check_constraints.py` | Add a browser test for tree placement/canopy display and tree-to-nutrition pipeline; add backend pytest for `POST /api/properties/validate-address` geocoding; add backend pytest for placed-structure CRUD (`POST/PUT/DELETE /api/placed-structures`) |
| Build garden beds and drag-and-drop crops into bed layouts | Create/edit/delete beds, place plants, move/duplicate plants, enforce spacing/collision rules, persist after reload | `frontend/tests/garden-beds.spec.ts`, `frontend/tests/garden-designer.spec.ts`, `frontend/tests/click-to-place.spec.ts`, `frontend/tests/space-calculations.spec.ts`, `backend/tests/test_conflict_detection.py`, `backend/tests/test_space_calculation_sync.py` | Seed-saving UI is covered (GD-08 through GD-11, CF-03). Add backend pytest for `DELETE /api/garden-beds/<id>/planted-items/date/<date>` and `DELETE .../plant/<plant_id>` batch-delete endpoints; add test for `PATCH /api/planting-events/<id>/switch-to-direct-seed` method switching |
| Create garden plans from seed inventory with succession planting, bed assignments, trellis assignments, rotation warnings, space checks, and nutrition estimates | Create/edit/delete plans, assign crops to beds/trellises, validate succession counts, detect rotation warnings, verify nutrition estimate card and feasibility/shopping endpoints | `frontend/tests/garden-planner.spec.ts`, `frontend/tests/cross-feature-integration.spec.ts`, `backend/tests/test_succession_export.py`, `backend/tests/test_space_calculation_sync.py` | Add Playwright/API checks for `GET /api/garden-plans/<id>/feasibility` (space feasibility), `GET /api/garden-plans/<id>/shopping-list` (seed shopping list), and `POST /api/garden-plans/<id>/optimize` (re-optimize). Add backend pytest for `POST /api/rotation/suggest-beds` and `GET /api/rotation/bed-history/<id>`. Add test for `GET /api/garden-planner/garden-snapshot?date=YYYY-MM-DD` (point-in-time inventory) |
| Export garden plans into a planting calendar | Export creates planting events, re-export is idempotent/safe, event dates and succession groups are correct, UI shows exported crops | `frontend/tests/garden-planner.spec.ts`, `frontend/tests/e2e-core.spec.ts`, `frontend/tests/cross-feature-integration.spec.ts`, `backend/tests/test_succession_export.py` | None obvious |
| Track indoor seed starts from seeding to germination, hardening off, and transplanting | Create/edit/delete seed starts, import from garden plan, update statuses, mark failed starts, transplant into a bed, require auth | `frontend/tests/indoor-seed-starts.spec.ts`, `backend/tests/test_planting_event_status.py` | Add one browser test that follows "From Garden Plan" to Garden Designer placement if not already covered |
| Manage personal seed inventory, browse seed catalog, import/export CSVs, and sync variety data | Seed CRUD, catalog pagination/search, clone catalog seed into personal inventory, sync cloned seed from catalog, CSV import/export, expiry indicators, filters/sort | `frontend/tests/seed-inventory.spec.ts`, `backend/tests/test_seed_import_service.py` | Add Playwright test for CSV import UI flow (upload file, verify imported seeds appear). Add backend pytest for `POST /api/my-seeds/from-catalog` (clone), `POST /api/my-seeds/<id>/sync-from-catalog` (sync overrides), `GET /api/seed-catalog/available-crops`, and `POST /api/varieties/import` (admin CSV import) |
| View planting schedules in list/calendar/timeline views with soil temperature, cold warnings, maple tapping, and open bed space | Create planting/mulch/maple events, switch list/grid/timeline views, verify soil temperature card, warning markers, bed filter, "Available Spaces" panel, delete/complete events | `frontend/tests/planting-calendar.spec.ts`, `backend/tests/test_event_details_validator.py` | Add a Playwright test that opens "Available Spaces" and validates a known open slot. Add a deterministic cold-warning test with mocked weather data. Add backend pytest for `GET /api/maple-tapping/season-estimate` calculation. Add backend pytest for `GET /api/planting-events/audit-conflicts` and `POST /api/planting-events/check-conflict`. Add backend pytest for `GET /api/germination-history` and `GET /api/germination-history/<plant_id>/prediction` |
| Track chickens, ducks, beehives, other livestock, egg production, hive inspections, honey harvests, and health records | CRUD each livestock category, log egg production, hive inspections, honey harvests, health records, search/filter/sort cards, show inactive toggle | `frontend/tests/livestock.spec.ts`, `backend/tests/test_breed_service.py`, `backend/tests/test_livestock_nutrition_integration.py` | Add backend pytest for duck CRUD and duck egg production endpoints (`/api/ducks`, `/api/duck-egg-production`). Add backend pytest for chicken egg production CRUD (`/api/egg-production`). Add backend pytest for beehive CRUD, hive inspections, and honey harvests (`/api/beehives`, `/api/hive-inspections`, `/api/honey-harvests`). Add Playwright test verifying egg/honey/health records render in UI cards (current E2E only validates API responses) |
| Log harvest amounts, quality, and notes | Create/edit/delete harvest records, stats update, search/filter/sort/date-range work, quality badge renders | `frontend/tests/harvest-tracker.spec.ts`, `frontend/tests/cross-feature-integration.spec.ts` | None obvious |
| Track compost piles, ingredients, moisture, turning, and estimated ready dates | Create/delete piles, add ingredients, C:N ratio updates, mark turned, update status/moisture, ready-date and schedule render | `frontend/tests/compost.spec.ts` | Add backend pytest for compost pile CRUD (`GET/POST/PUT/DELETE /api/compost-piles`) and ingredient management (`POST /api/compost-piles/<id>/ingredients`). Verify C:N ratio calculation logic, status lifecycle transitions, and estimated ready-date computation in isolation |
| Upload and organize garden/homestead photos | Upload photo, edit caption/category, delete photo, filter/search/sort/date-range, open lightbox, associate photo with bed if supported | No dedicated Playwright spec found | **HIGH PRIORITY**: Add `frontend/tests/photos.spec.ts` covering upload, edit caption/category, delete, filter by category, link to bed/plant. Add `backend/tests/test_photos.py` covering `GET/POST/PUT/DELETE /api/photos`, file storage, auth isolation, and linked-entity filtering |
| Monitor local weather, 7-day forecast, frost/heat alerts, wind, rainfall, and GDD | Current weather endpoint, forecast endpoint, ZIP/location settings persist, forecast cards render, alert thresholds generate, GDD chart renders | `frontend/tests/weather.spec.ts` | Add backend pytest for `GET /api/weather/current` and `GET /api/weather/forecast` with mocked external API responses (Open-Meteo). Add deterministic frost/heat alert threshold test with controlled forecast data. Add backend pytest for `GET /api/soil-temperature` endpoint |
| View nutrition dashboard from garden crops, livestock, and trees | Dashboard totals and source breakdown load, year selector works, CSV export button works, nutrition estimate endpoint validates data, auth required | `frontend/tests/nutrition.spec.ts`, `backend/tests/test_livestock_nutrition_integration.py` | Add property-tree-to-nutrition E2E pipeline (place tree on property, verify tree nutrition endpoint includes it in dashboard totals). Add backend pytest for `GET /api/nutrition/garden`, `GET /api/nutrition/trees`, `GET /api/nutrition/usda/search`, and `POST /api/nutrition/usda/import`. Add Playwright test for CSV export button producing valid file |

## Features Missing From Matrix (Added)

These features are described in `SITE_REVIEW.md` but had no row in the original test matrix:

| Review claim | What must be verified | Current automated coverage | Missing / add next |
|---|---|---|---|
| Garden snapshot — point-in-time inventory of what's in the ground on a date | `GET /api/garden-planner/garden-snapshot?date=YYYY-MM-DD` returns plants active on that date, aggregated by plant/variety | GD-14 covers season-progress but NOT snapshot | **Add** backend pytest for garden-snapshot endpoint: verify planted items with `planted_date <= date AND (harvest_date IS NULL OR harvest_date >= date)` are returned. Add Playwright test navigating to snapshot view in GardenPlanner |
| Season progress tracking — placed vs planned counts per plan item | `GET /api/garden-planner/season-progress?year=YYYY` returns `byPlanItemId` with correct placed/planned counts | GD-14, CF-01, CF-02 cover progress partially | Add backend pytest verifying `byPlanItemId` structure, that only PlantedItems with `source_plan_item_id` count, and that items without it don't affect progress |
| Future plantings overlay — preview scheduled succession plantings on the grid | Toggle ON shows future planting events with FUTURE badge, toggle OFF hides them, events filter by date range and quick harvest window | GD-13 toggles the button | Add Playwright test that creates a future-dated planting event, toggles overlay ON, and verifies the event renders on the grid with origin + buffer cells |
| Quick harvest filter — filter future plantings by harvest window | PlantPalette quick harvest dropdown sends `harvestWindowDays`, future plantings filtered to only events within window | None found | Add Playwright test: enable quick harvest filter (e.g., 30 days), verify future plantings overlay auto-enables and only shows events harvesting within 30 days |
| Season extension structures — cold frames, row covers, cloches, greenhouses on beds | Create bed with season extension type, layers, material, notes; verify data persists | GB-09 covers setting cold frame | Add backend pytest verifying season extension fields roundtrip through `to_dict()` and that all extension types (cold_frame, row_cover, cloche, greenhouse) are accepted |
| Companion planting and plant guilds | Guild suggestions appear when placing plants, companion/antagonist indicators shown | None found | Add Playwright test: place a tomato, verify companion planting suggestions render (e.g., basil as companion). Add backend pytest for any guild/companion endpoint if one exists |
| Date-aware sidebar counts — X/Y progress adjusts to view date | Sidebar denominator changes based on which successions are active on the current view date | CF-02 covers multi-bed succession progress | Add Playwright test: create succession plan (4 successions), export, navigate to mid-season date, verify sidebar shows only active succession count as denominator |
| Spacing calculator API | `POST /api/spacing-calculator` returns correct cells/space for a given plant, quantity, and method | `backend/tests/test_space_calculation_sync.py` covers sync logic | Add backend pytest directly calling `/api/spacing-calculator` endpoint with each planning method (square-foot, row, intensive, migardener) and verifying response |
| Planting validation endpoints | `POST /api/validate-planting`, `/api/validate-plants-batch`, `/api/validate-planting-date` | None found | Add backend pytest for each validation endpoint: valid input passes, invalid input returns structured error |
| Indoor seed starts — from planting event flow | Create seed start from an exported planting event, track through to transplant into target bed | ISS-01 through ISS-14 cover standalone CRUD | Add Playwright test: export plan to calendar, create indoor seed start from planting event via `POST /api/indoor-seed-starts/from-planting-event`, update status to ready, transplant into bed via `POST /api/indoor-seed-starts/<id>/transplant`, verify plant appears in designer |
| Admin panel — full user management UI | Admin can list, create, edit, delete users and reset passwords via UI | `frontend/tests/admin.spec.ts` covers API-level admin ops | Add Playwright test navigating to admin panel UI, verifying user table renders, and that non-admin redirect works in the browser |
| MIGardener seed density modes | Broadcast sowing, row-based sowing with thinning, and plant-spacing methods produce correct space calculations | `frontend/tests/space-calculations.spec.ts` | Add backend pytest for MIGardener-specific spacing: verify row-based (seed-density), intensive/broadcast (null row), and traditional row categories each return expected values via `migardener_spacing.py` |
| Trellis planting — assign crops to trellis structures | Create trellis, assign crop in plan, export, verify trellis position and capacity updates | PD-08 through PD-11 cover trellis CRUD | Add Playwright test: create trellis, create plan with trellis assignment, export to calendar, verify planting event has `trellis_structure_id` and position fields set, verify `GET /api/trellis-structures/<id>/capacity` reflects allocation |
| Harvest from Garden Designer | Mark a planted item as harvested from the designer UI, verify harvest record created and PlantingEvent completion synced | CF-01 covers plan-to-harvest pipeline | Add backend pytest verifying that harvesting a PlantedItem sets `PlantingEvent.completed=True` and `quantity_completed=quantity` (bidirectional sync) |

## High-Value End-to-End Journeys

| Journey | Steps | Pass criteria |
|---|---|---|
| Garden planning pipeline | Log in, add seeds, create beds, create garden plan, export to calendar, place plants in Garden Designer, log harvest, verify Nutrition dashboard | Every created object appears in the next downstream module and totals/progress update correctly |
| Indoor start to transplant | Create indoor seed start from garden plan, update germination status, mark hardening, navigate to Garden Designer, place transplant into target bed | Status and linked planting data stay in sync and planted item lands in the chosen bed |
| Property to trellis crops | Create property, add trellis, create trellis crop plan, assign crop to trellis, export/place crop, verify trellis capacity updates | Trellis assignment succeeds and capacity/usage reflects planted crops |
| Livestock production | Create chickens/ducks/beehive, log eggs/inspection/honey, open Livestock and Nutrition tabs | Animal records render and nutrition totals include animal production |
| Compost and weather operations | Create compost pile, add materials, mark turned, update moisture, open Weather tab, save ZIP, verify forecast and alerts | Compost and weather data persist and UI updates without errors |
| Photo documentation | Upload garden photo, edit category/caption, filter/search, open photo, delete photo | Photo appears with metadata, filters work, and deleted photo disappears |
| Seed saving full lifecycle | Place plant, toggle save-for-seed, wait for maturity date, collect seeds, verify seeds appear in inventory | Seed saving status is set, maturity date calculated, collected seeds create inventory entry, PlantingEvent harvest date extended |
| Garden snapshot point-in-time | Create beds, place plants with various dates, query snapshot at mid-season date | Snapshot returns only plants active on that date, excludes already-harvested and not-yet-planted |
| Quick harvest filter pipeline | Create succession plan, export, enable quick harvest filter (30 days), verify overlay shows only matching events | Future plantings overlay activates, only events within harvest window render |
| Indoor seed start to designer transplant | Create plan, export, create indoor starts from planting events, advance through statuses, transplant into bed | Seed start reaches "transplanted" status, planted item appears in target bed with correct source linkage |

## Priority Gap Summary

Gaps ranked by risk and user impact:

### P0 — No Coverage At All
| Gap | Why it matters | Effort |
|---|---|---|
| **Photos** (E2E + backend) | Entire feature section in review has zero test files | Medium — new spec + new pytest file |
| **Garden Snapshot** (backend + E2E) | Claimed feature, no test proves it works | Small — one backend pytest + one Playwright assertion |
| **Planting validation endpoints** (backend) | 3 endpoints with no tests; used before every plant placement | Small — backend pytest with valid/invalid inputs |
| **Germination history/prediction** (backend) | 2 endpoints untested; user-facing data in calendar | Small — backend pytest |

### P1 — Partial Coverage, Key Paths Untested
| Gap | Why it matters | Effort |
|---|---|---|
| **Livestock backend CRUD** | ~21 livestock endpoints have no backend pytest; only E2E coverage | Medium — one pytest file covering all animal types |
| **Compost backend** | 6 endpoints untested at backend level; C:N calculation only tested via E2E | Small — backend pytest |
| **Harvest backend** | 5 endpoints untested at backend level | Small — backend pytest |
| **Weather backend** (mocked) | External API dependency makes E2E flaky; no backend pytest with mocked responses | Medium — requires mocking Open-Meteo |
| **Seed catalog/clone/sync** (backend) | 5 seed endpoints untested at backend level | Small — backend pytest |
| **Feasibility/shopping-list/optimize** (backend) | 3 garden planner endpoints never directly asserted | Small — backend pytest |

### P2 — Feature Enrichment Tests
| Gap | Why it matters | Effort |
|---|---|---|
| **Future plantings overlay rendering** | Only toggle is tested, not actual event rendering on grid | Medium — requires date-controlled test data |
| **Quick harvest filter** | Zero coverage; multi-component integration | Medium |
| **Companion planting / guilds** | Claimed in review, no test proves suggestions appear | Small if endpoint exists |
| **Date-aware sidebar counts** | Complex succession math, only indirectly tested | Medium |
| **Indoor starts from-planting-event transplant** | Full flow untested end-to-end | Medium |
| **Trellis crop assignment + capacity** | Trellis CRUD tested, but not assignment-to-planting flow | Medium |
| **MIGardener-specific spacing** (backend) | 54 overrides, no dedicated backend test for the 3 categories | Small |
| **CSV import UI flow** | Backend CSV import tested, but no Playwright test for the upload UI | Medium |
| **Nutrition CSV export** | Button exists, no test verifies file output | Small |
| **Admin panel UI navigation** | API tested, but no test verifies browser-level admin page rendering | Small |

## Release Gate

A change should not be considered done until these pass:

- `cd backend && python -m pytest`
- `cd frontend && npm run build`
- `cd frontend && npx playwright test`

If any row in the Feature Acceptance Matrix is marked "Missing / add next", that gap should be implemented before claiming the matching review statement is fully verified.

## Backend API Coverage Summary

~170 API endpoints exist across 16 blueprints. ~35 have direct backend pytest coverage. The remaining ~135 are only exercised through Playwright E2E tests (if at all). The following backend test files would close the largest gaps:

| Proposed test file | Endpoints covered | Priority |
|---|---|---|
| `backend/tests/test_photos.py` | `GET/POST/PUT/DELETE /api/photos` | P0 |
| `backend/tests/test_garden_snapshot.py` | `GET /api/garden-planner/garden-snapshot` | P0 |
| `backend/tests/test_planting_validation.py` | `POST /api/validate-planting`, `validate-plants-batch`, `validate-planting-date` | P0 |
| `backend/tests/test_germination.py` | `GET /api/germination-history`, `GET .../prediction` | P0 |
| `backend/tests/test_livestock_crud.py` | All chicken, duck, beehive, livestock, egg, inspection, honey endpoints (~21) | P1 |
| `backend/tests/test_compost.py` | `GET/POST/PUT/DELETE /api/compost-piles`, ingredient endpoints | P1 |
| `backend/tests/test_harvests.py` | `GET/POST/PUT/DELETE /api/harvests`, `/api/harvests/stats` | P1 |
| `backend/tests/test_weather.py` | `GET /api/weather/current`, `GET /api/weather/forecast`, `GET /api/soil-temperature` (mocked) | P1 |
| `backend/tests/test_seed_catalog.py` | `GET /api/seed-catalog`, `available-crops`, `from-catalog`, `sync-from-catalog`, `varieties/import` | P1 |
| `backend/tests/test_plan_endpoints.py` | `GET .../feasibility`, `GET .../shopping-list`, `POST .../optimize`, `POST /api/rotation/suggest-beds`, `GET .../bed-history` | P1 |
| `backend/tests/test_spacing_api.py` | `POST /api/spacing-calculator` (all 4 methods) | P2 |
| `backend/tests/test_indoor_starts_flow.py` | `POST .../from-planting-event`, `POST .../transplant`, `POST .../mark-failed` | P2 |
