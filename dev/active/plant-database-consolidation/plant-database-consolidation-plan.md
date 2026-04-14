# Plant Database Consolidation Plan
## Fix: Varieties Appearing in Crop/Plant Filter

**Created**: 2026-01-01
**Status**: Planning

---

## Problem Statement

The Crop/Plant filter is showing variety types (e.g., "Lettuce (Butterhead)", "Tomato (Cherry)") instead of only base plant names (e.g., "Lettuce", "Tomato") because the plant database stores varieties as separate plant entries with variety information embedded in the `name` field.

**Root Cause**: Plant database has 48+ variety-specific entries with names like:
- `lettuce-romaine-1`: "Lettuce (Romaine)"
- `tomato-cherry-1`: "Tomato (Cherry)"
- `pepper-hot-1`: "Pepper (Hot/Jalapeño)"

## Solution Approach

Consolidate variety-based plant entries into base plant types. Move variety-specific information to the seed inventory's `variety` field and agronomic override fields.

**Architecture**: Base plants in plant database → Varieties in seed_inventory table

---

## Scope Summary

### Plant Types to Consolidate (14 types, 48+ entries)
**High Priority (visible in filter)**:
- **Lettuce**: 6 entries → 1 base (`lettuce-1`)
- **Tomato**: 5 entries → 1 base (`tomato-1`)
- **Pepper**: 4 entries → 1 base (`pepper-1`)
- **Broccoli**: 5 entries → 1 base (`broccoli-1`)
- **Watermelon**: 4 entries → 1 base (`watermelon-1`)
- **Squash**: 3 entries → 1 base (`squash-1`)

**Medium Priority**:
- Bean, Melon, Kale (2-3 entries each)

**Total**: 40+ deprecated plant IDs

### Files to Modify
**Backend**:
- `backend/plant_database.py` - Consolidate plant entries
- `backend/services/csv_import_service.py` - Update 38 TYPE_MAPPING dictionaries
- `backend/models.py` - No schema changes (already supports this)
- New migration script - Update existing data

**Frontend**:
- `frontend/src/data/plantDatabase.ts` - Sync with backend consolidation

### Database Tables Affected (7 models)
1. **SeedInventory** (primary) - Update plant_id references
2. **PlantedItem** - Update plant_id in garden beds
3. **PlantingEvent** - Update plant_id in timeline
4. **HarvestRecord** - Update plant_id in harvest history
5. **IndoorSeedStart** - Update plant_id in seed starts
6. **Photo** - Update plant_id in photo tags
7. **WinterPlan** - Update plant_id in JSON plant_list

---

## Implementation Plan

### Phase 1: Preparation (5-10 min)

**1.1 Create Dev Docs**
- Create `dev/active/plant-database-consolidation/`
- Copy this plan as `plant-database-consolidation-plan.md`
- Create `context.md` and `tasks.md`

**1.2 Create Plant ID Mapping Table**
- Document all old plant IDs → new consolidated plant IDs
- Example mapping:
  ```
  lettuce-looseleaf-1 → lettuce-1
  lettuce-romaine-1 → lettuce-1
  lettuce-butterhead-1 → lettuce-1
  lettuce-crisphead-1 → lettuce-1
  lettuce-summercrisp-1 → lettuce-1
  tomato-cherry-1 → tomato-1
  pepper-hot-1 → pepper-1
  pepper-bell-1 → pepper-1
  ...
  ```

**1.3 Backup Current Database**
- Export all 7 affected tables to CSV/JSON
- Store in `backend/data/backup-pre-consolidation/`

### Phase 2: Backend Plant Database (10-15 min)

**2.1 Consolidate Plant Entries** (`backend/plant_database.py`)

For each plant type with varieties:
- Keep ONE base plant entry with comprehensive agronomic data
- Use most common/versatile values for base entry
- Remove variety suffix from name (e.g., "Lettuce (Romaine)" → "Lettuce")
- Delete all variety-specific duplicate entries

**Example - Lettuce Consolidation**:
```python
# BEFORE: 6 entries
{ 'id': 'lettuce-1', 'name': 'Lettuce (Mixed)', 'daysToMaturity': 45, ... }
{ 'id': 'lettuce-looseleaf-1', 'name': 'Lettuce (Looseleaf)', 'daysToMaturity': 48, ... }
{ 'id': 'lettuce-romaine-1', 'name': 'Lettuce (Romaine)', 'daysToMaturity': 68, ... }
# ... 3 more

# AFTER: 1 entry
{ 'id': 'lettuce-1', 'name': 'Lettuce', 'daysToMaturity': 55, ... }
# Other lettuce varieties removed
```

