"""
Add gap-filling GardenPlanItem records to Plan 44.

Round 1 (~32 items): Fills unused bed capacity with unplanted seed-inventory varieties:
  - SFG Beds 37-40: fall greens (Jul-Aug plantings)
  - MIG Bed 1 (41): warm-season crops + sunflowers
  - MIG Bed 2 (42): melons, cucumbers, herbs
  - Raised Bed (44): watermelons, celery, perennials
  - Permaculture (43): fall crops + long-season herbs

Round 2 (~38 items): Summer warm-season + fall cool-season crops for underused beds:
  - MIG Bed 1 (41): beans, pumpkins, squash, cucumber + fall greens
  - MIG Bed 2 (42): corn, squash, pumpkin + fall greens
  - Raised Bed (44): corn, squash, herbs, chia + fall greens

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

    # ══════════════════════════════════════════════════════════════════════════
    # Round 2 — Fill MIG Beds 1 & 2 + Raised Bed (summer + fall crops)
    # ══════════════════════════════════════════════════════════════════════════

    # ── MIG Bed 1 (41) — Summer warm-season ────────────────────────────────
    ('bean-1',       'Contender',            40,  41, date(2026, 6, 1),  12, 1, None),
    ('pumpkin-1',    'Cinderella',            6,  41, date(2026, 6, 1),  60, 1, None),
    ('squash-1',     'Spaghetti Squash',      4,  41, date(2026, 6, 1),  71, 1, None),
    ('cucumber-1',   'Painted Serpent',       10,  41, date(2026, 6, 1),  29, 1, None),

    # ── MIG Bed 1 (41) — Fall cool-season ─────────────────────────────────
    ('radish-1',     'Cherry Belle',         80,  41, date(2026, 8, 1),  63, 1, None),
    ('kale-1',       'Bare Necessities',     20,  41, date(2026, 8, 1),  34, 1, None),
    ('collard-greens-1', 'Vates',            20,  41, date(2026, 8, 1),  26, 1, None),
    ('mustard-1',    'Tokyo Bekana',         40,  41, date(2026, 8, 15), 50, 1, None),
    ('lettuce-1',    'Red Sails',            30,  41, date(2026, 8, 15), 39, 1, None),
    ('bok-choy-1',   'Choko',               30,  41, date(2026, 8, 15), 15, 1, None),
    ('carrot-1',     'Royal Chantenay',      40,  41, date(2026, 8, 1),  21, 1, None),
    ('beet-1',       'Formanova',            30,  41, date(2026, 8, 1),  13, 1, None),

    # ── MIG Bed 2 (42) — Summer warm-season ────────────────────────────────
    ('corn-1',       "Stowell's Evergreen",  40,  42, date(2026, 5, 20), 28, 1, None),
    ('corn-1',       'Dakota Black Popcorn', 30,  42, date(2026, 5, 20), 27, 1, None),
    ('squash-1',     'Green Stripe Cushaw',   4,  42, date(2026, 6, 1),  72, 1, None),
    ('pumpkin-1',    'Cinderella',            4,  42, date(2026, 6, 1),  60, 1, None),

    # ── MIG Bed 2 (42) — Fall cool-season ─────────────────────────────────
    ('radish-1',     'Cherry Belle',         80,  42, date(2026, 8, 1),  63, 1, None),
    ('kale-1',       'Red Ursa',             20,  42, date(2026, 8, 1),  35, 1, None),
    ('chard-1',      'Fordhook Giant',       20,  42, date(2026, 8, 1),  74, 1, None),
    ('broccoli-1',   'De Cicco',             15,  42, date(2026, 8, 1),  16, 1, None),
    ('cabbage-1',    'Danish Ballhead',      15,  42, date(2026, 8, 1),  19, 1, None),
    ('spinach-1',    'Bloomsdale',           50,  42, date(2026, 8, 15), 68, 1, None),
    ('spinach-1',    'Viroflay',             50,  42, date(2026, 8, 15), 69, 1, None),
    ('lettuce-1',    'Heirloom Bronze Arrowhead', 30, 42, date(2026, 8, 15), 37, 1, None),

    # ── Raised Bed (44) — Summer warm-season ───────────────────────────────
    ('corn-1',       "Stowell's Evergreen",  30,  44, date(2026, 5, 20), 28, 1, None),
    ('squash-1',     'Spaghetti Squash',      4,  44, date(2026, 6, 1),  71, 1, None),
    ('pea-1',        'Super Sugar Snap',     40,  44, date(2026, 8, 15), 55, 1, None),
    ('sage-1',       'Common Sage',           6,  44, date(2026, 5, 1),  65, 1, None),
    ('thyme-1',      'Caraway Thyme',         6,  44, date(2026, 5, 1),  75, 1, None),
    ('chia-1',       'White Chia',           30,  44, date(2026, 5, 15), 24, 1, None),

    # ── Raised Bed (44) — Fall cool-season ─────────────────────────────────
    ('radish-1',     'Cherry Belle',         80,  44, date(2026, 8, 1),  63, 1, None),
    ('kale-1',       'Bare Necessities',     20,  44, date(2026, 8, 1),  34, 1, None),
    ('collard-greens-1', 'Vates',            20,  44, date(2026, 8, 1),  26, 1, None),
    ('broccoli-1',   'Calabrese',            15,  44, date(2026, 8, 1),  17, 1, None),
    ('chard-1',      'Fordhook Giant',       20,  44, date(2026, 8, 1),  74, 1, None),
    ('cabbage-1',    'Danish Ballhead',      15,  44, date(2026, 8, 1),  19, 1, None),
    ('beet-1',       'Zwaan Sugar Beet',     30,  44, date(2026, 8, 1),  14, 1, None),
    ('carrot-1',     'Royal Chantenay',      40,  44, date(2026, 8, 1),  21, 1, None),
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
