# Post Review Summary (2026-04-22)

Results of the `code-review` pass on the audit's intentional working tree,
plus the documentation reconciliation agents' output. Nothing committed.
All changes still uncommitted pending the git safe-directory fix.

---

## 1. Code review verdict

**0 Blockers, 0 High, 4 Medium, 3 Nit.**

Parity sync, `parse_iso_date` sweep, and space-calculator rewrite all clean.
Backend formulas are bit-equivalent to frontend. xfail discipline is clean
(Groups A–G empty with historical anchor reasons; Group H = `{strawberry-1}`).
Agent-memory entries for the pattern were saved.

### Medium findings

1. **`dev/active/production-readiness-audit/tasks.md:52`** — Homegrown badge
   item is still unchecked but was implemented this pass. Trivial tracking
   update needed.

2. **`frontend/src/components/MySeedInventory.tsx` `useCallback` cleanup** —
   the Homegrown badge work also converted `isExpiringSoon` and `isExpired`
   to `useCallback` and added them to two `useMemo` dependency arrays. This
   is a real latent-bug fix (memoized filter results were not re-running
   when simulation `now` advanced) but is unrelated to the badge, so it
   counts as scope creep.
   Decision needed: keep bundled in the badge commit (call it out in the
   message), split into its own commit, or revert it and accept the latent
   stale-closure bug as pre-existing.

3. **`backend/tests/test_space_calculation_sync.py`** row-method tests were
   refactored to dynamically look up `spacing`/`rowSpacing` from
   `PLANT_DATABASE` rather than just updating the hard-coded literal
   expected values. Self-consistent with the new plant DB but weakens the
   sentinel property — if plant DB drifts again in isolation, these tests
   will still pass while the cross-stack contract breaks. The parity harness
   catches that case, so overall coverage is not lost, just moved.
   Decision needed: accept as-is with a rationale comment in the test-file
   docstring, or revert to hard-coded current values (the watermelon /
   squash / carrot tests retained hard-coded values and should be the
   model).

4. **`backend/MIGRATIONS.md`** — the policy rewrite also added a
   "Recent Migrations" entry for the `cancelled_at` soft-delete migration
   (2026-04-21), which was outside the task scope. Factually correct and
   aligned with the existing Recent Migrations section, but scope creep.
   Decision needed: split into its own tiny follow-up commit, or mention
   explicitly in the policy-rewrite commit message.

### Nits

- **`backend/services/space_calculator.py:8`** — `import math` is now unused
  after the row/migardener rewrite removed the `ceil()` calls.
  Recommended fix: drop the import.
- **`backend/services/space_calculator.py:104,140` vs.
  `frontend/src/utils/gardenPlannerSpaceCalculator.ts:219,253`** — Backend
  uses `plant.get('spacing', 12)` (defaults only on missing key); frontend
  uses `plant.spacing || 12` (defaults on missing key OR `0`). Latent
  divergence only if a plant ever has `spacing=0`. No plant currently does
  (grepped `plant_database.py`). Not worth a fix until a real `spacing=0`
  entry appears.
- **`frontend/src/components/MySeedInventory.tsx:938`** —
  `seed.isHomegrown === true` is more verbose than `seed.isHomegrown` (both
  correct for a boolean-typed field). Matches defensive-equality style
  elsewhere in the same file.

### What looked good

- **Parity snapshot design** (`frontend/scripts/emit-parity-snapshot.js`
  transpiles TypeScript in-process and writes a deterministic JSON fixture
  at `backend/tests/fixtures/frontend_parity_snapshot.json`; pytest reads
  the fixture with no Node dependency). Frontend is the declared source of
  truth; the fixture `README.md` documents the "never hand-edit, always
  regenerate" rule.
- **xfail registry discipline** (`backend/tests/test_cross_stack_parity.py`)
  — emptied Groups A–G frozensets but retained their reason strings as
  historical anchors. Template-friendly for future audits.
- **Additive third-pass resolver** in `backend/sfg_spacing.py` — runs only
  after the existing two passes fail, so existing callers unaffected. Has a
  dedicated isolated test file (`backend/tests/test_sfg_spacing_resolver.py`,
  10 tests).
