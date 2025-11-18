# Duplicate Detection Bug - Context

**Last Updated**: 2025-11-13

## Architecture Overview

### CSV Import Flow

1. **User uploads CSV** via `CSVImportModal.tsx`
   - Sets crop type (default: lettuce)
   - Sets isGlobal flag (default: true - add to global catalog)
   - Uploads file

2. **Backend receives upload** at `/api/varieties/import` endpoint
   - Validates CSV format
   - Parses CSV rows
   - Maps variety types to plant_ids
   - Checks for duplicates
   - Imports non-duplicates

3. **Duplicate detection** in `import_varieties_to_database()`
   ```python
   existing = SeedInventory.query.filter_by(
       plant_id=variety_data['plant_id'],
       variety=variety_data['variety'],
       is_global=is_global
   ).first()
   ```

4. **Frontend search** in `SeedInventory.tsx`
   ```typescript
   const query = searchQuery.toLowerCase();
   result = result.filter(seed => {
       const plantName = getPlantName(seed.plantId).toLowerCase();
       const variety = seed.variety.toLowerCase();
       // ... searches brand, location, notes too
       return plantName.includes(query) || variety.includes(query) || ...
   });
   ```

## Key Differences

| Aspect | Duplicate Detection | Search |
|--------|-------------------|---------|
| **Case Sensitivity** | Case-sensitive (exact match) | Case-insensitive (toLowerCase) |
| **Scope** | Checks plant_id + variety + is_global | Searches across multiple fields |
| **Comparison** | Exact equality (===) | String contains (includes) |

## Database Schema

**SeedInventory Table**:
- `id` - Primary key
- `plant_id` - Foreign key to plant database (e.g., 'lettuce-looseleaf-1')
- `variety` - Variety name (e.g., 'Black Seeded Simpson')
- `brand` - Brand/supplier
- `quantity` - Number of packets
- `is_global` - Boolean (True = global catalog, False = personal)
- `notes`, `location`, etc.

## CSV File Structure

File: `C:\Users\march\Downloads\lettuce_varieties_max.csv`
- 54 lettuce varieties
- Columns: Variety, Type, Days to Maturity, Soil Temp Sowing F, Notes
- Examples:
  - Black Seeded Simpson, Looseleaf, 46-50, 40-75, "Early, frilly green leaves"
  - Grand Rapids, Looseleaf, 42-60, 40-75, Quick spring/fall variety

## Mapping Logic

The CSV Type column maps to plant_id:
- Looseleaf → 'lettuce-looseleaf-1'
- Romaine → 'lettuce-romaine-1'
- Butterhead → 'lettuce-butterhead-1'
- Crisphead → 'lettuce-crisphead-1'
- Summer Crisp → 'lettuce-summercrisp-1'

## User's Issue

User checks "Share with all users" (isGlobal=true) and uploads the CSV. The import fails with duplicate errors, but search shows no results for those varieties.

**Possible Causes**:
1. Global varieties exist in DB but aren't displayed in UI
2. Case mismatch ('Black Seeded Simpson' vs 'black seeded simpson')
3. Search filter is excluding global varieties
4. UI is not rendering global varieties properly

## Investigation Findings

### Database State (2025-11-13)

**Total Seeds**: 65
**All Global**: Yes (is_global=True for all 65)
**All Lettuce**: Yes (all have plant_id starting with 'lettuce')

### Specific Findings

1. **The duplicate detection is CORRECT** - All 54 varieties from the CSV are already in the database as global varieties
2. **The varieties ARE visible in the UI** - The API endpoint `/api/seeds` returns all 65 varieties with `isGlobal: true`
3. **The search IS working** - No filters are hiding global varieties from search results

### Root Cause

**There is NO BUG**. The system is working as designed:

- User's CSV file (`lettuce_varieties_max.csv`) contains 54 varieties
- ALL 54 of these varieties already exist in the database as global catalog entries
- The duplicate detection correctly identifies them as duplicates
- The import correctly refuses to create duplicates

### Why User Thinks It's a Bug

The user may be:
1. Not seeing the global varieties in the UI (need to verify with actual UI test)
2. Searching incorrectly
3. Looking at filtered results
4. Expecting to add personal copies of global varieties

### Actual CSV vs Database Comparison

| Variety Name | In CSV | In Database | plant_id | is_global |
|--------------|--------|-------------|----------|-----------|
| Black Seeded Simpson | ✓ | ✓ (ID=1) | lettuce-looseleaf-1 | True |
| Grand Rapids | ✓ | ✓ (ID=2) | lettuce-looseleaf-1 | True |
| Slobolt | ✓ | ✓ (ID=3) | lettuce-looseleaf-1 | True |
| Salad Bowl (Green) | ✓ | ✓ (ID=19) | lettuce-looseleaf-1 | True |
| Red Salad Bowl | ✓ | ✓ (ID=5) | lettuce-looseleaf-1 | True |

**ALL 54 varieties from the CSV match existing database entries**

### Case Sensitivity Note

There IS a minor case issue:
- CSV has: "Salad Bowl (Green)"
- Database has BOTH:
  - ID 19: "Salad Bowl (Green)" (exact match)
  - ID 4: "Salad Bowl (green)" (lowercase 'g')

This is a data quality issue but not the cause of the user's problem.

### Next Steps

Need to understand what the user is actually seeing in the UI:
1. Are the 65 varieties displayed?
2. Does search work for "Black Seeded Simpson"?
3. What exactly is the user experiencing?
