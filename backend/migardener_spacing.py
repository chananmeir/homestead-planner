"""
MIGardener Spacing Utilities

Handles spacing calculations for Luke Marion's high-intensity gardening method.
MIGardener uses much tighter spacing than traditional gardening, based on
direct-seeding and natural plant self-thinning.

This module mirrors the frontend logic in frontend/src/utils/migardenerSpacing.ts
to ensure consistent space calculations between client and server.
"""

# MIGardener-specific spacing overrides (in inches)
# Format: (row_spacing, plant_spacing)
# - row_spacing: inches between rows (None = no row restriction, intensive planting)
# - plant_spacing: inches between plants within a row
MIGARDENER_SPACING_OVERRIDES = {
    # Leafy Greens - Row-based for cut-and-come-again harvest
    'lettuce-1': (4, 1),      # Row-based: 4" row spacing, 1" seed spacing (1 seed/inch density)
    'arugula-1': (4, 1),      # Row-based: 4" row spacing, 1" seed spacing (1 seed/inch density)
    'spinach-1': (None, 4),   # Intensive/broadcast: 4" plant spacing, no row restriction (patch method)
    'kale-1': (None, 8),      # Intensive: 8" plant spacing for leaf harvest, no row limit
    'chard-1': (None, 9),     # Intensive: 9" plant spacing, no row limit
    'mustard-1': (None, 3),   # Intensive: 3" plant spacing, no row limit
    'bok-choy-1': (8, 6),     # Needs space for head formation (traditional row spacing)

    # Brassicas - Heading Types (need space for head development)
    'cabbage-1': (18, 12),    # Leaves should slightly overlap
    'broccoli-1': (18, 12),   # Space for head development
    'cauliflower-1': (18, 12),# Space for head development
    'brussels-sprouts-1': (24, 18),  # Vertical growth, needs air circulation

    # Root Vegetables & Tubers - Dense sowing, then thin
    'radish-1': (4, 1),       # Sow 1" apart, thin to 1-1.5" (36/sqft)
    'carrot-1': (6, 2),       # Sow densely, thin to 1.5-2" when 3-4 weeks old
    'beet-1': (12, 3),        # 3" for high-density (smaller beets), 4" for larger bulbs
    'turnip-1': (8, 3),       # Similar to beets
    'parsnip-1': (12, 3),     # Long roots, needs depth more than width
    'onion-1': (4, 4),        # 3-4" on center for medium bulbs, weed suppression
    'scallion-1': (4, 2),     # Green onions can be denser
    'potato-1': (20, 9),      # 20" rows (7 per 12' bed), 9" in-row - Luke Marion reference

    # Legumes - Closer than traditional methods
    'pea-1': (60, 1.5),       # Can sow 1-2" apart in 3" band at trellis base; 48-72" between rows
    'bean-1': (18, 5.5),      # Bush beans: 4-7" between plants, 18" row gap for airflow
    'bean-bush-1': (18, 6),   # Bush beans: 6" final spacing, 18" row spacing for airflow
    'bean-pole-1': (18, 6),   # Pole beans: 6" final spacing, 18" row spacing for airflow
    'pole-beans-1': (36, 6),  # Pole beans: 6" spacing on trellis, 36" row spacing

    # Nightshade Family
    'tomato-1': (24, 18),     # 18" between plants, 24" rows - tighter than traditional but needs airflow
    'pepper-1': (21, 18),     # 18" minimum spacing (Luke Marion rule), ~21" rows
    'eggplant-1': (18, 15),   # 15" standard spacing (12-18" range), 18" rows

    # Cucumber Family
    'cucumber-1': (18, 12),             # Generic cucumber: bush spacing as safe default
    'cucumber-wisconsin-smr-pickling': (18, 12),  # Pickling variety: bush spacing
    'cucumber-bush-1': (18, 12),        # Bush: 12" spacing, compact varieties
    'cucumber-vining-trellised-1': (24, 18),  # Trellised: 18" minimum, airflow critical
    'cucumber-vining-ground-1': (48, 36),     # Ground: 36" (3 ft) MINIMUM - airflow for disease prevention

    # Melons & Large Crops
    'watermelon-1': (72, 60),  # 60" (5 ft) NON-NEGOTIABLE - "garden hog" (25 sq ft per plant)
    'okra-1': (18, 10),        # 10" spacing, tall/spindly, minimal horizontal spread

    # Grains & Block Crops
    'corn-1': (12, 6),         # 6" spacing, requires 4×4 ft minimum block for pollination
    'sunflower-single-headed-1': (18, 15),  # 15" spacing (12-18" range), giant varieties
    'peanut-1': (24, 18),      # 18" minimum, wide spacing for stem sprawl

    # Leafy Discretes & Root Vegetables
    'swiss-chard-1': (12, 9),  # 9" spacing (8-10" range), discrete plants not row-based
    'celery-1': (18, 12),      # 12" spacing, transplants only

    # Perennial & Long-Cycle Crops
    'asparagus-1': (12, 8),    # 8" spacing (7-8" range), crown at soil line
    'artichoke-1': (48, 36),   # 36" spacing, large perennial, 2.5-3 ft wide
    'ginger-1': (30, 24),      # 24" spacing (18-24" range), spreads sideways not down
    'grape-1': (72, 60),       # 60" (5 ft) linear trellis allocation per vine
    'blackberry-1': (96, 36),  # 36" between canes, 96" between rows for access
    'raspberry-1': (72, 24),   # 24" between canes, 72" between rows
    'fig-1': (78, 66),         # 66" spacing (5-6 ft range), very wide canopy
    'goji-berry-1': (36, 30),  # 30" spacing (2-3 ft range), tall/floppy/wide

    # Shallots
    'shallot-from-sets': (12, 10),  # 10" spacing (8-10" range), cluster bulb formation
    'shallot-from-seed': (6, 3),    # 3" spacing (2-3" range), single bulb production

    # Herbs - Varies by use (microgreens vs. mature plants)
    'cilantro-1': (4, 2),      # Dense for microgreens/baby leaves
    'basil-1': (12, 8),        # Needs air circulation, 6-10" spacing (updated from reference: 6")
    'parsley-1': (8, 4),       # Moderate density
    'dill-1': (12, 6),         # Needs space for feathery growth
    'bee-balm-1': (30, 24),    # 24" spacing, spreads over time (mint family)
}

