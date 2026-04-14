# MIGardener Row-Based Seed Density Testing Plan

## Overview

Test the newly implemented MIGardener row-based seed density feature to verify:
1. Correct UI display with row-centric language
2. Accurate seed count calculations (35-70 seed range)
3. Database persistence of seed density data
4. Backward compatibility with existing plantings
5. End-to-end functionality

## What Was Implemented

**Code Changes Completed:**
- Increased seed density values (Lettuce: 16/inch, Spinach: 14/inch, Arugula: 14/inch)
- Updated UI language from grid-centric to row-centric terminology
- Added explanatory comments about row-based methodology
- Frontend built successfully (217.92 kB bundle)

**Expected Behavior:**
- Info panel shows "MIGardener Row Density" (not "Seed Density")
- Displays "Seeds per 3\" of row" (not "per cell")
- Shows "Row spacing: 4\""
- Includes explanation: "MIGardener method plants continuous dense rows (not grid-based)"
- Seed counts in 35-70 range for 3" row segments

## Testing Plan

### Test 1: Application Startup
**Goal:** Verify the application starts without errors

**Steps:**
1. Run `C:\homesteader\homestead-planner\start-app.bat`
2. Wait for backend (port 5000) and frontend (port 3000) to start
3. Check console logs for any errors

**Expected Result:**
- Backend starts successfully
- Frontend compiles and serves
- No JavaScript/TypeScript errors in browser console
- Application loads at http://localhost:3000

**Files to Monitor:**
- Backend console output
- Browser console (F12 Developer Tools)

---

### Test 2: MIGardener Lettuce Planting
**Goal:** Verify seed density calculations and UI display for Lettuce

**Steps:**
1. Navigate to Garden Designer
2. Select an existing bed OR create a new 3' × 3' bed
3. Switch planning method to "MIGardener"
4. Drag "Lettuce" from the plant palette to a grid cell
5. Observe the Plant Config Modal

**Expected Results:**
- Modal opens with plant configuration
- Info panel displays:
  - **Title:** "🌱 MIGardener Row Density"
  - **Seeds per 3\" of row:** ~48
  - **Seed density:** 16 seeds/inch along row
  - **Row spacing:** 4"
  - **Germination rate:** 85%
  - **Survival rate:** 25%
  - **Expected final:** ~10 plants per 3\" row segment
  - **Harvest method:** cut and come again
  - **Explanation text:** "MIGardener method plants continuous dense rows (not grid-based). Grid is a UI convenience for planning."

**Verification:**
- Seed count should be ~48 (16 seeds/inch × 3 inches)
- Final plant count should be ~10 (48 × 0.85 germination × 0.25 survival)
- All text uses "row" terminology, not "cell" or "grid"

**Files Involved:**
- `frontend/src/components/GardenDesigner/PlantConfigModal.tsx` (lines 755-786)
- `frontend/src/data/plantDatabase.ts` (Lettuce entry, lines 443-456)

---

### Test 3: MIGardener Spinach Planting
**Goal:** Verify seed density calculations for Spinach

**Steps:**
1. In the same bed, drag "Spinach" to a different grid cell
2. Observe the Plant Config Modal

**Expected Results:**
- **Seeds per 3\" of row:** ~42
- **Seed density:** 14 seeds/inch along row
- **Row spacing:** 4"
- **Germination rate:** 80%
- **Survival rate:** 30%
- **Expected final:** ~10 plants per 3\" row segment

**Verification:**
- Seed count: 14 seeds/inch × 3 inches = ~42 seeds
- Final count: 42 × 0.80 × 0.30 = ~10 plants

---

### Test 4: MIGardener Arugula Planting
**Goal:** Verify seed density calculations for Arugula

**Steps:**
1. Drag "Arugula" to another grid cell
2. Observe the Plant Config Modal

**Expected Results:**
- **Seeds per 3\" of row:** ~42
- **Seed density:** 14 seeds/inch along row
- **Expected final:** ~11 plants per 3\" row segment

---

### Test 5: Database Persistence
**Goal:** Verify seed density data is saved to database correctly

**Steps:**
1. Create a Lettuce planting in MIGardener mode
2. Save the planting (click Save/Add button)
3. Check database for the new record

**Verification Method:**
Use a SQLite browser or query the database directly:

```sql
SELECT
  plant_name,
  planting_method,
  seed_count,
  seed_density,
  ui_segment_length_inches,
  expected_germination_rate,
  expected_survival_rate,
  expected_final_count,
  harvest_method
FROM planting_event
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Database Values:**
- `plant_name`: "Lettuce"
- `planting_method`: "seed_density"
- `seed_count`: 48
- `seed_density`: 16.0
- `ui_segment_length_inches`: 3.0
- `expected_germination_rate`: 0.85
- `expected_survival_rate`: 0.25
- `expected_final_count`: 10
- `harvest_method`: "cut_and_come_again"

**Files Involved:**
- `backend/models.py` (PlantingEvent model, lines 153-172)
- `backend/app.py` (POST /api/planting-events endpoint)
- Database: `backend/instance/homestead.db`

---

### Test 6: Backward Compatibility
**Goal:** Verify existing plantings still work correctly

**Steps:**
1. If you have existing plantings in the database, navigate to them
2. Check that they display correctly
3. Try editing an old planting
4. Create a new planting using Square-Foot method (not MIGardener)

**Expected Results:**
- Old plantings display without errors
- Old plantings have `planting_method` = "individual_plants" (or NULL, defaulting to individual_plants)
- Square-Foot method still works as before
- No migration errors or data corruption

**Verification:**
Check that old records don't have seed density fields populated:
```sql
SELECT
  plant_name,
  planting_method,
  quantity,
  seed_count,
  seed_density
FROM planting_event
WHERE created_at < '2026-01-15'  -- Before today's implementation
LIMIT 5;
```

Expected: `seed_count` and `seed_density` should be NULL for old records

---

### Test 7: Non-MIGardener Plants
**Goal:** Verify plants without MIGardener metadata still work in MIGardener mode

**Steps:**
1. Switch to MIGardener planning method
2. Drag a plant that DOESN'T have migardener metadata (e.g., "Tomato", "Kale")
3. Observe the modal

**Expected Results:**
- Modal opens normally
- NO seed density info panel displayed
- Fallback to individual plants calculation
- Falls back to individual plant spacing (crop spacing rules), not seed-density rows

**Files Involved:**
- `frontend/src/components/GardenDesigner/PlantConfigModal.tsx` (lines 410-423, fallback logic)

---

### Test 8: Edge Cases
**Goal:** Test boundary conditions and edge cases

**Test Cases:**

**A) Different Grid Sizes:**
- If bed has gridSize = 6" instead of 3", verify calculations scale correctly
- Assumes segment length matches grid size (currently the default behavior)
- Expected: Lettuce should show ~96 seeds (16 seeds/inch × 6" segment) instead of 48

**B) Row Continuity (Adjacent Cells):**
- Place Lettuce in 3 adjacent horizontal cells (A1, B1, C1)
- Expected behavior:
  - Each cell shows: "Seeds per 3\" segment: ~48 seeds → ~10 plants"
  - UI should indicate "Part of 9\" continuous row (3 segments)"
  - Total row: 144 seeds → ~30 plants (3 segments × 10 plants each)
  - Verify calculations are consistent: 48 × 0.85 × 0.25 = ~10 per segment
  - Verify no multiplication errors occur
  - Backend should link them via rowGroupId

**Verification:**
```sql
SELECT
  row_group_id,
  row_segment_index,
  seed_count,
  ui_segment_length_inches
FROM planting_event
WHERE plant_name = 'Lettuce'
  AND row_group_id IS NOT NULL
