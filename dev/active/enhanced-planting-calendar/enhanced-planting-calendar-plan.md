# Enhanced Planting Calendar - Implementation Plan

**Created:** 2025-11-12
**Last Updated:** 2025-11-12
**Status:** Phase 1 & 2 COMPLETE - Phase 3 PENDING

**Phase 1 Complete:** 2025-11-12 (21/22 tasks - swipe nav deferred)
**Phase 2 Complete:** 2025-11-12 (20/20 tasks)
**Phase 3 Status:** Not started (0/12 tasks)

**Next Review:** After browser testing and API integration decision
**Target:** API integration → Phase 3 → Production ready

---

## Progress Update - 2025-11-12

**Status:** Phase 1 & 2 implementation complete, ready for testing
**Completed Phases:** Phase 1 (Foundation), Phase 2 (Enhanced UX)
**Current Phase:** Testing & API integration decision
**Blockers:** None - awaiting testing and user feedback

**Summary:** All Phase 1-2 features are implemented and building successfully. Calendar grid, sidebar, click-to-add, and enhanced modal are all functional with local state. Need to decide on API integration timing before proceeding to Phase 3.

---

## Executive Summary

Upgrade our existing PlantingCalendar component by adding SeedTime's visual calendar grid interface while preserving our intelligent auto-calculation and comprehensive data tracking features.

**Original Goal:** Visual calendar grid + "My Crops" sidebar + "Copy from Previous Year" feature

**Achievement:** ✅ Phase 1 & 2 complete (calendar grid + sidebar + enhanced modal)
**Remaining:** Phase 3 (year import + batch operations + advanced features)

---

## Competitive Analysis Summary

### SeedTime's Strengths (What We're Adding)
- ✅ Visual calendar grid with 18-month view
- ✅ Click dates directly to add crops
- ✅ "My Crops" sidebar with search/filter
- ✅ "Copy from previous year" import feature
- ✅ Clean empty states with illustrations
- ✅ Visual crop icons and color coding

### Our Strengths (What We're Keeping)
- ✅ Smart auto-calculation from plant database + frost dates
- ✅ Variety tracking (e.g., "Brandywine Tomato" vs "Roma Tomato")
- ✅ Succession planting support (built-in fields)
- ✅ Multiple date tracking (seed start, transplant, direct seed, harvest)
- ✅ Garden bed integration
- ✅ Completion tracking with checkboxes
- ✅ Integration with harvest tracker, seed inventory

---

## Current Implementation Analysis

### Existing PlantingCalendar Component

**File:** `frontend/src/components/PlantingCalendar.tsx` (348 lines)

**Current Features:**
1. **Frost Date Configuration**
   - Last spring frost date input
   - First fall frost date input
   - Stored in component state (not persisted)

2. **Smart Auto-Calculation**
   - `calculatePlantingDates()` function
   - Uses plant's `transplantWeeksBefore` and `daysToMaturity`
   - Calculates: seedStartDate, transplantDate, expectedHarvestDate

3. **Add Planting Event Form**
   - Plant selector dropdown (from PLANT_DATABASE)
   - Planting method radio: "Start Indoors & Transplant" vs "Direct Seed"
   - Real-time calculated dates preview (blue box)
   - "Add to Calendar" button

4. **List-Based Display**
   - Groups events by month (e.g., "March 2024")
   - Card-based layout for each event
   - Shows: 🌱 Start Seeds, 🌿 Transplant, 🌱 Direct Seed, 🎉 Harvest
   - Checkbox for completion tracking
   - Remove button

5. **Data Model**
   ```typescript
   interface PlantingCalendar {
     id: string;
     plantId: string;
     gardenBedId: string;
     seedStartDate?: Date;
     transplantDate?: Date;
     directSeedDate?: Date;
     expectedHarvestDate: Date;
     successionPlanting: boolean;
     successionInterval?: number;
     completed: boolean;
     notes?: string;
   }
   ```

6. **State Management**
   - Local component state (useState)
   - No API integration yet (mock data)
   - No persistence

