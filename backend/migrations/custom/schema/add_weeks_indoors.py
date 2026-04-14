#!/usr/bin/env python3
"""
Add weeksIndoors field to all plants in plant_database.py

This field represents how many weeks seedlings should be grown indoors
before transplanting outdoors. This is different from transplantWeeksBefore
which indicates when to transplant relative to the last frost date.

Reference data from Johnny's Seeds and common seed catalogs:
- Tomatoes, eggplant: 6-8 weeks
- Peppers: 8-10 weeks
- Brassicas (broccoli, cabbage, etc.): 4-6 weeks
- Lettuce, greens: 3-4 weeks
- Cucurbits (squash, cucumber, melon): 2-3 weeks
- Onions, leeks: 8-10 weeks
- Herbs: 6-8 weeks

This script uses AST-based code generation for robust, safe modifications.
"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
from pathlib import Path
from utils.plant_database_updater import PlantDatabaseUpdater


# Mapping of plant types to weeks indoors
# Based on Johnny's Seeds and common seed starting guides
WEEKS_INDOORS_MAP = {
    # Solanaceae (nightshades) - need long indoor time
    'tomato': 6,
    'pepper': 8,
    'eggplant': 8,

    # Brassicas - medium indoor time
    'broccoli': 5,
    'cauliflower': 5,
    'cabbage': 5,
    'kale': 4,
    'brussels': 5,
    'kohlrabi': 4,
    'collard': 4,

    # Leafy greens - short indoor time
    'lettuce': 4,
    'spinach': 4,
    'chard': 4,
    'arugula': 3,
    'mache': 3,
    'claytonia': 3,
    'mustard': 3,
    'bok': 4,
    'pak': 4,
    'tatsoi': 4,
    'mizuna': 3,

    # Alliums - long indoor time
    'onion': 10,
    'leek': 10,
    'shallot': 8,
    'garlic': 0,  # Usually not started indoors
    'chives': 8,
    'scallion': 8,

    # Cucurbits - short indoor time (don't transplant well)
    'squash': 3,
    'zucchini': 3,
    'cucumber': 3,
    'melon': 3,
    'pumpkin': 3,
    'watermelon': 3,

    # Root vegetables - usually direct seeded
    'carrot': 0,
    'beet': 4,
    'radish': 0,
    'turnip': 0,
    'parsnip': 0,
    'rutabaga': 0,
    'potato': 0,

    # Legumes - usually direct seeded or short time
    'bean': 0,
    'pea': 0,

    # Herbs
    'basil': 6,
    'parsley': 8,
    'cilantro': 4,
    'dill': 4,
    'oregano': 8,
    'thyme': 8,
    'sage': 8,
    'rosemary': 10,
    'mint': 8,
    'lavender': 10,
    'chervil': 4,
    'tarragon': 8,
    'fennel': 4,

    # Fruits
    'strawberry': 8,

    # Corn - direct seed
    'corn': 0,

    # Flowers
    'marigold': 6,
    'sunflower': 3,
    'zinnia': 4,
    'calendula': 4,

    # Others
    'celery': 10,
    'celeriac': 10,
    'artichoke': 8,
    'asparagus': 12,
    'rhubarb': 0,
    'okra': 4,
    'sorrel': 6,
    'endive': 4,
    'radicchio': 4,
}


def get_weeks_indoors(plant_name):
    """Get weeks indoors based on plant name."""
    name_lower = plant_name.lower()

    # Check each key in our map
    for key, weeks in WEEKS_INDOORS_MAP.items():
        if key in name_lower:
            return weeks

    # Default for unknown plants
    return 4


def update_plant_database():
    """Add weeksIndoors field to all plants in plant_database.py"""

    # Initialize updater
    updater = PlantDatabaseUpdater()

    print(f"Reading {updater.db_path}...")
    updater.load()

    # Get initial stats
    stats = updater.get_stats()
    print(f"Found {stats['total_plants']} plants in database")

    print("Processing plants to add weeksIndoors field...")

    # Import plant database to read plant names
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    from plant_database import PLANT_DATABASE

    updated_count = 0
    skipped_count = 0
    unknown_plants = []

    for plant in PLANT_DATABASE:
        plant_id = plant.get('id')
        plant_name = plant.get('name', '')

        if not plant_id:
            continue

        # Check if weeksIndoors already exists
        if 'weeksIndoors' in plant:
            skipped_count += 1
            continue

        # Determine weeks indoors from plant name
        weeks_indoors = get_weeks_indoors(plant_name)

        # Track if we're using default value
        if weeks_indoors == 4:
            # Check if it was actually matched or defaulted
            name_lower = plant_name.lower()
            matched = any(key in name_lower for key in WEEKS_INDOORS_MAP.keys())
            if not matched:
                unknown_plants.append(f"{plant_name} ({plant_id})")

        success = updater.add_or_update_fields(plant_id, {
            'weeksIndoors': weeks_indoors
        })

        if success:
            updated_count += 1

    print(f"\nUpdated {updated_count} plants")
    print(f"Skipped {skipped_count} plants (already have weeksIndoors)")

    if unknown_plants:
        print(f"\nINFO: {len(unknown_plants)} plants using default value (4 weeks):")
        for item in unknown_plants[:10]:
            print(f"  - {item}")
        if len(unknown_plants) > 10:
            print(f"  ... and {len(unknown_plants) - 10} more")

    # Validate before saving
    print("\nValidating syntax...")
    try:
        updater.validate_syntax()
        print("[PASS] Syntax validation passed")
    except SyntaxError as e:
        print(f"[FAIL] Syntax error: {e}")
        print("Aborting save to prevent corruption")
        return False

    # Save with backup
    if updated_count > 0:
        print(f"\nWriting updated database...")
        updater.save(backup=True)
        print(f"\n[SUCCESS] Successfully updated plant_database.py")
    else:
        print(f"\n[INFO] No changes needed - all plants already have weeksIndoors")

    print(f"  Plants updated: {updated_count}")
    print(f"  Plants skipped: {skipped_count}")
    if unknown_plants:
        print(f"  Plants using default (4 weeks): {len(unknown_plants)}")

    # Print summary of values added
    if updated_count > 0:
        print("\nSummary of weeksIndoors values by plant type:")
        value_counts = {}
        for plant in PLANT_DATABASE:
            if 'weeksIndoors' in plant or plant['id'] in [p.split(' (')[1].rstrip(')') for p in unknown_plants if '(' in p]:
                weeks = get_weeks_indoors(plant.get('name', ''))
                value_counts[weeks] = value_counts.get(weeks, 0) + 1

        for weeks in sorted(value_counts.keys()):
            print(f"  {weeks} weeks: {value_counts[weeks]} plants")

    return True


if __name__ == '__main__':
    print("=" * 70)
    print("Add weeksIndoors Field to Plant Database")
    print("=" * 70)
    print()

    try:
        success = update_plant_database()

        print()
        if success:
            print("[SUCCESS] Migration completed successfully!")
        else:
            print("[FAILED] Migration failed - please check errors above")

    except Exception as e:
        print(f"\n[ERROR] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

    print("=" * 70)
