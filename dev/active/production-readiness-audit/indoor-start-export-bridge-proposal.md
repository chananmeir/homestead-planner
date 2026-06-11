# Indoor-Start Export Bridge — Improvement Proposal

**Date:** 2026-06-11
**Context:** Deep-dive Appendix A item 3 ("Plan export does not create indoor trays").
**Prior decision:** `calendar-indoor-start-consistency-decision.md` (Apr 2026) — A1 shipped
(calendar pills, plan-only banner, Start-tracking action); A2 (auto-create on export)
explicitly deferred as "a possible later product decision." This proposal respects that
decision: Tier 1 below does NOT change export semantics; Tier 2 is the A2 revisit, gated on
evidence and an explicit product choice.

## Current state (verified 2026-06-11)

Nothing is silently lost today — three safety nets already exist:

1. **Calendar pills** distinguish Tracked vs Plan-only on every surface (DayDetailModal,
   EventMarker, GroupedEventsModal, ListView), with inline "Start tracking."
2. **Indoor Starts banner** (`GET /api/planting-events/needs-indoor-starts`) lists plan-only
   seedings with per-row Start-tracking and bulk import (`ImportFromGardenModal.tsx`).
3. **Dashboard `indoorStartsDue`** fires when `seed_start_date <= today` even with no linked
   start, so the task surfaces at the right moment regardless.

The real failure mode is therefore **friction, not data loss**: every bridge is *passive* —
the user must visit Indoor Starts or react to dashboard nags. If ignored, seedings age into
the missed bucket and germination tracking never happens.

## Tier 0 — Measure before changing anything (~zero cost)

The appendix's own trigger condition is "if that banner gets ignored in practice." Check it:

- Query this season's transplant-type events with `seed_start_date`: how many have a linked
  `IndoorSeedStart` vs remained plan-only? How many landed in the missed bucket?
- Single-household app — this is one SQL query plus asking the owner whether they actually
  use the banner. If reconciliation is happening, **stop here**.

## Tier 1 (recommended) — Post-export prompt: move the bridge to the moment of intent

Don't change what export creates; change *when the user is asked*. At export time the user
is already engaged with exactly these crops — that's the moment to offer tracking, not days
later via a banner they may never visit.

- Backend: `export_to_calendar` response gains an additive field, e.g.
  `indoorStartCandidates` (count + event ids of created/updated events that have a
  `seed_start_date` and no linked start). Cheap — the export loop already touches each event.
- Frontend: the export success path (`GardenPlanner.tsx::handleExportToCalendar`, ~line
  1310) currently shows "Successfully exported N events." Extend it: when candidates > 0,
  show "M of these are transplant crops — track indoor starts now?" with one-click bulk
  action reusing the existing contract (`POST /api/indoor-seed-starts/from-planting-event`
  per event, same loop ImportFromGardenModal uses). Decline = no-op; banner remains the
  fallback.
- No schema change, no export-semantics change, frontend-first + one additive response
  field. The A1 decision stands untouched.

## Tier 2 — Opt-in auto-create (the actual A2 revisit; only if the owner wants it)

If Tier 0 shows the banner *and* the Tier 1 prompt still get ignored, or the owner says
"export should just track by default":

- Checkbox on the export action ("Also create indoor start tracking"), remembered as a
  Settings key (Settings now has a consumer precedent — the calendar feed token).
- Backend: factor the creation logic out of the `from-planting-event` endpoint into a
  service function; export calls it per qualifying event. **Idempotency:** skip events that
  already have a linked start, so re-export is safe.
- **Provenance requirement:** bulk-deleting a plan's events should cascade-cancel only
  auto-created, untouched starts (status still `planned`, no germination data). That needs
  a provenance marker (e.g., `source` column on IndoorSeedStart) → Alembic migration.
  ⚠️ The two-head migration divergence (`a7f3c9d21e04` vs `f2bb35af831e`) must be resolved
  before adding any new migration.
- Succession series: N events → N trays is correct (each succession is its own sowing).
- Past-due dates: reuse `overdueMode='reschedule_today'` per the A1 convention.

## Rejected: just-in-time auto-create (tray appears when seed date approaches)

No scheduler exists in this app, and the dashboard build is display-layer-only by explicit
principle — lazily creating rows during `GET /api/dashboard/today` would violate it.

## Recommendation

Tier 0 now, Tier 1 if evidence (or the owner) says the banner isn't enough. Tier 1
eliminates the "banner gets ignored" risk for the export flow while preserving the
deliberate separation between the schedule layer and the tracking layer. Hold Tier 2 until
it's an explicit product choice.
