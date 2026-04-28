# Production Readiness Audit - Developer Issue Log

**Created**: 2026-04-23
**Last Updated**: 2026-04-28 (AUDIT-021 verified closed)

## Purpose

This file is the handoff log for defects, product deviations, and usability failures found during:

- manual smoke testing
- automated tests
- focused verification passes
- code review during the production-readiness audit

Use this file when something should be sent to the developer to fix.

This is different from `tasks.md`:

- `tasks.md` tracks the full audit scope.
- `developer-issue-log.md` tracks concrete issues that need engineering action or explicit product resolution.

## Workflow

1. When a problem is found, add an issue entry here.
2. Include enough detail that the developer can reproduce it without guessing.
3. Mark the issue status when it is handed off.
4. After a fix is shipped, re-test the exact scenario.
5. Only close the issue after the behavior is verified.

## Status Values

- `New`
- `Sent to developer`
- `In progress`
- `Fixed pending verification`
- `Verified closed`
- `Needs product decision`
- `Docs reconciled - no code change`

## Priority Guide

- `P0`: blocks core use or causes data corruption
- `P1`: serious workflow break or trust problem in a key feature
- `P2`: meaningful usability or consistency issue
- `P3`: polish issue or minor mismatch

## Issue Template

Copy this block for each new issue:

```md
## AUDIT-###

- Status:
- Priority:
- Source:
- Area:
- Summary:
- Expected:
- Actual:
- Impact:
- Repro steps:
  1.
  2.
  3.
- Evidence:
- Suspected files / systems:
- Acceptance criteria:
  - [ ]
  - [ ]
- Notes:
```

## Active Issues

## AUDIT-001

- Status: `Verified closed`
- Priority: `P2`
- Source: `phase-b-smoke-findings.md` finding 1
- Area: Property Designer
- Summary: Create Property action is effectively below the visible page area when no properties exist.
- Expected: A first-time user with no properties should be able to clearly see and reach the create action without changing browser zoom.
- Actual: The user had to reduce browser zoom to `70%` to access the action.
- Impact: First-run property setup looks broken or incomplete and blocks a foundational workflow.
- Repro steps:
  1. Open the app with an account that has no properties.
  2. Navigate to Property Designer or the first-run property setup path.
  3. Observe whether the create action is fully visible at normal browser zoom.
- Evidence: `phase-b-smoke-findings.md`
- Suspected files / systems: property onboarding UI, empty-state layout, responsive styling
- Acceptance criteria:
  - [x] Create Property action is visible at standard desktop zoom without scrolling tricks or zoom reduction.
  - [x] Empty state remains usable on common viewport heights.
- Notes: `user-facing-pass-report.md` records this as completed and pushed in commit `26317b7` on 2026-04-23. User re-test on 2026-04-23 with a fresh account (`FredVine`) confirmed the create action is visible at standard zoom without needing browser zoom changes. Keep separate from the later workspace-layout finding once a property already exists.

## AUDIT-002

- Status: `Verified closed`
- Priority: `P2`
- Source: `phase-b-smoke-findings.md` finding 2
- Area: Dashboard / Weather
- Summary: Weather views used a hardcoded fallback ZIP instead of the user's property ZIP when no pinned weather ZIP was set.
- Expected: After property creation and address validation, weather should default to the user's primary property ZIP unless the user has explicitly pinned a different weather ZIP.
- Actual: Weather could fall back to `53209` instead of the property ZIP, undermining the user's trust that weather was using their actual location.
- Impact: Undermines user trust in whether location-aware setup is complete.
- Repro steps:
  1. Create or validate a property with usable location data.
  2. Return to dashboard.
  3. Compare dashboard weather tile messaging with the weather page state.
- Evidence: `phase-b-smoke-findings.md`, `audit-002-retest-update.md`, `audit-002-fix-report.md`
- Suspected files / systems: frontend weather ZIP resolution, dashboard weather tile state derivation, weather setup gating logic
- Acceptance criteria:
  - [x] Dashboard weather tile reflects the real configured state.
  - [x] Property ZIP is used when no pinned weather ZIP exists.
  - [x] Hardcoded `53209` fallback is no longer driving normal user weather setup.
- Notes: Early copy-only handling was insufficient. Stage 1 frontend fix is documented in `audit-002-fix-report.md` (commit `5a673aa`: "Seed weather ZIP from user's primary property instead of '53209'"). User re-test on 2026-04-23 reported the property/location-backed weather behavior now works as expected, so this issue is verified closed.

## AUDIT-003

- Status: `Verified closed`
- Priority: `P2`
- Source: `phase-b-smoke-findings.md` finding 3
- Area: Garden Planner
- Summary: Create Plan workflow does not clearly move the user into the next working step after plan creation.
- Expected: After creating a new plan, the user should be guided directly into the working planner flow or see an obvious next action.
- Actual: The app returns to the plan list and requires the user to infer that `Work` is the next step.
- Impact: New-plan workflow feels incomplete and non-obvious.
- Repro steps:
  1. Create a new garden plan.
  2. Save the plan.
  3. Observe the destination screen and clarity of next-step guidance.
