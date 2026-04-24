Proceed with this understanding of the current Indoor Starts / Designer state:

## What is now considered fixed

The smaller banner/write-path safety issue is improved and can stay as-is:

- pre-ready states no longer silently behave like harmless placement-only actions
- `Save placement` now shows a confirm dialog before the real `status='transplanted'` write
- that smaller follow-up is considered addressed

## What is still open

The broader workflow issue remains open and should be treated as the next real follow-up:

- the app still does not clearly let the user take **one specific existing indoor-start record** and place **that exact record** into a precise spot in the destination bed
- as distinct from starting a new planting flow from the Garden Designer side

This is tracked in:

- `indoor-start-specific-placement-followup.md`
- `AUDIT-013` in `developer-issue-log.md`

## Why this is still a problem

From the user perspective, these are different actions and the app still does not separate them clearly enough:

1. **Use an existing indoor start**
   - "This basil start already exists in Indoor Starts; now place this exact one into the bed."

2. **Create a new planting from the bed side**
   - "I am adding a new planting directly from Garden Designer."

The current flow is improved for safety and wording, but it still does not make that distinction clearly enough.

## Request

Please investigate and propose the smallest clear workflow fix for `AUDIT-013`.

Focus question:

> How does a user take one specific indoor-start record and place that exact record into the bed in a way that is clearly distinct from creating a new planting directly in Garden Designer?

## What to report back with

Please return with:

- confirmed root cause
- recommended fix shape
- whether this needs frontend-only work or frontend + backend linkage work
- whether the current flow already reuses the specific record correctly but presents it unclearly, or whether the linkage itself is still incomplete

## Scope guidance

- keep the recent `Plan Placement` and confirm-dialog fixes in place
- do not reopen the smaller banner/write-path fix
- treat this as the broader remaining workflow problem
