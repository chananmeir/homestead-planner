"""
Space Requirement Calculator Service

Calculates how many grid cells a plant needs based on the bed's planning method.
Provides consistent space calculation logic for the backend.
"""

from plant_database import PLANT_DATABASE
from sfg_spacing import get_sfg_cells_required
from migardener_spacing import get_migardener_spacing
from intensive_spacing import get_intensive_spacing


def is_seed_density_planting(plant, planning_method):
    """
    Detect if plant uses seed-density calculation (not plant-count calculation).
    Seed-density crops are direct-seeded densely (e.g., lettuce, arugula) where
    the user specifies number of seeds, not number of mature plants.
    """
    if planning_method != 'migardener':
        return False

    mg = plant.get('migardener')
    if not mg:
        return False

    return (mg.get('plantingStyle') == 'row_based' and
            isinstance(mg.get('seedDensityPerInch'), (int, float)) and
            mg.get('seedDensityPerInch', 0) > 0 and
            isinstance(mg.get('rowSpacingInches'), (int, float)) and
            mg.get('rowSpacingInches', 0) > 0)


def calculate_seeds_per_sqft(plant):
    """
    Calculate seeds per square foot for seed-density crops.
    Formula: (rows per foot) × (seeds per row-foot)
    Example: lettuce with 4" rows, 1 seed/inch = (12÷4) × 12×1 = 36 seeds/sqft
    """
    mg = plant.get('migardener', {})
    seed_density = mg.get('seedDensityPerInch')
    row_spacing = mg.get('rowSpacingInches')

    if not seed_density or not row_spacing:
        return 1  # Fallback

    rows_per_foot = 12 / row_spacing
    seeds_per_row_foot = 12 * seed_density

    return rows_per_foot * seeds_per_row_foot


def calculate_space_requirement(plant_id, grid_size=12, planning_method='row'):
    """
    Calculate square-foot-equivalent area required to plant one unit.

    This is the backend counterpart to `calculateSpaceRequirement` in
    `frontend/src/utils/gardenPlannerSpaceCalculator.ts`. Both sides MUST
    return identical values (SFG-cell equivalents, where 1 cell = 1 sq ft =
    12" x 12"). See `dev/active/production-readiness-audit/calculator-contract.md`
    for the canonical contract.

    For plant-density crops, the returned value is sq ft per plant.
    For seed-density crops (lettuce, arugula, radish, etc. on the
    'migardener' method), the returned value is sq ft per seed — multiply
    by seed_count rather than plant_count.

    Args:
        plant_id (str): Plant identifier (e.g., 'tomato-1', 'pepper-1')
        grid_size (int): Grid cell size in inches (retained for backward
            compatibility; only consulted for the legacy `row` fallback on
            plants not found in the plant database). The contract assumes
            grid_size == 12 for cross-stack parity.
        planning_method (str): Bed's planning method
            - 'square-foot': Uses SFG lookup table (1 cell = 1 sq ft)
            - 'row': rowSpacing * spacing / 144 sq ft per plant
            - 'intensive': onCenter^2 / 144 sq ft per plant
            - 'migardener': plantSpacing * rowSpacing / 144 (or plantSpacing^2 / 144
              for broadcast crops with null rowSpacing); seed-density crops
              return sq ft per seed
            - 'permaculture': spacing^2 / 144 sq ft per plant
            - Other values default to row calculation

    Returns:
        float: Square-foot-equivalent area per unit (per plant, or per seed
        for seed-density migardener crops).
    """
    # Find plant in database (needed for all methods except SFG)
    plant = next((p for p in PLANT_DATABASE if p['id'] == plant_id), None)

    # SQUARE FOOT GARDENING: Use SFG lookup table (already in SFG cells = sq ft)
    if planning_method == 'square-foot':
        return get_sfg_cells_required(plant_id)

    # MIGARDENER METHOD: Ultra-dense spacing expressed as sq ft per unit
    elif planning_method == 'migardener':
        if plant:
            # Seed-density crops (e.g., lettuce, arugula) return sq ft per seed
            if is_seed_density_planting(plant, planning_method):
                seeds_per_sqft = calculate_seeds_per_sqft(plant)
                return 1.0 / seeds_per_sqft

            spacing = plant.get('spacing', 12)
            row_spacing = plant.get('rowSpacing', None)
            mg_spacing = get_migardener_spacing(plant_id, spacing, row_spacing)

            plant_spacing_in = mg_spacing['plant_spacing']
            row_spacing_val = mg_spacing.get('row_spacing')

            if row_spacing_val is None or row_spacing_val == 0:
                # Broadcast / intensive: equidistant in all directions
                sq_inches = plant_spacing_in * plant_spacing_in
            else:
                # Row-based: rectangular footprint rowSpacing x plantSpacing
                sq_inches = row_spacing_val * plant_spacing_in
            return sq_inches / 144.0
        return 1  # Fallback for unknown plants

    # INTENSIVE METHOD: Bio-intensive spacing (onCenter^2 / 144 sq ft)
    elif planning_method == 'intensive':
        if plant:
            spacing = plant.get('spacing', 12)
            on_center = get_intensive_spacing(plant_id, spacing)
            sq_inches = on_center * on_center
            return sq_inches / 144.0
        return 1  # Fallback for unknown plants

    # PERMACULTURE METHOD: Native spacing, equidistant (spacing^2 / 144)
    elif planning_method == 'permaculture':
        if plant:
            spacing = plant.get('spacing', 12)
            sq_inches = spacing * spacing
            return sq_inches / 144.0
        return 1  # Fallback

    # ROW / TRADITIONAL METHOD: rowSpacing * spacing / 144 sq ft per plant
    else:
        if plant:
            spacing = plant.get('spacing', 12)
            # Frontend mirrors: `plant.rowSpacing || spacing` — falls back to
            # in-row spacing when no explicit row spacing is set.
            row_spacing_val = plant.get('rowSpacing') or spacing
            sq_inches = row_spacing_val * spacing
            return sq_inches / 144.0

        # Fallback for unknown plants: preserve legacy "1 cell" contract so
        # downstream callers don't divide by zero or over-allocate.
        return 1


# Example usage for testing
if __name__ == '__main__':
    test_cases = [
        ('tomato-1', 12, 'square-foot'),
        ('tomato-1', 12, 'row'),
        ('tomato-1', 12, 'intensive'),
        ('tomato-1', 12, 'migardener'),
        ('lettuce-1', 12, 'square-foot'),
        ('lettuce-1', 12, 'row'),
        ('lettuce-1', 12, 'intensive'),
        ('lettuce-1', 12, 'migardener'),
        ('pepper-1', 12, 'intensive'),
        ('watermelon-1', 12, 'square-foot'),
        ('watermelon-1', 12, 'row'),
    ]

    print("Space Requirement Calculations:")
    print("=" * 70)
    for plant_id, grid_size, method in test_cases:
        cells = calculate_space_requirement(plant_id, grid_size, method)
        print(f"{plant_id:15} | {method:12} | {grid_size}\" grid = {cells} cell(s)")
