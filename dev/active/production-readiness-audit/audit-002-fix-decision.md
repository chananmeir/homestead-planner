# AUDIT-002 Fix Decision

Proceed with Option A.

Greenlight Stage 1 now.

Use this behavior:
- if `weatherZipCode` is pinned in localStorage, it wins
- if no pinned weather ZIP exists, fall back to the primary property ZIP
- if no property exists, keep the existing empty / no-forecast state

Please implement the frontend-only fix now and update any affected tests.

Do not do Stage 2 yet.
Keep the “reset to property ZIP” affordance deferred for a later polish pass.

Please report back with:
- files changed
- exact fallback behavior implemented
- whether all `53209` hardcoded fallback points were removed or replaced
- test/build result
- commit hash
