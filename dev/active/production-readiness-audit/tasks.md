# Production Readiness Audit - Task Checklist

**Created**: 2026-04-22
**Last Updated**: 2026-04-22

## Audit Decisions & Findings

- **2026-04-22 — Canonical space-calculator contract declared**. Shared cross-stack return value is **square-foot-equivalent area per unit** (frontend-style semantics). Backend rewrite pending; 96 calculator parity cases converted to `xfail(strict=True)` in the interim. Full contract: [`calculator-contract.md`](./calculator-contract.md). Callers anchor: `backend/services/garden_planner_service.py::calculate_plant_quantities` and `::calculate_planning_breakdown`, `frontend/src/utils/gardenPlannerSpaceCalculator.ts::calculateSpaceRequirement`.
- **2026-04-22 — Parity failures use xfail, not immediate fix**. Phase A's 116 drift cases grouped by category and marked xfail; backend alignment happens incrementally. Per `developer-response.md` item 1.
- **2026-04-22 — Product Deviation Tier introduced**. Initially three candidates (strategy-step removal, missing Homegrown badge, dev-only SimulationToolbar); SimulationToolbar subsequently reclassified out of this tier — see 2026-04-22 reversal entry below. See "Product Deviation Tier" section below.
- **2026-04-22 — Strategy-step simplification documented, not restored**. Per user `post-parity-decision-response.md` item 6: `USER_JOURNEY.md` Week 4 and `APPLICATION_FEATURES.md` §3 amended to describe the wizard's current two-step flow (Select Seeds → Allocate → Review) with a product note that strategy/succession-interval configuration is simplified to `balanced` + `moderate` defaults. Not restored; flagged for potential future power-user reintroduction.
- **2026-04-22 — Strawberry perennial DTM deferral documented**. Per user `post-parity-decision-response.md` item 1: kept as `xfail` Group H in `backend/tests/test_cross_stack_parity.py`; see "Intentional Deferrals" below for trigger.
- **2026-04-22 — SimulationToolbar un-gating deferred**. Per user `post-parity-decision-response.md` item 7: must be a standalone pass, not bundled. See "Intentional Deferrals" below for validation checklist. **Superseded same day — see next entry.**
- **2026-04-22 — Homegrown badge shipped earlier than planned**. Per user `post-review-developer-response.md` item 1, the Product Deviation Tier item "Homegrown badge missing from `MySeedInventory.tsx`" was pulled forward from its originally planned "soon after Phase B" slot and implemented in this audit pass. UI renders on `seed.isHomegrown === true` in `frontend/src/components/MySeedInventory.tsx`. See Product Deviation Tier item 2 below for full resolution note.
- **2026-04-22 — SimulationToolbar reclassified as QA/testing tool (reversal)**. Per user `simulation-tool-decision.md`, the earlier framing of SimulationToolbar as an in-scope power-user feature is withdrawn. It is a QA/testing tool used to validate the site and find errors, not an end-user feature. The `NODE_ENV !== 'development'` gating is correct behavior, not a product contradiction. It may be removed, disabled, or hidden permanently once site validation is complete. No un-gating pass is required; the earlier follow-up item is withdrawn. Entry moved out of the Product Deviation Tier into the new "Internal Tooling / QA Utilities" section below.

## Phase A / Phase B status (2026-04-22)

User approved Phase A (sync-lockdown) + Phase B prep (manual smoke checklist) on 2026-04-22. Phase A is complete; Phase B.1 is running in parallel with the xfail conversion specialist.

### Phase A — Sync-lockdown — **COMPLETE (2026-04-22)**

- [x] **A.1 — Calculator-pair parity harness** — *complete (2026-04-22)*. Harness lives at `backend/tests/test_cross_stack_parity.py`. Surfaced 116 real drift cases across space-calculator, SFG, plant-DB, and missing-plant groups. Per user direction (2026-04-22 `developer-response.md`), drift is NOT being mechanically patched this pass — the 116 cases are being converted to `@pytest.mark.xfail(strict=True)` markers grouped by drift category so CI stays green while backend alignment happens incrementally. A concurrent specialist is doing the xfail conversion.
- [x] **A.2 — `parse_iso_date` sweep** — *complete (2026-04-22)*. Ad-hoc `datetime.fromisoformat` calls on inbound API dates replaced with `utils.helpers.parse_iso_date` (handles JavaScript `'Z'` suffix per `CLAUDE.md` API Contract Rules).
- [x] **A.3 — `MIGRATIONS.md` doc drift fix** — *complete (2026-04-22)*. `backend/MIGRATIONS.md` rewritten so ALL schema changes go through Flask-Migrate. `migrations/custom/schema/` marked DEPRECATED (historical-only). `migrations/custom/data/` retained for data-only migrations. Aligns with `CLAUDE.md` Critical Constraint #1.

### Phase A constraints (active)

