#!/usr/bin/env python
"""
Migration: Add nutritional_data table for tracking nutritional content and yield estimates

This table stores nutritional information for all food sources (plants, eggs, milk, meat, honey).
Integrates with USDA FoodData Central for accurate nutritional data.

Run from backend directory:
    python migrations/custom/schema/add_nutritional_data_table.py
"""
import sqlite3
import os
from datetime import datetime

# Path to database file
DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'instance', 'homestead.db')

def main():
    print("[INFO] Creating nutritional_data table...")

    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if table already exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='nutritional_data'")
        if cursor.fetchone():
            print("[OK] Table nutritional_data already exists. Skipping.")
            return

        # Create nutritional_data table
        cursor.execute('''
            CREATE TABLE nutritional_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_type VARCHAR(50) NOT NULL,
                source_id VARCHAR(100) NOT NULL,
                name VARCHAR(200) NOT NULL,
                usda_fdc_id INTEGER,

                -- Nutritional values per 100g
                calories FLOAT,
                protein_g FLOAT,
                carbs_g FLOAT,
                fat_g FLOAT,
                fiber_g FLOAT,

                -- Vitamins (per 100g)
                vitamin_a_iu FLOAT,
                vitamin_c_mg FLOAT,
                vitamin_k_mcg FLOAT,
                vitamin_e_mg FLOAT,
                folate_mcg FLOAT,

                -- Minerals (per 100g)
                calcium_mg FLOAT,
                iron_mg FLOAT,
                magnesium_mg FLOAT,
                potassium_mg FLOAT,
                zinc_mg FLOAT,

                -- Yield estimation data
                average_yield_lbs_per_plant FLOAT,
                average_yield_lbs_per_sqft FLOAT,
                average_yield_lbs_per_tree_year FLOAT,

                data_source VARCHAR(100),
                notes TEXT,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                user_id INTEGER,

                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(source_type, source_id, user_id)
            )
        ''')

        # Create indexes for better query performance
        cursor.execute('''
            CREATE INDEX idx_nutritional_data_source
            ON nutritional_data(source_type, source_id)
        ''')

        cursor.execute('''
            CREATE INDEX idx_nutritional_data_user
            ON nutritional_data(user_id)
        ''')

        conn.commit()
        print("[OK] Successfully created nutritional_data table")

        # Verify table was created
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='nutritional_data'")
        result = cursor.fetchone()
        if result:
            print(f"[OK] Verified table exists: {result[0]}")
        else:
            print("[WARNING] Table not found after creation")

        # Show table schema
        cursor.execute("PRAGMA table_info(nutritional_data)")
        columns = cursor.fetchall()
        print(f"\n[INFO] Table schema ({len(columns)} columns):")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")

        # Show indexes
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='nutritional_data'")
        indexes = cursor.fetchall()
        print(f"\n[INFO] Indexes created ({len(indexes)}):")
        for idx in indexes:
            print(f"  - {idx[0]}")

    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Migration failed: {e}")
        raise
    finally:
        conn.close()

    print("\n[OK] Migration completed successfully")

if __name__ == '__main__':
    main()
