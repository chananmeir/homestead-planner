# Dashboard Stale Needs-Attention — Fix Plan

## Status

- **Priority**: `P1`
- **Status**: `Plan — awaiting product decisions before implementation`
- **Finding**: [dashboard-stale-needs-attention-finding.md](./dashboard-stale-needs-attention-finding.md)
- **Date**: 2026-04-24 (today); user is seeing Feb 1 / Feb 2 items still on the panel.

This is a **task-lifecycle** plan, not a sort plan. No implementation in this
document — only audit, proposed rules, scope, open questions, and risks.

---

## 1. Current-Behavior Audit

Every signal type below is emitted by `backend/services/dashboard_service.py`
(signal builders), composed in `build_dashboard_today()` (L768–L818), and
rendered by `frontend/src/components/Dashboard/NeedsAttentionPanel.tsx`
(`buildRows()` L537–L558). All rows share the same row chrome. The only
existing client-side escape valves are:

- **Snooze 3d** — POST `/api/dashboard/snooze` with `days=3` (row "Skip 3d" button).
- **Dismiss forever** — POST `/api/dashboard/snooze` with `forever=true`.
- **Cancel task** — POST `.../cancel` on the underlying PlantingEvent / IndoorSeedStart (only for `indoor-*` and `direct-seed-*` prefixes, see `getCancellableAction()` L75–L92).

There is **no server-side staleness / age-out filter today**. Every builder
lets items past their trigger date fall through as long as `is_complete` is
false (plantings) or the other domain-specific completion predicate isn't
satisfied. That is the root cause of the reported symptom.

