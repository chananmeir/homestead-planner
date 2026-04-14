"""
Migration script to add indoor_seed_start table for tracking indoor seed starting.

Usage:
    python add_indoor_seed_start_table.py
"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
from datetime import datetime

DATABASE_PATH = os.path.join(backend_dir, 'instance', 'homestead.db')

def run_migration():
    """Add indoor_seed_start table to database"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    print("[INFO] Starting migration: Add indoor_seed_start table")

    try:
        # Create indoor_seed_start table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS indoor_seed_start (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plant_id VARCHAR(50) NOT NULL,
                variety VARCHAR(100),
                seed_inventory_id INTEGER,
                start_date DATETIME NOT NULL,
                expected_germination_date DATETIME,
                expected_transplant_date DATETIME,
                actual_transplant_date DATETIME,
                seeds_started INTEGER NOT NULL,
                seeds_germinated INTEGER DEFAULT 0,
                expected_germination_rate FLOAT,
                actual_germination_rate FLOAT,
                location VARCHAR(100),
                light_hours INTEGER,
                temperature INTEGER,
                status VARCHAR(20) DEFAULT 'seeded',
                hardening_off_started DATETIME,
                transplant_ready BOOLEAN DEFAULT 0,
                planting_event_id INTEGER,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (seed_inventory_id) REFERENCES seed_inventory(id),
                FOREIGN KEY (planting_event_id) REFERENCES planting_event(id)
            )
        ''')

        conn.commit()
        print("[OK] Successfully created indoor_seed_start table")

        # Verify table was created
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='indoor_seed_start'")
        result = cursor.fetchone()
        if result:
            print(f"[OK] Verified table exists: {result[0]}")
        else:
            print("[WARNING] Table not found after creation")

        # Show table schema
        cursor.execute("PRAGMA table_info(indoor_seed_start)")
        columns = cursor.fetchall()
        print(f"\n[INFO] Table schema ({len(columns)} columns):")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")

    except sqlite3.Error as e:
        print(f"[ERROR] Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

    print("\n[OK] Migration completed successfully")

if __name__ == '__main__':
    run_migration()
