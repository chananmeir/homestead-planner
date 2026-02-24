# Enhanced Planting Calendar - Context & Key Decisions

**Created:** 2025-11-12
**Last Updated:** 2025-11-12

---

## Project Context

This document contains key context, files, decisions, and important information for the Enhanced Planting Calendar project. Use this as a reference while implementing.

---

## Key Files & Their Roles

### Frontend

**Current Implementation:**
- `frontend/src/components/PlantingCalendar.tsx` (348 lines)
  - Current list-based planting calendar
  - Contains smart auto-calculation logic (**PRESERVE THIS!**)
  - Will be refactored into `PlantingCalendar/ListView/index.tsx`

**New Structure (Phase 1):**
```
frontend/src/components/PlantingCalendar/
├── index.tsx                    # Main container component
├── CalendarGrid/
│   ├── index.tsx               # Month/year grid view
│   ├── CalendarHeader.tsx      # Navigation and view toggle
│   ├── CalendarDayCell.tsx     # Individual day cell
│   └── EventMarker.tsx         # Visual event indicator
└── ListView/
    └── index.tsx               # Refactored existing list view
```

**Type Definitions:**
- `frontend/src/types.ts`
  - Contains `PlantingCalendar` interface
  - Contains `Plant` interface
  - May need extension for new features

**Plant Database:**
- `frontend/src/data/plantDatabase.ts`
  - Complete plant database with all properties
  - Used for auto-calculation
  - **DO NOT MODIFY** - This is our source of truth

**Date Utilities:**
- Already using `date-fns` (4.1.0)
  - `format`, `addDays`, `addWeeks` - Currently used
  - Will need: `startOfMonth`, `endOfMonth`, `eachDayOfInterval`, `getDay`, `isToday`, `isSameDay`

### Backend

**API Endpoints:**
- `backend/app.py`
  - Lines 317-355: Planting event routes (GET, POST, PUT, DELETE)
  - Lines 356-375: Frost date routes (GET, POST)
  - **NOTE:** PUT endpoint only allows updating `completed` and `notes` - needs expansion

**Database Models:**
- `backend/models.py`
  - Lines 60-89: `PlantingEvent` model
  - Fields: plant_id, variety, garden_bed_id, seed_start_date, transplant_date, direct_seed_date, expected_harvest_date, succession_planting, succession_interval, completed, notes, created_at
  - **Already supports variety tracking!** (Recently added)

**Plant Database Backend:**
- `backend/plant_database.py`
  - Complete plant data with `transplantWeeksBefore` and `daysToMaturity`
  - Used for calculations

---

## Critical Logic to Preserve

### Date Calculation Algorithm

**File:** `frontend/src/components/PlantingCalendar.tsx` (Lines 14-24)

```typescript
const calculatePlantingDates = (plant: Plant) => {
  const seedStartDate = addWeeks(lastFrostDate, -plant.transplantWeeksBefore);
  const transplantDate = addDays(lastFrostDate, plant.transplantWeeksBefore * 7);
  const expectedHarvestDate = addDays(transplantDate, plant.daysToMaturity);

  return {
    seedStartDate,
    transplantDate,
    expectedHarvestDate,
  };
};
```

**WHY THIS IS IMPORTANT:**
- This is our competitive advantage over SeedTime
- Automatically calculates optimal planting dates based on frost dates and plant characteristics
- Must be preserved in enhanced version
- Should be made more flexible to accept custom base date (not just `lastFrostDate`)

**Enhancement for Phase 2:**
```typescript
const calculatePlantingDates = (
  plant: Plant,
  baseDate: Date = lastFrostDate  // Allow custom base date
) => {
  const seedStartDate = addWeeks(baseDate, -plant.transplantWeeksBefore);
  const transplantDate = addDays(baseDate, plant.transplantWeeksBefore * 7);
  const expectedHarvestDate = addDays(transplantDate, plant.daysToMaturity);

  return {
    seedStartDate,
    transplantDate,
    expectedHarvestDate,
  };
};
```

---

