# Tree & Shrub Placement - Implementation Plan

**Status:** Phase 1 In Progress
**Started:** 2025-11-20
**Estimated Time:** 4-6 hours

## Overview

Enable users to place fruit trees, nut trees, and berry shrubs directly on the Property Designer with full timeline integration and harvest tracking.

## Objectives

- Allow individual tree placement from plant database
- Auto-create PlantingEvents with multi-year maturity tracking
- Display trees with distinct icons per variety
- Integrate with existing timeline and harvest tracking
- Support collision detection based on tree spacing requirements

## Three-Phase Roadmap

### Phase 1: Individual Tree Placement (MVP) ⏳ IN PROGRESS
**Time:** 4-6 hours | **Complexity:** LOW

**Features:**
- Add "Trees & Shrubs" palette section in PropertyDesigner
- Drag-drop trees from plant database onto property map
- Auto-create PlantingEvent with years-to-maturity
- Render trees as circles with emoji icons (🍎🍐🍒🍑🌰🫐)
- Collision detection using plant spacing data

**Why Start Here:**
- Quick implementation (reuse 90% existing code)
- Unlocks all 16 tree varieties immediately
- Validates user demand before building complex features

### Phase 2: Multi-Year Timeline View 📅 FUTURE
**Time:** 6-8 hours | **Complexity:** MEDIUM

**Features:**
- Add zoom controls: Month / Year / 5-Year / 10-Year
- Display "Years to Maturity" badges on timeline bars
- Handle recurring harvests for perennials
- Optimize performance for long time spans

### Phase 3: Orchard Beds (Grouped) 🌳 FUTURE
**Time:** 12-16 hours | **Complexity:** HIGH

**Features:**
- Create OrchardBed model (similar to GardenBed)
- Build Orchard Designer with 5ft grid system
- Place entire orchards as single units
- Orchard-level filtering in timeline

**Decision Point:** Only proceed if users have 10+ trees and request grouping

## Available Tree Inventory

