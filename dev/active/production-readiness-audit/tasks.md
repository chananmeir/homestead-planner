# Production Readiness Audit - Task Checklist

**Created**: 2026-04-22
**Last Updated**: 2026-04-25

## Purpose

This file is the working production-readiness checklist for the app promised in `APPLICATION_FEATURES.md` and `USER_JOURNEY.md`.

It is not only a log of fixes already made. It is the source-of-truth checklist for proving:

1. The product does what the docs say it does.
2. The highest-value workflows are actually usable by a real user.
3. Missing, partial, deferred, or intentionally simplified features are explicitly called out instead of silently drifting.

For every verification item below, record one of these outcomes in notes or follow-up docs:

- `Verified`
- `Partial`
- `Missing`
- `Deferred by product decision`
- `Docs need correction`

When an item is marked verified, capture evidence where practical:

- UI path or API path
- test file or manual smoke note
- bug / deviation note if behavior is surprising

## Audit Decisions & Findings

- **2026-04-22 - Canonical space-calculator contract declared**. Shared cross-stack return value is **square-foot-equivalent area per unit** (frontend-style semantics). Backend rewrite pending; 96 calculator parity cases converted to `xfail(strict=True)` in the interim. Full contract: [`calculator-contract.md`](./calculator-contract.md). Callers anchor: `backend/services/garden_planner_service.py::calculate_plant_quantities` and `::calculate_planning_breakdown`, `frontend/src/utils/gardenPlannerSpaceCalculator.ts::calculateSpaceRequirement`.
- **2026-04-22 - Parity failures use xfail, not immediate fix**. Phase A's 116 drift cases grouped by category and marked xfail. Backend alignment happens incrementally per `developer-response.md` item 1.
- **2026-04-22 - Product Deviation Tier introduced**. Initially three candidates (strategy-step removal, missing Homegrown badge, dev-only SimulationToolbar). SimulationToolbar was later reclassified out of this tier the same day.
- **2026-04-22 - Strategy-step simplification documented, not restored**. Per user `post-parity-decision-response.md` item 6, `USER_JOURNEY.md` Week 4 and `APPLICATION_FEATURES.md` section 3 now describe the current two-step flow (Select Seeds -> Allocate -> Review) with `balanced` + `moderate` defaults. Not restored this pass.
- **2026-04-22 - Strawberry perennial DTM deferral documented**. Per user `post-parity-decision-response.md` item 1, this remains `xfail` Group H in `backend/tests/test_cross_stack_parity.py`.
- **2026-04-22 - SimulationToolbar un-gating deferred, then reversed**. The earlier standalone follow-up was superseded the same day when the user classified SimulationToolbar as QA/testing tooling rather than an end-user feature.
- **2026-04-22 - Homegrown badge shipped earlier than planned**. Per user `post-review-developer-response.md` item 1, the inventory badge issue was pulled forward and implemented in `frontend/src/components/MySeedInventory.tsx`.
- **2026-04-22 - SimulationToolbar reclassified as QA/testing tool**. Per user `simulation-tool-decision.md`, dev-only gating is correct behavior and not a product contradiction.
- **2026-04-23 - AUDIT-001 verified closed**. Fresh-user verification confirmed the Property Designer empty-state create action is visible at standard zoom without browser zoom workarounds. Keep future Property Designer usability reports separate from this resolved empty-state issue.
- **2026-04-23 - AUDIT-002 verified closed after Stage 1 weather ZIP fix**. Weather now falls back to the user's primary property ZIP when no pinned `weatherZipCode` exists, instead of using the old hardcoded `53209` fallback. User re-test reported the property-backed weather behavior now works as expected.
- **2026-04-23 - New Property Designer workspace-layout issue logged**. Separate from empty-state CTA visibility: once a property exists, too much vertical space is consumed by summary/header content, leaving the actual design canvas cramped. Tracked in `developer-issue-log.md` as `AUDIT-012` and in `property-designer-workspace-finding.md`.
- **2026-04-23 - AUDIT-012 verified closed**. Property Designer populated-state header was compressed so the canvas now dominates the viewport. User re-test reported the workspace looks materially better while keeping the `AUDIT-001` empty-state path intact.
- **2026-04-23 - AUDIT-011 verified closed after active-plan scoping fix**. Indoor Starts import modal now scopes rows to the active plan when `planId` is present, re-fetches when the active plan changes, and still surfaces unattributed rows as `Unknown plan`. User re-test reported the modal now appears to show the correct active-plan rows.
- **2026-04-24 - Dashboard stale-needs-attention (P1) shipped**. Display-layer staleness filter added to `backend/services/dashboard_service.py` with 5 module-level constants (`STALE_INDOOR_START_DAYS=14`, `STALE_TRANSPLANT_DAYS=10`, `STALE_DIRECT_SEED_DAYS=14`, `STALE_GERMINATION_CHECK_DAYS=14`, `HARVEST_DEMOTION_DAYS=14`). Response shape gains a top-level `missed: { indoorStartsDue, transplantsDue, directSeedDue }` block alongside `signals.*`, and `harvestReady` rows gain an `isStale: boolean` flag. Frontend renders a collapsible `Missed (N)` section (default collapsed); harvest rows with `isStale=true` render gray but stay visible (integrity rule — never hide). Zero state mutation — `PlantingEvent.completed` / `quantity_completed` / `PlantedItem.status` / `IndoorSeedStart.status` untouched. 29 backend + 12 frontend + 1 E2E tests added. LGTM from `code-review`. Tracked as `AUDIT-015`. Full context: `dashboard-stale-needs-attention-{finding,plan,decision,backend-report,frontend-report,test-report,code-review}.md`.
- **2026-04-24 - AUDIT-015 verified closed**. User re-test confirmed stale old items no longer clutter the main `Needs Attention Today` feed, a collapsed `Missed (N)` section is present, missed rows appear lower-priority, and `Skip 3d` is absent on Missed rows. Stale-harvest demotion was not directly re-tested due to lack of a sample stale harvest row, but implementation/tests cover that path.
- **2026-04-25 - Calendar / Indoor Starts consistency (A1) shipped**. P1 finding resolved as `AUDIT-016`. Calendar surfaces (`DayDetailModal.tsx`, `EventMarker.tsx`, `GroupedEventsModal.tsx`, `ListView/index.tsx`) now distinguish `Tracked` (solid green pill) vs `Plan only` (amber outline pill / dashed marker border) for indoor-start events; DayDetailModal exposes an inline `Start tracking` action on plan-only rows. Indoor Starts page (`IndoorSeedStarts.tsx`) surfaces a collapsible banner above the card grid listing planned seedings from the active plan that are not yet tracked, with per-row `Start tracking` / `Dismiss` (client-only). Both action paths POST to the existing `/api/indoor-seed-starts/from-planting-event` with `overdueMode='reschedule_today'`. **Zero backend changes**, no schema, no paired-file sync touched. Authoritative `Plan only` predicate is `indoorSeedStartStatus == null && seedStartDate != null` (not falsy). 16 frontend tests added (`code-review` LGTM); R1 SearchBar/sort scope creep flagged in review and reverted before ship. **A2 (auto-create `IndoorSeedStart` on Export to Calendar) explicitly deferred** — see `calendar-indoor-start-consistency-decision.md`. Full context: `calendar-indoor-start-consistency-{finding,triage,decision,plan,a1-approval,slice-a-report,slice-b-report,slice-c-report,slice-d-code-review,code-review-response}.md`.

