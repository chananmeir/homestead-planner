# Dashboard Stale Needs-Attention — Backend Report (Slice A)

## Status

- **Priority**: `P1`
- **Slice**: `A — Backend rule engine`
- **Status**: `Implemented + tests green`
- **Date**: 2026-04-24
- **Plan**: [dashboard-stale-needs-attention-plan.md](./dashboard-stale-needs-attention-plan.md)
- **Finding**: [dashboard-stale-needs-attention-finding.md](./dashboard-stale-needs-attention-finding.md)

---

## 1. Files Changed

| File | Change |
|---|---|
| `backend/services/dashboard_service.py` | Added 5 staleness constants; rewrote `_build_harvest_ready`, `_build_indoor_starts_due`, `_build_transplants_due`, `_build_direct_seed_due`, `_build_germination_check`, `_build_indoor_germination_check`; rewrote `build_dashboard_today()` to emit a top-level `missed` block; extended snooze filter to run across `signals.*` AND `missed.*`. |
| `backend/tests/test_dashboard_staleness.py` | **New file**, 29 tests covering all types x (fresh / just-at-threshold / past-threshold / dismissed / user-isolation). |
| `backend/tests/test_dashboard_endpoint.py` | Updated one existing test (`test_guard_suppresses_transplant_row_when_seed_start_passed_and_incomplete`) whose fixture (`seed_start_date=2026-03-15`, TODAY=2026-04-14 → 30d past) now aligns with the new missed-bucket contract. Original companion-signal assertion preserved but now reads from `body['missed']['indoorStartsDue']`. |

No schema changes. No model changes. No migrations.

---

## 2. API Contract Delivered (matches plan §3 Slice A exactly)

```
{
  "date": "2026-04-24",
  "signals": {
    "harvestReady":        [ { ..., "isStale": bool } ],       // NEVER drops
    "indoorStartsDue":     [ ...active only ],
    "transplantsDue":      [ ...active only ],
    "directSeedDue":       [ ...active only ],
    "germinationCheck":    [ ... ],                             // silently drops past threshold
    "indoorGerminationCheck": [ ... ],                          // silently drops past threshold
    "frostRisk": {...}, "rainAlert": {...},
    "compostOverdue": [...], "seedLowStock": [...],
    "seedExpiring": [...], "livestockActionsDue": [...]
  },
  "missed": {
    "indoorStartsDue":  [ ...aged-out ],
    "transplantsDue":   [ ...aged-out ],
    "directSeedDue":    [ ...aged-out ]
  },
  "meta": { "generatedAt": "...", "userTimezone": "UTC" }
}
```

**Staleness constants** (module-level in `dashboard_service.py`):

```python
STALE_INDOOR_START_DAYS = 14       # indoorStartsDue (both PE and ISS paths)
STALE_TRANSPLANT_DAYS = 10         # transplantsDue
STALE_DIRECT_SEED_DAYS = 14        # directSeedDue
STALE_GERMINATION_CHECK_DAYS = 14  # both germinationCheck and indoorGerminationCheck
HARVEST_DEMOTION_DAYS = 14         # harvestReady.isStale flag only — never drops
```

Boundary: `days_past > THRESHOLD` moves to `missed`. Exactly-at-threshold stays in `signals` (verified by tests).

**Signal-key format unchanged** — `harvest-{id}`, `indoor-{id}`, `indoor-iss-{id}`, `transplant-{id}`, `direct-seed-{id}`, `germination-{id}`, `indoor-germ-iss-{id}`, `indoor-germ-pe-{id}`. Frontend deep-link routing and `getCancellableAction()` prefix parsing untouched.

---

## 3. Contract Invariants Verified

| Invariant | Test |
|---|---|
| `PlantingEvent.completed` / `quantity_completed` untouched by staleness | `TestIndoorStartsStaleness::test_does_not_mutate_planting_event` |
| `IndoorSeedStart.status` stays `'planned'` when ISS ages out | `TestIndoorStartsIssStaleness::test_stale_iss_moves_to_missed_and_status_unchanged` |
| `harvestReady` NEVER drops regardless of age (integrity-sensitive) | `TestHarvestReadyStaleFlag::test_past_threshold_is_stale_but_still_in_signals`, `test_far_past_harvest_still_present` |
| `harvestReady[].isStale = true` iff `daysPastExpected > 14` | All `TestHarvestReadyStaleFlag` tests |
| Germination checks drop silently (no `missed.germinationCheck` key) | `TestGerminationCheckSilentDrop::test_stale_germ_check_dropped_silently` |
| Dismissed item does not resurface in `missed.*` after aging out | `TestSnoozeAcrossBuckets` (both tests) |
| User B cannot see User A's `missed.*` rows | `TestMissedUserIsolation::test_user_b_does_not_see_user_a_missed_items` |
| Exactly-at-threshold stays in `signals`; threshold + 1 moves to `missed` | `test_just_at_threshold_stays_in_signals` + `test_past_threshold_moves_to_missed` per type |

