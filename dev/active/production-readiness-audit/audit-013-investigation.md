# AUDIT-013 Investigation — Specific Indoor-Start Placement Workflow (2026-04-23)

Read-only investigation. No code modified.

Scope: confirms the framing in the handoff, examines the two existing
entry paths end-to-end, identifies the data-model gap, and recommends
the smallest clear workflow fix. Keeps `Plan Placement` label fix,
confirm-dialog fix, and link-existing-on-drop helper in place.

---

## 1. Current paths — confirmed

### Path A: Indoor Starts -> Designer banner

**Entry point (Indoor Starts card)**
`frontend/src/components/IndoorSeedStarts.tsx:540`
```
const transplantActionLabel = start.status === 'hardening' ? 'Transplant Now' : 'Plan Placement';
```
The card button calls `onNavigateToBed(firstBed.id, start.expectedTransplantDate, start.id)` at `IndoorSeedStarts.tsx:545-549`.

**App-level glue**
`frontend/src/App.tsx:528-538` wires the callback: it sets
`designerBedId`, `designerDate`, and `transplantSeedStartId`, then
switches to the designer tab. No placement / position info is carried.

**GardenDesigner receives the id**
`frontend/src/components/GardenDesigner.tsx:47` — prop `transplantSeedStartId`.
The effect at `GardenDesigner.tsx:450-482` fetches the IndoorSeedStart,
reads its status and destination bed name, and stores that in
`transplantMode` state:
```
setTransplantMode({
  seedStartId: transplantSeedStartId,
  plantName, variety, bedName, status,
});
setViewMode('detail');
```
No cell coordinates, no grid interaction, no drag primed.

**Banner render**
`GardenDesigner.tsx:2660-2686` — renders the green banner with copy
branching on status. Hardening → `Transplanting ... Mark Transplanted`.
Any pre-ready → `Planning placement for ... Save placement`.

**Click handler**
`GardenDesigner.tsx:506-513` `handleMarkTransplanted` — routes to the
confirm dialog for pre-ready, direct write for hardening.
`GardenDesigner.tsx:484-504` `executeMarkTransplanted`:
```
apiPut(`/api/indoor-seed-starts/${transplantMode.seedStartId}`,
       { status: 'transplanted' });
```
**That is the entire server write for Path A.** It goes to the
IndoorSeedStart PUT handler which updates only the fields sent (see
`utilities_bp.py:961-971` per the banner-summary doc, line 15-19). No
PlantedItem is ever created. No PlantingEvent is created by this path.
No position on the grid is written. `actualTransplantDate` stays NULL
unless the user sets it elsewhere (flagged in banner-summary line 88-97).

Confirmation: user's framing of Path A as **"status-only, no PlantedItem
write"** is accurate.

**Also confirmed: `transplantMode` never interacts with the grid.** A
full search for `transplantMode` references (`GardenDesigner.tsx:133,
485, 507, 508, 2418, 2420, 2660, 2665-2676, 3814`) shows it only gates
the Back-to-beds button, renders the banner, and drives
`executeMarkTransplanted`. No `onCellClick`, `handleDrop`, or placement
flow reads it.

### Path B: Designer drag-from-palette

**Entry point**
User drags a plant icon from `PlantPalette` onto a grid cell. The drop
handler eventually calls `apiPost('/api/planted-items', payload)` at
`GardenDesigner.tsx:1655` (single placement) or the batch endpoint at
`GardenDesigner.tsx:1597` / `1748`.

Payload shape at `GardenDesigner.tsx:1642-1653`:
```
{ gardenBedId, plantId, variety, position, quantity, status,
  notes, plantedDate, plantingMethod, sourcePlanItemId }
```
**There is no `indoorSeedStartId` / `sourceIndoorSeedStartId` field in
this payload.** Grep over `frontend/src` confirms the frontend never
sends one for this endpoint.

