# Multi-Square Plant Placement Implementation

## Date: 2025-12-31

## Overview

Implemented automatic multi-square plant placement logic in the Garden Designer. The system now correctly handles both single-square dense planting and multi-square spread planting without requiring manual preview clicks.

## Changes Made

### File: `frontend/src/components/GardenDesigner.tsx`

#### Added Import
```typescript
import { API_BASE_URL } from '../config';
```

#### Modified Function: `handlePlantConfig`

**Location**: Lines 580-766

**Key Logic Additions**:

1. **Calculate plants per square** (lines 623-625):
   ```typescript
   const spacing = plant.spacing || 12;
   const plantsPerSquare = spacing <= 12 ? Math.floor(Math.pow(12 / spacing, 2)) : 1;
   ```

2. **Calculate squares needed** (lines 627-629):
   ```typescript
   const totalQuantity = config.quantity;
   const squaresNeeded = Math.ceil(totalQuantity / plantsPerSquare);
   ```

3. **Branch on squares needed** (line 641):
   - If `squaresNeeded === 1` OR not using SFG/MIgardener → Create single PlantedItem
   - If `squaresNeeded > 1` AND using SFG/MIgardener → Create multiple PlantedItems

4. **Multi-square placement logic** (lines 682-758):
   - Generates positions in a compact grid pattern
   - Starts from the user's selected position
   - Spreads in a grid (e.g., 4 squares = 2x2, 9 squares = 3x3)
   - Distributes plants evenly across squares
   - Last square may have fewer plants if total doesn't divide evenly

## Implementation Details

### Single Square Placement (PATH 1)
**Condition**: `squaresNeeded === 1` OR `planningMethod !== 'square-foot' && planningMethod !== 'migardener'`

**Behavior**:
- Creates 1 PlantedItem at the specified position
- Quantity = total quantity entered by user
- Example: 4 lettuce plants at A1 → 1 PlantedItem with quantity=4 at (0,0)

### Multi-Square Placement (PATH 2)
**Condition**: `squaresNeeded > 1` AND `planningMethod === 'square-foot' || planningMethod === 'migardener'`

**Behavior**:
- Calculates grid pattern (e.g., 4 squares = 2x2)
- Generates positions starting from user's selected position
- Creates multiple PlantedItems via batch POST
- Each PlantedItem gets `plantsPerSquare` quantity (except possibly the last one)

**Positioning Pattern**:
```
For 4 squares starting at (x, y):
- Square 1: (x, y)
- Square 2: (x+1, y)
- Square 3: (x, y+1)
- Square 4: (x+1, y+1)
```

## Test Cases

### Test Case 1: 4 lettuce plants at A1 (6" spacing)
**Input**:
- Crop: Lettuce
- Spacing: 6 inches
- Quantity: 4
- Position: A1 (0,0)
- Planning Method: square-foot

**Calculation**:
- `plantsPerSquare = floor((12/6)²) = floor(4) = 4`
- `squaresNeeded = ceil(4/4) = 1`

**Result**:
- 1 PlantedItem created at (0,0) with quantity=4
- Visual: 4 icons in 2×2 grid within cell A1
- Success message: "Placed 4 Lettuce in 1 square"

### Test Case 2: 16 lettuce plants at A1 (6" spacing)
**Input**:
- Crop: Lettuce
- Spacing: 6 inches
- Quantity: 16
- Position: A1 (0,0)
- Planning Method: square-foot

**Calculation**:
- `plantsPerSquare = floor((12/6)²) = 4`
- `squaresNeeded = ceil(16/4) = 4`

**Result**:
- 4 PlantedItems created:
  - (0,0) with quantity=4
  - (1,0) with quantity=4
  - (0,1) with quantity=4
  - (1,1) with quantity=4
- Visual: 4 cells (A1, B1, A2, B2), each with 4 icons in 2×2 grid
- Success message: "Placed 16 Lettuce across 4 squares"

### Test Case 3: 6 lettuce plants at A1 (6" spacing)
**Input**:
- Crop: Lettuce
- Spacing: 6 inches
- Quantity: 6
- Position: A1 (0,0)
- Planning Method: square-foot

**Calculation**:
- `plantsPerSquare = 4`
- `squaresNeeded = ceil(6/4) = 2`

**Result**:
- 2 PlantedItems created:
  - (0,0) with quantity=4
  - (1,0) with quantity=2
- Visual: A1 with 4 icons, B1 with 2 icons
- Success message: "Placed 6 Lettuce across 2 squares"

### Test Case 4: 1 tomato plant at A1 (24" spacing)
**Input**:
- Crop: Tomato
- Spacing: 24 inches
- Quantity: 1
- Position: A1 (0,0)
- Planning Method: square-foot

