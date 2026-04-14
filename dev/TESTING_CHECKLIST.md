# Testing Checklist for Homestead Planner

**Purpose**: Ensure critical user flows work correctly after making changes. Use this checklist before committing major changes to prevent regressions.

---

## Configure Plant Modal (GardenDesigner)

### Critical User Flows

#### 1. Planting Date Validation & Suggestions
**When to test**: After any changes to PlantConfigModal, WarningDisplay, or validation logic

- [ ] **Crop with varieties available** (e.g., Tomato):
  - [ ] Open modal WITHOUT selecting variety
    - Suggestions (green box) should be visible
    - Warnings should NOT be visible yet
  - [ ] Select a variety from dropdown
    - Both warnings AND suggestions should appear (if applicable)
  - [ ] Click "Use [date]" button on suggestion
    - Modal should update with new date
    - Validation should re-run for new date

- [ ] **Crop without varieties** (custom entry):
  - [ ] Open modal
    - Both warnings AND suggestions should appear immediately (if applicable)

- [ ] **Different planting dates**:
  - [ ] Too early (before last frost):
    - Should show frost warning
    - Should show optimal date suggestion
  - [ ] Optimal date:
    - Should show no warnings
    - May show suggestion with optimal range
  - [ ] Too late (soil too hot):
    - Should show heat warning
    - Should show optimal date suggestion

#### 2. Variety Selection & Filtering
**When to test**: After changes to seed inventory, variety filtering, or variety dropdown

- [ ] **Personal seeds only** (default):
  - [ ] Dropdown shows only user's personal seed varieties
  - [ ] Count matches number of personal varieties

- [ ] **Include catalog varieties** (checkbox):
  - [ ] Check "Include catalog varieties"
  - [ ] Dropdown now includes global catalog seeds
  - [ ] Count increases to include catalog varieties

- [ ] **No varieties available**:
  - [ ] Text input appears instead of dropdown
  - [ ] User can enter custom variety name
  - [ ] Helpful text suggests checking catalog

#### 3. Quantity & Succession Planting
**When to test**: After changes to quantity input, succession planting, or space calculations

- [ ] **Square-Foot Gardening**:
  - [ ] Dual input UI shows (squares vs total plants)
  - [ ] Changing squares updates total plants
  - [ ] Changing total plants updates squares
  - [ ] Plants per square calculation is correct

- [ ] **Succession planting**:
  - [ ] Enable succession planting checkbox
  - [ ] Set week interval (e.g., 2 weeks)
  - [ ] Preview dates show correctly
  - [ ] Save creates multiple plantings with staggered dates

#### 4. Position Editing
**When to test**: After changes to grid label input or coordinate conversion

- [ ] Edit grid position (e.g., "A1" to "B3"):
  - [ ] Input accepts valid grid labels
  - [ ] Invalid labels show error message
  - [ ] Coordinates update correctly
  - [ ] Preview reflects new position

#### 5. Trellis Selection
**When to test**: After changes to trellis logic or property designer

- [ ] **Trellis-required plant** (e.g., Grapes):
  - [ ] Trellis dropdown appears
  - [ ] Shows available trellises
  - [ ] Shows capacity information
  - [ ] Prevents save without trellis selection

---

## Garden Planner (Season Planning)

### Critical User Flows

#### 1. Seed Selection with Manual Quantity
**When to test**: After changes to GardenPlanner, space calculations, or seed selection

- [ ] **Step 1: Select Seeds**:
  - [ ] Check seed checkbox - quantity input appears
  - [ ] Enter manual quantity
  - [ ] Space estimate appears next to seed
  - [ ] Space summary updates at bottom

- [ ] **Space Summary**:
  - [ ] Shows breakdown by planning method (SFG, MIGardener, Intensive, Row)
  - [ ] Shows cells needed / cells available
  - [ ] Shows utilization percentage
  - [ ] Visual indicators: ✓ (under 80%), ⚠️ (80-100%), ❌ (over 100%)

#### 2. Succession Planting Strategy
**When to test**: After changes to succession planting wizard or timeline view

- [ ] **Step 2: Succession Strategy**:
  - [ ] Auto-calculated quantities show correctly
  - [ ] Succession multipliers apply correctly
  - [ ] User can override quantities
  - [ ] Final plan reflects strategy choice

#### 3. Garden Snapshot
**When to test**: After changes to GardenSnapshot, PlantedItem queries, or snapshot endpoint

- [ ] **Navigation**:
  - [ ] Click "Garden Snapshot" button from plan list header
  - [ ] "Back to Plans" link returns to list view

- [ ] **Date Picker**:
  - [ ] Defaults to today's date
  - [ ] Changing date auto-fetches new data

