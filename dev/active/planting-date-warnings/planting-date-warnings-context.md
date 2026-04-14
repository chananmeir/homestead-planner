# Planting Date Warnings - Context

## Discovery Summary

**Date**: December 24, 2025
**Investigator**: Project Manager Agent
**Implementation Date**: December 24, 2025
**Status**: Phase 1A Complete - Ready for Testing

### What We Found

1. **Backend is Complete**: Full validation system exists and works
   - `/api/validate-planting` endpoint (app.py:1281-1340)
   - `season_validator.py` with daily soil temp precision
   - Integration with weather services, historical data
   - Protection offset calculations

2. **Frontend is Missing**: No calls to validation endpoint
   - PlantConfigModal: No validation before save
   - GardenDesigner: No validation when placing plants
   - No warnings shown to users

3. **Documentation was Misleading**: Dev docs claimed feature complete
   - `weather-soil-temp-validation/weather-soil-temp-validation-context.md:74` says "Line 377: Passes zipcode to /api/validate-planting"
   - **This is false** - grep shows NO calls to validate-planting in any .tsx file
   - Likely the backend was implemented but frontend integration was never done

## Key Files

### Backend (Already Complete)
- `backend/app.py` (lines 1281-1340): `/api/validate-planting` endpoint
- `backend/app.py` (lines 1343+): `/api/validate-plants-batch` endpoint
- `backend/season_validator.py`: Validation logic
  - `validate_planting_conditions()` (lines 45-283): Core validation
  - `validate_planting_for_property()` (lines 286-378): Property/zipcode wrapper
- `backend/historical_soil_temp.py`: Daily soil temp averages
- `backend/soil_temperature.py`: Current soil temp with adjustments
- `backend/weather_service.py`: Weather API integration

### Frontend (NOW COMPLETE)
- `frontend/src/types.ts` (lines 208-218): **NEW** ValidationWarning and ValidationResult interfaces
- `frontend/src/components/common/WarningDisplay.tsx`: **NEW** Warning display component
  - Styled divs with yellow (warning) or blue (info) backgrounds
  - Emoji icons for visual distinction
  - Maps array of warnings to UI elements
- `frontend/src/components/GardenDesigner.tsx` (lines 1129-1130): **UPDATED**
  - Now passes `plantingDate={dateFilter.date}` to PlantConfigModal
  - Now passes `bedId={activeBed?.id}` to PlantConfigModal
- `frontend/src/components/GardenDesigner/PlantConfigModal.tsx`: **UPDATED**
  - Lines 1-6: Added imports for ValidationWarning, ValidationResult, API_BASE_URL, WarningDisplay
  - Lines 13-14: Added plantingDate and bedId props to interface
  - Lines 43-44: Added warnings and validating state variables
  - Lines 84-139: **NEW** validation useEffect hook
    - Triggers when plant, plantingDate, plantingMethod, isOpen, or bedId changes
    - Reads zipcode from localStorage.weatherZipCode
    - Calls POST /api/validate-planting with credentials
    - Updates warnings state with response
    - Shows info message if no zipcode set
    - Gracefully handles API failures
  - Lines 314-339: **NEW** Warning display UI
    - Loading spinner while validating
    - WarningDisplay component showing all warnings
    - Positioned between "Planting Method" and "Quantity" sections

### Data Sources
- `localStorage.weatherZipCode`: User's location (set by WeatherAlerts)
- `Settings` table: `last_frost_date`, `first_frost_date`
- `plant_database.py`: Plant requirements (soil_temp_min, germinationTemp, frostTolerance)
- Open-Meteo Archive API: Historical daily soil temps (10-yr averages)
- Open-Meteo API: Current soil temps

## Current User Flow

1. User opens Garden Designer
2. User selects date in date filter (default: today)
3. User drags plant from palette to garden bed
4. PlantConfigModal opens
5. User selects variety, quantity, planting method
6. User clicks "Place Plant"
7. **NO VALIDATION HAPPENS**
8. Plant is saved to database with plantedDate = dateFilter.date

## Proposed User Flow (After Fix)

