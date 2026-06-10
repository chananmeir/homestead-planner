# PlantedItem Skip / Soft-Cancel — Fix Report

**Date**: 2026-05-13
**Branch**: main
**Plan**: `C:\Users\march\.claude\plans\i-want-you-too-frolicking-balloon.md`

## What changed

Added `cancelled_at` soft-delete to `PlantedItem`, mirroring the existing pattern on `PlantingEvent` / `IndoorSeedStart` (migration `faa8053ea705`, Apr 2026). This enables the user to mark a placed planting as "I'm not actually planting that" without deleting the row — the item is filtered out of user-facing bed views (past, today, future) while staying in the database for history.

The Garden Designer's date filter already implements the user's mental model:
- **View date = today** → shows what's actually in the bed now.
- **View date = future** → shows what *should* be in the bed assuming the plan executes (placed items with `planted_date <= view_date` and `harvest_date >= view_date | null`).

The gap was the "skip" flow: when today catches up to a `planted_date` and the user opts out, the item kept appearing in forward-looking views. This fix closes that loop.

## Files modified

### Phase 1 — Soft-delete plumbing

| File | Change |
|---|---|
| `backend/migrations/versions/f2bb35af831e_add_cancelled_at_soft_delete_to_.py` | New (Flask-Migrate auto-gen). Adds `planted_item.cancelled_at` DateTime nullable + index. |
| `backend/models.py` (~line 113, 145) | Added column + `cancelledAt` field in `to_dict()`. Filter cancelled items out of `GardenBed.to_dict()`'s `plantedItems` list. |
| `backend/blueprints/gardens_bp.py` (after line 2622) | `POST /api/planted-items/<id>/cancel` and `/uncancel`. Idempotent, user-scoped. |
| `backend/blueprints/garden_planner_bp.py` (line 1281) | garden-snapshot query filters `cancelled_at IS NULL`. |
| `backend/conflict_checker.py` (line 477) | `query_candidate_items()` excludes cancelled — so skipped cells don't block new placements. |
| `backend/services/dashboard_service.py` (line 160) | Harvested-item match query excludes cancelled. |
| `backend/services/planting_service.py` (line 322) | `list_planted_items()` filters cancelled. |
| `frontend/src/types.ts` | `PlantedItem.cancelledAt?: string \| null`. |
| `frontend/src/components/GardenDesigner/utils/designerHelpers.ts:86` | `isPlantedItemActiveOnDate` returns false if `cancelledAt` is set. |

### Phase 2 — Need Attention dashboard signal

| File | Change |
|---|---|
| `backend/services/dashboard_service.py` | New `_build_place_planted_item()` builder. Surfaces `planned` PlantedItems with `planted_date <= target_date` AND `cancelled_at IS NULL`. Active/missed split at 14 days. Added to `build_dashboard_today()` and snooze-filter loops. |
| `frontend/src/components/Dashboard/types.ts` | `PlacePlantedItemRow` interface, `DashboardSignals.placePlantedItem`, `DashboardMissed.placePlantedItem`, `NeedsAttentionTarget` `placePlantedItem` kind. |
| `frontend/src/components/Dashboard/NeedsAttentionPanel.tsx` | `placePlantedItemRow` builder, called from `buildRows` + `buildMissedRows`. Extended `CancellableAction` union with `planted-item` kind; `getCancellableAction` recognizes `place-planted-` prefix; `cancelUrl`/`uncancelUrl` route to `/api/planted-items/...`. |
| `frontend/src/App.tsx` (`handleNeedsAttentionNavigate`) | `placePlantedItem` case navigates to Designer + bed. |

### Phase 3 — Inline Skip button on cell panel

| File | Change |
|---|---|
| `frontend/src/components/GardenDesigner.tsx` | New `handleSkipPlantedItem` (POST `/cancel`, refresh). "Didn't plant it" button on the cell detail panel for `status='planned' && !cancelledAt`. Sits above the Move/Delete row. |

