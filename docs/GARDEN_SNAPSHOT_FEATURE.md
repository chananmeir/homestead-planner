# Garden Snapshot Feature

> Point-in-time inventory view showing what's physically in the ground on any date.

## Overview

The Garden Snapshot provides a date-selectable view of all active plants across all garden beds. It answers the question: "What do I have growing on date X?"

A plant is considered "active" on a given date if:
- `planted_date <= target_date` (already planted)
- `harvest_date IS NULL OR harvest_date >= target_date` (not yet harvested)

## Access

Navigate to **Garden Season Planner** and click the **Garden Snapshot** button in the plan list header.

## UI Components

### Date Picker
- Defaults to today's date
- Auto-fetches data on change

### Summary Cards (3-card grid)
- **Total Plants** - Sum of all active plant quantities
- **Unique Varieties** - Count of distinct plant_id::variety combinations
- **Beds with Plants** - Count of beds containing at least one active plant

### Plant Table
- Columns: Plant Name, Variety, Count, Beds
- Sorted by total quantity (descending)
- Click any row to expand/collapse per-bed breakdown
- Expanded rows show bed name + quantity per bed

### Empty State
Displays "No plants are active on this date" when no PlantedItems match.

## API Endpoint

`GET /api/garden-planner/garden-snapshot?date=YYYY-MM-DD`

### Parameters
| Param | Required | Format | Description |
|-------|----------|--------|-------------|
| `date` | Yes | `YYYY-MM-DD` | Target snapshot date |

### Response
```json
{
  "date": "2026-06-15",
  "summary": {
    "totalPlants": 142,
    "uniqueVarieties": 24,
    "bedsWithPlants": 6
  },
  "byPlant": {
    "tomato-1::Brandywine": {
      "plantId": "tomato-1",
      "plantName": "Tomato",
      "variety": "Brandywine",
      "totalQuantity": 12,
      "beds": [
        { "bedId": 1, "bedName": "Raised Bed A", "quantity": 8 },
        { "bedId": 3, "bedName": "Raised Bed C", "quantity": 4 }
      ]
    }
  }
}
```

## Files

| File | Role |
|------|------|
| `backend/blueprints/garden_planner_bp.py` | `api_garden_snapshot()` endpoint |
| `frontend/src/types.ts` | `GardenSnapshotResponse`, `GardenSnapshotPlantEntry`, `GardenSnapshotBedDetail` |
| `frontend/src/components/GardenPlanner/GardenSnapshot.tsx` | Snapshot UI component |
| `frontend/src/components/GardenPlanner.tsx` | View state integration (`'snapshot'` view) |

## Data Source

Uses **PlantedItem** records (physically placed plants on the grid), not GardenPlanItem or PlantingEvent. This reflects what's actually in the ground, not what's planned.

## Date: 2026-02-06
