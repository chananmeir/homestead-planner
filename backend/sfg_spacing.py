"""
Square Foot Gardening (SFG) Spacing Calculator

Calculates how many grid cells a plant needs in a Square Foot Gardening bed.
Uses the existing SFG_SPACING dictionary from garden_methods.py which contains
Mel Bartholomew's official spacing guidelines.
"""

from garden_methods import SFG_SPACING


def get_sfg_cells_required(plant_id):
    """
    Calculate grid cells required per plant in SFG bed.

    Args:
        plant_id (str): Plant identifier (e.g., 'tomato-1', 'pepper-1')

    Returns:
        float: Fractional grid cells needed per plant
            - 1 plant/sqft: 1.0 cells per plant
            - 4 plants/sqft: 0.25 cells per plant
            - 16 plants/sqft: 0.0625 cells per plant
            - 0.5 plants/sqft: 2.0 cells per plant (extra-large)

    Examples:
        >>> get_sfg_cells_required('tomato-1')
        1.0  # 1 plant per square = 1 cell per plant

        >>> get_sfg_cells_required('lettuce-1')
        0.25  # 4 plants per square = 0.25 cells per plant

        >>> get_sfg_cells_required('carrot-1')
        0.0625  # 16 plants per square = 0.0625 cells per plant

        >>> get_sfg_cells_required('watermelon-1')
        2.0  # 0.5 plants per square = 2 cells per plant
    """
    # Remove numeric variant suffix (e.g., 'tomato-1' → 'tomato', 'lettuce-head-1' → 'lettuce-head')
    # Split from the right and check if last part is numeric
    parts = plant_id.rsplit('-', 1)
    if len(parts) == 2 and parts[1].isdigit():
        base_plant = parts[0]
    else:
        base_plant = plant_id

    # First pass: Look for exact matches (highest priority)
    for plants_per_square, plant_list in SFG_SPACING.items():
        if base_plant in plant_list:
            return 1.0 / plants_per_square

    # Second pass: Look for prefix matches (e.g., 'lettuce-leaf' contains 'lettuce')
    # Only match if pattern starts with base_plant (not vice versa)
    # This prevents 'lettuce' matching 'lettuce-head' which is a different variety
    for plants_per_square, plant_list in SFG_SPACING.items():
        for plant_pattern in plant_list:
            # Only match if the pattern contains the base plant as a prefix
            # e.g., 'lettuce-leaf' matches 'lettuce' but 'lettuce-head' doesn't
            if plant_pattern.startswith(base_plant + '-') or plant_pattern == base_plant:
                return 1.0 / plants_per_square

    # Default: 1 cell per plant for unknown plants (standard SFG spacing)
    return 1.0


# Example usage for testing
if __name__ == '__main__':
    test_plants = [
        'tomato-1',
        'pepper-1',
        'lettuce-1',
        'carrot-1',
        'watermelon-1',
        'pumpkin-1',
        'unknown-plant-1',
    ]

    print("SFG Cell Requirements:")
    print("=" * 40)
    for plant in test_plants:
        cells = get_sfg_cells_required(plant)
        print(f"{plant:20} = {cells} cell(s)")
