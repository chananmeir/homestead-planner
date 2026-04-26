# Dashboard Missing Transplant-Due — Investigation (2026-04-25)

Investigation for `dashboard-missing-transplant-due-finding.md`.
This is a different bug family from the row-splitting series — a
stale guard proxy.

---

## TL;DR

Commit `b8f3cb8` (Apr 15, 2026, "Hide Transplant due dashboard rows
when indoor seed-start was missed") added a suppression guard to
`_build_transplants_due` that uses the wrong proxy:

```python
# dashboard_service.py:395-397
seed_start = _as_date(e.seed_start_date)
if seed_start is not None and seed_start <= target_date:
    continue   # "seed-start was missed" — but this fires for SUCCESSFUL starts too
```

The intent was reasonable: don't show a "Transplant due" row when the
seed-start phase was never actually performed (there's nothing to
transplant). But the proxy `is_complete=False AND seed_start_date <=
today` is wrong because **the Indoor Starts PUT endpoint advances
`IndoorSeedStart.status` (`planned → seeded → germinating → growing →
hardening`) without ever setting `linked_event.completed = True`**.
So every PlantingEvent created via the Indoor Starts flow remains
`is_complete=False` from seeding through transplant-due, and the
guard fires unconditionally.

The Indoor Starts page doesn't see this because it reads
`IndoorSeedStart.expected_transplant_date` directly and never
consults the linked PlantingEvent's completion state.

**Fix lives in the guard's proxy, not in the model.** Layer 1 (commit
`35cb6fe`) and the row-grouping change (commit `9feae3b`) are
unrelated — the bug predates both.

---

## Evidence

### Two surfaces, two queries

**Dashboard `_build_transplants_due`** —
`backend/services/dashboard_service.py:353-437`:

SQL filter (lines 366-373):
```python
PlantingEvent.user_id == user_id,
PlantingEvent.event_type == 'planting',
PlantingEvent.transplant_date.isnot(None),
PlantingEvent.transplant_date <= end_of_day,
PlantingEvent.cancelled_at.is_(None),
```

Then in-Python (lines 387-403):
```python
for e in events:
    if e.is_complete:
        continue
    # The buggy guard:
    seed_start = _as_date(e.seed_start_date)
    if seed_start is not None and seed_start <= target_date:
        continue                                 # ← over-fires
    transplant = _as_date(e.transplant_date)
    if transplant is None:
        continue
    ...
```

**Indoor Starts page** —
`backend/blueprints/utilities_bp.py:717-862` returns rows directly
from `IndoorSeedStart` with no PlantingEvent dependency. The
"ready to transplant" indicator is **purely frontend-computed** at
`frontend/src/components/IndoorSeedStarts.tsx:212-218, 568, 690-698`:

```tsx
const daysToTransplant = getDaysUntil(start.expectedTransplantDate);
{daysToTransplant !== null && start.status !== 'transplanted' && (
  <span>{daysToTransplant > 0 ? `${daysToTransplant} days`
        : daysToTransplant === 0 ? 'Today!'
        : `${Math.abs(daysToTransplant)} days overdue`}</span>
)}
```

Reads `start.expectedTransplantDate` and `start.status` only —
nothing from the linked PlantingEvent.

### The model asymmetry the guard didn't account for

`backend/blueprints/utilities_bp.py:961-962` — the Indoor Starts PUT
handler advances `IndoorSeedStart.status` through
`planned → seeded → germinating → growing → hardening` but
**never propagates completion to the linked PlantingEvent**. Search
for `linked_event.completed` in this handler returns zero hits.

So the linked `PlantingEvent.is_complete` stays False for the entire
ISS lifecycle until the explicit `/transplant` endpoint is hit.

### Reproducible scenario (from the finding's sim date 2024-03-24)

User flow: open Indoor Starts → "Start Seeds" for beets on `2024-02-18`
(≈5 weeks ago, beets `weeksIndoors=4`). POST
`/api/indoor-seed-starts` writes:
- `IndoorSeedStart`: `start_date=2024-02-18`,
  `expected_transplant_date=2024-03-17`, `status='planned'`,
  `planting_event_id=<NEW>`
- Linked `PlantingEvent`: `seed_start_date=2024-02-18`,
  `transplant_date=2024-03-17`, `expected_harvest_date≈2024-05-16`,
  `completed=False`, `quantity_completed=NULL`

User PUTs `status='seeded' → 'germinating' → 'growing'` over the
following weeks. None of these branches touch
`linked_event.completed` or `linked_event.quantity_completed`.

**At sim date 2024-03-24:**
- Indoor Starts page: `daysToTransplant = (2024-03-17 − 2024-03-24) =
  −7` → renders **"7 days overdue"** in red.
- Dashboard `_build_transplants_due`:
  - Outer SQL filter passes (transplant_date ≤ end_of_day).
  - `is_complete` check passes (False, not skipped).
  - **Guard at line 396 fires:** `seed_start=2024-02-18 ≤
    target_date=2024-03-24` → `continue` → row silently dropped.

### Why the contrast case works

On sim date 2024-04-14, the user saw `direct sowing of beans`. Beans
is direct-seed (`direct_seed_date` set, `seed_start_date=NULL`),
routed through `_build_direct_seed_due` — which has **no equivalent
guard**. So that signal correctly surfaces. The bug is specific to
indoor-started crops post-seed-start-phase.

### Pre-Layer-1 / pre-grouping bug

