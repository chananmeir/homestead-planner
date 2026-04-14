#!/usr/bin/env python
"""
Migration: Add seeds_per_packet column to SeedInventory table

This field stores the number of seeds per packet for better seed quantity tracking.
Default: 50 seeds per packet (common industry standard)

Run from backend directory:
    python migrations/custom/schema/add_seeds_per_packet.py
"""
import sqlite3
import os

# Path to database file
DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'instance', 'homestead.db')

def main():
    print("Adding seeds_per_packet column to seed_inventory table...")

    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(seed_inventory)")
        columns = [row[1] for row in cursor.fetchall()]

        if 'seeds_per_packet' in columns:
            print("[OK] Column seeds_per_packet already exists. Skipping.")
            return

        # Add the column with default value
        cursor.execute("""
            ALTER TABLE seed_inventory
            ADD COLUMN seeds_per_packet INTEGER DEFAULT 50
        """)

        conn.commit()
        print("[OK] Successfully added seeds_per_packet column")

        # Verify
        cursor.execute("SELECT COUNT(*) FROM seed_inventory")
        count = cursor.fetchone()[0]
        print(f"[OK] Verified: {count} rows in seed_inventory table")

    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Error: {e}")
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    main()
