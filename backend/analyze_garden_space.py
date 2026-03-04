"""
Analyze garden space availability over time.

Pulls live data from the database and plant_database.py, then calculates
which beds have free space on which dates across the growing season.

Usage:
    cd backend
    python analyze_garden_space.py                          # default user (marcsiegel)
    python analyze_garden_space.py --user marcsiegel        # by username
    python analyze_garden_space.py --user-id 59             # by user id
    python analyze_garden_space.py --year 2027              # different year
    python analyze_garden_space.py --start 2026-06-01       # custom date range
    python analyze_garden_space.py --end 2026-09-01
"""
import argparse
import json
import math
import sqlite3
import sys
from datetime import date, timedelta
from collections import defaultdict
from pathlib import Path

# ---------------------------------------------------------------------------
# Resolve project paths
# ---------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent
DB_PATH = BACKEND_DIR / "instance" / "homestead.db"

# Import plant data from the project
sys.path.insert(0, str(BACKEND_DIR))
from plant_database import PLANT_DATABASE
from sfg_spacing import get_sfg_cells_required


def get_plant_dtm(plant_id: str) -> int:
    """Look up days-to-maturity from PLANT_DATABASE."""
    for p in PLANT_DATABASE:
        if p["id"] == plant_id:
            return p.get("days_to_maturity") or p.get("daysToMaturity") or 60
    return 60  # fallback


def get_cells_per_plant(plant_id: str) -> float:
    """Look up SFG cells required per plant."""
    return get_sfg_cells_required(plant_id)


