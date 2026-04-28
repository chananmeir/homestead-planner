# Next User-Facing Pass Instructions

This next pass should stay aligned with the original product-management goal:

- make sure the app behaves the way a real user expects
- improve user-visible workflow clarity
- avoid drifting into deeper technical cleanup unless it directly supports the user-facing fixes below

Do **not** start:
- strawberry perennial modeling
- tomato variety split
- Phase C / D / E technical cleanup
- broad refactors unrelated to the specific user-facing issues below

## Scope for the next pass

Focus on these three user-facing items only, in this order:

1. **#11 Plan duplicate naming workflow**
2. **#1 Property Designer create-action visibility**
3. **#2 Dashboard weather-tile copy/state inconsistency**

## Priority and intent

### 1. #11 Plan duplicate naming workflow

This is the highest-priority remaining user-facing workflow issue in the current queue.

Goal:
- when duplicating a plan, the user should either be prompted to name the duplicate immediately, or see an obvious rename path as part of the duplication flow

Direction:
- prefer a solution that is coherent with the improved create-plan flow already shipped
- if the best long-term fix is to move Plan Name earlier in the workflow, that is acceptable if the scope stays tight and reviewable
- do not bundle this with unrelated Indoor Starts or Simulation work

Please report back with:
- the chosen UX approach
- whether the duplicate can be renamed during the flow or immediately after
- whether this touches only frontend or both stacks

### 2. #1 Property Designer create-action visibility

This is a real usability issue confirmed during smoke testing.

Goal:
- when no properties exist, the user must be able to clearly reach the create-property action at standard browser zoom without layout tricks

Direction:
- fix the empty-state layout so the create action is visible and reachable in a normal desktop viewport
- do not rely on browser zoom changes or hidden-below-the-fold affordances
- preserve the existing Property Designer structure if possible; this should be a targeted layout fix, not a redesign

Please report back with:
- the viewport/layout condition that caused the issue
- the exact fix made
- whether the create action is now visible at standard zoom in the tested desktop viewport

### 3. #2 Dashboard weather-tile copy/state inconsistency

This is lower priority than #11 and #1, but still worth fixing in the same user-facing pass if scope remains controlled.

Goal:
- if weather is already effectively available from the validated property/location context, the dashboard tile should not misleadingly imply that setup is still required

Direction:
- align the dashboard weather tile with the actual weather page state
- either:
  - auto-reflect the resolved property/location-backed weather state, or
  - update the copy/CTA so it accurately explains what still needs setup
- keep this as a state/copy consistency fix, not a weather-feature expansion

Please report back with:
- whether the fix was state-driven, copy-driven, or both
- whether weather now reuses the property/location context visibly from the dashboard experience

## Execution guidance

- Keep this pass tightly scoped to these three items.
- Prefer one issue per commit where practical.
- If #11 grows into a larger workflow redesign, stop and report before expanding scope.
- If #1 and #2 are fast, they can follow after #11 in the same pass.
- Update the audit tracking/docs only as needed to reflect what was actually changed.

## What to send back

When done, report back with:
- which of #11, #1, and #2 were completed
- the commit hash(es)
- any scope concerns or decisions made
- whether any item turned out to need a larger product decision instead of a straightforward fix
