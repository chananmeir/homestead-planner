# AUDIT-011 Retest Investigation — Option A Scoping (2026-04-23)

Read-only investigation. No code modified.

## Root cause confirmed

**Primary cause: Suspect #1 — by design.** The Option-B implementation shipped in `5d713b9` intentionally returns events across ALL of the user's plans. The modal does exactly what it was built to do:

- Backend endpoint filters only by `user_id` (`backend/blueprints/gardens_bp.py:2481-2484`):
  ```python
  query = PlantingEvent.query.filter_by(user_id=current_user.id).filter(
      PlantingEvent.transplant_date.isnot(None),
      PlantingEvent.cancelled_at.is_(None)
  )
  ```
  No `plan_id` / `garden_plan_id` / active-plan join. The per-row `planId`/`planName` attribution added in `5d713b9` (lines `2492-2524`, `2550`, `2631-2632`) is **labeling only** — it does not filter.

- Group key is `(plant_id, variety, transplant_date_str, plan_id)` (`gardens_bp.py:2550`). Cross-plan merge is fixed — rows from Plan A and Plan B no longer collapse — but both still come back in the same response.

- Frontend renders ALL returned rows (`ImportFromGardenModal.tsx:491-563`). The per-row badge logic at `ImportFromGardenModal.tsx:518-531` renders `from "<planName>"` for cross-plan rows and `Unknown plan` for null-plan rows, but there is no row-level filter:
  ```tsx
  {events.map((event) => (
    <tr key={event.plantingEventId} ...>
  ```
  So in the reporter's scenario (Plan A = lettuce with export, Plan B = basil active but lettuce has been imported-preview'd before), the lettuce rows are returned with a muted `from "Plan A"` badge and the basil rows (if any met the criteria) appear alongside them. The header correctly shows Plan B. From the user's perspective, this reads as "the modal is showing Plan A's rows despite Plan B being active" — which is true if they didn't notice the badges.

**Secondary contributing cause: Suspect #2 — real, but masked.** The modal's `useEffect` fires fetch only on `isOpen` (`ImportFromGardenModal.tsx:60-65`):
```tsx
useEffect(() => {
  if (isOpen) {
    loadEvents();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isOpen]);
```
There is no dependency on `activePlan?.id`. If the user switches active plan while the modal stays open, the list does not reload. In today's cross-plan shipping this is a no-op (the result set wouldn't change anyway) — but once Option A adds `?planId=<activePlan.id>`, this **must** include `activePlan?.id` in the dep array, or the Option A filter will itself become stale.

**Suspects #3 and #4 are not happening.** There is no client cache of rows across opens — `loadEvents()` always calls `setAllEvents(loadedEvents)` fresh (`ImportFromGardenModal.tsx:73-74`) and resets selection (`:75`). Backend per-row `planId`/`planName` attribution is correctly computed via the batch-lookup at `gardens_bp.py:2509-2524` with `GardenPlan.user_id == current_user.id` guarding cross-user leakage, and the group key correctly includes `plan_id` to prevent silent merging. No evidence of stale client state or mis-attribution.

## null-`export_key` product decision

**Recommended default: (ii) Always include with `Unknown plan` label.**

Rationale (evidence-driven):

1. **Null `export_key` is common, not rare.** Multiple code paths create `PlantingEvent` without setting `export_key`:
   - Direct creation from drag-and-drop on the designer: `backend/blueprints/gardens_bp.py:472-485` (no `export_key` passed).
   - Succession service path: `backend/services/planting_service.py:93-104`, `:239-265` (no `export_key`).
   - Legacy scripts: `backend/place_plants.py`, `backend/place_gap_plants.py` — grep for `export_key` returns zero hits.
   - Any pre-Feb-2026 event (the `export_key` column was added in migration `de0b8c7ef792`).

   Only `services/garden_planner_service.py::export_to_calendar()` populates `export_key` (three paths: trellis `:770`, bed-allocated `:867`, legacy `:928`). Users who drag plants directly onto the designer — the most common authoring path — produce null-`export_key` events even in current-day usage.

2. **Excluding (option i) would silently hide real work.** The import modal's job is "pull my planned transplants into indoor starts." A user who built their plan via drag-and-drop rather than the Garden Season Planner export flow would see an empty modal under option (i), despite having legitimate pending transplants. That is a worse trust failure than the current one.

3. **Option (iii) adds a branch with no clear benefit.** If the answer differs between "no active plan" and "active plan selected" for the same null-plan event, the user has to know that distinction to predict the UI. Not worth the cognitive load.

4. **Option (ii) matches the shipped frontend's existing intent.** The `Unknown plan` pill at `ImportFromGardenModal.tsx:527-531` is already in place. Extending Option A to keep these rows visible means the pill keeps working for its intended purpose even under active-plan scoping: "this row cannot be attributed — review and import at your discretion."

**User override to flag:** If product wants strict "this plan only, hide everything else" scoping, option (i) is defensible — but the empty-state copy then needs to advertise "N unattributed events hidden — [show all plans]" so the user can recover their non-exported work. That is additional UX scope. Option (ii) avoids the design work.

