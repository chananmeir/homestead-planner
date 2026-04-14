# Indoor Seed Starts Reset Bug - Fix Plan

## Problem Statement
When users reset garden beds in the Garden Designer (clear all planted items), the related indoor seed starts are not being deleted. This leaves orphaned indoor starts showing warnings like "All [plant]-1 plantings removed from garden plan" but the indoor starts themselves persist.

## Root Cause Analysis

### Database Schema
IndoorSeedStart model (models.py lines 962-1091):
- Has `planting_event_id` field (line 1001) linking to PlantingEvent
- Links to PlantingEvent via foreign key but **NO CASCADE DELETE** configured
- PlantingEvent references IndoorSeedStart but not vice versa for cascade

PlantingEvent model (models.py lines 128-254):
- Gets deleted when garden beds are cleared
- No relationship defined that would cascade delete to IndoorSeedStart

### Backend Reset Flow
gardens_bp.py - `clear_bed()` function (lines 596-615):
```python
def clear_bed(bed_id):
    # Delete all PlantingEvents for this bed
    PlantingEvent.query.filter_by(garden_bed_id=str(bed_id), user_id=current_user.id).delete()

    # Delete all planted items for this bed
    PlantedItem.query.filter_by(garden_bed_id=bed_id, user_id=current_user.id).delete()
    db.session.commit()
```

**ISSUE**: Only deletes PlantingEvents and PlantedItems. Does NOT delete related IndoorSeedStarts.

### Frontend Reset Flow
GardenDesigner.tsx - `handleClearBed()` function (lines 915-948):
```typescript
const handleClearBed = async () => {
  const response = await apiDelete(`/api/garden-beds/${activeBed.id}/planted-items`);
  // Just calls backend, no additional cleanup
}
```

**ISSUE**: Relies entirely on backend to handle cleanup.

### Indoor Seed Starts Detection
IndoorSeedStart.to_dict() has `get_current_garden_plan_count()` method (lines 1008-1051):
- Queries PlantingEvents to find matching plants
- Shows warning when count is 0: "All [plant] plantings removed from garden plan"
- BUT does not auto-delete itself

## Solution Options

### Option 1: Database CASCADE DELETE (Recommended)
**Approach**: Add ON DELETE SET NULL to planting_event_id foreign key
- Pros: Database-level enforcement, automatic cleanup
- Cons: Requires migration, sets field to NULL instead of deleting record

### Option 2: Backend Cleanup in clear_bed()
**Approach**: Add explicit deletion of IndoorSeedStarts in clear_bed() endpoint
- Pros: Simple, explicit, no migration needed
- Cons: Must remember to update multiple places

### Option 3: Periodic Orphan Cleanup
**Approach**: Background job or manual cleanup to find orphaned indoor starts
- Pros: Non-destructive, can be run as needed
- Cons: Doesn't solve the immediate problem, reactive not proactive

## Recommended Solution: Hybrid Approach

Implement **Option 2** (immediate fix) + **Option 1** (long-term fix):

### Phase 1: Immediate Backend Fix
1. ✅ Update `clear_bed()` in gardens_bp.py to delete related IndoorSeedStarts
2. ✅ Update `clear_bed_by_date()` to do the same for date-filtered clears
3. ✅ Add similar cleanup to DELETE single PlantingEvent endpoint
4. ✅ Add similar cleanup to DELETE single PlantedItem endpoint (missed in original pass, fixed 2026-02-06)

### Phase 2: Database Migration
1. Create migration to add proper foreign key constraint
2. Consider ON DELETE CASCADE vs ON DELETE SET NULL
3. Update model definition in models.py

### Phase 3: Add Cleanup Endpoint
1. Create admin utility to find and clean orphaned indoor starts
2. Useful for existing users with orphaned data

## Implementation Details

### Backend Changes Needed

**File**: `backend/blueprints/gardens_bp.py`

**Change 1**: Update `clear_bed()` function (line 596)
```python
def clear_bed(bed_id):
    bed = GardenBed.query.get_or_404(bed_id)

    if bed.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    count = len(bed.planted_items)

    # NEW: Delete related indoor seed starts FIRST
    # Find PlantingEvents for this bed
    planting_events = PlantingEvent.query.filter_by(
        garden_bed_id=str(bed_id),
        user_id=current_user.id
    ).all()

    # Delete IndoorSeedStarts linked to these events
    event_ids = [e.id for e in planting_events]
    if event_ids:
        IndoorSeedStart.query.filter(
            IndoorSeedStart.planting_event_id.in_(event_ids),
            IndoorSeedStart.user_id == current_user.id
        ).delete(synchronize_session=False)

    # Delete all PlantingEvents for this bed
    PlantingEvent.query.filter_by(garden_bed_id=str(bed_id), user_id=current_user.id).delete()

    # Delete all planted items for this bed
    PlantedItem.query.filter_by(garden_bed_id=bed_id, user_id=current_user.id).delete()

    db.session.commit()

    return jsonify({'message': f'Cleared {count} plants from bed', 'count': count}), 200
```

