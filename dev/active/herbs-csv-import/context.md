# Herbs CSV Import - Context

**Last Updated**: 2025-11-17
**Status**: ✅ COMPLETE

---

## Project Context

**Application**: Homestead Planner - garden and homestead planning application
**Tech Stack**:
- Backend: Flask/Python with SQLAlchemy (port 5000)
- Frontend: React/TypeScript with Tailwind CSS (port 3000)
- Database: SQLite

**Feature**: CSV Seed Import - bulk import seed varieties from CSV files

---

## Key Files

### Backend
**`backend/services/csv_import_service.py`** - CSV import logic
- Lines 1-162: Existing vegetable type mappings (lettuce, carrot, tomato, etc.)
- Lines 164-257: NEW - 9 herb type mappings
- Lines 260-286: CROP_TYPE_MAPPINGS dictionary (updated to include herbs)
- Lines 289-500+: CSV parsing and import functions

**`backend/plant_database.py`** - Plant definitions
- Contains 9 herb entries: basil-1, cilantro-1, parsley-1, dill-1, oregano-1, thyme-1, sage-1, rosemary-1, mint-1
- Each herb has category='herb' (distinct from 'vegetable')
- Each herb has single plant ID (no variety-specific types)

### Frontend
**`frontend/src/components/SeedInventory/CSVImportModal.tsx`** - CSV import UI
- Lines 36-61: cropTypes array (updated to include 9 herbs)
- Total: 23 crop types (14 vegetables + 9 herbs)

**`frontend/src/components/SeedInventory/SeedInventory.tsx`** - Seed list display
- Lines 128: Default sort by 'plantId' (uses plant name alphabetically)
- Lines 506-507: Sorting implementation
- Sorting already works - no changes needed!

### Sample Data
**`sample-csvs/herbs.csv`** - NEW file
- 24 herb varieties covering all 9 herb types
- Format: Variety,Type,Days to Maturity,Soil Temp Sowing F,Notes

---

## Technical Decisions

### Decision 1: Single-Type Mapping Pattern
**What**: All varieties of a herb map to single plant ID
**Example**: Sweet Basil, Thai Basil, Purple Basil → all map to 'basil-1'
**Why**: Database has single entry per herb, no variety-specific plant IDs
**Pattern**: Same as CARROT_TYPE_MAPPING (all carrot varieties → carrot-1)

### Decision 2: Herb Variety Selection
**Criteria**:
- Mix of common and specialty varieties
- Cover all major culinary uses
- Include both annual and perennial herbs
- Realistic days to maturity and soil temperatures

**Varieties Added**:
- Basil: Genovese (Sweet), Thai, Purple Ruffles
- Cilantro: Santo (Standard), Calypso (Slow-bolt)
- Parsley: Italian Flat-Leaf, Moss Curled, Hamburg
- Dill: Bouquet, Fernleaf, Dukat
- Oregano: Greek, Hot & Spicy
- Thyme: Common, Lemon, French
- Sage: Common Garden, Purple, Tricolor
- Rosemary: Tuscan Blue, Arp
- Mint: Spearmint, Peppermint, Chocolate Mint

### Decision 3: CSV Format Consistency
**Format**: Variety,Type,Days to Maturity,Soil Temp Sowing F,Notes
**Why**: Matches existing sample CSV files (tomatoes.csv, etc.)
**Benefit**: Users familiar with vegetable CSV format can easily adapt

### Decision 4: No Sorting Changes
**Finding**: Sorting already works correctly
**Verification**: SeedInventory.tsx sorts by plant name (alphabetically)
**Result**: Herbs automatically integrate into alphabetical list
**Example**: Basil, Beet, Broccoli, Cabbage, Carrot, Cilantro, Cucumber, Dill...

---

## Code Patterns Used

### Backend Type Mapping Pattern
```python
HERB_TYPE_MAPPING = {
    'variety-1': 'herb-1',
    'variety-2': 'herb-1',
    'variety-3': 'herb-1',
    # Fallback
    'mixed': 'herb-1',
}
```

**Why**: Simple, consistent, handles unknown varieties with 'mixed' fallback

### Frontend Crop Type Pattern
```typescript
{ value: 'herb', label: 'Herb Name' }
```

**Why**: Consistent with existing cropTypes, clear labels

---

## Integration Points

### 1. CSV Upload Flow
1. User selects crop type from dropdown (e.g., "Basil")
2. User uploads CSV file
3. Frontend sends: crop_type='basil', CSV data
4. Backend looks up BASIL_TYPE_MAPPING
5. Backend maps varieties to plant IDs
6. Backend creates seed_inventory entries
7. Frontend displays imported seeds in sorted list

