# Seed Import Fix - Context & Decisions

**Last Updated**: 2025-11-13

## Key Files

### Backend
- **`backend/services/csv_import_service.py`**: CSV parsing and import logic
- **`backend/app.py`**: Line 765-835, `/api/varieties/import` endpoint
- **`backend/models.py`**: Line 244-273, SeedInventory model

### Frontend
- **`frontend/src/components/SeedInventory.tsx`**: Main seed inventory component
- **`frontend/src/components/SeedInventory/CSVImportModal.tsx`**: Import modal UI
- **`frontend/src/App.tsx`**: Tab navigation for Seeds tab

## Architecture

### Import Flow
1. User clicks "Import from CSV" button in Seed Inventory
2. CSVImportModal opens with file upload
3. User selects crop type (default: lettuce) and isGlobal flag
4. File uploaded via FormData to `/api/varieties/import`
5. Backend validates CSV format
6. Backend parses CSV rows
7. Backend maps variety types to plant IDs
8. Backend creates SeedInventory records
9. Response includes import count and preview
10. UI reloads seed list

### Type Mapping System

The CSV import uses a two-level mapping system:

```python
CROP_TYPE_MAPPINGS = {
    'lettuce': LETTUCE_TYPE_MAPPING,
    # Future crops can be added here
}

LETTUCE_TYPE_MAPPING = {
    'looseleaf': 'lettuce-looseleaf-1',
    'romaine': 'lettuce-romaine-1',
    'romaine mini': 'lettuce-romaine-1',  # Variant
    'butterhead': 'lettuce-butterhead-1',
    'crisphead': 'lettuce-crisphead-1',
    'summer crisp': 'lettuce-summercrisp-1',
    'mixed': 'lettuce-1',  # Fallback
}
```

**Why lowercase?**: All keys are lowercase to enable case-insensitive matching. The `map_variety_to_plant_id()` function normalizes input to lowercase before lookup.

### Duplicate Detection

The import service checks for duplicates using:
```python
existing = SeedInventory.query.filter_by(
    plant_id=variety_data['plant_id'],
    variety=variety_data['variety'],
    is_global=is_global
).first()
```

**Important**: Duplicates are based on exact variety name AND is_global flag. This means:
- A variety can exist twice: once as personal (isGlobal=false), once as global (isGlobal=true)
- Case-sensitive variety name matching (e.g., "Red Sails" ≠ "red sails")

## Design Decisions

### Decision 1: Case-Insensitive Type Matching
**Problem**: CSV files from different sources use inconsistent capitalization.

**Options Considered**:
1. Normalize CSV data on upload
2. Add all case variants to mapping
3. Make mapping lookup case-insensitive

**Decision**: Option 3 - Case-insensitive lookup
- **Pros**: Most flexible, handles any future case variations
- **Cons**: Slightly more processing per lookup
- **Implementation**: Convert all keys to lowercase, normalize input in lookup function

### Decision 2: Romaine Mini Mapping
**Problem**: "Romaine mini" appears in CSV but isn't a separate plant type in database.

**Options Considered**:
1. Create separate "lettuce-romaine-mini-1" plant ID
2. Map to regular romaine
3. Treat as error

**Decision**: Option 2 - Map to regular romaine
- **Rationale**: Mini romaine has same growing characteristics as regular romaine
- **Note**: Variety name preserved in notes field for distinction

### Decision 3: Global vs Personal Varieties
**Current**: Default isGlobal=true in UI
**Rationale**: Variety catalogs are typically shared resources
**User Control**: Checkbox in import modal allows personal imports

### Decision 4: Quantity Default
**Current**: Imported varieties have quantity=0
**Rationale**: Import creates catalog entries, not inventory records
**Expected**: Users manually update quantity when they acquire seeds

## CSV File Quirks

### Variety Name Variations
Files contain slight name variations:
- "Salad Bowl (green)" vs "Salad Bowl (Green)"
- These are treated as different varieties (case-sensitive)

### Type Variations Handled
- "Summer Crisp" / "Summer crisp" / "summer crisp"
- "Romaine" / "romaine"
- "Romaine Mini" / "Romaine mini" / "romaine mini"

### DTM Range Parsing
CSV supports both formats:
- Single number: "45" → stored as 45 days
- Range: "45-50" → stored as midpoint (47 days)
- Range preserved in notes: "DTM: 45-50 days"

## Database Schema

### SeedInventory Model
```python
class SeedInventory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    plant_id = db.Column(db.String(50), nullable=False)     # Maps to plant type
    variety = db.Column(db.String(100), nullable=False)      # Variety name from CSV
    brand = db.Column(db.String(100))                        # Empty on import
    quantity = db.Column(db.Integer)                         # 0 on import
    purchase_date = db.Column(db.DateTime)                   # NULL on import
    expiration_date = db.Column(db.DateTime)                 # NULL on import
    germination_rate = db.Column(db.Float)                   # NULL on import
    location = db.Column(db.String(100))                     # Empty on import
    price = db.Column(db.Float)                              # NULL on import
    notes = db.Column(db.Text)                               # Auto-generated from CSV
    is_global = db.Column(db.Boolean, default=False)         # From import form
```

**Auto-Generated Notes Format**:
```
Type: Looseleaf | DTM: 46-50 days | Soil Temp: 40-75°F | Early, frilly green leaves
```

## Error Handling

### CSV Validation Errors
- Missing required columns
- Empty file
- Invalid CSV format
- Malformed DTM values

All return HTTP 400 with error details.

### Import Warnings
- Unknown variety types (uses fallback)
- Duplicate varieties (skipped)
- Row parsing errors (logged, continues with other rows)

Warnings included in response but don't fail the import.

## Future Enhancements

### Potential Improvements
1. **Add more crops**: Extend CROP_TYPE_MAPPINGS with tomato, pepper, etc.
2. **Fuzzy matching**: Handle typos in variety types
3. **Bulk edit**: Allow updating imported varieties' quantities in batch
4. **CSV export**: Export seed inventory back to CSV
5. **Import history**: Track when/what was imported

### Known Issues
1. Playwright tests need update for tab-based navigation
2. No progress indicator for large CSV files
3. No preview before import (only after)

## Related Dev Docs

- Multi-user variety catalog feature: `dev/active/multi-user-variety-catalog/`
- Seed filtering feature: `dev/active/seed-filtering-feature/`

## Environment Notes

- Backend: Flask/Python, SQLite database
- Frontend: React/TypeScript, Tailwind CSS
- Import endpoint: POST /api/varieties/import
- Seeds endpoint: GET /api/seeds (returns all seeds)
