"""
Migration script to add soil_type and mulch_type columns to garden_bed table
"""
# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
import os

def add_columns():
    """Add soil_type and mulch_type columns to garden_bed table"""
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
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(garden_bed)")
        columns = [column[1] for column in cursor.fetchall()]

        # Add soil_type column if it doesn't exist
        if 'soil_type' not in columns:
            print("Adding soil_type column to garden_bed table...")
            cursor.execute("""
                ALTER TABLE garden_bed
                ADD COLUMN soil_type VARCHAR(20) DEFAULT 'loamy'
            """)
            print("[OK] soil_type column added")
        else:
            print("soil_type column already exists")

        # Add mulch_type column if it doesn't exist
        if 'mulch_type' not in columns:
            print("Adding mulch_type column to garden_bed table...")
            cursor.execute("""
                ALTER TABLE garden_bed
                ADD COLUMN mulch_type VARCHAR(20) DEFAULT 'none'
            """)
            print("[OK] mulch_type column added")
        else:
            print("mulch_type column already exists")

        conn.commit()
        print("\nMigration completed successfully!")

        # Show current garden beds
        cursor.execute("SELECT id, name, soil_type, mulch_type FROM garden_bed")
        beds = cursor.fetchall()

        if beds:
            print(f"\nCurrent garden beds ({len(beds)} total):")
            for bed in beds:
                print(f"  - Bed {bed[0]}: {bed[1]} | Soil: {bed[2] or 'loamy'} | Mulch: {bed[3] or 'none'}")
        else:
            print("\nNo garden beds found in database")

    except sqlite3.Error as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    print("=" * 60)
    print("Garden Bed Mulch & Soil Type Migration")
    print("=" * 60)
    print()

    add_columns()
