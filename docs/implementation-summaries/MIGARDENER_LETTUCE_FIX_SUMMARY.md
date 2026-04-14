# MIGardener Lettuce Space Calculation Fix - Implementation Summary

**Date**: 2026-01-23
**Status**: ✅ COMPLETED
**Component**: Garden Season Planner - Space Calculator

---

## 🎯 Problem Fixed

The Garden Season Planner incorrectly treated MIGardener lettuce seeds as individual plants (1:1 ratio) when calculating space requirements. This caused **1056 lettuce seeds** to show as requiring **117 cells (over capacity)** when it should only require **29.33 sq ft (31% utilization)**.

**Before (Incorrect)**:
```
1056 seeds × 0.111 cells/plant = 117.33 cells needed → ❌ 122% usage (FAIL)
```

**After (Correct)**:
```
1056 seeds ÷ 36 seeds/sq ft = 29.33 sq ft needed → ✅ 31% usage (PASS)
```

---

## 🔧 Implementation Changes

### 1. Frontend Spacing Data Fix

**File**: `frontend/src/utils/migardenerSpacing.ts`

Updated lettuce and arugula spacing to match backend:
```typescript
// BEFORE (wrong):
'lettuce-1': [null, 4],   // ❌ Treated as 4" plant spacing, no rows
'arugula-1': [null, 2],   // ❌ Treated as 2" plant spacing, no rows

// AFTER (correct):
'lettuce-1': [4, 1],      // ✅ 4" row spacing, 1" seed spacing (36 seeds/sqft)
'arugula-1': [4, 1],      // ✅ 4" row spacing, 1" seed spacing (36 seeds/sqft)
```

### 2. Frontend Space Calculator Enhancement

**File**: `frontend/src/utils/gardenPlannerSpaceCalculator.ts`

Added two helper functions:
- `isSeedDensityPlanting()` - Detects seed-density crops using plant metadata
- `calculateSeedsPerSqFt()` - Calculates seeds per square foot based on row spacing and seed density

Updated space calculation logic to use dual modes:
- **Plant-based mode**: For transplanted crops (tomatoes, peppers, swiss chard)
  - `space = cellsPerPlant × quantity` (quantity = number of plants)
- **Seed-density mode**: For direct-seeded dense crops (lettuce, arugula)
  - `space = quantity ÷ seedsPerSqFt` (quantity = number of seeds)

Updated per-seed display estimate to show correct units ("sq ft" for seed-density, "cells" for plant-based).

### 3. Backend Space Calculator Enhancement

**File**: `backend/services/space_calculator.py`

Added matching helper functions:
- `is_seed_density_planting()` - Python version of detection logic
- `calculate_seeds_per_sqft()` - Python version of seed density calculation

Updated MIGardener calculation to check for seed-density mode before calculating space.

### 4. Backend Plant Database Update

**File**: `backend/plant_database.py`

Added `migardener` metadata to lettuce-1 and arugula-1 entries:
```python
'migardener': {
    'plantingStyle': 'row_based',
    'seedDensityPerInch': 1,
    'rowSpacingInches': 4,
    'germinationRate': 0.85,  # lettuce: 0.85, arugula: 0.90
    'survivalRate': 0.25,     # lettuce: 0.25, arugula: 0.30
}
```

---

## ✅ Test Results

All test cases pass:

### Test Case 1: MIGardener Lettuce (1056 seeds)
- **Seeds**: 1056
- **Cells per seed**: 0.0278 (= 1/36)
- **Total space needed**: 29.33 sq ft
- **Bed size**: 96 sq ft (8ft × 12ft)
- **Utilization**: 30.6%
- **Status**: ✅ PASS (under capacity)

### Test Case 2: MIGardener Arugula (800 seeds)
- **Seeds**: 800
- **Total space needed**: 22.22 sq ft
- **Utilization**: 23.1%
- **Status**: ✅ PASS (under capacity)

