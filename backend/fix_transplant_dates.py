"""
One-time fix: Sync IndoorSeedStart.expected_transplant_date to linked PlantingEvent.transplant_date.

Bug: When indoor seed starts were created via from-planting-event, the recalculated
transplant date was saved on the IndoorSeedStart but NOT synced back to the PlantingEvent.
This caused transplant dates to not appear on the calendar when expected.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import app
from models import db, IndoorSeedStart, PlantingEvent
from plant_database import get_plant_by_id
from datetime import timedelta

with app.app_context():
    # Find all indoor seed starts with linked planting events
    starts = IndoorSeedStart.query.filter(
        IndoorSeedStart.planting_event_id.isnot(None),
        IndoorSeedStart.expected_transplant_date.isnot(None)
    ).all()

    fixed = 0
    for start in starts:
        event = PlantingEvent.query.get(start.planting_event_id)
        if not event:
            continue

        # Check if dates are mismatched
        if event.transplant_date != start.expected_transplant_date:
            old_date = event.transplant_date
            event.transplant_date = start.expected_transplant_date

            # Also recalculate harvest date
            plant = get_plant_by_id(start.plant_id)
            dtm = plant.get('daysToMaturity', 70) if plant else 70
            event.expected_harvest_date = start.expected_transplant_date + timedelta(days=dtm)

            print(f"  Fixed: {start.plant_id} ({start.variety or 'no variety'}) "
                  f"- transplant {old_date} -> {start.expected_transplant_date}")
            fixed += 1

    if fixed:
        db.session.commit()
        print(f"\nFixed {fixed} mismatched transplant dates.")
    else:
        print("No mismatched dates found - all in sync.")
