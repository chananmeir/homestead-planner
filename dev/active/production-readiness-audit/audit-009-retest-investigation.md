# AUDIT-009 Retest Investigation (2026-04-23)

Read-only. No code modified.

## Summary

**Root cause**: `handleToggleSeedSaving` refreshes `beds` via `loadData()` but never refreshes `activeBed` / `visibleBeds`. The grid render and the reopen-click both read from `activeBed.plantedItems`, which keeps the pre-toggle snapshot. The optimistic `setSelectedPlantedCell` update on line 1223 makes the toggle appear correct until the panel is closed — on reopen, `handlePlantedItemClick` pulls the stale item out of `activeBed` and the toggle reverts to OFF.

**Scope**: Frontend-only.

The backend PUT is correct (proven by `backend/tests/test_save_for_seed_persistence.py` — 7 tests passing), the `to_dict()` serializer is correct (`models.py:147`), and the GET `/api/garden-beds` response does include `saveForSeed` on every planted item (`models.py:97` → `PlantedItem.to_dict` at `models.py:134`). Data is persisted; the frontend just never re-hydrates the bed reference from which the reopen reads.

Hypotheses #1 and #6 are ruled out (backend test proves roundtrip works). Hypothesis #2 is confirmed as the exact mechanism (fresh data is fetched into `beds` state but the UI reads from `activeBed`, which was never updated with the fresh bed object). Hypotheses #3 (wrong prop) and #5 (status-derived state) are ruled out below.

## 1. UI surface

### Where the Save for Seed toggle lives

`frontend/src/components/GardenDesigner.tsx:3315-3337` — inline inside the "Planted Item Details Panel" (line 3209). Specifically the toggle `<button data-testid="seed-saving-toggle">` at lines 3326-3336:

- Visual state: `item.saveForSeed ? 'bg-amber-500' : 'bg-gray-300'` (line 3330) and transform `translateX(18px)`/`translateX(2px)` (line 3335).
- `onClick={() => handleToggleSeedSaving(item, !item.saveForSeed)}` (line 3328).

**Important**: the toggle reads `item.saveForSeed` directly (line 3330, 3334, 3335). It does NOT read from `status === 'saving-seed'`. This rules out hypothesis #5 (status-based derivation).

`item` on these lines is destructured from `selectedPlantedCell` at `GardenDesigner.tsx:3215`:
```tsx
const { item, plant, futureEvents } = selectedPlantedCell;
```

### Which modal / detail box opens for a planted item

There is **no separate modal component** for the Save for Seed toggle. The detail box is rendered inline inside `GardenDesigner.tsx`:

- Wrapping div: `GardenDesigner.tsx:3225-3227` — `data-testid="plant-detail-panel"`, a fixed-positioned panel.
- `SetSeedDateModal` (`frontend/src/components/GardenDesigner/SetSeedDateModal.tsx`) only opens when the user explicitly clicks "Set seed maturity date" after the toggle is ON and `seedMaturityDate` is null (`GardenDesigner.tsx:3350-3355`). It is NOT the primary save-for-seed control.
- `CollectSeedsModal` is for the terminal "collect seeds" action, not the toggle itself.

## 2. Write path — what happens on toggle ON

`GardenDesigner.tsx:1208-1228` (`handleToggleSeedSaving`):

```tsx
const handleToggleSeedSaving = async (item: PlantedItem, saveForSeed: boolean) => {
  try {
    const response = await apiPut(`/api/planted-items/${item.id}`, { saveForSeed });
    if (!response.ok) { ... return; }
    const updated = await response.json();
    if (saveForSeed && !updated.seedMaturityDate) {
      setSeedDateItem(updated);
    }
    showSuccess(saveForSeed ? 'Marked for seed saving' : 'Seed saving removed');
    // Update the selected cell snapshot so the panel reflects the change immediately
    setSelectedPlantedCell(prev => prev ? { ...prev, item: { ...prev.item, ...updated } } : null);
    loadData();                                   //  <-- no await, no activeBed refresh
  } catch { ... }
};
```