1. User opens Garden Designer
2. User selects date in date filter (default: today)
3. User drags plant from palette to garden bed
4. PlantConfigModal opens **WITH DATE PROP**
5. **NEW**: Modal calls `/api/validate-planting` automatically
6. **NEW**: If warnings exist, display them in modal
7. User sees warnings like:
   - ⚠️ "Soil too cold: Basil needs 70°F, June 1st averages 68°F historically (10-yr avg)"
   - ℹ️ "Marginal soil temp: Lettuce needs 45°F, March 15th averages 47°F (10-yr avg)"
8. User can:
   - Click "Place Anyway" to proceed
   - Click "Cancel" to abort
   - (Future) Click "Suggest better date" to see optimal range
9. Plant is saved with full awareness of conditions

## Validation Logic Details

### Validation Request
```typescript
POST /api/validate-planting
{
  plantId: "basil",
  plantingDate: "2025-06-01",
  zipcode: "53209",  // from localStorage.weatherZipCode
  bedId: 123,        // optional, for protection offset
  plantingMethod: "seed" | "transplant"
}
```

### Validation Response
```json
{
  "valid": false,
  "warnings": [
    {
      "type": "soil_temp_low",
      "message": "Soil typically too cold: Basil needs 70°F, June 1st averages 68.1°F historically (10-yr avg)",
      "severity": "warning"
    }
  ]
}
```

### Warning Severities
- `warning`: Blocking issue, should reconsider (red/yellow UI)
- `info`: Marginal or protected, FYI only (blue UI)

### Validation Types

#### Frost Risk
- Checks if tender/very-tender plants are placed before last spring frost or after first fall frost
- Accounts for protection_offset from season extensions (cold frames, row covers, etc.)
- Message examples:
  - "Frost risk: Tomato is frost-tender and your last frost is April 15"
  - "Frost risk mitigated: Tomato is frost-tender (last frost April 15), but cold frame provides +15°F protection"

#### Soil Temperature
- For **direct seed**: Uses `soil_temp_min` or `germinationTemp.min` from plant data
- For **transplant**: Uses 80% of seed requirement (minimum 40°F) - more lenient
- For **future dates** (>1 day ahead): Uses 10-year daily historical averages
- For **today/tomorrow**: Uses current measured soil temp from Open-Meteo
- Accounts for protection_offset from season extensions
- Message examples:
  - "Soil typically too cold: Basil needs 70°F, June 1st averages 68.1°F historically (10-yr avg)"
  - "Soil temp adequate with protection: Basil needs 70°F, June 1st averages 68°F but cold frame adds +15°F (~83°F)"
  - "Marginal soil temp: Lettuce needs 45°F, March 15th averages 47°F (10-yr avg)"

## Integration Points

### GardenDesigner → PlantConfigModal
**CURRENT**:
```typescript
<PlantConfigModal
  isOpen={showConfigModal}
  plant={pendingPlant}
  position={pendingPosition}
  planningMethod={activeBed?.planningMethod}
  onSave={handleConfigSave}
  onCancel={handleConfigCancel}
/>
```

**NEEDED**:
```typescript
<PlantConfigModal
  isOpen={showConfigModal}
  plant={pendingPlant}
  position={pendingPosition}
  planningMethod={activeBed?.planningMethod}
  plantingDate={dateFilter.date}  // NEW PROP
  bedId={activeBed?.id}           // NEW PROP (for protection)
  onSave={handleConfigSave}
  onCancel={handleConfigCancel}
/>
```

### PlantConfigModal Internal
**NEEDED**:
```typescript
useEffect(() => {
  if (!plant || !isOpen || !plantingDate) return;

  const validatePlanting = async () => {
    const zipcode = localStorage.getItem('weatherZipCode');
    if (!zipcode) {
      setWarnings([{
        type: 'no_location',
        message: 'Set your location in Weather Dashboard for planting validation',
        severity: 'info'
      }]);
      return;
    }

    const response = await fetch(`${API_BASE_URL}/api/validate-planting`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        plantId: plant.id,
        plantingDate: plantingDate,
        zipcode: zipcode,
        bedId: bedId,
        plantingMethod: plantingMethod
      })
    });

    const result = await response.json();
    setWarnings(result.warnings || []);
  };

  validatePlanting();
}, [plant, plantingDate, plantingMethod, isOpen]);
```

