"""
Cross-Stack Parity Tests — Backend ↔ Frontend synchronized calculations.

This suite is the automated guardrail for the #1 documented risk in CLAUDE.md:
five synchronized backend/frontend file pairs must produce identical outputs.
Before this harness existed, drift was caught only by manual audit.

How it works
------------
The frontend is the source of truth. `frontend/scripts/emit-parity-snapshot.js`
loads the real frontend TS lookup tables and space calculator, then writes
`backend/tests/fixtures/frontend_parity_snapshot.json`. These tests load that
fixture and assert that the backend returns matching values for every
documented entry and every space-calculator case.

When these tests fail
---------------------
- A backend change drifted from the frontend counterpart. Fix the backend
  (or, if the frontend is what changed, regenerate the snapshot to make
  the drift visible in git and update both sides consistently).
- A frontend change drifted from the backend. Regenerate the snapshot
  (`cd frontend && npm run parity:emit`) and update the backend counterpart.

Do NOT "fix" a failing parity test by editing the snapshot file by hand —
that silently hides real drift. Only regenerate via the emit script.

Synced file pairs covered
-------------------------
1. space_calculator.py                 ↔ gardenPlannerSpaceCalculator.ts
2. sfg_spacing.py + garden_methods.py  ↔ sfgSpacing.ts
3. migardener_spacing.py               ↔ migardenerSpacing.ts
4. intensive_spacing.py                ↔ intensiveSpacing.ts
5. plant_database.py                   ↔ plantDatabase.ts
"""

import json
import math
import os

import pytest

# Import backend calculators (note: conftest.py adds backend/ to sys.path,
# so these bare imports mirror the existing test style in this directory).
from services.space_calculator import calculate_space_requirement
from sfg_spacing import get_sfg_cells_required
from migardener_spacing import get_migardener_spacing
from intensive_spacing import get_intensive_spacing
from plant_database import PLANT_DATABASE


FIXTURE_PATH = os.path.join(
    os.path.dirname(__file__), 'fixtures', 'frontend_parity_snapshot.json'
)

# Tolerance for floating-point comparisons. The snapshot stores JS Number
# values (double precision); backend uses Python float. 1e-9 comfortably
# absorbs representation noise without hiding real drift (smallest meaningful
# difference between spacing methods is ~0.01 cells).
FLOAT_TOLERANCE = 1e-9


# ============================================================================
# Known drift registry — see developer-response.md (2026-04-22 audit).
# ============================================================================
#
# The parity suite surfaced 116 real cross-stack drifts when first authored.
# Per user decision, we keep the suite running as a standing regression signal
# but mark the known-failing cases as xfail so CI stays green. Each group
# below is a distinct drift category; when a group's underlying drift is
# fixed in production code, the xfail(strict=True) markers in that group will
# flip to XPASS and nudge us to remove them.
#
# DO NOT add cases to these sets to silence new failures. A NEW failure means
# NEW drift — investigate and fix it (or file a new group with a clear reason).

# Group A — SFG lookup data drift.
# RESOLVED 2026-04-22: added explicit 'bean' entry to the 9-per-square bucket
# in backend/garden_methods.py::SFG_SPACING (resolver strips '-1' suffix so
# both 'bean' and 'bean-1' resolve correctly). Both lookup tests and the 3
# downstream space-calculator cases flipped to XPASS; markers removed.
XFAIL_REASON_A = (
    "Group A (legacy): SFG lookup fallthrough bug. Resolved 2026-04-22 by "
    "adding explicit 'bean' entry to SFG_SPACING. Reason string retained "
    "only as a historical anchor — the sets below are empty."
)

XFAIL_A_SFG_PLANT_IDS = frozenset()

XFAIL_A_SPACECALC_CASES = frozenset()