## Important Design Decisions

### Decision 1: Custom Calendar Grid vs Library

**Decision:** Build custom calendar grid using date-fns

**Rationale:**
- react-big-calendar is ~400KB (huge bundle size increase)
- Our calendar needs are simple (month grid with event markers)
- Custom implementation gives full control over UX
- date-fns already installed and familiar to team
- Estimated custom code: ~5KB

**Trade-offs:**
- More code to write and maintain
- But: Better performance, smaller bundle, full customization

### Decision 2: Keep List View as Option

**Decision:** Preserve existing list view, add toggle button

**Rationale:**
- Some users may prefer list view (especially on mobile)
- List view is already working and tested
- Low risk: Just refactor into subdirectory, add toggle
- Provides fallback if grid view has issues

**Implementation:**
- Move existing code to `PlantingCalendar/ListView/index.tsx`
- Add state: `viewMode: 'list' | 'grid'`
- Persist preference in localStorage
- Default to grid on desktop (>= 768px), list on mobile

### Decision 3: Mobile-First Design

**Decision:** Design calendar grid for mobile first, enhance for desktop

**Rationale:**
- Calendar grids are hardest on mobile (limited screen space)
- If it works on mobile, it'll work everywhere
- 60%+ of gardeners likely use mobile devices in garden

**Mobile Adaptations:**
- Collapse day names to single letter (M T W T F S S)
- Smaller event markers (just colored dots vs icons)
- Default to list view on < 768px
- Swipe navigation for month changes
- Consider week view for very small screens (< 375px)

### Decision 4: Color Coding by Plant Category

**Decision:** Use Tailwind color classes to color-code events by plant category

**Categories & Colors:**
- Vegetables: Green (`bg-green-500`)
- Herbs: Purple (`bg-purple-500`)
- Fruits: Red (`bg-red-500`)
- Flowers: Pink (`bg-pink-500`)
- Cover Crops: Brown (`bg-amber-700`)

**Rationale:**
- Visual distinction helps users quickly identify crops
- Color coding is universal and accessible
- Tailwind makes this trivial to implement
- Matches SeedTime's visual approach

**Accessibility Consideration:**
- Don't rely on color alone (add icons too: 🍅 🥬 🥕)
- Test with colorblind simulation tools

### Decision 5: Phase 1 = Grid Only, No New Features

**Decision:** Phase 1 focuses solely on visual calendar grid, no sidebar or year import yet

**Rationale:**
- Validate the grid UX before building more features
- Easier to test and debug incrementally
- Allows user feedback early
- Reduces risk of building wrong features

**Deliverables Phase 1:**
- Calendar grid with month view
- Display existing events on grid
- Toggle between list/grid
- Month/year navigation
- Color-coded event markers
- Mobile responsive

**NOT in Phase 1:**
- Sidebar (Phase 2)
- Click-to-add (Phase 2)
- Year import (Phase 3)
- Batch operations (Phase 3)

---

## Technical Constraints & Gotchas

### Date Handling

**Constraint:** Dates must be stored as ISO strings in backend, parsed correctly

**Current Implementation:**
- Backend has `parse_iso_date()` helper function
- Frontend sends dates as ISO strings (e.g., "2025-03-15T00:00:00Z")
- Backend stores in `db.DateTime` columns

**Gotcha:** JavaScript's `new Date()` can have timezone issues
**Solution:** Use `date-fns` `startOfDay()` to normalize dates to midnight

**Example:**
```typescript
import { startOfDay, parseISO } from 'date-fns';

// When receiving date from API
const date = parseISO(apiDateString);

// When creating new date for comparison
const today = startOfDay(new Date());
```

### Event Grouping by Date

**Current Implementation (Lines 66-75):**
```typescript
const groupedEvents = plantingEvents.reduce((acc, event) => {
  const date = event.seedStartDate || event.directSeedDate || event.transplantDate;
  if (!date) return acc;

  const monthYear = format(date, 'MMMM yyyy');
  if (!acc[monthYear]) acc[monthYear] = [];
  acc[monthYear].push(event);
  return acc;
}, {} as Record<string, PlantingCalendarType[]>);
```

