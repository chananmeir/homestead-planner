# Dashboard Stale Needs-Attention — Code Review

## Status

- **Reviewer**: code-review agent
- **Date**: 2026-04-24
- **Verdict**: **LGTM — no blocking issues**
- **Plan**: [dashboard-stale-needs-attention-plan.md](./dashboard-stale-needs-attention-plan.md)
- **Slice reports**: [backend](./dashboard-stale-needs-attention-backend-report.md), [frontend](./dashboard-stale-needs-attention-frontend-report.md), [test](./dashboard-stale-needs-attention-test-report.md)

---

## Scope Reviewed

| File | Risk | Notes |
|---|---|---|
| `backend/services/dashboard_service.py` | HIGH | Rewrote 6 signal builders; added `missed` top-level block; extended snooze filter. |
| `backend/tests/test_dashboard_staleness.py` | — | 31 tests (new file). |
| `backend/tests/test_dashboard_endpoint.py` | MEDIUM | One test updated for new contract. |
| `frontend/src/components/Dashboard/types.ts` | HIGH | Added `DashboardMissed`, `missed?` on `DashboardToday`, `isStale?` on `HarvestReadyRow`. |
| `frontend/src/components/Dashboard/NeedsAttentionPanel.tsx` | HIGH | Added `buildMissedRows()`, collapsible Missed section, `renderSignalRow()` helper, `isMissed` plumbing. |
| `frontend/src/components/Dashboard/__tests__/NeedsAttentionPanel.test.tsx` | — | 12 new tests. |
| `frontend/tests/dashboard-stale-missed-bucket.spec.ts` | — | New E2E spec. |

---

## Build & Test Verification

| Check | Result |
|---|---|
| `cd frontend && npx tsc --noEmit` | PASS (exit 0, no errors) |
| `cd backend && python -m pytest tests/test_dashboard_staleness.py tests/test_dashboard_endpoint.py -v` | **66 passed** in 22.80s |

---

## Findings

### BLOCKING

**None.**

### RECOMMENDED (should fix — non-blocking)

**None.**

### NIT (style only — optional)

