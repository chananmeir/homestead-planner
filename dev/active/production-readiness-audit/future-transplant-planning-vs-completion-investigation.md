# Future Transplant Planning vs Completion — Investigation (2026-04-25)

Diagnostic pass for `future-transplant-planning-vs-completion-finding.md`
(P1, Wave 2A). Persisted per the standing rule.

This is **investigation only** — no code changed. Recommendations are
options, not commits. The user picks Model.

---

## TL;DR

The finding is **fully accurate** and the root cause is sharper than
"product-model gap":

1. **Real bug, narrow scope** — `PlantedItem.status` is set to `'planned'`
   by the frontend, but the auto-created `PlantingEvent` in the same
   request is hardcoded `completed=True, quantity_completed=quantity`
   regardless of `planted_date`. Frontend intent and schedule-layer state
   contradict each other for any future-dated drop. This is *not* a
   product decision — it's an internal inconsistency.

2. **Workflow conflation, medium scope** — Selecting "Transplant" in
   `PlantConfigModal` always triggers `_auto_create_indoor_seed_start`
   back-calculated from the transplant date. Users transplanting a
   nursery / store-bought seedling have no opt-out and end up with a
   phantom `IndoorSeedStart` (clamped to today if back-calc lands in
   the past).

3. **Product gap, larger scope** — There is no `plant_source` concept
   anywhere (`seed-started` / `nursery` / `direct-sow` / `division` /
   `cutting` / etc.). The only origin signal is "Direct Seed vs
   Transplant" in `PlantConfigModal`, and "Transplant" forces the
   indoor-start workflow.

The earlier "Model 1 — placement means transplant now" decision
(`future-placement-reservation-decision.md`, 2026-04-23) explicitly
declined to build a reservation primitive for the **Indoor Seed Starts
→ Plan Placement** surface. That decision is still valid for that
surface, but does not address (1) and (2), which live on a different
entry point (Garden Designer drag-and-drop) and are bug-shaped, not
feature-shaped.

---

## Evidence

### Frontend — what the user sends

`frontend/src/components/GardenDesigner.tsx:95`
```ts
const [dateFilter, setDateFilter] = useState<DateFilterValue>({ mode: 'single', date: today });
```
View date initialises to today; user navigates with the date picker
(rendered ~line 2654). All POST payload sites use `dateFilter.date`,
never `new Date()`:

`GardenDesigner.tsx:1687-1699` (single-cell drop):
```ts
const payload = {
  gardenBedId: targetBed.id,
  plantId: plant.id,
  variety: config.variety || undefined,
  position: finalPosition,
  quantity: totalQuantity,
  status: 'planned',                    // ← intent: planned, not done
  notes: config.notes || undefined,
  plantedDate: dateFilter.date,         // ← view date, can be future
  plantingMethod: config.plantingMethod,
  sourcePlanItemId: sourcePlanItemId || undefined,
  sourceIndoorSeedStartId,
};
```

Same shape on lines 1635–1651 (MIGardener row stagger batch) and
lines 1795–1811 (square-foot/intensive multi-cell batch). All three
sites send `status: 'planned'` and `plantedDate: dateFilter.date`.

`PlantConfigModal.tsx:1897-1931` exposes only **Direct Seed** vs
**Transplant**. Helper text under "Transplant": *"Seedlings will be
transplanted from indoor starts."* No nursery / store-bought option.

### Backend — what the server does with it

`backend/blueprints/gardens_bp.py:485-498` (PlantedItem creation):
```python
item = PlantedItem(
    ...
    planted_date=planted_date,           # ← honored (future ok)
    status=data.get('status', 'transplanted' if planting_method == 'transplant' else 'seeded'),
    ...                                  # ← frontend's 'planned' wins
)
```
PlantedItem layer is consistent with frontend intent.

`backend/blueprints/gardens_bp.py:502-515` (auto-created PlantingEvent —
**the bug**):
```python
planting_event = PlantingEvent(
    ...
    transplant_date=planted_date if planting_method == 'transplant' else None,
    direct_seed_date=planted_date if planting_method == 'direct' else None,
    expected_harvest_date=expected_harvest,
    ...
    completed=True,                      # ← unconditional
    quantity_completed=data.get('quantity', 1)  # ← unconditional
)
```
Both `completed` and `quantity_completed` are hardcoded as if the
planting just happened, with **no comparison to `planted_date`** vs
today. The same shape exists in the batch path at lines 783–784.

`backend/blueprints/gardens_bp.py:558-569` (IndoorSeedStart auto-creation):
```python
elif planting_method == 'transplant':
    existing_seed_start = _find_existing_indoor_seed_start(...)
    if existing_seed_start is not None:
        _link_existing_indoor_seed_start(existing_seed_start, planting_event)
    else:
        indoor_seed_start = _auto_create_indoor_seed_start(
            current_user.id, planting_event, plant, data.get('quantity', 1)
        )
```
Always fires for transplant-method placements. No opt-out.