## Phase A / Phase B Status

User approved Phase A (sync-lockdown) plus Phase B prep (manual smoke checklist) on 2026-04-22. Phase A is complete. Phase B is the active validation lane.

### Phase A - Sync-lockdown - COMPLETE (2026-04-22)

- [x] **A.1 - Calculator-pair parity harness**. Harness lives at `backend/tests/test_cross_stack_parity.py`. Surfaced 116 real drift cases across space-calculator, SFG, plant-DB, and missing-plant groups. Per user direction, drift is not being mechanically patched this pass; the failures were converted to grouped `xfail(strict=True)` markers so CI can stay green while alignment happens incrementally.
- [x] **A.2 - `parse_iso_date` sweep**. Replaced ad-hoc `datetime.fromisoformat` calls on inbound API dates with `utils.helpers.parse_iso_date` to handle JavaScript `'Z'` suffixes.
- [x] **A.3 - `MIGRATIONS.md` doc drift fix**. `backend/MIGRATIONS.md` now states that all schema changes go through Flask-Migrate; `migrations/custom/schema/` is historical-only; `migrations/custom/data/` remains for data-only migrations.

### Phase A Constraints

- Do not touch `frontend/src/components/GardenDesigner.tsx` during Phase A (user decision 2026-04-22).
- Git safe-directory blocker remains unresolved; no git write-side operations were performed during Phase A.

