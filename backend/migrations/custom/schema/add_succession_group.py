"""
Database migration script to add succession_group_id column to planting_event table.

This migration adds a nullable succession_group_id field that links planting events
created as part of a succession series. This enables:
- Grouping related succession plantings visually
- Bulk editing entire succession series
- Better timeline visualization

Usage:
    python add_succession_group.py

Note: This script is designed to work with or without Flask-Migrate.
If Flask-Migrate is set up, use: flask db migrate -m "Add succession_group_id to PlantingEvent"
"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
import os

def add_succession_group_column():
    """Add succession_group_id column to planting_event table if it doesn't exist."""

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
            # Skip empty files (0 bytes) - they're placeholders, not real databases
            if os.path.getsize(path) > 0:
                db_path = path
                print(f"Found database at: {path}")
                break

    if not db_path:
        print("[ERROR] Database not found in any of these locations:")
        for path in possible_paths:
            print(f"        - {path}")
        print("        Make sure you're running this from the backend directory")
        return False

    try:
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check if table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='planting_event'")
        table_exists = cursor.fetchone() is not None

        if not table_exists:
            print("planting_event table doesn't exist yet - will be created with new field")
            conn.close()
            return True

        # Check if column already exists
        cursor.execute("PRAGMA table_info(planting_event)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]

        if 'succession_group_id' in column_names:
            print("succession_group_id column already exists - no migration needed")
            conn.close()
            return True

        # Add the column
        print("Adding succession_group_id column to planting_event table...")
        cursor.execute("""
            ALTER TABLE planting_event
            ADD COLUMN succession_group_id VARCHAR(50)
        """)

        # Commit changes
        conn.commit()

        # Verify column was added
        cursor.execute("PRAGMA table_info(planting_event)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]

        if 'succession_group_id' in column_names:
            print("Successfully added succession_group_id column")
            print("Total columns in planting_event:", len(column_names))

            # Show existing events
            cursor.execute("SELECT COUNT(*) FROM planting_event")
            count = cursor.fetchone()[0]
            print("Existing planting events:", count)
            print("(All existing events will have NULL succession_group_id)")

            success = True
        else:
            print("Failed to add column - verification failed")
            success = False

        conn.close()
        return success

    except sqlite3.Error as e:
        print("Database error:", str(e))
        return False
    except Exception as e:
        print("Unexpected error:", str(e))
        return False

if __name__ == '__main__':
    print("=" * 60)
    print("PLANTING EVENT SUCCESSION GROUP MIGRATION")
    print("=" * 60)
    print()

    success = add_succession_group_column()

    print()
    if success:
        print("Migration completed successfully!")
        print()
        print("Next steps:")
        print("  1. Restart Flask application to pick up model changes")
        print("  2. Test creating succession plantings in UI")
        print("  3. Verify events are linked with same succession_group_id")
    else:
        print("Migration failed - please check errors above")
    print()
    print("=" * 60)
