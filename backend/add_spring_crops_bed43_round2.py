#!/usr/bin/env python
"""
Round 2: Fill remaining spring gap on Permaculture Bed (ID 43) for Plan 44.

After round 1 (add_spring_crops_bed43.py), the bed is still only ~24% occupied
on April 4 (358/1500 cells). Round 1's idempotency check was too broad — it
matched Apr 1/Apr 15 wave items and skipped March placements for crops that
already had some plantings.

This script:
  - REUSES existing plan items for pea (#132), spinach (#111, #112), radish (#121)
  - CREATES new plan items for carrot (Mar 20) and beet (Mar 20) — the existing
    ones are Apr 15 wave, a different planting
  - Uses tighter idempotency: planted_date < Apr 1 (not May 1) to distinguish
    March plantings from the April wave

Crops (longest-DTM first, radish fills last):
  1. Carrot Royal Chantenay:  80 cells (16/cell, 1280 plants) Mar 20, DTM 70 → NEW
  2. Pea Super Sugar Snap:    33 cells ( 8/cell,  264 plants) Mar 15, DTM 60 → #132
  3. Beet Formanova:          60 cells ( 4/cell,  240 plants) Mar 20, DTM 55 → NEW
  4. Spinach Bloomsdale:      50 cells ( 9/cell,  450 plants) Mar 15, DTM 40 → #111
  5. Spinach Viroflay:        50 cells ( 9/cell,  450 plants) Mar 15, DTM 40 → #112
  6. Radish Cherry Belle:    FILL      (16/cell)              Mar 15, DTM 25 → #121

Expected: ~1,000 new cells → bed reaches ~90%+ occupancy on April 4.

Usage:
    cd backend
    python add_spring_crops_bed43_round2.py              # Dry run (preview)
    python add_spring_crops_bed43_round2.py --commit     # Write to database
"""

import json
import sys
from datetime import date, datetime, timedelta

from app import app
from models import db, GardenPlanItem, PlantedItem, PlantingEvent, GardenBed

DRY_RUN = '--commit' not in sys.argv
USER_ID = 1
PLAN_ID = 44
BED_ID = 43
GRID_SIZE = 12   # Permaculture bed: 12" grid
COLS, ROWS = 30, 50  # 30ft x 50ft at 12" grid

# Tighter cutoff than round 1: only count items planted before April 1
# This prevents the Apr 1 / Apr 15 wave items from triggering false skips
EARLY_CUTOFF_DT = datetime(2026, 4, 1)

# For new plan item date matching
SPRING_CUTOFF = date(2026, 5, 1)

# Harvest safety limits
HARVEST_WARN = datetime(2026, 5, 15)
HARVEST_HARD = datetime(2026, 5, 30)

# SFG plants per cell (12" grid)
SFG_PER_CELL = {
    'radish-1': 16,
    'carrot-1': 16,
    'spinach-1': 9,
    'pea-1': 8,
    'beet-1': 4,
}

# Round 2 crops
# (plant_id, variety, cells_target, plant_date, dtm, seed_id,
#  existing_plan_item_id, pre_existing_cells)
#
# cells_target = None → fill all remaining available cells
# existing_plan_item_id = None → create NEW plan item
# pre_existing_cells = cells already placed by round 1 (for idempotency)
ROUND2_CROPS = [
    ('carrot-1',  'Royal Chantenay',  80, date(2026, 3, 20), 70, 21, None,   0),
    ('pea-1',     'Super Sugar Snap', 33, date(2026, 3, 15), 60, 55, 132,   38),
    ('beet-1',    'Formanova',        60, date(2026, 3, 20), 55, 13, None,   0),
    ('spinach-1', 'Bloomsdale',       50, date(2026, 3, 15), 40, 68, 111,   10),
    ('spinach-1', 'Viroflay',         50, date(2026, 3, 15), 40, 69, 112,   10),
    ('radish-1',  'Cherry Belle',   None, date(2026, 3, 15), 25, 63, 121,   40),
]


