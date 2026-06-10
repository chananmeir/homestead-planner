# Production Readiness Audit - Developer Issue Log

**Created**: 2026-04-23
**Last Updated**: 2026-04-30 (added AUDIT-023 local API port conflict fix)

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

- Status: `Sent to developer`
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
  - [ ] Post-create destination makes the next step obvious.
  - [ ] User does not need insider knowledge to continue working on the new plan.
- Notes: `phase-b-workflow-investigation.md` confirms root cause and proposes a small frontend fix in `GardenPlanner.tsx`. `next-developer-decisions.md` greenlights this after #7/#8.

## AUDIT-004

- Status: `Sent to developer`
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
  - [ ] Successful export does not show unrelated error toasts.
  - [ ] If a secondary fetch fails, it is either silently retried or messaged in a way that does not contradict export success.
- Notes: `next-developer-decisions.md` references local fix commit `e748842` for this issue, but this folder does not yet contain a push/report confirmation or re-test note. Keep open until verified.

## AUDIT-005

- Status: `Sent to developer`
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
  - [ ] Import behavior is explicit about whether dates are historical, current, or rescheduled.
  - [ ] Users are not silently dropped into overdue states without guidance.
- Notes: `phase-b-6-indoor-starts-backdating-proposal.md` completed the research pass. `next-developer-decisions.md` greenlights Option 2 + Option 4 (prompt on import + skip overdue as backend default). Keep open until implementation and re-test.

## AUDIT-006

- Status: `Sent to developer`
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
  - [ ] Action availability is consistent for similar records.
  - [ ] Any intentional differences are explained to the user.
- Notes: `phase-b-workflow-investigation.md` confirms this is not a separate root cause; it is a symptom of the same destination-resolution problem as `AUDIT-007`.

## AUDIT-007

- Status: `Sent to developer`
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
  - [ ] Destination assignment is clearly surfaced for imported starts.
  - [ ] Missing destination state is visible and understandable when applicable.
- Notes: `phase-b-workflow-investigation.md` confirms this shares a root cause with `AUDIT-006`. `next-developer-decisions.md` greenlights `#7 + #8 together` as the next fix pass.

## AUDIT-008

- Status: `Sent to developer`
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
  - [ ] Existing indoor-start records are reused or advanced instead of duplicated.
  - [ ] Cross-module status remains consistent after placement.
  - [ ] No duplicate start cards are created for the same planned/imported start without explicit user intent.
- Notes: `next-developer-decisions.md` references local fix commit `2b59107` for this issue, but this folder does not yet contain a push/report confirmation or re-test note. Keep open until verified.

## AUDIT-009

- Status: `Sent to developer`
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
  - [ ] Save-for-seed state persists across navigation and reload.
  - [ ] Subsequent seed-saving workflow steps use the saved state correctly.
- Notes: `next-developer-decisions.md` references local fix commit `90c09a3` for this issue, but this folder does not yet contain a push/report confirmation or re-test note. Keep open until verified.

## AUDIT-010

- Status: `Fixed pending verification`
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
  - [ ] Duplicate flow gives an obvious, immediate naming path.
  - [ ] Users can distinguish original and copy without cleanup hunting.
- Notes: This was initially deferred, but `user-facing-pass-report.md` records it as completed and pushed in commit `29cb17e` on 2026-04-23. Re-test still needed before closing.

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

- Status: `New`
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
  - [ ] The flow clearly identifies the specific indoor-start record being placed.
  - [ ] The user can tell they are placing that existing record, not creating a separate new planting flow.
  - [ ] Resulting placement clearly advances or links the selected indoor-start record.
