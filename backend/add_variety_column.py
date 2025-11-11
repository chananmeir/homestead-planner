#!/usr/bin/env python3
"""
Migration script to add variety column to planting_event table
Run this from the backend directory: python add_variety_column.py
"""

import sqlite3
import os

def add_variety_column():
    # Check multiple possible database locations
    possible_paths = [
        os.path.join(os.path.dirname(__file__), 'homestead.db'),
        os.path.join(os.path.dirname(__file__), 'instance', 'homestead.db'),
        'homestead.db',
        'instance/homestead.db'
    ]

    db_path = None
    for path in possible_paths:
        if os.path.exists(path):
            db_path = path
            break

    if not db_path:
        print(f"❌ Database not found in any of these locations:")
        for path in possible_paths:
            print(f"   - {os.path.abspath(path)}")
        print()
        print("ℹ️  This might be the first time running the app.")
        print("   The database will be created automatically when you start Flask.")
        print()
        print("To create the database:")
        print("   1. Start the Flask app: python app.py")
        print("   2. Stop it (Ctrl+C)")
        print("   3. Run this migration script again")
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
    print("🔧 Database Migration: Add variety column")
    print("=" * 60)
    print()

    success = add_variety_column()

    print()
    if success:
        print("=" * 60)
        print("✅ Migration completed successfully!")
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
