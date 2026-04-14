# Move Trees to Property Designer - Implementation Plan

**Created**: 2026-01-18
**Status**: Planning Phase
**Estimated Time**: 4-6 hours (Phase 1 only)

## Important Note

This plan **consolidates and continues** the existing `tree-placement-plan.md` (created 2025-11-20). The original plan is excellent and will be followed. This document adds:
- Updated analysis based on current codebase state
- Detailed implementation steps
- User approval workflow
- Icon creation strategy

**Original Plan**: `dev/active/tree-placement/tree-placement-plan.md` (221 lines, comprehensive)
**This Plan**: Adds project management, approval gates, and coordination details

## Executive Summary

**What We're Building**: Enable users to place 33 varieties of fruit and nut trees on their Property Designer map with automatic timeline integration and harvest tracking.

**Current State**: Trees exist in backend plant database but are not accessible anywhere in the UI.

**Target State**: Trees available as draggable items in Property Designer, creating PlantingEvents that appear in timeline/harvest tracking.

## Phase 1: Implementation (4-6 hours)

This follows the original tree-placement-plan.md tasks exactly.

### Task 1: Add Tree Palette Section (1 hour)

**Objective**: Create "Trees & Shrubs" section in PropertyDesigner structure palette.

**Implementation**:
1. **Fetch tree data from backend**:
   ```typescript
   // In loadData() function (~line 136)
   const plantsResponse = await apiGet('/api/plants');
   const plantsData = await plantsResponse.json();
   const trees = plantsData.filter(p =>
     p.category === 'fruit' || p.category === 'nut'
   );
   setTreePlants(trees);
   ```

2. **Add state for tree plants**:
   ```typescript
   const [treePlants, setTreePlants] = useState<Plant[]>([]);
   ```

3. **Create tree palette UI** (after existing structure palette ~line 1545):
   ```tsx
   {/* Trees & Shrubs Section */}
   <div className="mb-6">
     <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
       <span className="text-2xl">🌳</span>
       Trees & Shrubs
       <span className="text-sm font-normal text-gray-500">({treePlants.length})</span>
     </h3>
     <div className="grid grid-cols-2 gap-2">
       {treePlants.map(tree => (
         <DraggableTreeCard key={tree.id} tree={tree} />
       ))}
     </div>
   </div>
   ```

4. **Create DraggableTreeCard component**:
   - Similar to DraggableStructureCard
   - Shows: icon (emoji), name, spacing, years to maturity
   - Draggable with plant data attached

**Files Modified**:
- `frontend/src/components/PropertyDesigner.tsx` (~80 lines added)

**Success Criteria**:
- ✅ Tree palette section visible in sidebar
- ✅ 33 trees displayed with emoji icons
- ✅ Trees are draggable
- ✅ Hover shows spacing and maturity info

---

### Task 2: Extend Drag-Drop Handlers (1 hour)

**Objective**: Modify drag handlers to support both structures AND trees.

**Implementation**:

1. **Update DragStartEvent handler** (~line 467):
   ```typescript
   const handleDragStart = (event: DragStartEvent) => {
     const { active } = event;

     // Check if dragging a structure or a tree
     if (active.data.current?.type === 'tree') {
       const plant = active.data.current.plant;

       // Convert plant to structure-like format for rendering
       const treeStructure: Structure = {
         id: plant.id,
         name: plant.name,
         category: 'orchard',
         width: plant.spacing / 12,  // inches to feet
         length: plant.spacing / 12,
         icon: plant.icon,
         shapeType: 'circle'
       };

       setDraggedStructure(treeStructure);
     } else {
       // Existing structure drag logic
       const structure = structures.find(s => s.id === active.id.toString());
       setDraggedStructure(structure || null);
     }
   };
   ```

2. **Update drag overlay rendering**:
   - Show circle preview for trees (not rectangle)
   - Display tree icon in center
   - Show diameter/spacing info

3. **Add tree-specific validation**:
   ```typescript
   const validateTreePlacement = (
     tree: Plant,
     x: number,
     y: number,
     property: Property
   ) => {
     const radius = (tree.spacing / 12) / 2; // feet

     // Check boundaries
     const isContained = (
       x - radius >= 0 &&
       x + radius <= property.width &&
       y - radius >= 0 &&
       y + radius <= property.length
     );

     // Check tree-to-tree conflicts
     const conflicts = property.placedStructures?.filter(ps => {
       if (ps.shapeType !== 'circle') return false;
       const distance = Math.sqrt(
         Math.pow(ps.positionX - x, 2) +
         Math.pow(ps.positionY - y, 2)
       );
       const minDistance = radius + (ps.custom_width / 2);
       return distance < minDistance;
     }) || [];

     return { isContained, conflicts };
   };
   ```

