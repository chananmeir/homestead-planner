# Homestead Planner — Copilot / AI Agent Instructions

This document gives targeted, actionable guidance for AI coding agents working on the Homestead Planner repository. Focus on small, safe changes that respect the project's current data conventions.

## Big picture
- Backend-first data model: the authoritative data lives in Python modules under `backend/` — most importantly `backend/plant_database.py` (large in-memory plant catalog) and `backend/structures_database.py` (homestead structures). Agents will frequently read, query and patch these files.
- These files are data-as-code: records are plain Python dicts in lists. Edits are code changes, not database updates. Keep diffs small and localized.

## Key files to inspect
- `backend/plant_database.py` — canonical plant schema and many examples (search for `PLANT_DATABASE`).
- `backend/structures_database.py` — structures and categories (search for `STRUCTURES_DATABASE`, `STRUCTURE_CATEGORIES`).
- Look for validation helpers: `validate_plant_database()` exists in the plant file; a validator was added to `structures_database.py`.

## Data conventions (explicit, project-specific)
- id format: prefer slug-like ids with a numeric suffix (e.g. `spinach-1`, `apple-1`). Some legacy entries omit `-1`; try to follow the dominant convention when adding new ids.
- Key naming: the codebase currently mixes camelCase and snake_case (e.g. `daysToMaturity`, `germination_days`, `days_to_seed`). Do not change naming style globally in a single PR — instead:
  - When editing or adding records, copy the nearest example's key names for consistency.
  - If you must normalize keys, open an issue and propose a migration strategy, then implement the migration in a separate PR with tests.
- Units: assume `width`/`length` are feet in `structures_database.py` (some comments), and `spacing`/`rowSpacing` are inches in `plant_database.py`. If you add numeric fields, add a comment or `*_unit` field where ambiguous.
- Minimal required fields for new plant entries: `id`, `name`, `scientificName` (follow existing case in nearby entries), `category`, `spacing`, `rowSpacing`, `daysToMaturity`, `plantingDepth`, `germination_days`, `ideal_seasons`, and `icon`.

## Editing rules for automated agents
- Make the smallest possible edit. Avoid reformatting the whole file. Keep the existing key spellings and value styles in the local region unless you are explicitly performing a normalization/migration PR.
- Preserve comments that document special cases (e.g., deprecation notes for `chia-white`). If you remove a deprecated entry, also add or point to a migration script (the repository contains notes referencing a migration path for some ids).
- For lookups and new helper functions, prefer adding non-breaking code (build an index at module import rather than changing external APIs). Example: create PLANT_INDEX = {p['id']: p for p in PLANT_DATABASE} and update get_plant_by_id to use the index.

## Validation and tests
- Use the existing validators: `validate_plant_database()` runs on import. `structures_database.py` now runs `validate_structures_database()` on import.
- Add unit tests under `tests/` if you change behavior. If tests don't exist, add a small `tests/test_data_valid.py` to assert validation returns True.

## Integration points & patterns to follow
- Companion/incompatible lists reference other plant ids (e.g. `companionPlants: ['lettuce-1']`). When renaming ids, update all references or create a migration script to update downstream references.
- `migardener` is a nested provider-specific object used by some plant entries — treat it as an opaque block unless you are extending the MIGardener feature; mirror existing keys exactly when adding such blocks.

## Examples (do this)
- Add a new plant entry near similar plants; copy keys exactly from nearby records to maintain style. Minimal example:

```py
{
  'id': 'newleaf-1',
  'name': 'Newleaf',
  'scientificName': 'Laminaria novus',
  'category': 'vegetable',
  'spacing': 6,
  'rowSpacing': 12,
  'daysToMaturity': 45,
  'plantingDepth': 0.25,
  'germination_days': 7,
  'ideal_seasons': ['spring', 'fall'],
  'icon': '🥬',
}
```

## Common pitfalls to avoid
- Don't mix up keys when reading/writing — check both camelCase and snake_case variants in the nearby records first.
- Don't remove deprecated records without running migration scripts and confirming no external references remain (database rows, seed inventories, fixtures).
- Avoid changing public helpers' signatures. Extend functionality with new helpers and keep old ones for a deprecation period.

## Suggested next steps for maintainers (high value)
1. Adopt a single key naming convention (recommendation: snake_case) and implement a staged migration with tests.
2. Move large data sets to JSON/YAML (e.g., `backend/data/plants.json`) and load them at runtime — this separates data from code and allows safer editing.
3. Add jsonschema or pydantic models for stricter validation and CI checks.
4. Replace linear id lookups with an index dict on import for O(1) fetches.

---
If you'd like, I can:
- implement indexing (PLANT_INDEX, STRUCTURE_INDEX) now (small, safe PR), or
- implement stricter validation for plants (detect camelCase vs snake_case collisions) and add a test, or
- start a careful key-normalization script (larger, requires a migration plan).

Tell me which of the above you'd like implemented first and I'll make the changes.