**Backend handler**
`backend/blueprints/gardens_bp.py:400-567` `add_planted_item`:
1. Validates `plantId`, `gardenBedId`, bed ownership (`:411-423`).
2. Accepts optional `sourcePlanItemId`, validates plan ownership (`:441-448`).
3. Creates `PlantedItem` with `source_plan_item_id` (`:455-468`).
4. Creates paired `PlantingEvent` (`:472-485`).
5. Runs spatial conflict validation (`:492-511`).
6. If `planting_method == 'transplant'`, calls
   `_find_existing_indoor_seed_start` to look for a candidate
   IndoorSeedStart (`:521-524`).
7. If found → `_link_existing_indoor_seed_start` sets
   `planting_event_id`, advances status to `'transplanted'`,
   sets `actual_transplant_date` if null (`:525-528`, helper at `:117-142`).
8. If not found → `_auto_create_indoor_seed_start` creates a fresh
   IndoorSeedStart (`:529-532`, helper at `:145-238`).

**Match criteria for existing-start lookup**
Helper at `gardens_bp.py:69-114`:
```
user_id == current_user.id
plant_id == event.plant_id
variety  == event.variety  (both null-aware)
cancelled_at IS NULL
status != 'transplanted'
expected_transplant_date BETWEEN (transplant_date +/- 14d)
```
Sorted by: unlinked-first → smallest date delta → lowest id.

Confirmation: user's framing of Path B as **"PlantedItem IS created, but
linkage to IndoorSeedStart is inferred by plant+variety+date heuristic,
not by an explicit user-selected record id"** is accurate.

The batch path at `gardens_bp.py:826` behaves the same way for multi-cell
placements.

### Any other path?

Grepped `transplantSeedStartId`, `indoor_seed_start_id`,
`sourceIndoorSeedStartId`, `indoorSeedStartId` across backend and
frontend. Findings:

- Backend `PlantedItem` model (`models.py:100-151`) has NO
  `indoor_seed_start_id` column. The only cross-model FK it carries is
  `source_plan_item_id` -> `GardenPlanItem`.
- Backend `GardenPlanItem` model DOES carry `indoor_seed_start_id`
  (`models.py:1396`), but that link is created by the
  import-from-indoor-starts flow (`utilities_bp.py:125, 172, 883, 1003`)
  — not by a designer-side "place this exact one" action.
- Frontend `indoorSeedStartId` references outside of Path A are in the
  Needs-Attention / Dashboard system (`App.tsx:275`,
  `Dashboard/NeedsAttentionPanel.tsx:624, 639, 729`), where it is only
  used to *focus/highlight* an indoor-start row in the Indoor Starts
  tab. Not a placement action.
- No other route on the backend accepts an `indoorSeedStartId` payload
  that also records a grid position.

**No third path exists.** A user cannot today click-to-place a specific
indoor-start record at an explicit cell in a single action.

---

## 2. The gap

There is a missing primitive:

> "I have indoor-start record #47 (basil, sown 2026-03-15, destination
> Bed A). Put that exact record at grid position (3, 4) in Bed A."

Today the user must compose this from two unrelated halves:

- Path A gives them the right record but only writes a status flip. No
  cell is chosen. No PlantedItem lands on the bed visual.
- Path B gives them a cell but requires them to drag from the palette
  as if creating a new planting, and the backend *infers* which
  IndoorSeedStart to advance by heuristic match. The user never gets to
  say "use record #47" — if two active basil starts exist, the
  tiebreaker is the date-delta heuristic, not the user's selection.

The UX symptom is what the finding describes: after entering via "Plan
Placement" on a specific card, the flow dead-ends at the banner, and the
only way to actually place at a cell feels indistinguishable from
creating a new planting from the bed side. That matches the user's own
framing in `indoor-start-specific-placement-followup.md:26` and `:34-37`.

---

## 3. Data model state

### Does `PlantedItem` have `source_indoor_seed_start_id` (or similar)?

