# Dashboard Stale Needs-Attention — Test Report (Slice C)

## Status

- **Slice**: C — Tests and verification
- **Status**: Implemented + green
- **Date**: 2026-04-24
- **Plan**: [dashboard-stale-needs-attention-plan.md](./dashboard-stale-needs-attention-plan.md) §3 Slice C
- **Backend report**: [dashboard-stale-needs-attention-backend-report.md](./dashboard-stale-needs-attention-backend-report.md)
- **Frontend report**: [dashboard-stale-needs-attention-frontend-report.md](./dashboard-stale-needs-attention-frontend-report.md)

---

## 1. Tests Added

### 1.1 Backend (`backend/tests/test_dashboard_staleness.py`)

Two tests added to the existing `TestSnoozeAcrossBuckets` class (29 → 31 tests total in file):

| Test | Asserts |
|---|---|
| `test_expired_3day_snooze_shows_in_missed_when_aged_out` | A 3-day snooze that has since expired (`snooze_until < TODAY`) does NOT hide an item that has aged past the 14-day stale threshold. The item appears in `missed.indoorStartsDue` and NOT in `signals.indoorStartsDue`. |
| `test_active_3day_snooze_still_hides_aged_out_item` | Companion: while a 3-day snooze is still active (`snooze_until = TODAY + 1`), an aged-out item is hidden from BOTH `signals.*` and `missed.*` — verifies the invariant "snooze filter runs across both buckets" for the non-forever case. |

### 1.2 Frontend (`frontend/src/components/Dashboard/__tests__/NeedsAttentionPanel.test.tsx`)

Twelve tests added in two new describe blocks (27 → 39 tests total in file):

**`describe('Missed bucket rendering', ...)`** — 9 tests:

| Test | Asserts |
|---|---|
| `does NOT render Missed section when data.missed is absent (undefined)` | Backward compat: older backends omit `missed`; panel stays at "All clear" with no Missed summary. |
| `does NOT render Missed section when all three missed arrays are empty` | Empty `missed` object still hides the summary — no misleading "Missed (0)" chrome. |
| `renders Missed section collapsed by default with correct count label` | Summary text is exactly `Missed (N)` where N is the total across all three buckets (tested with 2+1+1 = 4). `<details>.open === false`. |
| `Missed rows are visible after the user expands the section` | Toggling `<details>.open = true` + firing the toggle event reveals the row inside. |
| `clicking a Missed row calls onNavigate with identical target to its live counterpart` | Key deep-link invariant: same `NeedsAttentionTarget` object emitted whether the row is in `signals.*` or `missed.*`. Asserts equality across two renders of the same fixture. |
| `Missed rows render with gray tone (not blue)` | CSS class check: button has `bg-gray-50 opacity-60`, lacks `bg-blue-50`. |
| `Missed row hides the Skip 3d chip but keeps Cancel task and Dismiss` | Chip inventory on an `indoor-*` row (cancellable): `Skip 3d` absent, `Cancel task` present. |
| `live (non-missed) row still shows Skip 3d chip for comparison` | Sanity companion: the same row shape in `signals.indoorStartsDue` DOES show `Skip 3d` — proves the hiding is conditional on `isMissed`, not a side-effect of the fixture shape. |
| `"All clear" empty-state hides when Missed is populated but signals are empty` | The "All clear — nothing urgent today" copy does not render when only Missed rows exist; the Missed summary renders instead. |

**`describe('Harvest isStale tone', ...)`** — 3 tests:

| Test | Asserts |
|---|---|
| `row with isStale=true renders with gray tone (not green) but is still visible` | Harvest with `isStale=true, daysPastExpected=40`: button has `bg-gray-50`, lacks `bg-green-50`, is NOT dimmed with `opacity-60` (only Missed rows get dim), and is still clickable (`disabled === false`). |
| `row with isStale=false renders with normal green tone` | Fresh harvest still green. |
| `row with isStale undefined (field absent) renders with normal green tone` | Backward compat: pre-Slice-A payloads without the field default to green. |

### 1.3 E2E (`frontend/tests/dashboard-stale-missed-bucket.spec.ts`)

One test added (new spec file):

