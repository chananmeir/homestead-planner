"""
Make property_id optional for TrellisStructure

This allows users to create trellises from Garden Designer without needing
to create a property in Property Designer first.

Usage:
    cd backend
    python migrations/custom/schema/make_trellis_property_optional.py
"""

import sys
import os

# Add backend directory to path
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, backend_dir)

from app import app, db
from sqlalchemy import text

def run_migration():
    with app.app_context():
        try:
            # Make property_id nullable in trellis_structure table
            with db.engine.connect() as conn:
                # SQLite doesn't support ALTER COLUMN, so we need to recreate the table
                print("Making property_id optional in trellis_structure table...")

                # Check if property_id is already nullable
                result = conn.execute(text("PRAGMA table_info(trellis_structure)"))
                columns = result.fetchall()

                property_id_col = None
                for col in columns:
                    if col[1] == 'property_id':
                        property_id_col = col
                        break

                if property_id_col and property_id_col[3] == 1:  # notnull = 1 means NOT NULL
                    print("  - Creating backup of trellis_structure...")
                    conn.execute(text("""
                        CREATE TABLE trellis_structure_backup AS
                        SELECT * FROM trellis_structure
                    """))
                    conn.commit()

                    print("  - Dropping original table...")
                    conn.execute(text("DROP TABLE trellis_structure"))
                    conn.commit()

                    print("  - Creating new table with nullable property_id...")
                    conn.execute(text("""
                        CREATE TABLE trellis_structure (
                            id INTEGER PRIMARY KEY,
                            user_id INTEGER NOT NULL,
                            property_id INTEGER,
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
                            created_at DATETIME,
                            FOREIGN KEY (user_id) REFERENCES users(id),
                            FOREIGN KEY (property_id) REFERENCES property(id),
                            FOREIGN KEY (garden_bed_id) REFERENCES garden_bed(id)
                        )
                    """))
                    conn.commit()

                    print("  - Restoring data...")
                    conn.execute(text("""
                        INSERT INTO trellis_structure
                        SELECT * FROM trellis_structure_backup
                    """))
                    conn.commit()

                    print("  - Dropping backup table...")
                    conn.execute(text("DROP TABLE trellis_structure_backup"))
                    conn.commit()

                    print("✅ Migration completed successfully!")
                else:
                    print("✅ property_id is already nullable, no migration needed")

        except Exception as e:
            print(f"❌ Migration failed: {e}")
            import traceback
            traceback.print_exc()
            raise

if __name__ == '__main__':
    run_migration()
