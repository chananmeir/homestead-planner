#!/usr/bin/env python3
"""Add catnip to plant database and seed catalog"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
from datetime import datetime
from plant_database import PLANT_DATABASE, get_plant_by_id

# Check if catnip exists in plant database
catnip_plants = [p for p in PLANT_DATABASE if 'catnip' in p.get('name', '').lower()]

print('=== CATNIP STATUS ===')
print('\nPlant Database:')
if catnip_plants:
    for p in catnip_plants:
        print(f'  - {p.get("id")}: {p.get("name")}')
    catnip_id = catnip_plants[0].get('id')
else:
    print('  NOT FOUND - Need to add to plant_database.py')
    catnip_id = 'catnip-1'  # Will need to be added manually

# Check seed catalog
conn = sqlite3.connect(os.path.join(backend_dir, 'instance', 'homestead.db'))
cursor = conn.cursor()

cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id LIKE "%catnip%" AND is_global = 1')
count = cursor.fetchone()[0]
print(f'\nSeed Catalog:')
print(f'  Catnip varieties: {count}')

if catnip_plants:
    print('\nAdding catnip varieties to seed catalog...\n')

    # Catnip varieties
    varieties = [
        ('Common Catnip', 90),
        ('Lemon Catnip', 85),
        ('Greek Catnip', 95),
        ('Catmint (Nepeta mussinii)', 80),
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
            catnip_id,
            variety,
            None,
            True,  # is_global
            dtm,
            18,    # plant_spacing
            24,    # row_spacing
            0.125, # planting_depth
            65,    # germination_temp_min
            75,    # germination_temp_max
            65,    # soil_temp_min
            7,     # germination_days
            'spring,fall',
            'Perennial herb attractive to cats. Drought tolerant once established.',
            datetime.now()
        ))
        print(f'  Added: {variety} ({dtm} days)')

    conn.commit()

    cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id LIKE "%catnip%" AND is_global = 1')
    total = cursor.fetchone()[0]
    print(f'\nTotal catnip varieties in catalog: {total}')
else:
    print('\nCannot add varieties - catnip not in plant database')
    print('Need to add catnip-1 to backend/plant_database.py first')

conn.close()
