# Next Developer Instructions

Proceed with Tier 1 now. Do not wait for Phase B to finish.

1. Start the backend space-calculator rewrite for Groups C + D.
Use the calculator contract in `dev/active/production-readiness-audit/calculator-contract.md` as the source of truth.
Goal: backend row and migardener branches must return square-foot-equivalent area, matching the shared contract.
After the rewrite:
- rerun the parity suite
- identify which strict xfails turn into XPASS
- remove the markers that are no longer needed
- report the remaining xfail groups

2. Also fix the Homegrown badge now.
This is a confirmed user-facing omission and should be addressed in parallel.
Please implement the badge in `MySeedInventory.tsx` and verify that collected seeds with `is_homegrown` / `isHomegrown` are visibly labeled.

3. Continue Phase B manual smoke in parallel.
Any confirmed bugs from the smoke checklist should be reported separately and not mixed into the parity-fix work unless they directly touch the same files.

4. For Tier 2 plant-data alignment:
I do not currently have a single authoritative internal reference to hand you.
Please do the research pass plant-by-plant and propose which side should win for each mismatch.
Use the best primary/source-style references available per crop and method, then return:
- plant name
- mismatched fields
- backend value
- frontend value
- proposed winner
- source/rationale

5. For the SFG bean drift:
Do not silently choose a side.
Research it and include a recommendation with source/rationale.

6. For shallot-from-seed / shallot-from-sets:
Please propose whether they should be added to backend lookup tables or removed from frontend, with the least risky option clearly identified.

7. Keep the product-deviation tier separate:
- Configure Strategy step removal
- Homegrown badge
- SimulationToolbar dev-only gating

8. No need for code-review yet.
We can review once the parity state is intentional after the calculator rewrite.

Also, once git operations are needed, the repo safe-directory issue still needs to be resolved before status/diff/commit work.
