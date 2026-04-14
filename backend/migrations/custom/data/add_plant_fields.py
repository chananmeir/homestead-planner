#!/usr/bin/env python3
"""
Script to add new fields to PLANT_DATABASE using AST parsing:
- germination_days: Days from planting to emergence
- ideal_seasons: Optimal planting seasons
- heat_tolerance: General heat tolerance rating

This version uses programmatic AST modification instead of regex,
making it robust against formatting variations.
"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
from pathlib import Path
from utils.plant_database_updater import PlantDatabaseUpdater


# Field values based on plant characteristics
PLANT_ENHANCEMENTS = {
    # Winter Hardy Greens
    'spinach-1': {
        'germination_days': 7,
        'ideal_seasons': ['spring', 'fall', 'winter'],
        'heat_tolerance': 'low'
    },
    'kale-1': {
        'germination_days': 5,
        'ideal_seasons': ['spring', 'fall', 'winter'],
        'heat_tolerance': 'low'
    },
    'lettuce-1': {
        'germination_days': 7,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'low'
    },
    'lettuce-looseleaf-1': {
        'germination_days': 7,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'low'
    },
    'lettuce-romaine-1': {
        'germination_days': 7,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'low'
    },
    'lettuce-butterhead-1': {
        'germination_days': 7,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'low'
    },
    'lettuce-crisphead-1': {
        'germination_days': 8,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'low'
    },
    'lettuce-summercrisp-1': {
        'germination_days': 7,
        'ideal_seasons': ['spring', 'summer', 'fall'],
        'heat_tolerance': 'medium'
    },
    'arugula-1': {
        'germination_days': 5,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'low'
    },
    'mizuna-1': {
        'germination_days': 4,
        'ideal_seasons': ['spring', 'fall', 'winter'],
        'heat_tolerance': 'low'
    },
    'chard-1': {
        'germination_days': 7,
        'ideal_seasons': ['spring', 'summer', 'fall'],
        'heat_tolerance': 'medium'
    },

    # Root Vegetables
    'carrot-1': {
        'germination_days': 10,
        'ideal_seasons': ['spring', 'summer', 'fall'],
        'heat_tolerance': 'medium'
    },
    'beet-1': {
        'germination_days': 7,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'medium'
    },
    'radish-1': {
        'germination_days': 4,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'low'
    },
    'turnip-1': {
        'germination_days': 5,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'low'
    },
    'parsnip-1': {
        'germination_days': 14,
        'ideal_seasons': ['spring', 'summer'],
        'heat_tolerance': 'medium'
    },

    # Brassicas
    'broccoli-1': {
        'germination_days': 5,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'low'
    },
    'cauliflower-1': {
        'germination_days': 5,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'low'
    },
    'cabbage-1': {
        'germination_days': 5,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'low'
    },
    'brussels-sprouts-1': {
        'germination_days': 5,
        'ideal_seasons': ['summer', 'fall'],
        'heat_tolerance': 'low'
    },

    # Summer Vegetables
    'tomato-1': {
        'germination_days': 7,
        'ideal_seasons': ['summer'],
        'heat_tolerance': 'high'
    },
    'tomato-cherry-1': {
        'germination_days': 7,
        'ideal_seasons': ['summer'],
        'heat_tolerance': 'high'
    },
    'pepper-bell-1': {
        'germination_days': 10,
        'ideal_seasons': ['summer'],
        'heat_tolerance': 'high'
    },
    'pepper-hot-1': {
        'germination_days': 10,
        'ideal_seasons': ['summer'],
        'heat_tolerance': 'excellent'
    },
    'eggplant-1': {
        'germination_days': 10,
        'ideal_seasons': ['summer'],
        'heat_tolerance': 'excellent'
    },

    # Cucurbits
    'cucumber-1': {
        'germination_days': 6,
        'ideal_seasons': ['summer'],
        'heat_tolerance': 'high'
    },
    'zucchini-1': {
        'germination_days': 6,
        'ideal_seasons': ['summer'],
        'heat_tolerance': 'high'
    },
    'squash-summer-1': {
        'germination_days': 6,
        'ideal_seasons': ['summer'],
        'heat_tolerance': 'high'
    },
    'squash-winter-1': {
        'germination_days': 7,
        'ideal_seasons': ['summer'],
        'heat_tolerance': 'high'
    },
    'pumpkin-1': {
        'germination_days': 7,
        'ideal_seasons': ['summer'],
        'heat_tolerance': 'high'
    },
    'melon-1': {
        'germination_days': 7,
        'ideal_seasons': ['summer'],
        'heat_tolerance': 'excellent'
    },
    'watermelon-1': {
        'germination_days': 7,
        'ideal_seasons': ['summer'],
        'heat_tolerance': 'excellent'
    },

    # Legumes
    'pea-1': {
        'germination_days': 7,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'low'
    },
    'bean-bush-1': {
        'germination_days': 7,
        'ideal_seasons': ['summer'],
        'heat_tolerance': 'high'
    },
    'bean-pole-1': {
        'germination_days': 7,
        'ideal_seasons': ['summer'],
        'heat_tolerance': 'high'
    },

    # Alliums
    'onion-1': {
        'germination_days': 7,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'medium'
    },
    'garlic-1': {
        'germination_days': 7,
        'ideal_seasons': ['fall'],
        'heat_tolerance': 'medium'
    },
    'leek-1': {
        'germination_days': 10,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'low'
    },
    'scallion-1': {
        'germination_days': 7,
        'ideal_seasons': ['spring', 'summer', 'fall'],
        'heat_tolerance': 'medium'
    },
    'chives-1': {
        'germination_days': 10,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'medium'
    },

    # Corn & Grain
    'corn-1': {
        'germination_days': 7,
        'ideal_seasons': ['summer'],
        'heat_tolerance': 'excellent'
    },

    # Herbs
    'basil-1': {
        'germination_days': 7,
        'ideal_seasons': ['summer'],
        'heat_tolerance': 'excellent'
    },
    'cilantro-1': {
        'germination_days': 7,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'low'
    },
    'parsley-1': {
        'germination_days': 14,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'medium'
    },
    'dill-1': {
        'germination_days': 10,
        'ideal_seasons': ['spring', 'summer'],
        'heat_tolerance': 'medium'
    },
    'thyme-1': {
        'germination_days': 14,
        'ideal_seasons': ['spring', 'summer'],
        'heat_tolerance': 'high'
    },
    'oregano-1': {
        'germination_days': 10,
        'ideal_seasons': ['spring', 'summer'],
        'heat_tolerance': 'high'
    },
    'sage-1': {
        'germination_days': 14,
        'ideal_seasons': ['spring'],
        'heat_tolerance': 'high'
    },
    'rosemary-1': {
        'germination_days': 21,
        'ideal_seasons': ['spring'],
        'heat_tolerance': 'high'
    },
    'mint-1': {
        'germination_days': 10,
        'ideal_seasons': ['spring', 'summer'],
        'heat_tolerance': 'medium'
    },

    # Other
    'asparagus-1': {
        'germination_days': 21,
        'ideal_seasons': ['spring'],
        'heat_tolerance': 'medium'
    },
    'rhubarb-1': {
        'germination_days': 14,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'low'
    },
    'potato-1': {
        'germination_days': 14,
        'ideal_seasons': ['spring', 'summer'],
        'heat_tolerance': 'medium'
    },
    'sweet-potato-1': {
        'germination_days': 14,
        'ideal_seasons': ['summer'],
        'heat_tolerance': 'excellent'
    },
    'celery-1': {
        'germination_days': 14,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'low'
    },
    'fennel-1': {
        'germination_days': 10,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'medium'
    },
    'kohlrabi-1': {
        'germination_days': 5,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'low'
    },
    'strawberry-1': {
        'germination_days': 21,
        'ideal_seasons': ['spring', 'fall'],
        'heat_tolerance': 'medium'
    },
}


def update_plant_database():
    """Read, update, and write plant_database.py with new fields using AST."""

    # Initialize updater
    updater = PlantDatabaseUpdater()

    print(f"Reading {updater.db_path}...")
    updater.load()

    # Get initial stats
    stats = updater.get_stats()
    print(f"Found {stats['total_plants']} plants in database")

    print(f"Processing {len(PLANT_ENHANCEMENTS)} plant entries...")

    # Update each plant
    updated_count = 0
    not_found = []

    for plant_id, enhancements in PLANT_ENHANCEMENTS.items():
        success = updater.add_or_update_fields(plant_id, enhancements)
        if success:
            updated_count += 1
        else:
            not_found.append(plant_id)

    print(f"Updated {updated_count} plants")

    if not_found:
        print(f"\nWARNING: {len(not_found)} plants not found in database:")
        for plant_id in not_found[:10]:  # Show first 10
            print(f"  - {plant_id}")
        if len(not_found) > 10:
            print(f"  ... and {len(not_found) - 10} more")

    # Validate before saving
    print("\nValidating syntax...")
    try:
        updater.validate_syntax()
        print("✓ Syntax validation passed")
    except SyntaxError as e:
        print(f"✗ Syntax error: {e}")
        print("Aborting save to prevent corruption")
        return

    # Save with backup
    print(f"\nWriting updated database...")
    updater.save(backup=True)

    print(f"\n✓ Successfully updated plant_database.py")
    print(f"  Added fields: germination_days, ideal_seasons, heat_tolerance")
    print(f"  Plants updated: {updated_count}")
    if not_found:
        print(f"  Plants not found: {len(not_found)}")


if __name__ == '__main__':
    update_plant_database()
