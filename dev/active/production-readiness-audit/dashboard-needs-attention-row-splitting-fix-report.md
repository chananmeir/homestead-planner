# Dashboard Needs-Attention Row-Splitting — Fix Report (2026-04-25)

Option 1 from `dashboard-needs-attention-row-splitting-decision.md`
shipped. Fourth surface in the row-splitting follow-up series after
CalendarGrid pills (existing), ListView (commit `47a0e4a`), and
DayDetailModal (commit `2dd7c57`).

---

## Exact builders grouped

`backend/services/dashboard_service.py`, 8 paths total:

| Builder | Composite key |
|---|---|
| `_build_harvest_ready` | `(expected_harvest_date, plant_id, variety, garden_bed_id)` |
| `_build_indoor_starts_due` (PE path) | `(seed_start_date, plant_id, variety)` |
| `_build_indoor_starts_due` (ISS path) | `(start_date, plant_id, variety)` — output uses `indoorSeedStartIds` |
| `_build_transplants_due` | `(transplant_date, plant_id, variety, garden_bed_id)` |
| `_build_direct_seed_due` | `(direct_seed_date, plant_id, variety, garden_bed_id)` |
| `_build_germination_check` | `(direct_seed_date, plant_id, variety, garden_bed_id)` |
| `_build_indoor_germination_check` (PE path) | `(seed_start_date, plant_id, variety)` |
| `_build_indoor_germination_check` (ISS path) | `(start_date, plant_id, variety)` — output uses `indoorSeedStartIds` |

Untouched (out of scope, not affected by per-event splitting):
- Singletons: `_build_frost_risk`, `_build_rain_alert`, `_build_livestock_actions`
- Per-entity: `_build_compost_overdue`, `_build_seed_low_stock`, `_build_seed_expiring`

---

## Exact grouped payload shape

**PE path** (e.g., `indoorStartsDue` PE):
```python
{
    'signalKey': 'indoor-1234',                    # representative event id (lowest in group)
    'plantingEventId': 1234,                       # representative event
    'plantingEventIds': [1234, 1235, 1236, 1237],  # ALL members, sorted ascending — NEW
    'indoorSeedStartId': None,                     # PE path
    'plantName': 'Beet',
    'variety': 'Detroit Dark Red',
    'seedStartDate': '2026-04-14',
    'quantity': 32,                                # SUM of group; None coerced to 0
}
```

**ISS path** (e.g., standalone `IndoorSeedStart` rows):
```python
{
    'signalKey': 'indoor-iss-99',
    'plantingEventId': 7,                          # carried from any member that links a PE; else None
    'indoorSeedStartId': 99,                       # representative ISS
    'indoorSeedStartIds': [99, 100, 101],          # ALL ISS members — NEW
    'plantName': 'Lettuce',
    'variety': 'Buttercrunch',
    'seedStartDate': '2026-04-14',
    'quantity': 60,
}
```

**Harvest-ready** adds aggregated fields:
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
    'daysPastExpected': 20,                        # MAX across group (clamped >= 0 per-event)
    'isStale': True,                               # any(days_past > HARVEST_DEMOTION_DAYS)
}
```

**Singletons** preserve legacy shape — `plantingEventIds: [event.id]` length 1, `signalKey` byte-identical to pre-change.

Variety normalization: empty string → None for key consistency, mirroring the calendar surfaces' `variety || 'none'` default.

---

## How snooze behaves on grouped rows

**Backend**: snooze table key remains per-`signalKey`. Snoozing the representative key (e.g., `indoor-1234`) hides the entire grouped row from the dashboard because the row's `signalKey` is what the snooze filter checks. Verified by `TestSnoozeRepresentativeBehavior::test_snoozing_representative_signalkey_hides_whole_group`.

**Frontend** (per D3 — no bulk-snooze endpoint added):
- `buildGroupSignalKeys(prefix, ids, fallbackKey)` reconstructs each member's signalKey by templating `${prefix}-${id}` per id (the backend's signalKey shape is `f'{prefix}-{event_id}'`).
- `mergeGroupSignalKeys(a, b)` merges PE + ISS prefixes for indoor-starts and indoor-germination ISS-path rows.
- `handleSnooze` and `handleDismiss` accept `string | string[]`; fan out via `Promise.all([...].map(key => POST one signalKey))`.
- `handleUndo` also fans out DELETE across captured keys (`pendingDismissKeysRef` Map captures the key set at dismiss time so Undo restores all members).

Singletons (`plantingEventIds.length === 1` or undefined) behave identically to today — no `(N)` badge, single POST. Regression-guarded.

Click target: preserved as single representative `plantingEventId` per D2 (lossy deep-link; `NeedsAttentionTarget` shape unchanged).

---

## Files changed

**Backend**:
- `backend/services/dashboard_service.py` — 8 builder paths refactored to group same-key events; new `from collections import defaultdict` import.
- `backend/tests/test_dashboard_service_grouping.py` — NEW file, 22 tests.

**Frontend**:
- `frontend/src/components/Dashboard/types.ts` — 6 row interfaces add `plantingEventIds?: number[]`. 2 also add `indoorSeedStartIds?: number[]`.
- `frontend/src/components/Dashboard/NeedsAttentionPanel.tsx` — helpers + handler fan-out + row builder counts/badges + dismiss-undo invariant.
- `frontend/src/components/Dashboard/__tests__/NeedsAttentionPanel.test.tsx` — 8 new tests under `describe('Grouped rows', ...)`.

---

## Commits

- **`9feae3b`** — `fix: Group same-task dashboard signals to one row per logical task` (backend)
- **`e0d0296`** — `fix: Dashboard panel renders grouped rows + fans out snooze across members` (frontend)
- _(this report)_ — `docs:` follow-up

---

## Build / test results

**Backend**:
- `test_dashboard_service_grouping.py`: **22 passed** (new)
- `test_dashboard_endpoint.py`: **39 passed** (untouched)
- `test_dashboard_staleness.py`: **27 passed** (untouched)
- `test_dashboard_service_indoor_germination.py`: **14 passed** (untouched)
- Full backend suite: **1358 passed**, 2 pre-existing geocoding network failures unrelated, 1 xfailed

**Frontend**:
- `npx tsc --noEmit` → exit 0
- `NeedsAttentionPanel.test.tsx`: **47 passed** (39 pre-existing + 8 new)
- `ListView` regression: **3 passed** (no bleed)

**Code review**: `code-review` agent verdict — **APPROVE**. 0 critical, 0 warnings, 2 minor non-blocking suggestions (empty-string sentinel readability + redundant `any_stale` comparison — both stylistic, not bugs).

---

## Out of scope (deferred)

- **Multi-id deep-link target** (`NeedsAttentionTarget` with `plantingEventIds: number[]`): would let click highlight all underlying events in destination view. Currently lands on representative only. Future enhancement if requested.
- **Backend bulk-snooze endpoint** (D3): frontend fans out N POSTs. Future optimization if performance matters.
- **Atomic snooze across remount/page-reload of pendingDismissKeysRef Map**: Map is in-memory only; refresh during the undo window loses the captured key set, but the snooze records persist in DB. Acceptable given the small undo window.
