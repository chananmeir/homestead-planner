# Indoor Start Banner Retest Confirmation (2026-04-23)

User-side re-test result following the push of commit `2d41a02`.
Persisted per the always-write-findings-to-md rule.

---

## Verified working

- The new confirm dialog is appearing as expected when the user enters
  the banner from a pre-ready indoor-start state.
- `Save placement` no longer silently performs a
  `status='transplanted'` write.
- The user is warned before the write fires.

**Conclusion**: the smaller banner / write-path fix (Option β,
commit `2d41a02`) works as designed.

---

## Deeper observation (reinforced)

The dialog's presence also confirms that **`Save placement` is still,
under the covers, a confirm-gated `mark transplanted` action** — not a
true placement-only action.

Meaning: clicking Save placement → Confirm still advances
`IndoorSeedStart.status` to `'transplanted'`. The user is no longer
misled by copy OR surprised by the write, but the underlying data
transition is the same commit it always was. What's now missing is a
real "reserve this cell without transplanting" primitive.

That gap is **AUDIT-013**, not this finding.

---

## Status

- **Banner fix**: **verified — closed** as a safety/clarity improvement.
  - Copy now matches intent for the two entry paths.
  - Write is gated with explicit user consent when entry is pre-ready.
  - No more silent / misleading commits from the banner.

- **AUDIT-013** (broader placement workflow): **still open, distinct
  track**. Today's fix does NOT resolve it. Specifically open:
  - Placing a specific existing indoor-start record against a chosen
    cell without executing the transplant-status transition.
  - Distinguishing "mark this existing record's future cell" from
    "start a new planting flow from scratch" in the designer entry
    point.

---

## Next

- Banner follow-up needs no further action.
- AUDIT-013 awaits a formal finding doc + scope pass from the user
  when prioritized. No preemptive work on it from this side.