Originating commit `b8f3cb8` is from Apr 15, 2026 — well before
Layer 1 (`35cb6fe`) and the dashboard grouping (`9feae3b`). Reverting
either does not fix this. The grouping change correctly preserves
the same filter set; it just collapses qualifying rows.

### Existing tests pin the buggy behavior

`backend/tests/test_dashboard_endpoint.py::TestTransplantsDueMissedSeedStartGuard`
has 4 tests (added by `b8f3cb8`):
- `test_guard_fires_when_seed_start_passed_and_event_incomplete`
- `test_direct_seed_path_unaffected`
- `test_complete_events_still_skipped`
- `test_future_seed_start_passes_guard`

These tests use raw `PlantingEvent` rows without a linked
`IndoorSeedStart`, so they don't exercise the actual ISS-driven
flow. The "guard fires" test is correct *for the no-ISS case* but
mis-applies to the ISS-driven case. Tests will need expansion when
the fix lands.

---

## Root cause analysis (the guard's logic flaw)

The guard's intent: **"If the user planned a seed-start that never
happened, don't show a transplant-due row."** That's correct.

The guard's proxy: `PlantingEvent.is_complete == False AND
seed_start_date <= today`. This proxy assumes "if the seed-start was
performed, something would mark the PlantingEvent complete". **No
such marker exists in the data flow.**

The actual lifecycle truth lives on `IndoorSeedStart.status`:

| ISS.status | Seed-start happened? |
|---|---|
| `planned` | NO (never started — guard correctly should fire) |
| `seeded` | YES |
| `germinating` | YES |
| `growing` | YES |
| `hardening` | YES |
| `transplanted` | YES (transplant already done — different exit condition) |

If no IndoorSeedStart is linked at all (`event.indoor_seed_start IS
NULL`), then the user must be using PlantingEvent-only workflow
(e.g., calendar export without indoor-tracking). In that case the
guard's old proxy *might* still be right — but that's a separate
question and worth confirming with a small test.

---

## Fix options

### Option 1 — Consult IndoorSeedStart.status (recommended)

Replace the proxy with a direct query of the linked IndoorSeedStart:

```python
seed_start = _as_date(e.seed_start_date)
if seed_start is not None and seed_start <= target_date:
    # Look up linked IndoorSeedStart (relationship/backref)
    iss = (
        IndoorSeedStart.query
        .filter_by(planting_event_id=e.id, user_id=user_id)
        .first()
    )
    if iss is None:
        # No ISS linked — guard's original assumption applies
        continue
    if iss.status == 'planned':
        # Seed-start was scheduled but never started
        continue
    # Else: seed-start advanced beyond planned → don't suppress
```

**Effect**:
- Indoor-started crops with `status` in
  `{seeded, germinating, growing, hardening}` → transplant-due
  signal correctly surfaces.
- Indoor-started crops with `status='planned'` (truly never started)
  → guard still fires, signal hidden.
- PE-only events with no linked ISS → guard fires per original
  behavior. Backward compatible.

**Cost**: 1 small query per qualifying event. Could batch via
`IN (event_ids)` if profiled hot — unlikely.

**Tests to update / add**:
- New test: `test_guard_does_not_fire_when_iss_status_advanced` (new
  positive case for the ISS-linked happy path).
- New test: `test_guard_fires_when_iss_status_planned` (intent
  preserved for missed seed-starts via ISS).
- Existing `test_guard_fires_when_seed_start_passed_and_event_incomplete`
  must be updated to assert it ONLY fires when no ISS is linked
  (or `iss.status == 'planned'`).

**Scope**: ~25–40 LOC backend, +3–5 tests.

### Option 2 — Fix the proxy at PUT time (data-model fix)

When Indoor Starts PUT advances `status` to `'seeded'` (or any
post-planned), set `linked_event.completed = True` for the
seed-start phase.

Problem: PlantingEvent has only ONE `completed` flag, not per-phase.
Setting it `True` after seed-start would also exclude the event from
`_build_transplants_due` and downstream logic (since `is_complete`
is the canonical completion check). This option **breaks more than
it fixes**.

Could introduce a new `seed_start_completed` boolean column, but
that's schema work for a minor display semantic.

**Not recommended.** Schema bloat, breaks existing assumptions.

### Option 3 — Remove the guard

Delete lines 390–397 entirely. This makes the dashboard show
"Transplant due" rows for events whose seed-start phase was never
performed — restoring the pre-`b8f3cb8` behavior.

The original commit message says this was the user-confusing case
that motivated `b8f3cb8`. Removing the guard re-introduces that
confusion.

**Not recommended** unless we want to revert the b8f3cb8 intent.

---

## Recommendation

**Option 1**, with these defaults:

- Use the direct ISS query (no need to add a backref relationship
  unless one already exists).
- For events with no linked ISS, preserve the guard's original
  proxy behavior (matches `b8f3cb8` tests).
- For events with linked ISS where `iss.status == 'planned'`, fire
  the guard.
- For events with linked ISS where `iss.status` is anything else,
  show the transplant-due row.

Smallest risk, most precise fix. Backward-compatible with all
existing tests except one (which needs a small assertion update).

---

## Open question for the user

This is a fix-shaped finding (clear root cause, single-file change).
The earlier row-splitting fixes followed a finding → investigation
→ decision → implement loop. Pick:

- **(a)** Implement Option 1 now (recommended — small, surgical fix
  to the guard, +3–5 regression tests).
- **(b)** Implement Option 2 (data-model fix — not recommended,
  larger blast radius).
- **(c)** Implement Option 3 (revert the guard — not recommended,
  re-introduces the original UX issue).
- **(d)** Different scope / wait.
