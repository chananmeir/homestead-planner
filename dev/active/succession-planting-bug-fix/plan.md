# Succession Planting Bug Fix - Plan

**Project**: Homestead Planner
**Task**: Fix bug where succession planting count (e.g., 7) only creates 1 event
**Date Started**: 2025-11-12
**Status**: Implementation in Progress

## Problem Statement

When a user enables succession planting and enters a count (e.g., 7 plantings), only 1 planting event is created instead of the expected 7 events.

## Root Cause

**Race Condition in State Updates**

Location: `frontend/src/components/PlantingCalendar/index.tsx` (line 60) and `AddCropModal/index.tsx` (lines 115-137)

The bug occurs because:
1. `handleAddEvent()` in PlantingCalendar is an **async function** that makes API calls
2. AddCropModal loops through succession count and calls `onAddEvent()` multiple times
3. The loop **does not await** the async calls - all 7 fire simultaneously
4. Each call tries to update `plantingEvents` state based on the OLD state value
5. React batches state updates, causing race condition where only last update "wins"
6. Result: Only 1 event is saved to database and displayed in UI

### Code Evidence

**AddCropModal (lines 115-137)** - The problem:
```typescript
if (successionPlanting) {
  for (let i = 0; i < successionCount; i++) {
    const offset = i * successionInterval;
    const successionEvent: PlantingCalendarType = { /* ... */ };
    onAddEvent(successionEvent); // ❌ NOT AWAITED - race condition!
  }
}
```

**PlantingCalendar (lines 60-89)** - Receives events:
```typescript
const handleAddEvent = async (event: PlantingCalendarType) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/planting-events`, { /* ... */ });
    if (response.ok) {
      const savedEvent = await response.json();
      setPlantingEvents([...plantingEvents, savedEvent]); // ❌ Race condition on state
    }
  } catch (err) { /* ... */ }
};
```

## Proposed Solution

**Option 1: Batch POST in AddCropModal** (RECOMMENDED)

Instead of calling `onAddEvent()` for each succession event individually, collect all events in an array and save them in a single batch operation.

**Changes Required**:
1. Update `AddCropModal` to collect all succession events in an array
2. Use `Promise.all()` to POST all events simultaneously to API
3. Update `PlantingCalendar` state once with all saved events
4. Advantages:
   - Fewer API calls (1 batch vs 7 individual)
   - No race condition (single state update)
   - Better performance
   - Atomic operation (all or nothing)

**Implementation**:
```typescript
// In AddCropModal - handleSubmit()
if (successionPlanting) {
  const successionEvents = [];
  for (let i = 0; i < successionCount; i++) {
    const offset = i * successionInterval;
    const successionEvent: PlantingCalendarType = { /* ... */ };
    successionEvents.push(successionEvent);
  }
  // Call onAddEvents (plural) with array
  onAddEvents(successionEvents);
} else {
  onAddEvent(baseEvent);
}
```

```typescript
// In PlantingCalendar - new handleAddEvents()
const handleAddEvents = async (events: PlantingCalendarType[]) => {
  try {
    const savePromises = events.map(event =>
      fetch(`${API_BASE_URL}/api/planting-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ /* serialize dates */ }),
      }).then(res => res.json())
    );

    const savedEvents = await Promise.all(savePromises);
    setPlantingEvents([...plantingEvents, ...savedEvents]); // Single state update
  } catch (err) { /* ... */ }
};
```

**Option 2: Sequential Await Loop** (Not Recommended)

Use `await` in the loop to wait for each event to save before starting the next.

**Disadvantages**:
- Slower (7 sequential API calls instead of parallel)
- More API overhead
- Still makes N individual calls

## Implementation Plan

### Phase 1: Update AddCropModal
1. Modify `handleSubmit()` to collect succession events in array
2. Update prop signature to add `onAddEvents?: (events: PlantingCalendarType[]) => void`
3. Call `onAddEvents` when succession planting is enabled

### Phase 2: Update PlantingCalendar
1. Add new `handleAddEvents` function for batch operations
2. Pass `handleAddEvents` to AddCropModal
3. Keep `handleAddEvent` for single event operations (backward compatibility)

### Phase 3: Testing
1. TypeScript compilation check
2. Test with succession count = 1 (should work)
3. Test with succession count = 7 (should create 7 events)
4. Verify all 7 events saved to database
5. Verify all 7 events display in calendar
6. Verify dates are correctly offset

## Files to Modify

1. `frontend/src/components/PlantingCalendar/AddCropModal/index.tsx`
   - Update prop interface
   - Modify handleSubmit() for batch collection
   - Call onAddEvents for succession planting

2. `frontend/src/components/PlantingCalendar/index.tsx`
   - Add handleAddEvents() function
   - Pass to AddCropModal

## Success Criteria

1. Entering succession count = 7 creates exactly 7 planting events
2. All 7 events are saved to database (verified by refresh)
3. All 7 events display in calendar view
4. Events have correctly offset dates (7, 14, 21, 28... days apart)
5. TypeScript compiles with 0 errors
6. Single planting (no succession) still works correctly

## Risk Assessment

**Risk Level**: LOW

**Reasons**:
- Small, isolated change (2 files)
- Clear root cause identified
- Solution is well-tested pattern (Promise.all)
- Backward compatible (keeps single event path)

**Potential Issues**:
- If one API call fails, all might fail (can add error recovery)
- Need to handle partial failures gracefully

---

**Last Updated**: 2025-11-12
**Status**: Ready for Implementation
