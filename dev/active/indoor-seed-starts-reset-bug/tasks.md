# Indoor Seed Starts Reset Bug - Tasks

## Status: 🟢 Complete

## Phase 1: Backend Fix (Critical)

### Task 1.1: Update clear_bed() Endpoint ✅ CRITICAL
**File**: `backend/blueprints/gardens_bp.py` (line 758)
**Status**: ✅ Done
**Priority**: P0

**Implementation**:
1. Add import for IndoorSeedStart model (if not already imported)
2. Before deleting PlantingEvents, query them to get IDs
3. Delete IndoorSeedStarts where planting_event_id IN (event_ids) AND user_id = current_user.id
4. Use synchronize_session=False for bulk delete performance
5. Then proceed with existing PlantingEvent and PlantedItem deletion
6. Update toast message to mention indoor starts: "Cleared {count} plants and related indoor starts from bed"

**Acceptance Criteria**:
- [ ] Function queries PlantingEvents before deleting
- [ ] IndoorSeedStarts are deleted BEFORE PlantingEvents
- [ ] Only indoor starts owned by current user are deleted
- [ ] Only indoor starts with planting_event_id (not manual) are deleted
- [ ] Transaction commits successfully
- [ ] Toast message updated

**Code Location**: Line 596-615

---

### Task 1.2: Update clear_bed_by_date() Endpoint ✅ IMPORTANT
**File**: `backend/blueprints/gardens_bp.py` (line 585)
**Status**: ✅ Done
**Priority**: P0

**Implementation**:
1. After getting events_to_delete list (line 566)
2. Extract event IDs: event_ids = [e.id for e in events_to_delete]
3. Delete IndoorSeedStarts before deleting events
4. Update toast message: "Cleared {count} planting(s) and related indoor starts from {date_str}"

**Acceptance Criteria**:
- [ ] Date-filtered clear deletes matching indoor starts
- [ ] Only indoor starts for that specific date are deleted
- [ ] Other indoor starts in bed are preserved
- [ ] Transaction commits successfully
- [ ] Toast message updated

**Code Location**: Line 524-593

---

### Task 1.3: Update planting_event() DELETE Handler ✅ IMPORTANT
**File**: `backend/blueprints/gardens_bp.py` (line 1237)
**Status**: ✅ Done
**Priority**: P1

**Implementation**:
1. In DELETE handler (line 1036)
2. Before deleting event, delete related IndoorSeedStart
3. Use filter_by(planting_event_id=event_id, user_id=current_user.id).delete()

**Acceptance Criteria**:
- [ ] Deleting single planting event deletes its indoor start
- [ ] Only indoor starts owned by current user are deleted
- [ ] Returns 204 No Content on success

**Code Location**: Line 1036-1039

---

### Task 1.4: Update planted_item() DELETE Handler ✅ CRITICAL
**File**: `backend/blueprints/gardens_bp.py` (line 800)
**Status**: ✅ Done (2026-02-06)
**Priority**: P0

**Background**: This endpoint was missed in the original fix pass. Tasks 1.1–1.3 added
BUGFIX cleanup to `clear_bed()`, `clear_bed_by_date()`, and `planting_event()` DELETE,
but the single `planted_item()` DELETE handler at line 800 still used a bare
`PlantingEvent.query.filter_by(...).delete()` without first removing linked IndoorSeedStarts.

**Implementation**:
1. Query matching PlantingEvents to get their IDs (same position filter)
2. Delete IndoorSeedStarts where `planting_event_id IN (event_ids)` and `user_id == current_user.id`
3. Delete events via `db.session.delete(e)` loop (replaces bare `.delete()`)

**Acceptance Criteria**:
- [x] IndoorSeedStarts deleted BEFORE PlantingEvents
- [x] Only indoor starts owned by current user are deleted
- [x] Manual indoor starts (null planting_event_id) unaffected
- [x] Follows same pattern as clear_bed() at line 758
- [x] Python syntax check passes
- [x] Frontend build passes (no frontend changes)

---

### Task 1.5: Add Unit Tests for Deletion Logic
**File**: `backend/tests/test_indoor_starts_cleanup.py` (new file)
**Status**: ⏳ To Do
**Priority**: P1

