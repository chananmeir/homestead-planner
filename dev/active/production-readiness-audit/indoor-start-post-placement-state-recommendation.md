# Indoor-Start Post-Placement State — Recommendation Summary (2026-04-25)

Concise chat-style summary of the investigation findings + decision options.
Full investigation: `indoor-start-post-placement-state-investigation.md`.

## What I found

**Labeling/affordance gap, not state-mutation gap.** Model 1 *is* fully wired end-to-end:
- Backend advances `IndoorSeedStart.status` to `'transplanted'` atomically in `_link_existing_indoor_seed_start` (`gardens_bp.py:125`).
- Frontend correctly suppresses the "Plan Placement" button when `status === 'transplanted'` (`IndoorSeedStarts.tsx:743`).

**The user-perceived bug is one of two scenarios** (likely both):

1. **User stayed on Designer after placement** — `App.tsx:528` unmounts Indoor Starts on tab switch. If tester didn't manually navigate back, they were looking at stale state from memory of the original card.

2. **No positive-confirmation affordance when user does return** — only the status pill silently flips from `'growing'` → `'transplanted'` (a tiny gray label). No "✓ Placed in Bed Iota" subtitle, no green checkmark, no celebratory visual. Easily perceived as "nothing happened" — exactly matching the bug-report wording.

The "Destination" row at line 706-738 already shows the bed name, but doesn't visually shift to indicate placement has been **committed** (vs. just *planned*).

## Three options

| # | Approach | Scope |
|---|---|---|
| **1** | Add positive-confirmation visual on `status === 'transplanted'` cards (e.g., "✓ Placed in {bedName}" badge or subtitle, green checkmark on status pill) | ~30–50 LOC frontend, no backend, no API. **Recommended** |
| 2 | Option 1 + auto-navigate back to Indoor Starts after successful placement (or show toast) | +20–40 LOC, touches GardenDesigner success handler |
| 3 | Option 1 + refetch on tab focus (`visibilitychange` listener for multi-tab/window users) | +10–15 LOC, defensive |
| 4 | All three layers | Most thorough |

**Recommendation:** Option 1 alone. Directly addresses the user's complaint ("card should clearly indicate placement chosen") with smallest blast radius. Layers 2 and 3 are additive UX enhancements that can be decided separately.

## Open question for the user

Pick one of:

- **(a)** Implement Option 1 now
- **(b)** Implement Option 2 (1 + auto-return)
- **(c)** Implement Option 3 (1 + refetch)
- **(d)** Implement Option 4 (all)
- **(e)** Wait / different scope
