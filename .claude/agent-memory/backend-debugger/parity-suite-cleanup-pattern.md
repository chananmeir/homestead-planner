---
name: Parity suite xfail cleanup pattern
description: How to clean up xfail markers in test_cross_stack_parity.py after a data-alignment pass, including the legacy-reason retention convention.
type: feedback
---

## Pattern: clearing xfail groups after fix

When a data-alignment pass fixes drift, the parity suite's `strict=True` xfail
markers flip to XPASS (which counts as a failure). Do NOT just delete the
group entirely — the convention used in this repo is:

1. **Keep the `XFAIL_REASON_X` string** but rewrite it as a "(legacy)" anchor
   with the resolution date and a pointer to the fix PR/commit.
2. **Empty the frozenset** (`XFAIL_X_SPACECALC_CASES = frozenset()`) rather
   than deleting it. This keeps the `_spacecalc_param` dispatch literal so
   architectural regressions can be restored by re-populating the set.
3. The existing Groups C and D already follow this pattern (post-2026-04-22
   calculator rewrite) — mirror that style for A/B/E/F/G.

**Why:** `_spacecalc_param` dispatches by membership in these frozensets. An
empty frozenset is a no-op at collection time; a deleted name breaks the
dispatch and requires edits to two places (the group declaration and the
dispatch function). Keeping names stable also makes `git log` on this file
readable — you can see when a group went from "active drift" to "resolved".

## How to apply

- After data fix lands and parity XPASSes the expected cases, edit
  `XFAIL_REASON_X` to a "(legacy)" string with the date.
- Replace `frozenset({...})` with `frozenset()`.
- If a subset remains deferred (e.g. strawberry-1 perennial semantics), do
  NOT leave it in the original group — create a new Group H / I / etc. with
  its own reason string that explicitly names the product-model question.
  Mixed-reason groups make the xfail output unreadable.
- Always rerun parity after changes to confirm `0 failed, 0 xpassed`.

## Why: evidence from 2026-04-22 passes

- First 2026-04-22 pass (calculator rewrite): Groups C/D emptied this way;
  pattern worked cleanly, no regressions.
- Second 2026-04-22 pass (data alignment): Groups A/B/E/F/G emptied the same
  way; strawberry-1 split into new Group H. Final state: 694 pass / 1 xfail,
  which is exactly what the reviewer can audit at a glance.
