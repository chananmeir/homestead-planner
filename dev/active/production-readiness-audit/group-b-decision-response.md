# Group B Decision Response

Proceed with the next alignment pass using these decisions:

1. Group B:
Approve the conclusive field-level fixes from `dev/active/production-readiness-audit/data-alignment-proposal.md`.

Hold back only the unresolved product-model items:
- strawberry daysToMaturity
- strawberry rowSpacing if still inconclusive
- anything that really requires tomato variety splitting rather than generic alignment

Please apply the conclusive alignment fixes now and report which xfails remain afterward.

2. Group A bean SFG:
Approved.
Treat this as a backend lookup/fallthrough bug, not a product disagreement.
Add explicit `bean` / `bean-1` SFG entries on the backend.

3. Group E shallots:
Approved.
Proceed with:
- keeping `shallot-from-seed` / `shallot-from-sets` in frontend
- adding backend SFG entries
- fixing suffix stripping in `sfg_spacing.py` for multi-segment IDs

4. Strawberry:
Do not force a bad perennial model just to clear parity.
If non-DTM fields can be aligned safely, do that.
If strawberry DTM / rowSpacing still requires a product-model decision, leave those cases explicitly deferred.

5. Tomato variety split:
Defer for now.
Do not expand this pass into tomato variety-model redesign unless it is strictly required for current parity cleanup.

6. Homegrown badge on other surfaces:
Do not expand scope yet.
Keep the current `MySeedInventory` implementation as the approved scope for now.

7. After applying the approved data fixes:
- rerun parity
- remove any markers that turn into XPASS
- report the remaining xfail groups
- clearly separate “still unresolved data drift” from “deferred product-model issues”
