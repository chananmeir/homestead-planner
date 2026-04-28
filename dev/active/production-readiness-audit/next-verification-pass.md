# Next Verification Pass

**Created**: 2026-04-23  
**Purpose**: Re-verify shipped fixes and close issues in `developer-issue-log.md` before opening a new development lane.

## Why this is the right next step

The current state across:

- `tasks.md`
- `user-facing-pass-report.md`
- `developer-issue-log.md`

shows that the audit has moved from broad discovery into **verification of shipped fixes**.

There are multiple items already reported as fixed or pushed, but not yet closed in the issue log.  
So the next pass should be:

- narrow
- reproducible
- focused on exact before/after checks
- used to close issues, not discover an entirely new bug queue

Do **not** start a new broad feature audit before this pass is complete.

---

## Primary goal

Verify the fixes already reported as shipped for these issues:

- `AUDIT-001` Property Designer create-action visibility
- `AUDIT-002` Dashboard weather-tile copy/state consistency
- `AUDIT-003` Create Plan lands directly in wizard
- `AUDIT-004` Export success no longer shows unrelated nutrition error toast
- `AUDIT-005` Overdue indoor-start import behavior
- `AUDIT-006` / `AUDIT-007` Destination assignment + action consistency in Indoor Starts
- `AUDIT-008` Designer placement should no longer duplicate indoor-start records
- `AUDIT-009` Save-for-seed state should persist
- `AUDIT-010` Duplicate Plan naming flow
- `AUDIT-011` Indoor-start import source-plan identification

---

## Test setup guidance

Use a disposable or low-risk account with enough existing data to exercise:

- at least one property
- at least two plans
- at least one bed
- at least one MIGardener bed if already available
- at least one indoor-start-capable crop (tomato, lettuce, etc.)

Use the QA Time Machine only when required by the exact re-test.

Keep this pass short and deterministic.  
If an unrelated issue appears, note it separately but do not derail the pass.

---

## Re-test block A - Property + Dashboard

### A1. Re-test `AUDIT-001` Property Designer create-action visibility

**Goal**: confirm the create-property CTA is visible at standard desktop zoom.

**Steps**
1. Use an account with no properties, or otherwise reach the Property Designer empty state.
2. Open **Design -> Property Designer** at standard browser zoom.
3. Check whether the primary create action is visible without reducing zoom.

**Pass condition**
- Create Property CTA is visible and reachable at standard zoom on a normal desktop viewport.

**Reply format**
```md
A1 - Property Designer empty state
- CTA visible at standard zoom: yes/no
- Zoom reduction required: yes/no
- Viewport/notes:
```

### A2. Re-test `AUDIT-002` Dashboard weather-tile consistency

**Goal**: confirm the weather tile no longer misleadingly implies setup is required when the weather page already works.

**Steps**
1. Ensure property/location data already exists.
2. Open **Dashboard** and read the weather tile copy.
3. Click through to **Grow -> Weather & Alerts**.
4. Compare dashboard wording to the actual weather page state.

**Pass condition**
- Dashboard wording accurately reflects the real weather state and no longer falsely implies setup is blocked.

**Reply format**
```md
A2 - Dashboard weather tile
- Dashboard copy now accurate: yes/no
- Click-through weather still works: yes/no
- Notes:
```

---

## Re-test block B - Planner flow

### B1. Re-test `AUDIT-003` Create Plan workflow

**Goal**: confirm new plan creation lands directly in the wizard.

**Steps**
1. Open **Plan**.
2. Click **Create Plan**.
3. Create a new temporary plan.

**Pass condition**
- User lands directly in the seed-selection wizard for the new plan without needing to infer that `Work` is next.

**Reply format**
```md
B1 - Create Plan flow
- Landed directly in wizard: yes/no
- Seed selection opened immediately: yes/no
- Plan name wired correctly: yes/no
- Notes:
```

### B2. Re-test `AUDIT-010` Duplicate Plan naming flow

**Goal**: confirm duplicate-plan flow now offers immediate naming.

**Steps**
1. Open an existing plan detail view.
2. Click **Duplicate**.
3. Observe whether the app prompts for a plan name before persisting the copy.

**Pass condition**
- Duplicate flow gives an immediate naming path and the resulting copy has the user-chosen name.

**Reply format**
```md
B2 - Duplicate Plan flow
- Naming prompt shown: yes/no
- Could rename before duplicate persisted: yes/no
- Resulting name correct: yes/no
- Notes:
```

### B3. Re-test `AUDIT-004` Export success without nutrition error toast

**Goal**: confirm export success no longer shows unrelated red nutrition toast.

**Steps**
1. Open a valid plan.
2. Export it to calendar.
3. Watch for any red error toast or contradictory error message.