**Issue:** Groups by earliest date (seed start > direct seed > transplant)
**Enhancement for Grid:** Need to show events on ALL relevant dates

**Example:**
- Event has seedStartDate (March 1), transplantDate (April 15), harvest (July 1)
- Should appear on calendar on ALL THREE dates with different icons
- Current: Only appears on March 1

**Solution:**
```typescript
// Expand each event into multiple date markers
const dateMarkers = plantingEvents.flatMap(event => {
  const markers = [];

  if (event.seedStartDate) {
    markers.push({ date: event.seedStartDate, type: 'seed-start', event });
  }
  if (event.transplantDate) {
    markers.push({ date: event.transplantDate, type: 'transplant', event });
  }
  if (event.directSeedDate) {
    markers.push({ date: event.directSeedDate, type: 'direct-seed', event });
  }
  if (event.expectedHarvestDate) {
    markers.push({ date: event.expectedHarvestDate, type: 'harvest', event });
  }

  return markers;
});

// Group by date for calendar display
const eventsByDate = dateMarkers.reduce((acc, marker) => {
  const dateKey = format(marker.date, 'yyyy-MM-dd');
  if (!acc[dateKey]) acc[dateKey] = [];
  acc[dateKey].push(marker);
  return acc;
}, {} as Record<string, DateMarker[]>);
```

### Performance Considerations

**Constraint:** Component must render quickly even with 100+ events

**Potential Bottlenecks:**
1. Re-rendering entire calendar grid on every state change
2. Filtering/searching large plant database
3. Grouping events by date on every render

**Solutions:**
1. **Memoization:**
   ```typescript
   const eventsByDate = useMemo(() => {
     // Expensive grouping logic
   }, [plantingEvents, currentMonth]);
   ```

2. **React.memo for components:**
   ```typescript
   export const CalendarDayCell = React.memo(({ date, events, onClick }) => {
     // Component logic
   });
   ```

3. **Debounce search:**
   ```typescript
   const [searchQuery, setSearchQuery] = useState('');
   const debouncedSearch = useDebounce(searchQuery, 300);
   ```

4. **Virtual scrolling for lists:**
   - Use react-window for sidebar crop list (if > 100 items)

### Mobile Responsive

**Constraint:** Calendar must work on screens as small as 320px wide

**Breakpoints:**
- Mobile: < 768px (list view default)
- Tablet: 768px - 1024px (grid view, collapsed sidebar)
- Desktop: >= 1024px (grid view, expanded sidebar)

**Mobile-Specific Challenges:**
1. **Calendar Grid Too Cramped:**
   - Use smaller fonts (10px vs 14px)
   - Collapse day names to single letter (M vs Mon)
   - Show event as colored dot (no icon)

2. **Sidebar on Mobile:**
   - Collapse sidebar by default
   - Add hamburger button to toggle
   - Full-screen overlay when open

3. **Month Navigation:**
   - Swipe left/right to change months (react-swipeable?)
   - Larger touch targets for prev/next buttons (min 44px)

### State Persistence

**Constraint:** User preferences should persist across sessions

**What to Persist (localStorage):**
- View mode: 'list' | 'grid'
- Grid view mode: 'month' | 'quarter' | 'year' | '18months'
- Sidebar collapsed state
- Filter preferences (maybe?)
- Last viewed month (maybe?)

**What NOT to Persist:**
- Planting events (fetch from API)
- Frost dates (fetch from API)
- Garden beds (fetch from API)

**Implementation:**
```typescript
// On mount
useEffect(() => {
  const savedViewMode = localStorage.getItem('plantingCalendar.viewMode');
  if (savedViewMode) {
    setViewMode(savedViewMode as 'list' | 'grid');
  }
}, []);

// On change
useEffect(() => {
  localStorage.setItem('plantingCalendar.viewMode', viewMode);
}, [viewMode]);
```

---

## Integration Points

### With Existing Features

