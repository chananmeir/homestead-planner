# Post Parity Decision Response

Proceed with these decisions:

1. Strawberry perennial semantics:
Do not force a fake annual-style DTM just to clear the final xfail.
Product direction: long-term, strawberry should move toward a separate perennial path with nullable/non-standard DTM semantics rather than pretending it behaves like a normal annual crop.
For this pass:
- keep the single strawberry xfail
- document it as an intentional deferred product-model issue
- do not expand this pass into perennial-model implementation

2. Tomato variety split:
Defer.
Treat this as future product work, not parity-blocking work.

3. Phase B smoke findings:
No new decisions from me yet because manual smoke findings have not been summarized back here.
Continue Phase B and report confirmed issues separately.

4. Homegrown badge on other surfaces:
Do not expand scope yet.
Keep the current `MySeedInventory` implementation as the approved scope for now.
Only expand if Phase B shows clear user confusion.

5. Code review:
Yes, dispatch code-review now.
Parity state is intentional enough for review to be worthwhile.

6. Configure Strategy step:
Do not restore the UI automatically.
Amend `USER_JOURNEY.md` to match current product reality.
If `APPLICATION_FEATURES.md` also still describes that step as active UI, update that too.
Keep a note in the audit/docs that strategy is currently simplified/hardcoded rather than user-configurable.

7. SimulationToolbar gating:
Treat simulation as a real in-scope power-user feature, not a dev-only-only tool.
The current `NODE_ENV !== 'development'` gating is therefore a product contradiction, not just an internal choice.
Do not change it blindly in the same pass as unrelated fixes, but keep it as an explicit follow-up item to make available outside development once validated.

Please continue with:
- code review on the current intentional working tree
- continued Phase B smoke tracking
- explicit documentation of the strawberry deferral and simulation follow-up