ORDER BY row_segment_index;
```

Expected: Same row_group_id, different row_segment_index (0, 1, 2)

**E) Row Group Persistence on Reload:**
- Place Lettuce in 3 adjacent horizontal cells (A1, B1, C1)
- Save all three plantings
- Verify database has row grouping:
  ```sql
  SELECT row_group_id, row_segment_index, plant_name
  FROM planting_event
  WHERE plant_name = 'Lettuce' AND row_group_id IS NOT NULL
  ORDER BY row_segment_index;
  ```
- Refresh the page (hard reload: Ctrl+Shift+R)
- Reopen the garden bed in Garden Designer

**Expected Results:**
- All 3 lettuce plantings reload correctly
- UI still displays each as part of continuous row
- Visual indicators show they're linked
- Database grouping persists (same row_group_id)

**Test Editing:**
- Click on the middle segment (B1)
- Modify quantity or other property
- Save changes
- Verify row group linkage remains intact (same row_group_id for all 3)
- Verify UI still shows "Part of 9\" continuous row (3 segments)"

**Purpose:** Ensures row continuity isn't just in-memory, but persists through page reloads and edits

**C) Browser Console:
- Check for any JavaScript errors during planting operations
- Look for any console warnings related to seed density

**D) Network Tab:**
- Open Developer Tools → Network
- Create a planting
- Verify POST /api/planting-events request includes seedDensityData

**Expected Payload:**
```json
{
  "plantId": "lettuce-1",
  "plantName": "Lettuce",
  "seedDensityData": {
    "plantingMethod": "seed_density",
    "seedCount": 48,
    "seedDensity": 16,
    "uiSegmentLengthInches": 3,
    "expectedGerminationRate": 0.85,
    "expectedSurvivalRate": 0.25,
    "expectedFinalCount": 10,
    "harvestMethod": "cut_and_come_again",
    "rowGroupId": "row-1234567890-abc123def",
    "rowSegmentIndex": 0,
    "totalRowSegments": 3,
    "rowContinuityMessage": "Part of 9\" continuous row (3 segments)"
  }
}
```

**Note:** Row continuity fields (`rowGroupId`, `rowSegmentIndex`, `totalRowSegments`, `rowContinuityMessage`) are only present when the planting is part of a continuous row with adjacent segments.

---

### Test 9: Visual Verification
**Goal:** Verify the UI looks correct and professional

**Checklist:**
- [ ] Info panel has blue background (bg-blue-50)
- [ ] Seed icon (🌱) displays correctly
- [ ] Text is readable and properly formatted
- [ ] "Row spacing" line is included
- [ ] Explanation text is in italic and blue (text-blue-600)
- [ ] No layout issues or text overflow
- [ ] Panel appears only when condition is met (MIGardener + migardener metadata + seed_density method)

---

### Test 10: Planting Calendar Integration
**Goal:** Verify seed density plantings appear correctly in Planting Calendar

**Steps:**
1. Create a MIGardener Lettuce planting with a specific planting date
2. Navigate to Planting Calendar
3. Find the planting in the calendar

**Expected Results:**
- Planting appears in calendar on correct date
- Planting displays with correct plant name
- No errors when viewing planting details

**Potential Issue:**
- Calendar may not yet display seed density information in tooltips (this is a future enhancement)
- For now, just verify it doesn't break

---

## Success Criteria

The implementation is successful if:

1. ✅ **Seed counts are in correct range:** Lettuce ~48, Spinach ~42, Arugula ~42
2. ✅ **UI uses row-centric language:** "Row Density", "per 3\" of row", "row segment"
3. ✅ **Row spacing is displayed:** Shows "Row spacing: 4\""
4. ✅ **Explanation text is present:** Clarifies row-based methodology
5. ✅ **Database saves correctly:** All seed density fields populated
6. ✅ **Backward compatibility maintained:** Old plantings still work
7. ✅ **No JavaScript errors:** Clean console logs
8. ✅ **Fallback logic works:** Plants without migardener data use old logic

## Testing Checklist

- [ ] Application starts without errors
- [ ] Lettuce shows ~48 seeds → ~10 plants
- [ ] Spinach shows ~42 seeds → ~10 plants
- [ ] Arugula shows ~42 seeds → ~11 plants
- [ ] UI displays "MIGardener Row Density" title
- [ ] UI displays "Seeds per 3\" of row" label
- [ ] UI displays "Row spacing: 4\""
- [ ] UI displays explanation about row-based method
- [ ] Database saves all seed density fields correctly
- [ ] Existing plantings still work (backward compatible)
- [ ] Non-MIGardener plants fall back correctly
- [ ] No console errors or warnings
- [ ] Network request includes seedDensityData payload

## Known Limitations (Future Enhancements)

1. **Plant badges** - Don't yet show "48s→10p" format (future)
2. **Future Plantings tooltips** - Don't display seed density info (future)
3. **Planting Calendar** - May not show seed density details (future)
4. **Limited crops** - Only Lettuce, Spinach, Arugula have MIGardener data
5. **Row Planner UI** - Dedicated row view not yet implemented (future)

## Troubleshooting

**If seed counts are wrong:**
- Check `frontend/src/data/plantDatabase.ts` migardener.seedDensityPerInch values
- Verify calculation in PlantConfigModal.tsx line 395: `seedCount = rowLengthInches × seedDensityPerInch`

**If database doesn't save:**
- Check backend console for errors
- Verify `backend/app.py` POST endpoint extracts seedDensityData
- Check that migration `add_seed_density_fields.py` ran successfully

**If old plantings break:**
- Check that planting_method defaults to 'individual_plants'
- Verify NULL seed density fields don't cause errors
- Check backend handles missing seedDensityData gracefully

**If UI doesn't display panel:**
- Verify condition: `planningMethod === 'migardener' && representativePlant.migardener && seedDensityMetadata?.plantingMethod === 'seed_density'`
- Check that plant has migardener metadata in plantDatabase.ts
- Verify seedDensityMetadata state is set correctly

---

**Plan Created:** 2026-01-15 (Testing Phase)
**Estimated Time:** 45-60 minutes
**Prerequisites:** MIGardener refinement completed, frontend built
