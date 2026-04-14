#!/usr/bin/env python3
"""Add shungiku to plant database and seed catalog"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
from datetime import datetime
from plant_database import PLANT_DATABASE, get_plant_by_id

# Check if shungiku exists in plant database
shungiku_plants = [p for p in PLANT_DATABASE if 'shungiku' in p.get('name', '').lower()]

print('=== SHUNGIKU STATUS ===')
print('\nPlant Database:')
if shungiku_plants:
    for p in shungiku_plants:
        print(f'  - {p.get("id")}: {p.get("name")}')
    shungiku_id = shungiku_plants[0].get('id')
else:
    print('  NOT FOUND - Need to add to plant_database.py')
    shungiku_id = 'shungiku-1'  # Will need to be added manually

# Check seed catalog
conn = sqlite3.connect(os.path.join(backend_dir, 'instance', 'homestead.db'))
cursor = conn.cursor()

cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id = ? AND is_global = 1', (shungiku_id,))
count = cursor.fetchone()[0]
print(f'\nSeed Catalog:')
print(f'  Shungiku varieties: {count}')

if shungiku_plants:
    print('\nAdding shungiku varieties to seed catalog...\n')

    # Shungiku varieties
    varieties = [
        ('Large Leaf Shungiku', 40),
        ('Small Leaf Shungiku', 35),
        ('Garland Chrysanthemum', 40),
        ('Tong Hao (Chinese)', 40),
        ('Kikuna (Japanese)', 45),
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
            shungiku_id,
            variety,
            None,
            True,  # is_global
            dtm,
            6,     # plant_spacing
            12,    # row_spacing
            0.25,  # planting_depth
            50,    # germination_temp_min
            75,    # germination_temp_max
            50,    # soil_temp_min
            7,     # germination_days
            'spring,fall',
            'Asian leafy green (chrysanthemum greens). Unique aromatic flavor. Bolts in hot weather. Use young leaves.',
            datetime.now()
        ))
        print(f'  Added: {variety} ({dtm} days)')

    conn.commit()

    cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id = ? AND is_global = 1', (shungiku_id,))
    total = cursor.fetchone()[0]
    print(f'\nTotal shungiku varieties in catalog: {total}')
else:
    print('\nCannot add varieties - shungiku not in plant database')
    print('Need to add shungiku-1 to backend/plant_database.py first')

conn.close()