**No.** `backend/models.py:100-151` shows `PlantedItem` has only
`source_plan_item_id` (`:122-127`) as its cross-model link.

A migration would look like:
```
# Alembic migration (new file under backend/migrations/versions/)
batch_op.add_column(sa.Column('source_indoor_seed_start_id',
                              sa.Integer(), nullable=True))
batch_op.create_index('ix_planted_item_source_indoor_seed_start_id',
                      ['source_indoor_seed_start_id'], unique=False)
batch_op.create_foreign_key('fk_planted_item_indoor_seed_start',
                            'indoor_seed_start',
                            ['source_indoor_seed_start_id'], ['id'],
                            ondelete='SET NULL')
```
Precedent: `backend/migrations/versions/b4d826b4780f_add_source_and_indoor_seed_start_id_to_.py`
already did exactly this for `GardenPlanItem`.

**Alternative without a migration:** the existing
`PlantedItem.source_plan_item_id` chains through
`GardenPlanItem.indoor_seed_start_id` (`models.py:1396`), so the
linkage *can* be walked transitively when the placement came from a
plan-imported indoor start. But this does NOT cover the case where the
IndoorSeedStart was created ad-hoc from the Indoor Starts tab with no
plan item. For a complete explicit linkage, the migration is the
honest answer; for a first cut, see §8.

### Does the POST /api/planted-items endpoint accept an explicit IndoorSeedStart linkage?

**No.** `backend/blueprints/gardens_bp.py:400-567` parses only
`plantId`, `gardenBedId`, `position`, `quantity`, `status`, `notes`,
`plantedDate`, `plantingMethod`, `variety`, and `sourcePlanItemId`
(`:411-448`). There is no read of any `indoorSeedStartId` /
`sourceIndoorSeedStartId` key.

The IndoorSeedStart linkage is created only by
`_find_existing_indoor_seed_start` (`:69-114`) at `:522-524`, which is
heuristic, not user-driven.

### Does the banner's current click handler create a PlantedItem at all?

**No.** `executeMarkTransplanted` at `GardenDesigner.tsx:484-504` makes
exactly one API call: `PUT /api/indoor-seed-starts/:id {status: 'transplanted'}`.
It does not touch PlantedItem or PlantingEvent.

---

## 4. Fix options

### Option α — Banner -> cell-selection mode

Behavior change: instead of `Save placement` / `Mark Transplanted`
writing immediately, the button label becomes `Pick a cell` (pre-ready)
or `Pick cell and transplant` (hardening). Clicking enters a
cell-picker mode in the designer. Cursor changes; the next click inside
the destination bed grid is captured.

On cell click, a single combined write runs:
1. `POST /api/planted-items` with `{ gardenBedId, plantId, variety,
   position: {x,y}, quantity, plantedDate, plantingMethod: 'transplant',
   sourceIndoorSeedStartId: <id> }`.
2. Backend creates PlantedItem, PlantingEvent, and links explicitly
   to the user-selected IndoorSeedStart (status -> 'transplanted',
   `planting_event_id` set, `actual_transplant_date` set).
3. The existing `_find_existing_indoor_seed_start` heuristic is
   bypassed for this request because the id was explicit.

Cancel exits the mode with no write.

**Scope**: backend (new request-field support + explicit link path),
frontend (banner copy and button behavior, enter cell-picker mode on
click, capture next cell click, POST with explicit id, reset mode).
Cell-picker mode must gate other interactions (drag, palette) so the
user can't accidentally do a different action.

**Risks**:
- Introduces a new interaction mode in GardenDesigner; must coexist
  with the existing `plantingMode` banner and drag-from-palette without
  collision.
- If the plant needs multi-cell footprint (square-foot ≥ 1x1 grid),
  the "pick one cell" primitive needs to match the footprint
  calculator logic used by drag-from-palette. Reuse `PlantConfigModal`
  path or call the batch endpoint.
