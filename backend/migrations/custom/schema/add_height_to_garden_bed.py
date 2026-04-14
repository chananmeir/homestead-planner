"""
Migration: Add height field to garden_bed table for raised bed height tracking

This migration adds a 'height' column to the garden_bed table to support
tracking raised bed height in inches (default 12" standard).
"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
import os

def add_height_column():
    """Add height column to garden_bed table"""
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

        if 'height' in columns:
            print("[OK] Height column already exists in garden_bed table")
            return

        # Add height column with default value of 12.0 inches (standard raised bed)
        cursor.execute("""
            ALTER TABLE garden_bed
            ADD COLUMN height REAL DEFAULT 12.0
        """)

        conn.commit()
        print("[OK] Successfully added height column to garden_bed table")
        print("  - Column type: REAL (float)")
        print("  - Default value: 12.0 inches (standard raised bed height)")
        print("  - Used for: Soil warming calculations, drainage rating, etc.")

    except sqlite3.Error as e:
        print(f"[ERROR] Error adding height column: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    print("=" * 60)
    print("Migration: Add height field to garden_bed table")
    print("=" * 60)
    add_height_column()
    print("=" * 60)
    print("Migration complete!")
    print("\nCommon Raised Bed Heights:")
    print("  6\":  Shallow bed (greens, herbs)")
    print("  12\": Standard bed (most vegetables) - DEFAULT")
    print("  18\": Deep bed (root crops, tomatoes)")
    print("  24\": Extra deep (perennials, trees)")