# Group B — Plant database field drift.
# RESOLVED 2026-04-22 for 17 of 18 plants. Backend values aligned to frontend
# per `dev/active/production-readiness-audit/data-alignment-proposal.md`;
# markers removed. `strawberry-1` remains xfailed under Group H because its
# drift (daysToMaturity, rowSpacing) is tied to unresolved perennial product-
# model semantics — deferred per group-b-decision-response.md.
XFAIL_REASON_B = (
    "Group B (legacy): Data drift: per-plant `spacing`/`daysToMaturity`/"
    "`rowSpacing`/`category`/`migardener.*` fields mismatch between "
    "backend/plant_database.py and frontend/src/data/plantDatabase.ts. "
    "Reason string retained only as a historical anchor — the set below "
    "is empty; strawberry-1 lives under Group H."
)

XFAIL_B_PLANT_IDS = frozenset()


# Group H — Deferred product-model issues.
# `strawberry-1` is a perennial plant; the `daysToMaturity` and `rowSpacing`
# fields don't map cleanly onto annual-crop semantics (DTM ≈ 270–365+ days
# to first harvest in year 2; rowSpacing is use-case dependent). Per
# `dev/active/production-readiness-audit/group-b-decision-response.md` the
# user deferred both fields pending a product decision on perennial
# semantics (perennial flag, null DTM + separate year-2 workflow, etc.).
# This is NOT data drift to fix — leave the marker in place until the
# product model is resolved.
XFAIL_REASON_H = (
    "Group H — deferred product-model: strawberry-1 perennial semantics "
    "(see dev/active/production-readiness-audit/group-b-decision-response.md; "
    "daysToMaturity and rowSpacing both require product decision on whether "
    "to model perennials as annuals, add a perennial flag, or null out DTM "
    "and surface a year-2 harvest workflow)."
)

XFAIL_H_PLANT_IDS = frozenset({'strawberry-1'})


# Group C — Space calculator `row` method unit mismatch.
# RESOLVED 2026-04-22: backend `row` branch rewritten to return sq-ft
# (`rowSpacing * spacing / 144`), matching the canonical contract
# (calculator-contract.md). The 32 cases that flipped to XPASS had their
# markers removed. The 14 cases that did NOT flip are downstream of Group B
# plant-database field drift — tracked under Group G below with the
# architectural drift explicitly excluded so the remaining failures surface
# as data drift, not calculator drift.
XFAIL_REASON_C = (
    "Group C (legacy): `row` method architectural drift. Resolved by the "
    "2026-04-22 space-calculator rewrite. This reason string is retained only "
    "as a historical anchor — the set below is empty."
)


# Group D — Space calculator `migardener` method unit mismatch.
# RESOLVED 2026-04-22: backend `migardener` branch rewritten to return sq-ft
# (`rowSpacing * plantSpacing / 144` for row-based crops, `plantSpacing^2 / 144`
# for broadcast crops), matching the canonical contract. All 43 cases flipped
# to XPASS and their markers were removed.
XFAIL_REASON_D = (
    "Group D (legacy): `migardener` method architectural drift. Resolved by "
    "the 2026-04-22 space-calculator rewrite. This reason string is retained "
    "only as a historical anchor — the set below is empty."
)


# Group G — `row` method downstream of Group B plant-database field drift.
# After the 2026-04-22 calculator rewrite, these 14 plants still fail on the
# `row` method because their `spacing` field drifts between backend/frontend
# plant databases (Group B). Will clear automatically once Group B's plant-DB
# alignment lands. Listed as its own group (not folded into B) because the
# failure surfaces in the space calculator output, not in the plant-DB field
# comparison.
XFAIL_REASON_G = (
    "Group G (legacy): `row` method downstream of Group B plant-DB drift. "
    "Resolved 2026-04-22 by the Group B plant-DB alignment. Reason string "
    "retained only as a historical anchor — the set below is empty."
)


# Group E — Missing plant in backend lookup tables.
# RESOLVED 2026-04-22: added explicit 'shallot-from-seed' and
# 'shallot-from-sets' entries to the 4-per-square bucket in
# backend/garden_methods.py::SFG_SPACING, and hardened the resolver in
# backend/sfg_spacing.py to iteratively strip trailing segments so future
# multi-segment IDs fall back to a base-plant match. Both cases flipped to
# XPASS and their markers were removed.
XFAIL_REASON_E = (
    "Group E (legacy): Missing plant in backend lookup tables. Resolved "
    "2026-04-22. Reason string retained only as a historical anchor — the "
    "set below is empty."
)