- Conflict validation must still run (existing path in `add_planted_item`
  at `:492-511`) — no regression concern.

### Option β — Drag-from-palette picker

Behavior change: when the user drags a plant with one or more matching
active unattached IndoorSeedStart records, the drop handler presents a
small picker before POSTing:
- `Use existing indoor start: basil (sown 2026-03-15, growing)`
- `Create new planting`

If the user picks an existing record, the POST carries an explicit
`sourceIndoorSeedStartId`. Backend uses that directly instead of the
heuristic.

**Scope**: backend (same new request-field support as Option α),
frontend (picker modal/dropdown inserted into the drop flow in
`GardenDesigner.tsx` around `:1642-1655` and the batch equivalents).
Additional GET endpoint or query param to list unattached candidates
(could reuse `GET /api/indoor-seed-starts` filtered client-side).

**Risks**:
- Adds friction to the drag-from-palette flow, which is today the
  smoother "just place a new planting" path. The picker must be
  dismissible and default to "create new" to avoid regressions.
- Does not resolve the entry from Indoor Starts tab — the user who
  clicked "Plan Placement" on card #47 still has no direct cell
  primitive; they'd have to come back, drag from palette, then pick
  #47 from the picker. Indirect.

### Option γ — Both (A + B)

Ship α and β together. Full coverage of both entry points: Indoor
Starts tab -> click card -> pick cell (α), and Designer tab -> drag
from palette -> pick existing record (β).

**Scope**: sum of α + β. One migration, one backend change to accept
the explicit FK, two frontend sites.

**Risks**: bigger blast radius. Harder to isolate regressions.

### Option δ — Add a SECOND banner action for cell placement, preserve status-only write

Behavior change: keep current `Save placement` / `Mark Transplanted`
button exactly as today. Add a second primary button `Place in bed...`
next to it. That second button enters the α cell-picker mode; the
original button keeps the status-only write for users who genuinely
just want to mark the record transplanted without picking a cell.

**Scope**: same backend work as α. Frontend gets an additional button
in the banner plus the cell-picker mode.

**Risks**:
- More buttons in a tight banner; copy real estate.
- Two success paths with different outcomes (status-only vs. full
  placement) risk user confusion of a different flavor.
- Arguably the "just status" affordance is the one causing AUDIT-014's
  trust problem in the first place; preserving it may not be a
  feature.

---

## 5. Recommendation

**Recommended: Option α — banner becomes a cell-selection mode.**

Rationale:

The user's own framing of the problem
(`indoor-start-specific-placement-followup.md:41-45`) is literally "take
one specific indoor-start record and place that exact record into the
bed". That is a one-primitive request. Option α delivers exactly that
primitive and nothing else. The Indoor Starts card is already the
selection step; making the banner's action "choose where in the bed"
closes the loop.

Option β helps a different user intent ("I'm in the designer and
happen to remember I have an indoor start") and leaves the
Plan-Placement entry point still feeling dead-ended. Option γ is
correct long-term but doubles scope. Option δ keeps the status-only
write alive as a separate action, which preserves the affordance that
caused AUDIT-014's original write-path safety concern (even with the
confirm dialog, it's an action whose effect still surprises users, per
`indoor-start-banner-summary.md:22-34`); not ideal to enshrine a second
permanent button for it.

Code-evidence supporting α specifically:
- `transplantMode` at `GardenDesigner.tsx:133` is already the right
  in-memory carrier — status, plantName, variety, bedName, and
  seedStartId are already populated at `:465-472`. All that's missing
  is a "waiting for cell click" flag and a cell-click handler.
- `add_planted_item` at `gardens_bp.py:400-567` already runs conflict
  validation, auto-creates PlantingEvent, and links the existing
  IndoorSeedStart when found. Adding a `sourceIndoorSeedStartId`
  accept-path is a small extension that short-circuits the heuristic
  with an explicit id — it reuses the existing
  `_link_existing_indoor_seed_start` helper at `:117-142` directly.