---

## 4. Test Results

```
backend/tests/test_dashboard_staleness.py        29 passed
backend/tests/test_dashboard_endpoint.py         22 passed (1 test updated for new contract)
backend/tests/test_dashboard_service_indoor_germination.py   27 passed
-------
dashboard suite total                            78 passed
```

Full suite: `1328 passed, 1 xfailed, 2 failed` — the 2 failures (`test_geocoding_service.py`) are pre-existing and unrelated (geocoding API lookups, documented in backend-debugger MEMORY.md).

---

## 5. Deviations from Plan

None substantive. Three minor implementation choices worth noting:

1. **Builder return shape**: Plan §3 Slice A step 1 said "each builder returns two lists: `active` and (for the three bucketable types) `missed`". I implemented this as a `dict` `{'active': [...], 'missed': [...]}` to keep the three bucketable builders' signatures consistent and unambiguous at the call site in `build_dashboard_today()`. Non-bucketable builders still return plain lists/dicts as before. This is internal to `dashboard_service.py` — no API surface change.

2. **SIGNAL_CAP applied per bucket**: Each bucketable builder caps `active` at `SIGNAL_CAP` AND caps `missed` at `SIGNAL_CAP` independently (so the maximum rows per type is now 2×SIGNAL_CAP = 40). The plan's over-fetch limit of `SIGNAL_CAP * 3` rows from SQL remains intact, so this doesn't add any new N+1 or memory pressure. Plan §5 performance note is still satisfied.

3. **ISS-path indoor-germ silent drop also records the linked_event_id**: When an `indoor-germ-iss-*` row is silently dropped, the code still adds its `planting_event_id` to `linked_event_ids` so the PE-path fallback won't surface the same underlying seed start with a different `signalKey`. This matches the existing dedup invariant — without it, an ISS record with a linked PE could yield an `indoor-germ-pe-{id}` row after the ISS row was stale-dropped, which would violate the silent-drop semantics.

---

## 6. Notes for the Frontend Agent (Slice B)

**Top-level payload now has a new `missed` key**. Existing Slice B agent should:

1. Extend `DashboardToday` type: `missed: DashboardMissed` where `DashboardMissed` has `indoorStartsDue`, `transplantsDue`, `directSeedDue` — no other keys.
2. Row shapes inside `missed.*` are **identical** to the `signals.*` row shapes (same fields, same `signalKey` prefixes). They can reuse `indoorStartRow`, `transplantRow`, `directSeedRow`.
3. `harvestReady` rows now carry `isStale: boolean`. Use it for tone demotion (plan §2.2 "demote tone to gray after 14 days").
4. `signals.indoorStartsDue` / `transplantsDue` / `directSeedDue` are now **active-only** — a dashboard with only stale items will have empty arrays here, which is correct new behavior.
5. Snooze/dismiss POST endpoints are **unchanged**. Sending a `signalKey` dismiss for a row in `missed.*` works identically to dismissing from `signals.*` (both filtered by the same snooze set server-side).

**One caveat worth surfacing**: the regression test I updated (`test_guard_suppresses_transplant_row_when_seed_start_passed_and_incomplete`) moves a seed-start-past-threshold item into `missed.indoorStartsDue`. This means the "companion signal still surfaces" property now requires the frontend to either (a) render the `missed` bucket so the user can see it, or (b) accept that very-old missed starts are only visible when the user expands the Missed section. This is a product decision captured in plan §4 open question #1.

---

## 7. Unresolved Issues

None blocking. Open product questions from plan §4 (threshold values, Missed bucket visibility, snooze semantics on Missed rows) remain for product to confirm — backend accepts whatever the frontend chooses to render and the thresholds are single-line constants to tune.

---

## 8. Cross-Domain Alert

```
CROSS_DOMAIN_ALERT:
- Modified: backend/services/dashboard_service.py (build_dashboard_today response shape)
- Requires sync: frontend/src/components/Dashboard/types.ts (add `missed` + `isStale`),
  frontend/src/components/Dashboard/NeedsAttentionPanel.tsx (render missed bucket,
  consume `isStale` for harvest tone)
- What changed: Top-level response now has `{signals, missed, meta}` instead of
  `{signals, meta}`. `harvestReady` rows gain `isStale: boolean`. `signals.*`
  arrays are filtered to active-only for indoorStartsDue/transplantsDue/directSeedDue —
  frontend will see fewer rows there until it consumes `missed.*`.
- Urgency: RECOMMENDED — frontend still compiles and renders (missing fields default
  to undefined), but stale items will become invisible until Slice B ships.
```

User already flagged in the task that Slice B is being done in parallel by `frontend-debugger` against this exact contract, so the sync is already in flight.
