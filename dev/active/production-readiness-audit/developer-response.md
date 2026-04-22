# Developer Response

Proceed with these decisions:

1. Parity failures:
Use option (b). Convert the 116 real parity failures into intentional `xfail` coverage with grouped references by drift category. Keep the parity harness in place. Do not leave them as plain red tests, and do not try to fix all drift immediately in this phase.

2. Canonical calculator contract:
Treat frontend-style area / square-foot-equivalent semantics as the canonical shared contract for space-calculator output.
Do not mechanically patch the 96 calculator mismatches yet.
First write a short contract note describing exactly what the shared return value means.
If any code needs grid cells, that should come from a separate helper/contract, not the shared cross-stack parity contract.

3. New deviation findings:
Track these as a separate “product deviation” tier, not the same bucket as narrative feature gaps:
- Planner wizard “Configure Strategy” step removed
- Homegrown badge missing in inventory UI
- Simulation toolbar dev-only in production

4. Code review:
Skip code-review for now.

5. Phase B:
Proceed now with Phase B manual smoke execution in parallel.
For simulation-related probes, run in development mode if needed and explicitly log that production-build simulation is currently blocked by the toolbar being gated behind `NODE_ENV !== 'development'`.

Additional direction:
- Homegrown badge is a straightforward user-facing omission; fix it soon after Phase B if confirmed.
- The removed strategy step is a product/spec decision; do not automatically restore it without noting the tradeoff.
- The simulation-toolbar gating is a real product contradiction if simulation is still considered an intended user-facing feature.

Please continue from there and report back with:
- the xfail grouping structure
- the calculator contract note
- Phase B smoke results
- recommended next fixes in priority order
