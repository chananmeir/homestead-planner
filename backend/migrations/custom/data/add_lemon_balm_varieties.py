#!/usr/bin/env python3
"""Add lemon balm varieties to the global seed catalog"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
from datetime import datetime

conn = sqlite3.connect(os.path.join(backend_dir, 'instance', 'homestead.db'))
cursor = conn.cursor()

varieties = [
    ('Common Lemon Balm', 70),
    ('Citronella Lemon Balm', 70),
    ('Variegated Lemon Balm', 70),
    ('Quedlinburger Lemon Balm', 70),
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
        'lemon-balm-1',
        variety,
        None,
        True,  # is_global
        dtm,
        12,    # plant_spacing
        18,    # row_spacing
        0.25,  # planting_depth
        60,    # germination_temp_min
        75,    # germination_temp_max
        60,    # soil_temp_min
        14,    # germination_days
        'spring,summer',
        'Lemon-scented herb. Great for tea and attracts pollinators.',
        datetime.now()
    ))

conn.commit()

print(f'Added {len(varieties)} lemon balm varieties to seed catalog:')
cursor.execute('SELECT variety FROM seed_inventory WHERE plant_id = "lemon-balm-1" AND is_global = 1')
results = cursor.fetchall()
for r in results:
    print(f'  - {r[0]}')

conn.close()
