# AUDIT-009 Retest Fix Report (2026-04-23)

Ships the fix for the P1 retest failure recorded in
`audit-009-retest-failure.md`. Investigation at
`audit-009-retest-investigation.md`. Distinct from the earlier
AUDIT-009 fix at commit `90c09a3` (which addressed a DIFFERENT
symptom — plants hidden from the grid by `getActivePlantedItems`).

---

## Commit

```
44cc572 fix: Refresh activeBed after seed-saving writes (AUDIT-009 retest)
```

Local only. Not pushed.

---

## Root cause (confirmed)

`handleToggleSeedSaving` at `frontend/src/components/GardenDesigner.tsx:1208-1228` wrote `PUT /api/planted-items/:id { saveForSeed: true }` correctly and optimistically updated `selectedPlantedCell`, but never refreshed `activeBed` or `visibleBeds` after the write. The grid `.map()` at `:2166` and `handlePlantedItemClick` (the reopen handler) both read from `activeBed.plantedItems[*]`, which still carried the stale pre-toggle `saveForSeed=false`. On reopen, a fresh `selectedPlantedCell` was seeded from that stale data — so the toggle rendered OFF.

Two sibling handlers had the same defect:
- `handleSeedDateSuccess` (`:1230-1232`) — Set Seed Date modal's success callback
- `handleCollectSeedsSuccess` (`:1234-1237`) — Collect Seeds modal's success callback

Backend round-trip was already provably correct (`test_save_for_seed_persistence.py`, 7 tests passing). Fix is frontend-only.

---

## Fix shape

Applied to all three handlers. Matches the pattern used by the 18 other `setActiveBed` call sites in the same file:

```tsx
const freshBeds = await loadData();
if (activeBed) {
  const updatedBed = freshBeds.find(b => b.id === activeBed.id);
  if (updatedBed) {
    setActiveBed(updatedBed);
    setVisibleBeds(prev => prev.map(b => b.id === updatedBed.id ? updatedBed : b));
  }
}
```

For `handleToggleSeedSaving` specifically, also re-derives `selectedPlantedCell.item` from the canonical `updatedBed.plantedItems` post-refresh, so the optimistic panel state is replaced by the fresh reference. Close-and-reopen now reads the same canonical array the grid reads.

Optimistic UX preserved: `setSelectedPlantedCell(prev => ...)` on line 1223 still fires before the async refresh, so the toggle flip feels instant. Canonical state overwrites it a tick later.

---

## Scope

- Single file: `frontend/src/components/GardenDesigner.tsx`
- +31 insertions / -5 deletions, net +26 LOC
- Frontend-only. No backend change, no new state, no new imports
- Error-handling branches and toast messages preserved verbatim in all three handlers

---

## Verification

- **Build**: `npm run build` compiled successfully (+54 B gzipped). No TypeScript errors.
- **Tests**: no `GardenDesigner.test.*` / `GardenDesigner.spec.*` files match; coverage gap re-confirmed (standing across prior audits). Backend `test_save_for_seed_persistence.py` still passes (not touched; referenced only to confirm the round-trip that made this a frontend-only problem in the first place).
- **Three scenarios reasoned**:
  - Toggle ON → close → reopen: reads fresh `saveForSeed=true` from refreshed `activeBed.plantedItems`. Toggle stays ON.
  - Set Seed Date via modal → close → reopen: reads fresh `seedMaturityDate` + status.
  - Collect Seeds → close → reopen: reads fresh `seedsCollected=true` / `seedsCollectedDate` / `status='harvested'`.

---

## Deferred (explicitly out of scope)

- Playwright E2E regression covering the close/reopen cycle — test IDs (`plant-detail-panel`, `seed-saving-toggle`, `planted-item-<id>`) already exist; a `test-engineer` pass could add a spec without component-test infrastructure.
- Broader refactor to centralize the "write then refresh activeBed" pattern — 18 call sites duplicate it; a custom hook or helper would reduce drift risk. Not this pass.

---

## Awaiting user

Push greenlight for the local commits:

```
44cc572 fix: Refresh activeBed after seed-saving writes (AUDIT-009 retest)
```

Plus the retest-finding doc + investigation docs already on disk from the user's drop + the investigation agent; I'll bundle those in the next commit.
