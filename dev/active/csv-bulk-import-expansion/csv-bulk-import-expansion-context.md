# CSV Bulk Import Expansion - Context & Decisions

**Last Updated**: 2025-11-13

## Key Files

### Backend
- **`backend/services/csv_import_service.py`**: CSV parsing and import logic (333 lines)
- **`backend/app.py`**: Line 765-835, `/api/varieties/import` endpoint
- **`backend/plant_database.py`**: Plant definitions with IDs (1158 lines, 60+ plants)
- **`backend/models.py`**: Line 244-273, SeedInventory model

### Frontend
- **`frontend/src/components/SeedInventory/CSVImportModal.tsx`**: Import modal UI (293 lines)
- **`frontend/src/config.ts`**: API_BASE_URL configuration

## Architecture

### CSV Import Pattern

The system uses a two-level mapping approach:

```
User CSV → Crop Type Selection → Variety Type Mapping → Plant ID → Database
```

**Example Flow:**
1. User selects "carrot" crop type
2. CSV contains row: `Scarlet Nantes,Nantes,68,...`
3. System looks up: `CARROT_TYPE_MAPPING['nantes']` → `'carrot-1'`
4. Creates SeedInventory record with plant_id='carrot-1'

### Case-Insensitive Matching

All type mapping keys are **lowercase** to enable case-insensitive matching:
- CSV can contain "Nantes", "NANTES", or "nantes"
- `map_variety_to_plant_id()` normalizes input to lowercase before lookup
- This was a lesson learned from the lettuce import fix

### Fallback Strategy

Each TYPE_MAPPING includes a 'mixed' fallback:
- If variety type is unknown, map to 'mixed'
- If 'mixed' doesn't exist, use first mapping entry
- Prevents import failures due to unexpected variety types

## Design Decisions

### Decision 1: Which Crops to Include

**Question**: Which crops beyond carrots should we add?

**Analysis**:
- Plant database has 60+ plants
- Some have variety-specific entries (lettuce, tomato, pepper, bean, squash)
- Most have single generic entries

**Decision**: Add 14 total crop types in 3 tiers
- **Tier 1**: Carrots (requested), Tomatoes, Peppers, Beans (high variety diversity)
- **Tier 2**: Squash, Cucumber, Pea, Beet, Radish (common garden vegetables)
- **Tier 3**: Broccoli, Cauliflower, Cabbage, Kale (brassicas)

**Rationale**:
- Covers most common home garden vegetables
- Includes all plants with variety-specific entries in database
- Balances completeness with implementation effort
- User can bulk import seeds for entire garden, not just greens

### Decision 2: Carrot Variety Type Mapping

**Question**: Carrots only have one plant ID (carrot-1). How should we map variety types?

**Options**:
1. Single mapping: all types → carrot-1
2. No type mapping: variety name only
3. Wait for variety-specific carrot entries in database

**Decision**: Option 1 - Map common carrot types to carrot-1
- Nantes, Imperator, Chantenay, Danvers → all map to carrot-1
- Preserves variety name in database for user reference
- Allows filtering/sorting by variety characteristics
- Future-proof: can add carrot-nantes-1, etc. later without breaking imports

