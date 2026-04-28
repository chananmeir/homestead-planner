# Proposed CLAUDE.md Updates

## Status

- **Item 1 (IndoorSeedStart completion sync)**: APPLIED to `CLAUDE.md` on 2026-04-24. Cleaned-up version merged per `dev/active/claude-md-updates-response.md` (function-name references, no line numbers, no mojibake, no proposal date).
- **Item 2 (Dashboard staleness §12 entry)**: HELD per response — the staleness implementation lives in the working tree but is not yet committed/shipped. Promote to `CLAUDE.md` once the feature is merged.

---

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

---

## Date: 2026-04-24
## Reason: Dashboard stale-needs-attention staleness rules introduced a subtle integrity invariant

### Proposed Addition: New entry in §12 Uncertainty Notices

**Where to add**: Append as item 8 after the existing Completion State entry (item 7) in `## Uncertainty Notices`.

**Proposed text**:

```markdown
8. **Dashboard Needs-Attention Staleness (Apr 2026)**: Display-layer only — staleness filters in `backend/services/dashboard_service.py` do NOT mutate `PlantingEvent.completed`, `PlantingEvent.quantity_completed`, `PlantedItem.status`, or `IndoorSeedStart.status`. Response shape is `{signals, missed, meta}` where `missed` contains aged-out `indoorStartsDue` / `transplantsDue` / `directSeedDue` rows (active and missed are disjoint, never double-counted). **Harvest integrity rule: `harvestReady` rows NEVER drop regardless of age — after `HARVEST_DEMOTION_DAYS` (14) they gain `isStale: true` and render gray but stay visible and clickable. Silent removal would block later back-dated harvest logging and rewrite user history.** Germination checks drop silently (no Missed bucket). Thresholds live as five module-level constants in `dashboard_service.py`. Snooze/dismiss filter runs across both `signals.*` and `missed.*`; `signalKey` prefixes preserved so `getCancellableAction()` and `NeedsAttentionTarget` deep-link invariants hold. 29 backend tests in `test_dashboard_staleness.py` + 12 frontend tests pin these contracts. **Do not "consistency-fix" harvests to also bucket into Missed — that would silently lose inventory data.** If adding a new integrity-sensitive signal (carrying real-world truth), follow the harvest pattern (`isStale` flag, never drop), not the Missed bucket pattern.
```

**Rationale**: The harvest-demotion rule (demote via `isStale` but never hide) is a subtle invariant a future agent could violate while refactoring for apparent consistency. The distinction between "safe to age out" (reminders only) and "integrity-sensitive" (records carrying real-world truth) is exactly the kind of design axis §12 is for. Also documents the display-layer-only rule so nobody tries to "clean up stale indoor starts" by flipping statuses.
