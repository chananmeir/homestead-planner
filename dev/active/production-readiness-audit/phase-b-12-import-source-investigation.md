# Phase B #12 — Import Source Ambiguity Investigation (2026-04-22)

Read-only investigation. No code modified.

## Backend endpoint scope

- Endpoint: `GET /api/planting-events/needs-indoor-starts` at `backend/blueprints/gardens_bp.py:2442-2444`
- Query filter (verbatim from `backend/blueprints/gardens_bp.py:2459-2466`):
  ```python
  query = PlantingEvent.query.filter_by(user_id=current_user.id).filter(
      PlantingEvent.transplant_date.isnot(None),
      PlantingEvent.cancelled_at.is_(None)
  )
  if not include_past:
      query = query.filter(PlantingEvent.transplant_date >= get_utc_now())
  ```
- Additional filters (in-Python, post-query):
  - Plant must have `weeksIndoors > 0` (`gardens_bp.py:2478-2482`).
  - Drops groups that already have a non-cancelled linked `IndoorSeedStart` (`gardens_bp.py:2505-2517`).
- **Result: ALL plans for the user.** The only scoping is `user_id`. There is no `plan_id` query-param support, no implicit active-plan filter, and no join to `GardenPlan` or `GardenPlanItem`. Events from every plan the user has ever exported to the calendar (and has not cancelled or consumed) are returned together.

## Planting event → plan linkage

- `PlantingEvent` fields relevant to plan linkage (read from `backend/models.py:153-316`):
  - `succession_group_id` (string UUID, line 172) — links succession siblings, NOT to a plan.
  - `row_group_id` (string UUID, line 213) — links row segments, NOT to a plan.
  - `export_key` (string, line 238) — idempotency key.
  - **NO `source_plan_item_id`. NO `garden_plan_id`. NO `plan_item_id`.** MEMORY's claim is correct and still matches current code as of this branch.
- `GardenPlanItem` fields relevant (`backend/models.py:1348-1399`):
  - `garden_plan_id` (FK to `garden_plan.id`, line 1356) — the actual parent link.
  - `export_key` (line 1392) — idempotency key.
  - Reverse relationship: `source_plan_item.placed_items` via `PlantedItem.source_plan_item_id` (`models.py:122-132`). This is on **PlantedItem**, not **PlantingEvent**.
- **Actual linkage path PlantingEvent → GardenPlan**:
  - **Direct FK: none.**
  - **Indirect via `export_key` string parsing:** The export_key format built in `backend/services/garden_planner_service.py` encodes the plan item id as the second underscore-separated component:
    - `f"{user_id}_{item.id}_{plant_date.isoformat()}_{i}"` — legacy path, line 928
    - `f"{user_id}_{item.id}_{bed_id}_{plant_date.isoformat()}_{i}"` — bed-allocated path, line 867
    - `f"{user_id}_{item.id}_trellis_{trellis_id}_{plant_date.isoformat()}_{i}"` — trellis path, line 770
    - In all three, `item.id` is `GardenPlanItem.id`, and `GardenPlanItem.garden_plan_id` gets the plan.
  - **Caveat:** `export_key` is nullable (`PlantingEvent.export_key = db.Column(..., nullable=True)`, line 238). Events created by any path other than `export_to_calendar()` (e.g., hand-added events, legacy pre-Feb-2026 events, events created via direct POST `/api/planting-events`) will have `export_key = NULL` and cannot be attributed to any plan.
  - **Heuristic fallback (`user_id`, `plant_id`, `variety`, `garden_bed_id`):** unreliable — two plans can legitimately target the same crop+bed, and succession re-exports would collide.

## Frontend modal state

- Modal file: `frontend/src/components/IndoorSeedStarts/ImportFromGardenModal.tsx`
- Opens from: `frontend/src/components/IndoorSeedStarts.tsx:668-677` (rendered when `showImportModal` is true; opened via a button in the IndoorSeedStarts toolbar).
- Receives plan context via: **not at all.** The prop interface (`ImportFromGardenModal.tsx:25-31`) has only `isOpen`, `onClose`, `onSuccess`, `showSuccess`, `showError`. No `planId`, no `activePlan`, no `planName`.
- Fetch call (`ImportFromGardenModal.tsx:62`): `apiGet('/api/planting-events/needs-indoor-starts')` — no query params, no plan filter.
- Currently displays source plan: **no.** The header says literally `"Import from Garden Plan"` (line 358, hardcoded). Below it, the body reads `"Select planting events to create indoor seed starts for:"` (line 363-365) — no plan name anywhere.
- Would be trivial to add: **yes.**
  - `ActivePlanProvider` wraps the whole app at `frontend/src/App.tsx:610-612`, so `useActivePlan()` is available in any descendant.
  - `useActivePlan()` exposes `activePlan: GardenPlan | null` with `activePlan.name` and `activePlan.id` (`contexts/ActivePlanContext.tsx:162-173`).
  - Adding a header line and an optional query-param filter is a ~10-line change split across two files.