**Calculation**:
- `plantsPerSquare = 1` (spacing > 12")
- `squaresNeeded = ceil(1/1) = 1`

**Result**:
- 1 PlantedItem created at (0,0) with quantity=1
- Visual: 1 icon centered in cell A1
- Success message: "Placed 1 Tomato in 1 square"

### Test Case 5: 9 carrots at B2 (3" spacing)
**Input**:
- Crop: Carrot
- Spacing: 3 inches
- Quantity: 9
- Position: B2 (1,1)
- Planning Method: square-foot

**Calculation**:
- `plantsPerSquare = floor((12/3)²) = floor(16) = 16`
- `squaresNeeded = ceil(9/16) = 1`

**Result**:
- 1 PlantedItem created at (1,1) with quantity=9
- Visual: 9 icons in 3×3 grid within cell B2
- Success message: "Placed 9 Carrot in 1 square"

### Test Case 6: 20 radishes at C1 (2" spacing)
**Input**:
- Crop: Radish
- Spacing: 2 inches
- Quantity: 20
- Position: C1 (2,0)
- Planning Method: square-foot

**Calculation**:
- `plantsPerSquare = floor((12/2)²) = floor(36) = 36`
- `squaresNeeded = ceil(20/36) = 1`

**Result**:
- 1 PlantedItem created at (2,0) with quantity=20
- Visual: 20 icons arranged in grid within cell C1
- Success message: "Placed 20 Radish in 1 square"

## Edge Cases Handled

### Bounds Checking
- If a position in the grid pattern exceeds bed dimensions, it's skipped
- Warning logged: `⚠️ Position (x, y) out of bounds, skipping`

### Non-SFG Planning Methods
- For 'row', 'intensive', or other planning methods, always creates single PlantedItem
- Multi-square logic only applies to 'square-foot' and 'migardener' methods

### Uneven Distribution
- Last square receives remainder of plants
- Example: 10 plants with 4 per square → [4, 4, 2]

## User Experience Improvements

### Before This Fix
- User had to manually click "Preview Placement" for multi-square planting
- Without preview, 16 plants would create 1 PlantedItem with quantity=16 (incorrect)
- Confusing workflow with different paths for same outcome

### After This Fix
- User enters total quantity (e.g., 16)
- System automatically calculates squares needed
- Automatically creates correct number of PlantedItems
- Transparent success messages show exactly what was placed

## Success Messages

The implementation provides clear feedback:

**Single square**: `"Placed {quantity} {cropName} in 1 square"`
- Example: "Placed 4 Lettuce in 1 square"

**Multiple squares**: `"Placed {totalPlantsPlaced} {cropName} across {squaresCount} squares"`
- Example: "Placed 16 Lettuce across 4 squares"

## Console Logging

Debug logs help track placement logic:

```javascript
console.log('🌱 Multi-square placement logic:', {
  cropName,
  spacing,
  plantsPerSquare,
  totalQuantity,
  squaresNeeded,
  planningMethod
});
```

```javascript
console.log('✨ Creating multiple PlantedItems for multi-square placement');
console.log('📍 Generated positions:', positions);
```

## Backend Integration

Uses existing batch POST endpoint: `/api/planted-items/batch`

**Payload Structure**:
```json
{
  "gardenBedId": 1,
  "plantId": "lettuce",
  "variety": "Buttercrunch",
  "plantedDate": "2025-12-31",
  "plantingMethod": "direct",
  "status": "planned",
  "notes": "Spring succession",
  "positions": [
    { "x": 0, "y": 0, "quantity": 4 },
    { "x": 1, "y": 0, "quantity": 4 },
    { "x": 0, "y": 1, "quantity": 4 },
    { "x": 1, "y": 1, "quantity": 4 }
  ]
}
```

## Verification Steps

### Manual Testing
1. Start the application
2. Navigate to Garden Designer
3. Create a garden bed with square-foot planning method
4. Drag lettuce (6" spacing) to grid
5. Enter quantity=4 → Verify 1 square with 4 icons
6. Enter quantity=16 → Verify 4 squares each with 4 icons
7. Enter quantity=6 → Verify 2 squares (4 icons + 2 icons)

### Visual Verification
- Each square should show correct number of plant icons
- Icons should be arranged in sub-grid (e.g., 2×2 for 4 plants)
- Adjacent squares should form compact pattern

### Database Verification
- Check `planted_items` table
- Verify correct number of records created
- Verify each record has correct position and quantity

## Compatibility

### Planning Methods
- **square-foot**: Multi-square logic enabled
- **migardener**: Multi-square logic enabled
- **row**: Single PlantedItem always (legacy behavior)
- **intensive**: Single PlantedItem always (legacy behavior)

### Plant Types
- **Small spacing (≤12")**: Dense planting, multi-square when needed
- **Large spacing (>12")**: Single plant per square, multi-square when needed

## Future Enhancements

### Possible Improvements
1. **Visual preview**: Show grid pattern before placement
2. **Custom patterns**: Allow user to choose linear vs. grid spread
3. **Conflict detection**: Warn if not enough adjacent space available
4. **Undo/redo**: Allow easy reversal of multi-square placements

### Not Included in This Implementation
- Preview modal integration (PlantConfigModal already has preview logic)
- Custom positioning (uses compact grid pattern)
- Advanced spacing algorithms (uses simple sqrt-based grid)

## Code Quality

### TypeScript Compliance
- All types properly defined
- No TypeScript compilation errors
- Proper type inference for positions array

### Error Handling
- Bounds checking for grid positions
- Graceful fallback for missing data
- User-friendly error messages

### Maintainability
- Clear variable names
- Extensive comments
- Logical flow with early returns
- Reusable calculation logic

## Related Files

### Modified
- `frontend/src/components/GardenDesigner.tsx`

### Dependencies
- `frontend/src/components/GardenDesigner/PlantConfigModal.tsx` (provides quantity)
- `frontend/src/utils/plantUtils.ts` (findPlantByVariety)
- `frontend/src/config.ts` (API_BASE_URL)
- `backend/app.py` (batch POST endpoint)

## Conclusion

This implementation provides a seamless user experience for multi-square plant placement. Users can now simply enter the total number of plants they want, and the system automatically:
1. Calculates how many fit per square
2. Determines how many squares are needed
3. Creates the appropriate PlantedItems
4. Positions them in a logical grid pattern

The solution is backwards-compatible, maintains existing preview functionality, and provides clear feedback to users.