### Phase B - User-journey validation

- [x] **B.0 - Manual smoke-test checklist authored**. File: `dev/active/production-readiness-audit/phase-b-manual-smoke-checklist.md`. Five probes ordered Jan -> Nov/Dec, <=15 min each, with explicit prerequisites, steps, red flags, deviation notes, and scratch space.
- [ ] **B.1 - Run the five probes**. User execution was already started in parallel on 2026-04-22. Findings should be pulled back into this file or a linked findings log.
- [ ] **B.2 - Automate stable flows**. Only automate flows after B.1 identifies which ones are stable and worth locking down in Playwright.

## Scope Truth Checklist

This section exists so the audit stays tied to the promised product scope rather than drifting into only technical cleanup.

- [ ] Build a feature-by-feature verification matrix directly from `APPLICATION_FEATURES.md`.
- [ ] Build a month-by-month verification matrix directly from `USER_JOURNEY.md`.
- [ ] Ensure every major claim in `APPLICATION_FEATURES.md` is mapped to one of: Verified, Partial, Missing, Deferred, or Docs need correction.
- [ ] Ensure every notable seasonal behavior in `USER_JOURNEY.md` is mapped to one of: Verified, Partial, Missing, Deferred, or Docs need correction.
- [ ] Track evidence for each verified claim so we can explain why it is considered done.
- [ ] Track product deviations separately from missing features.
- [ ] Track internal QA utilities separately from end-user features.
- [ ] Do not silently remove scope from `APPLICATION_FEATURES.md` or `USER_JOURNEY.md` to make the audit easier.

## Platform-Wide Invariants

- [ ] Verify multi-user isolation across gardens, seeds, livestock, photos, and admin-visible data.
- [ ] Verify admin role behavior and protections (including last-admin protection).
- [ ] Verify the single current-date model drives dashboard, calendar, snapshot, alerts, and date-aware views consistently.
- [ ] Verify location-aware behavior chain: property -> geocoding -> hardiness zone -> frost dates -> weather -> soil temperature.
- [ ] Verify all five planting methodologies can coexist across different beds without corrupting planner or designer behavior.
- [ ] Verify plant database coverage and icon/reference data are sufficient for the flows documented in the app docs.

## Feature Coverage Checklist

### 1. Dashboard

- [ ] Verify Active Plan card shows correct plan, bed count, plant count, and navigation links.
- [ ] Verify Needs Attention surfaces all promised signal types: harvests, indoor starts, transplants, direct sow, germination, compost, seed stock, livestock, frost/heat, rain, maple tapping.
- [ ] Verify each Needs Attention signal deep-links to the exact record or filtered view the user expects.
- [ ] Verify snooze, dismiss, and mark-done actions work and behave predictably on refresh and future dates.
- [ ] Verify Quick Actions can create planting, harvest, seed, livestock, compost, and photo records.
- [ ] Verify Upcoming Timeline shows the next 14 days correctly and respects current date.
- [ ] Verify Garden Snapshot widget reflects today's date and the active plan accurately.
- [ ] Verify Plan Overview statuses stay in sync with actual plan lifecycle state.
- [ ] Verify Weather tile matches the weather page and property location.
- [ ] Verify dashboard behavior changes appropriately by season, not just on static sample data.

### 2. Garden Season Planner

- [ ] Verify plan create, edit, delete, clone, filter, and activate flows.
- [ ] Verify Step 1 seed browsing and filtering by DTM, soil temp, category, and season suitability.
- [ ] Verify seed selection shows germination rate and expiration state accurately.
- [ ] Verify Step 2 allocation across beds, even/custom distribution, trellis assignment, and bed optimization suggestions.
- [ ] Verify space warnings, rotation warnings, and temporal conflict warnings are understandable and correct.
- [ ] Verify Step 3 review shows allocations, nutrition totals, missing-seed warnings, and export behavior.
- [ ] Verify export to calendar is correct and idempotent.
- [ ] Verify plan detail editor: breakdown by bed, space utilization, rotation warnings, trellis capacity, seed-by-seed view, nutrition cards, and feasibility checker.
- [ ] Verify shopping list generator uses germination rates, seeds per packet, inventory, and brand preferences correctly.
- [ ] Verify simplified strategy behavior is understandable to users and consistent with docs.