- Endpoint: `PUT /api/planted-items/:id`
- Payload: `{ saveForSeed: boolean }` — correct camelCase; backend `gardens_bp.py:1359` matches.
- Response body: `item.to_dict()` — includes fresh `saveForSeed`, `status='saving-seed'`, `seedMaturityDate`.
- Optimistic merge: `setSelectedPlantedCell(prev => { ...prev, item: { ...prev.item, ...updated } })` — this DOES correctly update the panel while open (so the toggle "works" on first click without closing).
- Global state refresh: `loadData()` is invoked but **not awaited**, and `loadData` (`GardenDesigner.tsx:371-424`) only calls `setBeds(bedData)` (line 382). Crucially, it does NOT update `activeBed` or `visibleBeds` — those are only set on *initial* load (`line 393: if (bedData.length > 0 && !activeBed)`).

Backend PUT handler (`backend/blueprints/gardens_bp.py:1358-1393`):

```python
if 'saveForSeed' in data:
    save_for_seed = data['saveForSeed']
    item.save_for_seed = save_for_seed
    if save_for_seed:
        item.status = 'saving-seed'
        # ... auto-calculate seed_maturity_date if days_to_seed is present
```

Backend response is correct and `PlantedItem.to_dict()` (`models.py:134-151`) emits the camelCase `saveForSeed` key.

## 3. Read path — what happens on reopen

After the user closes the panel via the close button at `GardenDesigner.tsx:3253` or via the overflow area click at `GardenDesigner.tsx:2996`, `setSelectedPlantedCell(null)` fires. `selectedPlantedCell` is gone.

When the user clicks the plant again:

1. The click fires on an SVG `<g>` rendered by `getActivePlantedItems(bed).map((item) => { ... })` at `GardenDesigner.tsx:2166`. The `bed` argument is the `activeBed` (passed by `renderGrid(activeBed)` at `GardenDesigner.tsx:3026`).
2. The click handler at `GardenDesigner.tsx:2215-2219` (or the nested `<g>` at `GardenDesigner.tsx:2298-2302`) calls `handlePlantedItemClick(item, bed, e)`.
3. `handlePlantedItemClick` (`GardenDesigner.tsx:1417-1431`) does `setSelectedPlantedCell({ item, bed, plant, futureEvents, clickX, clickY })`. **The `item` here is the same object from the `.map()` iteration** — i.e., a reference taken from `activeBed.plantedItems`.

`activeBed` is never re-derived from `beds` after `loadData()` (verified via `Grep setActiveBed` — only 18 call sites, all in explicit handlers; no useEffect syncs `activeBed` when `beds` changes). So when `handleToggleSeedSaving` only calls `loadData()`, `activeBed` keeps the pre-toggle planted-item objects.

Reopening reads the stale `saveForSeed=false` (and stale `status`), and the toggle renders OFF.

### Contrast — handlers that do work correctly

All other mutation handlers follow a consistent pattern of awaiting `loadData()` AND explicitly refreshing `activeBed` / `visibleBeds`. Examples:

- Clear bed (`GardenDesigner.tsx:920-930`): `const freshBeds = await loadData(); ... const updatedBed = freshBeds.find(b => b.id === activeBed.id); if (updatedBed) { setActiveBed(updatedBed); setVisibleBeds(prev => ...); }`
- Move plant (`GardenDesigner.tsx:1280-1293`): same pattern.
- Duplicate via shift-drag (`GardenDesigner.tsx:311-327`): same pattern.
- Harvest (`GardenDesigner.tsx:1355-1363`), delete (`GardenDesigner.tsx:1141-1149`), etc. — all `setActiveBed(updatedBed)` from `freshBeds`.

`Grep "setActiveBed"` returns 18 call sites. `handleToggleSeedSaving` is the only mutation handler that touches `loadData()` without calling `setActiveBed`.

### Ruling out hypothesis #3 (wrong prop read)

The toggle button reads `item.saveForSeed` via the same `item` reference that the backend returns — just snapshotted early into `activeBed.plantedItems`. It is not reading from a defaults object, a `useState(false)` initializer, or `snake_case` vs `camelCase` mismatch. The `types.ts:172` declaration uses `saveForSeed?: boolean`, matching the backend response. The read is correct; the data source is stale.

### Ruling out hypothesis #5 (status-based derivation)

The toggle's visual state reads `item.saveForSeed` directly on `GardenDesigner.tsx:3330, 3334, 3335`. The only place `status === 'saving-seed'` is consulted is in `getActivePlantedItems` (line 655) for grid visibility — which is the symptom commit `90c09a3` fixed. That fix also depends on fresh `activeBed` to surface the new status, so it has the same underlying data-staleness problem — but it happens to work because the status update is propagated via the same PUT response and the plant remains visible if `activeBed` is stale (status stays as its prior value, falling through to DTM-based visibility which keeps the plant visible as long as DTM hasn't elapsed). The retest exposes that the data-staleness bug is still present for the `saveForSeed` field specifically.