XFAIL_E_SPACECALC_CASES = frozenset()


# Group F — Intensive-method downstream drift.
# RESOLVED 2026-04-22: cleared automatically by the Group B plant-DB
# alignment (intensive fallback consumes plant `spacing`, so fixing Group B
# propagated to both `cilantro-1[intensive]` and `dill-1[intensive]`).
# No additional intensive_spacing.py override was needed.
XFAIL_REASON_F = (
    "Group F (legacy): Intensive-method downstream drift. Resolved "
    "2026-04-22 by the Group B plant-DB alignment. Reason string retained "
    "only as a historical anchor — the set below is empty."
)

XFAIL_F_SPACECALC_CASES = frozenset()


# Historical Group C / D registries. After the 2026-04-22 rewrite both sets
# are empty — kept as named constants so the indexing in `_spacecalc_param`
# remains literal and any future architectural regression can be restored
# here cleanly.
XFAIL_C_SPACECALC_CASES = frozenset()

XFAIL_D_SPACECALC_CASES = frozenset()


# Group G — `row` method cases downstream of Group B plant-database field
# drift. RESOLVED 2026-04-22: all 14 cases cleared automatically when the
# Group B plant-DB alignment landed (the row calculator consumes plant-DB
# `spacing` and `rowSpacing`). Markers removed; the set below is empty.
XFAIL_G_SPACECALC_CASES = frozenset()


def _load_snapshot():
    """Load the frontend-emitted parity snapshot.

    If the fixture is missing the suite fails loudly with actionable guidance
    rather than silently skipping — a missing snapshot = untested parity.
    """
    if not os.path.exists(FIXTURE_PATH):
        pytest.fail(
            "Frontend parity snapshot is missing: {path}\n"
            "Run `cd frontend && npm run parity:emit` to generate it.\n"
            "This fixture must be committed so backend tests can assert "
            "against frontend values without needing Node at pytest time."
            .format(path=FIXTURE_PATH)
        )
    with open(FIXTURE_PATH, 'r', encoding='utf-8') as fh:
        return json.load(fh)


# Module-level fixture: load once, reuse across parametrized tests.
SNAPSHOT = _load_snapshot()


def _xfail(reason):
    """Shorthand: strict xfail mark with a reason. strict=True means when
    the drift is fixed the test will XPASS and the suite will flag it so
    we remove the marker — keeps the registry honest.
    """
    return pytest.mark.xfail(reason=reason, strict=True)


def _sfg_param(plant_id, plants_per_cell):
    if plant_id in XFAIL_A_SFG_PLANT_IDS:
        return pytest.param(plant_id, plants_per_cell, marks=_xfail(XFAIL_REASON_A))
    return pytest.param(plant_id, plants_per_cell)


def _plant_param(plant):
    """Attach an xfail marker to plant-DB field parity cases that are
    currently deferred. Group B (data drift) was cleared 2026-04-22;
    Group H (strawberry-1 perennial semantics) remains deferred.
    """
    plant_id = plant.get('id', 'unknown')
    if plant_id in XFAIL_H_PLANT_IDS:
        return pytest.param(plant, id=plant_id, marks=_xfail(XFAIL_REASON_H))
    if plant_id in XFAIL_B_PLANT_IDS:
        return pytest.param(plant, id=plant_id, marks=_xfail(XFAIL_REASON_B))
    return pytest.param(plant, id=plant_id)


