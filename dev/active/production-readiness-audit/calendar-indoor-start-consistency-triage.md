# Calendar / Indoor Starts Consistency — Triage (2026-04-24)

Triage of the P1 finding in `calendar-indoor-start-consistency-finding.md`. Source-of-truth review only — no code changes proposed yet.

---

## 1. Answer to the Finding's Key Question

> Are the calendar's indoor-start events and the Indoor Starts planned records the same underlying work in different views, or intentionally different layers?

**They are different layers that are sometimes — but not always — linked.** This is **partly intentional, partly a coverage gap**.

- Calendar day view renders **`PlantingEvent`** rows where `seed_start_date` falls on the day. Every PlantingEvent for a transplant-method crop has a `seed_start_date` populated, regardless of whether an `IndoorSeedStart` row exists.
- Indoor Starts → Planned tab renders **`IndoorSeedStart`** rows only.
- The two are linked via the optional, nullable FK `IndoorSeedStart.planting_event_id` (no backref, no CASCADE).
- An `IndoorSeedStart` row is created in **only two places**: the explicit "Start Seeds" UI flow and the **placement** code path (drag-and-drop onto the grid in GardenDesigner). It is **never** created by `export_to_calendar`.
- Result: a user can do "Export to Calendar" on a plan with 50 transplant-method seedings, see 50 indoor-start rows in the calendar day view, then visit Indoor Starts → Planned and see **zero** matching rows because no placement has happened yet.

So: **same conceptual work, two storage layers, asymmetric population.**

---

## 2. Code Trace

### 2A. Calendar day-view rendering

| Concern | Code |
|---|---|
| Component | `frontend/src/components/PlantingCalendar/CalendarGrid/DayDetailModal.tsx` |
| Event-type label logic | `getEventTypeInfo()` — labels an event "Start Seeds (Indoor)" if `event.seedStartDate` is truthy (any PlantingEvent with a populated `seed_start_date`) |
| Day filter | `dayEvents = events.filter(...)` — keeps events where any of `seedStartDate`, `directSeedDate`, `transplantDate`, `expectedHarvestDate` matches the cell's calendar day |
| Indoor-start completion source | `event.indoorSeedStartStatus` — joined on the backend per-event, not derived from `event.completed` |
| Data source | parent `frontend/src/components/PlantingCalendar/index.tsx` → `fetchPlantingEvents()` → `GET /api/planting-events` |
| Backend handler | `backend/blueprints/gardens_bp.py::planting_events()` (the `GET` branch) |
| Backend filter | `PlantingEvent.user_id == current_user.id`, abandoned excluded (completed AND quantity_completed==0), soft-cancelled excluded (`cancelled_at IS NULL`). **No `event_type` filter.** Optional date-range filter applies only when both `start_date` and `end_date` query params are supplied (calendar does not pass them). |
| `indoorSeedStartStatus` injection | Same handler, ~30 lines before the `return jsonify(result)`: batch-loads `IndoorSeedStart` rows whose `planting_event_id` is in the page's event ids and overlays each event's `to_dict()` with `event_dict['indoorSeedStartStatus'] = seed_start_map.get(event.id)`. Returns `None` when there is no linked record. |

So the calendar's "Start Seeds (Indoor)" rows include:
- PlantingEvents linked to an IndoorSeedStart (status surfaced via `indoorSeedStartStatus`)
- PlantingEvents with `seed_start_date` set but **no** linked IndoorSeedStart (`indoorSeedStartStatus === null`)

The UI today does not visually distinguish these two cases.

### 2B. Indoor Starts → Planned tab

| Concern | Code |
|---|---|
| Component | `frontend/src/components/IndoorSeedStarts.tsx` |
| Data source | `apiGet('/api/indoor-seed-starts')` — no query params |
| Backend handler | `backend/blueprints/utilities_bp.py::indoor_seed_starts()` (GET branch) |
| Backend filter | `IndoorSeedStart.user_id == current_user.id`, soft-cancelled excluded (`cancelled_at IS NULL`). Optional `?status=planned` filter; the page does not send it on initial load. |
| Frontend filter | `filterStatus` state, default `'all'`. The "Planned" pill applies `s.status === 'planned'`. |
| Result set | Only rows in the `IndoorSeedStart` table — **independent of whether matching PlantingEvents exist with `seed_start_date`**. |

### 2C. When IndoorSeedStart is / is not created

`IndoorSeedStart(...)` constructors live in three places (excluding tests):

