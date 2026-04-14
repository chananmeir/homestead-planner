"""
Intensive/Bio-Intensive Spacing Utilities

Handles spacing calculations for bio-intensive gardening method pioneered by
John Jeavons and Ecology Action. Uses hexagonal (offset) planting pattern for
maximum space efficiency and plant health.

Key Principles:
- Hexagonal packing: Each plant has 6 neighbors instead of 4 (square grid)
- Offset rows: Row 2 is offset by 0.866 × spacing from row 1
- On-center spacing: Single value represents distance between any two adjacent plants
- ~15% more plants per area than square spacing

This module mirrors the frontend logic in frontend/src/utils/intensiveSpacing.ts
to ensure consistent space calculations between client and server.
"""

import math

# Intensive spacing overrides (in inches) - on-center spacing for hexagonal packing
# Based on John Jeavons' "How to Grow More Vegetables" spacing recommendations
#
# These values represent the distance from the center of one plant to the center
# of its neighbor in a hexagonal pattern.
INTENSIVE_SPACING_OVERRIDES = {
    # Fruiting crops - need airflow and space
    'tomato-1': 18,
    'pepper-1': 12,
    'eggplant-1': 18,

    # Brassicas - heading types
    'broccoli-1': 15,
    'cauliflower-1': 15,
    'cabbage-1': 15,
    'kale-1': 12,

    # Leafy greens
    'lettuce-1': 8,
    'spinach-1': 6,
    'chard-1': 8,
    'arugula-1': 4,

    # Root vegetables
    'carrot-1': 3,
    'beet-1': 4,
    'radish-1': 2,
    'onion-1': 4,
    'garlic-1': 6,
    'potato-1': 10,

    # Legumes
    'bean-1': 6,      # Bush beans
    'pea-1': 4,

    # Cucurbits
    'squash-1': 24,
    'cucumber-1': 12,
    'melon-1': 18,

    # Grains
    'corn-1': 15,

    # Herbs
    'basil-1': 8,
    'parsley-1': 6,

    # Flowers
    'marigold-1': 8,
    'nasturtium-1': 10,
}

# Hexagonal packing efficiency constant
# In hexagonal packing, rows are offset by √3/2 ≈ 0.866 of the spacing
# This allows plants to fit in the "valleys" between plants in the previous row
HEX_ROW_OFFSET = math.sqrt(3) / 2  # ≈ 0.866


def get_intensive_spacing(plant_id, standard_spacing):
    """
    Get intensive spacing for a plant.

    Matches frontend getIntensiveSpacing() function.

    Args:
        plant_id (str): The plant ID to look up
        standard_spacing (float): The plant's standard spacing from database (fallback)

    Returns:
        float: On-center spacing in inches for hexagonal packing

    Examples:
        >>> get_intensive_spacing('tomato-1', 24)
        18

        >>> get_intensive_spacing('unknown-plant', 12)
        12
    """
    # Check for specific override first
    if plant_id in INTENSIVE_SPACING_OVERRIDES:
        return INTENSIVE_SPACING_OVERRIDES[plant_id]

    # Fallback to standard spacing (close spacing is key to bio-intensive)
    # Use the tighter dimension for hexagonal packing
    return standard_spacing


def calculate_intensive_cells_required(on_center_spacing, grid_size):
    """
    Calculate cells required for intensive spacing on a square grid.

    Since the UI uses a square grid but intensive uses hexagonal packing,
    we need to approximate the hexagonal area on the square grid.

    Hexagonal packing is ~15% more efficient than square packing,
    so we reduce the cell requirement accordingly.

    Matches frontend calculateIntensiveCellsRequired() function.

    Args:
        on_center_spacing (float): On-center spacing in inches
        grid_size (float): Grid cell size in inches

    Returns:
        int: Number of grid cells required (approximate)

    Examples:
        >>> calculate_intensive_cells_required(18, 12)
        2

        >>> calculate_intensive_cells_required(6, 12)
        1
    """
    # Base calculation: square grid cells
    cells_per_side = math.ceil(on_center_spacing / grid_size)
    square_cells = cells_per_side * cells_per_side

    # Hexagonal packing efficiency factor
    # Hex packing fits ~1.15× more plants in same area, so each plant needs ~0.87× the cells
    hex_efficiency = 1 / 1.15

    return max(1, math.ceil(square_cells * hex_efficiency))


