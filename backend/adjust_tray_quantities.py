#!/usr/bin/env python3
"""
Adjust per-succession quantities to fill 12-cell seed starting trays.

For Plan 44 lettuce (lettuce-1), bumps per-succession quantity from current
(5-6) to 12 to match 12-cell seed starting trays.

Updates both GardenPlanItem (season plan row) and linked PlantingEvents
(exported calendar events).

Usage:
  python adjust_tray_quantities.py            # Dry run (no changes)
  python adjust_tray_quantities.py --commit   # Apply changes
"""

import json
import math
import sys
from app import app, db
from models import PlantingEvent, GardenPlanItem, SeedInventory
from plant_database import get_plant_by_id
from sfg_spacing import get_sfg_cells_required

PLAN_ID = 44
USER_ID = 59
TRAY_SIZE = 12  # cells per tray
AUTO_BUMP_PLANT_IDS = {'lettuce-1'}  # Only auto-bump these


def get_germination_rate(plant):
    """Get germination rate for a plant (0.0-1.0)."""
    if plant.get('germination_rate'):
        return plant['germination_rate'] / 100.0
    return 0.85


def get_survival_rate(plant):
    """Get survival rate for SFG planning (0.0-1.0)."""
    return 0.90  # Standard SFG survival rate


def calculate_seeds_needed(target_plants, germination_rate, survival_rate):
    """Calculate total seeds needed with 15% safety buffer."""
    if target_plants == 0:
        return 0
    safety_buffer = 1.15
    return math.ceil(target_plants / (germination_rate * survival_rate) * safety_buffer)


def get_linked_events(plan_item_id):
    """Find PlantingEvents linked to a GardenPlanItem via export_key prefix."""
    events = PlantingEvent.query.filter(
        PlantingEvent.user_id == USER_ID,
        PlantingEvent.event_type == 'planting',
        PlantingEvent.export_key.like(f"{plan_item_id}_%"),
    ).all()
    return events