def build_cell_occupancy():
    """Build map of (x,y) -> list of (start_dt, end_dt) intervals.

    Uses interval-based tracking so spring crops can be placed in cells
    that are later used by summer crops (no temporal overlap).
    """
    items = PlantedItem.query.filter_by(garden_bed_id=BED_ID).all()
    cell_intervals = {}
    for it in items:
        key = (it.position_x, it.position_y)
        start = it.planted_date if it.planted_date else datetime(2026, 1, 1)
        end = it.harvest_date if it.harvest_date else datetime(2099, 12, 31)
        if key not in cell_intervals:
            cell_intervals[key] = []
        cell_intervals[key].append((start, end))
    return cell_intervals


def cell_available(cell_intervals, key, new_start, new_end):
    """Check if cell is available during [new_start, new_end].

    Two intervals overlap if start1 < end2 AND start2 < end1.
    """
    if key not in cell_intervals:
        return True
    for (occ_start, occ_end) in cell_intervals[key]:
        if new_start < occ_end and occ_start < new_end:
            return False
    return True


def find_cells(cell_intervals, plant_date_dt, harvest_dt, count):
    """Find up to `count` cells available during [plant_date_dt, harvest_dt]."""
    available = []
    for y in range(ROWS):
        for x in range(COLS):
            key = (x, y)
            if cell_available(cell_intervals, key, plant_date_dt, harvest_dt):
                available.append(key)
                if len(available) >= count:
                    return available
    return available


def create_plan_item(plant_id, variety, qty, plant_date, dtm, seed_inv_id):
    """Create a NEW GardenPlanItem for a spring crop."""
    harvest_date = plant_date + timedelta(days=dtm)
    return GardenPlanItem(
        garden_plan_id=PLAN_ID,
        seed_inventory_id=seed_inv_id,
        plant_id=plant_id,
        variety=variety,
        unit_type='plants',
        target_value=qty,
        plant_equivalent=qty,
        succession_enabled=False,
        succession_count=1,
        succession_interval_days=None,
        first_plant_date=plant_date,
        harvest_window_start=harvest_date,
        harvest_window_end=harvest_date,
        beds_allocated=json.dumps([BED_ID]),
        bed_assignments=json.dumps([{'bedId': BED_ID, 'quantity': qty}]),
        allocation_mode='custom',
        status='planned',
    )


def find_existing_new_plan_item(plant_id, variety, pdate):
    """Find a plan item matching exact plant date (for idempotent re-runs).

    Distinguishes round 2's Mar 20 carrot/beet from the Apr 15 wave items.
    """
    candidates = GardenPlanItem.query.filter_by(
        garden_plan_id=PLAN_ID, plant_id=plant_id, variety=variety
    ).all()
    for c in candidates:
        fpd = c.first_plant_date
        if fpd is None:
            continue
        if isinstance(fpd, str):
            try:
                fpd = datetime.strptime(fpd, '%Y-%m-%d').date()
            except ValueError:
                continue
        elif isinstance(fpd, datetime):
            fpd = fpd.date()
        if fpd == pdate:
            if c.bed_assignments:
                try:
                    if any(a.get('bedId') == BED_ID
                           for a in json.loads(c.bed_assignments)):
                        return c
                except (json.JSONDecodeError, TypeError):
                    pass
    return None


def create_pair(plan_item, x, y, qty, planted_dt, harvest_dt):
    """Create a PlantedItem + PlantingEvent pair (all crops are direct-seeded)."""
    item = PlantedItem(
        user_id=USER_ID,
        plant_id=plan_item.plant_id,
        variety=plan_item.variety,
        garden_bed_id=BED_ID,
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
        garden_bed_id=BED_ID,
        direct_seed_date=planted_dt,
        expected_harvest_date=harvest_dt,
        position_x=x,
        position_y=y,
        quantity=qty,
    )
    if not DRY_RUN:
        db.session.add(item)
        db.session.add(event)
    return item, event