**Garden Beds:**
- Planting events can be assigned to garden beds
- Filter calendar by garden bed
- Garden bed selector in AddCropModal

**Harvest Tracker:**
- Planting events have `expectedHarvestDate`
- Could link to HarvestTracker component
- Future: Auto-create harvest entry on expected date

**Seed Inventory:**
- Could link from planting event to seed inventory
- "Do I have seeds for this?" check
- Future: Auto-decrement seed inventory when planting

**Property Designer:**
- Could show planting calendar for specific property
- Filter events by property
- Visual map + calendar integration (future)

---

## Known Issues & TODOs

### Current Component Issues

**Issue 1: No API Integration**
- Current PlantingCalendar uses local state only
- Events lost on page refresh
- **TODO:** Integrate with `/api/planting-events` endpoints

**Issue 2: Frost Dates Not Persisted**
- Frost dates reset to defaults on refresh
- **TODO:** Fetch from `/api/frost-dates`, update on change

**Issue 3: No Garden Bed Integration**
- `garden_bed_id` field exists but not used in UI
- **TODO:** Add garden bed selector to add event form

**Issue 4: Succession Planting Not Fully Implemented**
- `succession_planting` and `succession_interval` fields exist
- Not used in UI (just a static tip section)
- **TODO:** Add succession planting form fields, create multiple events

**Issue 5: Limited PUT Endpoint**
- Backend only allows updating `completed` and `notes`
- Can't edit other fields (plant, dates, variety)
- **TODO:** Expand PUT endpoint to allow full event editing

### Phase 1 TODOs

- [ ] Refactor existing PlantingCalendar.tsx into modular structure
- [ ] Build CalendarGrid component with date-fns
- [ ] Implement event marker rendering
- [ ] Add view toggle
- [ ] Test on mobile devices
- [ ] Fix any existing bugs before adding new features

### Future Considerations

**Phase 2+:**
- Offline support (service worker, IndexedDB)
- Calendar export (iCal, Google Calendar)
- Notifications/reminders (browser notifications API)
- Dark mode support
- Internationalization (i18n for dates, plant names)

---

## Dependencies

### Already Installed

- `date-fns` (4.1.0) - Date manipulation
- `lucide-react` (0.553.0) - Icons
- `@dnd-kit/core` (6.3.1) - Drag and drop (optional use)
- `tailwindcss` (latest) - Styling

### May Need to Add

**Phase 1:**
- None (use what we have)

**Phase 2:**
- `react-window` or `react-virtuoso` - Virtual scrolling for crop list (if needed)
- `use-debounce` - Debounce hook for search (or implement custom)
- `react-swipeable` - Swipe navigation on mobile (optional)

**Phase 3:**
- None yet

---

## Code Style & Patterns

### Naming Conventions

**Components:** PascalCase
- `CalendarGrid.tsx`
- `EventMarker.tsx`

**Functions:** camelCase
- `calculatePlantingDates()`
- `groupEventsByDate()`

**Constants:** SCREAMING_SNAKE_CASE
- `PLANT_DATABASE`
- `COLOR_SCHEME`

**Interfaces:** PascalCase
- `PlantingEvent`
- `CalendarState`

### File Organization

```
ComponentName/
├── index.tsx              # Main component
├── ComponentName.test.tsx # Tests
├── SubComponent.tsx       # Sub-components if large
└── README.md              # Component documentation (optional)
```

### Component Pattern

```typescript
import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';

interface ComponentNameProps {
  // Props with descriptions
  events: PlantingEvent[];
  onEventClick?: (event: PlantingEvent) => void;
}

export const ComponentName: React.FC<ComponentNameProps> = ({
  events,
  onEventClick,
}) => {
  // State
  const [loading, setLoading] = useState(false);

  // Derived state (memoized)
  const groupedEvents = useMemo(() => {
    // Expensive calculation
  }, [events]);

  // Effects
  useEffect(() => {
    // Side effects
  }, []);

  // Event handlers
  const handleClick = (event: PlantingEvent) => {
    onEventClick?.(event);
  };

  // Render
  return (
    <div className="component-name">
      {/* JSX */}
    </div>
  );
};

export default ComponentName;
```

