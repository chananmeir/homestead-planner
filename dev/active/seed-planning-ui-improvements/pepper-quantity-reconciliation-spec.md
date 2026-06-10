# Pepper Quantity Reconciliation — Developer Spec

**Date:** 2026-06-03
**Author:** PM (on behalf of marcsiegel)
**Status:** Ready for development (decisions locked)

## Problem statement

User indoor-started **Pepper (Pimento Sweet)**: 20 seeds → 15 germinated ("growing"). Planned 5
in a row of **Garden Bed Five** but only physically transplanted **3**. Two screens are now wrong:

1. **Design → Garden Designer**, "Plants in Garden Bed Five" panel shows `Pepper (Pimento Sweet) — 5 plants · A7, C7`. Should read **3**.
2. **Grow → Indoor Seed Starts**, Pepper card shows germination/scheduling but **never shows how many seedlings remain to be planted** (15 grown − 3 planted = **12 left**).

## Reference screenshots
- `Downloads/68s.JPG` — Garden Designer, Garden Bed Five, Pepper row reads "5 plants · A7, C7".
- `Downloads/pepperseeds.JPG` — Indoor Seed Starts, Pepper (Pimento Sweet): 20 seeds, 15 germinated (75%), planned bed Garden Bed Five, "Spot chosen".

---

## Part 1 — Edit placed plant count in the bed (5 → 3)

**Decision (locked):** *Just fix the number.* User edits the count; system auto-removes the surplus
placed plants and updates the grid. User does NOT hand-pick which cells.

### Requirements
- Provide an editable quantity control on the Pepper row in the "Plants in Garden Bed Five" panel (`BedSummaryCard` / equivalent placed-plants list).
- Setting count from 5 → 3 removes 2 `PlantedItem`s from that plant+variety group in that bed.
- Removal MUST use the **`cancelled_at` soft-delete** pattern (migration `f2bb35af831e`, May 2026) — not hard delete.
- Grid cells for the removed plants are cleared — no orphan icons in the A7/C7 row.
- Season-progress sidebar ("X/Y placed", `PlannedPlantsSection.tsx` / `GET /api/garden-planner/season-progress`) recomputes correctly.
- Increasing the number is out of scope for now (this is a downward correction); decide whether to disable up-edits or no-op them.

### Open implementation notes
- "5 plants · A7, C7" lists only 2 cells for 5 plants — confirm whether peppers are 1 PlantedItem/plant or a quantity-bearing item, since that determines whether we cancel rows or decrement a quantity field.
- When auto-selecting which 2 to remove, prefer a deterministic rule (e.g. most-recently-placed first) so behavior is predictable.

---

## Part 2 — "Remaining to plant" on the Indoor Seed Start card

**Decision (locked):** *Germinated − planted.* Remaining = germinated count − number actually placed
in beds. For this case: 15 − 3 = **12**.

**Decision (locked):** *Auto-derive by match.* "Planted" count = non-cancelled `PlantedItem`s whose
plant + variety match the seed start AND whose bed = the seed start's planned bed. No new explicit
foreign-key link required.

### Requirements
- Add a "remaining to plant" figure to the Indoor Seed Start card (`IndoorSeedStarts.tsx` / `EditSeedStartModal` area), e.g. **"12 of 15 remaining to plant"**.
- `remaining = germinatedCount − placedCount`, clamped to `>= 0`.
- `placedCount` = derived by match (plant_id + variety + planned bed, excluding `cancelled_at`).
- Updates live: placing/removing peppers on the grid (Part 1) should move this number.

### Known risk — flag in implementation
- Per architecture notes (`plantingevent-indoorseedstart-asymmetry.md`), IndoorSeedStart and PlantedItem are **not auto-linked**. Auto-derive-by-match is a heuristic:
  - If **two seed starts** of the same plant+variety target the **same bed**, their placements are indistinguishable and counts could be misattributed. Document this limitation; acceptable for now.
  - Match must be scoped by `user_id`.
