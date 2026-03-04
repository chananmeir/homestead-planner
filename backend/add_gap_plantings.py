"""
Add ~30 new GardenPlanItem records to fill gaps in Plan 44.

Fills unused bed capacity with unplanted seed-inventory varieties:
  - SFG Beds 37-40: fall greens (Jul-Aug plantings)
  - MIG Bed 1 (41): warm-season crops + sunflowers
  - MIG Bed 2 (42): melons, cucumbers, herbs
  - Raised Bed (44): watermelons, celery, perennials
  - Permaculture (43): fall crops + long-season herbs

Idempotent: skips items whose (plant_id, variety, bed_id) already exists in plan 44.

Usage:
    cd backend
    python add_gap_plantings.py
    python add_gap_plantings.py --dry-run   # preview without writing
"""
import argparse
import json
import sys
import os
from datetime import date

sys.path.insert(0, os.path.dirname(__file__))

from app import app, db
from models import GardenPlanItem

PLAN_ID = 44

# ── Items to add ────────────────────────────────────────────────────────────
# Each tuple: (plant_id, variety, qty, bed_id, first_plant_date,
#               seed_inventory_id, succession_count, succession_interval_days)
ITEMS = [
    # ── SFG Beds — Fall Greens ──────────────────────────────────────────────
    ('bok-choy-1',   'Choko',                8,  38, date(2026, 7, 1),  15, 1, None),
    ('shungiku-1',   'Small Leaf Shungiku',   8,  37, date(2026, 8, 1),  66, 2, 21),
    ('fenugreek-1',  'Fenugreek',             8,  37, date(2026, 7, 15), 32, 1, None),
    ('radicchio-1',  'Rouge De Verona',       4,  40, date(2026, 7, 15), 62, 1, None),
    ('lettuce-1',    'Oakleaf',               8,  38, date(2026, 7, 1),  38, 2, 21),
    ('lettuce-1',    'Ruby Red',              8,  37, date(2026, 7, 15), 41, 2, 21),
    ('lettuce-1',    'Kagraner Sommer',       8,  38, date(2026, 7, 1),  43, 1, None),
    ('endive-1',     'Batavian Broadleaf',    4,  40, date(2026, 6, 15), 31, 1, None),
    ('sorrel-1',     'Red Veined Sorrel',     4,  37, date(2026, 7, 1),  67, 1, None),
    ('lettuce-1',    'Bronze Guard',          8,  40, date(2026, 7, 15), 40, 1, None),
    ('lettuce-1',    'Great Lakes 118',       8,  39, date(2026, 8, 15), 42, 1, None),

    # ── MIG Bed 1 — Warm-season + sunflowers ────────────────────────────────
    ('watermelon-1', 'Sugar Baby',            6,  41, date(2026, 5, 20), 81, 1, None),
    ('watermelon-1', 'Dixie Queen',           4,  41, date(2026, 5, 20), 82, 1, None),
    ('melon-1',      'Honey Rock',            6,  41, date(2026, 5, 20), 45, 1, None),
    ('sunflower-1',  'Teddy Bear',           24,  41, date(2026, 5, 15), 73, 1, None),
    ('squash-1',     'Cocozelle',             6,  41, date(2026, 6, 1),  70, 1, None),

    # ── MIG Bed 2 — Melons, cucumbers, herbs ────────────────────────────────
    ('melon-1',      'Prescott Fond Blanc',   4,  42, date(2026, 5, 25), 46, 1, None),
    ('melon-1',      'Honeydew Green Flesh',  4,  42, date(2026, 5, 25), 47, 1, None),
    ('cucumber-1',   'Wisconsin SMR Pickling',12, 42, date(2026, 6, 1),  30, 1, None),
    ('gourd-bi-color-pear', 'Bi-Color Pear',  4,  42, date(2026, 5, 25), 33, 1, None),
    ('lemon-balm-1', 'Common Lemon Balm',     6,  42, date(2026, 5, 15), 36, 1, None),

    # ── Raised Bed — Watermelons, celery, perennials ────────────────────────
    ('watermelon-1', 'Charleston Grey',       4,  44, date(2026, 5, 20), 79, 1, None),
    ('watermelon-1', 'Congo',                 3,  44, date(2026, 5, 20), 80, 1, None),
    ('celery-1',     'Tall Utah 52-70',      10,  44, date(2026, 4, 15), 23, 1, None),
    ('melon-1',      'Orange Flesh Honeydew',  6, 44, date(2026, 5, 20), 48, 1, None),
    ('purple-coneflower-1', 'Purple Coneflower (Standard)', 8, 44, date(2026, 4, 15), 61, 1, None),
    ('catnip-1',     'Common Catnip',         6,  44, date(2026, 5, 1),  22, 1, None),

    # ── Permaculture Bed — Fall crops + long-season ─────────────────────────
    ('burdock-1',    'Takinogawa Long',      25,  43, date(2026, 4, 15), 18, 1, None),
    ('bok-choy-1',   'Choko',               40,  43, date(2026, 8, 15), 15, 1, None),
    ('shungiku-1',   'Small Leaf Shungiku',  60,  43, date(2026, 8, 15), 66, 2, 21),
    ('mullein-1',    'Common Mullein',       12,  43, date(2026, 4, 15), 49, 1, None),
    ('caraway-1',    'Caraway',              25,  43, date(2026, 8, 1),  20, 1, None),
]


