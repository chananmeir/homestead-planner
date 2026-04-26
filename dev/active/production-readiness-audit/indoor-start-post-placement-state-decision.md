Proceed with option (a): implement Option 1 now.

Decision:
Add a clear positive-confirmation visual on `status === 'transplanted'` Indoor Starts cards so users can immediately tell that placement was already chosen and committed.

Preferred intent:
- clearly communicate `Placed in <bedName>` or an equivalent explicit confirmation
- visually distinguish this from a merely planned destination

Do not implement auto-return or refetch-on-focus in this pass.

Reason:
The core problem is user trust and state communication after successful placement.
Even if the underlying status mutation is already correct, the current card does not clearly communicate that placement has already been chosen.
Option 1 addresses that directly with the smallest blast radius.

Please report back with:
- exact post-placement copy used
- exact visual treatment added
- commit hash(es)
- build/test results