## Proposed Option A implementation

### Backend

File: `backend/blueprints/gardens_bp.py`

Change: Add optional `?planId=<int>` query param to `/api/planting-events/needs-indoor-starts`. Changes are localized to the function at `gardens_bp.py:2464-2641`.

1. **Parse + validate the param** (insert after `include_past` parsing at `:2478`):
   ```python
   plan_id_raw = request.args.get('planId')
   plan_id_filter = None
   if plan_id_raw is not None and plan_id_raw != '':
       try:
           plan_id_filter = int(plan_id_raw)
       except (ValueError, TypeError):
           return jsonify({'error': 'planId must be an integer'}), 400
       # Ownership check — reject cross-user planIds before any data is touched.
       owned = GardenPlan.query.filter_by(
           id=plan_id_filter, user_id=current_user.id
       ).first()
       if not owned:
           return jsonify({'error': 'Plan not found'}), 404
   ```

2. **Filter after plan attribution is computed.** The batch plan-attribution lookup at `gardens_bp.py:2501-2524` already resolves `event.id → plan_id`. Re-use that. Insert a filter step immediately before the grouping loop (at `gardens_bp.py:2530`):
   ```python
   if plan_id_filter is not None:
       # null-handling: (ii) Include null-export_key events alongside matching
       # plan events. They render as "Unknown plan" in the modal. This preserves
       # legacy and manually-placed events in the filtered view.
       filtered_events = []
       for event in events:
           parsed_item_id = event_to_plan_item.get(event.id)
           plan_info = (
               plan_item_to_plan.get(parsed_item_id)
               if parsed_item_id is not None else None
           )
           event_plan_id = plan_info[0] if plan_info else None
           if event_plan_id == plan_id_filter or event_plan_id is None:
               filtered_events.append(event)
       events = filtered_events
   ```

3. **Backward compat:** When `planId` is omitted, path is unchanged — all callers continue to receive cross-plan results as they do today.

**Why filter in Python, not SQL?** The attribution is via `export_key` string parse, not a FK. Filtering in SQL would require either:
- A `LIKE '{user_id}_{plan_item_id}_%'` on `PlantingEvent.export_key` (works but no new index buys much — `PlantingEvent.export_key` is already indexed at `models.py:238`, but a LIKE with variable prefix is not index-friendly).
- A full `JOIN GardenPlanItem ON substring-parse(PlantingEvent.export_key)` — not portable/indexable in SQLite.

Python-side filter is simpler, matches the existing attribution code, and the result set here is small (per-user, transplant-dated, non-cancelled) — well under a few hundred rows in realistic use. The LOC cost is ~10 lines; the SQL cost would be larger + riskier.

### Frontend

File: `frontend/src/components/IndoorSeedStarts/ImportFromGardenModal.tsx`

1. **Pass `planId` in fetch** (`ImportFromGardenModal.tsx:70`):
   ```tsx
   const url = activePlan?.id
     ? `/api/planting-events/needs-indoor-starts?planId=${activePlan.id}`
     : '/api/planting-events/needs-indoor-starts';
   const response = await apiGet(url);
   ```
   When no active plan is set, pass no param → preserves current cross-plan behavior, matching the existing "no active plan" header copy at `:380-384`.

2. **Fix the effect dep array** (`ImportFromGardenModal.tsx:60-65`):
   ```tsx
   useEffect(() => {
     if (isOpen) {
       loadEvents();
     }
   }, [isOpen, activePlan?.id]);  // reload when plan switches while modal open
   ```
   Drop the `eslint-disable-next-line` — the deps are now correct. This is required: without it, switching active plan while the modal is open will not refresh rows, defeating the Option A scope.

3. **Keep the badge code.** Post-fix, same-plan rows dominate and the `from "X"` branch at `:522-526` will rarely render (only when `planId` is omitted — i.e., no active plan). The `Unknown plan` branch at `:527-531` remains live and expected. Leaving both branches is the right call:
   - The `from "X"` branch is a correctness safety net: if the backend ever returns a cross-plan row under an active-plan filter (bug), the badge makes it visible instead of silently trusted.
   - The `Unknown plan` branch is required by the chosen null-handling default (ii).
   - Removing the `from "X"` branch would save two lines but lose the invariant-violation signal. Not worth it.

4. **Update the header disclaimer copy** at `ImportFromGardenModal.tsx:385-387` to match new behavior. Suggested:
   ```tsx
   <p className="text-xs text-gray-500 mt-1">
     {activePlan
       ? 'Rows are scoped to this plan. Unattributed events are also shown.'
       : 'No active plan selected — showing events across all your plans.'}
   </p>
   ```
   This correctly describes the null-handling policy.

### null-handling applied consistently at both layers

- **Backend:** When `planId` is provided, include events where `event_plan_id == planId` OR `event_plan_id is None`. Explicit at the filter step.
- **Frontend:** The `Unknown plan` badge at `:527-531` continues to mark those rows. The header copy acknowledges "Unattributed events are also shown" so the user knows the badge is expected, not a bug.
- **Grouping-key consistency:** The existing `plan_id`-including group key at `gardens_bp.py:2550` already handles null-plan grouping correctly (`(plant_id, variety, date, None)` groups null-plan events amongst themselves without smearing into the active-plan bucket). No change needed there.

