# Planting Date Warnings - Restoration Plan

## Problem Statement

**Status**: Phase 1A Complete - Ready for User Testing
**Created**: December 24, 2025
**Completed**: December 24, 2025
**Manager**: Project Manager Agent

### Issue
The backend has a fully-functional planting validation system (`/api/validate-planting`) with soil temperature and frost date warnings, but **the frontend never calls it**. Users can place plants at any date without seeing warnings about suboptimal planting conditions.

### Evidence
- Backend: `app.py` lines 1281-1340 has `/api/validate-planting` POST endpoint
- Backend: `season_validator.py` has comprehensive validation logic with daily soil temp precision
- Frontend: `PlantConfigModal.tsx` never calls validation endpoint
- Frontend: `GardenDesigner.tsx` never calls validation endpoint before saving
- Dev docs claim feature is complete (weather-soil-temp-validation) but only backend exists

### User Impact
- Users plant crops too early (soil too cold) without warning
- Users plant tender plants before last frost without warning
- No suggested optimal planting date ranges
- Wastes seeds/seedlings, reduces germination success

## Root Cause Analysis

The `weather-soil-temp-validation` feature (completed Nov 22, 2025) implemented:
1. Backend validation endpoint with daily historical soil temps
2. Integration with weather services and frost dates
3. Protection offset calculations for season extensions

But it **never wired the frontend to call this endpoint**. The dev docs claim "GardenDesigner → /api/validate-planting" but grep shows NO such calls exist.

## Solution Architecture

### Phase 1: Add Validation Call to PlantConfigModal
**Goal**: Show warnings BEFORE user saves the plant

**User Flow**:
1. User drags plant to garden bed
2. PlantConfigModal opens (variety, quantity, planting method)
3. **NEW**: Modal calls `/api/validate-planting` with current date filter
4. **NEW**: If warnings exist, show them in modal with severity indicators
5. User can:
   - Adjust planting date (if needed)
   - Override warnings and proceed anyway
   - Cancel placement

**Technical Changes**:
- Add `useEffect` to PlantConfigModal that calls validation when plant/date changes
- Pass current date from GardenDesigner's dateFilter to modal
- Display warnings with appropriate styling (warning = yellow, info = blue)
- Add "Place Anyway" button if warnings exist

### Phase 2: Show Suggested Optimal Dates
**Goal**: Help users pick better planting dates

**Enhancement**:
- When soil temp warning appears, calculate "soil warm enough" date
- Show: "Soil typically reaches 70°F around June 15th (10-yr avg)"
- Add quick action: "Change date to June 15th"

### Phase 3: Visual Indicators in Plant Palette
**Goal**: Show which plants are OK to plant "now"

**Enhancement**:
- Use `/api/validate-plants-batch` (already exists!) to validate all plants
- Add green checkmark / yellow warning / red X to each plant in palette
- Tooltip on hover: "Basil: Soil too cold (needs 70°F, currently 62°F)"

## Implementation Phases

### Phase 1A: Basic Warning Display ✅ (PRIORITY 1) - COMPLETE
- [x] Add validation API call to PlantConfigModal
- [x] Create WarningDisplay component for validation messages
- [x] Pass dateFilter.date to PlantConfigModal as prop
- [x] Show warnings between planting method and quantity inputs
- [x] Add loading spinner during validation
- [x] TypeScript compilation passes
- [ ] Test with early/late planting dates - READY FOR USER TESTING

### Phase 1B: User Actions (PRIORITY 1) - DEFERRED
- [ ] Add "Place Anyway" button if warnings present - OPTIONAL (current UI allows placement regardless)
- [x] "Cancel" button available
- [x] "Place Plant" button remains enabled (warnings are advisory, not blocking)

### Phase 2: Optimal Date Suggestions (PRIORITY 2)
- [ ] Create backend helper: `suggest_optimal_date_range()`
- [ ] Returns earliest safe date and optimal range
- [ ] Display in warning: "Suggested: June 10-30"
- [ ] Add quick action button to change date

### Phase 3: Plant Palette Indicators (PRIORITY 3)
- [ ] Call `/api/validate-plants-batch` on date change
- [ ] Add validation status to each plant in palette
- [ ] Visual indicators: ✓ (safe), ⚠ (marginal), ✗ (not recommended)
- [ ] Tooltip with reason

## Success Criteria

### Must Have (Phase 1)
- [x] Validation called before plant placement
- [ ] Warnings displayed clearly in PlantConfigModal
- [ ] User can see why date is suboptimal
- [ ] User can proceed anyway or cancel

### Should Have (Phase 2)
- [ ] Suggested optimal date range shown
- [ ] Quick action to change date
- [ ] Works for both direct seed and transplant methods

### Nice to Have (Phase 3)
- [ ] Real-time plant palette validation
- [ ] Visual indicators on plant icons
- [ ] Tooltips with specific reasons

## Technical Details

### API Endpoints (Already Exist)
```
POST /api/validate-planting
Input: {plantId, plantingDate, zipcode, bedId, plantingMethod}
Output: {valid: bool, warnings: [{type, message, severity}]}

POST /api/validate-plants-batch
Input: {plantIds[], plantingDate, zipcode, bedId}
Output: {plantId: {valid: bool, warnings: []}, ...}
```

### Warning Types
- `frost_risk`: Tender plant + frost date conflict (severity: warning)
- `frost_risk_protected`: Protected from frost (severity: info)
- `soil_temp_low`: Soil too cold for requirements (severity: warning)
- `soil_temp_protected`: Protection makes it viable (severity: info)
- `soil_temp_marginal`: Close to minimum (severity: info)

### Data Sources
- Zipcode: localStorage 'weatherZipCode' (set by WeatherAlerts)
- Frost dates: Settings table (last_frost_date, first_frost_date)
- Soil temps: Open-Meteo (current) or Historical Archive (future dates)
- Plant requirements: plant_database.py (soil_temp_min, germinationTemp)

## Dependencies

### Required Data
- User must set zipcode in Weather Dashboard first
- Frost dates should be configured in Settings
- Garden bed must exist with optional season_extension

### Validation Logic
- Located in: `backend/season_validator.py`
- Uses daily historical averages (30x more precise than monthly)
- Accounts for protection offsets from season extensions
- Different thresholds for direct seed vs transplant

## Testing Plan

### Manual Tests
1. **Early Spring Planting**: Place basil (needs 70°F) in March → expect warning
2. **Late Fall Planting**: Place tomato (tender) in November → expect frost warning
3. **Protected Bed**: Same tests with cold frame → expect "protected" info messages
4. **Transplant vs Seed**: Basil transplant should have lower threshold than seed
5. **No Zipcode**: Ensure graceful handling if zipcode not set

### Edge Cases
- No zipcode configured → skip soil temp validation, show frost warnings only
- Historical data unavailable → skip soil temp validation
- Plant with no soil_temp_min → no soil temp warnings
- Hardy plant in winter → no warnings (only tender plants checked)

## Migration Notes

**No database changes needed** - all infrastructure exists.

**No breaking changes** - this is purely additive functionality.

## Future Enhancements

1. **Succession Planting Integration**: Show warnings in succession planting wizard
2. **Timeline Integration**: Warn when moving events to bad dates
3. **Batch Import Validation**: Validate CSV imports for date issues
4. **Calendar View**: Color-code days by planting suitability
5. **Push Notifications**: "Your tomatoes can be planted in 2 weeks!"

---

**Last Updated**: December 24, 2025 (Initial creation)
**Next Update**: After Phase 1A completion