- The existing conflict / spatial validation at `:492-511` flows
  through unchanged; no new validation surface.

---

## 6. Is it frontend-only or cross-stack?

**Cross-stack, but backend change is narrow.**

Strictly required backend work:
1. Accept `sourceIndoorSeedStartId` (or `indoorSeedStartId`) in the
   POST /api/planted-items payload (`gardens_bp.py:400-567`).
2. Validate ownership: the referenced IndoorSeedStart must belong to
   `current_user.id` and must not be `cancelled_at IS NOT NULL` or
   already `status='transplanted'`. Mirror the existing
   `sourcePlanItemId` validation pattern at `:442-448`.
3. When present, skip `_find_existing_indoor_seed_start` and
   directly call `_link_existing_indoor_seed_start` with that id
   (`:117-142` is already the right function).

**Migration question:** strictly, none is required if the only thing
persisted is the IndoorSeedStart status flip + PlantingEvent linkage
(which uses the existing `IndoorSeedStart.planting_event_id`
column). `PlantedItem` does NOT need a new column for Option α to
function, because the identity of the originating indoor-start can be
walked back via `PlantedItem -> source_plan_item_id -> GardenPlanItem
-> indoor_seed_start_id` for plan-derived starts, and
`IndoorSeedStart.planting_event_id -> PlantingEvent` for ad-hoc
starts.

**Optional but cleaner**: add `PlantedItem.source_indoor_seed_start_id`
anyway for direct linkage. Precedent exists at
`b4d826b4780f_add_source_and_indoor_seed_start_id_to_.py`. This is a
nice-to-have, not a blocker, and can land as a stage-2 cleanup if
Option α MVP (§8) gets shipped first.

Frontend work (larger):
- GardenDesigner.tsx: add cell-picker mode, gate grid clicks, wire the
  next-click-captures-cell flow, update banner copy/buttons, include
  `sourceIndoorSeedStartId` in the POST.
- Reuse existing `PlantConfigModal` / footprint logic so the placement
  respects bed `planningMethod` (square-foot cell count, migardener,
  etc.). Do not reinvent footprint math.

---

## 7. Linkage: working-but-unclear or incomplete?

**Mixed, leaning incomplete.**

- Linkage is **working** in the narrow sense that Path B's heuristic
  does advance an existing IndoorSeedStart when the match criteria
  happen to line up (same plant+variety+date window,
  `_find_existing_indoor_seed_start` at `gardens_bp.py:69-114`, tested
  by `backend/tests/test_placement_indoor_start_dedup.py`).
- Linkage is **incomplete** in the user-intent sense: there is no
  single action where the user explicitly selects record #47 AND
  places it at a cell. Path A selects the record but writes no
  placement. Path B writes a placement but doesn't let the user pick
  which record.
- Linkage is **unclear** in the UX sense at Path A — the "Save
  placement" / "Planning placement for" banner reads like it will
  place a plant on the grid, but it does not. `GardenDesigner.tsx:2665`
  literally says `Planning placement for <plant>` and the button label
  is `Save placement`; the actual write is `status='transplanted'`
  with no position.

So the honest one-line answer: **linkage is partially working via
heuristic, and the specific-record-to-specific-cell primitive is
absent entirely.**

---

## 8. Smallest safe first cut

Stage-1 MVP (Option α, minimum viable slice):

1. **Backend** — accept `sourceIndoorSeedStartId` in
   `POST /api/planted-items` payload (`gardens_bp.py:400-567`):
   - Validate ownership (mirror `sourcePlanItemId` pattern at `:442-448`).
   - When present: skip `_find_existing_indoor_seed_start`; call
     `_link_existing_indoor_seed_start(seed_start, planting_event)`
     directly after `planting_event` is flushed.
   - Return `indoorSeedStartId` and `indoorSeedStartLinked: true` in
     the response (already the shape at `:552-556`).
   - No migration. No new column. Uses existing
     `IndoorSeedStart.planting_event_id` linkage.

