# Claude Code Guidelines for Homestead Planner

**PURPOSE**: This document exists to prevent regressions and breaking changes when using Claude Code on this repository. Follow these rules strictly.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Critical Constraints (NON-NEGOTIABLE)](#critical-constraints-non-negotiable)
3. [High-Risk Areas (REQUIRE PLANNING)](#high-risk-areas-require-planning)
4. [Database Schema Rules](#database-schema-rules)
5. [API Contract Rules](#api-contract-rules)
6. [Frontend-Backend Synchronization](#frontend-backend-synchronization)
7. [Before Making Changes](#before-making-changes)
8. [After Making Changes](#after-making-changes)
9. [Common AI Mistakes to Avoid](#common-ai-mistakes-to-avoid)
10. [Quick Start Commands](#quick-start-commands)
11. [Project Structure Reference](#project-structure-reference)
12. [Uncertainty Notices](#uncertainty-notices)
13. [Default Verification Command](#default-verification-command)

---

## Project Overview

Homestead Planner is a full-stack garden and homestead planning application:

- **Backend**: Flask/Python with SQLAlchemy (port 5000)
- **Frontend**: React/TypeScript with Tailwind CSS (port 3000)
- **Database**: SQLite with Flask-Migrate for migrations
- **Architecture**: 11 Flask blueprints, service layer, multi-user with authentication

**Key Features**:
- Multi-method garden planning (Square-Foot, MIGardener, Intensive, Row, Trellis)
- Succession planting with temporal/spatial conflict detection
- Variety-specific agronomic overrides
- Crop rotation tracking
- Livestock, compost, harvest, and photo tracking

---

## Critical Constraints (NON-NEGOTIABLE)

### 1. **NEVER Modify Database Schema Directly**

❌ **PROHIBITED**:
```python
# DON'T: Directly modify database schema
db.session.execute("ALTER TABLE planting_event ADD COLUMN new_field TEXT")
```

✅ **REQUIRED**:
```bash
# DO: Use Flask-Migrate
cd backend
flask db migrate -m "Add new_field to planting_event"
flask db upgrade
```

**Why**: Direct schema changes bypass migration tracking, break deployments, and can corrupt data.

### 2. **NEVER Modify Space Calculation Logic Without Updating ALL Locations**

Space calculation logic exists in **FOUR LOCATIONS** that must stay synchronized:

1. `backend/services/space_calculator.py` - Backend calculation
2. `backend/plant_database.py` - Plant spacing data
3. `frontend/src/utils/gardenPlannerSpaceCalculator.ts` - Frontend calculation
4. `frontend/src/utils/sfgSpacing.ts` - SFG lookup table

**Rule**: If you modify ONE, you MUST modify ALL FOUR.

**Example**:
- Changing tomato SFG spacing from 1 to 2 requires:
  1. Update `backend/sfg_spacing.py` lookup table
  2. Update `frontend/src/utils/sfgSpacing.ts` lookup table
  3. Test backend `calculate_space_requirement('tomato-1', 12, 'square-foot')`
  4. Test frontend `calculateSpaceRequirement(tomato, 12, 'square-foot')`
  5. Verify both return identical values

### 3. **NEVER Break API Contracts**

Backend and frontend have tightly coupled type contracts:

- Backend uses **snake_case** (e.g., `seed_start_date`)
- Frontend uses **camelCase** (e.g., `seedStartDate`)
- Every backend `to_dict()` method converts case
- Every frontend API call expects camelCase
- **Note**: `/api/plants` returns `PLANT_DATABASE` dicts normalized to camelCase by `_normalize_plant_keys()` in `data_bp.py`. Backend `PLANT_DATABASE` still uses snake_case internally — only the HTTP response is transformed.

**Rule**: When adding a new field to a model:
1. Add to backend model (snake_case)
2. Add to backend `to_dict()` method (convert to camelCase)
3. Add to frontend type definition (camelCase)
4. Test roundtrip serialization

### 4. **NEVER Skip Planning for Multi-File Changes**

**Require Planning** if your change affects:
- More than 2 files
- Any calculation logic
- Database schema
- API endpoints
- Succession/conflict logic

Use `EnterPlanMode` tool BEFORE making changes.

### 5. **NEVER Ignore NULL vs Falsy Values**

This codebase has **14 variety-specific override fields** where:
- `NULL` = "use plant default"
- `0` = "explicit zero value"
- `undefined` = "not set"

❌ **WRONG**:
```python
if self.days_to_maturity:  # Treats 0 as False!
    result['daysToMaturity'] = self.days_to_maturity
```

✅ **CORRECT**:
```python
if self.days_to_maturity is not None:  # Explicit NULL check
    result['daysToMaturity'] = self.days_to_maturity
```

**Frontend equivalent** — use `!= null` (covers both `null` and `undefined`, passes `0`):
```tsx
// WRONG: {seed.daysToMaturity && (...)}       — hides when 0
// CORRECT: {seed.daysToMaturity != null && (...)}
```

**Common locations where this pattern applies** (audited Feb 2026):
- `backend/services/planting_service.py` — `plant.get('daysToMaturity') is not None`
- `backend/services/csv_import_service.py` — DTM validation
- `frontend/src/components/SeedCatalog.tsx` — displaying agronomic values
- Any code using `dict.get()` on plant/seed fields that can be `0`

---

## High-Risk Areas (REQUIRE PLANNING)

### 🔴 CRITICAL RISK: Space Calculation Synchronization

**Files Involved**:
- `backend/services/space_calculator.py::calculate_space_requirement()`
- `frontend/src/utils/gardenPlannerSpaceCalculator.ts::calculateSpaceRequirement()`

**Why Critical**: Frontend calculates space estimates during user input. Backend validates on submission. If they diverge, users see incorrect space estimates or validation errors.

**Special Cases**:
1. **Seed-Density Plantings** (e.g., lettuce, arugula):
   - Backend returns cells **per seed** (not per plant)
   - Must multiply by seed_count to get total space
   - Frontend must mirror this calculation exactly

2. **Trellis Plantings** (e.g., tomatoes on trellis):
   - Use **linear feet** instead of square feet
   - Calculation: `effectiveQuantity × linearFeetPerPlant`
   - Not stored in bed space calculations

**Before Modifying**:
1. Read both files completely
2. Understand all four planning methods (square-foot, row, intensive, migardener)
3. Write test cases comparing frontend/backend output
4. Document expected values per method

### 🔴 CRITICAL RISK: Succession Planting Race Condition

**Files Involved**:
- `backend/services/garden_planner_service.py::calculate_plant_quantities()`
- `backend/services/garden_planner_service.py::export_to_calendar()`
- `backend/services/conflict_service.py`

**Why Critical**: Succession plantings create multiple PlantingEvents linked by `succession_group_id` (UUID string). If temporal/spatial offsets are incorrect, plantings collide.

**Recent Bugs** (see commit history):
- "Fix succession planting space calculation race condition" (335cfea)
- "Fix Garden Season Planner manual quantity and succession bug" (5f8da02)

**Rules**:
1. **Space Division**: If 4 succession plantings, divide total space by 4
2. **Temporal Offset**: Each planting offset by `succession_interval_days`
3. **UUID Linking**: All events in series share same `succession_group_id`
4. **Idempotency**: Check for existing exports before creating new events

**Test Coverage**: `backend/tests/test_succession_export.py` (36 tests) covers all 3 export paths (legacy, bed-allocated, trellis), idempotent re-export, DTM resolution, remainder distribution, and edge cases. Run with `cd backend && python -m pytest tests/test_succession_export.py -v`.

**Before Modifying**:
1. Understand succession flow: calculate → validate → export
2. Test edge cases: 0, 1, 4, 8 succession counts
3. Verify space doesn't over-allocate
4. Run `python -m pytest tests/test_succession_export.py -v` after changes

### 🟡 HIGH RISK: Event Type Polymorphism

**Files Involved**:
- `backend/models.py::PlantingEvent`
- All API routes handling PlantingEvent

**Why Risky**: `event_type` field discriminates between:
- `'planting'`: Uses plant_id, variety, dates, spacing fields
- `'mulch'`: Uses event_details JSON with mulch_type, depth, coverage
- `'fertilizing'`: Uses event_details JSON with fertilizer_type, amount
- `'irrigation'`: Uses event_details JSON with duration, method
- `'maple-tapping'`: Uses event_details JSON with tap_count, sapAmount

**Problem**: No JSON schema validation. event_details is stored as TEXT.

**Rules**:
1. Always validate event_details structure before saving
2. Use try-except when parsing event_details
3. Never assume event_details keys exist
4. Log parsing failures

❌ **WRONG**:
```python
details = json.loads(event.event_details)
mulch_type = details['mulch_type']  # KeyError if missing!
```

✅ **CORRECT**:
```python
try:
    details = json.loads(event.event_details)
    mulch_type = details.get('mulch_type', 'none')  # Default fallback
except (json.JSONDecodeError, AttributeError) as e:
    logging.error(f"Failed to parse event_details: {e}")
    mulch_type = 'none'
```

### 🟡 HIGH RISK: Dual Status System

**Files Involved**:
- `backend/models.py::PlantingEvent` (Lines 108-109, 201-202)

**Problem**: PlantingEvent has **THREE status fields** with unclear semantics:
- `status` (String): 'planned' | 'seeded' | 'transplanted' | 'growing' | 'harvested' | 'saving-seed'
- `completed` (Boolean): True/False
- `quantity_completed` (Integer): None (not started), 0 (partial), ≥quantity (complete)

**Inconsistencies**:
- `status='harvested'` but `completed=False` (contradictory)
- `completed=True` but `quantity_completed=10` when `quantity=20` (partial)
- No validation enforcing consistency

**Rules**:
1. Do NOT add logic that assumes status fields are consistent
2. Prefer using `quantity_completed` for completion tracking
3. Treat `status` as informational only
4. If modifying status logic, document ambiguities

**Known Issue**: Reviewed Feb 2026 (backlog #11) and **intentionally deferred**. No user-facing bugs today. Cleanup would touch seed saving, calendar export, harvest marking, and designer placement — all without status-transition test coverage as a safety net. Leave as-is until dedicated test coverage exists.

### 🟠 MEDIUM RISK: Trellis Capacity Tracking

**Files Involved**:
- `backend/models.py::TrellisStructure`
- `backend/models.py::PlantingEvent` (trellis_structure_id, trellis_position_start_inches, trellis_position_end_inches)

**Problem**: No database constraints prevent:
1. Overlapping trellis segments (Event A: 0-12", Event B: 6-18")
2. Positions exceeding trellis length (position_start > total_length_feet)
3. Invalid ranges (position_start > position_end)

**Rules**:
1. Application code must validate ranges before saving
2. Check for overlaps when assigning trellis positions
3. Log warnings for suspicious allocations

**Before Modifying**:
- Read existing trellis allocation logic
- Understand linear vs area-based space calculations

### 🟠 MEDIUM RISK: UUID Linking Without Foreign Keys

**Fields**:
- `PlantingEvent.succession_group_id` (UUID string linking succession series)
- `PlantingEvent.row_group_id` (UUID string linking adjacent row segments)

**Problem**: These are strings, not foreign keys. No database enforcement of:
- UUID uniqueness per user
- Referential integrity
- Orphaned chains

**Risks**:
1. UUID collision across users → data leakage
2. UUID deletion → broken chains
3. No cascade delete behavior

**Rules**:
1. Always filter UUIDs by `user_id` in queries
2. Generate UUIDs using `uuid.uuid4()` (never hardcode)
3. Verify UUID doesn't exist before creating new group

### 🟠 MEDIUM RISK: Planning Method vs Planting Style

**Fields**:
- `GardenBed.planning_method`: 'square-foot' | 'row' | 'intensive' | 'migardener' (bed-level)
- `PlantingEvent.planting_style`: 'grid' | 'row' | 'broadcast' | 'dense_patch' | 'plant_spacing' | 'trellis_linear' (plant-level)

**Problem**: Recent architectural change separated these concepts, but refactoring is incomplete:
- Space calculator uses `planning_method`
- Some frontend code uses `planting_style`
- Unclear interaction when bed is 'square-foot' but event is 'broadcast'

**Rules**:
1. Prefer `planning_method` for space calculations
2. Use `planting_style` for UI/visualization only
3. Do NOT add logic that mixes both concepts
4. Document uncertainty if unclear which to use

### 🟡 HIGH RISK: Seed Saving Feature

**Files Involved**:
- `backend/blueprints/gardens_bp.py` (saveForSeed toggle + collect-seeds endpoint)
- `frontend/src/components/GardenDesigner/SetSeedDateModal.tsx`
- `frontend/src/components/GardenDesigner/CollectSeedsModal.tsx`
- `backend/models.py::PlantedItem` (seed saving fields)

**PlantedItem Seed Fields**:
- `save_for_seed` (Boolean): Whether plant is marked for seed saving
- `seed_maturity_date` (DateTime): When seeds will be ready
- `seeds_collected` (Boolean): Whether seeds have been harvested
- `seeds_collected_date` (DateTime): When seeds were collected

**Auto-Calculation Logic** (backend):
- Seed maturity = `base_date + days_to_seed`
- `base_date` priority: `harvest_date` → `transplant_date + daysToMaturity` → `planted_date + daysToMaturity`
- If plant has no `days_to_seed`, leave `seed_maturity_date` null (frontend prompts for manual entry)

**Status Lifecycle**:
- Toggle ON: status → `'saving-seed'`
- Toggle OFF: status restored based on lifecycle (`harvested` > `transplanted` > `growing` > `planned`)
- Collect seeds: status → `'harvested'`

**PlantingEvent Sync**:
- Toggle ON: `expected_harvest_date` = `seed_maturity_date` (extends time in ground)
- Toggle OFF: `expected_harvest_date` restored from `in_ground_date + daysToMaturity`
- **WARNING**: PlantingEvent has NO `status` column and NO `planted_date` column. Do not attempt to set these.

---

## Database Schema Rules

### Migration Workflow

**Two Migration Systems**:

1. **Flask-Migrate** (for schema changes):
   ```bash
   cd backend
   flask db migrate -m "Add field_name to table_name"
   flask db upgrade
   ```

2. **Custom Scripts** (for data migrations):
   ```bash
   cd backend
   python migrations/custom/schema/add_position_fields.py
   ```

### Schema Change Checklist

Before adding/modifying a field:

- [ ] Is this field nullable? (Default should be nullable=True for existing data)
- [ ] Does this field have a default value?
- [ ] Does this field require an index? (foreign keys, user_id, frequently queried)
- [ ] Does this field require a foreign key constraint?
- [ ] Will this field break existing API responses?
- [ ] Do I need to backfill data for existing rows?
- [ ] Have I documented this change in `MIGRATIONS.md`?

### Model Relationship Rules

**Cascade Behavior**:
- `cascade='all, delete-orphan'`: Use for parent-child (e.g., GardenBed → PlantedItem)
- `cascade='all'`: Use for weak ownership
- No cascade: Use when deletion should be explicit

**Common Cascade Patterns**:
```python
# Parent deletes children
planted_items = db.relationship('PlantedItem', backref='garden_bed',
                                lazy=True, cascade='all, delete-orphan')

# Weak reference (no cascade)
seed_inventory_id = db.Column(db.Integer, db.ForeignKey('seed_inventory.id'))
```

### Field Naming Conventions

- **Backend**: snake_case (`seed_start_date`, `succession_group_id`)
- **Frontend**: camelCase (`seedStartDate`, `successionGroupId`)
- **Database**: snake_case (follows SQLAlchemy conventions)

### Common Gotchas

1. **DateTime Fields**: Always use `datetime.utcnow` (not `datetime.now()`)
2. **JSON Fields**: Store as TEXT, parse with `json.loads()`, always use try-except
3. **Boolean Fields**: Default to False, never nullable
4. **Foreign Keys**: Always add index for query performance

---

## API Contract Rules

### Case Conversion

**Backend to Frontend**:
```python
def to_dict(self):
    return {
        'seedStartDate': self.seed_start_date.isoformat() if self.seed_start_date else None,
        'transplantDate': self.transplant_date.isoformat() if self.transplant_date else None,
        'successionGroupId': self.succession_group_id,
        # ... all snake_case → camelCase
    }
```

**Frontend to Backend**:
```typescript
const payload = {
  seedStartDate: '2025-06-15T00:00:00Z',
  transplantDate: '2025-07-01T00:00:00Z',
  successionGroupId: 'abc-def-123'
};
// Backend endpoint converts camelCase → snake_case
```

### Date Handling

**JavaScript Issue**: JavaScript Date.toISOString() adds 'Z' suffix (UTC)
**Python Issue**: Python datetime.fromisoformat() doesn't accept 'Z'

**Canonical Helper**: `backend/utils/helpers.py::parse_iso_date()`

**Rule**: NEVER use `datetime.fromisoformat()` directly on inbound API request dates.

❌ **WRONG**:
```python
harvest_date = datetime.fromisoformat(data['harvestDate'])  # fails on "Z"
```

✅ **CORRECT**:
```python
from utils.helpers import parse_iso_date
harvest_date = parse_iso_date(data['harvestDate'])  # handles "Z"
```

### Error Response Format

**Standard Error Response**:
```python
return jsonify({'error': 'Human-readable message', 'details': {...}}), 400
```

**Frontend Expectation**:
```typescript
if (!response.ok) {
  const error = await response.json();
  console.error(error.error); // "Human-readable message"
}
```

### API URL Configuration

**CRITICAL**: Never hardcode API URLs in components!

❌ **WRONG**:
```typescript
const response = await fetch('http://localhost:5000/api/endpoint');
```

✅ **CORRECT**:
```typescript
import { API_BASE_URL } from '../config';
const response = await fetch(`${API_BASE_URL}/api/endpoint`);
```

**Why**: Hardcoded URLs break deployment, prevent environment-specific configuration.

---

## Frontend-Backend Synchronization

### Space Calculation Synchronization (MOST CRITICAL)

**Backend**: `backend/services/space_calculator.py::calculate_space_requirement()`
**Frontend**: `frontend/src/utils/gardenPlannerSpaceCalculator.ts::calculateSpaceRequirement()`

**Contract**: Both functions MUST return identical values for same inputs.

**Test Pattern**:
```python
# Backend test
from services.space_calculator import calculate_space_requirement
cells = calculate_space_requirement('tomato-1', 12, 'square-foot')
assert cells == 1, f"Expected 1, got {cells}"
```

```typescript
// Frontend test
import { calculateSpaceRequirement } from './gardenPlannerSpaceCalculator';
const plant = PLANT_DATABASE.find(p => p.id === 'tomato-1');
const cells = calculateSpaceRequirement(plant, 12, 'square-foot');
expect(cells).toBe(1);
```
## Multi-bed succession planting (Jan 2026)

### Data model (GardenPlanItem)
- `bed_assignments` (TEXT JSON): `[{"bedId": number, "quantity": number}, ...]`
  - This is the **single source of truth** for bed selection + per-bed quantity.
- `allocation_mode` (string): `'even' | 'custom'` (default `'even'`)
- `beds_allocated` remains **legacy**, derived from `bed_assignments` for backward compatibility.

## Season plan progress tracking (Feb 2026)

What to include (guardrails):

PlantedItem.source_plan_item_id is the only reliable link between a placed plant and a GardenPlanItem.

Sidebar progress must be computed per plan item id, not by plantId::variety, because multiple plan rows can share the same plant/variety.

Progress display rules:

Bed progress: placedByBed[bedId] / plannedByBed[bedId]

Season progress: placedSeason / plannedSeason

Items without source_plan_item_id must not affect plan progress counts.

Bed assignments parsing rules:

bed_assignments is JSON, must be try/except guarded.

Skip null bedId, coerce quantity safely to int.

Verification commands to list:

Call GET /api/garden-planner/season-progress?year=YYYY and confirm byPlanItemId exists.

Place plants from sidebar → confirm the specific item in that bed increments (not other identical crops).

### Migration policy
- Use **Flask-Migrate/Alembic** (`flask db migrate`, `flask db upgrade`).
- **Do not** add custom SQLite `ALTER TABLE` scripts in `migrations/custom/...` for schema changes.

### API contract
GardenPlanItem payload may include:
```json
{
  "bedAssignments": [{"bedId": 1, "quantity": 25}],
  "allocationMode": "even"
}

### Plant Database Synchronization

**Backend**: `backend/plant_database.py::PLANT_DATABASE`
**Frontend**: `frontend/src/data/plantDatabase.ts::PLANT_DATABASE`

**Rule**: These must contain identical data. Adding a plant requires:
1. Add to backend `PLANT_DATABASE`
2. Add to frontend `PLANT_DATABASE`
3. Add to SFG lookup tables (if applicable)
4. Add to method-specific spacing tables (if applicable)

### SFG Lookup Table Synchronization

**Backend**: `backend/sfg_spacing.py::SFG_PLANTS_PER_CELL`
**Frontend**: `frontend/src/utils/sfgSpacing.ts::SFG_PLANTS_PER_CELL`

**Current Size**: 52+ plants + varieties

**Rule**: Any change to SFG spacing requires updating BOTH files.

---

## Before Making Changes

### Pre-Change Checklist

Before modifying ANY code, answer these questions:

1. **Scope**: Does this change affect more than 2 files?
   - YES → Use `EnterPlanMode` tool first
   - NO → Proceed with caution

2. **Calculation Logic**: Does this change any calculation?
   - Space requirements
   - Date calculations
   - Succession logic
   - Conflict detection
   - Rotation checking
   - YES → Document expected behavior first

3. **Database Schema**: Does this change database structure?
   - YES → Create migration, document in MIGRATIONS.md
   - NO → Proceed

4. **API Contract**: Does this change request/response format?
   - YES → Update backend AND frontend types
   - NO → Proceed

5. **Synchronization**: Does this change space calculation or plant data?
   - YES → Update all 4 locations (backend service, backend data, frontend utils, frontend data)
   - NO → Proceed

### Planning Requirements

**REQUIRE EnterPlanMode if**:
- Adding new planning method
- Modifying succession logic
- Changing conflict detection
- Refactoring service layer
- Adding new API endpoints (>1 endpoint)
- Database schema changes (>1 table)

**SKIP EnterPlanMode if**:
- Fixing typos
- Adding single UI component
- Updating documentation
- Simple bug fixes (1-2 lines)

---

## After Making Changes

### Post-Change Verification Checklist

After making changes, verify:

- [ ] **Backend Tests**: Run backend tests
  ```bash
  cd backend
  python -m pytest                    # All tests
  python -m pytest tests/test_space_calculation_sync.py -v  # Space calc tests (114 tests)
  python -m pytest tests/test_succession_export.py -v       # Succession export tests (36 tests)
  ```

- [ ] **Frontend Tests**: Run frontend tests
  ```bash
  cd frontend
  CI=true npx react-scripts test --watchAll=false  # All tests
  CI=true npx react-scripts test --testPathPattern="gardenPlannerSpaceCalculator" --watchAll=false  # Space calc tests (55 tests)
  ```

- [ ] **E2E Tests**: Run Playwright E2E tests (requires both servers running)
  ```bash
  cd frontend
  npx playwright test                                    # All E2E suites (~161 tests)
  npx playwright test tests/garden-planner.spec.ts       # Garden Planner lifecycle (13 tests)
  npx playwright test tests/e2e-core.spec.ts             # Core user journeys (3 tests)
  ```

- [ ] **Manual Testing**: Test the feature manually
  - Create sample data
  - Test edge cases (0, 1, max values)
  - Test error handling

- [ ] **Database Migration**: If schema changed, test migration
  ```bash
  cd backend
  flask db downgrade -1  # Test rollback
  flask db upgrade       # Test upgrade
  ```

- [ ] **API Contract**: If API changed, test frontend-backend roundtrip
  - Create test record
  - Fetch from API
  - Verify all fields present and correct type

- [ ] **Cross-File Consistency**: If calculation changed, verify synchronization
  - Test backend calculation
  - Test frontend calculation
  - Compare outputs for identical inputs

- [ ] **Git Status**: Review all modified files
  ```bash
  git status
  git diff
  ```
  - Confirm no unintended changes
  - Verify only necessary files modified

- [ ] **Documentation**: Update relevant docs
  - `MIGRATIONS.md` for schema changes
  - Dev docs in `dev/active/` for task progress
  - Comments in code for complex logic

---
- Review git diff and confirm:
  - No formatting-only changes
  - No renamed variables without reason
  - No unrelated refactors

## Common AI Mistakes to Avoid

### ❌ Mistake 1: Modifying Space Calculation in Only One Location

**Example**:
```python
# Claude modifies backend/services/space_calculator.py
def calculate_space_requirement(plant_id, grid_size, method):
    if method == 'square-foot':
        return get_sfg_cells_required(plant_id) * 2  # WRONG: Frontend not updated!
```

**Why Wrong**: Frontend shows incorrect estimates, users confused.

**Fix**: Update ALL FOUR locations (backend service, backend data, frontend utils, frontend data).

### ❌ Mistake 2: Using Falsy Check for Nullable Fields

**Example (model attribute)**:
```python
# WRONG: Treats 0 as False
if seed.days_to_maturity:
    dtm = seed.days_to_maturity
else:
    dtm = plant.days_to_maturity
```

**Example (dict.get — equally wrong)**:
```python
# WRONG: dict.get returns None for missing keys, but falsy check also rejects 0
if plant and plant.get('daysToMaturity'):
    expected_harvest = planted_date + timedelta(days=plant['daysToMaturity'])
```

**Example (JSX conditional rendering)**:
```tsx
// WRONG: hides element when daysToMaturity is 0
{seed.daysToMaturity && (<span>{seed.daysToMaturity} days</span>)}
```

**Why Wrong**: If DTM is 0 (valid value), falls back to plant default / hides UI incorrectly.

**Fix (Python)**:
```python
# CORRECT: Explicit NULL check (model attribute)
if seed.days_to_maturity is not None:
    dtm = seed.days_to_maturity

# CORRECT: Explicit NULL check (dict.get)
if plant and plant.get('daysToMaturity') is not None:
    expected_harvest = planted_date + timedelta(days=plant['daysToMaturity'])
```

**Fix (TypeScript/JSX)**:
```tsx
// CORRECT: != null covers null and undefined, passes 0
{seed.daysToMaturity != null && (<span>{seed.daysToMaturity} days</span>)}
```

### ❌ Mistake 3: Direct Database Schema Modification

**Example**:
```python
# WRONG: Direct SQL execution
db.session.execute("ALTER TABLE planting_event ADD COLUMN new_field TEXT")
```

**Why Wrong**: Bypasses migration tracking, breaks deployments.

**Fix**: Use Flask-Migrate (`flask db migrate -m "..."`)

### ❌ Mistake 4: Ignoring Event Type Discrimination

**Example**:
```python
# WRONG: Assumes event is planting type
event = PlantingEvent.query.get(event_id)
plant_id = event.plant_id  # None if event_type='mulch'!
```

**Why Wrong**: Non-planting events have null plant_id.

**Fix**:
```python
# CORRECT: Check event type first
event = PlantingEvent.query.get(event_id)
if event.event_type == 'planting':
    plant_id = event.plant_id
else:
    details = json.loads(event.event_details)
    # Handle non-planting event
```

### ❌ Mistake 5: Hardcoding API URLs

**Example**:
```typescript
// WRONG: Hardcoded URL
const response = await fetch('http://localhost:5000/api/seeds');
```

**Why Wrong**: Breaks in production, prevents environment configuration.

**Fix**:
```typescript
// CORRECT: Use config
import { API_BASE_URL } from '../config';
const response = await fetch(`${API_BASE_URL}/api/seeds`);
```

### ❌ Mistake 6: Forgetting Case Conversion

**Example**:
```python
# WRONG: Returns snake_case to frontend
def to_dict(self):
    return {
        'seed_start_date': self.seed_start_date,  # Frontend expects camelCase!
    }
```

**Why Wrong**: Frontend TypeScript types expect camelCase.

**Fix**:
```python
# CORRECT: Convert to camelCase
def to_dict(self):
    return {
        'seedStartDate': self.seed_start_date.isoformat() if self.seed_start_date else None,
    }
```

### ❌ Mistake 7: Not Handling JavaScript 'Z' Suffix

**Example**:
```python
# WRONG: Fails on JavaScript dates
date = datetime.fromisoformat(request.json['seedStartDate'])  # Fails if ends with 'Z'
```

**Why Wrong**: JavaScript sends '2025-06-15T00:00:00Z', Python fromisoformat() doesn't accept 'Z'.

**Fix**:
```python
# CORRECT: Use helper
date = parse_iso_date(request.json['seedStartDate'])
```

### ❌ Mistake 8: Over-Engineering Simple Changes

**Example**: User asks to "add a tooltip to the button"

Claude response: Creates new component, adds state management, creates utility file, updates 5 files.

**Why Wrong**: Simple changes should be simple. Don't add unnecessary abstraction.

**Fix**: Add inline tooltip, modify 1 file, commit.

### ❌ Mistake 9: Assuming Succession Group ID is Unique Globally

**Example**:
```python
# WRONG: No user_id filter
events = PlantingEvent.query.filter_by(succession_group_id=group_id).all()
```

**Why Wrong**: UUID could collide across users, leaks data.

**Fix**:
```python
# CORRECT: Filter by user
events = PlantingEvent.query.filter_by(
    succession_group_id=group_id,
    user_id=current_user.id
).all()
```

### ❌ Mistake 10: Not Testing Edge Cases

**Example**: Modifies succession logic, tests only with 4 successions.

**Why Wrong**: Edge cases (0, 1, 8 successions) often break.

**Fix**: Test edge cases:
- 0 successions (no succession)
- 1 succession (single planting)
- 8 successions (maximum)
- Manual quantity overrides
- Per-seed succession preferences

### ❌ Mistake X: Assuming drag tracking works with `mousemove` in @dnd-kit

**Why Wrong**: @dnd-kit uses Pointer Events internally. Depending on device/browser routing, `mousemove` may not fire during a drag, causing stale cursor position (often the initial click) to be used on drop.

**Fix**:
- Track drag position with `pointermove` (optionally also `mousemove` for legacy)
- Always cleanup listeners on drag end + component unmount
- Use `clientX/clientY` with `getBoundingClientRect()` (don’t mix `pageX/pageY` with rect math)
- If converting to SVG coordinates, prefer `getScreenCTM().inverse()` approach

---

## Quick Start Commands

### Backend

```bash
# Activate virtual environment
cd backend
venv\Scripts\activate              # Windows
source venv/bin/activate           # Mac/Linux

# Run Flask app
python app.py                      # Development server (port 5000)

# Database migrations
flask db migrate -m "description"  # Generate migration
flask db upgrade                   # Apply migration
flask db downgrade -1              # Rollback one migration

# Run custom migration
python migrations/custom/schema/add_position_fields.py

# Run tests
python -m pytest                   # All tests (130+ tests)
```

### Frontend

```bash
# Install dependencies
cd frontend
npm install

# Run development server
npm start                          # Port 3000

# Build for production
npm run build

# Run tests
CI=true npx react-scripts test --watchAll=false  # All tests (33+ space calc tests)

# E2E tests (requires both servers running on ports 3000/5000)
npx playwright test                          # All E2E suites (~161 tests)
```

### Common Tasks

```bash
# Start both servers (from project root)
# Windows
start-backend.bat
start-frontend.bat

# Check git status
git status
git diff

# View recent commits
git log --oneline -10
```

---

## Project Structure Reference

```
homestead-planner/
├── backend/
│   ├── app.py                              # Main Flask app (DEPRECATED: migrating to blueprints)
│   ├── models.py                           # SQLAlchemy models (54+ models, 13 domains)
│   ├── blueprints/                         # Flask blueprints (11 blueprints)
│   │   ├── garden_planner_bp.py            # Garden Season Planner + Garden Snapshot (COMPLEX)
│   │   ├── gardens_bp.py                   # Garden beds CRUD
│   │   ├── seeds_bp.py                     # Seed inventory
│   │   └── ...
│   ├── services/                           # Business logic layer
│   │   ├── space_calculator.py             # Space calculations (CRITICAL)
│   │   ├── garden_planner_service.py       # Succession + quantity logic (COMPLEX)
│   │   ├── rotation_checker.py             # Crop rotation validation
│   │   ├── conflict_service.py             # Spatial/temporal conflicts
│   │   └── ...
│   ├── migrations/                         # Database migrations
│   │   ├── versions/                       # Flask-Migrate (auto-generated)
│   │   └── custom/                         # Custom migration scripts
│   ├── plant_database.py                   # Plant data (MUST SYNC with frontend)
│   ├── sfg_spacing.py                      # SFG lookup table (MUST SYNC)
│   ├── migardener_spacing.py               # MIGardener calculations
│   ├── intensive_spacing.py                # Intensive method calculations
│   └── instance/                           # SQLite database
├── frontend/
│   ├── src/
│   │   ├── App.tsx                         # Main React app + routing
│   │   ├── config.ts                       # API_BASE_URL configuration
│   │   ├── types.ts                        # TypeScript type definitions
│   │   ├── components/                     # React components
│   │   │   ├── GardenPlanner.tsx           # Season planner (COMPLEX)
│   │   │   ├── GardenPlanner/              # Subcomponents (PlanNutritionCard, GardenSnapshot)
│   │   │   ├── PlantingCalendar/           # Calendar views
│   │   │   ├── GardenDesigner/             # Visual bed designer
│   │   │   └── ...
│   │   ├── utils/                          # Utility functions
│   │   │   ├── gardenPlannerSpaceCalculator.ts  # Space calc (CRITICAL, MUST SYNC)
│   │   │   ├── sfgSpacing.ts               # SFG lookup (MUST SYNC)
│   │   │   ├── migardenerSpacing.ts        # MIGardener calculations
│   │   │   └── ...
│   │   └── data/
│   │       └── plantDatabase.ts            # Plant data (MUST SYNC)
│   └── public/
│       ├── plant-icons/                    # Plant icon images
│       └── structure-icons/                # Structure icon images
├── dev/                                    # Development documentation
│   ├── active/                             # Current tasks
│   ├── completed/                          # Finished tasks
│   └── templates/                          # Task templates
└── docs/                                   # Project documentation
```

---

## Uncertainty Notices

**Areas Where Behavior is Unclear** (document if modifying):

1. **Planning Method vs Planting Style**: Incomplete refactoring. Unclear which field takes precedence for space calculations.

2. **Status Fields**: Three status fields (status, completed, quantity_completed) with unclear consistency rules. May need architectural cleanup.

3. **Trellis Capacity**: No database constraints prevent overlapping allocations. Application-level validation exists but may have gaps.

4. **Rotation Algorithm**: 3-year window is simplistic. Ignores intervening crops, cover crops, and intercropping. May produce false positives.

5. **Event Details Schema**: JSON structure not formally defined. Each event_type has different expected keys. No validation layer.

6. **Export Idempotency**: GardenPlanItem has `export_key` field for preventing duplicate exports, but logic may not be fully implemented.

## Default Verification Command

If unsure what to run, default to:
- Backend: `cd backend && python -m pytest`
- Frontend: `cd frontend && npm run build`
- Frontend tests: `cd frontend && CI=true npx react-scripts test --watchAll=false`
- E2E tests: `cd frontend && npx playwright test` (requires both servers running, ~161 tests)
---

## Final Notes

**Conservative Approach**:
- When in doubt, ask the user
- Prefer small, additive changes over large refactors
- Always use planning mode for multi-file changes
- Test edge cases (0, 1, max values)
- Document uncertainties explicitly

**Verification is Mandatory**:
- Test before committing
- Verify synchronization after calculation changes
- Check migration rollback/upgrade
- Review git diff for unintended changes

**This Document is Living**:
- Update when architecture changes
- Add examples of common bugs
- Document new high-risk areas as discovered

---

**Last Updated**: 2026-02-26