**Current Weaknesses:**
- No visual calendar grid
- Can't see entire season at a glance
- Can't click dates to add crops
- No crop browsing sidebar
- No year-import functionality
- Empty state is plain text
- Limited filtering options
- Data not persisted (lost on refresh)

---

## Proposed Visual Design

### Layout Structure

```
┌────────────────────────────────────────────────────────────────────┐
│ Planting Calendar                         [List View] [Grid View] │
├──────────────────────┬─────────────────────────────────────────────┤
│ MY CROPS             │ CALENDAR VIEW                               │
│                      │                                              │
│ 🔍 [Search crops]   │  Property: [All Gardens ▼]  🌡️ [Set Frost] │
│                      │                                              │
│ Filters:             │  ◄ March 2025 ►          [Today] [18 Mo]   │
│ ☐ Vegetables (45)    │  ┌────────────────────────────────────────┐ │
│ ☐ Herbs (12)         │  │ Sun Mon Tue Wed Thu Fri Sat             │ │
│ ☐ Fruits (8)         │  │                 1                       │ │
│ ☐ Flowers (6)        │  │  2   3   4   5   6   7   8             │ │
│                      │  │ 🌱  🥕              🍅                   │ │
│ 🍅 TOMATO (4 vars)  →│  │  9  10  11  12  13  14  15             │ │
│   • Brandywine       │  │     🌱                                  │ │
│   • Cherokee Purple  │  │ 16  17  18  19  20  21  22             │ │
│   • Roma             │  │ 🌿  🌱  🌿                              │ │
│   • San Marzano      │  │ 23  24  25  26  27  28  29             │ │
│                      │  │                                         │ │
│ 🥬 LETTUCE (2)       │  │ 30  31                                  │ │
│   • Red Leaf         │  │ 🥬                                      │ │
│   • Buttercrunch     │  └────────────────────────────────────────┘ │
│                      │                                              │
│ 🥕 CARROT (2)        │  Legend:                                    │
│   • Danvers          │  🌱 Seed Start  🌿 Transplant              │
│   • Nantes           │  🥕 Direct Seed 🎉 Harvest                 │
│                      │                                              │
│ [+ Add Custom]       │  [+ Add Planting] [📥 Import from 2024]    │
└──────────────────────┴─────────────────────────────────────────────┘
```

### Component Architecture

```
EnhancedPlantingCalendar/
├── index.tsx                    # Main container component
│
├── CalendarGrid/
│   ├── index.tsx               # Month/year grid view
│   ├── CalendarHeader.tsx      # Month/year navigation, view mode toggle
│   ├── CalendarDayCell.tsx     # Individual day cell with event markers
│   ├── EventMarker.tsx         # Visual marker for event (🌱 🌿 🥕 🎉)
│   └── ViewModeToggle.tsx      # Month/Quarter/Year/18mo toggle
│
├── CropsSidebar/
│   ├── index.tsx               # Main sidebar container
│   ├── SearchBar.tsx           # Search input with debounce
│   ├── FilterPanel.tsx         # Category filter checkboxes
│   ├── CropList.tsx            # Scrollable crop list (virtualized?)
│   └── CropCard.tsx            # Individual crop item with icon
│
├── AddCropModal/
│   ├── index.tsx               # Modal for adding crops
│   ├── PlantSelector.tsx       # Choose plant (enhanced dropdown)
│   ├── DateCalculator.tsx      # Show calculated dates (existing logic)
│   ├── VarietyInput.tsx        # Variety text input
│   └── SuccessionOptions.tsx   # Succession planting settings
│
├── YearImportModal/
│   ├── index.tsx               # Import from previous year
│   ├── YearSelector.tsx        # Choose year to import from
│   ├── EventPreview.tsx        # Preview imported events
│   └── DateAdjuster.tsx        # Adjust dates if needed
│
├── ListView/
│   └── index.tsx               # Existing list view (refactored from current)
│
└── EmptyState/
    └── index.tsx               # Friendly empty state with illustration
```

---

## Technology Stack

