# Phase B #6 — Imported indoor starts backdating: policy proposal (2026-04-22)

Research output for Phase B smoke finding #6 ("Imported indoor starts are backdated"). No production code, tests, or migrations were modified — proposal only.

## Context

### Current behavior (end-to-end)

1. The user opens **Grow → Indoor Starts → Import from Garden Plan**
   (`frontend/src/components/IndoorSeedStarts/ImportFromGardenModal.tsx:209`).
2. The modal loads candidates via `GET /api/planting-events/needs-indoor-starts`
   (`frontend/src/components/IndoorSeedStarts/ImportFromGardenModal.tsx:57`), which is implemented at
   `backend/blueprints/gardens_bp.py:2333`.
   - Candidates are `PlantingEvent` rows with a `transplant_date` set, a non-null plant,
     `weeksIndoors > 0`, no existing linked `IndoorSeedStart`, and (by default)
     `transplant_date >= now` (`gardens_bp.py:2350-2358`).
   - The endpoint computes a **suggested indoor start date** as
     `transplant_date - weeks(weeksIndoors)` and classifies timing
     (`gardens_bp.py:2426-2435`):
     - `past` (red "Overdue" pill) if `suggested_start_date < today`
     - `urgent` (yellow) if `< 7` days away
     - `good` (green) otherwise
   - So the modal already *displays* overdue status — it just doesn't prevent or adjust import.
3. For each checked row, the frontend calls
   `POST /api/indoor-seed-starts/from-planting-event`
   (`ImportFromGardenModal.tsx:136`). That handler lives at
   `backend/blueprints/utilities_bp.py:1308`.
4. The handler computes dates on the fly and **creates the `IndoorSeedStart` regardless of whether
   those dates are in the past** (`utilities_bp.py:1342-1381`):
   - `indoor_start_date = transplant_date - timedelta(weeks=weeks_indoors)`
   - `expected_germination_date = indoor_start_date + timedelta(days=germination_days)`
   - `expected_transplant_date = indoor_start_date + timedelta(weeks=weeks_indoors)` (tautology — this is
     effectively the same as the input `transplant_date`)
   - `is_past_due = indoor_start_date.date() < get_utc_now().date()` — simulation-aware via
     `simulation_clock.get_utc_now()` (`backend/simulation_clock.py:53`)
   - If past-due, the handler attaches a `warning` string to the JSON response (`utilities_bp.py:1346-1349`,
     `1416-1417`) but **writes the past start_date to the database anyway**.
5. The frontend only `console.warn`s that warning string (`ImportFromGardenModal.tsx:142-144`) — no UI
   surface, no dialog, no toast.
6. Downstream effect on dashboard: any `IndoorSeedStart` with `status='planned'` and
   `start_date <= end_of_today` is surfaced in the Needs Attention "seeding signals" panel
   (`backend/services/dashboard_service.py:210-222`). A just-imported, backdated start therefore lands
   on the dashboard as already-actionable the moment it is created, with no indication that the user
   *just* created it overdue.

### Why backdating happens

The root cause is a model mismatch: `PlantingEvent.transplant_date` is anchored to a plan-level
frost-date-offset computed when the plan was built (usually months in advance), but
`weeksIndoors` for warm-season crops (tomato, pepper, eggplant, many brassicas) is 6–10 weeks.

If the user runs the import more than a couple of weeks after the plan was built, any crop with
large `weeksIndoors` whose transplant target is less than `weeksIndoors` in the future will produce a
`suggested_start_date < today`. The `needs-indoor-starts` endpoint happily includes these
(it filters on `transplant_date >= now`, not on `suggested_start_date >= now`), and the create
endpoint happily writes them.

### What the user saw in Phase B smoke

Phase B runs with a simulated clock (`backend/simulation_clock.py`). The smoke script advances the
sim clock to a date late enough in the season that several crop rows in the imported plan had
`suggested_start_date` in the past. The modal showed red "Overdue" pills, and — because the user
proceeded to click Import — the created records had past `start_date` values and immediately
appeared on the dashboard as seed-start signals. Nothing in the product flow invited the user to
reschedule.

## Policy options

### Option 1 — Clamp to today

- **Behavior**: In `create_indoor_start_from_planting_event`, if `indoor_start_date < today`, set
  `indoor_start_date = today`. Re-derive `expected_germination_date = today + germination_days`.
  `expected_transplant_date` must either (a) stay at the original `transplant_date` (creating a
  shortened indoor phase) or (b) slide forward by the same delta (moving the transplant date,
  which also implies updating `PlantingEvent.transplant_date` + `expected_harvest_date` — the
  handler already does this on line 1394-1398 when `planting_event_id` is linked).
