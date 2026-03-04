# Garden Space Availability Analysis

Analyzes your garden plan to show **when each bed has free space** throughout the growing season. Helps identify gaps for succession planting, cover crops, or additional plantings.

---

## How to Run

```bash
cd backend
python analyze_garden_space.py
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--user USERNAME` | Analyze a specific user's garden | User with most plan items |
| `--user-id ID` | Analyze by user ID | (auto-detected) |
| `--year YYYY` | Plan year | 2026 |
| `--start YYYY-MM-DD` | Start of analysis window | March 1 of plan year |
| `--end YYYY-MM-DD` | End of analysis window | November 1 of plan year |
| `--db PATH` | Path to SQLite database | `backend/instance/homestead.db` |

### Examples

```bash
# Default: auto-detect user, 2026, March-November
python analyze_garden_space.py

# Specific user
python analyze_garden_space.py --user marcsiegel

# Different year
python analyze_garden_space.py --user marcsiegel --year 2027

# Custom date range (just summer)
python analyze_garden_space.py --start 2026-06-01 --end 2026-09-01

# Combine options
python analyze_garden_space.py --user marcsiegel --year 2026 --start 2026-05-01 --end 2026-10-01
```

### Re-running After Plan Changes

After modifying your garden plan (adding/removing plants, changing dates, adjusting bed assignments), just re-run the script. It pulls **live data** from the database and `plant_database.py` each time — nothing is hardcoded.

---

## What It Shows

The report has three sections:

### 1. Timeline Per Bed (bi-weekly snapshots)

Visual bar chart of space usage for every bed, checked every 2 weeks:

```
--- SFG Bed 1 (Bed 37) | 32 cells | 4.0x8.0 ft | square-foot ---
  2026-03-01 [........................................] used=    0.0 free=   32.0 (100.0% free) <<< EMPTY
  2026-03-15 [##############..........................] used=   11.4 free=   20.6 ( 64.5% free) << HALF FREE
  2026-04-12 [###########################.............] used=   22.0 free=   10.0 ( 31.2% free) < SOME SPACE
```

Flags:
- `<<< EMPTY` — Nothing in the bed
- `<<< MOSTLY FREE` — 80%+ free
- `<< HALF FREE` — 50-80% free
- `< SOME SPACE` — 25-50% free
- `!!! OVERCOMMITTED` — More plants than cells (plan exceeds capacity)

### 2. Summary: Windows of Open Space

Shows continuous date ranges where each bed is >50% free, with average free cells:

```
SFG Bed 1 (Bed 37, 32 cells, square-foot):
  2026-03-01 to 2026-04-04 ( 34 days) ~25 cells avg free
  2026-06-14 to 2026-11-01 (140 days) ~29 cells avg free
```

### 3. Monthly Snapshot: What's in Each Bed

On the 15th of each month, shows exactly which crops occupy each bed:

```
=== June 15, 2026 ===
  SFG Bed 1            |   62% free | beet: 4c, onion: 8c
  SFG Bed 2            |   94% free | lettuce: 2c
  SFG Bed 3            |      EMPTY | (nothing planted)
```

---

## How It Calculates Space

1. **Bed capacity** = `floor(width / grid_size) * floor(length / grid_size)` cells
2. **Cells per plant** = from `sfg_spacing.py::get_sfg_cells_required()` (e.g., tomato = 1 cell, carrot = 0.0625 cells)
3. **Days to maturity** = from `plant_database.py` (e.g., tomato = 70d, radish = 25d)
4. **Succession expansion** = if an item has 4 successions every 14 days, it creates 4 separate planting events offset by 14d each, with quantity divided evenly (remainder to early successions)
5. **Active on date X** = plant_date <= X <= plant_date + DTM
6. **Free space** = bed capacity - sum of cells for all active plants

### Data Sources

| Data | Source |
|------|--------|
| Beds (size, method) | `garden_bed` table |
| Plan items (crops, dates, quantities, bed assignments) | `garden_plan_item` table (via `garden_plan`) |
| Days to maturity | `backend/plant_database.py::PLANT_DATABASE` |
| Cells per plant | `backend/sfg_spacing.py::get_sfg_cells_required()` |

