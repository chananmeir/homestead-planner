# Post Review Developer Response

Proceed with these decisions:

1. Homegrown tracking item in `tasks.md`:
Please update the checkbox/status so the audit tracking matches reality.

2. `MySeedInventory.tsx` `useCallback` cleanup:
Keep the stale-closure fix, but do **not** hide it inside the Homegrown badge commit.
Split it into its own small commit or clearly isolate it as a separate change.
Reason: it is a real bug fix, but it is unrelated to the badge feature.

3. `backend/tests/test_space_calculation_sync.py` row-method expectations:
Accept the dynamic version as-is, but add a short rationale comment/docstring note explaining that:
- this file no longer acts as the sole sentinel for row-method plant DB drift
- the parity harness is now the canonical cross-stack guard for that case
- coverage was shifted, not lost

Do not revert back to hard-coded literals in this pass.

4. `backend/MIGRATIONS.md` scope-creep entry:
Keep the `cancelled_at` migration note bundled with the policy rewrite, but call it out explicitly in the commit message for transparency.
No need to split that into a separate tiny commit.

5. Product-note wording:
The wording in `USER_JOURNEY.md` and `APPLICATION_FEATURES.md` is acceptable as proposed.
Proceed with that documentation reconciliation.

6. `plant.spacing || 12` vs backend defaulting:
Defer this nit for now.
No plant currently has `spacing=0`, so this is not worth touching in the current pass.

7. Phase B smoke findings:
No new manual-smoke findings are being sent in this response.
Continue tracking Phase B issues separately and report confirmed findings as their own follow-up items.

8. SimulationToolbar:
Keep the current treatment from the prior decision:
- it is a QA/testing tool
- it is not a normal end-user feature
- any un-gating/removal/hiding should remain a standalone pass, not bundled into unrelated work

9. Git / commit preparation:
Once the git safe-directory issue is resolved, proceed using the recommended commit structure from `post-review-summary.md`, with the `useCallback` cleanup split cleanly from the Homegrown badge commit.

Please continue with:
- the small Medium/Nit follow-up pass above
- the documented commit preparation
- separate reporting of any new Phase B confirmed bugs
