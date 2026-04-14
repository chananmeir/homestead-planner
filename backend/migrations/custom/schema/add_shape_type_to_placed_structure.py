"""
Migration script to add shape_type support to placed_structure table.

This allows structures to be rectangles or circles (for ponds, roundabouts, etc.).

For rectangles: use width and length (or custom_width and custom_length)
For circles: width represents diameter, length is ignored

Run this migration:
    cd backend
    python add_shape_type_to_placed_structure.py
"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
from app import app, db
from sqlalchemy import text

def run_migration():
    """Add shape_type column to placed_structure table."""
    with app.app_context():
        try:
            # Check if column already exists
            inspector = db.inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('placed_structure')]

            if 'shape_type' in columns:
                print("[OK] Column already exists. Migration already applied.")
                return

            print("Adding shape_type column to placed_structure table...")

            # Add shape_type column (default to 'rectangle' for backward compatibility)
            db.session.execute(text(
                "ALTER TABLE placed_structure ADD COLUMN shape_type VARCHAR(20) DEFAULT 'rectangle'"
            ))
            print("[OK] Added shape_type column (default: 'rectangle')")

            db.session.commit()
            print("[OK] Migration completed successfully!")
            print("\nExisting structures will default to 'rectangle' shape.")
            print("New structures can specify 'circle' for circular shapes (ponds, etc.).")

        except Exception as e:
            db.session.rollback()
            print(f"[ERROR] Migration failed: {str(e)}")
            raise

if __name__ == '__main__':
    print("=" * 60)
    print("Circular Structure Support Migration")
    print("=" * 60)
    run_migration()