## Scope

**LOC estimate: ~20 lines of production code + 4-6 new test cases.**

Backend: +12 lines (param parse/validate + Python-side filter). Frontend: +4 lines (URL builder + dep array + copy tweak). That's the full change.

Regression tests to add:

- Backend (`backend/tests/test_needs_indoor_starts_plan_attribution.py` — extend existing suite):
  1. `?planId=<owned plan>` returns only rows attributed to that plan plus null-plan rows.
  2. `?planId=<owned plan>` excludes rows attributed to another plan (even same user).
  3. `?planId=<other user's plan id>` returns 404 (not 200, not cross-user leak).
  4. `?planId=not-an-int` returns 400.
  5. `?planId=` (empty) and no param at all both behave as cross-plan (backward compat).
  6. null-`export_key` events: included under `planId` filter with `planId=null` in response.

- Frontend: No existing unit tests for `ImportFromGardenModal` fetch behavior. **Coverage gap, flag it** — a test that the `useEffect` refetches on `activePlan.id` change would prevent regression. Existing `IndoorSeedStarts.focus.test.tsx` mocks `ActivePlanContext` but doesn't exercise this modal's lifecycle. Adding a dedicated test file is ~30 lines; optional for this pass if time is tight, required for belt-and-suspenders.

## Index / performance

**Defer. Do not add an index in this pass.**

Evidence:

- The Option A filter runs entirely against `GardenPlanItem.id` (PK index, free) via the existing batch query at `gardens_bp.py:2511-2524`. No new hot path touches `GardenPlanItem.export_key`.
- `PlantingEvent.export_key` is already indexed (`models.py:238`) but is not queried by string equality in this path — only parsed in Python after the `user_id`-filtered query returns its rows. No SQL-layer index pressure introduced.
- The cost of adding an index now is non-zero: new migration, rollback test, schema audit. The prior investigation (`finding-12-implementation-decision.md` §3) explicitly says "Do not implement it in this pass. Please explicitly note: ... if that path is implemented later, add an index for the matching plan-attribution lookup path as needed." Option A as proposed does not introduce that path — it reuses the existing id-based batch lookup. The index can stay deferred.

If a future design ever joins `PlantingEvent.export_key = GardenPlanItem.export_key` as string equality (rather than parsing + id-lookup), add an index on `GardenPlanItem.export_key` in that same migration. Not needed for this proposal.

## Cross-stack split

Per the audit's "one bug, one commit" directive, both slices ship in a single commit. Delegation:

- **Backend slice (`backend-debugger`):**
  - File: `backend/blueprints/gardens_bp.py`
  - Add `?planId` param parse, ownership check, Python-side filter, null-inclusion per option (ii).
  - Extend `backend/tests/test_needs_indoor_starts_plan_attribution.py` with 6 new cases listed above.
  - Verify existing 6 tests still pass (no change to response shape for unfiltered calls).

- **Frontend slice (`frontend-debugger`):**
  - File: `frontend/src/components/IndoorSeedStarts/ImportFromGardenModal.tsx`
  - Pass `planId=<activePlan.id>` in fetch URL when active plan set.
  - Fix `useEffect` dep array to include `activePlan?.id`.
  - Update header disclaimer copy per active-plan state.
  - No test changes if existing focus test still passes; flag test-coverage gap in PR description.

- **Coordination (`project-manager` or combined commit owner):**
  - Single commit titled along the lines of `fix(AUDIT-011): Scope Import from Garden Plan modal to active plan`.
  - PR description must call out the null-`export_key` product decision (option ii) explicitly so reviewer can confirm.
  - No migration, no new index.
  - Run `cd backend && python -m pytest tests/test_needs_indoor_starts_plan_attribution.py -v` before commit; both the 6 original and 6 new cases should pass.

- **`sync-validator` agent is NOT needed.** No synchronized file pair is touched — this is single-file each side, no space-calculator / plant-database / SFG-lookup modifications.

## Open questions for user (if any)

1. **Confirm the null-`export_key` policy.** Recommendation is option (ii) — "include null-plan events alongside active-plan events under `Unknown plan` badge." If product prefers strict scoping (option i), the modal's empty state and an "unattributed events hidden — show all?" affordance will need additional design work not captured in this scope. **Blocking only if product wants option (i).**

2. **Confirm whether the `from "<planName>"` cross-plan badge branch should be retained post-fix.** Recommendation: retain as a safety net + for the "no active plan" case. No blocker either way — removing it is a 5-line edit if preferred.

3. **Frontend test-coverage gap.** No existing `ImportFromGardenModal` unit test exercises the fetch URL or the `activePlan.id` dep. Ship the fix without a test (faster) or add ~30 lines of Jest coverage in the same commit (slower, safer)? Recommendation: add the minimal test — the dep-array footgun is exactly the kind of regression that silently reappears.