| Path | File / function | Creates IndoorSeedStart? |
|---|---|---|
| Explicit "Start Seeds" UI POST | `utilities_bp.py::indoor_seed_starts()` (POST branch) | Yes (1:1 with a freshly-created PlantingEvent) |
| Drag-and-drop placement (single + batch) | `gardens_bp.py::_auto_create_indoor_seed_start()`, called at lines ~567 and ~876 | Yes — only if `weeksIndoors > 0` and `transplant_date` is set on the event, and no existing IndoorSeedStart already linked |
| **Export to Calendar** | `services/garden_planner_service.py::export_to_calendar()` | **No.** `IndoorSeedStart` is not imported in this file at all. Sets `seed_start_date` on the PlantingEvent rows it creates, then stops. |

This is the asymmetry. The calendar surfaces the work the moment a plan is exported; the Indoor Starts page only surfaces it after placement (or after the user manually visits "Start Seeds").

---

## 3. Reproduction (Most Likely Path)

**Most likely:** Data layering — calendar shows all PlantingEvents with `seed_start_date == day`, Indoor Starts page only shows `IndoorSeedStart` rows. The two are linked but not 1:1; PlantingEvents created by `export_to_calendar` never have a paired IndoorSeedStart until placement.
**Confidence: high.** This matches the user's exact symptom (calendar full, Indoor Starts → Planned empty/sparse) and is reproducible from the code without running the app: export any plan with 5+ transplant-method seedings → calendar day for `transplant - weeksIndoors` shows N indoor-start rows → Indoor Starts → Planned shows 0 new rows because no `IndoorSeedStart` was inserted.

**Alternative hypotheses considered & rejected:**
- *Filter mismatch* — IndoorSeedStarts.tsx defaults to `filterStatus='all'`. Switching to "Planned" only narrows further. Cannot explain "many on calendar, none on Indoor Starts".
- *Sync gap on already-placed items* — completion sync via `_sync_indoor_start_on_completion` is bidirectional and well-tested. Once an IndoorSeedStart exists, its status reliably tracks the PlantingEvent. Not the cause here.
- *Visual crowding only* — DayDetailModal renders every matching event individually with no collapsing. Could amplify perceived count but not create the layering mismatch.

---

## 4. Fix-Direction Options

### Option A — Same work, different views (UX explainability + filter parity)
**Premise:** accept that PlantingEvents and IndoorSeedStarts represent the same work and either (a) backfill the missing IndoorSeedStart rows on export, or (b) make the views agree visually.

**A1 (lighter):** keep current data model, change UX:
- DayDetailModal: badge "Start Seeds (Indoor)" rows as either "Tracked" (has `indoorSeedStartStatus`) or "Plan only — not yet tracked" (status null). Add a button on "Plan only" rows: "Start tracking" → POST to `/api/indoor-seed-starts/from-planting-event` (already exists, line 1308 of utilities_bp.py).
- IndoorSeedStarts page: add a "Plan-only seedings" section that fetches `GET /api/planting-events/needs-indoor-starts` (already exists, line 2501) and lists PlantingEvents missing an IndoorSeedStart, with a one-click "Start tracking" action.
- Files: `DayDetailModal.tsx`, `IndoorSeedStarts.tsx`, possibly a new `PlanOnlySeedingsSection.tsx`. No backend changes.

**A2 (heavier):** make `export_to_calendar` create matching IndoorSeedStart rows for transplant-method GardenPlanItems, mirroring the placement path's `_auto_create_indoor_seed_start` logic.
- Files: `services/garden_planner_service.py` (add IndoorSeedStart creation in all three export paths), tests under `backend/tests/test_succession_export.py` to assert the new behavior, `dashboard_service.py::_build_indoor_starts_due` Path A becomes redundant and can be simplified.
- Risk: changes the semantics of "Export to Calendar" — users who only used the calendar layer now get rows on the Indoor Starts page they didn't ask for. Needs product decision.

### Option B — Different layers, intentional (UX disambiguation only)
**Premise:** PlantingEvents are "schedule" and IndoorSeedStarts are "execution tracking". Today's labeling implies they are the same.
- Rename the calendar event type from "Start Seeds (Indoor)" to "Indoor start scheduled" (or similar), add a tooltip explaining the relationship.
- Add helper text on the Indoor Starts page: "This page shows seedings you've started tracking. Scheduled seedings from your plan appear in the calendar."
- Files: `DayDetailModal.tsx`, `IndoorSeedStarts.tsx` (header text), `EventDetailModal.tsx` (consistent labeling).
- Cheapest option, but does not give the user a way to actually reconcile "what work is on Apr 24 vs what records exist". Likely insufficient.