- Evidence: `phase-b-smoke-findings.md`
- Suspected files / systems: plan creation flow, post-save redirect, plan list CTA design
- Acceptance criteria:
  - [x] Post-create destination makes the next step obvious.
  - [x] User does not need insider knowledge to continue working on the new plan.
- Notes: Fix shipped in commit `ebba9ee` on 2026-04-23. User re-test confirmed new plan creation now lands directly in the wizard with the plan name pre-wired.

## AUDIT-004

- Status: `Verified closed`
- Priority: `P1`
- Source: `phase-b-smoke-findings.md` finding 5
- Area: Garden Planner / Nutrition loading
- Summary: Successful plan export shows an unrelated red error toast about nutrition loading.
- Expected: A successful export should complete without surfacing unrelated failure messaging.
- Actual: Export succeeds, but a red toast appears saying `Failed to load nutritio...`.
- Impact: User cannot trust whether export actually succeeded and may think data is corrupted or incomplete.
- Repro steps:
  1. Create or open a valid plan.
  2. Export it successfully.
  3. Observe whether any unrelated error toast appears during or after success.
- Evidence: `phase-b-smoke-findings.md`
- Suspected files / systems: planner export flow, nutrition fetch side effects, toast handling
- Acceptance criteria:
  - [x] Successful export does not show unrelated error toasts.
  - [x] If a secondary fetch fails, it is either silently retried or messaged in a way that does not contradict export success.
- Notes: Fix shipped in commit `e748842` on 2026-04-23. User re-test reported the red nutrition toast is gone and export to calendar works.

## AUDIT-005

- Status: `Verified closed`
- Priority: `P1`
- Source: `phase-b-smoke-findings.md` finding 6
- Area: Indoor Seed Starts import
- Summary: Importing starts from a plan silently creates already-overdue starts based on past schedule dates.
- Expected: Importing from a plan on the current date should either reschedule intelligently or clearly guide the user through handling overdue starts.
- Actual: Imported starts are created with past start and germination dates relative to the current date.
- Impact: Users import a plan and immediately receive confusing, stale, or overdue records.
- Repro steps:
  1. Create or activate a plan whose intended indoor-start dates are already in the past.
  2. Open Indoor Seed Starts and import from the plan on the current date.
  3. Observe the created records and their dates.
- Evidence: `phase-b-smoke-findings.md`, `phase-b-6-indoor-starts-backdating-proposal.md`
- Suspected files / systems: indoor-start import logic, date handling, plan-to-start conversion rules
- Acceptance criteria:
  - [x] Import behavior is explicit about whether dates are historical, current, or rescheduled.
  - [x] Users are not silently dropped into overdue states without guidance.
- Notes: Fix shipped in commit `58ae342` on 2026-04-23. User re-test reported an overdue options prompt appeared instead of silently importing stale starts.

## AUDIT-006

- Status: `Verified closed`
- Priority: `P2`
- Source: `phase-b-smoke-findings.md` finding 7
- Area: Indoor Seed Starts
- Summary: Similar imported starts show inconsistent actions without clear explanation.
- Expected: Comparable imported starts should present consistent actions, or the UI should clearly explain why different actions are shown.
- Actual: Lettuce showed `Transplant Now`; tomato did not.
- Impact: Users cannot trust status/action logic in Indoor Seed Starts.
- Repro steps:
  1. Import multiple indoor starts from a plan.
  2. Compare the action buttons shown on different imported records.
  3. Check whether the differences are explained in the UI.
- Evidence: `phase-b-smoke-findings.md`
- Suspected files / systems: indoor-start status derivation, action rendering conditions
- Acceptance criteria:
  - [x] Action availability is consistent for similar records.
  - [x] Any intentional differences are explained to the user.
- Notes: Resolved as part of the destination-resolution/import fixes shipped in `c98b8a0` and later indoor-start flow cleanup. User verification reported the destination/action behavior now looks generally correct from the user side. A minor workflow note remains that importing from plan is not fully obvious unless the plan has first been exported to calendar, but that is tracked separately as a product-clarity observation rather than this issue.

## AUDIT-007

- Status: `Verified closed`
- Priority: `P2`
- Source: `phase-b-smoke-findings.md` finding 8
- Area: Indoor Seed Starts import
- Summary: Imported starts do not clearly show whether a destination bed is assigned.
- Expected: Imported starts should clearly indicate destination bed assignment state.
- Actual: Lettuce showed a destination bed; tomato did not clearly show one.
- Impact: Users cannot trust plan import completeness or downstream transplant context.
- Repro steps:
  1. Import indoor starts from a garden plan.
  2. Compare records that should have clear destination context.
  3. Observe whether destination assignment is visible and consistent.
- Evidence: `phase-b-smoke-findings.md`
- Suspected files / systems: import mapping, destination display, plan item attribution
- Acceptance criteria:
  - [x] Destination assignment is clearly surfaced for imported starts.
  - [x] Missing destination state is visible and understandable when applicable.
- Notes: Resolved as part of the destination-resolution/import fixes shipped in `c98b8a0`. User verification indicated assigned/missing destination states now appear understandable enough in practice.

## AUDIT-008

