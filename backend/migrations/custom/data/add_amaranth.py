#!/usr/bin/env python3
"""Add amaranth to plant database and seed catalog"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
from datetime import datetime
from plant_database import PLANT_DATABASE, get_plant_by_id

# Check if amaranth exists in plant database
amaranth_plants = [p for p in PLANT_DATABASE if 'amaranth' in p.get('name', '').lower()]

print('=== AMARANTH STATUS ===')
print('\nPlant Database:')
if amaranth_plants:
    for p in amaranth_plants:
        print(f'  - {p.get("id")}: {p.get("name")}')
    amaranth_id = amaranth_plants[0].get('id')
else:
    print('  NOT FOUND - Need to add to plant_database.py')
    amaranth_id = 'amaranth-1'  # Will need to be added manually

# Check seed catalog
conn = sqlite3.connect(os.path.join(backend_dir, 'instance', 'homestead.db'))
cursor = conn.cursor()

cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id LIKE "%amaranth%" AND is_global = 1')
count = cursor.fetchone()[0]
print(f'\nSeed Catalog:')
print(f'  Amaranth varieties: {count}')

if amaranth_plants:
    print('\nAdding amaranth varieties to seed catalog...\n')

    # Amaranth varieties
    varieties = [
        # User requested
        ('Red Leaf Amaranth', 77),  # Average of 75-80

        # Leaf amaranths (vegetable types)
        ('Red Garnet', 40),
        ('Green Calaloo', 45),
        ('Chinese Spinach', 40),
        ('Tender Leaf', 35),

        # Grain amaranths
        ('Golden Giant', 110),
        ('Hopi Red Dye', 100),
        ('Elephant Head', 90),
        ('Burgundy', 100),
        ('Love Lies Bleeding', 90),

        # Dual purpose
        ('Opopeo', 90),
        ('Alegria', 100),
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
            amaranth_id,
            variety,
            None,
            True,  # is_global
            dtm,
            12,    # plant_spacing
            18,    # row_spacing
            0.25,  # planting_depth
            65,    # germination_temp_min
            85,    # germination_temp_max
            65,    # soil_temp_min
            7,     # germination_days
            'summer',
            'Heat-loving plant. Grown for nutritious leaves or grain seeds.',
            datetime.now()
        ))
        print(f'  Added: {variety} ({dtm} days)')

    conn.commit()

    cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id LIKE "%amaranth%" AND is_global = 1')
    total = cursor.fetchone()[0]
    print(f'\nTotal amaranth varieties in catalog: {total}')
else:
    print('\nCannot add varieties - amaranth not in plant database')
    print('Need to add amaranth-1 to backend/plant_database.py first')

conn.close()
