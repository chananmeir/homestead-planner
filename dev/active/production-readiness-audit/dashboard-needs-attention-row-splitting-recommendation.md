# Dashboard Needs-Attention Row-Splitting — Recommendation Summary (2026-04-25)

Concise chat-style summary of the investigation findings and decision options.
Full investigation: `dashboard-needs-attention-row-splitting-investigation.md`.

## What I found

Same root cause as the 3 prior surfaces, but **structurally different layer**: this is a backend issue, not frontend.

`backend/services/dashboard_service.py` emits **one signal per PlantingEvent** with `signalKey = f'indoor-{event.id}'`. 4 PlantingEvents → 4 distinct signalKeys → 4 dashboard rows. The frontend `NeedsAttentionPanel` does zero grouping — it faithfully renders what the backend sends.

**5–7 builders** need grouping logic: `harvestReady`, `indoorStartsDue` (PE + ISS paths), `transplantsDue`, `directSeedDue`, `germinationCheck`, `indoorGerminationCheck`. Singletons (frost, rain, livestock) and one-per-entity kinds (compost, seed-low, seed-expiring) don't apply.

**Three product-decision points** that don't have the same answer as the calendar surfaces:

| # | Decision | Default recommendation |
|---|---|---|
| **D1** | Grouping key | Composite `(date, plantId, variety, bedId)` matching ListView/CalendarGrid/DayDetailModal |
| **D2** | Deep-link click target | Representative event id (lossy but minimal change to `NeedsAttentionTarget` + `useFocusHighlight`) |
| **D3** | Snooze semantics | Frontend loops POSTs over `plantingEventIds` (no backend bulk endpoint needed) |

## Three options

| # | Approach | Scope |
|---|---|---|
| **1** | Minimal: backend grouping + representative id + frontend snooze fan-out | ~150–250 LOC backend, ~50–100 LOC frontend, +tests. **Recommended** |
| 2 | Option 1 + new bulk-snooze endpoint | +30 LOC backend, atomic snooze |
| 3 | Defer | Not recommended — 4th surface of same finding family |

**Recommendation:** Option 1 with defaults (D1=composite, D2=representative id, D3=frontend loop). Smallest reasonable fix, mirrors the prior 3 surfaces' philosophy, additive — if you later want exact deep-link or atomic snooze those become non-breaking enhancements.

## Open question for the user

Pick one of:

- **(a)** Implement Option 1
- **(b)** Implement Option 2 (Option 1 + bulk-snooze endpoint)
- **(c)** Defer / want different scope
- **(d)** Want to override one of the D1/D2/D3 defaults
