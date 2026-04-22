# Phase B Triage (2026-04-22)

Triage of the 11 confirmed findings in `phase-b-smoke-findings.md`, ranked by
severity so scope for the next pass can be decided.

---

## Triage

### Bugs — real functional breakage (3)

| # | Finding | Domain | Likely blast radius |
|---|---|---|---|
| 9 | Designer placement creates a duplicate indoor-start record instead of advancing the existing one | Frontend + backend link | Data integrity — duplicate records accumulate |
| 10 | "Save for seed" state doesn't persist after leaving/reopening | Frontend + backend | Data loss — user-facing feature silently fails |
| 5 | Export-plan succeeds but shows red toast `Failed to load nutritio…` | Frontend | Cosmetic-ish, but the nutrition fetch is actually failing during export — may hide real backend issue |

### Scheduling / data-logic (1)

| # | Finding | Notes |
|---|---|---|
| 6 | Imported indoor starts are backdated when importing on the current date, no rescheduling help | Indoor seed-start import math — needs a product decision before fixing (clamp to today? prompt user? offer reschedule?) |

### UX / workflow consistency (4)

| # | Finding | Notes |
|---|---|---|
| 3 | Create Plan returns to plan list; user has to guess "Work" is the next step | Workflow dead-end |
| 7 | Lettuce has "Transplant Now" button; tomato doesn't | Action surface varies without clear reason |
| 8 | Lettuce shows destination bed; tomato doesn't | Presentation varies without clear reason |
| 11 | Plan duplicate names itself `original-copy` with no rename prompt | Minor UX gap |

### UI / layout (2)

| # | Finding | Notes |
|---|---|---|
| 1 | Create Property action below the fold at default zoom; requires 70% zoom to reach | Layout / responsive sizing |
| 2 | Dashboard weather tile says "set up weather separately" but clicking shows weather working | State/copy inconsistency |

### Already handled by the audit (1)

| # | Finding | Notes |
|---|---|---|
| 4 | Configure Strategy step documented but not in live flow | **Already resolved** by the audit's doc reconciliation in commit `5fedaff`: `USER_JOURNEY.md` Week 4 + `APPLICATION_FEATURES.md` §3 now match the simplified live flow. If the deviation is still showing, the reference doc version used during the smoke pass was pre-audit. |

### Retest findings (1, added 2026-04-22)

| # | Finding | Notes |
|---|---|---|
| 12 | Indoor Starts import source ambiguity — the From Garden Plan modal does not identify WHICH plan its rows come from, so activating a different plan (42-seed signature) didn't visibly change the modal's contents. Surfaced on retest after the #7/#8 fix shipped. | Trust/scoping issue. Likely rooted in the `/api/planting-events/needs-indoor-starts` endpoint not filtering by active plan, OR the modal rendering rows from all plans union-style without a plan header/filter. Needs investigation — classify as **workflow trust bug**, higher priority than #11 because it affects data accuracy, not just naming polish. Fix scope likely: (a) backend filter by `?planId=<id>` OR active plan, (b) frontend modal header naming the source plan, (c) either both. Not scheduled yet. |

---

## Recommendation

Suggested order:

1. **Bugs first** (#9, #10, #5) — confirmed functional breakage. Each is
   scoped enough for one specialist in one pass. Can run in parallel if
   desired.
2. **Scheduling policy decision (#6) before fix** — the correct behavior
   depends on a product call that hasn't been made yet (clamp date? prompt?
   partial skip?). A research pass should gather options and return with a
   recommendation before dispatching a fix.
3. **Workflow consistency items (#3, #7, #8, #11)** — these likely cluster
   because they're all adjacent (planner → indoor starts → designer
   lifecycle). May share a root cause. Worth investigating with one research
   pass before dispatching fixes.
4. **UI / layout (#1, #2)** — lower severity. Fine to batch after the above.

---

## Open items for user decision

- **Greenlight bug fixes (#9, #10, #5)?** Three specialists can run in
  parallel.
- **Preference for #6 policy** (clamp-to-today vs. prompt vs. skip), or
  should the next pass research and propose?
- **Tracking structure**: new findings doc per issue, or extend `tasks.md`
  / this file for Phase B bug tracking?
- **Commit structure**: one finding per commit, grouped by probe, or grouped
  by domain? Decides how fixes get committed later.

Nothing started yet. Awaiting direction.