def main():
    mode = "DRY RUN" if DRY_RUN else "COMMIT"
    print(f"\n{'=' * 72}")
    print(f"  Round 2: Fill Spring Gap on Permaculture Bed (ID 43) ({mode})")
    print(f"{'=' * 72}")

    with app.app_context():
        bed = GardenBed.query.get(BED_ID)
        existing_planted = PlantedItem.query.filter_by(garden_bed_id=BED_ID).count()
        print(f"\n  Bed: {bed.name} (ID {BED_ID}, {bed.planning_method}, "
              f"{bed.grid_size}\", {COLS}x{ROWS}, {existing_planted} existing items)")

        # -- Phase 1: Resolve / create plan items -----------------------------
        print(f"\n--- Phase 1: GardenPlanItems ---")
        plan_items = {}   # (plant_id, variety) -> GardenPlanItem
        plan_added = 0
        plan_reused = 0

        for (plant_id, variety, cells_target, pdate, dtm, seed_id,
             existing_pi_id, pre_existing) in ROUND2_CROPS:
            key = (plant_id, variety)
            per_cell = SFG_PER_CELL.get(plant_id, 1)
            plant_qty = (cells_target * per_cell) if cells_target is not None else 0

            if existing_pi_id is not None:
                # Reuse existing plan item by ID
                pi = GardenPlanItem.query.get(existing_pi_id)
                if pi is None:
                    print(f"  ERROR   {plant_id:15s} {variety:25s} -- "
                          f"plan item #{existing_pi_id} not found!")
                    continue
                plan_items[key] = pi
                plan_reused += 1
                print(f"  REUSE   {plant_id:15s} {variety:25s}  "
                      f"plan item #{pi.id} (qty={pi.target_value})")
            else:
                # NEW plan item — check if already created by a previous run
                found = find_existing_new_plan_item(plant_id, variety, pdate)
                if found:
                    plan_items[key] = found
                    plan_reused += 1
                    print(f"  REUSE   {plant_id:15s} {variety:25s}  "
                          f"plan item #{found.id} (already created)")
                else:
                    pi = create_plan_item(plant_id, variety, plant_qty,
                                          pdate, dtm, seed_id)
                    if not DRY_RUN:
                        db.session.add(pi)
                        db.session.flush()  # Get ID for Phase 2 linking
                    plan_items[key] = pi
                    plan_added += 1
                    print(f"  ADD     {plant_id:15s} {variety:25s}  "
                          f"qty={plant_qty:5d}  plant={pdate}")

        print(f"\n  Plan items: {plan_added} added, {plan_reused} reused")

        # -- Phase 2: Place on grid (PlantedItem + PlantingEvent) -------------
        print(f"\n--- Phase 2: Grid Placement (SFG packing) ---")
        cell_intervals = build_cell_occupancy()
        total_placed = 0
        total_plants = 0
        total_short = 0

        for (plant_id, variety, cells_target, pdate, dtm, seed_id,
             existing_pi_id, pre_existing) in ROUND2_CROPS:
            key = (plant_id, variety)
            pi = plan_items.get(key)
            if pi is None:
                print(f"  SKIP    {plant_id:15s} {variety:25s} -- no plan item")
                continue

            per_cell = SFG_PER_CELL.get(plant_id, 1)
            is_fill = cells_target is None

            # -- Idempotency check --
            # Count early-spring items (planted before Apr 1) for this crop
            already = PlantedItem.query.filter(
                PlantedItem.garden_bed_id == BED_ID,
                PlantedItem.plant_id == plant_id,
                PlantedItem.variety == variety,
                PlantedItem.planted_date < EARLY_CUTOFF_DT,
            ).count()

            if is_fill:
                # Fill mode: if more than pre_existing, round 2 already ran
                if already > pre_existing:
                    print(f"  SKIP    {plant_id:15s} {variety:25s} -- "
                          f"{already} early items (> {pre_existing} pre-existing)")
                    continue
            else:
                # Fixed target: skip if already >= pre_existing + round 2 target
                target_total = pre_existing + cells_target
                if already >= target_total:
                    print(f"  SKIP    {plant_id:15s} {variety:25s} -- "
                          f"{already} early items (>= {target_total} target)")
                    continue

            plant_date_dt = datetime(pdate.year, pdate.month, pdate.day)
            harvest_dt = plant_date_dt + timedelta(days=dtm)

            # Safety check: hard reject if harvest >= May 30
            if harvest_dt >= HARVEST_HARD:
                print(f"  REJECT  {plant_id:15s} {variety:25s} -- "
                      f"harvest {harvest_dt.strftime('%b %d')} >= May 30!")
                continue

            # Determine cells needed
            if is_fill:
                cells_needed = COLS * ROWS  # find_cells returns only available
            else:
                cells_needed = cells_target

            available = find_cells(cell_intervals, plant_date_dt, harvest_dt,
                                   cells_needed)

            if not is_fill and len(available) < cells_needed:
                shortfall = cells_needed - len(available)
                print(f"  WARN    {plant_id:15s} {variety:25s} -- "
                      f"need {cells_needed}, only {len(available)} available "
                      f"(short {shortfall})")
                total_short += shortfall

            placed = 0
            plant_count = 0
            cells_to_use = available if is_fill else available[:cells_needed]
            for x, y in cells_to_use:
                create_pair(pi, x, y, per_cell, plant_date_dt, harvest_dt)
                # Record new occupancy for subsequent crops
                ckey = (x, y)
                if ckey not in cell_intervals:
                    cell_intervals[ckey] = []
                cell_intervals[ckey].append((plant_date_dt, harvest_dt))
                placed += 1
                plant_count += per_cell

            total_placed += placed
            total_plants += plant_count

            harvest_warn = " [late]" if harvest_dt >= HARVEST_WARN else ""
            if is_fill:
                qty_label = f"{plant_count:5d} plants"
            else:
                qty_label = (f"{plant_count:5d}/{cells_target * per_cell:5d} "
                             f"plants")
            print(f"  PLACE   {plant_id:15s} {variety:25s}  {placed:4d} cells  "
                  f"{qty_label}  ({per_cell}/cell)  "
                  f"harvest={harvest_dt.strftime('%b %d')}{harvest_warn}")

        # -- Summary ----------------------------------------------------------
        print(f"\n{'=' * 72}")
        print(f"  TOTAL: {total_placed} cells placed, {total_plants} plants, "
              f"{total_short} cells short")
        print(f"  Creates: {plan_added} GardenPlanItems + "
              f"{total_placed} PlantedItems + {total_placed} PlantingEvents")
        expected_total = existing_planted + total_placed
        print(f"  Expected bed total: {existing_planted} existing + "
              f"{total_placed} new = {expected_total}")
        print(f"  Occupancy: {expected_total} / {COLS * ROWS} "
              f"= {100 * expected_total / (COLS * ROWS):.0f}%")
        print(f"{'=' * 72}")

        if not DRY_RUN:
            db.session.commit()
            print("\nCommitted to database.")

            # Verification
            count = PlantedItem.query.filter_by(garden_bed_id=BED_ID).count()
            print(f"\nVerification: Bed {BED_ID} now has {count} PlantedItems total")

            early = PlantedItem.query.filter(
                PlantedItem.garden_bed_id == BED_ID,
                PlantedItem.planted_date < EARLY_CUTOFF_DT
            ).count()
            print(f"  Early spring items (before Apr 1): {early}")
        else:
            print("\nDry run -- no changes written. Run with --commit to write.")


if __name__ == '__main__':
    main()
