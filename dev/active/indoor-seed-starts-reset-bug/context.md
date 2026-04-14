# Indoor Seed Starts Reset Bug - Context

## Overview
This document captures key architectural decisions and context for fixing the indoor seed starts orphan issue.

## Architecture Understanding

### Data Flow: Garden Plan → Indoor Seed Starts

```
User Creates Garden Plan (Planting Events)
    ↓
User Clicks "From Garden Plan" Button (IndoorSeedStarts.tsx)
    ↓
ImportFromGardenModal queries /api/planting-events/needs-indoor-starts
    ↓
Backend groups events by (plant_id, variety, transplant_date)
    ↓
User selects events to create indoor starts from
    ↓
POST /api/indoor-seed-starts/from-planting-event
    ↓
IndoorSeedStart created with planting_event_id link
```

### Current Relationship

**IndoorSeedStart → PlantingEvent**:
- `planting_event_id` foreign key (nullable)
- No CASCADE DELETE configured
- Used for "live sync" - checking if garden plan still has these plants

**PlantingEvent → IndoorSeedStart**:
- No backref relationship defined in model
- One-way relationship only

### Reset Flow

```
User Clicks "Clear Bed" (GardenDesigner.tsx)
    ↓
Confirm dialog
    ↓
DELETE /api/garden-beds/{id}/planted-items
    ↓
Backend clear_bed() function:
  1. Delete PlantingEvents
  2. Delete PlantedItems
  3. Commit
    ↓
IndoorSeedStarts remain in database (ORPHANED)
    ↓
User sees warnings: "All [plant]-1 plantings removed from garden plan"
```

## Key Files

### Backend
- **models.py** (lines 962-1091): IndoorSeedStart model definition
- **models.py** (lines 128-254): PlantingEvent model definition
- **blueprints/gardens_bp.py** (lines 596-615): `clear_bed()` endpoint
- **blueprints/gardens_bp.py** (lines 524-593): `clear_bed_by_date()` endpoint
- **blueprints/gardens_bp.py** (lines 1026-1082): `planting_event()` DELETE handler
- **blueprints/utilities_bp.py** (lines 425-836): Indoor seed starts CRUD endpoints

### Frontend
- **components/GardenDesigner.tsx** (lines 915-948): `handleClearBed()` function
- **components/IndoorSeedStarts.tsx**: Main indoor starts UI
- **components/IndoorSeedStarts/ImportFromGardenModal.tsx**: "From Garden Plan" feature

## Design Decisions

### Why Not CASCADE DELETE in Database?

**Current State**: No CASCADE DELETE configured on foreign key

**Reasoning** (inferred):
1. Indoor starts can exist independently (manual creation without garden plan)
2. Allows users to keep indoor start records even if garden plan changes
3. Enables "live sync" warnings to show when plans diverge

**Problem**: This flexibility causes orphans when beds are cleared

### Why planting_event_id is Nullable?

Indoor seed starts can be created two ways:
1. **From Garden Plan**: Has `planting_event_id` (linked)
2. **Manual Entry**: No `planting_event_id` (standalone)

Manual entries should NOT be deleted when clearing beds.

### Live Sync Feature

IndoorSeedStart.to_dict() includes:
```python
garden_sync = self.get_current_garden_plan_count()
return {
    'gardenPlanCount': garden_sync['count'],
    'gardenPlanWarning': garden_sync['warning']
}
```

This queries PlantingEvents to show if garden plan has changed since indoor start was created.

**User Experience**:
- Green checkmark: In sync (expected plants match actual)
- Yellow warning: Plan changed (different quantities)
- Red warning: "All plantings removed from garden plan" (ORPHAN)

## Alternative Solutions Considered

### 1. Soft Delete
**Approach**: Mark PlantingEvents as deleted, keep in database
- Pros: Enables undo, preserves history
- Cons: Complicates queries, requires cleanup job

### 2. Archive Table
**Approach**: Move deleted events to archive table
- Pros: Preserves history, clean main tables
- Cons: Additional complexity, migration needed

### 3. Warning Before Delete
**Approach**: Show warning when clearing bed with indoor starts
- Pros: User choice, non-destructive
- Cons: Extra click, doesn't solve root cause

### 4. Auto-Update Indoor Starts
**Approach**: Update indoor starts quantities when plan changes
- Pros: Keeps data in sync
- Cons: Loss of original user intent