- Status: `Verified closed`
- Priority: `P0`
- Source: `phase-b-smoke-findings.md` finding 9
- Area: Garden Designer / Indoor Seed Starts linkage
- Summary: Placing a crop in Designer creates a duplicate indoor-start record instead of advancing or linking the existing imported record.
- Expected: If a crop already has an imported indoor-start record, placement/transplant flow should use or advance that existing record.
- Actual: Placing lettuce resulted in a new Indoor Start card rather than clearly linking to the existing one.
- Impact: Duplicate records create data integrity problems and destroy user trust in cross-module workflows.
- Repro steps:
  1. Import indoor starts from a plan.
  2. Go to Designer and place a crop that should correspond to one of those starts.
  3. Return to Indoor Seed Starts and inspect the resulting records.
- Evidence: `phase-b-smoke-findings.md`
- Suspected files / systems: designer placement flow, indoor-start linking logic, planted-item / event / start synchronization
- Acceptance criteria:
  - [x] Existing indoor-start records are reused or advanced instead of duplicated.
  - [x] Cross-module status remains consistent after placement.
  - [x] No duplicate start cards are created for the same planned/imported start without explicit user intent.
- Notes: Original duplicate-card bug was first addressed in `2b59107`, then substantially superseded by the explicit source-record placement flow shipped in `2ca6390` (`AUDIT-013`). User re-test on 2026-04-24 indicated the flow now appears to work without creating a duplicate record.

## AUDIT-009

- Status: `Verified closed`
- Priority: `P1`
- Source: `phase-b-smoke-findings.md` finding 10
- Area: Seed Saving
- Summary: Save-for-seed state does not persist after leaving and reopening the plant.
- Expected: After marking a plant Save for Seed, that state should persist.
- Actual: After leaving and reopening the plant, it is no longer marked for seed saving.
- Impact: Seed-saving workflow is unreliable and may cause users to lose planning intent.
- Repro steps:
  1. Open a plant in Designer.
  2. Mark it Save for Seed.
  3. Leave the plant detail view and reopen it.
  4. Check whether the save-for-seed state remains.
- Evidence: `phase-b-smoke-findings.md`
- Suspected files / systems: planted-item state persistence, save-for-seed toggle flow, backend save path
- Acceptance criteria:
  - [x] Save-for-seed state persists across navigation and reload.
  - [x] Subsequent seed-saving workflow steps use the saved state correctly.
- Notes: Earlier fix `90c09a3` addressed the "disappears from grid" symptom but not the stale reopen state. Final retest fix shipped in commit `44cc572` with docs commit `3b71858`. User re-test on 2026-04-24 reported the workflow now appears to pass.

## AUDIT-010

- Status: `Verified closed`
- Priority: `P2`
- Source: `phase-b-smoke-findings.md` finding 11
- Area: Garden Planner / Plan Management
- Summary: Duplicate Plan flow creates weak naming and rename affordance.
- Expected: User should be prompted to name the duplicated plan or see an obvious rename path immediately.
- Actual: Duplicate appears with original name plus `-copy`, with no obvious rename option in the flow.
- Impact: Plan management gets messy and users can easily lose track of which plan is which.
- Repro steps:
  1. Duplicate an existing plan.
  2. Observe the new plan name and immediate edit affordances.
  3. Check whether rename is obvious in the resulting workflow.
- Evidence: `phase-b-smoke-findings.md`, `tasks.md` intentional deferral
- Suspected files / systems: plan duplication flow, plan-management UX
- Acceptance criteria:
  - [x] Duplicate flow gives an obvious, immediate naming path.
  - [x] Users can distinguish original and copy without cleanup hunting.
- Notes: This was initially deferred, then implemented and pushed in commit `29cb17e` on 2026-04-23 per `user-facing-pass-report.md`. User re-test on 2026-04-24 reported that the duplicate-plan naming flow now appears to work.

## AUDIT-011

- Status: `Verified closed`
- Priority: `P1`
- Source: `phase-b-smoke-findings.md` finding 12
- Area: Indoor Seed Starts import
- Summary: Import-from-plan flow does not clearly identify which plan the rows are sourced from.
- Expected: When importing from a garden plan, the selected or active source plan should be explicit and the rows shown should match that plan.
- Actual: The modal did not clearly reflect the source plan, and there was no visible indication of which plan the rows were being pulled from.
- Impact: User cannot trust which plan is being imported; the workflow becomes ambiguous and error-prone.
- Repro steps:
  1. Create or activate a second plan with a very distinctive quantity signature.
  2. Open Indoor Seed Starts -> Import From Garden Plan.
  3. Observe whether the UI clearly identifies the source plan and rows.
- Evidence: `phase-b-smoke-findings.md`, `finding-12-response.md`, `finding-12-implementation-decision.md`
- Suspected files / systems: import modal source-plan selection, plan attribution display, query scoping
- Acceptance criteria:
  - [x] UI clearly identifies which plan is currently being imported.
  - [x] Displayed rows match the selected or active plan logic.
  - [x] If rows can intentionally come from multiple plans, the UI states that clearly.
