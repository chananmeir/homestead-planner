# Garden Season Planner - Nutrition Display Implementation

## Summary

Successfully implemented expected nutritional output display for Garden Season Planner, allowing users to see estimated calories, protein, and other nutrients their plan will produce before planting.

**Implementation Date:** 2026-01-26

## Changes Made

### Backend

**File:** `backend/blueprints/garden_planner_bp.py`

- **Added:** New endpoint `GET /api/garden-plans/<int:plan_id>/nutrition` (lines 365-454)
- **Functionality:**
  - Fetches nutrition data for each plant in the plan using `NutritionalService`
  - Calculates total yield: `plant_equivalent × average_yield_lbs_per_plant × succession_count`
  - Converts yield (lbs) to grams and calculates nutrition values
  - Aggregates totals and per-plant breakdowns
  - Returns: totals, by_plant data, missing_data list, and year

### Frontend - Types

**File:** `frontend/src/types.ts`

- **Added:** Three new interfaces (lines 564-604):
  - `PlanNutritionData` - API response structure
  - `PlantNutritionBreakdown` - Per-crop nutrition details
  - `NutritionTotals` - Aggregated nutrition totals

### Frontend - Component

**File:** `frontend/src/components/GardenPlanner/PlanNutritionCard.tsx` (NEW)

- **Created:** New collapsible nutrition card component (250 lines)
- **Features:**
  - Loading state with spinner
  - Empty state when no nutrition data available
  - Collapsed view: Summary with calories and protein person-days
  - Expanded view:
    - 4 summary cards (Calories, Protein, Carbs, Fat) with person-days calculations
    - Per-crop breakdown table showing quantity, succession, yield, and nutrition
    - Warning for crops missing nutrition data
    - Disclaimer about planning estimates vs. actual yields
  - Error handling with toast notifications

### Frontend - Integration

**File:** `frontend/src/components/GardenPlanner.tsx`

- **Line 18:** Added import for `PlanNutritionCard`
- **Lines 2207-2210:** Integrated component into plan detail view (after table)

## Data Flow

```
User views plan detail
        ↓
PlanNutritionCard loads
        ↓
API: GET /api/garden-plans/{id}/nutrition
        ↓
Backend (garden_planner_bp.py):
  - For each GardenPlanItem:
    1. Get nutritional_data (plant_id)
    2. Calculate yield: plant_equivalent × yield_per_plant × succession_count
    3. Convert lbs → grams → nutrition (per 100g basis)
    4. Aggregate into totals
        ↓
Return: { totals, by_plant, missing_data, year }
        ↓
Frontend: Render collapsible card
  - Collapsed: Summary (calories/protein person-days)
  - Expanded: Full breakdown with table
```

## Calculation Example

**Plan Item:**
- Plant: Lettuce (Heirloom Bronze Arrowhead)
- Plant Equivalent: 50
- Succession Count: 4x

**Nutrition Data:**
- Lettuce: 0.5 lbs/plant, 15 cal/100g, 1.4g protein/100g

**Calculation:**
1. Yield per planting: 50 plants × 0.5 lbs/plant = 25 lbs
2. Total yield: 25 lbs × 4 succession = 100 lbs
3. Convert to grams: 100 lbs × 453.592 = 45,359 grams
4. Nutrition multiplier: 45,359 / 100 = 453.59
5. Total calories: 15 cal × 453.59 = 6,804 calories
6. Total protein: 1.4g × 453.59 = 635g protein

## Key Features

1. **Reuses Existing Infrastructure:**
   - Leverages `NutritionalService` from `backend/services/nutritional_service.py`
   - Uses existing `nutritional_data` table with USDA data

2. **Person-Days Context:**
   - Displays person-days for major macros (calories, protein, carbs, fat)
   - Uses USDA RDA: 2000 cal, 50g protein, 300g carbs, 65g fat
   - Helps users understand scale (e.g., "63 person-days of calories")

3. **Progressive Disclosure:**
   - Collapsed by default (shows summary only)
   - Expands to show detailed breakdown
   - Reduces visual clutter

4. **Handles Edge Cases:**
   - Missing nutrition data (shows warning)
   - Empty plans (shows empty state)
   - API errors (shows error toast)
   - Loading states (shows spinner)

