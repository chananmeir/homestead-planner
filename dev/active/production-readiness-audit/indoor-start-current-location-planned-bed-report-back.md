# Indoor Start — Current Location + Planned Bed — Report-back (2026-04-27)

Chat-reply cut of two sequential fixes from one session. Both bugs surfaced on the Indoor Starts card after the recent label-clarity rename (`Location` → `Current location`, `Destination` → `Planned bed`).

Companion to:
- `indoor-start-current-location-set-to-bed-finding.md` — first finding (current-location wrongly set to bed name)
- `indoor-start-current-location-set-to-bed-fix-report.md` — full fix-pass detail (fix #1)
- `indoor-start-auto-create-missing-planned-bed-finding.md` — sequel finding (planned-bed shows "not assigned")
- `indoor-start-auto-create-missing-planned-bed-fix-report.md` — full fix-pass detail (fix #2)

Persisted per the always-write-findings-to-md rule.

---

## TL;DR

Two single-file backend fixes in `_auto_create_indoor_seed_start` (`backend/blueprints/gardens_bp.py`):

| # | Symptom on card | Root cause | Fix |
|---|---|---|---|
| 1 | `Current location: replica` (the bed name) | Helper set `location` from the destination bed's name | `location='windowsill'` |
| 2 | `Planned bed: not assigned` (after fix #1 made it visible) | Helper never wrote `destination_bed_ids`; resolution chain excludes the self-linked event from tier-2 matching | Write `destination_bed_ids = json.dumps([planting_event.garden_bed_id])` at create time |

Both fixes target the same helper: `backend/blueprints/gardens_bp.py::_auto_create_indoor_seed_start` (defined at ~line 145, invoked from single-placement at :577 and batch placement at :901).

---

## Why fix #1 unmasked fix #2

Before fix #1, the card showed `Location: replica` — visually the bed name was already on the card (in the wrong slot). Once `location` was correctly defaulted to `'windowsill'`, the now-empty `Planned bed:` slot exposed that the destination bed was never being persisted on auto-create.

Fix #1 alone makes the card semantically correct for the indoor phase. Fix #2 makes it complete (carries the user's bed pick through into the seed-start record).

---

## Files changed across both fixes

| File | Change | LOC |
|---|---|---|
| `backend/blueprints/gardens_bp.py` | `_auto_create_indoor_seed_start`: set `location='windowsill'` (was: bed-name fallback). Add `destination_bed_ids` from `planting_event.garden_bed_id`. | ~9 net (incl. comment block) |
| `backend/tests/test_placement_indoor_start_dedup.py` | New regression test `test_auto_created_seed_start_captures_placement_bed`. | +30 |

No frontend changes for either fix — the card already renders `location`, `destinationBedDetails`, and `destinationBeds` from the API. Backend correctness is sufficient.

---

## Test results

- **Targeted** (`pytest tests/test_placement_explicit_seed_start_link.py tests/test_placement_indoor_start_dedup.py -v`): **21 / 21 pass** (was 20 → 21 with the new regression test).
- **Full backend** (`pytest`): **1365 pass, 1 xfail, 2 fail** in ~107s. The 2 failures are pre-existing `test_geocoding_service.py` network-dependent tests, unrelated to these fixes.

No test asserted either bug's old behavior, so nothing had to be updated.

---

## What explicitly did NOT change

- The bed-resolution chain in `models.py::IndoorSeedStart.get_current_garden_plan_count` — its self-link exclusion is intentional (the linked event is a placeholder, not a plan entry) and is now correctly bypassed by tier-1 (manual `destination_bed_ids`).
- `_link_existing_indoor_seed_start` — when reusing an existing IndoorSeedStart, we trust whatever `destination_bed_ids` the user set (or didn't).
- The two user-driven creation endpoints in `utilities_bp.py` (~lines 765 and 1551) — they were already correct, defaulting `location` to `'windowsill'` and accepting `destination_bed_ids` from the request.
- All frontend code paths.

---

## Backfill recommendation (NOT applied)

Legacy `IndoorSeedStart` rows created before these fixes will keep showing the wrong values until edited or transplanted out:

- **`location`** — free-text rows like `'replica'` will keep showing as the current location.
- **`destination_bed_ids = NULL`** — Planned bed will keep saying "not assigned".

Both are cosmetic per-row issues. Suggested one-shot SQL (idempotent, respects user overrides) is documented in each fix report. Hold until requested.

---

## Awaiting

Push greenlight for the local fixes + docs. Suggested commit grouping:

```
fix: Default IndoorSeedStart auto-create location to 'windowsill'
fix: Persist destination_bed_ids on auto-created IndoorSeedStart + regression test
docs: Indoor Start current-location and planned-bed fix reports + report-back
```

(Or a single bundled `fix:` commit covering both — they share the same helper and were diagnosed together.)
