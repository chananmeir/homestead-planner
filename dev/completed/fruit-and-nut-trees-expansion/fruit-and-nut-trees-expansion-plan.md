# Fruit and Nut Trees Expansion - Implementation Plan

**Status**: Active
**Created**: 2025-11-17
**Last Updated**: 2025-11-17

## Objective

Add comprehensive fruit and nut tree support to Homestead Planner, filling the critical gap in the database which currently has 72 plants but ZERO tree crops.

## Scope

### Trees to Add (14 total)

#### Fruit Trees (9)
1. **Apple** - Most versatile homestead fruit, stores well, zones 3-8
2. **Pear** - Long-lived, fire blight resistant varieties, zones 4-8
3. **Cherry (Sweet)** - High value, birds love them, zones 5-8
4. **Cherry (Sour/Tart)** - Hardier, self-fertile, better for baking, zones 4-8
5. **Plum** - European and Japanese types, zones 4-9
6. **Peach** - Short-lived but productive, zones 5-9
7. **Apricot** - Early bloomer, frost risk, zones 4-9
8. **Fig** - Heat lover, container-friendly, zones 7-10
9. **Persimmon** - American variety super hardy, zones 4-9

#### Nut Trees (5)
1. **Almond** - California staple, needs chill hours, zones 5-9
2. **Walnut (English/Black)** - Black is native, English better nuts, zones 4-9
3. **Pecan** - Southern classic, needs long season, zones 6-9
4. **Hazelnut (Filbert)** - Shrub-like, quick bearing, zones 4-9
5. **Chestnut** - American blight-resistant hybrids, zones 4-8

### Rationale

- **Homestead productivity focus**: Selected trees that provide food, not ornamentals
- **Climate diversity**: Range from zone 3 (apple) to zone 10 (fig)
- **Pollination variety**: Mix of self-fertile and cross-pollination required
- **Bearing timeline**: From 2 years (fig, hazelnut) to 7+ years (walnut, pecan)
- **Size options**: Noted dwarf/semi-dwarf rootstocks available

## Technical Implementation

### 1. Backend Plant Database (`backend/plant_database.py`)

**Location**: Append to PLANT_DATABASE list (currently ends at line 1801)

**Pattern to follow**: Perennial berries (lines 1552-1675)
- Use `category: 'fruit'` for fruit trees
- Use `category: 'nut'` for nut trees (NEW category)
- `spacing`: 180-300 inches (15-25 feet)
- `rowSpacing`: Same as spacing for trees
- `daysToMaturity`: Days to first harvest (730 = 2 years, 1095 = 3 years, etc.)
- `frostTolerance`: 'hardy' for most
- `winterHardy`: True for most
- `notes`: CRITICAL - must include:
  - Pollination requirements (self-fertile vs cross-pollination)
  - Chill hours required
  - Rootstock options (dwarf/semi-dwarf/standard)
  - Years to first bearing
  - Expected lifespan
  - Special considerations

**Example Entry Structure**:
```python
{
    'id': 'apple-1',
    'name': 'Apple',
    'scientificName': 'Malus domestica',
    'category': 'fruit',
    'spacing': 240,  # 20 feet for semi-dwarf
    'rowSpacing': 240,
    'daysToMaturity': 1825,  # 5 years to first harvest
    'frostTolerance': 'hardy',
    'winterHardy': True,
    'companionPlants': ['nasturtium-1', 'chive-1'],
    'incompatiblePlants': ['potato-1'],
    'waterNeeds': 'medium',
    'sunRequirement': 'full',
    'soilPH': {'min': 6.0, 'max': 7.0},
    'plantingDepth': 0,  # Bareroot planting
    'germinationTemp': {'min': 60, 'max': 75},
    'soil_temp_min': 60,
    'transplantWeeksBefore': 0,
    'germination_days': 60,  # From seed (not typical)
    'ideal_seasons': ['spring', 'fall'],
    'heat_tolerance': 'medium',
    'notes': 'Perennial tree. First harvest year 4-6 (dwarf), 5-8 (semi-dwarf). Requires 800-1000 chill hours. Most varieties need cross-pollination (plant 2+ varieties). Rootstocks: M27 (dwarf 6-8ft), M26 (semi-dwarf 12-15ft), MM111 (standard 20-25ft). Productive 30-50 years. Prune annually in late winter.',
    'icon': '🍎'
}
```

### 2. CSV Import Service (`backend/services/csv_import_service.py`)

**Location**:
- TYPE_MAPPING dictionaries: After line 508
- CROP_TYPE_MAPPINGS entries: After line 559

**Pattern to follow**: Recent herb additions (lines 458-508)

For each tree, create a TYPE_MAPPING dictionary:
```python
APPLE_TYPE_MAPPING = {
    'honeycrisp': 'apple-1',
    'gala': 'apple-1',
    'fuji': 'apple-1',
    'granny-smith': 'apple-1',
    'red-delicious': 'apple-1',
    'golden-delicious': 'apple-1',
    'crabapple': 'apple-1',
    # Fallback
    'mixed': 'apple-1',
}
```