## 4. Root cause (confirmed)

`handleToggleSeedSaving` at `GardenDesigner.tsx:1208-1228` fires `loadData()` (unawaited) after the PUT succeeds. `loadData` at `GardenDesigner.tsx:371-424` only updates the `beds` state and intentionally skips `activeBed` / `visibleBeds` if they are already populated (line 393 guard: `if (bedData.length > 0 && !activeBed)`). The Garden Designer's render path (`renderGrid(activeBed)` at line 3026, then `getActivePlantedItems(bed).map(...)` at line 2166) reads from `activeBed.plantedItems`, which remains a reference to the pre-toggle bed snapshot. When the user reopens the panel, `handlePlantedItemClick` at `GardenDesigner.tsx:1417-1431` takes the item from this stale array and sets `selectedPlantedCell` with `saveForSeed=false`.

The optimistic update at `GardenDesigner.tsx:1223` masks the bug while the panel is open, which is why early smoke tests did not surface it — the toggle "sticks" until the panel is dismissed, at which point the next open reads the stale snapshot.

The backend tests pass because they compare PUT response → GET response and correctly see `saveForSeed=true` on both sides — they don't exercise the frontend's `activeBed` state.

## 5. Fix shape

Apply the same `setActiveBed` / `setVisibleBeds` refresh pattern already used by every other mutation handler in this file.

**Target**: `frontend/src/components/GardenDesigner.tsx:1208-1228` (`handleToggleSeedSaving`).

**Diff shape** (illustrative — **not applied**):

```tsx
const handleToggleSeedSaving = async (item: PlantedItem, saveForSeed: boolean) => {
  try {
    const response = await apiPut(`/api/planted-items/${item.id}`, { saveForSeed });
    if (!response.ok) {
      const errData = await response.json();
      showError(errData.error || 'Failed to update seed saving');
      return;
    }
    const updated = await response.json();
    if (saveForSeed && !updated.seedMaturityDate) {
      setSeedDateItem(updated);
    }
    showSuccess(saveForSeed ? 'Marked for seed saving' : 'Seed saving removed');
    setSelectedPlantedCell(prev => prev ? { ...prev, item: { ...prev.item, ...updated } } : null);

    // NEW: refresh activeBed & visibleBeds from fresh backend data
    const freshBeds = await loadData();
    if (activeBed) {
      const updatedBed = freshBeds.find(b => b.id === activeBed.id);
      if (updatedBed) {
        setActiveBed(updatedBed);
        setVisibleBeds(prev => prev.map(b => b.id === updatedBed.id ? updatedBed : b));
      }
    }
  } catch {
    showError('Failed to update seed saving');
  }
};
```

**Estimated LOC**: +7 / -1 (await `loadData`, find the updated bed, set `activeBed`, update `visibleBeds`).

### Apply the same fix to two sibling handlers

The same pattern defect is present and should be fixed at the same time:

- `handleSeedDateSuccess` at `GardenDesigner.tsx:1230-1232` — fires `loadData()` (unawaited) with no `activeBed` refresh. This is called by `SetSeedDateModal` `onSuccess` (line 3933-3936). After setting the seed maturity date, `selectedPlantedCell` is already null (modal closed), so the grid relies on `activeBed` being fresh.
- `handleCollectSeedsSuccess` at `GardenDesigner.tsx:1234-1237` — same defect. Called by `CollectSeedsModal` `onSuccess` (line 3924-3930). After collecting seeds, the plant should transition to `seedsCollected=true` and disappear from the grid's seed-saving ring (`GardenDesigner.tsx:2246`) — but `activeBed` stays stale until another handler refreshes it.

Each fix is the same ~7-line pattern.

### Scope / cross-stack split

**Frontend-only**. Backend PUT, serializer, and GET endpoints are all correct. Backend persistence is already verified end-to-end by `backend/tests/test_save_for_seed_persistence.py` (7 tests, all passing).

### Alternative fix (deeper, broader)

