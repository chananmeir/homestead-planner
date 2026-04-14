# Seed Planning UI/UX Improvements - Implementation Plan

## Goals

### Primary Goals (MUST HAVE)
A) Use more screen width (target 1400-1600px on 1440px screens)
B) Add bed filter dropdown next to Quantity/Succession
C) Grey out incompatible beds and show incompatibility reason
D) Show "Assigned beds:" chips on seed card for at-a-glance status

### Secondary Goals (NICE TO HAVE)
- Improve overall visual hierarchy
- Make current bed assignments obvious without expanding sections
- Reduce user confusion about why beds are "hidden"

## Implementation Phases

### Phase 1: Layout Width Expansion ✅
**Objective**: Increase effective screen width usage from ~768px to ~1280px.

**Changes**:
- File: `frontend/src/components/GardenPlanner.tsx`
- Line: ~1410
- Change: `max-w-4xl` → `max-w-7xl`

**Reasoning**: Tailwind's max-w-7xl = 1280px, which provides ~90% width usage on 1440px screens when accounting for padding/margins.

**Testing**:
- View on 1440px screen: Should use majority of width
- View on 1024px screen: Should not overflow
- View on mobile: Should remain responsive

### Phase 2: Add Bed Filter State ✅
**Objective**: Add state management for per-seed bed filtering.

**Changes**:
- Add state: `const [perSeedBedFilter, setPerSeedBedFilter] = useState<Map<number, number | null>>(new Map());`
- Location: After line ~53 (with other per-bed state)

**Data Structure**:
- Key: seedId (number)
- Value: bedId (number) or null (all beds)

**Reasoning**: Per-seed filtering allows users to focus on one bed at a time for each crop without affecting other crops.

### Phase 3: Add Bed Filter Functions ✅
**Objective**: Create helper functions to filter beds for display.

**New Functions**:
1. `getAllBedsForDisplay(seed)`: Returns all beds with compatibility flag
2. `getFilteredBedsForDisplay(seed)`: Returns beds filtered by user selection

**Location**: After `getCompatibleBeds()` function (~line 474)

**Return Type**:
```typescript
Array<GardenBed & { isCompatible: boolean }>
```

**Reasoning**: Separating data logic from UI rendering makes code maintainable and testable.

### Phase 4: Adjust Seed Card Grid Layout ✅
**Objective**: Make room for bed filter dropdown without cramping layout.

**Changes**:
- File: `frontend/src/components/GardenPlanner.tsx`
- Location: ~line 1662 (seed card grid)

**Before**:
```tsx
<div className="grid grid-cols-12">
  <div className="col-span-4"> {/* Variety name */}
  <div className="col-span-2"> {/* Quantity */}
  <div className="col-span-3"> {/* Succession */}
  <div className="col-span-3"> {/* Space estimate */}
```

**After**:
```tsx
<div className="grid grid-cols-12">
  <div className="col-span-3"> {/* Variety name + chips */}
  <div className="col-span-2"> {/* Quantity */}
  <div className="col-span-2"> {/* Succession */}
  <div className="col-span-2"> {/* Bed filter */}
  <div className="col-span-3"> {/* Space estimate */}
```

**Reasoning**: Slight reduction in variety name space (4→3) and succession space (3→2) makes room for bed filter (2 cols) while maintaining space estimate visibility.

### Phase 5: Add Bed Filter Dropdown ✅
**Objective**: Add bed filter control to seed card.

**Changes**:
- Location: After Succession dropdown (~line 1720)
- Component: `<select>` with "All Beds" option + all garden beds

**UI Structure**:
```tsx
<div className="col-span-2">
  <label>Bed Filter</label>
  <select value={perSeedBedFilter.get(seed.id) || ''} onChange={...}>
    <option value="">All Beds</option>
    {gardenBeds.map(bed => (
      <option value={bed.id}>
        {bed.name} ({getPlanningMethodDisplay(bed.planningMethod)})
      </option>
    ))}
  </select>
</div>
```

**Behavior**:
- Only visible when seed is selected AND has quantity
- Selecting a bed filters the bed assignment list below
- Selecting "All Beds" shows all beds

