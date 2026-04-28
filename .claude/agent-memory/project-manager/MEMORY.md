# Project Manager Memory

## Key Architecture Patterns

### Three-Model Plant Lifecycle (Plan -> Schedule -> Place)
- **GardenPlanItem** -- season plan target (e.g., "519 carrots for Bed A")
- **PlantingEvent** -- created by "Export to Calendar"; has positions, dates, quantities
- **PlantedItem** -- created by drag-and-drop onto the grid; has `source_plan_item_id`

### Future Planting Overlay (Feb 2026 refactor)
- Overlay now shows ONLY placed PlantedItems with future `plantedDate` (not PlantingEvents)
- `getFuturePlantedItemPositions(bed)` computes grid overlay positions from bed.plantedItems
- `getFuturePlantedItems(bed)` returns the actual PlantedItem objects for popup display
- `futurePlantingEvents` state is KEPT for PlannedPlantsSection sidebar (not used in overlay)
- Popup allows editing plantedDate and deleting future PlantedItems
- FuturePlantingsOverlay.tsx is purely a renderer -- takes `positions` prop, unchanged

### Frost Date Resolution (Apr 2026)
- `frost_date_lookup.py` -- zone-to-frost-date lookup table + `get_frost_dates_for_user()`
- Priority: explicit property dates > zone lookup > hardcoded Zone 5b default
- API: `GET /api/frost-dates` returns `{lastFrostDate, firstFrostDate, source}`
- Property model has `last_frost_date` and `first_frost_date` (Date, nullable)
- Migration: `256f54bf5501` adds the two columns

## Build & Verification
- Frontend build: `cd /c/homesteader/homestead-planner/frontend && npm run build`
- Use Unix paths with `/c/` prefix on Windows Git Bash
- Build has pre-existing lint warnings (unused vars, missing deps) -- these are not blockers
- Backend tests: 5 pre-existing failures in test_geocoding_service.py (network-dependent)

## File Locations
- GardenDesigner.tsx: ~3500 lines, main designer component
- FuturePlantingsOverlay.tsx: overlay renderer + helper functions
- PlannedPlantsSection.tsx: sidebar progress tracking
- Backend planted items API: PUT /api/planted-items/:id accepts plantedDate field

## Blueprint Registration
- All blueprints registered in `backend/blueprints/__init__.py`
- properties_bp uses url_prefix='/api' -- routes like `/api/frost-dates`
- Several blueprint files are untracked (new, not yet committed): properties_bp, pages_bp, etc.
