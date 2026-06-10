# Bed-View Harvest Workflow — Fix Report

**Date**: 2026-05-04
**Related finding**: [bed-view-harvest-workflow-finding.md](bed-view-harvest-workflow-finding.md)
**Plan**: `C:\Users\march\.claude\plans\okay-so-we-need-serialized-nebula.md`

## Summary

Closed the gap identified in the finding: the Garden Designer's bed view now has a green **Log Harvest** button on the placed-plant detail panel that opens a small modal, posts to `POST /api/harvests` with `plantedItemId`, and triggers the backend's existing auto-sync. The result: the plant flips to `status='harvested'`, its linked `PlantingEvent.completed` becomes `True`, the linked `IndoorSeedStart` (if any) flips to `transplanted`, the detail panel closes, and the bed grid refreshes — all from one click in the bed view.

Zero backend production-code changes; the harvest endpoint already supported everything we needed. The gap was entirely in the frontend.

## What shipped

### New files
- `frontend/src/components/GardenDesigner/HarvestPlantModal.tsx` — bed-view harvest modal mirroring `CollectSeedsModal`. Header banner shows plant name + variety + grid position; form has date / quantity (defaults to `plantedItem.quantity`) / unit / quality / notes. Submit posts to `/api/harvests` with `plantedItemId`. ~165 lines.
- `backend/tests/test_harvest_planted_item_sync.py` — 7 tests covering the previously uncovered auto-sync block at `harvests_bp.py:38-65`: PlantedItem status flip, PlantingEvent completion, IndoorSeedStart transplant flip, idempotency on already-transplanted starts, no-sync when `plantedItemId` is omitted, cross-user isolation, and HarvestRecord field correctness.
- `frontend/src/components/GardenDesigner/__tests__/HarvestPlantModal.test.tsx` — 10 unit tests covering header rendering, defaults, validation, payload shape (mocking `apiPost`), and error paths.

### Modified files
- `frontend/src/components/GardenDesigner.tsx` — 5 small touchpoints:
  1. Import `HarvestPlantModal`
  2. `harvestPlantItem` state
  3. `handleHarvestPlantSuccess` — closes panel, refetches beds + planting events + future plantings, bumps plan refresh (mirrors `handleDeletePlant`)
  4. `canLogHarvest` gate (`status !== 'harvested' && !seedsCollected && !saveForSeed`) + green Log Harvest button rendered above the existing Move/Delete row inside the detail panel's actions section
  5. Conditional `<HarvestPlantModal>` render, parallel to `<CollectSeedsModal>`
- `frontend/tests/harvest-tracker.spec.ts` — added `Harvest from Bed View — E2E Tests` describe block with two tests:
  - **BV-01**: place tomato → click cell → click Log Harvest → submit → assert panel closes + `PlantedItem.status='harvested'` via API + `HarvestRecord` exists with matching `plantedItemId`
  - **BV-02**: post-harvest plant — Log Harvest button is hidden (or the plant is filtered out)

## Test results

| Suite | Result |
|---|---|
| `backend/tests/test_harvest_planted_item_sync.py` | 7/7 passed |
| Full backend pytest | 1420 passed, 5 pre-existing failures in `test_geocoding_service.py` (network-dependent, unchanged) |
| `HarvestPlantModal.test.tsx` | 10/10 passed |
| Full frontend `react-scripts test` | 217/217 passed |
| `tsc --noEmit` | Clean |

Pre-existing-failure verification: `git stash && pytest tests/test_geocoding_service.py` → same 5 failures on unmodified main, confirming they predate this work.

E2E (`harvest-tracker.spec.ts`) requires both servers running and was not executed in this session — should be run as part of the next CI/manual smoke pass.

## Design decisions (from approved plan)

1. **New in-bed modal vs. extending `LogHarvestModal`** — chose new modal. `LogHarvestModal` stays untouched on the Harvests tab; in-bed modal mirrors the `CollectSeedsModal` precedent (header banner with plant identity, no plant dropdown, `apiPost` instead of raw `fetch`).
2. **Hide-vs-disable for ineligible plants** — chose hide. The button only renders when `status !== 'harvested' && !seedsCollected && !saveForSeed`. Save-for-seed plants get `Collect Seeds` in the same panel slot, so the two affordances never compete.
3. **Partial-quantity harvest** — out of scope (backend doesn't support it). Documented as a future enhancement.

## Accessibility note

The new modal uses proper `htmlFor`/`id` label associations on every input/select/textarea. This was a small additive change (no logic, just attributes) that makes screen readers and `getByLabelText` queries work correctly. `CollectSeedsModal` uses unassociated labels — that's a separate accessibility debt not addressed here.

## Out of scope (per plan; backlog)

- Partial-quantity harvest (e.g., harvest 2 of 4 lettuces from a single cell) — would require a `PlantedItem.quantity` decrement path and a conditional status update in `harvests_bp.py`.
- Bulk harvest of all "growing" items in a bed.
- Harvest action on the future-plantings overlay (those aren't real placements).
- Polish: when `plantedItem.quantity > 1`, defaulting `unit='lbs'` with `quantity=N` may mislead the user (implies "N lbs"). User can edit; consider `unit='count'` default when quantity > 1 in a follow-up.

## Files for review

| Path | Purpose |
|---|---|
| `frontend/src/components/GardenDesigner/HarvestPlantModal.tsx` | New modal |
| `frontend/src/components/GardenDesigner.tsx` | 5 wiring touchpoints (search for `harvestPlantItem` and `canLogHarvest`) |
| `frontend/src/components/GardenDesigner/__tests__/HarvestPlantModal.test.tsx` | Unit tests |
| `frontend/tests/harvest-tracker.spec.ts` | E2E tests in `Harvest from Bed View` describe block |
| `backend/tests/test_harvest_planted_item_sync.py` | Backend coverage of the auto-sync block |
| `backend/blueprints/harvests_bp.py:23-67` | Unchanged — already supported `plantedItemId` |
