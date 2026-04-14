#!/usr/bin/env python3
"""Add Dakota Black Popcorn to seed catalog"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
from datetime import datetime

conn = sqlite3.connect(os.path.join(backend_dir, 'instance', 'homestead.db'))
cursor = conn.cursor()

# Check if Dakota Black already exists
cursor.execute("""
    SELECT variety, days_to_maturity
    FROM seed_inventory
    WHERE plant_id = 'corn-1'
      AND variety LIKE '%Dakota%Black%'
      AND is_global = 1
""")
existing = cursor.fetchall()

print('=== DAKOTA BLACK POPCORN ===')
if existing:
    print('Already in catalog:')
    for variety, dtm in existing:
        print(f'  - {variety} ({dtm} days)')
else:
    print('Not found - adding now...\n')

    # Add Dakota Black Popcorn
    variety = 'Dakota Black Popcorn'
    dtm = 95  # Average DTM for popcorn varieties

    cursor.execute('''
        INSERT INTO seed_inventory (
            plant_id, variety, brand, is_global,
            days_to_maturity, plant_spacing, row_spacing, planting_depth,
            germination_temp_min, germination_temp_max, soil_temp_min,
            germination_days, ideal_seasons, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        'corn-1',
        variety,
        None,
        True,  # is_global
        dtm,
        12,    # plant_spacing
        36,    # row_spacing (3 feet)
        1.5,   # planting_depth
        60,    # germination_temp_min
        95,    # germination_temp_max
        60,    # soil_temp_min
        7,     # germination_days
        'summer',
        'Heirloom popcorn with deep purple-black kernels. Pops white with excellent flavor.',
        datetime.now()
    ))
    print(f'  Added: {variety} ({dtm} days)')

    conn.commit()
    print('\nSuccessfully added Dakota Black Popcorn!')

# Show sample of popcorn varieties
print('\n=== POPCORN VARIETIES ===')
cursor.execute("""
    SELECT variety, days_to_maturity
    FROM seed_inventory
    WHERE plant_id = 'corn-1'
      AND (variety LIKE '%popcorn%' OR variety LIKE '%Dakota%')
      AND is_global = 1
    ORDER BY variety
""")
popcorn = cursor.fetchall()
if popcorn:
    for variety, dtm in popcorn:
        print(f'  - {variety} ({dtm} days)')
else:
    print('  No popcorn varieties found')

conn.close()
