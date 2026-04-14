"""
Migration script to add custom dimension support to placed_structure table.

This allows users to specify custom width and length when placing structures
(e.g., a 12x12 chicken run instead of the default 10x20).

When custom_width and custom_length are NULL, the system uses the dimensions
from the structure definition in structures_database.py.

Run this migration:
    cd backend
    python add_custom_dimensions_to_placed_structure.py
"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
from app import app, db
from models import PlacedStructure
from sqlalchemy import text

def run_migration():
    """Add custom_width and custom_length columns to placed_structure table."""
    with app.app_context():
        try:
            # Check if columns already exist
            inspector = db.inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('placed_structure')]

            if 'custom_width' in columns and 'custom_length' in columns:
                print("[OK] Columns already exist. Migration already applied.")
                return

            print("Adding custom dimension columns to placed_structure table...")

            # Add custom_width column (nullable - NULL means use structure default)
            if 'custom_width' not in columns:
                db.session.execute(text(
                    'ALTER TABLE placed_structure ADD COLUMN custom_width FLOAT'
                ))
                print("[OK] Added custom_width column")

            # Add custom_length column (nullable - NULL means use structure default)
            if 'custom_length' not in columns:
                db.session.execute(text(
                    'ALTER TABLE placed_structure ADD COLUMN custom_length FLOAT'
                ))
                print("[OK] Added custom_length column")

            db.session.commit()
            print("[OK] Migration completed successfully!")
            print("\nExisting placed structures will use structure definition defaults.")
            print("New structures can specify custom dimensions via the API.")

        except Exception as e:
            db.session.rollback()
            print(f"[ERROR] Migration failed: {str(e)}")
            raise

if __name__ == '__main__':
    print("=" * 60)
    print("Custom Structure Dimensions Migration")
    print("=" * 60)
    run_migration()
