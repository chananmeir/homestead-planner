# Collision Detection Test Plan

## Test Setup
- Backend: Running on port 5000
- Frontend: Running on port 3000
- Date: 2025-11-12

## Test Scenarios

### Scenario 1: Garden Bed + Garden Bed (Should Block)
**Expected Behavior**:
- RED outline when dragging second bed over first bed
- Error message prevents placement
- Structure snaps back to original position if dropped

**Steps**:
1. Open Property Designer
2. Place a "Raised Bed (4'x8')" at position (10, 10)
3. Try to drag another "Raised Bed (4'x8')" over the first one
4. Verify RED outline appears during drag
5. Drop the structure
6. Verify error toast appears: "Cannot move structure: [conflict message]"

**Result**: ⏳ Pending manual test

---

### Scenario 2: Garden Bed Inside Greenhouse (Should Allow with Warning)
**Expected Behavior**:
- YELLOW outline when dragging bed inside greenhouse
- Placement allowed
- Optional warning message about containment

**Steps**:
1. Place a "Greenhouse (20'x40')" at position (10, 10)
2. Drag a "Raised Bed (4'x8')" completely inside the greenhouse bounds
3. Verify YELLOW outline appears during drag
4. Drop the structure
5. Verify placement succeeds

**Result**: ⏳ Pending manual test

---

### Scenario 3: Pathway + Garden Bed (Should Allow)
**Expected Behavior**:
- GREEN outline when dragging pathway over bed
- Placement allowed (infrastructure can overlap anything)

**Steps**:
1. Place a "Raised Bed (4'x8')" at position (10, 10)
2. Drag a "Pathway" over the bed
3. Verify GREEN outline appears during drag
4. Drop the structure
5. Verify placement succeeds

**Result**: ⏳ Pending manual test

---

### Scenario 4: Partial Greenhouse Overlap (Should Block)
**Expected Behavior**:
- RED outline when greenhouse partially overlaps existing structure
- Error message about partial overlap
- Containers must fully contain or avoid structures

**Steps**:
1. Place a "Raised Bed (4'x8')" at position (10, 10)
2. Drag a "Greenhouse (20'x40')" so it partially overlaps the bed
3. Verify RED outline appears during drag
4. Drop the structure
5. Verify error message about partial overlap

**Result**: ⏳ Pending manual test

---

### Scenario 5: Chicken Coop + Beehive (Should Block)
**Expected Behavior**:
- RED outline (livestock category cannot overlap itself)
- Error message prevents placement

**Steps**:
1. Place a "Chicken Coop" at position (10, 10)
2. Try to drag a "Beehive" over the coop
3. Verify RED outline appears during drag
4. Verify placement blocked

**Result**: ⏳ Pending manual test

---

### Scenario 6: Garden Bed Not Fully in Greenhouse (Should Block)
**Expected Behavior**:
- RED outline when bed extends outside greenhouse boundary
- Error message about partial containment

**Steps**:
1. Place a "Greenhouse (20'x40')" at position (10, 10)
2. Drag a "Raised Bed (4'x8')" so half is inside, half is outside greenhouse
3. Verify RED outline appears during drag
4. Verify error about partial overlap

**Result**: ⏳ Pending manual test

---

### Scenario 7: Valid Empty Space (Should Allow)
**Expected Behavior**:
- GREEN outline when dragging to empty space
- Placement allowed

**Steps**:
1. Place a "Raised Bed (4'x8')" at position (10, 10)
2. Drag another bed to position (50, 50) with no overlap
3. Verify GREEN outline appears during drag
4. Drop the structure
5. Verify placement succeeds

**Result**: ⏳ Pending manual test

---

### Scenario 8: Backend Validation Match
**Expected Behavior**:
- Frontend validation matches backend validation
- No cases where frontend shows GREEN but backend rejects

**Steps**:
1. For each scenario above, compare frontend visual feedback to backend response
2. Verify consistency between client and server validation
3. Check browser console for any validation errors

**Result**: ⏳ Pending manual test

---

## Visual Feedback Color Key

| Color | Meaning | Status |
|-------|---------|--------|
| 🔴 RED | Collision detected - placement blocked | Invalid |
| 🟡 YELLOW | Inside valid container - placement allowed | Valid (contained) |
| 🟢 GREEN | Valid empty space - placement allowed | Valid |
| 🔵 BLUE | Default state (not dragging) | Neutral |

---

## Error Message Verification

Expected error formats:
- "Cannot move structure: [StructureName] overlaps with [OtherName] at (x, y)"
- "Cannot move structure: [StructureName] partially overlaps container boundary"
- "Cannot move structure: [ContainerName] cannot contain [StructureName]"

---

## Test Results Summary

**Total Scenarios**: 8
**Passed**: 0
**Failed**: 0
**Pending**: 8

**Overall Status**: ⏳ Ready for manual testing

---

## Instructions for Manual Testing

1. Open browser to http://localhost:3000
2. Navigate to Property Designer tab
3. Select a property (or create one if needed)
4. Ensure structures are loaded in the left panel
5. Follow each test scenario above
6. Document results in this file
7. Report any bugs or unexpected behavior

---

## Known Limitations

- Rotation not supported (structures always placed at 0° angle)
- Collision detection uses rectangular bounding boxes
- Z-index layering not considered (2D only)
- Performance with 100+ structures not tested

---

**Last Updated**: 2025-11-12
