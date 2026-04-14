#!/usr/bin/env python3
"""Add Bronze Guard lettuce variety to the global seed catalog"""

# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3
from datetime import datetime

conn = sqlite3.connect(os.path.join(backend_dir, 'instance', 'homestead.db'))
cursor = conn.cursor()

# Check if it already exists
cursor.execute("""
    SELECT variety, plant_id
    FROM seed_inventory
    WHERE variety LIKE '%bronze%guard%' AND is_global = 1
""")
result = cursor.fetchone()

if result:
    print(f'Bronze Guard already exists: {result[0]} ({result[1]})')
else:
    # Add Bronze Guard as a looseleaf lettuce
    cursor.execute('''
        INSERT INTO seed_inventory (
            plant_id, variety, brand, is_global,
            days_to_maturity, plant_spacing, row_spacing, planting_depth,
            germination_temp_min, germination_temp_max, soil_temp_min,
            germination_days, ideal_seasons, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        'lettuce-looseleaf-1',  # Bronze Guard is a looseleaf type
        'Bronze Guard',
        None,
        True,  # is_global
        55,    # days_to_maturity
        6,     # plant_spacing
        12,    # row_spacing
        0.25,  # planting_depth
        40,    # germination_temp_min
        75,    # germination_temp_max
        40,    # soil_temp_min
        7,     # germination_days
        'spring,fall',
        'Bronze/red looseleaf lettuce with good heat tolerance and disease resistance.',
        datetime.now()
    ))

    conn.commit()
    print('Added Bronze Guard lettuce to seed catalog:')
    print('  - Bronze Guard (lettuce-looseleaf-1) - 55 days')

conn.close()