- **Data alignment applied exactly as proposed** — spot-checked arugula-1,
  carrot-1, tomato-1, broccoli-1. Strawberry-1 correctly deferred.

---

## 2. Recommended commit structure

Seven commits. Order matters: **commit 5 must merge before commit 4** because
the row-method test assertions in commit 4 depend on the new plant-DB values
from commit 5. Alternatively, bundle 4 + 5.

1. **`test: Add cross-stack parity harness (Phase A.1)`**
   - `backend/tests/test_cross_stack_parity.py` (with pre-emptied xfail
     registry)
   - `backend/tests/fixtures/frontend_parity_snapshot.json`
   - `backend/tests/fixtures/README.md`
   - `frontend/scripts/emit-parity-snapshot.js`
   - `frontend/package.json`

2. **`refactor: Route inbound-date parsing through parse_iso_date (Phase A.2)`**
   - `backend/conflict_checker.py`
   - `backend/services/nutritional_service.py`
   - `backend/place_plants.py`
   - `backend/place_gap_plants.py`

3. **`docs: Mandate Flask-Migrate for all schema changes; note cancelled_at migration`**
   - `backend/MIGRATIONS.md` — bundles in-scope policy rewrite with the
     Medium #4 scope-creep entry for transparency.

4. **`refactor: Rewrite space calculator to sq-ft contract (Tier 1)`**
   - `backend/services/space_calculator.py` (drop unused `math` import at
     the same time)
   - `backend/tests/test_space_calculation_sync.py`

5. **`data: Align backend plant DB + SFG lookup to frontend canonical values (Tier 2)`**
   - `backend/plant_database.py`
   - `backend/garden_methods.py`
   - `backend/sfg_spacing.py`
   - `backend/tests/test_sfg_spacing_resolver.py`
   - `backend/tests/test_succession_export.py`
   - `backend/tests/test_conflict_detection.py`

6. **`feat: Show Homegrown badge on saved-seed inventory rows`**
   - `frontend/src/components/MySeedInventory.tsx` — depending on decision,
     either keep `useCallback` cleanup in this commit (call it out in the
     message) or split to 6b.

7. **`docs: Update audit tracking for Phase A completion and Homegrown badge`**
   - `dev/active/production-readiness-audit/calculator-contract.md`
   - `dev/active/production-readiness-audit/data-alignment-proposal.md`
   - `dev/active/production-readiness-audit/tasks.md` (ticking the
     Homegrown checkbox)
   - `dev/active/production-readiness-audit/phase-b-manual-smoke-checklist.md`

---

## 3. Documentation reconciliation

### `USER_JOURNEY.md`

- Week 4 amended: "Configure Strategy" Step 2 block removed; remaining
  wizard steps renumbered. Product note added flagging simplified defaults
  and potential future power-user reintroduction.
- Two narrative mentions of "strategy" left untouched (lines 457 and 473 —
  both user-intent language, not product-feature references).

### `APPLICATION_FEATURES.md`

- §3 amended with the same structural change. Product note extended to
  cover where the removed Step 2 capabilities (planning method, per-seed
  succession intent) actually live now.

### `dev/active/production-readiness-audit/tasks.md`

- Three dated "Audit Decisions & Findings" entries for 2026-04-22.
- Product Deviation Tier item 1 (Configure Strategy) marked resolved with a
  "Trigger to revisit" note.
- Product Deviation Tier item 3 (SimulationToolbar) was initially expanded
  with a standalone-pass plan and production-build validation checklist,
  then reversed later the same day per user `simulation-tool-decision.md`:
  SimulationToolbar is a QA/testing tool, the `NODE_ENV !== 'development'`
  gating is correct behavior, and no un-gating pass is required. The entry
  has been moved out of the Product Deviation Tier into a new "Internal
  Tooling / QA Utilities" section in `tasks.md`.
- New "Intentional Deferrals (2026-04-22)" subsection documenting the
  `strawberry-1` Group H deferral with its trigger (perennial modeling
  implementation).

### Product-note text for wording review

