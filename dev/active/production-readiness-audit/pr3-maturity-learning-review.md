# PR #3 Review — Maturity-Learning (learned Days-To-Maturity)

**Branch:** `claude/refine-local-plan-dyMz9` → `main` · **Size:** +1254 / −56 · **Reviewed:** 2026-06-08
**Verdict:** ✅ Mergeable — no code blockers. One **pre-existing DB drift** must be reconciled before
`flask db upgrade` runs on the real database (not caused by this PR).

## What the feature does
Learns a recency-weighted days-to-maturity per `(user, plant, variety, sun_exposure, covered)` from
bed-linked harvests that carry a maturity tag, and resolves an effective DTM for predictions and the
"Harvest ready" badge. Precedence: manual `SeedInventory.days_to_maturity` override → exact learned →
variety-wide aggregate learned → plant-DB default → 60.

- **Service:** `backend/services/maturity_learning.py` (EWMA, 2-yr half-life; `per_harvest_estimate`,
  `recompute_key`, `refresh_from_harvest`, `resolve_dtm` / `resolve_dtm_optional`).
- **Model:** `VarietyMaturityModel` (materialized) + snapshot columns on `HarvestRecord`
  (`maturity_feedback`, `outcome_reason`, `days_in_ground`, `planted_date_snapshot`, `variety_snapshot`,
  `sun_exposure_snapshot`, `covered_snapshot`, `garden_bed_id_snapshot`).
- **Capture/recompute:** `harvests_bp.py` POST/PUT/DELETE.
- **Resolver wiring:** `gardens_bp.py`, `garden_planner_bp.py` (per-item `resolvedDaysToMaturity` +
  `learnedDtm`/`learnedSampleCount`).
- **Frontend:** new `HarvestFromBedModal.tsx`; `designerHelpers.calculateHarvestDate` prefers the
  server-resolved DTM and fixes the `0`-is-falsy trap (`== null`).

## Strengths
- Exact/aggregate key symmetry is consistent on write and read (`sun` coalesced to `'unknown'`,
  `covered` coerced to `bool` on both sides) — the subtle bug that would silently lose learned values.
- NULL-vs-falsy discipline throughout (`is not None`); `days_in_ground == 0` and DTM `0` respected, with tests.
- Durable snapshots survive PlantedItem/bed deletion (`garden_bed_id_snapshot` is a plain Int, not FK).
- Recompute only on the rare harvest write; materialized row read on the hot path. DELETE captures the
  key before delete and recomputes with the row excluded.
- EWMA guards: `max(0.0, years_ago)` for Time-Machine future dates; `naive()` reconciles tz-aware/naive.

## Verification performed (isolated git worktree, copy of real DB)
- **Backend:** `pytest tests/test_maturity_learning.py` → **28/28 passed**.
- **Migration round-trip** (after reconciling drift, below): `faa8053ea705 → a7f3c9d21e04` upgrade adds
  cols + table; downgrade drops them; re-upgrade re-creates; `flask db current` = `a7f3c9d21e04 (head)`;
  `flask db heads` = single head. ✅
- **Frontend:** `designerHelpers` + `HarvestFromBedModal` suites → **8/8 passed**.

## ⚠️ Pre-existing DB drift (action required before deploy — NOT a PR defect)
The real DB's `alembic_version` is stamped **`f2bb35af831e`**, but no migration file defines that id; the
actual latest pre-PR migration is **`faa8053ea705`** (same logical "cancelled_at soft-delete" migration,
re-generated under a new id). The `cancelled_at` columns already exist in the DB, so the schema matches
`faa8053ea705`. Because the stamped id isn't in the migration graph, `flask db upgrade` (and even
`flask db stamp`) fail with *"Can't locate revision identified by 'f2bb35af831e'"* — this would block **any**
future migration, not just this one.

**One-time remediation on the real DB (back up first):**
```sql
UPDATE alembic_version SET version_num = 'faa8053ea705';
```
then `cd backend && flask db upgrade` (applies `a7f3c9d21e04`).

**Important:** `app.py` runs `db.create_all()` at import. On the real DB that auto-creates
`variety_maturity_model` but does **not** add the `harvest_record` snapshot columns (create_all never alters
existing tables). So the migration above is **mandatory** before logging a bed harvest — otherwise the
capture INSERT references columns that don't exist.

## Non-blocking follow-ups
- **UX:** harvest is per-plant (one modal per PlantedItem). A group/multi-select harvest carrying one
  maturity tag would save many clicks (a 16-beet bed = 16 actions today).
- Double `db.session.commit()` per harvest POST — harmless nit.
- Recommend adding a regression note so the `alembic_version` drift is fixed once and documented.
