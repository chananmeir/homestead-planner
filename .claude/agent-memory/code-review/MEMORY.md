# Code Review - Agent Memory

## Most Commonly Violated CLAUDE.md Rules

### 1. Falsy checks on nullable fields (HIGH frequency)
- Pattern: `if value:` or `if (value)` on fields where 0 is valid
- Locations to watch: variety override fields (14 total), DTM, spacing_inches, days_to_seed
- Fix: `is not None` (Python), `!= null` (TypeScript)

### 2. Date parsing without helper (MEDIUM frequency)
- Pattern: `datetime.fromisoformat()` on API input (fails on 'Z' suffix)
- Fix: `parse_iso_date()` from `utils.helpers`
- Also: `strptime()` on model date fields without `isinstance(str)` guard

### 3. Hardcoded API URLs (MEDIUM frequency)
- Pattern: `localhost:5000` or `localhost:3000` in frontend fetch calls
- Fix: `API_BASE_URL` from `frontend/src/config.ts`

### 4. Sync file groups modified without counterpart (HIGH impact)
- Space calc (4 files): space_calculator.py, gardenPlannerSpaceCalculator.ts, sfgSpacing.ts, plant_database.py
- Plant database (2 files): plant_database.py, plantDatabase.ts
- SFG lookup (2 files): sfg_spacing.py, sfgSpacing.ts
- MIGardener (2 files): migardener_spacing.py, migardenerSpacing.ts
- Intensive (2 files): intensive_spacing.py, intensiveSpacing.ts

### 5. UUID queries without user_id filter (HIGH impact)
- Fields: succession_group_id, row_group_id
- Risk: data leakage across users

### 6. Event type not checked before plant_id access
- Non-planting events (mulch, fertilizing, irrigation, maple-tapping) have null plant_id
- Always check event_type first

## Anti-Pattern Grep Patterns
```
# Run these to find common violations:
localhost:5000|localhost:3000    # hardcoded URLs
datetime.fromisoformat          # unsafe date parsing
if self\.\w+:                   # falsy checks on model attributes
// @ts-ignore|as any            # type suppression
json\.loads\(                   # JSON parsing without try-except
```

## Files Most Prone to Issues
- `backend/services/garden_planner_service.py`: most complex, succession logic
- `backend/blueprints/gardens_bp.py`: largest blueprint, many endpoints
- `frontend/src/components/GardenDesigner.tsx`: 3500+ lines, complex state
- `frontend/src/types.ts`: type definitions must match backend to_dict()
- `backend/models.py`: 54+ models, to_dict() methods must return camelCase
