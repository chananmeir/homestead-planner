# Future Placement Reservation — Product Model Analysis (2026-04-23)

Structured analysis of the question raised in
`future-placement-reservation-gap.md`. Persisted per the standing rule.

This is a **product-model decision**, not a defect. AUDIT-013 shipped
Option α (cell-picker + atomic status advance) per the explicit user
greenlight in `audit-013-implementation-decision.md`. The retest's
finding is that Option α does not resolve a **different** workflow —
the one deferred as Option B in
`audit-013-investigation.md` §4 — which is future-placement reservation
without immediate transplant-status advance.

---

## The gap stated plainly

There is currently no data shape for:

> "This cell in Bed A is reserved for basil start #42, which I will
> transplant when it's actually ready."

Every bed-cell-level write today is a placement commit:

- `PlantedItem` = a plant **placed** in a cell (status ∈
  `planned`/`seeded`/`transplanted`/`growing`/`harvested`/`saving-seed`
  — but the lifecycle is a plant that physically exists in the bed).
- `PlantingEvent` = a scheduled event with dates but **no cell
  position**.
- `IndoorSeedStart` = pre-transplant growth log with a **destination
  bed** but **no cell**.

So today the user can:
- assign a bed (via `destination_bed_ids` on `IndoorSeedStart`)
- pick a cell AND advance status simultaneously (AUDIT-013 path)

But cannot:
- pick a cell AND defer the status advance (reserve)

---

## Two candidate product models

### Model 1 — "Placement means transplant now"

Exact cell selection always advances `IndoorSeedStart.status → 'transplanted'`. There is no "future placement" concept at the cell level; cell reservations live in the user's head (or on paper) until the plant is physically ready.

- **Mental model**: "Indoor Starts = the plant as it grows indoors.
  The bed cell is only chosen at actual transplant time."
- **Upside**: simpler data model. No new state, no new lifecycle. What
  shipped yesterday is the final shape.
- **Downside**: users can't pre-plan exact layouts the way they can
  pre-plan beds. A gardener looking at a 4×4 bed and deciding which
  two cells each crop gets must either commit the transplant early
  (wrong data) or rely on external tools.
- **Scope**: zero additional work. Document this as the intended model;
  close the retest finding as "by design".

### Model 2 — "Placement can be a future reservation"

Introduce a **reserved-position** primitive. Clicking a cell during
`Plan Placement` stores `(IndoorSeedStart.id, bed_id, cell_x, cell_y)`
but does NOT advance status. When the start reaches `hardening`, a
confirm flow promotes the reservation to an actual placement +
transplant.

- **Mental model**: "Indoor Starts = the plant + a future spot in the
  bed. Transplanting is the promotion event."
- **Upside**: matches the user's natural planning workflow. Lets users
  design full-bed layouts in advance. Cells display reserved plants
  on the grid with a different visual state.
- **Downside**: new schema + new rendering + new lifecycle. Needs:
  - New model or columns: `IndoorSeedStart.reserved_bed_id`,
    `IndoorSeedStart.reserved_position_x`, `.reserved_position_y`
    (simplest); OR a new `ReservedCell` row.
  - Backend validation: reserved cells must be unique per bed, must
    not overlap existing PlantedItems, must not collide with other
    reservations.
  - GardenDesigner render: reserved cells show as ghost / placeholder,
    distinct from placed plants. Click behavior in designer when a
    cell already holds a reservation.
  - Promotion flow: when user marks a start transplanted, the reserved
    position becomes a real PlantedItem at the same cell. Today's
    cell-picker flow becomes the promotion path.
  - Migration: backfill existing IndoorSeedStarts to reservation-null.
  - Cross-domain surface: Indoor Starts card could now show
    "Reserved: Bed A, row 2 col 3" as a concrete position rather than
    the current vague "Destination: Bed A".

### Model 3 (hybrid, worth naming) — "Placement is implicitly future until user says transplant"

Soft version of Model 2: reuse `PlantedItem` at the reserved cell, add
a `PlantedItem.is_reservation: boolean` flag. When user promotes, the
flag clears and the IndoorSeedStart advances to transplanted.

- **Upside**: no new model; reuses existing rendering and conflict
  detection with minor branching.
