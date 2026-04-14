"""
Add Garden Planner Tables Migration

Creates two new tables:
- garden_plan: Stores garden season plans
- garden_plan_item: Stores individual crop plans within a garden plan

Also adds seeds_per_packet field to seed_inventory table.

Run with: python backend/migrations/custom/schema/add_garden_planner_tables.py
"""

import sys
import os

# Add backend directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

from models import db
from app import app


def run_migration():
    """Run the migration to add garden planner tables"""
    with app.app_context():
        print("=" * 60)
        print("GARDEN PLANNER TABLES MIGRATION")
        print("=" * 60)

        # Check if tables already exist
        inspector = db.inspect(db.engine)
        existing_tables = inspector.get_table_names()

        if 'garden_plan' in existing_tables:
            print("✓ Table 'garden_plan' already exists, skipping creation")
        else:
            print("Creating 'garden_plan' table...")
            db.session.execute("""
                CREATE TABLE garden_plan (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    name VARCHAR(200) NOT NULL,
                    season VARCHAR(20),
                    year INTEGER NOT NULL,
                    strategy VARCHAR(50) DEFAULT 'balanced',
                    succession_preference VARCHAR(20) DEFAULT 'moderate',
                    target_total_plants INTEGER,
                    target_diversity INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    notes TEXT,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """)
            print("✓ Created 'garden_plan' table")

        if 'garden_plan_item' in existing_tables:
            print("✓ Table 'garden_plan_item' already exists, skipping creation")
        else:
            print("Creating 'garden_plan_item' table...")
            db.session.execute("""
                CREATE TABLE garden_plan_item (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    garden_plan_id INTEGER NOT NULL,
                    seed_inventory_id INTEGER,
                    plant_id VARCHAR(50) NOT NULL,
                    variety VARCHAR(100),
                    unit_type VARCHAR(20) DEFAULT 'plants',
                    target_value FLOAT NOT NULL,
                    plant_equivalent INTEGER NOT NULL,
                    seeds_required INTEGER,
                    seed_packets_required INTEGER,
                    succession_enabled BOOLEAN DEFAULT 0,
                    succession_count INTEGER DEFAULT 1,
                    succession_interval_days INTEGER,
                    first_plant_date DATE,
                    last_plant_date DATE,
                    harvest_window_start DATE,
                    harvest_window_end DATE,
                    beds_allocated TEXT,
                    space_required_cells INTEGER,
                    status VARCHAR(20) DEFAULT 'planned',
                    export_key VARCHAR(100),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (garden_plan_id) REFERENCES garden_plan(id) ON DELETE CASCADE,
                    FOREIGN KEY (seed_inventory_id) REFERENCES seed_inventory(id)
                )
            """)
            print("✓ Created 'garden_plan_item' table")

        # Add seeds_per_packet column to seed_inventory if it doesn't exist
        try:
            columns = [col['name'] for col in inspector.get_columns('seed_inventory')]
            if 'seeds_per_packet' not in columns:
                print("Adding 'seeds_per_packet' column to 'seed_inventory' table...")
                db.session.execute("""
                    ALTER TABLE seed_inventory ADD COLUMN seeds_per_packet INTEGER DEFAULT 50
                """)
                print("✓ Added 'seeds_per_packet' column")
            else:
                print("✓ Column 'seeds_per_packet' already exists")
        except Exception as e:
            print(f"Warning: Could not add seeds_per_packet column: {e}")

        # Add export_key column to planting_event if it doesn't exist (for idempotent exports)
        try:
            columns = [col['name'] for col in inspector.get_columns('planting_event')]
            if 'export_key' not in columns:
                print("Adding 'export_key' column to 'planting_event' table...")
                db.session.execute("""
                    ALTER TABLE planting_event ADD COLUMN export_key VARCHAR(100)
                """)
                print("✓ Added 'export_key' column to planting_event")
            else:
                print("✓ Column 'export_key' already exists in planting_event")
        except Exception as e:
            print(f"Warning: Could not add export_key column: {e}")

        db.session.commit()

        print()
        print("=" * 60)
        print("MIGRATION COMPLETED SUCCESSFULLY")
        print("=" * 60)
        print()
        print("Next steps:")
        print("1. Restart the backend server")
        print("2. Navigate to the 'Season Planner' tab in the app")
        print("3. Create your first garden plan!")


if __name__ == '__main__':
    try:
        run_migration()
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