def _spacecalc_param(case):
    plant_id = case['plantId']
    method = case['method']
    test_id = "{pid}[{m}]".format(pid=plant_id, m=method)
    key = (plant_id, method)

    # Group A downstream (SFG-table driven square-foot failures).
    # Empty post-2026-04-22 fix; retained for forward-compat.
    if key in XFAIL_A_SPACECALC_CASES:
        return pytest.param(case, id=test_id, marks=_xfail(XFAIL_REASON_A))

    # Group E — plant missing from backend. Empty post-2026-04-22 fix.
    if key in XFAIL_E_SPACECALC_CASES:
        return pytest.param(case, id=test_id, marks=_xfail(XFAIL_REASON_E))

    # Group F — intensive downstream of plant DB drift. Empty post-2026-04-22
    # fix (cleared automatically by the Group B plant-DB alignment).
    if key in XFAIL_F_SPACECALC_CASES:
        return pytest.param(case, id=test_id, marks=_xfail(XFAIL_REASON_F))

    # Group C — legacy `row` method architectural drift. Empty post-rewrite;
    # kept for forward-compat if architectural regression is ever reintroduced.
    if key in XFAIL_C_SPACECALC_CASES:
        return pytest.param(case, id=test_id, marks=_xfail(XFAIL_REASON_C))

    # Group D — legacy `migardener` method architectural drift. Empty
    # post-rewrite.
    if key in XFAIL_D_SPACECALC_CASES:
        return pytest.param(case, id=test_id, marks=_xfail(XFAIL_REASON_D))

    # Group G — `row` method downstream of Group B plant-DB field drift.
    # Empty post-2026-04-22 fix.
    if key in XFAIL_G_SPACECALC_CASES:
        return pytest.param(case, id=test_id, marks=_xfail(XFAIL_REASON_G))

    return pytest.param(case, id=test_id)


# Pre-build parametrize lists so the marks attach once at collection time.
_SFG_PARAMS = [
    _sfg_param(plant_id, plants_per_cell)
    for plant_id, plants_per_cell in sorted(SNAPSHOT['sfgPlantsPerCell'].items())
]
_MIGARDENER_PARAMS = [
    pytest.param(plant_id, entry)
    for plant_id, entry in sorted(SNAPSHOT['migardenerOverrides'].items())
]
_INTENSIVE_PARAMS = [
    pytest.param(plant_id, on_center)
    for plant_id, on_center in sorted(SNAPSHOT['intensiveOverrides'].items())
]
_PLANT_EXISTS_PARAMS = [
    # Group B doesn't apply to the "exists in backend" check — all 18
    # plants in Group B are present on the backend; the mismatch is on
    # field values. So no xfail marks here.
    pytest.param(plant, id=plant.get('id', 'unknown'))
    for plant in SNAPSHOT['plantDatabase']
]
_PLANT_FIELDS_PARAMS = [
    _plant_param(plant) for plant in SNAPSHOT['plantDatabase']
]
_SPACECALC_PARAMS = [
    _spacecalc_param(case) for case in SNAPSHOT['spaceCalculator']['cases']
]


def _close(a, b, tol=FLOAT_TOLERANCE):
    """Numeric equality with tolerance; handles ints, floats, and None."""
    if a is None or b is None:
        return a == b
    return math.isclose(float(a), float(b), rel_tol=tol, abs_tol=tol)


# ============================================================================
# Group 2: SFG spacing parity (sfgSpacing.ts ↔ sfg_spacing.py)
# ============================================================================

class TestSFGParity:
    """Every plantId → plantsPerCell entry in the frontend SFG lookup table
    must produce the same cells-per-plant from the backend resolver.

    Frontend table maps plantId → plantsPerCell (e.g. carrot=16).
    Backend returns 1/plantsPerCell as cells-per-plant (e.g. carrot=0.0625).
    So backend result × frontend plantsPerCell should equal 1.0.
    """

    @pytest.mark.parametrize("plant_id,plants_per_cell", _SFG_PARAMS)
    def test_sfg_lookup_parity(self, plant_id, plants_per_cell):
        backend_cells = get_sfg_cells_required(plant_id)
        expected_cells = 1.0 / plants_per_cell
        assert _close(backend_cells, expected_cells), (
            "SFG cells-per-plant drift for {pid}: "
            "backend={b}, frontend-implied={e} (plants/cell={ppc}). "
            "Keep sfg_spacing.py/garden_methods.py in sync with sfgSpacing.ts."
        ).format(pid=plant_id, b=backend_cells, e=expected_cells, ppc=plants_per_cell)


