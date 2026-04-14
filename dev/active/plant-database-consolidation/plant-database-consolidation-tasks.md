# Plant Database Consolidation - Tasks

**Last Updated**: 2026-01-01

## Phase 1: Preparation ✅

- [x] Create dev docs directory
- [x] Copy plan to dev docs
- [x] Create context.md
- [x] Create tasks.md
- [x] Create backup directory
- [ ] Export database tables to backup

## Phase 2: Backend Plant Database

- [ ] Read current plant_database.py
- [ ] Consolidate Lettuce entries (6 → 1)
- [ ] Consolidate Tomato entries (5 → 1)
- [ ] Consolidate Pepper entries (4 → 1)
- [ ] Consolidate Broccoli entries (5 → 1)
- [ ] Consolidate Watermelon entries (4 → 1)
- [ ] Consolidate Squash entries (3 → 1)
- [ ] Consolidate Bean entries (2 → 1)
- [ ] Consolidate Melon entries (2 → 1)
- [ ] Consolidate Kale entries (2 → 1)
- [ ] Consolidate Cherry entries (2 → 1)
- [ ] Update companion plant references
- [ ] Verify no duplicate IDs remain

## Phase 3: CSV Import Service

- [ ] Read csv_import_service.py
- [ ] Update LETTUCE_TYPE_MAPPING
- [ ] Update TOMATO_TYPE_MAPPING
- [ ] Update PEPPER_TYPE_MAPPING
- [ ] Update BEAN_TYPE_MAPPING
- [ ] Update SQUASH_TYPE_MAPPING
- [ ] Update BROCCOLI_TYPE_MAPPING
- [ ] Update WATERMELON_TYPE_MAPPING
- [ ] Update MELON_TYPE_MAPPING
- [ ] Update KALE_TYPE_MAPPING
- [ ] Update CHERRY_TYPE_MAPPING
- [ ] Verify all 38 TYPE_MAPPING dictionaries

## Phase 4: Database Migration

- [ ] Create migrate_consolidate_plant_ids.py
- [ ] Add full PLANT_ID_MAPPING table
- [ ] Implement migration logic for all 7 models
- [ ] Add migration statistics reporting
- [ ] Test migration on backup database
- [ ] Run migration on production database
- [ ] Verify migration results

## Phase 5: Frontend Plant Database

- [ ] Read frontend/src/data/plantDatabase.ts
- [ ] Remove variety-specific entries
- [ ] Keep only base plant types
- [ ] Update companion plant references
- [ ] Verify sync with backend

## Phase 6: Testing & Validation

- [ ] Backend: Test /api/plants endpoint
- [ ] Backend: Test /api/seed-catalog endpoint
- [ ] Backend: Test /api/my-seeds endpoint
- [ ] Frontend: Test Seed Catalog Crop/Plant filter
- [ ] Frontend: Test My Seed Inventory Crop/Plant filter
- [ ] Frontend: Verify no varieties in filter dropdown
- [ ] Integration: Test CSV import with new mappings
- [ ] Integration: Test Garden Planner plant selection
- [ ] Integration: Test Planting Calendar events
- [ ] Integration: Test Harvest Tracker data access
- [ ] Integration: Test Indoor Seed Starts lookups
- [ ] Integration: Test Photo Gallery plant tags

## Rollback Plan (if needed)

- [ ] Stop backend server
- [ ] Restore database from backup
- [ ] Revert plant_database.py changes
- [ ] Revert csv_import_service.py changes
- [ ] Restart backend server

## Completion Checklist

- [ ] All phases completed
- [ ] All tests passing
- [ ] Dev docs updated with completion status
- [ ] User testing confirms filter working correctly
- [ ] Plan file moved to dev/completed/
