"""
Database Migration: Add user_id to all user-specific models

This migration adds user_id foreign key columns to all models that contain user-specific data.
All existing data will be assigned to the admin user (id=1).

Models updated:
- GardenBed, PlantedItem, PlantingEvent
- Property, PlacedStructure
- SeedInventory
- Chicken, Duck, Beehive, Livestock
- HarvestRecord, CompostPile, Photo
- WinterPlan, IndoorSeedStart, Settings
"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
import os

def run_migration():
    """Add user_id column to all user-specific tables"""

    # Get the database path - check multiple locations
    # Use backend_dir from path injection above
    possible_paths = [
        os.path.join(backend_dir, 'instance', 'homestead_planner.db'),
        os.path.join(backend_dir, 'instance', 'homestead.db'),
        os.path.join(backend_dir, 'homestead.db'),
    ]

    DATABASE_PATH = None
    for path in possible_paths:
        if os.path.exists(path):
            # Skip empty files (0 bytes) - they're placeholders
            if os.path.getsize(path) > 0:
                DATABASE_PATH = path
                break

    if not DATABASE_PATH:
        print("[ERROR] Database not found in any of these locations:")
        for path in possible_paths:
            print(f"        - {path}")
        print("        Make sure you're running this from the backend directory")
        return False

    print(f"Using database: {DATABASE_PATH}\n")
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    try:
        # Verify admin user exists
        cursor.execute("SELECT id FROM users WHERE is_admin = 1 LIMIT 1")
        admin_user = cursor.fetchone()

        if not admin_user:
            print("ERROR: No admin user found in database")
            print("Please create an admin user first (run create_users_table.py)")
            return False

        admin_id = admin_user[0]
        print(f"Found admin user with ID: {admin_id}")
        print(f"All existing data will be assigned to this user.")
        print()

        # List of tables to add user_id to
        # Format: (table_name, has_data_description)
        tables_to_migrate = [
            ('garden_bed', 'garden beds'),
            ('planted_item', 'planted items'),
            ('planting_event', 'planting events'),
            ('property', 'properties'),
            ('placed_structure', 'placed structures'),
            ('seed_inventory', 'seed inventory items'),
            ('chicken', 'chickens'),
            ('duck', 'ducks'),
            ('beehive', 'beehives'),
            ('livestock', 'livestock'),
            ('harvest_record', 'harvest records'),
            ('compost_pile', 'compost piles'),
            ('photo', 'photos'),
            ('winter_plan', 'winter plans'),
            ('indoor_seed_start', 'indoor seed starts'),
            ('settings', 'settings')
        ]

        migration_summary = []

        for table_name, description in tables_to_migrate:
            # Check if table exists
            cursor.execute(f"""
                SELECT name FROM sqlite_master
                WHERE type='table' AND name='{table_name}'
            """)

            if not cursor.fetchone():
                print(f"SKIP: Table '{table_name}' does not exist yet")
                continue

            # Check if user_id column already exists
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = [col[1] for col in cursor.fetchall()]

            if 'user_id' in columns:
                print(f"SKIP: Table '{table_name}' already has user_id column")
                continue

            # Count existing records
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            record_count = cursor.fetchone()[0]

            # Add user_id column (nullable first, we'll make it NOT NULL after populating)
            print(f"Adding user_id to {table_name}...")
            cursor.execute(f"""
                ALTER TABLE {table_name}
                ADD COLUMN user_id INTEGER
            """)

            # Assign all existing records to admin user
            if record_count > 0:
                cursor.execute(f"""
                    UPDATE {table_name}
                    SET user_id = ?
                    WHERE user_id IS NULL
                """, (admin_id,))

                print(f"  Assigned {record_count} {description} to admin user")
                migration_summary.append(f"  {record_count} {description}")
            else:
                print(f"  No existing {description} to migrate")

            # Note: We're not making it NOT NULL or adding foreign key constraint
            # because SQLite doesn't support adding constraints to existing tables
            # The backend models.py will enforce this at the application level

        # Commit all changes
        conn.commit()

        print()
        print("=" * 60)
        print("MIGRATION COMPLETED SUCCESSFULLY")
        print("=" * 60)
        print()
        print("Summary of data assigned to admin user:")
        for item in migration_summary:
            print(item)
        print()
        print("Next steps:")
        print("1. Update backend/models.py to add user_id foreign keys")
        print("2. Add @login_required decorators to API endpoints")
        print("3. Add user ownership filters to queries")
        print("4. Restart backend server")
        print()

        return True

    except sqlite3.Error as e:
        print(f"ERROR: Database error occurred: {e}")
        conn.rollback()
        return False

    except Exception as e:
        print(f"ERROR: Unexpected error: {e}")
        conn.rollback()
        return False

    finally:
        conn.close()

if __name__ == '__main__':
    print("=" * 60)
    print("DATABASE MIGRATION: Add user_id to all models")
    print("=" * 60)
    print()
    print("WARNING: This migration will:")
    print("1. Add user_id column to all user-specific tables")
    print("2. Assign ALL existing data to the admin user")
    print()

    response = input("Do you want to proceed? (yes/no): ")

    if response.lower() in ['yes', 'y']:
        success = run_migration()
        if success:
            print("Migration completed successfully!")
        else:
            print("Migration failed. Please check errors above.")
    else:
        print("Migration cancelled.")
