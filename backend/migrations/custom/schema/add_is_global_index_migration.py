"""
Database Migration: Add index to is_global column

⚠️ ONE-TIME MANUAL MIGRATION - DO NOT RE-RUN ⚠️

This migration adds an index to the is_global column for improved query performance
when filtering varieties by global vs personal status.

What this migration does:
1. Checks if the index already exists
2. Creates an index on seed_inventory.is_global if it doesn't exist
3. Verifies the index was created successfully

Why add an index:
- Improves performance when filtering: WHERE is_global = True/False
- Beneficial for multi-user environments with many varieties
- Minimal overhead as is_global is a boolean column

When to run:
- Run ONCE after adding index=True to models.py
- Skip if the index already exists (idempotent)

How to run:
    cd backend
    python add_is_global_index_migration.py

Prerequisites:
- is_global column must already exist (run add_is_global_migration.py first)
"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
from app import app, db
from sqlalchemy import text, inspect

def run_migration():
    """Execute the migration to add index on is_global column"""
    with app.app_context():
        print("Starting migration: Add index to is_global column")

        try:
            # Step 1: Check if index already exists
            inspector = inspect(db.engine)
            indexes = inspector.get_indexes('seed_inventory')

            # Check for index on is_global column
            index_exists = any(
                'is_global' in index.get('column_names', [])
                for index in indexes
            )

            if index_exists:
                print("[OK] Index on 'is_global' column already exists")
            else:
                # Step 2: Create the index
                print("Creating index on 'is_global' column...")
                with db.engine.connect() as conn:
                    conn.execute(text(
                        "CREATE INDEX IF NOT EXISTS ix_seed_inventory_is_global ON seed_inventory (is_global)"
                    ))
                    conn.commit()
                print("[OK] Index created successfully")

            # Step 3: Verify index exists
            print("\nVerification:")
            inspector = inspect(db.engine)
            indexes_after = inspector.get_indexes('seed_inventory')

            global_index = next(
                (idx for idx in indexes_after if 'is_global' in idx.get('column_names', [])),
                None
            )

            if global_index:
                print(f"  Index name: {global_index.get('name', 'N/A')}")
                print(f"  Column: is_global")
                print(f"  Unique: {global_index.get('unique', False)}")
            else:
                print("  [WARNING] Could not verify index (may still exist)")

            print("\n[SUCCESS] Migration completed successfully!")

        except Exception as e:
            print(f"\n[ERROR] Migration failed: {str(e)}")
            db.session.rollback()
            raise

if __name__ == '__main__':
    run_migration()
