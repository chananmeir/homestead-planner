# Timeline-Based Planting Planning Feature - Implementation Plan

**Status**: In Progress
**Started**: 2025-11-17
**Estimated Completion**: Phase 1 - 2025-11-17

## Overview

Implement a timeline view for the Planting Calendar that allows users to visually plan plantings across time, see crop lifecycles as bars, and understand when garden space becomes available after harvest.

## User Story

As a homesteader, I want to:
- Choose a specific date (e.g., Aug 15, 2025) and plan what to plant
- See a visual timeline showing when crops are planted, growing, and harvested
- Navigate forward/backward in time to see crop progression
- Understand when space becomes available (e.g., radishes harvested Sept 29 → plant lettuce Oct 1)
- Manage succession plantings as grouped series

## Implementation Approach: 3 Phases

### Phase 1: MVP Timeline View (CURRENT)

**Goal**: Basic visual timeline showing crop lifecycles without space conflict detection

**Backend Tasks**:
1. Add `succession_group_id` field to PlantingEvent model
2. Create database migration script
3. Add date-range query support to `/api/planting-events` endpoint
4. Auto-generate succession_group_id when creating succession events

**Frontend Tasks**:
1. Create TimelineView component (horizontal Gantt chart)
2. Create TimelineBar component (individual crop lifecycle bar)
3. Create TimelineHeader component (month headers)
4. Add "Timeline" view mode to PlantingCalendar
5. Update AddCropModal to generate succession group IDs
6. Update TypeScript types

**What Users Get**:
- Visual timeline showing planting → harvest lifecycle
- Navigate months to see crop progression
- Succession plantings grouped visually
- Know harvest dates to plan next crops

**Limitations**:
- No space conflict detection (Phase 2)
- No position tracking (Phase 2)

### Phase 2: Space Awareness (Future)

**Goal**: Detect space conflicts and show availability

**Tasks**:
- Add position fields to PlantingEvent (position_x, position_y, width, height)
- Create space conflict checker API
- Add garden bed position selector to modal
- Display conflict warnings

### Phase 3: Advanced Features (Future)

**Ideas**:
- Succession planting wizard
- Auto-suggest optimal intervals
- "Show available spaces on date X" view
- Copy previous year's schedule
- Optimization recommendations

## Technical Design

### Data Model Changes

**PlantingEvent Model** (backend/models.py):
```python
succession_group_id = db.Column(db.String(50))  # UUID linking succession series
```

**Migration Strategy**:
- Nullable field (backward compatible)
- Existing events: NULL (no group)
- New succession events: Auto-generated UUID

### API Changes

**GET /api/planting-events** (enhanced):
```
Query params:
  - start_date (optional): YYYY-MM-DD format
  - end_date (optional): YYYY-MM-DD format

Filter logic: Return events where ANY date (seed/transplant/harvest) falls in range
```

### Frontend Components

**TimelineView Structure**:
```
TimelineView/
├── index.tsx          # Main timeline container
├── TimelineHeader.tsx # Month column headers
├── TimelineBar.tsx    # Individual crop lifecycle bar
└── utils.ts           # Date calculations, positioning
```

**Timeline Display**:
- Horizontal Gantt chart
- Months as columns (Aug | Sept | Oct | Nov...)
- Rows for each planting event
- Bars span from plant_date to harvest_date
- Color-coded by plant category
- Hover tooltip shows details
- Click to edit event

**Color Scheme**:
- Green: Vegetables
- Purple: Herbs
- Orange: Fruits
- Brown: Nuts

### Succession Group Linking

**Generation**:
```typescript
const successionGroupId = crypto.randomUUID(); // When creating succession series
```

**Usage**:
- All events in succession get same group ID
- Frontend can group visually (stack rows or connect bars)
- Future: Bulk edit entire series

## Success Criteria

**Phase 1 Complete When**:
- ✅ Timeline view renders without errors
- ✅ Events display as bars spanning plant → harvest
- ✅ Month navigation works
- ✅ Succession events have group IDs
- ✅ Can add events from timeline view
- ✅ Existing data displays correctly
- ✅ Backend validation passes
- ✅ Frontend TypeScript compiles

## Files to Modify/Create

### Backend
- `backend/models.py` (modify)
- `backend/app.py` (modify)
- `backend/migrations/add_succession_group.py` (new)

