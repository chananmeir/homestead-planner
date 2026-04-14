#!/usr/bin/env python3
"""Add onion varieties to the global seed catalog"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
from datetime import datetime

conn = sqlite3.connect(os.path.join(backend_dir, 'instance', 'homestead.db'))
cursor = conn.cursor()

# Onion varieties with DTM
varieties = [
    # User requested
    ('Southport White Globe', 110),
    ('Red Creole', 110),
    ('Pompeu Mini White', 64),

    # Additional common varieties
    ('Yellow Sweet Spanish', 110),
    ('Walla Walla Sweet', 125),
    ('Red Baron', 110),
    ('Candy', 85),
    ('Copra', 104),
    ('Patterson', 90),
    ('Ailsa Craig', 105),
    ('Redwing', 115),
    ('White Lisbon', 60),  # Bunching/scallion type
    ('Tokyo Long White', 65),  # Bunching/scallion type
    ('Evergreen Hardy White', 60),  # Bunching type
]

print('Adding onion varieties to seed catalog:\n')

for variety, dtm in varieties:
    cursor.execute('''
        INSERT INTO seed_inventory (
            plant_id, variety, brand, is_global,
            days_to_maturity, plant_spacing, row_spacing, planting_depth,
            germination_temp_min, germination_temp_max, soil_temp_min,
            germination_days, ideal_seasons, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        'onion-1',
        variety,
        None,
        True,  # is_global
        dtm,
        4,     # plant_spacing
        12,    # row_spacing
        0.5,   # planting_depth
        50,    # germination_temp_min
        95,    # germination_temp_max
        50,    # soil_temp_min
        7,     # germination_days
        'spring,fall',
        'Can be grown from seed, sets, or transplants. Store in cool, dry place.',
        datetime.now()
    ))
    print(f'  - {variety} ({dtm} days)')

conn.commit()

print(f'\nSuccessfully added {len(varieties)} onion varieties!')

# Verify
cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id = "onion-1" AND is_global = 1')
total = cursor.fetchone()[0]
print(f'Total onion varieties in catalog: {total}')

conn.close()