**Carrot Types to Support**:
- Nantes (cylindrical, sweet, 6-7")
- Imperator (long, tapered, 9-10")
- Chantenay (short, broad, 5-6")
- Danvers (medium, good storage, 6-8")
- Ball/Paris Market (round, container variety)
- Mixed (fallback)

### Decision 3: Tomato Type Mapping Strategy

**Question**: How to map tomato variety types to tomato-1 vs tomato-cherry-1?

**Mapping Strategy**:
- **Beefsteak, Slicing, Heirloom, Roma, Paste** → tomato-1
- **Cherry, Grape, Currant** → tomato-cherry-1
- Mixed → tomato-1 (fallback to standard)

**Rationale**:
- Cherry tomatoes have different growing characteristics (smaller spacing, faster maturity)
- Database has separate entries for this distinction
- Most tomato varieties fall into "standard" category

### Decision 4: Pepper Type Mapping Strategy

**Question**: How to distinguish bell vs hot peppers?

**Mapping Strategy**:
- **Bell, Sweet, Pimento** → pepper-bell-1
- **Hot, Jalapeño, Cayenne, Habanero, Serrano** → pepper-hot-1
- Mixed → pepper-bell-1 (fallback to milder)

**Rationale**:
- Clear distinction between sweet and hot peppers
- Handles accent variations (jalapeño vs jalapeno)
- Different growing requirements (hot peppers often need longer season)

### Decision 5: Bean Type Mapping Strategy

**Question**: How to map bush vs pole beans?

**Mapping Strategy**:
- **Bush, Dwarf** → bean-bush-1
- **Pole, Climbing, Runner** → bean-pole-1
- Mixed → bean-bush-1 (fallback to bush)

**Rationale**:
- Fundamentally different growing methods (bush vs trellised)
- Database has separate entries for spacing and support needs
- Bush beans are more common for beginners

### Decision 6: Frontend Label Capitalization

**Frontend Display**: Capitalize and pluralize crop names
- Backend: 'carrot' → Frontend: 'Carrots'
- Backend: 'tomato' → Frontend: 'Tomatoes'
- Backend: 'pepper' → Frontend: 'Peppers'

**Rationale**: User-friendly display in dropdown

### Decision 7: Single-Type Crops Mapping

**Question**: For crops with only one plant ID (cucumber, pea, beet, etc.), should we skip type mapping?

**Decision**: Still include type mapping with common variety names
- Allows CSV flexibility
- Future-proof for variety-specific entries
- Consistent pattern across all crops

**Example**: Cucumbers
```python
CUCUMBER_TYPE_MAPPING = {
    'slicing': 'cucumber-1',
    'pickling': 'cucumber-1',
    'burpless': 'cucumber-1',
    'lemon': 'cucumber-1',
    'mixed': 'cucumber-1',
}
```

## Variety Type Reference

### Carrot Types (all → carrot-1)
- **Nantes**: Cylindrical, sweet, blunt tip, 6-7 inches
- **Imperator**: Long, tapered, deep orange, 9-10 inches
- **Chantenay**: Short, broad shoulders, 5-6 inches
- **Danvers**: Medium, good storage, 6-8 inches
- **Ball/Paris Market**: Round, container variety

### Tomato Types
- **Standard (tomato-1)**: Beefsteak, Slicing, Heirloom, Roma, Paste
- **Cherry (tomato-cherry-1)**: Cherry, Grape, Currant

### Pepper Types
- **Bell (pepper-bell-1)**: Bell, Sweet, Pimento
- **Hot (pepper-hot-1)**: Jalapeño, Cayenne, Habanero, Serrano

### Bean Types
- **Bush (bean-bush-1)**: Bush, Dwarf
- **Pole (bean-pole-1)**: Pole, Climbing, Runner

### Squash Types
- **Summer (squash-summer-1)**: Zucchini, Yellow, Pattypan
- **Winter (squash-winter-1)**: Butternut, Acorn, Hubbard, Delicata

## Implementation Notes

### Backend Changes Location
File: `backend/services/csv_import_service.py`
- Lines 17-28: Current LETTUCE_TYPE_MAPPING
- Lines 30-35: Current CROP_TYPE_MAPPINGS
- **Insert new mappings**: After line 28, before CROP_TYPE_MAPPINGS
- **Update CROP_TYPE_MAPPINGS**: Lines 30-35 → expand to lines 30-50

### Frontend Changes Location
File: `frontend/src/components/SeedInventory/CSVImportModal.tsx`
- Lines 36-41: Current cropTypes array
- **Expand array**: Add 13 new entries

## CSV Format Constraints

All CSV files must have these columns:
- **Variety** (required): e.g., "Scarlet Nantes"
- **Type** (required): e.g., "Nantes"
- **Days to Maturity** (required): e.g., "68" or "68-75"
- **Soil Temp Sowing F** (optional): e.g., "45-85"
- **Notes** (optional): Free text

## Database Schema

SeedInventory records created by import:
```python
{
    'plant_id': 'carrot-1',        # From type mapping
    'variety': 'Scarlet Nantes',   # From CSV
    'days_to_maturity': 71,        # Midpoint of range
    'notes': 'Type: Nantes | DTM: 68-75 days | Soil Temp: 45-85°F | Sweet, cylindrical',
    'quantity': 0,                 # Default
    'is_global': True/False,       # From import form
}
```

## Related Work

Previous task: `dev/active/seed-import-fix/`
- Fixed lettuce import case sensitivity issues
- Added 'romaine mini' variant
- Established case-insensitive pattern we're following here

## Future Enhancements

Potential additions after this phase:
1. **Herbs**: Basil, Cilantro, Parsley, Dill (single types each)
2. **Specialty fields**: Tomato determinate/indeterminate, pepper heat level
3. **CSV export**: Export seed inventory back to CSV
4. **Bulk quantity update**: Update quantities for multiple varieties at once
5. **Import templates**: Downloadable CSV templates for each crop type