### Frontend
- `frontend/src/components/PlantingCalendar/TimelineView/index.tsx` (new)
- `frontend/src/components/PlantingCalendar/TimelineView/TimelineBar.tsx` (new)
- `frontend/src/components/PlantingCalendar/TimelineView/TimelineHeader.tsx` (new)
- `frontend/src/components/PlantingCalendar/TimelineView/utils.ts` (new)
- `frontend/src/components/PlantingCalendar/index.tsx` (modify)
- `frontend/src/components/PlantingCalendar/AddCropModal/index.tsx` (modify)
- `frontend/src/types.ts` (modify)

## Risks and Mitigations

**Risk 1: Performance with many events**
- Mitigation: Virtual scrolling, lazy load by date range, memoization

**Risk 2: Date calculation edge cases**
- Mitigation: Use existing dateCalculations.ts logic, test with various DTM values

**Risk 3: UI complexity**
- Mitigation: Keep Phase 1 simple, optional feature, can hide if not useful

## Testing Plan

1. Create test data: 20+ plantings across 6 months
2. Test timeline rendering performance
3. Test date range filtering
4. Test succession group display
5. Test with existing PlantingCalendar data
6. Test edge cases (very short DTM, very long DTM)

## Next Steps After Phase 1

1. User testing and feedback
2. Decide if Phase 2 (space awareness) is needed
3. Iterate on UX based on usage patterns
4. Consider mobile responsive design

---

**Last Updated**: 2025-11-18
**Completed**: 2025-11-18

## Feature Completion Summary

**All Phases Complete**: ✅

This feature has been fully implemented across 7 phases:

### Phase 1: MVP Timeline View
- ✅ Horizontal Gantt chart visualization
- ✅ Month navigation and date range display
- ✅ Color-coded bars by plant category
- ✅ Succession group linking with UUIDs
- ✅ Hover tooltips and click-to-edit
- **Completed**: 2025-11-17

### Phase 2A: Backend Position Support
- ✅ Position fields (position_x, position_y, space_required)
- ✅ Conflict checker module with Chebyshev distance
- ✅ Conflict check API endpoint
- **Completed**: 2025-11-18

### Phase 2B: Frontend Position Selector
- ✅ Mini SVG grid component
- ✅ Real-time conflict detection (debounced 500ms)
- ✅ ConflictWarning modal with override option
- ✅ Optional position selection ("Skip Position" button)
- **Completed**: 2025-11-18

### Phase 2C: Timeline Integration
- ✅ Bed filtering with event counts
- ✅ Position badges on timeline bars
- ✅ Conflict override indicators
- ✅ ConflictDetailsModal for clicked events
- ✅ Foreign key constraint for data integrity
- **Completed**: 2025-11-18

### Phase 3A: Auto-Suggest Intervals
- ✅ DTM-based interval calculation algorithm
- ✅ Category-specific recommendations
- ✅ Suitability checking for succession
- ✅ Auto-apply on succession enable
- **Completed**: 2025-11-18

### Phase 3B: Succession Wizard
- ✅ 4-step guided workflow
- ✅ Plant selection with auto-suggest
- ✅ Series configuration (interval, count, dates)
- ✅ Per-planting position assignment
- ✅ Review and confirm with conflict warnings
- **Completed**: 2025-11-18

### Phase 3C: Available Spaces View
- ✅ Temporal + spatial overlap detection
- ✅ SVG grid with color-coded availability
- ✅ Plant size filter (contiguous space finding)
- ✅ Click-to-select positions
- ✅ Stats display and legend
- **Completed**: 2025-11-18

## Total Impact

**Lines of Code**: ~3,200 lines across all phases
**Components Created**: 8 major components
**Utility Modules**: 3 (utils, calculations, space availability)
**Backend Endpoints**: 2 (date-range query, conflict check)
**Database Fields**: 5 (succession_group_id, positions, conflict_override)
**Implementation Time**: ~10 hours total

## Code Quality

- ✅ TypeScript compilation: 0 errors
- ✅ Backend validation: PASSED
- ✅ Code review: All issues fixed
- ✅ Git commits: Clean history with detailed messages
- ✅ Documentation: Comprehensive dev docs

## User Value Delivered

Users can now:
1. ✅ Visualize entire growing season on timeline
2. ✅ Plan succession plantings with wizard guidance
3. ✅ Avoid spatial conflicts with position tracking
4. ✅ Find available garden spaces by date
5. ✅ Get smart interval suggestions for any crop
6. ✅ Filter timeline by garden bed
7. ✅ See harvest dates to plan next crops
8. ✅ Override conflicts when intentional

**Status**: Ready for production use and user testing

**Last Updated**: 2025-11-18