**Decision**: Use explicit deletion (Option 2 from plan.md) because:
- Simple to implement
- Clear user intent (clearing bed = removing everything)
- Matches existing pattern for PlantedItems

## Related Features

### Garden Season Planner
- Creates bulk PlantingEvents
- Can generate indoor seed starts in one click
- Clearing these events should also clear their indoor starts

### Succession Planting
- Multiple PlantingEvents with same plant/variety
- Indoor starts may be grouped by transplant date
- All related indoor starts should be deleted together

### Tracking Mode vs Planning Mode
- Planning mode: Uses expected_harvest_date
- Tracking mode: Uses actual_harvest_date
- Indoor starts deletion works same in both modes

## User Impact

### Current Behavior (Buggy)
```
User creates plan → generates indoor starts → clears bed
Result: Indoor starts show "All plantings removed" warnings
Action: User must manually delete each orphaned indoor start
```

### Expected Behavior (Fixed)
```
User creates plan → generates indoor starts → clears bed
Result: Indoor starts automatically deleted with plan
Action: User can recreate plan and indoor starts from scratch
```

### Breaking Changes
**None**. This fixes unexpected behavior, doesn't change intended functionality.

### Data Migration
Users with existing orphaned indoor starts:
- Will keep them until manually deleted OR
- Can use cleanup utility to batch delete orphans

## Testing Considerations

### Database States to Test
1. Fresh database (no orphans)
2. Database with orphaned indoor starts
3. Mixed: Some linked, some orphaned, some manual

### User Workflows to Test
1. Create plan → Clear bed → Verify indoor starts gone
2. Create plan → Generate indoor starts → Clear bed → Verify
3. Manual indoor starts → Clear bed → Verify NOT deleted
4. Clear specific date → Verify only that date's indoor starts deleted

### Edge Cases
1. Indoor start with null planting_event_id (manual) - should survive
2. Indoor start with deleted planting_event_id (orphan) - should be cleaned
3. Multiple indoor starts pointing to same event - all should be deleted
4. Indoor start with status='transplanted' - should still be deleted (plan is gone)

## Performance Considerations

**Query Impact**: Additional query to delete indoor starts
- Small overhead: O(n) where n = number of planting events in bed
- Typically n < 100, negligible impact

**Database Load**: Minimal
- DELETE operations are indexed on foreign keys
- Single transaction, no nested queries needed

## Security Considerations

**Authorization**: All deletions check `user_id`
- Only delete indoor starts owned by current user
- Prevents cross-user data deletion

**Validation**: No additional validation needed
- If user can delete PlantingEvent, they can delete its IndoorSeedStart
- Follows existing authorization pattern

## Future Enhancements

### 1. Undo Functionality
Track deletions for potential undo:
```python
class DeletedRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    record_type = db.Column(db.String(50))  # 'indoor_seed_start'
    record_json = db.Column(db.Text)  # JSON snapshot
    deleted_at = db.Column(db.DateTime, default=datetime.utcnow)
```

### 2. Batch Operations
Add endpoint to clear multiple beds at once:
```
POST /api/garden-beds/bulk-clear
Body: { bedIds: [1, 2, 3] }
```

### 3. Archive Mode
Instead of deleting, move to archive:
```python
indoor_start.status = 'archived'
indoor_start.archived_at = datetime.utcnow()
db.session.commit()
```

### 4. Export Before Clear
Offer CSV export of planting events + indoor starts before clearing.

## Lessons Learned

1. **Foreign Key Constraints Matter**: Always configure CASCADE DELETE for parent-child relationships
2. **Test Deletion Paths**: Test not just creation but also cleanup
3. **Nullable Foreign Keys**: When FK is nullable, decide cleanup policy upfront
4. **User Warnings**: Live sync warnings helped identify the bug quickly

## Questions for Product Owner

1. Should we allow undo for cleared beds? (Nice to have, not MVP)
2. Should transplanted indoor starts be kept? (Current plan: delete them too)
3. Export functionality before clearing? (User request?)
4. Should we notify users when their indoor starts are auto-deleted? (Toast message)

**Answers** (Assumed for MVP):
1. No undo (simplicity)
2. Delete all (consistency)
3. No export (future enhancement)
4. Yes, update toast message (done in implementation)

## Fix History