**Change 2**: Update `clear_bed_by_date()` function (line 524)
```python
def clear_bed_by_date(bed_id, date_str):
    # ... existing date parsing logic ...

    # Get the events to delete
    events_to_delete = query.all()
    count = len(events_to_delete)

    # NEW: Delete related indoor seed starts FIRST
    event_ids = [e.id for e in events_to_delete]
    if event_ids:
        IndoorSeedStart.query.filter(
            IndoorSeedStart.planting_event_id.in_(event_ids),
            IndoorSeedStart.user_id == current_user.id
        ).delete(synchronize_session=False)

    # ... rest of existing logic ...
```

**Change 3**: Update `planting_event()` DELETE handler (line 1036)
```python
if request.method == 'DELETE':
    # NEW: Delete related indoor seed start FIRST
    IndoorSeedStart.query.filter_by(
        planting_event_id=event_id,
        user_id=current_user.id
    ).delete(synchronize_session=False)

    db.session.delete(event)
    db.session.commit()
    return '', 204
```

### Database Migration (Future)

**File**: `backend/migrations/versions/XXX_add_cascade_indoor_starts.py`

```python
"""Add cascade delete for indoor seed starts

Revision ID: XXX
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    # Add ON DELETE CASCADE to planting_event_id foreign key
    with op.batch_alter_table('indoor_seed_start') as batch_op:
        batch_op.drop_constraint('fk_indoor_seed_start_planting_event_id', type_='foreignkey')
        batch_op.create_foreign_key(
            'fk_indoor_seed_start_planting_event_id',
            'planting_event',
            ['planting_event_id'],
            ['id'],
            ondelete='CASCADE'
        )

def downgrade():
    with op.batch_alter_table('indoor_seed_start') as batch_op:
        batch_op.drop_constraint('fk_indoor_seed_start_planting_event_id', type_='foreignkey')
        batch_op.create_foreign_key(
            'fk_indoor_seed_start_planting_event_id',
            'planting_event',
            ['planting_event_id'],
            ['id']
        )
```

## Testing Plan

1. **Test Scenario 1: Clear Entire Bed**
   - Create garden bed with 3 planting events
   - Create indoor seed starts from those events
   - Clear bed
   - Verify: Indoor seed starts are deleted

2. **Test Scenario 2: Clear Bed by Date**
   - Create bed with events on different dates
   - Create indoor starts for events
   - Clear specific date
   - Verify: Only indoor starts for that date are deleted

3. **Test Scenario 3: Delete Single Planting Event**
   - Create single planting event
   - Create indoor start from it
   - Delete planting event
   - Verify: Indoor start is deleted

4. **Test Scenario 4: Orphaned Indoor Starts**
   - Manually delete planting events from database
   - Run cleanup utility
   - Verify: Orphaned indoor starts are found and cleaned

## Edge Cases

1. **Indoor starts without planting_event_id**: Should NOT be deleted (manual entries)
2. **Multiple indoor starts per event**: Should all be deleted
3. **Indoor starts already transplanted**: Consider keeping them? (status = 'transplanted')
   - Decision: Delete anyway since garden plan is gone
4. **Undo functionality**: Not implemented, user must recreate

## Rollout Plan

1. Deploy backend fix to clear_bed endpoints
2. Announce to users: "Clearing beds will now also remove related indoor seed starts"
3. Create cleanup utility for existing orphaned data
4. Schedule database migration for next maintenance window

## Success Criteria

- [x] Clearing bed deletes all related indoor seed starts
- [x] Clearing bed by date deletes indoor starts for that date only
- [x] Deleting single planting event deletes its indoor start
- [x] Deleting single planted item deletes its linked indoor starts
- [ ] No warnings about "plantings removed from garden plan"
- [ ] Indoor starts component shows correct count after reset
- [x] Manual indoor starts (no planting_event_id) are preserved

## Last Updated
2026-02-06