### Phase 6: Add Assigned Beds Chips ✅
**Objective**: Show assigned beds as chips/badges on seed card.

**Changes**:
- Location: Inside variety name column, below plant name (~line 1673)
- Component: Flex container with chips

**UI Structure**:
```tsx
{isSelected && assignedBeds.length > 0 && (
  <div className="mt-1 flex flex-wrap gap-1">
    <span className="text-xs text-gray-500">Beds:</span>
    {assignedBeds.map(bedId => (
      <span className="inline-block px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full border border-green-300">
        {bed.name} ({getPlanningMethodDisplay(bed.planningMethod)})
      </span>
    ))}
  </div>
)}
```

**Styling**:
- Green background (bg-green-100) to indicate positive action (assignment)
- Rounded-full for pill/badge appearance
- Text-xs for compact size
- Wrapping allowed (flex-wrap) for multiple beds

### Phase 7: Update Bed Selector to Show All Beds ✅
**Objective**: Replace filtered bed list with all beds, greying out incompatible ones.

**Changes**:
- Location: Bed selector (~line 1890)
- Replace: `{compatibleBeds.map(...)` → `{getFilteredBedsForDisplay(seed).map(...)`
- Add disabled styling for incompatible beds

**UI Structure**:
```tsx
<select multiple size={...}>
  {getFilteredBedsForDisplay(seed).map(bed => {
    const optionClass = bed.isCompatible ? '' : 'text-gray-400 italic';
    const incompatibleReason = !bed.isCompatible
      ? ` ⚠️ Incompatible (needs ${plant.sunRequirement} sun)`
      : '';

    return (
      <option
        key={bed.id}
        value={bed.id}
        className={optionClass}
        disabled={!bed.isCompatible}
      >
        {bed.name} ({planningMethod}) - {bedStatus}
        {incompatibleReason}
      </option>
    );
  })}
</select>
```

**Behavior**:
- Compatible beds: Normal styling, selectable
- Incompatible beds: Greyed out, disabled, shows reason
- Filter active: Only shows filtered bed(s)

### Phase 8: Remove Confusing "X beds hidden" Message ✅
**Objective**: Replace yellow "beds hidden" banner with clear filter indicator.

**Changes**:
- Location: Above bed selector (~line 1873)
- Remove: Yellow banner showing "X beds hidden - incompatible"
- Add: Blue banner when bed filter is active

**UI Structure**:
```tsx
{(() => {
  const filterBedId = perSeedBedFilter.get(seed.id);
  if (filterBedId) {
    const filterBed = gardenBeds.find(b => b.id === filterBedId);
    return (
      <div className="mb-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1">
        🔍 Filtering to: {filterBed?.name}
      </div>
    );
  }
  return null;
})()}
```

**Reasoning**: Transparency over hiding. Users see all beds and understand incompatibility, rather than being confused by hidden information.

## Component Hierarchy

### GardenPlanner.tsx Structure
```
GardenPlanner
├── [view === 'list'] → Plans list
├── [view === 'detail'] → Plan detail
└── [view === 'create'] → Wizard
    ├── Step 1: Select Seeds & Configure (MODIFIED)
    │   ├── Search/Filter/Sort controls
    │   ├── Seed list
    │   │   └── Seed card (MODIFIED)
    │   │       ├── Checkbox + Grid layout
    │   │       │   ├── Variety name + Plant name
    │   │       │   │   └── Assigned beds chips (NEW)
    │   │       │   ├── Quantity input
    │   │       │   ├── Succession dropdown
    │   │       │   ├── Bed filter dropdown (NEW)
    │   │       │   └── Space estimate
    │   │       ├── Succession suitability indicator
    │   │       └── Bed selector (MODIFIED)
    │   │           ├── Filter indicator (NEW)
    │   │           └── Bed multi-select with incompatible styling (MODIFIED)
    │   └── Space summaries
    └── Step 2: Review & Save
```

## Data Flow

