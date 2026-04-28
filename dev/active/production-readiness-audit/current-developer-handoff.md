# Current Developer Handoff

**Created**: 2026-04-23
**Purpose**: This is the current "send now" snapshot for the developer, based on the audit files in this folder.

## What To Send The Developer Now

These are the items that are still actionable now and should be treated as the current engineering queue.

### 1. Confirm / push the already-approved bug-fix commits for #5, #9, and #10

The audit folder shows these fixes were implemented locally and approved for push in `next-developer-decisions.md`, but this folder does not yet contain a push confirmation or re-test note for them:

- `e748842` - stop plan-nutrition toast from firing on unrelated operations (`#5`)
- `2b59107` - link existing `IndoorSeedStart` on placement instead of duplicating (`#9`)
- `90c09a3` - keep saving-seed plants visible on the designer grid (`#10`)
- `40a0c10` - docs: Phase B smoke findings, triage, research, and investigation

Ask the developer to:

- confirm whether these commits were actually pushed
- provide the pushed commit hashes if they differ
- state whether any of these fixes still need work before push

These should stay open until re-tested.

### 2. Implement #12 trust fix for Indoor Starts import source clarity

This is currently one of the most important open issues because it affects user trust in what plan data is being imported.

Approved fix shape from `finding-12-implementation-decision.md`:

- backend enrichment with `planId` + `planName` per row
- frontend labeling in the import modal
- fix the cross-plan grouping-key bug in the same pass so rows from different plans are not merged incorrectly

Also note:

- do **not** implement future `?planId=` filtering in this pass
- do **record** that future follow-up as a known next-step
- if `b0ef4c5` is still local, it should be pushed together with the eventual `#12` fix/docs batch, not alone

Expected report back:

- exact fix shape used
- whether grouping key now includes plan identity
- how null / legacy `export_key` rows are surfaced
- resulting commit hash(es)

### 3. Implement #6 backdated Indoor Starts behavior

This is already researched and approved.

Approved behavior from `phase-b-6-indoor-starts-backdating-proposal.md` and `next-developer-decisions.md`:

- prompt on import when selected rows are overdue
- skip overdue imports as the backend default behavior when no explicit choice is supplied

Goal:

- avoid silently creating stale/backdated indoor starts
- make the user-facing behavior explicit

### 4. Implement #7 and #8 together

These were investigated and confirmed to share the same root cause.

Issue summary:

- imported starts do not consistently show destination beds
- `Transplant Now` appears for some imported starts but not others because it depends on the same missing destination-resolution path

Guidance from `phase-b-workflow-investigation.md` and `next-developer-decisions.md`:

- treat `#7` and `#8` as one fix pass
- prioritize them before `#3`

### 5. Implement #3 after #7 / #8

Issue summary:

- after creating a new plan, the app returns to the plan list and makes the user infer that `Work` is the next step

Investigation already identified the likely root cause in `GardenPlanner.tsx` and described a small frontend fix.

## What Should Not Be Sent Again As New Work

These items already have a stronger status and should not be re-sent as if untouched.

### Already fixed and pushed, waiting only for re-test

- `#1` Create Property action visibility
  - pushed in `26317b7`
- `#2` Dashboard weather tile wording/state confusion
  - pushed in `2192987`
- `#11` Duplicate-plan naming flow
  - pushed in `29cb17e`

These should be re-tested, not re-opened as fresh developer work unless the fix fails verification.

### Already resolved without code change

- `#4` Configure Strategy step mismatch
  - docs were reconciled to match the simplified live flow
  - this is not an active engineering item unless product decides to reintroduce the step

## Lower-Priority / Deferred For Now

- Do not add `#1` and `#2` back into the current pass; they already have pushed fixes and only need verification.
- Future `?planId=` filtering on `/api/planting-events/needs-indoor-starts` is a known follow-up, not part of the current `#12` fix pass.
- Plan duplicate naming `#11` is already handled by the pushed modal-prompt fix.

## Recommended Message To Developer

Use this summary:

1. Please confirm/push the approved local fixes for `#5`, `#9`, `#10` and the supporting docs commit, and report the final pushed hashes.
2. Please implement `#12` with backend plan metadata enrichment, frontend source-plan labeling, and grouping-key correction in the same pass.
3. Please implement `#6` using the approved prompt + skip-default behavior for overdue indoor-start imports.
4. Please implement `#7` and `#8` together, since they share the same destination-resolution root cause.
5. After that, please complete `#3` so creating a plan takes the user clearly into the next working step.

## Source Files For This Handoff

- `developer-issue-log.md`
- `phase-b-smoke-findings.md`
- `phase-b-triage.md`
- `phase-b-triage-response.md`
- `phase-b-workflow-investigation.md`
- `phase-b-6-indoor-starts-backdating-proposal.md`
- `finding-12-response.md`
- `finding-12-implementation-decision.md`
- `next-developer-decisions.md`
- `user-facing-pass-report.md`
