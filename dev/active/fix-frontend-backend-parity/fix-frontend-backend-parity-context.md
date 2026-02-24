# Context: Frontend-Backend UI Parity Fix

## Key Files

### Backend (Flask)
- **C:\Users\march\Downloads\homesteader\homestead-planner\backend\app.py** - All routes and API endpoints
- **C:\Users\march\Downloads\homesteader\homestead-planner\backend\templates\base.html** - Navigation bar with all 12 features
- **C:\Users\march\Downloads\homesteader\homestead-planner\backend\templates\index.html** - Homepage with 10 feature cards

### Frontend (React)
- **C:\Users\march\Downloads\homesteader\homestead-planner\frontend\src\App.tsx** - Main app with tab navigation
- **C:\Users\march\Downloads\homesteader\homestead-planner\frontend\src\components\** - React components

### Existing Components
- GardenPlanner.tsx
- PlantingCalendar.tsx
- WinterGarden.tsx
- WeatherAlerts.tsx
- CompostTracker.tsx

## Backend API Endpoints Available

All endpoints verified in app.py:

### Garden Features
- GET/POST `/api/garden-beds`
- GET/PUT/DELETE `/api/garden-beds/<id>`
- POST `/api/planted-items`

### Property Designer
- GET/POST `/api/properties`
- GET/PUT/DELETE `/api/properties/<id>`
- POST `/api/placed-structures`
- GET `/api/structures`

### Livestock
- GET/POST `/api/chickens`
- GET/POST `/api/ducks`
- GET/POST `/api/beehives`
- GET/POST `/api/livestock`
- GET/POST `/api/egg-production`
- GET/POST `/api/health-records`

### Harvest Tracker
- GET/POST `/api/harvests`
- DELETE `/api/harvests/<id>`
- GET `/api/harvests/stats`

### Seed Inventory
- GET/POST `/api/seeds`
- PUT/DELETE `/api/seeds/<id>`

### Photos
- GET/POST `/api/photos`
- DELETE `/api/photos/<id>`

### Other
- GET `/api/plants` - Plant database
- GET/POST `/api/frost-dates`
- GET/POST `/api/planting-events`

## Architecture Decisions

1. **Keep Tab Navigation**: The React app uses tab-based navigation which is cleaner for SPA. Will add more tabs.

2. **No Home Tab**: Frontend will not have a "Home" dashboard tab. The app starts directly in Garden Planner. This is acceptable as SPA doesn't need a dashboard like server-rendered app.

3. **Progressive Enhancement**: Start with placeholder components that show basic UI, can be enhanced later with full functionality.

4. **API Backend**: All components will use the existing Flask API endpoints.

5. **TypeScript Types**: Will need to add type definitions for new data structures (Livestock, Seeds, Harvests, Photos).

## Component Implementation Order

1. **Livestock** - Most complex, has multiple animal types
2. **HarvestTracker** - Medium complexity
3. **SeedInventory** - Medium complexity
4. **PhotoGallery** - File upload complexity
5. **GardenDesigner** - Visual designer (may need canvas/drag-drop)
6. **PropertyDesigner** - Similar to GardenDesigner

## Notes

- Backend uses Bootstrap 5 for styling
- Frontend uses Tailwind CSS
- Both use similar color schemes (green theme)
- Backend has more mature features than frontend
- Frontend was likely a later addition focused on core features

## Last Updated
2025-11-11