| Technology | Choice | Rationale |
|------------|--------|-----------|
| **Calendar Library** | Custom implementation with date-fns | Already using date-fns (4.1.0). Custom grid is lighter (~5KB) than react-big-calendar (~400KB). Full control over UX. |
| **Date Library** | date-fns (4.1.0) | Already installed and used extensively. Modern, tree-shakeable, familiar to team. |
| **Icons** | lucide-react (0.553.0) | Already installed. Comprehensive icon set. Lightweight. Used throughout app. |
| **Drag & Drop** | @dnd-kit/core (6.3.1) - Optional | Already installed. Could enable dragging crops from sidebar to calendar. Phase 2+ feature. |
| **Modals** | Custom with Tailwind | Consistent with existing modals in codebase. No new dependencies. |
| **Color Coding** | Tailwind utility classes | Categories: vegetables (green), herbs (purple), fruits (red), flowers (pink), cover crops (brown) |
| **State Management** | React useState + API | Keep simple for now. Could add Zustand/Redux later if needed. |
| **Responsive Strategy** | Mobile-first | Design for mobile first (hardest case), enhance for desktop. Consider list view as mobile default. |

---

## 3-Phase Implementation Roadmap

### Phase 1: Foundation - Visual Calendar Grid (Weeks 1-2)

**Goal:** Add visual calendar grid view alongside existing list view. Display current events on grid. No new features yet.

#### Week 1: Core Calendar Grid

**Tasks:**
1. **Create component structure**
   - [ ] Create `frontend/src/components/PlantingCalendar/` directory
   - [ ] Move existing PlantingCalendar.tsx to `PlantingCalendar/ListView/index.tsx`
   - [ ] Create new `PlantingCalendar/index.tsx` as main container
   - [ ] Create `CalendarGrid/` subdirectory

2. **Build CalendarGrid component**
   - [ ] Create `CalendarGrid/index.tsx`
   - [ ] Implement month view with 7×5-6 grid (Sun-Sat columns)
   - [ ] Use `date-fns` functions: `startOfMonth`, `endOfMonth`, `eachDayOfInterval`, `getDay`
   - [ ] Render days with proper date numbers
   - [ ] Handle month boundaries (gray out prev/next month days)
   - [ ] Add "Today" indicator (blue circle or background)

3. **Build CalendarHeader component**
   - [ ] Create `CalendarGrid/CalendarHeader.tsx`
   - [ ] Month/year display (e.g., "March 2025")
   - [ ] Previous/Next month buttons (◄ ►)
   - [ ] "Today" button (jumps to current month)
   - [ ] View mode toggle (Month/Quarter/Year/18mo) - Start with Month only

4. **Build CalendarDayCell component**
   - [ ] Create `CalendarGrid/CalendarDayCell.tsx`
   - [ ] Display date number
   - [ ] Handle hover states
   - [ ] Handle click events (Phase 2: will open AddCropModal)
   - [ ] Container for event markers (Phase 1: just structure)

#### Week 2: Event Display & View Toggle

5. **Display events on calendar**
   - [ ] Create `CalendarGrid/EventMarker.tsx`
   - [ ] Group planting events by date
   - [ ] Render EventMarker components on correct dates
   - [ ] Color-code by plant category (vegetables=green, herbs=purple, etc.)
   - [ ] Show event type icon: 🌱 seed start, 🌿 transplant, 🥕 direct seed, 🎉 harvest
   - [ ] Handle multiple events on same day (stack or "+X more" indicator)
   - [ ] Click event marker to view details (tooltip or modal)

6. **Add view toggle**
   - [ ] Create toggle button: "List View" ↔ "Grid View"
   - [ ] State: `viewMode: 'list' | 'grid'`
   - [ ] Persist view preference in localStorage
   - [ ] Show ListView component when `viewMode === 'list'`
   - [ ] Show CalendarGrid component when `viewMode === 'grid'`
   - [ ] Ensure both views show same data

7. **Mobile responsive**
   - [ ] Test grid on mobile (< 768px)
   - [ ] Collapse day names to single letter (M T W T F S S)
   - [ ] Smaller font sizes
   - [ ] Default to list view on mobile (override localStorage?)
   - [ ] Allow grid toggle on mobile
   - [ ] Consider week view for very small screens

