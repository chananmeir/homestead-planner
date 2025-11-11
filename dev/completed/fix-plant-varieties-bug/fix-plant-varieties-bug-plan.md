# Fix PLANT_VARIETIES Undefined Variable Bug

**Status**: Active
**Priority**: Critical
**Created**: 2025-11-11
**Estimated Time**: 15 minutes

## Problem Statement

The backend `app.py` file references `PLANT_VARIETIES` on line 298, but this variable is not defined anywhere in the codebase. This will cause a NameError when users try to access the planting calendar route.

## Root Cause

In the planting calendar route (`/planting-calendar`), the code attempts to pass `plant_varieties=PLANT_VARIETIES` to the template, but:
1. PLANT_VARIETIES is never imported from any module
2. PLANT_VARIETIES is never defined in plant_database.py
3. This appears to be a legacy reference that was never implemented

## Affected Code

**File**: `backend/app.py`
**Line**: 298

```python
@app.route('/planting-calendar')
def planting_calendar():
    """Planting calendar page"""
    events = PlantingEvent.query.order_by(PlantingEvent.seed_start_date).all()
    last_frost = Settings.get_setting('last_frost_date', '2024-04-15')
    first_frost = Settings.get_setting('first_frost_date', '2024-10-15')
    return render_template('planting_calendar.html',
                         events=events,
                         plants=PLANT_DATABASE,
                         plant_varieties=PLANT_VARIETIES,  # <-- UNDEFINED
                         last_frost_date=last_frost,
                         first_frost_date=first_frost)
```

## Solution

### Option 1: Remove the Reference (RECOMMENDED)
Since the variety information is already stored in the PlantingEvent model's `variety` field, and there's no corresponding data structure, we should simply remove this parameter.

### Option 2: Create Empty Dictionary
Pass an empty dictionary as a placeholder for future implementation.

### Option 3: Build from Plant Database
Create a PLANT_VARIETIES dictionary based on the PLANT_DATABASE structure.

**Decision**: Go with Option 1 - Remove the reference entirely. The variety field in PlantingEvent is sufficient for now.

## Implementation Steps

1. Remove the `plant_varieties=PLANT_VARIETIES` parameter from line 298
2. Verify no template is using this variable (check planting_calendar.html)
3. Test the backend starts without errors
4. Document this change

## Testing

- [ ] Backend starts without errors
- [ ] Planting calendar route loads successfully
- [ ] No NameError exceptions

## Acceptance Criteria

- Backend app.py imports successfully
- Planting calendar route works
- No undefined variable errors

---

**Last Updated**: 2025-11-11
