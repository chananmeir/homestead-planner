# Dashboard Needs-Attention Row-Splitting — Backend Implementation Report (2026-04-25)

Implements the backend half of the fourth row-splitting surface following
the investigation
(`dashboard-needs-attention-row-splitting-investigation.md`) and the
decision (`dashboard-needs-attention-row-splitting-decision.md`).

Frontend implementation runs in parallel under the same decision.

---

## TL;DR

8 dashboard signal builders in
`backend/services/dashboard_service.py` now group per-PlantingEvent (and
per-IndoorSeedStart) signals by composite key. Same-task PlantingEvents
collapse to a single row carrying `plantingEventIds: int[]` (or
`indoorSeedStartIds: int[]` on ISS rows). Singletons keep the legacy shape
plus a length-1 ids list. Snooze stays per-signalKey (representative event
id); the frontend will fan-out POSTs across `plantingEventIds` when the
user dismisses a grouped row.

No schema changes. No migration. Existing tests untouched and all
passing.

---

## Builders modified

`backend/services/dashboard_service.py`

| Builder | Lines (new) | Composite key |
|---|---|---|
| `_build_harvest_ready` | 112–195 | `(expected_harvest_date, plant_id, variety, garden_bed_id)` |
| `_build_indoor_starts_due` (PE path) | 198–281 | `(seed_start_date, plant_id, variety)` — no bed |
| `_build_indoor_starts_due` (ISS path) | 282–350 | `(start_date, plant_id, variety)` — no bed |
| `_build_transplants_due` | 353–437 | `(transplant_date, plant_id, variety, garden_bed_id)` |
| `_build_direct_seed_due` | 440–515 | `(direct_seed_date, plant_id, variety, garden_bed_id)` |
| `_build_germination_check` | 518–605 | `(direct_seed_date, plant_id, variety, garden_bed_id)` |
| `_build_indoor_germination_check` (ISS path) | 640–734 | `(start_date, plant_id, variety)` — no bed |
| `_build_indoor_germination_check` (PE path) | 736–803 | `(seed_start_date, plant_id, variety)` — no bed |

Out of scope, intentionally unchanged:
- `_build_frost_risk`, `_build_rain_alert`, `_build_livestock_actions` (singletons)
- `_build_compost_overdue`, `_build_seed_low_stock`, `_build_seed_expiring` (per-entity)

Also added: `from collections import defaultdict` import at the top of
the module (line 13).

---

## Contract — grouped row payload shape

For each PE-based builder, a representative (fully-populated) grouped row
payload looks like:

```python
{
    'signalKey': 'indoor-1234',                    # representative event id
    'plantingEventId': 1234,                       # representative event id
    'plantingEventIds': [1234, 1235, 1236, 1237],  # ALL group members, sorted asc
    'plantName': 'Beet',                           # representative
    'variety': 'Detroit Dark Red',                 # representative
    'seedStartDate': '2026-04-14',                 # representative (identical across group)
    'quantity': 32,                                # SUM across group; None coerced to 0
}
```

For ISS-based builder rows:

```python
{
    'signalKey': 'indoor-iss-99',
    'plantingEventId': 7,                          # carried through if any member links to a PE; else None
    'indoorSeedStartId': 99,                       # representative iss id
    'indoorSeedStartIds': [99, 100, 101],          # ALL ISS members, sorted asc
    'plantName': 'Lettuce',
    'variety': 'Buttercrunch',
    'seedStartDate': '2026-04-14',
    'quantity': 60,                                # SUM of seeds_started
}
```

`harvestReady` adds two aggregate fields:

```python
{
    'signalKey': 'harvest-42',
    'plantingEventId': 42,
    'plantingEventIds': [42, 43],
    'plantName': 'Tomato',
    'variety': 'Roma',
    'bedId': 5,
    'bedName': 'Bed Tomato',
    'quantity': 5,
    'daysPastExpected': 20,                        # MAX across group (per-event clamped to >= 0)
    'isStale': True,                               # any(member daysPastExpected > 14)
}
```

### Singletons preserve legacy shape

Single-event rows still emit one signal with:
- `plantingEventIds: [event.id]` (length 1)
- `indoorSeedStartIds: [s.id]` (length 1, ISS path only)

Frontend treats length-1 as "no badge, no fan-out".

### Variety normalization

`event.variety or None` — empty strings hash to the same bucket as `None`
so two events with `variety=''` and `variety=None` are treated identically
when forming the composite key. The representative's `variety` field is
preserved verbatim in the row payload.

### Determinism

Within each group, members are sorted by `event.id` (or `iss.id`)
ascending; the lowest id is the representative. Groups themselves are
ordered first by date, then by min member id.

---

## Snooze behavior implication

Per D3 in the decision: snooze remains per-signalKey, the representative
event id. A backend snooze on `indoor-1234` (where 1234 is the
representative) suppresses the entire grouped row from the dashboard —
because the snooze filter runs over `signalKey` membership, and the
grouped row carries only the representative's signalKey.

