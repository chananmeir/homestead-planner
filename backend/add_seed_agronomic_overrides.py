#!/usr/bin/env python3
"""
Database Migration: Add Variety-Specific Agronomic Override Fields to Seed Inventory

This migration adds nullable override columns to the seed_inventory table, allowing
seeds to store variety-specific agronomic data while maintaining backward compatibility
with plant_database.py defaults.

Fields Added:
- Core agronomic: days_to_maturity, germination_days, plant_spacing, row_spacing, planting_depth
- Temperature: germination_temp_min, germination_temp_max, soil_temp_min
- Qualitative: heat_tolerance, cold_tolerance, bolt_resistance, ideal_seasons
- Variety-specific: flavor_profile, storage_rating

All fields are nullable - NULL means "use plant_id default from plant_database.py"

Usage:
    cd backend
    python add_seed_agronomic_overrides.py
"""

import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).parent / 'instance' / 'homestead.db'


def add_agronomic_override_columns():
    """Add variety-specific agronomic override columns to seed_inventory table."""

    print("=" * 80)
    print("SEED AGRONOMIC OVERRIDES MIGRATION")
    print("=" * 80)
    print(f"\nDatabase: {DB_PATH}")

    if not DB_PATH.exists():
        print(f"\n[ERROR] Database not found at {DB_PATH}")
        print("Make sure you're running this script from the backend directory.")
        return 1

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check if columns already exist
    cursor.execute("PRAGMA table_info(seed_inventory)")
    existing_columns = [row[1] for row in cursor.fetchall()]

    new_columns = [
        'days_to_maturity',
        'germination_days',
        'plant_spacing',
        'row_spacing',
        'planting_depth',
        'germination_temp_min',
        'germination_temp_max',
        'soil_temp_min',
        'heat_tolerance',
        'cold_tolerance',
        'bolt_resistance',
        'ideal_seasons',
        'flavor_profile',
        'storage_rating'
    ]

    already_added = [col for col in new_columns if col in existing_columns]
    to_add = [col for col in new_columns if col not in existing_columns]

    if already_added:
        print(f"\n[INFO] These columns already exist (skipping): {', '.join(already_added)}")

    if not to_add:
        print("\n[SUCCESS] All agronomic override columns already exist!")
        print("No migration needed.")
        conn.close()
        return 0

    print(f"\nAdding {len(to_add)} new columns to seed_inventory table...")
    print("-" * 80)

    try:
        # Define column specifications: (name, type, description)
        column_specs = [
            ('days_to_maturity', 'INTEGER', 'Override DTM for variety'),
            ('germination_days', 'INTEGER', 'Days from planting to emergence'),
            ('plant_spacing', 'INTEGER', 'Inches between plants'),
            ('row_spacing', 'INTEGER', 'Inches between rows'),
            ('planting_depth', 'REAL', 'Inches deep'),
            ('germination_temp_min', 'INTEGER', 'Min germination temp (F)'),
            ('germination_temp_max', 'INTEGER', 'Max germination temp (F)'),
            ('soil_temp_min', 'INTEGER', 'Min soil temp for planting (F)'),
            ('heat_tolerance', 'VARCHAR(20)', 'low/medium/high/excellent'),
            ('cold_tolerance', 'VARCHAR(20)', 'tender/hardy/very-hardy'),
            ('bolt_resistance', 'VARCHAR(20)', 'low/medium/high'),
            ('ideal_seasons', 'VARCHAR(100)', 'Comma-separated: spring,summer,fall,winter'),
            ('flavor_profile', 'TEXT', 'Flavor description'),
            ('storage_rating', 'VARCHAR(20)', 'poor/fair/good/excellent'),
        ]

        # Add columns using loop
        for column_name, column_type, description in column_specs:
            if column_name in to_add:
                cursor.execute(f"ALTER TABLE seed_inventory ADD COLUMN {column_name} {column_type}")
                print(f"  [OK] {column_name} ({column_type}) - {description}")

        conn.commit()

        print("\n" + "=" * 80)
        print("[SUCCESS] Migration completed successfully!")
        print("=" * 80)
        print(f"\nAdded {len(to_add)} new columns to seed_inventory table")
        print("\nAll columns are nullable - NULL means 'use plant_id default'")
        print("\nNext Steps:")
        print("  1. Update models.py with new fields")
        print("  2. Update API endpoints to return merged data (override || default)")
        print("  3. Update CSV import service to populate overrides")
        print("  4. Update frontend to display/edit override fields")
        print("\n" + "=" * 80)

    except sqlite3.Error as e:
        conn.rollback()
        print(f"\n[ERROR] Migration failed: {e}")
        return 1
    finally:
        conn.close()

    return 0


if __name__ == '__main__':
    import sys
    sys.exit(add_agronomic_override_columns())
