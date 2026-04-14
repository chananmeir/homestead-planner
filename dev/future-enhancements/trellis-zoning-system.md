# Trellis Zoning System

**Status**: ✅ **Phases 1-4 Implemented** (2026-01-20)
**Priority**: High (completed)
**Created**: 2026-01-18
**Reason**: Grapes and other trellis crops require linear allocation, not grid/row-based placement

## Implementation Status

- ✅ **Phase 1**: Trellis Structure Management (Complete)
- ✅ **Phase 2**: Trellis Visualization in Property Designer (Complete)
- ✅ **Phase 3**: Linear Allocation Logic (Complete)
- ✅ **Phase 4**: Trellis-Based Plant Placement (Complete)
- 🔜 **Phase 5**: Visual Extent and Management (Future)
- 🔜 **Phase 6**: Multi-Year Tracking (Future)
- 🔜 **Phase 7**: Garden Designer Integration (Planned)

---

## Problem Statement

Current planting systems (grid, row-based, broadcast, block) do not support **trellis crops** that require **linear allocation along a structure**.

**Example**: Grapes (MIGardener method)
- Each grape vine needs **5 linear feet of trellis**
- Vines are placed at 5 ft intervals **along a trellis line**
- One vine should **never exceed 5 ft** of trellis length
- Spacing is **linear** (along trellis), not grid-based (2D area)

**Current workaround**: Grapes use `plant_spacing: 60` (5 feet) as placeholder, but this incorrectly applies grid logic instead of linear trellis allocation.

---

## Crops Requiring Trellis System

### Already Added (Using Placeholder)
1. **Grapes** - 5 ft linear per vine

### Future Additions That Will Need This
2. **Pole Beans (trellised)** - 6-12 inches linear per plant
3. **Cucumbers (trellised)** - 18 inches linear per plant
4. **Peas (trellised)** - 2-4 inches linear per plant
5. **Indeterminate Tomatoes (trellised)** - 18-24 inches linear per plant
6. **Melons (trellised)** - 24-36 inches linear per plant
7. **Kiwi** - 15-20 ft linear per vine
8. **Passionfruit** - 10-15 ft linear per vine
9. **Hops** - 3-5 ft linear per plant

---

## Requirements

### Functional Requirements

1. **Define Trellis Structures**
   - User can draw/place trellis lines in garden designer
   - Trellis has start point, end point, direction
   - System calculates total trellis length

