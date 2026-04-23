# Indoor Start Transplant-Now Fix Report (2026-04-23)

Ships the approved Option C (relabel-only) per user response to
`indoor-start-transplant-now-summary.md`. Pure label semantics —
navigation behavior unchanged.

---

## Commit

```
d63f487 fix: Show Plan Placement label until indoor start is hardening
```

Not yet pushed.

---

## Files changed

- `frontend/src/components/IndoorSeedStarts.tsx` — single file. 7
  insertions / 6 deletions. ~4 net LOC. Wrapped the existing
  button-render conditional in an IIFE to compute
  `transplantActionLabel`, then used that variable in both the enabled
  and disabled button variants.

No backend files touched. No new tests authored. No schema change. No
migration.

---

## Exact status-to-label mapping implemented

```tsx
const transplantActionLabel = start.status === 'hardening'
  ? 'Transplant Now'
  : 'Plan Placement';
```

| Status | Enabled label | Disabled (no bed) label |
|---|---|---|
| `planned` | Plan Placement | Plan Placement |
| `seeded` | Plan Placement | Plan Placement |
| `germinating` | Plan Placement | Plan Placement |
| `growing` | Plan Placement | Plan Placement |
| `hardening` | Transplant Now | Transplant Now |
| `transplanted` | (button hidden) | (button hidden) |
| `failed` | (button hidden) | (button hidden) |

Enabled and disabled variants share the same label so the row reads
consistently when a bed is / isn't assigned. Tooltip
`title="Assign a destination bed first"` on the disabled variant
remains accurate under either label.

---

## What did NOT change

- `onClick` handler on the enabled button: identical before/after —
  same `onNavigateToBed(firstBed.id, expectedTransplantDate, start.id)`
  call, same timing, same args.
- Render gating: still `status !== 'transplanted' && status !== 'failed'
  && onNavigateToBed`.
- In-designer banner copy ("Transplanting: …" / "Mark Transplanted")
  untouched — user explicitly deferred that to a future pass.
- Status semantics: no new states, no existing state behavior altered.
- `transplant_ready` boolean on the model (unused, flagged lifecycle
  drift): untouched — out of scope per investigation.

---

## Verification

- **Build**: `npm run build` — compiled successfully. Main bundle
  grew by +18 B.
- **Tests**: `IndoorSeedStarts.focus.test.tsx` — 2/2 passed. No
  existing test asserts the button label text, so the label flip
  could not regress an assertion. Coverage gap re-flagged.
- **Manual reasoning**: three scenarios walked (planned + bed →
  "Plan Placement"; planned no bed → disabled "Plan Placement";
  hardening + bed → "Transplant Now"). Navigation target and args
  unchanged in all three.

---

## Deferred (out of scope, tracked in findings docs)

- **In-designer banner copy branch by entry status**. Currently reads
  "Transplanting: …" + "Mark Transplanted" regardless of where the
  user entered from. After this fix, a user who clicked "Plan
  Placement" will still see a "Transplanting" banner in the designer
  — mildly inconsistent but not a trust break. Separate future pass.
- **Date-aware threshold** (show "Transplant Now" on `growing` /
  `hardening` within N days of transplant date). Reserved as Option γ
  if product ever wants a softer handoff.
- **Reserved-position write path** (Option B from the full
  investigation — introduce a `reserved_position` field so "Plan
  Placement" can commit a future cell without executing the
  transplant). Legitimate future product pass; overkill for this
  trust fix.
- **Coverage backfill for this modal's label/behavior**. No unit
  tests assert the button label. Candidate for a future
  `test-engineer` pass.

---

## Awaiting user

Push greenlight for `d63f487` plus the earlier AUDIT / transplant-now
docs bundle:

```
d63f487 fix: Show Plan Placement label until indoor start is hardening
29867d1 docs: Indoor Start Transplant-Now report-back
ef7b039 docs: Indoor Start Transplant-Now lifecycle investigation + summary
ab155f5 docs: AUDIT-011 compact report-back             (from AUDIT-011 pass)
```

Three new commits for this Transplant-Now pass; `ab155f5` already
approved but pushed in the AUDIT-011 push earlier.