- Do NOT touch `frontend/src/components/GardenDesigner.tsx` during Phase A (user decision 2026-04-22).
- Git safe-directory blocker remains unresolved; no git write-side operations were performed during Phase A.

### Phase B — User-journey validation

- [x] **B.0 — Manual smoke-test checklist authored** — *complete (2026-04-22)*. File: `dev/active/production-readiness-audit/phase-b-manual-smoke-checklist.md`. Five probes ordered Jan → Nov/Dec, ≤15 min each, explicit prerequisites/steps/red-flags/deviation/scratch per probe. Chosen over immediate Playwright automation per user decision "manual smoke checklist first, automate stable flows later."
- [ ] **B.1 — Run the five probes** — *user executing in parallel (2026-04-22)*. Running alongside the xfail conversion. Simulation-related probes run in development mode — `SimulationToolbar` is a QA/testing tool gated behind `NODE_ENV !== 'development'` by design (see "Internal Tooling / QA Utilities" section below). Findings feed Phase C triage.
- [ ] **B.2 — Automate stable flows** — deferred until B.1 surfaces which flows are stable enough to codify.

### R9 narrative gaps (deferred — retained in USER_JOURNEY.md as intended scope)

The following capabilities are described in `USER_JOURNEY.md` but are NOT currently implemented. Per user decision 2026-04-22 they are **retained in USER_JOURNEY.md as intended product scope** and are NOT to be removed from that doc:

- [ ] **Microgreens rotation** (USER_JOURNEY Week 4, Week 9, December) — no first-class model or dashboard rotation reminder
- [ ] **Weekly tunnel harvest info card** (USER_JOURNEY January Week 1) — dashboard info card showing current tunnel stocks
- [ ] **First-class cover-crop tagging** (USER_JOURNEY October Week 39) — currently notes-only on a PlantingEvent; no dedicated type/tag

Do NOT edit `USER_JOURNEY.md` to remove these. Do NOT edit `APPLICATION_FEATURES.md`. Status: **missing / deferred**.

### Product Deviation Tier (2026-04-22)

Separate from the R9 narrative gaps above. These are features that **were implemented** and then partially removed, broken, or gated in a way that contradicts `USER_JOURNEY.md`. Tracked distinctly because each needs a product decision, not just build-out work.

- [x] **1. Planner wizard "Configure Strategy" step removed from UI** — *real deviation, docs reconciled 2026-04-22*. The Garden Planner wizard now hardcodes `strategy='balanced'` and `succession_preference='moderate'` (see `frontend/src/components/GardenPlanner.tsx:42` comment; step removal corroborated by `backend/MIGRATIONS.md` 2026-01-24 entry). **Resolution (2026-04-22)**: per user `post-parity-decision-response.md` item 6, docs amended to match code reality rather than restoring the UI. `USER_JOURNEY.md` Week 4 and `APPLICATION_FEATURES.md` §3 now describe the two-step flow (Select Seeds → Allocate → Review) with a product note that strategy/succession-interval configuration is simplified. **Trigger to revisit**: if a product decision reintroduces strategy as a user-configurable power-user feature, remove the product note and re-add the Configure Strategy step to both docs alongside the UI work.

- [x] **2. "Homegrown" badge missing from `MySeedInventory.tsx`** — *real deviation, **resolved 2026-04-22***. Backend writes `is_homegrown=True` on the collect-seeds endpoint; the `CollectSeedsModal` submits the flag; the inventory UI (`frontend/src/components/MySeedInventory.tsx`) never read or rendered it. `USER_JOURNEY.md` Week 3 and Week 35 both describe a visible "Homegrown" badge on inventory rows. **Originally scheduled as "fix soon after Phase B" (user direction 2026-04-22). Pulled forward into this audit pass** per `post-review-developer-response.md` item 1. **Resolution (2026-04-22)**: badge now renders in `frontend/src/components/MySeedInventory.tsx` conditionally on `seed.isHomegrown === true`, alongside the existing From Catalog / Custom badge row. End-to-end data path (backend flag → API → UI) is now fully surfaced.

_(SimulationToolbar entry removed from this tier on 2026-04-22 per user `simulation-tool-decision.md`. It is a QA/testing tool, not a product deviation. See "Internal Tooling / QA Utilities" below.)_

### Internal Tooling / QA Utilities (2026-04-22)

Tools that exist to help validate the site and surface errors during development and site-review passes. Not end-user features. Correctly gated outside of development/testing environments; not tracked as product deviations.

- **`SimulationToolbar` (Time Machine)** — `frontend/src/components/SimulationToolbar.tsx:20` returns `null` when `NODE_ENV !== 'development'`. **Classification (2026-04-22, user `simulation-tool-decision.md`)**: QA/testing tool used to validate date-aware behavior, year-boundary flow, and seasonal signals. Not intended as a normal end-user feature long-term. The dev-only gating is the correct behavior, not a product contradiction. **May be removed, disabled, or hidden permanently once site validation is complete.** No un-gating pass is scheduled; the earlier follow-up plan and production-build validation checklist (from the initial 2026-04-22 framing) are withdrawn. Probe 5 of the Phase B manual smoke checklist exercises this tool in development mode — that is the intended audience.