- Neither `IndoorSeedStarts.tsx` nor `ImportFromGardenModal.tsx` currently imports `useActivePlan` (verified by grep — no matches).

## Root cause (confirmed)

The modal advertises itself as importing "from Garden Plan" but the backend endpoint is cross-plan: it returns every non-cancelled future-transplant event for the user, aggregated across every plan the user has ever exported. When the reporter created a second plan with a 42-seed signature and activated it, exporting that plan to the calendar appended its events to the user's event pool — but the modal continued to show the union of events from the first plan AND the second plan (minus groups that already had indoor starts linked). The 42-seed rows were likely in there, but drowned in the other plan's rows and not highlighted as coming from the active plan.

There are two separable defects:

1. **Scoping defect (backend):** The endpoint has no notion of "active plan" or `?planId=…`. A user with N plans sees a merged list from all N. Even the bed/variety/transplant-date grouping at `gardens_bp.py:2486` (group key `(plant_id, variety, transplant_date_str)`) does not disambiguate which plan each row came from, and **will merge rows from different plans together** if they happen to share (plant, variety, transplant date). The `plantingEventIds` in such a merged group can legitimately span multiple plans — this is a silent data-smearing hazard worth noting even beyond the labeling fix.

2. **Labeling defect (frontend):** The modal has no source-plan header and no per-row plan attribution, so even if the user intellectually knows the list is cross-plan, they cannot tell which row came from which plan. The "Bed" column shown in the table (`ImportFromGardenModal.tsx:487-489`) is the only weak disambiguator, and beds are often shared across plans.

## Fix shape options

### Option A — Backend filter

- Change: Add optional `?planId=<id>` query param to `/api/planting-events/needs-indoor-starts`. When provided, join `PlantingEvent.export_key` against `GardenPlanItem.export_key` (or parse the second underscore component of `export_key` and join on `GardenPlanItem.id`), then filter by `GardenPlanItem.garden_plan_id = planId`. When omitted, fall back to current user-wide behavior (backward compatible). Optionally have the modal pass `useActivePlan().activePlanId` by default.
- Files: `backend/blueprints/gardens_bp.py` (endpoint), `frontend/src/components/IndoorSeedStarts/ImportFromGardenModal.tsx` (pass the param).
- Scope: **medium.** One new query param, one SQL join or subquery, one frontend call-site update. Plus: decide policy for events with `export_key = NULL` (likely: exclude when `planId` filter is active, since they cannot be attributed).
- Risk:
  - Legacy events with `export_key = NULL` will silently disappear from the filtered list — users with a pre-Feb-2026 plan may see fewer rows than they expect. Needs a UI signal ("N events could not be attributed to this plan — view all?").
  - Joining through `export_key` string requires either an exact-match index join (if we store it on `PlantingEvent` and `GardenPlanItem` consistently) or a parsed join on `GardenPlanItem.id` — the latter is fragile. Exact-match on `export_key` strings is cleaner and both sides already have indexes (`PlantingEvent.export_key` is indexed at `models.py:238`; `GardenPlanItem.export_key` at `models.py:1392` is not indexed — worth checking).
  - Does not fix the silent cross-plan merge in the grouping logic (`gardens_bp.py:2486`) unless the group key also includes plan id.

### Option B — Frontend labeling only

- Change:
  1. In `ImportFromGardenModal.tsx`, read `useActivePlan().activePlan` and render a header strip: `Importing events across all your plans. Active plan: "<name>"` (or similar honest copy).
  2. In the response payload, add `planName` / `planId` per row (requires tiny backend change to enrich rows via `export_key → GardenPlanItem → GardenPlan` lookup). Render "Plan" column in the table next to "Bed".
  3. Keep backend scope as-is (cross-plan) — but now the user can see which rows belong to which plan.
- Files: `backend/blueprints/gardens_bp.py` (enrich each row with `planId`/`planName`), `frontend/src/components/IndoorSeedStarts/ImportFromGardenModal.tsx` (header + column).
- Scope: **small-to-medium.** Header is trivial. Per-row enrichment requires one extra lookup per row in the endpoint — acceptable since the endpoint already does bed name enrichment at `gardens_bp.py:2519-2524`.
- Risk:
  - Rows with `export_key = NULL` will display "(no source plan)" — need to decide copy.
  - Does not prevent the silent cross-plan merge in the group key — two plans with the same (plant, variety, transplant date) will still collapse into one row. Mitigation: include plan id in the group key.
  - Gives the user trust information but doesn't actually scope the import — users who expect "only this plan's rows" still have to manually filter visually. Arguably the right call if imports across plans are a legitimate workflow.

### Option C — Both

