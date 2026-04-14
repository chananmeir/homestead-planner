# Nutrition Pipeline Unification - Tasks

## Status Legend
- [ ] Not started
- [~] In progress
- [x] Complete

---

## Phase 1: Backend Service Enhancement

### Task 1.1: Add `estimate_nutrition_from_items()` to NutritionalService
- [ ] Open `backend/services/nutritional_service.py`
- [ ] Add new method `estimate_nutrition_from_items(items, user_id)` after line 795
- [ ] Accept both snake_case and camelCase input keys (plantId/plant_id)
- [ ] Return camelCase output for frontend compatibility
- [ ] Handle missing nutrition data gracefully (add to missingNutritionData list)

**File**: `backend/services/nutritional_service.py`
**After line**: 795

### Task 1.2: Add `POST /api/nutrition/estimate` endpoint
- [ ] Open `backend/blueprints/nutrition_bp.py`
- [ ] Add new route after line 491
- [ ] Accept JSON body with `items` array and optional `year`
- [ ] Call `NutritionalService.estimate_nutrition_from_items()`
- [ ] Return standardized response

**File**: `backend/blueprints/nutrition_bp.py`
**After line**: 491

### Task 1.3: Write backend unit test
- [ ] Create or update `backend/tests/test_nutrition_estimate.py`
- [ ] Test with known inputs, verify calorie/protein calculations
- [ ] Test missing plant handling
- [ ] Test succession count multiplication

---

## Phase 2: Frontend GardenPlanner Integration

### Task 2.1: Remove hardcoded nutrition data
- [ ] Open `frontend/src/components/GardenPlanner.tsx`
- [ ] Remove or comment out `NUTRITION_ALIASES` (lines 819-823)
- [ ] Remove or comment out `nutritionData` object (lines 827-852)
- [ ] Remove or comment out inline calculation useEffect (lines 854-893)

**File**: `frontend/src/components/GardenPlanner.tsx`
**Lines to modify**: 800-893

### Task 2.2: Add API fetch for nutrition estimate
- [ ] Create debounced API call function `fetchNutritionEstimate()`
- [ ] Call `POST /api/nutrition/estimate` with items array
- [ ] Transform `manualQuantities` + `perSeedSuccession` to request format
- [ ] Update `setNutritionEstimates` with response

**File**: `frontend/src/components/GardenPlanner.tsx`

### Task 2.3: Handle loading and error states
- [ ] Add loading state while fetching nutrition
- [ ] Handle API errors gracefully
- [ ] Show "Calculating..." indicator during fetch

---

## Phase 3: Refactor Plan Detail Nutrition Endpoint

### Task 3.1: Update `api_plan_nutrition()` to use shared service
- [ ] Open `backend/blueprints/garden_planner_bp.py`
- [ ] Modify `/garden-plans/<id>/nutrition` handler (lines 430-516)
- [ ] Convert plan.items to items array format
- [ ] Call `NutritionalService.estimate_nutrition_from_items()`
- [ ] Return response in same format as before for backwards compatibility

**File**: `backend/blueprints/garden_planner_bp.py`
**Lines to modify**: 430-516

### Task 3.2: Verify PlanNutritionCard still works
- [ ] Test with existing saved plan
- [ ] Verify totals display correctly
- [ ] Verify per-crop breakdown displays
- [ ] Verify missing_data warning shows

---

## Phase 4: Add Missing Baseline Nutrition Data

### Task 4.1: Identify missing crops
- [ ] Query `nutritional_data` table for existing entries
- [ ] Compare against commonly used plants in seed inventory
- [ ] List crops showing in "missing nutrition data" warnings

**Known missing**:
- bok-choy
- arugula
- swiss-chard
- collards
- turnip
- rutabaga
- kohlrabi

### Task 4.2: Research and add nutrition data
- [ ] Use USDA FoodData Central to find nutrition values
- [ ] Estimate average yields from gardening resources
- [ ] Add entries to `backend/data/baseline_nutrition.csv`

### Task 4.3: Re-run baseline import
- [ ] Run `python migrations/custom/data/import_baseline_nutrition.py`
- [ ] Verify new entries added to database
- [ ] Test that previously missing crops now show estimates

---

## Phase 5: Testing and Verification

### Task 5.1: End-to-end test: Wizard nutrition
- [ ] Open Garden Season Planner
- [ ] Select seeds with known nutrition data
- [ ] Enter quantities and succession preferences
- [ ] Verify nutrition estimates display in wizard

### Task 5.2: End-to-end test: Plan detail nutrition
- [ ] Save plan from wizard
- [ ] View plan detail page
- [ ] Expand PlanNutritionCard
- [ ] Verify totals match wizard estimates

### Task 5.3: Test missing data handling
- [ ] Add a seed with unknown plant ID
- [ ] Verify it appears in "missing nutrition data" list
- [ ] Verify it doesn't break total calculation

### Task 5.4: Test succession handling
- [ ] Plan with 40 lettuce, succession=4
- [ ] Verify yield = 40 * 1.0 lb * 4 = 160 lbs
- [ ] Verify calories reflect full succession yield

---

## Optional Enhancements (Future)

### Task O.1: Add variety-specific nutrition overrides
- [ ] Allow seeds to override base plant nutrition
- [ ] Support user-specific nutrition data per USDA import

### Task O.2: Integrate with NutritionalDashboard
- [ ] Add "Planned" category to dashboard
- [ ] Show planned vs actual comparison after harvest

### Task O.3: Add micro-nutrients to wizard display
- [ ] Currently wizard only shows calories/protein
- [ ] Add vitamins and minerals summary card

---

## Implementation Notes

### API Contract (Request)
```json
POST /api/nutrition/estimate
{
  "items": [
    {"plantId": "tomato", "quantity": 20, "successionCount": 4}
  ],
  "year": 2026
}
```

### API Contract (Response)
```json
{
  "totals": {
    "calories": 12500,
    "proteinG": 450,
    "carbsG": 2800,
    "fatG": 120
  },
  "byPlant": [
    {
      "plantId": "tomato",
      "plantName": "Tomato",
      "quantity": 20,
      "successionCount": 4,
      "yieldLbs": 200,
      "calories": 8000,
      "proteinG": 180
    }
  ],
  "missingNutritionData": ["bok-choy-1"],
  "year": 2026
}
```

### Key Files
- Backend service: `backend/services/nutritional_service.py`
- Backend endpoint: `backend/blueprints/nutrition_bp.py`
- Plan endpoint: `backend/blueprints/garden_planner_bp.py`
- Frontend wizard: `frontend/src/components/GardenPlanner.tsx`
- Frontend detail: `frontend/src/components/GardenPlanner/PlanNutritionCard.tsx`
- Baseline data: `backend/data/baseline_nutrition.csv`
