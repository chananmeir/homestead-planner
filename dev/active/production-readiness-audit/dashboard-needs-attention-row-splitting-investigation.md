# Dashboard Needs-Attention Row-Splitting — Investigation (2026-04-25)

Investigation for `dashboard-needs-attention-row-splitting-finding.md`.
Fourth surface in the row-splitting follow-up series after CalendarGrid
pills (existing), ListView (commit `47a0e4a`), and DayDetailModal
(commit `2dd7c57`).

This one is structurally different from the calendar surfaces and
requires a few product decisions before implementation. Investigation
only — no code changed.

---

## TL;DR

The dashboard is **emitting one signal per PlantingEvent** at the
backend layer. The frontend `NeedsAttentionPanel` does no grouping
and faithfully renders one row per signal. The 32-beet scenario
becomes 4 rows because 4 PlantingEvents share `(date, plantId,
variety, bedId)` but have distinct `id`s, and `signalKey =
f'indoor-{event.id}'` embeds the id.

**Fix should live in the backend** (`dashboard_service.py`), same
root cause as the prior 3 surfaces. The frontend needs only minor
display updates (sum quantity + show count). However, three
invariants need decisions before implementation:

1. **Deep-link target** — today each row carries one
   `plantingEventId`. Grouped rows need either (a) a representative
   id (lossy but minimal change), or (b) `plantingEventIds: int[]`
   (heavier but exact).
2. **Snooze** — today snooze is per-signalKey. A grouped row's
   snooze either (a) uses a representative key with minor churn on
   group changes, or (b) requires a backend bulk-snooze endpoint.
3. **Staleness** (harvest-ready and similar kinds) — when grouped
   members differ on staleness, the row needs a representative
   policy (worst-case / any-stale / all-stale).

---

## Evidence

### Where the 4 rows come from

`backend/services/dashboard_service.py:_build_indoor_starts_due` lines
202–216:
```python
for e in events:
    rows.append({
        'signalKey': f'indoor-{e.id}',
        'plantingEventId': e.id,
        ...
        'quantity': e.quantity,
    })
```
Linear iteration, one row per event, signalKey embeds the event id
→ 4 PlantingEvents = 4 rows. Same shape in:
- `_build_transplants_due` (lines 286–322)
- `_build_direct_seed_due` (lines 351–380)
- `_build_germination_check` (lines 406–446)
- `_build_indoor_germination_check` PE-path (lines 562–600)
- `_build_harvest_ready` (line 151)

Cross-source dedup exists (`_build_indoor_starts_due` skips ISS
already linked to a PE shown — lines 224, 250–251), but **no
intra-source aggregation** anywhere. No `seen` set keyed by `(date,
plantId, variety, bedId)`. No reduce step.

### Frontend renders one signal = one row

`frontend/src/components/Dashboard/NeedsAttentionPanel.tsx:392-393`:
```tsx
<div className="space-y-2">
  {visibleRows.map(row => renderSignalRow(row))}
```
where `rows` is built by `buildRows(data.signals, onNavigate)` (line
169) — naive `forEach` over each backend array, one frontend row per
backend signal. Zero client-side grouping.

### Signal shape (representative — IndoorStartDueRow)

