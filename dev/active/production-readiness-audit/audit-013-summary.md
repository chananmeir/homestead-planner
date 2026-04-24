# AUDIT-013 Investigation Summary (2026-04-23)

Decision cut from `audit-013-investigation.md`. Focuses on the
broader specific-placement workflow gap. Keeps the recent banner
fixes (`d63f487`, `2d41a02`) intact — not reopened.

---

## Confirmed gap

The app has two placement-adjacent paths, neither of which is
"select this indoor-start record AND place it at this cell in one
action":

- **Path A — Indoor Starts → Designer banner**
  `GardenDesigner.tsx:484-504`. Writes ONLY `PUT /api/indoor-seed-starts/:id { status: 'transplanted' }`. **No PlantedItem created.** No cell selected. No position stored.
- **Path B — Drag from palette**
  `gardens_bp.py:411-448` + `_find_existing_indoor_seed_start` at `:69-114`. Creates `PlantedItem` at a clicked cell, then INFERS the IndoorSeedStart linkage by a `(user + plant + variety + destination_bed + ±14-day transplant_date)` heuristic. User never explicitly picks the record.

### Linkage status

**Mixed, leaning incomplete.** Path B's heuristic partially works but the
user-explicit "select record X, place at cell Y" primitive is absent
entirely. Path A writes status but nothing else; Path B writes
PlantedItem but doesn't let the user pick the record.

---

## Data model state

- `PlantedItem` has `source_plan_item_id` (`models.py:100-151`) but
  **NO** `source_indoor_seed_start_id`.
- `POST /api/planted-items` (`add_planted_item` at `gardens_bp.py:411-448`)
  accepts `sourcePlanItemId` but NOT `sourceIndoorSeedStartId`.
- Backend helpers `_find_existing_indoor_seed_start` and
  `_link_existing_indoor_seed_start` at `gardens_bp.py:69-142` already
  exist and handle the FK update on the `IndoorSeedStart` side.

---

## Recommendation: **Option α — Banner becomes cell-selection mode**

Rather than writing status immediately on "Save placement" / "Mark
Transplanted", the button transitions the designer into a click-to-
place mode. The user clicks a cell in the destination bed → one
atomic write:

1. Create `PlantedItem` at that cell.
2. Advance `IndoorSeedStart.status` to `'transplanted'`.
3. Persist the linkage between them.

Cancel exits the mode without writes. Pre-ready confirm dialog still
fires before the atomic write (safety improvement from `2d41a02`
preserved).

This delivers exactly the primitive the user asked for: explicit
record select (via the Indoor Starts entry) + explicit cell select
(via the new click-to-place mode) in one action. Ships with
Stage 1 scope cleanly.

---

## Scope — cross-stack, narrow

### Backend (strict)

- Extend `add_planted_item` (`gardens_bp.py:411-448`) to accept
  optional `sourceIndoorSeedStartId` in the POST payload.
- Validate ownership mirroring `sourcePlanItemId` at `:441-448`.
- When present, short-circuit to the existing
  `_link_existing_indoor_seed_start` helper at `:117-142` instead of
  the heuristic `_find_existing_indoor_seed_start`. This keeps the
  linkage logic in one place.
- **No migration required for Stage 1.** `IndoorSeedStart.planting_event_id`
  already exists and is the mechanism the link helper already uses.
- Nice-to-have for Stage 2: add `PlantedItem.source_indoor_seed_start_id`
  column for direct FK queries. Not blocking Stage 1.

### Frontend (strict)

- `GardenDesigner.tsx` banner: new cell-picker mode state.
- On banner button click (post confirm dialog for pre-ready): DON'T
  write immediately. Enter click-to-place mode.
- Grid-cell click in the destination bed dispatches
  `POST /api/planted-items` with `sourceIndoorSeedStartId`.
- Reuse existing `PlantConfigModal` path (option (a) from product-decisions) for footprint/quantity confirmation — matches how drag-from-palette behaves today, safest default.
- Cancel exits the mode.
- Copy per decisions below.

---

## Product decisions flagged (from investigation §9)

These decisions shape implementation but none are blocking for a
research pass:

### 1. Multi-cell footprint handling (likely the biggest decision)

When the user clicks a cell and the plant needs a 2x2 footprint
(e.g., tomato at square-foot), does Stage 1:

- **(a)** open `PlantConfigModal` pre-populated with the cell; user
  confirms quantity/config before POST (reuses existing
  drag-from-palette pipeline) ← **recommended**
- **(b)** assume quantity=1 and let the batch path infer footprint

(a) is the safer default and matches existing drag behavior.

### 2. Confirm-dialog copy for pre-ready cell picker

Current copy at `GardenDesigner.tsx:3812-3815` is about
mark-transplanted-anyway. For cell-picker mode, proposed:

> "This start is at status=`<current>` and isn't ready for transplant. Placing it now will also mark it transplanted. Continue?"

Confirm or override.

### 3. Banner button label in cell-picker mode

Options:

- `Pick cell in <bedName>` (action-verb + explicit destination) ←
  recommended
- `Place in bed`
- `Choose cell`

### 4. Replace Path A or coexist?

Recommendation: **replace.** Path A's status-only write becomes
obsolete once Option α lands. Coexistence (Option δ) would preserve
a "just mark transplanted without picking a cell" action, which
would re-introduce the ambiguity AUDIT-013 is trying to fix.

### 5. Destination-bed mismatch

If the designer is on a different bed when cell-picker engages:

- **(a)** auto-navigate to the IndoorSeedStart's destination bed
  (matches existing auto-navigation at `App.tsx:534`) ← recommended
- **(b)** restrict picker to destination bed only + warn on wrong
  click

---

## Smallest safe first cut (Stage 1)

Ship Option α end-to-end with:

- Backend: accept `sourceIndoorSeedStartId`, reuse
  `_link_existing_indoor_seed_start`
- Frontend: banner enters cell-picker mode; cell click opens
  `PlantConfigModal` with the existing start pre-linked; modal confirm
  fires the POST; `_link_existing_indoor_seed_start` advances status
- Preserve pre-ready confirm dialog from `2d41a02`
- No new columns, no migration

Defer Stage 2: new `PlantedItem.source_indoor_seed_start_id` column for
cleaner direct queries, drag-from-palette record picker (Option β).

---

## Scope estimate

- Backend: ~20-30 LOC in `add_planted_item` + validation + tests.
- Frontend: ~40-60 LOC in `GardenDesigner.tsx` — cell-picker mode state,
  click handler, modal pre-population, banner wiring.
- Tests: 4-6 backend regression tests (explicit linkage, ownership,
  coexistence with inferred path, multi-cell footprint flow).
- Frontend tests: coverage gap per prior passes — flagged, not
  scoped to this fix.

Cross-stack, so one combined commit per the audit's "one bug, one
commit" directive. Backend-debugger first, frontend-debugger second,
then single commit + docs.

---

## Awaiting user

- Confirm **Option α** as the chosen direction (or override).
- Confirm defaults on the 5 product decisions above — or override any.
- Greenlight to dispatch `backend-debugger` then `frontend-debugger`.