---

## Testing Strategy

### What to Test

**Unit Tests:**
- `calculatePlantingDates()` function
- Date grouping functions
- Filter functions
- Date adjustment logic (year import)

**Integration Tests:**
- Add event flow (user clicks, fills form, saves)
- Delete event flow
- Toggle completion flow
- View mode toggle

**E2E Tests (Playwright):**
- User navigates calendar
- User adds event via grid click
- User searches for plant
- User imports from previous year

### Testing Tools

- **Jest** - Unit tests (already set up?)
- **React Testing Library** - Component tests
- **Playwright** - E2E tests (already installed)

---

## Related Documentation

- **Plan:** `enhanced-planting-calendar-plan.md` - Complete implementation plan
- **Tasks:** `enhanced-planting-calendar-tasks.md` - Specific work items
- **SeedTime Analysis:** `analysis-output/COMPLETE_SEEDTIME_ANALYSIS.md` - Competitive research
- **Project Guidelines:** `CLAUDE.md` - General project standards

---

## Phase 1 Enhancement (2025-11-12)

### Manual Date Editing Feature

**Issue Identified:** Phase 1 dates were auto-calculated but fixed - users couldn't manually adjust them.

**Solution Implemented:**
- Added `manualDates` state in ListView to store user overrides
- Replaced static date display with editable date inputs (type="date")
- Pre-filled inputs with calculated dates as smart defaults
- Modified `addPlantingEvent()` to use manual dates when provided, falling back to calculated dates
- Reset manual dates after adding event

**Files Modified:**
- `PlantingCalendar/ListView/index.tsx` - Added manual date override state and UI

**Result:** Users now get smart auto-calculated dates AND can manually edit them before adding events.

---

## Phase 2 Implementation (2025-11-12)

### New Components Created

#### CropsSidebar (`PlantingCalendar/CropsSidebar/`)

**Purpose:** Searchable, filterable sidebar for browsing and selecting crops

**Components:**
- `index.tsx` - Main sidebar container with state management
  - 250px fixed width on desktop, full-screen overlay on mobile
  - Sticky header with search and filters
  - Scrollable crop list
  - Footer with count
  - Persist sidebar state in localStorage

- `SearchBar.tsx` - Search input with debounce (300ms)
  - Search icon (left)
  - Clear button (right) when text entered
  - Filters by plant name and scientific name

- `FilterPanel.tsx` - Category checkboxes
  - Multi-select filtering
  - Shows counts for each category
  - "Clear All" button

- `CropList.tsx` - Scrollable list grouped by category
  - Groups plants by category with headers
  - Handles empty state

- `CropCard.tsx` - Individual crop card
  - Plant icon (emoji mapping)
  - Plant name
  - Days to maturity
  - Click to select
  - Highlight when selected

**Plant Icon Mapping:**
- Created comprehensive emoji mapping for common vegetables, herbs, fruits, and flowers
- Fallback icons based on category
- Used in both CropCard and EventMarker

#### AddCropModal (`PlantingCalendar/AddCropModal/`)

**Purpose:** Enhanced modal for adding planting events with all features

**Features Implemented:**
- **Plant Selection:** Dropdown of all plants from PLANT_DATABASE
- **Variety Input:** Text field for variety (e.g., "Brandywine", "Roma")
- **Garden Bed Selector:** Dropdown (placeholder data, ready for API integration)
- **Planting Method:** Radio buttons (Transplant vs Direct Seed)
- **Manual Date Editing:** Reused logic from ListView Phase 1 enhancement
  - Pre-filled with calculated dates
  - Editable date inputs
  - Calculates from initialDate (if clicked from calendar) or lastFrostDate
- **Succession Planting:**
  - Checkbox to enable
  - Interval input (days between plantings)
  - Count input (number of plantings)
  - Creates multiple events with staggered dates