def load_data(db_path: str, user_id: int = None, username: str = None, year: int = 2026):
    """Load beds and plan items from the database for a given user."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    # Resolve user
    if user_id is None and username:
        c.execute("SELECT id FROM users WHERE username = ?", (username,))
        row = c.fetchone()
        if not row:
            print(f"ERROR: User '{username}' not found.")
            sys.exit(1)
        user_id = row["id"]
    elif user_id is None:
        # Default: find user with the most plan items
        c.execute("""
            SELECT gp.user_id, u.username, COUNT(gpi.id) as cnt
            FROM garden_plan gp
            JOIN garden_plan_item gpi ON gpi.garden_plan_id = gp.id
            LEFT JOIN users u ON u.id = gp.user_id
            GROUP BY gp.user_id
            ORDER BY cnt DESC LIMIT 1
        """)
        row = c.fetchone()
        if not row:
            print("ERROR: No garden plans found in database.")
            sys.exit(1)
        user_id = row["user_id"]
        print(f"Auto-selected user: {row['username']} (id={user_id}, {row['cnt']} plan items)")

    # Load beds
    c.execute("""
        SELECT id, name, width, length, grid_size, planning_method
        FROM garden_bed WHERE user_id = ? ORDER BY id
    """, (user_id,))
    beds = {}
    for row in c.fetchall():
        gs_ft = (row["grid_size"] or 12) / 12.0
        cols = int(row["width"] / gs_ft) if row["width"] else 0
        rows = int(row["length"] / gs_ft) if row["length"] else 0
        beds[row["id"]] = {
            "name": row["name"],
            "cells": cols * rows,
            "method": row["planning_method"] or "unknown",
            "width": row["width"],
            "length": row["length"],
        }

    # Load plan items
    c.execute("""
        SELECT gpi.id, gpi.plant_id, gpi.variety, gpi.plant_equivalent,
               gpi.first_plant_date, gpi.succession_count, gpi.succession_interval_days,
               gpi.bed_assignments
        FROM garden_plan_item gpi
        JOIN garden_plan gp ON gpi.garden_plan_id = gp.id
        WHERE gp.user_id = ? AND gp.year = ?
        ORDER BY gpi.first_plant_date
    """, (user_id, year))

    plan_items = []
    for row in c.fetchall():
        ba = []
        if row["bed_assignments"]:
            try:
                ba = json.loads(row["bed_assignments"])
            except (json.JSONDecodeError, TypeError):
                pass
        plan_items.append({
            "id": row["id"],
            "plant_id": row["plant_id"],
            "variety": row["variety"],
            "total_qty": row["plant_equivalent"],
            "first_plant_date": row["first_plant_date"],
            "succession_count": row["succession_count"] or 1,
            "succession_interval_days": row["succession_interval_days"] or 0,
            "bed_assignments": ba,
        })

    conn.close()
    return user_id, beds, plan_items


def expand_successions(plan_items):
    """Expand plan items with successions into individual planting events."""
    events = []
    for item in plan_items:
        if not item["first_plant_date"]:
            continue

        fpd = date.fromisoformat(str(item["first_plant_date"]))
        plant_id = item["plant_id"]
        dtm_days = get_plant_dtm(plant_id)
        cells_per = get_cells_per_plant(plant_id)
        sc = max(item["succession_count"], 1)
        interval = item["succession_interval_days"]

        for assign in item["bed_assignments"]:
            bed_id = assign.get("bedId")
            bed_qty = assign.get("quantity", 0)
            if not bed_id or not bed_qty:
                continue

            for i in range(sc):
                plant_date = fpd + timedelta(days=i * interval)
                harvest_date = plant_date + timedelta(days=dtm_days)
                qty_per_succ = math.floor(bed_qty / sc)
                remainder = bed_qty - qty_per_succ * sc
                qty = qty_per_succ + (1 if i < remainder else 0)
                cells = qty * cells_per

                events.append({
                    "plant_id": plant_id,
                    "variety": item["variety"],
                    "bed_id": bed_id,
                    "plant_date": plant_date,
                    "harvest_date": harvest_date,
                    "cells": cells,
                    "qty": qty,
                })

    return events


def print_report(beds, events, start_date, end_date):
    """Print the full space availability report."""
    # Bi-weekly check dates
    check_dates = []
    d = start_date
    while d <= end_date:
        check_dates.append(d)
        d += timedelta(days=14)

    print("=" * 120)
    print(f"GARDEN SPACE AVAILABILITY ANALYSIS ({start_date} to {end_date})")
    print("=" * 120)
    print()

    # --- Section 1: Timeline per bed ---
    for bed_id in sorted(beds.keys()):
        bed = beds[bed_id]
        capacity = bed["cells"]
        if capacity == 0:
            continue
        bed_events = [e for e in events if e["bed_id"] == bed_id]

        print(f"--- {bed['name']} (Bed {bed_id}) | {capacity} cells | "
              f"{bed['width']}x{bed['length']} ft | {bed['method']} ---")

        for check_date in check_dates:
            active = [e for e in bed_events
                      if e["plant_date"] <= check_date <= e["harvest_date"]]
            used = sum(e["cells"] for e in active)
            free = capacity - used
            pct_free = (free / capacity) * 100

            bar_len = 40
            used_bars = min(int((used / capacity) * bar_len), bar_len)
            bar = "#" * used_bars + "." * (bar_len - used_bars)

            flag = ""
            if used == 0:
                flag = " <<< EMPTY"
            elif pct_free >= 80:
                flag = " <<< MOSTLY FREE"
            elif pct_free >= 50:
                flag = " << HALF FREE"
            elif pct_free >= 25:
                flag = " < SOME SPACE"
            elif free < 0:
                flag = " !!! OVERCOMMITTED"

            print(f"  {check_date} [{bar}] "
                  f"used={used:>7.1f} free={free:>7.1f} ({pct_free:>5.1f}% free){flag}")
        print()

    # --- Section 2: Windows of open space ---
    print("=" * 120)
    print("SUMMARY: WINDOWS WHERE BEDS HAVE >50% FREE SPACE")
    print("=" * 120)
    print()

    for bed_id in sorted(beds.keys()):
        bed = beds[bed_id]
        capacity = bed["cells"]
        if capacity == 0:
            continue
        bed_events = [e for e in events if e["bed_id"] == bed_id]

        d = start_date
        windows = []
        window_start = None

        while d <= end_date:
            active = [e for e in bed_events
                      if e["plant_date"] <= d <= e["harvest_date"]]
            used = sum(e["cells"] for e in active)
            pct_free = ((capacity - used) / capacity) * 100

            if pct_free >= 50:
                if window_start is None:
                    window_start = d
            else:
                if window_start is not None:
                    windows.append((window_start, d - timedelta(days=1)))
                    window_start = None
            d += timedelta(days=7)

        if window_start is not None:
            windows.append((window_start, end_date))

        if windows:
            print(f"{bed['name']} (Bed {bed_id}, {capacity} cells, {bed['method']}):")
            for ws, we in windows:
                duration = (we - ws).days
                avgs = []
                wd = ws
                while wd <= we:
                    active = [e for e in bed_events
                              if e["plant_date"] <= wd <= e["harvest_date"]]
                    used = sum(e["cells"] for e in active)
                    avgs.append(capacity - used)
                    wd += timedelta(days=7)
                avg_free = sum(avgs) / len(avgs) if avgs else 0
                print(f"  {ws} to {we} ({duration:>3d} days) "
                      f"~{avg_free:.0f} cells avg free")
            print()

    # --- Section 3: Monthly snapshots ---
    print("=" * 120)
    print("DETAILED VIEW: WHAT'S IN EACH BED ON KEY DATES")
    print("=" * 120)
    print()

    # Build monthly key dates within the range
    key_dates = []
    d = start_date.replace(day=15)
    if d < start_date:
        d = d.replace(month=d.month + 1)
    while d <= end_date:
        key_dates.append(d)
        if d.month == 12:
            d = d.replace(year=d.year + 1, month=1)
        else:
            d = d.replace(month=d.month + 1)

    for check_date in key_dates:
        print(f"=== {check_date.strftime('%B %d, %Y')} ===")
        for bed_id in sorted(beds.keys()):
            bed = beds[bed_id]
            capacity = bed["cells"]
            if capacity == 0:
                continue
            active = [e for e in events
                      if e["bed_id"] == bed_id
                      and e["plant_date"] <= check_date <= e["harvest_date"]]

            total_used = sum(e["cells"] for e in active)
            free = capacity - total_used
            pct_free = (free / capacity) * 100

            status = "EMPTY" if total_used == 0 else f"{pct_free:.0f}% free"
            line = f"  {bed['name']:20s} | {status:>10s} | "

            if active:
                plant_summary = defaultdict(float)
                for e in active:
                    name = e["plant_id"].replace("-1", "")
                    plant_summary[name] += e["cells"]
                parts = [f"{name}: {cells:.0f}c"
                         for name, cells in sorted(plant_summary.items())]
                line += ", ".join(parts)
            else:
                line += "(nothing planted)"
            print(line)
        print()


def main():
    parser = argparse.ArgumentParser(
        description="Analyze garden space availability over time")
    parser.add_argument("--user", type=str, default=None,
                        help="Username to analyze (default: user with most plans)")
    parser.add_argument("--user-id", type=int, default=None,
                        help="User ID to analyze")
    parser.add_argument("--year", type=int, default=2026,
                        help="Plan year (default: 2026)")
    parser.add_argument("--start", type=str, default=None,
                        help="Start date YYYY-MM-DD (default: March 1 of plan year)")
    parser.add_argument("--end", type=str, default=None,
                        help="End date YYYY-MM-DD (default: November 1 of plan year)")
    parser.add_argument("--db", type=str, default=str(DB_PATH),
                        help=f"Database path (default: {DB_PATH})")
    args = parser.parse_args()

    start_date = (date.fromisoformat(args.start) if args.start
                  else date(args.year, 3, 1))
    end_date = (date.fromisoformat(args.end) if args.end
                else date(args.year, 11, 1))

    print(f"Database: {args.db}")
    print(f"Year: {args.year}  |  Range: {start_date} to {end_date}")
    print()

    user_id, beds, plan_items = load_data(
        args.db, user_id=args.user_id, username=args.user, year=args.year)

    print(f"Found {len(beds)} beds, {len(plan_items)} plan items")
    print()

    events = expand_successions(plan_items)
    print(f"Expanded to {len(events)} planting events (after succession expansion)")
    print()

    print_report(beds, events, start_date, end_date)


if __name__ == "__main__":
    main()
