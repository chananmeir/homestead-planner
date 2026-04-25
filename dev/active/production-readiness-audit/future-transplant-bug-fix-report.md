# Future-Dated Placement Completion — Fix Report (2026-04-25)

Layer 1 of `future-transplant-planning-vs-completion-finding.md` is
shipped. Layers 2 and 3 remain deferred per
`future-transplant-bug-decision.md`.

---

## Exact backend behavior change

**Before**: Both `add_planted_item` and `batch_add_planted_items`
hardcoded the auto-created `PlantingEvent` as
`completed=True, quantity_completed=quantity` regardless of
`planted_date`. A future-dated drop produced a PlantedItem with
`status='planned'` *and* a co-created PlantingEvent in the
`completed=True` state — internally inconsistent. Calendar and
dashboard then reported future drops as already done.

**After**: Both paths compute `is_completed = (planted_date <= today)`
and apply that boolean to both `completed` and `quantity_completed` in
a paired way:

- past or today → `completed=True, quantity_completed=quantity` (unchanged)
- future → `completed=False, quantity_completed=0` (NEW)

PlantedItem semantics are unchanged. PlantingEvent now correctly
mirrors the user's planning intent. When the planting actually
happens (e.g., the user later marks the event complete via PUT or
harvest endpoints), the existing
`_sync_indoor_start_on_completion` and `is_complete` paths take over
unchanged.

`_auto_create_indoor_seed_start` is intentionally untouched (Layer 2
boundary).

---

## Both create paths covered

Yes:

- **Single-drop**: `backend/blueprints/gardens_bp.py:402` →
  completion compute at lines 501–509, applied at lines 523–524.
- **Batch-drop**: `backend/blueprints/gardens_bp.py:619` →
  per-request "today" baseline at lines 701–706, per-position
  computation at lines 761–767, applied at lines 808–809.

Per-position date handling in the batch path is preserved
(`pos.get('plantedDate')` honored), so a batch with mixed past/future
positions is evaluated correctly position-by-position against a single
shared "today" baseline.

---

## Commits

- **Fix**: `35cb6fe` — `fix: Future-dated placements no longer reported as completed`
  - `backend/blueprints/gardens_bp.py` (Layer 1 hunks only;
    pre-existing cancel/uncancel WIP left unstaged)
  - `backend/tests/test_planting_event_status.py` (6 new tests)
- **Docs**: `6c2b46a` — `docs: Future-transplant finding, investigation, and bug decision`
  - `future-transplant-planning-vs-completion-finding.md`
  - `future-transplant-planning-vs-completion-investigation.md`
  - `future-transplant-bug-decision.md`

---

## Test results

6 new regression tests in
`backend/tests/test_planting_event_status.py` under
`TestFutureDatedPlacementCompletion`:

1. `test_single_drop_past_date_creates_completed_event` — past plantedDate → `completed=True`
2. `test_single_drop_today_creates_completed_event` — today's plantedDate → `completed=True` (boundary)
3. `test_single_drop_future_date_creates_scheduled_event` — future plantedDate → `completed=False, quantity_completed=0`
4. `test_batch_drop_all_future_creates_scheduled_events` — all-future batch → all `completed=False`
5. `test_batch_drop_mixed_past_and_future_per_position_dates` — per-position dates honored independently
6. `test_future_transplant_preserves_indoor_seed_start_creation` — future transplant: PlantingEvent scheduled, IndoorSeedStart still auto-created (Layer 2 boundary pinned)

Test runs:

- `tests/test_planting_event_status.py`: **25 passed** (19 pre-existing + 6 new)
- `tests/test_succession_export.py`: **36 passed** (no regression)
- Full backend suite: **1336 passed, 2 failed, 1 xfailed** — the 2
  failures are pre-existing `test_geocoding_service.py` network
  failures unrelated to this change (matches recorded baseline).

Tests use the simulation clock (`set_simulated_date`) to pin "today"
deterministically, mirroring the existing pattern from
`test_indoor_seed_start_overdue_modes.py`. No DB mocks (per repo
convention).

---

## Code review summary

`code-review` agent verdict: **APPROVE — Ready to commit.**

- ✅ Date type handling consistent with `_auto_create_indoor_seed_start`
  idiom in the same file.
- ✅ `completed` and `quantity_completed` always paired; no drift risk.
- ✅ Per-request "today" computed once in batch path, not per position.
- ✅ Per-position `plantedDate` overrides honored by completion check.
- ✅ No schema change; no migration; no sync drift.
- ✅ `is_complete` canonical property still works correctly.
- ✅ Comments explain WHY (the previous bug behavior) — not WHAT.
- ✅ Test coverage comprehensive; uses simulation clock; no DB mocks.

The reviewer also noted pre-existing `cancel_planting_event` /
`uncancel_planting_event` WIP in the working tree (not introduced by
this fix) and recommended splitting it. Resolved by surgically
staging only the Layer 1 hunks via `git apply --cached` with a filtered
patch. The cancel WIP remains untouched in the working tree (`MM`
status on `gardens_bp.py`).

---

## Out of scope (deferred)

- **Layer 2** (nursery / store-bought escape hatch): No way for users
  to mark a transplant as nursery-bought to skip the auto
  IndoorSeedStart. Decide separately.
- **Layer 3** (future placement reservation primitive): Already
  declined for the Indoor Seed Starts surface on 2026-04-23 (Model 1).
  Symmetrically deferred for the Garden Designer surface.
