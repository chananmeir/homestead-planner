# CSV Bulk Import Expansion - Tasks

**Last Updated**: 2025-11-13

## Task Checklist

### Phase 1: Discovery & Planning ✓ COMPLETED
- [x] Check for existing seed import dev docs
- [x] Read CSV import service code
- [x] Read plant database to identify all crop types
- [x] Read frontend import modal component
- [x] Identify crop types to add (14 total)
- [x] Determine mapping strategy for each crop type
- [x] Create dev docs directory
- [x] Write implementation plan
- [x] Write context document with design decisions
- [x] Write tasks checklist

### Phase 2: Backend Implementation (In Progress)
- [ ] Add CARROT_TYPE_MAPPING dictionary
- [ ] Add TOMATO_TYPE_MAPPING dictionary
- [ ] Add PEPPER_TYPE_MAPPING dictionary
- [ ] Add BEAN_TYPE_MAPPING dictionary
- [ ] Add SQUASH_TYPE_MAPPING dictionary
- [ ] Add CUCUMBER_TYPE_MAPPING dictionary
- [ ] Add PEA_TYPE_MAPPING dictionary
- [ ] Add BEET_TYPE_MAPPING dictionary
- [ ] Add RADISH_TYPE_MAPPING dictionary
- [ ] Add BROCCOLI_TYPE_MAPPING dictionary
- [ ] Add CAULIFLOWER_TYPE_MAPPING dictionary
- [ ] Add CABBAGE_TYPE_MAPPING dictionary
- [ ] Add KALE_TYPE_MAPPING dictionary
- [ ] Update CROP_TYPE_MAPPINGS dictionary with all 14 crops
- [ ] Verify case-insensitive keys (all lowercase)
- [ ] Verify each mapping has 'mixed' fallback

### Phase 3: Frontend Implementation (Pending)
- [ ] Update cropTypes array in CSVImportModal.tsx
- [ ] Add 'Carrots' option
- [ ] Add 'Tomatoes' option
- [ ] Add 'Peppers' option
- [ ] Add 'Beans' option
- [ ] Add 'Squash' option
- [ ] Add 'Cucumbers' option
- [ ] Add 'Peas' option
- [ ] Add 'Beets' option
- [ ] Add 'Radishes' option
- [ ] Add 'Broccoli' option
- [ ] Add 'Cauliflower' option
- [ ] Add 'Cabbage' option
- [ ] Add 'Kale' option
- [ ] Verify dropdown displays all 14 crop types

### Phase 4: Build Validation (Pending)
- [ ] Run Python syntax check on csv_import_service.py
- [ ] Run TypeScript compilation check (npx tsc --noEmit)
- [ ] Review changes for consistency with lettuce pattern
- [ ] Verify all plant IDs match plant_database.py
- [ ] Check for typos in mapping keys

### Phase 5: Documentation & Completion (Pending)
- [ ] Update context.md with final implementation notes
- [ ] Mark all tasks complete in this file
- [ ] Add completion timestamp to plan.md
- [ ] Create CSV example files for user testing

## Crop Types Added

### Tier 1: High-Variety Crops
1. **Carrots** - 6 type mappings → carrot-1
2. **Tomatoes** - 8 type mappings → tomato-1, tomato-cherry-1
3. **Peppers** - 7 type mappings → pepper-bell-1, pepper-hot-1
4. **Beans** - 4 type mappings → bean-bush-1, bean-pole-1

### Tier 2: Common Vegetables
5. **Squash** - 7 type mappings → squash-summer-1, squash-winter-1
6. **Cucumbers** - 5 type mappings → cucumber-1
7. **Peas** - 4 type mappings → pea-1
8. **Beets** - 3 type mappings → beet-1
9. **Radishes** - 3 type mappings → radish-1

### Tier 3: Brassicas
10. **Broccoli** - 3 type mappings → broccoli-1
11. **Cauliflower** - 3 type mappings → cauliflower-1
12. **Cabbage** - 4 type mappings → cabbage-1
13. **Kale** - 4 type mappings → kale-1

## Implementation Progress

### Backend Changes
**File**: `backend/services/csv_import_service.py`
- **Status**: Pending
- **Line Range**: ~30-150 (new mappings), ~31-50 (updated CROP_TYPE_MAPPINGS)
- **Agent**: Backend Implementation Agent

### Frontend Changes
**File**: `frontend/src/components/SeedInventory/CSVImportModal.tsx`
- **Status**: Pending
- **Line Range**: ~36-55 (updated cropTypes array)
- **Agent**: Frontend Implementation Agent

## Testing Checklist

### Backend API Tests (curl)
- [ ] Test carrot CSV import
- [ ] Test tomato CSV import
- [ ] Test pepper CSV import
- [ ] Test bean CSV import
- [ ] Test other crop types
- [ ] Verify all imports create correct plant_id
- [ ] Verify case-insensitive type matching works
- [ ] Verify fallback to 'mixed' works for unknown types

### Frontend UI Tests (Manual)
- [ ] Verify dropdown shows all 14 crop types
- [ ] Test carrot CSV upload via UI
- [ ] Verify success message displays
- [ ] Verify imported varieties appear in seed inventory
- [ ] Test existing lettuce import still works (regression test)

## Expected Outcomes

### Backend File Changes
- `csv_import_service.py`: ~120 new lines added
- 13 new TYPE_MAPPING dictionaries (8-10 lines each)
- CROP_TYPE_MAPPINGS updated from 3 lines to ~17 lines

### Frontend File Changes
- `CSVImportModal.tsx`: ~13 new lines added
- cropTypes array updated from 3 lines to ~16 lines

## CSV Format Examples Created

For user reference and testing:
- [ ] carrots.csv (5-10 common varieties)
- [ ] tomatoes.csv (mix of beefsteak and cherry)
- [ ] peppers.csv (mix of bell and hot)
- [ ] beans.csv (mix of bush and pole)

## Success Metrics

- Total crop types supported: 14 (up from 1)
- Backend mappings: 13 new TYPE_MAPPING dictionaries
- Frontend options: 13 new dropdown options
- Build status: Clean (no syntax or type errors)
- Regression: Lettuce import still functional
- User request: Carrot import working

## Notes

- All TYPE_MAPPING keys are lowercase for case-insensitive matching
- Each mapping includes a 'mixed' fallback entry
- Plant IDs verified against plant_database.py
- Follows same pattern as existing lettuce implementation
- Import service handles duplicate detection automatically
- Global/personal catalog flag preserved from import form