### Fruit Trees (9 varieties)
- 🍎 Apple (20' spacing, 5 years to fruit, needs cross-pollination)
- 🍐 Pear (20' spacing, 5 years, needs cross-pollination)
- 🍒 Cherry Sweet (20' spacing, 4 years, needs cross-pollination)
- 🍒 Cherry Sour (15' spacing, 4 years, SELF-FERTILE)
- 🍑 Peach (17' spacing, 3 years, SELF-FERTILE)
- Plum (20' spacing, 4 years, some self-fertile)
- Apricot (17' spacing, 3 years, SELF-FERTILE)
- Fig (15' spacing, 2 years, SELF-FERTILE - FASTEST!)
- Persimmon (20' spacing, 5 years)

### Nut Trees (4 varieties)
- 🌰 Almond (20' spacing, 5 years, needs cross-pollination)
- Walnut (40' spacing, 7 years, ALLELOPATHIC - toxin kills tomatoes)
- Pecan (40' spacing, 7 years, massive tree 70-100ft)
- Hazelnut (15' spacing, 2 years, FAST for a nut)

### Berry Shrubs (3 varieties)
- 🍓 Strawberry (1' spacing, 90 days, perennial)
- 🫐 Raspberry (2' spacing, 1 year, second-year canes)
- Blueberry (4' spacing, 2 years, needs acidic soil)

**Total:** 16 perennial varieties with full agronomic data

## Technical Approach

### Reuse Existing Patterns

**From Garden Designer Integration:**
- Drag-drop structure placement → Apply to trees
- Auto-create PlantingEvent on drop → Reuse exact pattern
- Position-based matching (x, y coords) → Same for trees
- Harvest tracking visuals → Works for perennials

**From Resize Handles:**
- Circle rendering (shape_type: 'circle') → Perfect for tree canopy
- Custom dimensions → Tree spacing from plant database

### Data Flow

```
User Drags Tree → Drop on Property Map
         ↓
Create PlacedStructure
  - structure_id: plant_id (e.g., 'apple-1')
  - position_x, position_y: drop location
  - custom_width/length: from plant.spacing
  - shape_type: 'circle' (canopy)
         ↓
Auto-Create PlantingEvent
  - plant_id: 'apple-1'
  - garden_bed_id: NULL (property-level)
  - direct_seed_date: today
  - expected_harvest_date: today + (plant.daysToMaturity / 365) years
  - space_required: calculated from spacing
         ↓
Timeline Shows Tree
  - Timeline bar spans planting → first harvest
  - Badge: "Year 3 of 5" (maturity progress)
  - Annual harvest indicators after maturity
```

## Implementation Tasks

### Task 1: Add Tree Palette Section
- [ ] Filter plant database for categories: 'fruit', 'nut', perennial berries
- [ ] Create "Trees & Shrubs" section in structure palette
- [ ] Show tree cards with icon, name, spacing, years to maturity
- [ ] Make trees draggable (reuse DraggableStructureCard pattern)

### Task 2: Extend Drag-Drop Handlers
- [ ] Modify handleDragStart to support plant IDs (not just structure IDs)
- [ ] Fetch plant data on drag start
- [ ] Calculate tree dimensions from plant.spacing
- [ ] Pass plant data to drag overlay

### Task 3: Handle Tree Drop
- [ ] Detect drop of plant-based tree (vs structure)
- [ ] Create PlacedStructure with plant_id as structure_id
- [ ] Set shape_type: 'circle' for tree canopy
- [ ] Validate placement (collision, boundaries)

### Task 4: Auto-Create PlantingEvent
- [ ] Reuse pattern from garden timeline integration
- [ ] POST to /api/planting-events with:
  - plant_id from dropped tree
  - garden_bed_id: NULL (property-level)
  - position_x, position_y from PlacedStructure
  - direct_seed_date: today (or user-selected)
  - expected_harvest_date: calculate from daysToMaturity
- [ ] Handle errors (duplicate placement, invalid dates)

### Task 5: Tree-Specific Rendering
- [ ] Render trees as circles (already supported)
- [ ] Map plant icons to emoji (apple-1 → 🍎)
- [ ] Show tree name label
- [ ] Add maturity indicator (Year 1, Year 2, etc.)

### Task 6: Timeline Integration
- [ ] Verify trees appear in timeline view
- [ ] Show multi-year maturity span
- [ ] "View on Property" button works for trees
- [ ] Harvest tracking works (mark as harvested)

### Task 7: Testing
- [ ] Place single apple tree → verify PlantingEvent created
- [ ] Timeline shows 5-year span for apple
- [ ] Collision detection works (can't overlap trees)
- [ ] Spacing validation (warns if trees too close)
- [ ] Edit tree variety → updates PlantingEvent
- [ ] Mark tree as harvested → visual feedback

## Success Criteria

**Phase 1 Complete When:**
- ✅ Users can drag 16 tree varieties onto property
- ✅ Trees render as circles with correct spacing
- ✅ PlantingEvent auto-created with multi-year dates
- ✅ Timeline shows trees with maturity indicators
- ✅ Harvest tracking works for perennial harvests
- ✅ No regressions (gardens, structures still work)

## Files to Modify

### Frontend
- `frontend/src/components/PropertyDesigner.tsx` (~150 lines added)
  - Add tree palette section (lines ~1545-1580)
  - Extend drag handlers (lines ~467-527)
  - Auto-create PlantingEvent on drop (lines ~855-904)

### Backend
- No changes needed! Plant database has all data
- API endpoints already support property-level PlantingEvents

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Timeline cluttered with 5-year events | Medium | Add Phase 2 (multi-year zoom) |
| Trees overlap due to manual placement | Low | Collision detection + spacing hints |
| Performance with 100+ trees | Low | Lazy rendering (existing optimization) |
| Users confused by tree vs structure | Medium | Clear labeling, tooltips |

## Future Enhancements (Post-Phase 1)

1. **Pollination Wizard**: Suggest compatible varieties for cross-pollination
2. **Chill Hours Check**: Validate trees meet climate requirements
3. **Spacing Optimizer**: Auto-arrange trees for optimal layout
4. **Guild Planting**: Suggest companion plants for understory
5. **Allelopathy Warnings**: Alert if planting incompatible plants nearby
6. **Rootstock Selector**: Choose dwarf/semi-dwarf/standard sizes
7. **Multi-Year Harvest Log**: Track actual yields year-over-year

## References

- Plant Database: `backend/plant_database.py` lines 1254-2219
- Garden Timeline Integration: `dev/completed/timeline-garden-integration/`
- Resize Handles: `dev/completed/resize-handles/`
- Property Designer: `frontend/src/components/PropertyDesigner.tsx`

---

**Next Step:** Begin Task 1 - Add tree palette section to PropertyDesigner
