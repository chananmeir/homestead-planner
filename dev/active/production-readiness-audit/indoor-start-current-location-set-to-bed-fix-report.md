# Indoor Start Current Location Set To Garden Bed — Fix Report (2026-04-27)

Resolves the finding at `indoor-start-current-location-set-to-bed-finding.md`. Auto-created `IndoorSeedStart` records now default to `'windowsill'` for `location` instead of inheriting the destination garden bed's name.

---

## Root cause

`backend/blueprints/gardens_bp.py::_auto_create_indoor_seed_start` (line 145) is the helper invoked when placing a transplant-method plant — it auto-creates a linked `IndoorSeedStart` so the seedling phase shows up on the Indoor Starts page.

At line 210 it set `location` from the **destination garden bed's name**:

```python
location=(GardenBed.query.get(planting_event.garden_bed_id).name if planting_event.garden_bed_id else 'windowsill'),
```

Since placement always sets `planting_event.garden_bed_id`, the `else 'windowsill'` branch never fired in practice. Every auto-created indoor start ended up labeled `Current location: <bed name>` (e.g., `Current location: replica`) — semantically wrong because the seedlings are still indoors.

The two other creation sites (`utilities_bp.py:765` and `utilities_bp.py:1551`, both user-driven endpoints) already used `data.get('location', 'windowsill')` correctly. Only this auto-create path was buggy.

---

## Fix

| File:line | Before | After |
|---|---|---|
| `backend/blueprints/gardens_bp.py:210` | `location=(GardenBed.query.get(planting_event.garden_bed_id).name if planting_event.garden_bed_id else 'windowsill'),` | `location='windowsill',` |

`IndoorSeedStart.location` is documented in `models.py:1083` as `"windowsill, grow-lights, heated-mat, greenhouse"`. `'windowsill'` is the correct default for an unsupplied indoor location, and the destination bed information is not lost — it is still accessible via the linked `PlantingEvent.garden_bed_id` and surfaced in the UI as **Planned bed:** (the recent label-clarity change from `indoor-start-location-vs-destination-clarity-fix-report.md`).

---

## Test audit

Searched `backend/tests/` for assertions that depended on the buggy behavior — `IndoorSeedStart.location` checks against bed names (`'replica'`, `'bed'`, etc.), or any explicit comparison after an auto-create flow. **Zero matches.** No tests had to change.

Notably checked:
- `backend/tests/test_placement_explicit_seed_start_link.py`
- `backend/tests/test_placement_indoor_start_dedup.py`
- All `test_dashboard_*.py` (which exercise IndoorSeedStart staleness/grouping/germination)

---

## Test results

- **Targeted**: `pytest tests/test_placement_explicit_seed_start_link.py tests/test_placement_indoor_start_dedup.py -v` → **20 / 20 pass**
- **Full backend**: `pytest` → **1364 pass, 2 fail, 1 xfail** in 107s
  - The 2 failures are pre-existing in `test_geocoding_service.py` (Washington DC / Chicago lookups — network-dependent), tracked as known pre-existing failures unrelated to this change.

---

## Migration recommendation (NOT applied)

Existing rows where `location` is set to a bed name will continue showing the wrong value on the Indoor Starts card until the user manually edits or transplants out of them. Since `location` is a free-text string with no enum constraint and the user can edit it inline, the impact on legacy rows is purely cosmetic.

**Suggested one-shot fixup if requested later**:

```sql
UPDATE indoor_seed_start
   SET location = 'windowsill'
 WHERE location NOT IN ('windowsill', 'grow-lights', 'heated-mat', 'greenhouse');
```

Holding off until the user requests it is acceptable. New auto-creates from this point forward use `'windowsill'`.

---

## Files changed

- `backend/blueprints/gardens_bp.py` (1 line, single character change)

---

## Out of scope

- The `Started:` label on future planned starts mentioned in the original finding's Notes section — left as a separate follow-up.
- Frontend changes — not needed; the card already renders `location` as-is. With the backend now returning the correct value, the card displays correctly automatically.