8. **Preserve existing functionality**
   - [ ] Ensure frost date configuration still works
   - [ ] Ensure add event form still works
   - [ ] Ensure auto-calculation still works
   - [ ] Ensure completion tracking still works
   - [ ] Ensure remove event still works
   - [ ] No breaking changes to existing features

**Deliverables:**
- ✅ Visual calendar grid showing existing events
- ✅ Toggle between list and grid views
- ✅ Month/year navigation working
- ✅ Color-coded event markers
- ✅ Mobile-responsive grid
- ✅ All existing features preserved

**Acceptance Criteria:**
- User can switch between list and grid views
- Events appear on correct dates in grid
- Events are color-coded by plant category
- Calendar looks good on mobile (< 768px)
- All existing list view features still work

---

### Phase 2: Enhanced UX - Sidebar & Click-to-Add (Weeks 3-4)

**Goal:** Add "My Crops" sidebar, click-to-add on calendar dates, improved modal and empty states

#### Week 3: Crops Sidebar

**Tasks:**
1. **Build "My Crops" sidebar structure**
   - [ ] Create `CropsSidebar/index.tsx`
   - [ ] Sidebar layout (fixed width ~250px, scrollable)
   - [ ] Responsive: collapse on mobile (< 768px), toggle button

2. **Implement search functionality**
   - [ ] Create `CropsSidebar/SearchBar.tsx`
   - [ ] Search input with icon
   - [ ] Debounce search (300ms) using `useMemo` or debounce library
   - [ ] Filter PLANT_DATABASE by search query
   - [ ] Highlight matching text

3. **Implement category filters**
   - [ ] Create `CropsSidebar/FilterPanel.tsx`
   - [ ] Checkboxes for each category: Vegetables, Herbs, Fruits, Flowers, Cover Crops
   - [ ] Show count per category (e.g., "Vegetables (45)")
   - [ ] Filter PLANT_DATABASE by selected categories
   - [ ] Additional filters: Frost Tolerance, Season

4. **Build crop list**
   - [ ] Create `CropsSidebar/CropList.tsx`
   - [ ] Scrollable list of filtered crops
   - [ ] Group by category (collapsible sections)
   - [ ] Virtual scrolling for performance (react-window?) if needed

5. **Build crop card**
   - [ ] Create `CropsSidebar/CropCard.tsx`
   - [ ] Plant name
   - [ ] Plant icon/emoji (🍅 🥬 🥕)
   - [ ] Quick info: Days to maturity, spacing
   - [ ] Click to select plant (highlight, open modal, or add to calendar)

#### Week 4: Click-to-Add & Modal Improvements

6. **Implement click-to-add workflow**
   - [ ] Add onClick handler to CalendarDayCell
   - [ ] Open AddCropModal when clicking empty date
   - [ ] Pre-fill selected date in modal
   - [ ] Pass date to calculatePlantingDates()
   - [ ] Show calculated dates in modal

7. **Enhance AddCropModal**
   - [ ] Create `AddCropModal/index.tsx`
   - [ ] Refactor existing add event form into modal
   - [ ] Better UI: larger modal, better spacing
   - [ ] Visual date picker (optional, in addition to calculated dates)
   - [ ] Variety input field (text input for "Brandywine", etc.)
   - [ ] Garden bed selector dropdown
   - [ ] Notes textarea
   - [ ] Succession planting section (checkbox + interval input)
   - [ ] "Save" and "Cancel" buttons

8. **Add crop icons and visual improvements**
   - [ ] Create icon mapping: plantId → emoji/icon
   - [ ] Use emojis for now (🍅 🥬 🥕 🌶️ 🫑 🥔 🧄 🧅)
   - [ ] Consider lucide-react icons for consistency
   - [ ] Color coding by category (Tailwind classes)
   - [ ] Hover effects on calendar cells
   - [ ] Tooltips with plant info

9. **Implement friendly empty states**
   - [ ] Create `EmptyState/index.tsx`
   - [ ] Illustration or large icon (🌱 or vegetable emoji)
   - [ ] Message: "No planting events yet. Start planning your garden!"
   - [ ] "Get Started" button (opens AddCropModal)
   - [ ] "Add Sample Calendar" button (pre-populate with common crops for zone)
   - [ ] Tips and suggestions