**Files Modified**:
- `frontend/src/components/PropertyDesigner.tsx` (~60 lines modified, ~40 added)

**Success Criteria**:
- ✅ Can start dragging a tree
- ✅ Drag overlay shows circle with tree icon
- ✅ Coordinate display works for trees
- ✅ Validation prevents overlapping trees

---

### Task 3: Handle Tree Drop & Save (1 hour)

**Objective**: Create PlacedStructure when tree is dropped on property.

**Implementation**:

1. **Extend handleDragEnd** (~line 520):
   ```typescript
   const handleDragEnd = async (event: DragEndEvent) => {
     const { active, over } = event;

     if (!over || !selectedProperty) return;

     // Get drop position
     const mapElement = document.getElementById('property-map-svg');
     const rect = mapElement.getBoundingClientRect();
     const x = Math.round(((event.activatorEvent.clientX - rect.left) / PROPERTY_SCALE) / GRID_SNAP_SPACING) * GRID_SNAP_SPACING;
     const y = Math.round(((event.activatorEvent.clientY - rect.top) / PROPERTY_SCALE) / GRID_SNAP_SPACING) * GRID_SNAP_SPACING;

     if (active.data.current?.type === 'tree') {
       const plant = active.data.current.plant;

       // Validate placement
       const validation = validateTreePlacement(plant, x, y, selectedProperty);
       if (!validation.isContained || validation.conflicts.length > 0) {
         showError('Cannot place tree here - check spacing and boundaries');
         return;
       }

       // Create PlacedStructure
       const placedStructure = {
         property_id: selectedProperty.id,
         structure_id: plant.id,  // e.g., 'apple-1'
         position_x: x,
         position_y: y,
         custom_width: plant.spacing / 12,  // inches to feet
         custom_length: plant.spacing / 12,
         shape_type: 'circle',
         rotation: 0,
         notes: `${plant.name} tree - ${plant.notes?.split('.')[0] || ''}`
       };

       const response = await apiPost('/api/placed-structures', placedStructure);
       if (!response.ok) {
         showError('Failed to place tree');
         return;
       }

       const savedStructure = await response.json();

       // Auto-create PlantingEvent (Task 4 functionality)
       await createPlantingEventForTree(plant, savedStructure);

       // Reload property to show new tree
       await loadData();
       showSuccess(`${plant.name} tree placed successfully!`);
     } else {
       // Existing structure drop logic
     }
   };
   ```

**Files Modified**:
- `frontend/src/components/PropertyDesigner.tsx` (~50 lines added)

**Success Criteria**:
- ✅ Dropping tree creates PlacedStructure in database
- ✅ Tree appears on map immediately
- ✅ Error shown if placement invalid
- ✅ Success toast confirms placement

---

### Task 4: Auto-Create PlantingEvent (1.5 hours)

**Objective**: Automatically create PlantingEvent when tree is placed, integrating with timeline.

**Implementation**:

1. **Create helper function**:
   ```typescript
   const createPlantingEventForTree = async (
     plant: Plant,
     placedStructure: PlacedStructure
   ) => {
     const today = new Date();

     // Calculate expected harvest date
     // daysToMaturity is in days, convert to date
     const harvestDate = new Date(today);
     harvestDate.setDate(harvestDate.getDate() + plant.daysToMaturity);

     // Calculate space required (circular area)
     const radiusFeet = (plant.spacing / 12) / 2;
     const spaceRequired = Math.PI * Math.pow(radiusFeet, 2);

     const plantingEvent = {
       plant_id: plant.id,
       garden_bed_id: null,  // Property-level placement
       position_x: placedStructure.positionX,
       position_y: placedStructure.positionY,
       direct_seed_date: today.toISOString().split('T')[0],
       expected_harvest_date: harvestDate.toISOString().split('T')[0],
       space_required: Math.round(spaceRequired),
       variety: null,
       notes: `Tree placed on property at (${placedStructure.positionX}, ${placedStructure.positionY})`
     };

     const response = await apiPost('/api/planting-events', plantingEvent);
     if (!response.ok) {
       console.error('Failed to create PlantingEvent for tree');
       // Don't fail the whole operation - tree is still placed
     }
   };
   ```

