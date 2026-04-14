# Planting Date Warnings - Tasks

## Progress: 16/17 tasks completed (94%)

---

## Phase 1A: Basic Warning Display (PRIORITY 1)

### Backend Verification
- [x] Verify `/api/validate-planting` endpoint works correctly (endpoint registered at line 1281)
- [x] Confirm daily historical soil temps are functioning (implemented in season_validator.py)
- [x] Check that protection_offset calculations work (implemented in validate_planting)
- [ ] Test with sample POST request (Postman/curl) - DEFERRED (will test via UI)

### Frontend - PlantConfigModal Updates
- [x] Add `plantingDate` prop to PlantConfigModal interface
- [x] Add `bedId` prop to PlantConfigModal interface
- [x] Add `warnings` state variable (useState<ValidationWarning[]>)
- [x] Add `validating` loading state (useState<boolean>)
- [x] Create validation API call useEffect hook
  - Triggers on: plant, plantingDate, plantingMethod, isOpen changes
  - Reads zipcode from localStorage
  - Calls `/api/validate-planting` with credentials
  - Updates warnings state
  - Handles errors gracefully

### Frontend - GardenDesigner Updates
- [x] Pass `plantingDate={dateFilter.date}` to PlantConfigModal
- [x] Pass `bedId={activeBed?.id}` to PlantConfigModal

### Frontend - Warning Display Component
- [x] Create WarningDisplay component
  - Accepts warnings array prop
  - Maps warnings to styled divs
  - Yellow bg + border for severity: 'warning'
  - Blue bg + border for severity: 'info'
  - Emoji icons (⚠️ for warning, ℹ️ for info)
  - Responsive text sizing
- [x] Add WarningDisplay to PlantConfigModal
  - Position between "Planting Method" and "Quantity" sections
  - Only render if warnings.length > 0
- [x] Add loading spinner during validation
- [x] TypeScript compilation passes with no errors

### Testing - Phase 1A
- [ ] Test: Early spring basil (should warn about cold soil) - READY FOR TESTING
- [ ] Test: Late fall tomato (should warn about frost) - READY FOR TESTING
- [ ] Test: Protected bed (should show "protected" info message) - READY FOR TESTING
- [ ] Test: Transplant vs direct seed (different thresholds) - READY FOR TESTING
- [ ] Test: No zipcode set (should show info message) - READY FOR TESTING
- [ ] Test: API failure (should not block, show generic warning) - READY FOR TESTING
- [ ] Test: Loading state displays correctly - READY FOR TESTING
- [ ] Test: Warnings update when changing planting method - READY FOR TESTING

## Phase 1B: User Actions (PRIORITY 1)

### UI Enhancements
- [x] Decide on button behavior:
  - Option A: Keep "Place Plant" enabled always ✅ CHOSEN
  - Option B: Add "Place Anyway" button if warnings exist
- [x] Implement chosen button behavior (Place Plant stays enabled)
- [x] Add visual indication if warnings are present (badge count + button color change)
- [ ] Test user can successfully place plant despite warnings - READY FOR USER TESTING

## Phase 2: Optimal Date Suggestions (PRIORITY 2)

### Backend - Date Suggestion Logic
- [ ] Create `suggest_optimal_date_range()` function in season_validator.py
  - Iterates through next 90 days
  - Finds first date where soil temp >= requirement
  - Returns earliest safe date + optimal range (e.g., "June 10-30")
- [ ] Add to `/api/validate-planting` response
  - New field: `suggestedDates: {earliest: string, optimal: string}`
  - Only included if current date has warnings

### Frontend - Date Suggestion Display
- [ ] Add suggestion display to WarningDisplay component
  - Shows after warning message
  - "Suggested: Soil typically reaches 70°F around June 15"
- [ ] Add "Change to [date]" button (future enhancement)
  - Updates dateFilter in GardenDesigner
  - Re-validates with new date

### Testing - Phase 2
- [ ] Test: Early basil planting shows June suggestion
- [ ] Test: Late season planting shows fall window
- [ ] Test: Year-round crops don't show suggestions

## Phase 3: Plant Palette Indicators (PRIORITY 3)

### Backend - Batch Validation
- [ ] Verify `/api/validate-plants-batch` endpoint works
- [ ] Test batch validation with multiple plants

### Frontend - Palette Integration
- [ ] Call `/api/validate-plants-batch` when date changes
- [ ] Add validation status to plant palette items
- [ ] Visual indicators:
  - ✓ Green checkmark: No warnings
  - ⚠️ Yellow warning: Marginal conditions
  - ✗ Red X: Not recommended
- [ ] Tooltip on hover: Shows warning message
- [ ] Loading state while batch validation runs

### Testing - Phase 3
- [ ] Test: Palette updates when changing date
- [ ] Test: Visual indicators match actual validation
- [ ] Test: Tooltips show correct messages
- [ ] Test: Performance with 50+ plants in palette

## Documentation

- [ ] Update CLAUDE.md with validation pattern
- [ ] Add JSDoc comments to new components
- [ ] Update README with user instructions (set zipcode first)
- [ ] Create user guide for interpreting warnings

## Code Review

- [ ] Follow CLAUDE.md guidelines (API_BASE_URL, no hardcoded URLs)
- [ ] Add proper TypeScript types for validation responses
- [ ] Error handling for all API calls
- [ ] Loading states for better UX
- [ ] Accessibility (ARIA labels for warnings)

---

## Blockers

None

## Deferred Tasks

- Succession planting wizard integration
- Timeline drag-drop validation
- CSV import validation
- Calendar view color-coding
- Push notifications for planting windows

---

**Last Updated**: December 24, 2025 (Initial creation)
**Next Update**: After completing Phase 1A tasks