**Deliverables:**
- ✅ Searchable "My Crops" sidebar
- ✅ Click date to add crop workflow
- ✅ Enhanced AddCropModal UI
- ✅ Crop icons and color coding
- ✅ Friendly empty states
- ✅ Variety input support

**Acceptance Criteria:**
- User can search and filter plants in sidebar
- User can click calendar date to add crop
- Selected date is pre-filled in modal
- Auto-calculated dates appear correctly
- User can enter variety name
- Empty state is friendly and actionable

---

### Phase 3: Year Import & Advanced Features (Weeks 5-6)

**Goal:** "Copy from Previous Year" feature, batch operations, advanced filtering, multiple view modes

#### Week 5: Year Import Feature

**Tasks:**
1. **Build YearImportModal**
   - [ ] Create `YearImportModal/index.tsx`
   - [ ] Modal with year selector
   - [ ] Fetch events from selected year (mock data or API)
   - [ ] Preview events in table/list
   - [ ] Checkboxes to select which events to import
   - [ ] Show date adjustment preview (e.g., "March 15, 2024" → "March 15, 2025")
   - [ ] "Import" and "Cancel" buttons

2. **Implement year import logic**
   - [ ] Function to fetch events by year
   - [ ] Function to adjust dates by offset (e.g., +365 days)
   - [ ] Handle leap years correctly
   - [ ] Function to create new events from imported data
   - [ ] Preserve variety, notes, succession settings
   - [ ] Refresh calendar after import

3. **Add backend endpoint (if using API)**
   - [ ] `POST /api/planting-events/import-from-year`
   - [ ] Accept: sourceYear, eventIds[], dateOffset
   - [ ] Create new PlantingEvent records with adjusted dates
   - [ ] Return created events

4. **Add "Import from Year" button**
   - [ ] Button on main calendar page
   - [ ] Opens YearImportModal
   - [ ] Year dropdown (2020-2024 or dynamic range)

#### Week 6: Batch Operations & Advanced Features

5. **Implement batch operations**
   - [ ] Add checkbox to each event card
   - [ ] "Select All" checkbox
   - [ ] Selected count indicator (e.g., "3 events selected")
   - [ ] Batch actions toolbar:
     - [ ] "Mark Complete" button
     - [ ] "Mark Incomplete" button
     - [ ] "Delete Selected" button (with confirmation)
     - [ ] "Change Garden Bed" button

6. **Add advanced filtering**
   - [ ] Filter by garden bed (dropdown)
   - [ ] Filter by completion status (All / Active / Completed)
   - [ ] Filter by date range (start date, end date)
   - [ ] Filter by plant category (from sidebar)
   - [ ] Combine multiple filters (AND logic)
   - [ ] "Clear Filters" button

7. **Add multiple calendar view modes**
   - [ ] Month view (current) - 1 month at a time
   - [ ] Quarter view - 3 months in grid (3 columns)
   - [ ] Year view - 12 months condensed (4×3 grid or list)
   - [ ] 18-month view - SeedTime style (scrollable or paged)
   - [ ] Toggle between view modes in CalendarHeader
   - [ ] Persist view mode preference

8. **Performance optimizations**
   - [ ] Lazy load events by date range (only fetch visible months)
   - [ ] Debounce search input (already done in Week 3)
   - [ ] Memoize expensive calculations (useMemo for groupedEvents)
   - [ ] Virtual scrolling for large event lists (react-window)
   - [ ] Optimize re-renders (React.memo for components)

9. **Testing and polish**
   - [ ] Test with large datasets (100+ events)
   - [ ] Test on mobile devices
   - [ ] Test across browsers (Chrome, Firefox, Safari)
   - [ ] Fix any bugs found
   - [ ] Polish animations and transitions
   - [ ] Add loading states
   - [ ] Add error handling

**Deliverables:**
- ✅ Year import functionality
- ✅ Batch operations for events
- ✅ Advanced filtering options
- ✅ Multiple calendar view modes (Month/Quarter/Year/18mo)
- ✅ Performance optimizations
- ✅ Polished, production-ready feature