An alternative cleaner-but-riskier fix is to add a `useEffect(() => { ... }, [beds])` inside `GardenDesigner.tsx` that auto-syncs `activeBed` and `visibleBeds` whenever `beds` changes. That would eliminate the manual refresh pattern in all 10+ mutation handlers and prevent future recurrences of this bug class. However, it risks breaking handlers that depend on `beds` changing without `activeBed` changing (e.g., creating a new bed and keeping focus on the current active bed). Given the pattern is already established and only three handlers are broken, the narrow fix is safer for the audit timeline.

## 6. Regression test recommendation

### Frontend (preferred)

A Playwright E2E test in `frontend/tests/` (which per `CLAUDE.md` "Quick Start Commands" is where E2E tests live — `npx playwright test`):

```
test('AUDIT-009: Save for Seed persists across panel close/reopen', async ({ page }) => {
  // 1. Sign in, navigate to Garden Designer with a planted item
  // 2. Click the planted item → detail panel opens → toggle is OFF
  // 3. Click seed-saving-toggle → expect bg-amber-500 class / translateX(18px)
  // 4. Dismiss the SetSeedDateModal if it appears (or set a date)
  // 5. Close the detail panel (click outside or close button)
  // 6. Click the planted item again → detail panel reopens
  // 7. Assert toggle is still ON (bg-amber-500, not bg-gray-300)
});
```

Hook points already in place: `data-testid="plant-detail-panel"` (line 3226), `data-testid="seed-saving-toggle"` (line 3327), `data-testid={`planted-item-${item.id}`}` (line 2198). No new test IDs needed.

### Unit test (React Testing Library)

If a frontend unit harness exists for `GardenDesigner`, test `handleToggleSeedSaving` in isolation: mock `apiPut` + `apiGet` so `loadData()` returns a bed with `saveForSeed=true` on the target item; assert after the handler resolves that `activeBed.plantedItems[0].saveForSeed === true`. **Caveat**: `GardenDesigner.tsx` is ~3500 lines and unit-level testing of it is unprecedented in this repo — Grep finds no `GardenDesigner.test.tsx`. Playwright E2E is the realistic path.

### Backend (not needed)

Backend tests (`test_save_for_seed_persistence.py`) already cover the PUT→GET roundtrip and should remain untouched.

## Appendix: code references

- Toggle JSX: `frontend/src/components/GardenDesigner.tsx:3315-3337`
- Toggle read of `item.saveForSeed`: `frontend/src/components/GardenDesigner.tsx:3330, 3334, 3335`
- `item` destructured from `selectedPlantedCell`: `frontend/src/components/GardenDesigner.tsx:3215`
- `handleToggleSeedSaving` (THE BUG): `frontend/src/components/GardenDesigner.tsx:1208-1228`
- Missing activeBed refresh: `frontend/src/components/GardenDesigner.tsx:1224` (`loadData();` — no await, no setActiveBed)
- `loadData` early-returns on initialized state: `frontend/src/components/GardenDesigner.tsx:393` (`if (bedData.length > 0 && !activeBed)`)
- Grid render reads `activeBed`: `frontend/src/components/GardenDesigner.tsx:3026` (`renderGrid(activeBed)`)
- `.map` iteration over `getActivePlantedItems(bed)`: `frontend/src/components/GardenDesigner.tsx:2166`
- `handlePlantedItemClick` sets `selectedPlantedCell` from the iteration's `item`: `frontend/src/components/GardenDesigner.tsx:1417-1431`
- Correct-pattern reference (move): `frontend/src/components/GardenDesigner.tsx:1280-1293`
- Correct-pattern reference (clear): `frontend/src/components/GardenDesigner.tsx:920-930`
- Correct-pattern reference (duplicate shift-drag): `frontend/src/components/GardenDesigner.tsx:311-327`
- Sibling handlers with the same defect: `frontend/src/components/GardenDesigner.tsx:1230-1232` (`handleSeedDateSuccess`), `1234-1237` (`handleCollectSeedsSuccess`)
- Backend PUT for saveForSeed: `backend/blueprints/gardens_bp.py:1358-1394`
- `PlantedItem.to_dict`: `backend/models.py:134-151`
- `GardenBed.to_dict` embeds planted items: `backend/models.py:97`
- Backend persistence tests (passing): `backend/tests/test_save_for_seed_persistence.py` (7 tests)
- Related prior fix (visibility, different symptom): commit `90c09a3` — `getActivePlantedItems` `saving-seed` branch at `frontend/src/components/GardenDesigner.tsx:655-657`
