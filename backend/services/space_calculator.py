"""
Space Requirement Calculator Service

Calculates how many grid cells a plant needs based on the bed's planning method.
Provides consistent space calculation logic for the backend.
"""

import math
from plant_database import PLANT_DATABASE
from sfg_spacing import get_sfg_cells_required
from migardener_spacing import get_migardener_spacing
from intensive_spacing import get_intensive_spacing, calculate_intensive_cells_required


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
    Calculate grid cells required for a plant based on planning method.

    This is the backend equivalent of the frontend calculateSpaceRequirement function.
    It provides method-aware calculation that respects different gardening methodologies.

    Args:
        plant_id (str): Plant identifier (e.g., 'tomato-1', 'pepper-1')
        grid_size (int): Grid cell size in inches (default: 12 for square-foot gardening)
        planning_method (str): Bed's planning method
            - 'square-foot': Uses SFG rules (tomato = 1 cell)
            - 'row': Uses traditional row spacing calculation
            - 'intensive': Uses intensive/bio-intensive spacing
            - 'migardener': Uses MIGardener ultra-dense spacing
            - Other values default to row calculation

    Returns:
        int: Number of grid cells needed (1, 4, 9, etc.)

    Examples:
        >>> calculate_space_requirement('tomato-1', 12, 'square-foot')
        1  # SFG: 1 tomato per square

        >>> calculate_space_requirement('tomato-1', 12, 'row')
        4  # Row: 24" spacing ÷ 12" grid = 2×2 = 4 cells

        >>> calculate_space_requirement('watermelon-1', 12, 'square-foot')
        4  # SFG: Extra-large plant needs 2×2 grid
    """
    # Find plant in database (needed for all methods except SFG)
    plant = next((p for p in PLANT_DATABASE if p['id'] == plant_id), None)

    # SQUARE FOOT GARDENING: Use SFG lookup table
    if planning_method == 'square-foot':
        return get_sfg_cells_required(plant_id)

    # MIGARDENER METHOD: Ultra-dense spacing with method-specific overrides
    elif planning_method == 'migardener':
        if plant:
            # Check if this is a seed-density planting (e.g., lettuce, arugula)
            if is_seed_density_planting(plant, planning_method):
                # Seed-density calculation: returns cells per seed (not per plant)
                seeds_per_sqft = calculate_seeds_per_sqft(plant)
                return 1.0 / seeds_per_sqft

            # Standard plant-based calculation
            spacing = plant.get('spacing', 12)
            row_spacing = plant.get('rowSpacing', None)
            mg_spacing = get_migardener_spacing(plant_id, spacing, row_spacing)

            # Calculate cells based on tighter spacing
            plant_cells = math.ceil(mg_spacing['plant_spacing'] / grid_size)

            # Handle broadcast mode (null rowSpacing)
            row_spacing_val = mg_spacing.get('row_spacing')
            if row_spacing_val is None or row_spacing_val == 0:
                # Broadcast/intensive planting: space equally in all directions
                return plant_cells * plant_cells
            else:
                row_cells = math.ceil(row_spacing_val / grid_size)
                return plant_cells * row_cells
        return 1  # Fallback for unknown plants

    # INTENSIVE METHOD: Hexagonal packing with bio-intensive spacing
    elif planning_method == 'intensive':
        if plant:
            spacing = plant.get('spacing', 12)
            on_center = get_intensive_spacing(plant_id, spacing)
            return calculate_intensive_cells_required(on_center, grid_size)
        return 1  # Fallback for unknown plants

    # PERMACULTURE METHOD: Uses native plant spacing (equidistant in all directions)
    elif planning_method == 'permaculture':
        if plant:
            spacing = plant.get('spacing', 12)
            sq_inches = spacing * spacing
            return sq_inches / 144.0
        return 1  # Fallback

    # ROW / TRADITIONAL METHOD: Standard spacing calculation (default)
    else:
        if plant:
            spacing = plant.get('spacing', 12)  # Default to 12" if not specified
            cells_per_side = math.ceil(spacing / grid_size)
            return cells_per_side * cells_per_side

        # Fallback: 1 cell for unknown plants
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
