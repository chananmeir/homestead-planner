# Indoor Start Transplant-Now Report-back (2026-04-23)

Chat-reply cut of the investigation. Companion to:
- `indoor-start-transplant-now-lifecycle-finding.md` (user finding, P1)
- `indoor-start-transplant-now-investigation.md` (full technical investigation)
- `indoor-start-transplant-now-summary.md` (decisions-and-next-steps cut)

Persisted per the always-write-findings-to-md rule.

---

## Good news first

**The click is navigation-only, not execution.** Clicking "Transplant
Now" on a `planned` card does NOT write anything — it just routes to
the Garden Designer. The actual status advance happens only when the
user clicks "Mark Transplanted" in the designer's banner
(`GardenDesigner.tsx:481-501`). Today's data is safe. **The problem is
purely label semantics / affordance.**

---

## Root cause confirmed

- Button at `IndoorSeedStarts.tsx:539-564` gates on
  `status !== 'transplanted'/'failed'` AND destination bed exists — no
  other status consideration.
- Basil scenario reproduces: both indoor-start create endpoints hardcode
  `initial_status = 'planned'` at `utilities_bp.py:753, :1539-1540`.
- So a freshly-imported `planned` card with a destination bed shows an
  enabled "Transplant Now" button.

---

## Recommendation — Option C — relabel by status

~5-10 LOC, frontend-only, zero regression risk. Label flips by status;
navigation behavior unchanged.

| Status | Recommended label |
|---|---|
| `planned` | `Plan Placement` |
| `seeded` | `Plan Placement` |
| `germinating` / `growing` | `Plan Placement` |
| `hardening` | `Transplant Now` |
| `transplanted` / `failed` | (hidden — unchanged) |

Option B (new "reserved position" field + separate write path) is a
legitimate future product pass but is overkill for a 5-line trust fix.
**Deferred.**

---

## Minor lifecycle drift (flagged, not scope)

- Backend column comment mentions a `'ready'` status; frontend uses
  `'hardening'`.
- An unused `transplant_ready` boolean column sits on the model (no
  writer, no reader).

Cleanup candidate for a separate future pass — not needed to fix this
finding.

---

## Three blocking product decisions (with recommended defaults)

### 1. Pre-ready label wording

- **α: `Plan Placement`** ← recommended (matches finding's own language)
- β: `Preview Placement`
- γ: `Reserve Spot`

### 2. "Transplant Now" threshold

- **α: strict — `hardening` only** ← recommended (user framed `growing`
  as too-early)
- β: loose — `growing` + `hardening`
- γ: date-aware — `growing` / `hardening` within N days of transplant
  date

### 3. In-designer banner copy branch by entry status?

Currently says "Transplanting: …" + "Mark Transplanted" regardless of
entry label. If we ship the pre-ready label flip, this becomes mildly
inconsistent.

**Recommend: defer.** It's a cosmetic seam, not a trust break. Keep
this pass tight.

---

## Committed docs (already landed)

```
ef7b039 docs: Indoor Start Transplant-Now lifecycle investigation + summary
```

Three files: the user's finding (moved in), the full investigation, and
the summary. Not yet pushed.

This report-back file (`indoor-start-transplant-now-report-back.md`)
will be committed as an additional docs entry and pushed with the
eventual fix commit.

---

## Awaiting user

- Confirm default choices `(α, α, defer)` or override.
- Greenlight to dispatch `frontend-debugger` for the ~5-10 LOC label
  flip.
