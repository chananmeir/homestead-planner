# Seed Planning UI/UX Improvements - Context

## Overview
This enhancement improves the Garden Season Planner (GardenPlanner.tsx) UI to better utilize screen space, add filtering controls, improve visual clarity of bed assignments, and make incompatibility more obvious.

## Problems Identified

### 1. Narrow Layout (Wasted Screen Space)
**Issue**: The planning page used `max-w-4xl` (768px) which created large margins on 1440px+ screens, wasting 50%+ of horizontal space.

**Impact**: Users with wide monitors couldn't see information efficiently, had to scroll more, and the interface felt cramped.

**Root Cause**: Conservative max-width constraint likely designed for smaller screens but never optimized for wider displays.

### 2. Unclear Bed Assignments
**Issue**: No visual indicator on seed cards showing which beds were already assigned. Users had to expand the bed selector to see assignments.

**Impact**: Hard to get an at-a-glance overview of plan status. Tedious to review which crops were assigned where.

### 3. Incompatible Beds Hidden
**Issue**: Incompatible beds (sun exposure mismatch) were completely filtered out of the bed selector, with only a yellow banner saying "X beds hidden".

**Impact**:
- Users couldn't see WHY beds were hidden
- No way to understand bed compatibility without going to Garden Designer
- Confusing UX - information was hidden rather than explained

### 4. No Bed Filter Control
**Issue**: When plants were assigned to multiple beds, the bed selector showed all beds, making it hard to focus on one bed at a time.

**Impact**: Difficult to review space allocation for a specific bed. Hard to plan bed-by-bed.

## Solution Architecture

### Layout Changes
- Changed `max-w-4xl` → `max-w-7xl` (768px → 1280px)
- Maintains responsive design
- Targets 1400-1600px effective usage on 1440px screens
- Preserves mobile/tablet layouts

### State Management
Added new state:
```typescript
const [perSeedBedFilter, setPerSeedBedFilter] = useState<Map<number, number | null>>(new Map());
```

This stores per-seed bed filter selections. Key = seedId, Value = bedId or null (all beds).

### Grid Layout Adjustment
Modified seed card grid from:
- col-span-4 (variety name)
- col-span-2 (quantity)
- col-span-3 (succession)
- col-span-3 (space estimate)

To:
- col-span-3 (variety name + assigned beds chips)
- col-span-2 (quantity)
- col-span-2 (succession)
- col-span-2 (bed filter)
- col-span-3 (space estimate)

### New Functions

#### `getAllBedsForDisplay(seed)`
Returns all beds with compatibility flag:
```typescript
Array<GardenBed & { isCompatible: boolean }>
```

#### `getFilteredBedsForDisplay(seed)`
Returns beds filtered by user's bed filter selection, with compatibility flags.

### Bed Selector Changes
**Before**: Only showed compatible beds (filtered out incompatible)
**After**: Shows all beds, with incompatible ones:
- Greyed out (`text-gray-400 italic`)
- Disabled (`disabled={!bed.isCompatible}`)
- Labeled with incompatibility reason (e.g., "⚠️ Incompatible (needs full sun)")

### Visual Indicators

#### Assigned Beds Chips
Added below variety name:
```tsx
<div className="mt-1 flex flex-wrap gap-1">
  <span className="text-xs text-gray-500">Beds:</span>
  {assignedBeds.map(bedId => (
    <span className="inline-block px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full border border-green-300">
      {bed.name} ({getPlanningMethodDisplay(bed.planningMethod)})
    </span>
  ))}
</div>
```

#### Bed Filter Dropdown
Positioned next to Quantity and Succession:
```tsx
<select>
  <option value="">All Beds</option>
  {gardenBeds.map(bed => (
    <option value={bed.id}>
      {bed.name} ({getPlanningMethodDisplay(bed.planningMethod)})
    </option>
  ))}
</select>
```

#### Filter Active Indicator
When bed filter is active, shows blue banner:
```tsx
<div className="mb-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1">
  🔍 Filtering to: {filterBed?.name}
</div>
```

## Design Decisions

### Why Show Incompatible Beds Instead of Hiding?
**Transparency over convenience**: Users need to understand WHY beds aren't suitable. Hiding them created confusion. Showing them disabled with reasons educates users about sun compatibility and helps them make informed decisions (e.g., "I need to add a full-sun bed").

### Why Per-Seed Bed Filter?
**Flexibility**: Different crops may be planned for different beds. Per-seed filter allows users to focus on one bed at a time for each crop without affecting other crops.

### Why Add Assigned Beds Chips?
**Scan-ability**: Users requested at-a-glance status. Chips make it immediately obvious which crops have bed assignments without expanding sections.

### Why Widen to max-w-7xl Instead of Full Width?
**Readability**: While users wanted more width, ultra-wide layouts (>1600px) reduce readability for text-heavy interfaces. max-w-7xl (1280px) provides a good balance between space efficiency and readability.

## Technical Constraints

### No Backend Changes Required
This is purely a frontend UI enhancement. No API modifications, no database schema changes.

### Maintains Existing Compatibility Logic
All existing sun compatibility logic (`checkBedSunCompatibility`, `getCompatibleBeds`) remains unchanged. We only added display wrappers.

### Preserves Existing State Management
Bed assignments (`bedAssignments` Map) remain unchanged. We only added a new filter state that doesn't affect saved data.

## Testing Considerations

### Manual Testing Checklist
1. Wide screen (1440px+): Verify layout uses majority of width
2. Narrow screen (1024px): Verify responsive design still works
3. Mobile (< 768px): Verify no layout breaks
4. Assign beds to crop: Verify chips appear
5. Select bed filter: Verify bed list filters correctly
6. Incompatible bed: Verify greyed out and shows reason
7. Compatible bed: Verify normal styling
8. Clear bed filter: Verify shows all beds again

### Edge Cases to Test
- Seed with no bed assignments: Should show no chips
- Seed with multiple bed assignments: Should show multiple chips (wrapped)
- All beds incompatible: Should show all greyed out
- Bed filter on bed with no space: Should still show in filter
- Very long bed names: Ensure chips don't break layout

## Future Enhancements (Out of Scope)

### Could Add:
- Persist bed filter selections across sessions (localStorage)
- Add "Assigned" vs "Unassigned" filter
- Group beds by planning method in dropdown
- Show space utilization indicator on bed filter options
- Tooltip on hover for incompatible beds (instead of inline text)

### Should NOT Add:
- Automatic bed assignment suggestions (requires backend logic)
- Drag-and-drop bed assignment (major UX overhaul)
- Bed-level view with all crops (separate feature)

## References

### Related Files
- `frontend/src/components/GardenPlanner.tsx` - Main component (modified)
- `frontend/src/utils/gardenPlannerSpaceCalculator.ts` - Space calculations (unchanged)
- `backend/services/garden_planner_service.py` - Backend service (unchanged)

### Related Documentation
- `CLAUDE.md` - Project guidelines (followed)
- `dev/completed/garden-planner-wizard-simplification/` - Previous refactoring

## Completion Date
2026-01-29

## Author
Claude Sonnet 4.5 (via Project Manager Agent)