**2.2 Update Companion Plant References**
- Search for deprecated plant IDs in `companionPlants` and `incompatiblePlants` arrays
- Update to use new consolidated IDs

**Critical Files**:
- `backend/plant_database.py:1-1200+` (main database)

### Phase 3: CSV Import Service (5-10 min)

**3.1 Update TYPE_MAPPING Dictionaries** (`backend/services/csv_import_service.py`)

Update all 38 mappings to point varieties to base plant IDs:

```python
# BEFORE
LETTUCE_TYPE_MAPPING = {
    'looseleaf': 'lettuce-looseleaf-1',
    'romaine': 'lettuce-romaine-1',
    'butterhead': 'lettuce-butterhead-1',
    # ...
}

# AFTER
LETTUCE_TYPE_MAPPING = {
    'looseleaf': 'lettuce-1',
    'romaine': 'lettuce-1',
    'butterhead': 'lettuce-1',
    # All map to base plant ID
}
```

**Mappings to Update**:
- LETTUCE_TYPE_MAPPING (6 varieties → `lettuce-1`)
- TOMATO_TYPE_MAPPING (5 varieties → `tomato-1`)
- PEPPER_TYPE_MAPPING (4 varieties → `pepper-1`)
- BEAN_TYPE_MAPPING (2 varieties → `bean-1`)
- SQUASH_TYPE_MAPPING (3 varieties → `squash-1`)
- BROCCOLI_TYPE_MAPPING (5 varieties → `broccoli-1`)
- WATERMELON_TYPE_MAPPING (4 varieties → `watermelon-1`)
- MELON_TYPE_MAPPING (2 varieties → `melon-1`)
- KALE_TYPE_MAPPING (2 varieties → `kale-1`)
- Plus 29 other single-mapping types (verify base IDs match)

**Critical Files**:
- `backend/services/csv_import_service.py:19-350` (all TYPE_MAPPING dicts)

### Phase 4: Database Migration Script (15-20 min)

**4.1 Create Migration Script** (`backend/migrate_consolidate_plant_ids.py`)

Migration logic:
```python
import sqlite3
import json
from datetime import datetime

# Mapping table: old_plant_id → new_plant_id
PLANT_ID_MAPPING = {
    'lettuce-looseleaf-1': 'lettuce-1',
    'lettuce-romaine-1': 'lettuce-1',
    # ... full mapping
}

def migrate_database():
    conn = sqlite3.connect('instance/homestead.db')
    cursor = conn.cursor()

    # 1. Update SeedInventory
    for old_id, new_id in PLANT_ID_MAPPING.items():
        cursor.execute('''
            UPDATE seed_inventory
            SET plant_id = ?, last_synced_at = ?
            WHERE plant_id = ?
        ''', (new_id, datetime.utcnow(), old_id))

    # 2. Update PlantedItem
    for old_id, new_id in PLANT_ID_MAPPING.items():
        cursor.execute('''
            UPDATE planted_item
            SET plant_id = ?
            WHERE plant_id = ?
        ''', (new_id, old_id))

    # 3. Update PlantingEvent
    for old_id, new_id in PLANT_ID_MAPPING.items():
        cursor.execute('''
            UPDATE planting_event
            SET plant_id = ?
            WHERE plant_id = ?
        ''', (new_id, old_id))

    # 4. Update HarvestRecord
    for old_id, new_id in PLANT_ID_MAPPING.items():
        cursor.execute('''
            UPDATE harvest_record
            SET plant_id = ?
            WHERE plant_id = ?
        ''', (new_id, old_id))

    # 5. Update Photo (nullable field)
    for old_id, new_id in PLANT_ID_MAPPING.items():
        cursor.execute('''
            UPDATE photo
            SET plant_id = ?
            WHERE plant_id = ?
        ''', (new_id, old_id))

    # 6. Update IndoorSeedStart
    for old_id, new_id in PLANT_ID_MAPPING.items():
        cursor.execute('''
            UPDATE indoor_seed_start
            SET plant_id = ?
            WHERE plant_id = ?
        ''', (new_id, old_id))

    # 7. Update WinterPlan (JSON field - complex)
    cursor.execute('SELECT id, plant_list FROM winter_plan')
    for row in cursor.fetchall():
        plan_id, plant_list_json = row
        if plant_list_json:
            plant_list = json.loads(plant_list_json)
            updated_list = [PLANT_ID_MAPPING.get(pid, pid) for pid in plant_list]
            cursor.execute('''
                UPDATE winter_plan
                SET plant_list = ?
                WHERE id = ?
            ''', (json.dumps(updated_list), plan_id))

    conn.commit()
    print("Migration complete!")
    print_migration_stats(cursor)
    conn.close()
```