### Intentional Deferrals (2026-04-22)

Items where the current state is **deliberately frozen** pending a larger product decision. Separate from R9 narrative gaps (unimplemented scope) and Product Deviation Tier (product contradictions). These are cases where implementing the naive fix would actively make the model worse.

- [ ] **`strawberry-1` perennial-plant DTM + rowSpacing drift** — tracked in the parity suite as **Group H** in `backend/tests/test_cross_stack_parity.py`. Real drift: backend `daysToMaturity=90, rowSpacing=24` vs frontend `daysToMaturity=120, rowSpacing=18`. **Why deferred (user `post-parity-decision-response.md` item 1, 2026-04-22)**: neither value is semantically correct for a perennial plant; picking either side and forcing a fake annual-style DTM would obscure the underlying modeling gap. **Long-term product direction (user)**: strawberry should move toward a separate perennial path with nullable / non-standard DTM semantics rather than being forced into annual-crop semantics. **This pass does NOT implement the perennial path** — the Group H `xfail` stays in place. **Trigger to revisit**: when perennial modeling is designed and implemented. At that point either (a) strawberry fits the new perennial model and the Group H `xfail` can be removed (parity passes normally), or (b) strawberry is explicitly excluded from cross-stack parity because it's handled by a separate perennial path, and the `xfail` is promoted to a deletion with a comment pointing at the perennial module.

- [ ] **`?planId=` scoping filter on `/api/planting-events/needs-indoor-starts`** — the endpoint still returns events across all of the user's plans. Finding #12 (commit `5d713b9`, 2026-04-22) restored trust by labeling each row with its source plan and stopping cross-plan row merges, but the list itself is still cross-plan by design. **Why deferred (user `finding-12-implementation-decision.md` item 3, 2026-04-22)**: a true scoping filter would hide rows with `export_key = NULL` (manually-created or legacy events with no plan attribution) unless the UX accounts for them explicitly. That is a product decision, not a mechanical change. **Trigger to revisit**: if per-plan scoping becomes user-requested in future Phase B retesting, or if a planning workflow is added that requires strict per-plan isolation at the import step. **When implementing, also add**: an index on `GardenPlanItem.export_key` (`backend/models.py:1392`, currently unindexed) so the scoping join doesn't regress read-path performance on large plan counts. The existing batch-load query path for attribution uses `GardenPlanItem.id.in_([...])` via the implicit PK index, so today's endpoint is not on the hot path.

- [ ] **#11 — Plan duplicate naming flow** — weak rename affordance after "Duplicate Plan". Queued as a future workflow-focused pass per user direction (`next-developer-decisions.md` item 2, 2026-04-22). Not indefinite. **Trigger to revisit**: when a plan-clarity / plan-management polish pass is scheduled. The workflow investigation recommended hoisting the Plan Name input from the wizard's Save step onto step 1 as a shared fix for both `#11` and the post-create landing polish that would extend #3.

### Phases C / D / E — pending user decision

Do not start. Scope and priority will be set after Phase B.1 findings are reviewed with the user.

---

## Audit Foundation

- [x] Read `APPLICATION_FEATURES.md`
- [x] Read `USER_JOURNEY.md`
- [x] Inventory backend/frontend module surface
- [x] Run backend test suite
- [x] Run frontend production build

## Stability Fixes

- [x] Fix hardiness-zone lookup when external ZIP API is unavailable
- [x] Re-run geocoding and frost-date tests
- [x] Re-run full backend test suite
- [x] Fix frontend hook dependency issues tied to date-aware behavior
- [x] Remove dead frontend imports/types found during build
- [x] Rebuild frontend successfully

## Remaining Product Audit Tasks

- [ ] Create feature verification matrix by product domain
- [ ] Verify dashboard attention signals and deep-link flows
- [ ] Verify season planner full flow from seed selection to export
- [ ] Verify garden designer placement, overlays, conflicts, and seed-saving paths
- [ ] Verify planting calendar views and non-plant event workflows
- [ ] Verify indoor seed starts lifecycle
- [ ] Verify harvest tracker and nutrition rollups
- [ ] Verify seed inventory/catalog/import flows
- [ ] Verify property designer and structure placement flows
- [ ] Verify livestock, compost, and photo gallery flows
- [ ] Verify admin/user-management flows

## Technical Debt Follow-Up

- [ ] Review SQLAlchemy `Query.get()` deprecation warnings
- [ ] Investigate cyclic FK warning during SQLite metadata teardown
- [ ] Refresh stale `baseline-browser-mapping` dependency metadata
- [ ] Restore Git review workflow by addressing safe-directory ownership issue

## Progress

13/26 tasks completed (A.1 and A.2 moved to complete on 2026-04-22; product-deviation tier items tracked separately and not counted here until resolved)
