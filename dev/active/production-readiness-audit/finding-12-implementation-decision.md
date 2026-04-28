# Finding 12 Implementation Decision

Proceed with these decisions:

1. #12:
Yes, greenlight Option B for implementation:
- backend enrichment with `planId` + `planName` per row
- frontend labeling in the import modal

2. Cross-plan group-key bug:
Do not leave this out of the trust fix.
Fold it into the same implementation pass as #12.

Reason:
If the current grouping key can merge rows across plans, then plan labeling alone is not sufficient, because the row itself may already represent combined data from multiple plans.
The immediate fix for #12 should therefore include:
- plan metadata enrichment
- frontend source-plan labeling
- grouping-key correction so cross-plan rows are not incorrectly merged

You can still note this as a subfinding or related finding in the docs, but it should be fixed in the same pass rather than parked separately.

3. Future Option A + index:
Record this as a known follow-up.
Do not implement it in this pass.
Please explicitly note:
- possible future `?planId=` filtering on `/api/planting-events/needs-indoor-starts`
- if that path is implemented later, add an index for the matching plan-attribution lookup path as needed

4. b0ef4c5:
Keep it local for now and push it together with the eventual #12 fix/docs update, not as a standalone push.

Please report back with:
- the exact fix shape you applied for #12
- whether the grouping key now includes plan identity
- how rows with null / legacy `export_key` are surfaced to the user
- the resulting commit hash(es)
