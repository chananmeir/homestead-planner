#!/usr/bin/env python
"""
Place unplaced GardenPlanItems onto garden bed grids for Beds 41, 42, 44.

Finds all GardenPlanItems in Plan 44 assigned to these beds that have NO
linked PlantedItems (via source_plan_item_id), then places them on the grid
avoiding existing occupied cells.

Covers:
  - Round 1 gap items (16 items never placed by place_plants.py)
  - Round 2 items (38 items added by add_gap_plantings.py)

Usage:
    cd backend
    python place_gap_plants.py              # Dry run (shows what would be placed)
    python place_gap_plants.py --commit     # Actually write to database
"""

import json
import math
import sys
from datetime import datetime, timedelta
from app import app
from models import db, PlantedItem, PlantingEvent, GardenBed, GardenPlanItem
from plant_database import get_plant_by_id
from migardener_spacing import get_migardener_spacing, MIGARDENER_SPACING_OVERRIDES

DRY_RUN = '--commit' not in sys.argv
USER_ID = 1
PLAN_ID = 44
TARGET_BEDS = [41, 42, 44]

# Grid dimensions per bed
BED_GRIDS = {
    41: {'cols': 16, 'rows': 32, 'grid_inches': 3},   # 4ft x 8ft MIG
    42: {'cols': 16, 'rows': 32, 'grid_inches': 3},   # 4ft x 8ft MIG
    44: {'cols': 14, 'rows': 36, 'grid_inches': 6},   # 7ft x 18ft Raised
}


def get_plant_info(plant_id):
    """Return (days_to_maturity, is_transplant, standard_spacing) for a plant."""
    plant = get_plant_by_id(plant_id)
    if not plant:
        return 60, False, 12
    dtm = plant.get('daysToMaturity', 60) if plant.get('daysToMaturity') is not None else 60
    weeks_indoors = plant.get('weeksIndoors', 0) if plant.get('weeksIndoors') is not None else 0
    spacing = plant.get('spacing', 12) if plant.get('spacing') is not None else 12
    return dtm, weeks_indoors > 0, spacing


def to_datetime(d):
    """Convert a date or string to datetime."""
    if d is None:
        return datetime(2026, 6, 1)
    if isinstance(d, str):
        d = d.replace('Z', '+00:00')
        return datetime.fromisoformat(d)
    if isinstance(d, datetime):
        return d
    # datetime.date
    return datetime(d.year, d.month, d.day)


def get_occupied_cells(bed_id):
    """Return set of (x, y) positions already occupied in this bed."""
    items = PlantedItem.query.filter_by(garden_bed_id=bed_id).all()
    occupied = set()
    for item in items:
        occupied.add((item.position_x, item.position_y))
    return occupied


def get_unplaced_items(bed_id):
    """Find GardenPlanItems for Plan 44, assigned to bed_id, with no PlantedItems."""
    all_items = GardenPlanItem.query.filter_by(garden_plan_id=PLAN_ID).all()

    unplaced = []
    for pi in all_items:
        # Check if this item is assigned to the target bed
        if not pi.bed_assignments:
            continue
        try:
            assignments = json.loads(pi.bed_assignments)
        except (json.JSONDecodeError, TypeError):
            continue

        assigned_to_bed = False
        qty_for_bed = 0
        for a in assignments:
            if a.get('bedId') == bed_id:
                assigned_to_bed = True
                qty_for_bed = a.get('quantity', pi.plant_equivalent or 0)
                break

        if not assigned_to_bed:
            continue

        # Check if any PlantedItems already linked
        placed_count = PlantedItem.query.filter_by(
            source_plan_item_id=pi.id,
            garden_bed_id=bed_id
        ).count()

        if placed_count == 0:
            unplaced.append((pi, qty_for_bed))

    # Sort by first_plant_date then id (earlier dates first)
    unplaced.sort(key=lambda t: (to_datetime(t[0].first_plant_date), t[0].id))
    return unplaced


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