- Notes: Earlier plan-label-only handling was not sufficient and failed re-test. Final fix shipped in commit `a33b921` with supporting docs commits `1781270`, `f0cd53a`, and `ab155f5`. User re-test on 2026-04-23 reported the modal now appears to scope correctly to the active plan and the original trust issue is resolved from the user side. Null / unattributed events remain visible as `Unknown plan` per the approved decision.

## AUDIT-012

- Status: `Verified closed`
- Priority: `P2`
- Source: `property-designer-workspace-finding.md`
- Area: Property Designer
- Summary: Once a property exists, too much vertical space is consumed by summary/header content, leaving the actual design workspace cramped.
- Expected: Most of the screen should support actual property-layout work when the user is actively designing a property.
- Actual: The upper Property Designer info area (header, stats, explanatory content) takes a large portion of the viewport, compressing the useful design canvas into the lower part of the page.
- Impact: The page technically works, but the core property-design workflow feels inefficient and visually cramped on standard desktop viewports.
- Repro steps:
  1. Create or open a property in Property Designer.
  2. View the page on a standard desktop viewport at normal zoom.
  3. Observe how much vertical space is reserved for summary/header content compared with the usable design canvas.
- Evidence: `property-designer-workspace-finding.md`
- Suspected files / systems: Property Designer page layout, stats/header section sizing, canvas/container height allocation, responsive styling
- Acceptance criteria:
  - [x] Design canvas receives the majority of vertical real estate on standard desktop viewports.
  - [x] Summary/header content is denser, collapsible, or otherwise reduced once a property is selected.
  - [x] Actual property-layout work no longer feels compressed into the lower portion of the screen.
- Notes: Separate from `AUDIT-001`. Developer reports local commits `6935fb0` (layout fix) and `6d275c9` (fix report) for this issue. User re-test on 2026-04-23 reported that the populated Property Designer view now looks materially better and the canvas dominates the viewport as intended.

## AUDIT-013

- Status: `Verified closed`
- Priority: `P1`
- Source: `indoor-start-specific-placement-followup.md`
- Area: Indoor Seed Starts / Garden Designer workflow
- Summary: The app still does not clearly let the user place one specific existing indoor-start record into an exact bed position as distinct from creating a new planting from the garden side.
- Expected: When entering placement from Indoor Starts, the flow should make it obvious that the user is placing that exact indoor-start record into the bed, not starting a separate new planting flow.
- Actual: Even after the `Plan Placement` label improvement, the downstream placement flow still feels too close to creating a new garden-side planting rather than using a specific existing indoor start.
- Impact: Users may not trust whether they are placing the planned indoor start they selected or inadvertently creating a separate planting path.
- Repro steps:
  1. Open Indoor Starts with an existing planned indoor-start record assigned to a destination bed.
  2. Use the placement/transplant entry action from that record.
  3. Follow the flow into Garden Designer and try to place that exact planned item into a specific bed location.
  4. Observe whether the flow clearly distinguishes "place this existing indoor start" from "create a new planting from the bed side."
- Evidence: `indoor-start-specific-placement-followup.md`
- Suspected files / systems: Indoor Starts -> Designer linkage, placement flow semantics, specific-record tracking across modules
- Acceptance criteria:
  - [x] The flow clearly identifies the specific indoor-start record being placed.
  - [x] The user can tell they are placing that existing record, not creating a separate new planting flow.
  - [x] Resulting placement clearly advances or links the selected indoor-start record.
- Notes: Resolved by the explicit cell-picker placement flow shipped in `2ca6390`, with docs/report commits `195a20d`, `6ae3ef2`, and `64a319c`. A separate future-feature question remains about reserving an exact future spot without also transplanting; that is now tracked as a by-design limitation / intentional deferral, not as an active defect.

## AUDIT-014

- Status: `Verified closed`
- Priority: `P2`
- Source: `indoor-start-plan-placement-banner-followup.md`
- Area: Garden Designer / Indoor Start banner flow
- Summary: Pre-ready placement flow used transplant-execution wording and allowed a real transplant-status write without clear warning.
- Expected: Pre-ready placement flow should not look like harmless planning while silently performing a real `status='transplanted'` write.
- Actual: Banner/action wording was adjusted and a confirm dialog now appears before the real write for pre-ready states.
- Impact: The immediate trust/safety issue is improved; users are warned before the write occurs.
- Repro steps:
  1. Open a pre-ready indoor-start record with a destination bed.
  2. Enter the bed-placement flow.
  3. Click `Save placement`.
  4. Confirm that a dialog appears warning that the start is not ready and that proceeding will mark it transplanted.
- Evidence: `indoor-start-plan-placement-banner-followup.md`, `indoor-start-banner-report-back.md`
- Suspected files / systems: `GardenDesigner.tsx`, indoor-start banner copy, pre-ready write gating
- Acceptance criteria:
  - [x] Pre-ready states use planning-oriented banner/action copy.
  - [x] A confirm dialog appears before the transplant-status write for pre-ready states.
  - [x] `hardening` keeps the direct transplant wording/path.
- Notes: User re-test on 2026-04-23 confirmed the confirm dialog appears as expected. This closes the smaller banner/write-path safety issue only. The broader specific-placement workflow question remains open as `AUDIT-013`.