# ============================================================================
# Group 3: MIGardener spacing parity (migardenerSpacing.ts ↔ migardener_spacing.py)
# ============================================================================

class TestMIGardenerParity:
    """Every override row in the frontend MIGARDENER_SPACING_OVERRIDES must
    match the backend dictionary exactly. Frontend uses a tuple
    `[rowSpacing|null, plantSpacing]`; backend uses tuple `(row, plant)`.
    """

    @pytest.mark.parametrize("plant_id,entry", _MIGARDENER_PARAMS)
    def test_migardener_override_parity(self, plant_id, entry):
        expected_row = entry['rowSpacing']  # may be None
        expected_plant = entry['plantSpacing']

        # get_migardener_spacing needs standard_spacing for the fallback
        # branch, but because `plant_id` is a known override, the fallback
        # is unreachable. Pass 12 as a safe dummy.
        result = get_migardener_spacing(plant_id, 12, None)
        backend_row = result['row_spacing']
        backend_plant = result['plant_spacing']

        assert _close(backend_row, expected_row) and _close(backend_plant, expected_plant), (
            "MIGardener override drift for {pid}: "
            "backend=(row={br}, plant={bp}), frontend=(row={fr}, plant={fp}). "
            "Keep migardener_spacing.py in sync with migardenerSpacing.ts."
        ).format(
            pid=plant_id,
            br=backend_row, bp=backend_plant,
            fr=expected_row, fp=expected_plant,
        )

    def test_migardener_override_table_coverage(self):
        """Backend MIGARDENER_SPACING_OVERRIDES must contain exactly the
        same keys as the frontend table. Extra keys on either side are drift.
        """
        from migardener_spacing import MIGARDENER_SPACING_OVERRIDES as BACKEND_MG

        frontend_keys = set(SNAPSHOT['migardenerOverrides'].keys())
        backend_keys = set(BACKEND_MG.keys())

        only_backend = sorted(backend_keys - frontend_keys)
        only_frontend = sorted(frontend_keys - backend_keys)

        assert not only_backend and not only_frontend, (
            "MIGardener override key sets diverge.\n"
            "  Only in backend: {ob}\n"
            "  Only in frontend: {of}"
        ).format(ob=only_backend, of=only_frontend)


# ============================================================================
# Group 4: Intensive spacing parity (intensiveSpacing.ts ↔ intensive_spacing.py)
# ============================================================================

class TestIntensiveParity:
    """Every override in INTENSIVE_SPACING_OVERRIDES must match across stacks."""

    @pytest.mark.parametrize("plant_id,on_center", _INTENSIVE_PARAMS)
    def test_intensive_override_parity(self, plant_id, on_center):
        # standard_spacing is only used as a fallback for unknown plants;
        # overrides short-circuit it. Pass 12 as a safe dummy.
        backend_value = get_intensive_spacing(plant_id, 12)
        assert _close(backend_value, on_center), (
            "Intensive on-center drift for {pid}: backend={b}, frontend={f}. "
            "Keep intensive_spacing.py in sync with intensiveSpacing.ts."
        ).format(pid=plant_id, b=backend_value, f=on_center)

    def test_intensive_override_table_coverage(self):
        from intensive_spacing import INTENSIVE_SPACING_OVERRIDES as BACKEND_INT

        frontend_keys = set(SNAPSHOT['intensiveOverrides'].keys())
        backend_keys = set(BACKEND_INT.keys())

        only_backend = sorted(backend_keys - frontend_keys)
        only_frontend = sorted(frontend_keys - backend_keys)

        assert not only_backend and not only_frontend, (
            "Intensive override key sets diverge.\n"
            "  Only in backend: {ob}\n"
            "  Only in frontend: {of}"
        ).format(ob=only_backend, of=only_frontend)


# ============================================================================
# Group 5: Plant database parity (plantDatabase.ts ↔ plant_database.py)
# ============================================================================
#
# Scope note: we deliberately assert parity on ONLY the fields the space
# calculator and succession/export logic consume (id, spacing, rowSpacing,
# daysToMaturity, category, migardener override block). The two databases
# intentionally carry different presentation/backend-only fields (e.g.
# backend has germination_temp, icon, days_to_seed; frontend has
# notes/frostTolerance/etc). Requiring bit-for-bit parity on every field
# would be noise; requiring parity on calc-relevant fields catches real
# drift without forcing unrelated refactors.

