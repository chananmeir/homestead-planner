# Plant Database Consolidation - Context

**Created**: 2026-01-01
**Status**: In Progress
**Last Updated**: 2026-01-01

## Overview

Consolidating variety-based plant database entries into base plant types to fix the Crop/Plant filter showing varieties instead of plant names.

## Key Decisions

### Architecture Decision
- **Chosen**: Base plants in plant_database.py → Varieties in seed_inventory.variety field
- **Rationale**: Cleaner separation of concerns, varieties are seed-specific not plant-specific
- **Impact**: All 48+ variety entries consolidate to ~14 base plant entries

### Scope Decision
- **Chosen**: Consolidate ALL varieties (vegetables, herbs, fruit trees)
- **Rationale**: Complete architectural solution prevents future filter issues
- **Alternative Rejected**: Partial fix (vegetables only) - would leave technical debt

### Data Migration Strategy
- **Chosen**: Update plant_id references in 7 models, preserve all variety data
- **Rationale**: Zero data loss, maintains all historical records
- **Risk Mitigation**: Full database backup before migration

## Critical Files

### Backend
- `backend/plant_database.py` - Plant entries consolidation
- `backend/services/csv_import_service.py` - TYPE_MAPPING updates (38 dictionaries)
- `backend/migrate_consolidate_plant_ids.py` - Migration script (NEW)

### Frontend
- `frontend/src/data/plantDatabase.ts` - Manual sync with backend

### Database Tables
1. seed_inventory - Primary table with plant_id references
2. planted_item - Garden bed placements
3. planting_event - Timeline/scheduling
4. harvest_record - Historical harvest data
5. indoor_seed_start - Seed starting tracking
6. photo - Image tagging
7. winter_plan - JSON plant_list field

## Plant ID Consolidation Mapping

### Lettuce (6 → 1)
- lettuce-looseleaf-1 → lettuce-1
- lettuce-romaine-1 → lettuce-1
- lettuce-butterhead-1 → lettuce-1
- lettuce-crisphead-1 → lettuce-1
- lettuce-summercrisp-1 → lettuce-1
- lettuce-1 (Mixed) → lettuce-1 (rename to "Lettuce")

### Tomato (5 → 1)
- tomato-cherry-1 → tomato-1
- tomato-wisconsin-55 → tomato-1
- tomato-peron-sprayless → tomato-1
- tomato-orange-roussollin → tomato-1
- tomato-1 (Beefsteak) → tomato-1 (rename to "Tomato")

### Pepper (4 → 1)
- pepper-bell-1 → pepper-1
- pepper-hot-1 → pepper-1
- pepper-yellow-corno-di-toro → pepper-1
- pepper-miniature-yellow-bell → pepper-1

### Broccoli (5 → 1)
- broccoli-calabrese → broccoli-1
- broccoli-de-cicco → broccoli-1
- broccoli-waltham-29 → broccoli-1
- broccoli-belstar → broccoli-1
- broccoli-1 → broccoli-1 (base)

### Watermelon (4 → 1)
- watermelon-sugar-baby → watermelon-1
- watermelon-charleston-grey → watermelon-1
- watermelon-congo → watermelon-1
- watermelon-1 → watermelon-1 (base)

### Squash (3 → 1)
- squash-summer-1 → squash-1
- squash-winter-1 → squash-1
- squash-green-stripe-cushaw → squash-1

### Bean (2 → 1)
- bean-bush-1 → bean-1
- bean-pole-1 → bean-1

### Melon (2 → 1)
- melon-1 → melon-1 (Cantaloupe → base)
- melon-orange-flesh-honeydew → melon-1

### Kale (2 → 1)
- kale-1 → kale-1 (Lacinato → base)
- kale-bare-necessities → kale-1

### Cherry (2 → 1)
- cherry-sweet-1 → cherry-1
- cherry-sour-1 → cherry-1

## Technical Notes

- Frontend/backend plant databases are manually synced (technical debt)
- No database schema changes needed (models already support this)
- plant_id is not a true FK - it's an application-level reference
- Migration preserves all data in variety and override fields

## Progress Tracking

- ✅ Phase 1: Dev docs created, backup prepared
- ⏳ Phase 2: Backend plant database consolidation
- ⏳ Phase 3: CSV import service updates
- ⏳ Phase 4: Database migration
- ⏳ Phase 5: Frontend sync
- ⏳ Phase 6: Testing & validation