## AUDIT-015

- Status: `Verified closed`
- Priority: `P1`
- Source: `dashboard-stale-needs-attention-finding.md`
- Area: Dashboard / Needs Attention Today
- Summary: Stale reminders from Feb 1 / Feb 2 were still surfacing in `Needs Attention Today` on Apr 24 as if they were normal current-day actions.
- Expected: `Needs Attention Today` should primarily surface items meaningfully actionable today; overdue items should age out of the primary feed or move to a lower-priority state, without silently rewriting history on integrity-sensitive records (harvests, seed-saving, inventory).
- Actual: Every signal builder let items fall through as long as the domain completion predicate was false. No server-side age-out filter existed, so indoor-start / transplant / direct-sow / germination-check reminders from months ago persisted indefinitely.
- Impact: Dashboard felt noisy and unrealistic; truly current work was harder to see; users felt they had to click through every old task just to make the dashboard usable.
- Repro steps:
  1. Load a plan whose indoor-start dates are 30+ days in the past.
  2. Open the dashboard on a current date.
  3. Observe stale reminders still present in `Needs Attention Today`.
- Evidence: `dashboard-stale-needs-attention-finding.md`, `dashboard-stale-needs-attention-plan.md`, `dashboard-stale-needs-attention-decision.md`, `dashboard-stale-needs-attention-backend-report.md`, `dashboard-stale-needs-attention-frontend-report.md`, `dashboard-stale-needs-attention-test-report.md`, `dashboard-stale-needs-attention-code-review.md`
- Suspected files / systems: `backend/services/dashboard_service.py`, `frontend/src/components/Dashboard/NeedsAttentionPanel.tsx`, `frontend/src/components/Dashboard/types.ts`
- Acceptance criteria:
  - [x] Stale indoor-start / transplant / direct-sow reminders age out of the primary feed after a type-specific threshold.
  - [x] Aged-out items surface in a collapsible `Missed (N)` bucket rather than disappearing entirely.
  - [x] Harvest rows never hide — demote visually via `isStale` flag but stay visible and clickable.
  - [x] Germination checks drop silently (no Missed bucket).
  - [x] Zero state mutation on `PlantingEvent.completed` / `quantity_completed` / `PlantedItem.status` / `IndoorSeedStart.status`.
  - [x] Snooze/dismiss filter runs across both buckets so dismissals persist across aging.
  - [x] `signalKey` prefix format preserved so `getCancellableAction()` routing and `NeedsAttentionTarget` deep-link invariants still hold.
- Notes: Display-layer-only filter. Five module-level constants in `dashboard_service.py` (`STALE_INDOOR_START_DAYS=14`, `STALE_TRANSPLANT_DAYS=10`, `STALE_DIRECT_SEED_DAYS=14`, `STALE_GERMINATION_CHECK_DAYS=14`, `HARVEST_DEMOTION_DAYS=14`). Response shape gains top-level `missed: { indoorStartsDue, transplantsDue, directSeedDue }` alongside `signals.*`; `harvestReady` rows gain `isStale: boolean`. Frontend renders a collapsible `Missed (N)` section (default collapsed) with no `Skip 3d` chip. 29 new backend tests + 12 new frontend tests + 1 new E2E spec. `code-review` returned LGTM on 2026-04-24 with no blocking issues. No schema change, no migration, no paired-file sync needed.

## AUDIT-016

- Status: `Verified closed`
- Priority: `P1`
- Source: `calendar-indoor-start-consistency-finding.md`
- Area: Planting Calendar / Indoor Seed Starts cross-page consistency
- Summary: PlantingEvents with a `seedStartDate` were rendered identically on the calendar regardless of whether they had a linked `IndoorSeedStart`, and the Indoor Starts page never surfaced "scheduled but not yet tracked" seedings, leaving users no obvious reconciliation path between the schedule layer and the tracking layer.
- Expected: Calendar surfaces should visually distinguish tracked indoor starts from plan-only ones, and the Indoor Starts page should surface plan-only seedings with a one-click way to begin tracking them.
- Actual: Both layers existed in isolation. `export_to_calendar` creates `PlantingEvent` rows but no `IndoorSeedStart` rows; nothing in the UI told users this asymmetry existed or how to bridge it.
- Impact: Users could believe an exported plan was "set up" for indoor starts without ever creating the tracking records; conversely, the Indoor Starts page felt empty even though plenty of plan items implied indoor work.
- Verification notes: User re-test confirmed the tracked / plan-only distinction now reads clearly enough in the calendar flow, and the previously-missed clicked-day modal surface now groups repeated same-day same-bed same-plant rows instead of listing noisy per-cell duplicates.
- Repro steps:
  1. Export a plan whose items have transplant-method seedings (e.g., tomatoes, peppers).
  2. Open the calendar around the relevant `seedStartDate` — observe markers/rows look identical to tracked ones.
  3. Open the Indoor Starts page — observe no surface listing the just-exported planned seedings.
