"""
Migration: Add zone field to garden_bed table for permaculture zones

This migration adds a 'zone' column to the garden_bed table to support
permaculture zone classification (zone0 through zone5).
"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
import os

def add_zone_column():
    """Add zone column to garden_bed table"""
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
        return

    print(f"Using database: {db_path}\n")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(garden_bed)")
        columns = [column[1] for column in cursor.fetchall()]

        if 'zone' in columns:
            print("[OK] Zone column already exists in garden_bed table")
            return

        # Add zone column
        cursor.execute("""
            ALTER TABLE garden_bed
            ADD COLUMN zone VARCHAR(10)
        """)

        conn.commit()
        print("[OK] Successfully added zone column to garden_bed table")
        print("  - Column type: VARCHAR(10)")
        print("  - Default value: NULL (user can assign zones as needed)")
        print("  - Valid values: zone0, zone1, zone2, zone3, zone4, zone5")

    except sqlite3.Error as e:
        print(f"[ERROR] Error adding zone column: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    print("=" * 60)
    print("Migration: Add zone field to garden_bed table")
    print("=" * 60)
    add_zone_column()
    print("=" * 60)
    print("Migration complete!")
    print("\nPermaculture Zones:")
    print("  zone0: House/center - most visited")
    print("  zone1: Daily harvest (herbs, greens)")
    print("  zone2: Regular care (main garden)")
    print("  zone3: Occasional (orchards, chickens)")
    print("  zone4: Foraging (wild, pasture)")
    print("  zone5: Wilderness (unmanaged)")
