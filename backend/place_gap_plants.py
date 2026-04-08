#!/usr/bin/env python
"""
Place unplaced gap-filling plan items onto bed grids for Plan 44.

Finds all GardenPlanItems in Plan 44 that have no corresponding PlantedItem,
then creates PlantedItem + PlantingEvent pairs using temporal-aware cursor fill.

Temporal reuse: cells occupied by earlier crops become available after harvest,
allowing later-season items to reuse the same grid positions.

Usage:
    cd backend
    python place_gap_plants.py              # Dry run (shows what would be created)
    python place_gap_plants.py --commit     # Actually write to database
"""

import json
import math
import sys
from datetime import datetime, timedelta

from app import app
from models import db, PlantedItem, PlantingEvent, GardenBed, GardenPlanItem
from plant_database import get_plant_by_id

DRY_RUN = '--commit' not in sys.argv
USER_ID = 1
PLAN_ID = 44

# SFG plants-per-cell lookup (for 12" grid beds)
SFG_PER_CELL = {
    'cabbage-1': 1, 'kale-1': 1, 'broccoli-1': 1, 'collard-greens-1': 1,
    'potato-1': 1, 'pepper-1': 1, 'tomato-1': 1, 'cucumber-1': 1,
    'corn-1': 1, 'sage-1': 1, 'asparagus-1': 1, 'squash-1': 1, 'pumpkin-1': 1,
    'cilantro-1': 1, 'watermelon-1': 1, 'melon-1': 1, 'sunflower-1': 1,
    'gourd-bi-color-pear': 1, 'lemon-balm-1': 1, 'mullein-1': 1,
    'burdock-1': 1, 'marigold-1': 4,
    'lettuce-1': 4, 'chard-1': 4, 'beet-1': 4, 'onion-1': 4, 'mustard-1': 4,
    'thyme-1': 4, 'radicchio-1': 4, 'endive-1': 4, 'sorrel-1': 4,
    'bok-choy-1': 4, 'shungiku-1': 4, 'fenugreek-1': 4, 'caraway-1': 4,
    'pea-1': 8,
    'spinach-1': 9, 'bean-1': 9,
    'carrot-1': 16, 'radish-1': 16,
}

# Minimum plant spacing in inches (for stride on fine-grid beds)
PLANT_SPACING_INCHES = {
    'watermelon-1': 24, 'melon-1': 24, 'squash-1': 24,
    'gourd-bi-color-pear': 24, 'pumpkin-1': 24,
    'tomato-1': 18, 'pepper-1': 12, 'cucumber-1': 12,
    'sunflower-1': 12, 'kale-1': 12, 'collard-greens-1': 12,
    'broccoli-1': 12, 'potato-1': 9, 'lemon-balm-1': 9,
    'corn-1': 6, 'marigold-1': 6, 'bean-1': 4, 'pea-1': 3,
    'cilantro-1': 6, 'onion-1': 4, 'beet-1': 4,
    'lettuce-1': 6, 'bok-choy-1': 6, 'endive-1': 6,
    'radicchio-1': 6, 'sorrel-1': 6, 'shungiku-1': 3,
    'spinach-1': 3, 'mustard-1': 3, 'fenugreek-1': 3,
    'carrot-1': 3, 'mullein-1': 12, 'burdock-1': 6, 'caraway-1': 3,
}

BED_IDS = [37, 38, 39, 40, 41, 42, 43, 44]

# Bed geometry: bed_id -> (cols, rows)
BED_GEOMETRY = {
    37: (4, 8), 38: (4, 8), 39: (4, 8), 40: (4, 8),   # SFG 12"
    41: (16, 32), 42: (16, 32),                          # MIG 3"
    43: (30, 50),                                         # Permaculture 12"
    44: (14, 36),                                         # Raised 6"
}


def get_plant_info(plant_id):
    """Return (days_to_maturity, is_transplant) for a plant."""
    plant = get_plant_by_id(plant_id)
    dtm = plant.get('daysToMaturity', 60) if plant else 60
    weeks_indoors = plant.get('weeksIndoors', 0) if plant else 0
    return dtm, weeks_indoors > 0


def to_datetime(d):
    """Convert a date, string, or None to datetime."""
    if d is None:
        return datetime(2026, 3, 15)
    if isinstance(d, str):
        d = d.replace('Z', '+00:00')
        return datetime.fromisoformat(d)
    if isinstance(d, datetime):
        return d
    # datetime.date
    return datetime(d.year, d.month, d.day)


