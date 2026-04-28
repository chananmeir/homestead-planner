# Claude Code Guidelines for Homestead Planner

**PURPOSE**: Prevent regressions and breaking changes when editing this repo. Follow these rules strictly.

---

## Project Overview

- Backend: Flask/Python with SQLAlchemy (port 5000)
- Frontend: React/TypeScript with Tailwind CSS (port 3000)
- Database: SQLite with Flask-Migrate
- Architecture: 16 Flask blueprints, service layer, multi-user with authentication
- Key features: multi-method garden planning (Square-Foot, MIGardener, Intensive, Row, Trellis); succession planting; variety-specific overrides; crop rotation; livestock/compost/harvest/photo tracking

---

## Critical Constraints (NON-NEGOTIABLE)

### 1. NEVER modify database schema directly

BAD:
```python
db.session.execute("ALTER TABLE planting_event ADD COLUMN new_field TEXT")
```

GOOD:
```bash
cd backend
flask db migrate -m "Add new_field to planting_event"
flask db upgrade
```

Direct schema changes bypass migration tracking, break deployments, and can corrupt data.

### 2. NEVER modify space calculation logic without updating ALL synchronized locations

| Domain | Backend | Frontend |
|--------|---------|----------|
| Main calculator | `backend/services/space_calculator.py` | `frontend/src/utils/gardenPlannerSpaceCalculator.ts` |
| SFG spacing | `backend/sfg_spacing.py` + `backend/garden_methods.py` | `frontend/src/utils/sfgSpacing.ts` |
| MIGardener spacing | `backend/migardener_spacing.py` | `frontend/src/utils/migardenerSpacing.ts` |
| Intensive spacing | `backend/intensive_spacing.py` | `frontend/src/utils/intensiveSpacing.ts` |
| Plant data | `backend/plant_database.py` | `frontend/src/data/plantDatabase.ts` |

Modifying a backend file requires updating its frontend counterpart (and vice versa). After any change, verify both implementations return identical values for the same input. Backend test pattern: `calculate_space_requirement('tomato-1', 12, 'square-foot')`. Frontend test pattern: `calculateSpaceRequirement(plant, 12, 'square-foot')`.

### 3. NEVER break API contracts

- Backend uses snake_case (`seed_start_date`)
- Frontend uses camelCase (`seedStartDate`)
- Every backend `to_dict()` converts case
- Every frontend API call expects camelCase
- `/api/plants` is normalized to camelCase by `_normalize_plant_keys()` in `data_bp.py`. Backend `PLANT_DATABASE` still uses snake_case internally; only the HTTP response is transformed.

When adding a model field:
1. Add to model (snake_case)
2. Add to `to_dict()` (camelCase)
3. Add to frontend type (camelCase)
4. Test roundtrip serialization

### 4. NEVER skip planning for multi-file changes

Plan explicitly before starting if your change affects:
- More than 2 files
- Any calculation logic
- Database schema
- API endpoints
- Succession/conflict logic

Multi-file or cross-stack work needs a written plan reviewed by the user, not just implementation.

### 5. NEVER ignore NULL vs falsy values

This codebase has 14 variety-specific override fields where `NULL` means "use plant default" and `0` is an explicit zero. Falsy checks treat `0` as `False` and break this contract.

BAD:
```python
if self.days_to_maturity:  # treats 0 as False
    result['daysToMaturity'] = self.days_to_maturity
```

GOOD:
```python
if self.days_to_maturity is not None:
    result['daysToMaturity'] = self.days_to_maturity
```

Frontend equivalent: use `!= null` (covers null and undefined, passes 0):
```tsx
{seed.daysToMaturity != null && (<span>{seed.daysToMaturity} days</span>)}
```

Common locations where this pattern applies (audited Feb 2026):
- `backend/services/planting_service.py`
- `backend/services/csv_import_service.py`
- `frontend/src/components/SeedCatalog.tsx`
- Any code using `dict.get()` on plant/seed fields that can be `0`

---

## High-Risk Areas

### [CRITICAL] Space Calculation Synchronization

Files: `backend/services/space_calculator.py::calculate_space_requirement()`, `frontend/src/utils/gardenPlannerSpaceCalculator.ts::calculateSpaceRequirement()`.

Frontend estimates during user input; backend validates on submission. Divergence causes wrong estimates or validation errors.

Special cases:
- Seed-density plantings (lettuce, arugula): backend returns cells PER SEED. Multiply by seed_count for total. Frontend must mirror exactly.
- Trellis plantings (tomatoes on trellis): use linear feet, not square feet. `effectiveQuantity * linearFeetPerPlant`. Not stored in bed space.

### [CRITICAL] Succession Planting Race Condition