### Limitations

- Uses **plan data** (GardenPlanItem), not actual placements (PlantedItem). Shows what's *planned*, not what's actually in the ground yet.
- DTM is the generic plant default. Variety-specific DTM overrides from seed inventory are not yet incorporated.
- Does not account for trellis plantings (which use linear feet, not cells).
- Space calculation uses SFG cells-per-plant for all bed types. MIGardener and permaculture beds may pack plants more densely in practice.

---

## Latest Results (2026-03-04)

### Marc's Garden — 8 Beds, Feed Family of 8

#### Bed Inventory

| Bed | Size | Method | Cells |
|-----|------|--------|-------|
| SFG Bed 1 | 4x8 ft | square-foot | 32 |
| SFG Bed 2 | 4x8 ft | square-foot | 32 |
| SFG Bed 3 | 4x8 ft | square-foot | 32 |
| SFG Bed 4 | 4x8 ft | square-foot | 32 |
| MIG Bed 1 | 4x8 ft | migardener | 512 |
| MIG Bed 2 | 4x8 ft | migardener | 512 |
| Permaculture | 30x50 ft | permaculture | 1,500 |
| Raised Bed | 7x18 ft | raised-bed | 504 |

#### Best Windows of Open Space (>50% free)

| Bed | Window | Days | Avg Free Cells |
|-----|--------|------|----------------|
| SFG Bed 1 | Mar 1 - Apr 4 | 34 | ~25 |
| SFG Bed 1 | Jun 14 - Nov 1 | 140 | ~29 |
| SFG Bed 2 | Mar 1 - Mar 28 | 27 | ~29 |
| SFG Bed 2 | May 17 - Nov 1 | 168 | ~29 |
| SFG Bed 3 | Mar 1 - Mar 14 | 13 | ~16 |
| SFG Bed 3 | May 3 - Jul 18 | 76 | ~23 |
| SFG Bed 3 | Sep 20 - Nov 1 | 42 | ~32 |
| SFG Bed 4 | Mar 1 - Apr 4 | 34 | ~25 |
| SFG Bed 4 | Jun 14 - Nov 1 | 140 | ~28 |
| MIG Bed 1 | **All season** | 245 | ~489 |
| MIG Bed 2 | **All season** | 245 | ~498 |
| Permaculture | Mar 1 - Apr 18 | 48 | ~1,384 |
| Permaculture | Jun 14 - Jul 18 | 34 | ~853 |
| Permaculture | Jul 26 - Nov 1 | 98 | ~1,316 |
| Raised Bed | **All season** | 245 | ~492 |

#### Key Takeaways

1. **MIG Beds 1 & 2 and the Raised Bed are massively underused** — 87-100% free all season. Prime candidates for more crops.
2. **All 4 SFG beds are fully empty by mid-September** — great for fall brassicas, garlic, or cover crops.
3. **Permaculture bed peaks at ~70% used in late April-May** (onions + beets + carrots), then opens up rapidly through summer.
4. **SFG Beds 1 & 4 open up from mid-June** when onions and early brassicas finish.
5. **SFG Bed 2 opens from mid-May** — longest open window of the SFG beds.

#### Key Dates When Space Opens

| Date | Event | Space Freed |
|------|-------|-------------|
| ~Apr 10 | Radishes finish (Bed 37) | ~4 cells |
| ~Apr 30 | Peas finish (Bed 39) | 16 cells |
| ~May 14 | First spinach successions finish | Various |
| ~Jun 13 | Potatoes finish (Beds 39, 42) | 16-20 cells each |
| ~Jun 11 | Cabbage finishes (Beds 37, 40) | 8 cells each |
| ~Jul 3 | Onions finish (Beds 37, 40, 42) | 8-16 cells each |
| ~Jul 24 | Tomatoes finish (Raised Bed) | 11 cells |
| ~Aug 3 | Onions finish (Permaculture) | ~400 cells |
| ~Sep 15 | **All 4 SFG beds completely empty** | 128 cells total |