def get_stride(plant_id, grid_size):
    """Get cell stride for a plant on a given grid size.

    For 12" grids (SFG/Permaculture), stride is 1 because multi-plant
    packing is handled by SFG_PER_CELL.
    For smaller grids, stride = spacing_inches / grid_size.
    """
    if grid_size >= 12:
        return 1
    spacing = PLANT_SPACING_INCHES.get(plant_id, 6)
    return max(1, spacing // grid_size)


def build_cell_availability(bed_id):
    """Build a map of (x,y) -> latest harvest_date for existing items.

    A cell is available on date D if it has never been used, OR its
    latest harvest_date <= D.
    """
    items = PlantedItem.query.filter_by(garden_bed_id=bed_id).all()
    cell_free_after = {}  # (x,y) -> datetime when cell becomes free

    for it in items:
        key = (it.position_x, it.position_y)
        hd = it.harvest_date if it.harvest_date else datetime(2099, 12, 31)
        if key not in cell_free_after or hd > cell_free_after[key]:
            cell_free_after[key] = hd

    return cell_free_after


def find_available_cells(cell_free_after, cols, rows, plant_date, count, stride=1):
    """Find `count` cells available on `plant_date`.

    Scans left-to-right, top-to-bottom with given stride.
    Falls back to stride=1 if not enough cells found at original stride.
    """
    available = []
    y = 0
    while y < rows and len(available) < count:
        x = 0
        while x < cols and len(available) < count:
            key = (x, y)
            if key not in cell_free_after or cell_free_after[key] <= plant_date:
                available.append(key)
            x += stride
        y += stride

    # Fallback: if stride > 1 and not enough found, try stride 1
    if len(available) < count and stride > 1:
        taken = set(available)
        for y2 in range(rows):
            for x2 in range(cols):
                key = (x2, y2)
                if key in taken:
                    continue
                if key not in cell_free_after or cell_free_after[key] <= plant_date:
                    available.append(key)
                    taken.add(key)
                    if len(available) >= count:
                        return available

    return available


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


def get_bed_qty(plan_item, bed_id):
    """Get the quantity allocated to a specific bed from bed_assignments."""
    if plan_item.bed_assignments:
        try:
            assignments = json.loads(plan_item.bed_assignments)
            for a in assignments:
                if a.get('bedId') == bed_id:
                    return int(a.get('quantity', 0))
        except (json.JSONDecodeError, TypeError):
            pass
    return plan_item.plant_equivalent


def expand_successions(plan_item, bed_id):
    """Expand a plan item into succession batches.

    Returns list of (qty, plant_date) tuples.
    Remainder plants go to earlier successions (matches backend export logic).
    """
    total_qty = get_bed_qty(plan_item, bed_id)
    succ_count = max(1, plan_item.succession_count or 1)
    interval = plan_item.succession_interval_days or 0
    base_date = to_datetime(plan_item.first_plant_date)

    if succ_count <= 1:
        return [(total_qty, base_date)]

    base_qty = total_qty // succ_count
    remainder = total_qty % succ_count

    batches = []
    for i in range(succ_count):
        qty = base_qty + (1 if i < remainder else 0)
        plant_date = base_date + timedelta(days=i * interval)
        if qty > 0:
            batches.append((qty, plant_date))

    return batches


def get_unplaced_items_for_bed(bed_id, placed_ids):
    """Get GardenPlanItems in Plan 44 assigned to bed_id with no PlantedItems."""
    all_items = GardenPlanItem.query.filter_by(garden_plan_id=PLAN_ID).all()

    result = []
    for pi in all_items:
        if pi.id in placed_ids:
            continue
        if not pi.bed_assignments:
            continue
        try:
            assignments = json.loads(pi.bed_assignments)
            if any(a.get('bedId') == bed_id for a in assignments):
                result.append(pi)
        except (json.JSONDecodeError, TypeError):
            continue

    # Sort chronologically, then by ID as tiebreaker
    result.sort(key=lambda pi: (to_datetime(pi.first_plant_date), pi.id))
    return result


def place_bed_items(bed_id, grid_size):
    """Place unplaced gap items on a bed using temporal-aware cursor fill."""
    cols, rows = BED_GEOMETRY[bed_id]
    use_sfg = grid_size >= 12

    # Get all plan item IDs that already have placed items
    placed_ids = set(
        r[0] for r in db.session.query(PlantedItem.source_plan_item_id)
        .filter(PlantedItem.source_plan_item_id.isnot(None))
        .distinct().all()
    )

    items = get_unplaced_items_for_bed(bed_id, placed_ids)
    if not items:
        print("  No unplaced items for this bed")
        return 0, 0, 0

    cell_free_after = build_cell_availability(bed_id)
    total_placed = 0
    total_skipped = 0
    total_items = 0

    for pi in items:
        dtm, is_transplant = get_plant_info(pi.plant_id)
        per_cell = SFG_PER_CELL.get(pi.plant_id, 1) if use_sfg else 1
        stride = get_stride(pi.plant_id, grid_size)

        batches = expand_successions(pi, bed_id)
        item_placed = 0
        item_skipped = 0

        for batch_idx, (batch_qty, plant_date) in enumerate(batches):
            harvest_dt = plant_date + timedelta(days=dtm)

            if per_cell > 1:
                cells_needed = math.ceil(batch_qty / per_cell)
            else:
                cells_needed = batch_qty

            available = find_available_cells(
                cell_free_after, cols, rows, plant_date, cells_needed, stride
            )

            if len(available) < cells_needed:
                short = cells_needed - len(available)
                batch_str = f" batch {batch_idx + 1}" if len(batches) > 1 else ""
                print(f"  WARNING: {pi.plant_id} {pi.variety}{batch_str} on "
                      f"{plant_date.strftime('%m/%d')} needs {cells_needed} cells, "
                      f"only {len(available)} available (short {short})")

            remaining = batch_qty
            for x, y in available:
                if remaining <= 0:
                    break
                qty = min(per_cell, remaining) if per_cell > 1 else 1
                remaining -= qty
                create_pair(bed_id, pi, x, y, qty, plant_date, harvest_dt, is_transplant)

                # Update cell availability for later items
                key = (x, y)
                cell_free_after[key] = harvest_dt
                item_placed += qty

            item_skipped += remaining  # plants that couldn't be placed

        var_str = (pi.variety or '')[:20]
        bed_qty = get_bed_qty(pi, bed_id)
        succ_info = f" ({len(batches)} succ)" if len(batches) > 1 else ""
        skip_info = f" [SKIP {item_skipped}]" if item_skipped > 0 else ""
        print(f"  {pi.plant_id:25s} {var_str:20s} "
              f"{item_placed:3d}/{bed_qty:3d}{succ_info}{skip_info}")

        total_placed += item_placed
        total_skipped += item_skipped
        total_items += 1

    print(f"  {'':25s} {'TOTAL':20s} {total_placed:3d} placed, "
          f"{total_skipped} skipped, {total_items} items")
    return total_placed, total_skipped, total_items


def main():
    mode = "DRY RUN" if DRY_RUN else "COMMIT"
    print(f"\n{'=' * 72}")
    print(f"  Place Gap-Filling Plants ({mode})")
    print(f"{'=' * 72}\n")

    with app.app_context():
        grand_placed = 0
        grand_skipped = 0
        grand_items = 0

        for bid in BED_IDS:
            bed = GardenBed.query.get(bid)
            existing = PlantedItem.query.filter_by(garden_bed_id=bid).count()
            cols, rows = BED_GEOMETRY[bid]
            print(f"\n--- {bed.name} (Bed {bid}, {bed.planning_method}, "
                  f"{bed.grid_size}\", {cols}x{rows}, {existing} existing) ---")

            placed, skipped, items = place_bed_items(bid, bed.grid_size)
            grand_placed += placed
            grand_skipped += skipped
            grand_items += items

        print(f"\n{'=' * 72}")
        print(f"  GRAND TOTAL: {grand_placed} placed, {grand_skipped} skipped "
              f"({grand_items} plan items)")
        print(f"  Creates: {grand_placed} PlantedItems + {grand_placed} PlantingEvents")
        print(f"{'=' * 72}")

        if not DRY_RUN:
            db.session.commit()
            print("\nCommitted to database.")
        else:
            print("\nDry run - no changes written. Run with --commit to write.")

        # Verification counts
        print("\nVerification (DB counts after):")
        for bid in BED_IDS:
            count = PlantedItem.query.filter_by(garden_bed_id=bid).count()
            bed = GardenBed.query.get(bid)
            print(f"  Bed {bid} ({bed.name}): {count} PlantedItems")


if __name__ == '__main__':
    main()
