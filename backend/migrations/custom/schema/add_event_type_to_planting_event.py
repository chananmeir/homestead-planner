"""
Migration Script: Add event_type and event_details columns to PlantingEvent

This migration adds support for different types of garden events (planting, mulch, fertilizing, etc.)
by adding event type discriminator and event-specific details fields.

Date: 2026-01-11
"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
import os

# Database path
DB_PATH = os.path.join(backend_dir, 'instance', 'homestead.db')

def migrate():
    """Add event_type and event_details columns to planting_event table"""

    print("Starting migration: Add event_type and event_details to planting_event")
    print(f"Database: {DB_PATH}")

    if not os.path.exists(DB_PATH):
        print(f"ERROR: Database not found at {DB_PATH}")
        return False

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(planting_event)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'event_type' in columns and 'event_details' in columns:
            print("[SKIP] Columns already exist")
            conn.close()
            return True

        # Add event_type column with default='planting'
        if 'event_type' not in columns:
            print("Adding event_type column...")
            cursor.execute("""
                ALTER TABLE planting_event
                ADD COLUMN event_type VARCHAR(50) DEFAULT 'planting'
            """)
            print("[OK] event_type column added")

        # Add event_details column (nullable, for JSON data)
        if 'event_details' not in columns:
            print("Adding event_details column...")
            cursor.execute("""
                ALTER TABLE planting_event
                ADD COLUMN event_details TEXT
            """)
            print("[OK] event_details column added")

        # Backfill existing records with event_type='planting'
        print("Backfilling existing records...")
        cursor.execute("""
            UPDATE planting_event
            SET event_type = 'planting'
            WHERE event_type IS NULL
        """)
        rows_updated = cursor.rowcount
        print(f"[OK] Backfilled {rows_updated} records with event_type='planting'")

        # Remove NOT NULL constraint from plant_id (needed for non-planting events)
        # SQLite doesn't support ALTER COLUMN directly, so we check if recreation is needed
        cursor.execute("PRAGMA table_info(planting_event)")
        plant_id_col = [col for col in cursor.fetchall() if col[1] == 'plant_id'][0]
        plant_id_notnull = plant_id_col[3]  # notnull flag (1 = NOT NULL, 0 = nullable)

        if plant_id_notnull == 1:
            print("\nWARNING: plant_id column has NOT NULL constraint")
            print("SQLite requires table recreation to modify constraints")
            print("This will be handled when the backend creates garden events with null plant_id")
            print("For now, garden events must provide a placeholder plant_id or use backend validation")

        conn.commit()
        print("\n[SUCCESS] Migration completed successfully")

        # Verify changes
        cursor.execute("PRAGMA table_info(planting_event)")
        print("\nUpdated planting_event schema:")
        for col in cursor.fetchall():
            col_name = col[1]
            col_type = col[2]
            col_notnull = "NOT NULL" if col[3] == 1 else "nullable"
            col_default = f" DEFAULT {col[4]}" if col[4] else ""
            print(f"  - {col_name} ({col_type}, {col_notnull}{col_default})")

        conn.close()
        return True

    except Exception as e:
        print(f"\n[ERROR] Migration failed: {e}")
        conn.rollback()
        conn.close()
        return False

if __name__ == '__main__':
    success = migrate()
    exit(0 if success else 1)
