#!/usr/bin/env python
"""
Import baseline nutritional data from CSV into nutritional_data table

This script imports nutritional and yield data for 30 common garden crops.
Data includes USDA nutritional values and yield estimates.

Run from backend directory:
    python migrations/custom/data/import_baseline_nutrition.py
"""
import sqlite3
import os
import csv
from datetime import datetime

# Paths
DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'instance', 'homestead.db')
CSV_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'data', 'baseline_nutrition.csv')

def main():
    print("[INFO] Importing baseline nutritional data from CSV...")

    # Verify CSV exists
    if not os.path.exists(CSV_PATH):
        print(f"[ERROR] CSV file not found: {CSV_PATH}")
        return

    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Read and import CSV data
        with open(CSV_PATH, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            rows_imported = 0
            rows_skipped = 0

            for row in reader:
                # Check if entry already exists
                cursor.execute("""
                    SELECT id FROM nutritional_data
                    WHERE source_type = ? AND source_id = ? AND user_id IS NULL
                """, (row['source_type'], row['source_id']))

                if cursor.fetchone():
                    print(f"[SKIP] Entry already exists: {row['name']}")
                    rows_skipped += 1
                    continue

                # Helper function to convert empty strings to None
                def val(key):
                    v = row.get(key, '').strip()
                    return None if v == '' else v

                # Insert nutrition data
                cursor.execute("""
                    INSERT INTO nutritional_data (
                        source_type, source_id, name, usda_fdc_id,
                        calories, protein_g, carbs_g, fat_g, fiber_g,
                        vitamin_a_iu, vitamin_c_mg, vitamin_k_mcg, vitamin_e_mg, folate_mcg,
                        calcium_mg, iron_mg, magnesium_mg, potassium_mg, zinc_mg,
                        average_yield_lbs_per_plant, average_yield_lbs_per_sqft,
                        data_source, notes, last_updated, user_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    row['source_type'],
                    row['source_id'],
                    row['name'],
                    val('usda_fdc_id'),
                    val('calories'),
                    val('protein_g'),
                    val('carbs_g'),
                    val('fat_g'),
                    val('fiber_g'),
                    val('vitamin_a_iu'),
                    val('vitamin_c_mg'),
                    val('vitamin_k_mcg'),
                    val('vitamin_e_mg'),
                    val('folate_mcg'),
                    val('calcium_mg'),
                    val('iron_mg'),
                    val('magnesium_mg'),
                    val('potassium_mg'),
                    val('zinc_mg'),
                    val('average_yield_lbs_per_plant'),
                    val('average_yield_lbs_per_sqft'),
                    row['data_source'],
                    val('notes'),
                    datetime.utcnow().isoformat(),
                    None  # Global data (not user-specific)
                ))

                rows_imported += 1
                print(f"[OK] Imported: {row['name']}")

        conn.commit()
        print(f"\n[OK] Import completed: {rows_imported} rows imported, {rows_skipped} rows skipped")

        # Verify data
        cursor.execute("SELECT COUNT(*) FROM nutritional_data WHERE user_id IS NULL")
        total_count = cursor.fetchone()[0]
        print(f"[OK] Total global nutrition entries in database: {total_count}")

        # Show sample data
        cursor.execute("""
            SELECT name, calories, protein_g, average_yield_lbs_per_plant
            FROM nutritional_data
            WHERE user_id IS NULL
            LIMIT 5
        """)
        samples = cursor.fetchall()
        print("\n[INFO] Sample entries:")
        for sample in samples:
            print(f"  - {sample[0]}: {sample[1]} cal, {sample[2]}g protein, {sample[3]} lbs/plant")

    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Import failed: {e}")
        raise
    finally:
        conn.close()

    print("\n[OK] Baseline nutritional data import completed successfully")

if __name__ == '__main__':
    main()