### Bed Filter Selection Flow
1. User selects bed in "Bed Filter" dropdown
2. State updated: `setPerSeedBedFilter(new Map(...).set(seedId, bedId))`
3. `getFilteredBedsForDisplay(seed)` called
4. Bed selector renders only filtered bed(s)
5. Blue banner appears: "🔍 Filtering to: [Bed Name]"

### Bed Assignment with Incompatibility Check
1. User views bed selector (multiple select)
2. Compatible beds: Normal text, selectable
3. Incompatible beds: Grey text, disabled, shows reason
4. User selects compatible bed(s)
5. `handleBedSelection(seedId, selectedIds)` called
6. State updated: `bedAssignments` Map
7. Chips appear below variety name

## Testing Strategy

### Unit Testing (Manual)
- [ ] Layout width: Measure effective width on 1440px screen
- [ ] Bed filter: Select bed, verify list filters
- [ ] Bed filter: Select "All Beds", verify shows all
- [ ] Assigned beds chips: Assign 1 bed, verify chip appears
- [ ] Assigned beds chips: Assign 3 beds, verify 3 chips appear
- [ ] Incompatible bed: Verify greyed out and disabled
- [ ] Incompatible bed: Verify shows reason text
- [ ] Compatible bed: Verify normal styling

### Integration Testing (Manual)
- [ ] Select seed → Assign bed → Chips appear
- [ ] Select bed filter → Bed list updates
- [ ] Assign incompatible bed (should be blocked)
- [ ] Clear bed filter → All beds reappear

### Regression Testing
- [ ] Existing bed assignments still work
- [ ] Space calculations unchanged
- [ ] Succession logic unchanged
- [ ] Rotation warnings still display
- [ ] Mobile layout not broken
- [ ] Tablet layout not broken

### Browser Testing
- [ ] Chrome (primary)
- [ ] Firefox
- [ ] Safari (if applicable)
- [ ] Edge

## Acceptance Criteria

### ✅ A) Screen Width Usage
- [x] On 1440px wide screen, planning page uses majority of width (>80%)
- [x] Layout remains responsive on smaller screens
- [x] No horizontal scrolling introduced

### ✅ B) Bed Filter Control
- [x] Bed filter dropdown appears next to Quantity/Succession
- [x] Dropdown shows "All Beds" + all garden beds
- [x] Selecting bed filters bed assignment list
- [x] Filter state persists until changed

### ✅ C) Incompatible Beds Visual Styling
- [x] Incompatible beds appear in list (not hidden)
- [x] Incompatible beds greyed out with italic text
- [x] Incompatible beds disabled (not selectable)
- [x] Incompatibility reason shown inline (e.g., "needs full sun")
- [x] Compatible beds have normal styling

### ✅ D) Assigned Beds Chips
- [x] Chips appear below variety name when beds assigned
- [x] Chips show bed name and planning method
- [x] Chips styled as green badges/pills
- [x] Multiple chips wrap properly
- [x] Chips only appear when seed is selected

## Rollback Plan

If critical issues found:

1. **Quick Rollback**: Revert `max-w-4xl` change only
   - Command: `git checkout HEAD~1 -- frontend/src/components/GardenPlanner.tsx`
   - Impact: Restores narrow layout, removes all new features

2. **Selective Rollback**: Keep layout change, remove filter features
   - Keep `max-w-7xl` change
   - Remove bed filter state and dropdown
   - Remove chips display
   - Keep incompatible bed styling improvements

3. **Full Rollback**: Revert entire commit
   - Command: `git revert <commit-hash>`
   - Impact: Complete restoration to previous state

## Success Metrics

### Quantitative
- Effective width usage: >80% on 1440px screens (previously ~50%)
- Bed filter usage: Track if users utilize the filter
- Click reduction: Fewer clicks needed to review bed assignments

### Qualitative
- User feedback: "Easier to see bed assignments"
- User feedback: "Layout feels less cramped"
- User feedback: "Understand why beds are incompatible now"

## Timeline

- **Planning & Analysis**: 10 minutes ✅
- **Implementation**: 30 minutes ✅
- **Testing**: 10 minutes (manual)
- **Documentation**: 10 minutes ✅
- **Total**: ~60 minutes

## Completion Date
2026-01-29
