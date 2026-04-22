# Space Calculator Cross-Stack Contract

**Decision date**: 2026-04-22
**Status**: Canonical contract declared. Backend alignment **pending** — drift is tracked by xfail markers in `backend/tests/test_cross_stack_parity.py::TestSpaceCalculatorParity`.

---

## The contract

`calculate_space_requirement(plant, grid_size, method)` (backend) and `calculateSpaceRequirement(plant, gridSize, planningMethod)` (frontend) MUST return **square-foot-equivalent area required to plant one unit**, in **square feet** (floating-point; fractional values are valid and expected).

- Valid `method` values: `'square-foot'`, `'row'`, `'intensive'`, `'migardener'` (plus `'permaculture'` where implemented).
- For **plant-density** crops, the returned value is sq ft per plant. Multiply by `quantity` (plant count) to get total bed area needed.
- For **seed-density** crops (lettuce, arugula, radish, carrot, spinach, etc.), the returned value is sq ft **per seed**, not per plant. Multiply by `seed_count`, not by plant count.
- 1 SFG cell = 1 sq ft (12″ × 12″). SFG callers may treat the return value as "cells" interchangeably with "sq ft" — they are the same unit.

**Canonical reference implementation**: `frontend/src/utils/gardenPlannerSpaceCalculator.ts::calculateSpaceRequirement` (lines ~205–257). The header comment already documents the unit: *"Returns SFG-cell equivalents (1 cell = 1 sq ft = 12" × 12")"*.

## Why frontend is canonical

The backend callers of `calculate_space_requirement` already treat the return value as sq-ft-equivalent area, regardless of what the calculator currently returns for `row` / `migardener`:

- `backend/services/garden_planner_service.py::calculate_plant_quantities` (~line 110): divides `total_available_cells` (bed area in sq ft) by `space_per_plant` to compute `max_by_space`. Only a sq-ft return makes that math correct.
- `backend/services/garden_planner_service.py::calculate_planning_breakdown` (~line 1211): accumulates `cells_used += cells_per_plant * quantity` and compares against `_calculate_bed_cells(bed)` (bed area). Same shape — sq-ft math.
- `backend/blueprints/garden_planner_bp.py` (line 427) and `backend/blueprints/gardens_bp.py` (line 1335): same pattern.

The parity harness surfaced that `space_calculator.py`'s `row` branch returns grid-cells-squared and its `migardener` branch returns a cell-count product — neither is sq ft. The backend calculator has drifted away from what its own callers assume. The frontend value is what the UI shows users, so it is the de-facto source of truth. Backend will be rewritten to match.

## If code needs grid cells

Grid-cell math (e.g., highlighting cells on the SFG designer grid, cell-indexed storage in the designer) is valid for some UIs but is **not** part of the shared cross-stack contract. Any such need must be satisfied by a separate helper with a clearly different name. Suggested signature:

```python
def calculate_cells_required(plant, grid_size) -> int
```

Callers that currently piggyback on `calculate_space_requirement` for cell-count math must migrate to the new helper during backend alignment. Do not overload the shared contract with unit-switching.

## Test enforcement

- `backend/tests/test_cross_stack_parity.py::TestSpaceCalculatorParity` enforces the contract.
- 96 calculator cases are currently `@pytest.mark.xfail` pending backend rewrite (grouped by drift category — see test file docstring and `developer-response.md`).
- `xfail` markers are configured `strict=True`. When a backend case flips to matching the contract, it registers as XPASS and the test suite will require the marker to be removed — this is the signal that drift has been fixed case-by-case.

## Scope boundaries

This contract covers:
- The four planning methods: `square-foot`, `row`, `intensive`, `migardener`.
- Both plant-density and seed-density output semantics.

This contract does **NOT** cover:
- **Trellis linear-ft math**. Linear feet for trellis crops is computed separately. Backend: `backend/services/garden_planner_service.py::_get_linear_feet_per_plant` (module-private helper, line 302). Frontend: consumed via `plant.migardener.linearFeetPerPlant`. Trellis crops are explicitly excluded from `calculate_space_requirement` callers (see `_is_trellis_planting` check in `calculate_planning_breakdown`). Trellis needs its own contract note if/when parity is asserted.
- **Buffer / spacing-circle math**. Frontend-only rendering concern — see `frontend/src/components/GardenDesigner/utils/footprintCalculator.ts`. Not shared across stacks.
- **Row-group UUID linking / row-strip adjacency math**. `PlantingEvent.row_group_id` logic is distinct from per-unit space math.

## Callers touched by this contract

Callers to audit once backend is aligned (use these as search anchors, not line numbers — the code will move):

- Backend
  - `backend/services/space_calculator.py` (the calculator itself)
  - `backend/services/garden_planner_service.py` (multiple call sites)
  - `backend/blueprints/garden_planner_bp.py`
  - `backend/blueprints/gardens_bp.py`
- Frontend
  - `frontend/src/utils/gardenPlannerSpaceCalculator.ts` (reference impl + several internal call sites)
  - `frontend/src/components/GardenDesigner/PlannedPlantsSection.tsx`
  - `frontend/src/components/GardenDesigner/utils/autoPlacement.ts` (duplicate local implementation — audit for drift)
  - `frontend/src/components/PlantingCalendar/utils/spaceAvailability.ts` (duplicate local implementation — audit for drift)
  - `frontend/src/components/PlantingCalendar/TimelineView/AvailableSpacesView.tsx`
  - `frontend/src/components/PlantingCalendar/AddCropModal/index.tsx`

## Next steps

1. Backend-debugger rewrites `space_calculator.py` `row` and `migardener` branches to return sq ft. Remove xfail markers in the corresponding drift groups as cases flip to passing (XPASS will make this loud).
2. If a caller still needs grid cells after the rewrite, introduce `calculate_cells_required(plant, grid_size)` and migrate that caller. Do not re-overload the shared contract.
3. Independently peel off xfails for SFG data drift, plant-DB field drift, and missing-plant cases as data is aligned.