Then add to CROP_TYPE_MAPPINGS:
```python
    # Trees - Fruit
    'apple': APPLE_TYPE_MAPPING,
    'pear': PEAR_TYPE_MAPPING,
    # ... etc
    # Trees - Nut
    'almond': ALMOND_TYPE_MAPPING,
    'walnut': WALNUT_TYPE_MAPPING,
    # ... etc
```

### 3. Frontend UI (`frontend/src/components/SeedInventory/CSVImportModal.tsx`)

**Location**: After line 83 (after elderberries)

Add new section for trees:
```typescript
    // Trees - Fruit
    { value: 'apple', label: 'Apple' },
    { value: 'apricot', label: 'Apricot' },
    { value: 'cherry-sweet', label: 'Cherry (Sweet)' },
    { value: 'cherry-sour', label: 'Cherry (Sour/Tart)' },
    { value: 'fig', label: 'Fig' },
    { value: 'peach', label: 'Peach' },
    { value: 'pear', label: 'Pear' },
    { value: 'persimmon', label: 'Persimmon' },
    { value: 'plum', label: 'Plum' },
    // Trees - Nut
    { value: 'almond', label: 'Almond' },
    { value: 'chestnut', label: 'Chestnut' },
    { value: 'hazelnut', label: 'Hazelnut (Filbert)' },
    { value: 'pecan', label: 'Pecan' },
    { value: 'walnut', label: 'Walnut' },
```

### 4. Sample CSV Files (`sample-csvs/`)

Create two new files following `sample-csvs/culinary-herbs.csv` pattern:

**sample-csvs/fruit-trees.csv**:
- Variety Name, Type, Quantity, Chill Hours, Pollination
- 10-15 popular varieties (Honeycrisp apple, Bartlett pear, etc.)

**sample-csvs/nut-trees.csv**:
- Variety Name, Type, Quantity, Chill Hours, Self-Fertile
- 5-8 popular varieties (Chandler walnut, Carmel almond, etc.)

## Key Decisions

### 1. Category Assignment
- Fruit trees: `category: 'fruit'` (matches existing berries)
- Nut trees: `category: 'nut'` (NEW category - first use)

### 2. Days to Maturity Calculation
For trees, this represents days to FIRST harvest:
- 2 years = 730 days (fig, hazelnut)
- 3 years = 1095 days (peach, apricot)
- 4-5 years = 1460-1825 days (most fruit trees)
- 7+ years = 2555+ days (walnut, pecan)

### 3. Spacing Convention
Use spacing for semi-dwarf rootstocks as default:
- Small trees (hazelnut, fig): 120-180 inches (10-15 feet)
- Medium trees (peach, plum, cherry): 180-240 inches (15-20 feet)
- Large trees (apple, pear): 240-300 inches (20-25 feet)
- Nut trees: 300-480 inches (25-40 feet)

### 4. Special Considerations in Notes
Must document:
- **Chill hours**: Cold requirement for fruiting (critical for mild climates)
- **Pollination**: Self-fertile vs needs pollinizer variety
- **Rootstocks**: Size categories (dwarf, semi-dwarf, standard)
- **Years to bearing**: When first harvest expected
- **Lifespan**: How long productive (30-100+ years)
- **Pruning needs**: Annual, biennial, or minimal

## Expected Outcomes

**Before**:
- Total plants: 72
- Total trees: 0 ← CRITICAL GAP
- CSV import types: 45

**After**:
- Total plants: 86 (+14)
- Total trees: 14 (9 fruit + 5 nut)
- CSV import types: 59 (+14)
- Categories: vegetables, herbs, fruit, nut (nut is new)

## Success Criteria

- [ ] All 14 tree entries added to plant_database.py
- [ ] All required fields populated with accurate data
- [ ] Pollination, chill hours, rootstock info in notes
- [ ] 14 TYPE_MAPPING dictionaries created
- [ ] CROP_TYPE_MAPPINGS updated with all 14 types
- [ ] Frontend dropdown updated with all 14 options
- [ ] 2 sample CSV files created with realistic varieties
- [ ] Backend Python syntax validates cleanly
- [ ] Frontend TypeScript compiles without errors
- [ ] Plant count increases from 72 to 86

## Timeline

- Phase 1 (Discovery): 5-10 minutes ✓
- Phase 2 (Implementation): 15-30 minutes
- Phase 3 (Validation): 5-10 minutes
- Total: 25-50 minutes

## Notes

This fills a major gap in the database. Trees are the backbone of a homestead food system - they provide perennial production with minimal maintenance after establishment. While they take years to bear fruit, they can produce for decades or even centuries.

The database currently has excellent annual vegetable coverage, good herb coverage, and basic berry coverage - but zero tree crops. This expansion makes Homestead Planner suitable for true long-term homestead planning.
