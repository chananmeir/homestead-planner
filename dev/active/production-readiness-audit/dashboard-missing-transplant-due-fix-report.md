# Dashboard Missing Transplant-Due — Fix Report (2026-04-25)

Option 1 from `dashboard-missing-transplant-due-decision.md` shipped.

---

## Exact guard behavior implemented

`backend/services/dashboard_service.py:_build_transplants_due` lines 390–413:

```python
if e.is_complete:
    continue
# If this event has a scheduled indoor seed-start that has already
# passed and the event is still incomplete, decide whether to
# suppress based on the linked IndoorSeedStart's status (if any):
#   - no ISS linked -> use the original proxy (assume PE-only flow,
#     in which case the seed-start truly was never performed since
#     no tracking record exists)
#   - ISS linked, status='planned' -> seed-start was scheduled but
#     never started; suppress
#   - ISS linked, any advanced status ('seeded', 'germinating',
#     'growing', 'ready', 'transplanted') -> seed-start was
#     started; do NOT suppress (the linked PlantingEvent stays
#     is_complete=False for the entire ISS lifecycle by design —
#     see dashboard-missing-transplant-due-investigation.md).
# The companion "indoor start due" builder still surfaces the
# missed start as the actionable item when the guard fires.
seed_start = _as_date(e.seed_start_date)
if seed_start is not None and seed_start <= target_date:
    iss = (
        IndoorSeedStart.query
        .filter_by(planting_event_id=e.id, user_id=user_id)
        .first()
    )
    if iss is None or iss.status == 'planned':
        continue
```

**Decision matrix**:

| Linked ISS exists? | ISS status | Guard fires (signal hidden)? |
|---|---|---|
| No (PE-only) | n/a | YES — original behavior preserved |
| Yes | `'planned'` | YES — seed-start truly never started (intent preserved) |
| Yes | `'seeded'` | NO — signal surfaces |
| Yes | `'germinating'` | NO — signal surfaces |
| Yes | `'growing'` | NO — signal surfaces |
| Yes | `'ready'` | NO — signal surfaces |
| Yes | `'transplanted'` | NO — but `is_complete` may catch it earlier |

ISS query is properly scoped by `planting_event_id == e.id` AND
`user_id == user_id` (verified by user-isolation test).

---

## PE-only events preserve current behavior

For events with no linked IndoorSeedStart, the guard fires per the
original `b8f3cb8` proxy:
- `seed_start_date <= today` AND `is_complete=False` AND no ISS linked → suppress.

This matches the assumption baked into the original commit: if the
user is operating purely on PlantingEvent (e.g., calendar export
without indoor-tracking), then `is_complete=False` past the
seed-start date is a reasonable proxy for "never performed".

All 4 existing tests in `TestTransplantsDueMissedSeedStartGuard`
pass without modification:
- `test_guard_suppresses_transplant_row_when_seed_start_passed_and_incomplete` (no ISS — guard fires)
- `test_direct_seed_path_still_included` (no `seed_start_date` — guard never reached)
- `test_complete_events_still_skipped` (`is_complete=True` — early return)
- `test_future_seed_start_passes_guard` (future date — guard False)

---

## Files changed

- `backend/services/dashboard_service.py` (+24 / −8) — guard logic + comment
- `backend/tests/test_dashboard_endpoint.py` (+220 / −0) — 6 new tests

---

## Commits

- **`bb5a082`** — `fix: Transplant-due guard consults IndoorSeedStart.status, not stale completion proxy`
- _(this report + decision)_ — `docs:` follow-up

---

## Test results

- `TestTransplantsDueMissedSeedStartGuard`: **10/10 passing** (4 existing + 6 new)
  - `test_guard_does_not_fire_when_iss_status_advanced_seeded` — happy path
  - `test_guard_does_not_fire_when_iss_status_growing` — happy path
  - `test_guard_does_not_fire_when_iss_status_ready` — happy path (canonical pre-transplant terminus)
  - `test_guard_fires_when_iss_status_planned` — intent preserved
  - `test_guard_user_isolation_for_iss_lookup` — security boundary
  - `test_guard_fires_when_iss_linked_to_different_event` — query correctness
- `test_dashboard_endpoint.py`: **41/41 passing**
- `test_dashboard_service_grouping.py`: **22/22 passing** (regression)
- `test_dashboard_staleness.py`: **27/27 passing** (regression)
- Full backend suite: **1364 passed** (2 pre-existing geocoding network failures unrelated)
- `code-review` verdict: **APPROVE**

---

## Code-review cleanup applied

The reviewer flagged that the implementation initially used `'hardening'`
in a test + comment, but the actual `IndoorSeedStart.status` enum is
`('planned', 'seeded', 'germinating', 'growing', 'ready', 'transplanted')` —
no `'hardening'`. Renamed the test to
`test_guard_does_not_fire_when_iss_status_ready` (using the canonical
pre-transplant terminus) and updated the comment to remove
`'hardening'` from the lifecycle list. All tests still pass.

---

## Out of scope (explicitly rejected by decision)

- **Option 2** (set `linked_event.completed = True` in Indoor Starts PUT): would break `is_complete` semantics for transplant-due itself. Schema/state churn.
- **Option 3** (remove guard entirely): re-introduces the UX issue `b8f3cb8` was solving.
- Cross-surface harmonization beyond this guard (Indoor Starts page reads `expected_transplant_date` directly; that's correct behavior).
