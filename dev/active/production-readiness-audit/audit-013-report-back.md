# AUDIT-013 Report-back (2026-04-23)

Chat-reply cut of the fix pass. Companion to:
- `audit-013-developer-handoff.md` (user directive)
- `indoor-start-specific-placement-followup.md` (user P1 finding)
- `audit-013-investigation.md` (full technical investigation)
- `audit-013-summary.md` (decisions + options)
- `audit-013-implementation-decision.md` (user greenlight)
- `audit-013-fix-report.md` (full fix-pass detail)

Persisted per the always-write-findings-to-md rule.

---

## Exact backend API payload / behavior change

`POST /api/planted-items` accepts optional
**`sourceIndoorSeedStartId: number`**:

| Input | Response |
|---|---|
| Omitted | Existing Path B heuristic (backward compat) |
| Not a positive int (incl. booleans, floats, strings, lists, dicts) | `400 {error: 'sourceIndoorSeedStartId must be a positive integer'}` |
| Not found / cross-user | `404 {error: 'Indoor seed start not found'}` |
| Status `'transplanted'` or `'failed'` | `400 {error: "Indoor seed start is already in status '<status>' and cannot be relinked."}` |
| Soft-cancelled (`cancelled_at` not null) | `400 {error: 'Indoor seed start has been cancelled and cannot be relinked.'}` |
| Valid + owned + active | **Atomic**: create PlantedItem + PlantingEvent + advance IndoorSeedStart to `'transplanted'` via `_link_existing_indoor_seed_start`, skipping the heuristic. |

No schema change, no migration. Linkage flows through existing
`IndoorSeedStart.planting_event_id`.

---

## Exact frontend flow change

`GardenDesigner.tsx`:

1. **Removed**: `executeMarkTransplanted`, `markingTransplanted`
   state, and the direct
   `PUT /api/indoor-seed-starts/:id { status: 'transplanted' }`
   path. **Grep: 0 hits for either symbol across `frontend/src/`.**
2. **Banner button** now reads `Pick cell in <bedName>`. Click:
   - `hardening` → enter picker mode directly
   - Pre-ready → confirm dialog first (new copy:
     *"This start is at status='<current>' and isn't ready for
     transplant. Placing it now will also mark it transplanted.
     Continue?"*) → on Confirm, enter picker mode
3. **Entering picker mode** auto-navigates to the destination bed
   (sets active/visible/bedFilter/checkedBeds, persists to
   localStorage).
4. **Grid-cell click** (in picker mode, on destination bed) opens
   `PlantConfigModal` pre-populated with position + plant +
   variety.
5. **Modal confirm** dispatches `POST /api/planted-items` with
   `sourceIndoorSeedStartId: transplantMode.seedStartId`. Atomic
   write.
6. **Cancel** (banner, dialog, or modal) exits without writing.
7. Out-of-destination-bed clicks show a toast and don't dispatch.

---

## Path A fully replaced?

**Yes.** No banner path writes `status='transplanted'` without
picking a cell and confirming through `PlantConfigModal`. The
`executeMarkTransplanted` function is deleted. Verified by grep.

---

## Commit hashes

```
6ae3ef2 docs: AUDIT-013 fix report
2ca6390 fix: Enable explicit indoor-start placement via cell picker (AUDIT-013)
195a20d docs: AUDIT-013 investigation + summary  (earlier)
```

Three local commits. Not yet pushed.

---

## Test / build results

- **Backend**: **1299 passed, 2 failed (pre-existing geocoding), 1
  xfailed**. 15 new tests in
  `test_placement_explicit_seed_start_link.py` all pass — happy
  path, omit-field fallthrough, 7 malformed-value rejections,
  not-found, cross-user, 2 stale-status rejections, cancelled-record
  rejection, explicit-FK-wins-over-heuristic.
- **Frontend**: `npm run build` compiled successfully (+274 B
  gzipped). **139/139 Jest tests pass** across 15 suites. No tests
  cover `GardenDesigner.tsx` — standing coverage gap re-flagged.

---

## Deferred (explicitly out of scope)

- `/api/planted-items/batch` explicit-FK support (Stage 2 if needed)
- `PlantedItem.source_indoor_seed_start_id` column for direct FK
  queries
- Drag-from-palette record picker (Option β)
- `GardenDesigner.tsx` coverage backfill

---

## Awaiting

Push greenlight for the three local commits.