### 3. Garden Designer

- [ ] Verify bed create/edit/delete with full attributes: dimensions, method, grid size, sun, soil, mulch, permaculture zone, season extension, shade cloth, notes.
- [ ] Verify bed thumbnail cards reflect current plantings.
- [ ] Verify SVG grid, zoom, coordinate labels, and overlays.
- [ ] Verify plant palette filtering by active plan.
- [ ] Verify drag-and-drop, multi-drag, click-to-place, and placement preview behavior.
- [ ] Verify placement modal: variety, quantity, spacing validation, planting method, germination/survival, final count, transplant date, harvest method.
- [ ] Verify planted-item edit, move, delete, and remove-all-by-plant actions.
- [ ] Verify multi-select workflows behave safely.
- [ ] Verify MIGardener row planner and row schedule modal work end-to-end.
- [ ] Verify Trellis Manager create/edit/assign/overlap detection behavior.
- [ ] Verify date filtering for single-date and range modes.
- [ ] Verify Future Plantings Overlay and Quick Harvest filter interaction.
- [ ] Verify conflict audit modal, auto-resolve, manual fix, and override behavior.
- [ ] Verify Plant Guild workflows, especially Three Sisters.
- [ ] Verify seed-saving workflows from planted item -> seed date -> collect seeds -> inventory entry.
- [ ] Verify weather alert banner appears with the right severity and temperature context.

### 4. Property Designer

- [ ] Verify property create/edit with address, dimensions, coordinates, hardiness zone, soil, slope, frost dates, and acreage calculation.
- [ ] Verify map canvas grid layers, coordinate display, and snap-to-grid behavior.
- [ ] Verify structure placement for trees, beds, greenhouses, sheds, compost, water, apiaries, fences, coops, ponds, worm bins, wells, gates, and landscape elements.
- [ ] Verify structure properties: rotation, custom dimensions, shape type, cost, built date, notes.
- [ ] Verify tree nutrition estimates roll into property and nutrition views.

### 5. Planting Calendar

- [ ] Verify List View, Calendar Grid View, and Timeline View all work on the same event set.
- [ ] Verify supported event types: seed-start, transplant, direct-seed, germination-check, harvest, mulch, fertilizing, irrigation, maple-tapping.
- [ ] Verify list filters, crop sidebar, planted/expected counts, search, sort, and status labels.
- [ ] Verify day detail modal and quick actions from calendar cells.
- [ ] Verify Add Crop modal for manual crop scheduling.
- [ ] Verify Add Garden Event modal for non-plant events.
- [ ] Verify Add Maple Tapping modal with tree selection and series logging.
- [ ] Verify event detail modal shows the correct polymorphic detail fields.
- [ ] Verify frost date display and soil temperature card accuracy.

### 6. Indoor Seed Starts

- [ ] Verify seed start create flow with all documented fields.
- [ ] Verify Import From Garden Plan bulk-creation behavior.
- [ ] Verify mark germinated, ready to transplant, move to garden, mark failed, cancel, and uncancel.
- [ ] Verify sync-status / mismatch indicators against the plan are understandable and correct.
- [ ] Verify seed quantity calculator behavior.
- [ ] Verify deep-link entry from dashboard signals lands the user in the correct record or filtered list.

### 7. Harvest Tracker

- [ ] Verify harvest logging fields, defaults, unit handling, quality rating, linked planting event, notes, and photo attachments.
- [ ] Verify harvest statistics: total harvests, total quantity, heaviest crop, most harvested crop, yield trends.
- [ ] Verify filtering, sorting, and search.
- [ ] Verify harvest entries affect nutrition and dashboard behavior where promised.

### 8. Seed Inventory and Catalog

