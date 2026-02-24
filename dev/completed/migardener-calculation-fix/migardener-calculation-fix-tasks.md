# MIgardener Calculation Fix - Tasks

**Last Updated**: 2025-11-17 (Final Update - All Complete)
**Status**: All tasks completed ✅ + All crops verified ✅

## Task Checklist

### Phase 1: Data Corrections
- [x] Update radish spacing in MIGARDENER_SPACING dictionary (6,2 → 4,1)
- [x] Update radish spacing in plant_database.py (rowSpacing: 6→4, spacing: 3→1)

### Phase 2: Backend Implementation
- [x] Add get_migardener_spacing import to app.py
- [x] Add migardener case to calculate_spacing() endpoint in app.py
- [x] Add migardener case to calculate_plants_per_bed() in garden_methods.py

### Phase 3: Frontend Implementation
- [x] Add migardener case to PlantConfigModal.tsx for default quantity calculation

### Phase 4: Testing & Validation
- [x] Test radish calculations: MIgardener (36/sqft) and SFG (16/sqft)
- [x] Verify Python calculation: 4×4 bed = 576 plants for MIgardener
- [x] Verify Python calculation: 4×4 bed = 256 plants for SFG

### Phase 5: Documentation
- [x] Create dev docs directory: dev/active/migardener-calculation-fix/
- [x] Write migardener-calculation-fix-plan.md
- [x] Write migardener-calculation-fix-context.md
- [x] Write migardener-calculation-fix-tasks.md

## Completed Task Details

### Task 1: Update MIGARDENER_SPACING
**File**: `backend/garden_methods.py:280`
**Change**: `'radish': [6, 2]` → `'radish': [4, 1]`
**Result**: Now calculates 36 plants/sqft instead of 12

### Task 2: Update plant_database.py
**File**: `backend/plant_database.py:314-315`
**Changes**:
- `'spacing': 3` → `'spacing': 1`
- `'rowSpacing': 6` → `'rowSpacing': 4`
**Result**: Radish data now matches MIgardener recommendations

### Task 3: Add Import
**File**: `backend/app.py:9`
**Change**: Added `get_migardener_spacing` to imports from garden_methods
**Result**: Function now available in app.py

### Task 4: Add API Endpoint Case
**File**: `backend/app.py:286-302`
**Change**: Added complete `elif method == 'migardener':` block
**Result**: API now returns proper calculations for migardener method

### Task 5: Add Helper Function Case
**File**: `backend/garden_methods.py:536-543`
**Change**: Added `elif method == 'migardener':` case with calculation logic
**Result**: calculate_plants_per_bed() now supports migardener

### Task 6: Frontend Default Quantity
**File**: `frontend/src/components/GardenDesigner/PlantConfigModal.tsx:90-95`
**Change**: Added migardener case with proper calculation
**Result**: UI shows correct default quantity (36) when adding radishes

### Task 7: Testing
**Method**: Python calculation script
**Results**:
- MIgardener: 576 plants (36/sqft) ✓
- SFG: 256 plants (16/sqft) ✓
- Difference: +320 plants (125% more) ✓

### Task 8: Documentation
**Created**:
- plan.md - Implementation plan and overview
- context.md - Background, decisions, and technical details
- tasks.md - This file

## Summary

**Total Tasks**: 14
**Completed**: 14
**Status**: ✅ All complete

**Files Modified**: 4
1. backend/garden_methods.py
2. backend/plant_database.py
3. backend/app.py
4. frontend/src/components/GardenDesigner/PlantConfigModal.tsx

**Lines Changed**: ~35 total
- Backend: ~25 lines
- Frontend: ~5 lines
- Data: ~5 values updated

**Time Spent**: ~45 minutes

### Phase 6: Verification of All Crops (BONUS)
- [x] Verify lettuce spacing against MIgardener data
- [x] Verify spinach spacing against MIgardener data
- [x] Verify carrots spacing against MIgardener data
- [x] Verify beets spacing against MIgardener data
- [x] Verify onions spacing against MIgardener data
- [x] Verify garlic spacing against MIgardener data
- [x] Verify bush beans spacing against MIgardener data
- [x] Verify pole beans spacing against MIgardener data
- [x] Verify peas spacing against MIgardener data
- [x] Verify tomatoes spacing against MIgardener data
- [x] Verify peppers spacing against MIgardener data
- [x] Resolve radish spacing conflict ([4,1] vs [6,2])

**Phase 6 Result**: All 11 other crops already had correct values. Only radishes needed fixing.

## Verification Details

**Crops Verified** (2025-11-17):
- Lettuce: [4, 4] = middle of 3-4" range ✓
- Spinach: [5, 4] = middle of 4-6" rows ✓
- Carrots: [6, 2] = matches MIgardener exactly ✓
- Beets: [12, 3] = matches MIgardener exactly ✓
- Onions: [4, 4] = 3-4" on center ✓
- Garlic: [4, 3] = 3-3.5" sweet spot ✓
- Bush Beans: [18, 5.5] = middle of 4-7" range ✓
- Pole Beans: [30, 8] = 8-10" on trellis ✓
- Peas: [60, 1.5] = ultra-dense 1-2" ✓
- Tomatoes: [36, 24] = matches exactly ✓
- Peppers: [21, 14] = middle of 12-16" range ✓

**Radish Conflict Resolved**:
- User initially provided [6, 2] documentation
- Confirmed preference for ultra-intensive [4, 1]
- Implemented [4, 1] = 36 plants/sqft

## Future Enhancements (Optional)

- [ ] Add UI tooltips explaining method differences
- [ ] Create visual comparison chart for documentation
- [ ] Add backend validation for spacing data
- [ ] Consider making spacing values user-configurable per variety
- [x] ~~Audit other crops in MIGARDENER_SPACING for accuracy~~ → COMPLETED
