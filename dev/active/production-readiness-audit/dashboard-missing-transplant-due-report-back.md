# Dashboard Missing Transplant-Due — Report Back (2026-04-25)

Option 1 shipped. Two commits:

| Commit | Type | Content |
|---|---|---|
| **`bb5a082`** | `fix:` | ISS-status-aware guard + 6 regression tests |
| `3653295` | `docs:` | decision + fix-report + report-back |

## Report-back

**Exact guard behavior implemented** (`dashboard_service.py:390-413`):

```python
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

Decision matrix:

| Linked ISS? | ISS status | Guard fires? |
|---|---|---|
| No | n/a | **YES** — original PE-only behavior preserved |
| Yes | `'planned'` | **YES** — original intent preserved |
| Yes | `'seeded'` / `'germinating'` / `'growing'` / `'ready'` | **NO** — signal surfaces |

ISS query properly scoped by `planting_event_id == e.id` AND `user_id == user_id` (verified by user-isolation test).

**PE-only events preserve current behavior:** All 4 existing `TestTransplantsDueMissedSeedStartGuard` tests pass without modification — the no-ISS path falls through to the original `b8f3cb8` proxy.

**Test results:**
- `TestTransplantsDueMissedSeedStartGuard`: **10/10 passing** (4 existing + 6 new)
- `test_dashboard_endpoint.py`: **41/41 passing**
- `test_dashboard_service_grouping.py` + `test_dashboard_staleness.py`: **49/49 passing** (regression)
- Full backend suite: **1364 passed** (2 pre-existing geocoding network failures unrelated)
- `code-review` verdict: **APPROVE** (1 cosmetic nit applied — renamed `hardening` → `ready` to match canonical `IndoorSeedStart.status` enum, since the actual enum doesn't include `'hardening'`)

For the user's reproducible scenario (sim 2024-03-24, beets seed-started 2024-02-18 with `weeksIndoors=4`): the guard now correctly identifies the ISS has progressed beyond `'planned'` (e.g., `'growing'`) and lets the transplant-due signal surface on the Dashboard.
