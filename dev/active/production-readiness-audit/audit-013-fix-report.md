# AUDIT-013 Fix Report (2026-04-23)

Ships Option α per `audit-013-implementation-decision.md`. Replaces
Path A's status-only banner write with an end-to-end cell-picker
workflow. Pre-ready confirm dialog from `2d41a02` preserved.

---

## Commit

```
2ca6390 fix: Enable explicit indoor-start placement via cell picker (AUDIT-013)
```

Local only. Not yet pushed.

---

## Exact backend API payload / behavior change

**Endpoint**: `POST /api/planted-items` (`gardens_bp.py:447-476` new validation + `:544-557` linkage routing).

New optional payload field: **`sourceIndoorSeedStartId: number`**.

Validation:

| Case | Response |
|---|---|
| Absent / undefined | Existing behavior — Path B heuristic still runs |
| Not a positive int (`0`, `-1`, `'abc'`, `1.5`, `true`, lists, dicts) | 400 `{error: 'sourceIndoorSeedStartId must be a positive integer'}` |
| Not found / cross-user | 404 `{error: 'Indoor seed start not found'}` |
| Record already `status='transplanted'` or `'failed'` | 400 `{error: "Indoor seed start is already in status '<status>' and cannot be relinked."}` |
| Record soft-cancelled (`cancelled_at is not None`) | 400 `{error: 'Indoor seed start has been cancelled and cannot be relinked.'}` |
| Valid + owned + active | Link via `_link_existing_indoor_seed_start(seed_start, planting_event)`, skipping the heuristic. `IndoorSeedStart.status → 'transplanted'` and `planting_event_id` wired in the same transaction as the PlantedItem create. |

Response body on success includes `indoorSeedStartLinked: true`,
`indoorSeedStartCreated: false`, `indoorSeedStartId: <id>`.

**No schema change. No migration.** Linkage flows through the existing
`IndoorSeedStart.planting_event_id` column. The explicit-FK column
`PlantedItem.source_indoor_seed_start_id` remains Stage 2 — not added.

---

## Exact frontend flow change

**File**: `frontend/src/components/GardenDesigner.tsx` (only).

### State additions
- `transplantMode` type gains `plantId?: string` and `bedId?: number` for picker use.
- New `transplantPickerActive: boolean` state flag.

### Removed
- `executeMarkTransplanted` handler (the direct `PUT /api/indoor-seed-starts/:id { status: 'transplanted' }` write path).
- `markingTransplanted` / `setMarkingTransplanted` state.
- Banner's "Mark Transplanted" / "Save placement" **write** button — replaced by "Pick cell in `<bedName>`" mode-entry button.

### Banner button behavior (`Pick cell in <bedName>`)
- **`hardening`** entry → `enterTransplantPickerMode()` directly.
- **pre-ready** entry (`planned`/`seeded`/`germinating`/`growing`) → opens `ConfirmDialog` with the new copy:
  > `This start is at status='<current>' and isn't ready for transplant. Placing it now will also mark it transplanted. Continue?`
  → Continue → `enterTransplantPickerMode()`. Cancel → no mode change.

### Picker mode
- Auto-navigates to the destination bed (sets `activeBed`, `visibleBeds=[destBed]`, `bedFilter`, `checkedBeds`, persists to localStorage). Matches `App.tsx:534` pattern.
- Banner updates to prompt: `Click a cell in <bedName> to place <name>`.
- Grid-cell click handler (`handleTransplantPickerCellClick`) opens `PlantConfigModal` pre-populated with `cropName`, `position: { x, y }`, `bedId`, `initialVariety`.
- Modal confirm dispatches `POST /api/planted-items` with `sourceIndoorSeedStartId: transplantMode.seedStartId` in the payload. **Atomic**: backend creates PlantedItem + PlantingEvent + advances IndoorSeedStart status in one call.
- On success: clears `transplantMode`, `transplantPickerActive`, fires `onTransplantComplete()`. Banner dismisses.
- On error: banner stays so user can retry another cell.

### Defense-in-depth
- Clicks on cells outside the destination bed (if user re-expands beds somehow) show a toast and do NOT dispatch.
- `handleCancelTransplant` (the banner's own Cancel button) also clears `transplantPickerActive` + `showPreReadyConfirm`.

---

## Is Path A fully replaced?

**Yes.** The direct `PUT /api/indoor-seed-starts/:id { status: 'transplanted' }` call path is removed entirely from the banner flow.

- `executeMarkTransplanted` — deleted.
- No more status-only write reachable from the banner.
- Grep verification: `executeMarkTransplanted|markingTransplanted` across `frontend/src/` → 0 hits.
- The user's only path from the banner to marking an IndoorSeedStart transplanted now requires picking a cell and confirming through `PlantConfigModal`. No shortcut.

If a user ever wants to mark a seed start transplanted without caring about the bed cell, that's now out-of-reach from this banner — not in scope for AUDIT-013. Per the user's Replace (not coexist) decision.

---

## Test / build result

- **Backend suite**: **1299 passed, 2 failed, 1 xfailed**. The 2 failures are pre-existing geocoding tests (unrelated). 15 new cases in `test_placement_explicit_seed_start_link.py` all pass.
- **Frontend build**: `Compiled successfully.` No TypeScript errors. Main bundle +274 B.
- **Frontend tests**: 139/139 passed, 15/15 suites. No new tests added — `GardenDesigner.tsx` has no Jest harness (standing coverage gap, flagged across prior passes).

---

## Preserved

- Pre-ready confirm dialog gate (commit `2d41a02`) — fires before entering picker mode.
- Path B drag-from-palette flow — unchanged. Heuristic `_find_existing_indoor_seed_start` intact.
- Banner's own Cancel button — untouched (just cleared one extra state flag on exit).
- All existing label semantics from the earlier `d63f487` relabel + `2d41a02` banner copy flip.

---

## Deferred (explicitly out of scope this pass)

- `/api/planted-items/batch` explicit-FK support. Backend endpoint untouched.
- `PlantedItem.source_indoor_seed_start_id` column for direct FK queries. Stage 2.
- Drag-from-palette record picker (Option β from investigation). Separate future pass.
- `GardenDesigner.tsx` unit tests. Standing coverage gap.
- `PlantConfigModal.skipPost` branch's `sourceIndoorSeedStartId` injection. Currently no caller sets `skipPost: true`; defensive-only path. Noted.

---

## Scope notes

- Backend: ~43 LOC in `add_planted_item` + 15 new test cases.
- Frontend: ~137 gross LOC change in `GardenDesigner.tsx`. Soft target was ≤100 LOC; overrun driven by three parallel POST call sites in `handlePlantConfig` (seed-density batch, single-position, multi-square batch) each needing the new `sourceIndoorSeedStartId` field. No helper abstraction won on net. Flagged but not blocking.
- Cross-stack in a single commit per the audit's one-bug-one-commit directive.

---

## Awaiting user

Push greenlight for the local commits:

```
2ca6390 fix: Enable explicit indoor-start placement via cell picker (AUDIT-013)
195a20d docs: AUDIT-013 investigation + summary
```

Two commits total (the implementation + the earlier investigation bundle).
