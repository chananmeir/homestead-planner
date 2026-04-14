#!/usr/bin/env python3
"""Add mullein to plant database and seed catalog"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
from datetime import datetime
from plant_database import PLANT_DATABASE, get_plant_by_id

# Check if mullein exists in plant database
mullein_plants = [p for p in PLANT_DATABASE if 'mullein' in p.get('name', '').lower()]

print('=== MULLEIN STATUS ===')
print('\nPlant Database:')
if mullein_plants:
    for p in mullein_plants:
        print(f'  - {p.get("id")}: {p.get("name")}')
    mullein_id = mullein_plants[0].get('id')
else:
    print('  NOT FOUND - Need to add to plant_database.py')
    mullein_id = 'mullein-1'  # Will need to be added manually

# Check seed catalog
conn = sqlite3.connect(os.path.join(backend_dir, 'instance', 'homestead.db'))
cursor = conn.cursor()

cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id LIKE "%mullein%" AND is_global = 1')
count = cursor.fetchone()[0]
print(f'\nSeed Catalog:')
print(f'  Mullein varieties: {count}')

if mullein_plants:
    print('\nAdding mullein varieties to seed catalog...\n')

    # Mullein varieties
    varieties = [
        # Medicinal varieties
        ('Common Mullein', 85),
        ('Great Mullein', 90),

        # Ornamental varieties
        ('Moth Mullein', 75),
        ('Purple Mullein', 80),
        ('Dark Mullein', 90),
        ('Olympic Mullein', 95),

        # Hybrids
        ('Southern Charm Mix', 85),
        ('Banana Custard', 80),
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
            mullein_id,
            variety,
            None,
            True,  # is_global
            dtm,
            18,    # plant_spacing
            24,    # row_spacing
            0.125, # planting_depth
            55,    # germination_temp_min
            75,    # germination_temp_max
            55,    # soil_temp_min
            14,    # germination_days
            'spring,fall',
            'Biennial herb. Medicinal leaves first year, flowers second year. Drought tolerant.',
            datetime.now()
        ))
        print(f'  Added: {variety} ({dtm} days)')

    conn.commit()

    cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id LIKE "%mullein%" AND is_global = 1')
    total = cursor.fetchone()[0]
    print(f'\nTotal mullein varieties in catalog: {total}')
else:
    print('\nCannot add varieties - mullein not in plant database')
    print('Need to add mullein-1 to backend/plant_database.py first')

conn.close()