# Fallback multiplier for crops without specific MIGardener overrides
# Applies a 4:1 density increase to standard spacing
MIGARDENER_DEFAULT_MULTIPLIER = 0.25


def get_migardener_spacing(plant_id, standard_spacing, standard_row_spacing=None):
    """
    Calculate spacing for a plant in MIGardener bed.

    Matches frontend getMIGardenerSpacing() function.

    Args:
        plant_id (str): The plant ID to look up
        standard_spacing (float): The plant's standard within-row spacing from database
        standard_row_spacing (float, optional): The plant's standard row-to-row spacing

    Returns:
        dict: Dictionary with 'row_spacing' and 'plant_spacing' in inches

    Examples:
        >>> get_migardener_spacing('lettuce-1', 12, None)
        {'row_spacing': 4, 'plant_spacing': 4}

        >>> get_migardener_spacing('unknown-plant', 8, 16)
        {'row_spacing': 4.0, 'plant_spacing': 2.0}
    """
    # Check for specific override first
    if plant_id in MIGARDENER_SPACING_OVERRIDES:
        row_spacing, plant_spacing = MIGARDENER_SPACING_OVERRIDES[plant_id]
        return {'row_spacing': row_spacing, 'plant_spacing': plant_spacing}

    # Fall back to applying multiplier to standard spacing
    plant_spacing = standard_spacing * MIGARDENER_DEFAULT_MULTIPLIER
    row_spacing = (standard_row_spacing * MIGARDENER_DEFAULT_MULTIPLIER
                   if standard_row_spacing else standard_spacing)

    return {'row_spacing': row_spacing, 'plant_spacing': plant_spacing}


def calculate_migardener_plants_per_row(bed_length_feet, plant_id, standard_spacing, standard_row_spacing=None):
    """
    Calculate how many plants fit in a row for MIGardener bed.

    Args:
        bed_length_feet (float): Length of the bed in feet (horizontal dimension)
        plant_id (str): The plant ID
        standard_spacing (float): The plant's standard spacing from database
        standard_row_spacing (float, optional): The plant's standard row spacing

    Returns:
        int: Number of plants that fit in one row
    """
    bed_length_inches = bed_length_feet * 12
    spacing = get_migardener_spacing(plant_id, standard_spacing, standard_row_spacing)
    return int(bed_length_inches / spacing['plant_spacing'])


def calculate_migardener_rows(bed_width_feet, plant_id, standard_spacing, standard_row_spacing=None):
    """
    Calculate how many rows fit in a MIGardener bed.

    Args:
        bed_width_feet (float): Width of the bed in feet (vertical dimension)
        plant_id (str): The plant ID
        standard_spacing (float): The plant's standard spacing from database
        standard_row_spacing (float, optional): The plant's standard row spacing

    Returns:
        int: Number of rows that fit in the bed
    """
    spacing = get_migardener_spacing(plant_id, standard_spacing, standard_row_spacing)

    # If row_spacing is None or 0, this is an intensive crop with no row restrictions
    # Return maximum grid rows based on bed width and default grid size (3")
    if spacing['row_spacing'] is None or spacing['row_spacing'] == 0:
        bed_width_inches = bed_width_feet * 12
        grid_size = 3  # Default grid size in inches
        return int(bed_width_inches / grid_size)

    # Traditional row-based crops: calculate based on row spacing
    bed_width_inches = bed_width_feet * 12
    return int(bed_width_inches / spacing['row_spacing'])


# Example usage for testing
if __name__ == '__main__':
    test_cases = [
        ('lettuce-1', 12, None),
        ('arugula-1', 12, None),
        ('tomato-1', 24, 36),
        ('unknown-plant', 8, 16),
    ]

    print("MIGardener Spacing Calculations:")
    print("=" * 70)
    for plant_id, std_spacing, row_spacing in test_cases:
        result = get_migardener_spacing(plant_id, std_spacing, row_spacing)
        print(f"{plant_id:15} | Std: {std_spacing:2}\" | "
              f"MG Row: {result['row_spacing']:5.1f}\" | MG Plant: {result['plant_spacing']:5.1f}\"")