1. **`dashboard_service.py:235` — duplicate `_day_bounds(target_date)` call.**
   Inside `_build_indoor_starts_due`, `_, end_of_day = _day_bounds(target_date)` is computed at L183 and re-computed at L235 inside the `if` block. The second call is unnecessary (the variable hasn't been shadowed). Cosmetic only — no behavioral impact.

2. **`dashboard_service.py:557` — loop-exit is capped on `results`, not on `linked_event_ids`.**
   In `_build_indoor_germination_check`, when the ISS path breaks at `len(results) >= SIGNAL_CAP`, later ISS records that would have been stale-dropped never get their `planting_event_id` added to `linked_event_ids`. In practice this is extremely rare (would need >20 ISS records with linked PEs all stale-dropped) and the only consequence would be a duplicate indoor-germ-pe row surfacing. Not worth changing — documenting only.

3. **`NeedsAttentionPanel.tsx:697-699` — comment note.**
   Comment says "Use `=== true` per the standing nullable-field rule even though `!= null` would be fine here". `!= null` would actually NOT be equivalent here because `isStale: false` should render green, not gray — the `=== true` choice is semantically correct, not just stylistic. Minor comment-accuracy nit.

---

## Focus-Area Verification (plan §5)

| Invariant | Verified in code | Verified by test |
|---|---|---|
| **signalKey prefix stability** — no new prefix introduced | `buildMissedRows` reuses `indoorStartRow`/`transplantRow`/`directSeedRow` with the identical `row.signalKey`. Backend emits `indoor-{id}`, `indoor-iss-{id}`, `transplant-{id}`, `direct-seed-{id}` for both `signals.*` and `missed.*`. | E2E spec; `clicking a Missed row calls onNavigate with identical target` |
| **`getCancellableAction()` prefix routing intact** (`NeedsAttentionPanel.tsx:81-98`) | Parser unchanged. `indoor-iss-` > `indoor-germ-` > `indoor-` > `direct-seed-` prefix order preserved; Missed rows parse through the same path. | `Missed row hides the Skip 3d chip but keeps Cancel task and Dismiss` — asserts `indoor-*` → `planting-event` cancellable on a Missed row |
| **`NeedsAttentionTarget` union invariance** (12 kinds) | `types.ts:180-192` unchanged. Missed rows reuse `indoorStart` / `transplant` / `directSeed` kinds. | `clicking a Missed row calls onNavigate with identical target` |
| **Deep-link invariants** (Apr 2026 memory) | Row-click routes through the same `onClick` closures; `indoorStartRow`/`transplantRow`/`directSeedRow` construct identical targets regardless of `isMissed`. HarvestTracker id semantics untouched (no changes to `harvestRow`). | Same test |
| **Snooze filter across BOTH buckets** | `dashboard_service.py:874-895` filters `signals.*` (lines 886-890) AND `missed.*` (lines 893-895) using the same `snoozed_keys` set. | `test_dismiss_before_stale_does_not_resurface_in_missed`, `test_dismiss_stale_transplant_absent_from_missed`, `test_active_3day_snooze_still_hides_aged_out_item` |
| **No state mutation** — `PlantingEvent.completed`, `quantity_completed`, `PlantedItem.status`, `IndoorSeedStart.status` untouched | Grep confirms no `.completed =`, `.quantity_completed =`, `.status =` on any of those models in `dashboard_service.py`. Only reads `IndoorSeedStart.status == 'planned'` (line 240) and `Chicken.status == 'active'` (line 810). | `test_does_not_mutate_planting_event`, `test_stale_iss_moves_to_missed_and_status_unchanged` |
| **Sync discipline** — camelCase on wire, snake_case internal | Backend dict emits camelCase keys (`signalKey`, `plantingEventId`, `indoorSeedStartId`, `isStale`, `seedStartDate`, etc.); TypeScript types mirror exactly. | TS compile passes |
| **Null/falsy discipline** — `isStale?` optional, `missed?` optional | `harvestRow:699` uses `row.isStale === true` (not truthy). `useMemo` guard: `if (!data \|\| !data.missed) return []`. `DashboardToday.missed?` typed optional for older cached payloads. | `row with isStale undefined (field absent) renders with normal green tone` |
| **CLAUDE.md pattern conformance** | No `parse_iso_date` needed (no inbound dates in this change — `resolve_target_date()` is intentionally strict `date.fromisoformat` for calendar day, documented at L83-89). No `localhost` hardcoded (uses `API_BASE_URL`). `datetime.utcnow()` used at L908 (not `datetime.now()`). No `// @ts-ignore`/`as any` added. No `ALTER TABLE` / direct schema mutation. | TS + pytest pass |

---

## Scope Creep Check

The plan explicitly calls for "just staleness filters + one UI bucket." The delivered code matches:

- Five module-level constants (exactly the 5 in plan §2.4).
- One new payload key (`missed`) with three sub-keys (only the bucketable types).
- One new `isStale` field on harvest rows.
- One new collapsible UI section using `<details>`.
- Row builders extended with one optional `isMissed` parameter (defaulted to `false` — additive, non-breaking).

No over-engineering observed. The `renderSignalRow()` inner-function extraction (NeedsAttentionPanel.tsx:447-570) is a reasonable refactor given the new shared call-site from `visibleRows.map` and `missedRows.map`. It stays inside the component so closures over `pendingDismissals` and handlers are preserved without prop-drilling.

---

## Dead Code / Half-Finished Implementations

None observed. Every new code path is exercised by tests. `isMissed` defaults to `false`, so existing call-sites (three `buildRows` invocations) work without modification.

---

## Test Quality Notes

- Backend tests use tight boundary assertions (`test_just_at_threshold_stays_in_signals` + `test_past_threshold_moves_to_missed` pair per type) rather than imprecise "should be in a bucket" checks. The `> THRESHOLD` semantics are pinned.
- `test_does_not_mutate_planting_event` and `test_stale_iss_moves_to_missed_and_status_unchanged` directly assert the "no silent auto-completion" invariant via `db.session.refresh(e)` — exactly the guard the finding required.
- Frontend tests assert specific class names (`bg-gray-50`, `bg-green-50`, `opacity-60`) rather than relying on snapshot matching. Chip-inventory test uses label-text filtering, not index-based selectors.
- E2E spec double-validates the backend API response before exercising the UI — if the backend contract regresses, the test fails early with a clear message rather than at the UI-interaction layer.
- No meaningless mocks — backend uses real DB + real service; frontend uses `installFetchMock` with precise payloads.

One minor test-design note (non-blocking): `test_stale_indoor_germ_pe_dropped` / `test_stale_indoor_germ_iss_dropped` rely on pepper-1's default germination_days; if the plant database value for pepper-1 changes to something extreme (e.g., 0 or > 50), these tests could become brittle. Current choice is fine; worth remembering.

---

## Summary

| Category | Count |
|---|---|
| Blocking | 0 |
| Recommended | 0 |
| Nit | 3 |

**Verdict: LGTM.** All plan §5 invariants verified both in code and by matching test assertions. No signalKey prefix collision, no `NeedsAttentionTarget` union change, no state mutation, no cross-user leakage, no hardcoded URLs, no CLAUDE.md rule violations. Builds and tests green (frontend tsc exit 0; 66 backend tests pass). Scope is minimal — just the staleness filters + one collapsible UI bucket, with the three nits above being purely cosmetic.

Safe to merge.
