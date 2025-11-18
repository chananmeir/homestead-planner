# MIgardener Calculation Fix - Context

**Last Updated**: 2025-11-17 (Final Update - Task Complete)

## Background

User reported that MIgardener planting density calculations didn't match expected values. After investigation, discovered two separate issues:

1. Backend calculation logic completely missing for migardener method
2. Spacing data in database was incorrect

## MIgardener Method

MIgardener is Luke Marion's high-intensity planting method that uses:
- **Row-based spacing** (not grid-based like SFG)
- **Dense initial sowing** followed by thinning
- **Closer row spacing** than traditional gardening
- **Tighter plant spacing** than Square Foot Gardening

### Radish Spacing Details

**MIgardener Recommendations** (from user clarification):
- Sow seeds ~1" apart initially
- Thin to 1-1.5" apart for final spacing
- Rows 4" apart
- **Result**: 36 plants per square foot

**Database Values Before Fix**:
- `MIGARDENER_SPACING`: `'radish': [6, 2]` (6" rows, 2" spacing)
- `plant_database.py`: `rowSpacing: 6, spacing: 3`
- **Resulted in**: 8-12 plants per square foot (way too low!)

**Database Values After Fix**:
- `MIGARDENER_SPACING`: `'radish': [4, 1]` (4" rows, 1" spacing)
- `plant_database.py`: `rowSpacing: 4, spacing: 1`
- **Results in**: 36 plants per square foot ✓

## Key Decisions

### Decision 1: Use Final Thinned Spacing
- Could have used pre-thinning (1" sowing) or post-thinning (1-1.5" final)
- **Chose**: 1" final spacing (conservative estimate)
- **Rationale**: Gives 36/sqft which matches user's target range

### Decision 2: 4" Row Spacing
- User confirmed 4" rows × 1" spacing = 36/sqft target
- Alternative would be 3" rows × 1" spacing = 48/sqft (ultra-intensive)
- **Chose**: 4" rows as balanced high-intensity approach

### Decision 3: Separate from plant_database spacing
- `plant_database.py` has `spacing` field (used for SFG)
- Also has `rowSpacing` field (used for row/migardener methods)
- **Both need to be correct** for proper calculations
- Changed radish spacing from 3 to 1 (affects migardener calculations)
- SFG uses different logic (grid-based) so still works correctly

## Technical Implementation

### Backend API Endpoint Pattern

```python
elif method == 'migardener':
    spacing = get_migardener_spacing(plant_id)  # Gets [row, plant] from dictionary
    bed_width_inches = bed_width * 12
    bed_length_inches = bed_length * 12
    num_rows = int(bed_width_inches / spacing['rowSpacing'])
    plants_per_row = int(bed_length_inches / spacing['plantSpacing'])
    total = num_rows * plants_per_row
```

### Helper Function Pattern

```python
elif method == 'migardener':
    spacing = get_migardener_spacing(plant_id)
    num_rows = int((bed_width * 12) / spacing['rowSpacing'])
    plants_per_row = int((bed_length * 12) / spacing['plantSpacing'])
    return num_rows * plants_per_row
```

### Frontend Calculation Pattern

```typescript
else if (planningMethod === 'migardener' && plant.rowSpacing && plant.spacing) {
  const rowsPerFoot = 12 / plant.rowSpacing;
  const plantsPerFoot = 12 / plant.spacing;
  defaultQuantity = Math.floor(rowsPerFoot * plantsPerFoot);
}
```

## Why This Bug Existed

1. **MIgardener added to frontend** in a previous feature
2. **Backend never updated** to handle the new method
3. **No errors surfaced** because:
   - Frontend doesn't always call the API endpoint
   - 400 errors may have been silently ignored
   - Feature "appeared" to work with default values

## Data Source

User provided clarification based on MIgardener's published recommendations:
- Final spacing: 1-1.5 inches after thinning
- Row spacing: 4 inches (for 36/sqft target)
- Source reference: MIgardener website/videos on radish spacing

## Related Code Locations

### Backend
- `backend/garden_methods.py:280` - MIGARDENER_SPACING dictionary
- `backend/garden_methods.py:503` - get_migardener_spacing() function
- `backend/garden_methods.py:536-543` - calculate_plants_per_bed() migardener case
- `backend/plant_database.py:314-315` - Radish spacing values
- `backend/app.py:9` - Import statement
- `backend/app.py:286-302` - calculate_spacing() endpoint migardener case

