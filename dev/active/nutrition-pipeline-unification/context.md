# Nutrition Pipeline Unification - Context

## Problem Statement

The user identified THREE separate nutrition calculation paths producing inconsistent results:

1. **GardenPlanner.tsx (Wizard Mode)** - Client-side inline calculation
2. **PlanNutritionCard.tsx (Plan Detail Page)** - Backend API call to `/api/garden-plans/<id>/nutrition`
3. **NutritionalDashboard.tsx** - Backend API call to `/api/nutrition/dashboard`

## Current Implementation Analysis

### 1. GardenPlanner.tsx (Wizard/Create Mode) - Lines 800-893

**Location**: `frontend/src/components/GardenPlanner.tsx`
**Data Source**: Hardcoded inline `nutritionData` object (lines 827-852)
**Calculation Method**: Client-side JavaScript in a `useEffect` hook

**Key Characteristics**:
- Uses a **simplified subset** of only ~22 crops
- Hardcoded `yieldPerPlant` values (not synced with backend database)
- Calculates: `quantity * yieldPerPlant * 453.592g/lb * (nutrition/100g)`
- Includes alias handling: `NUTRITION_ALIASES` maps variants to canonical keys
- Stores results in `nutritionEstimates` state

**Problems Identified**:
- **Incomplete coverage**: Only 22 crops in the hardcoded map vs 32+ in backend `baseline_nutrition.csv`
- **Missing data warning**: Shows "missing nutrition data" for Beet, Pea, Pumpkin, Bean, Potato, bok-choy-1
- **Data drift**: Hardcoded values may not match backend `nutritional_data` table
- **No succession handling**: Uses raw `manualQuantities` without considering succession count

**Hardcoded Crops** (lines 827-852):
```javascript
const nutritionData = {
  'tomato': { calories: 18, protein: 0.9, yieldPerPlant: 10.0 },
  'lettuce': { calories: 15, protein: 1.4, yieldPerPlant: 1.0 },
  'carrot': { calories: 41, protein: 0.9, yieldPerPlant: 1.5 },
  // ... 19 more crops
  'chia-1': { calories: 486, protein: 16.5, yieldPerPlant: 0.1 },
};
```

---

### 2. PlanNutritionCard.tsx (Plan Detail Page)

**Location**: `frontend/src/components/GardenPlanner/PlanNutritionCard.tsx`
**API Endpoint**: `GET /api/garden-plans/<plan_id>/nutrition`
**Backend Handler**: `backend/blueprints/garden_planner_bp.py::api_plan_nutrition()` (lines 430-516)

**Key Characteristics**:
- Fetches from **backend database** `nutritional_data` table
- Uses `NutritionalService.get_nutritional_data(plant_id, user_id)` for each plan item
- Calculates: `plant_equivalent * yield_per_plant * succession_count`
- Returns detailed breakdown per plant including variety, succession, and yield

**Backend Logic** (lines 467-505):
```python
for item in plan.items:
    nutrition_data = nutrition_service.get_nutritional_data(item.plant_id, current_user.id)
    yield_per_plant = nutrition_data.get('average_yield_lbs_per_plant', 0)
    total_yield = item.plant_equivalent * yield_per_plant * (item.succession_count or 1)
    # ... calculate macros and micros
```

**Problems Identified**:
- **Relies on saved plan data**: Only works for plans with `items` persisted to database
- **Cannot estimate during wizard**: Not available before plan is saved
- **Missing plant IDs**: If `plant_id` not in `nutritional_data` table, it's listed in `missing_data`

---

### 3. NutritionalDashboard.tsx

**Location**: `frontend/src/components/NutritionalDashboard.tsx`
**API Endpoint**: `GET /api/nutrition/dashboard?year=<year>`
**Backend Handler**: `backend/blueprints/nutrition_bp.py::get_nutrition_dashboard()` (lines 26-48)
**Backend Service**: `backend/services/nutritional_service.py::calculate_total_nutrition()` (lines 747-795)

