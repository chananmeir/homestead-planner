#!/usr/bin/env python
"""
Place plants onto garden bed grids for Plan 44 ("Feed Family of 8").

Creates PlantedItem + PlantingEvent pairs for the first succession
of each GardenPlanItem assigned to beds 37-44.

Usage:
    cd backend
    python place_plants.py              # Dry run (shows what would be created)
    python place_plants.py --commit     # Actually write to database
    python place_plants.py --commit --force  # Re-place beds that already have items
"""

import json
import math
import sys
from datetime import datetime, timedelta
from app import app
from models import db, PlantedItem, PlantingEvent, GardenBed, GardenPlanItem
from plant_database import get_plant_by_id

DRY_RUN = '--commit' not in sys.argv
FORCE = '--force' in sys.argv
USER_ID = 1

# SFG plants-per-cell lookup (12" grid)
SFG_PER_CELL = {
    'cabbage-1': 1, 'kale-1': 1, 'broccoli-1': 1, 'collard-greens-1': 1,
    'potato-1': 1, 'pepper-1': 1, 'tomato-1': 1, 'cucumber-1': 1,
    'corn-1': 1, 'sage-1': 1, 'asparagus-1': 1, 'squash-1': 1, 'pumpkin-1': 1,
    'cilantro-1': 1,
    'lettuce-1': 4, 'chard-1': 4, 'beet-1': 4, 'onion-1': 4, 'mustard-1': 4,
    'thyme-1': 4,
    'pea-1': 8,
    'spinach-1': 9, 'bean-1': 9,
    'carrot-1': 16, 'radish-1': 16,
}

# Plan item IDs per SFG bed, in cursor-fill order (left->right, top->bottom)
SFG_BEDS = {
    37: [69, 70, 71, 74, 75, 72, 73, 68],
    38: [82, 83, 76, 85, 86, 77, 78, 81, 84, 79, 80],
    39: [87, 89],
    40: [91, 92, 93, 94, 90],
}

# Raised Bed 44 explicit positions (6" grid, 14 cols x 24 rows)
# Tomatoes rows 0-5 (24" = 4 cells apart), Peppers rows 6-9 (12" = 2 apart),
# Cucumbers rows 10-19 (18" = 3 apart), Beans/herbs rows 20-23
RAISED_BED_POSITIONS = {
    # Tomatoes
    57: [(1, 0), (5, 0), (9, 0), (13, 0)],
    58: [(1, 4), (5, 4), (9, 4), (13, 4)],
    59: [(3, 2), (7, 2), (11, 2)],
    # Peppers
    62: [(0, 6), (2, 6), (4, 6)],
    63: [(6, 6), (8, 6), (10, 6)],
    64: [(0, 8), (2, 8), (4, 8)],
    # Cucumbers
    60: [(0, 10), (3, 10), (6, 10), (9, 10),
         (0, 13), (3, 13), (6, 13), (9, 13)],
    61: [(12, 10), (12, 13), (0, 16), (3, 16),
         (6, 16), (9, 16), (12, 16), (0, 19)],
    # Beans (adjacent, direct seed)
    65: [(x, 20) for x in range(14)],
    # Cilantro
    66: [(0, 22), (1, 22), (2, 22)],
    # Marigold
    67: [(4, 22), (5, 22), (6, 22), (7, 22), (8, 22), (9, 22)],
}

# ---------------------------------------------------------------------------
# MIG Bed definitions (3" grid, 16 cols x 32 rows)
# ---------------------------------------------------------------------------
# Each entry: (item_id, plant_stride, y_rows, max_plants)
#   plant_stride = cells between plants in a row (on 3" grid)
#   y_rows = explicit row y-indices for this crop