_PARITY_FIELDS = ('spacing', 'rowSpacing', 'daysToMaturity', 'category')


def _backend_plant_map():
    return {p['id']: p for p in PLANT_DATABASE}


class TestPlantDatabaseParity:

    @pytest.mark.parametrize("plant", _PLANT_EXISTS_PARAMS)
    def test_frontend_plant_exists_in_backend(self, plant):
        """Every plantId in the frontend PLANT_DATABASE must exist in the
        backend PLANT_DATABASE. Missing-on-backend is a real bug: the
        frontend will show a plant that the backend's calculator falls back
        to defaults on, producing silently different space estimates.
        """
        plant_id = plant['id']
        backend = _backend_plant_map().get(plant_id)
        assert backend is not None, (
            "Plant id {pid} is in frontend PLANT_DATABASE but missing from "
            "backend plant_database.py. Add it to keep calculators in sync."
        ).format(pid=plant_id)

    @pytest.mark.parametrize("plant", _PLANT_FIELDS_PARAMS)
    def test_parity_relevant_fields_match(self, plant):
        """For every plant present on both sides, the fields the space
        calculator consumes must match exactly.
        """
        plant_id = plant['id']
        backend = _backend_plant_map().get(plant_id)
        if backend is None:
            pytest.skip(
                "plant {pid} missing from backend; covered by "
                "test_frontend_plant_exists_in_backend".format(pid=plant_id)
            )

        mismatches = []
        for field in _PARITY_FIELDS:
            frontend_val = plant.get(field)
            backend_val = backend.get(field)
            # Only assert parity if the frontend sets the field — backend
            # may have extra optional fields that the frontend omits.
            if frontend_val is None and backend_val is None:
                continue
            if frontend_val != backend_val:
                mismatches.append((field, frontend_val, backend_val))

        # Migardener sub-block (drives seed-density + trellis detection)
        frontend_mg = plant.get('migardener')
        backend_mg = backend.get('migardener')
        if frontend_mg or backend_mg:
            frontend_mg = frontend_mg or {}
            backend_mg = backend_mg or {}
            for key in ('plantingStyle', 'seedDensityPerInch',
                        'rowSpacingInches', 'linearFeetPerPlant'):
                fv = frontend_mg.get(key)
                bv = backend_mg.get(key)
                if fv is None and bv is None:
                    continue
                if fv != bv:
                    mismatches.append(('migardener.' + key, fv, bv))

        assert not mismatches, (
            "Plant database drift for {pid}:\n  ".format(pid=plant_id)
            + "\n  ".join(
                "{f}: frontend={fv!r} backend={bv!r}".format(f=f, fv=fv, bv=bv)
                for f, fv, bv in mismatches
            )
        )


# ============================================================================
# Group 1: Space calculator parity (gardenPlannerSpaceCalculator.ts
#                                    ↔ services/space_calculator.py)
# ============================================================================
#
# This is the decisive check — it validates the full calculation chain per
# planning method, not just lookup tables. Every plant that has a method-
# specific override in any of groups 2–4 is exercised across all four
# supported methods at gridSize=12.


class TestSpaceCalculatorParity:

    @pytest.mark.parametrize("case", _SPACECALC_PARAMS)
    def test_space_calculator_case(self, case):
        plant_id = case['plantId']
        method = case['method']
        grid_size = case['gridSize']
        expected = case['cells']

        actual = calculate_space_requirement(plant_id, grid_size, method)

        assert _close(actual, expected), (
            "Space calculator drift for {pid} via {m} (grid={g}): "
            "backend={b}, frontend={f}. "
            "Check services/space_calculator.py and its inputs against "
            "gardenPlannerSpaceCalculator.ts."
        ).format(pid=plant_id, m=method, g=grid_size, b=actual, f=expected)
