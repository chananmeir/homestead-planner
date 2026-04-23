# Indoor Start Transplant-Now Finding — Investigation Summary (2026-04-23)

Decision cut from `indoor-start-transplant-now-investigation.md`.
Finding is P1 per `indoor-start-transplant-now-lifecycle-finding.md`.

---

## Good news first

**The click is navigation-only, not execution.** Clicking "Transplant Now"
on a `status='planned'` card does NOT write anything. It navigates to
the Garden Designer with `transplantSeedStartId`, and a banner there
prompts the user to explicitly click "Mark Transplanted" — only then
does the backend `PUT status='transplanted'` fire (designer at
`GardenDesigner.tsx:481-501`).

So today's data is safe. The problem is purely **label semantics /
affordance** — the button implies a stronger action than it performs.

---

## Current gating — confirmed

`frontend/src/components/IndoorSeedStarts.tsx:539-564` gates the button
on:

- `start.status !== 'transplanted' && start.status !== 'failed'`
- `destinationBedDetails.length > 0`
- `onNavigateToBed` provided

No status-threshold consideration, no date gate, no "ready" flag. A
freshly-created `'planned'` record flows straight through.

---

## Basil scenario reproduced

Both `POST /api/indoor-seed-starts` and
`POST /api/indoor-seed-starts/from-planting-event` hardcode
`initial_status = 'planned'` at creation
(`backend/blueprints/utilities_bp.py:753` and `:1539-1540`), with the
comment "user explicitly updates status when they seed."

So the basil card WAS at `planned`, the destination bed was set during
import, and the button appeared exactly as shipped — matching the
retest observation.

---

## Lifecycle drift (minor, flagged)

- Backend column comment mentions `ready` as a status.
- Frontend / EditSeedStartModal actually uses `hardening`, `failed`,
  and others.
- An unused `transplant_ready` boolean column exists on the model — no
  writer, no reader.

Not the root cause of this finding, but worth cleaning up later
(separate follow-up, not this pass).

---

## Recommendation: **Option C — relabel only**

Label flips by status. Navigation behavior unchanged (still routes to
the designer + Mark-Transplanted flow).

Suggested default:

| Status | Label |
|---|---|
| `planned` | `Plan Placement` |
| `seeded` | `Plan Placement` |
| `germinating` / `growing` | `Plan Placement` |
| `hardening` | `Transplant Now` |
| (`transplanted` / `failed`) | (button hidden — unchanged) |

Rationale:

- Click is navigation-only, so no behavior change is actually needed
  to make the action safe. The semantic cleanup is purely cognitive.
- Option B (introduce a "Reserve Spot" field on the model + separate
  write path) is the bigger product play. It's a fine future move but
  it's **not required** to resolve this finding. Scope creep for a
  user-trust issue that's otherwise a 5-line change.
- Status-driven label is stable, readable, and matches the user's
  mental model that "Transplant Now" should only appear when something
  is actually ready to transplant.

**Scope**: Frontend-only. ~5-10 LOC in `IndoorSeedStarts.tsx`. Zero
backend change, zero migration, zero regression risk (navigation
target unchanged).

---

## Blocking product decisions

**1. Pre-ready label wording**

- Option α: `Plan Placement` (plan-first)
- Option β: `Preview Placement` (view-first)
- Option γ: `Reserve Spot` (commitment-first)

Recommend **α (`Plan Placement`)** — matches the finding's own
language ("planning the future exact spot"), pairs cleanly with the
eventual "Transplant Now" flip, and doesn't imply a write that the
click doesn't perform.

**2. Threshold for "Transplant Now"**

- Option α: strict — `hardening` only
- Option β: loose — `growing` OR `hardening`, both showing "Transplant Now"
- Option γ: date-aware — `growing`/`hardening` + transplant date within N days (e.g., 7)

Recommend **α (strict `hardening` only)**. Reasoning: the user's own
finding framed `growing` as too-early. Anything looser re-introduces
the premature-action feel. If product wants a softer handoff, revisit
with Option γ (date-aware) later.

**3. Should the in-designer banner copy also branch by entry status?**

Currently when the user clicks and lands in the designer, a banner
says "Transplanting: ..." and the button reads "Mark Transplanted." If
we flip the pre-ready label to "Plan Placement", arriving at the
designer with a banner that says "Transplanting: ..." is mildly
inconsistent.

**Recommend: defer.** The banner change (Option D from the full
investigation) is a separate follow-up pass — keep this fix tight.
Banner inconsistency is a cosmetic seam, not a user-trust break.

---

## Awaiting user

- Confirm default choices (α, α, defer) or override.
- Confirm greenlight to dispatch `frontend-debugger` for the ~5-10 LOC
  label flip.
