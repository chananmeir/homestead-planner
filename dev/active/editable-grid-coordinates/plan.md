# Editable Grid-Based Plant Placement - Implementation Plan

**Status**: ✅ COMPLETED
**Created**: 2025-12-31
**Completed**: 2025-12-31
**Last Updated**: 2025-12-31

## Problem Statement

When dragging a plant onto a garden bed, the PlantConfigModal shows "Position: (1, 0)" using numeric coordinates. Users cannot:
1. See grid labels (A1, A2, B1, B2) that match the visual grid
2. Edit the position if the drop was inaccurate
3. Manually specify a position without drag-and-drop

## Current System Analysis

### Grid Label System (Lines 958-962 in GardenDesigner.tsx)
```typescript
const colLabel = String.fromCharCode(65 + x); // A, B, C, D...
const rowLabel = (y + 1).toString(); // 1, 2, 3, 4...
const cellLabel = colLabel + rowLabel; // A1, B2, C3...
```

**Key Discovery**: Grid labels are currently shown only in development mode and are NOT production-visible.

### Coordinate System
- **Storage**: `position_x` and `position_y` in database (PlantedItem model line 97-98)
- **Meaning**: Zero-indexed grid coordinates
  - x=0 → Column A
  - x=1 → Column B
  - y=0 → Row 1
  - y=1 → Row 2
- **Grid Dimensions**: Calculated as `Math.floor((bed.width * 12) / bed.gridSize)`
  - Example: 4' bed with 12" grid = (4 * 12) / 12 = 4 cells (A-D)

### PlantConfigModal (Lines 437-441)
Currently displays:
```typescript
<p className="text-sm text-gray-600">
  Position: ({position.x}, {position.y})
</p>
```

This is NOT editable and shows numeric coordinates.

## Implementation Plan

### Phase 1: Utility Functions
**File**: `frontend/src/components/GardenDesigner/utils/gridCoordinates.ts`

Create conversion functions:
- `coordinateToGridLabel(x: number, y: number): string`
  - Input: (0, 0) → Output: "A1"
  - Input: (1, 2) → Output: "B3"
- `gridLabelToCoordinate(label: string): { x: number; y: number } | null`
  - Input: "A1" → Output: { x: 0, y: 0 }
  - Input: "B3" → Output: { x: 1, y: 2 }
  - Input: "invalid" → Output: null
- `isValidGridLabel(label: string, gridWidth: number, gridHeight: number): boolean`
  - Validates label is within bed bounds

### Phase 2: Modal Enhancement
**File**: `frontend/src/components/GardenDesigner/PlantConfigModal.tsx`

Changes needed:
1. **Display Grid Label** (Lines 437-441)
   - Show "Position: A1" instead of "Position: (0, 0)"
   - Show both formats: "Position: A1 (0, 0)" for clarity

2. **Add Editable Input** (After line 441)
   - Add text input field for grid label
   - Validate input as user types
   - Show error message for invalid labels
   - Update position state when valid label entered

3. **Update Confirmation Text** (Lines 644-650)
   - Use grid labels in button text where appropriate

### Phase 3: Integration
**File**: `frontend/src/components/GardenDesigner.tsx`

1. Make grid labels visible in production (currently dev-only, line 958)
2. Consider adding grid labels to PlantedItem tooltip
3. Ensure drag-and-drop coordinates still work correctly

## User Experience Flow

1. **User drags lettuce plant** → drops at visual grid cell labeled "B2"
2. **Modal opens** → Shows "Position: B2 (1, 1)"
3. **User sees position is wrong** → Clicks input field
4. **User types "A1"** → Position updates to (0, 0)
5. **User clicks Place** → Plant placed at correct position

## Technical Decisions

### Grid Label Format
- **Columns**: A, B, C... (using capital letters)
- **Rows**: 1, 2, 3... (1-indexed for user clarity)
- **Combined**: "A1", "B2", "C3" (column + row, no separator)

### Input Validation
- Accept both uppercase and lowercase (convert to uppercase)
- Trim whitespace
- Validate column letter is within bed width
- Validate row number is within bed height
- Show helpful error: "B5 is out of bounds. This bed has columns A-D and rows 1-4."

### Backward Compatibility
- Database still stores numeric coordinates
- Only frontend conversion needed
- No backend changes required

## Future Enhancements (Not in Scope)

1. Visual grid cell picker (click on grid to set position)
2. Dropdown selector instead of text input
3. Show grid labels on main garden view (not just dev mode)
4. Keyboard navigation (arrow keys to change position)

## Success Criteria

- ✅ User can see grid label (e.g., "A1") in modal
- ✅ User can edit position by typing grid label
- ✅ Invalid labels show helpful error message
- ✅ Valid labels update plant position correctly
- ✅ Drag-and-drop still works as before
- ✅ No TypeScript errors
- ✅ No backend changes needed