def place_mig_items(bed_id, unplaced_items, occupied):
    """Place items on a MIG bed (3" grid) using row-based spacing.

    Scans available rows top-to-bottom, places plants with appropriate stride.
    """
    grid = BED_GRIDS[bed_id]
    cols, total_rows, grid_inches = grid['cols'], grid['rows'], grid['grid_inches']
    total_placed = 0

    for pi, qty in unplaced_items:
        dtm, is_transplant, std_spacing = get_plant_info(pi.plant_id)
        planted_dt = to_datetime(pi.first_plant_date)
        harvest_dt = planted_dt + timedelta(days=dtm)

        # Get MIG spacing
        spacing = get_migardener_spacing(pi.plant_id, std_spacing)
        plant_spacing = spacing['plant_spacing']
        row_spacing = spacing['row_spacing']

        # Convert to grid strides
        plant_stride = max(1, round(plant_spacing / grid_inches))
        if row_spacing is not None:
            row_stride = max(1, round(row_spacing / grid_inches))
        else:
            # Intensive/broadcast — use plant spacing for both dimensions
            row_stride = max(1, round(plant_spacing / grid_inches))

        # Clamp very large strides to fit bed (with warning)
        if plant_stride > cols:
            print(f"    WARNING: {pi.plant_id} plant_stride {plant_stride} > {cols} cols, "
                  f"clamping to {cols}")
            plant_stride = cols
        if row_stride > total_rows:
            print(f"    WARNING: {pi.plant_id} row_stride {row_stride} > {total_rows} rows, "
                  f"clamping to {total_rows // 2}")
            row_stride = max(1, total_rows // 2)

        remaining = qty
        placed = 0
        # Scan every row; for each row, find free cells respecting plant_stride
        # between placed plants (not between scan positions)
        for y in range(total_rows):
            if remaining <= 0:
                break
            # Check if this row is usable: at least one cell free
            row_free = any((x, y) not in occupied for x in range(cols))
            if not row_free:
                continue
            # Place plants in this row with spacing
            last_placed_x = -plant_stride  # allow placing at x=0
            for x in range(cols):
                if remaining <= 0:
                    break
                if (x, y) not in occupied and (x - last_placed_x) >= plant_stride:
                    create_pair(bed_id, pi, x, y, 1, planted_dt, harvest_dt, is_transplant)
                    occupied.add((x, y))
                    placed += 1
                    remaining -= 1
                    last_placed_x = x

        var_str = (pi.variety or '')[:25]
        print(f"    {pi.plant_id:25s} {var_str:25s} {placed:3d}/{qty:3d}  "
              f"(stride p={plant_stride} r={row_stride})")
        total_placed += placed

    return total_placed


def place_raised_items(bed_id, unplaced_items, occupied):
    """Place items on Raised Bed 44 (6" grid) using cursor fill with spacing.

    Scans left-to-right, top-to-bottom, skipping occupied cells and
    respecting spacing-based stride.
    """
    grid = BED_GRIDS[bed_id]
    cols, total_rows, grid_inches = grid['cols'], grid['rows'], grid['grid_inches']
    total_placed = 0

    for pi, qty in unplaced_items:
        dtm, is_transplant, std_spacing = get_plant_info(pi.plant_id)
        planted_dt = to_datetime(pi.first_plant_date)
        harvest_dt = planted_dt + timedelta(days=dtm)

        # Convert spacing to grid stride
        plant_stride = max(1, round(std_spacing / grid_inches))

        # Clamp
        if plant_stride > cols:
            plant_stride = cols

        remaining = qty
        placed = 0
        for y in range(total_rows):
            x = 0
            while x < cols and remaining > 0:
                if (x, y) not in occupied:
                    create_pair(bed_id, pi, x, y, 1, planted_dt, harvest_dt, is_transplant)
                    occupied.add((x, y))
                    placed += 1
                    remaining -= 1
                    x += plant_stride
                else:
                    x += 1
            if remaining <= 0:
                break

        var_str = (pi.variety or '')[:25]
        print(f"    {pi.plant_id:25s} {var_str:25s} {placed:3d}/{qty:3d}  "
              f"(stride={plant_stride})")
        total_placed += placed

    return total_placed


def main():
    mode = "DRY RUN" if DRY_RUN else "COMMIT"
    print(f"\n{'=' * 70}")
    print(f"  Place Gap Plants Script ({mode})")
    print(f"  Beds: {TARGET_BEDS}  |  Plan: {PLAN_ID}")
    print(f"{'=' * 70}\n")

    with app.app_context():
        grand_total = 0

        for bed_id in TARGET_BEDS:
            bed = GardenBed.query.get(bed_id)
            if not bed:
                print(f"ERROR: Bed {bed_id} not found!")
                continue

            occupied = get_occupied_cells(bed_id)
            unplaced = get_unplaced_items(bed_id)
            grid = BED_GRIDS[bed_id]
            total_cells = grid['cols'] * grid['rows']

            print(f"--- {bed.name} (Bed {bed_id}) ---")
            print(f"    Grid: {grid['cols']}x{grid['rows']} ({grid['grid_inches']}\" cells)  "
                  f"Occupied: {len(occupied)}/{total_cells}  "
                  f"Unplaced items: {len(unplaced)}")

            if not unplaced:
                print(f"    Nothing to place.\n")
                continue

            if bed_id in (41, 42):
                n = place_mig_items(bed_id, unplaced, occupied)
            else:
                n = place_raised_items(bed_id, unplaced, occupied)

            print(f"    --- Placed {n} plants, now {len(occupied)}/{total_cells} occupied\n")
            grand_total += n

        print(f"{'=' * 70}")
        print(f"  TOTAL: {grand_total} PlantedItems + {grand_total} PlantingEvents")
        print(f"{'=' * 70}")

        if not DRY_RUN:
            db.session.commit()
            print("\nCommitted to database.")
        else:
            print("\nDry run - no changes written. Run with --commit to write.")

        # Verification counts
        print("\nVerification (DB counts):")
        for bed_id in TARGET_BEDS:
            total = PlantedItem.query.filter_by(garden_bed_id=bed_id).count()
            linked = PlantedItem.query.filter(
                PlantedItem.garden_bed_id == bed_id,
                PlantedItem.source_plan_item_id.isnot(None)
            ).count()
            print(f"  Bed {bed_id}: {total} PlantedItems ({linked} linked to plan items)")


if __name__ == '__main__':
    main()