Files: `backend/services/garden_planner_service.py` (`calculate_plant_quantities()`, `export_to_calendar()`), `backend/services/conflict_service.py`.

Succession plantings create multiple PlantingEvents linked by `succession_group_id` (UUID string). Wrong offsets cause collisions.

Rules:
1. Space division: 4 successions = total space / 4
2. Temporal offset: each planting offset by `succession_interval_days`
3. UUID linking: all events in the series share `succession_group_id`
4. Idempotency: check existing exports before creating new events

Test: `cd backend && python -m pytest tests/test_succession_export.py -v`. Cover edge cases: 0, 1, 4, 8 successions; manual quantity overrides; remainder distribution.

### [HIGH] Event Type Polymorphism

File: `backend/models.py::PlantingEvent`.

`event_type` discriminates: `'planting'` (uses plant_id, dates, spacing), `'mulch'`, `'fertilizing'`, `'irrigation'`, `'maple-tapping'` (use `event_details` JSON TEXT). Write-time validation in `services/event_details_validator.py` for mulch and maple-tapping; unknown types accepted for forward compat.

Rules: validate before saving; parse with try/except; never assume keys exist; always default with `.get('key', default)`.

### [HIGH] Completion State Consistency

- `PlantingEvent.completed` (Boolean), `quantity_completed` (Integer, nullable)
- `PlantedItem.status` (String): 'planned' | 'seeded' | 'transplanted' | 'growing' | 'harvested' | 'saving-seed'

These are SEPARATE models with no automatic cross-model sync. Use `PlantingEvent.is_complete` as the canonical check (prefers `quantity_completed >= quantity`, falls back to `completed`).

Normalized at all write paths (Feb 2026): PUT auto-sets `quantity_completed = quantity` when `completed=True` without explicit value; harvest endpoint sets both; PlantedItem harvest propagates to linked PlantingEvent. Test coverage in `test_planting_event_status.py`.

Do NOT assume PlantedItem.status and PlantingEvent.completed are consistent. Treat status as informational (no cross-model sync except 'harvested').

### [HIGH] IndoorSeedStart <-> PlantingEvent Completion Sync

Files: `backend/blueprints/gardens_bp.py` defines the canonical helper `_sync_indoor_start_on_completion()`; also called from `harvests_bp.py` (after harvest-driven completion) and `utilities_bp.py` (explicit transplant route).

PlantingEvent completion is set in 6+ code paths. Each path MUST sync the linked IndoorSeedStart to `'transplanted'`, or indoor starts show as "overdue" on the indoor-starts page.

Link: `IndoorSeedStart.planting_event_id` FK (nullable, no CASCADE, no backref).

Rules:
1. Any code that sets `event.completed = True` MUST call `_sync_indoor_start_on_completion(event)` afterward.
2. Always filter IndoorSeedStart queries by BOTH `planting_event_id` AND `user_id`.
3. The helper is idempotent.
4. New completion paths: grep for existing helper calls before merging.

### [MEDIUM] Trellis Capacity Tracking

Files: `backend/models.py::TrellisStructure`, `PlantingEvent.trellis_structure_id`, `trellis_position_start_inches`, `trellis_position_end_inches`.

No DB constraints prevent overlapping segments, out-of-bounds positions, or inverted ranges. Application-level validation: `services/trellis_validation.py::check_trellis_overlaps()` is called before saving in `gardens_bp.py` (returns 409 on overlap). Export path validates bounds; sequential assignment prevents overlap.

### [MEDIUM] UUID Linking Without Foreign Keys

Fields: `PlantingEvent.succession_group_id` and `row_group_id` are strings, not FKs. No DB enforcement of uniqueness, referential integrity, or orphan cleanup.

Rules: always filter UUIDs by `user_id` (collisions across users would leak data); generate via `uuid.uuid4()`; verify uniqueness before creating a new group.

### [MEDIUM] Planning Method vs Planting Style

- `GardenBed.planning_method`: 'square-foot' | 'row' | 'intensive' | 'migardener' (bed-level)
- `PlantingEvent.planting_style`: 'grid' | 'row' | 'broadcast' | 'dense_patch' | 'plant_spacing' | 'trellis_linear' (plant-level)

Refactoring incomplete. Rules: prefer `planning_method` for space calculations; use `planting_style` for UI/visualization only; do NOT mix the two.

### [HIGH] Seed Saving Feature

Files: `backend/blueprints/gardens_bp.py` (saveForSeed toggle, collect-seeds endpoint); `frontend/src/components/GardenDesigner/SetSeedDateModal.tsx`; `frontend/src/components/GardenDesigner/CollectSeedsModal.tsx`; `backend/models.py::PlantedItem` seed fields.