### 2026-01-28: Initial fix (Tasks 1.1–1.3)
Added BUGFIX cleanup to three endpoints:
- `clear_bed()` at line 758
- `clear_bed_by_date()` at line 585
- `planting_event()` DELETE at line 1237

### 2026-02-06: Missed endpoint fix (Task 1.4)
The `planted_item()` DELETE handler at line 800 was missed in the original pass.
It used a bare `PlantingEvent.query.filter_by(...).delete()` without first cleaning
up linked IndoorSeedStarts, creating orphans when a single PlantedItem was deleted
from the Garden Designer. Fixed by adding the same pattern: query events → delete
linked IndoorSeedStarts → delete events via `db.session.delete()`.

### 2026-04-01: IndoorSeedStart status not synced on PlantingEvent completion

**Symptom**: Indoor seed starts (e.g., Red Ursa kale) showed as "overdue" on the
indoor-starts page even though their linked PlantingEvent was already marked completed.
The only code path that properly updated IndoorSeedStart to `'transplanted'` was the
explicit transplant route in `utilities_bp.py` (line 1029-1030). All other PlantingEvent
completion paths — batch placement, PUT update, PlantedItem harvest cross-model sync,
harvest endpoint, bulk update — silently left the IndoorSeedStart in its old status.

**Root cause**: PlantingEvent completion was set in 6 different code paths across
`gardens_bp.py` and `harvests_bp.py`, but none of them checked for or updated the
linked IndoorSeedStart record. The IndoorSeedStart-to-PlantingEvent link exists via
`IndoorSeedStart.planting_event_id` foreign key, but there was no reverse sync from
PlantingEvent completion back to IndoorSeedStart status.

**Fix**: Added helper function `_sync_indoor_start_on_completion(event)` in
`gardens_bp.py` (line 23) and called it at all 5 completion sites in that file.
Added inline equivalent in `harvests_bp.py` (line 56).

**Files affected**:
- `backend/blueprints/gardens_bp.py` — new helper function (line 23-41), called at
  lines 573, 1015, 1661, 1815, 1934
- `backend/blueprints/harvests_bp.py` — inline sync at lines 56-63

**Helper logic**:
1. If `event.completed` is False, return immediately (no-op)
2. Query `IndoorSeedStart` by `planting_event_id=event.id` AND `user_id=event.user_id`
3. If found and status is not already `'transplanted'`:
   - Set `status = 'transplanted'`
   - Set `actual_transplant_date` from `event.transplant_date` or `event.direct_seed_date`
     or `datetime.utcnow()` as fallback

**Call sites (6 total)**:
| # | File | Line | Code Path | Description |
|---|------|------|-----------|-------------|
| 1 | gardens_bp.py | ~573 | Batch plant placement | Marks exported events complete when plants placed on grid |
| 2 | gardens_bp.py | ~1015 | PlantedItem harvest cross-model sync | PlantedItem status -> 'harvested' propagates to PlantingEvent |
| 3 | gardens_bp.py | ~1661 | PUT /planting-events/:id | Generic event update (any field, including completed flag) |
| 4 | gardens_bp.py | ~1815 | POST /planting-events/:id/harvest | Explicit harvest endpoint |
| 5 | gardens_bp.py | ~1934 | PATCH /planting-events/bulk-update | Bulk update with completed/quantityCompleted |
| 6 | harvests_bp.py | ~56 | POST /harvests (harvest log) | Creating harvest record completes linked PlantingEvent |

**Key insight**: The `_sync_indoor_start_on_completion()` helper is idempotent — calling
it on an already-transplanted IndoorSeedStart is a no-op due to the `status != 'transplanted'`
guard. This makes it safe to call at every completion site without worrying about double-sync.

**Note on harvests_bp.py**: Uses inline code instead of the shared helper because importing
from `gardens_bp` would create a circular import risk. The inline version also uses
`datetime.now()` instead of `datetime.utcnow()` (minor inconsistency to be aware of).

**Tests**: All 216 backend tests pass. All 55 succession export + planting event status
tests pass. No new tests were added for this specific fix.

**Lesson learned**: When a model has multiple completion paths scattered across blueprints,
extract a shared helper and call it at every site. Audit completion paths by grepping for
`event.completed = True` across all blueprint files. The IndoorSeedStart ↔ PlantingEvent
relationship is one-way (FK on IndoorSeedStart pointing to PlantingEvent) with no
backref, so the reverse lookup must always be explicit.

## Last Updated
2026-04-01
