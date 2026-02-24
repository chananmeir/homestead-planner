"""
Database migration: Add position tracking fields to planting_event table.

This migration adds spatial awareness to planting events for Phase 2 of the
Timeline Planting Feature. It enables conflict detection by tracking where
plantings are located within garden beds.

Fields added:
- position_x: Grid X coordinate (nullable)
- position_y: Grid Y coordinate (nullable)
- space_required: Number of grid cells needed (nullable)
- conflict_override: Whether user allowed a conflict (default=0)

All fields are nullable for backward compatibility with existing events.
"""
import sqlite3
import os

def add_position_fields():
    """Add position tracking fields to planting_event table."""
    db_path = os.path.join('instance', 'homestead_planner.db')

    if not os.path.exists(db_path):
        print("Database does not exist yet. Fields will be created when database is initialized.")
        return True

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check if columns already exist
        cursor.execute("PRAGMA table_info(planting_event)")
        columns = [col[1] for col in cursor.fetchall()]

        fields_to_add = [
            ('position_x', 'INTEGER'),
            ('position_y', 'INTEGER'),
            ('space_required', 'INTEGER'),
            ('conflict_override', 'BOOLEAN DEFAULT 0')
        ]

        added_fields = []
        for field_name, field_type in fields_to_add:
            if field_name not in columns:
                print(f"Adding {field_name} column...")
                cursor.execute(f"ALTER TABLE planting_event ADD COLUMN {field_name} {field_type}")
                added_fields.append(field_name)
            else:
                print(f"Column {field_name} already exists, skipping...")

        if added_fields:
            conn.commit()
            print(f"\nMigration completed successfully!")
            print(f"Added fields: {', '.join(added_fields)}")
        else:
            print("\nNo fields needed to be added - all columns already exist.")

        conn.close()
        return True

    except sqlite3.Error as e:
        print(f"Migration failed: {str(e)}")
        if conn:
            conn.close()
        return False
    except Exception as e:
        print(f"Unexpected error during migration: {str(e)}")
        if conn:
            conn.close()
        return False

if __name__ == '__main__':
    print("=" * 60)
    print("Position Fields Migration - Phase 2: Space Awareness")
    print("=" * 60)
    print()

    success = add_position_fields()

    print()
    if success:
        print("[SUCCESS] Migration completed successfully!")
    else:
        print("[FAILED] Migration failed - please check errors above")

    print("=" * 60)