- Notes: This is broader than the smaller copy-only seam in `indoor-start-plan-placement-banner-followup.md`. Leave the card-label fix in place; track this as the remaining workflow follow-up.

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
- Source: User report on 2026-04-29
- Area: Garden Designer / Garden Beds / Planning data cleanup
- Summary: Users needed a safe way to permanently delete accidental extra beds and all planning data attached to those beds.
- Expected: Deleting a bed should require deliberate confirmation and remove bed-owned records, planning events, plan allocations, linked indoor-start records, property placement, trellises, photos, and harvest references tied to the deleted bed.
- Actual: Existing `DELETE /api/garden-beds/<id>` deleted only the bed row through a narrow ORM path and had no typed confirmation guard.
- Impact: Users who over-created beds, such as making a 9-bed plan when they only have 5 beds, had no trustworthy cleanup path and risked stale events/allocations lingering across planner, designer, calendar, and indoor starts.
- Repro steps:
  1. Create more garden beds than the real property has.
  2. Export or create plan allocations/events tied to the extra bed.
  3. Try to remove the bed and observe missing confirmation/cascade cleanup behavior.
- Evidence: User report plus focused regression coverage in `backend/tests/test_garden_bed_delete_cascade.py` and `frontend/src/components/common/__tests__/ConfirmDialog.test.tsx`.
- Suspected files / systems: `backend/blueprints/gardens_bp.py`, `frontend/src/components/GardenDesigner.tsx`, `frontend/src/components/common/ConfirmDialog.tsx`
- Acceptance criteria:
  - [x] Bed deletion requires typing `delete` before the destructive action is enabled.
  - [x] Backend rejects permanent bed deletes without `confirmation: "delete"`.
  - [x] Backend removes or detaches bed-linked `PlantedItem`, `PlantingEvent`, `IndoorSeedStart`, `HarvestRecord`, `Photo`, `PlacedStructure`, `TrellisStructure`, `GardenPlanItem`, and `SeedInventory.source_planted_item_id` references as appropriate.
  - [x] Cross-user bed delete protection still returns 403 before confirmation state matters.
  - [x] Garden Designer refreshes bed, planting-event, future-event, and active-plan state after deletion.
- Notes: Implemented on 2026-04-29. No schema change or migration required. Verification: `python -m pytest tests/test_garden_bed_delete_cascade.py -q`; `python -m pytest tests/test_auth_isolation.py::TestOwnershipProtection::test_cannot_delete_other_users_bed -q`; `CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/components/common/__tests__/ConfirmDialog.test.tsx`; `npm run build` (compiled with existing hook warnings and known stale `baseline-browser-mapping` notice).

## AUDIT-018

- Status: `Verified closed`
- Priority: `P1`
- Source: User report on 2026-04-29
- Area: Dashboard / Needs Attention / Indoor Seed Starts deep-linking
- Summary: Clicking a grouped `Indoor start due` dashboard row opened the Indoor Seed Starting tab but did not expand or highlight the exact planned seed row.
- Expected: Dashboard indoor-start rows should carry enough focus data for Indoor Seed Starts to scroll to and highlight the matching tracked card or plan-only banner row, including grouped rows such as multiple Spaghetti Squash planned events.
- Actual: The click target only sent one representative ID. Grouped rows already had `plantingEventIds` / `indoorSeedStartIds` for snooze and dismiss, but those arrays were dropped from navigation.
- Impact: Users landed on the correct page but still had to manually hunt through many planned seedings, making the dashboard action feel broken.
- Repro steps:
  1. Load a plan with grouped indoor-start reminders, such as `Squash (Spaghetti Squash) (3)`.
  2. Click the dashboard `Indoor start due` row.
  3. Observe Indoor Seed Starting opens without expanding/highlighting the matching planned row.