def existing_keys(session):
    """Return set of (plant_id, variety, bed_id) already in plan 44."""
    rows = session.query(
        GardenPlanItem.plant_id,
        GardenPlanItem.variety,
        GardenPlanItem.beds_allocated,
    ).filter_by(garden_plan_id=PLAN_ID).all()

    keys = set()
    for plant_id, variety, beds_json in rows:
        if beds_json:
            try:
                for bid in json.loads(beds_json):
                    keys.add((plant_id, variety, bid))
            except (json.JSONDecodeError, TypeError):
                pass
    return keys


def build_item(plant_id, variety, qty, bed_id, first_date,
               seed_inv_id, succ_count, succ_interval):
    """Create a GardenPlanItem matching the create_plan_item_from_data pattern."""
    bed_assignments = [{'bedId': bed_id, 'quantity': qty}]
    beds_allocated = [bed_id]

    return GardenPlanItem(
        garden_plan_id=PLAN_ID,
        seed_inventory_id=seed_inv_id,
        plant_id=plant_id,
        variety=variety,
        unit_type='plants',
        target_value=qty,
        plant_equivalent=qty,
        succession_enabled=(succ_count > 1),
        succession_count=succ_count,
        succession_interval_days=succ_interval,
        first_plant_date=first_date,
        beds_allocated=json.dumps(beds_allocated),
        bed_assignments=json.dumps(bed_assignments),
        allocation_mode='custom',
        status='planned',
    )


def main():
    parser = argparse.ArgumentParser(description='Add gap plantings to plan 44')
    parser.add_argument('--dry-run', action='store_true',
                        help='Preview what would be added without writing')
    args = parser.parse_args()

    with app.app_context():
        existing = existing_keys(db.session)
        added = []
        skipped = []

        for row in ITEMS:
            plant_id, variety, qty, bed_id = row[0], row[1], row[2], row[3]
            key = (plant_id, variety, bed_id)

            if key in existing:
                skipped.append(f"  SKIP  {plant_id:30s}  {variety:35s}  bed={bed_id}")
                continue

            item = build_item(*row)

            if not args.dry_run:
                db.session.add(item)

            added.append(f"  ADD   {plant_id:30s}  {variety:35s}  bed={bed_id}  qty={qty}  date={row[4]}")

        if not args.dry_run and added:
            db.session.commit()

        # ── Summary ─────────────────────────────────────────────────────────
        print(f"\n{'DRY RUN — ' if args.dry_run else ''}Gap Plantings for Plan {PLAN_ID}")
        print('=' * 70)
        if added:
            print(f"\n{'Would add' if args.dry_run else 'Added'} {len(added)} items:\n")
            for line in added:
                print(line)
        if skipped:
            print(f"\nSkipped {len(skipped)} (already exist):\n")
            for line in skipped:
                print(line)
        if not added and not skipped:
            print("\nNo items to process.")
        print()


if __name__ == '__main__':
    main()
