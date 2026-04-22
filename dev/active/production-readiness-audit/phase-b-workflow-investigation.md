# Phase B Workflow Investigation (2026-04-22)

Diagnostic for findings #3, #7, #8, #11. No code modified.

Scope: planner -> indoor starts -> designer lifecycle. Read-only investigation; proposed fix shapes only.

---

## Finding #3 — Create Plan workflow clarity

- **Root cause**: `handleCreatePlan` creates the plan via POST and then **closes the modal and stays on the plan-list view**. It never calls `setView('create')` or otherwise enters the wizard. The user ends up back on the list with a new card and has to pick one of five buttons (Work, Set Active, Edit, View, Delete) to continue. By contrast `handleEditPlan` and `handleDuplicatePlan` both call `setView('create')` to enter the wizard.
- **Code references**:
  - `frontend/src/components/GardenPlanner.tsx:1373-1394` — `handleCreatePlan` (awaits `loadPlans()`, `setShowCreatePlanModal(false)`, `setNewPlanName('')`; NO view change).
  - `frontend/src/components/GardenPlanner.tsx:1442` — `handleEditPlan` ends with `setView('create')`.
  - `frontend/src/components/GardenPlanner.tsx:1494-1495` — `handleDuplicatePlan` ends with `setView('create'); setStep(1);`.
  - `frontend/src/components/GardenPlanner.tsx:1800` — the "Create Plan" button wired to `setShowCreatePlanModal(true)`.
  - `frontend/src/components/GardenPlanner.tsx:1818-1860` — the list card renders five buttons per plan: `Work`, `Set Active`, `Edit`, `View`, `Delete`. `Work` and `Edit` both call `handleEditPlan(plan)` (same handler). The label disambiguation ("Work" vs "Edit") is purely visual — no behavioral difference.
- **Isolated or shared**: Isolated. This is purely a post-create navigation miss in `handleCreatePlan`. Unrelated to #7/#8 data-resolution issues and unrelated to #11.
- **Proposed fix shape** (any one of these; preference A):
  - (A) After `loadPlans()` in `handleCreatePlan` (line 1387-1389), locate the newly-created plan by id from the POST response and emulate `handleEditPlan` (reconstruct empty wizard state, `setView('create'); setStep(1); setEditingPlanId(newPlan.id); setEditingPlanName(name); setPlanName(name);`). The create response already returns the plan object; use it directly rather than re-fetching via `handleEditPlan`.
  - (B) Additionally collapse the redundant `Work` button since it is a duplicate of `Edit` (same handler). Either drop `Work` or rename `Edit` to something else (`Configure`) — but do NOT ship both.
  - (C) Optional: change the "Create Plan" flow to skip the name-only modal entirely and take the user straight into the wizard with a default name (`${year} Garden Plan`) pre-filled in the wizard's Plan Name field at `GardenPlanner.tsx:3029`. This mirrors how Duplicate works and removes one modal roundtrip.
- **Scope estimate**: small (roughly 15–25 lines in one file, plus optional button cleanup).
- **Recommended specialist**: frontend-debugger.

---

## Finding #7 — Indoor Starts action inconsistency

- **Root cause**: The "Transplant Now" button is rendered conditionally on `start.destinationBedDetails.length > 0`. Lettuce's card resolved to at least one destination bed so the button appeared; tomato's card did not, so the button was suppressed. This is NOT a separate gate — it is the same `destinationBedDetails` array that drives finding #8.
- **Code references**:
  - `frontend/src/components/IndoorSeedStarts.tsx:534-550` — "Transplant Now" button, gated on `start.status !== 'transplanted' && start.status !== 'failed' && start.destinationBedDetails && start.destinationBedDetails.length > 0 && onNavigateToBed`.
  - `frontend/src/components/IndoorSeedStarts.tsx:502-529` — "Destination:" row, rendered only when `destinationBedDetails.length > 0` (primary branch) or `destinationBeds.length > 0` (legacy fallback branch). When both are empty the label is hidden with no placeholder.
  - Source of the field: `backend/models.py:1212-1218`, `1277-1278` — `destinationBedDetails` is built inside `IndoorSeedStart.get_current_garden_plan_count()` and returned in `to_dict()`.
