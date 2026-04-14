#!/usr/bin/env python3
"""Add De Cicco broccoli variety to seed catalog"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
from datetime import datetime

conn = sqlite3.connect(os.path.join(backend_dir, 'instance', 'homestead.db'))
cursor = conn.cursor()

# Check if De Cicco already exists
cursor.execute("""
    SELECT variety, days_to_maturity
    FROM seed_inventory
    WHERE plant_id = 'broccoli-1'
      AND variety LIKE '%De Cicco%'
      AND is_global = 1
""")
existing = cursor.fetchall()

print('=== DE CICCO BROCCOLI ===')
if existing:
    print('Already in catalog:')
    for variety, dtm in existing:
        print(f'  - {variety} ({dtm} days)')
else:
    print('Not found - adding now...\n')

    # Add De Cicco broccoli
    variety = 'De Cicco'
    dtm = 48  # Classic Italian heirloom, 45-50 days

    cursor.execute('''
        INSERT INTO seed_inventory (
            plant_id, variety, brand, is_global,
            days_to_maturity, plant_spacing, row_spacing, planting_depth,
            germination_temp_min, germination_temp_max, soil_temp_min,
            germination_days, ideal_seasons, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        'broccoli-1',
        variety,
        None,
        True,  # is_global
        dtm,
        18,    # plant_spacing
        24,    # row_spacing
        0.25,  # planting_depth
        45,    # germination_temp_min
        85,    # germination_temp_max
        45,    # soil_temp_min
        7,     # germination_days
        'spring,fall',
        'Classic Italian heirloom. Produces medium central head followed by many side shoots. Excellent flavor.',
        datetime.now()
    ))
    print(f'  Added: {variety} ({dtm} days)')

    conn.commit()
    print('\nSuccessfully added De Cicco broccoli!')

# Show all broccoli varieties
print('\n=== ALL BROCCOLI VARIETIES ===')
cursor.execute("""
    SELECT variety, days_to_maturity
    FROM seed_inventory
    WHERE plant_id = 'broccoli-1' AND is_global = 1
    ORDER BY variety
""")
varieties = cursor.fetchall()
for variety, dtm in varieties:
    print(f'  - {variety} ({dtm} days)')

print(f'\nTotal broccoli varieties: {len(varieties)}')

conn.close()