### Option C — Bug (actual sync gap requiring backfill)
**Premise:** IndoorSeedStart rows should already exist for these PlantingEvents and are missing due to a real gap.
- Audit all PlantingEvent rows where `seed_start_date IS NOT NULL`, `event_type='planting'`, `cancelled_at IS NULL`, no linked IndoorSeedStart. Decide whether to backfill via a one-time script or a creation-path audit.
- Files: would be `backend/migrations/custom/data/backfill_indoor_seed_starts.py` plus a creation-path audit on `garden_planner_service.py::export_to_calendar`.
- This option is essentially the data-side of A2. Recommend folding into A2 if A2 is chosen.

---

## 5. Recommended Direction

**Option A1 (lighter), with A2 deferred pending product decision.**

Rationale:
- A1 is reversible and ships immediately. It surfaces the asymmetry in-UI without changing data semantics.
- A2 is the "right" architectural answer but changes export semantics; needs the user's call on whether export should auto-create tracking records.
- B alone leaves the user with no actionable reconciliation path — fails the original finding's expected behavior ("user should be able to reconcile").
- The needed backend endpoints (`/api/planting-events/needs-indoor-starts`, `/api/indoor-seed-starts/from-planting-event`) already exist; A1 is mostly frontend wiring.

---

## 6. Open Product Questions

1. **Should "Export to Calendar" auto-create IndoorSeedStart rows for transplant-method items?** (decides A1 vs A2)
   - Pro: calendar and Indoor Starts agree by default; one-source-of-truth for "indoor work due".
   - Con: changes the meaning of export; users get rows they didn't request; clutters Indoor Starts → Planned with potentially many rows.
2. **If we go A1, where should the "Plan-only seedings" affordance live?** As a banner on Indoor Starts → Planned tab? A separate sub-tab? Inline rows mixed with real records?
3. **Should the calendar visually distinguish "scheduled but not tracked" from "tracked"?** (If yes, what styling — different icon, badge, opacity?)
4. **Is the `dashboard_service.py::_build_indoor_starts_due` two-path pattern (Path A queries PlantingEvents, Path B queries IndoorSeedStarts) supposed to merge under A2, or stay split?** Currently it papers over the asymmetry in the dashboard but not in the calendar/Indoor Starts pair.
5. **For users with existing data**, do we need a one-time backfill (Option C) — or is leaving historical exports without IndoorSeedStart records acceptable since the user can always click "Start tracking"?

---

## 7. Risks to Watch (per CLAUDE.md and prior memory)

- **High-Risk: IndoorSeedStart ↔ PlantingEvent Completion Sync.** Any new IndoorSeedStart-creation code path must NOT flip status outside `_sync_indoor_start_on_completion`. The proposed A1/A2 paths call existing helpers (`_auto_create_indoor_seed_start`, `/from-planting-event`) so they stay within the supported sync surface — but a code-review check is required.
- **Deep-link memory** (`needs-attention-deep-link.md`): if A1 adds a "Start tracking" link from calendar → Indoor Starts page, we must use the existing `NeedsAttentionTarget` discriminated union (12 kinds). The relevant kind is `'indoor-start-overdue'` / `'indoor-start-due'`. There is **no current kind for "PlantingEvent that needs an IndoorSeedStart"** — we'd either piggyback on the existing kinds (the IndoorSeedStart doesn't exist yet, so the focus id wouldn't resolve) or add a new kind. Note this is a gap.
- **Dashboard staleness fix in working tree:** `signals/missed` payload contract is in flux. Any change to `_build_indoor_starts_due` (relevant to A2) must coordinate with that uncommitted work. Defer A2 backend work until the dashboard staleness PR lands.
- **Sync-file rule** (CLAUDE.md Constraint #2): no calculation-table changes here, so the four-location sync rule does not apply.
- **Per Mistake 11 / High-Risk Area added today**: the user explicitly flagged not to introduce changes that flip `IndoorSeedStart.status` outside the existing helper. A1 calls only existing helpers; A2 inserts new rows with `status='planned'` matching the existing auto-create path — both compliant.

---

## 8. Next Step (awaiting user)

User to decide on Open Question #1 (A1 vs A2). On answer:
- **A1**: spawn `frontend-debugger` for the two component changes, `Explore` first to confirm `/needs-indoor-starts` payload shape matches the planned UI.
- **A2**: spawn `Plan` agent for the export-path changes (touches `garden_planner_service.py` — high-risk per CLAUDE.md), then `backend-debugger` + `migration-guardian` (no schema change but data-creation logic) + `test-engineer` for `test_succession_export.py` updates, then `frontend-debugger` for any UX text adjustments.

No code changes made by this triage.