### 2. Type Mapping Resolution
```python
crop_mapping = CROP_TYPE_MAPPINGS.get(crop_type)
# For crop_type='basil', returns BASIL_TYPE_MAPPING
plant_id = crop_mapping.get(variety_type, 'mixed')
# For variety_type='genovese', returns 'basil-1'
```

### 3. Sorting Integration
```typescript
// SeedInventory.tsx
const sortBy = 'plantId';  // Default sort
const getPlantName = (plantId: string) => { ... };
// Seeds sorted alphabetically by plant name
```

---

## Database Schema

### seed_inventory Table
Relevant fields for herb import:
- `plant_id` VARCHAR(50) - e.g., 'basil-1', 'cilantro-1'
- `variety` VARCHAR(100) - e.g., 'Genovese', 'Thai'
- `category` VARCHAR(50) - 'herb' (auto-populated from plant_database)
- `days_to_maturity` INT
- `soil_temp_min_f` INT
- `soil_temp_max_f` INT
- `notes` TEXT
- `is_global` BOOLEAN - True for catalog seeds, False for user seeds

---

## Validation & Testing

### Backend Validation
```bash
cd backend
python -m py_compile services/csv_import_service.py
```
**Result**: ✅ No syntax errors

### Frontend Validation
```bash
cd frontend
npx tsc --noEmit
```
**Result**: ✅ No TypeScript errors

### Integration Testing
1. Backend running on port 5000
2. Frontend running on port 3000
3. Seeds tab → Import from CSV
4. Dropdown shows 23 crop types (including all 9 herbs)
5. Import herbs.csv → 24 varieties imported successfully
6. Sorting: Herbs appear alphabetically with vegetables
7. Filter by category='herb' → Shows only herbs

---

## Known Limitations

1. **No Variety-Specific Data**: All basil varieties get same plant data (spacing, companion plants, etc.)
   - **Impact**: Minimal - most varieties have similar growing requirements
   - **Future**: Could add variety-specific overrides if needed

2. **No Herb Images**: Sample CSV doesn't include image URLs
   - **Impact**: Herbs display without photos initially
   - **Future**: Users can add images manually or via future bulk image import

3. **Limited Variety Coverage**: 24 varieties across 9 herbs
   - **Impact**: Just sample data, users can add more
   - **Future**: Could expand to 50+ varieties in sample

---

## Gotchas & Lessons Learned

### Gotcha 1: Type Names Must Match
The `Type` column in CSV must match keys in the TYPE_MAPPING dictionary
- **Example**: CSV has "Sweet" → mapping has 'sweet': 'basil-1'
- **Case**: Keys are lowercase, CSV values can be any case (backend converts)

### Gotcha 2: Mixed Fallback
Every type mapping should include 'mixed' fallback
- **Why**: Handles unknown varieties gracefully
- **Pattern**: `'mixed': 'herb-1'` in every mapping

### Gotcha 3: Sorting is Case-Insensitive
Plant names like "Basil" sort alongside "beet" correctly
- **Why**: JavaScript sort() handles this automatically
- **Result**: Clean alphabetical integration

---

## Performance Considerations

- **Backend**: 9 new type mappings add negligible overhead (dictionary lookups are O(1))
- **Frontend**: 9 new dropdown options add <1KB to bundle size
- **Database**: Herb entries already exist, no schema changes needed
- **Import Speed**: Same as vegetables, dependent on CSV size

---

## Future Enhancements

### Enhancement 1: Herb-Specific Fields
Add fields like:
- `is_perennial` BOOLEAN - True for Rosemary, Thyme, etc.
- `hardiness_zones` VARCHAR(20) - e.g., "5-9"
- `herb_type` VARCHAR(20) - 'culinary', 'medicinal', 'ornamental'

### Enhancement 2: Advanced Sorting
Allow sorting by:
- Category (all herbs together, then alphabetically)
- Perennial vs annual
- Hardiness zones

### Enhancement 3: More Sample Data
Create additional sample CSVs:
- `sample-csvs/beans.csv` (10+ bean varieties)
- `sample-csvs/squash.csv` (winter, summer, zucchini)
- `sample-csvs/greens.csv` (kale, chard, spinach)

### Enhancement 4: Import Validation
Add warnings for:
- Varieties not in mapping (suggest using 'mixed')
- Unrealistic DTM ranges
- Invalid soil temperature ranges

---

**Last Updated**: 2025-11-17 23:15 UTC
**Next Review**: After user testing of herb import feature
