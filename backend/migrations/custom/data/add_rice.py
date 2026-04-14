#!/usr/bin/env python3
"""Add rice to plant database and seed catalog"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
from datetime import datetime
from plant_database import PLANT_DATABASE, get_plant_by_id

# Check if rice exists in plant database
rice_plants = [p for p in PLANT_DATABASE if 'rice' in p.get('name', '').lower()]

print('=== RICE STATUS ===')
print('\nPlant Database:')
if rice_plants:
    for p in rice_plants:
        print(f'  - {p.get("id")}: {p.get("name")}')
    rice_id = rice_plants[0].get('id')
else:
    print('  NOT FOUND - Need to add to plant_database.py')
    rice_id = 'rice-1'  # Will need to be added manually

# Check seed catalog
conn = sqlite3.connect(os.path.join(backend_dir, 'instance', 'homestead.db'))
cursor = conn.cursor()

cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id LIKE "%rice%" AND is_global = 1')
count = cursor.fetchone()[0]
print(f'\nSeed Catalog:')
print(f'  Rice varieties: {count}')

if rice_plants:
    print('\nAdding rice varieties to seed catalog...\n')

    # Rice varieties
    varieties = [
        # Long grain
        ('Long Grain Brown Rice', 120),
        ('Long Grain White Rice', 120),
        ('Jasmine Rice', 125),
        ('Basmati Rice', 130),

        # Medium grain
        ('Medium Grain Brown Rice', 115),
        ('Calrose Rice', 120),

        # Short grain
        ('Short Grain Brown Rice', 115),
        ('Arborio Rice', 125),
        ('Sushi Rice', 120),

        # Specialty
        ('Black Rice (Forbidden Rice)', 130),
        ('Red Rice', 125),
        ('Wild Rice Mix', 120),
    ]

    for variety, dtm in varieties:
        cursor.execute('''
            INSERT INTO seed_inventory (
                plant_id, variety, brand, is_global,
                days_to_maturity, plant_spacing, row_spacing, planting_depth,
                germination_temp_min, germination_temp_max, soil_temp_min,
                germination_days, ideal_seasons, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            rice_id,
            variety,
            None,
            True,  # is_global
            dtm,
            6,     # plant_spacing
            12,    # row_spacing
            1,     # planting_depth
            68,    # germination_temp_min
            95,    # germination_temp_max
            68,    # soil_temp_min
            7,     # germination_days
            'summer',
            'Warm-season grain. Requires consistent moisture or flooding. Long growing season. Best in warm climates.',
            datetime.now()
        ))
        print(f'  Added: {variety} ({dtm} days)')

    conn.commit()

    cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id LIKE "%rice%" AND is_global = 1')
    total = cursor.fetchone()[0]
    print(f'\nTotal rice varieties in catalog: {total}')
else:
    print('\nCannot add varieties - rice not in plant database')
    print('Need to add rice-1 to backend/plant_database.py first')

conn.close()
