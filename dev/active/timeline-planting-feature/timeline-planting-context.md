# Timeline Planting Feature - Context and Decisions

**Last Updated**: 2025-11-18

## Key Files and Locations

### Backend Files
- `C:\Users\march\Downloads\homesteader\homestead-planner\backend\models.py`
  - Lines 62-91: PlantingEvent model
  - Lines 34-60: PlantedItem model (spatial layout, separate from timeline)

- `C:\Users\march\Downloads\homesteader\homestead-planner\backend\app.py`
  - Lines 415-453: `/api/planting-events` endpoint

- `C:\Users\march\Downloads\homesteader\homestead-planner\backend\plant_database.py`
  - 86 plants with daysToMaturity data

### Frontend Files
- `C:\Users\march\Downloads\homesteader\homestead-planner\frontend\src\components\PlantingCalendar\index.tsx`
  - Main planting calendar component (List + Grid views)

- `C:\Users\march\Downloads\homesteader\homestead-planner\frontend\src\components\PlantingCalendar\AddCropModal\index.tsx`
  - Modal for creating planting events
  - Lines 245-280: Succession planting logic

- `C:\Users\march\Downloads\homesteader\homestead-planner\frontend\src\components\PlantingCalendar\utils\dateCalculations.ts`
  - `calculatePlantingDates()` function - calculates seed/transplant/harvest dates

- `C:\Users\march\Downloads\homesteader\homestead-planner\frontend\src\types.ts`
  - Lines 76-91: PlantingCalendar type definition

## Existing Features We're Building On

### PlantingEvent Data Model
Already includes all dates needed:
- `seed_start_date` - When to start seeds indoors
- `transplant_date` - When to transplant to garden
- `direct_seed_date` - Or when to direct seed
- `expected_harvest_date` - Calculated: plant_date + daysToMaturity

### Succession Planting Support
Already works (bug fixed recently):
- User enables succession in modal
- Sets interval (e.g., 14 days) and count (e.g., 7 plantings)
- Frontend creates N events with offset dates
- **GAP**: Events are independent (no grouping)

### Date Calculation Logic
Function `calculatePlantingDates(plant, baseDate)`:
- Takes plant data + target harvest date
- Calculates backward: harvest → transplant → seed start
- Returns all three dates
- **Works perfectly** - we'll reuse this

## Design Decisions

### Decision 1: Add succession_group_id vs Separate Table

**Considered**:
- Option A: Add field to PlantingEvent
- Option B: Create SuccessionGroup table with foreign keys

**Chose Option A** because:
- Simpler migration
- No joins needed for queries
- Easy to implement
- Can always normalize later if needed

### Decision 2: Timeline UI Pattern

**Considered**:
- Option A: Horizontal Gantt (months as columns)
- Option B: Vertical timeline feed (Instagram style)
- Option C: Calendar grid with bars overlay

**Chose Option A** because:
- Industry standard for project planning
- Clear duration visualization
- Easy to scan across time
- Works well on desktop (primary use case)

### Decision 3: Position Tracking in Phase 1?

**Considered**:
- Option A: Add position fields now
- Option B: Add in Phase 2 based on need

**Chose Option B** because:
- Phase 1 MVP doesn't require space tracking
- Not all users use GardenDesigner spatial layout
- Keep initial implementation simple
- Can add later if users request conflict detection

### Decision 4: Date Range Query Implementation

**Considered**:
- Option A: Filter in Python (get all, filter after)
- Option B: SQL query with date range WHERE clause

**Chose Option B** because:
- Performance: Only fetch needed events
- Scalability: Works with 1000+ events
- Standard practice
- Easy to implement with SQLAlchemy

### Decision 5: Color Coding

**Options**:
- By plant type (vegetable/herb/fruit/nut)
- By garden bed
- By status (planned/seeded/harvested)
- User customizable

**Chose plant type** because:
- Most visually distinct
- Helps scan timeline quickly
- Aligns with plant database categories
- Status already shown in list view

## Technical Patterns Established

### UUID Generation for Groups
```typescript
const successionGroupId = crypto.randomUUID();
// Or fallback: `${Date.now()}-${Math.random()}`
```