- **Isolated or shared**: **Shared with #8** — confirmed below under "Root-cause clustering". Both findings collapse to a single fix on how destination beds are resolved for indoor starts.
- **Proposed fix shape**: Fix #8 (see below). Once the bed resolver reliably produces a non-empty `destinationBedDetails` for imports that have bed data upstream, the button returns for tomato automatically. If the product decision is "sometimes there genuinely is no destination yet", also render a disabled/ghost "Transplant Now" button with a tooltip explaining why (e.g., "Assign a destination bed first") so the card is visibly consistent across rows.
- **Scope estimate**: trivial once #8 is fixed (no extra code). If we also add the disabled-button affordance: small (5-10 lines in `IndoorSeedStarts.tsx` card body).
- **Recommended specialist**: resolves with #8 — see below.

---

## Finding #8 — Destination assignment inconsistency

- **Root cause**: `IndoorSeedStart.get_current_garden_plan_count()` resolves `destinationBedDetails` through a three-tier priority chain, and for indoor starts imported via **Import from Garden Plan** none of the first two tiers fires:
  1. **Manual override** (`destination_bed_ids` column) — only set if the user passed `destinationBedIds` to the create endpoints. The Import-from-garden-plan modal does **NOT** pass this field (`frontend/src/components/IndoorSeedStarts/ImportFromGardenModal.tsx:126-134` — only `plantingEventId, plantId, variety, transplantDate, desiredQuantity, location, notes`). Likewise the from-planting-event endpoint does not write `destination_bed_ids` (`backend/blueprints/utilities_bp.py:1365-1381` — no `destination_bed_ids` kwarg).
  2. **PlantingEvent match** — joins on `plant_id + variety + transplant_date ∈ [expected_transplant_date ± 1 day]`, then **explicitly excludes `self.planting_event_id`** (the linked event). For an indoor start imported from a single planting event, the linked event is excluded and there are typically no other events for that plant+variety at the same transplant date — so the match set is empty.
  3. **GardenPlanItem fallback** (`bed_assignments`) — runs only when tiers 1 and 2 produced zero beds. Matches `plant_id + variety` and filters by `first_plant_date` within ±30 days of `expected_transplant_date`, OR `first_plant_date <= tp+30 AND last_plant_date >= tp-30`.

  In Probe 3 the tester imported both lettuce and tomato from the Probe 2 plan. The observable split between lettuce and tomato is most likely one of:
  - (a) **Tomato's `GardenPlanItem.bed_assignments` was empty/null in the Probe 2 plan** (tester allocated lettuce to a bed in the wizard step 3 but skipped tomato, or tomato's bed column was nullable in the fixture path). Lettuce had a valid `bed_assignments` blob so tier 3 returned beds; tomato had nothing so `destinationBedDetails` is `[]`.
  - (b) **Date window miss**: tomato's `first_plant_date` is more than 30 days from its indoor-start `expected_transplant_date`. Lettuce (succession crop with a wide `first_plant_date..last_plant_date` window) satisfied the second OR-branch of the window filter while tomato (single-planting crop) did not. Inspection of the ±30 day window vs. `weeksIndoors` offset is the key diagnostic here — if `weeksIndoors` for tomato pushes the expected_transplant_date well past `first_plant_date + 30d`, the OR-branch requiring `last_plant_date` kicks in, but `last_plant_date` may be null for a single-planting crop.
  - (c) **Variety mismatch**: indoor start stored `variety = 'XYZ'` but `GardenPlanItem.variety` is null (or vice versa). The query treats `NULL == NULL` specially (`if self.variety is None: plan_variety_filter = GardenPlanItem.variety.is_(None) else: variety == self.variety`) — a one-sided variety will miss.

  Without the fixture DB in hand I cannot pick (a) vs (b) vs (c), but the architectural hole is the same: `destination_bed_ids` is NEVER written during import, so tiers 1 and 2 are structurally unreachable, and tier 3 depends on plan-item shape that smoke fixtures can easily violate.
