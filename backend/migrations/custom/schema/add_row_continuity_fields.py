"""
Database migration script to add row continuity fields to planting_event table.

This enables tracking of continuous rows by linking adjacent grid segments together.
Rows are conceptually continuous; grid cells are a UI abstraction.

Run this script from the backend directory:
    python add_row_continuity_fields.py
"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
import os

def run_migration():
    # Database path
    db_path = os.path.join('instance', 'homestead.db')

    if not os.path.exists(db_path):
        print(f"[ERROR] Database not found at {db_path}")
        print("Please ensure you're running this script from the backend directory.")
        return False

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        print("Starting migration: Adding row continuity fields to planting_event table...")

        # Check if columns already exist
        cursor.execute("PRAGMA table_info(planting_event)")
        existing_columns = [col[1] for col in cursor.fetchall()]

        migrations_needed = []

        # List of new columns to add
        new_columns = [
            ('row_group_id', 'VARCHAR(50)', None),
            ('row_segment_index', 'INTEGER', None),
            ('total_row_segments', 'INTEGER', None),
        ]

        # Check which columns need to be added
        for col_name, col_type, default_value in new_columns:
            if col_name not in existing_columns:
                migrations_needed.append((col_name, col_type, default_value))

        if not migrations_needed:
            print("[SUCCESS] All row continuity fields already exist. No migration needed.")
            conn.close()
            return True

        # Add new columns
        for col_name, col_type, default_value in migrations_needed:
            if default_value:
                sql = f'ALTER TABLE planting_event ADD COLUMN {col_name} {col_type} DEFAULT "{default_value}"'
            else:
                sql = f'ALTER TABLE planting_event ADD COLUMN {col_name} {col_type}'

            print(f"  Adding column: {col_name} ({col_type})")
            cursor.execute(sql)

        conn.commit()

        # Verify columns were added
        cursor.execute("PRAGMA table_info(planting_event)")
        updated_columns = [col[1] for col in cursor.fetchall()]

        all_added = all(col_name in updated_columns for col_name, _, _ in migrations_needed)

        if all_added:
            print(f"[SUCCESS] Successfully added {len(migrations_needed)} row continuity fields to planting_event table")
            print("\nNew columns:")
            for col_name, col_type, default_value in migrations_needed:
                default_str = f" (default: {default_value})" if default_value else ""
                print(f"  - {col_name}: {col_type}{default_str}")
            conn.close()
            return True
        else:
            print("[ERROR] Some columns were not added successfully")
            conn.close()
            return False

    except sqlite3.Error as e:
        print(f"[ERROR] Database error: {e}")
        return False
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        return False

if __name__ == '__main__':
    print("=" * 60)
    print("Row Continuity Migration Script")
    print("=" * 60)
    success = run_migration()
    print("=" * 60)
    if success:
        print("Migration completed successfully!")
    else:
        print("Migration failed. Please review the errors above.")
    print("=" * 60)