2. **Add to drop handler** (already included in Task 3):
   - Call `createPlantingEventForTree()` after PlacedStructure created

3. **Update PlantingCalendar to handle property-level events**:
   - Check if this is already working (garden_bed_id can be NULL)
   - If not, update filter to include `garden_bed_id IS NULL`

**Files Modified**:
- `frontend/src/components/PropertyDesigner.tsx` (~40 lines added)
- `frontend/src/components/PlantingCalendar/index.tsx` (possibly ~5 lines modified)

**Success Criteria**:
- ✅ PlantingEvent created when tree placed
- ✅ Tree appears in PlantingCalendar timeline
- ✅ Timeline shows multi-year span (e.g., 5 years for apple)
- ✅ "View on Property" button works for trees

---

### Task 5: Tree Rendering (1 hour)

**Objective**: Render trees as circles with icons on the property map.

**Implementation**:

1. **Add tree rendering to SVG** (~line 600-800):
   ```tsx
   {/* Render placed trees (circles) */}
   {selectedProperty?.placedStructures
     ?.filter(ps => ps.shapeType === 'circle')
     .map(tree => {
       const radiusPx = (tree.customWidth / 2) * PROPERTY_SCALE;
       const centerX = tree.positionX * PROPERTY_SCALE;
       const centerY = tree.positionY * PROPERTY_SCALE;

       return (
         <g key={tree.id}>
           {/* Tree canopy circle */}
           <circle
             cx={centerX}
             cy={centerY}
             r={radiusPx}
             fill="#86efac"
             fillOpacity={0.3}
             stroke="#22c55e"
             strokeWidth={2}
             className="cursor-pointer hover:fill-opacity-40"
             onClick={() => handleStructureClick(tree)}
           />

           {/* Tree icon */}
           <text
             x={centerX}
             y={centerY}
             textAnchor="middle"
             dominantBaseline="middle"
             fontSize={radiusPx > 50 ? 32 : 24}
             className="pointer-events-none"
           >
             {tree.icon || '🌳'}
           </text>

           {/* Tree name label */}
           <text
             x={centerX}
             y={centerY + radiusPx + 15}
             textAnchor="middle"
             fontSize={12}
             fill="#374151"
             className="pointer-events-none font-semibold"
           >
             {tree.name}
           </text>
         </g>
       );
     })}
   ```

2. **Add hover tooltips**:
   - Show spacing, years to maturity, companion plants
   - Use existing tooltip system or create simple one

3. **Handle tree selection/editing**:
   - Click tree → open edit modal
   - Show tree-specific info (variety, planting date, notes)
   - Allow deletion

**Files Modified**:
- `frontend/src/components/PropertyDesigner.tsx` (~60 lines added)

**Success Criteria**:
- ✅ Trees render as green circles
- ✅ Emoji icon centered in circle
- ✅ Tree name shown below circle
- ✅ Hover shows details
- ✅ Click opens edit modal

---

### Task 6: Timeline Integration Testing (30 minutes)

**Objective**: Verify trees appear correctly in PlantingCalendar timeline view.

**Testing Steps**:

1. **Place a tree** (e.g., Apple)
2. **Navigate to PlantingCalendar**
3. **Verify timeline shows**:
   - Timeline bar spanning 5 years (apple maturity)
   - Badge: "Year 1 of 5" or maturity indicator
   - Tree icon (🍎) on timeline bar
   - "View on Property" button
4. **Click "View on Property"**:
   - Should navigate to PropertyDesigner
   - Should highlight/zoom to tree location (nice-to-have)

**Potential Issues**:
- Timeline might not handle multi-year spans well (originally designed for annual crops)
- Might need to add zoom controls (Phase 2 of original plan)

**Quick Fixes**:
- If timeline looks cluttered, add filter for "Perennials Only"
- If dates look wrong, check daysToMaturity calculation

**Files to Check**:
- `frontend/src/components/PlantingCalendar/TimelineView/index.tsx`
- `frontend/src/components/PlantingCalendar/TimelineView/TimelineBar.tsx`

---

### Task 7: Testing & Validation (1 hour)

