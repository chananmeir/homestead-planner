# Dashboard Missing Transplant-Due — Recommendation Summary (2026-04-25)

Concise chat-style summary of the investigation findings + decision options.
Full investigation: `dashboard-missing-transplant-due-investigation.md`.

## What I found

**Different bug family from the row-splitting series — a stale guard proxy.** Sharp root cause:

Commit `b8f3cb8` (Apr 15) added this guard to `_build_transplants_due` at `dashboard_service.py:395-397`:
```python
seed_start = _as_date(e.seed_start_date)
if seed_start is not None and seed_start <= target_date:
    continue   # "seed-start was missed" → no transplant signal
```

The intent was right ("don't show Transplant Due for events whose seed-start phase was never performed"), but the proxy `is_complete=False AND seed_start_date <= today` is **wrong** because the Indoor Starts PUT endpoint at `utilities_bp.py:961-962` advances `IndoorSeedStart.status` (`planned → seeded → germinating → growing → hardening`) **without ever setting `linked_event.completed = True`**.

So every indoor-started crop reaching its transplant date gets silently suppressed from the dashboard while Indoor Starts (which reads `expected_transplant_date` directly) correctly shows it as ready / overdue.

**Reproducible scenario** (sim 2024-03-24, beets seed-started 2024-02-18 with `weeksIndoors=4`, expected_transplant 2024-03-17):
- Indoor Starts: shows "7 days overdue" (red)
- Dashboard: silently dropped by the guard

**Why the contrast case works:** The 2024-04-14 beans signal you saw is direct-seed (`direct_seed_date` set, `seed_start_date` NULL) → routed through `_build_direct_seed_due` which has no equivalent guard.

**Layer 1 / row-grouping not involved** — bug predates both, originates in `b8f3cb8`.

## Three options

| # | Approach | Tradeoff |
|---|---|---|
| **1** | Replace proxy with IndoorSeedStart.status check. Fire guard only when no ISS linked OR `iss.status == 'planned'` | ~25–40 LOC + 3–5 tests. **Recommended** |
| 2 | Set `linked_event.completed = True` in Indoor Starts PUT | Schema/state churn, breaks `is_complete` semantics for transplant-due itself |
| 3 | Remove the guard entirely | Re-introduces the UX issue `b8f3cb8` was solving |

**Recommendation:** Option 1. Smallest, surgical, backward-compatible (PE-only events with no linked ISS keep existing behavior).

## Open question for the user

Pick one of:

- **(a)** Implement Option 1 now
- **(b)** Implement Option 2 / 3 (not recommended)
- **(c)** Wait / different scope
