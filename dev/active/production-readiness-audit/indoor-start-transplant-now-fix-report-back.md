# Indoor Start Transplant-Now Fix — Report-back (2026-04-23)

Chat-reply cut of the fix pass. Companion to:
- `indoor-start-transplant-now-lifecycle-finding.md` (user finding, P1)
- `indoor-start-transplant-now-investigation.md` (full technical investigation)
- `indoor-start-transplant-now-summary.md` (decisions + options)
- `indoor-start-transplant-now-report-back.md` (pre-fix report-back)
- `indoor-start-transplant-now-fix-report.md` (full fix-pass detail)

Persisted per the always-write-findings-to-md rule.

---

## Files changed

- `frontend/src/components/IndoorSeedStarts.tsx` (only). +7 / −6, net ~4 LOC.

---

## Exact status-to-label mapping implemented

```tsx
const transplantActionLabel = start.status === 'hardening'
  ? 'Transplant Now'
  : 'Plan Placement';
```

Applied to BOTH the enabled button and the disabled (no-bed) button:

| Status | Enabled | Disabled (no bed) |
|---|---|---|
| `planned` | Plan Placement | Plan Placement |
| `seeded` | Plan Placement | Plan Placement |
| `germinating` | Plan Placement | Plan Placement |
| `growing` | Plan Placement | Plan Placement |
| `hardening` | Transplant Now | Transplant Now |
| `transplanted` / `failed` | hidden | hidden |

Tooltip (`title="Assign a destination bed first"`) on the disabled
variant preserved — still accurate under either label.

---

## Commit hash

```
d63f487 fix: Show Plan Placement label until indoor start is hardening
43f7aa8 docs: Transplant-Now fix report
```

Plus the earlier `29867d1` / `ef7b039` docs from this workstream.

---

## Test / build result

- `npm run build` — **Compiled successfully.** Main bundle +18 B.
- `IndoorSeedStarts.focus.test.tsx` — **2/2 passed.** No existing test
  asserts the button label text (coverage gap re-confirmed from the
  investigation).

---

## What explicitly did NOT change

- `onClick` handler is byte-identical — same
  `onNavigateToBed(firstBed.id, expectedTransplantDate, start.id)`
  call, same timing.
- In-designer banner copy ("Transplanting: …" / "Mark Transplanted")
  untouched — deferred per user decision.
- Status semantics, render gating, tooltip, styling, testids — all
  unchanged.

---

## Awaiting

Push greenlight for the four local commits:

```
43f7aa8 docs: Transplant-Now fix report
d63f487 fix: Show Plan Placement label until indoor start is hardening
29867d1 docs: Indoor Start Transplant-Now report-back
ef7b039 docs: Indoor Start Transplant-Now lifecycle investigation + summary
```