**Comprehensive Testing Checklist**:

**Basic Functionality**:
- [ ] Tree palette appears with 33 varieties
- [ ] Can drag apple tree onto property
- [ ] Tree renders as circle with emoji icon
- [ ] Tree name label visible
- [ ] Tree persists on page reload

**Placement & Validation**:
- [ ] Tree snaps to 1ft grid
- [ ] Coordinate display shows position during drag
- [ ] Cannot place tree outside property boundaries
- [ ] Cannot place overlapping trees
- [ ] Error messages clear and helpful

**Database Integration**:
- [ ] PlacedStructure saved with correct data
- [ ] shape_type is 'circle'
- [ ] custom_width matches tree spacing
- [ ] PlantingEvent created automatically

**Timeline Integration**:
- [ ] Tree appears in PlantingCalendar
- [ ] Multi-year span shown correctly
- [ ] "View on Property" works
- [ ] Can log harvest for mature tree

**Editing & Deletion**:
- [ ] Can click tree to open edit modal
- [ ] Can add notes to tree
- [ ] Can delete tree (with confirmation)
- [ ] Deleting tree removes PlantingEvent (or mark it deleted)

**Cross-Browser**:
- [ ] Emoji icons render in Chrome
- [ ] Emoji icons render in Firefox
- [ ] Emoji icons render in Safari
- [ ] Emoji icons render in Edge

**Performance**:
- [ ] Placing 10 trees performs well
- [ ] Dragging feels smooth
- [ ] Page loads quickly with trees

**Edge Cases**:
- [ ] Property with 0 width/height (should prevent placement)
- [ ] Tree with missing spacing data (should use default or error)
- [ ] Very large tree (walnut 40ft) on small property (should warn)

---

## Phase 2: Icon Creation (Future - Not Part of MVP)

**Status**: Deferred until after Phase 1 is complete and user-tested.

**Requirements**:
- 33 PNG icons needed (all fruit and nut trees)
- Follow existing icon style (see strawberry-1.png, raspberry-1.png)
- Size: Likely 512x512px or 256x256px (check existing icons)
- Style: Simple, recognizable, consistent with existing set

**Approach Options**:
1. **AI Generation**: Use DALL-E or Midjourney to create consistent set
2. **Icon Library**: Find open-source icon set (Flaticon, Noun Project)
3. **Manual Design**: Hire designer or create in Figma/Inkscape
4. **User Contribution**: Community-sourced icons

**Implementation**:
- Once icons created, update plant_database.py to reference PNG files
- Update PropertyDesigner to load PNG instead of emoji
- Add fallback: if PNG missing, use emoji

**Estimated Time**: 3-5 hours (icon creation + integration)

---

## Success Metrics

**Phase 1 Complete When**:
- ✅ Users can drag 33 tree varieties onto property
- ✅ Trees render as circles with emoji icons
- ✅ PlacedStructure created with shape_type='circle'
- ✅ PlantingEvent auto-created with multi-year dates
- ✅ Trees appear in PlantingCalendar timeline
- ✅ Harvest tracking works for trees
- ✅ Collision detection prevents overlapping
- ✅ No regressions (structures, garden beds still work)
- ✅ TypeScript compiles with 0 errors
- ✅ All manual tests pass

**User Value Delivered**:
- Can plan orchard layout on property
- Track tree planting and maturity timeline
- Log harvests from fruit/nut trees
- Visualize tree spacing and canopy coverage
- Integration with existing planning tools

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Timeline cluttered with multi-year events | High | Medium | Add "Perennials Only" filter; defer Phase 2 zoom to future |
| Users confused tree vs structure | Medium | Medium | Clear labeling, separate "Trees & Shrubs" palette section |
| Emoji rendering inconsistency | Medium | Low | Document browser requirements; plan PNG icon Phase 2 |
| Performance with 100+ trees | Low | Low | Existing lazy rendering handles this; test with 50 trees |
| PlantingEvent creation fails | Low | High | Add try-catch, don't fail tree placement if event creation fails |
| Database schema incompatibility | Very Low | High | Already verified - no changes needed |

---

## Rollback Plan

If critical issues arise during implementation:

**1. Partial Rollback** (remove tree placement, keep UI):
- Comment out tree drop handler
- Keep tree palette visible (read-only)
- Trees placed before rollback remain visible

