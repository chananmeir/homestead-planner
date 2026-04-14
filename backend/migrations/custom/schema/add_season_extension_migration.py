"""
Migration script to add season_extension column to garden_bed table.
This allows beds to have protection structures (cold frames, tunnels, etc.)
that affect frost/soil temperature calculations.

Run this script once to update your database schema.
"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
import os

def migrate():
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

    print(f"Using database: {db_path}\n")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(garden_bed)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'season_extension' in columns:
            print("Column 'season_extension' already exists in garden_bed table")
            return True

        # Add the new column
        cursor.execute("""
            ALTER TABLE garden_bed
            ADD COLUMN season_extension TEXT
        """)

        conn.commit()
        print("Successfully added 'season_extension' column to garden_bed table")
        return True

    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