# Bed 41: Corn (May 15) relay -> Spinach (Aug 25)
MIG_BED_41 = [
    (95, 2, [0, 4, 8, 12], 32),            # corn Stowell's Evergreen
    (96, 2, [16, 20, 24, 28], 32),          # corn Dakota Black Popcorn
    (97, 2, list(range(0, 13)), 100),       # spinach Bloomsdale (relay Aug 25)
    (98, 2, list(range(13, 26)), 100),      # spinach Viroflay (relay Aug 25)
]

# Bed 42: Potato + Onion (Mar 15) relay -> Bean (Aug 15)
MIG_BED_42 = [
    (99, 3, [0, 7, 14, 21], 20),           # potato Adirondack Blue
    (100, 2, [24, 26], 16),                 # onion Pompeu
    (101, 2, [25, 27], 16),                 # onion Red Creole
    (102, 2, [28, 30], 16),                 # onion Southport
    (103, 2, [0, 6, 12, 18, 24], 34),      # bean Contender (relay Aug 15)
]

MIG_BEDS = {41: MIG_BED_41, 42: MIG_BED_42}

ALL_BEDS = [37, 38, 39, 40, 41, 42, 43, 44]


def should_place(bed_id):
    """Return True if bed has no items (or --force is set)."""
    if FORCE:
        return True
    count = PlantedItem.query.filter_by(garden_bed_id=bed_id).count()
    if count > 0:
        print(f"    Already has {count} items — skipping (use --force to override)")
        return False
    return True


def get_plant_info(plant_id):
    """Return (days_to_maturity, is_transplant) for a plant."""
    plant = get_plant_by_id(plant_id)
    dtm = plant.get('daysToMaturity', 60) if plant else 60
    weeks_indoors = plant.get('weeksIndoors', 0) if plant else 0
    return dtm, weeks_indoors > 0


def to_datetime(d):
    """Convert a date or string to datetime."""
    if d is None:
        return datetime(2026, 3, 15)
    if isinstance(d, str):
        d = d.replace('Z', '+00:00')
        return datetime.fromisoformat(d)
    if isinstance(d, datetime):
        return d
    # datetime.date
    return datetime(d.year, d.month, d.day)


def create_pair(bed_id, plan_item, x, y, qty, planted_dt, harvest_dt, is_transplant):
    """Create a PlantedItem + PlantingEvent pair."""
    item = PlantedItem(
        user_id=USER_ID,
        plant_id=plan_item.plant_id,
        variety=plan_item.variety,
        garden_bed_id=bed_id,
        planted_date=planted_dt,
        harvest_date=harvest_dt,
        position_x=x,
        position_y=y,
        quantity=qty,
        status='planned',
        source_plan_item_id=plan_item.id,
    )
    event = PlantingEvent(
        user_id=USER_ID,
        event_type='planting',
        plant_id=plan_item.plant_id,
        variety=plan_item.variety,
        garden_bed_id=bed_id,
        direct_seed_date=planted_dt if not is_transplant else None,
        transplant_date=planted_dt if is_transplant else None,
        expected_harvest_date=harvest_dt,
        position_x=x,
        position_y=y,
        quantity=qty,
    )
    if not DRY_RUN:
        db.session.add(item)
        db.session.add(event)
    return item, event


