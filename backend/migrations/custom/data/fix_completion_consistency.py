"""
Data fixup: Normalize PlantingEvent completion state consistency.

Fixes existing rows where completed and quantity_completed contradict:
1. completed=True but quantity_completed=None → set quantity_completed = quantity
2. quantity_completed >= quantity but completed=False → set completed=True
3. actual_harvest_date IS NOT NULL but completed=False → set completed=True

Run BEFORE applying the CHECK constraint migration.

Usage:
    cd backend
    python migrations/custom/data/fix_completion_consistency.py
"""

import sys
import os

# Ensure backend/ is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app import app
from models import db, PlantingEvent


def fix_completion_consistency():
    """Fix inconsistent completion state on PlantingEvent rows."""
    with app.app_context():
        fixed_count = 0

        # Case 1: completed=True but quantity_completed is None
        case1 = PlantingEvent.query.filter(
            PlantingEvent.completed == True,
            PlantingEvent.quantity_completed.is_(None),
            PlantingEvent.quantity.isnot(None),
        ).all()
        for event in case1:
            event.quantity_completed = event.quantity
            fixed_count += 1
        print(f"Case 1 (completed=True, qty_completed=None): fixed {len(case1)} rows")

        # Case 2: quantity_completed >= quantity but completed=False
        case2 = PlantingEvent.query.filter(
            PlantingEvent.completed == False,
            PlantingEvent.quantity.isnot(None),
            PlantingEvent.quantity_completed.isnot(None),
            PlantingEvent.quantity_completed >= PlantingEvent.quantity,
        ).all()
        for event in case2:
            event.completed = True
            fixed_count += 1
        print(f"Case 2 (qty_completed >= qty, completed=False): fixed {len(case2)} rows")

        # Case 3: actual_harvest_date set but completed=False
        case3 = PlantingEvent.query.filter(
            PlantingEvent.completed == False,
            PlantingEvent.actual_harvest_date.isnot(None),
        ).all()
        for event in case3:
            event.completed = True
            if event.quantity is not None and event.quantity_completed is None:
                event.quantity_completed = event.quantity
            fixed_count += 1
        print(f"Case 3 (harvested but not completed): fixed {len(case3)} rows")

        if fixed_count > 0:
            db.session.commit()
            print(f"\nTotal: fixed {fixed_count} rows")
        else:
            print("\nNo inconsistencies found.")


if __name__ == '__main__':
    fix_completion_consistency()
