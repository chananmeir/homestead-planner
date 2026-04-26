# Dashboard Needs-Attention Row-Splitting — Report Back (2026-04-25)

Option 1 shipped. Three commits:

| Commit | Type | Content |
|---|---|---|
| **`9feae3b`** | `fix:` | Backend grouping in 8 builders + 22 tests |
| **`e0d0296`** | `fix:` | Frontend grouped row + snooze fan-out + 8 tests |
| `175ee57` | `docs:` | decision + backend-implementation + fix-report + report-back |

## Report-back

**Exact builders grouped:**

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

**Exact grouped payload shape:**
```python
{
  'signalKey': 'indoor-1234',                    # representative (min event id)
  'plantingEventId': 1234,                       # representative — for D2 deep-link
  'plantingEventIds': [1234, 1235, 1236, 1237],  # ALL members — NEW, for D3 fan-out
  'plantName': 'Beet',
  'variety': 'Detroit Dark Red',
  'seedStartDate': '2026-04-14',
  'quantity': 32,                                # SUM; None → 0
}
```
ISS-path adds `indoorSeedStartIds: int[]`. Harvest-ready adds aggregated `daysPastExpected` (MAX) + `isStale` (ANY). Singletons emit `plantingEventIds: [event.id]` length 1 — byte-identical legacy shape.

**Snooze behavior:**
- **Backend**: representative key (`indoor-{lowest_event_id}`) hides the whole grouped row from the dashboard.
- **Frontend** (D3 — no bulk endpoint): handler fans out `Promise.all([...].map(id => POST {signalKey: '${prefix}-${id}'}))`. Same fan-out for snooze, dismiss, and undo (a `pendingDismissKeysRef` Map captures the key set at dismiss time so Undo restores all members).
- **Singletons**: identical to legacy behavior — single POST, no badge.

**Build / test results:**
- `test_dashboard_service_grouping.py`: **22/22 passing** (new file)
- Existing dashboard tests: **39 + 27 + 14 = 80 passing** (untouched)
- Backend full suite: **1358 passed** (2 pre-existing geocoding failures unrelated)
- `npx tsc --noEmit` → exit 0
- `NeedsAttentionPanel.test.tsx`: **47/47 passing** (39 + 8 new)
- ListView regression: **3/3 passing**
- `code-review` verdict: **APPROVE**. 0 critical / 0 warnings / 2 minor non-blocking suggestions

This was the fourth and final surface of the row-splitting series — calendar surfaces (CalendarGrid pills, ListView, DayDetailModal) and the dashboard now share the same composite-key grouping shape.
