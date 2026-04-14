# Nutrition Data Import & Plant ID Matching Fix

## Summary

Successfully resolved the "Nutrition estimates unavailable" issue in the Garden Season Planner.

**Problem:** Garden plan items use variety-suffixed plant IDs (e.g., `beet-1`, `lettuce-1`), but the nutrition database uses base plant IDs (e.g., `beet`, `lettuce`), causing lookup failures.

**Solution:** Modified `NutritionalService.get_nutritional_data()` to automatically extract base plant IDs before database lookup.

---

## Import Status

✅ **Baseline nutrition data already imported**

The import script detected 30 existing entries and skipped them:
- All 30 baseline crops present in database
- Global data (user_id = NULL) available to all users
- USDA-verified nutritional values and yield estimates

Sample crops verified:
- Tomato: 18 cal, 0.9g protein, 10 lbs/plant
- Lettuce: 15 cal, 1.4g protein, 1 lbs/plant
- Carrot: 41 cal, 0.9g protein, 1.5 lbs/plant
- Broccoli: 34 cal, 2.8g protein, 1.5 lbs/plant
- Cucumber: 15 cal, 0.7g protein, 5 lbs/plant

---

## Technical Fix

### File Modified
`backend/services/nutritional_service.py`

### Changes Made

**1. Added `_extract_base_plant_id()` helper method**
```python
def _extract_base_plant_id(self, plant_id: str) -> str:
    """
    Extract base plant ID from variety-suffixed plant ID

    Examples:
        'tomato-1' -> 'tomato'
        'lettuce-3' -> 'lettuce'
        'pepper-bell-2' -> 'pepper-bell'
        'tomato' -> 'tomato'
    """
    import re
    match = re.match(r'^(.+)-(\d+)$', plant_id)
    if match:
        return match.group(1)
    return plant_id
```

**2. Updated `get_nutritional_data()` to use base ID**
- Calls `_extract_base_plant_id()` before database lookup
- Strips variety suffixes like `-1`, `-2`, etc.
- Preserves compound IDs like `pepper-bell`

### Test Results

All variety-suffixed IDs now resolve correctly:
```
✓ beet-1 → base: beet → Found: Beet (raw) (43 cal)
✓ lettuce-1 → base: lettuce → Found: Lettuce (leaf green raw) (15 cal)
✓ tomato-5 → base: tomato → Found: Tomato (raw) (18 cal)
✓ pepper-bell-2 → base: pepper-bell → Found: Bell Pepper (raw) (31 cal)
✓ carrot → base: carrot → Found: Carrot (raw) (41 cal)
```

### Verified Calculation

Test garden plan nutrition calculation:
```
Beet (12 plants × 1x succession):
  → 24 lbs → 4,681 cal, 174g protein

Lettuce (50 plants × 4x succession):
  → 200 lbs → 13,608 cal, 1,270g protein

TOTAL: 224 lbs
  → 18,289 calories (9.1 person-days)
  → 1,444g protein (28.9 person-days)
```

---

## Testing Instructions

### 1. Restart Backend Server

The Python code change requires a server restart:

```bash
# Stop current backend (Ctrl+C in terminal)

# Restart backend
cd backend
venv\Scripts\activate
python app.py
```

### 2. Test in Application

1. **Open app:** Navigate to `http://localhost:3000`
2. **Go to Garden Season Planner**
3. **Open existing plan or create new one:**
   - Beet (any variety) - 12 plants, 1x succession
   - Lettuce (any variety) - 50 plants, 4x succession
4. **View plan detail** (click on plan name)
5. **Scroll to "Estimated Nutrition Output" card**

**Expected Results:**
- ✅ No "missing data" warning
- ✅ Shows calorie and protein person-days summary
- ✅ Expand button works
- ✅ Expanded view shows:
  - 4 summary cards (Calories, Protein, Carbs, Fat)
  - Per-crop breakdown table
  - Yield calculations
  - Nutritional contributions

### 3. Verify API Directly (Optional)

