# Indoor Start Save-Placement Confirm Re-test

## Result

User re-test confirmed that the new confirm dialog appears when using **`Save placement`** from a pre-ready indoor-start flow.

Observed behavior:

- the pre-ready flow now presents **`Save placement`**
- clicking it opens a confirmation dialog
- the dialog explicitly warns that the start is not ready for transplant yet
- the dialog makes clear that continuing will mark the start as transplanted

## Interpretation

This means the smaller banner/write-path follow-up is improved:

- the app no longer presents the pre-ready action as harmless placement-only behavior without warning
- users are explicitly warned before the real transplant-status write happens

## Important limitation

This does **not** resolve the broader workflow issue tracked separately in:

- `indoor-start-specific-placement-followup.md`
- `AUDIT-013`

Why:

- `Save placement` is still not a true placement-only action
- it remains a confirm-gated path to the same transplant-status write
- the larger question of how a user places one specific existing indoor-start record into the bed, as distinct from starting a new planting flow, is still open

## Recommended tracking interpretation

- treat the smaller banner/write-path issue as **fixed**
- keep the broader specific-placement workflow issue **open**
