# CSV Bulk Import Expansion - Implementation Plan

**Created**: 2025-11-13
**Last Updated**: 2025-11-13
**Status**: Completed
**Completion Date**: 2025-11-13

## Objective

Add carrot support to the CSV bulk import system, along with other common crop types that should support variety imports. User specifically requested carrot import capability.

## Current State

### Existing Infrastructure
- CSV import service: `backend/services/csv_import_service.py`
- Frontend modal: `frontend/src/components/SeedInventory/CSVImportModal.tsx`
- Backend endpoint: `/api/varieties/import` (in `backend/app.py`)

### Currently Supported
- **Lettuce only** with 6 variety type mappings:
  - Looseleaf → lettuce-looseleaf-1
  - Romaine → lettuce-romaine-1
  - Romaine Mini → lettuce-romaine-1
  - Butterhead → lettuce-butterhead-1
  - Crisphead → lettuce-crisphead-1
  - Summer Crisp → lettuce-summercrisp-1

## Crop Types to Add

### Tier 1: Explicitly Requested + High-Variety Crops
1. **Carrots** (REQUESTED) - Single generic type (all varieties → carrot-1)
2. **Tomatoes** - 2 types: Beefsteak, Cherry
3. **Peppers** - 2 types: Bell, Hot
4. **Beans** - 2 types: Bush, Pole

### Tier 2: Common Garden Vegetables
5. **Squash** - 2 types: Summer (Zucchini), Winter (Butternut)
6. **Cucumbers** - Single generic type
7. **Peas** - Single generic type
8. **Beets** - Single generic type
9. **Radishes** - Single generic type

### Tier 3: Brassicas
10. **Broccoli** - Single generic type
11. **Cauliflower** - Single generic type
12. **Cabbage** - Single generic type
13. **Kale** - Single generic type

## Implementation Strategy

### Backend Changes (csv_import_service.py)

For each crop type, create a TYPE_MAPPING dictionary:

#### Single-Type Crops (map all variety names to one plant ID)
```python
CARROT_TYPE_MAPPING = {
    'nantes': 'carrot-1',
    'imperator': 'carrot-1',
    'chantenay': 'carrot-1',
    'danvers': 'carrot-1',
    'mixed': 'carrot-1',  # Fallback
}
```

#### Multi-Type Crops (map variety names to specific plant IDs)
```python
TOMATO_TYPE_MAPPING = {
    'beefsteak': 'tomato-1',
    'slicing': 'tomato-1',
    'cherry': 'tomato-cherry-1',
    'grape': 'tomato-cherry-1',
    'mixed': 'tomato-1',  # Fallback
}

PEPPER_TYPE_MAPPING = {
    'bell': 'pepper-bell-1',
    'sweet': 'pepper-bell-1',
    'hot': 'pepper-hot-1',
    'jalapeño': 'pepper-hot-1',
    'jalapeno': 'pepper-hot-1',  # Handle accent variation
    'cayenne': 'pepper-hot-1',
    'mixed': 'pepper-bell-1',  # Fallback
}

BEAN_TYPE_MAPPING = {
    'bush': 'bean-bush-1',
    'pole': 'bean-pole-1',
    'climbing': 'bean-pole-1',
    'mixed': 'bean-bush-1',  # Fallback
}

SQUASH_TYPE_MAPPING = {
    'summer': 'squash-summer-1',
    'zucchini': 'squash-summer-1',
    'yellow': 'squash-summer-1',
    'winter': 'squash-winter-1',
    'butternut': 'squash-winter-1',
    'acorn': 'squash-winter-1',
    'mixed': 'squash-summer-1',  # Fallback
}
```

#### Add to CROP_TYPE_MAPPINGS
```python
CROP_TYPE_MAPPINGS = {
    'lettuce': LETTUCE_TYPE_MAPPING,
    'carrot': CARROT_TYPE_MAPPING,
    'tomato': TOMATO_TYPE_MAPPING,
    'pepper': PEPPER_TYPE_MAPPING,
    'bean': BEAN_TYPE_MAPPING,
    'squash': SQUASH_TYPE_MAPPING,
    'cucumber': CUCUMBER_TYPE_MAPPING,
    'pea': PEA_TYPE_MAPPING,
    'beet': BEET_TYPE_MAPPING,
    'radish': RADISH_TYPE_MAPPING,
    'broccoli': BROCCOLI_TYPE_MAPPING,
    'cauliflower': CAULIFLOWER_TYPE_MAPPING,
    'cabbage': CABBAGE_TYPE_MAPPING,
    'kale': KALE_TYPE_MAPPING,
}
```

### Frontend Changes (CSVImportModal.tsx)

Update cropTypes array to include all new crop types:

```typescript
const cropTypes = [
  { value: 'lettuce', label: 'Lettuce' },
  { value: 'carrot', label: 'Carrots' },
  { value: 'tomato', label: 'Tomatoes' },
  { value: 'pepper', label: 'Peppers' },
  { value: 'bean', label: 'Beans' },
  { value: 'squash', label: 'Squash' },
  { value: 'cucumber', label: 'Cucumbers' },
  { value: 'pea', label: 'Peas' },
  { value: 'beet', label: 'Beets' },
  { value: 'radish', label: 'Radishes' },
  { value: 'broccoli', label: 'Broccoli' },
  { value: 'cauliflower', label: 'Cauliflower' },
  { value: 'cabbage', label: 'Cabbage' },
  { value: 'kale', label: 'Kale' },
];
```

## Plant ID Reference

From plant_database.py:

| Crop Type | Plant IDs | Notes |
|-----------|-----------|-------|
| Carrot | carrot-1 | Generic carrot |
| Tomato | tomato-1, tomato-cherry-1 | Beefsteak and Cherry |
| Pepper | pepper-bell-1, pepper-hot-1 | Bell/Sweet and Hot |
| Bean | bean-bush-1, bean-pole-1 | Bush and Pole |
| Squash | squash-summer-1, squash-winter-1 | Summer and Winter |
| Cucumber | cucumber-1 | Generic |
| Pea | pea-1 | Generic shelling pea |
| Beet | beet-1 | Generic |
| Radish | radish-1 | Generic |
| Broccoli | broccoli-1 | Generic |
| Cauliflower | cauliflower-1 | Generic |
| Cabbage | cabbage-1 | Generic |
| Kale | kale-1 | Lacinato type |

## CSV Format Examples

### Carrots
```csv
Variety,Type,Days to Maturity,Soil Temp Sowing F,Notes
Scarlet Nantes,Nantes,68-75,45-85,"Sweet, cylindrical, 6-7 inches"
Danvers 126,Danvers,75,45-85,"Broad shoulders, good storage"
Imperator 58,Imperator,68,45-85,"Long, tapered, deep orange"
```

### Tomatoes
```csv
Variety,Type,Days to Maturity,Soil Temp Sowing F,Notes
Brandywine,Beefsteak,80-90,60-85,"Heirloom, pink, excellent flavor"
Sun Gold,Cherry,55-65,60-85,"Orange, very sweet, prolific"
Cherokee Purple,Beefsteak,80,60-85,"Heirloom, dusky rose color"
```

### Peppers
```csv
Variety,Type,Days to Maturity,Soil Temp Sowing F,Notes
California Wonder,Bell,70-75,65-85,"Classic blocky bell, thick walls"
Jalapeño M,Hot,70-80,65-85,"Medium heat, great for salsa"
Cayenne Long Slim,Hot,70,65-85,"Very hot, drying pepper"
```

## Files to Modify

1. **Backend**: `backend/services/csv_import_service.py`
   - Add 13 new TYPE_MAPPING dictionaries (lines ~30-150)
   - Update CROP_TYPE_MAPPINGS dictionary (lines ~31-45)

2. **Frontend**: `frontend/src/components/SeedInventory/CSVImportModal.tsx`
   - Update cropTypes array (lines 36-41)
   - Add 13 new crop type options

## Implementation Checklist

- [ ] Create all TYPE_MAPPING dictionaries in backend
- [ ] Update CROP_TYPE_MAPPINGS in backend
- [ ] Update cropTypes array in frontend
- [ ] Run Python syntax check
- [ ] Run TypeScript compilation check
- [ ] Test carrot import with sample CSV
- [ ] Document in context.md
- [ ] Update this plan with completion status

## Testing Plan

1. **Backend API Testing** (via curl):
   ```bash
   curl -X POST http://localhost:5000/api/varieties/import \
     -F "file=@carrots.csv" \
     -F "cropType=carrot" \
     -F "isGlobal=true"
   ```

2. **Frontend Testing**:
   - Navigate to Seeds tab
   - Click "Import from CSV"
   - Verify all 14 crop types appear in dropdown
   - Test carrot CSV import
   - Verify varieties appear in seed inventory

## Success Criteria

- [ ] All 14 crop types added to backend mappings
- [ ] All 14 crop types appear in frontend dropdown
- [ ] Carrot CSV import works successfully
- [ ] Backend Python syntax is valid
- [ ] Frontend TypeScript compiles without errors
- [ ] No regression in existing lettuce import functionality

## Next Steps After Completion

1. Create sample CSV files for each crop type
2. Add CSV templates to documentation
3. Consider adding herb support (basil, cilantro, parsley, etc.)
4. Consider adding variety-specific fields (e.g., tomato determinate/indeterminate)