- **Notes:** Textarea for additional notes
- **Modal UX:**
  - 600px wide, responsive
  - Scrollable content
  - Backdrop overlay
  - ESC to close
  - Close button (X)
  - Cancel and Save buttons

**Props:**
- `initialDate?: Date` - Pre-fills when clicking calendar date
- `initialPlant?: Plant` - Pre-fills when clicking crop from sidebar
- `lastFrostDate: Date` - Base date for calculations

### Integration Changes

#### Main PlantingCalendar Component

**New State:**
- `sidebarOpen` - Controls sidebar visibility (persisted in localStorage)
- `modalOpen` - Controls AddCropModal visibility
- `modalInitialDate` - Passes clicked date to modal
- `modalInitialPlant` - Passes selected plant to modal
- `lastFrostDate` - Shared frost date for calculations

**New Handlers:**
- `handleDateClick(date)` - Opens modal with pre-filled date
- `handlePlantSelect(plant)` - Opens modal with pre-filled plant
- `handleAddEvent(event)` - Adds event to state

**Layout Changes:**
- Flex layout: Sidebar (grid view only) + Main content
- Mobile: Sidebar as overlay with hamburger menu
- Desktop: Sidebar always visible in grid view

#### CalendarGrid Component

**Updated:**
- Added `onDateClick` prop
- Pass click handler through to CalendarDayCell
- Removed console.log placeholder

#### EventMarker Component

**Enhanced:**
- Display variety in tooltip
- Show variety in marker (small text if space allows)
- Improved tooltip format: "Event Type: Plant Name (Variety)"

### Type Updates

**PlantingCalendar Interface:**
- Added `variety?: string` field
- Maintains backward compatibility (optional field)

---

## Technical Decisions Made

### Decision: Reuse Manual Date Logic in Modal

**Why:** ListView Phase 1 enhancement provided proven manual date editing logic. Instead of rebuilding, we extracted the pattern and reused it in AddCropModal.

**Benefits:**
- Consistent UX between ListView and Grid view
- Reduced code duplication
- Faster development

### Decision: Plant Icons in CropCard

**Why:** Visual distinction helps users quickly identify plants in sidebar and on calendar.

**Implementation:**
- Created comprehensive emoji mapping
- Fallback to category-based icons
- Used in both CropCard and (optionally) EventMarker

### Decision: Sidebar Only in Grid View

**Why:**
- List view already has inline add form
- Grid view benefits from persistent sidebar
- Reduces UI clutter in list view
- Clear separation of concerns

### Decision: Succession Planting in Modal

**Why:**
- More space in modal for complex UI
- Can show preview of what will be created
- Better UX than cramped inline form

**Implementation:**
- Checkbox to enable
- Simple inputs for interval and count
- Creates multiple events client-side
- Future: Could show preview list

---

## Files Created/Modified Summary

### New Files (Phase 2):
```
PlantingCalendar/CropsSidebar/
  - index.tsx (155 lines)
  - SearchBar.tsx (30 lines)
  - FilterPanel.tsx (55 lines)
  - CropList.tsx (65 lines)
  - CropCard.tsx (85 lines)

PlantingCalendar/AddCropModal/
  - index.tsx (420 lines)
```

### Modified Files:
- `PlantingCalendar/ListView/index.tsx` - Manual date editing (Phase 1)
- `PlantingCalendar/index.tsx` - Integrated sidebar and modal
- `PlantingCalendar/CalendarGrid/index.tsx` - Added onDateClick prop
- `PlantingCalendar/CalendarGrid/EventMarker.tsx` - Show variety, enhanced tooltip
- `types.ts` - Added variety field to PlantingCalendar interface

---

## Known Limitations & Future Work

### Current Limitations:

1. **Garden Beds:** Using placeholder data
   - **TODO:** Fetch from `/api/garden-beds`
   - Need to handle empty state

2. **Frost Dates:** Hardcoded in component
   - **TODO:** Fetch from `/api/frost-dates`
   - Need to fetch on mount

