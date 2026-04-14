# Nutrition Pipeline Unification - Implementation Plan

## Objective

Create a single backend service endpoint that can be used for nutrition estimation in both:
1. **GardenPlanner.tsx wizard** - During planning, before plan is saved
2. **PlanNutritionCard.tsx** - After plan is saved (plan detail view)

## Proposed Solution

### Phase 1: Create Unified Backend Endpoint

**New Endpoint**: `POST /api/nutrition/estimate`

This endpoint accepts a list of crops with quantities (either from wizard state OR from saved plan) and returns standardized nutrition estimates.

**Request Schema**:
```json
{
  "items": [
    {
      "plantId": "tomato",
      "quantity": 20,
      "successionCount": 4
    },
    {
      "plantId": "lettuce",
      "quantity": 40,
      "successionCount": 4
    }
  ],
  "year": 2026
}
```

**Response Schema**:
```json
{
  "totals": {
    "calories": 12500,
    "protein_g": 450,
    "carbs_g": 2800,
    "fat_g": 120,
    "fiber_g": 340,
    "vitamin_a_iu": 25000,
    "vitamin_c_mg": 1200,
    "vitamin_k_mcg": 800,
    "calcium_mg": 450,
    "iron_mg": 35,
    "potassium_mg": 4500
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

### Phase 2: Modify GardenPlanner.tsx

**Remove**:
- Hardcoded `nutritionData` object (lines 827-852)
- Inline nutrition calculation `useEffect` (lines 800-893)

**Add**:
- API call to `POST /api/nutrition/estimate` when `manualQuantities` changes
- Debounced fetch to prevent excessive API calls during typing

**Integration Point**:
```typescript
useEffect(() => {
  if (manualQuantities.size === 0) {
    setNutritionEstimates(null);
    return;
  }

  const items = Array.from(manualQuantities.entries())
    .filter(([seedId, qty]) => qty > 0)
    .map(([seedId, qty]) => {
      const seed = seedInventory.find(s => s.id === seedId);
      const successionPref = perSeedSuccession.get(seedId) || DEFAULT_SUCCESSION;
      return {
        plantId: seed?.plantId,
        quantity: qty,
        successionCount: parseInt(successionPref) || 1
      };
    });

  fetchNutritionEstimate(items).then(setNutritionEstimates);
}, [manualQuantities, perSeedSuccession]);
```

### Phase 3: Refactor PlanNutritionCard.tsx

**Current**: Calls `GET /api/garden-plans/<id>/nutrition`

**New**: Keep existing endpoint but refactor backend to use shared calculation logic.

**Backend Refactor** in `garden_planner_bp.py`:
```python
@garden_planner_bp.route('/garden-plans/<int:plan_id>/nutrition', methods=['GET'])
def api_plan_nutrition(plan_id):
    plan = GardenPlan.query.get(plan_id)
    # ... validation ...

    # Convert plan items to estimation request format
    items = [{
        'plant_id': item.plant_id,
        'quantity': item.plant_equivalent,
        'succession_count': item.succession_count or 1
    } for item in plan.items]

    # Use shared estimation service
    from services.nutritional_service import NutritionalService
    service = NutritionalService()
    return jsonify(service.estimate_nutrition(items, current_user.id, plan.year))
```

### Phase 4: Add Missing Crops to Baseline Data

Update `backend/data/baseline_nutrition.csv` to add any missing crops that exist in the plant database but lack nutrition data.

**Priority additions**:
- bok-choy
- arugula
- swiss-chard
- Any other commonly used crops showing in "missing data" warnings

---

## API Design Details

### New Endpoint: `POST /api/nutrition/estimate`

**File**: `backend/blueprints/nutrition_bp.py`

```python
@nutrition_bp.route('/estimate', methods=['POST'])
@login_required
def estimate_nutrition():
    """
    Estimate nutritional output for a list of crops with quantities

    Use cases:
    - GardenPlanner wizard (pre-save estimation)
    - Plan detail page (post-save, converts plan items to request format)

    Request:
        {
            "items": [
                {"plantId": "tomato", "quantity": 20, "successionCount": 4}
            ],
            "year": 2026
        }

    Response:
        {
            "totals": { calories, protein_g, ... },
            "byPlant": [ { plantId, plantName, yieldLbs, calories, ... } ],
            "missingNutritionData": ["bok-choy-1"],
            "year": 2026
        }
    """
    data = request.json
    items = data.get('items', [])
    year = data.get('year', datetime.now().year)

    service = NutritionalService()
    result = service.estimate_nutrition_from_items(items, current_user.id)
    result['year'] = year

    return jsonify(result), 200