### Date Range Query Pattern
```python
# Backend
start_date = request.args.get('start_date')
end_date = request.args.get('end_date')

query = PlantingEvent.query
if start_date:
    query = query.filter(
        (PlantingEvent.seed_start_date >= start_date) |
        (PlantingEvent.transplant_date >= start_date) |
        (PlantingEvent.expected_harvest_date >= start_date)
    )
# Similar for end_date
```

### Timeline Bar Positioning
```typescript
// Calculate bar position and width based on dates
const monthWidth = 120; // pixels per month
const startOffset = differenceInDays(event.plantDate, timelineStart);
const duration = differenceInDays(event.harvestDate, event.plantDate);
const barLeft = (startOffset / 30) * monthWidth;
const barWidth = (duration / 30) * monthWidth;
```

## Dependencies

### Existing Libraries (Already Installed)
- `date-fns` - Date manipulation (addDays, format, etc.)
- `react` - Component framework
- `tailwindcss` - Styling

### No New Dependencies Needed
All functionality can be built with existing tools.

## Data Flow

### Loading Timeline View
1. User clicks "Timeline" view button
2. Component calculates visible date range (e.g., current month ± 3 months)
3. Fetches: `GET /api/planting-events?start_date=2025-08-01&end_date=2025-11-30`
4. Backend returns filtered events
5. Frontend renders bars positioned by date

### Creating Succession Planting
1. User opens AddCropModal
2. Enables succession, sets interval=14 days, count=7
3. Generate `successionGroupId = crypto.randomUUID()`
4. Create 7 events with offset dates, all with same group ID
5. Save batch with `Promise.all()`
6. Timeline auto-refreshes, shows grouped events

## Integration Points

### With Existing PlantingCalendar
- Timeline is third view mode (List / Grid / Timeline)
- Shares same data source (PlantingEvent API)
- Uses same AddCropModal for creating events
- Can switch between views seamlessly

### With GardenDesigner (Future Phase 2)
- GardenDesigner uses PlantedItem model (has position)
- PlantingCalendar uses PlantingEvent model (has dates)
- Phase 2: Add position to PlantingEvent to unify
- Enable: "Click timeline event → show on garden bed"

## Performance Considerations

### Expected Load
- Typical user: 50-200 events per year
- Power user: 500+ events
- Timeline shows: 3-6 month window = 50-150 events visible

### Optimization Strategies
- Date-range filtering (only load visible months)
- React.memo() on TimelineBar component
- Virtual scrolling if >100 events visible
- Debounce month navigation

## Testing Strategy

### Unit Tests (Future)
- Date calculation utils
- Bar positioning logic
- Group ID generation

### Integration Tests
- Create event via modal → appears in timeline
- Navigate months → correct events shown
- Succession planting → events grouped

### Manual Testing
- Load with existing data (backward compatibility)
- Create new events from timeline
- Test with various DTM values (30 days - 365 days)
- Mobile responsive (stretch goal)

## Known Limitations

### Phase 1 Limitations
- No space conflict detection
- No position tracking
- No drag-to-change-dates (future enhancement)
- No automatic succession interval suggestions

### Intentional Simplifications
- Timeline shows expected_harvest_date (not actual)
- No weather integration
- No companion planting overlay
- Desktop-first design

## Phase 2 Design Decisions

### Decision 6: Position Selector Component Architecture

**Considered**:
- Option A: Full GardenDesigner integration (reuse entire component)
- Option B: Standalone mini grid (SVG visualization only)
- Option C: Text-based position entry (grid coordinates like "A1, B2")

**Chose Option B** because:
- Lightweight: Only renders what's needed for position selection
- Reusable: Follows GardenDesigner SVG patterns but independent
- Visual: Users can see the grid and occupied cells
- Fast: No need to load full GardenDesigner state
- Flexible: Can be used in other modals if needed

### Decision 7: Conflict Detection Timing

**Considered**:
- Option A: Check on submit only
- Option B: Check immediately on position click
- Option C: Debounced check (500ms delay)

**Chose Option C** because:
- Real-time feedback without excessive API calls
- 500ms debounce prevents API spam while user explores positions
- Provides visual warning before submission
- Allows user to correct position before proceeding

### Decision 8: Conflict Override Workflow

**Considered**:
- Option A: Block submission entirely (no override)
- Option B: Allow override with warning modal
- Option C: Silent override with checkbox

