#!/usr/bin/env python3
"""Add burdock to plant database and seed catalog"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
from datetime import datetime
from plant_database import PLANT_DATABASE, get_plant_by_id

# Check if burdock exists in plant database
burdock_plants = [p for p in PLANT_DATABASE if 'burdock' in p.get('name', '').lower()]

print('=== BURDOCK STATUS ===')
print('\nPlant Database:')
if burdock_plants:
    for p in burdock_plants:
        print(f'  - {p.get("id")}: {p.get("name")}')
    burdock_id = burdock_plants[0].get('id')
else:
    print('  NOT FOUND - Need to add to plant_database.py')
    burdock_id = 'burdock-1'  # Will need to be added manually

# Check seed catalog
conn = sqlite3.connect(os.path.join(backend_dir, 'instance', 'homestead.db'))
cursor = conn.cursor()

cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id = ? AND is_global = 1', (burdock_id,))
count = cursor.fetchone()[0]
print(f'\nSeed Catalog:')
print(f'  Burdock varieties: {count}')

if burdock_plants:
    print('\nAdding burdock varieties to seed catalog...\n')

    # Burdock varieties
    varieties = [
        ('Takinogawa Long', 120),
        ('Watanabe Early', 110),
        ('Common Burdock', 120),
        ('Greater Burdock', 125),
        ('Kinpira Gobo', 115),
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
            burdock_id,
            variety,
            None,
            True,  # is_global
            dtm,
            12,    # plant_spacing
            24,    # row_spacing
            0.5,   # planting_depth
            50,    # germination_temp_min
            85,    # germination_temp_max
            50,    # soil_temp_min
            14,    # germination_days
            'spring,fall',
            'Biennial root vegetable (gobo). Deep taproot needs loose, deep soil. Harvest first-year roots.',
            datetime.now()
        ))
        print(f'  Added: {variety} ({dtm} days)')

    conn.commit()

    cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id = ? AND is_global = 1', (burdock_id,))
    total = cursor.fetchone()[0]
    print(f'\nTotal burdock varieties in catalog: {total}')
else:
    print('\nCannot add varieties - burdock not in plant database')
    print('Need to add burdock-1 to backend/plant_database.py first')

conn.close()