### Test Case 3: MIGardener Swiss Chard (50 plants)
- **Plants**: 50
- **Cells per plant**: 1.00
- **Total space needed**: 50.00 sq ft
- **Utilization**: 52.1%
- **Status**: ✅ PASS (plant-based mode still works correctly)

### Test Case 4: Mixed Planting (1056 lettuce + 50 swiss chard)
- **Lettuce**: 29.33 sq ft (seed-density mode)
- **Swiss chard**: 50.00 sq ft (plant-based mode)
- **Total**: 79.33 sq ft
- **Utilization**: 82.6%
- **Status**: ✅ PASS (dual-mode calculation works correctly)

---

## 📐 Technical Details

### Seed-Density Calculation Formula

For crops with `plantingStyle: 'row_based'` and `seedDensityPerInch > 0`:

```
Seeds per sq ft = (rows per foot) × (seeds per row-foot)
                = (12 ÷ rowSpacingInches) × (12 × seedDensityPerInch)

For lettuce with rowSpacing=4" and seedDensity=1 seed/inch:
Seeds per sq ft = (12 ÷ 4) × (12 × 1) = 3 × 12 = 36 seeds
Space per seed = 1 ÷ 36 = 0.0278 sq ft
```

### Detection Logic

A plant is considered seed-density when:
1. Planning method is `'migardener'`
2. Plant has `migardener` metadata object
3. `plantingStyle === 'row_based'`
4. `seedDensityPerInch > 0`
5. `rowSpacingInches > 0`

### Affected Crops

Currently only two crops use seed-density calculation:
- `lettuce-1` - 36 seeds per sq ft
- `arugula-1` - 36 seeds per sq ft

All other crops continue to use plant-based calculation.

---

## 🔍 Files Modified

**Frontend** (3 files):
1. `frontend/src/utils/migardenerSpacing.ts` - Fixed spacing data
2. `frontend/src/utils/gardenPlannerSpaceCalculator.ts` - Added dual-mode calculation
3. _(Optional UI enhancement not implemented yet)_

**Backend** (2 files):
1. `backend/services/space_calculator.py` - Added dual-mode calculation
2. `backend/plant_database.py` - Added migardener metadata for lettuce and arugula

**Test Files** (1 file):
1. `backend/test_seed_density_fix.py` - Comprehensive test suite

---

## 🎨 Design Decisions

### Why Two Modes?

**Plant-Based Mode**: For transplanted or discrete plants
- Examples: Tomatoes, peppers, swiss chard
- Input represents: Number of mature plants to transplant
- Calculation: Each plant needs X cells of space

**Seed-Density Mode**: For direct-seeded dense crops
- Examples: Lettuce, arugula (cut-and-come-again)
- Input represents: Number of seeds to sow
- Calculation: Seeds per sq ft based on row spacing and density

### Why Detection Instead of Hardcoding?

Using `isSeedDensityPlanting()` detection logic instead of hardcoding plant IDs ensures:
- Any new crop with `seedDensityPerInch` automatically works correctly
- Clear architectural separation of concerns
- Easy to extend to future seed-density crops

### Frontend + Backend Consistency

Both systems implement identical logic to ensure:
- User sees same calculations in UI and backend validation
- Frontend estimates match backend allocation
- Both systems understand seed vs. plant distinction

---

## 🚀 Future Enhancements

1. **UI Labels**: Add dynamic labels showing "Seeds" vs "Plants" in quantity inputs
2. **More Crops**: Add seed-density metadata to other direct-seeded crops (radish, carrot, spinach)
3. **Validation**: Add frontend validation to warn if seed count seems unrealistic
4. **Documentation**: Update user-facing help text to explain seed vs. plant quantities

---

## 📊 Verification

Run the test suite to verify the fix:
```bash
cd backend
python test_seed_density_fix.py
```

Build frontend to verify TypeScript compilation:
```bash
cd frontend
npm run build
```

---

**Status**: Implementation complete and tested
**Impact**: High - Fixes critical calculation bug affecting all MIGardener lettuce/arugula plantings
**Breaking Changes**: None - Only affects lettuce and arugula calculations, which were previously incorrect