- [ ] **Summary Cards**:
  - [ ] Total Plants count matches table total
  - [ ] Unique Varieties count matches table row count
  - [ ] Beds with Plants count is correct

- [ ] **Plant Table**:
  - [ ] Sorted by quantity (highest first)
  - [ ] Click row to expand per-bed breakdown
  - [ ] Click again to collapse
  - [ ] Per-bed quantities sum to row total

- [ ] **Edge Cases**:
  - [ ] Date with no active plants shows empty state message
  - [ ] Date in the far future (plants with NULL harvest_date still show)
  - [ ] Date before any plantings shows empty state

---

## Planting Calendar

### Critical User Flows

#### 1. Add Crop Modal
**When to test**: After changes to AddCropModal or planting logic

- [ ] **Calendar view**:
  - [ ] Click date to open modal
  - [ ] Crop selection works
  - [ ] Variety dropdown populates
  - [ ] Position selector shows available spots
  - [ ] Save creates planting event

- [ ] **Timeline view**:
  - [ ] Click "Add Crop" button
  - [ ] Same as calendar view functionality

#### 2. Timeline View
**When to test**: After changes to timeline rendering or conflict detection

- [ ] **Timeline bars**:
  - [ ] Show correct date ranges
  - [ ] Color-coded by status (planned, planted, harvesting, completed)
  - [ ] Overlapping bars show conflicts
  - [ ] Click bar opens detail modal

- [ ] **Available Spaces View**:
  - [ ] Shows open planting spots
  - [ ] Respects bed capacity
  - [ ] Updates after adding/removing crops

---

## Seed Inventory

### Critical User Flows

#### 1. CSV Import
**When to test**: After changes to CSV import service or parsing logic

- [ ] **Upload CSV**:
  - [ ] Select file (valid CSV)
  - [ ] Preview shows parsed data
  - [ ] Column mapping works
  - [ ] Import creates seeds
  - [ ] Error handling for invalid data

---

## Property Designer

### Critical User Flows

#### 1. Garden Bed Creation
**When to test**: After changes to PropertyDesigner or bed creation

- [ ] **Create new bed**:
  - [ ] Open PropertyDesigner
  - [ ] Click "Add Bed"
  - [ ] Fill in dimensions (length, width)
  - [ ] Select planning method
  - [ ] Set sun exposure
  - [ ] Save creates bed in database

---

## General UI/UX

### Critical Elements
**When to test**: After any UI changes

- [ ] **Toast notifications**:
  - [ ] Success messages appear (green)
  - [ ] Error messages appear (red)
  - [ ] Warning messages appear (yellow)
  - [ ] Messages auto-dismiss after timeout

- [ ] **Modal behavior**:
  - [ ] Opens correctly
  - [ ] Closes on cancel
  - [ ] Closes on save (success)
  - [ ] ESC key closes modal
  - [ ] Click outside closes modal

- [ ] **Loading states**:
  - [ ] Spinners show during async operations
  - [ ] Buttons disable during submission
  - [ ] No double-submission possible

---

## API Integration

### Critical Endpoints
**When to test**: After backend changes or API refactoring

- [ ] **Validation endpoints**:
  - [ ] `/api/validate-planting` - Returns warnings and suggestions
  - [ ] `/api/validate-planting-date` - Returns forward-looking warnings

- [ ] **CRUD endpoints**:
  - [ ] GET requests return correct data
  - [ ] POST requests create records
  - [ ] PUT requests update records
  - [ ] DELETE requests remove records

---

## Performance

### Performance Checks
**When to test**: After changes affecting data loading or rendering

- [ ] **Page load times**:
  - [ ] Initial load < 3 seconds
  - [ ] Subsequent loads < 1 second (cached)

- [ ] **Large datasets**:
  - [ ] 100+ planting events render smoothly
  - [ ] 500+ seed varieties load without lag
  - [ ] Pagination works correctly

---

## Browser Compatibility

### Supported Browsers
**When to test**: Before major releases

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

---

## Accessibility

### Basic Accessibility
**When to test**: After UI changes

- [ ] Keyboard navigation works
- [ ] Tab order is logical
- [ ] Focus indicators visible
- [ ] Labels for form inputs

---

## Notes

### When to Use This Checklist
- Before committing major changes to main branch
- Before creating pull requests
- After refactoring critical components
- When fixing regressions

### How to Use This Checklist
1. Copy relevant sections to your task markdown
2. Check off items as you test
3. Document any failures or issues found
4. Retest after fixes

### Updating This Checklist
- Add new critical flows as features are added
- Remove obsolete flows as features are deprecated
- Keep descriptions concise but clear
- Include "why to test" for context

---

**Last Updated**: 2026-01-28