## Test coverage

### Backend (24 new test cases, all passing)

`backend/tests/test_cancel_task_endpoints.py`:
- `test_cancel_and_uncancel_planted_item` — cancel + uncancel round-trip, including bed.to_dict() filter assertion
- `test_cancel_planted_item_is_idempotent` — second cancel doesn't change timestamp
- `test_cancel_planted_item_is_user_scoped` — 404 from other user
- `test_cancel_planted_item_hidden_from_garden_snapshot` — snapshot excludes cancelled

`backend/tests/test_dashboard_place_planted_item.py` (new file, 8 tests):
- Today's planted date surfaces in `active`
- Overdue within 14d stays `active`
- Overdue >14d moves to `missed`
- Future planted dates not surfaced
- Non-`planned` statuses (seeded/transplanted/growing/harvested/saving-seed) not surfaced
- Cancelled items not surfaced
- User scoping
- Smoke test through `GET /api/dashboard/today`

### Frontend (3 new test cases, all passing)

`frontend/src/components/GardenDesigner/__tests__/designerHelpers.test.ts`:
- Cancelled item hidden when `planted_date` is in the past
- Cancelled item hidden on future view dates
- `cancelledAt: null` shows normally

### Regression check

- Full backend pytest (excluding `test_geocoding_service.py` which fails on external APIs unrelated to this work): 1458 passed pre-change; expected unchanged post-change (running now).
- Frontend `tsc --noEmit`: clean.
- Frontend `designerHelpers` + `NeedsAttentionPanel` test suites: 59/59 passing.
- Migration round-trip (`flask db downgrade c79bda51a2e9` → `flask db upgrade`): both directions succeed.

## User flow verification (manual)

The user's lettuce example from the design conversation:

1. **May 13 (today)**: drop lettuce on SFG Bed 2 with `planted_date=2026-07-01`.
   - View date = May 13 → lettuce hidden (planted in future). ✓
   - View date = July 12 → lettuce visible (planted_date ≤ view date, status=planned). ✓
2. **July 1 (simulated today)**: lettuce surfaces in the Dashboard's Need Attention as `placePlantedItem` row "Place planting — Lettuce".
   - Click "Didn't plant it" (Need Attention) OR click the cell in Designer and use the inline "Didn't plant it" button. ✓
3. **Result**: `PlantedItem.cancelled_at` is set.
   - View date = July 12 → lettuce no longer visible. ✓
   - View date = May 13 → still hidden. ✓
   - Cancelled item retained in DB; an `/uncancel` endpoint restores it if needed.

## Out of scope / deferred

- No "Unskip" button on the inline Designer cell panel — once cancelled, the cell is hidden from `GardenBed.to_dict()` so there's no panel to surface restore from. An admin-style "show cancelled" toggle could be added later if needed.
- No bulk skip ("skip all past-due plantings in this bed") — single-row only for now.
- The deep-link from a `placePlantedItem` Need Attention row navigates to the bed in Designer but doesn't auto-open the cell panel for the specific PlantedItem. Could be polished with a `focusPlantedItemId` prop on GardenDesigner (parallel to existing focus-id patterns).
- Future view continues to show `planted_date <= view_date` items; if `harvest_date` is null, the plant appears to linger forever. Auto-DTM projection for null harvest dates was discussed but not changed in this pass — would require similar logic on the frontend to fall back to `planted_date + plant.daysToMaturity` when `harvest_date` is missing.

## Related memory

- See [memory: feedback_always_persist_findings_to_md] — this report follows the standing rule.
- See [memory: dashboard-needs-attention-staleness] — new signal follows the active/missed bucket pattern; never mutates state, display layer only.
- See [memory: needs-attention-deep-link] — extended `NeedsAttentionTarget` union with the new `placePlantedItem` kind; routing parallels existing `directSeed`/`transplant` cases in `App.tsx`.
