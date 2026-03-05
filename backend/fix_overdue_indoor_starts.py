#!/usr/bin/env python3
"""
Fix script: Push overdue indoor seed start dates forward for Plan 44.

After exporting Plan 44 to the calendar, ~44 transplant PlantingEvents have
seed_start_date in the past (transplant_date - weeksIndoors < today).
This script adjusts dates using three agronomic categories:

  Category A (1-7 days overdue, >=50% indoor time remaining):
    Set seed_start_date = today. Keep transplant_date unchanged.
    Rationale: vigorous crops can handle a compressed indoor period.

  Category B (8-28 days overdue, or Cat A with <50% indoor time left):
    Set seed_start_date = today, transplant_date = today + weeksIndoors.
    Rationale: too much indoor time lost; give full indoor growing period.

  Category C (29+ days overdue):
    Same as B — full reset with today + weeksIndoors.

Usage:
  python fix_overdue_indoor_starts.py            # Dry run (no changes)
  python fix_overdue_indoor_starts.py --commit   # Apply changes
"""

import sys
from datetime import date, timedelta
from app import app, db
from models import PlantingEvent, GardenPlanItem, IndoorSeedStart
from plant_database import get_plant_by_id

PLAN_ID = 44
USER_ID = 59
TODAY = date(2026, 3, 5)


def categorize(days_overdue, remaining_indoor_days, total_indoor_days):
    """Assign an agronomic category (A, B, or C) based on how overdue the start is."""
    if days_overdue >= 29:
        return 'C'
    if days_overdue >= 8:
        return 'B'
    # 1-7 days overdue — check if enough indoor time remains
    if total_indoor_days > 0 and remaining_indoor_days < (total_indoor_days * 0.5):
        return 'B'  # Transplant too soon to compress
    return 'A'


