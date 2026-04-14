#!/usr/bin/env python3
"""
Migration script to add quantity_completed column to planting_event table
Tracks how many seeds/plants were actually planted vs target quantity
Run this from the backend directory: python migrations/custom/schema/add_quantity_completed.py
"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
import os

def add_quantity_completed_column():
    # Get the database path - check multiple locations
    # Use backend_dir from path injection above
    possible_paths = [
        os.path.join(backend_dir, 'instance', 'homestead.db'),
        os.path.join(backend_dir, 'instance', 'homestead_planner.db'),
        os.path.join(backend_dir, 'homestead.db'),
    ]

    db_path = None
    for path in possible_paths:
        if os.path.exists(path) and os.path.getsize(path) > 0:
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

        if 'quantity_completed' in columns:
            print("[EXISTS] Column 'quantity_completed' already exists in planting_event table!")
            return True

        # Add the quantity_completed column
        print("[ADDING] Adding 'quantity_completed' column to planting_event table...")
        cursor.execute('ALTER TABLE planting_event ADD COLUMN quantity_completed INTEGER')
        conn.commit()

        print("[ADDED] Successfully added 'quantity_completed' column!")

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
    print("[MIGRATION] Database Migration: Add quantity_completed column")
    print("=" * 60)
    print()

    success = add_quantity_completed_column()

    print()
    if success:
        print("=" * 60)
        print("[SUCCESS] Migration completed successfully!")
        print("=" * 60)
        print()
        print("Next steps:")
        print("1. Restart your Flask server")
        print("2. The PlantingEvent model now supports partial completion tracking")
        print("3. Track actual planted quantities (e.g., 25/31 seeds planted)")
        print()
    else:
        print("=" * 60)
        print("[FAILED] Migration failed!")
        print("=" * 60)
        print()
        print("Please check the error message above and try again.")
        print()
