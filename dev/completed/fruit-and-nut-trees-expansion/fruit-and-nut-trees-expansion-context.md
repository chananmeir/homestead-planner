# Fruit and Nut Trees Expansion - Context

**Last Updated**: 2025-11-17

## Key Files

### Backend
- **backend/plant_database.py** (1861 lines)
  - Main plant data structure
  - Currently 72 plants, line 5: `PLANT_DATABASE = [`
  - Last entry ends ~line 1801 (tarragon-1)
  - Pattern to follow: lines 1552-1675 (berry entries)
  - Will append 14 tree entries after line 1801

- **backend/services/csv_import_service.py**
  - Lines 458-508: TYPE_MAPPING dictionaries (recent herb additions)
  - Lines 512-559: CROP_TYPE_MAPPINGS dictionary
  - Currently 45 crop types
  - Will add 14 TYPE_MAPPING dictionaries after line 508
  - Will add 14 entries to CROP_TYPE_MAPPINGS after line 559

### Frontend
- **frontend/src/components/SeedInventory/CSVImportModal.tsx**
  - Lines 70-83: Crop type dropdown options
  - Organized: Herbs (70-77), Berries/Fruits (79-83)
  - Will add Trees section after line 83

### Sample Data
- **sample-csvs/** directory
  - Existing: culinary-herbs.csv (template to follow)
  - Will create: fruit-trees.csv, nut-trees.csv

## Critical Decisions

### 1. Tree Selection
Selected 14 trees optimized for homestead productivity:
- **Fruit Trees (9)**: Apple, Pear, Sweet Cherry, Sour Cherry, Plum, Peach, Apricot, Fig, Persimmon
- **Nut Trees (5)**: Almond, Walnut, Pecan, Hazelnut, Chestnut

**Rationale**:
- Climate diversity: Zones 3-10 coverage
- Pollination variety: Self-fertile and cross-pollination types
- Bearing timeline: 2-7+ years (shows full range)
- Common homestead species (not exotic/rare)

### 2. Category Assignment
- Fruit trees: Use existing `category: 'fruit'` (matches berries)
- Nut trees: Create new `category: 'nut'` (first use of this category)

**Why**: Keeps fruit trees grouped with other fruit-producing perennials (berries). Nuts are nutritionally distinct (high protein/fat vs high sugar).

### 3. Days to Maturity for Trees
Trees use `daysToMaturity` to represent days to FIRST harvest:
- Existing pattern from berries: blackberry=365 (year 2), grape=1095 (year 3)
- Tree conversions:
  - 2 years = 730 days (fig, hazelnut - early bearing)
  - 3 years = 1095 days (peach, apricot - fast for stone fruits)
  - 4 years = 1460 days (cherry, plum)
  - 5 years = 1825 days (apple, pear - typical fruit trees)
  - 7 years = 2555 days (walnut, pecan - slow nut trees)
  - 10 years = 3650 days (some walnuts on standard rootstock)

**Why**: Maintains consistency with existing perennial entries. Important for planning timeline expectations.

### 4. Spacing for Trees
Using semi-dwarf rootstock spacing as default (most common for homesteads):
- Small trees: 120-180 inches (10-15 ft) - hazelnut, fig
- Medium trees: 180-240 inches (15-20 ft) - peach, apricot, plum, cherry
- Large fruit trees: 240-300 inches (20-25 ft) - apple, pear
- Nut trees: 300-480 inches (25-40 ft) - almond, walnut, pecan, chestnut

**Why**: Homesteaders typically choose semi-dwarf (easier harvest, faster bearing than standard, more production than dwarf). Can note other rootstock options in notes field.

### 5. Critical Tree-Specific Data in Notes Field
Must document these unique tree considerations:

**Pollination Requirements**:
- Self-fertile (can plant just one) vs cross-pollination needed (need 2+ varieties)
- Example: Most apples need 2 varieties, most peaches are self-fertile

**Chill Hours**:
- Number of hours below 45°F needed for fruiting
- Critical for mild winter climates (California, South, etc.)
- Example: Apples need 800-1000 hours, figs need 100-300 hours

**Rootstock Options**:
- Dwarf (6-10 ft, early bearing, needs support)
- Semi-dwarf (12-18 ft, balance of size/production)
- Standard (20-30 ft, long-lived, large harvest)

**Years to First Bearing**:
- Varies by rootstock and species
- Example: Dwarf apple year 2-3, semi-dwarf year 4-6, standard year 6-10

**Lifespan**:
- How long productive
- Example: Peach 15-20 years, apple 50-80 years, walnut 100+ years

### 6. Companion Plants for Trees
Limited data available for tree companions. Using:
- General beneficial herbs (nasturtium, chive, comfrey)
- Nitrogen fixers for under-tree guilds (bean varieties)
- Pest deterrents (marigold, garlic)
- Known incompatibilities (potato near stone fruits - disease vector)

**Why**: Tree companion planting less researched than annual vegetables. Conservative approach with proven combinations.

## Data Sources

### Agronomic Data
- Spacing: USDA/Extension recommendations for semi-dwarf rootstocks
- Hardiness zones: USDA Plant Hardiness Zone Map
- Chill hours: University extension publications (UC Davis, Cornell, etc.)
- Pollination requirements: Fruit tree nursery catalogs (Stark Bros, Raintree, etc.)
- Soil pH: USDA NRCS soil survey data

### Tree Selection Criteria
1. **Common homestead species** - widely adapted, proven production
2. **Nursery availability** - can actually purchase these trees
3. **Rootstock options** - dwarf/semi-dwarf available (not just standard)
4. **Climate diversity** - representation from cold (zone 3) to hot (zone 10)
5. **Food value** - high nutrition and storability

## Pattern Analysis

### Perennial Berry Pattern (Template)
From blackberry-1 (lines 1552-1575):
- All standard fields present (20+ fields)
- `daysToMaturity`: 365 (represents year 2 first harvest)
- `spacing`: 36 inches (3 feet)
- `category`: 'fruit'
- `notes`: "Perennial cane fruit. First harvest year 2. Very productive..."
- Documents production timeline, special needs, management

### Recent Herb Addition Pattern
From fennel-1 (lines 1676-1700):
- Perennial herb with full field data
- `notes`: "Dual-use... Perennial zones 6-10... ALLELOPATHIC..."
- Documents special characteristics, zones, warnings, uses

### CSV Import Pattern
From FENNEL_TYPE_MAPPING (lines 458-467):
- Dictionary maps variety names to plant ID
- 5-7 common varieties
- Fallback 'mixed' entry
- All lowercase keys

## Implementation Notes

### Backend Changes
- Add 14 entries to PLANT_DATABASE array (append after line 1801)
- Add 14 TYPE_MAPPING dictionaries (after line 508)
- Add 14 CROP_TYPE_MAPPINGS entries (after line 559)
- Total additions: ~1000 lines of code

### Frontend Changes
- Add 14 dropdown options (after line 83)
- Organize as two sections: "Trees - Fruit" and "Trees - Nut"
- Alphabetize within each section
- Total additions: ~20 lines

### Sample Data Changes
- Create fruit-trees.csv with 10-15 popular varieties
- Create nut-trees.csv with 5-8 popular varieties
- Follow culinary-herbs.csv format (CSV header + data rows)

## Special Considerations

### New Category: 'nut'
This is the first use of the 'nut' category. Verify:
- No hardcoded category assumptions in frontend filters
- Category icon/display logic handles new type
- Database queries include nut category where appropriate

### Tree-Specific UI Implications
Trees have unique characteristics that may affect UI:
- Much larger spacing (240-480 inches vs 6-48 inches)
- Much longer DTM (730-3650 days vs 40-120 days)
- May need special handling in garden designer for scale
- Note: Implementation focuses on DATABASE expansion, UI enhancements are future work

### Pollination Complexity
Some trees require specific pollinizer varieties:
- Example: Some cherries need specific compatible varieties
- Current database structure doesn't enforce this (just notes it)
- Future enhancement: Pollination compatibility matrix

## Testing Strategy

### Backend Validation
1. Python syntax check: `python -c "from plant_database import PLANT_DATABASE; print(len(PLANT_DATABASE))"`
2. Expected output: 86 plants
3. Check: No syntax errors, imports cleanly

### Frontend Validation
1. TypeScript compilation: `cd frontend && npm run build`
2. Expected: No type errors
3. Check: CSVImportModal dropdown renders with tree options

### Data Validation
1. Verify all 14 trees have all required fields
2. Verify ID format: `[tree-name]-1`
3. Verify category: 'fruit' or 'nut'
4. Verify spacing: 120-480 inches (reasonable tree spacing)
5. Verify daysToMaturity: 730-3650 (2-10 years)

## Success Metrics

- [x] 72 → 86 plants (+14) ✓ ACHIEVED
- [x] 0 → 14 trees (critical gap filled) ✓ ACHIEVED
- [x] 45 → 59 CSV import types (+14) ✓ ACHIEVED
- [x] 3 → 4 plant categories (added 'nut') ✓ ACHIEVED
- [x] 2 new sample CSV files created ✓ ACHIEVED
- [x] Zero syntax errors ✓ VERIFIED
- [x] Zero TypeScript errors ✓ VERIFIED
- [x] All tree entries have complete data ✓ VERIFIED
- [x] Pollination, chill hours, rootstock data documented ✓ VERIFIED

## Final Results

**Implementation Completed**: 2025-11-17

**Statistics**:
- Total plants: 86 (was 72)
- Categories: vegetable (43), herb (15), flower (6), fruit (17), nut (5)
- Tree entries: 14 (9 fruit + 5 nut)
- CSV import types: 59 (was 45)
- Sample CSV files: 2 new files (fruit-trees.csv, nut-trees.csv)

**Validation**:
- Backend Python: All imports successful, no syntax errors
- Frontend TypeScript: Compilation successful, no type errors
- Code quality: All tree entries have complete field data
- Special data: Chill hours, pollination, rootstock info documented in all entries

**Files Modified**:
1. backend/plant_database.py - Added 14 tree entries (lines 1801+)
2. backend/services/csv_import_service.py - Added 14 TYPE_MAPPINGS + dict entries
3. frontend/src/components/SeedInventory/CSVImportModal.tsx - Added 14 dropdown options
4. sample-csvs/fruit-trees.csv - Created with 15 varieties
5. sample-csvs/nut-trees.csv - Created with 13 varieties

## Timeline

- Created: 2025-11-17
- Implementation: 2025-11-17
- Completed: 2025-11-17 (same day - under 1 hour)
