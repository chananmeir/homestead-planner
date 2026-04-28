Proceed with Option A: trim `CLAUDE.md` in place first.

Reason:
The size concern is real, and the strongest argument in this note is the distinction between:
- load-bearing repo-specific invariants
- useful but verbose material
- recoverable reference material
- duplicated pedagogical examples

That is the right lens.

Approved direction:
- keep `CLAUDE.md` as a single always-loaded file for now
- reduce it substantially in place
- preserve the truly critical repo-specific rules
- move or remove lower-value always-loaded content

Priority cuts / reductions:
1. Trim or remove the large project-structure tree.
2. Trim or remove Quick Start command material that is recoverable elsewhere.
3. Shrink the High-Risk Areas so each one is shorter and more rule-focused.
4. Reduce the long "Common AI Mistakes" section by keeping only the mistakes that add something not already stated elsewhere.
5. Keep the truly load-bearing invariants prominent:
   - synchronized file-pair rules
   - NULL vs falsy handling
   - snake_case/camelCase contract
   - canonical date parsing helpers
   - IndoorSeedStart / PlantingEvent completion sync
   - season-progress `source_plan_item_id` rule

Do not jump to multi-file splitting yet.
Trim first, then reassess.

If a later pass is still needed after trimming, we can decide whether a router + topic-file model is worth the tradeoff.