**Chose Option B** because:
- Educates users about conflicts (modal explains the issue)
- Provides escape hatch for experienced users (succession planting, early harvest)
- Tracks override in database (conflictOverride field)
- Maintains data integrity while allowing flexibility

### Decision 9: Position Optional vs Required

**Considered**:
- Option A: Position required when garden bed selected
- Option B: Position always optional ("Skip Position" button)
- Option C: Position required for new events, optional for existing

**Chose Option B** because:
- Users may want timeline tracking without spatial layout
- Not all users use GardenDesigner
- Succession plantings can be planned without exact positions
- Backward compatible (existing events have no position)

### Decision 10: Grid Size Handling

**Considered**:
- Option A: Fetch gridSize from garden bed API
- Option B: Default to 12" (square foot gardening)
- Option C: Let user configure grid size in modal

**Chose Option B** because:
- Current garden beds may not have gridSize field
- 12" is industry standard (square foot gardening)
- Simplifies initial implementation
- Can be enhanced later if users request custom grid sizes

## Technical Patterns Established (Phase 2)

### Conflict Detection API Pattern
```typescript
const response = await fetch(`${API_BASE_URL}/api/planting-events/check-conflict`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    gardenBedId,
    positionX,
    positionY,
    startDate,
    endDate,
    plantId,
    excludeEventId // Optional: for editing existing events
  })
});

const result: ConflictCheck = await response.json();
// { hasConflict: boolean, conflicts: Conflict[] }
```

### Position Selector Integration Pattern
```typescript
// AddCropModal integration
{gardenBedId && selectedPlant && dates && (
  <PositionSelector
    gardenBed={bed} // Must have id, name, width, length, gridSize
    selectedPlant={plant}
    startDate={plantDate}
    endDate={harvestDate}
    onPositionSelect={(pos) => setSelectedPosition(pos)}
    onConflictDetected={(conflicts) => handleConflicts(conflicts)}
  />
)}
```

### Conflict Override Workflow Pattern
```typescript
// State management
const [conflictOverride, setConflictOverride] = useState(false);
const [showConflictWarning, setShowConflictWarning] = useState(false);

// On conflict detected
if (conflicts.hasConflict && !conflictOverride) {
  setShowConflictWarning(true);
}

// On override
const handleOverride = () => {
  setConflictOverride(true);
  setShowConflictWarning(false);
  // Proceed with submission
};
```

## Integration Points (Phase 2 Extensions)

### With PlantingEvent API
- POST /api/planting-events now accepts: positionX, positionY, spaceRequired, conflictOverride
- GET /api/planting-events filters by date range to fetch occupied cells
- Backend validates position data and stores in database

### With GardenDesigner
- Shared SVG grid rendering patterns (40px cell size, grid lines, cell labels)
- Shared plant icon emoji system
- Shared position data model (x, y grid coordinates)
- Future: Click event in timeline → highlight in GardenDesigner

### With Timeline View
- Position data enables timeline conflict indicators (Phase 2C)
- Events with positions can show spatial context
- Future: "Show available spaces" feature can use position data

## Performance Considerations (Phase 2)

### Position Selector Performance
- Debounced conflict checking (500ms) reduces API load
- Only fetches events for selected garden bed + date range
- SVG grid rendering optimized (no virtual scrolling needed for typical 4x8 beds)
- Expected cell count: 48 cells for 4'x8' bed with 12" grid

### API Optimization
- Backend filters events in SQL before conflict checking
- Only checks events with position data (position_x IS NOT NULL)
- Spatial overlap uses Chebyshev distance (efficient for grid-based layouts)
- Typical conflict check: <100ms for 50 events

## Future Enhancements (Post-Phase 2B)

### Phase 2C: Timeline Integration
- Visual conflict indicators on timeline bars
- Click timeline event → highlight position on grid
- "Show available spaces on date X" feature
- Timeline view shows spatial density

### User-Requested Features to Consider
- Drag event to change dates (maintains position)
- Automatic position suggestion (finds first available space)
- Multi-select for bulk positioning
- Position history/undo

### Technical Improvements
- WebSocket live updates for multi-user conflict detection
- Virtual scrolling for large garden beds (>100 cells)
- Mobile-optimized position selector (touch-friendly)
- Dark mode for timeline

---

**Key Insight**: Phase 2B successfully bridges timeline planning and spatial layout. Position selection is optional but provides powerful conflict detection when used.