- [ ] Verify My Inventory fields, provenance, sync status, and badges.
- [ ] Verify variety-specific agronomic overrides are editable and respected downstream.
- [ ] Verify manual add, import from catalog, sync from catalog, edit, delete, and expire actions.
- [ ] Verify CSV import flow, auto-detection, preview, error reporting, and supported supplier formats.
- [ ] Verify global Seed Catalog data is sufficient for the planner and designer workflows.
- [ ] Verify Homegrown seed lifecycle stays visible from collection through future planning.

### 9. Livestock Management

- [ ] Verify chickens, ducks, beehives, and other livestock record flows.
- [ ] Verify egg logs, duck egg logs, hive inspections, honey harvests, and health records.
- [ ] Verify age/status-driven calculations and nutrition contributions.
- [ ] Verify livestock actions can surface on dashboard attention panels where promised.

### 10. Compost Tracker

- [ ] Verify multiple piles, lifecycle state, dimensions, turn frequency, ready date, temperature, and moisture fields.
- [ ] Verify ingredient logging with green/brown categories and C:N guidance.
- [ ] Verify record-turn, mark-ready, and dashboard focus navigation flows.
- [ ] Verify overdue compost alerts and resolution behavior.

### 11. Photo Gallery

- [ ] Verify upload, edit, delete, caption, category, association, search, and filtering.
- [ ] Verify associations to beds, plants, planted items, livestock, and general garden context.
- [ ] Verify responsive grid and lightbox navigation behavior.

### 12. Weather and Alerts

- [ ] Verify current weather, 7-day forecast, humidity, wind, UV, and GDD views.
- [ ] Verify frost, heat, and rain alerts with correct severity thresholds and recommendations.
- [ ] Verify alert preferences are respected.
- [ ] Verify Open-Meteo integration and fallback handling where practical.
- [ ] Verify soil temperature data and mulch-adjusted readiness indicators.

### 13. Nutritional Dashboard

- [ ] Verify garden + livestock + tree aggregation.
- [ ] Verify calories, macros, fiber, and micronutrient calculations.
- [ ] Verify RDA percentages and source drill-down views.
- [ ] Verify seasonal breakdowns, year selector, and multi-year trends.
- [ ] Verify USDA FoodData Central search/import and baseline data management paths.
- [ ] Verify nutrition CSV export.

### 14. Crop Rotation and Succession Planning

- [ ] Verify family-based rotation rules and 3-year validation.
- [ ] Verify alternative bed suggestions and override flows.
- [ ] Verify rotation visualization in designer and planner contexts.
- [ ] Verify succession preference, scheduling, succession-group linkage, row continuity, and per-seed overrides.
- [ ] Verify suitability analysis (heat/cold tolerance, DTM, season fit).
- [ ] Verify date-aware counters across planner, calendar, dashboard, and designer.

### 15. Authentication and User Management

- [ ] Verify registration, login, remember-me, session behavior, password hashing, and last-login tracking.
- [ ] Verify profile management.
- [ ] Verify admin tab user stats, filtering, sorting, create/edit/delete, password reset, admin toggle, and cascade-delete warning.
- [ ] Verify regular users cannot reach admin-only capabilities.

### 16. Garden Snapshot

- [ ] Verify past-date and future-date snapshots.
- [ ] Verify bed expansion, sorting, filtering, and plant detail accuracy.
- [ ] Verify snapshot stays consistent with designer and calendar data for the same date.

### 17. CSV Import / Export and Derived Workflows

- [ ] Verify seed CSV import from supported supplier formats.
- [ ] Verify plan export to calendar remains idempotent and respects conflict handling.
- [ ] Verify nutrition export output.
- [ ] Verify bed layout export behavior if present in the UI/API.

### 18. Maple Tapping Calculator

- [ ] Verify season estimation based on freeze-thaw windows and forecast scanning.
- [ ] Verify tapping event creation, collection logs, sap tracking, syrup yield, and notes.
- [ ] Verify maple tapping prompts appear on dashboard when conditions are met.

### 19. Dashboard Snooze System

- [ ] Verify per-user snoozing by signal key.
- [ ] Verify snoozed items stay hidden only for the intended duration.
- [ ] Verify restore / un-snooze behavior.
- [ ] Verify snooze state does not affect other users.

### 20. Event Details Polymorphism

- [ ] Verify planting events expose plant-specific fields.
- [ ] Verify mulch, fertilizing, irrigation, and maple-tapping events expose event-specific fields.
- [ ] Verify event detail rendering stays correct across list, calendar, and modal views.

