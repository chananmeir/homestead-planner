# Tier 2 Shipped — Opt-In Auto-Create of Indoor Starts at Export

**Date:** 2026-06-11 · **Proposal:** `indoor-start-export-bridge-proposal.md` ·
**Tier 1:** `indoor-start-export-bridge-tier1-report.md`

## What was built

A **"Track indoor starts" checkbox** next to the Export to Calendar button (remembered in
localStorage). When checked, the export request carries `createIndoorStarts: true` and the
backend auto-creates one linked IndoorSeedStart per exported transplant-crop event:

- **Idempotent**: events that already have an active linked tray are counted as
  `alreadyTracked`, never duplicated — safe on re-export.
- **Direct-seed crops** (`weeksIndoors == 0`) are `notApplicable` — no tray.
- **Past-due starts** follow the A1 `reschedule_today` convention: clamped to today,
  germination/transplant dates slide forward, the linked event stays coherent. Counted as
  `rescheduled` and surfaced in the success toast.
- **On-time rows do NOT touch the event's dates** — the export's seed-override-aware
  `expected_harvest_date` is preserved (see "sync_linked_event" below).
- **Provenance**: auto-created rows carry `source='export'` (new column); manual rows stay
  NULL. The export response gains `indoorStarts: {created, rescheduled, alreadyTracked,
  notApplicable, failed}`.
- Seed-packet linkage (`seed_inventory_id`) carries over from the plan item, so
  seeds-available accounting reflects auto-created trays.
- When the checkbox is on, the Tier 1 post-export prompt is suppressed (auto-create just
  did its job).

## Architecture: one canonical creation core

New `backend/services/indoor_start_service.py`:

- `create_indoor_start(...)` — the creation core, extracted verbatim from the
  `from-planting-event` endpoint (overdue handling, date math, germination prediction,
  seed-quantity buffer, event sync). Flushes, never commits — callers own the transaction.
- `create_indoor_start_for_event(...)` — export wrapper (event-derived params,
  `reschedule_today`, `source='export'`, already-tracked check).
- `predict_germination_days` / `calculate_seed_quantity` — moved here from utilities_bp
  (which now imports them; all 7 call sites unchanged).

`utilities_bp.py::create_indoor_start_from_planting_event` keeps all HTTP
validation/serialization and delegates creation to the core — the "single safe creation
path" contract now lives in the service, shared by both callers.

**`sync_linked_event` parameter**: the endpoint passes `'always'` (existing behavior: the
linked event's seed_start/transplant/expected_harvest dates are rewritten, harvest with
plant-default DTM). Export passes `'if_rescheduled'` — discovered during implementation
that `'always'` would clobber the export's seed-override-aware harvest date on every
on-time row.

## Schema

`ff46179d637a` adds `indoor_seed_start.source` (String(20), nullable). Rollback tested
(`downgrade a7f3c9d21e04` → `upgrade`). **Autogenerate gotcha** documented in
MIGRATIONS.md: alembic proposes dropping `variety_maturity_model` + harvest snapshot
columns (no ORM models by design) — the generated file was hand-trimmed.

## Deviations from the proposal

1. **No bulk-delete cascade work**: `_delete_planting_events` already hard-deletes linked
   IndoorSeedStarts when plan events are bulk-deleted — auto-created trays can't be
   orphaned. The `source` column is kept for observability (e.g., later measuring whether
   auto-created trays get seeded).
2. **Preference stored in localStorage**, not the Settings model — zero backend surface
   for a single-device localhost app. Move to Settings if multi-device ever matters.

## Files changed

| File | Change |
|---|---|
| `backend/models.py` | `IndoorSeedStart.source` column + to_dict |
| `backend/migrations/versions/ff46179d637a_*.py` | add column (hand-trimmed) |
| `backend/services/indoor_start_service.py` | NEW — creation core + export wrapper + moved helpers |
| `backend/services/garden_planner_service.py` | `create_indoor_starts` param; touched-event collection at all 6 create/update sites (trellis/bed/legacy × create/update); post-commit auto-create loop (per-row commit so one failure can't roll back earlier successes) |
| `backend/blueprints/utilities_bp.py` | endpoint delegates creation core to service; helpers imported |
| `backend/blueprints/garden_planner_bp.py` | passes `createIndoorStarts` through |
| `backend/tests/test_export_indoor_starts.py` | NEW — 9 tests (below) |
| `backend/MIGRATIONS.md` | migration documented |
| `frontend/src/components/GardenPlanner.tsx` | checkbox + localStorage persistence; flag in POST; toast with created/rescheduled counts; Tier 1 prompt suppressed when on |
| `frontend/src/components/IndoorSeedStarts.tsx` | `source` added to the IndoorSeedStart type |

## Verification

- New: `test_export_indoor_starts.py` — 9/9 pass (default off; created+linked+provenance;
  direct-seed excluded; succession N trays; idempotent re-export; bed-allocated
  destination beds; past-due reschedule; harvest-date preservation; seed-packet linkage).
- Refactor regression: `test_succession_export.py` 36/36; all 122 indoor-related backend
  tests pass.
- Full backend: 1491 passed (only the 5 documented live-API geocoding tests fail offline).
- Frontend: 34 suites / 307 tests pass; production build compiles clean.
- Migration rollback/upgrade cycle tested against the real database.