The frontend will fan-out separately when a user dismisses a grouped row
(it iterates `plantingEventIds` and POSTs N times, as recommended in the
investigation). That fan-out is a frontend implementation detail — the
backend snooze model and endpoint are unchanged.

This is verified by the new test
`TestSnoozeRepresentativeBehavior::test_snoozing_representative_signalkey_hides_whole_group`.

---

## Tests

### New test file

`backend/tests/test_dashboard_service_grouping.py` — **22 tests**, all passing:

- `TestIndoorStartsDueGrouping` (6 tests):
  - 4 same-key PEs collapse to 1 signal (canonical 32-beet investigation case)
  - Singleton preserves legacy shape with `plantingEventIds: [id]`
  - Variety boundary preserved
  - Date boundary preserved
  - `quantity=None` coerced to 0 in sum
  - Active/missed split for grouped rows is consistent
- `TestIndoorStartsDueIssGrouping` (2 tests):
  - 3 same-key ISS records collapse with `indoorSeedStartIds`
  - Singleton ISS still emits `indoorSeedStartIds: [s.id]`
- `TestTransplantsDueGrouping` (2 tests): same-bed collapses, bed boundary preserves
- `TestDirectSeedDueGrouping` (2 tests): same-bed collapses, bed boundary preserves
- `TestGerminationCheckGrouping` (2 tests): same-key collapses, bed boundary preserves
- `TestIndoorGerminationCheckGrouping` (2 tests): PE path + ISS path each collapse correctly
- `TestHarvestReadyGrouping` (3 tests): MAX daysPastExpected, fresh→isStale=False, bed boundary
- `TestSnoozeRepresentativeBehavior` (1 test): backend snooze hides whole group
- `TestBackwardCompatPayloadShape` (2 tests): PE rows always carry `plantingEventIds`; ISS rows always carry `indoorSeedStartIds`

### Existing test files — all still pass, untouched

- `tests/test_dashboard_endpoint.py` (39 tests) — single-event scenarios, behavior unchanged
- `tests/test_dashboard_staleness.py` (27 tests) — per-key staleness, snooze interaction
- `tests/test_dashboard_service_indoor_germination.py` (14 tests) — ISS/PE dedup, fallback computation

No tests required modification because every existing test created exactly
one event per "kind" — singletons emit identical payloads to before plus a
length-1 ids list.

### Test results

```
tests/test_dashboard_endpoint.py             39 passed
tests/test_dashboard_staleness.py            27 passed
tests/test_dashboard_service_indoor_germination.py  14 passed
tests/test_dashboard_service_grouping.py     22 passed
                                            ----------
Total dashboard tests                       102 passed

Full backend suite                  1358 passed, 1 xfailed, 2 failed
                                    (the 2 failures are pre-existing
                                    geocoding network tests unrelated
                                    to this work)
```

---

## What did NOT change (out of scope per decision doc)

- `DashboardSnooze` model — unchanged
- `dashboard_bp.py` snooze endpoint — unchanged (frontend will fan-out)
- No bulk-snooze endpoint added (deferred per D3 decision)
- Database schema — no migration
- Frontend code — runs in parallel under the same decision

---

## Cross-domain alert

```
CROSS_DOMAIN_ALERT:
- Modified: backend/services/dashboard_service.py
- Requires sync:
    frontend/src/components/Dashboard/types.ts
      (signal row types: add plantingEventIds, indoorSeedStartIds)
    frontend/src/components/Dashboard/NeedsAttentionPanel.tsx
      (display summed quantity + count badge for grouped rows;
       fan-out snooze POST across plantingEventIds when grouped)
- What changed: All per-PlantingEvent dashboard signals now collapse same-key
  events into one row. Each row carries `plantingEventIds: int[]` (always present,
  length >= 1). ISS-path rows carry `indoorSeedStartIds: int[]`. Singleton rows
  still work with the existing frontend code (length-1 list); grouped rows
  need display + snooze fan-out logic.
- Urgency: RECOMMENDED — single-event scenarios continue to render correctly
  unchanged. Multi-event scenarios will display only the representative event's
  data (correct overall — quantity is summed) and dismissing a grouped row
  with the existing single-POST snooze will only snooze the representative,
  leaving the other 3 events to resurface. So users will see the bug less
  severely than today (1 row instead of N) but won't get full closure on
  group-level dismiss until the frontend does the fan-out POST.
```

---

## File paths

- Backend implementation: `backend/services/dashboard_service.py`
- New tests: `backend/tests/test_dashboard_service_grouping.py`
- Existing tests (unchanged): `backend/tests/test_dashboard_endpoint.py`,
  `backend/tests/test_dashboard_staleness.py`,
  `backend/tests/test_dashboard_service_indoor_germination.py`
- Investigation: `dev/active/production-readiness-audit/dashboard-needs-attention-row-splitting-investigation.md`
- Decision: `dev/active/production-readiness-audit/dashboard-needs-attention-row-splitting-decision.md`

DO NOT commit — parent will commit.