| # | Signal (camelCase key) | Builder + line | Trigger query | Completion predicate that removes it | Staleness filter today? | Symptom when stale |
|---|---|---|---|---|---|---|
| 1 | `harvestReady` | `_build_harvest_ready` L102–L152 | `expected_harvest_date <= target_date` AND `cancelled_at IS NULL` | `PlantingEvent.is_complete` (i.e., `completed=True` or `quantity_completed >= quantity`) | **No**. `daysPastExpected` is computed and displayed, but never used to drop the row. | Harvest reminder from Feb stays pinned forever until user logs a harvest or dismisses. |
| 2 | `indoorStartsDue` (path A: PlantingEvent) | `_build_indoor_starts_due` L155–L201 | `seed_start_date <= target_date`, `event_type='planting'`, not cancelled | `PlantingEvent.is_complete` | **No** | **This is the reported Feb 1 case.** Seed-start reminder never ages out; if user never opened the indoor-start tile, it just sits. |
| 3 | `indoorStartsDue` (path B: standalone ISS) | Same builder L208–L239 | `IndoorSeedStart.status == 'planned'` AND `start_date <= target_date` | Status advances past `'planned'` (seeded/germinating/…). | **No** | Same as above, from the ISS side. |
| 4 | `transplantsDue` | `_build_transplants_due` L244–L295 | `transplant_date <= target_date`, not cancelled | `PlantingEvent.is_complete` | **No**. Has a guard that **suppresses** the row if its prerequisite `seed_start_date` has passed and the event isn't complete (L277–L279), so overdue-without-indoor-start cases roll into #2 instead of showing here. | Overdue transplant sits on panel; real-world urgency is higher than #2 because seedlings get rootbound. |
| 5 | `directSeedDue` | `_build_direct_seed_due` L298–L341 | `direct_seed_date <= target_date`, not cancelled | `PlantingEvent.is_complete` | **No** | Stale sowing reminders past the viable planting window persist. |
| 6 | `germinationCheck` (outdoor) | `_build_germination_check` L344–L396 | `direct_seed_date + germination_days <= target_date`, not cancelled | `PlantingEvent.is_complete` | **No upper-bound filter**. Only the lower bound (`expected_germ > target_date ⇒ skip`). | "Check germination" for direct sowings from March still present in late April. |
| 7 | `indoorGerminationCheck` (ISS path) | `_build_indoor_germination_check` L399–L489 | `actual_germination_date IS NULL` AND status not in germinating/growing/ready/transplanted AND expected_germ ≤ target | Status advances OR `actual_germination_date` set | **No upper-bound** (similar to #6). Has transplant-eclipse guard in path B (L516–L518). | Germ-check rows from Feb persist if user never logged germination. |
| 8 | `indoorGerminationCheck` (PE fallback) | Same builder L492–L539 | `seed_start_date + germination_days <= target_date`, not complete | `PlantingEvent.is_complete` | **No upper-bound** | Same as #7. |
| 9 | `frostRisk` | `_build_frost_risk` L544–L585 | Weather forecast low ≤ 33°F in next 24h | Recomputed each request from live forecast | **N/A — self-expires** as forecast changes. | N/A. |
| 10 | `rainAlert` | `_build_rain_alert` L588–L623 | Forecast sum ≥ 0.5" in next 48h | Recomputed each request | **N/A — self-expires**. | N/A. |
| 11 | `compostOverdue` | `_build_compost_overdue` L626–L664 | `days_since_last_turn >= 7` AND pile status != `'ready'` | User logs a turn (updates `last_turned`) | **Cadence-based, not date-based**. Never ages out; reappears every 7 days if user doesn't turn it. | Persists indefinitely — but this is arguably correct for compost. |
| 12 | `seedLowStock` | `_build_seed_low_stock` L667–L692 | `SeedInventory.quantity < 2` | User adjusts inventory | **N/A — state-based, not time-based**. | N/A (correct behavior). |
| 13 | `seedExpiring` | `_build_seed_expiring` L695–L725 | `expiration_date` within next 30 days | Expiration passes | **Self-expires** when date passes out of window. | N/A (correct). |
| 14 | `livestockActionsDue` (egg collection) | `_build_livestock_actions` L728–L761 | No `EggProduction` row exists for any active chicken on target_date | Any egg record logged that day | **Scoped to target_date** — self-resets daily. | N/A. |

**Key observation**: rows #1–#8 are the entire stale-dashboard problem.
Rows #9–#14 are already self-limiting.

Additional client-side context the plan must preserve:

- Deep-link navigation from row click → `NeedsAttentionTarget` discriminated
  union (12 kinds, see `types.ts` L154–L166). Memory note
  "Needs Attention Deep-Link (Apr 2026)" documents that HarvestTracker
  matches by `PlantingEvent.id` and several destinations auto-switch filters
  on focus. **Any bucketing change must not alter `signalKey` format or
  target-id semantics.**
- `signalKey` prefix is used by the frontend to route "Cancel task" vs.
  "Dismiss" (L75–L92). If we introduce a new bucket, prefixes must remain
  parseable.

---

## 2. Proposed Rule Set

### 2.1 Two axes: *safe-to-age* vs *integrity-sensitive*

The finding explicitly warns against silently auto-completing anything that
"rewrites history." Map that to our signals:

| Axis | Signals | Rule |
|---|---|---|
| **Safe to age out** (reminders only — aging out does not alter any record) | `indoorStartsDue`, `transplantsDue` (when user never acted), `directSeedDue`, `germinationCheck`, `indoorGerminationCheck` | Age out of the primary feed after a type-specific threshold; optionally surface in a lower-priority `Missed` bucket. Never flip any DB field. |
| **Integrity-sensitive** (the record itself carries real-world truth) | `harvestReady` | **Do not age out.** Keep visible indefinitely — or demote visually after N days but never hide. Auto-completing a harvest would fabricate yield data. |
| **State-based (no aging needed)** | `compostOverdue`, `seedLowStock`, `seedExpiring`, `livestockActionsDue`, `frostRisk`, `rainAlert` | Unchanged. They already self-limit. |

### 2.2 Per-type proposals (rows #1–#8)

Thresholds below are starting points tied to real-world urgency. All are
open for product decision — see §4.

| Type | Age-out rule | After aging out, where? | Safe to auto-age? | Reasoning |
|---|---|---|---|---|
| `harvestReady` | **Never hide.** Optionally demote tone to `gray` after 14 days past due. | Stays in primary feed at lower visual priority. | N/A (no history rewrite — we're not marking anything harvested). | Harvests are inventory events. A tomato that was ready on Feb 1 and never logged is still the user's real data. Silent removal would mean the user can't later say "oh right, I harvested those, let me back-date." |
| `indoorStartsDue` (PE) | Age out after **14 days** past `seed_start_date`. | Drop from primary feed; optionally into a collapsed `Missed` bucket (see §2.3). Does NOT mark the PlantingEvent complete or cancelled. | **Yes** — this is only a reminder; the PlantingEvent still exists with `seed_start_date` in the past, and the user can still act on it from Grow → Indoor Starts. | 14 days ≈ the window where starting a crop indoors is still useful vs. the target transplant date. Past two weeks the start is usually moot; the downstream transplant-due row (if any) will still surface. |
| `indoorStartsDue` (ISS standalone) | Same: **14 days** past `start_date`. | Same — the ISS row stays in Grow → Indoor Starts, just not on Today. | Yes. ISS.status remains `'planned'`; no mutation. | Same reasoning. |
| `transplantsDue` | Age out after **10 days** past `transplant_date`. | `Missed` bucket. No mutation. | Yes. | Seedlings become rootbound quickly; past ~10 days the transplant is realistically abandoned. The user can still complete it manually from Calendar / Designer. |
| `directSeedDue` | Age out after **14 days** past `direct_seed_date`. | `Missed` bucket. No mutation. | Yes. | Viable planting windows for most crops are ~2 weeks; a stale sowing reminder is noise. |
| `germinationCheck` (outdoor) | Age out when **target_date > direct_seed_date + germination_days + 14**. | Drop silently (no `Missed` bucket). | Yes. | If germination hasn't been logged 2 weeks past expected, either it germinated and the user didn't log, or it failed. Either way the reminder has no real-world action left. |
| `indoorGerminationCheck` (ISS + PE) | Same: **14 days** past expected germ. Additionally, drop if `transplant_date` is now in the past (existing transplant-eclipse guard already covers the PE path — extend to ISS path for consistency). | Drop silently. | Yes. | Same as outdoor germination. |

### 2.3 The `Missed` bucket

Proposal: introduce a single collapsed section below the primary feed,
default collapsed, labeled **"Missed (N)"** with a disclosure arrow.
Contains aged-out items from `indoorStartsDue`, `transplantsDue`,
`directSeedDue` (but **not** germination checks or harvests).

Rules:

- Rendered with `opacity-60` and `gray` tone, no `Skip 3d` button (already
  past the point where snoozing matters), `Cancel task` and `Dismiss` still
  available.
- Clicking a Missed row still deep-links the same way as the live row —
  same `NeedsAttentionTarget`, same `signalKey`. No frontend type changes.
- Hard cap at **SIGNAL_CAP** items per type (same as today) to avoid
  unbounded growth on long-unmaintained plans.
- Exists only on the dashboard; the Calendar / Grow pages are unaffected.

Alternative: drop silently with no `Missed` bucket and rely on the existing
Calendar / Grow pages as the record of overdue items. Cheaper to build,
but users who currently use the dashboard as their to-do list lose
visibility. **This is the #1 open product question.**

### 2.4 Where the threshold lives

Threshold constants live in `dashboard_service.py` as module-level
constants so they can be changed in one place and are visible in code
review:

```
STALE_INDOOR_START_DAYS = 14
STALE_TRANSPLANT_DAYS = 10
STALE_DIRECT_SEED_DAYS = 14
STALE_GERMINATION_CHECK_DAYS = 14
HARVEST_DEMOTION_DAYS = 14   # visual only; never drops the row
```

No per-user config in v1. If product wants per-user later, it becomes a
`Property` or new `UserPreference` field.

---

## 3. Implementation Scope

Three slices. Specialist ownership and sync notes per the PM routing rules.

### Slice A — Backend rule engine (`backend-debugger`)

**Files**:

- `backend/services/dashboard_service.py` — add staleness filters and a new
  `missed` block in the return payload of `build_dashboard_today()`.
- `backend/tests/test_dashboard_service.py` (or wherever existing dashboard
  tests live — needs verification) — test matrix per type × (fresh / stale /
  just-past-threshold).

**Changes**:

1. Add per-builder upper-bound filters using the constants from §2.4. Each
   builder returns two lists: `active` and (for the three bucketable types)
   `missed`. Germination builders return only `active`.
2. Extend `build_dashboard_today()` response to include:
   ```
   signals: { ... unchanged keys ... },
   missed:  { indoorStartsDue: [...], transplantsDue: [...], directSeedDue: [...] }
   ```
   **Important:** do NOT move items out of `signals.*` into `missed.*` —
   instead `signals.*` only contains active items after the staleness filter,
   and `missed.*` contains aged-out ones. This keeps existing frontend code
   that iterates `signals.indoorStartsDue` still working (just with fewer
   rows). New frontend code reads `missed.*` for the Missed bucket.
3. Harvest demotion: add `isStale: boolean` to `HarvestReadyRow` payload —
   true when `daysPastExpected > HARVEST_DEMOTION_DAYS`. Frontend uses this
   to pick tone. Row stays in `signals.harvestReady`.
4. Respect existing `DashboardSnooze` — filter after staleness bucketing so
   snoozed items disappear from both buckets.

**Constraints**:

- Nullable-field discipline: `seed_start_date`, `transplant_date`,
  `direct_seed_date` all already guarded via `_as_date()`. Maintain that.
- Snake_case internally, camelCase in response (already the pattern).
- No schema change needed — all staleness is derived at query time.

### Slice B — Frontend types + rendering (`frontend-debugger`)

**Files**:

- `frontend/src/components/Dashboard/types.ts` — add `DashboardMissed`
  interface mirroring the subset of `DashboardSignals` that's bucketable;
  add `missed: DashboardMissed` to `DashboardToday`. Add optional
  `isStale?: boolean` to `HarvestReadyRow`.
- `frontend/src/components/Dashboard/NeedsAttentionPanel.tsx` —
  - `buildRows()` still composes the primary feed from `signals.*` (no
    change except harvest row picking tone from `isStale`).
  - Add a second `buildMissedRows()` that builds gray-toned rows from
    `data.missed.*`.
  - Render a collapsible `<details>`-style section below the primary feed
    when `missedRows.length > 0`. Default collapsed. Label: "Missed (N)".
  - Missed rows reuse all existing row functions (`indoorStartRow`,
    `transplantRow`, `directSeedRow`) but pass an `isMissed` flag that
    forces `tone: 'gray'` and hides the `Skip 3d` chip (keep `Cancel task`
    / `Dismiss`).
- Existing tests under `frontend/src/components/Dashboard/__tests__/` (if
  any) — update fixtures; add new tests for the Missed bucket.

**Constraints**:

- **Deep-link invariants**: `signalKey` format is unchanged. `onClick`
  handlers unchanged. `NeedsAttentionTarget` union unchanged — Missed rows
  navigate the same way. Memory note for deep-link continues to hold.
- `getCancellableAction()` prefix logic untouched.
- No changes to snooze/cancel/dismiss endpoints.

### Slice C — Tests and verification (`test-engineer` after A + B)

- Backend: extend dashboard service tests with a fixture user who has
  `seed_start_date = today - 30d`. Assert it appears in `missed.indoorStartsDue`
  and NOT in `signals.indoorStartsDue`.
- Frontend: unit test the Missed section renders under `missed` payload and
  stays hidden when empty; test that clicking a Missed row calls
  `onNavigate` with the correct target kind and id.
- Manual / E2E: load dashboard with stale seed-start → primary feed no
  longer shows it → expand Missed → row appears → click → deep-link to
  Indoor Starts still focuses correctly.

### Synchronization risks

- **None of the paired-file tables in CLAUDE.md apply** — no space calc, no
  plant DB, no spacing table change. But the backend-frontend API contract
  is synchronized: adding `missed` and `isStale` requires matching changes
  on both sides in a single PR (standard snake→camel discipline).
- Run `code-review` agent after both slices are done; verify no `signalKey`
  prefix collision with existing cancel routing.

---

## 4. Open Product Questions (need user decision before coding)

1. **Do we want a `Missed` bucket at all, or should stale items drop
   silently?**
   - *Bucket*: keeps dashboard as user's to-do list; slightly more UI complexity.
   - *Silent drop*: cleanest dashboard; users must go to Calendar / Grow pages to see overdue work. The Calendar view already shows past dates.
2. **Exact thresholds.** §2.2 proposes 14d / 10d / 14d / 14d / 14d. Are
   those right? Specifically:
   - Indoor starts: 14 days feels right for most crops. Slow crops
     (celery, leeks, pepper) may warrant 21. Do we keep uniform or
     plant-type-aware? (Uniform is simpler; plant-aware is more accurate
     but adds a per-plant lookup.)
   - Transplants: is 10 days too short? Users who skip a weekend may hit
     it immediately.
   - Harvest demotion threshold: 14 days the right visual-demotion window?
3. **Is `Missed` visible on the dashboard at all, or surfaced only on
   a separate "Overdue" page linked from elsewhere?**
4. **Should `Missed` items still be snoozable?** Proposal: no `Skip 3d`
   (pointless once aged out); keep `Cancel task` and `Dismiss forever`.
   Confirm.
5. **Should we also expire indefinitely-snoozed items or snoozed-past-a-year
   items from the DB to prevent `DashboardSnooze` table growth?** Out of
   scope for this task but worth noting; skipping for v1.
6. **Harvest policy confirmation**: the finding says "harvest records"
   should not be silently auto-completed — agreed. Do we want *any* visual
   treatment after, say, 30 days past due (e.g., warning banner "you have
   12 un-logged harvests older than 30 days, review them in Calendar")?
   Separate feature; deferring.

---

## 5. Risks and Regressions to Watch

- **Deep-link memory invariants**: the Apr 2026 deep-link work assumes
  every row emits a stable `signalKey` and navigates via
  `NeedsAttentionTarget`. Both are preserved under this plan. HarvestTracker
  still matches by `PlantingEvent.id` — unchanged. No changes to the 12
  target kinds.
- **`getCancellableAction()` prefix routing** (NeedsAttentionPanel L75–L92):
  Missed rows keep their existing prefixes. `indoor-iss-`, `indoor-germ-`,
  `indoor-`, `direct-seed-` parsing is unaffected. Verify in code review
  that new payload structure doesn't leak a stale `signalKey` under a new
  prefix.
- **Snooze interaction**: a user who *today* dismisses a row, then it ages
  past the stale threshold, should not resurface. Current
  `DashboardSnooze` filtering in `build_dashboard_today()` L789–L803
  already runs on both `signals.*`; extend it to `missed.*` so dismissals
  persist across the move.
- **`is_complete` semantics** (CLAUDE.md §High-Risk Areas / Completion State):
  This plan does **not** touch `PlantingEvent.completed`,
  `PlantingEvent.quantity_completed`, or `PlantedItem.status`. Staleness is
  purely a display-layer filter in `dashboard_service.py`. That preserves
  the Feb 2026 normalization.
- **Simulation clock / time travel**: `resolve_target_date()` feeds
  `target_date` into every builder (L81). Staleness uses
  `target_date - trigger_date`, so simulation-clock users get correct
  behavior automatically. Add one E2E test that moves the sim clock and
  verifies freshly-aged-out items appear in Missed.
- **Test coverage drift**: any existing dashboard tests asserting that a
  stale fixture is still on the panel will break. That's correct — but
  verify the test failures before shipping to confirm no semantic
  regression elsewhere.
- **Performance**: adding staleness filters only narrows existing result
  sets; `SIGNAL_CAP * 3` over-fetch guards remain sufficient. No new N+1.
- **Standalone IndoorSeedStart status advancement**: if aging an ISS row
  out of the feed, we explicitly do **not** flip `status` away from
  `'planned'`. Matches the finding's rule — we only hide, never mutate.

---

## 6. Sequencing

1. User decides §4 open questions (especially #1 — bucket vs silent drop).
2. `backend-debugger` implements Slice A with a corresponding test file.
3. `frontend-debugger` implements Slice B against the new payload.
4. `test-engineer` adds frontend + backend staleness tests and an E2E
   simulation-clock walk test.
5. `code-review` pass, focusing on signalKey prefix stability and
   `NeedsAttentionTarget` invariance.
6. `documentation-recorder` records the new constants, the `missed`
   payload key, and the harvest `isStale` field; update CLAUDE.md §12
   Uncertainty Notices if harvest demotion behavior warrants it.

---

*Prepared 2026-04-24 in response to the P1 finding. Awaiting product
decisions on §4 before implementation.*
