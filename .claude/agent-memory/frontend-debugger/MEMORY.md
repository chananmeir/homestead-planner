# Frontend Debugger - Agent Memory

## Future Plantings Overlay Data Flow
1. Frontend `fetchFuturePlantingEvents()` calls `GET /api/planting-events?start_date=TOMORROW&end_date=+1YEAR`
2. Backend filters in `gardens_bp.py`: event must have `transplant_date <= end_dt` OR `direct_seed_date <= end_dt`
3. Backend tracking-mode harvest filter: `expected_harvest_date >= start_dt` OR both harvest dates null
4. Frontend `getFuturePlantingPositions()` filters: bed match, positionX null check, event_type=planting, date > today
5. Two overlay sources: PlantingEvent positions + PlantedItem positions (future-dated items)
6. Overlay refactored (Feb 2026): shows ONLY placed PlantedItems with future plantedDate, not PlantingEvents
7. `futurePlantingEvents` state kept for PlannedPlantsSection sidebar, not used in overlay

## Common Missing-Event Causes
- **No bed assignment**: export_to_calendar without bed_allocations -> garden_bed_id=NULL -> invisible
- **No position data**: positionX=null routed to "N unplaced" badge instead
- **Quick Harvest Filter**: harvestCutoff filters events whose planting date is beyond the window
- **No in-ground date**: events with only seedStartDate (no transplant/direct_seed) excluded by backend
- **planning_mode not passed**: fetchFuturePlantingEvents does NOT pass planning_mode=true
- **Never exported**: GardenPlanItem exists in Season Plan but no PlantingEvent created

## Position Check Consistency
- `getFuturePlantingPositions`: `positionX == null` (loose equality -- correctly catches both null and undefined)
- `getUnpositionedFutureEvents`: `positionX != null` (correct)
- `getFutureEventsAtPosition`: `positionX === undefined` (strict -- potential BUG: doesn't catch null)

## TypeScript Gotchas
- `[...new Set(arr)]` fails with TS downlevelIteration error. Use `Array.from(new Set(arr))` instead.

## @dnd-kit Drag Prevention
- Clickable buttons inside draggable items: use `onPointerDown` with `e.stopPropagation()` + `e.preventDefault()` to prevent @dnd-kit from capturing as drag start.
- Also add `onClick={(e) => e.stopPropagation()}` as fallback.

## PlannedPlantsSection Data Flow
- `PlannedBedItem` from API: `GET /api/garden-plans/:planId/beds/:bedId/items`
- `futurePlantingEvents` (PlantingEvent[]) from GardenDesigner parent via props
- `activePlantedItems` (PlantedItem[]) from GardenDesigner's `getActivePlantedItems(activeBed)`
- PlantedItem has `sourcePlanItemId` to link back to GardenPlanItem
- PlantingEvent does NOT have `sourcePlanItemId` - must match by plantId + variety + bedId + date proximity

## Succession Schedule Computation
- Quantity per succession: `Math.floor(total / succCount)` with remainder to early successions
- Date matching needs tolerance (+/- 7 days) due to date rounding
- Items without `firstPlantDate` cannot have succession details computed

## PlantingEvent Creation Paths
1. Season Planner export (garden_planner_service.py export_to_calendar): sets direct_seed_date only
2. Planting Calendar AddCropModal: sets transplantDate OR directSeedDate based on method
3. GardenDesigner drag-drop creates PlantedItems, not PlantingEvents

## TZ Anti-Pattern for YYYY-MM-DD Strings
- `new Date('2026-03-23')` parses as UTC midnight -> shifts to previous civil day in western TZ when rendered with `toLocaleDateString()`.
- `someDate.toISOString().split('T')[0]` formats in UTC -> can shift forward/back a day in western TZ.
- Canonical helpers in `frontend/src/utils/dateUtils.ts`:
  - `parseLocalDate(str)` -- parses YYYY-MM-DD as local midnight (input)
  - `formatLocalDate(date)` -- formats Date to YYYY-MM-DD using local getters (output)
- Pattern: `parseLocalDate` on input, `formatLocalDate` on output. Never `new Date(str)` or `toISOString().split('T')[0]` for YYYY-MM-DD round-trips.
- Note: `GardenDesigner/utils/designerHelpers.ts` also exports a `formatLocalDate` (separate copy) -- check which is imported when debugging.

## Key File Locations
- GardenDesigner.tsx: ~3500 lines, main designer component
- FuturePlantingsOverlay.tsx: overlay renderer + helper functions
- PlannedPlantsSection.tsx: sidebar progress tracking
- footprintCalculator.ts: circular spacing buffer calculations
- SetSeedDateModal.tsx / CollectSeedsModal.tsx: seed saving UI
