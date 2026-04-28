# Garden Designer Expert - Frontend Agent Memory

## TypeScript Gotchas
- `[...new Set(arr)]` fails with TS error about `--downlevelIteration`. Use `Array.from(new Set(arr))` instead.

## @dnd-kit Drag Prevention Pattern
- To add clickable buttons inside a draggable item: use `onPointerDown` with `e.stopPropagation()` + `e.preventDefault()`.
- Also add `onClick={(e) => e.stopPropagation()}` as a fallback.
- This prevents @dnd-kit from capturing the pointer event as a drag start.

## PlannedPlantsSection Data Sources
- `PlannedBedItem`: API endpoint `GET /api/garden-plans/:planId/beds/:bedId/items`
- `futurePlantingEvents`: PlantingEvent[] from GardenDesigner parent (fetched via `/api/planting-events`)
- `activePlantedItems`: PlantedItem[] from `getActivePlantedItems(activeBed)` in GardenDesigner
- PlantedItem.sourcePlanItemId links to GardenPlanItem
- PlantingEvent has NO sourcePlanItemId -- match by plantId + variety + bedId + date proximity
