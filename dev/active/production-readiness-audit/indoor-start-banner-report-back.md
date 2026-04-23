# Indoor Start Banner Copy — Report-back (2026-04-23)

Chat-reply cut of the banner-copy follow-up investigation. Companion to:
- `indoor-start-plan-placement-banner-followup.md` (user P2 finding)
- `indoor-start-banner-investigation.md` (full technical investigation)
- `indoor-start-banner-summary.md` (decisions + options)

Persisted per the always-write-findings-to-md rule.

---

## Confirmed current behavior

- **Banner text** (`GardenDesigner.tsx:2653`): hardcoded literal
  `"Transplanting"`.
- **Button** (`GardenDesigner.tsx:2664`): hardcoded literal
  `"Mark Transplanted"`.
- **Click writes**: `PUT /api/indoor-seed-starts/:id { status:
  'transplanted' }` — and **nothing else**. No PlantedItem creation.
  No `actualTransplantDate` set (verified against
  `utilities_bp.py:961-971` — fields are independent).
- **Entry status is accessible**: `IndoorSeedStart.status` already
  flows into the fetch at line 458; just needs to be propagated into
  `transplantMode` state before line 468.

---

## Critical semantic finding

**Option α (copy-only) is not acceptable** — the click is a real write
(terminal `status='transplanted'` transition). Softening the button
label to "Save placement" without gating the write would mean users
who entered via "Plan Placement" would think they're reserving a spot
but actually execute the transplant. That's **worse** than the current
wording mismatch.

---

## Recommendation: **Option β — Copy + confirm dialog**

Copy branches by entry status:

| Entry status | Banner | Button |
|---|---|---|
| `hardening` | `Transplanting: <name>` (current) | `Mark Transplanted` (current) |
| any other pre-ready (`planned` / `seeded` / `germinating` / `growing`) | `Planning placement for: <name>` | `Save placement` |

**Click behavior**:
- Hardening: unchanged.
- Pre-hardening: confirm dialog first — `"This start isn't ready for
  transplant yet (status: <current>). Continue and mark it
  transplanted?"` Proceed → same write. Cancel → no write.

---

## Scope

- Single file: `GardenDesigner.tsx`
- ~30-50 LOC: status propagation + copy branch + confirm dialog
- Frontend-only, no backend change
- Specialist: `frontend-debugger`
- Test coverage gap: no tests assert banner copy or
  `handleMarkTransplanted` behavior (flagged for future
  `test-engineer` pass)

---

## Observation flagged (NOT scope)

`actual_transplant_date` stays NULL when status is set to
`'transplanted'` via this flow (frontend doesn't send it, backend
doesn't auto-fill). Pre-existing — not a regression. Candidate for a
separate future cleanup pass to either auto-fill server-side or send
from the frontend.

---

## Commit

```
d438c69 docs: Indoor Start banner-copy follow-up investigation + summary
```

Local only, not pushed.

---

## Awaiting

- Greenlight **Option β** (or override to a different option)
- Optional: preferred confirm-dialog wording/style (both suggestions
  in the summary doc are fine; implementation can pick either)

Once greenlit, `frontend-debugger` will ship the ~30-50 LOC change,
bundle with docs, and push.
