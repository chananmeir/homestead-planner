# Move Trees to Property Designer - Context

**Created**: 2026-01-18
**Last Updated**: 2026-01-18
**Status**: Planning Phase

## Executive Summary

This task was initially framed as "moving trees" to Property Designer, but investigation revealed that **trees have never been implemented anywhere else**. The actual task is to **complete the existing tree-placement implementation plan** (Phase 1) that was started on 2025-11-20 but never finished.

## Key Discovery

**Existing Documentation**: `dev/active/tree-placement/tree-placement-plan.md`
- Status marked as "Phase 1 In Progress" since 2025-11-20
- Comprehensive 221-line implementation plan exists
- **No actual code implementation has been done yet**
- Missing: context.md and tasks.md files (incomplete dev docs)

## Current State Analysis

### Where Trees Currently Exist

**Backend - Plant Database** (`backend/plant_database.py`):
- ✅ **33 tree varieties** with complete data
  - 9 fruit trees (apple, pear, cherry, peach, plum, apricot, fig, persimmon, nectarine)
  - 5 nut trees (almond, walnut, pecan, hazelnut, chestnut)
  - 19 additional fruit trees (Asian pear, citrus, berries, etc.)
- ✅ All have spacing, daysToMaturity, companion plants, notes
- ✅ All have emoji icons assigned (🍎🍐🍒🍑🌰 etc.)

**Frontend - Where Trees Are NOT**:
- ❌ NOT in PlantingCalendar (only shows annual crops currently)
- ❌ NOT in GardenDesigner (focused on bed-level planting)
- ❌ NOT in PropertyDesigner (plan exists, but not implemented)
- ❌ NOT accessible to users anywhere in UI

**Icon Status**:
- ✅ Emoji icons exist for all trees (backend plant_database.py)
- ❌ **NO PNG icons exist for any fruit/nut trees**
  - 88 plant PNG icons exist in `frontend/public/plant-icons/`
  - Berry shrubs have PNGs: strawberry-1.png, raspberry-1.png, blueberry-1.png
  - **Zero tree PNG icons**: no apple-1.png, pear-1.png, etc.

### Property Designer Current Capabilities

**Already Implemented**:
- ✅ Drag-and-drop structure placement
- ✅ Multi-level grid system (1ft, 10ft, 50ft)
- ✅ Professional scale indicators and rulers
- ✅ Snap-to-grid (1ft precision)
- ✅ Collision detection between structures
- ✅ Circle shape rendering (shape_type: 'circle')
- ✅ Garden bed integration (beds appear as placeable structures)
- ✅ Custom dimensions support
- ✅ Real-time coordinate display during drag

**What PropertyDesigner Has**:
- Structure palette with categories: garden, livestock, storage, compost, water, **orchard**
- Collision rules already include 'orchard' category
- SVG rendering supports circles (perfect for tree canopy visualization)
- Scale: 10 pixels = 1 foot

### Architecture Patterns Available

**From Garden Bed Integration** (completed 2025-11-19):
- Pattern: Backend `/api/structures` returns both static structures AND dynamic items (garden beds)
- Frontend treats all as structures with consistent drag-drop
- New category added: "My Garden Beds"
- Links back to source via foreign key (gardenBedId)

**Reusable Pattern for Trees**:
1. Add trees to structure palette as "Trees & Shrubs" category
2. Fetch from plant database (category: 'fruit' or 'nut')
3. Drag-drop creates PlacedStructure with plant_id as structure_id
4. Set shape_type: 'circle' for canopy visualization
5. Auto-create PlantingEvent on drop (property-level, no bed)

## Architectural Decisions

### Why Trees Belong in Property Designer

**Spatial Scale**:
- Trees require 15-40ft spacing (walnut: 40ft, hazelnut: 15ft)
- GardenDesigner beds are typically 4ft wide, 8-20ft long
- **Trees operate at property scale, not bed scale**

**Lifecycle**:
- Trees are multi-year perennials (5-50+ years productive)
- Gardens are typically planned annually or seasonally
- **Trees are permanent property features like structures**

**Companion Planting**:
- Trees create zones (understory planting, guild systems)
- Affect entire areas of property (shade, root competition)
- **Property-level planning tool is appropriate**

