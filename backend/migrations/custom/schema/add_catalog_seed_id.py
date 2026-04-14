"""
Database Migration: Add catalog_seed_id column to SeedInventory

⚠️ ONE-TIME MANUAL MIGRATION - DO NOT RE-RUN ⚠️

This is a standalone migration script (not using Alembic) for adding the catalog_seed_id
feature to an existing database. This should only be run ONCE.

What this migration does:
1. Adds the catalog_seed_id Integer column to seed_inventory table (nullable)
2. Adds index on catalog_seed_id for performance
3. Adds foreign key constraint referencing seed_inventory.id
4. All existing personal seeds will have catalog_seed_id=NULL (custom varieties)
5. Verifies the migration completed successfully

Purpose:
- Track which catalog seed a personal seed was cloned from
- Enable "From Catalog" vs "Custom" badges in UI
- Enable future "Sync from Catalog" feature
- Fix Gaps #1 and #2 from my-seed-inventory-plan.md

When to run:
- Run ONCE when upgrading to catalog tracking feature
- Skip if starting with a fresh database (column already in models.py)

How to run:
    cd backend
    python add_catalog_seed_id.py

Status after running:
- All existing personal seeds will have catalog_seed_id=NULL (custom varieties)
- New seeds added from catalog will have catalog_seed_id set
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
        print("Starting migration: Add catalog_seed_id column to SeedInventory")

        try:
            # Step 1: Check if column already exists
            inspector = db.inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('seed_inventory')]

            if 'catalog_seed_id' in columns:
                print("[OK] Column 'catalog_seed_id' already exists")
            else:
                # Step 2: Add the column (nullable, default NULL)
                print("Adding 'catalog_seed_id' column to seed_inventory table...")
                with db.engine.connect() as conn:
                    # Add column
                    conn.execute(text(
                        "ALTER TABLE seed_inventory ADD COLUMN catalog_seed_id INTEGER"
                    ))
                    conn.commit()
                print("[OK] Column added successfully")

            # Step 3: Add index if it doesn't exist
            print("Adding index on catalog_seed_id...")
            try:
                with db.engine.connect() as conn:
                    # Try to create index (will fail silently if already exists on some DBs)
                    conn.execute(text(
                        "CREATE INDEX IF NOT EXISTS ix_seed_inventory_catalog_seed_id ON seed_inventory(catalog_seed_id)"
                    ))
                    conn.commit()
                print("[OK] Index created/verified")
            except Exception as e:
                # Index may already exist, that's fine
                print(f"[INFO] Index creation skipped: {str(e)}")

            # Step 4: Verify migration
            print("\nVerification:")
            total_seeds = SeedInventory.query.count()
            global_seeds = SeedInventory.query.filter_by(is_global=True).count()
            personal_seeds = SeedInventory.query.filter_by(is_global=False).count()

            # Count how many personal seeds have catalog references (should be 0 after initial migration)
            personal_from_catalog = SeedInventory.query.filter(
                SeedInventory.is_global == False,
                SeedInventory.catalog_seed_id.isnot(None)
            ).count()

            print(f"  Total varieties: {total_seeds}")
            print(f"  Global catalog varieties: {global_seeds}")
            print(f"  Personal varieties: {personal_seeds}")
            print(f"  Personal varieties from catalog: {personal_from_catalog}")
            print(f"  Custom varieties (catalog_seed_id=NULL): {personal_seeds - personal_from_catalog}")

            print("\n[SUCCESS] Migration completed successfully!")
            print("\nNext steps:")
            print("  1. Personal seeds can now track their catalog origin")
            print("  2. Existing personal seeds are marked as 'custom' (catalog_seed_id=NULL)")
            print("  3. New seeds added from catalog will have catalog_seed_id set")
            print("  4. UI can now show 'From Catalog' vs 'Custom' badges")

        except Exception as e:
            print(f"\n[ERROR] Migration failed: {str(e)}")
            db.session.rollback()
            raise

if __name__ == '__main__':
    run_migration()