### 21. Permaculture Zones and Season Extension

- [ ] Verify permaculture zone values can be configured and persist correctly.
- [ ] Verify season-extension types, layer counts, and material notes.
- [ ] Verify shade-cloth settings and frost-tolerance effects where promised.
- [ ] Verify these settings meaningfully affect planner, weather, or readiness calculations where documented.

## End-to-End User Journey Checklist

These checks are derived from `USER_JOURNEY.md`. They exist to prove that the app works the way a real homesteader expects to use it across the year, not only as isolated screens.

### Winter Planning and Deep-Winter Harvest

- [ ] Verify January dashboard behavior during Persephone-style quiet periods.
- [ ] Verify weekly tunnel harvest logging and winter stock visibility.
- [ ] Verify year-review numbers can be surfaced meaningfully from prior-season data.
- [ ] Verify property refresh flow for tunnel, cold frame, coop, compost, tree, and indoor structure layout.
- [ ] Verify seed inventory review, expiration handling, CSV import, manual unusual-seed entry, and Homegrown badge visibility.
- [ ] Verify full-year planner creation, activation, and export for a complex mixed-season plan.

### Late Winter to Early Spring

- [ ] Verify "growth resuming" and early-season dashboard signals around the end of Persephone conditions.
- [ ] Verify early indoor starts, including unconventional early tunnel tomato starts.
- [ ] Verify cold-frame direct sowing with soil temperature and season-extension influence.
- [ ] Verify maple tapping prompts, event logging, and syrup-yield follow-through.
- [ ] Verify recurring microgreens / sprouts style workflows if implemented.

### Spring Ramp-Up

- [ ] Verify peak indoor-start import-from-plan flow at realistic scale.
- [ ] Verify dashboard cascade across direct seed, germination, harvest-ready, and indoor checks in one day.
- [ ] Verify tunnel transplant flow with trellis position allocation.
- [ ] Verify MIGardener row-planner rhythm across multiple rows and successions.
- [ ] Verify parallel inside/outside successions of the same crop do not confuse counts, filters, or snapshots.
- [ ] Verify transplant completion updates indoor-start state cleanly.

### Warm-Season Transition

- [ ] Verify last-frost-driven transitions into field tomatoes, peppers, eggplant, beans, cucumbers, basil, and squash.
- [ ] Verify staggered tomato waves and other staged successions.
- [ ] Verify Plant Guild / Three Sisters flow.
- [ ] Verify seed-density mode and trellis allocation in realistic summer beds.

### Peak Summer and Fall Planning Pivot

- [ ] Verify heat alerts and shade-cloth context.
- [ ] Verify fall brassica indoor starts and fall direct-sow timing.
- [ ] Verify continued succession alerts through summer.
- [ ] Verify harvest logging, photo logging, and nutrition accumulation during peak harvest.
- [ ] Verify mulch events and other non-plant calendar events in active-season use.

### Fall Transition and Winter Setup

- [ ] Verify winter-hold crop planning and planting in tunnel / cold-frame contexts.
- [ ] Verify seed-saving set-date and collect-seeds workflows across multiple crops.
- [ ] Verify overwintered crops such as garlic, onions, and spring spinach.
- [ ] Verify frost warnings, row-cover behavior, cover-crop flows, and tunnel / frame closure workflows.

### Harvest-Only Mode and Year-End Review

- [ ] Verify dashboard transitions toward harvest-only mode in November and December.
- [ ] Verify root-cellar / storage-adjacent entries if they are represented in current product scope.
- [ ] Verify compost completion logging late in the season.
- [ ] Verify winter harvest logging and nutrition contribution visibility.
- [ ] Verify year-end nutrition review, harvest statistics review, and plan-cloning workflow.

## User-Friendly / UX Checklist

Correctness alone is not enough. These checks exist to confirm the product is understandable and practical for a real user.