- Evidence: `calendar-indoor-start-consistency-finding.md`, `calendar-indoor-start-consistency-triage.md`, `calendar-indoor-start-consistency-decision.md`, `calendar-indoor-start-consistency-plan.md`, `calendar-indoor-start-consistency-a1-approval.md`, `calendar-indoor-start-consistency-slice-a-report.md`, `calendar-indoor-start-consistency-slice-b-report.md`, `calendar-indoor-start-consistency-slice-c-report.md`, `calendar-indoor-start-consistency-slice-d-code-review.md`, `calendar-indoor-start-consistency-code-review-response.md`
- Suspected files / systems: `frontend/src/components/PlantingCalendar/CalendarGrid/DayDetailModal.tsx`, `frontend/src/components/PlantingCalendar/CalendarGrid/EventMarker.tsx`, `frontend/src/components/PlantingCalendar/CalendarGrid/GroupedEventsModal.tsx`, `frontend/src/components/PlantingCalendar/ListView/index.tsx`, `frontend/src/components/IndoorSeedStarts.tsx`
- Acceptance criteria:
  - [x] Calendar surfaces show a `Tracked` / `Plan only` distinction on indoor-start rows where `seedStartDate` is set.
  - [x] DayDetailModal exposes a one-click `Start tracking` action on plan-only rows.
  - [x] Indoor Starts page surfaces a banner listing plan-only seedings from the active plan, with per-row `Start tracking` / `Dismiss`.
  - [x] All write paths use the existing `/api/indoor-seed-starts/from-planting-event` endpoint with `overdueMode='reschedule_today'`.
  - [x] No backend changes, no schema changes, no paired-file sync triggered.
  - [x] `Plan only` predicate uses `== null` (not falsy) on `indoorSeedStartStatus`.
- Notes: A1 of two product options. **A2 (auto-create `IndoorSeedStart` on Export to Calendar) was explicitly deferred** — see `calendar-indoor-start-consistency-decision.md` for reasoning; do not propose A2 again without revisiting that decision. 16 frontend tests added across DayDetailModal, EventMarker, GroupedEventsModal, ListView, and the IndoorSeedStarts banner. `code-review` returned LGTM; an R1 SearchBar/sort scope creep was flagged and reverted in the parent session before ship. Banner data source: existing `GET /api/planting-events/needs-indoor-starts` endpoint. Source bed name omitted from banner per locked default. Banner dismissal is client-only (no backend write).

## AUDIT-017

- Status: `Verified closed`
- Priority: `P1`
- Source: `dashboard-needs-attention-row-splitting-finding.md`
- Area: Dashboard / Needs Attention Today grouping
- Summary: One logical seeding task was being surfaced as multiple separate dashboard rows because `dashboard_service.py` emitted one signal per `PlantingEvent` with distinct `signalKey`s, so per-cell events inflated the dashboard workload.
- Expected: When one logical same-day same-plant same-bed task exists, the dashboard should present it as one grouped task or otherwise read as one coherent unit of work.
- Actual: A `32`-start beet task appeared as `4` separate `8`-plant rows instead of one understandable grouped reminder.
- Impact: Dashboard workload felt inflated and noisy, making quick triage harder and reducing trust in the `Needs Attention Today` summary.
- Repro steps:
  1. Create a multi-cell planting/seeding task that generates several same-day `PlantingEvent` rows for one bed/crop.
  2. Open the dashboard on the relevant date.
  3. Observe multiple separate reminder rows instead of one grouped task.
- Evidence: `dashboard-needs-attention-row-splitting-finding.md`, `dashboard-needs-attention-row-splitting-recommendation.md`, `dashboard-needs-attention-row-splitting-decision.md`, `dashboard-needs-attention-row-splitting-report-back.md`
- Suspected files / systems: `backend/services/dashboard_service.py`, `frontend/src/components/Dashboard/NeedsAttentionPanel.tsx`
- Acceptance criteria:
  - [x] Dashboard builders that emit per-cell planting reminders group by the same composite key philosophy already used on calendar surfaces.
  - [x] Grouped dashboard rows aggregate quantities sensibly and no longer feel inflated/noisy.
  - [x] Snooze/dismiss/undo work across grouped `plantingEventIds` without adding a new bulk endpoint.
  - [x] Existing deep-link target shape remains compatible via representative event id targeting.
- Notes: Option 1 shipped as the recommended fix. Backend grouped 8 builders; frontend added grouped-row rendering plus snooze/dismiss/undo fan-out over `plantingEventIds`. User re-test on 2026-04-26 reported the dashboard now looks good and no longer feels inflated for these grouped tasks.

## AUDIT-018

- Status: `Partial - monitoring`
- Priority: `P1`
- Source: `dashboard-missing-transplant-due-finding.md`
- Area: Dashboard / Indoor Starts actionable-task consistency
- Summary: Indoor Starts showed transplant-ready beet starts on the simulation date, but Dashboard `Needs Attention Today` did not surface the corresponding transplant-due task.
- Expected: If Indoor Starts shows a crop ready or overdue for transplant on the current simulation date, Dashboard should surface the same transplant work in `Needs Attention Today`.
- Actual: A stale proxy guard in `_build_transplants_due` suppressed transplant-due signals whenever `seed_start_date <= today`, even if the linked `IndoorSeedStart` had legitimately progressed past `planned`.
- Impact: Dashboard could not be fully trusted as the daily task hub because time-sensitive transplant work shown elsewhere in the app disappeared from the main action list.
- Repro steps:
  1. In simulation mode, move to a date where an indoor-started crop is ready/overdue for transplant.
  2. Confirm Indoor Starts shows the crop ready or overdue.
  3. Open Dashboard and observe the transplant-due task missing from `Needs Attention Today`.