- Change: Do B (labeling + per-row enrichment + plan-id in group key) AND add `?planId=` as an optional filter, with a "All my plans" toggle (similar to the existing "Show all future events" toggle at `ImportFromGardenModal.tsx:378-389`).
- Files: same as A + B: `backend/blueprints/gardens_bp.py`, `frontend/src/components/IndoorSeedStarts/ImportFromGardenModal.tsx`.
- Scope: **medium.** Sum of A and B.
- Risk: Largest surface area; most defensive. Adds two new UX states (default = active plan only; toggle = all plans). Needs cleanest empty-state copy ("No events for this plan. Show all plans?").

## Recommendation

**Recommended: Option C, but staged — ship B first, then add A's filter as a follow-up.**

Rationale:

Option B is the **smallest change that restores user trust**. The reporter's concrete complaint is "I can't tell which plan the rows are from" — that is a labeling problem, not a scoping problem. Adding a visible "Importing from: `<active plan name>` (rows from all your plans shown)" header plus a per-row "Plan" column closes the trust gap immediately without changing behavior anyone may already depend on. It also exposes the real cross-plan merge behavior instead of hiding it behind a filter.

Option A is the right long-term fix but has one real footgun: rows with `export_key = NULL` (any event not created via `export_to_calendar`) cannot be attributed to a plan and would silently vanish from a `?planId=…`-filtered response. That needs a thought-out UX ("N events couldn't be attributed — show all?") before we ship the filter. Doing A without that UX would trade one trust problem for another.

Option C bundled is defensible if we have time to design the "unattributed events" empty state. If this retest needs to be cleared quickly, do just B.

The group-key plan-id fix (plant_id, variety, transplant_date, **plan_id**) at `gardens_bp.py:2486` should go in with B regardless — it's a quiet data-correctness issue, not just cosmetic.

## Smallest safe fix

The one change that resolves the reporter's "I can't trust which plan this is pulling from" complaint with minimum blast radius:

**Frontend-only, no backend changes, no schema changes:** Add a `useActivePlan()` call in `ImportFromGardenModal.tsx` and render a prominent header at the top of the modal body (just below the existing `<p>` at `ImportFromGardenModal.tsx:363-365`) showing the active plan name and a one-sentence disclaimer that rows come from all the user's plans:

```
Active plan: "<activePlan.name>" — this list shows pending indoor starts from all your plans, not just this one.
```

Estimated change: ~8 lines in `ImportFromGardenModal.tsx`, zero lines elsewhere. Honest about current behavior, restores user trust, unblocks retest.

**Recommended follow-up (same PR if time permits):** Add `planId`/`planName` per row in the backend response (enrich via `export_key → GardenPlanItem → GardenPlan` lookup, similar to the existing bed-name enrichment at `gardens_bp.py:2519-2524`) and render a "Plan" column in the table. This is purely additive and low-risk; it brings us most of the way to Option B.

**No schema change required.** Existing `PlantingEvent.export_key` and `GardenPlanItem.export_key` fields carry enough information to attribute any event created via `export_to_calendar` back to its plan. Events without an export_key stay unattributed, which matches reality.

## Bundling with #11

**Recommendation: keep separate.**

#11 (Plan duplicate naming flow is weak — `phase-b-smoke-findings.md:55-58`) is a different UI surface and a different user workflow. It lives in the Garden Planner plan-list area and is about naming a plan at creation time. #12 is in the Indoor Starts modal and is about source-identification at read time.

Files are disjoint:
- #11 touches the plan-duplicate action in the Garden Planner plan list (likely `frontend/src/components/GardenPlanner.tsx` or a plan-list subcomponent) and the `POST /api/garden-plans/<id>/duplicate` endpoint (if that exists) or equivalent.
- #12 touches `frontend/src/components/IndoorSeedStarts/ImportFromGardenModal.tsx` and optionally `backend/blueprints/gardens_bp.py`.

A unified "plan clarity" framing is superficially attractive ("make it clear which plan you're looking at everywhere") but would produce a harder-to-review commit. Reviewing the indoor-starts label fix in isolation is quick (few lines, clear intent); reviewing a cross-cutting plan-clarity pass requires thinking about every plan-adjacent UI surface simultaneously. Defer that until we have more than two signals worth bundling.

## Open questions

- Product policy: is cross-plan import actually the intended behavior, or do we want imports to be hard-scoped to the active plan? If hard-scoped, ship Option A. If open/cross-plan with labeling, ship Option B. This is a product decision, not an engineering one.
- Legacy events with `export_key = NULL` (pre-Feb-2026 exports, hand-added events): when we add plan attribution, what copy do we show? "(no source plan)" is honest but ugly. "(manual event)" is friendlier but potentially wrong for pre-Feb-2026 plan-exported events.
- Should the group-key plan-id fix at `gardens_bp.py:2486` be its own finding? Right now, two plans that schedule the same (crop, variety, transplant date) silently merge into one import row with a merged `plantingEventIds` array spanning both plans — this is arguably worse than the labeling issue and should at minimum be noted in the findings log.
- `GardenPlanItem.export_key` at `backend/models.py:1392` is not indexed (only `PlantingEvent.export_key` at line 238 is). If we go with Option A's join-on-export_key, add an index in the same migration.