2. **Linear Allocation**
   - Plants allocated at fixed intervals along trellis
   - Example: 20 ft trellis ÷ 5 ft per plant = 4 grape vines max
   - System prevents over-allocation (can't place 5th vine on 20 ft trellis)

3. **Plant Placement Along Trellis**
   - Plants snap to trellis line
   - Placement constrained to trellis zones only
   - Cannot place trellis crops in open garden beds (grid mode)

4. **Capacity Tracking**
   - Display remaining trellis capacity
   - Example: "20 ft trellis: 4/4 grapes (0 ft available)"
   - Warning when approaching capacity

5. **Vine/Plant Extent Visualization**
   - Show which linear segment each plant occupies
   - Example: Vine 1 = 0-5 ft, Vine 2 = 5-10 ft, Vine 3 = 10-15 ft, Vine 4 = 15-20 ft
   - Visual indicators for occupied vs available trellis segments

### Non-Functional Requirements

1. **Backward Compatibility**
   - Existing grid/row crops continue to work unchanged
   - Trellis system is additive, not replacement

2. **Performance**
   - Trellis calculations should not slow down garden designer
   - Real-time feedback on placement validity

3. **Usability**
   - Clear visual distinction between trellis zones and garden beds
   - Intuitive trellis drawing tool
   - Helpful error messages when placement invalid

---

## System Architecture

### Data Models

#### TrellisStructure (Database Model)

```python
# backend/models.py

class TrellisStructure(db.Model):
    __tablename__ = 'trellis_structure'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    garden_bed_id = db.Column(db.Integer, db.ForeignKey('garden_bed.id'))  # Optional: trellis within bed

    # Trellis geometry
    name = db.Column(db.String(100))  # e.g., "North Fence Trellis", "Grape Arbor"
    trellis_type = db.Column(db.String(50))  # 'fence', 'arbor', 'a-frame', 'post_wire', 'espalier'

    # Start and end points (relative to garden/property)
    start_x = db.Column(db.Float)  # inches from origin
    start_y = db.Column(db.Float)
    start_z = db.Column(db.Float, default=0)  # height if needed

    end_x = db.Column(db.Float)
    end_y = db.Column(db.Float)
    end_z = db.Column(db.Float, default=0)

    # Calculated properties
    total_length_feet = db.Column(db.Float)  # Calculated from start/end points
    total_length_inches = db.Column(db.Float)

    # Trellis characteristics
    height_inches = db.Column(db.Float)  # Vertical height of trellis
    wire_spacing_inches = db.Column(db.Float, nullable=True)  # For multi-wire trellises
    num_wires = db.Column(db.Integer, nullable=True)

    # Orientation
    direction = db.Column(db.String(20))  # 'N-S', 'E-W', 'NE-SW', etc.

    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.Text)
```

#### TrellisPlanting (Extension to PlantingEvent)

```python
# backend/models.py

class PlantingEvent(db.Model):
    # ... existing fields ...

    # NEW: Trellis-based planting fields
    trellis_structure_id = db.Column(db.Integer, db.ForeignKey('trellis_structure.id'), nullable=True)
    trellis_position_start_inches = db.Column(db.Float, nullable=True)  # Linear position along trellis
    trellis_position_end_inches = db.Column(db.Float, nullable=True)    # End of allocated segment
    linear_feet_allocated = db.Column(db.Float, nullable=True)          # Length occupied (e.g., 5 ft for grape)
```

### TypeScript Types

```typescript
// frontend/src/types.ts

export interface TrellisStructure {
  id: number;
  userId: number;
  gardenBedId?: number;
  name: string;
  trellisType: 'fence' | 'arbor' | 'a-frame' | 'post_wire' | 'espalier';

  // Start and end points
  startX: number;
  startY: number;
  startZ?: number;
  endX: number;
  endY: number;
  endZ?: number;

  // Calculated properties
  totalLengthFeet: number;
  totalLengthInches: number;

  // Trellis characteristics
  heightInches: number;
  wireSpacingInches?: number;
  numWires?: number;

  direction: string;
  createdAt: string;
  notes?: string;
}

export interface TrellisPlanting {
  trellisStructureId: number;
  trellisPositionStartInches: number;
  trellisPositionEndInches: number;
  linearFeetAllocated: number;
}

export type PlantingStyle =
  | 'row_based'
  | 'broadcast'
  | 'dense_patch'
  | 'plant_spacing'
  | 'trellis_linear';  // NEW

// Extend PlantType
export interface PlantType {
  // ... existing fields ...

  migardener?: {
    plantingStyle: PlantingStyle;

    // ... existing fields ...

    // NEW: Trellis-specific fields
    linearFeetPerPlant?: number;  // For trellis crops (e.g., 5 ft for grapes)
    trellisRequired?: boolean;    // Must be placed on trellis
    trellisTypes?: TrellisStructure['trellisType'][];  // Compatible trellis types
  };
}
```

---

## Implementation Phases

### Phase 1: Trellis Structure Management

**Goal**: Allow users to define trellis structures

**Tasks**:
1. Create `TrellisStructure` database model
2. Migration script: `backend/add_trellis_structures.py`
3. Backend API endpoints:
   - `POST /api/trellis-structures` - Create trellis
   - `GET /api/trellis-structures` - List all trellises
   - `PUT /api/trellis-structures/:id` - Update trellis
   - `DELETE /api/trellis-structures/:id` - Delete trellis
4. Frontend: TrellisManager component
   - Form to add trellis (name, type, start/end points, height)
   - List of existing trellises
   - Edit/delete functionality

**Deliverable**: User can create and manage trellis structures (but not place plants yet)

---

### Phase 2: Trellis Visualization

**Goal**: Display trellis structures in garden designer

**Tasks**:
1. Add trellis layer to GardenDesigner canvas
2. Draw trellis lines from start to end points
3. Visual styling:
   - Different colors/patterns for trellis types
   - Show trellis height (if perspective view)
   - Label with trellis name
4. Highlight trellis on hover
5. Click trellis to see details (length, capacity, plants)

**Deliverable**: User can see trellis structures overlaid on garden designer

---

### Phase 3: Linear Allocation Logic

**Goal**: Calculate trellis capacity and allocate linear segments

**Tasks**:
1. Create utility functions:
   - `calculateTrellisLength(startX, startY, endX, endY)` → feet
   - `calculateCapacity(trellisLength, linearFeetPerPlant)` → max plants
   - `allocateSegment(trellis, linearFeetPerPlant)` → start/end position
   - `getRemainingCapacity(trellis, existingPlants)` → feet available
2. Backend validation:
   - Check if trellis has capacity before allowing placement
   - Prevent over-allocation
3. Frontend capacity display:
   - "Grape Trellis: 4/4 plants (20 ft total, 0 ft available)"
   - Visual meter showing occupied vs available

**Deliverable**: System can track and enforce trellis capacity limits

---

### Phase 4: Trellis-Based Plant Placement

**Goal**: Allow placing trellis crops on trellis structures

**Tasks**:
1. Update PlantConfigModal:
   - Detect if plant requires trellis (`migardener.trellisRequired === true`)
   - Show trellis selector dropdown (list compatible trellises)
   - Display linear feet allocation (e.g., "This grape will occupy 5 ft of trellis")
2. Placement validation:
   - Block placement if no trellis selected
   - Check trellis capacity before allowing placement
   - Snap plant to available trellis position
3. Update `PlantingEvent` model:
   - Store `trellis_structure_id`, `trellis_position_start_inches`, etc.
4. Backend API update:
   - `POST /api/planted-items` accepts trellis data
   - Store trellis allocation in database

**Deliverable**: User can place grapes and other trellis crops on trellis structures

---

### Phase 5: Visual Extent and Management

**Goal**: Show which plants occupy which trellis segments

**Tasks**:
1. Visual indicators on trellis:
   - Color-code or segment trellis by plant
   - Example: Grape 1 (green) 0-5 ft, Grape 2 (green) 5-10 ft
   - Show plant icons at each allocation point
2. Trellis utilization view:
   - Linear diagram showing all segments
   - Click segment to highlight plant
   - Drag to adjust plant position along trellis
3. Pruning/maintenance reminders:
   - Alert if vine exceeds allocated length
   - Suggest pruning to maintain linear allocation

**Deliverable**: Clear visual representation of trellis usage

---

### Phase 6: Multi-Year Tracking and Harvest Integration

**Goal**: Track trellis crops over multiple years

**Tasks**:
1. Perennial trellis crops (grapes, kiwi):
   - Track planting year
   - Disable harvest for Year 1-2 (establishment)
   - Enable harvest Year 3+
2. Annual trellis crops (beans, cucumbers):
   - Track succession plantings on same trellis
   - Show timeline of crop rotation
3. Harvest tracking:
   - Link harvest records to trellis position
   - Yield tracking per linear foot
   - Compare productivity across trellis segments

**Deliverable**: Full lifecycle tracking for trellis crops

---

## User Interface Design

### Trellis Drawing Tool

**Option A: Line Tool**
- User clicks start point, clicks end point
- System draws trellis line
- Form appears to set name, type, height

**Option B: Property Designer Integration**
- Trellises defined in Property Designer (like structures)
- Automatically available in Garden Designer
- Associate trellises with specific garden beds

**Recommendation**: Option B (more consistent with existing property/structure system)

### Trellis Plant Palette

**Filtered View**:
- When user clicks trellis, show only trellis-compatible plants
- Disable non-trellis crops in palette (or hide them)
- Show linear feet requirement for each plant

**Placement Flow**:
1. User selects trellis structure
2. System shows available capacity: "15 ft available on Grape Trellis"
3. User selects grape from palette (requires 5 ft)
4. System shows: "Place grape? This will use 5 ft (3 plants remaining possible)"
5. User confirms
6. Grape icon appears on trellis at allocated position

### Trellis Capacity Indicator

```
┌─────────────────────────────────────────┐
│ Grape Trellis (20 ft total)            │
├─────────────────────────────────────────┤
│ ████████████████░░░░░░░░░░░░░░░░░░░░░░ │
│ 15 ft occupied │ 5 ft available        │
│                                         │
│ • Grape 1 (0-5 ft)                     │
│ • Grape 2 (5-10 ft)                    │
│ • Grape 3 (10-15 ft)                   │
│ + Add plant (needs 5 ft minimum)       │
└─────────────────────────────────────────┘
```

---

## Example Calculations

### Grape Trellis Example

**Given**:
- Trellis length: 20 feet
- Grape linear allocation: 5 feet per vine

**Calculation**:
```
Max capacity = 20 ft ÷ 5 ft/vine = 4 vines

Placements:
- Vine 1: Start=0 ft,  End=5 ft  (position 0")
- Vine 2: Start=5 ft,  End=10 ft (position 60")
- Vine 3: Start=10 ft, End=15 ft (position 120")
- Vine 4: Start=15 ft, End=20 ft (position 180")

Remaining capacity: 20 ft - 20 ft = 0 ft (full)
```

### Mixed Trellis Example

**Given**:
- Trellis length: 30 feet
- Grape: 5 ft per vine
- Kiwi: 15 ft per vine

**Calculation**:
```
Option 1: 6 grapes (6 × 5 ft = 30 ft)
Option 2: 2 kiwi (2 × 15 ft = 30 ft)
Option 3: 1 kiwi + 3 grapes (15 ft + 15 ft = 30 ft)

User selects Option 3:
- Kiwi 1:  Start=0 ft,  End=15 ft (position 0")
- Grape 1: Start=15 ft, End=20 ft (position 180")
- Grape 2: Start=20 ft, End=25 ft (position 240")
- Grape 3: Start=25 ft, End=30 ft (position 300")

Remaining capacity: 30 ft - 30 ft = 0 ft (full)
```

---

## Technical Considerations

### Coordinate System

**Option A: Absolute Coordinates**
- Trellis uses global garden coordinates
- Pros: Simple, works across garden
- Cons: Hard to move/adjust

**Option B: Relative to Garden Bed**
- Trellis positioned relative to parent bed
- Pros: Easier to move beds, better for bed-integrated trellises
- Cons: More complex for property-wide trellises

**Recommendation**: Hybrid
- Allow both garden-level (absolute) and bed-level (relative) trellises
- Use `garden_bed_id` field: null = garden-level, not null = bed-level

### Linear Position Tracking

**Use inches as base unit** (consistent with existing system):
- Store positions in inches (e.g., 60" = 5 ft)
- Display to user in feet (more intuitive for trellis crops)
- Conversions: `inches / 12 = feet`, `feet × 12 = inches`

### Collision Detection

**Prevent overlapping allocations**:
```typescript
function canPlaceOnTrellis(
  trellis: TrellisStructure,
  linearFeetNeeded: number,
  existingPlacements: TrellisPlanting[]
): { canPlace: boolean, availableSegments: [start, end][] } {
  // Find all occupied segments
  const occupiedSegments = existingPlacements.map(p => [
    p.trellisPositionStartInches,
    p.trellisPositionEndInches
  ]);

  // Find gaps (available segments)
  const availableSegments = findGaps(
    0,
    trellis.totalLengthInches,
    occupiedSegments
  );

  // Check if any gap is large enough
  const linearInchesNeeded = linearFeetNeeded * 12;
  const canPlace = availableSegments.some(
    ([start, end]) => (end - start) >= linearInchesNeeded
  );

  return { canPlace, availableSegments };
}
```

---

## Migration Strategy

### Backward Compatibility

**Existing crops unaffected**:
- Grid/row/broadcast crops continue to work unchanged
- Trellis system is opt-in (only affects crops with `trellisRequired: true`)

**Grape transition**:
1. Grapes currently use `plant_spacing` (placeholder)
2. When trellis system implemented:
   - Update `grape-1` config: `plantingStyle: 'trellis_linear'`
   - Add: `trellisRequired: true`, `linearFeetPerPlant: 5`
3. Existing grape placements (if any):
   - Keep as-is in grid (legacy support)
   - Show warning: "Grapes should be on trellis for proper spacing"
   - Offer migration tool to convert to trellis placement

---

## Testing Plan

### Unit Tests

1. **Trellis length calculation**
   - Test Pythagorean distance: `sqrt((x2-x1)² + (y2-y1)²)`
   - Test various orientations (N-S, E-W, diagonal)

2. **Capacity calculation**
   - Test exact divisions: 20 ft ÷ 5 ft = 4
   - Test fractional: 22 ft ÷ 5 ft = 4.4 → 4 plants (round down)
   - Test insufficient: 3 ft with 5 ft/plant = 0 plants

3. **Collision detection**
   - Test non-overlapping placements
   - Test boundary conditions (0 ft, max ft)
   - Test gap finding with multiple plants

### Integration Tests

1. **Create trellis + place plant**
   - Create 20 ft trellis
   - Place 4 grapes at 5 ft intervals
   - Verify database stores correct positions

2. **Capacity enforcement**
   - Try to place 5th grape on 20 ft trellis
   - Verify rejection with helpful error message

3. **Multi-year tracking**
   - Place grape in Year 1
   - Verify harvest disabled
   - Fast-forward to Year 3
   - Verify harvest enabled

### User Acceptance Tests

1. **Trellis creation workflow**
   - User creates trellis structure
   - Verifies it appears in garden designer
   - Verifies capacity is calculated correctly

2. **Grape planting workflow**
   - User selects grape from palette
   - System requires trellis selection
   - User selects trellis
   - Grape placed successfully
   - Visual extent shown on trellis

3. **Capacity warning**
   - Fill trellis to capacity
   - Try to place one more plant
   - See clear error: "Grape Trellis is at capacity (0 ft available)"

---

## Future Enhancements

### Phase 7+: Advanced Features

1. **Trellis templates**
   - Pre-configured trellis types (standard grape arbor, cattle panel arch, etc.)
   - One-click setup with recommended dimensions

2. **3D visualization**
   - Show trellis height in 3D garden view
   - Visualize vine growth over time

3. **Automated spacing recommendations**
   - "Your 30 ft trellis can fit 6 grapes or 2 kiwi"
   - AI-suggested optimal plant combinations

4. **Trellis health tracking**
   - Maintenance logs (repair wires, replace posts)
   - Track trellis age and condition

5. **Multi-level trellises**
   - Grape arbor with beans below (vertical stacking)
   - Track plants on different trellis levels

6. **Espalier support**
   - Special trellis type for espalier trees
   - Track branch training patterns

---

## Related Documentation

- **Plant Database**: `frontend/src/data/plantDatabase.ts` (grape-1 entry)
- **Types**: `frontend/src/types.ts` (PlantType, planting styles)
- **Backend Models**: `backend/models.py` (PlantingEvent, future TrellisStructure)
- **Garden Designer**: `frontend/src/components/GardenDesigner.tsx`

---

## Decision Log

### Why Not Use Grid Placement for Grapes?

**Problem**: Grid placement assumes 2D spacing (e.g., 60" × 60" square per plant).

**Reality**: Grapes need 1D spacing (5 ft along trellis line, negligible width perpendicular to trellis).

**Example**:
- Grid: 5 ft × 5 ft = 25 sq ft per plant (wasteful, incorrect model)
- Trellis linear: 5 ft × 0 ft = 5 linear ft per plant (correct model)

**Conclusion**: Trellis crops fundamentally require different spatial model (linear vs area).

### Why Not Use Row-Based Placement?

**Problem**: Row-based assumes linear seeding with seed density (e.g., 3 seeds per inch).

**Reality**: Grapes are discrete plants with large linear allocation (5 ft per plant, not 3 seeds per inch).

**Conclusion**: Row-based is for dense seeding, trellis linear is for discrete plants with large spacing.

---

## Contact

**Implementation Questions**: See `CLAUDE.md` for project guidelines
**Feature Requests**: This is a design doc - implementation TBD

---

## Phase 7: Garden Designer Integration (Planned)

**Status**: Planned for implementation
**Priority**: High (improves UX significantly)
**Goal**: Allow bed-scoped trellis management directly from Garden Designer

### Problem
Currently, trellises can only be managed from Property Designer. When working in Garden Designer on a specific bed, users must:
- Switch to Property Designer to create trellises
- Remember which trellises belong to which beds
- Navigate back to Garden Designer to place plants

### Solution
Add a "Manage Trellises" button to Garden Designer that opens a bed-scoped trellis manager modal.

### Features
1. **Bed-Scoped Trellis View**
   - Show only trellises assigned to active bed
   - Filter trellises by `gardenBedId`
   - Automatic bed linking when creating new trellises

2. **Capacity Display with Plant Details**
   - Show which plants occupy each trellis
   - Display plant names and varieties
   - Visual capacity bar (occupied vs available)
   - Example: "Grape Trellis: 15ft occupied (Grape 'Concord' x3), 5ft available"

3. **Inline Trellis Management**
   - Create new trellises without leaving Garden Designer
   - Edit existing bed trellises
   - Delete trellises (with validation)
   - Visual indicator badge showing bed has trellises

4. **Simplified Coordinate Input**
   - Bed-relative coordinate system (optional)
   - Automatic propertyId assignment
   - Simpler form than property-wide version

### Implementation Details
- New component: `frontend/src/components/GardenDesigner/TrellisManagerModal.tsx`
- Button placement: After "Insert Guild" button in left panel
- Button style: Blue (matches "Edit" and "Manage" operations)
- Modal pattern: Similar to ConflictAuditModal structure
- No backend changes needed (API already supports bed filtering)

### User Workflow
1. User working in Garden Designer on "Main Vegetable Bed"
2. Clicks "Manage Trellises" button
3. Modal opens: "Trellises for Main Vegetable Bed"
4. Sees existing trellises (if any) with capacity info
5. Clicks "Add Trellis"
6. Creates 20ft trellis (bed automatically linked)
7. Closes modal
8. Drags grape plant to bed
9. PlantConfigModal shows new trellis in dropdown
10. Selects trellis and places grape

### Benefits
- **Contextual workflow**: Manage trellises while working on the bed
- **Reduced navigation**: No switching between Designer views
- **Clearer organization**: See only relevant trellises
- **Faster placement**: Create trellis → place plant in same view

---

## Phase 8+: Advanced Future Enhancements

### Visual Trellis Overlay on Grid
- Display trellises directly on garden bed grid
- Visual representation of occupied segments
- Click trellis segments to see plant details
- Drag-and-drop plants along trellis line

### Drag-to-Create Trellises
- Click-and-drag to draw trellis on grid
- Real-time length calculation as user drags
- Snap to grid boundaries
- One-step trellis creation

### Trellis Templates
- Pre-configured common setups:
  - "Standard Grape Arbor" (20ft, post_wire)
  - "Cattle Panel Arch" (16ft, a-frame)
  - "Garden Fence Trellis" (variable length, fence type)
- One-click template application
- Customizable after creation

### Copy Trellis from Another Bed
- Select existing trellis from different bed
- Clone configuration to current bed
- Automatic coordinate adjustment
- Useful for consistent setups across beds

### Bulk Trellis Creation
- Create multiple identical trellises at once
- Example: "Create 3 trellises, each 10ft, spaced 5ft apart"
- Automatic naming (Trellis 1, Trellis 2, Trellis 3)
- Time-saver for large gardens

### Export/Import Trellis Configurations
- Export trellis layouts as JSON
- Import pre-designed trellis systems
- Share configurations between users
- Template marketplace potential

### Auto-Suggest Trellis Placement
- AI-powered recommendations based on:
  - Available bed space
  - Sun exposure patterns
  - Planned crops requiring trellises
  - Optimal spacing for crop rotation
- "Your bed can fit a 15ft trellis along the north edge"

### Multi-Bed Trellis View
- See all trellises across multiple beds
- Property-wide capacity summary
- Identify underutilized trellises
- Plan crop distribution across beds

### Trellis Maintenance Calendar
- Track trellis maintenance tasks:
  - Wire tightening
  - Post replacement
  - Winter preparation
  - Spring setup
- Reminders based on trellis age
- Maintenance history log

### Yield Tracking Per Trellis Segment
- Record harvest yields by linear position
- Identify high/low producing segments
- Correlate with sun exposure, soil quality
- Optimize future plantings based on data

### Companion Planting on Trellises
- Suggest companion plants for trellis crops
- Example: Plant nasturtiums at trellis base for aphid control
- Guild integration for vertical growing
- Multi-species trellis management

### Seasonal Trellis Rotation
- Track annual vs perennial on same trellis
- Plan succession: beans in spring, cucumbers in summer
- Show historical timeline of trellis usage
- Optimize trellis utilization year-round

---

**Last Updated**: 2026-01-20
**Document Version**: 2.0
**Status**: Phases 1-4 Complete, Phase 7+ Planned
