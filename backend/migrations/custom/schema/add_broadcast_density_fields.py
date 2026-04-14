"""
Database migration script to add broadcast planting fields to PlantingEvent model.

Adds support for broadcast/dense patch planting in addition to row-based seeding.
This extends the MIGardener seed density system to handle area-based seeding
(e.g., spinach broadcast at ~50 seeds/sq ft) instead of only row-based seeding
(e.g., seeds per linear inch along rows).

New fields:
- seed_density_per_sq_ft: Seeds per square foot (for broadcast crops)
- grid_cell_area_inches: Grid cell area in square inches
- planting_style: 'row_based', 'broadcast', or 'dense_patch'

Run this script to migrate existing database:
    python backend/add_broadcast_density_fields.py
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

def add_broadcast_fields():
    # Path to database
    db_path = os.path.join('instance', 'homestead.db')

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
            'seed_density_per_sq_ft': False,
            'grid_cell_area_inches': False,
            'planting_style': False
        }

        for col in new_columns:
            if col in columns:
                new_columns[col] = True
                print(f"   INFO: Column '{col}' already exists")

        # Add missing columns
        if not new_columns['seed_density_per_sq_ft']:
            print("   Adding column 'seed_density_per_sq_ft'...")
            cursor.execute("ALTER TABLE planting_event ADD COLUMN seed_density_per_sq_ft REAL")

        if not new_columns['grid_cell_area_inches']:
            print("   Adding column 'grid_cell_area_inches'...")
            cursor.execute("ALTER TABLE planting_event ADD COLUMN grid_cell_area_inches REAL")

        if not new_columns['planting_style']:
            print("   Adding column 'planting_style'...")
            cursor.execute("ALTER TABLE planting_event ADD COLUMN planting_style VARCHAR(20)")

        # Backfill existing records as 'row_based' if they have seed_density
        print("\nBackfilling existing seed density records...")
        cursor.execute("""
            UPDATE planting_event
            SET planting_style = 'row_based'
            WHERE seed_density IS NOT NULL AND planting_style IS NULL
        """)

        rows_updated = cursor.rowcount
        print(f"   SUCCESS: Updated {rows_updated} existing row-based records")

        conn.commit()
        print("\nMigration completed successfully!")
        print("\nNew columns added:")
        print("  - seed_density_per_sq_ft (REAL)")
        print("  - grid_cell_area_inches (REAL)")
        print("  - planting_style (VARCHAR(20))")
        print("\nBackwards compatibility:")
        print(f"  - {rows_updated} existing records marked as 'row_based'")

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
    print("  MIGardener Broadcast Planting Migration")
    print("  Adding broadcast/dense patch support to PlantingEvent model")
    print("=" * 70)
    print()

    success = add_broadcast_fields()

    if success:
        print("\n" + "=" * 70)
        print("  Migration complete! Database is ready for broadcast planting.")
        print("=" * 70)
    else:
        print("\n" + "=" * 70)
        print("  Migration failed. Please check error messages above.")
        print("=" * 70)