2. **Frontend** — convert the existing `transplantMode` banner to a
   cell-picker trigger (`GardenDesigner.tsx:2660-2686`):
   - Rename button to `Pick cell in bed` (or similar) for both
     hardening and pre-ready states.
   - Clicking enters a new `cellPickerMode` state (boolean flag
     alongside `transplantMode`).
   - In `cellPickerMode`, the next click on a grid cell in
     `transplantMode.bedName`'s bed triggers a POST to
     `/api/planted-items` with `sourceIndoorSeedStartId: seedStartId`
     and the clicked cell's `{x,y}`. Bed id comes from
     `transplantMode`; plantId/variety come from the fetched
     IndoorSeedStart.
   - On success: clear `transplantMode`, clear `cellPickerMode`, show
     success toast, reload beds.
   - Cancel and Esc both exit `cellPickerMode` without writing.
   - Preserve the confirm dialog for pre-ready status — same message,
     but phrased as "This start isn't ready; placing it will mark it
     transplanted anyway. Continue?"

3. **Leave deferred** (Stage 2):
   - Option β (drag-from-palette picker).
   - `PlantedItem.source_indoor_seed_start_id` migration for direct
     FK. (Stage-1 walks back through the existing PlantingEvent link.)
   - Multi-cell footprint handling for square-foot beds where the
     plant needs more than one cell. Stage 1 can handle 1-cell
     footprint and defer the multi-cell case to Stage 2, OR Stage 1
     can open `PlantConfigModal` pre-populated from the IndoorSeedStart
     and reuse the existing footprint placement path. The latter is
     cleaner and probably the actual minimum — see §9.

Blast radius of Stage 1:
- Backend: ~20 LOC in `gardens_bp.py` (one block before the heuristic
  call, an ownership check, an id-based direct-link branch).
- Frontend: ~50-80 LOC in `GardenDesigner.tsx` (new state, new click
  handler, banner button rewire, POST payload change). No new modal
  if `PlantConfigModal` reuse is chosen; +1 modal if not.
- Tests: extend `test_placement_indoor_start_dedup.py` with an
  explicit-id case; add an E2E for the banner -> cell flow.

---

## 9. Open product decisions

These need user / product input before implementation:

1. **Multi-cell footprint handling on pick.** When the user clicks a
   cell and the plant needs a 2x2 footprint (e.g., tomato at
   square-foot), does Stage 1:
   - (a) open `PlantConfigModal` with the cell pre-populated and let
     the user confirm quantity / configuration before POSTing (reuses
     existing placement pipeline), or
   - (b) assume quantity=1 and let the existing batch path handle the
     footprint implicitly?
   Option (a) is the safer default and matches how drag-from-palette
   behaves today. Confirm.

2. **Pre-ready confirm dialog phrasing.** Current copy at
   `GardenDesigner.tsx:3812-3815` is about marking-transplanted-anyway.
   For the cell-picker version it should also warn that the status
   flip still happens. Proposed: `"This start is at status='<current>'
   and isn't ready for transplant. Placing it now will also mark it
   transplanted. Continue?"` — confirm the copy.

3. **What should the banner button read?** Options:
   - `Pick cell in <bedName>` (action-verb, explicit destination)
   - `Place in bed`
   - `Choose cell`
   Pick one; keep it consistent across hardening and pre-ready.

4. **Should Option α replace Path A's current status-only write, or
   coexist (Option δ)?** Recommendation is replace. If the user wants a
   separate "just mark it transplanted without picking a cell" action
   preserved, that's Option δ and needs a second button in the banner.

