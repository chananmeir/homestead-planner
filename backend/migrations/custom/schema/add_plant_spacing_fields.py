"""
Database migration script to add plant-spacing fields to PlantingEvent model.

Adds support for plant-spacing planting style (multi-seed spots with thinning).
This extends the MIGardener seed density system to handle crops like beans where
you plant multiple seeds per spot (e.g., 3 seeds) and thin to the healthiest
plant (e.g., keep 1 per spot).

New fields:
- seeds_per_spot: Number of seeds planted per spot (e.g., 3 for beans)
- plants_kept_per_spot: Number of plants kept after thinning (usually 1)

Run this script to migrate existing database:
    python backend/add_plant_spacing_fields.py
"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
import os
import sys

# Fix Windows encoding issues
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

def add_plant_spacing_fields():
    # Path to database
    db_path = os.path.join('instance', 'app.db')

    if not os.path.exists(db_path):
        print(f"ERROR: Database not found at {db_path}")
        print("   Please ensure the database exists before running migration.")
        return False

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        print("Checking existing schema...")

        # Check if columns already exist
        cursor.execute("PRAGMA table_info(planting_event)")
        columns = [column[1] for column in cursor.fetchall()]

        new_columns = {
            'seeds_per_spot': False,
            'plants_kept_per_spot': False
        }

        for col in new_columns:
            if col in columns:
                new_columns[col] = True
                print(f"   INFO: Column '{col}' already exists")

        # Add missing columns
        if not new_columns['seeds_per_spot']:
            print("   Adding column 'seeds_per_spot'...")
            cursor.execute("ALTER TABLE planting_event ADD COLUMN seeds_per_spot INTEGER")

        if not new_columns['plants_kept_per_spot']:
            print("   Adding column 'plants_kept_per_spot'...")
            cursor.execute("ALTER TABLE planting_event ADD COLUMN plants_kept_per_spot INTEGER")

        conn.commit()
        print("\nMigration completed successfully!")
        print("\nNew columns added:")
        print("  - seeds_per_spot (INTEGER)")
        print("  - plants_kept_per_spot (INTEGER)")
        print("\nThese fields support plant-spacing style (multi-seed spots with thinning)")

        return True

    except sqlite3.Error as e:
        print(f"\nERROR: Database error: {e}")
        return False
    except Exception as e:
        print(f"\nERROR: Unexpected error: {e}")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    print("=" * 70)
    print("  MIGardener Plant-Spacing Migration")
    print("  Adding plant-spacing support to PlantingEvent model")
    print("=" * 70)
    print()

    success = add_plant_spacing_fields()

    if success:
        print("\n" + "=" * 70)
        print("  Migration complete! Database is ready for plant-spacing.")
        print("=" * 70)
    else:
        print("\n" + "=" * 70)
        print("  Migration failed. Please check error messages above.")
        print("=" * 70)
