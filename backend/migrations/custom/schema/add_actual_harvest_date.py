#!/usr/bin/env python3
"""
Migration script to add actual_harvest_date column to planting_event table
Run this from the backend directory: python add_actual_harvest_date.py
"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
import os

def add_actual_harvest_date_column():
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
            db_path = path
            break

    if not db_path:
        print(f"[ERROR] Database not found in any of these locations:")
        for path in possible_paths:
            print(f"        - {path}")
        print("        Make sure you're running this from the backend directory")
        return False

    print(f"[INFO] Found database at: {db_path}")

    # Connect to database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(planting_event)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'actual_harvest_date' in columns:
            print("[EXISTS] Column 'actual_harvest_date' already exists in planting_event table!")
            return True

        # Add the actual_harvest_date column
        print("[ADDING] Adding 'actual_harvest_date' column to planting_event table...")
        cursor.execute('ALTER TABLE planting_event ADD COLUMN actual_harvest_date DATETIME')
        conn.commit()

        print("[ADDED] Successfully added 'actual_harvest_date' column!")

        # Verify the column was added
        cursor.execute("PRAGMA table_info(planting_event)")
        columns = [col[1] for col in cursor.fetchall()]
        print(f"\n[INFO] Current columns in planting_event table:")
        for col in columns:
            print(f"       - {col}")

        return True

    except sqlite3.OperationalError as e:
        print(f"[ERROR] SQLite error: {e}")
        return False
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        return False
    finally:
        conn.close()

if __name__ == '__main__':
    print("=" * 60)
    print("[MIGRATION] Database Migration: Add actual_harvest_date column")
    print("=" * 60)
    print()

    success = add_actual_harvest_date_column()

    print()
    if success:
        print("=" * 60)
        print("[SUCCESS] Migration completed successfully!")
        print("=" * 60)
        print()
        print("Next steps:")
        print("1. Restart your Flask server")
        print("2. The PlantingEvent model now supports actual harvest dates")
        print()
    else:
        print("=" * 60)
        print("[FAILED] Migration failed!")
        print("=" * 60)
        print()
        print("Please check the error message above and try again.")
        print()
