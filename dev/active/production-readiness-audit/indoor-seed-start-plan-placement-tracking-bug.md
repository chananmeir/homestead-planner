# Bug: Indoor Seed Start "Plan Placement" Does Not Track Completed Placement

**Reported**: 2026-05-26  
**Severity**: Medium-High (UX confusion + duplicate data risk)  
**Status**: Fixed pending verification

---

## Implementation Update

Implemented Option A with an extra derived API flag:

- `sourceIndoorSeedStartAction='plan'` now links `IndoorSeedStart.planting_event_id` to the newly positioned `PlantingEvent` without changing `status` or `actual_transplant_date`.
- `IndoorSeedStart.to_dict()` now returns `hasPlannedPlacement`, true only when the linked event has a real bed cell. This avoids treating plan-only calendar links as confirmed placements.
- Indoor Seed Starts now shows `has spot` / `Spot chosen in <bed>` for non-transplanted starts with a planned placement and changes the CTA to `View Planned Spot` instead of offering another `Plan Placement`.
- Backend rejects repeated explicit placement attempts for the same seed start once a linked positioned event already exists.

Verification run:

- `cd backend && python -m pytest tests/test_placement_explicit_seed_start_link.py -q`
- `cd backend && python -m pytest tests/test_placement_indoor_start_dedup.py -q`
- `cd backend && python -m pytest tests/test_indoor_seed_start_from_planting_event.py -q`
- `cd frontend && npm.cmd test -- --watchAll=false --runInBand --runTestsByPath src/components/__tests__/IndoorSeedStarts.placementPill.test.tsx src/components/__tests__/IndoorSeedStarts.placementConfirmation.test.tsx`
- `cd frontend && npm.cmd run build`

---

## What the User Experienced

1. User opened **Indoor Seed Starts** and clicked **"Plan Placement"** on a Pumpkin (Cinderella / Rouge Vif d'Etampes)
2. Was navigated to the **Garden Designer** and successfully placed the pumpkin on the grid in SFG Bed 1
3. On a subsequent visit to Indoor Seed Starts, the pumpkin **still shows the "Plan Placement" button** as if nothing happened
4. Clicking it again navigates back to the Designer with the same placement prompt (green banner: "Planning placement for Pumpkin (Cinderella (Rouge Vif d'Etampes)) → SFG Bed 1")
5. There is **no deduplication** — the user can create duplicate PlantedItems for the same seed start

---

## Root Cause

The issue is in `backend/blueprints/gardens_bp.py` around lines 1116–1122. There are **two action paths** when placing a plant from Indoor Seed Starts:

| Action | When Triggered | What It Does to IndoorSeedStart |
|--------|----------------|--------------------------------|
| `'transplant'` | Seed start status is `'hardening'` | Calls `_link_existing_indoor_seed_start()` — sets `status='transplanted'`, links `planting_event_id`, records `actual_transplant_date` |
| `'plan'` | Any other status (growing, ready, etc.) | Sets a **local flag only** (`indoor_seed_start_planned = True`) — does NOT update the IndoorSeedStart record at all |

The `'plan'` path creates a real PlantedItem on the grid, but the IndoorSeedStart record is **never modified**. The flag is only used to set a response JSON field (`indoorSeedStartPlacementPlanned: true`) which the frontend does not persist or check on subsequent visits.

### Relevant backend code (`gardens_bp.py` ~line 1116):

```python
if explicit_seed_start is not None:
    indoor_seed_start = explicit_seed_start
    if source_seed_start_action == 'transplant':
        _link_existing_indoor_seed_start(explicit_seed_start, planting_event)
        indoor_seed_start_linked = True
    else:
        # action == 'plan' — just record the placement, don't mark transplanted
        indoor_seed_start_planned = True  # <-- local flag only, nothing persisted
```

### Why the button reappears

The "Plan Placement" button renders when `start.status !== 'transplanted' && start.status !== 'failed'` (`IndoorSeedStarts.tsx` ~line 1254). Since the `'plan'` action never changes the status, the button always reappears.

The IndoorSeedStart GET endpoint (`utilities_bp.py` ~line 1020) **never queries PlantedItem records** to check if one already exists for this seed start. It only relies on the `status` field and `planting_event_id`.

---

## No Reverse Linkage Exists

- **PlantedItem** model has no `indoor_seed_start_id` field
- **IndoorSeedStart.planting_event_id** is only set by the `'transplant'` path
- There is **no database record** connecting the placed PlantedItem back to the seed start after a `'plan'` action

---

## Impact

1. **User confusion** — placement appears incomplete despite having been done
2. **Duplicate plants** — user can place the same seed start multiple times with no warning
3. **Incorrect counts** — Indoor Seed Starts page doesn't reflect actual garden state

---

## Fix Options

### Option A: Link `planting_event_id` on `'plan'` path too (minimal change)

- In the `'plan'` else-branch, set `seed_start.planting_event_id = planting_event.id` without changing status to `'transplanted'`
- Frontend button logic changes to: show button only when `status !== 'transplanted' && status !== 'failed' && planting_event_id == null`
- **Pro**: No migration needed (`planting_event_id` field already exists)
- **Con**: Overloads `planting_event_id` to mean both "planned placement" and "actually transplanted" — only distinguishable by status

### Option B: Add a `planned_planting_event_id` field (cleaner separation)

- New nullable FK field on IndoorSeedStart: `planned_planting_event_id`
- `'plan'` action sets this field; `'transplant'` action sets existing `planting_event_id`
- Frontend can distinguish "has a planned spot" vs "has been transplanted"
- Show "View Planned Spot" instead of "Plan Placement" when `planned_planting_event_id` is set
- **Pro**: Clean separation of planned vs completed states
- **Con**: Requires migration

### Option C: Add deduplication check only (defensive)

- Before creating a new PlantedItem, check if one already exists for this IndoorSeedStart
- Could query PlantedItems by matching plant_id + variety + bed_id + source context
- Block or warn the user if a placement already exists
- **Pro**: Prevents duplicate data without schema changes
- **Con**: Doesn't solve the UX issue of the button reappearing; heuristic matching is fragile

### Recommended: Option A (or A + C together)

Option A is the smallest change that solves the user-facing problem. Adding Option C as a safety net prevents duplicates regardless of path.

---

## Files Involved

| File | Lines | Role |
|------|-------|------|
| `backend/blueprints/gardens_bp.py` | ~1116–1122 | The `'plan'` vs `'transplant'` branch |
| `backend/blueprints/gardens_bp.py` | ~273–299 | `_link_existing_indoor_seed_start()` (only called for `'transplant'`) |
| `backend/blueprints/utilities_bp.py` | ~1020–1161 | IndoorSeedStart GET endpoint (no PlantedItem check) |
| `frontend/src/components/IndoorSeedStarts.tsx` | ~1254–1280 | Button gating logic (`status !== 'transplanted'`) |
| `backend/models.py` | ~1058–1335 | IndoorSeedStart model |
| `backend/models.py` | ~100–153 | PlantedItem model (no `indoor_seed_start_id` field) |

---

## Verification Steps (post-fix)

1. Create an IndoorSeedStart with status `'growing'` (not `'hardening'`)
2. Click "Plan Placement" → place on grid in Garden Designer
3. Navigate back to Indoor Seed Starts
4. Confirm the "Plan Placement" button is gone or changed to "View Planned Spot"
5. Confirm the seed start card shows some indication of the planned placement
6. Attempt to place the same seed start again — confirm it is blocked or warns
7. Advance the seed start to `'hardening'` → click "Transplant Now"
8. Confirm status updates to `'transplanted'` and green confirmation shows