**USER_JOURNEY.md, Week 4 (between Step 1 and bed-allocation bullets)**:

> **Step 2 — Allocate to Beds.** (*The wizard no longer has a dedicated
> Configure Strategy step — it applies sensible defaults and moves you
> straight into bed allocation. Succession counts you set back in Step 1
> still drive how many waves the system schedules.*)
>
> > *Product note: strategy and succession-interval configuration are
> > currently simplified — the app applies `balanced` + `moderate`
> > defaults. A future version may reintroduce per-crop strategy
> > configuration as a power-user feature.*

**APPLICATION_FEATURES.md, §3 (under Step 2)**:

> **Step 2 — Allocate to Beds**
>
> > *Product note: strategy and succession-interval configuration are
> > currently simplified — the app applies `balanced` + `moderate`
> > defaults. A future version may reintroduce per-crop strategy
> > configuration as a power-user feature. Planning method is chosen per
> > bed in the Garden Designer, and per-seed succession intent is set
> > alongside quantities in Step 1.*

Slight wording difference between the two because APPLICATION_FEATURES.md
originally listed "Planning method" and "Per-seed succession overrides" as
Step 2 bullets, and the extended note covers where those capabilities live
now.

### Follow-up triggers (explicit for future pickup)

- **Strawberry perennial deferral** — revisit when perennial modeling is
  designed. Two exit paths:
  (a) strawberry fits new model → remove Group H xfail; or
  (b) strawberry is excluded from parity → delete Group H xfail with comment.
- **SimulationToolbar un-gating follow-up — withdrawn (2026-04-22).** The
  earlier framing of SimulationToolbar as an in-scope power-user feature
  was reversed later the same day per user `simulation-tool-decision.md`.
  It is a QA/testing tool; the `NODE_ENV !== 'development'` gating is
  correct behavior, not a product contradiction. No standalone pass is
  scheduled. The tool may be removed, disabled, or hidden permanently once
  site validation is complete.

---

## 4. Open items for user decision

1. **Code-review Medium-tier follow-up pass.** All four items are small and
   can be resolved in one pass:
   - Tick the Homegrown checkbox in `tasks.md`.
   - Decide commit-split strategy for the `useCallback` cleanup in
     `MySeedInventory.tsx` (keep bundled / split / revert).
   - Decide whether `test_space_calculation_sync.py` row-method tests
     should stay dynamic (with rationale comment) or be reverted to
     hard-coded sentinel values.
   - Decide whether the `cancelled_at` MIGRATIONS.md entry should split
     into its own commit or stay with the policy rewrite.
   Nit-tier fixes (unused `import math`, `plant.spacing || 12` divergence)
   can be rolled into the same pass.

2. **Product-note wording** — acceptable as proposed, or want it sharper
   or softer?

3. **Phase B manual smoke findings** — still pending user's manual pass.
   Any confirmed issues should be reported separately per earlier
   direction.

4. **Nit: `plant.spacing || 12` vs `get('spacing', 12)` divergence.** No
   plant currently has `spacing=0`. Defer until a real `spacing=0` entry
   is introduced, or fix proactively for strict parity.

5. **Git safe-directory** — still unresolved on user's end. Once fixed,
   the 7-commit structure above is ready to apply.

---

## State of the audit

- **Phase A**: complete (parity harness + parse_iso_date sweep +
  MIGRATIONS.md policy).
- **Phase B**: execution in user's hands (smoke checklist ready).
- **Tier 1**: complete (space-calculator rewrite + Homegrown badge).
- **Tier 2**: complete (40 of 41 parity cases cleared; 1 deferred with
  explicit product-model reason).
- **Product deviations**: Configure Strategy resolved via doc amendment;
  Homegrown badge shipped; SimulationToolbar reclassified as QA/testing
  tool (not a product deviation) per `simulation-tool-decision.md`.
- **R9 narrative gaps**: unchanged — intentional scope retained in
  USER_JOURNEY.md.
- **Phase C / D / E**: pending user decision (not started this session).

Nothing committed. Working tree clean and ready for review/commit once the
git safe-directory issue is sorted.