3. **Event Persistence:** Events stored in local state only
   - **TODO:** POST to `/api/planting-events`
   - Need error handling

4. **No Edit Feature:** Can only add/delete events
   - **TODO:** Click event marker to edit
   - Reuse AddCropModal with pre-filled data

5. **No Event Details View:** Limited info shown
   - **TODO:** Click event for full details modal
   - Show all fields, allow editing

### Future Enhancements:

1. **Smart Suggestions:** "Based on your location, you should plant X now"
2. **Weather Integration:** Adjust dates based on actual frost dates
3. **Companion Planting Alerts:** "This plant pairs well with X (already in Bed 2)"
4. **Harvest Reminders:** Notifications when harvest date approaches
5. **Multi-Select Events:** Batch operations (mark complete, delete, reschedule)
6. **Print/Export:** PDF planting schedule
7. **Templates:** "Spring Garden", "Fall Garden", "Winter Greenhouse"

---

## Current Implementation Status (Post-Phase 2 - 2025-11-12)

### What's Fully Functional (Client-Side):

✅ **Calendar Grid** - Month view with date navigation
✅ **Event Display** - Color-coded markers on relevant dates (seed, transplant, harvest)
✅ **View Toggle** - Switch between List and Grid views (localStorage persistence)
✅ **Crops Sidebar** - Searchable, filterable plant database
  - Debounced search (300ms)
  - Multi-select category filters (Vegetables, Herbs, Fruits, Flowers, Cover Crops)
  - Plant icons (40+ emoji mappings)
  - Click to select plant
✅ **Click-to-Add** - Click calendar date OR crop from sidebar to add event
✅ **AddCropModal** - Comprehensive modal with:
  - Variety input ("Brandywine", "Roma", etc.)
  - Garden bed selector
  - Succession planting (interval + count)
  - Manual date editing with smart defaults
  - Notes field
  - Pre-fills date/plant based on context
✅ **ListView** - Original list view with manual date editing
✅ **Mobile Responsive** - Sidebar collapses, touch-friendly
✅ **Smart Auto-Calculation** - Dates calculate from frost dates + plant data
✅ **Manual Override** - Users can edit any calculated date

### What's Using Mock/Placeholder Data:

⚠️ **Garden Beds** - Hardcoded array in AddCropModal:
```typescript
const gardenBeds = [
  { id: '1', name: 'Main Garden', width: 20, length: 30 },
  { id: '2', name: 'Side Bed', width: 10, length: 15 },
  { id: '3', name: 'Greenhouse', width: 12, length: 24 },
];
```

⚠️ **Frost Dates** - Hardcoded in component:
```typescript
const [lastFrostDate, setLastFrostDate] = useState(new Date('2024-04-15'));
const [firstFrostDate, setFirstFrostDate] = useState(new Date('2024-10-15'));
```

⚠️ **Event Persistence** - Stored in component state only:
```typescript
const [plantingEvents, setPlantingEvents] = useState<PlantingCalendarType[]>([]);
```
**CRITICAL:** All events lost on page refresh

### Integration Gaps - API Endpoints Not Connected:

| Endpoint | Purpose | Current Status | Priority |
|----------|---------|----------------|----------|
| `GET /api/planting-events` | Load all events | Not connected | **CRITICAL** |
| `POST /api/planting-events` | Save new events | Not connected | **CRITICAL** |
| `PUT /api/planting-events/<id>` | Edit events | Not implemented | HIGH |
| `DELETE /api/planting-events/<id>` | Delete events | Not connected | MEDIUM |
| `GET /api/garden-beds` | Fetch beds | Using placeholder | HIGH |
| `GET /api/frost-dates` | Load frost config | Using hardcoded | MEDIUM |
| `POST /api/frost-dates` | Save frost config | Not implemented | MEDIUM |

**Total:** 7 API endpoints need integration

### Files That Need API Integration:

1. **`PlantingCalendar/index.tsx`** (Main container)
   - On mount: fetch events, frost dates
   - On add event: POST to API, then update state
   - On delete event: DELETE from API, then update state

