#!/usr/bin/env python3
"""Add spinach varieties to seed catalog"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
from datetime import datetime
from plant_database import PLANT_DATABASE, get_plant_by_id

# Check if spinach exists in plant database
spinach_plants = [p for p in PLANT_DATABASE if 'spinach' in p.get('name', '').lower()]

print('=== SPINACH STATUS ===')
print('\nPlant Database:')
if spinach_plants:
    for p in spinach_plants:
        print(f'  - {p.get("id")}: {p.get("name")}')
    spinach_id = spinach_plants[0].get('id')
else:
    print('  NOT FOUND - Need to add to plant_database.py')
    spinach_id = 'spinach-1'  # Will need to be added manually

# Check seed catalog
conn = sqlite3.connect(os.path.join(backend_dir, 'instance', 'homestead.db'))
cursor = conn.cursor()

cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id = ? AND is_global = 1', (spinach_id,))
count = cursor.fetchone()[0]
print(f'\nSeed Catalog:')
print(f'  Spinach varieties: {count}')

if spinach_plants:
    print('\nAdding spinach varieties to seed catalog...\n')

    # Spinach varieties
    varieties = [
        # Savoy types (crinkled leaves)
        ('Bloomsdale Long Standing', 45),
        ('Bloomsdale Savoy', 42),
        ('Tyee', 40),
        ('Regiment', 37),

        # Semi-savoy types
        ('Space', 39),
        ('Catalina', 40),
        ('Teton', 45),

        # Smooth/Flat leaf types
        ('Giant Noble', 43),
        ('Olympia', 46),
        ('Corvair', 39),

        # Baby spinach
        ('Baby Leaf Mix', 28),
        ('Melody', 42),

        # Heat-tolerant varieties
        ('New Zealand Spinach', 55),
        ('Malabar Spinach', 70),
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
            spinach_id,
            variety,
            None,
            True,  # is_global
            dtm,
            4,     # plant_spacing
            12,    # row_spacing
            0.5,   # planting_depth
            35,    # germination_temp_min
            75,    # germination_temp_max
            35,    # soil_temp_min
            7,     # germination_days
            'spring,fall',
            'Cool-season crop. Tolerates light frost. Bolts in hot weather. Succession plant every 2 weeks.',
            datetime.now()
        ))
        print(f'  Added: {variety} ({dtm} days)')

    conn.commit()

    cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id = ? AND is_global = 1', (spinach_id,))
    total = cursor.fetchone()[0]
    print(f'\nTotal spinach varieties in catalog: {total}')
else:
    print('\nCannot add varieties - spinach not in plant database')
    print('Need to add spinach-1 to backend/plant_database.py first')

conn.close()
