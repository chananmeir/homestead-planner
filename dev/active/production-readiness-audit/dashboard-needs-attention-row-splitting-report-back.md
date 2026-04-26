# Dashboard Needs-Attention Row-Splitting — Report Back (2026-04-25)

Option 1 shipped per `dashboard-needs-attention-row-splitting-decision.md`.

| Commit | Type | Content |
|---|---|---|
| **`9feae3b`** | `fix:` | Backend grouping in 8 builders + 22 tests |
| **`e0d0296`** | `fix:` | Frontend grouped row + snooze fan-out + 8 tests |

## Exact builders grouped

| Builder | Composite key |
|---|---|
| `_build_harvest_ready` | `(harvest_date, plant_id, variety, bed_id)` |
| `_build_indoor_starts_due` PE | `(seed_start_date, plant_id, variety)` |
| `_build_indoor_starts_due` ISS | `(start_date, plant_id, variety)` — `indoorSeedStartIds` |
| `_build_transplants_due` | `(transplant_date, plant_id, variety, bed_id)` |
| `_build_direct_seed_due` | `(direct_seed_date, plant_id, variety, bed_id)` |
| `_build_germination_check` | `(direct_seed_date, plant_id, variety, bed_id)` |
| `_build_indoor_germination_check` PE | `(seed_start_date, plant_id, variety)` |
| `_build_indoor_germination_check` ISS | `(start_date, plant_id, variety)` — `indoorSeedStartIds` |

Singletons + per-entity builders untouched.

## Exact grouped payload shape

```python
{
    'signalKey': 'indoor-1234',                    # representative (min event id)
    'plantingEventId': 1234,                       # representative — for D2 deep-link
    'plantingEventIds': [1234, 1235, 1236, 1237],  # ALL members — NEW, for D3 fan-out
    'plantName': 'Beet',
    'variety': 'Detroit Dark Red',
    'seedStartDate': '2026-04-14',
    'quantity': 32,                                # SUM of group; None → 0
}
```

ISS-path adds `indoorSeedStartIds: int[]`. Harvest-ready adds aggregated `daysPastExpected` (MAX) + `isStale` (ANY). Singletons emit `plantingEventIds: [event.id]` length 1 — byte-identical legacy shape.

## How snooze behaves on grouped rows

- **Backend**: `signalKey = 'indoor-1234'` (representative). Snoozing the representative key hides the entire grouped row.
- **Frontend** (D3 — no bulk endpoint): handler fans out `Promise.all([...].map(id => POST {signalKey: 'indoor-${id}'}))`. Reconstructs each member's signalKey from the prefix templated against `plantingEventIds`. Same fan-out for dismiss + undo (a `pendingDismissKeysRef` Map captures the key set at dismiss time so Undo restores all members).
- **Singletons**: `plantingEventIds.length === 1` or undefined → single POST, no badge, identical to legacy behavior.

## Build / test results

- `test_dashboard_service_grouping.py`: **22 passing** (new file)
- Existing dashboard tests: **39 + 27 + 14 = 80 passing** (untouched)
- Backend full suite: **1358 passed** (2 pre-existing geocoding network failures unrelated)
- `npx tsc --noEmit` → exit 0
- `NeedsAttentionPanel.test.tsx`: **47 passing** (39 pre-existing + 8 new)
- `ListView` regression: **3/3 passing**
- `code-review`: **APPROVE**. 0 critical / 0 warnings / 2 minor non-blocking suggestions

Out of scope per decision: multi-id `NeedsAttentionTarget`, backend bulk-snooze endpoint.