`frontend/src/components/Dashboard/types.ts:24-35`:
```ts
export interface IndoorStartDueRow {
  signalKey: string;
  plantingEventId: number | null;
  indoorSeedStartId?: number | null;
  plantName: string;
  variety?: string | null;
  seedStartDate: string;
  quantity: number | null;
}
```
No `gardenBedId` on indoor-starts (they're not yet placed). Other
kinds add `bedId`/`bedName`, `daysPastExpected`, `isStale`,
`expectedGerminationDate`, etc.

### NeedsAttentionTarget — single-id everywhere

`frontend/src/components/Dashboard/types.ts:180-192`:
```ts
export type NeedsAttentionTarget =
  | { kind: 'harvest'; plantingEventId: number }
  | { kind: 'indoorStart'; indoorSeedStartId?: number | null; plantingEventId?: number | null }
  | { kind: 'transplant'; plantingEventId: number; bedId?: number | null }
  | { kind: 'directSeed'; plantingEventId: number; bedId?: number | null }
  | { kind: 'germinationCheck'; plantingEventId: number; bedId?: number | null }
  | { kind: 'indoorGerminationCheck'; indoorSeedStartId?: number | null; plantingEventId?: number | null }
  | { kind: 'compost'; pileId: number }
  | { kind: 'seedLow'; seedId: number }
  | { kind: 'seedExpiring'; seedId: number }
  | { kind: 'livestock'; type: string }
  | { kind: 'weatherFrost' }
  | { kind: 'weatherRain' };
```
Every clickable kind targets a **single** primary key. No "group of
ids" variant. `useFocusHighlight` is generic over `T extends string |
number` — single-id deep-link only.

### Snooze — per-signalKey, single-key endpoint

Backend: `DashboardSnooze.signal_key` is unique per `(user, signal_key)`
(`models.py:1461-1470`). Filter applied via set membership across
both signals and missed (`dashboard_service.py:890, 895`). The
endpoint accepts ONE `signalKey` per call (`dashboard_bp.py:53-98`).

Frontend snooze (`NeedsAttentionPanel.tsx:182`) POSTs once per row.

So a grouped row with a single representative signalKey will
**only snooze the representative event**. The other 3 events keep
their own signalKeys. If we don't change the underlying signal
emission, those 3 reappear after refresh.

### Missed bucket — same builders, same problem

`dashboard_service.py:868-872` populates `missed` via the same
3 builders (`indoorStartsDue`, `transplantsDue`, `directSeedDue`)
returning `{'active': [...], 'missed': [...]}`. Frontend renders
`missedRows` in a separate `<details>` block at
`NeedsAttentionPanel.tsx:417-437`. The same row-per-event pattern
applies; same grouping concern in both buckets.

### Tests

- **Backend**: no test pins per-event count for multi-event scenarios.
  Existing assertions (`test_dashboard_endpoint.py:177, 217, 237, 244`,
  `test_dashboard_staleness.py:131, 141, 153, 205`) all use single-event
  scenarios with `len == 1` or `== 0`. The PE↔ISS dedup test
  (line 237) constrains 1 PE + 1 ISS → 1 row, not multi-PE grouping.
  **No test would break from collapsing 4-into-1.**
- **Frontend**: 988 lines in `NeedsAttentionPanel.test.tsx` cover
  per-category row rendering, snooze POST, dismiss + undo, missed
  bucket. Existing tests assume one-row-per-signal — any grouping fix
  will need new tests and likely revisions.

---

## Which kinds are affected

Of the 12 dashboard kinds (14 prefix patterns including dual-source
paths), grouping applies only to per-PlantingEvent ones:

| Kind | Builder | Affected? |
|---|---|---|
| harvestReady | `_build_harvest_ready` | ✅ |
| indoorStartsDue (PE path) | `_build_indoor_starts_due` (PE) | ✅ |
| indoorStartsDue (ISS path) | `_build_indoor_starts_due` (ISS) | ⚠️ rare (succession ISS) |
| transplantsDue | `_build_transplants_due` | ✅ |
| directSeedDue | `_build_direct_seed_due` | ✅ |
| germinationCheck | `_build_germination_check` | ✅ |
| indoorGerminationCheck (ISS) | `_build_indoor_germination_check` | ⚠️ rare |
| indoorGerminationCheck (PE) | `_build_indoor_germination_check` | ✅ |
| frostRisk / rainAlert | singletons | n/a |
| compostOverdue | one per pile | n/a |
| seedLowStock / seedExpiring | one per seed | n/a |
| livestockActions | singleton | n/a |

**5–7 builders need grouping logic.** Medium-shaped fix.

---

## Three product-decision points

### D1: Grouping key

Two viable approaches:

**(a) Composite key — same as calendar surfaces.**
```
(seed_start_date, plant_id, variety, garden_bed_id)   # for transplant/directSeed/germinationCheck
(seed_start_date, plant_id, variety)                   # for indoor-starts (no bed yet)
```
Maximally consistent with ListView/CalendarGrid/DayDetailModal.

**(b) succession_group_id when available, fall back to composite.**
PlantingEvent has `succession_group_id` (UUID, see CLAUDE.md
"Succession Planting Race Condition"). For events created via the
calendar export path, this UUID links a succession series — exactly
the user-facing "one task" intent.

Recommendation: **(a)**. Simpler, mirrors the prior 3 surfaces, and
covers non-succession cases (e.g., a 32-beet plan placed in one shot
without succession). `succession_group_id` is a strict subset of
the composite key, so (a) covers (b) plus more.

### D2: Deep-link / click target

**(a) Representative event id.** Click on grouped row navigates to
the first event in the group. `NeedsAttentionTarget` shape unchanged.
`useFocusHighlight` unchanged. 3 of 4 events don't get focused/
highlighted in the destination, but the user lands on the right view.

**(b) Multi-id target.** Add `plantingEventIds: number[]` variant to
`NeedsAttentionTarget`. Each destination component handles array
focus. `useFocusHighlight` becomes `T | T[]`. Scope: ~12
destinations + the hook.

**(c) Group modal.** Click opens a modal listing the underlying
events (mirror `GroupedEventsModal` in calendar). User picks one to
deep-link.

Recommendation: **(a)**. Lossy but vastly simpler. Users wanted
"one task, one row" — they'll click through to confirm, not need
all 4 events highlighted.

### D3: Snooze semantics

**(a) Representative key.** Grouped row's signalKey is the first
event's. Snoozing it only suppresses that one event's signal next
time. If the user expects "snooze the whole task", behavior is
broken.

**(b) Backend computes a stable group key.** `signalKey =
f'indoor-group-{hash(seed_start_date, plant_id, variety, bedId)}'`.
Snooze applies to the group as long as the membership is identical.
If one event is later completed/removed, the group key may shift
(if hash inputs change) or stay (if hash inputs don't include event
id) — needs care.

**(c) Frontend bulk-snoozes by looping.** Grouped row carries
`plantingEventIds: int[]`. Snooze handler POSTs N times, one per
event. Robust. Adds N requests but typically N ≤ 8.

**(d) New backend bulk-snooze endpoint.** `POST /api/dashboard/snooze`
accepts `signalKeys: string[]`. Atomic.

Recommendation: **(c)**. Stable, no schema gymnastics, minor request
overhead. (d) is a clean future enhancement if performance matters.

---

## Three implementation options

### Option 1 — Minimal (representative id, frontend bulk-snooze)

- Backend: 5–7 builders updated to group by composite key, sum
  `quantity`, use first event's id as the representative for
  `signalKey` and `plantingEventId`. Add `plantingEventIds: int[]`
  field to the signal shape.
- Frontend: signal types add optional `plantingEventIds`. Display
  shows summed quantity + `(N)` badge when count > 1. Snooze loops
  POSTs per id.
- Tests: backend gets 1 new test per affected builder
  (multi-event-collapse). Frontend tests adjusted for grouped row +
  snooze fan-out.

Estimated scope: ~150–250 LOC backend, ~50–100 LOC frontend, plus
tests. **Recommended.**

### Option 2 — Backend bulk-snooze endpoint

Same as Option 1 plus:
- New `POST /api/dashboard/snooze-bulk` accepting `signalKeys: string[]`.
- Frontend uses single bulk POST instead of looping.
- DashboardSnooze model unchanged; just a wrapper endpoint.

Adds ~30 LOC backend + small frontend tweak. Cleaner but defers
decision on bulk-undo / bulk-dismiss.

### Option 3 — Defer

Acknowledge dashboard signal-splitting as known limitation, point
the user at the now-fixed calendar surfaces for grouped views, and
move on.

Not recommended given the same root concern just got 3 surfaces of
fixes.

---

## Recommendation

**Option 1**, with the three product-decision defaults: composite
grouping key (D1=a), representative event id for deep-link (D2=a),
frontend loops for snooze (D3=c).

This is the smallest reasonable fix that fully closes the fourth
surface. ~5–7 backend builders + minor frontend display + targeted
tests. Maintains consistency with the prior 3 surface fixes
(commits `47a0e4a` and `2dd7c57`) by reusing the same composite
key shape. No schema change, no migration.

If after shipping the user wants exact deep-link / atomic snooze,
those become Option 1.5 (multi-id target) or 1.6 (bulk-snooze
endpoint) — additive, not breaking.