- Evidence: `dashboard-missing-transplant-due-finding.md`, `dashboard-missing-transplant-due-recommendation.md`, `dashboard-missing-transplant-due-decision.md`, `dashboard-missing-transplant-due-report-back.md`
- Suspected files / systems: `backend/services/dashboard_service.py`, Dashboard `transplantsDue` signal generation, Indoor Starts state linkage
- Acceptance criteria:
  - [x] The guard checks linked `IndoorSeedStart.status` instead of using the old completion proxy.
  - [x] PE-only events with no linked `IndoorSeedStart` preserve current guard behavior.
  - [ ] User-side verification is strong enough to fully close the issue.
- Notes: Fix shipped in `bb5a082` with docs in `3653295`. User re-test on 2026-04-26 reported the dashboard "looks better" and the transplant reminder appears improved, but the issue remains under observation before full closure.

## AUDIT-019

- Status: `New`
- Priority: `P2`
- Source: `user re-test note (2026-04-26)`
- Area: Indoor Starts / placement-state affordance
- Summary: After an indoor start has already been placed into the garden, the action/button state still reads `Plan Placement`, which makes it unclear that a location has already been chosen.
- Expected: Once the user has decided where a plant goes in the garden, the Indoor Starts action/state should reflect that placement has already been chosen (for example `Placed`, `Placement chosen`, or equivalent completed/planned state wording).
- Actual: After placement, the UI still presents `Plan Placement`, which reads like the placement work has not yet been done.
- Impact: Users may re-enter the placement flow unnecessarily or lose confidence about whether the exact garden location has already been decided.
- Repro steps:
  1. Open an indoor start that is eligible for placement.
  2. Complete the placement flow and choose the garden cell/location.
  3. Return to the Indoor Starts card and observe the action still reads `Plan Placement`.
- Evidence: User re-test note captured during Wave 2A on 2026-04-26.
- Suspected files / systems: `IndoorSeedStarts.tsx`, Garden Designer / Indoor Starts placement-state mapping, button-label state logic
- Acceptance criteria:
  - [ ] After placement, the card/button state clearly indicates a location has already been chosen.
  - [ ] The UI distinguishes "not placed yet" from "placement chosen / already placed" without implying the wrong lifecycle status.
  - [ ] Users can tell at a glance whether they still need to choose a location.
- Notes: This is separate from the already-closed `AUDIT-014` banner-copy safety fix and the broader resolved `AUDIT-013` explicit cell-picker flow. It is a follow-on state-labeling issue after successful placement.

## AUDIT-020

- Status: `Verified closed`
- Priority: `P1`
- Source: `indoor-start-current-location-set-to-bed-finding.md`
- Area: Indoor Starts / auto-created current-location value
- Summary: Auto-created indoor starts were incorrectly using the destination garden bed name as the card's `Current location` instead of an indoor starting location.
- Expected: Auto-created indoor starts should default their current location to a sensible indoor value such as `windowsill`, while preserving destination-bed information separately as `Planned bed`.
- Actual: The auto-create path in `gardens_bp.py` assigned `IndoorSeedStart.location` from the linked garden bed name, causing cards to show values like `Current location: replica` even though the plant was still in the indoor-start phase.
- Impact: The Indoor Starts card became logically wrong and users could not trust the `Current location` field to describe where seedlings actually were.
- Repro steps:
  1. In Garden Designer, create a future transplant flow that auto-creates an indoor start.
  2. Open the resulting Indoor Starts card.
  3. Observe the card showing the outdoor bed name under `Current location`.
- Evidence: `indoor-start-current-location-set-to-bed-finding.md`, `indoor-start-current-location-set-to-bed-fix-report.md`
- Suspected files / systems: `backend/blueprints/gardens_bp.py`, auto-created `IndoorSeedStart.location`, Indoor Starts card rendering
- Acceptance criteria:
  - [x] The auto-create path no longer uses the garden bed name as `IndoorSeedStart.location`.
  - [x] New auto-created indoor starts default to `windowsill`, matching the other indoor-start creation paths.
  - [x] User-side verification confirms new cards no longer show bed names as the current indoor location.
- Notes: Fix applied at `backend/blueprints/gardens_bp.py:210` by setting `location='windowsill'` and persisting `destination_bed_ids` from `planting_event.garden_bed_id`, so new auto-created cards now show both a correct indoor location and the chosen planned bed. Developer explicitly left legacy bad rows untouched; any one-shot SQL cleanup for existing records is deferred and should be treated as separate data cleanup, not part of the shipped bug fix.

## AUDIT-021

