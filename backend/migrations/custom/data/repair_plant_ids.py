#!/usr/bin/env python3
"""
Data Repair Script: Update deprecated plant_ids to canonical IDs in seed_inventory.

This script migrates seed_inventory rows from deprecated/variety-specific plant IDs
to canonical plant IDs (e.g., 'chia-white' -> 'chia-1').

Usage:
  cd backend
  python migrations/custom/data/repair_plant_ids.py --dry-run   # Preview changes
  python migrations/custom/data/repair_plant_ids.py             # Apply changes

After running, you can remove deprecated entries from plant_database.py
and aliases from frontend/src/utils/plantIdResolver.ts
"""

import argparse
import sys
from datetime import datetime

# Alias map: deprecated plant_id -> canonical plant_id
# Keep in sync with frontend/src/utils/plantIdResolver.ts::PLANT_ID_ALIASES
PLANT_ID_ALIASES = {
    'chia-white': 'chia-1',
    # Add more aliases as needed:
    # 'old-plant-id': 'new-canonical-id',
}


def main():
    parser = argparse.ArgumentParser(description='Repair deprecated plant_ids in seed_inventory')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without applying')
    args = parser.parse_args()

    # Import Flask app and models
    try:
        sys.path.insert(0, '.')
        from app import app, db
        from models import SeedInventory
    except ImportError as e:
        print(f"ERROR: Run from backend directory with venv activated. {e}")
        sys.exit(1)

    print("=" * 60)
    print("Plant ID Repair Script")
    print("=" * 60)
    print(f"Mode: {'DRY RUN (no changes)' if args.dry_run else 'LIVE (will modify database)'}")
    print(f"Aliases to migrate: {len(PLANT_ID_ALIASES)}")
    for old_id, new_id in PLANT_ID_ALIASES.items():
        print(f"  - '{old_id}' -> '{new_id}'")
    print()

    with app.app_context():
        total_updated = 0

        for old_id, new_id in PLANT_ID_ALIASES.items():
            # Find seeds with the deprecated plant_id
            seeds = SeedInventory.query.filter_by(plant_id=old_id).all()

            if not seeds:
                print(f"[SKIP] No seeds found with plant_id='{old_id}'")
                continue

            print(f"[FOUND] {len(seeds)} seed(s) with plant_id='{old_id}':")
            for seed in seeds:
                print(f"  - ID {seed.id}: {seed.variety} (user_id={seed.user_id})")

            if not args.dry_run:
                # Update the plant_id
                for seed in seeds:
                    seed.plant_id = new_id
                    total_updated += 1

                db.session.commit()
                print(f"  -> Updated {len(seeds)} seed(s) to plant_id='{new_id}'")
            else:
                print(f"  -> Would update {len(seeds)} seed(s) to plant_id='{new_id}'")
                total_updated += len(seeds)

            print()

        print("=" * 60)
        if args.dry_run:
            print(f"DRY RUN COMPLETE: Would update {total_updated} seed(s)")
            print("Run without --dry-run to apply changes.")
        else:
            print(f"MIGRATION COMPLETE: Updated {total_updated} seed(s)")
            print()
            print("Next steps:")
            print("1. Test the application to verify seeds work correctly")
            print("2. Remove deprecated entries from backend/plant_database.py")
            print("3. Remove aliases from frontend/src/utils/plantIdResolver.ts")
        print("=" * 60)


if __name__ == '__main__':
    main()
