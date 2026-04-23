# AUDIT-011 Report-back (2026-04-23)

Response to the verbatim report-back requests in
`audit-011-scope-decision.md`. Persisted per the
always-write-findings-to-md rule. Full technical details are at
`audit-011-fix-report.md`; this file is the compact report-back cut.

---

## Exact backend filter behavior implemented

`GET /api/planting-events/needs-indoor-starts` now accepts optional
`?planId=<int>`:

| Input | Behavior |
|---|---|
| Omitted | Cross-plan (backward compat for any other caller) |
| Non-integer / `<= 0` / malformed | `400 {error: 'planId must be a positive integer'}` |
| Valid int not owned by current_user | `404 {error: 'Plan not found'}` (no leak) |
| Valid + owned | Keep events matching that plan **plus** events with `export_key = None` / unresolvable; drop events attributed to other plans |

Filter runs AFTER the existing plan-attribution batch lookup, reusing
the PK-indexed `GardenPlanItem.id.in_(...)` path — no new hot path on
`export_key`. Response shape / group key / all other filters unchanged.

---

## Exact frontend re-fetch behavior implemented

`ImportFromGardenModal.tsx`:

1. **URL**: appends `?planId=${activePlan.id}` when set; omits param
   otherwise.
2. **useEffect dep array**: now includes `activePlan?.id` → modal
   re-fetches on plan switch mid-session. Fixes the stale-fetch latent
   bug flagged as suspect #2 in the retest investigation.
3. **404 handler**: surfaces `"Plan not found"` toast for stale
   `activePlan` ids (e.g. plan deleted in another tab).
4. **Header disclaimer**:
   - Active plan set: "Rows are scoped to this plan. Unattributed
     events are also shown."
   - No active plan: "No active plan selected — showing events across
     all your plans."

---

## How `Unknown plan` rows appear under scoped mode

- Events with `export_key = None` OR unresolvable keys are **retained**
  by the backend filter even under `planId` scoping (per the approved
  option (ii)).
- Response returns them with `planId: null`, `planName: null`
  (unchanged from commit `5d713b9`).
- Frontend renders the existing `Unknown plan` pill in the Bed cell via
  the null-plan branch already in place — no frontend rendering
  changes needed for this path.
- **Net UX**: scoped-plan rows + `Unknown plan` rows coexist in the
  modal. No legitimate planting work is hidden.

---

## Commit hashes

```
f0cd53a docs: Record AUDIT-011 fix report
a33b921 fix: Scope import-events endpoint to active plan (AUDIT-011)
1781270 docs: AUDIT-011 retest investigation + decision summary  (earlier)
```

Three local commits. Not yet pushed.

---

## Test results

### New regression tests

`backend/tests/test_needs_indoor_starts_plan_attribution.py` gained 6
tests:

- Filter returns only matching-plan rows.
- Filter includes null `export_key` rows (Unknown plan bucket).
- Filter excludes other plans even when the group key would merge.
- Cross-user `planId` → 404, no leak.
- Malformed `planId` → 400 (parametrized: `'abc'`, `-1`, `0`, `1.5`,
  `' '` — 5 variants).
- Omitted `planId` preserves cross-plan behavior (backward compat).

### Full backend suite

**1284 passed, 2 failed, 1 xfailed** — the 2 failures are the
pre-existing `test_geocoding_service.py` network-dependent tests
(unrelated, same as every prior audit commit this session). `xfailed`
is strawberry-1 Group H perennial deferral.

### Frontend

`npm run build` — compiled successfully. Main bundle +63 B gzipped.
No TypeScript / lint errors.

`IndoorSeedStarts.focus.test.tsx` (2 tests) still passes. **No unit
tests exist for `ImportFromGardenModal` fetch behavior** — flagged as a
coverage gap for a future `test-engineer` follow-up.

---

## Awaiting user

Push greenlight for `1781270 → f0cd53a` (three commits: investigation
docs, fix, fix report).
