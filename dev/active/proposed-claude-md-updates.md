# Proposed CLAUDE.md Updates

## Date: 2026-04-01
## Reason: IndoorSeedStart completion sync bug discovered and fixed

---

### Proposed Addition: New High-Risk Area

**Where to add**: After the existing "Completion State Consistency" section in High-Risk Areas.

**Proposed text**:

```markdown
### HIGH RISK: IndoorSeedStart ↔ PlantingEvent Completion Sync

**Files Involved**:
- `backend/blueprints/gardens_bp.py` (`_sync_indoor_start_on_completion()` helper, line 23)
- `backend/blueprints/harvests_bp.py` (inline sync, line ~56)
- `backend/blueprints/utilities_bp.py` (explicit transplant route, line ~1029)

**Why Risky**: PlantingEvent completion is set in 6+ code paths across multiple blueprints.
Each path must sync the linked IndoorSeedStart to `'transplanted'` status, or indoor starts
show as "overdue" on the indoor-starts page even though the actual planting is done.

**Link**: `IndoorSeedStart.planting_event_id` FK (nullable, no CASCADE, no backref).

**Rules**:
1. Any code that sets `event.completed = True` MUST call `_sync_indoor_start_on_completion(event)` afterward
2. Always filter IndoorSeedStart queries by BOTH `planting_event_id` AND `user_id`
3. The helper is idempotent — safe to call at every completion site
4. If adding a NEW PlantingEvent completion path, grep for existing calls to ensure you don't miss the sync
```

---

### Proposed Addition: New Common AI Mistake

**Where to add**: After Mistake 10 in "Common AI Mistakes to Avoid" section.

**Proposed text**:

```markdown
### Mistake 11: Adding PlantingEvent Completion Without IndoorSeedStart Sync

**Example**:
```python
# WRONG: Marks event complete but forgets indoor start sync
event.completed = True
event.quantity_completed = event.quantity
db.session.commit()
```

**Why Wrong**: The linked IndoorSeedStart stays in its old status (e.g., 'growing'),
causing it to appear "overdue" on the indoor-starts page.

**Fix**:
```python
# CORRECT: Always sync indoor start after completion
event.completed = True
event.quantity_completed = event.quantity
_sync_indoor_start_on_completion(event)
db.session.commit()
```

**Audit**: Grep for `event.completed = True` or `.completed = True` across all
blueprint files when adding new completion paths.
```

---

### Proposed Addition: Synchronized File Note

**Where to add**: In the "Frontend-Backend Synchronization" section or the IndoorSeedStart
context above.

**Note**: This is a backend-only sync concern (no frontend counterpart needed), but the
pattern of "multiple code paths must all do X" is the same principle as the space calculator
sync — just within the backend across blueprints rather than between backend and frontend.
