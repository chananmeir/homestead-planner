"""
Database Migration: Add is_global column to SeedInventory

⚠️ ONE-TIME MANUAL MIGRATION - DO NOT RE-RUN ⚠️

This is a standalone migration script (not using Alembic) for adding the is_global
feature to an existing database. This should only be run ONCE.

What this migration does:
1. Adds the is_global Boolean column to seed_inventory table with default False
2. Marks all existing varieties as global (is_global=True)
3. Verifies the migration completed successfully

Why not use Alembic/Flask-Migrate:
- This is a retroactive migration for an existing feature
- It includes data migration logic (marking existing records as global)
- It's idempotent - safe to run on already-migrated databases

When to run:
- Run ONCE when upgrading to the global variety catalog feature
- Skip if starting with a fresh database (column already in models.py)

How to run:
    cd backend
    python add_is_global_migration.py

Status after running:
- All existing varieties will be marked as global (is_global=True)
- New varieties will default to personal (is_global=False)
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
        print("Starting migration: Add is_global column to SeedInventory")

        try:
            # Step 1: Check if column already exists
            inspector = db.inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('seed_inventory')]

            if 'is_global' in columns:
                print("[OK] Column 'is_global' already exists")
            else:
                # Step 2: Add the column with default False
                print("Adding 'is_global' column to seed_inventory table...")
                with db.engine.connect() as conn:
                    conn.execute(text(
                        "ALTER TABLE seed_inventory ADD COLUMN is_global BOOLEAN DEFAULT 0"
                    ))
                    conn.commit()
                print("[OK] Column added successfully")

            # Step 3: Mark all existing varieties as global
            print("Marking existing varieties as global...")
            existing_count = SeedInventory.query.count()

            if existing_count > 0:
                # Update all existing records to is_global=True
                SeedInventory.query.update({'is_global': True})
                db.session.commit()
                print(f"[OK] Marked {existing_count} existing varieties as global")
            else:
                print("[OK] No existing varieties found (clean database)")

            # Step 4: Verify migration
            print("\nVerification:")
            total_seeds = SeedInventory.query.count()
            global_seeds = SeedInventory.query.filter_by(is_global=True).count()
            personal_seeds = SeedInventory.query.filter_by(is_global=False).count()

            print(f"  Total varieties: {total_seeds}")
            print(f"  Global varieties: {global_seeds}")
            print(f"  Personal varieties: {personal_seeds}")

            print("\n[SUCCESS] Migration completed successfully!")

        except Exception as e:
            print(f"\n[ERROR] Migration failed: {str(e)}")
            db.session.rollback()
            raise

if __name__ == '__main__':
    run_migration()
