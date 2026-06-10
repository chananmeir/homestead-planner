# Indoor Start Pending Placement Not Visible in Destination Bed — Finding

**Date:** 2026-05-12
**Reporter:** User screenshots `walthama.JPG`, `waltham.JPG` (paths under `C:\Users\march\Downloads\`)
**Priority:** P1 (workflow confusion, repeat report of a known by-design gap)
**Status:** R6 implemented (header placement pill on seed-start cards). R1–R4 deferred per user direction.

## Resolution (2026-05-12)

User clarified: the fix should make it obvious **on each Indoor Seed Starts
card** whether the start currently has a spot in the garden or not. Confirmed
"has a spot" means a specific cell in a specific bed (i.e.,
`status === 'transplanted'` per Model 1). Destination-bed-only is not a spot.

**Implemented:**
- `frontend/src/components/IndoorSeedStarts.tsx` — new `getPlacementPill()` helper + header pill rendered next to the existing status badge.
  - `status === 'transplanted'` → green pill **"✓ has spot"** (with `iss-placement-pill-{id}` testid).
  - `status === 'failed'` → no pill.
  - Everything else (`planned`/`seeded`/`germinating`/`growing`/`hardening`) → amber pill **"⚠ no spot"** with a tooltip that points the user at "Plan Placement".
- `frontend/src/components/__tests__/IndoorSeedStarts.placementPill.test.tsx` — 9 new tests covering each status, no-bed case, failed-status suppression, and pill+banner coexistence on transplanted.
- All 33 IndoorSeedStarts Jest tests pass.

**Not implemented (per user direction):**
- R1 Model 2 (cell-level reservation) — still deferred per April decision.
- R2 "Pending placements" sidebar on bed view — superseded by R6 (clearer affordance lives on the card, where user expected it).
- R3 banner CTA copy tweak — not needed; pill on the card now signals state up-front.
- R4 grid-level pending ghost — not needed; the card pill closes the loop without grid changes.

The original "Open question" about the `date=2026-06-16` vs "June 9" mismatch
was not resolved — it remains worth verifying with the user but does not block
the primary fix.

---

## Summary

User reports: the Indoor Seed Starts card for *Broccoli (Waltham)* explicitly says
`Planned bed: SFG Bed 2` and `Transplant on: June 9, 2026`. When the user clicks
**Plan Placement** and lands in the Garden Designer for SFG Bed 2, the
"Plants in SFG Bed 2" sidebar does not contain Broccoli (Waltham). To the user
this reads as an inconsistency: *"the app told me this plant is in this bed,
but the bed doesn't show it."*

This is not a data corruption bug. It is the same product-model gap previously
documented in `future-placement-reservation-gap.md` /
`future-placement-reservation-analysis.md` / `future-placement-reservation-decision.md`
surfacing again from a different entry point. The team's prior decision was to
ship **Model 1 ("Placement means transplant now")** and treat the gap as
by-design. The user is hitting the friction that decision left behind.

There is also a **secondary anomaly** worth verifying: the designer URL in
`walthama.JPG` is `date=2026-06-16` while the seed-start card displays
"Transplant on: June 9, 2026". Both values are read from the same backend field
(`expectedTransplantDate`), so they should never disagree. See "Open question"
below.

---

## Evidence

### Screenshot 1 — `walthama.JPG` (Garden Designer, SFG Bed 2)

- URL: `localhost:3000/?tab=designer&group=design&bedId=38&date=2026-06-16&seedStartId=154`
- Top banner: *"Planning placement for Broccoli (Waltham) → SFG Bed 2"* with
  buttons `Pick cell in SFG Bed 2` and `Cancel`.
- "Plants in SFG Bed 2" sidebar (date 2026-06-16): 10 entries
  (Collard Greens, Swiss Chard, Lettuce, Kale, Spinach, Cucumber, Corn, Carrot,
  Beet, Bean). **No Broccoli (Waltham).**
- "Future Plantings Visible: 539 scheduled plantings from calendar" banner is
  ON.

### Screenshot 2 — `waltham.JPG` (Indoor Seed Starts)

- URL: `localhost:3000/?tab=indoor-starts&group=grow&plantingEvents=5887`
- Broccoli (Waltham) card:
  - Started 5/12/2026, 3 seeds
  - Expected germination 5/17/2026
  - Transplant on **June 9, 2026**
  - Current location: windowsill
  - Planned bed: **SFG Bed 2**
  - Status: `planned`

---

## Root cause (workflow gap, not data corruption)

The Garden Designer's "Plants in [bed]" sidebar is sourced exclusively from
**`PlantedItem`** rows. An `IndoorSeedStart` with `status='planned'` has no
`PlantedItem` yet — nothing has been "placed in the bed" yet. The user is
mid-flow: the placement banner is asking them to click *"Pick cell in SFG Bed
2"* and then click a grid cell, which is the step that finally creates the
`PlantedItem`.

The three primary visual surfaces on the bed view, and why each excludes the
Broccoli (Waltham):

| Surface | Source | Filter | Why Broccoli (Waltham) is missing |
|---|---|---|---|
| "Plants in SFG Bed 2" sidebar | `bed.plantedItems` (PlantedItem) | `isPlantedItemActiveOnDate()` | No PlantedItem exists yet |
| Future Plantings overlay (grid) | `/api/planting-events?start_date=…` (PlantingEvent) | `event.positionX != null && event.positionY != null` (`GardenDesigner.tsx:742`) | Linked PlantingEvent (likely id=5887) has no cell position yet |
| Planned Plants section (sidebar) | `GardenPlanItem` for the active plan | Filters by `planId` + `bedId` | Only shows if a `GardenPlanItem` for SFG Bed 2 exists; an ad-hoc indoor start created outside the season plan won't appear |

This is exactly the architectural asymmetry recorded in
`MEMORY.md → "PlantingEvent ↔ IndoorSeedStart Asymmetry (Apr 2026)"` and the
"future exact placement reservation" gap previously analyzed.

### Pointers into the code

- `frontend/src/components/IndoorSeedStarts.tsx:1198-1204` — Plan Placement
  button passes `start.expectedTransplantDate` to `onNavigateToBed`.
- `frontend/src/App.tsx:811-819` — `onNavigateToBed` forwards to
  `openAppDestination`, which builds the URL via `buildAppDestinationUrl`
  (`App.tsx:288-311`).
- `frontend/src/components/GardenDesigner.tsx:475-479` — designer adopts the
  URL `date` param via `setDateFilter`.
- `frontend/src/components/GardenDesigner.tsx:3297-3404` — "Plants in [bed]"
  sidebar reads from `getActivePlantedItems(activeBed)` which is
  `bed.plantedItems || []`, filtered by `isPlantedItemActiveOnDate`.
- `frontend/src/components/GardenDesigner.tsx:739-742` — future-plantings
  overlay drops any PlantingEvent without `positionX`/`positionY`.
- `backend/models.py:1056-1101` — `IndoorSeedStart` has `destination_bed_ids`
  (planned bed) and `planting_event_id` (link after transplant), but **no
  reserved cell position fields**.

---

## Open question (verify with user)

The URL in `walthama.JPG` is `date=2026-06-16`, but the seed-start card in
`waltham.JPG` displays the transplant date as **June 9, 2026**. Both UI
locations read from the same field (`IndoorSeedStart.expected_transplant_date`
serialized to `expectedTransplantDate`), so they cannot disagree at source.

The most likely explanations, in decreasing order:

1. **User manually advanced the date picker after landing on the bed view.**
   The designer's date control was clicked from 2026-06-09 → 2026-06-16
   between landing and taking the screenshot. The URL is reactive (it gets
   updated when the date filter changes, see
   `GardenDesigner.tsx:662-666` → `updateDateFilterUrl`).
2. **`seedStartId=154` is a different Broccoli (Waltham) record than the card
   visible in screenshot 2.** Cards for two separate IndoorSeedStarts with
   different transplant dates would explain the divergence. Worth confirming
   by checking `GET /api/indoor-seed-starts/154` directly.
3. **A genuine deeplink bug** is unlikely given the same field powers both
   surfaces, but cannot be ruled out without server-side data.

**Action:** Please confirm with the user whether they manually changed the
designer's date filter, and/or what `GET /api/indoor-seed-starts/154` returns
for `expectedTransplantDate`. The primary finding (missing-from-bed) holds
regardless of which explanation is correct.

---

## Recommendations (in order of preference + scope)

### R1 — Re-evaluate Model 1 vs Model 2 with this report as fresh signal (P1, ~half-day decision)

The "future-placement-reservation" gap was deliberately deferred in April
(`future-placement-reservation-decision.md`). This is the second user-reported
surfacing of that same gap. Recommendation: ask the user whether they want
exact-cell future reservation now (Model 2 from
`future-placement-reservation-analysis.md`), or whether the cheaper UX-only
mitigations below (R2–R4) are enough.

If Model 2 is greenlit, scope is laid out in lines 124–161 of the analysis
doc (~200-300 LOC backend + ~300-500 LOC frontend + migration). Do not pick
Model 3 (hybrid) — the analysis flags it as worse-of-both.

### R2 — Add a "Pending placements" section to the bed sidebar (P1, ~half-day FE-only)

**File:** `frontend/src/components/GardenDesigner.tsx` (right sidebar
"Plants in [bed]" panel, currently `lines 3297-3404`).

**Change:** Above (or below) the "Plants in [bed]" list, render a "Pending
placements" subsection that enumerates:
- Any `IndoorSeedStart` whose `destinationBedDetails` contains the active
  bed AND `status ∈ {planned, seeded, germinating, growing, ready, hardening}`.
- Each row: plant icon, name + variety, transplant date, status pill, and a
  CTA button "Pick cell" that triggers the existing `transplantMode` flow.

**Data source:** `/api/indoor-seed-starts?destinationBedId=<bedId>&status_not=transplanted,failed,cancelled`.
A simple list endpoint already exists; if it doesn't accept a bed filter, add
the filter or filter client-side.

**Why this works without Model 2:** It does not introduce reserved-cell state.
It surfaces the existing "this start is planning to go here" metadata
(`destination_bed_ids`) directly in the bed where the user expects to see it.
Closes the "told me X is in this bed, but I don't see it" loop without new
schema.

### R3 — Strengthen the Plan Placement banner CTA (P2, ~2 hours FE-only)

**File:** `frontend/src/components/GardenDesigner.tsx:2947-2976`.

The banner currently says *"Planning placement for Broccoli (Waltham) → SFG
Bed 2"* with a small green "Pick cell in SFG Bed 2" button. From the
screenshot the banner can be easily skimmed past. Suggested tweaks:

- Make the CTA button bigger/pulsing on first render, OR add an explanatory
  sub-line: *"This seed start is not in the bed yet. Click 'Pick cell in SFG
  Bed 2' to choose its position."*
- Optionally render a translucent overlay on the grid prompting cell choice
  (mirrors `mcp__playwright`-style "click anywhere" affordance).

### R4 — Render pending-placement ghost cells on the grid (P2, ~half-day FE-only)

**File:** `frontend/src/components/GardenDesigner/FuturePlantingsOverlay.tsx`
+ `GardenDesigner.tsx:735-776` (`getFuturePlantingEventPositions`).

When in `transplantMode` with no cell chosen yet, render a non-positional
"pending" indicator on the bed (e.g., a banner strip at the bottom-left of
the grid: *"Broccoli (Waltham) is awaiting placement"*). This is purely visual
— no model change.

### R5 — Decline (do not implement)

If the team reaffirms the April Model 1 decision and considers
`future-placement-reservation-gap.md` final, document this finding as a known
limitation and link it from the user-facing release notes / help docs so
future reports can be triaged faster. The `indoor-start-pending-placement-...`
finding should still be filed, since the user-experience friction is real even
if the data model is "correct".

---

## Tests to add (whichever recommendation is taken)

- **R2 unit test:** `IndoorSeedStarts.tsx` already has card-rendering tests
  in `frontend/src/components/__tests__/`. Add a designer-sidebar test in
  `GardenDesigner/__tests__/` that mounts the designer with one `PlantedItem`
  in SFG Bed 2 + one `IndoorSeedStart` planned for SFG Bed 2 with
  `status='planned'`. Assert that the pending-placement entry renders with
  the seed start's plant name and a "Pick cell" CTA.
- **R3/R4 visual tests:** none beyond Playwright smoke — the banner is the
  existing AUDIT-013 surface.
- **R1 (Model 2) tests:** see `future-placement-reservation-analysis.md`
  §"Scope estimate" lines 150-154 for the test plan.

---

## Cross-references

- [`future-placement-reservation-gap.md`](future-placement-reservation-gap.md)
- [`future-placement-reservation-analysis.md`](future-placement-reservation-analysis.md)
- [`future-placement-reservation-decision.md`](future-placement-reservation-decision.md)
- [`indoor-start-auto-create-missing-planned-bed-finding.md`](indoor-start-auto-create-missing-planned-bed-finding.md)
  (sibling backend bug, already fixed)
- `MEMORY.md → "PlantingEvent ↔ IndoorSeedStart Asymmetry (Apr 2026)"`
- `audit-013-investigation.md` §4 "Option B" — the original framing of this
  workflow gap.
