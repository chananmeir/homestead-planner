"""
Database Migration: Add last_synced_at column to SeedInventory

⚠️ ONE-TIME MANUAL MIGRATION - DO NOT RE-RUN ⚠️

This migration adds the last_synced_at timestamp field to track when
a personal seed's agronomic data was last synced from its catalog source.

What this migration does:
1. Adds the last_synced_at DateTime column to seed_inventory table (nullable)
2. All existing seeds will have last_synced_at=NULL (never synced)
3. Future syncs will update this timestamp
4. Verifies the migration completed successfully

Purpose:
- Track when a seed was last synced from catalog
- Enable "Last synced: X days ago" display in UI
- Help users know if their seed data is up-to-date

When to run:
- Run ONCE when adding the "Sync from Catalog" feature
- Skip if starting with a fresh database (column already in models.py)

How to run:
    cd backend
    ./venv/Scripts/python.exe add_last_synced_at.py

Status after running:
- All seeds will have last_synced_at=NULL (never synced)
- When users click "Sync from Catalog", this field gets updated
"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
from app import app, db
from models import SeedInventory
from sqlalchemy import text

def run_migration():
    """Execute the migration"""
    with app.app_context():
        print("Starting migration: Add last_synced_at column to SeedInventory")

        try:
            # Step 1: Check if column already exists
            inspector = db.inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('seed_inventory')]

            if 'last_synced_at' in columns:
                print("[OK] Column 'last_synced_at' already exists")
            else:
                # Step 2: Add the column (nullable, default NULL)
                print("Adding 'last_synced_at' column to seed_inventory table...")
                with db.engine.connect() as conn:
                    conn.execute(text(
                        "ALTER TABLE seed_inventory ADD COLUMN last_synced_at DATETIME"
                    ))
                    conn.commit()
                print("[OK] Column added successfully")

            # Step 3: Verify migration
            print("\nVerification:")
            total_seeds = SeedInventory.query.count()
            global_seeds = SeedInventory.query.filter_by(is_global=True).count()
            personal_seeds = SeedInventory.query.filter_by(is_global=False).count()

            # Count how many seeds have been synced (should be 0 after initial migration)
            synced_seeds = SeedInventory.query.filter(
                SeedInventory.last_synced_at.isnot(None)
            ).count()

            print(f"  Total varieties: {total_seeds}")
            print(f"  Global catalog varieties: {global_seeds}")
            print(f"  Personal varieties: {personal_seeds}")
            print(f"  Seeds with sync history: {synced_seeds}")
            print(f"  Seeds never synced: {total_seeds - synced_seeds}")

            print("\n[SUCCESS] Migration completed successfully!")
            print("\nNext steps:")
            print("  1. Users can now sync their personal seeds from catalog")
            print("  2. last_synced_at will be updated when sync happens")
            print("  3. UI can show 'Last synced: X days ago'")

        except Exception as e:
            print(f"\n[ERROR] Migration failed: {str(e)}")
            db.session.rollback()
            raise

if __name__ == '__main__':
    run_migration()
