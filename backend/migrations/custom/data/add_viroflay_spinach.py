#!/usr/bin/env python3
"""Add Viroflay spinach variety to seed catalog"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
from datetime import datetime

conn = sqlite3.connect(os.path.join(backend_dir, 'instance', 'homestead.db'))
cursor = conn.cursor()

# Check if Viroflay already exists
cursor.execute("""
    SELECT variety, days_to_maturity
    FROM seed_inventory
    WHERE plant_id = 'spinach-1'
      AND variety LIKE '%Viroflay%'
      AND is_global = 1
""")
existing = cursor.fetchall()

print('=== VIROFLAY SPINACH ===')
if existing:
    print('Already in catalog:')
    for variety, dtm in existing:
        print(f'  - {variety} ({dtm} days)')
else:
    print('Not found - adding now...\n')

    # Add Viroflay spinach
    variety = 'Viroflay'
    dtm = 48  # Classic French heirloom, 45-50 days

    cursor.execute('''
        INSERT INTO seed_inventory (
            plant_id, variety, brand, is_global,
            days_to_maturity, plant_spacing, row_spacing, planting_depth,
            germination_temp_min, germination_temp_max, soil_temp_min,
            germination_days, ideal_seasons, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        'spinach-1',
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
        'Classic French heirloom. Large, smooth, thick leaves. Slow to bolt. Excellent flavor.',
        datetime.now()
    ))
    print(f'  Added: {variety} ({dtm} days)')

    conn.commit()
    print('\nSuccessfully added Viroflay spinach!')

# Show all spinach varieties
print('\n=== ALL SPINACH VARIETIES ===')
cursor.execute("""
    SELECT variety, days_to_maturity
    FROM seed_inventory
    WHERE plant_id = 'spinach-1' AND is_global = 1
    ORDER BY variety
""")
varieties = cursor.fetchall()
for variety, dtm in varieties:
    print(f'  - {variety} ({dtm} days)')

print(f'\nTotal spinach varieties: {len(varieties)}')

conn.close()