```

### New Service Method: `estimate_nutrition_from_items()`

**File**: `backend/services/nutritional_service.py`

```python
def estimate_nutrition_from_items(self, items: List[Dict], user_id: int) -> Dict:
    """
    Calculate nutrition estimates from a list of items

    Args:
        items: List of dicts with plantId, quantity, successionCount
        user_id: For user-specific nutrition overrides

    Returns:
        Dictionary with totals, byPlant breakdown, and missingNutritionData
    """
    totals = {key: 0 for key in NUTRITION_KEYS}
    by_plant = []
    missing_data = []

    for item in items:
        plant_id = item.get('plantId') or item.get('plant_id')
        quantity = item.get('quantity', 0)
        succession_count = item.get('successionCount') or item.get('succession_count') or 1

        nutrition_data = self.get_nutritional_data(plant_id, user_id)

        if not nutrition_data:
            missing_data.append(plant_id)
            continue

        yield_per_plant = nutrition_data.get('average_yield_lbs_per_plant', 0)
        if not yield_per_plant:
            missing_data.append(plant_id)
            continue

        # Calculate total yield considering succession
        total_yield_lbs = quantity * yield_per_plant * succession_count

        # Convert to nutrition
        plant_nutrition = self.calculate_nutrition_from_yield(total_yield_lbs, nutrition_data)

        # Aggregate totals
        for key in NUTRITION_KEYS:
            totals[key] += plant_nutrition.get(key, 0)

        # Add to per-plant breakdown
        by_plant.append({
            'plantId': plant_id,
            'plantName': nutrition_data.get('name', plant_id),
            'quantity': quantity,
            'successionCount': succession_count,
            'yieldLbs': total_yield_lbs,
            **{self._to_camel(k): plant_nutrition.get(k, 0) for k in NUTRITION_KEYS}
        })

    return {
        'totals': totals,
        'byPlant': by_plant,
        'missingNutritionData': list(set(missing_data))
    }
```

---

## Implementation Order

1. **Backend first**: Create `estimate_nutrition_from_items()` method in NutritionalService
2. **Add endpoint**: Add `POST /api/nutrition/estimate` route
3. **Test backend**: Verify endpoint returns correct data
4. **Frontend integration**: Update GardenPlanner.tsx to use new endpoint
5. **Refactor plan endpoint**: Update `/api/garden-plans/<id>/nutrition` to use shared method
6. **Add missing crops**: Update baseline_nutrition.csv with missing entries
7. **Test end-to-end**: Verify both wizard and plan detail show consistent values

---

## Testing Strategy

### Backend Unit Tests

```python
def test_estimate_nutrition_from_items():
    service = NutritionalService()
    items = [
        {'plantId': 'tomato', 'quantity': 10, 'successionCount': 1},
        {'plantId': 'lettuce', 'quantity': 20, 'successionCount': 4}
    ]
    result = service.estimate_nutrition_from_items(items, user_id=1)

    assert result['totals']['calories'] > 0
    assert len(result['byPlant']) == 2
    assert 'missingNutritionData' in result
```

### Frontend Integration Tests

1. Create plan in wizard with known quantities
2. Check nutrition estimates display
3. Save plan
4. View plan detail
5. Verify PlanNutritionCard shows same totals as wizard

---

## Backwards Compatibility

- **PlanNutritionCard**: No change to frontend, backend refactored internally
- **NutritionalDashboard**: Unchanged (different use case - tracks actual harvests)
- **GardenPlanItem model**: No schema changes needed

---

## Notes

### Case Conversion
- Backend uses snake_case (`protein_g`, `succession_count`)
- Frontend uses camelCase (`proteinG`, `successionCount`)
- New endpoint should return camelCase for frontend convenience
- Use helper method `_to_camel()` for conversion

### Succession Handling
- `successionCount = 1` means single planting (no succession)
- `successionCount = 4` means 4 separate plantings at intervals
- Total yield = `quantity * yield_per_plant * successionCount`
