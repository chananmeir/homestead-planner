#!/usr/bin/env python3
"""
Migration script to add variety column to planting_event table
Run this from the backend directory: python add_variety_column.py
"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
import os

def add_variety_column():
    # Get the database path
    db_path = os.path.join(backend_dir, 'homestead.db')

    if not os.path.exists(db_path):
        print(f"❌ Database not found at: {db_path}")
        print("   Make sure you're running this from the backend directory")
        return False

    print(f"📂 Found database at: {db_path}")

    # Connect to database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(planting_event)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'variety' in columns:
            print("✅ Column 'variety' already exists in planting_event table!")
            return True

        # Add the variety column
        print("📝 Adding 'variety' column to planting_event table...")
        cursor.execute('ALTER TABLE planting_event ADD COLUMN variety VARCHAR(100)')
        conn.commit()

        print("✅ Successfully added 'variety' column!")

        # Verify the column was added
        cursor.execute("PRAGMA table_info(planting_event)")
        columns = [col[1] for col in cursor.fetchall()]
        print(f"\n📋 Current columns in planting_event table:")
        for col in columns:
            print(f"   - {col}")

        return True

    except sqlite3.OperationalError as e:
        print(f"❌ Error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False
    finally:
        conn.close()

if __name__ == '__main__':
    print("=" * 60)
    print("[MIGRATION] Database Migration: Add variety column")
    print("=" * 60)
    print()

    success = add_variety_column()

    print()
    if success:
        print("=" * 60)
        print("[SUCCESS] Migration completed successfully!")
        print("=" * 60)
        print()
        print("Next steps:")
        print("1. Restart your Flask server")
        print("2. Try adding a planting event")
        print()
    else:
        print("=" * 60)
        print("❌ Migration failed!")
        print("=" * 60)
        print()
        print("Please check the error message above and try again.")
        print()
