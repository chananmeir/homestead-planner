"""
Database migration script to add variety column to planted_item table.

This allows users to specify which variety of a plant they're planting in the Garden Designer.
For example: 'Buttercrunch' lettuce vs 'Romaine' lettuce.

IMPORTANT: This is a ONE-TIME migration script for adding the variety feature.
          Normally, schema changes should use Flask-Migrate:
              flask db migrate -m "description"
              flask db upgrade

          This standalone script is provided for convenience and can be run
          safely multiple times (it checks if the column already exists).

Run this script after backing up your database:
    cd backend
    python add_variety_to_planted_item.py

Or with virtual environment:
    cd backend
    ./venv/Scripts/python.exe add_variety_to_planted_item.py  # Windows
    ./venv/bin/python add_variety_to_planted_item.py          # Mac/Linux
"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
from app import app, db
from sqlalchemy import text

def add_variety_column():
    """Add variety column to planted_item table if it doesn't exist."""

    with app.app_context():
        try:
            # Check if variety column already exists
            result = db.session.execute(text(
                "SELECT COUNT(*) FROM pragma_table_info('planted_item') WHERE name='variety'"
            ))
            column_exists = result.scalar() > 0

            if column_exists:
                print("[OK] variety column already exists in planted_item table")
                return

            print("Adding variety column to planted_item table...")

            # Add variety column (nullable, VARCHAR(100))
            db.session.execute(text(
                "ALTER TABLE planted_item ADD COLUMN variety VARCHAR(100)"
            ))

            db.session.commit()
            print("[OK] Successfully added variety column to planted_item table")
            print()
            print("Notes:")
            print("- variety column is nullable (optional)")
            print("- existing planted items will have variety = NULL")
            print("- users can now specify variety when placing plants in Garden Designer")

        except Exception as e:
            db.session.rollback()
            print(f"[ERROR] Error adding variety column: {e}")
            raise

if __name__ == '__main__':
    print("=" * 70)
    print("Database Migration: Add variety to planted_item")
    print("=" * 70)
    print()

    add_variety_column()

    print()
    print("=" * 70)
    print("Migration complete!")
    print("=" * 70)