`backend/blueprints/gardens_bp.py:174-189` (back-calc + past-clamp):
```python
indoor_start_date = transplant_date - timedelta(weeks=weeks_indoors)
...
if start_date_only < today_date:
    indoor_start_date = datetime.combine(today_date, datetime.min.time())
    was_clamped = True
```
For a near-future transplant date with non-zero `weeksIndoors`, the
back-calc may land in the past and silently clamp to today, presenting
the user with an "overdue from inception" indoor start.

### Read-side downstream consequences

- **PlantingCalendar** (`frontend/src/components/PlantingCalendar/`):
  reads PlantingEvents. Since they're born `completed=True`, a
  future-dated drop appears in the calendar as **completed** —
  contradicting the user's intent expressed via `status: 'planned'`.
- **Dashboard needs-attention** (`backend/services/dashboard_service.py`):
  filters by `PlantingEvent.completed == False`. Future-dated drops
  never surface as "upcoming work" because they're already done in the
  schedule layer.
- **Garden Designer grid render** (`GardenDesigner.tsx:625-678`,
  `getActivePlantedItems`): no styling differentiation by `status`. A
  future-placed item viewed *on its placement date* looks identical to
  a today-placed one.
- **FuturePlantingsOverlay** (`frontend/src/components/GardenDesigner/FuturePlantingsOverlay.tsx:175,245`):
  *does* show the FUTURE badge + opacity 0.7 — but only when the user
  is viewing a date *before* the placement date. The view-on-placement
  case is the one users are actually on, and it gets no treatment.
- **PlantedItem layer**: `status: 'planned'` is preserved correctly. So
  if any future feature reads PlantedItem.status, it would correctly
  see this as planned. The conflation is entirely in the PlantingEvent
  layer.

### Plant-source field — searched, absent

Repo-wide grep for `plant_source|store_bought|nursery_transplant|seed_started|grown_from_seed|origin_type|acquisition_source`: zero hits in
`models.py`, `plant_database.py`, or `migrations/versions/*.py`. The
only adjacent concept is `plantingMethod` (direct vs transplant), which
captures *how* the plant enters the bed but not *where the plant came
from*.

---

## Why this case is different from the 2026-04-23 decision

| Surface | Decision | Status |
|---|---|---|
| Indoor Seed Starts → Plan Placement | Model 1 (placement = transplant now). Reservation primitive deferred. | Shipped + decided. |
| Garden Designer drag-and-drop on future date | Not previously addressed. | **This investigation.** |

The Model 1 decision was about *whether to build a reservation
primitive for indoor starts*. The current finding overlaps in spirit
but exposes a different problem: the Garden Designer **already**
records the user's intent as `status: 'planned'`, and the backend
**already** stores `planted_date` correctly in the future. The bug is
that the schedule layer (PlantingEvent) silently overrides that with
`completed=True`, so downstream surfaces (calendar, dashboard) report
the wrong thing.

In other words: this isn't asking for a new reservation primitive. The
reservation-equivalent is already half-built — it just stops at the
PlantedItem boundary and gets clobbered when the PlantingEvent is
co-created.

---

## Options for resolution

Three layers, decreasing in confidence and increasing in scope.

### Layer 1 — Internal inconsistency fix (BUG)

**Scope:** ~10–20 LOC backend, no frontend changes, no migration.

In `gardens_bp.py:502-515` and the batch path at ~line 783–784, set
PlantingEvent completion based on `planted_date` vs today:

```python
today = get_now().date()
planted_d = planted_date.date() if hasattr(planted_date, 'date') else planted_date
is_in_past_or_today = planted_d <= today

planting_event = PlantingEvent(
    ...
    completed=is_in_past_or_today,
    quantity_completed=data.get('quantity', 1) if is_in_past_or_today else 0,
)
```

**Effect:** Future drops surface as scheduled work in
`/api/planting-events`, calendar shows them as upcoming, dashboard
correctly flags them when their date arrives. PlantedItem.status
('planned') and PlantingEvent.completed (False) become aligned.

**Risk:** Low. PlantingEvent already supports both completion states.
`is_complete` property on the model handles both. Existing tests
(`test_planting_event_status.py`) cover the boolean.
`_sync_indoor_start_on_completion` only fires when `completed=True`,
so unlinking it for future drops is the correct behavior.

**Caveats:**
- Need to confirm `_sync_indoor_start_on_completion` is not relied on
  by other callers in a way that breaks if completion is deferred.
- Need to confirm the auto-created IndoorSeedStart linking path still
  fires (it currently fires regardless of completion — `_auto_create_indoor_seed_start`
  is independent of the completion flag).

This change is roughly the same shape as previous "completion state
consistency" fixes (CLAUDE.md §"Completion State Consistency").

### Layer 2 — Plant-source escape hatch (BUG/UX)

**Scope:** ~50–100 LOC. One backend column (or boolean), small modal
change.

Two sub-options:

**2a — Boolean flag** (smallest):
- Add `PlantedItem.skip_indoor_seed_start: bool = False` (nullable not
  needed; default False preserves current behavior).
- `PlantConfigModal.tsx:1897-1931`: add a small "I started this from
  a transplant I purchased" checkbox under the Transplant radio.
- `gardens_bp.py:558-569`: skip `_auto_create_indoor_seed_start` if
  `data.get('skipIndoorSeedStart')` is true.

**2b — Plant-source enum** (cleaner, slightly more work):
- Add `PlantedItem.plant_source: enum('seed-started', 'nursery', 'direct-sow', 'division', 'cutting')` (nullable, defaults
  derived from `plantingMethod` for backward compatibility).
- `PlantConfigModal.tsx`: replace the binary Direct Seed / Transplant
  radio with a more expressive picker, OR keep the binary and add a
  sub-question for Transplant ("From your indoor starts" / "From
  nursery").
- `gardens_bp.py`: skip indoor-start auto-creation if `plant_source ==
  'nursery'`.
- Future surfaces (cost tracking, harvest yield reporting, seed-saving
  generations) can read `plant_source`.

**Effect:** Users transplanting a nursery seedling no longer get a
phantom IndoorSeedStart. The Garden Designer drag-and-drop accurately
reflects what the user is actually doing.

**Risk:** Low to medium. 2b touches the data model; 2a is purely
additive.

### Layer 3 — Future placement reservation primitive (FEATURE)

This is the same Model 2 from `future-placement-reservation-analysis.md`
applied to the Garden Designer entry point. **Already declined for
the indoor-starts surface on 2026-04-23.** Including it here only for
completeness — Layer 1 + Layer 2 together resolve the finding without
requiring this.

If you change your mind on Model 2, the scoping in
`future-placement-reservation-analysis.md` still applies; the only
delta is the entry point shifts from "Plan Placement" button to "drop
on a future view date".

---

## Recommendation

Layer 1 is a clear bug fix — PlantedItem status and PlantingEvent
completion contradict each other for future drops, with measurable
downstream effects (wrong calendar, wrong dashboard). I'd ship that
independent of any product decision.

Layer 2 is a real user concern (no way to model nursery transplants)
but is a smaller-than-Layer-1 lift if 2a (boolean) is acceptable.
2b is more correct long-term but bigger.

Layer 3 stays deferred per the prior decision unless you want to
revisit.

**Smallest reasonable next step: Layer 1 only.** It's a true bug, low
risk, no UX surface change. After that, decide on Layer 2 separately.

---

## Open product questions for the user

1. **Layer 1**: Ship as a bug fix? Yes/no.
2. **Layer 2**: Do you want a way to mark a transplant as
   nursery/store-bought to skip the auto IndoorSeedStart?
   - 2a (checkbox), 2b (full plant-source enum), or skip Layer 2?
3. **Layer 3**: Confirm reservation primitive remains deferred for
   this surface too (consistent with 2026-04-23 decision)? Or revisit?

---

## File-line index

**Backend:**
- `backend/blueprints/gardens_bp.py:402` — `add_planted_item` route
- `backend/blueprints/gardens_bp.py:485-498` — PlantedItem create (status branch, honors `'planned'`)
- `backend/blueprints/gardens_bp.py:502-515` — **PlantingEvent born `completed=True` (THE BUG)**
- `backend/blueprints/gardens_bp.py:558-569` — IndoorSeedStart auto-create (no opt-out)
- `backend/blueprints/gardens_bp.py:609` — `batch_add_planted_items` route
- `backend/blueprints/gardens_bp.py:783-784` — same bug in batch path
- `backend/blueprints/gardens_bp.py:145-194` — `_auto_create_indoor_seed_start` (back-calc + past clamp)
- `backend/models.py:100-151` — `PlantedItem` (no plant_source field)

**Frontend:**
- `frontend/src/components/GardenDesigner.tsx:95` — view date state
- `frontend/src/components/GardenDesigner.tsx:1687-1699` — single-drop POST payload (`status:'planned'`, `plantedDate:dateFilter.date`)
- `frontend/src/components/GardenDesigner.tsx:1635-1651, 1795-1811` — batch POST payloads
- `frontend/src/components/GardenDesigner/PlantConfigModal.tsx:1897-1931` — Direct Seed / Transplant radio (no nursery option)
- `frontend/src/components/PlantingCalendar/` — reads PlantingEvents (currently sees future drops as completed)
- `frontend/src/components/GardenDesigner/FuturePlantingsOverlay.tsx:175,245` — FUTURE badge (only shown when viewing dates *before* the placement date)

**Related decisions:**
- `dev/active/production-readiness-audit/future-placement-reservation-decision.md` — Model 1 (deferred reservation, 2026-04-23)
- `dev/active/production-readiness-audit/future-placement-reservation-analysis.md` — three-model analysis
- `dev/active/production-readiness-audit/indoor-start-transplant-now-lifecycle-finding.md` — overlapping concern, different surface