| Test | Asserts |
|---|---|
| `stale indoor-start is absent from primary feed, present in Missed bucket, deep-links to Indoor Starts` | Full round-trip: registers a user, creates a `PlantingEvent` with `seedStartDate = 2026-03-25` via POST `/api/planting-events`, sets the backend sim clock to `2026-04-24` via POST `/api/simulation/set-date`, logs in through the UI, opens the Dashboard. Asserts (a) the API body directly confirms the event is in `missed.indoorStartsDue` and not `signals.indoorStartsDue`, (b) the primary feed does not render the row, (c) the `Missed (N)` summary appears and is collapsed, (d) clicking it reveals the row, (e) clicking the row deep-links to the Indoor Starts tab (verified by the `Start Seeds` / `From Garden Plan` buttons only visible on that tab). Cleans up the simulation clock and the test event in `afterAll`. |

---

## 2. Tests That Already Existed (No Duplication Needed)

These boundary scenarios from the Slice C task spec were already covered by the 29 existing backend tests and did not need to be re-added:

| Scenario | Already covered by |
|---|---|
| Just at threshold (e.g., `target_date - 14d`) stays in `signals` | `TestIndoorStartsStaleness::test_just_at_threshold_stays_in_signals`, and equivalents in `TestTransplantsStaleness` and `TestDirectSeedStaleness`. Each asserts the exactly-at-threshold case lives in `signals.*` and `missed.*` is empty. |
| One day past threshold moves to `missed` | `TestIndoorStartsStaleness::test_past_threshold_moves_to_missed` (`seed_start_date = TODAY - 15d`), and equivalents for transplants (`-11d`) and direct-seed (`-15d`). |
| Dismissed-forever then aged out: absent from both | `TestSnoozeAcrossBuckets::test_dismiss_before_stale_does_not_resurface_in_missed` and `test_dismiss_stale_transplant_absent_from_missed` (both use `snooze_until=date(9999, 12, 31)` and assert absence from both `signals.*` and `missed.*`). |

Only the **snoozed-3-days-then-aged-out-after-snooze-expires** scenario was missing — added as `test_expired_3day_snooze_shows_in_missed_when_aged_out`. The companion active-snooze case was added alongside (`test_active_3day_snooze_still_hides_aged_out_item`) because the pair is what actually tests "filter runs across both buckets" for the non-forever path.

---

## 3. Test Results

### Backend
```
cd backend && python -m pytest tests/test_dashboard_staleness.py -v
...
31 passed, 30 warnings in 9.84s
```

Sanity pass on the broader dashboard suite to check for regressions:
```
cd backend && python -m pytest tests/test_dashboard_staleness.py tests/test_dashboard_endpoint.py -q
66 passed, 65 warnings in 19.99s
```

### Frontend
```
cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern="NeedsAttentionPanel"
...
Test Suites: 1 passed, 1 total
Tests:       39 passed, 39 total
Time:        4.377 s
```

### E2E
```
cd frontend && npx playwright test tests/dashboard-stale-missed-bucket.spec.ts --reporter=list
  ok 1 [chromium] › tests\dashboard-stale-missed-bucket.spec.ts:81:7 ... (7.1s)
  1 passed (13.2s)
```

Both servers were running during the run (backend :5000, frontend :3000).

---

## 4. E2E Scaffolding Observations

No prior E2E tests in `frontend/tests/` exercise the simulation clock endpoints. The sim clock endpoints are well-documented and easy to call directly (`POST /api/simulation/set-date`, `POST /api/simulation/advance`, `GET /api/simulation/status`), so no new fixture file or helper was needed — the new spec sets and clears the sim clock inline in `beforeAll` / `afterAll`. Future dashboard-timing E2E work could factor that into a helper (e.g., `helpers/simulation.ts`) but it wasn't worth doing for one test.

Minor fixture note: `POST /api/planting-events` requires `expectedHarvestDate` as a required field (400 if omitted). I set it to `2026-08-01` (~90 days past sim today) so the event doesn't also surface as a `harvestReady` row that would clutter the primary feed and obscure the stale-row assertion.

---

## 5. Bugs Uncovered

None. All new backend, frontend, and E2E tests passed on the first fully-wired run. The Slice A and Slice B implementations hold up against the boundary, backward-compat, and deep-link invariants the plan calls out.

---

## 6. Final Test Count Delta

| Layer | Before | After | Delta |
|---|---|---|---|
| `backend/tests/test_dashboard_staleness.py` | 29 | 31 | +2 |
| `frontend/.../NeedsAttentionPanel.test.tsx` | 27 | 39 | +12 |
| `frontend/tests/` (E2E) | — | — | +1 new spec file (1 test) |

15 new tests in total across the three layers.

---

*Prepared 2026-04-24. Slice C complete — ready for code-review.*