### Relationship to Other Components

**PlantingCalendar**:
- Trees will appear in timeline view once PlantingEvent is created
- Multi-year maturity tracking (Year 1, Year 2... Year 5, etc.)
- Harvest logging for mature trees

**GardenDesigner**:
- Remains focused on annual/bed-level planting
- Could later support understory planting beneath trees
- No changes needed for tree feature

**HarvestTracker**:
- Will work automatically once PlantingEvents exist
- Perennial harvest tracking already supported

## Data Model

### Current Database Schema

**PlacedStructure Model** (already exists):
```python
id: Integer (Primary Key)
property_id: Integer (Foreign Key to Property)
structure_id: String  # Will hold plant_id for trees (e.g., 'apple-1')
garden_bed_id: Integer (Foreign Key, nullable)  # NULL for trees
position_x: Float  # Feet from top-left corner
position_y: Float
custom_width: Float (nullable)  # Will store tree spacing
custom_length: Float (nullable)  # Will store tree spacing
shape_type: String (nullable)  # Will be 'circle' for trees
rotation: Integer
notes: Text (nullable)
cost: Float (nullable)
```

**PlantingEvent Model** (already exists):
```python
id: Integer
plant_id: String  # Links to plant database (e.g., 'apple-1')
garden_bed_id: Integer (nullable)  # NULL for property-level trees
position_x: Float (nullable)  # From PlacedStructure
position_y: Float (nullable)
direct_seed_date: Date
expected_harvest_date: Date  # Calculated from daysToMaturity
space_required: Float  # Calculated from plant spacing
variety: String (nullable)
```

**No Database Changes Required!** All models already support tree placement.

## Technical Implementation Notes

### Tree Rendering