- **Code references**:
  - `backend/models.py:1105-1242` — full `get_current_garden_plan_count()` method, including the three-tier resolution.
  - `backend/models.py:1121-1133` — variety+transplant_date ±1 day filter on `PlantingEvent`.
  - `backend/models.py:1137-1138` — self-link exclusion (`PlantingEvent.id != self.planting_event_id`) — the key reason tier 2 empties out for imports.
  - `backend/models.py:1156-1158` — "if not manual_override" gate that lets tier 2 run.
  - `backend/models.py:1163-1210` — tier 3 fallback with ±30 day window on `first_plant_date`/`last_plant_date`.
  - `backend/blueprints/utilities_bp.py:1308-1402` — `/api/indoor-seed-starts/from-planting-event` endpoint; does NOT accept or write `destinationBedIds` (compare line 798-802 in the sibling endpoint above, which does).
  - `frontend/src/components/IndoorSeedStarts/ImportFromGardenModal.tsx:126-134` — the import payload omits `destinationBedIds`.
- **Isolated or shared**: **Shared with #7**. One root cause, two symptoms.
- **Proposed fix shape**:
  1. **Primary (backend + frontend, 1 endpoint, 1 modal)**: Write `destination_bed_ids` at import time. In `ImportFromGardenModal.tsx`, when building the payload, look up the matching `GardenPlanItem.bedAssignments` for the event's `plantId + variety` and include the resolved `bedId` list as `destinationBedIds`. Extend `/api/indoor-seed-starts/from-planting-event` to accept and persist `destination_bed_ids` (analogous to the existing handling at `utilities_bp.py:798-802`). This makes tier 1 (manual override) the authoritative source for imports and sidesteps tier-2/tier-3 flakiness entirely.
  2. **Secondary (backend only, hardens tier 2)**: Drop the `PlantingEvent.id != self.planting_event_id` exclusion at `models.py:1137-1138`, OR change it to "include the linked event's `garden_bed_id` if set, but do not count its `quantity` toward the current_count". The exclusion was meant to prevent double-counting plants, but it also blinds the bed-resolution query. Splitting the two concerns (counting vs bed-resolution) lets the linked event contribute its `garden_bed_id` without inflating counts.
  3. **Tertiary (backend, widen tier 3)**: When `last_plant_date` is null, treat tier-3 match as succeeding when `first_plant_date` is any date **before** `expected_transplant_date` (single-plant crops have no window — any plan item for this crop+variety in the same user's plan should be eligible if no bed has been resolved yet). Current logic requires `first_plant_date` within ±30 days or a non-null `last_plant_date` — that is too strict.
  4. **UI safety net**: In `IndoorSeedStarts.tsx:502-529`, render an explicit "Destination: not assigned" line with a small "Assign bed" button when `destinationBedDetails.length === 0`. This eliminates the silent/hidden state the tester saw. Pair it with a disabled "Transplant Now" button + tooltip so row layout is consistent.
- **Scope estimate**: medium. Primary fix touches two files (`ImportFromGardenModal.tsx`, `utilities_bp.py`) plus possibly `models.py` if we want to pre-resolve bedAssignments on the backend side for the import call. UI safety net is +15 lines in `IndoorSeedStarts.tsx`.
- **Recommended specialist**: cross-stack. backend-debugger owns the endpoint/model work (tiers 1-3 + exclusion split); frontend-debugger owns the import-modal payload change and the UI safety net. PM should split these into a two-branch delegation.

---

## Finding #11 — Plan duplicate naming

- **Root cause**: `handleDuplicatePlan` pre-fills the new plan name as `` `${fullPlan.name} (Copy)` `` and enters the wizard at **step 1 (Select Seeds)**. The Plan Name input field only exists on the wizard's final Save step (around `GardenPlanner.tsx:3029`). Between step 1 and save the user has no visible rename control, and the new name doesn't appear in any header/breadcrumb. The smoke tester's recollection of "original name plus `-copy`" is close: the actual suffix is `" (Copy)"` (capital C, parenthesized, with a leading space — `GardenPlanner.tsx:1491`). Tester's point is still correct: there is no prompt or obvious inline rename control. There is no backend duplicate endpoint — the clone is entirely a frontend reconstruction, which means the "new plan" doesn't actually exist as a DB row until the user completes the wizard and clicks Save, which only then reveals the Plan Name field.
- **Code references**:
  - `frontend/src/components/GardenPlanner.tsx:1457-1506` — `handleDuplicatePlan`. Line 1491 sets name with `(Copy)` suffix. Line 1494-1495 enters wizard at step 1.
  - `frontend/src/components/GardenPlanner.tsx:3029` — the only Plan Name input, on the Save step.
  - `frontend/src/components/GardenPlanner.tsx:3200-3206` — the Duplicate button, which only exists on the plan-detail view (not on the plan-list cards).
  - Backend: grep over `backend/blueprints/garden_planner_bp.py` finds no `duplicate` endpoint — there is no POST /api/garden-plans/:id/duplicate. Duplicate is a pure frontend reconstruct-and-save-as-new flow.
- **Isolated or shared**: Isolated. Unrelated to #7/#8 destination-resolution and unrelated to #3 post-create nav (though it's a close cousin of #3 in that both stem from "wizard Plan Name field is buried on step 3").
- **Proposed fix shape** (any of these; preference A):
  - (A) **Modal prompt on Duplicate**: before calling `handleDuplicatePlan`, open a small name-prompt modal (reuse the shape of the Create Plan modal at `GardenPlanner.tsx:1876-1900`) pre-filled with `"${plan.name} (Copy)"`. User confirms → then call the duplicate flow with the chosen name. Small, surgical, mirrors the Create flow.
  - (B) **Inline rename in wizard**: surface the Plan Name input on step 1 of the wizard (always visible, not just at save). This also benefits #3 and the normal edit flow — users can rename at any step. Medium-scope: moves or duplicates the input field, threads state through.
  - (C) **Both A and B**: A gives a clear explicit rename moment at the point of intent; B ensures the name is always visible/editable during the wizard journey. Small combined cost; this is probably the user's intuitive expectation.
- **Scope estimate**: small (A alone, maybe 40 lines) to medium (A + B, maybe 70 lines).
- **Recommended specialist**: frontend-debugger.

---

## Root-cause clustering

### #7 + #8 — shared root cause: **YES, confirmed**

Evidence:
- The same array — `destinationBedDetails` — gates both the "Destination:" row (`IndoorSeedStarts.tsx:502-529`) and the "Transplant Now" button (`IndoorSeedStarts.tsx:534-550`). When the array is empty, both UI elements disappear together. When it is populated, both appear together.
- The only source of `destinationBedDetails` is `IndoorSeedStart.get_current_garden_plan_count()` at `backend/models.py:1212-1218`, surfaced via `to_dict()` at line 1278.
- The Import-from-Garden-Plan modal path cannot populate tier 1 (manual override) because it never sends `destinationBedIds` to the backend, and cannot reliably populate tier 2 because the query explicitly excludes the linked `planting_event_id`. Tier 3 is the only fallback and is sensitive to plan-item shape (variety symmetry, `first_plant_date`/`last_plant_date` window, presence of `bed_assignments`).

Fixing the resolver (primary fix, plus hardening and UI safety net) fixes both findings in one stroke. #7 does not need a separate fix.

### #3 — independent

Distinct from #7/#8 (different screen, different data path, different file). Distinct from #11 (different handler, different flow — create-new vs duplicate). Pure navigation miss in `handleCreatePlan`.

### #11 — independent

Distinct from #7/#8 (different screen). Shares a **philosophical** cousin with #3: both reveal that the wizard's Plan Name input at step 3 is a problematic design when the entry point to the wizard is a flow that implies a new name. They are still two separate handlers and can be fixed independently — but if we pick option (B) for #11 (surface Plan Name at step 1), it also cleans up a papercut in the edit and create flows.

---

## Recommended execution plan

Parallelizable into two branches. Do the investigation-driven work on the indoor-starts cluster first (it's the largest in scope and the most user-visible gap), and the two small frontend touches concurrently.

1. **Branch A — indoor-starts destination resolver (#7 + #8)**. Cross-stack, PM-led.
   - A1 (backend-debugger): extend `/api/indoor-seed-starts/from-planting-event` to accept and persist `destinationBedIds`. Optional hardening: split the tier-2 exclusion into "exclude from count, include for bed-resolution". Optional tier-3 widening for null `last_plant_date`.
   - A2 (frontend-debugger): in `ImportFromGardenModal`, resolve matching `GardenPlanItem.bedAssignments` for each event and include the bedId list in the payload. Add the UI safety net in `IndoorSeedStarts.tsx` for the no-destination case.
   - A3 (test-engineer, after A1+A2): regression tests for destination resolution across the three import paths (with/without bedAssignments, with/without variety, single vs succession crops). Existing test pattern likely in `backend/tests/` for IndoorSeedStart to_dict().
2. **Branch B — Create Plan navigation (#3)**. Frontend-only.
   - Fix `handleCreatePlan` to enter the wizard after create. Remove or rename the redundant `Work` button.
3. **Branch C — Duplicate naming (#11)**. Frontend-only.
   - Option A (name-prompt modal) is the minimum viable fix. Combine with Option B (surface Plan Name on wizard step 1) if scope allows; the two changes compose cleanly.

Branches B and C can run in parallel with Branch A. Suggested order of merge: B → C → A (A is largest and most worth landing last after the smaller improvements stabilize).

---

## Open questions for the user

1. **For #8 fix (A):** Should we pull `bedAssignments` resolution into the **backend** import endpoint (backend looks up the event's plan item and writes `destination_bed_ids` automatically when creating the seed start), or keep it as a **frontend** concern (the modal queries plan items and passes `destinationBedIds` in the payload)? Backend is more robust (future import callers get the behavior for free); frontend is smaller-diff. Recommend backend.
2. **For #8 tier-2 split:** Removing the `planting_event_id` self-exclusion could inflate `currentCount` by double-counting the linked event's quantity. My proposal is to split exclusion by concern (exclude from count, include for bed-resolution). Do you prefer that, or a simpler "always include, accept minor count inflation as the cost of reliability"?
3. **For #8 UI safety net:** When `destinationBedDetails` is empty, should the card offer an "Assign destination bed" inline picker, or just a status badge ("No destination assigned — edit to set")? The former is higher-value but +40 lines.
4. **For #3:** Do you want the middle-modal step removed entirely (jump straight into the wizard with a default name) or kept as a name-first step that also navigates into the wizard? Either is fine; the current "modal then back to list" is the broken shape.
5. **For #3 button cleanup:** Is the `Work` button meant to be distinct from `Edit` in some future sense (e.g., opening a "working view" vs the wizard)? Currently they are identical. I'd drop `Work`, but confirm it isn't a reserved slot for a future feature.
6. **For #11:** Confirm preference between modal prompt (A), inline rename on step 1 (B), or both. Option B has the broader impact (helps #3 too) but is larger scope.
