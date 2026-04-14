# Plant Variety CSV Import Format

This directory contains CSV files for bulk importing plant varieties into the Seed Inventory.

## CSV Format

### Required Columns

1. **Variety** (string, required)
   - Name of the plant variety
   - Example: "Black Seeded Simpson", "Parris Island Cos"

2. **Type** (string, required)
   - Sub-type of the crop for intelligent plant ID mapping
   - Must match a type defined in `backend/services/csv_import_service.py`
   - Example for lettuce: "Looseleaf", "Romaine", "Butterhead", "Crisphead", "Summer crisp"

3. **Days to Maturity** (string/number, required)
   - Days until harvest readiness
   - Accepts single number: "48"
   - Accepts range: "46-50" (will store midpoint in database, full range in notes)
   - Example: "46-50", "68-70", "55"

### Optional Columns

4. **Soil Temp Sowing F** (string, optional)
   - Optimal soil temperature range for sowing (Fahrenheit)
   - Example: "40-75"

5. **Notes** (string, optional)
   - Additional variety information
   - Example: "Early, frilly green leaves"

## Supported Crop Types

### Lettuce (crop_type: "lettuce")

Type mappings defined in `csv_import_service.py`:

- **Looseleaf** → `lettuce-looseleaf-1` (DTM: ~48 days)
- **Romaine** → `lettuce-romaine-1` (DTM: ~68 days)
- **Butterhead** → `lettuce-butterhead-1` (DTM: ~60 days)
- **Crisphead** → `lettuce-crisphead-1` (DTM: ~75 days)
- **Summer crisp** → `lettuce-summercrisp-1` (DTM: ~55 days)
- **Mixed** → `lettuce-1` (fallback for unknown types)

### Future Crop Types

To add new crop types (tomatoes, peppers, etc.):

1. Add type-specific plant entries to `backend/plant_database.py`
2. Create a new type mapping dict in `backend/services/csv_import_service.py`
3. Add the mapping to `CROP_TYPE_MAPPINGS`

## Example CSV

```csv
Variety,Type,Days to Maturity,Soil Temp Sowing F,Notes
Black Seeded Simpson,Looseleaf,46-50,40-75,"Early, frilly green leaves"
Parris Island Cos,Romaine,68-70,40-75,Standard romaine
Buttercrunch,Butterhead,60-65,40-75,"Heat-tolerant, sweet"
Iceberg,Crisphead,75-80,40-75,Classic head lettuce
Nevada,Summer crisp,55-60,40-75,"Bolt-resistant, crispy"
```

## Import Process

### Via API

**Endpoint**: `POST /api/varieties/import`

**Parameters**:
- `file`: CSV file (multipart/form-data)
- `cropType`: Crop type string (default: "lettuce")
- `isGlobal`: Boolean string "true" or "false" (default: "false") - Share varieties with all users

**Example using curl**:
```bash
# Import as global/shared varieties (recommended for admin)
curl -X POST http://localhost:5000/api/varieties/import \
  -F "file=@lettuce_varieties.csv" \
  -F "cropType=lettuce" \
  -F "isGlobal=true"

# Import as personal varieties (user-specific)
curl -X POST http://localhost:5000/api/varieties/import \
  -F "file=@lettuce_varieties.csv" \
  -F "cropType=lettuce" \
  -F "isGlobal=false"
```

**Response**:
```json
{
  "success": true,
  "imported": 19,
  "total_rows": 19,
  "crop_type": "lettuce",
  "preview": [
    {
      "variety": "Black Seeded Simpson",
      "plant_id": "lettuce-looseleaf-1",
      "days_to_maturity": 48
    }
  ],
  "warnings": []
}
```

### Via Frontend UI

1. Navigate to Seed Inventory page
2. Click "Import from CSV" button
3. Select crop type from dropdown
4. Check/uncheck "Share with all users" checkbox:
   - **Checked** (default): Varieties will be added to global catalog (visible to all users, read-only)
   - **Unchecked**: Varieties will be personal (only visible to you, editable)
5. Upload CSV file (drag-and-drop or browse)
6. Review preview and confirm import

## Data Storage

Imported varieties are stored in the `SeedInventory` table with:

- **plant_id**: Mapped from Type column
- **variety**: Variety name
- **days_to_maturity**: Midpoint of DTM range
- **notes**: Combined string with Type, DTM range, Soil Temp, and Notes
  - Example: `"Type: Looseleaf | DTM: 46-50 days | Soil Temp: 40-75°F | Early, frilly green leaves"`
- **brand**: NULL (to be filled by user)
- **quantity**: 0 (to be updated by user)
- **location**: Empty string (to be filled by user)
- **is_global**: Boolean flag indicating if variety is shared with all users (default: false)

## Global vs Personal Varieties

### Global Varieties (is_global = true)

**Characteristics**:
- Shared catalog visible to all users
- Read-only (cannot be edited or deleted)
- Display "Global Catalog" badge in UI
- Edit and Delete buttons are disabled
- Ideal for admin-curated variety collections

**Use Cases**:
- Admin imports standard variety collections for everyone
- Community-shared seed catalogs
- Reference variety databases

### Personal Varieties (is_global = false)

**Characteristics**:
- User-specific inventory
- Fully editable and deletable
- No badge displayed
- All actions enabled
- Ideal for individual seed tracking

**Use Cases**:
- Personal seed purchases
- Experimental varieties
- User-specific inventory management

### Protection Mechanism

Global varieties are protected by:
- **Backend**: DELETE endpoint returns 403 Forbidden
- **Frontend**: Edit/Delete buttons disabled with explanatory tooltips
- **Database**: is_global column defaults to false for safety

## Validation

The import service performs these validations:

1. **CSV Structure**: Checks for required columns
2. **Data Rows**: Ensures at least one data row exists
3. **Required Fields**: Validates Variety, Type, and Days to Maturity are present
4. **DTM Format**: Validates DTM is a number or valid range (e.g., "46-50")
5. **Crop Type**: Ensures crop type is supported
6. **Variety Type**: Maps type to plant ID, uses fallback if unknown
7. **Duplicates**: Skips varieties already in database (same plant_id + variety name)

## Error Handling

The import service provides detailed error messages:

- Missing columns: Lists which required columns are missing
- Invalid DTM format: Shows the problematic DTM string
- Unknown crop type: Lists supported crop types
- Row-level errors: Includes row number for easy debugging
- Database errors: Reports transaction failures

## Files in This Directory

- **lettuce_varieties.csv**: Example lettuce varieties (19 varieties across 5 types)
- **README.md**: This documentation file

## See Also

- Backend service: `backend/services/csv_import_service.py`
- Plant database: `backend/plant_database.py`
- API endpoint: `backend/app.py` (search for `/api/varieties/import`)
- Frontend component: `frontend/src/components/SeedInventory/CSVImportModal.tsx`
