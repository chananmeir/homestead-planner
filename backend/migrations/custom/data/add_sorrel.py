#!/usr/bin/env python3
"""Add sorrel to plant database and seed catalog"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
from datetime import datetime
from plant_database import PLANT_DATABASE, get_plant_by_id

# Check if sorrel exists in plant database
sorrel_plants = [p for p in PLANT_DATABASE if 'sorrel' in p.get('name', '').lower()]

print('=== SORREL STATUS ===')
print('\nPlant Database:')
if sorrel_plants:
    for p in sorrel_plants:
        print(f'  - {p.get("id")}: {p.get("name")}')
    sorrel_id = sorrel_plants[0].get('id')
else:
    print('  NOT FOUND - Need to add to plant_database.py')
    sorrel_id = 'sorrel-1'  # Will need to be added manually

# Check seed catalog
conn = sqlite3.connect(os.path.join(backend_dir, 'instance', 'homestead.db'))
cursor = conn.cursor()

cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id = ? AND is_global = 1', (sorrel_id,))
count = cursor.fetchone()[0]
print(f'\nSeed Catalog:')
print(f'  Sorrel varieties: {count}')

if sorrel_plants:
    print('\nAdding sorrel varieties to seed catalog...\n')

    # Sorrel varieties
    varieties = [
        ('Common Sorrel', 60),
        ('French Sorrel', 60),
        ('Garden Sorrel', 60),
        ('Large Leaf Sorrel', 65),
        ('Red Veined Sorrel', 60),
        ('Bloody Dock Sorrel', 65),
        ('Silver Shield Sorrel', 60),
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
            sorrel_id,
            variety,
            None,
            True,  # is_global
            dtm,
            12,    # plant_spacing
            18,    # row_spacing
            0.25,  # planting_depth
            50,    # germination_temp_min
            75,    # germination_temp_max
            50,    # soil_temp_min
            10,    # germination_days
            'spring,fall',
            'Perennial leafy green with tart, lemony flavor. Hardy. Use young leaves for best flavor.',
            datetime.now()
        ))
        print(f'  Added: {variety} ({dtm} days)')

    conn.commit()

    cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id = ? AND is_global = 1', (sorrel_id,))
    total = cursor.fetchone()[0]
    print(f'\nTotal sorrel varieties in catalog: {total}')
else:
    print('\nCannot add varieties - sorrel not in plant database')
    print('Need to add sorrel-1 to backend/plant_database.py first')

conn.close()
