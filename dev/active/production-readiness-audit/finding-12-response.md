# Finding 12 Response

Proceed with these decisions:

1. Push:
Do not push `b0ef4c5` yet.
Hold it locally for now until there is either a small related docs batch or the corresponding #12 investigation/fix work is ready to move with it.

2. Priority:
Yes, queue #12 ahead of #11.
I agree with the triage classification that #12 is more important because it affects trust in what data is being imported, not just naming/UX polish.

3. Investigation:
Yes, do a short investigation pass first before fixing #12.

Please confirm:
- whether `/api/planting-events/needs-indoor-starts` is scoped to the active plan, a selected plan, or all plans for the user
- how planting events are linked back to garden plans / plan items
- whether the frontend modal has enough information to identify the source plan even if backend scoping is correct
- the smallest safe fix shape

Please return with:
- confirmed root cause
- recommended fix scope
- whether #12 should be solved by backend filtering, frontend labeling, or both
- whether that work should be bundled with #11 or kept separate