**Acceptance Criteria:**
- User can import events from previous year with date adjustment
- User can select multiple events and perform batch actions
- User can filter events by multiple criteria
- User can switch between different calendar view modes
- Calendar performs well with 100+ events
- All features work on mobile and desktop

---

## State Management Design

### Main Component State

```typescript
interface CalendarState {
  // View State
  viewMode: 'list' | 'grid';
  gridViewMode: 'month' | 'quarter' | 'year' | '18months';
  currentDate: Date;  // Currently displayed month/period

  // Data State
  plantingEvents: PlantingEvent[];
  selectedProperty: Property | null;
  selectedGardenBed: GardenBed | null;

  // Frost Dates
  lastFrostDate: Date;
  firstFrostDate: Date;

  // Filter State
  searchQuery: string;
  categoryFilters: PlantCategory[];  // ['vegetables', 'herbs']
  frostToleranceFilters: FrostTolerance[];
  completedFilter: 'all' | 'active' | 'completed';
  dateRangeFilter: { start: Date | null; end: Date | null };

  // Modal State
  addModalOpen: boolean;
  addModalDate: Date | null;  // Pre-filled date when clicking calendar
  addModalPlant: Plant | null;  // Pre-selected plant from sidebar
  importModalOpen: boolean;

  // Selection State (for batch operations)
  selectedEventIds: string[];

  // Loading/Error State
  loading: boolean;
  error: string | null;
}
```

### Data Flow

```
1. Mount
   ├─> GET /api/planting-events (fetch all events)
   ├─> GET /api/frost-dates (fetch frost dates)
   ├─> GET /api/properties (fetch properties/garden beds)
   └─> Render calendar with fetched data

2. User clicks calendar date
   ├─> Open AddCropModal
   ├─> Pre-fill selectedDate
   ├─> User selects plant
   ├─> Run calculatePlantingDates(plant, selectedDate)
   ├─> Show calculated dates in modal
   └─> User saves → POST /api/planting-events → Refresh calendar

3. User imports from previous year
   ├─> Open YearImportModal
   ├─> User selects year (e.g., 2024)
   ├─> GET /api/planting-events?year=2024
   ├─> Display events with adjusted date preview
   ├─> User confirms import
   ├─> POST /api/planting-events/import-year
   │   └─> Backend creates new events with adjusted dates
   └─> Refresh calendar

4. User filters/searches
   ├─> Update filter state (searchQuery, categoryFilters, etc.)
   ├─> Recompute filtered events (useMemo)
   └─> Re-render calendar with filtered events
```

---

## API Integration Plan

### Existing Endpoints (from backend/app.py)

✅ `GET /api/planting-events` - Fetch all planting events
✅ `POST /api/planting-events` - Create new event
✅ `PUT /api/planting-events/<id>` - Update event (limited to completed/notes)
✅ `DELETE /api/planting-events/<id>` - Delete event
✅ `GET /api/frost-dates` - Fetch frost dates
✅ `POST /api/frost-dates` - Update frost dates
✅ `GET /api/plants` - Fetch plant database
✅ `GET /api/garden-beds` - Fetch garden beds

### New Endpoints Needed

#### 1. Enhanced Event Query
```python
GET /api/planting-events?start_date=2025-01-01&end_date=2025-12-31&garden_bed_id=5

Response:
[
  {
    "id": 1,
    "plantId": "tomato",
    "variety": "Brandywine",
    "gardenBedId": 5,
    "seedStartDate": "2025-03-01T00:00:00Z",
    "transplantDate": "2025-04-15T00:00:00Z",
    "expectedHarvestDate": "2025-07-01T00:00:00Z",
    "completed": false,
    "notes": "Plant in full sun"
  }
]
```

#### 2. Year Import Endpoint
```python
POST /api/planting-events/import-year

Request Body:
{
  "sourceYear": 2024,
  "eventIds": [1, 2, 3],  // Optional: specific events only
  "dateOffsetDays": 365,  // Adjust by +365 days
  "propertyId": 1
}

Response:
{
  "imported": 3,
  "events": [...]  // Created events
}
```