Test the nutrition endpoint via browser (requires login):
```
http://localhost:5000/api/garden-plans/1/nutrition
```

Expected: JSON with `totals`, `by_plant`, and `missing_data` (should be empty array).

---

## What's Included

**30 Baseline Crops:**

| Category | Crops |
|----------|-------|
| Vegetables | Tomato, Lettuce, Carrot, Broccoli, Cucumber, Bell Pepper, Zucchini, Spinach, Kale, Cabbage, Cauliflower, Eggplant, Sweet Corn, Beet, Radish |
| Legumes | Bush Bean, Pole Bean, Garden Pea |
| Root Crops | Potato, Sweet Potato, Onion, Garlic |
| Squash | Winter Squash, Summer Squash, Cantaloupe, Watermelon |
| Herbs | Basil, Parsley, Cilantro |
| Berries | Strawberry |

**Data Per Crop:**
- Nutritional values per 100g (11 nutrients)
- Yield estimates (lbs/plant, lbs/sqft)
- USDA FoodData Central ID for verification

---

## Architecture

The fix ensures all nutrition lookups work correctly:

1. **Garden Season Planner** → calls `/api/garden-plans/<id>/nutrition`
2. **Endpoint** → calls `NutritionalService.get_nutritional_data(item.plant_id)`
3. **Service** → extracts base ID → queries database
4. **Database** → returns nutrition data for base plant ID

This fix automatically handles:
- ✅ Variety-suffixed IDs (`tomato-1`, `lettuce-3`)
- ✅ Compound base IDs (`pepper-bell`, `bean-bush`)
- ✅ Plain IDs (`tomato`, `carrot`)

---

## Related Files

**No changes needed** (feature already implemented):
- `frontend/src/components/GardenPlanner/PlanNutritionCard.tsx` - UI component
- `frontend/src/types.ts` - TypeScript types
- `frontend/src/components/GardenPlanner.tsx` - integration
- `backend/blueprints/garden_planner_bp.py` - nutrition endpoint
- `backend/blueprints/nutrition_bp.py` - nutrition blueprint

**Data files:**
- `backend/data/baseline_nutrition.csv` - 30 crops (already imported)
- `backend/migrations/custom/data/import_baseline_nutrition.py` - import script

**Modified:**
- `backend/services/nutritional_service.py` - added base ID extraction

---

## Troubleshooting

**If nutrition card still shows "missing data" after restart:**

1. **Check plant IDs in plan:**
   ```python
   cd backend && python -c "
   import sqlite3
   conn = sqlite3.connect('instance/homestead.db')
   cursor = conn.cursor()
   cursor.execute('SELECT plant_id FROM garden_plan_item')
   print([row[0] for row in cursor.fetchall()])
   "
   ```

2. **Verify nutrition data:**
   ```python
   cd backend && python -c "
   import sqlite3
   conn = sqlite3.connect('instance/homestead.db')
   cursor = conn.cursor()
   cursor.execute('SELECT source_id FROM nutritional_data WHERE user_id IS NULL')
   print([row[0] for row in cursor.fetchall()])
   "
   ```

3. **Test matching:**
   ```python
   cd backend && python -c "
   from services.nutritional_service import NutritionalService
   service = NutritionalService()
   result = service.get_nutritional_data('beet-1', user_id=None)
   print('Found!' if result else 'Not found')
   print(result)
   "
   ```

**If backend won't start:**
- Check for syntax errors in `nutritional_service.py`
- Verify virtual environment is activated
- Check port 5000 isn't already in use

---

## Next Steps

1. **Restart backend server** (required for fix to take effect)
2. **Test nutrition feature** in Garden Season Planner
3. **Verify calculations** match expected values
4. **User can now:**
   - View nutrition estimates for garden plans
   - See person-days calculations
   - Understand nutritional contribution of each crop
   - Make informed planting decisions based on nutrition goals

---

**Status:** ✅ Complete and tested
**Date:** 2026-01-26
**Impact:** All garden plans with imported crops now show nutrition data
