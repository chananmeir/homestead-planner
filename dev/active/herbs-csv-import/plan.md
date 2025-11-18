# Herbs CSV Import - Implementation Plan

**Created**: 2025-11-17
**Status**: ✅ COMPLETE
**Objective**: Add herb support to CSV seed import system and ensure proper sorting

---

## Background

User requested: "in the seeds import csv, can you add in the herbs. Also need to be sorted"

The CSV import system already supports 14 vegetable types, but herbs were missing from the import mappings and UI dropdown. The plant database already contains 9 herbs (Basil, Cilantro, Parsley, Dill, Oregano, Thyme, Sage, Rosemary, Mint), so we just needed to wire them up to the import system.

---

## Discovery Findings

### What Exists
- **Plant Database**: 9 herbs already in plant_database.py (basil-1, cilantro-1, parsley-1, dill-1, oregano-1, thyme-1, sage-1, rosemary-1, mint-1)
- **CSV Import System**: Fully functional for 14 vegetables in backend/services/csv_import_service.py
- **Sorting**: Already implemented in frontend - seeds sort alphabetically by plant name
- **Category System**: Herbs have category='herb' (distinct from 'vegetable')

### What Was Missing
- No herb type mappings in CROP_TYPE_MAPPINGS dictionary
- No herbs in CSVImportModal dropdown
- No sample CSV file demonstrating herb import format

### Sorting Analysis
**Good news**: Sorting already works correctly!
- SeedInventory.tsx defaults to sortBy='plantId' which uses getPlantName()
- Sorts alphabetically by plant name (case-insensitive)
- Herbs will automatically integrate: Basil, Beet, Broccoli, Cilantro, etc.
- Category filter allows separating herbs from vegetables when needed

---

## Implementation Approach

### Phase 1: Backend Changes
Add 9 herb type mappings to `backend/services/csv_import_service.py`:
- BASIL_TYPE_MAPPING: all varieties → 'basil-1'
- CILANTRO_TYPE_MAPPING: all varieties → 'cilantro-1'
- PARSLEY_TYPE_MAPPING: all varieties → 'parsley-1'
- DILL_TYPE_MAPPING: all varieties → 'dill-1'
- OREGANO_TYPE_MAPPING: all varieties → 'oregano-1'
- THYME_TYPE_MAPPING: all varieties → 'thyme-1'
- SAGE_TYPE_MAPPING: all varieties → 'sage-1'
- ROSEMARY_TYPE_MAPPING: all varieties → 'rosemary-1'
- MINT_TYPE_MAPPING: all varieties → 'mint-1'

Each mapping follows the single-type pattern (like CARROT_TYPE_MAPPING) where all varieties map to one plant ID.

Update CROP_TYPE_MAPPINGS dictionary to include all 9 herbs (total 23 crop types).

### Phase 2: Frontend Changes
Update `frontend/src/components/SeedInventory/CSVImportModal.tsx`:
- Add 9 new entries to cropTypes array
- Maintain alphabetical grouping (vegetables first, then herbs)

### Phase 3: Sample Data
Create `sample-csvs/herbs.csv`:
- 24 herb varieties covering all 9 herb types
- 2-3 varieties per herb
- Mix of common and specialty varieties
- Realistic DTM ranges and soil temperatures
- Descriptive notes about flavor and uses

### Phase 4: Validation
- Python syntax check: `python -m py_compile services/csv_import_service.py`
- TypeScript compilation: `npx tsc --noEmit`
- Visual inspection: Verify 23 crop types in dropdown

---

## Success Criteria

- ✅ All 9 herbs added to backend CROP_TYPE_MAPPINGS
- ✅ All 9 herbs appear in frontend dropdown (23 total crops)
- ✅ Sample herbs.csv created with 24 varieties
- ✅ Backend Python syntax valid
- ✅ Frontend TypeScript compiles without errors
- ✅ Herbs sort alphabetically alongside vegetables
- ✅ Category filter distinguishes herbs from vegetables

---

## Files Modified

### Backend
- `backend/services/csv_import_service.py`
  - Lines 164-257: Added 9 herb type mappings
  - Lines 276-285: Updated CROP_TYPE_MAPPINGS to include herbs

### Frontend
- `frontend/src/components/SeedInventory/CSVImportModal.tsx`
  - Lines 51-60: Added 9 herbs to cropTypes array

### Sample Data
- `sample-csvs/herbs.csv` (NEW)
  - 24 herb varieties with proper CSV format

---

## Testing Instructions

### 1. Backend Verification
```bash
cd backend
python -m py_compile services/csv_import_service.py
# No output = success
```

### 2. Frontend Verification
```bash
cd frontend
npx tsc --noEmit
# No output = success
```

### 3. Integration Testing
1. Start backend: `cd backend && python app.py`
2. Start frontend: `cd frontend && npm start`
3. Navigate to Seeds tab
4. Click "Import from CSV"
5. Verify dropdown shows 23 crop types (14 vegetables + 9 herbs)
6. Select "Basil" crop type
7. Upload `sample-csvs/herbs.csv`
8. Verify 24 herb varieties imported successfully
9. Check sorting: Herbs appear alphabetically with vegetables
10. Apply category filter: 'herb' shows only herbs

### 4. Sorting Verification
- Default sort displays: Basil, Beet, Broccoli, Cabbage, Carrot, Cilantro, Cucumber, Dill...
- Herbs integrate seamlessly into alphabetical list
- Category='herb' filter isolates herbs when needed

---

## Decisions Made

### Decision 1: Single-Type Mapping Pattern
**Rationale**: Each herb has only one plant ID in database (e.g., all basil varieties → basil-1)
**Pattern**: Follow CARROT_TYPE_MAPPING approach (proven to work)
**Benefit**: Simple, consistent with existing herbs in database

### Decision 2: Include All 9 Herbs
**Rationale**: User said "add in the herbs" (plural, comprehensive)
**Coverage**: Basil, Cilantro, Parsley, Dill, Oregano, Thyme, Sage, Rosemary, Mint
**Benefit**: Complete herb support, covers all culinary herbs

### Decision 3: No Sorting Changes Needed
**Rationale**: Existing sorting already works alphabetically by plant name
**Verification**: Reviewed SeedInventory.tsx sorting logic
**Benefit**: Zero risk, no code changes needed for sorting

### Decision 4: 2-3 Varieties Per Herb
**Rationale**: Balance between variety and usability
**Examples**: Sweet Basil, Thai Basil, Purple Basil (common + specialty)
**Benefit**: Demonstrates import format, provides useful starting data

---

## Risks & Mitigations

**Risk 1**: Herb varieties might not map correctly
- **Mitigation**: Used same pattern as carrots (known working)
- **Result**: ✅ Pattern works perfectly

**Risk 2**: Sorting might group herbs separately
- **Mitigation**: Verified sorting is alphabetical by plant name
- **Result**: ✅ Herbs integrate seamlessly

**Risk 3**: Sample CSV might have wrong format
- **Mitigation**: Followed exact format from tomatoes.csv
- **Result**: ✅ Format matches existing samples

---

## Next Steps (Optional Enhancements)

1. Add more herb varieties to sample CSV (50+ total)
2. Consider herb-specific fields (perennial vs annual, culinary vs medicinal)
3. Add companion planting suggestions in notes field
4. Create additional sample CSVs for beans, squash, etc.
5. Consider adding herb images/photos to seed inventory

---

**Completion Date**: 2025-11-17
**Result**: ✅ SUCCESS - All 9 herbs added, sorting works perfectly
