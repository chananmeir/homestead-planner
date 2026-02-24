# Editable Grid Coordinates - Context & Decisions

**Last Updated**: 2025-12-31

## Key Files

### Frontend
- `frontend/src/components/GardenDesigner/PlantConfigModal.tsx` - Modal that needs grid label display/edit
- `frontend/src/components/GardenDesigner.tsx` - Main garden designer (grid rendering, drag-and-drop)
- `frontend/src/components/GardenDesigner/utils/gridCoordinates.ts` - NEW FILE - Conversion utilities
- `frontend/src/types.ts` - Type definitions (GardenBed, PlantedItem)

### Backend (No Changes Needed)
- `backend/models.py` - PlantedItem model (position_x, position_y stored as integers)

## Grid System Understanding

### Coordinate Mapping
```
Visual Grid:     A    B    C    D
                ┌────┬────┬────┬────┐
              1 │ A1 │ B1 │ C1 │ D1 │
                ├────┼────┼────┼────┤
              2 │ A2 │ B2 │ C2 │ D2 │
                ├────┼────┼────┼────┤
              3 │ A3 │ B3 │ C3 │ D3 │
                └────┴────┴────┴────┘

Database:        x=0  x=1  x=2  x=3
              y=0 ┌────┬────┬────┬────┐
              y=1 │    │    │    │    │
              y=2 └────┴────┴────┴────┘

Mapping:
- Column A = x: 0
- Column B = x: 1
- Row 1 = y: 0
- Row 2 = y: 1
```

### Grid Dimensions Calculation
From GardenDesigner.tsx (line 938):
```typescript
const gridWidth = Math.floor((bed.width * 12) / bed.gridSize);
const gridHeight = Math.floor((bed.length * 12) / bed.gridSize);
```

Example:
- Bed: 4' x 3' with 12" grid
- gridWidth = Math.floor((4 * 12) / 12) = 4 cells → Columns A-D
- gridHeight = Math.floor((3 * 12) / 12) = 3 cells → Rows 1-3

### Current Label Rendering
From GardenDesigner.tsx (lines 960-962):
```typescript
const colLabel = String.fromCharCode(65 + x); // A, B, C, D...
const rowLabel = (y + 1).toString(); // 1, 2, 3, 4...
const cellLabel = colLabel + rowLabel; // A1, B2, C3...
```

**Important**: This is currently wrapped in `process.env.NODE_ENV === 'development'` - only visible in dev mode!

## Type Definitions

### PlantedItem (types.ts, lines 103-114)
```typescript
export interface PlantedItem {
  id: string;
  plantId: string;
  variety?: string;
  plantedDate: Date;
  transplantDate?: Date;
  harvestDate?: Date;
  position: { x: number; y: number }; // ← Zero-indexed grid coordinates
  quantity: number;
  status: 'planned' | 'seeded' | 'transplanted' | 'growing' | 'harvested';
  notes?: string;
}
```

### GardenBed (types.ts, lines 90-101)
```typescript
export interface GardenBed {
  id: number;
  name: string;
  width: number; // feet
  length: number; // feet
  location?: string;
  sunExposure?: 'full' | 'partial' | 'shade';
  planningMethod: string;
  gridSize: number; // inches per grid cell (default: 12)
  plantedItems?: PlantedItem[];
  seasonExtension?: SeasonExtension;
}
```

## PlantConfigModal Props

From PlantConfigModal.tsx (lines 22-35):
```typescript
interface PlantConfigModalProps {
  isOpen: boolean;
  cropName: string;
  allPlants: Plant[];
  position: { x: number; y: number } | null; // ← Current position
  planningMethod?: string;
  plantingDate?: string;
  bedId?: number;
  bed?: GardenBed; // ← Contains gridSize, width, length for validation
  onDateChange?: (newDate: string) => void;
  onPreviewChange?: (positions: { x: number; y: number }[]) => void;
  onSave: (config: PlantConfig) => void;
  onCancel: () => void;
}
```

## Implementation Decisions

### Decision 1: Grid Label Format
**Chosen**: "A1", "B2" (Column letter + Row number)
**Rationale**:
- Matches existing development display
- Familiar to spreadsheet users
- Clear column/row separation
- No ambiguity with coordinates

**Alternatives Considered**:
- "1A", "2B" (Row + Column) - Less familiar
- "A-1", "B-2" (With separator) - Unnecessarily verbose

### Decision 2: Input Method
**Chosen**: Text input field with validation
**Rationale**:
- Simple to implement
- Keyboard-friendly for power users
- Works on all devices
- Easy to validate

**Future Enhancement**: Visual grid picker (click on grid cell)

### Decision 3: Display Format
**Chosen**: Show both grid label AND coordinates: "Position: A1 (0, 0)"
**Rationale**:
- Helps users understand the mapping
- Provides debugging information
- Smooth transition for existing users
- Can remove coordinate display later once users are familiar

**Alternative**: Show only grid label - too drastic a change initially

### Decision 4: Error Messages
**Chosen**: Specific, helpful messages with bounds information
**Example**: "B5 is out of bounds. This bed has columns A-D and rows 1-4."
**Rationale**:
- User knows exactly what went wrong
- User knows the valid range
- Reduces frustration and support questions

### Decision 5: Validation Timing
**Chosen**: Validate on blur (when user leaves input field)
**Rationale**:
- Don't interrupt typing
- Show error after user is done
- Less annoying than real-time validation

**Alternative**: Real-time validation - too aggressive

### Decision 6: Case Sensitivity
**Chosen**: Accept both "a1" and "A1", convert to uppercase
**Rationale**:
- User-friendly
- Lowercase is easier to type
- Always display as uppercase for consistency

## Edge Cases to Handle

1. **Empty bed** (gridWidth = 0 or gridHeight = 0)
   - Disable position editing
   - Show message: "Grid dimensions not available"

2. **Large beds** (more than 26 columns)
   - Column AA, AB, AC (like Excel)
   - NOT IMPLEMENTED in Phase 1 - show error instead

3. **Invalid input** ("Z99", "ABC", "1A", "")
   - Clear error message
   - Don't update position
   - Keep previous valid value

4. **Position prop is null**
   - Don't show position input
   - Already handled by existing null check (line 421)

## Testing Checklist

### Manual Testing
- [ ] Drop plant on grid, verify grid label matches visual cell
- [ ] Edit position to valid label, verify plant would be placed correctly
- [ ] Enter invalid column (e.g., "Z1" on 4-column bed), see error
- [ ] Enter invalid row (e.g., "A99" on 3-row bed), see error
- [ ] Enter malformed input (e.g., "ABC", "123"), see error
- [ ] Enter lowercase ("a1"), verify converted to uppercase
- [ ] Edit position, then cancel modal, verify no side effects
- [ ] Edit position, then place plant, verify placed at new position
- [ ] Try on beds with different grid sizes (6", 12", 18")
- [ ] Try on beds with different dimensions (2x3, 4x4, 8x4)

### TypeScript Compilation
- [ ] `cd frontend && npx tsc --noEmit` passes with no errors

### Integration Testing
- [ ] Drag-and-drop still works
- [ ] Multi-plant placement (preview) still works
- [ ] Dense planting (quantity > 1) still works
- [ ] Date filtering doesn't interfere

## Notes

- Backend requires NO changes - grid labels are purely a frontend concern
- Database continues to store numeric coordinates (position_x, position_y)
- Conversion happens only in the UI layer
- This is a pure enhancement - existing functionality unchanged