PlantedItem seed fields: `save_for_seed` (Boolean), `seed_maturity_date` (DateTime), `seeds_collected` (Boolean), `seeds_collected_date` (DateTime).

Auto-calc: `seed_maturity = base_date + days_to_seed`. Base_date priority: `harvest_date`, then `transplant_date + DTM`, then `planted_date + DTM`. If plant has no `days_to_seed`, leave null (frontend prompts manual entry).

Status lifecycle: toggle ON -> 'saving-seed'; toggle OFF -> restored from lifecycle (harvested > transplanted > growing > planned); collect seeds -> 'harvested'.

PlantingEvent sync on toggle: ON sets `expected_harvest_date = seed_maturity_date`; OFF restores from `in_ground_date + DTM`. PlantingEvent has NO `status` column and NO `planted_date` column; do not attempt to set these.

### [HIGH] Multi-Bed Succession Planting

Files: `backend/models.py::GardenPlanItem` (`bed_assignments`, `allocation_mode`, `beds_allocated`); `backend/services/garden_planner_service.py`; frontend GardenPlanner forms that submit `bedAssignments` / `allocationMode`.

Data model:
- `bed_assignments` (TEXT JSON): `[{"bedId": number, "quantity": number}, ...]` is the SINGLE SOURCE OF TRUTH.
- `allocation_mode`: `'even' | 'custom'` (default `'even'`).
- `beds_allocated` is LEGACY; derive from `bed_assignments` for backward compat; do not write directly.

Use Flask-Migrate for any related schema changes. No `migrations/custom/ALTER TABLE` scripts.

### [HIGH] Season Plan Progress Tracking

Files: `backend/blueprints/garden_planner_bp.py` (`season-progress` endpoint); `frontend/src/components/GardenDesigner/PlannedPlantsSection.tsx`; `backend/models.py::PlantedItem.source_plan_item_id` (the only reliable plan-to-placed link).

Multiple plan rows can share the same `plantId::variety`. Aggregating by anything other than `source_plan_item_id` will conflate distinct plan rows and silently corrupt progress counts.

Rules:
1. Sidebar progress: per plan item id, NEVER by `plantId::variety`.
2. Bed progress: `placedByBed[bedId] / plannedByBed[bedId]`. Season progress: `placedSeason / plannedSeason`.
3. PlantedItems without `source_plan_item_id` must NOT affect plan progress counts.
4. `bed_assignments` parsing must be try/except guarded; skip null `bedId`; coerce `quantity` to int safely.

Verify: `GET /api/garden-planner/season-progress?year=YYYY` returns a `byPlanItemId` map. Place plants from the sidebar; confirm the specific item in that bed increments (not other identical crops).

---

## Database Schema Rules

### Migration Workflow

- Schema changes: `flask db migrate -m "..."` then `flask db upgrade`
- Data migrations: `python migrations/custom/schema/<script>.py`

### Schema Change Checklist

- Nullable? (default nullable=True for existing data)
- Default value?
- Index needed? (FKs, user_id, frequently queried)
- FK constraint?
- Will it break existing API responses?
- Backfill needed?
- Documented in MIGRATIONS.md?

### Cascade Behavior

- `cascade='all, delete-orphan'`: parent-child (e.g. GardenBed -> PlantedItem)
- `cascade='all'`: weak ownership
- No cascade: explicit deletion only

### Naming Conventions

- Backend / Database: snake_case
- Frontend: camelCase

### Common Gotchas

1. DateTime: use `datetime.utcnow` (not `datetime.now()`).
2. JSON: store as TEXT, parse with `json.loads()` in try/except.
3. Boolean: default False, never nullable.
4. FKs: always index for query performance.

---

## API Contract Rules

### Case Conversion

Backend `to_dict()` returns camelCase; frontend payloads are camelCase. Backend endpoints convert incoming camelCase to snake_case.

### Date Handling (Backend)

JavaScript `Date.toISOString()` adds 'Z' suffix. Python `datetime.fromisoformat()` does NOT accept 'Z'.

Canonical helper: `backend/utils/helpers.py::parse_iso_date()`.

NEVER use `datetime.fromisoformat()` directly on inbound API request dates.

BAD:
```python
harvest_date = datetime.fromisoformat(data['harvestDate'])  # fails on 'Z'
```

GOOD:
```python
from utils.helpers import parse_iso_date
harvest_date = parse_iso_date(data['harvestDate'])
```

### Date Parsing (Frontend)

`new Date('2026-03-23')` parses as UTC midnight, shifting to the previous day in western timezones.

Canonical helper: `frontend/src/utils/dateUtils.ts::parseLocalDate()`.

NEVER use `new Date(dateStr + 'T00:00:00')` inline.

