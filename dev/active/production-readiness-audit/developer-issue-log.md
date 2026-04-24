# Production Readiness Audit - Developer Issue Log

**Created**: 2026-04-23
**Last Updated**: 2026-04-23

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