def place_sfg_bed(bed_id, item_ids):
    """Place items using cursor fill on a 4x12 SFG grid."""
    cols, rows = 4, 12
    cx, cy = 0, 0
    total_cells = 0

    for pid in item_ids:
        pi = GardenPlanItem.query.get(pid)
        if not pi:
            print(f"    SKIP: Plan item {pid} not found")
            continue

        dtm, is_transplant = get_plant_info(pi.plant_id)
        per_cell = SFG_PER_CELL.get(pi.plant_id, 1)
        succ_count = max(1, pi.succession_count or 1)
        first_qty = math.ceil(pi.plant_equivalent / succ_count)
        cells_needed = math.ceil(first_qty / per_cell)

        planted_dt = to_datetime(pi.first_plant_date)
        harvest_dt = planted_dt + timedelta(days=dtm)

        remaining = first_qty
        placed = 0
        for _ in range(cells_needed):
            if cy >= rows:
                print(f"    OVERFLOW at {pi.plant_id} {pi.variety}")
                break
            qty = min(per_cell, remaining)
            remaining -= qty
            create_pair(bed_id, pi, cx, cy, qty, planted_dt, harvest_dt, is_transplant)
            placed += 1
            cx += 1
            if cx >= cols:
                cx = 0
                cy += 1

        var_str = (pi.variety or '')[:20]
        print(f"    {pi.plant_id:20s} {var_str:20s} {placed:2d} cells  ({first_qty} plants, {per_cell}/cell)")
        total_cells += placed

    print(f"    {'':20s} {'TOTAL':20s} {total_cells:2d} / {cols * rows} cells")
    return total_cells


def place_raised_bed(bed_id):
    """Place items on Raised Bed 44 with explicit positions."""
    total = 0

    for pid, positions in RAISED_BED_POSITIONS.items():
        pi = GardenPlanItem.query.get(pid)
        if not pi:
            print(f"    SKIP: Plan item {pid} not found")
            continue

        dtm, is_transplant = get_plant_info(pi.plant_id)
        planted_dt = to_datetime(pi.first_plant_date)
        harvest_dt = planted_dt + timedelta(days=dtm)

        for x, y in positions:
            create_pair(bed_id, pi, x, y, 1, planted_dt, harvest_dt, is_transplant)

        var_str = (pi.variety or '')[:20]
        print(f"    {pi.plant_id:20s} {var_str:20s} {len(positions):2d} plants")
        total += len(positions)

    print(f"    {'':20s} {'TOTAL':20s} {total:2d} / 336 cells")
    return total


def place_mig_bed(bed_id, items):
    """Place items using MIG row-based spacing on a 16x32 grid (3" cells).

    Each item specifies explicit row positions and plant stride.
    One PlantedItem per plant position (qty=1 each).
    """
    cols = 16  # 4ft / 3" = 16
    total_plants = 0

    for item_id, plant_stride, y_rows, max_plants in items:
        pi = GardenPlanItem.query.get(item_id)
        if not pi:
            print(f"    SKIP: Plan item {item_id} not found")
            continue

        dtm, is_transplant = get_plant_info(pi.plant_id)
        planted_dt = to_datetime(pi.first_plant_date)
        harvest_dt = planted_dt + timedelta(days=dtm)

        remaining = max_plants
        placed = 0
        for y in y_rows:
            if remaining <= 0:
                break
            x = 0
            while x < cols and remaining > 0:
                create_pair(bed_id, pi, x, y, 1, planted_dt, harvest_dt, is_transplant)
                placed += 1
                remaining -= 1
                x += plant_stride

        var_str = (pi.variety or '')[:20]
        print(f"    {pi.plant_id:20s} {var_str:20s} {placed:3d} plants  "
              f"(stride={plant_stride}, rows={len(y_rows)})")
        total_plants += placed

    print(f"    {'':20s} {'TOTAL':20s} {total_plants:3d} plants")
    return total_plants