- [ ] Verify each major screen has a clear default state and an understandable empty state.
- [ ] Verify each major workflow has a discoverable primary action without hunting through the UI.
- [ ] Verify deep-links land on the exact item the user expects, not just the right page.
- [ ] Verify warnings explain what is wrong and what the user can do next.
- [ ] Verify destructive actions have confirmation where appropriate.
- [ ] Verify forms preserve work or fail gracefully when validation errors occur.
- [ ] Verify date-aware screens make it obvious which date is driving the current view.
- [ ] Verify users can tell the difference between planned data, current planted reality, and harvested/completed history.
- [ ] Verify cross-plan behavior is understandable anywhere multiple plans could be mixed.
- [ ] Verify labels and status names stay consistent across planner, designer, calendar, dashboard, and indoor starts.
- [ ] Verify major calculations are explained well enough that users trust warnings and estimates.
- [ ] Verify mobile / narrower-screen behavior remains usable on high-value screens.
- [ ] Verify accessibility basics on interactive flows: keyboard reachability, visible focus, readable alerts, modal usability.

## Documentation Truth and Deviation Control

- [ ] Review `APPLICATION_FEATURES.md` section by section and mark each claim as Verified / Partial / Missing / Deferred / Docs need correction.
- [ ] Review `USER_JOURNEY.md` month by month and mark each notable flow as Verified / Partial / Missing / Deferred / Docs need correction.
- [ ] Record any feature that is implemented but confusing enough to fail the "user friendly" standard.
- [ ] Record any feature that exists in code but is missing from docs.
- [ ] Record any feature that is still described in docs but no longer exists in the product.
- [ ] Do not change docs to hide defects without an explicit product decision.
- [ ] Keep internal QA utilities clearly labeled so they do not get mistaken for promised end-user functionality.

## R9 Narrative Gaps (Deferred - Retained in `USER_JOURNEY.md` as Intended Scope)

The following capabilities are described in `USER_JOURNEY.md` but are not currently implemented. Per user decision on 2026-04-22 they remain in `USER_JOURNEY.md` as intended scope and are not to be removed from that doc.

- [ ] **Microgreens rotation** (Week 4, Week 9, December) - no first-class model or dashboard rotation reminder.
- [ ] **Weekly tunnel harvest info card** (January Week 1) - dashboard info card showing current tunnel stocks.
- [ ] **First-class cover-crop tagging** (October Week 39) - currently notes-only on a `PlantingEvent`; no dedicated type/tag.

Do not edit `USER_JOURNEY.md` to remove these. Do not edit `APPLICATION_FEATURES.md` to erase them.

## Product Deviation Tier

Separate from the R9 narrative gaps above. These are features that were implemented and then partially removed, broken, or gated in a way that contradicts `USER_JOURNEY.md`. They need product decisions, not only engineering cleanup.

- [x] **1. Planner wizard "Configure Strategy" step removed from UI** - real deviation, docs reconciled on 2026-04-22. The Garden Planner wizard now hardcodes `strategy='balanced'` and `succession_preference='moderate'`. Resolution: docs were amended to match code reality rather than restoring the UI. Trigger to revisit: if strategy becomes a configurable power-user feature again.
- [x] **2. "Homegrown" badge missing from `MySeedInventory.tsx`** - real deviation, resolved on 2026-04-22. Backend already wrote `is_homegrown=True`; inventory UI now renders the badge when `seed.isHomegrown === true`.

`SimulationToolbar` was removed from this tier on 2026-04-22 because it is internal QA tooling, not a product deviation.

## Internal Tooling / QA Utilities

Tools that exist to validate the site and surface errors during development or review passes. They are not end-user features and should not be tracked as product deviations.

- **`SimulationToolbar` (Time Machine)** - `frontend/src/components/SimulationToolbar.tsx:20` returns `null` when `NODE_ENV !== 'development'`. Per user `simulation-tool-decision.md` on 2026-04-22, this is a QA/testing tool used to validate date-aware behavior, year-boundary flow, and seasonal signals. Dev-only gating is correct behavior. It may be removed, disabled, or hidden permanently once site validation is complete.

## Intentional Deferrals

Items where the current state is deliberately frozen pending a larger product decision. Separate from R9 narrative gaps (unimplemented scope) and Product Deviation Tier (product contradictions).