- Confirm where germinated count lives on the IndoorSeedStart model and that it's the right denominator (vs seeds-planted).

---

## Acceptance test (manual)
1. Garden Bed Five Pepper shows 5 → edit to 3 → grid drops 2 icons, panel reads 3, sidebar placed-count drops by 2.
2. Indoor Seed Starts Pepper card now reads "12 of 15 remaining to plant".
3. Remove 1 more pepper from the bed → card reads "11 of 15"; re-add one → back to "12 of 15".
4. Removed plants are soft-deleted (`cancelled_at` set), not hard-deleted.

## Cross-file / sync checklist
- No space-calculation change (counts only) — sync pairs not affected.
- No schema change expected (reuses `cancelled_at`); confirm before adding any column.
- Backend: `gardens_bp.py` (placement/cancel), season-progress service; Frontend: `BedSummaryCard.tsx`, `IndoorSeedStarts.tsx`, `PlannedPlantsSection.tsx`.
- Run: backend `pytest`, frontend `CI=true npx react-scripts test --watchAll=false`.

## Implementation notes - 2026-06-03

- Added downward-only group quantity correction via `PATCH /api/garden-beds/<bed_id>/planted-item-groups/quantity`.
- Reduction is deterministic: most-recent active `PlantedItem` rows are reduced first. Full row removals set `cancelled_at`; partial removals decrement `quantity` because placed peppers can be quantity-bearing rows.
- Matching `PlantingEvent` rows at the same bed/plant/variety/cell are reduced or soft-cancelled so calendar/future overlays do not keep stale quantities.
- Season progress now excludes `PlantedItem.cancelled_at IS NOT NULL` in all placed-count aggregations.
- `IndoorSeedStart.to_dict()` now returns `placedCount` and `remainingToPlant`, derived from active placed items matching user, plant, variety, and destination bed.
- Known limitation remains: two indoor seed starts with the same plant+variety targeting the same bed cannot be distinguished by the match heuristic.

Verification:
- `cd backend && python -m pytest tests\test_pepper_quantity_reconciliation.py -q`
- `cd backend && python -m pytest tests\test_cancel_task_endpoints.py tests\test_pepper_quantity_reconciliation.py -q`
- `cd frontend && npm.cmd test -- --watchAll=false --testPathPattern=IndoorSeedStarts.placementPill.test.tsx`
- `cd frontend && npm.cmd run build` (passed with existing ESLint warnings outside this change)
- `cd backend && python -m pytest` was attempted. It passed this task's coverage but failed existing `tests/test_geocoding_service.py` hardiness-zone/API expectations; rerunning that file with network access still left 5 geocoding expectation failures unrelated to pepper quantity reconciliation.
- `cd frontend && npm.cmd test -- --watchAll=false` passed.

## Live-data verification — 2026-06-04

Verified against `backend/instance/homestead.db` (user 59, marcsiegel) that the feature works end-to-end on the real pepper case.

- Bed "Garden Bed Five" = id 41, `planning_method='square-foot'`.
- Pepper stored as **two quantity-bearing cell records**, NOT a single row object (no row_group table exists):
  - `planted_item` #1927 — A7 (x0,y6) — qty **3** — active.
  - `planted_item` #1928 — C7 (x2,y6) — qty 2 — `cancelled_at=2026-06-04 09:05` (the 5→3 correction).
  - Active total = 3. Panel "5 plants · A7, C7" was the sum of both cells' quantities pre-edit.
- IndoorSeedStart #131 (Pimento Sweet): `seeds_germinated=15`, `destination_bed_ids=[41]`.
  - `get_placed_count_for_destination_beds` SUMs `quantity` of active matching PlantedItems = 3.
  - `remainingToPlant = max(0, 15 - 3) = 12`. Confirmed correct.
- **Conclusion:** The row-vs-square-foot ("planting-style vs planning-method") risk did NOT manifest — neither the Qty edit nor the remaining-to-plant count assumes one-plant-per-cell; both sum the `quantity` field. No code change needed.