- Evidence: User screenshot plus focused regression coverage in `frontend/src/components/Dashboard/__tests__/NeedsAttentionPanel.test.tsx` and `frontend/src/components/__tests__/IndoorSeedStarts.focus.test.tsx`.
- Suspected files / systems: `frontend/src/components/Dashboard/NeedsAttentionPanel.tsx`, `frontend/src/components/Dashboard/types.ts`, `frontend/src/App.tsx`, `frontend/src/components/IndoorSeedStarts.tsx`
- Acceptance criteria:
  - [x] Dashboard indoor-start and indoor-germination targets include grouped `plantingEventIds` / `indoorSeedStartIds` when present.
  - [x] App preserves grouped indoor focus IDs when navigating to Indoor Starts.
  - [x] Indoor Starts matches focus against all grouped planting-event IDs and indoor-seed-start IDs.
  - [x] Plan-only banner expands, applies the needed bed filter, scrolls, and highlights the representative row when any grouped event ID matches.
  - [x] Linked IndoorSeedStart cards still scroll when focus resolves before the loading spinner has been replaced by the card grid.
- Notes: Implemented on 2026-04-29. No backend or schema changes required. Verification: `CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/components/__tests__/IndoorSeedStarts.focus.test.tsx src/components/Dashboard/__tests__/NeedsAttentionPanel.test.tsx`; `CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/components/Dashboard/hooks/__tests__/useFocusHighlight.test.tsx src/components/__tests__/IndoorSeedStarts.focus.test.tsx src/components/__tests__/Livestock.focus.test.tsx`; `npm run build` (compiled with existing unrelated hook warnings and stale `baseline-browser-mapping` notice).

## AUDIT-019

- Status: `Verified closed`
- Priority: `P1`
- Source: User report on 2026-04-29
- Area: Indoor Seed Starts / Garden Designer placement
- Summary: `Plan Placement` for an indoor seed start that was still `planned` showed a warning that placement would mark it transplanted, and the backend did in fact advance explicitly linked seed starts to `transplanted`.
- Expected: `Plan Placement` should only choose the future garden cell and leave the IndoorSeedStart status/linkage unchanged. Only `Transplant Now` for hardening starts should mark the seed start transplanted.
- Actual: The Garden Designer sent `sourceIndoorSeedStartId` for both planning and real transplant flows, and the backend treated any explicit seed-start source as an actual transplant.
- Impact: Users could accidentally convert not-yet-started seedlings into transplanted records while merely laying out where they should go later.
- Repro steps:
  1. Open a planned Indoor Seed Start.
  2. Click `Plan Placement`.
  3. In Garden Designer, click `Pick cell`.
  4. Observe `Place before ready?` warning saying it will mark the seed start transplanted.
- Evidence: User screenshot plus regression coverage in `backend/tests/test_placement_explicit_seed_start_link.py`.
- Suspected files / systems: `frontend/src/components/GardenDesigner.tsx`, `backend/blueprints/gardens_bp.py`
- Acceptance criteria:
  - [x] Planned/growing indoor starts no longer show the `Place before ready?` modal when choosing a placement cell.
  - [x] Garden Designer sends `sourceIndoorSeedStartAction: "plan"` for non-hardening `Plan Placement`.
  - [x] Backend creates the planned garden placement without changing IndoorSeedStart `status`, `planting_event_id`, or `actual_transplant_date`.
  - [x] Existing actual-transplant behavior remains intact for hardening/manual transplant placement.
- Notes: Implemented on 2026-04-29. No schema change. Verification: `python -m pytest tests/test_placement_explicit_seed_start_link.py -q`; `python -m pytest tests/test_placement_indoor_start_dedup.py -q`; `npm run build` (compiled with existing unrelated hook warnings and stale `baseline-browser-mapping` notice).

## AUDIT-020

