#!/usr/bin/env python3
"""Add datura to plant database and seed catalog"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
from datetime import datetime
from plant_database import PLANT_DATABASE, get_plant_by_id

# Check if datura exists in plant database
datura_plants = [p for p in PLANT_DATABASE if 'datura' in p.get('name', '').lower()]

print('=== DATURA STATUS ===')
print('\nPlant Database:')
if datura_plants:
    for p in datura_plants:
        print(f'  - {p.get("id")}: {p.get("name")}')
    datura_id = datura_plants[0].get('id')
else:
    print('  NOT FOUND - Need to add to plant_database.py')
    datura_id = 'datura-1'  # Will need to be added manually

# Check seed catalog
conn = sqlite3.connect(os.path.join(backend_dir, 'instance', 'homestead.db'))
cursor = conn.cursor()

cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id LIKE "%datura%" AND is_global = 1')
count = cursor.fetchone()[0]
print(f'\nSeed Catalog:')
print(f'  Datura varieties: {count}')

if datura_plants:
    print('\nAdding datura varieties to seed catalog...\n')

    # Datura varieties
    varieties = [
        # Datura species
        ('Moonflower (White)', 90),
        ('Double Purple Datura', 95),
        ('Yellow Devil\'s Trumpet', 90),
        ('Angel\'s Trumpet White', 85),
        ('Datura Metel (Purple)', 90),
        ('Datura Stramonium (Jimsonweed)', 85),
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
            datura_id,
            variety,
            None,
            True,  # is_global
            dtm,
            24,    # plant_spacing
            36,    # row_spacing
            0.25,  # planting_depth
            65,    # germination_temp_min
            75,    # germination_temp_max
            65,    # soil_temp_min
            14,    # germination_days
            'summer',
            'WARNING: All parts are toxic. Ornamental only. Large fragrant trumpet flowers bloom at night.',
            datetime.now()
        ))
        print(f'  Added: {variety} ({dtm} days)')

    conn.commit()

    cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id LIKE "%datura%" AND is_global = 1')
    total = cursor.fetchone()[0]
    print(f'\nTotal datura varieties in catalog: {total}')
    print('\nIMPORTANT: All parts of Datura are toxic. Grow for ornamental purposes only.')
else:
    print('\nCannot add varieties - datura not in plant database')
    print('Need to add datura-1 to backend/plant_database.py first')

conn.close()