- Status: `Verified closed`
- Priority: `P1`
- Source: `weather-property-zip-propagation-regression-finding.md`, user report 2026-04-28
- Area: Property Designer / Weather & Alerts / location-aware weather consumers
- Summary: A ZIP code entered and validated on a newly created property does not reliably propagate to Weather & Alerts and other weather-aware sections.
- Expected: After a user creates or edits a property with a validated ZIP-bearing address, weather-aware surfaces should use that property ZIP automatically when no explicit weather ZIP override is pinned.
- Actual: The user created a new property and expected the ZIP to pass through, but Weather & Alerts did not receive/use it. Code inspection also shows multiple weather consumers still read only `localStorage.weatherZipCode`.
- Impact: Users cannot trust whether weather, frost dates, soil temperature, and planting-readiness calculations are using their actual property location. The app asks for the same location in multiple places instead of treating property setup as the source of truth.
- Repro steps:
  1. Use an account with no property and no `weatherZipCode` pinned in localStorage.
  2. Open a weather-aware screen such as Weather & Alerts before creating a property.
  3. Create a property in Property Designer.
  4. Validate and save an address containing a ZIP code.
  5. Return to Weather & Alerts and observe whether the ZIP field / forecast automatically uses the new property ZIP.
  6. Check Dashboard weather tile, app header, Garden Designer weather banner, and Planting Calendar weather helpers for the same ZIP behavior.
- Evidence: `weather-property-zip-propagation-regression-finding.md`, `weather-zip-propagation-fix-plan-review.md`, `weather-zip-propagation-product-decision.md`, `weather-zip-propagation-fix-report.md`, `weather-zip-propagation-tests-report.md`, `weather-zip-propagation-code-review.md`, `weather-zip-propagation-ship-response.md`, `weather-zip-propagation-retest-failure.md`, `weather-zip-propagation-retest-fix-report.md`, `weather-zip-propagation-retest-code-review.md`, `weather-zip-propagation-second-pass-review.md`, `weather-zip-propagation-user-retest-confirmation.md`
- Suspected files / systems: `frontend/src/hooks/useProperty.ts`, `frontend/src/components/PropertyDesigner/PropertyFormModal.tsx`, `frontend/src/components/WeatherAlerts.tsx`, `frontend/src/components/Dashboard/WeatherSummaryTile.tsx`, `frontend/src/App.tsx`, `frontend/src/components/GardenDesigner.tsx`, `frontend/src/components/PlantingCalendar/index.tsx`, `frontend/src/components/common/PlantPalette.tsx`, `frontend/src/components/GardenDesigner/PlantConfigModal.tsx`
- Acceptance criteria:
  - [x] Creating a property after an initial no-property state invalidates stale property ZIP state without requiring a full reload.
  - [x] Weather & Alerts uses the saved property ZIP when no explicit weather ZIP override is pinned.
  - [x] Dashboard weather tile and app header use the same property-backed ZIP resolution.
  - [x] Garden Designer and Planting Calendar weather-aware helpers use the same resolver or receive the same resolved ZIP.
  - [x] When an existing weather ZIP differs from a newly saved property ZIP, property save wins for this fix and updates the app-wide weather ZIP.
  - [x] Regression tests cover property-created-after-null-cache and at least Weather & Alerts plus Dashboard weather tile propagation.
  - [x] ZIP-only validated property setup pins the ZIP even if the displayed formatted address does not include the ZIP.
  - [x] Freshly registered users do not inherit prior users' weather ZIP state.
  - [x] A first validation failure followed by a successful retry still pins the ZIP on property save.
  - [x] User retest confirms the fresh-user/new-property path updates Dashboard and Weather & Alerts without reload.
- Notes: The likely root cause was split frontend location resolution. `useProperty` memoized `/api/properties` at module scope and could cache `null` before the user created a property; property save did not invalidate that cache or dispatch a weather-location change. Several consumers also bypassed property fallback and read only `localStorage.weatherZipCode`. Product decision on 2026-04-28: proceed with developer option (a). Property create/edit with a ZIP-bearing validated address should seed/update the app-wide weather ZIP and dispatch `weatherZipCodeChanged`; explicit manual override UI is deferred. First implementation reports showed build/test/code-review approval, but user retest on 2026-04-28 found the fresh-user/new-property path still failed. Second-pass fix captured ZIP before validation rewrite and reset/restored weather ZIP state on register; tests and code review passed. User retest after the second-pass fix reported the flow now appears to work, so this is verified closed.

## Closed / Non-Developer Action Items

## AUDIT-ND-001

- Status: `Docs reconciled - no code change`
- Priority: `P3`
- Source: `phase-b-smoke-findings.md` finding 4
- Area: Garden Planner docs vs live flow
- Summary: Smoke testing confirmed the Configure Strategy step was missing from the live flow.
- Expected: Older docs described a separate Configure Strategy step.
- Actual: Live planner goes from seed selection to review/save with strategy simplified to defaults.
- Impact: This was a documented-product vs live-product deviation.
- Resolution: Docs were already reconciled on 2026-04-22 to match the simplified live flow. See `tasks.md` Product Deviation Tier.
- Notes: Keep as historical context only unless product decides to reintroduce the step.