## Technical Decisions

### Decision 1: Validate on Modal Open (Not on Save Click)
**Rationale**: Immediate feedback is better UX. User sees warnings while configuring, not after clicking save.

### Decision 2: Allow Override ("Place Anyway" Button)
**Rationale**: User knows their situation better than historical averages. Maybe they have a microclimate, or want to experiment.

### Decision 3: Different Thresholds for Transplant vs Seed
**Rationale**: Already implemented in backend. Transplants are hardier, can handle cooler soil (80% of seed requirement).

### Decision 4: Use localStorage.weatherZipCode (Not Property)
**Rationale**: Already implemented pattern. Weather Dashboard sets this, all weather/soil features use it.

### Decision 5: Show Info-Level Warnings Too
**Rationale**: "Marginal" and "protected" conditions are useful to know, even if not blocking.

## Performance Considerations

### API Call Frequency
- Validation called once per modal open
- Not called on every keystroke/change
- Cached by browser if same params
- Backend has caching for historical soil temps (30 days)

### Fallback Behavior
- If zipcode not set: Skip soil temp validation, show only frost warnings (if frost dates configured)
- If API fails: Log error, don't block placement, show generic warning
- If plant has no soil_temp_min: Skip soil temp validation

## UI/UX Design

### Warning Display Location
**Option A** (RECOMMENDED): Between "Planting Method" and "Quantity" sections
- Natural flow: user picks method → sees warnings → adjusts or proceeds
- Warnings relate to method choice (different thresholds for seed vs transplant)

**Option B**: At bottom before action buttons
- Warnings appear after all inputs
- More prominent, but interrupts flow

### Warning Styling
```typescript
// Warning (severity: 'warning')
<div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
  <div className="flex items-start">
    <span className="text-yellow-400 text-xl mr-2">⚠️</span>
    <p className="text-sm text-yellow-800">{message}</p>
  </div>
</div>

// Info (severity: 'info')
<div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
  <div className="flex items-start">
    <span className="text-blue-400 text-xl mr-2">ℹ️</span>
    <p className="text-sm text-blue-800">{message}</p>
  </div>
</div>
```

### Button Behavior Options

**Option A** (RECOMMENDED): Keep "Place Plant" enabled, show warnings
- Warnings are advisory, not blocking
- User can read and decide
- Simpler implementation

**Option B**: Add "Place Anyway" button if warnings exist
- More explicit acknowledgment
- Two-step for risky placements
- More complex UI

## Error Handling