5. **Planning vs. Actual:**
   - Clear disclaimer: planning estimates only
   - Links to Nutritional Dashboard for actual harvest tracking
   - Notes that yields vary by climate/soil/practices

## Verification Steps

### Backend Test

```bash
# Test the nutrition endpoint
curl -X GET http://localhost:5000/api/garden-plans/1/nutrition \
  --cookie "session=..." \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "totals": {
    "calories": 12000,
    "protein_g": 450,
    "carbs_g": 2500,
    "fat_g": 80,
    ...
  },
  "by_plant": {
    "lettuce": {
      "name": "Lettuce",
      "variety": "Heirloom Bronze Arrowhead",
      "plant_equivalent": 50,
      "succession_count": 4,
      "total_yield_lbs": 100,
      "calories": 6804,
      "protein_g": 635,
      ...
    }
  },
  "missing_data": [],
  "year": 2026
}
```

### Frontend Test

1. **Create Test Plan:**
   - Add Formanova (12 plants, 1x succession)
   - Add Heirloom Bronze Arrowhead Lettuce (50 plants, 4x succession)
   - Save and view plan detail

2. **Verify Collapsed State:**
   - Nutrition card appears below plan table
   - Shows "Estimated Nutrition Output" header
   - Displays summary: calories and protein with person-days
   - Shows "Expand to see full breakdown" button

3. **Verify Expanded State:**
   - Click to expand
   - Verify 4 summary cards show correct totals
   - Check per-crop table:
     - Formanova: 12 qty, 1x succession
     - Lettuce: 50 qty, 4x succession
     - Yield, calories, protein match expected calculations
   - Disclaimer displays at bottom

4. **Test Edge Cases:**
   - Empty plan (no items) → Shows empty state
   - Plan with crops missing nutrition data → Shows warning section
   - Network error → Shows error toast

### Calculation Verification

Manual calculation for validation:
- 12 tomatoes @ 10 lbs/plant × 1x = 120 lbs
- Backend should convert: 120 lbs → 54,431g → nutrition values
- With 4x succession: multiply by 4

## Files Modified/Created

### Backend (1 file)
- `backend/blueprints/garden_planner_bp.py` (+90 lines)

### Frontend (3 files)
- `frontend/src/types.ts` (+41 lines)
- `frontend/src/components/GardenPlanner/PlanNutritionCard.tsx` (+250 lines, NEW)
- `frontend/src/components/GardenPlanner.tsx` (+5 lines)

**Total:** 4 files, ~386 lines of code

## Dependencies

### Backend
- `services.nutritional_service.NutritionalService` (existing)
- `models.GardenPlan` (existing)
- `flask_login.login_required` (existing)

### Frontend
- `components/common/Toast` (existing)
- `config.API_BASE_URL` (existing)
- React hooks: `useState`, `useEffect` (standard)

## Future Enhancements

1. **Micronutrient Details:**
   - Add vitamins (A, C, K, E) and minerals (calcium, iron, potassium)
   - Visual bar charts for RDA percentages

2. **Export/Print:**
   - PDF export of nutrition estimates
   - CSV download for spreadsheet analysis

3. **Comparison Mode:**
   - Compare multiple plans side-by-side
   - "Plan A vs Plan B" nutrition comparison

4. **Nutrition Goals:**
   - Set household nutrition goals (# of people, dietary needs)
   - Show progress toward meeting annual goals

5. **Per-Season Breakdown:**
   - Show spring/summer/fall/winter nutrition output
   - Identify nutritional gaps by season

## Testing Status

- ✅ Backend endpoint implemented
- ✅ TypeScript types defined
- ✅ Component created with all features
- ✅ Integrated into GardenPlanner
- ⏳ Manual testing pending (backend/frontend servers need to be running)
- ⏳ Calculation verification pending

## Notes

- **Reuses proven infrastructure:** No duplication of nutritional_service.py logic
- **MVP first approach:** Focused on core functionality (summary + table)
- **Performance:** Single API call per plan view, efficient calculation
- **User experience:** Progressive disclosure, clear context with person-days
- **Risk level:** Low (reusing existing, tested services)

---

**Status:** Implementation complete, ready for testing
**Last Updated:** 2026-01-26