- **Downside**: overloads `PlantedItem` semantics. `is_reservation`
  items must be excluded from yield/harvest/rotation views unless
  you want reserved-but-not-transplanted plants counted. Every query
  that reads PlantedItems becomes `status != 'reserved'`-aware.
- Effectively Model 2 with less structural purity, possibly worse
  long-term maintenance.

---

## What AUDIT-013 left on the table

From `audit-013-investigation.md` §4:

> **Option B — Separate "Plan Placement" action**
> Pre-ready: "Plan Placement" button navigates to designer to select
> the future cell position, but does NOT advance status / does NOT
> create PlantedItem. The reserved position is stored on the
> IndoorSeedStart itself.

That is exactly Model 2 as proposed above. The user at the time chose
Option α (confirm-gated atomic write) over Option B for scope reasons.
This finding is Option B asking to be reconsidered — now framed as a
real product gap rather than a smaller alternative.

---

## Scope estimate if Model 2 is chosen

**Backend** (~200-300 LOC + migration):
- Migration to add `reserved_bed_id`, `reserved_position_x`,
  `reserved_position_y` columns on `IndoorSeedStart` (nullable).
- New endpoint (or extend existing): `POST /api/indoor-seed-starts/:id/reserve-position`
  accepting `{bedId, positionX, positionY}`, validating bed ownership +
  cell availability + collision.
- Removal / adjustment of the AUDIT-013 atomic-write behavior when
  user is in "reserve, don't transplant" mode.
- Promotion path: when `PUT /api/indoor-seed-starts/:id { status:
  'transplanted' }` fires, the current reserved-position (if any)
  becomes the PlantedItem. Collision check at promotion time.
- Conflict detection: reserved cells participate in the existing
  overlap/conflict queries or have their own.

**Frontend** (~300-500 LOC):
- GardenDesigner grid rendering of reserved cells (ghost/placeholder
  styling, distinct icon, "Reserved: basil #42" tooltip).
- Cell-picker mode splits into two modes: "Reserve placement" (no
  transplant) vs "Transplant now" (atomic). Banner buttons branch.
- IndoorSeedStarts card shows reserved position + bed.
- Promotion UI when user eventually marks ready — what happens if
  another plant got placed on the reserved cell in the interim? Needs
  UX for collision resolution.

**Tests**:
- Backend: reserve endpoint validation, collision cases, promotion path,
  user isolation.
- Frontend: coverage gap persists; likely still no Jest harness.

**Stage-1 smallest cut of Model 2**:
- Backend: columns + reserve endpoint + reservation listing (no
  promotion path yet, no conflict detection — reservations can
  shadow/be shadowed by PlantedItems in Stage 1).
- Frontend: minimal — basic ghost rendering, simple reserve button on
  the card, no promotion UX.
- Still a substantial pass (~150-200 LOC minimum).

---

## Recommendation

**I don't pick this decision.** It's a product-model call, not a code
choice.

What I can say with confidence:

- Model 1 is already shipped. If that's the intended model, close the
  finding as "by design" and move on.
- Model 2 is a real product feature requiring a new schema, new
  rendering, new promotion flow. Non-trivial scope.
- Model 3 exists as a hybrid but probably shouldn't be chosen — it
  earns Model 2's complexity with Model 1's semantic muddle.
- The gap exists and the retest finding is valid — but whether it's
  worth the scope of Model 2 is a product judgment about how closely
  the app should model the user's in-head pre-transplant planning.

Questions that might help the user decide:

1. When you plan a full-bed layout on paper before the season, do you
   decide exact cells for each crop at that time?
2. If so, do you want the app to mirror that planning, or is "bed
   assigned + cell at transplant time" accurate enough?
3. How often do layouts change between planning and transplant? If
   frequently, a reservation that locks too early may be friction.
4. Are there other scenarios (e.g., multi-user gardens, shared plans,
   printouts) where a cell-level plan ahead of transplant would pay off?

---

## Awaiting user

- Decide Model 1 (close finding as by-design) vs Model 2 (dispatch
  investigation + scoping pass for reservation primitive) vs Model 3
  (not recommended) vs another option.
- If Model 2: I'll dispatch a fresh investigation agent to scope the
  schema + endpoints + UI in detail, then an implementation pass. This
  would be a multi-step workstream, not a single commit.
