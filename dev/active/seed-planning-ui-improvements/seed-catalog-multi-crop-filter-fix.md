# Seed Catalog Multi-Crop Filter — Diagnosis & Fix

**Date:** 2026-06-10
**Status:** Shipped (Tier 1 + Tier 1.5 of the assessment; Tier 2 deferred)
**Trigger:** Deep-dive Appendix A item 2 — `SeedCatalog.tsx:226` TODO "update backend to
support multiple plant_ids".

## Diagnosis

The TODO was about the crop **filter**, not catalog data modeling. The catalog is
`SeedInventory` rows with `is_global=True`; `GET /api/seed-catalog` accepted exactly one
`plant_id` query param. The UI's Crop/Plant filter is a multi-select, so the frontend papered
over the gap in three places:

1. `handleFilterChange` clamped the crop group to one value (last pick wins).
2. `loadSeeds` sent only `cropFilters[0]` (first value — the TODO site).
3. The CSV export path had the same first-value truncation.

Net effect: "show tomato AND pepper varieties" silently showed only one crop, in both
browsing and export.

**Adjacent latent bug found during diagnosis (Tier 1.5):** the Variety/Type filter options
builder compared `cropFilters.includes(plant.name)` while the crop options store
`plant_id` values (`'Tomato' ≠ 'tomato-1'`) — the comparison never matched, so the Variety
filter's option list emptied whenever any crop filter was active.

## Fix

- **Backend** (`seeds_bp.py` `get_seed_catalog`): `plant_id` is now repeatable —
  `request.args.getlist('plant_id')` → `SeedInventory.plant_id.in_(...)`. Single-value
  requests behave identically (backward compatible); empty values ignored.
- **Frontend** (`SeedCatalog.tsx`): removed the last-pick-wins clamp; `loadSeeds` and the
  export path append every selected crop as repeated `plant_id` params; Variety options
  builder compares `seed.plantId` against the stored ids.

## Deliberately unchanged

- Catalog rows still map to exactly one plant. True multi-plant rows (seed mixes) were
  assessed and **deferred**: single `plant_id` is load-bearing across spacing/SFG/overrides/
  planner. If ever wanted, build a `catalog_seed_plants` join table scoped to catalog
  browsing only, with a clone-time crop pick so inventory rows stay single-plant.

## Verification

- New `backend/tests/test_seed_catalog_filter.py` (6 tests): no-filter global-only,
  single-value compat, repeated params OR'd, is_global never bypassed, pagination total,
  search composition, empty-param ignored.
- Full backend suite + frontend tests/tsc/build green (same pre-existing geocoding
  live-API failures only).
