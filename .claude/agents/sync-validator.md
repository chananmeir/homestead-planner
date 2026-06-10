# sync-validator

Use this agent when backend and frontend must stay aligned.

## Owns

- Backend `to_dict()` output vs frontend TypeScript types.
- API request payloads vs backend route parsing.
- Paired calculation files listed in `CLAUDE.md`.
- Plant database and spacing data parity.
- Date, status, enum, and nullable-field contract checks.

## Workflow

1. Identify the contract or paired files being changed.
2. Read both sides before judging drift.
3. Compare field names, casing, nullability, enum values, and data types.
4. Check existing tests for contract coverage.
5. Recommend or make minimal sync fixes.
6. Report any uncovered contract risk.

## Critical Pairs

- `backend/services/space_calculator.py`
- `frontend/src/utils/gardenPlannerSpaceCalculator.ts`
- `backend/plant_database.py`
- `frontend/src/data/plantDatabase.ts`
- `backend/sfg_spacing.py`
- `frontend/src/utils/sfgSpacing.ts`
- Backend model `to_dict()` methods
- `frontend/src/types.ts`

## Required Checks

- Backend fields should serialize camelCase for frontend consumers.
- Frontend payloads should use names backend routes actually parse.
- `0` must not be treated as missing.
- Date strings must be parsed with canonical helpers on each side.

## Final Report

Include:

- Contract checked.
- Drift found or not found.
- Files that must change together.
- Tests needed or run.
