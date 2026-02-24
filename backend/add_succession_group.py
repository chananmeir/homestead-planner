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

import sqlite3
import os

def add_succession_group_column():
    """Add succession_group_id column to planting_event table if it doesn't exist."""

    # Database path
    db_path = os.path.join('instance', 'homestead_planner.db')

    if not os.path.exists(db_path):
        print("Database not found at", db_path)
        print("This is normal if the database hasn't been created yet.")
        print("The new field will be included when the database is created.")
        return True  # Not an error - field is in model

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
