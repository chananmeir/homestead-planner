#!/usr/bin/env python3
"""Add purple coneflower to plant database and seed catalog"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
from datetime import datetime
from plant_database import PLANT_DATABASE, get_plant_by_id

# Check if purple coneflower exists in plant database
coneflower_plants = [p for p in PLANT_DATABASE if 'coneflower' in p.get('name', '').lower() or 'echinacea' in p.get('name', '').lower()]

print('=== PURPLE CONEFLOWER STATUS ===')
print('\nPlant Database:')
if coneflower_plants:
    for p in coneflower_plants:
        print(f'  - {p.get("id")}: {p.get("name")}')
    coneflower_id = coneflower_plants[0].get('id')
else:
    print('  NOT FOUND - Need to add to plant_database.py')
    coneflower_id = 'purple-coneflower-1'  # Will need to be added manually

# Check seed catalog
conn = sqlite3.connect(os.path.join(backend_dir, 'instance', 'homestead.db'))
cursor = conn.cursor()

cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id LIKE "%coneflower%" AND is_global = 1')
count = cursor.fetchone()[0]
print(f'\nSeed Catalog:')
print(f'  Purple Coneflower varieties: {count}')

if coneflower_plants:
    print('\nAdding purple coneflower varieties to seed catalog...\n')

    # Purple Coneflower varieties
    varieties = [
        # Classic purple
        ('Purple Coneflower (Standard)', 90),
        ('Magnus Purple Coneflower', 95),
        ('Ruby Star', 85),

        # White varieties
        ('White Swan', 90),
        ('Virgin White', 85),

        # Pink/Purple shades
        ('Pink Double Delight', 95),
        ('PowWow Wild Berry', 80),

        # Yellow/Orange
        ('Harvest Moon', 90),
        ('Cheyenne Spirit Mix', 85),
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
            coneflower_id,
            variety,
            None,
            True,  # is_global
            dtm,
            18,    # plant_spacing
            24,    # row_spacing
            0.25,  # planting_depth
            65,    # germination_temp_min
            75,    # germination_temp_max
            65,    # soil_temp_min
            14,    # germination_days
            'spring,fall',
            'Medicinal perennial. Drought tolerant. Attracts butterflies. Used for immune support.',
            datetime.now()
        ))
        print(f'  Added: {variety} ({dtm} days)')

    conn.commit()

    cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id LIKE "%coneflower%" AND is_global = 1')
    total = cursor.fetchone()[0]
    print(f'\nTotal purple coneflower varieties in catalog: {total}')
else:
    print('\nCannot add varieties - purple coneflower not in plant database')
    print('Need to add purple-coneflower-1 to backend/plant_database.py first')

conn.close()