**4.2 Run Migration**
- Test on backup database first
- Run migration script
- Verify all plant_id references updated
- Check for any orphaned references

**Critical Files**:
- `backend/migrate_consolidate_plant_ids.py` (new file)

### Phase 5: Frontend Plant Database (5 min)

**5.1 Update Frontend Plant Database** (`frontend/src/data/plantDatabase.ts`)

- Manually sync with backend changes
- Remove variety-specific plant entries
- Keep only base plant types
- Update companion plant references

**Note**: Frontend and backend plant databases are manually synced (technical debt).

**Critical Files**:
- `frontend/src/data/plantDatabase.ts:1-1500+`

### Phase 6: Testing & Validation (10-15 min)

**6.1 Backend Testing**
```bash
cd backend
python migrate_consolidate_plant_ids.py  # Run migration
python query_db_direct.py  # Verify data
```

**6.2 API Testing**
- Test `/api/plants` - should return consolidated plant list
- Test `/api/seed-catalog` - seeds should have correct plant_id
- Test `/api/my-seeds` - personal seeds updated correctly

**6.3 Frontend Filter Testing**
- Navigate to Seed Catalog page
- Check Crop/Plant filter dropdown
- Verify only base plant names appear (no varieties)
- Test filtering functionality

**6.4 CSV Import Testing**
- Import sample lettuce CSV
- Verify varieties map to `lettuce-1`
- Check that `variety` field stores specific variety name
- Confirm filter shows only "Lettuce", not variety types

**6.5 Full Integration Testing**
- Garden Planner: Plant selection and placement
- Planting Calendar: Timeline events with consolidated plant IDs
- Harvest Tracker: Historical data still accessible
- Indoor Seed Starts: Lookups work correctly
- Photo Gallery: Photo tags display correctly

---

## Data Preservation Guarantees

✅ **All variety information preserved** in `seed_inventory.variety` field
✅ **All agronomic overrides preserved** in override fields (DTM, spacing, etc.)
✅ **All user ownership preserved** via `user_id` field
✅ **All catalog linkage preserved** via `catalog_seed_id` field
✅ **All historical data preserved** in all 7 models
✅ **No data loss** - only plant_id references updated

---

## Rollback Plan

If issues arise:
1. Stop backend server
2. Restore database from `backend/data/backup-pre-consolidation/`
3. Revert code changes to plant_database.py and csv_import_service.py
4. Restart backend server

---

## Post-Implementation

### Immediate Follow-up
- Update dev docs with completion status
- Document any issues encountered
- Add note about frontend/backend manual sync issue

### Future Enhancements
- Consider automating frontend/backend plant database sync
- Add unit tests for CSV import type mapping
- Add integration tests for filter functionality
- Consider migrating plant database to actual database table (vs in-memory)

---

## Critical Files Reference

**Backend**:
- `backend/plant_database.py` - Plant database consolidation
- `backend/services/csv_import_service.py` - TYPE_MAPPING updates
- `backend/migrate_consolidate_plant_ids.py` - Migration script (NEW)
- `backend/models.py` - No changes (review only)

**Frontend**:
- `frontend/src/data/plantDatabase.ts` - Sync with backend
- `frontend/src/components/SeedCatalog.tsx:205-210` - Filter logic (no changes)
- `frontend/src/components/MySeedInventory.tsx:301-306` - Filter logic (no changes)

**Database**:
- All 7 models: SeedInventory, PlantedItem, PlantingEvent, HarvestRecord, Photo, IndoorSeedStart, WinterPlan

---

## Estimated Time: 50-70 minutes

- Phase 1 (Prep): 5-10 min
- Phase 2 (Backend Plants): 10-15 min
- Phase 3 (CSV Import): 5-10 min
- Phase 4 (Migration): 15-20 min
- Phase 5 (Frontend): 5 min
- Phase 6 (Testing): 10-15 min

**Total**: ~1 hour of focused work