**Visual Representation**:
- Shape: Circle (represents canopy spread)
- Diameter: Based on plant.spacing (e.g., apple: 240 inches = 20ft)
- Fill: Semi-transparent green (#86efac with opacity)
- Icon: Emoji centered in circle (🍎🍐🍒🍑🌰)
- Label: Tree name below icon

**Scale Example**:
- Apple tree: 20ft spacing = 200px diameter circle (at 10px/ft scale)
- Hazelnut: 15ft = 150px diameter
- Walnut: 40ft = 400px diameter

### Auto-PlantingEvent Creation

**Data Flow**:
```
User drags apple tree → Drops at (50, 75) on property
    ↓
Create PlacedStructure:
  - structure_id: 'apple-1'
  - position_x: 50, position_y: 75
  - shape_type: 'circle'
  - custom_width: 20, custom_length: 20
    ↓
Auto-Create PlantingEvent:
  - plant_id: 'apple-1'
  - garden_bed_id: NULL
  - position_x: 50, position_y: 75
  - direct_seed_date: today (or user-selected planting date)
  - expected_harvest_date: today + (1825 days / 365) = ~5 years
  - space_required: π * (10ft)^2 ≈ 314 sq ft
    ↓
Timeline shows:
  - Bar from today → 5 years out
  - Badge: "Year 1 of 5" (progress indicator)
  - First harvest marker at year 5
```

### Collision Detection

**Tree-Specific Rules**:
- Trees must not overlap other trees (center-to-center distance ≥ combined radii)
- Trees must not overlap structures in 'orchard' conflict list
- Trees can overlap garden beds (intentional - for guild planting)
- Warning if too close to buildings/storage

**Implementation**:
```typescript
const treeRadius = plant.spacing / 2; // feet
const conflictCheck = {
  centerX: positionX,
  centerY: positionY,
  radius: treeRadius,
  category: 'orchard'
};
```

## Icon Requirements

### Current Icon Status

**What We Have**:
- Emoji icons: ✅ All 33 trees have emojis in plant_database.py
- PNG icons: ❌ Zero tree icons exist

**What We Need**:
For Phase 1 MVP, **emoji icons are sufficient**. PNG icons can be added later.

**Future Icon Creation** (Post-MVP):
- 9 fruit trees need PNGs: apple, pear, cherry, peach, plum, apricot, fig, persimmon, nectarine
- 5 nut trees need PNGs: almond, walnut, pecan, hazelnut, chestnut
- 19 additional fruit trees: citrus, Asian pear, quince, mulberry, pawpaw, etc.
- **Total: 33 PNG icons needed** for full coverage

**Icon Approach**:
- Use emoji for MVP (already working in plant database)
- Create PNG icons in batches (fruit trees first, then nuts)
- Follow existing icon style (seen in strawberry-1.png, raspberry-1.png, etc.)

## Files to Modify

### Backend (Minimal/None)

**No backend changes required!** The plant database and API endpoints already support everything needed.

**Optional Enhancement** (`backend/app.py`):
- Add helper function to auto-create PlantingEvent on tree placement
- Could be done in frontend or backend (frontend is simpler for MVP)

### Frontend

**Primary File**: `frontend/src/components/PropertyDesigner.tsx` (~1319 lines)

**Sections to Modify**:
1. **Line ~149-160**: Update `loadData()` to fetch plants for tree palette
2. **Line ~1545-1580**: Add "Trees & Shrubs" palette section (new)
3. **Line ~467-527**: Extend drag handlers to support plant-based trees
4. **Line ~855-904**: Auto-create PlantingEvent on tree drop (new)
5. **Line ~600-800**: Add tree rendering in SVG map (circles with icons)

**Estimated Changes**: ~200-250 lines added, ~20 lines modified

### New Files (Optional)

**Component for Tree Palette** (optional refactor):
- `frontend/src/components/PropertyDesigner/TreePalette.tsx`
- Would clean up PropertyDesigner.tsx (already 1319 lines)
- Not required for MVP

## Testing Strategy

### Manual Testing Checklist

**Phase 1 - Basic Placement**:
- [ ] Tree palette appears with 33 varieties
- [ ] Can drag apple tree onto property
- [ ] Tree renders as circle with emoji icon
- [ ] Tree snaps to 1ft grid
- [ ] Coordinate display shows position during drag

**Phase 2 - Data Persistence**:
- [ ] PlacedStructure saved to database
- [ ] Tree appears on page reload
- [ ] Can click tree to edit details
- [ ] Can delete tree

**Phase 3 - PlantingEvent Integration**:
- [ ] PlantingEvent auto-created on tree drop
- [ ] Tree appears in PlantingCalendar timeline
- [ ] Multi-year span shown (e.g., 5 years for apple)
- [ ] "View on Property" button navigates to PropertyDesigner

**Phase 4 - Collision & Validation**:
- [ ] Can't place trees overlapping each other
- [ ] Warning if too close to building
- [ ] Trees can overlap garden beds (allowed)

**Phase 5 - Advanced Features**:
- [ ] Can filter trees by type (fruit/nut)
- [ ] Spacing requirements shown in tooltip
- [ ] Cross-pollination warnings (needs 2+ trees)

## Related Work

**Completed Projects**:
- Garden Beds ↔ Property Integration (2025-11-19)
- Property Designer Grid Enhancements (2025-11-12)
- Resize Handles (completed)

**Active Projects**:
- Tree Placement Plan (2025-11-20, incomplete)
- Multiple Property Designer enhancements

**This Project Completes**: Tree Placement Phase 1

## Known Issues & Risks

### Risks

**Medium Risk**:
- Timeline cluttered with multi-year events (mitigation: Phase 2 adds zoom controls)
- Users confused by tree vs structure (mitigation: clear labeling, separate palette section)

**Low Risk**:
- Performance with 100+ trees (existing lazy rendering handles this)
- Emoji rendering inconsistency across browsers (fallback to PNG icons later)

### Dependencies

**Hard Dependencies**:
- PlantingCalendar must support NULL garden_bed_id (already does)
- Property Designer drag-drop system (already works)

**Soft Dependencies**:
- Tree PNG icons (not required for MVP, emoji works)

## Next Steps

1. **Complete dev docs** (context.md ✓, plan.md exists, tasks.md needed)
2. **Get user approval** on implementation approach
3. **Implement Phase 1** following existing tree-placement-plan.md
4. **Test thoroughly** with multiple tree varieties
5. **Document in CLAUDE.md** for future reference

---

**Last Updated**: 2026-01-18
**Status**: Planning Complete, Awaiting User Approval