#### 3. Full Event Update
```python
PUT /api/planting-events/<id>

Request Body:
{
  "plantId": "tomato",
  "variety": "Brandywine",
  "gardenBedId": 5,
  "seedStartDate": "2025-03-01",
  "transplantDate": "2025-04-15",
  "expectedHarvestDate": "2025-07-01",
  "completed": true,
  "notes": "Grown successfully!"
}
```

#### 4. Batch Operations
```python
POST /api/planting-events/batch

Request Body:
{
  "action": "complete",  // or "uncomplete", "delete", "update"
  "eventIds": [1, 2, 3],
  "updates": {  // For "update" action
    "gardenBedId": 5
  }
}

Response:
{
  "updated": 3,
  "events": [...]
}
```

---

## Risk Assessment & Mitigation

### Technical Risks

**Risk 1: Calendar Grid Performance with Many Events**
- **Impact:** Slow rendering if user has 100+ planting events
- **Likelihood:** Medium
- **Mitigation:**
  - Lazy load events by date range (only fetch visible month)
  - Virtual scrolling for event lists (react-window)
  - Memoize event grouping calculations (useMemo)
  - Debounce search/filter operations
  - Profile with React DevTools

**Risk 2: Mobile Calendar Grid Usability**
- **Impact:** Calendar grid may be too cramped on mobile screens (< 768px)
- **Likelihood:** High
- **Mitigation:**
  - Mobile-first design approach
  - Default to list view on mobile
  - Swipe navigation for month changes
  - Simplified event markers on mobile (just colored dots)
  - Consider week view for very small screens (< 375px)
  - Extensive mobile testing

**Risk 3: Date/Timezone Handling Edge Cases**
- **Impact:** Planting dates off by one day due to timezone issues
- **Likelihood:** Medium
- **Mitigation:**
  - Use date-fns consistently throughout
  - Store dates as ISO strings in backend
  - Backend already has `parse_iso_date` helper
  - Use `startOfDay` to normalize dates
  - Test across timezones (UTC, EST, PST)

**Risk 4: Bundle Size Increase**
- **Impact:** Larger JavaScript bundle, slower page load
- **Likelihood:** Low (custom calendar, no new heavy dependencies)
- **Mitigation:**
  - Custom calendar grid (~5KB additional code)
  - Tree-shake date-fns (import only needed functions)
  - Code-split YearImportModal (lazy load)
  - Monitor bundle size with webpack-bundle-analyzer

### UX Risks

**Risk 1: Breaking Existing Users' Workflow**
- **Impact:** Users accustomed to list view may be confused by grid view
- **Likelihood:** Medium
- **Mitigation:**
  - Keep list view as option (toggle button)
  - Default to user's last used view (localStorage)
  - Add onboarding tooltip: "✨ New! Visual calendar grid"
  - Gradual rollout with feature flag (optional)
  - User feedback collection

**Risk 2: Cluttered Calendar with Many Events on Same Day**
- **Impact:** Multiple events on one date hard to see (e.g., 5 crops planted same day)
- **Likelihood:** High (succession planting, multiple crops)
- **Mitigation:**
  - Stack event markers (show first 3, then "+2 more")
  - Click cell to expand full list in popover
  - Filter to show only specific event types (seed start, transplant, harvest)
  - Color-coded markers help distinguish
  - Hover tooltip with event details

**Risk 3: Complex Year Import UX**
- **Impact:** Users confused by year import, import wrong events, incorrect dates
- **Likelihood:** Medium
- **Mitigation:**
  - Clear preview before importing (table showing old → new dates)
  - Checkbox selection (uncheck unwanted events)
  - Show date adjustments clearly (e.g., "March 15, 2024 → March 15, 2025")
  - Confirmation dialog before import
  - Undo button after import (Phase 3+) or at least "Delete all imported"

**Risk 4: Sidebar Takes Too Much Space on Desktop**
- **Impact:** Calendar grid cramped on smaller desktop screens (< 1200px)
- **Likelihood:** Medium
- **Mitigation:**
  - Collapsible sidebar (toggle button)
  - Persist sidebar state (localStorage)
  - Default collapsed on screens < 1024px
  - Responsive width (20% of screen vs fixed 250px)