**Key Characteristics**:
- Calculates nutrition from **PlantingEvent** table (exported crops, not plan items)
- Aggregates Garden + Livestock + Trees
- Garden calculation uses `calculate_garden_nutrition()` (lines 201-331)
- Livestock uses `calculate_livestock_nutrition()` with breed-specific production rates (lines 333-593)

**Garden Nutrition Calculation** (lines 254-328):
```python
for event in planting_events:  # From planting_event table
    plant_id = event.get('plant_id')
    nutrition_data = self.get_nutritional_data(plant_id, user_id)
    yield_lbs = self.estimate_plant_yield(plant_id, event, nutrition_data)
    # ... calculate and aggregate
```

**Problems Identified**:
- **Shows 0 for Garden**: If plan not exported to PlantingEvent table, garden shows 0
- **Livestock "annualized"**: Calculates annual production (e.g., chickens -> eggs/year)
- **Different data source**: Uses PlantingEvent, not GardenPlanItem

---

## Authoritative Nutrition Data Source

**Database Table**: `nutritional_data`
**Schema Location**: `backend/migrations/custom/schema/add_nutritional_data_table.py`
**Baseline Data**: `backend/data/baseline_nutrition.csv` (32 crops)

**Table Schema**:
```
id, source_type, source_id, name, usda_fdc_id,
calories, protein_g, carbs_g, fat_g, fiber_g,
vitamin_a_iu, vitamin_c_mg, vitamin_k_mcg, vitamin_e_mg, folate_mcg,
calcium_mg, iron_mg, magnesium_mg, potassium_mg, zinc_mg,
average_yield_lbs_per_plant, average_yield_lbs_per_sqft, average_yield_lbs_per_tree_year,
data_source, notes, last_updated, user_id
```

**Baseline Coverage** (32 entries):
```
tomato, lettuce, carrot, broccoli, cucumber, pepper-bell, zucchini, spinach,
kale, bean-bush, bean-pole, pea, radish, beet, onion, garlic, potato,
sweet-potato, squash-winter, squash-summer, cabbage, cauliflower, eggplant,
corn, melon-cantaloupe, watermelon, strawberry, basil, parsley, cilantro, chia-1
```

**Missing from GardenPlanner hardcoded map**:
- cauliflower
- melon-cantaloupe
- watermelon
- strawberry
- basil
- parsley
- cilantro
- squash-summer (duplicated with zucchini)

---

## Inconsistency Matrix

| Feature | GardenPlanner (Wizard) | PlanNutritionCard | NutritionalDashboard |
|---------|----------------------|-------------------|---------------------|
| Data Source | Hardcoded JS object | `nutritional_data` table | `nutritional_data` table |
| Crops Covered | 22 | 32+ | 32+ |
| Succession Handled | No | Yes | Yes |
| When Available | During wizard | After plan saved | After export to calendar |
| Yield Source | Hardcoded | DB `average_yield_lbs_per_plant` | DB + planting method aware |

---

## Key Files Reference

### Frontend
- `frontend/src/components/GardenPlanner.tsx` - Lines 800-893 (inline nutrition calc)
- `frontend/src/components/GardenPlanner/PlanNutritionCard.tsx` - Plan detail nutrition
- `frontend/src/components/NutritionalDashboard.tsx` - Overall homestead nutrition
- `frontend/src/types.ts` - Lines 575-615 (PlanNutritionData, NutritionTotals)

### Backend
- `backend/blueprints/garden_planner_bp.py` - Lines 430-516 (plan nutrition endpoint)
- `backend/blueprints/nutrition_bp.py` - Dashboard and CRUD endpoints
- `backend/services/nutritional_service.py` - Core nutrition calculation service
- `backend/data/baseline_nutrition.csv` - Authoritative nutrition data

### Database
- `nutritional_data` table - Per-crop nutrition and yield data
- `planting_event` table - Exported events (for dashboard calculation)
- `garden_plan_item` table - Saved plan items (for plan nutrition)