### No Zipcode Set
- Show info message: "Set your location in Weather Dashboard for planting validation"
- Allow placement (don't block)
- Only show frost warnings if frost dates configured

### API Failure
- Log error to console
- Don't block placement
- Show generic info: "Could not validate planting conditions"

### Invalid Date
- Should never happen (date comes from DateFilter)
- If it does: Skip validation, allow placement

## Implementation Summary

### Phase 1A Complete ✅
1. ✅ Created TypeScript types (ValidationWarning, ValidationResult)
2. ✅ Created WarningDisplay component with proper styling
3. ✅ Added validation API call to PlantConfigModal
4. ✅ Passed plantingDate and bedId props from GardenDesigner
5. ✅ Integrated WarningDisplay into modal UI
6. ✅ Added loading state and error handling
7. ✅ TypeScript compilation passes

### Phase 1B Complete ✅
1. ✅ Selected button behavior: Keep "Place Plant" enabled (advisory warnings)
2. ✅ Added visual warning indicator to Place Plant button
   - Button changes from green to yellow when warnings present
   - Badge shows count of warning-severity items
   - Button text changes to "Place Plant Anyway" when warnings exist
   - Info-level warnings don't change button appearance (only warning-severity does)
3. ✅ Implementation details (PlantConfigModal.tsx lines 383-397):
   - Conditional className based on warning severity
   - Badge with white background, yellow text, shows warning count
   - Text appends "Anyway" when warnings detected

### Files Changed
**Created**:
- `frontend/src/components/common/WarningDisplay.tsx` (49 lines)

**Modified**:
- `frontend/src/types.ts` (+10 lines: ValidationWarning, ValidationResult interfaces)
- `frontend/src/components/GardenDesigner/PlantConfigModal.tsx` (+57 lines: validation logic, UI)
- `frontend/src/components/GardenDesigner.tsx` (+2 lines: pass plantingDate, bedId props)

**No Backend Changes Required**: Backend validation system already complete

### Next Steps

### Immediate (User Testing Required) ⚠️ PHASE 1A & 1B READY
1. ✅ Start application (backend + frontend)
2. ✅ Set zipcode in Weather Dashboard (e.g., "53209" for Milwaukee)
3. Test scenarios:
   - Early spring: Set date to March 15, drag basil → expect soil temp warning + yellow button
   - Late fall: Set date to November 15, drag tomato → expect frost warning + yellow button
   - Change planting method: Toggle Direct Seed ↔ Transplant → warnings should update
   - Protected bed: If bed has season extension, warnings should mention protection
   - No zipcode: Remove localStorage.weatherZipCode → expect info message (blue)
   - Warning badge: Verify count badge appears on button when warnings present
   - Button color: Verify button is yellow when warning-severity exists, green for info-only
   - Verify "Place Plant Anyway" text appears when warnings present

### Phase 2 Complete ✅ (December 25, 2025)
1. ✅ Optimal date suggestions
   - Backend: `suggest_optimal_date_range()` function created (season_validator.py:381-514)
   - Finds earliest safe planting date within 120-day window
   - Returns optimal 3-week planting range
   - API: `/api/validate-planting` now includes `suggestion` field when warnings exist
   - Frontend: WarningDisplay shows green suggestion box with optimal window
   - "Change Date" button updates dateFilter in GardenDesigner
   - Full integration: PlantConfigModal → WarningDisplay → GardenDesigner

**Files Modified (Phase 2)**:
- `backend/season_validator.py`: Added `suggest_optimal_date_range()` function
- `backend/app.py`: Updated `/api/validate-planting` to include suggestions
- `frontend/src/types.ts`: Added `DateSuggestion` interface
- `frontend/src/components/common/WarningDisplay.tsx`: Added suggestion display and button
- `frontend/src/components/GardenDesigner/PlantConfigModal.tsx`: Wired suggestion to WarningDisplay
- `frontend/src/components/GardenDesigner.tsx`: Added `onDateChange` callback

### Phase 3 Complete ✅ (December 25, 2025)
1. ✅ Plant palette validation indicators
   - Batch validation on date change using `/api/validate-plants-batch`
   - Visual indicators: ✓ (good), ⚠️ (warning), ℹ️ (info)
   - Tooltips show specific warning messages on hover
   - Auto-validates first 50 filtered plants when date changes
   - Color-coded indicators: green (safe), yellow (warnings), blue (info)

**Files Modified (Phase 3)**:
- `frontend/src/components/common/PlantPalette.tsx`:
  - Added `plantingDate` prop
  - Added batch validation useEffect
  - Added `validationStatus` state and API call
  - Updated `DraggablePlantItem` with indicators and tooltips
- `frontend/src/components/GardenDesigner.tsx`: Passed `plantingDate` to PlantPalette

### Future (Phase 4) - Deferred
1. Succession planting integration
   - Show warnings for auto-calculated succession dates
   - Visual indicators in succession preview
2. Timeline integration
   - Color-code timeline events based on validation status
   - Show warning icons on problematic dates
3. Calendar view color-coding
   - Highlight dates with validation issues
   - Tooltip preview of warnings

**Note**: Phase 4 integrations are complex and should be implemented when these views are actively being used. The validation infrastructure is complete and can be easily integrated when needed.

---

**Last Updated**: December 25, 2025 (Phases 2 & 3 complete)
**Next Review**: After user testing Phases 2 & 3