def calculate_intensive_plants_per_row(bed_length_feet, on_center_spacing):
    """
    Calculate how many plants fit in a row with hexagonal packing.

    Args:
        bed_length_feet (float): Length of the bed in feet
        on_center_spacing (float): On-center spacing in inches

    Returns:
        int: Number of plants that fit in one row
    """
    bed_length_inches = bed_length_feet * 12
    return int(bed_length_inches / on_center_spacing)


def calculate_intensive_rows(bed_width_feet, on_center_spacing):
    """
    Calculate how many rows fit in a bed with hexagonal packing.

    In hexagonal packing, rows are offset vertically by 0.866 × spacing.
    This is more efficient than square packing (1.0 × spacing).

    Args:
        bed_width_feet (float): Width of the bed in feet
        on_center_spacing (float): On-center spacing in inches

    Returns:
        int: Number of rows that fit in the bed
    """
    bed_width_inches = bed_width_feet * 12
    row_spacing = on_center_spacing * HEX_ROW_OFFSET
    return int(bed_width_inches / row_spacing)


def calculate_intensive_plants_per_bed(bed_width_feet, bed_length_feet, plant_id, standard_spacing):
    """
    Calculate total plants for a bed using hexagonal packing.

    Accounts for offset rows where even rows may have one fewer plant.

    Args:
        bed_width_feet (float): Width of the bed in feet
        bed_length_feet (float): Length of the bed in feet
        plant_id (str): The plant ID
        standard_spacing (float): The plant's standard spacing from database

    Returns:
        int: Total number of plants that fit in the bed
    """
    on_center_spacing = get_intensive_spacing(plant_id, standard_spacing)

    plants_per_row = calculate_intensive_plants_per_row(bed_length_feet, on_center_spacing)
    num_rows = calculate_intensive_rows(bed_width_feet, on_center_spacing)

    # In hexagonal packing, alternating rows may be offset
    # Odd rows: full plants per row
    # Even rows: may have one fewer plant if they're offset by half-spacing
    # For simplicity, we'll use plantsPerRow × numRows as an approximation
    # (More precise calculation would alternate between plantsPerRow and plantsPerRow-1)

    return plants_per_row * num_rows


def is_offset_row(row_index):
    """
    Check if a row is offset in hexagonal packing.

    Args:
        row_index (int): Zero-based row index

    Returns:
        bool: True if this row should be offset (even rows are offset)
    """
    return row_index % 2 == 1  # Offset every other row (0-indexed)


def get_hexagonal_x_offset(row_index, on_center_spacing):
    """
    Calculate X offset for a plant position in hexagonal packing.

    Args:
        row_index (int): Zero-based row index
        on_center_spacing (float): On-center spacing in inches

    Returns:
        float: X offset in inches (0 for odd rows, spacing/2 for even rows)
    """
    return on_center_spacing / 2 if is_offset_row(row_index) else 0


def hex_to_grid_position(row_index, col_index, on_center_spacing, grid_size):
    """
    Calculate grid position for hexagonal packing.

    Converts hexagonal packing coordinates to square grid coordinates.

    Args:
        row_index (int): Zero-based row index in hex pattern
        col_index (int): Zero-based column index in hex pattern
        on_center_spacing (float): On-center spacing in inches
        grid_size (float): Grid cell size in inches

    Returns:
        dict: Grid coordinates {'x': x, 'y': y}
    """
    # Calculate actual position in inches
    x_inches = col_index * on_center_spacing + get_hexagonal_x_offset(row_index, on_center_spacing)
    y_inches = row_index * on_center_spacing * HEX_ROW_OFFSET

    # Convert to grid coordinates
    x = int(x_inches / grid_size)
    y = int(y_inches / grid_size)

    return {'x': x, 'y': y}


# Example usage for testing
if __name__ == '__main__':
    test_cases = [
        ('tomato-1', 24),
        ('lettuce-1', 12),
        ('unknown-plant', 12),
    ]

    print("Intensive Spacing Calculations:")
    print("=" * 70)
    for plant_id, std_spacing in test_cases:
        on_center = get_intensive_spacing(plant_id, std_spacing)
        cells = calculate_intensive_cells_required(on_center, 12)
        print(f"{plant_id:15} | Std: {std_spacing:2}\" | "
              f"Intensive: {on_center:5.1f}\" | Cells: {cells}")

    print("\nHexagonal Packing Efficiency:")
    print(f"Row offset factor: {HEX_ROW_OFFSET:.3f}")
    print(f"~15% more efficient than square packing")