**Pass condition**
- Export succeeds without unrelated red error toast.

**Reply format**
```md
B3 - Export to Calendar
- Export succeeded: yes/no
- Red nutrition/error toast appeared: yes/no
- Notes:
```

---

## Re-test block C - Indoor Starts / Designer workflow

### C1. Re-test `AUDIT-005` Overdue indoor-start import behavior

**Goal**: confirm overdue rows are no longer silently imported as stale/backdated starts.

**Steps**
1. Use or create a plan with indoor-start events that should be overdue relative to the current date.
2. Go to **Grow -> Indoor Starts -> From Garden Plan**.
3. Attempt the import.
4. Observe whether the app:
   - prompts,
   - skips overdue rows by default,
   - or offers explicit choices.

**Pass condition**
- No silent import of stale overdue rows.
- User gets explicit behavior for overdue items.

**Reply format**
```md
C1 - Overdue indoor-start import
- Overdue prompt shown: yes/no
- Rows skipped by default: yes/no
- Silent stale import still happens: yes/no
- Options shown:
- Notes:
```

### C2. Re-test `AUDIT-006` + `AUDIT-007` Destination assignment and action consistency

**Goal**: confirm imported starts now carry destination information clearly and actions match that state.

**Steps**
1. In **Indoor Starts -> From Garden Plan**, import a mix of rows with and without destination beds if possible.
2. After import, inspect the cards/list.
3. Compare records that previously differed (for example, lettuce vs tomato).

**Pass condition**
- Destination state is clearly surfaced.
- Missing destination shows an explicit empty-state message.
- Action availability is consistent with destination state.

**Reply format**
```md
C2 - Destination + actions
- Destination clearly shown for assigned rows: yes/no
- Missing destination clearly labeled: yes/no
- Disabled Transplant Now makes sense when no destination: yes/no
- Action consistency improved: yes/no
- Notes:
```

### C3. Re-test `AUDIT-011` Source-plan identification in import modal

**Goal**: confirm the import modal now makes source-plan context trustworthy.

**Steps**
1. Have at least two distinguishable plans.
2. Open **Indoor Starts -> From Garden Plan**.
3. Observe:
   - modal header
   - per-row plan labels/badges
   - any `Unknown plan` rows if present

**Pass condition**
- User can clearly tell what plan context is being shown.
- Cross-plan rows are visibly labeled instead of silently merged/confused.

**Reply format**
```md
C3 - Import modal plan attribution
- Active/source plan shown in header: yes/no
- Per-row plan badges shown: yes/no
- Cross-plan distinction clear: yes/no
- Unknown plan rows labeled clearly: yes/no / not present
- Notes:
```

### C4. Re-test `AUDIT-008` Designer placement should not duplicate indoor-start records

**Goal**: confirm placing a crop now links/advances the existing indoor-start record instead of creating a duplicate.

**Steps**
1. Import an indoor start from a plan.
2. Navigate to the assigned bed.
3. Place/transplant the crop in Designer.
4. Return to Indoor Starts and inspect the records.

**Pass condition**
- No duplicate indoor-start card is created for the same imported start.

**Reply format**
```md
C4 - Designer to Indoor Starts linkage
- Existing start reused/advanced: yes/no
- Duplicate start card created: yes/no
- Notes:
```

### C5. Re-test `AUDIT-009` Save-for-seed persistence

**Goal**: confirm save-for-seed state remains after leaving and reopening the plant.

**Steps**
1. Open a planted item in Designer.
2. Enable **Save for Seed**.
3. Leave the panel/view.
4. Reopen the same plant.

**Pass condition**
- Save-for-seed state still visible and active after reopening.

**Reply format**
```md
C5 - Save for Seed persistence
- Save-for-seed remained active after reopen: yes/no
- Plant remained visible on grid: yes/no
- Seed-ready state/date still shown: yes/no
- Notes:
```

---

## Close-out rule

After this pass:

- any item that clearly passes should be marked for closure in `developer-issue-log.md`
- any item that still fails should be reported back with exact before/after behavior
- do not open a broad new development lane until these re-tests are resolved or consciously deferred

## Recommended outcome report format

```md
Verification results

- AUDIT-001: pass/fail
- AUDIT-002: pass/fail
- AUDIT-003: pass/fail
- AUDIT-004: pass/fail
- AUDIT-005: pass/fail
- AUDIT-006: pass/fail
- AUDIT-007: pass/fail
- AUDIT-008: pass/fail
- AUDIT-009: pass/fail
- AUDIT-010: pass/fail
- AUDIT-011: pass/fail

Items ready to close:
- ...

Items still failing:
- ...

New findings discovered during re-test:
- ...
```