### Frontend
- `frontend/src/components/GardenDesigner/PlantConfigModal.tsx:90-95` - Default quantity calculation

## Comparison with Other Methods

### SFG (Square Foot Gardening)
- Grid-based: divides bed into 1ft squares
- Uses single spacing value (not row-based)
- Radishes: 3" spacing = (12/3)² = 16/sqft

### Row Method
- Traditional row gardening
- Uses same formula as MIgardener but different spacing
- Typically wider rows (12-18") and spacing (3-4")

### Intensive Method
- Hexagonal packing pattern
- Uses hexagonal efficiency factor (0.866)
- Different from MIgardener's simple row calculation

## Testing Notes

Verified calculations with Python script:
```
MIgardener: 4×4 bed = (48/4 rows) × (48/1 plants) = 12 × 48 = 576 ✓
SFG: 4×4 bed = 16 sqft × 16 plants/sqft = 256 ✓
```

## Current State

**✅ TASK COMPLETE** - All objectives achieved

### Completed Work
1. **Backend Bug Fixed**: MIgardener calculations now work correctly
   - API endpoint handles `method='migardener'` (app.py:286-302)
   - Helper function calculates plants correctly (garden_methods.py:536-543)
   - No more 400 errors or "1 plant" defaults

2. **Radish Spacing Corrected**: Ultra-intensive values implemented
   - MIGARDENER_SPACING: [4, 1] = 36 plants/sqft (garden_methods.py:280)
   - plant_database: rowSpacing: 4, spacing: 1 (plant_database.py:314-315)
   - Yields 576 radishes in 4×4 bed (vs 256 with SFG)

3. **All 12 Crops Verified**: Database already correct for other crops
   - Lettuce: [4, 4] ✓
   - Spinach: [5, 4] ✓
   - Carrots: [6, 2] ✓
   - Beets: [12, 3] ✓
   - Onions: [4, 4] ✓
   - Garlic: [4, 3] ✓
   - Bush Beans: [18, 5.5] ✓
   - Pole Beans: [30, 8] ✓
   - Peas: [60, 1.5] ✓
   - Tomatoes: [36, 24] ✓
   - Peppers: [21, 14] ✓

4. **Frontend Enhanced**: Default quantities calculate correctly
   - PlantConfigModal.tsx now handles migardener method (lines 90-95)
   - Shows correct plant count immediately when adding plants

5. **Tested & Validated**: All calculations verified
   - Python test script confirmed 576 vs 256 plants
   - Formula matches MIgardener recommendations
   - SFG still works correctly (no regression)

### Important Data Clarification

**Radish Spacing Conflict Resolved**:
- User initially provided documentation showing [6, 2] spacing
- But confirmed they want ultra-intensive [4, 1] spacing
- Decision: Use [4, 1] for maximum density (36 plants/sqft)
- This represents the most aggressive MIgardener approach

### Recent Decisions

**Decision 4: All Other Crops Already Correct**
- Verified all 12 MIgardener crops against user-provided data
- Only radishes needed updating
- Database was well-maintained already
- **Rationale**: No additional changes needed - verification complete

### Discoveries & Learnings

**Discovery 1**: Database was mostly correct
- Initial assumption: all crops might need fixing
- Reality: Only radishes had wrong values
- Lesson: Always verify before bulk changes

**Discovery 2**: Radish spacing varies by source
- Documentation showed [6, 2] (moderate density)
- User wants [4, 1] (ultra-intensive)
- Lesson: MIgardener has ranges, need user preference

**Discovery 3**: Frontend calculations are optional
- Frontend can calculate defaults without API
- API endpoint is backup/validation
- Both now work correctly

### Next Steps

**NONE - Task is complete**

This task can be moved to `dev/completed/` when ready.

### Files to Review After Compaction

If resuming this work (unlikely - task complete):
1. Read this context.md file
2. Read tasks.md for detailed task breakdown
3. Read plan.md for implementation overview

### Answered Questions

~~1. Should we add similar fixes for other crops?~~
   → **Answered**: Not needed - all other crops already correct

~~2. Do we need UI tooltips explaining method differences?~~
   → **Deferred**: Optional enhancement, not blocking

~~3. Should we validate that all MIGARDENER_SPACING values are current/accurate?~~
   → **Completed**: All 12 crops verified against MIgardener data