def adjust_tray_quantities(commit=False):
    # 1. Get all GardenPlanItems for Plan 44
    plan_items = GardenPlanItem.query.filter_by(garden_plan_id=PLAN_ID).all()
    print(f"=== Tray Quantity Adjustment - Plan {PLAN_ID} ===\n")
    print(f"Found {len(plan_items)} plan items")
    print(f"Tray size: {TRAY_SIZE} cells\n")

    auto_bump_items = []
    other_small_items = []

    for item in plan_items:
        plant = get_plant_by_id(item.plant_id)
        if not plant:
            continue

        succ_count = item.succession_count or 1
        total_qty = int(item.target_value or item.plant_equivalent or 0)
        per_succ = total_qty // succ_count if succ_count > 0 else total_qty

        if per_succ >= TRAY_SIZE:
            continue  # Already at or above tray size

        if item.plant_id in AUTO_BUMP_PLANT_IDS:
            auto_bump_items.append((item, plant, succ_count, per_succ, total_qty))
        else:
            other_small_items.append((item, plant, succ_count, per_succ, total_qty))

    # 2. Process auto-bump items (lettuce-1)
    if auto_bump_items:
        print(f"--- Auto-bumping to {TRAY_SIZE}/succession ---\n")

    changes = []
    for item, plant, succ_count, old_per_succ, old_total in auto_bump_items:
        new_total = TRAY_SIZE * succ_count
        cells_per_plant = get_sfg_cells_required(item.plant_id)
        new_cells = math.ceil(new_total * cells_per_plant)

        germ_rate = get_germination_rate(plant)
        surv_rate = get_survival_rate(plant)
        new_seeds = calculate_seeds_needed(new_total, germ_rate, surv_rate)

        # Seed packets
        seed = None
        seeds_per_packet = 50
        if item.seed_inventory_id:
            seed = SeedInventory.query.get(item.seed_inventory_id)
            if seed and seed.seeds_per_packet:
                seeds_per_packet = seed.seeds_per_packet
        new_packets = math.ceil(new_seeds / seeds_per_packet)

        # Linked PlantingEvents
        events = get_linked_events(item.id)

        # Parse bed_assignments
        old_bed_assignments = None
        new_bed_assignments = None
        if item.bed_assignments:
            try:
                old_bed_assignments = json.loads(item.bed_assignments)
                # Scale proportionally: each bed gets new_total distributed by old ratio
                new_bed_assignments = []
                for ba in old_bed_assignments:
                    old_ba_qty = ba.get('quantity', 0)
                    if old_total > 0:
                        ratio = old_ba_qty / old_total
                    else:
                        ratio = 1.0 / len(old_bed_assignments)
                    new_ba_qty = round(new_total * ratio)
                    new_bed_assignments.append({
                        'bedId': ba['bedId'],
                        'quantity': new_ba_qty,
                    })
                # Ensure sum matches new_total (fix rounding)
                diff = new_total - sum(ba['quantity'] for ba in new_bed_assignments)
                if diff != 0 and new_bed_assignments:
                    new_bed_assignments[0]['quantity'] += diff
            except (json.JSONDecodeError, KeyError, TypeError):
                pass

        print(f"  {item.plant_id}: {item.variety or '(no variety)'} (GardenPlanItem {item.id})")
        print(f"    {succ_count} successions x {old_per_succ}/succ = {old_total} total"
              f" -> {succ_count} x {TRAY_SIZE} = {new_total} total")
        print(f"    PlantingEvents: {len(events)} events, qty {old_per_succ}->{TRAY_SIZE} each")
        print(f"    Cells: {item.space_required_cells or '?'} -> {new_cells}")
        print(f"    Seeds: {item.seeds_required or '?'} -> {new_seeds}"
              f"  (germ={germ_rate:.0%}, surv={surv_rate:.0%})")
        print(f"    Packets: {item.seed_packets_required or '?'} -> {new_packets}"
              f"  ({seeds_per_packet} seeds/pkt)")
        if old_bed_assignments and new_bed_assignments:
            for old_ba, new_ba in zip(old_bed_assignments, new_bed_assignments):
                print(f"    Bed {old_ba['bedId']}: {old_ba.get('quantity', '?')}"
                      f" -> {new_ba['quantity']} plants")
        print()

        changes.append({
            'item': item,
            'events': events,
            'new_total': new_total,
            'new_cells': new_cells,
            'new_seeds': new_seeds,
            'new_packets': new_packets,
            'new_bed_assignments': new_bed_assignments,
        })

    # 3. Show other crops with <12/succession (not auto-bumped)
    if other_small_items:
        print(f"--- Other crops with <{TRAY_SIZE}/succession (NOT auto-bumped) ---\n")
        for item, plant, succ_count, per_succ, total_qty in other_small_items:
            print(f"  {item.plant_id} {item.variety or ''}: "
                  f"{succ_count} succ x {per_succ} = {total_qty} total")
        print()

    # 4. Summary
    total_items = len(changes)
    total_events = sum(len(c['events']) for c in changes)
    print(f"{'='*60}")
    print(f"Summary: {total_items} plan items, {total_events} PlantingEvents to update")

    if not changes:
        print("Nothing to update.")
        return

    if not commit:
        print(f"\n*** DRY RUN — run with --commit to apply changes ***")
        return

    # 5. Apply changes
    for change in changes:
        item = change['item']
        item.target_value = change['new_total']
        item.plant_equivalent = change['new_total']
        item.seeds_required = change['new_seeds']
        item.seed_packets_required = change['new_packets']
        item.space_required_cells = change['new_cells']

        if change['new_bed_assignments'] is not None:
            item.bed_assignments = json.dumps(change['new_bed_assignments'])

        # Update linked PlantingEvents
        for ev in change['events']:
            ev.quantity = TRAY_SIZE

    db.session.commit()
    print(f"\nCommitted: {total_items} GardenPlanItems + {total_events} PlantingEvents updated.")


if __name__ == '__main__':
    commit_flag = '--commit' in sys.argv
    with app.app_context():
        adjust_tray_quantities(commit=commit_flag)