def fix_overdue_indoor_starts(commit=False):
    # 1. Get all GardenPlanItem IDs for Plan 44
    plan_items = GardenPlanItem.query.filter_by(garden_plan_id=PLAN_ID).all()
    plan_item_ids = {item.id for item in plan_items}
    print(f"Plan {PLAN_ID}: {len(plan_item_ids)} plan items found")

    # 2. Query transplant PlantingEvents for this user
    events = PlantingEvent.query.filter(
        PlantingEvent.user_id == USER_ID,
        PlantingEvent.event_type == 'planting',
        PlantingEvent.transplant_date.isnot(None),
        PlantingEvent.export_key.isnot(None),
    ).all()
    print(f"Found {len(events)} transplant events for user {USER_ID}")

    # 3. Filter to Plan 44 via export_key prefix matching (format: "{item_id}_...")
    plan_events = []
    for ev in events:
        try:
            prefix = int(ev.export_key.split('_')[0])
            if prefix in plan_item_ids:
                plan_events.append(ev)
        except (ValueError, IndexError):
            continue
    print(f"Matched {len(plan_events)} events to Plan {PLAN_ID}")

    # 4. Find overdue events and categorize
    results = {'A': [], 'B': [], 'C': []}
    skipped_no_plant = 0
    skipped_not_overdue = 0
    skipped_no_weeks = 0

    for ev in plan_events:
        plant = get_plant_by_id(ev.plant_id)
        if not plant:
            skipped_no_plant += 1
            continue

        weeks_indoors = plant.get('weeksIndoors', 0)
        if not weeks_indoors or weeks_indoors <= 0:
            skipped_no_weeks += 1
            continue

        total_indoor_days = weeks_indoors * 7
        transplant_dt = ev.transplant_date.date() if hasattr(ev.transplant_date, 'date') else ev.transplant_date
        ideal_start = transplant_dt - timedelta(days=total_indoor_days)

        if ideal_start >= TODAY:
            skipped_not_overdue += 1
            continue

        days_overdue = (TODAY - ideal_start).days
        remaining_indoor_days = (transplant_dt - TODAY).days

        cat = categorize(days_overdue, remaining_indoor_days, total_indoor_days)
        results[cat].append({
            'event': ev,
            'plant': plant,
            'weeks_indoors': weeks_indoors,
            'total_indoor_days': total_indoor_days,
            'days_overdue': days_overdue,
            'remaining_indoor_days': remaining_indoor_days,
            'old_seed_start': ev.seed_start_date,
            'old_transplant': ev.transplant_date,
            'old_harvest': ev.expected_harvest_date,
        })

    # Print summary
    total_fixing = sum(len(v) for v in results.values())
    print(f"\n{'='*70}")
    print(f"OVERDUE ANALYSIS  (today = {TODAY})")
    print(f"{'='*70}")
    print(f"Total overdue events: {total_fixing}")
    print(f"Skipped (not overdue): {skipped_not_overdue}")
    print(f"Skipped (no plant data): {skipped_no_plant}")
    print(f"Skipped (no weeksIndoors): {skipped_no_weeks}")
    print()

    for cat_label, cat_name, description in [
        ('A', 'Category A', 'Slightly overdue (1-7d, >=50% indoor time left) — compress indoor period'),
        ('B', 'Category B', 'Moderately overdue (8-28d) — full reset'),
        ('C', 'Category C', 'Severely overdue (29+d) — full reset'),
    ]:
        items = results[cat_label]
        if not items:
            print(f"\n--- {cat_name}: 0 events ---")
            continue

        print(f"\n--- {cat_name}: {len(items)} events ---")
        print(f"    {description}")
        print(f"    {'Plant':<25} {'Variety':<20} {'Overdue':>7} {'Action'}")
        print(f"    {'-'*25} {'-'*20} {'-'*7} {'-'*40}")

        for item in sorted(items, key=lambda x: x['event'].plant_id):
            ev = item['event']
            transplant_dt = ev.transplant_date.date() if hasattr(ev.transplant_date, 'date') else ev.transplant_date

            if cat_label == 'A':
                new_transplant = transplant_dt  # unchanged
                action = f"start={TODAY}, transplant unchanged ({new_transplant})"
            else:
                new_transplant = TODAY + timedelta(days=item['total_indoor_days'])
                action = f"start={TODAY}, transplant={new_transplant}"

            # Preserve original DTM by back-calculating from old dates
            if ev.expected_harvest_date and ev.transplant_date:
                old_transplant_d = ev.transplant_date.date() if hasattr(ev.transplant_date, 'date') else ev.transplant_date
                old_harvest_d = ev.expected_harvest_date.date() if hasattr(ev.expected_harvest_date, 'date') else ev.expected_harvest_date
                original_dtm = (old_harvest_d - old_transplant_d).days
                new_harvest = new_transplant + timedelta(days=original_dtm)
                action += f", harvest={new_harvest}"
            else:
                new_harvest = None

            print(f"    {ev.plant_id:<25} {(ev.variety or ''):<20} {item['days_overdue']:>4}d   {action}")

    if total_fixing == 0:
        print("\nNo overdue events found. Nothing to do.")
        return

    # 5. Apply changes
    if not commit:
        print(f"\n*** DRY RUN — {total_fixing} events would be updated. "
              f"Run with --commit to apply. ***")
        return

    updated = 0
    for cat_label in ['A', 'B', 'C']:
        for item in results[cat_label]:
            ev = item['event']
            transplant_dt = ev.transplant_date.date() if hasattr(ev.transplant_date, 'date') else ev.transplant_date

            from datetime import datetime as dt

            # New seed start = today for all categories
            ev.seed_start_date = dt(TODAY.year, TODAY.month, TODAY.day)

            if cat_label == 'A':
                new_transplant = transplant_dt  # unchanged
            else:
                new_transplant = TODAY + timedelta(days=item['total_indoor_days'])
                ev.transplant_date = dt(new_transplant.year, new_transplant.month, new_transplant.day)

            # Recalculate harvest date preserving original DTM
            if ev.expected_harvest_date and item['old_transplant']:
                old_transplant_d = item['old_transplant'].date() if hasattr(item['old_transplant'], 'date') else item['old_transplant']
                old_harvest_d = item['old_harvest'].date() if hasattr(item['old_harvest'], 'date') else item['old_harvest']
                original_dtm = (old_harvest_d - old_transplant_d).days
                new_harvest = new_transplant + timedelta(days=original_dtm)
                ev.expected_harvest_date = dt(new_harvest.year, new_harvest.month, new_harvest.day)

            updated += 1

    # 6. Update any linked IndoorSeedStart records
    indoor_updated = 0
    for cat_label in ['A', 'B', 'C']:
        for item in results[cat_label]:
            ev = item['event']
            indoor_starts = IndoorSeedStart.query.filter_by(
                planting_event_id=ev.id,
                user_id=USER_ID
            ).all()
            for iss in indoor_starts:
                from datetime import datetime as dt
                iss.start_date = dt(TODAY.year, TODAY.month, TODAY.day)
                if cat_label != 'A':
                    new_tp = TODAY + timedelta(days=item['total_indoor_days'])
                    iss.expected_transplant_date = dt(new_tp.year, new_tp.month, new_tp.day)
                indoor_updated += 1

    db.session.commit()
    print(f"\nCommitted {updated} PlantingEvent updates.")
    if indoor_updated:
        print(f"Also updated {indoor_updated} linked IndoorSeedStart records.")
    else:
        print("No linked IndoorSeedStart records found (expected).")


if __name__ == '__main__':
    commit_flag = '--commit' in sys.argv
    with app.app_context():
        fix_overdue_indoor_starts(commit=commit_flag)