- Status: `Verified closed`
- Priority: `P2`
- Source: User request on 2026-04-29
- Area: Indoor Seed Starts / Planned filtering
- Summary: Indoor Seed Starts needed a date range filter so planned seed work could be narrowed by start date without manually scanning the full list.
- Expected: Users can set a start-date range while viewing planned indoor starts, and both regular tracked cards and plan-only garden-plan rows respect that range.
- Actual: The page had status and bed filters, but no date filter for planned indoor-start work.
- Impact: Large plans made it difficult to focus on only the seed-start work due in a specific window.
- Evidence: Focused regression coverage in `frontend/src/components/__tests__/IndoorSeedStarts.banner.test.tsx`.
- Suspected files / systems: `frontend/src/components/IndoorSeedStarts.tsx`
- Acceptance criteria:
  - [x] Indoor Seed Starts exposes `Start from` and `To` date controls with a clear action.
  - [x] Tracked seed-start cards are filtered by `startDate`.
  - [x] Plan-only garden-plan banner rows are filtered by `suggestedIndoorStartDate`.
  - [x] Empty states explain when a date range has hidden all matching rows.
- Notes: Implemented on 2026-04-29. No backend or schema change. Verification: `npm test -- --watchAll=false --runInBand --runTestsByPath src/components/__tests__/IndoorSeedStarts.banner.test.tsx src/components/__tests__/IndoorSeedStarts.focus.test.tsx`; `npm run build` (compiled with existing unrelated hook warnings and stale `baseline-browser-mapping` notice after sandbox `spawn EPERM` retry outside the sandbox).

## AUDIT-021

- Status: `Verified closed`
- Priority: `P2`
- Source: User request on 2026-04-29
- Area: App navigation / cross-module deep links
- Summary: Action clicks that moved from Dashboard, Calendar, or Indoor Seed Starts into another module replaced the current view, making it hard to refer back to the original page.
- Expected: Cross-module action clicks should open a deep-linked browser tab so the source page remains available.
- Actual: The app stored destination/focus state only in React state and navigated in-place, so the source context was lost.
- Impact: Users had to manually navigate back after inspecting or completing a task, especially from Needs Attention and seed-start placement flows.
- Evidence: Focused regression coverage in `frontend/src/App.test.tsx`.
- Suspected files / systems: `frontend/src/App.tsx`
- Acceptance criteria:
  - [x] Dashboard quick actions and Needs Attention rows open a new browser tab via `_blank`.
  - [x] Header date opens Planting Calendar grid in a new browser tab.
  - [x] Calendar-to-Designer and Indoor-Starts-to-Designer actions open Designer in a new browser tab.
  - [x] Destination tabs restore the intended app view and focus context from URL query parameters.
  - [x] Top-level app navigation still changes the current tab in place.
- Notes: Implemented on 2026-04-29. No backend or schema change. Verification: `npm test -- --watchAll=false --runInBand --runTestsByPath src/App.test.tsx`; `npm run build` (compiled with existing unrelated hook warnings and stale `baseline-browser-mapping` notice after sandbox `spawn EPERM` retry outside the sandbox).

## AUDIT-022

- Status: `Verified closed`
- Priority: `P2`
- Source: User report on 2026-04-30
- Area: Garden Designer / Plant configuration / Indoor-start scheduling
- Summary: Transplant configuration warned that a late indoor start would produce fewer days indoors instead of automatically shifting the transplant date later.
- Expected: If an indoor-start crop is started later than the recommended seed-start date, the program should preserve the recommended indoor growing duration by moving the transplant date later when possible.
- Actual: The modal kept the transplant date fixed and displayed a confusing warning that the crop would get fewer indoor days.
- Impact: Users were asked to accept a worse schedule even though the practical fix is to leave seedlings indoors longer and transplant later.
- Evidence: User screenshot for Pumpkin on 2026-04-30 and regression coverage in `frontend/src/components/GardenDesigner/__tests__/PlantConfigModal.test.tsx`.
- Suspected files / systems: `frontend/src/components/GardenDesigner/PlantConfigModal.tsx`
- Acceptance criteria:
  - [x] Transplant date auto-shifts later when the recommended indoor seed-start date is already in the past.
  - [x] Auto-shift preserves the plant's configured `weeksIndoors`.
  - [x] The old warning no longer frames the normal path as losing indoor growing time.
  - [x] Dates that already preserve indoor growing time are not changed.
