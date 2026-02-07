# Permaculture Bed Plant Quantity Calculation Fix

## What Changed

3 files modified to add permaculture branch to space calculators and PlantConfigModal.

Permaculture beds (`planningMethod === 'permaculture'`) previously had no quantity calculation logic. When placing a plant on a permaculture bed, the modal defaulted to quantity=1 with no capacity checks. Users could enter any quantity (e.g., 500 plants in a single 12" cell) with no warning.

## Root Cause

PlantConfigModal has explicit branches for square-foot, migardener, and intensive methods, but permaculture fell through all of them to `defaultQuantity = 1`.

## Formula

`(12 / spacing)^2` plants per cell - same concept as SFG but uses the plant's native `spacing` field instead of the SFG lookup table.

## Capacity Warning

Amber banner when manually-entered quantity exceeds `floor(plantsPerSquare) * numberOfSquares`. Works for ALL dual-input methods (SFG, migardener, intensive, permaculture).

## Files Modified

### `frontend/src/components/GardenDesigner/PlantConfigModal.tsx` (5 edits)
- **Line 21**: Added `permaculture` to `shouldUseDensePlanting()` guard
- **Line 526**: Added `permaculture` to `usesDualInput` memo
- **Lines 869-875**: Added permaculture quantity calculation branch (after intensive block)
- **Line 1695**: Added `permaculture` to dual-input UI rendering condition
- **Lines 1737-1742**: Added capacity warning for all dual-input methods

### `frontend/src/utils/gardenPlannerSpaceCalculator.ts` (1 edit)
- **Lines 236-241**: Added permaculture space calculation: `spacing * spacing / 144` sq ft

### `backend/services/space_calculator.py` (1 edit)
- **Lines 126-132**: Added permaculture `elif` branch: `spacing * spacing / 144.0` sq ft

## What Was NOT Changed (and why)

- **`sfgSpacing.ts` / `sfg_spacing.py`**: Permaculture intentionally skips SFG lookup tables - uses native plant spacing instead
- **`plantDatabase.ts` / `plant_database.py`**: No plant data changes - uses existing `spacing` field
- **`autoPlacement.ts`**: Generic grid strategy already works for permaculture ('grid' style)
- **`footprintCalculator.ts`**: Existing circular buffer logic works with permaculture's 12" grid
- **Database schema**: No changes

## Expected Values (for rollback verification)

| Plant | Spacing | Plants/Cell | Sq Ft/Plant |
|-------|---------|-------------|-------------|
| Chia | 12" | 1 | 1.0 |
| Lettuce | 8" | 2 | 0.44 |
| Carrot | 3" | 16 | 0.0625 |
| Tomato | 24" | 1 (needs 4 cells) | 4.0 |

## Verification

1. `cd frontend && npm run build` - passes
2. Create permaculture bed, place Chia - modal defaults to quantity=1
3. Place Carrot on permaculture bed - modal defaults to quantity=16
4. Manually type 500 for Chia - amber warning appears
5. Backend/frontend sync: both return 1.0 sq ft for 12" spacing permaculture