5. **Destination bed mismatch.** `transplantMode.bedName` comes from
   the IndoorSeedStart's `destinationBedDetails[0]`
   (`GardenDesigner.tsx:462-464`). If the user is currently looking at
   a different bed in the designer when cell-picker mode engages,
   should Stage 1:
   - (a) auto-navigate to the destination bed, or
   - (b) restrict the cell picker to the destination bed only and warn
     if user clicks elsewhere?
   Option (a) matches the existing auto-navigation at `App.tsx:534`
   (which already sets `designerBedId` on entry). Most likely a no-op
   in practice but worth deciding.

None of these are blocking for a code-only investigation; they are
decisions the implementer needs before they can ship.

---

## Appendix: code references

Frontend
- `frontend/src/components/IndoorSeedStarts.tsx:540` — `transplantActionLabel` branching, card entry.
- `frontend/src/components/IndoorSeedStarts.tsx:545-549` — `onNavigateToBed` call carrying `seedStartId`.
- `frontend/src/App.tsx:142, 507-508, 528-538` — `transplantSeedStartId` state, designer prop wiring, indoor-starts callback.
- `frontend/src/components/GardenDesigner.tsx:47` — component props including `transplantSeedStartId`.
- `frontend/src/components/GardenDesigner.tsx:133` — `transplantMode` state shape.
- `frontend/src/components/GardenDesigner.tsx:450-482` — Path A effect that fetches and stores the IndoorSeedStart.
- `frontend/src/components/GardenDesigner.tsx:484-513` — `executeMarkTransplanted` and `handleMarkTransplanted`.
- `frontend/src/components/GardenDesigner.tsx:2660-2686` — Path A banner UI.
- `frontend/src/components/GardenDesigner.tsx:3812-3815` — pre-ready confirm dialog.
- `frontend/src/components/GardenDesigner.tsx:1642-1655` — Path B drag-drop POST payload (no `indoorSeedStartId`).
- `frontend/src/components/GardenDesigner/types.ts:12-13` — prop types for `transplantSeedStartId` / `onTransplantComplete`.

Backend
- `backend/models.py:100-151` — `PlantedItem` (no `indoor_seed_start_id` column).
- `backend/models.py:1053` — `IndoorSeedStart` class header.
- `backend/models.py:1348, 1396` — `GardenPlanItem.indoor_seed_start_id` (precedent for FK).
- `backend/blueprints/gardens_bp.py:69-114` — `_find_existing_indoor_seed_start` heuristic.
- `backend/blueprints/gardens_bp.py:117-142` — `_link_existing_indoor_seed_start` helper.
- `backend/blueprints/gardens_bp.py:145-238` — `_auto_create_indoor_seed_start` helper.
- `backend/blueprints/gardens_bp.py:400-567` — `add_planted_item` POST route.
- `backend/blueprints/gardens_bp.py:441-448` — `sourcePlanItemId` validation pattern to mirror.
- `backend/blueprints/gardens_bp.py:521-532` — existing heuristic call site for Path B.
- `backend/blueprints/gardens_bp.py:800-846` — batch equivalent.
- `backend/blueprints/utilities_bp.py:125, 172, 883, 1003` — where `indoor_seed_start_id` is written on GardenPlanItem (import-from-starts paths).
- `backend/migrations/versions/b4d826b4780f_add_source_and_indoor_seed_start_id_to_.py` — precedent migration for adding an IndoorSeedStart FK.

Tests
- `backend/tests/test_placement_indoor_start_dedup.py` — existing coverage for `_find_existing_indoor_seed_start`.
- `backend/tests/test_indoor_seed_start_delete_cascade.py` — existing coverage for the GardenPlanItem linkage.

Prior handoff docs
- `dev/active/production-readiness-audit/audit-013-developer-handoff.md`
- `dev/active/production-readiness-audit/indoor-start-specific-placement-followup.md`
- `dev/active/production-readiness-audit/indoor-start-banner-summary.md`
- `dev/active/production-readiness-audit/developer-issue-log.md` AUDIT-013