**Tests to Write**:
1. test_clear_bed_deletes_indoor_starts()
2. test_clear_bed_by_date_deletes_indoor_starts()
3. test_delete_planting_event_deletes_indoor_start()
4. test_manual_indoor_starts_preserved()
5. test_other_users_indoor_starts_preserved()

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] Test coverage > 90% for affected functions
- [ ] Tests use test database fixtures
- [ ] Tests cleanup after themselves

---

## Phase 2: Frontend Updates (Optional)

### Task 2.1: Update Toast Messages
**File**: `frontend/src/components/GardenDesigner.tsx` (line 925)
**Status**: ⏳ To Do
**Priority**: P2

**Implementation**:
1. Backend already sends updated message
2. Frontend just needs to display it
3. No code changes needed (verify current behavior)

**Acceptance Criteria**:
- [ ] Toast shows "Cleared X plants and related indoor starts"
- [ ] User understands what was deleted

---

### Task 2.2: Add Confirmation Warning
**File**: `frontend/src/components/GardenDesigner.tsx` (line 4849)
**Status**: ⏳ To Do
**Priority**: P3 (Nice to have)

**Implementation**:
1. Update ConfirmDialog message to mention indoor starts
2. Change from: "Clear all plants from {bed.name}?"
3. Change to: "Clear all plants and related indoor seed starts from {bed.name}? This cannot be undone."

**Acceptance Criteria**:
- [ ] Dialog clearly states indoor starts will be deleted
- [ ] User understands action is permanent

---

## Phase 3: Database Migration (Future)

### Task 3.1: Create Migration for CASCADE DELETE
**File**: `backend/migrations/versions/XXX_cascade_indoor_starts.py` (new file)
**Status**: ⏳ To Do
**Priority**: P3 (Post-MVP)

**Implementation**:
1. Drop existing foreign key constraint
2. Recreate with ON DELETE CASCADE
3. Test upgrade and downgrade
4. Document migration in MIGRATIONS.md

**Acceptance Criteria**:
- [ ] Migration applies cleanly
- [ ] Cascade delete works at database level
- [ ] Backend code can be simplified (remove explicit deletes)
- [ ] Rollback works correctly

---

## Phase 4: Cleanup Utilities (Maintenance)

### Task 4.1: Create Orphan Cleanup Endpoint
**File**: `backend/blueprints/admin_bp.py` (new or existing)
**Status**: ⏳ To Do
**Priority**: P3 (Post-MVP)

**Implementation**:
1. Create endpoint: GET /api/admin/indoor-starts/orphans
2. Query: IndoorSeedStarts where planting_event_id NOT NULL AND planting_event not found
3. Return list of orphaned records
4. Create endpoint: DELETE /api/admin/indoor-starts/orphans
5. Delete all orphaned records

**Acceptance Criteria**:
- [ ] Finds all orphaned indoor starts
- [ ] Returns JSON list with plant names and dates
- [ ] Delete endpoint requires admin permission
- [ ] Deletes only confirmed orphans

---

### Task 4.2: Add Cleanup to Admin Dashboard
**File**: `frontend/src/components/AdminUserManagement/` (if admin exists)
**Status**: ⏳ To Do
**Priority**: P4 (Nice to have)

**Implementation**:
1. Add "Cleanup Orphaned Data" section
2. Button to scan for orphans
3. Show count and list
4. Button to delete all orphans

**Acceptance Criteria**:
- [ ] Admin can see orphan count
- [ ] Admin can review orphan details
- [ ] Admin can delete orphans in batch
- [ ] Action is logged

---

## Phase 5: Testing & Validation

### Task 5.1: Manual Testing Checklist
**Status**: ⏳ To Do
**Priority**: P0

**Scenarios**:
- [ ] Create garden bed with 3 planting events
- [ ] Generate indoor seed starts from events
- [ ] Verify 3 indoor starts exist
- [ ] Clear entire bed
- [ ] Verify 0 indoor starts remain
- [ ] Verify no warnings about "plantings removed"

- [ ] Create bed with events on 3 different dates
- [ ] Generate indoor starts for all
- [ ] Clear only middle date
- [ ] Verify only that date's indoor starts deleted

- [ ] Create single planting event
- [ ] Generate indoor start from it
- [ ] Delete planting event
- [ ] Verify indoor start deleted

