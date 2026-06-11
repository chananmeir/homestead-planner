# Tier 0 Findings — Is the plan-only seedings banner enough?

**Date:** 2026-06-11 · **Method:** read-only SQLite queries
(`tier0_indoor_start_query.py` / `query2.py` in this folder) against
`backend/instance/homestead.db`. Follow-up to `indoor-start-export-bridge-proposal.md`.

## Data hygiene note

183 users exist; almost all are e2e/test fixtures (`*@test.com`). The only real account
with meaningful data is **u59 (marcsiegel)** — owner, last real login 2026-05-08. u60
(lacyevens) has 8 events of light/older usage. Everything below is u59, season 2026.

## Headline numbers (u59, 2026 season)

| Metric | Count |
|---|---|
| Transplant-type events (seed_start_date set, active) | 81 |
| Tracked (linked IndoorSeedStart) | **62 (77%)** |
| Plan-only (no linked start) | 19 |
| Plan-only and past-due (seed date < today) | 12 |
| — of which completed anyway (event marked done, never tracked) | 8 |
| — of which still open = **genuinely missed seedings** | **4** |
| Plan-only but upcoming (fall crops, still time) | 7 |

All 93 of u59's IndoorSeedStart rows link to an event — standalone tray creation is never
used; the event bridge is the only tracking entry point in practice.

## The 4 genuinely missed seedings

| Event | Crop / variety | Seed date | Weeks overdue |
|---|---|---|---|
| ev5930 | Lettuce — Ruby Red (qty 12) | 2026-03-04 | ~14 |
| ev6130 | Pepper — Miniature Yellow Bell (qty 20) | 2026-04-01 | ~10 |
| ev5990 | Squash — Spaghetti (qty 3) | 2026-04-30 | ~6 |
| ev6086 | Cilantro — Slow Bolt (qty 10) | 2026-05-17 | ~3.5 |

These sat through the banner, the calendar plan-only pills, and weeks of dashboard
`indoorStartsDue` signals (now aged into the missed bucket) without being tracked,
completed, or skipped.

The other 8 past-due plan-only events (4 broccoli, 4 cucumber) were **completed without
ever tracking a tray** — the work happened, but outside the tracking layer. Possibly
deliberate ("I don't need germination tracking for these"), possibly friction-skip.

## Verdict

The passive bridge is *mostly* working (77% tracked) but demonstrably leaks: 4 real
seedings slipped for weeks-to-months, and 8 more bypassed tracking entirely. That meets
the appendix's revisit condition ("if that banner gets ignored in practice") at moderate
strength — not a wholesale failure, so full A2 auto-create remains unjustified, but
**Tier 1 (post-export tracking prompt) is supported by the evidence**: it would have put
all 12 past-due cases in front of the user at the moment of intent, with decline as a
legitimate answer for the "completed anyway" class.

## Caveat

"Past-due" is measured against real today (2026-06-11). The simulation clock can shift the
app's working date, so some of these may have been planned during time-travel sessions;
the 4 missed rows have plausible real-season dates and are treated as genuine.

## Recommendation

Proceed to Tier 1 as scoped in `indoor-start-export-bridge-proposal.md`. Hold Tier 2 (A2).
