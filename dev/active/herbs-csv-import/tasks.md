# Herbs CSV Import - Task Checklist

**Created**: 2025-11-17
**Status**: ✅ ALL COMPLETE

---

## Backend Tasks

### Type Mapping Creation
- [x] Create BASIL_TYPE_MAPPING (lines 165-175)
- [x] Create CILANTRO_TYPE_MAPPING (lines 177-185)
- [x] Create PARSLEY_TYPE_MAPPING (lines 187-195)
- [x] Create DILL_TYPE_MAPPING (lines 197-205)
- [x] Create OREGANO_TYPE_MAPPING (lines 207-215)
- [x] Create THYME_TYPE_MAPPING (lines 217-226)
- [x] Create SAGE_TYPE_MAPPING (lines 228-236)
- [x] Create ROSEMARY_TYPE_MAPPING (lines 238-246)
- [x] Create MINT_TYPE_MAPPING (lines 248-257)

### Dictionary Updates
- [x] Add 'basil': BASIL_TYPE_MAPPING to CROP_TYPE_MAPPINGS (line 277)
- [x] Add 'cilantro': CILANTRO_TYPE_MAPPING to CROP_TYPE_MAPPINGS (line 278)
- [x] Add 'parsley': PARSLEY_TYPE_MAPPING to CROP_TYPE_MAPPINGS (line 279)
- [x] Add 'dill': DILL_TYPE_MAPPING to CROP_TYPE_MAPPINGS (line 280)
- [x] Add 'oregano': OREGANO_TYPE_MAPPING to CROP_TYPE_MAPPINGS (line 281)
- [x] Add 'thyme': THYME_TYPE_MAPPING to CROP_TYPE_MAPPINGS (line 282)
- [x] Add 'sage': SAGE_TYPE_MAPPING to CROP_TYPE_MAPPINGS (line 283)
- [x] Add 'rosemary': ROSEMARY_TYPE_MAPPING to CROP_TYPE_MAPPINGS (line 284)
- [x] Add 'mint': MINT_TYPE_MAPPING to CROP_TYPE_MAPPINGS (line 285)

---

## Frontend Tasks

### UI Updates
- [x] Add { value: 'basil', label: 'Basil' } to cropTypes (line 52)
- [x] Add { value: 'cilantro', label: 'Cilantro' } to cropTypes (line 53)
- [x] Add { value: 'parsley', label: 'Parsley' } to cropTypes (line 54)
- [x] Add { value: 'dill', label: 'Dill' } to cropTypes (line 55)
- [x] Add { value: 'oregano', label: 'Oregano' } to cropTypes (line 56)
- [x] Add { value: 'thyme', label: 'Thyme' } to cropTypes (line 57)
- [x] Add { value: 'sage', label: 'Sage' } to cropTypes (line 58)
- [x] Add { value: 'rosemary', label: 'Rosemary' } to cropTypes (line 59)
- [x] Add { value: 'mint', label: 'Mint' } to cropTypes (line 60)

---

## Sample Data Tasks

### CSV Creation
- [x] Create sample-csvs/herbs.csv file
- [x] Add CSV header row (Variety,Type,Days to Maturity,Soil Temp Sowing F,Notes)
- [x] Add 3 basil varieties (Genovese, Thai, Purple Ruffles)
- [x] Add 2 cilantro varieties (Santo, Calypso)
- [x] Add 3 parsley varieties (Italian Flat-Leaf, Moss Curled, Hamburg)
- [x] Add 3 dill varieties (Bouquet, Fernleaf, Dukat)
- [x] Add 2 oregano varieties (Greek, Hot & Spicy)
- [x] Add 3 thyme varieties (Common, Lemon, French)
- [x] Add 3 sage varieties (Common Garden, Purple, Tricolor)
- [x] Add 2 rosemary varieties (Tuscan Blue, Arp)
- [x] Add 3 mint varieties (Spearmint, Peppermint, Chocolate Mint)
- [x] Include realistic DTM ranges for each variety
- [x] Include realistic soil temperature ranges for each variety
- [x] Include descriptive notes (flavor, use, characteristics)

**Total**: 24 herb varieties across 9 herb types ✅

---

## Validation Tasks

### Code Quality
- [x] Backend Python syntax check passed (no errors)
- [x] Frontend TypeScript compilation passed (no errors)
- [x] No ESLint warnings introduced
- [x] Code follows project patterns (CLAUDE.md guidelines)

### Functional Testing
- [x] Verify CROP_TYPE_MAPPINGS has 23 entries total (14 vegetables + 9 herbs)
- [x] Verify cropTypes array has 23 entries total
- [x] Verify herbs.csv has correct format
- [x] Verify all variety types exist in their respective mappings

---

## Documentation Tasks

### Dev Docs
- [x] Create dev/active/herbs-csv-import/ directory
- [x] Write plan.md with full implementation plan
- [x] Write context.md with technical details and decisions
- [x] Write tasks.md (this file) with complete checklist

### Code Documentation
- [x] Add comment "# Herb type mappings" above herb mappings section
- [x] Add comment "# Herbs" above herb entries in CROP_TYPE_MAPPINGS
- [x] Add comment "// Herbs" above herb entries in cropTypes array

---

## Testing Checklist (Manual)

### Backend Testing
- [ ] Start backend: `cd backend && python app.py`
- [ ] Verify backend starts without errors
- [ ] Check logs for any warnings about herb mappings

### Frontend Testing
- [ ] Start frontend: `cd frontend && npm start`
- [ ] Navigate to Seeds tab
- [ ] Click "Import from CSV" button
- [ ] Verify dropdown shows 23 crop types (scroll to see all)
- [ ] Verify herbs appear in dropdown: Basil, Cilantro, Dill, Mint, Oregano, Parsley, Rosemary, Sage, Thyme

### Integration Testing
- [ ] Select "Basil" from crop type dropdown
- [ ] Upload sample-csvs/herbs.csv file
- [ ] Verify import success message
- [ ] Verify 24 varieties imported
- [ ] Check seed list shows imported herbs
- [ ] Verify herbs sort alphabetically with vegetables
- [ ] Apply category filter: 'herb' shows only herbs
- [ ] Apply category filter: 'vegetable' excludes herbs

### Variety Mapping Testing
- [ ] Import herb with variety='genovese' → maps to basil-1
- [ ] Import herb with variety='thai' → maps to basil-1
- [ ] Import herb with unknown variety → maps to basil-1 (mixed fallback)
- [ ] Import different herbs → each maps to correct plant ID

### Sorting Testing
- [ ] Default sort: Herbs appear alphabetically (Basil before Beet, Cilantro after Carrot)
- [ ] Sort by Plant Name: Works correctly
- [ ] Sort by Purchase Date: Herbs sort with vegetables by date
- [ ] Sort by Expiration Date: Herbs sort with vegetables by date
- [ ] Sort by Quantity: Herbs sort with vegetables by quantity

---

## Completion Criteria

All tasks marked [x] = ✅ COMPLETE

**Final Status**:
- Backend: ✅ 9 herbs added to CSV import system
- Frontend: ✅ 9 herbs added to dropdown UI
- Sample Data: ✅ 24 varieties in herbs.csv
- Validation: ✅ Python and TypeScript checks passed
- Documentation: ✅ All dev docs created
- Ready for: User testing and feedback

---

**Completed**: 2025-11-17 23:20 UTC
**Result**: SUCCESS - All implementation tasks complete
