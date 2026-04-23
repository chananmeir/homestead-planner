# AUDIT-011 Fix Report — Active-Plan Scoping for Import Modal (2026-04-23)

Implementation of Option A per `audit-011-scope-decision.md`, with
null-`export_key` handling option (ii) ("include with Unknown plan
label"). Retest had flagged that the earlier Option B ship (commit
`5d713b9`) labeled rows correctly but still returned them cross-plan;
this ships the scoping filter.

---

## Commit

```
a33b921 fix: Scope import-events endpoint to active plan (AUDIT-011)
```

Cross-stack (backend + frontend + regression tests) in one commit per
the scope-decision directive. Not yet pushed.

---

## Exact backend filter behavior

**Endpoint**: `GET /api/planting-events/needs-indoor-starts`

**New query param**: `?planId=<int>` (optional)

| Input | Behavior |
|---|---|
| Omitted / `None` / empty | Preserves current cross-plan behavior (backward compat) |
| Non-integer / `<=0` / malformed | `400 {error: 'planId must be a positive integer'}` |
| Valid int not owned by current_user | `404 {error: 'Plan not found'}` — no cross-user leak |
| Valid + owned | Filter runs **after** the existing plan-attribution batch lookup, so the lookup stays free and shared: keep events whose resolved `plan_id` matches, **plus** events with `export_key=None` or unresolvable key. Drop events attributable to other known plans. |

**Response shape unchanged.** Group key unchanged. All other existing
filters (date range, indoor-start exclusion, etc.) unchanged.
`planId` / `planName` per-row fields still emitted per commit
`5d713b9`.

---

## Exact frontend re-fetch behavior

**File**: `frontend/src/components/IndoorSeedStarts/ImportFromGardenModal.tsx`

1. **URL builder** — appends `?planId=${activePlan.id}` when
   `activePlan?.id` is set; omits the param when no active plan.
2. **useEffect dep array** — gains `activePlan?.id` so the modal
   re-fetches when the user switches active plan mid-session (fixes the
   stale-fetch latent bug identified as suspect #2 in the retest
   investigation).
3. **404 handler** — new branch surfaces "Plan not found" as a specific
   toast (covers stale activePlan id after deletion in another tab).
4. **Header disclaimer** — adapts to scope:
   - Active plan set: "Rows are scoped to this plan. Unattributed
     events are also shown."
   - No active plan: "No active plan selected — showing events across
     all your plans."

---

## How `Unknown plan` rows appear under scoped mode

Events with `export_key = None` OR export_key values that don't
resolve to any `GardenPlanItem` are:

- **Retained** by the backend filter even when `planId` is being
  scoped (option (ii) from `audit-011-scope-decision.md`).
- Returned with `planId: null` and `planName: null` in the response
  (unchanged from commit `5d713b9`).
- Rendered with the existing `Unknown plan` badge in the modal's Bed
  cell — no frontend rendering change needed; the branch from commit
  `5d713b9` still fires on null `planId`.

**Net user experience**: when an active plan is set, the modal shows
scope-plan rows mingled with any null-plan rows visually
distinguished by an `Unknown plan` pill. No legitimate planting work
is hidden.

---

## Test results

### New tests (`backend/tests/test_needs_indoor_starts_plan_attribution.py` — 6 added)

- `test_plan_id_filter_returns_only_matching_plan_rows`
- `test_plan_id_filter_includes_null_export_key_rows`
- `test_plan_id_filter_excludes_other_plans_even_when_group_key_would_merge`
- `test_plan_id_filter_rejects_other_users_plan` → 404 no leak
- `test_plan_id_filter_rejects_malformed_value` (parametrized:
  `'abc'`, `-1`, `0`, `1.5`, `' '` → all 400)
- `test_omitted_plan_id_preserves_cross_plan_behavior`

### Full backend suite

- **1284 passed, 2 failed, 1 xfailed** — the 2 failures are the
  pre-existing `test_geocoding_service.py` network-dependent tests
  (unrelated, same as every prior audit commit this session).

### Frontend build

- `npm run build` — compiled successfully. Bundle +63 B gzipped.

### Frontend tests

- `IndoorSeedStarts.focus.test.tsx` (2 tests) still passes. No tests
  cover `ImportFromGardenModal` fetch behavior — flagged as a
  coverage gap for a future `test-engineer` pass.

---

## Scope

- 3 production files touched:
  `backend/blueprints/gardens_bp.py` (~42 lines added inside the
  needs-indoor-starts endpoint, cleanly separable from the
  pre-existing `cancelled_at` workstream changes in the same file),
  `frontend/src/components/IndoorSeedStarts/ImportFromGardenModal.tsx`
  (20 insertions / 7 deletions), and the new regression tests.
- Total: 210 insertions / 7 deletions across 3 files.
- No schema change. No new index (reuses `GardenPlanItem.id.in_(...)`
  PK path already in place). No migration.

---

## Deferred / follow-ups

- **Frontend unit tests for `ImportFromGardenModal` fetch behavior**:
  AUDIT-011 scenarios (URL param presence, re-fetch on plan change,
  404 toast, header copy) remain untested at the unit level. Build +
  manual reasoning were the verification path for this pass. Candidate
  for a `test-engineer` follow-up.
- **"Show all" toggle**: not in scope. If users later want to override
  the active-plan scope inline without leaving the modal, that's a
  separate product pass.
- **Index on `GardenPlanItem.export_key`**: still deferred (per
  `finding-12-implementation-decision.md` item 3). The current filter
  reuses the PK-indexed batch lookup so there's no hot-path regression.

---

## Awaiting user

- Push greenlight for the local commit (`a33b921`) plus this docs
  commit. The scope decision doc says bundle the docs commit with the
  implementation push.