- [ ] **`strawberry-1` perennial-plant DTM + rowSpacing drift** - tracked as Group H in `backend/tests/test_cross_stack_parity.py`. Real drift: backend `daysToMaturity=90, rowSpacing=24` vs frontend `daysToMaturity=120, rowSpacing=18`. Deferred because neither annual-style value is semantically correct for a perennial. Trigger to revisit: perennial modeling design.
- [ ] **Plan duplicate naming flow** - weak rename affordance after "Duplicate Plan". Queued for a later workflow-polish pass. Trigger to revisit: plan-clarity / plan-management polish work.
- [ ] **Future exact-placement reservation (Model 2)** - the app does not currently let a user pick an exact cell for an indoor start without also advancing it to `transplanted` in the same action. AUDIT-013 resolved record-to-cell linkage but is explicitly atomic (placement + transplant). Per user decision on 2026-04-23 in `future-placement-reservation-decision.md`, the product runs on Model 1 (placement means transplant now); future-reservation is **by-design limitation** for the current pass. See `future-placement-reservation-analysis.md` for the full Model 1 / Model 2 / Model 3 comparison + scope estimates. Trigger to revisit: if a dedicated pre-transplant layout-planning feature is scheduled as planned product work. Model 2 requires new schema (`IndoorSeedStart.reserved_bed_id/position_x/y`), new reservation endpoint, ghost-cell rendering in the designer, promotion flow at transplant time, and conflict detection — treated as a multi-commit feature, not an audit fix.

## Completed Product Decisions / Follow-through

- [x] **`?planId=` scoping filter on `/api/planting-events/needs-indoor-starts`** - formerly deferred while plan-attribution work was still incomplete. Resolved on 2026-04-23 as part of `AUDIT-011`: modal now scopes rows to the active plan when `planId` is present, re-fetches on active-plan change, and still includes unattributed rows labeled `Unknown plan`.

## Open Workflow Follow-ups

*(none currently open — see Intentional Deferrals for the Model 2 future-reservation item, which is product-scope rather than an open defect)*

## Completed Workflow Follow-through

- [x] **Designer banner wording / write-path safety for pre-ready placement flow** - pre-ready states now use planning-oriented copy and require a confirm dialog before performing the real transplant-status write. Verified from the user side on 2026-04-23. This does not replace the broader `AUDIT-013` specific-placement follow-up.
- [x] **`AUDIT-013` — Specific indoor-start placement flow** - banner now enters a cell-picker mode, auto-navigates to the destination bed, and dispatches `POST /api/planted-items` with `sourceIndoorSeedStartId` so the create-PlantedItem + advance-status writes happen atomically. Path A (status-only write) removed entirely. Shipped in commit `2ca6390` on 2026-04-23. Documented in `audit-013-fix-report.md` / `audit-013-report-back.md`. User-side re-test expected against four acceptance points.

## Testing and Automation Follow-Up

- [ ] Log every developer-actionable failure in `developer-issue-log.md` with repro steps, impact, suspected area, and acceptance criteria.
- [ ] Keep `developer-issue-log.md` status in sync as issues move from discovery -> handoff -> fix -> verification.
- [x] Re-test `AUDIT-012` after any Property Designer workspace-layout fix; closure for `AUDIT-001` does not cover ongoing canvas usability.
- [ ] Turn the feature checklist above into a linked proof matrix with file references or test references.
- [ ] Identify which current Playwright suites already cover the highest-value flows and which claims remain uncovered.
- [ ] Add or update Playwright smoke coverage for the top user journeys once B.1 findings stabilize.
- [ ] Add focused tests for date-aware behavior where simulation/current-date logic is central.
- [ ] Add focused tests for planner/designer/calendar cross-module contracts where drift risk is high.
- [ ] Revisit parity `xfail` groups and promote the most important ones into planned alignment work.

## Technical Debt Follow-Up

- [ ] Review SQLAlchemy `Query.get()` deprecation warnings.
- [ ] Investigate cyclic FK warning during SQLite metadata teardown.
- [ ] Refresh stale `baseline-browser-mapping` dependency metadata.
- [ ] Restore git review workflow by addressing safe-directory ownership issue.
- [ ] Re-check geocoding / hardiness fallback resilience after any future location-model changes.

## Progress Note

The old `13/26 tasks completed` count is obsolete after expanding this file into a full audit checklist on 2026-04-23.

Next progress update should report:

1. How many feature-domain items are verified vs partial vs missing.
2. How many seasonal user-journey flows are verified vs partial vs missing.
3. Which open items are real bugs, real product gaps, or documentation corrections.
