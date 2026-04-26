# Dashboard Missing Transplant-Due — Report Back (2026-04-25)

Option 1 shipped per `dashboard-missing-transplant-due-decision.md`.

| Commit | Type | Content |
|---|---|---|
| **`bb5a082`** | `fix:` | ISS-status-aware guard + 6 new regression tests (2 files) |

## Exact guard behavior

`backend/services/dashboard_service.py:_build_transplants_due` (lines 390–413):

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
| No | n/a | **YES** — original PE-only behavior |
| Yes | `'planned'` | **YES** — original intent preserved |
| Yes | `'seeded'` / `'germinating'` / `'growing'` / `'ready'` | **NO** — signal surfaces |

## PE-only events preserve current behavior

When `iss is None`, guard fires per original `b8f3cb8` proxy. All 4 existing `TestTransplantsDueMissedSeedStartGuard` tests pass without modification.

## Test results

- `TestTransplantsDueMissedSeedStartGuard`: **10/10 passing** (4 existing + 6 new)
  - 3 ISS-advanced-status tests (seeded / growing / ready) — happy path
  - 1 ISS-planned-status test — intent preserved
  - 1 user-isolation test — security boundary
  - 1 wrong-event-link test — query correctness
- `test_dashboard_endpoint.py`: **41/41 passing**
- `test_dashboard_service_grouping.py`: **22/22 passing** (regression)
- `test_dashboard_staleness.py`: **27/27 passing** (regression)
- Full backend suite: **1364 passed** (2 pre-existing geocoding network failures unrelated)
- `code-review` verdict: **APPROVE** (1 cosmetic nit applied — renamed `hardening` → `ready` to match canonical enum)

## Out of scope (per decision)

- Option 2 (data-model fix): rejected — would break `is_complete` semantics
- Option 3 (remove guard): rejected — re-introduces b8f3cb8 UX issue