def place_permaculture_bed(bed_id):
    """Place items using cursor fill on Permaculture bed (30x50, 12" grid).

    Queries all GardenPlanItems assigned to this bed via bed_assignments JSON,
    sorts by first_plant_date then ID, and fills left-to-right top-to-bottom.
    """
    cols, rows = 30, 50
    cx, cy = 0, 0
    total_cells = 0

    # Query all plan items assigned to this bed
    all_items = GardenPlanItem.query.filter(
        GardenPlanItem.bed_assignments.isnot(None)
    ).all()

    bed_items = []
    for pi in all_items:
        try:
            assignments = json.loads(pi.bed_assignments)
            if any(a.get('bedId') == bed_id for a in assignments):
                bed_items.append(pi)
        except (json.JSONDecodeError, TypeError):
            continue

    # Sort by first_plant_date, then by ID as tiebreaker
    bed_items.sort(key=lambda pi: (to_datetime(pi.first_plant_date), pi.id))

    for pi in bed_items:
        dtm, is_transplant = get_plant_info(pi.plant_id)
        per_cell = SFG_PER_CELL.get(pi.plant_id, 1)
        succ_count = max(1, pi.succession_count or 1)
        first_qty = math.ceil(pi.plant_equivalent / succ_count)
        cells_needed = math.ceil(first_qty / per_cell)

        planted_dt = to_datetime(pi.first_plant_date)
        harvest_dt = planted_dt + timedelta(days=dtm)

        remaining = first_qty
        placed = 0
        for _ in range(cells_needed):
            if cy >= rows:
                print(f"    OVERFLOW at {pi.plant_id} {pi.variety}")
                break
            qty = min(per_cell, remaining)
            remaining -= qty
            create_pair(bed_id, pi, cx, cy, qty, planted_dt, harvest_dt, is_transplant)
            placed += 1
            cx += 1
            if cx >= cols:
                cx = 0
                cy += 1

        var_str = (pi.variety or '')[:20]
        print(f"    {pi.plant_id:20s} {var_str:20s} {placed:3d} cells  "
              f"({first_qty} plants, {per_cell}/cell)")
        total_cells += placed

    print(f"    {'':20s} {'TOTAL':20s} {total_cells:3d} / {cols * rows} cells")
    return total_cells


def main():
    mode = "DRY RUN" if DRY_RUN else "COMMIT"
    print(f"\n{'=' * 60}")
    print(f"  Place Plants Script ({mode})")
    print(f"{'=' * 60}\n")

    with app.app_context():
        # Verify beds exist and show status
        for bid in ALL_BEDS:
            bed = GardenBed.query.get(bid)
            if not bed:
                print(f"ERROR: Bed {bid} not found!")
                return
            existing = PlantedItem.query.filter_by(garden_bed_id=bid).count()
            print(f"  Bed {bid}: {bed.name} ({bed.planning_method}, "
                  f"grid={bed.grid_size}\") - {existing} existing items")

        grand_total = 0

        # SFG Beds (37-40)
        for bid, item_ids in SFG_BEDS.items():
            bed = GardenBed.query.get(bid)
            print(f"\n--- {bed.name} (Bed {bid}) ---")
            if not should_place(bid):
                continue
            n = place_sfg_bed(bid, item_ids)
            grand_total += n

        # MIG Beds (41-42)
        for bid, items in MIG_BEDS.items():
            bed = GardenBed.query.get(bid)
            print(f"\n--- {bed.name} (Bed {bid}) ---")
            if not should_place(bid):
                continue
            n = place_mig_bed(bid, items)
            grand_total += n

        # Permaculture Bed (43)
        bed = GardenBed.query.get(43)
        print(f"\n--- {bed.name} (Bed 43) ---")
        if should_place(43):
            n = place_permaculture_bed(43)
            grand_total += n

        # Raised Bed 44
        bed = GardenBed.query.get(44)
        print(f"\n--- {bed.name} (Bed 44) ---")
        if should_place(44):
            n = place_raised_bed(44)
            grand_total += n

        print(f"\n{'=' * 60}")
        print(f"  TOTAL: {grand_total} PlantedItems + {grand_total} PlantingEvents")
        print(f"{'=' * 60}")

        if not DRY_RUN:
            db.session.commit()
            print("\nCommitted to database.")
        else:
            print("\nDry run - no changes written. Run with --commit to write.")

        # Verification counts
        print("\nVerification (DB counts):")
        for bid in ALL_BEDS:
            count = PlantedItem.query.filter_by(garden_bed_id=bid).count()
            print(f"  Bed {bid}: {count} PlantedItems")


if __name__ == '__main__':
    main()
