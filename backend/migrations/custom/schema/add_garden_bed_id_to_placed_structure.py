"""
Migration script to add garden_bed_id column to PlacedStructure table.
This allows linking placed structures back to their source garden beds.

Run with: python add_garden_bed_id_to_placed_structure.py
"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
import os

def run_migration():
    # Get the database path - check multiple locations
    # Use backend_dir from path injection above
    possible_paths = [
        os.path.join(backend_dir, 'instance', 'homestead_planner.db'),
        os.path.join(backend_dir, 'instance', 'homestead.db'),
        os.path.join(backend_dir, 'homestead.db'),
    ]

    db_path = None
    for path in possible_paths:
        if os.path.exists(path):
            # Skip empty files (0 bytes) - they're placeholders
            if os.path.getsize(path) > 0:
                db_path = path
                break

    if not db_path:
        print("[ERROR] Database not found in any of these locations:")
        for path in possible_paths:
            print(f"        - {path}")
        print("        Make sure you're running this from the backend directory")
        return False

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(placed_structure)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'garden_bed_id' in columns:
            print("Column 'garden_bed_id' already exists in placed_structure table")
            return True

        # Add the new column
        cursor.execute("""
            ALTER TABLE placed_structure
            ADD COLUMN garden_bed_id INTEGER REFERENCES garden_bed(id)
        """)

        conn.commit()
        print("Successfully added 'garden_bed_id' column to placed_structure table")
        return True

    except sqlite3.Error as e:
        print(f"Error during migration: {e}")
        conn.rollback()
        return False

    finally:
        conn.close()

if __name__ == '__main__':
    run_migration()
