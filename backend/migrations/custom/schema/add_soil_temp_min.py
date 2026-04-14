#!/usr/bin/env python3
"""
Add soil_temp_min field to plant database.

Extracts the minimum germination temperature and adds it as a top-level
field for easier querying and API access.

Migration: germinationTemp.min → soil_temp_min

This script uses AST-based code generation for robust, safe modifications.
"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
from pathlib import Path
from utils.plant_database_updater import PlantDatabaseUpdater


def update_plant_database():
    """Add soil_temp_min field based on germinationTemp.min"""

    # Initialize updater
    updater = PlantDatabaseUpdater()

    print(f"Reading {updater.db_path}...")
    updater.load()

    # Get initial stats
    stats = updater.get_stats()
    print(f"Found {stats['total_plants']} plants in database")

    print("Processing plants to add soil_temp_min field...")

    # Import plant database to read germinationTemp values
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    from plant_database import PLANT_DATABASE

    updated_count = 0
    skipped_count = 0
    missing_data = []

    for plant in PLANT_DATABASE:
        plant_id = plant.get('id')
        if not plant_id:
            continue

        # Check if soil_temp_min already exists
        if 'soil_temp_min' in plant:
            skipped_count += 1
            continue

        # Extract min germination temp
        germ_temp = plant.get('germinationTemp')
        if germ_temp and isinstance(germ_temp, dict):
            min_temp = germ_temp.get('min')
            if min_temp is not None:
                success = updater.add_or_update_fields(plant_id, {
                    'soil_temp_min': min_temp
                })
                if success:
                    updated_count += 1
                else:
                    missing_data.append(plant_id)
            else:
                missing_data.append(f"{plant_id} (no min temp)")
        else:
            missing_data.append(f"{plant_id} (no germinationTemp)")

    print(f"\nUpdated {updated_count} plants")
    print(f"Skipped {skipped_count} plants (already have soil_temp_min)")

    if missing_data:
        print(f"\nWARNING: {len(missing_data)} plants missing germination data:")
        for item in missing_data[:10]:
            print(f"  - {item}")
        if len(missing_data) > 10:
            print(f"  ... and {len(missing_data) - 10} more")

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
        print(f"\n[INFO] No changes needed - all plants already have soil_temp_min")

    print(f"  Plants updated: {updated_count}")
    print(f"  Plants skipped: {skipped_count}")
    if missing_data:
        print(f"  Plants with missing data: {len(missing_data)}")

    return True


if __name__ == '__main__':
    print("=" * 70)
    print("Add soil_temp_min Field to Plant Database")
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
