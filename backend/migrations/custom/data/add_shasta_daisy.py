#!/usr/bin/env python3
"""Add Shasta daisy to plant database and seed catalog"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
from datetime import datetime
from plant_database import PLANT_DATABASE, get_plant_by_id

# Check if shasta daisy exists in plant database
daisy_plants = [p for p in PLANT_DATABASE if 'shasta' in p.get('name', '').lower() or ('daisy' in p.get('name', '').lower() and 'shasta' in p.get('id', ''))]

print('=== SHASTA DAISY STATUS ===')
print('\nPlant Database:')
if daisy_plants:
    for p in daisy_plants:
        print(f'  - {p.get("id")}: {p.get("name")}')
    daisy_id = daisy_plants[0].get('id')
else:
    print('  NOT FOUND - Need to add to plant_database.py')
    daisy_id = 'shasta-daisy-1'  # Will need to be added manually

# Check seed catalog
conn = sqlite3.connect(os.path.join(backend_dir, 'instance', 'homestead.db'))
cursor = conn.cursor()

cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id = ? AND is_global = 1', (daisy_id,))
count = cursor.fetchone()[0]
print(f'\nSeed Catalog:')
print(f'  Shasta Daisy varieties: {count}')

if daisy_plants:
    print('\nAdding Shasta daisy varieties to seed catalog...\n')

    # Shasta daisy varieties
    varieties = [
        ('Alaska', 120),
        ('Becky', 90),
        ('Crazy Daisy', 120),
        ('Snow Lady', 80),
        ('Silver Princess', 90),
        ('Esther Read (Double)', 120),
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
            daisy_id,
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
            14,    # germination_days
            'spring,summer',
            'Classic perennial flower. White petals with yellow center. Attracts pollinators. Long-lasting cut flower.',
            datetime.now()
        ))
        print(f'  Added: {variety} ({dtm} days)')

    conn.commit()

    cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id = ? AND is_global = 1', (daisy_id,))
    total = cursor.fetchone()[0]
    print(f'\nTotal Shasta daisy varieties in catalog: {total}')
else:
    print('\nCannot add varieties - Shasta daisy not in plant database')
    print('Need to add shasta-daisy-1 to backend/plant_database.py first')

conn.close()