---

## Success Metrics

### Phase 1 (Foundation)
- [ ] 100% of existing features still work
- [ ] Calendar grid renders correctly on all screen sizes
- [ ] Events appear on correct dates
- [ ] User can toggle between list and grid views
- [ ] No console errors or warnings

### Phase 2 (Enhanced UX)
- [ ] User can find and add crops 50% faster than list-only
- [ ] Search returns results in < 100ms (debounced)
- [ ] Modal loads in < 200ms
- [ ] Empty state has 80%+ positive feedback

### Phase 3 (Year Import)
- [ ] Year import completes in < 2 seconds for 50 events
- [ ] Date adjustment accuracy: 100% (no off-by-one errors)
- [ ] Batch operations complete in < 500ms for 10 events
- [ ] Calendar handles 100+ events without lag

### User Satisfaction
- [ ] User survey: 80%+ prefer grid view over list
- [ ] User survey: 90%+ find year import useful
- [ ] Zero critical bugs reported
- [ ] Feature adoption: 70%+ of users use grid view within 1 month

---

## Testing Strategy

### Unit Tests
- [ ] calculatePlantingDates() accuracy
- [ ] Date grouping functions
- [ ] Filter functions
- [ ] Date adjustment for year import

### Integration Tests
- [ ] Add planting event flow
- [ ] Delete planting event flow
- [ ] Toggle completion flow
- [ ] Year import flow

### E2E Tests (Playwright)
- [ ] User adds event via calendar click
- [ ] User searches for plant in sidebar
- [ ] User imports from previous year
- [ ] User performs batch operations
- [ ] Mobile calendar navigation

### Visual Regression Tests
- [ ] Calendar grid layout
- [ ] Event markers appearance
- [ ] Modal appearance
- [ ] Empty states

---

## Deployment Plan

### Phase 1 Rollout
1. Merge to development branch
2. Deploy to staging environment
3. Internal team testing (1 week)
4. Fix any bugs found
5. Deploy to production behind feature flag
6. Enable for 10% of users
7. Monitor metrics and feedback
8. Gradually roll out to 100%

### Phase 2 & 3 Rollout
- Same process as Phase 1
- Each phase can be deployed independently
- Feature flags allow partial rollout

---

## Future Enhancements (Post-Phase 3)

### Not in Scope for Initial Release
1. **Weather Integration** - Show forecast on calendar, frost warnings
2. **Multi-Property Calendar** - Filter by property, show all properties
3. **Print/Export** - PDF export, printable month view
4. **Recurring Events** - Weekly watering, monthly fertilizing reminders
5. **Quick Add from Plant Database** - "Plant Now" button on each plant
6. **AI Planting Suggestions** - Optimal planting dates based on historical data
7. **Crop Rotation Planning** - Multi-year rotation suggestions
8. **Pest/Disease Tracking** - Track issues on calendar
9. **Social Sharing** - Share calendar with friends/family
10. **Calendar Sync** - Export to Google Calendar, iCal

---

## Appendix: Color Coding System

### Plant Categories

| Category | Color | Tailwind Class | Example Plants |
|----------|-------|----------------|----------------|
| Vegetables | Green | `bg-green-500` | Tomato, Lettuce, Carrot |
| Herbs | Purple | `bg-purple-500` | Basil, Cilantro, Parsley |
| Fruits | Red | `bg-red-500` | Strawberry, Melon, Raspberry |
| Flowers | Pink | `bg-pink-500` | Marigold, Zinnia, Sunflower |
| Cover Crops | Brown | `bg-amber-700` | Clover, Rye, Buckwheat |

### Event Types

| Event Type | Icon | Color | Description |
|------------|------|-------|-------------|
| Seed Start | 🌱 | Blue | Start seeds indoors |
| Transplant | 🌿 | Green | Move seedlings outdoors |
| Direct Seed | 🥕 | Orange | Sow seeds directly in ground |
| Harvest | 🎉 | Yellow | Expected harvest date |

---

**Last Updated:** 2025-11-12
**Status:** Approved - Ready for Phase 1 Implementation
**Next Review:** After Phase 1 completion (Week 2)