**2. Full Rollback** (revert all changes):
```bash
git diff HEAD -- frontend/src/components/PropertyDesigner.tsx | git apply --reverse
```

**3. Database Cleanup** (if needed):
```sql
-- Remove tree PlacedStructures
DELETE FROM placed_structures WHERE shape_type = 'circle';

-- Remove tree PlantingEvents
DELETE FROM planting_events WHERE garden_bed_id IS NULL AND plant_id LIKE '%-1'
  AND plant_id IN (SELECT id FROM plants WHERE category IN ('fruit', 'nut'));
```

---

## Future Enhancements (Post-Phase 1)

From original tree-placement-plan.md:

**Phase 2: Multi-Year Timeline View** (6-8 hours):
- Add zoom controls: Month / Year / 5-Year / 10-Year
- Display "Years to Maturity" badges on timeline bars
- Handle recurring harvests for perennials
- Optimize performance for long time spans

**Phase 3: Orchard Beds (Grouped)** (12-16 hours):
- Create OrchardBed model
- Build Orchard Designer with 5ft grid
- Place entire orchards as single units
- Orchard-level filtering in timeline

**Additional Ideas**:
1. Pollination Wizard - suggest compatible varieties for cross-pollination
2. Chill Hours Check - validate trees meet climate requirements
3. Spacing Optimizer - auto-arrange trees for optimal layout
4. Guild Planting - suggest companion plants for understory
5. Allelopathy Warnings - alert if planting incompatible plants nearby (walnut kills tomatoes!)
6. Rootstock Selector - choose dwarf/semi-dwarf/standard sizes
7. Multi-Year Harvest Log - track actual yields year-over-year

---

## Files to Modify Summary

### Frontend Changes

**Primary File**: `frontend/src/components/PropertyDesigner.tsx`
- Lines ~136-160: Add tree data fetching
- Lines ~467-527: Extend drag handlers for trees
- Lines ~600-800: Add tree rendering (circles)
- Lines ~855-904: Auto-create PlantingEvent
- Lines ~1545-1580: Add tree palette section
- **Total**: ~250 lines added, ~30 lines modified

**Optional Changes**: `frontend/src/components/PlantingCalendar/index.tsx`
- Only if property-level events not showing in timeline
- ~5 lines to handle NULL garden_bed_id

### Backend Changes

**None required for MVP!** 🎉

All data models, API endpoints, and plant data already support tree placement.

---

## Implementation Order

**Recommended Sequence**:

1. **Day 1 Morning** (2 hours):
   - Task 1: Add tree palette section
   - Task 5 (partial): Add tree rendering (read-only, for testing)
   - **Checkpoint**: Can see trees in palette, can see test tree on map

2. **Day 1 Afternoon** (2 hours):
   - Task 2: Extend drag-drop handlers
   - Task 3: Handle tree drop & save
   - **Checkpoint**: Can place trees, they persist

3. **Day 2 Morning** (1.5 hours):
   - Task 4: Auto-create PlantingEvent
   - Task 6: Timeline integration testing
   - **Checkpoint**: Trees appear in timeline

4. **Day 2 Afternoon** (1.5 hours):
   - Task 5 (complete): Finish tree rendering (edit, delete)
   - Task 7: Comprehensive testing
   - **Checkpoint**: All tests pass, ready for user testing

**Total Time**: ~7 hours (slightly over estimate, includes buffer)

---

## Getting User Approval

**Before Implementation**, present to user:

1. **Summary**: "Trees aren't implemented anywhere yet. I'll add them to Property Designer as planned."

2. **What You'll Get**:
   - 33 fruit and nut trees available
   - Drag-drop placement on property
   - Automatic timeline integration
   - Emoji icons (PNG icons later)

3. **Timeline**: 4-6 hours of work

4. **Ask**: "Should I proceed with implementation, or would you like to review the detailed plan first?"

---

## References

- **Original Plan**: `dev/active/tree-placement/tree-placement-plan.md`
- **Garden Integration Pattern**: `dev/active/garden-beds-property-integration/`
- **Property Designer Enhancements**: `dev/active/property-designer-grid-enhancements/`
- **Plant Database**: `backend/plant_database.py` lines 2029-2500
- **Property Designer**: `frontend/src/components/PropertyDesigner.tsx`

---

**Last Updated**: 2026-01-18
**Status**: Ready for User Approval
**Next Action**: Present plan to user, await approval to proceed
