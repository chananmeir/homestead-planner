# Indoor Start Auto-Create Missing Planned Bed — Fix Report (2026-04-27)

Resolves the finding at `indoor-start-auto-create-missing-planned-bed-finding.md`. Auto-created `IndoorSeedStart` records now record the placement bed in `destination_bed_ids`, so the Indoor Starts card renders **Planned bed: \<bed name\>** instead of "not assigned".

Sequel to `indoor-start-current-location-set-to-bed-fix-report.md` (same day): with `Current location` correctly defaulting to `'windowsill'`, the `Planned bed` slot was newly visible — and exposed that the destination bed was being lost on auto-create.

---

## Root cause

`backend/blueprints/gardens_bp.py::_auto_create_indoor_seed_start` constructs an `IndoorSeedStart` and links it to the freshly-created `PlantingEvent` via `seed_start.planting_event_id`. It did not write `destination_bed_ids`.

`IndoorSeedStart.get_current_garden_plan_count()` (`models.py` ~line 1105) resolves destination beds in this priority order:

1. **manual `destination_bed_ids` JSON** — "set = user override"
2. matching `PlantingEvent` records (same plant/variety/transplant_date)
3. `GardenPlanItem.bed_assignments` fallback

Tier 2 **intentionally excludes the self-linked event** (`PlantingEvent.id != self.planting_event_id`) — documented as: *"self-linked timeline PlantingEvent — it's a placeholder, not a garden plan entry, and would skew the count"*.

In auto-create, the only event referencing the seed start IS the self-linked one. Tier 2 returns nothing. Tier 3 is also empty when placement bypasses the season planner. Result: `destinationBeds = []` → frontend renders "not assigned".

Tier 1 was the right slot to populate — the user's explicit pick during placement IS a manual override.

---

## Fix

| File:line | Change |
|---|---|
| `backend/blueprints/gardens_bp.py` (`_auto_create_indoor_seed_start`, ~line 211) | Added `destination_bed_ids=json.dumps([planting_event.garden_bed_id]) if planting_event.garden_bed_id else None` to the `IndoorSeedStart(...)` constructor, with a comment block explaining the self-link-exclusion invariant. |

`import json` was already present in `gardens_bp.py`. No new imports.

### Both call sites work

`_auto_create_indoor_seed_start` is called from two places:

1. `gardens_bp.py:577` — single placement (one event, one bed)
2. `gardens_bp.py:901` — batch placement, grouped by `transplant_date`

In the batch path all events in a single placement request share the same `garden_bed_id` (the request body has a single top-level `gardenBedId` — see line 916). So `representative_event.garden_bed_id` correctly represents the whole group.

### Not changed

- The resolution chain in `models.py::get_current_garden_plan_count` — the self-link exclusion is intentional and is now correctly bypassed by the new tier-1 write.
- `_link_existing_indoor_seed_start` — when reusing a pre-existing IndoorSeedStart, we trust whatever `destination_bed_ids` the user set (or didn't set) on it.
- The frontend — already renders `destinationBedDetails` / `destinationBeds` from the API; no sync needed.

---

## Regression test

Added `TestPlacementDoesNotDuplicateIndoorStart::test_auto_created_seed_start_captures_placement_bed` to `backend/tests/test_placement_indoor_start_dedup.py`.

Asserts that posting a transplant placement (`tomato-1`, `weeksIndoors=6`) with no pre-existing IndoorSeedStart:

- Creates exactly one `IndoorSeedStart`
- `destination_bed_ids` parses to `[bed_a.id]`
- `to_dict()` returns `destinationBedIds=[bed_a.id]`, `hasManualDestination=True`, non-empty `destinationBeds`, and a `destinationBedDetails` entry with the bed id and name

---

## Test results

- **Targeted** (`pytest tests/test_placement_explicit_seed_start_link.py tests/test_placement_indoor_start_dedup.py -v`): **21 / 21 pass** (was 20 — the new regression test brought it to 21)
- **Full backend** (`pytest`): **1365 pass, 1 xfail, 2 fail** in ~107s
  - The 2 failures are pre-existing in `test_geocoding_service.py` (Washington DC / Chicago network lookups) — known and unrelated.

---

## Files changed

- `backend/blueprints/gardens_bp.py` (+9 / −0 in `_auto_create_indoor_seed_start`, including the explanatory comment)
- `backend/tests/test_placement_indoor_start_dedup.py` (new regression test + `import json`)

---

## Backfill recommendation (NOT applied)

Legacy `IndoorSeedStart` rows created before this fix still have `destination_bed_ids = NULL` and will continue to display **Planned bed: not assigned** until they are transplanted.

A safe one-shot backfill would be:

> For every `IndoorSeedStart` where `destination_bed_ids IS NULL` AND `planting_event_id IS NOT NULL` AND the linked `PlantingEvent.garden_bed_id IS NOT NULL`, set `destination_bed_ids = json.dumps([linked_event.garden_bed_id])`.

It's idempotent, respects existing user overrides, and skips rows where the linked event has no bed. Hold off until requested.

---

## Out of scope

- The "Started:" label on future planned starts mentioned at the bottom of both findings remains a separate follow-up.
- Front-end rendering paths weren't touched — the existing `destinationBedDetails` resolution does the right thing as soon as the backend payload is correct.
