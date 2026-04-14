#!/usr/bin/env python3
"""Add pumpkin varieties to the global seed catalog"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
from datetime import datetime

conn = sqlite3.connect(os.path.join(backend_dir, 'instance', 'homestead.db'))
cursor = conn.cursor()

# Pumpkin varieties with DTM
varieties = [
    # User requested
    ('Cinderella (Rouge Vif d\'Etampes)', 110),

    # Popular carving/jack-o-lantern pumpkins
    ('Connecticut Field', 120),
    ('Howden', 115),
    ('Jack-O-Lantern', 110),
    ('Autumn Gold', 90),

    # Pie pumpkins
    ('Sugar Pie', 100),
    ('New England Pie', 105),
    ('Winter Luxury Pie', 100),
    ('Small Sugar', 100),

    # Specialty/heirloom pumpkins
    ('Jarrahdale', 110),
    ('Long Island Cheese', 115),
    ('Musquee de Provence', 120),
    ('Baby Boo', 95),
    ('Jack Be Little', 95),
    ('Atlantic Giant', 130),  # Giant variety
    ('Big Max', 120),
    ('Dill\'s Atlantic Giant', 130),

    # Unique varieties
    ('Fairytale', 115),
    ('Lumina (White)', 90),
    ('Casper (White)', 115),
]

print('Adding pumpkin varieties to seed catalog:\n')

for variety, dtm in varieties:
    cursor.execute('''
        INSERT INTO seed_inventory (
            plant_id, variety, brand, is_global,
            days_to_maturity, plant_spacing, row_spacing, planting_depth,
            germination_temp_min, germination_temp_max, soil_temp_min,
            germination_days, ideal_seasons, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        'pumpkin-1',
        variety,
        None,
        True,  # is_global
        dtm,
        24,    # plant_spacing (2 feet)
        72,    # row_spacing (6 feet) - pumpkins need space!
        1,     # planting_depth
        70,    # germination_temp_min
        95,    # germination_temp_max
        70,    # soil_temp_min
        7,     # germination_days
        'summer',
        'Warm-season vine crop. Plant after last frost when soil is warm.',
        datetime.now()
    ))
    print(f'  - {variety} ({dtm} days)')

conn.commit()

print(f'\n✓ Successfully added {len(varieties)} pumpkin varieties!')

# Verify
cursor.execute('SELECT COUNT(*) FROM seed_inventory WHERE plant_id = "pumpkin-1" AND is_global = 1')
total = cursor.fetchone()[0]
print(f'Total pumpkin varieties in catalog: {total}')

conn.close()