- Notes: Implemented on 2026-04-30. No backend or schema change. Verification: `npm test -- --watchAll=false --runInBand --runTestsByPath src/components/GardenDesigner/__tests__/PlantConfigModal.test.tsx`; `npm run build` (compiled with existing unrelated hook warnings and stale `baseline-browser-mapping` notice).

## AUDIT-023

- Status: `Verified closed`
- Priority: `P2`
- Source: User report on 2026-04-30
- Area: Local development / API connectivity
- Summary: The app often showed `Failed to fetch` during local use.
- Expected: The frontend should talk to a single, stable Homestead backend process.
- Actual: Local port inspection showed multiple Python processes plus another local service (`MedXM.Api`) listening on backend port `5000`, causing dropped or misrouted HTTP responses.
- Impact: Frontend API calls intermittently failed even when the React dev server was compiled successfully.
- Evidence: `netstat -ano | findstr :5000` showed multiple listeners; `Invoke-WebRequest http://localhost:5000/api/plants` returned a connection-closed error.
- Suspected files / systems: `backend/app.py`, `start-backend.bat`, `start-app.bat`, `frontend/.env.local`
- Acceptance criteria:
  - [x] Backend startup script uses a Homestead-specific local API port that is free on this machine.
  - [x] Backend app can read `HOMESTEAD_BACKEND_PORT` while preserving default direct `python app.py` behavior.
  - [x] Frontend local environment points to the matching backend URL.
  - [x] Temporary backend verification on the new port returns `/api/plants` successfully.
- Notes: Implemented on 2026-04-30. Chosen local API port: `5051`. Verification: temporary backend on `127.0.0.1:5051` returned `200` for `/api/plants`; `npm run build` compiled with existing unrelated hook warnings and stale `baseline-browser-mapping` notice.

## AUDIT-024

- Status: `Verified closed`
- Priority: `P2`
- Source: User report on 2026-04-30
- Area: Indoor Seed Starts / Garden Designer planned placements
- Summary: Updating an Indoor Seed Start's seed type/variety did not update the planned garden-bed placement that had already been created from that start.
- Expected: Changing the indoor start variety/seed lot should keep linked planning records, bed placements, and matching calendar planting events aligned.
- Actual: The PUT `/api/indoor-seed-starts/<id>` handler updated only the indoor start. Older Plan Placement flows could also create an unlinked Designer plan item, leaving the bed card on the old variety.
- Impact: A user could see Charleston Grey in Indoor Seed Starts while the garden bed still showed Dixie Queen for the same planned transplant.
- Evidence: User screenshot/report for Watermelon on 2026-04-30 and regression coverage in `backend/tests/test_indoor_seed_start_variety_sync.py`.
- Suspected files / systems: `backend/blueprints/utilities_bp.py`, `backend/blueprints/garden_planner_bp.py`, `frontend/src/components/GardenDesigner.tsx`, `frontend/src/components/IndoorSeedStarts/EditSeedStartModal.tsx`
- Acceptance criteria:
  - [x] Indoor seed-start updates propagate variety/seed inventory to directly linked planting events and plan items.
  - [x] Legacy unlinked planned placements are repaired only when user, crop, old variety, destination bed, transplant date, planned status, and source plan item all match.
  - [x] Matching bed PlantedItems and their same-cell calendar PlantingEvents update together.
  - [x] Future Designer Plan Placement records store the source indoor seed-start id on the plan item.
  - [x] Clearing a seed lot from the edit modal sends `seedInventoryId: null` so stale seed-lot links do not remain.
- Notes: Implemented on 2026-04-30. No schema change. Verification: `python -m pytest tests/test_indoor_seed_start_variety_sync.py tests/test_placement_explicit_seed_start_link.py tests/test_indoor_seed_start_delete_cascade.py -q`; `npm run build` (compiled with existing unrelated hook warnings and stale `baseline-browser-mapping` notice).

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