2. **`PlantingCalendar/AddCropModal/index.tsx`**
   - On mount: fetch garden beds from API
   - Replace placeholder beds array

3. **`PlantingCalendar/ListView/index.tsx`**
   - On frost date change: POST to /api/frost-dates
   - Receive frost dates as props from parent (after parent fetches)

### Decision Point: API Integration Timing

**Option A: Integrate APIs Now (RECOMMENDED)**

**Pros:**
- Addresses CRITICAL need (event persistence)
- Solid foundation for Phase 3 features
- Can get real user testing with data that persists
- Year import (Phase 3) requires real data

**Cons:**
- Delays Phase 3 start by 4-6 hours
- Adds scope before completing all features

**Tasks:**
1. Verify /api/planting-events endpoints exist (check backend/app.py)
2. Add useEffect in PlantingCalendar/index.tsx to fetch events on mount
3. Connect POST in handleAddEvent()
4. Add loading states (spinner while saving)
5. Add error handling (toasts for failures)
6. Test create → save → refresh → load cycle
7. Repeat for garden-beds and frost-dates

**Estimated Time:** 4-6 hours

**Option B: Proceed to Phase 3 with Mock Data**

**Pros:**
- Complete feature set faster
- Can defer integration work

**Cons:**
- Users can't actually use the feature (data doesn't persist)
- Phase 3 features (year import, batch ops) need real data to work
- **Risk:** Technical debt, may need refactoring later
- **User Experience:** Limited testing without persistence

**Not Recommended**

### API Integration Implementation Notes:

**Pattern to Use:**
```typescript
// In PlantingCalendar/index.tsx
useEffect(() => {
  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/planting-events`);
      const data = await response.json();
      setPlantingEvents(data.map(e => ({
        ...e,
        seedStartDate: e.seedStartDate ? parseISO(e.seedStartDate) : undefined,
        transplantDate: e.transplantDate ? parseISO(e.transplantDate) : undefined,
        // ... parse all dates
      })));
    } catch (error) {
      console.error('Failed to load events:', error);
      // Show error toast
    } finally {
      setLoading(false);
    }
  };

  fetchEvents();
}, []);

const handleAddEvent = async (event: PlantingCalendarType) => {
  try {
    setSaving(true);
    const response = await fetch(`${API_BASE_URL}/api/planting-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...event,
        seedStartDate: event.seedStartDate?.toISOString(),
        // ... convert dates to ISO
      }),
    });

    if (!response.ok) throw new Error('Save failed');

    const savedEvent = await response.json();
    setPlantingEvents([...plantingEvents, savedEvent]);
    // Show success toast
  } catch (error) {
    console.error('Failed to save event:', error);
    // Show error toast
  } finally {
    setSaving(false);
  }
};
```

### Next Immediate Actions (After Context Compaction):

**Step 1: Browser Testing** (30 minutes)
- Open http://localhost:3000
- Test all user flows (see tasks.md for checklist)
- Note any bugs or UX issues
- Test on mobile (Chrome DevTools responsive mode)

**Step 2: Make Decision** (5 minutes)
- Review decision point above
- Choose: API integration now OR defer to later
- **Recommendation:** API integration (event persistence is CRITICAL)

**Step 3A: If API Integration Chosen** (4-6 hours)
- Check backend: Does `/api/planting-events` exist?
  - If YES: Connect frontend to existing endpoints
  - If NO: Create endpoints first (backend work)
- Implement fetch on mount (GET events)
- Implement save on add (POST event)
- Add loading/error states
- Test persistence cycle
- Then: garden-beds and frost-dates
- Then: Proceed to Phase 3

**Step 3B: If Deferring API Integration** (Not recommended)
- Begin Phase 3 task planning
- Accept that user testing will be limited
- Plan to integrate APIs after Phase 3

**Step 4: Update Context**
- Document testing results
- Document any bugs found
- Update with API integration status
- Mark next milestone

---

**Last Updated:** 2025-11-12
**Next Update:** After browser testing and API integration decision