- [ ] Create manual indoor start (no planting_event_id)
- [ ] Clear bed (if has other events)
- [ ] Verify manual indoor start preserved

---

### Task 5.2: Integration Testing
**Status**: ⏳ To Do
**Priority**: P1

**Test Areas**:
- [ ] Garden Designer → Clear Bed → Indoor Starts page (refresh)
- [ ] Planting Calendar → Delete Event → Indoor Starts page (refresh)
- [ ] Indoor Starts → Import from Garden → Clear Bed → Verify gone
- [ ] Multi-user: User A clears bed, User B's indoor starts unaffected

---

### Task 5.3: Performance Testing
**Status**: ⏳ To Do
**Priority**: P2

**Metrics**:
- [ ] Clear bed with 100 planting events: < 1 second
- [ ] Database query count: < 5 queries total
- [ ] Memory usage: No leaks
- [ ] Concurrent users: No race conditions

---

## Phase 6: Documentation

### Task 6.1: Update User Documentation
**Status**: ⏳ To Do
**Priority**: P2

**Files to Update**:
- [ ] README.md: Note about indoor starts cleanup
- [ ] CHANGELOG.md: Add bug fix entry
- [ ] Backend API docs: Document deletion behavior

---

### Task 6.2: Update Dev Documentation
**Status**: ⏳ To Do
**Priority**: P2

**Files to Update**:
- [ ] CLAUDE.md: Add note about cascade delete pattern
- [ ] backend/MIGRATIONS.md: Document cleanup migration (if created)

---

## Task Dependencies

```
Phase 1 (Backend Fix):
  Task 1.1 (clear_bed) ────┐
  Task 1.2 (clear_by_date) ├──→ Task 5.1 (Manual Testing)
  Task 1.3 (delete event)  ┘
                           │
                           ├──→ Task 5.2 (Integration Testing)
                           │
                           └──→ Task 6.1 (Documentation)

Phase 2 (Frontend):
  Task 2.1 (Toast) ────────────→ Task 5.1 (Manual Testing)
  Task 2.2 (Warning) (optional)

Phase 3 (Migration):
  Task 3.1 (CASCADE) ──────────→ Task 1.* (can simplify code)

Phase 4 (Cleanup):
  Task 4.1 (Endpoint) ─────────→ Task 4.2 (Admin UI)

Phase 5 (Testing):
  All phases ──────────────────→ Task 5.3 (Performance)
```

## Timeline Estimate

- **Phase 1 (Backend Fix)**: 2-3 hours
  - Task 1.1: 30 min
  - Task 1.2: 20 min
  - Task 1.3: 15 min
  - Task 1.4: 60-90 min

- **Phase 2 (Frontend)**: 30 min
  - Task 2.1: 10 min (verify)
  - Task 2.2: 20 min

- **Phase 3 (Migration)**: 1-2 hours (future)
- **Phase 4 (Cleanup)**: 2-3 hours (future)
- **Phase 5 (Testing)**: 2-3 hours
- **Phase 6 (Docs)**: 30-60 min

**Total MVP**: ~5-7 hours (Phases 1, 2, 5, 6)

## Current Progress

**Phase 1 Backend Fix**: 4/5 complete (Tasks 1.1–1.4 done, 1.5 unit tests to do)

All four deletion endpoints now clean up IndoorSeedStarts before removing PlantingEvents:
- `clear_bed()` — line 758 (done prior)
- `clear_bed_by_date()` — line 585 (done prior)
- `planting_event()` DELETE — line 1237 (done prior)
- `planted_item()` DELETE — line 800 (done 2026-02-06, was missed in original pass)

**Phase 2 Optional Tasks**: 0/2 complete
**Phase 3–4 Future Tasks**: 0/3 complete
**Phase 5 Testing Tasks**: 0/3 complete
**Phase 6 Documentation**: 0/2 complete

## Next Steps

1. ✅ Task 1.1 (clear_bed) — done
2. ✅ Task 1.2 (clear_bed_by_date) — done
3. ✅ Task 1.3 (planting_event DELETE) — done
4. ✅ Task 1.4 (planted_item DELETE) — done 2026-02-06
5. ⏳ Task 1.5 (unit tests)
6. ⏳ Task 5.1 (manual testing)

## Last Updated
2026-02-06
