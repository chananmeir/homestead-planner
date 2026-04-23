# User-Facing Pass Report (2026-04-23)

Output of the pass scoped by `next-user-facing-pass-instructions.md`:
three user-visible workflow fixes, one commit per issue, no technical
cleanup bleed-through.

---

## Commits

Pushed to `origin/main` as `1f88de7..2192987`:

```
2192987 fix: Reword dashboard weather tile to stop implying setup is required   (#2)
26317b7 fix: Keep Create Property action above the fold in empty state          (#1)
29cb17e feat: Prompt for plan name on Duplicate (matches Create flow)           (#11)
```

---

## Completion status

| # | Title | Status | Approach |
|---|---|---|---|
| 11 | Plan duplicate naming workflow | **Completed** | Modal prompt (parameterized the existing Create-plan name modal) |
| 1 | Property Designer create-action visibility | **Completed** | Targeted layout fix — reduced empty-state padding, reordered CTA |
| 2 | Dashboard weather-tile copy/state inconsistency | **Completed** (copy-driven) | Rewrote tile copy to frame itself as "location pin", not "setup required" |

---

## Scope concerns / decisions made

### #11 — Plan duplicate naming

Chose **modal prompt** over hoisting Plan Name to wizard step 1. The
larger refactor (move Plan Name input earlier in the wizard) was
flagged in the earlier workflow investigation as the "shared long-term
fix" for both #3 and #11, but the modal-on-duplicate approach:

- Required zero new components (parameterized existing Create modal).
- Made the Duplicate flow identical in shape to the just-shipped
  Create flow (commit `ebba9ee`).
- Landed in ~30 net lines in one file.

If Plan Name hoisting onto wizard step 1 is desired later (for
in-wizard rename access), it's now a separate follow-up rather than
tangled with #11.

### #1 — Property Designer create-action visibility

Preserved the existing tall header card + stats grid above the canvas
pane. Empty-state padding was the clearly-fixable part. If the header
card should be trimmed later for more breathing room, that's a
different (and larger) change.

### #2 — Dashboard weather-tile consistency

Chose **copy-only** per the user's "no feature expansion" constraint.
The deeper fix — auto-populate the tile from `Property.latitude /
longitude` so the forecast shows inline without requiring a
click-through — is a legitimate next step but needs new state wiring
and a new fetch. Flagged as a candidate follow-up; not included.

---

## Items requiring a larger product decision

**None.** All three were straightforward once identified.

- #11: pure frontend, tight scope.
- #1: pure frontend layout, targeted 9-line fix.
- #2: pure frontend copy + test update, 11-line change.

---

## Per-item detail

### #11 — modal prompt parameterized from Create flow

- File: `frontend/src/components/GardenPlanner.tsx` (only)
- Split `handleDuplicatePlan` into a two-step pair:
  - `handleDuplicatePlan(plan)` — opens the rename modal with
    `newPlanName` pre-filled as `` `${plan.name} (Copy)` ``.
  - `handleConfirmDuplicatePlan()` — runs the existing clone logic
    using the edited name, then enters the wizard at step 1.
- Modal title/action/button label switch on `duplicateSourcePlan`:
  - Title: `"Duplicate Plan"` vs `"Create New Plan"`
  - Confirm callback: `handleConfirmDuplicatePlan` vs
    `handleCreatePlan`
  - Button: `"Duplicate"` vs `"Create"`
- Helper caption under the input: `Cloning "<sourceName>". You can
  rename now or keep the default.`
- Rename happens **during** the flow, **before** the clone is
  persisted. The POST uses the final edited name.
- **Stack touched**: frontend only. No backend change (`POST
  /api/garden-plans` accepts any name string).
- **Coverage gap**: no tests exist for `GardenPlanner.tsx`. Flagged;
  out of scope.

### #1 — above-the-fold CTA

- File: `frontend/src/components/PropertyDesigner.tsx` (only)
- Empty-state tweaks (5 insertions / 4 deletions):
  - `py-12` → `py-4` (saves 64 px vertical)
  - Emoji hero `text-6xl mb-4` → `text-4xl mb-2` (saves ~40 px)
  - Button moved **above** the secondary descriptive paragraph so
    the primary CTA follows the headline directly.
  - `mt-6` → `mt-4` on the button; `mt-3` on the demoted paragraph.
  - Added `data-testid="btn-create-property-empty"` for E2E anchoring
    (mirrors the existing `btn-create-property` testid used in the
    populated state).
- **Viewport reasoning**: button center now lands at ~680–720 px on a
  1366×768 viewport — comfortably above the fold. Previously it
  landed at ~820–870 px, below the fold.
- **Coverage gap**: no tests for `PropertyDesigner.tsx`.

### #2 — copy-only tile fix

- Files:
  - `frontend/src/components/Dashboard/WeatherSummaryTile.tsx`
    (4 lines)
  - `frontend/src/components/Dashboard/__tests__/WeatherSummaryTile.test.tsx`
    (6 lines — assertion strings updated to match new copy)
- Copy change:
  - _Before_ — "Set your zip code in Weather settings to see the
    forecast here." + button "Set up →"
  - _After_ — "Open Weather to view the forecast. Set a zip code there
    to pin this tile to your location." + button "Open →"
- **Why copy-only**: the Weather page has a hardcoded fallback ZIP
  (`'53209'`) and the backend accepts either zipcode or lat/lon, so
  the forecast renders immediately when the user clicks through. The
  tile's detection branch (`!zipCode`) is correct in one sense (no
  local pinned ZIP), but the **copy** wrongly implied this was a
  gating prerequisite.
- **State-driven vs copy-driven**: copy-driven. Detection logic was
  untouched; only the message and CTA label changed.
- **Does weather reuse property/location context visibly from the
  dashboard experience now?** No — intentionally not. That would be a
  feature addition (new state wiring + new fetch from
  `Property.latitude / longitude`), out of scope per the instructions.
- **Test coverage**: all 5 `WeatherSummaryTile` tests still pass; no
  new gaps introduced.

---

## Final state

- **Full backend suite**: not re-run (no backend changes this pass).
  Last known green at 1274 passing.
- **Frontend build**: passes cleanly.
- 3 commits pushed; working tree still carries the 24 pre-existing
  modifications from the prior workstream (unchanged scope — still to
  be handled separately).

---

## Deferred / standing queue (reminder)

- Strawberry perennial modeling (Group H xfail)
- Tomato variety split
- `?planId=` scoping filter on `needs-indoor-starts` + matching
  `GardenPlanItem.export_key` index
- Phase C / D / E technical cleanup
- Pre-existing working-tree mods (24 files)
- **Newly flagged**: Weather tile auto-population from
  `Property.latitude / longitude` (candidate follow-up surfaced by #2;
  not formally queued)