GOOD:
```typescript
import { parseLocalDate } from '../utils/dateUtils';
const viewDate = parseLocalDate(dateFilter.date);
```

### Error Response Format

Backend: `return jsonify({'error': 'Human-readable message', 'details': {...}}), 400`. Frontend reads `error.error` from `await response.json()`.

### API URL Configuration

NEVER hardcode API URLs.

GOOD:
```typescript
import { API_BASE_URL } from '../config';
const response = await fetch(`${API_BASE_URL}/api/endpoint`);
```

---

## Before Making Changes

Quick check before any edit:

1. Affects more than 2 files? -> write a plan first.
2. Changes calculation logic (space, dates, succession, conflicts, rotation)? -> document expected behavior.
3. Changes database schema? -> create migration, document in MIGRATIONS.md.
4. Changes API request/response format? -> update backend AND frontend types.
5. Changes space calc or plant data? -> update all synchronized file pairs (Constraint #2 table).

Skip the plan step only for: typos, single UI components, doc updates, 1-2 line bug fixes.

---

## After Making Changes

Verify:
- Backend tests: `cd backend && python -m pytest`
- Frontend build: `cd frontend && npm run build`
- Frontend tests: `cd frontend && CI=true npx react-scripts test --watchAll=false`
- E2E (both servers running): `cd frontend && npx playwright test`

If schema changed: test `flask db downgrade -1` then `flask db upgrade`.
If API changed: roundtrip test (create record, fetch, verify all fields and types).
If calculation changed: verify backend and frontend produce identical outputs for shared inputs.

Always: `git status` and `git diff` to confirm only intended files were modified. Update `MIGRATIONS.md` for schema changes; update `dev/active/` task docs for in-progress work.

---

## Common AI Mistakes to Avoid

### Mistake: Ignoring event type discrimination

```python
# BAD: assumes planting type
event = PlantingEvent.query.get(event_id)
plant_id = event.plant_id  # None if event_type='mulch'

# GOOD
if event.event_type == 'planting':
    plant_id = event.plant_id
else:
    details = json.loads(event.event_details)
```

### Mistake: Over-engineering simple changes

User asks for a tooltip; do not create a new component, state hook, and utility file. Modify one file. Do not add abstraction the task does not require.

### Mistake: Assuming `succession_group_id` is globally unique

UUIDs could collide across users; querying without `user_id` would leak data.

```python
events = PlantingEvent.query.filter_by(
    succession_group_id=group_id,
    user_id=current_user.id
).all()
```

### Mistake: Not testing edge cases

Test 0 successions, 1 succession, 8 successions, manual quantity overrides, per-seed succession preferences. Edge cases at the boundaries break first.

### Mistake: Assuming `mousemove` works for drag tracking in @dnd-kit

@dnd-kit uses Pointer Events internally; `mousemove` may not fire during a drag, causing stale cursor position (often the initial click) to be used on drop.

Fix: track with `pointermove` (optionally also `mousemove` for legacy); always cleanup listeners on drag end and component unmount; use `clientX/clientY` with `getBoundingClientRect()` (do not mix `pageX/pageY` with rect math); for SVG, prefer `getScreenCTM().inverse()`.

---

## Key Files

Load-bearing files worth memorizing:

- `backend/models.py` - 54+ SQLAlchemy models
- `backend/services/space_calculator.py` and `frontend/src/utils/gardenPlannerSpaceCalculator.ts` - synchronized space calc (CRITICAL)
- `backend/services/garden_planner_service.py` - succession + quantity logic
- `frontend/src/components/GardenDesigner.tsx` - visual bed designer (~3500 lines)
- `backend/plant_database.py` and `frontend/src/data/plantDatabase.ts` - synchronized plant data

---

## Uncertainty Notices

Areas where behavior is unclear; document if modifying:

1. Planning Method vs Planting Style: refactoring incomplete. Unclear which field takes precedence for space calculations in mixed configurations.
2. Rotation Algorithm: 3-year window is simplistic. Ignores intervening crops, cover crops, intercropping. May produce false positives.

---

## Default Verification Command

If unsure what to run:
- Backend: `cd backend && python -m pytest`
- Frontend build: `cd frontend && npm run build`
- Frontend tests: `cd frontend && CI=true npx react-scripts test --watchAll=false`
- E2E (both servers running): `cd frontend && npx playwright test`

Dev servers: `start-backend.bat` and `start-frontend.bat` from project root.

---

## Final Notes

Conservative approach:
- When in doubt, ask the user.
- Prefer small, additive changes over large refactors.
- Always plan explicitly for multi-file changes.
- Test edge cases (0, 1, max values).
- Document uncertainties explicitly.

---

**Last Updated**: 2026-04-27
