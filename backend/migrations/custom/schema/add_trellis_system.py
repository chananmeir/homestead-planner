"""
Migration script to add trellis system support.

This adds:
1. New trellis_structure table for managing linear trellis structures
2. Trellis allocation fields to planting_event table for crops like grapes, pole beans

Run this migration:
    cd backend
    python migrations/custom/schema/add_trellis_system.py
"""

# Path setup for running from migrations/custom/schema/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
from app import app, db
from models import TrellisStructure, PlantingEvent
from sqlalchemy import text

def run_migration():
    """Add trellis_structure table and trellis fields to planting_event."""
    with app.app_context():
        try:
            inspector = db.inspect(db.engine)
            existing_tables = inspector.get_table_names()

            # Step 1: Create trellis_structure table if it doesn't exist
            if 'trellis_structure' not in existing_tables:
                print("Creating trellis_structure table...")
                db.session.execute(text("""
                    CREATE TABLE trellis_structure (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        property_id INTEGER NOT NULL,
                        garden_bed_id INTEGER,
                        name VARCHAR(100) NOT NULL,
                        trellis_type VARCHAR(50) DEFAULT 'post_wire',
                        start_x FLOAT NOT NULL,
                        start_y FLOAT NOT NULL,
                        end_x FLOAT NOT NULL,
                        end_y FLOAT NOT NULL,
                        total_length_feet FLOAT NOT NULL,
                        total_length_inches FLOAT NOT NULL,
                        height_inches FLOAT DEFAULT 72.0,
                        wire_spacing_inches FLOAT,
                        num_wires INTEGER,
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id),
                        FOREIGN KEY (property_id) REFERENCES property(id),
                        FOREIGN KEY (garden_bed_id) REFERENCES garden_bed(id)
                    )
                """))
                print("[OK] Created trellis_structure table")
            else:
                print("[OK] trellis_structure table already exists")

            # Step 2: Add trellis fields to planting_event table
            planting_event_columns = [col['name'] for col in inspector.get_columns('planting_event')]

            trellis_fields = [
                ('trellis_structure_id', 'INTEGER', 'FOREIGN KEY (trellis_structure_id) REFERENCES trellis_structure(id)'),
                ('trellis_position_start_inches', 'FLOAT', None),
                ('trellis_position_end_inches', 'FLOAT', None),
                ('linear_feet_allocated', 'FLOAT', None)
            ]

            for field_name, field_type, constraint in trellis_fields:
                if field_name not in planting_event_columns:
                    print(f"Adding {field_name} column to planting_event...")
                    db.session.execute(text(
                        f'ALTER TABLE planting_event ADD COLUMN {field_name} {field_type}'
                    ))
                    print(f"[OK] Added {field_name} column")
                else:
                    print(f"[OK] {field_name} column already exists")

            db.session.commit()
            print("\n" + "=" * 60)
            print("[SUCCESS] Trellis system migration completed!")
            print("=" * 60)
            print("\nNew features:")
            print("- TrellisStructure table for managing trellis structures")
            print("- PlantingEvent supports trellis allocation (grapes, pole beans, etc.)")
            print("\nNext steps:")
            print("1. Create trellis structures via API")
            print("2. Place trellis crops with trellisStructureId in planting data")

        except Exception as e:
            db.session.rollback()
            print(f"\n[ERROR] Migration failed: {str(e)}")
            raise

if __name__ == '__main__':
    print("=" * 60)
    print("Trellis System Migration")
    print("=" * 60)
    run_migration()
