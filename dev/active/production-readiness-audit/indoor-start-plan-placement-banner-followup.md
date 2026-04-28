# Indoor Start Plan-Placement Banner Follow-up

## Status

- **Priority**: `P2`
- **Status**: `Verified closed`

## Context

The recent label fix improved the card-level affordance:

- pre-ready indoor starts now show **`Plan Placement`**

That part is working from the user side.

## Remaining seam

After clicking through from **`Plan Placement`** into the bed view, the designer banner still uses transplant-execution language such as:

- **`Transplanting Basil ...`**
- **`Mark Transplanted`**

## Why this matters

From the user perspective, this creates a wording mismatch:

- the card says this is placement planning
- but the next screen still reads like immediate transplant execution

So the trust issue is improved, but not fully smoothed out.

## Recommendation

Treat the recent fix as successful for the original card-level affordance issue, but keep this as a smaller follow-up item:

- update designer/banner copy when entering from a pre-ready placement-planning flow
- do not treat this as a rollback of the card-label fix

## Suggested framing

This is a **banner-copy / flow-language follow-up**, not a full lifecycle failure.

Possible follow-up directions:

- branch the banner copy by entry status
- use planning language for pre-ready flows
- reserve `Transplanting ...` / `Mark Transplanted` for truly transplant-ready states

## Resolution

Resolved on 2026-04-23.

- pre-ready states now use planning-oriented copy
- a confirm dialog appears before the real transplant-status write for pre-ready states
- `hardening` keeps the direct transplant wording/path

User re-test confirmed the dialog appears as expected. This closes the smaller banner/write-path safety issue, but does not replace the broader specific-placement workflow follow-up tracked in `indoor-start-specific-placement-followup.md` / `AUDIT-013`.