- **Effect on date fields**:
  - `start_date`: bumped to today
  - `expected_germination_date`: bumped in lockstep
  - `expected_transplant_date`: either unchanged (shortened indoor phase, possibly unrealistic for
    plant) or shifted by the clamp delta
  - If we slide the transplant date, the linked `PlantingEvent.transplant_date` and
    `expected_harvest_date` also change — which cascades into the garden snapshot, harvest dashboard,
    and (indirectly) frost-date safety.
- **Effect on dashboard**: The new start is immediately "due today" on Needs Attention (same
  behavior as the bug today, just with a defensible date). No overdue state.
- **Effect on frost-date alignment**: **Breaks it silently**. The whole point of `weeksIndoors` is
  that transplants must happen after last-frost. If we keep the transplant_date pinned and
  compress the indoor phase, the user transplants with under-age seedlings. If we slide the
  transplant_date forward, we've silently pushed the outdoor planting later — potentially past
  the safe harvest window for the zone — without telling the user.
- **UI/UX changes needed**: Minimal. A small info tooltip in the response / modal ("Adjusted to
  today — indoor phase shortened by N days"). One response field or toast.
- **Implementation effort**: Small. ~20-line change in `utilities_bp.py:1308-1419`, plus test.
- **Risk**: Medium-high — silently rewrites user intent. The plan said "start 8 weeks before
  transplant", and we turned it into "start 3 weeks before transplant" or "start today and
  transplant whenever 8 weeks from now". Neither matches the original plan.
- **Pros**: Trivial to implement. No data model change. Import always succeeds, dashboard state
  is clean.
- **Cons**: Silently misleads the user about frost-date safety. Destroys the signal that the
  plan needs rescheduling.

### Option 2 — Prompt user to reschedule at import time

- **Behavior**: When the user clicks "Create N Indoor Starts" and any selected rows have
  `timingStatus === 'past'`, the modal opens a confirm-step sub-dialog:
  > "N of the M selected starts are already overdue. How would you like to handle them?"
  > `[Reschedule to today]` `[Import as-is (keep original date)]` `[Skip overdue]` `[Cancel]`
  Per-row choice via radio-group is a stretch goal; a single global choice covers the 80% case.
  The chosen mode is sent as an extra field (`overdueHandling: 'clamp' | 'preserve' | 'skip'`) on
  each `POST /api/indoor-seed-starts/from-planting-event` call (or as a single batch endpoint).
- **Effect on date fields**: Depends on user choice; equivalent to Option 1, 3, or 4 on a per-import
  basis.
- **Effect on dashboard**: Consistent with the user's stated intent — either a clean "due today"
  row, an overdue row the user explicitly chose to keep, or nothing.
- **Effect on frost-date alignment**: User is informed, so any frost-date compromise is
  deliberate.
- **UI/UX changes needed**: Medium. New sub-modal or extension of confirmation step. The existing
  row-level "Overdue" pill already primes the user, which helps. We already have `timingStatus`
  on each row from `needs-indoor-starts`.
- **Implementation effort**: Medium. Backend accepts a mode parameter; frontend gets a new
  dialog and per-row-or-global mode routing. ~80–120 lines combined.
- **Risk**: Low — user makes the call. Slight risk of decision fatigue if many rows are overdue
  and only global mode is offered.
- **Pros**: No data model change. No silent rewriting. Respects user intent. Addresses bug
  immediately and permanently.
- **Cons**: Extra click at import time. Doesn't help users who already imported before this fix
  (those rows are already in the DB as-is — could be addressed by a one-time "Fix overdue
  starts" banner in the Indoor Starts screen).

### Option 3 — Preserve original date, require explicit reschedule

- **Behavior**: Import proceeds with the original (past) `start_date`. A new marker signals the
  need for rescheduling — options:
  - **Schema-free**: repurpose `notes` prefix (e.g. `[NEEDS-RESCHEDULE] ...`) — fragile, string
    matching.
  - **Status value**: add `status='needs-reschedule'` to the allowed enum (migration-free since
    `status` is a `String(20)` column — `models.py:1088`). Dashboard and list UI query on it
    and render a "Reschedule" CTA. Clean fit with existing status-lifecycle code.
  - **New boolean column**: `needs_reschedule = db.Column(db.Boolean, default=False)` — cleanest
    semantically but requires an Alembic migration.
  The Indoor Starts list grows a banner: "3 starts need rescheduling" → opens a bulk
  reschedule modal with `[Set all to today]` / per-row date pickers.
- **Effect on date fields**: Untouched at import. User changes them via the reschedule flow.
- **Effect on dashboard**: Two paths:
  - If `status != 'planned'` (e.g. `'needs-reschedule'`), the Needs Attention seeding-signal
    query at `dashboard_service.py:214` excludes it by default — **but that also hides it from
    Needs Attention**, which is the wrong direction. We'd want a separate
    "Indoor starts need rescheduling" bucket on the dashboard.
  - If we use a boolean flag and keep `status='planned'`, the row still appears on Needs
    Attention with the original backdated date — same bug.
- **Effect on frost-date alignment**: Preserved fully until the user acts.
- **UI/UX changes needed**: Large. New list-level banner, new bulk-reschedule modal, new
  dashboard bucket (optional but recommended), state sync when user does reschedule.
- **Implementation effort**: Large. Backend status/flag change, dashboard service change,
  frontend list + modal + dashboard, tests across all three.
- **Risk**: Medium — more surface area; new status value must be handled everywhere status is
  read (filter dropdowns, status badges, transplant flow).
- **Pros**: Never silently drops intent. Never silently adjusts dates. Scales to
  already-imported-in-the-past rows (could backfill `needs_reschedule=True` for any rows with
  `start_date < created_at` via a one-shot data fix).
- **Cons**: Biggest implementation footprint. New status value proliferates. Pushes a two-step
  workflow (import → reschedule) onto the user.

### Option 4 — Skip overdue imports with warning

- **Behavior**: In the create endpoint, if `indoor_start_date < today`, return 409 with
  `{'error': 'skipped_overdue', 'suggestedStartDate': ..., 'transplantDate': ...}` without
  writing. Frontend aggregates skipped rows and shows a toast + inline list: "Skipped 3 overdue
  starts — extend your plan or reschedule to import them." Candidate rows remain in the modal
  (not imported, not created) and the user can manually reschedule via the planner and re-import.
  Alternatively, the modal grows a companion `[Reschedule now]` link per skipped row that jumps
  to a reschedule flow.
- **Effect on date fields**: No records created → no dates to manage.
- **Effect on dashboard**: Clean — no false-positive overdue signals from imports.
- **Effect on frost-date alignment**: Preserved (the original plan dates are untouched).
- **UI/UX changes needed**: Small-to-medium. Toast + skipped list. Optionally a
  "Jump to Planner to reschedule" deep-link.
- **Implementation effort**: Small. Early-return in handler + aggregation on the frontend.
  ~40-line change.
- **Risk**: Low-medium. User may be confused by "nothing happened" if the toast is dismissed or
  missed. If a user tries to bulk-import and 80% of rows silently skip, it looks broken.
- **Pros**: Zero risk of polluting the DB with overdue records. Simplest correct behavior.
  Well-aligned with the finding's expected behavior ("should not silently create already-overdue
  starts without rescheduling help").
- **Cons**: User loses the ability to deliberately log a started-late crop through this flow.
  Need a separate "manual create" path for "yeah I really did start these 4 days late" — which
  already exists via the standalone New Indoor Start form (confirmed: `utilities_bp.py:717-820`
  handles POST independently).

## Recommendation

**Recommended default: Option 2 (Prompt user to reschedule at import time) as the primary fix,
with Option 4 (Skip overdue with warning) as the "no action taken" default if the user dismisses
the dialog.**

### Rationale

The finding's framing — "should not silently create already-overdue starts **without
rescheduling help**" — is explicitly about giving the user the chance to decide. That rules out
Option 1 (silent clamp) as the primary behavior on its own: it hides the frost-date coupling
break and misrepresents user intent, which is exactly the class of silent
misbehavior the CLAUDE.md guidelines call out as the highest-risk bug pattern.

Option 3 is conceptually the cleanest ("preserve intent, require explicit reschedule"), but the
implementation cost is disproportionate: it touches the `IndoorSeedStart.status` enum, the
dashboard service's seed-start signal query (`dashboard_service.py:210-222`), the Indoor Starts
list UI, a new bulk-reschedule modal, and a data backfill for rows already in the DB. The
feature surface isn't big enough to justify that investment when the bug can be fixed at the
import boundary. It would also introduce an intermediate "needs-reschedule" state that several
other screens (list filters, status badges, transplant flow) would need to learn — and none of
those exist yet.

Option 4 alone is safe but too restrictive: there are legitimate cases (a user actually *did*
start their tomatoes 3 days late, and wants to log them against the existing plan) where
skipping is wrong. The existing standalone "New Indoor Start" form covers that case, but only if
the user knows to use it — a discoverability problem.

Option 2 resolves the bug without schema changes and without destroying frost-date signal, by
making the user the decider for every overdue row. The existing `needs-indoor-starts` endpoint
already surfaces `timingStatus: 'past'` per row (`gardens_bp.py:2432`), and the modal already
renders red "Overdue" pills (`ImportFromGardenModal.tsx:200`) — so the classification work is
done. The remaining work is:

1. Extend `POST /api/indoor-seed-starts/from-planting-event` to accept an
   `overdueHandling: 'clamp' | 'preserve' | 'skip'` parameter and behave accordingly
   (clamp = Option 1 math; preserve = today's behavior minus the warning string; skip =
   return 409 without writing).
2. Before the batch POST loop in `handleCreateSelected` (`ImportFromGardenModal.tsx:115`),
   detect selected rows with `timingStatus === 'past'` and open a confirm step with three
   radio options (clamp / preserve / skip) plus Cancel. Pass the chosen mode through to the
   per-row POST call. Per-row override can be a v2 addition.
3. Add one smoke-level test in `backend/tests/` that covers the three branches.

Option 2 also **composes with Option 4** as the "no default" fallback: if the user dismisses the
confirm dialog or the frontend never adds the prompt for any reason, the backend default for
`overdueHandling` when the parameter is absent should be `skip` with a warning — not the current
silent-accept. That single backend-default change covers the simulation-smoke scenario that
Phase B hit, even before the frontend prompt ships.

The one caveat the user should consciously accept: Option 2 does nothing for rows **already
imported** in a backdated state before the fix lands. If cleanup of pre-fix data matters, a
separate one-shot audit query (`SELECT * FROM indoor_seed_start WHERE start_date < created_at AND
status = 'planned'`) plus a manual review is the lightest-weight remediation; a durable
"Reschedule these" banner in the Indoor Starts list is the bigger ask that falls into Option 3
territory and is worth deferring until we see whether it's a real problem for existing users.

## Open questions for the user

1. **Default mode**: If the frontend prompt is not present (or user cancels), should the backend
   default be `skip` (proposed) or `preserve` (today's behavior)? Proposed is `skip` because
   Phase B's finding is specifically "don't silently create overdue".
2. **Per-row vs global choice**: Is a single global choice at import time acceptable for v1, or
   must the user be able to pick `clamp` for some rows and `skip` for others in the same import?
   v1-global is ~half the implementation cost.
3. **Transplant date handling under `clamp`**: If the user picks `clamp`, do we (a) pin the
   original transplant_date and shorten the indoor phase, or (b) slide transplant_date forward
   by the clamp delta (which cascades into `PlantingEvent.transplant_date` and
   `expected_harvest_date`)? Agronomic default is (b) — seedlings need their full indoor time —
   but (b) mutates the linked PlantingEvent silently. I lean toward (a) with a warning banner on
   the created IndoorSeedStart explaining the compression.
4. **Backfill**: Should we surface existing overdue-at-creation rows (created before this fix) to
   the user, or leave them alone? Leaving alone is simpler; listing them risks nagging on rows
   that are now ancient history.
5. **Scope of fix to the `needs-indoor-starts` endpoint**: Currently the endpoint only filters on
   `transplant_date >= now`, not on `suggested_start_date >= now`. Should it optionally grow a
   `hide_overdue` query param so a future "clean list" mode is cheap? Low priority; cosmetic.

## Appendix: relevant code references

- `backend/blueprints/utilities_bp.py:1308-1423` — `create_indoor_start_from_planting_event` handler;
  date math at `:1342-1349`; `is_past_due` flag at `:1346`; `warning_message` return path at
  `:1416-1417`; linked PlantingEvent update at `:1387-1398`.
- `backend/blueprints/gardens_bp.py:2333-2460` — `get_planting_events_needing_indoor_starts`
  listing endpoint; transplant-date filter at `:2350-2357`; timing-status classification at
  `:2426-2435`.
- `backend/models.py:1053-1103` — `IndoorSeedStart` schema; status column is `String(20)` with
  default `'planned'` (`:1088`); cancelled_at soft-delete (`:1103`).
- `backend/services/dashboard_service.py:202-239` — Needs Attention "seeding signals"; query
  requires `status='planned'` AND `start_date <= end_of_day`, so any backdated record with
  `status='planned'` surfaces immediately (`:214-216`).
- `backend/simulation_clock.py:53-60` — `get_utc_now()` returns simulated clock when present,
  confirming that every existing `today`-comparison in these handlers is already simulation-aware.
- `frontend/src/components/IndoorSeedStarts/ImportFromGardenModal.tsx:57` — list fetch;
  `:109-177` — `handleCreateSelected` batch loop; `:141-144` — the `warning` field currently
  goes only to `console.warn`; `:198-206` — "Overdue" / "Start Soon" / `N days` pill rendering.
- `frontend/tests/p2-indoor-transplant-journey.spec.ts` — existing e2e coverage for the
  import-from-plan happy path; any fix should extend this suite with an overdue scenario.
