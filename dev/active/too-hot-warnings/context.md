# Too Hot Weather Warnings - Context

## Key Files

### Backend
- **`backend/season_validator.py`** (lines 45-301)
  - `validate_planting_conditions()` - Main validation function
  - Lines 153-300: Soil temperature validation logic
  - Lines 175-248: Future date validation using historical data
  - Lines 250-296: Current date validation using live data

- **`backend/plant_database.py`**
  - Contains plant data with `heat_tolerance` field
  - Values: 'low', 'medium', 'high', 'excellent'
  - Cool-weather crops have `heat_tolerance: 'low'`

- **`backend/historical_soil_temp.py`**
  - `get_historical_daily_soil_temps()` - Returns daily averages for a month
  - Used for future date validation

- **`backend/soil_temperature.py`**
  - `get_soil_temperature_with_adjustments()` - Returns current soil temp
  - Used for today/tomorrow validation

## Current "Too Cold" Logic Pattern

### Temperature Thresholds
- **Minimum Required**: `soil_temp_min` from plant database
- **Marginal**: Within 5°F of minimum
- **Optimal**: `soil_temp_min + 10°F` or higher
- **Too Hot** (NEW): `soil_temp_min + 20°F` or higher

### Validation Flow
```
1. Get plant data from plant_database
2. Determine soil_temp_min based on planting_method
   - 'seed': Use plant's soil_temp_min directly
   - 'transplant': Use 80% of soil_temp_min (min 40°F)
3. Check if planting date is future (>1 day ahead)
   - YES: Get historical daily average for that date
   - NO: Get current measured soil temperature
4. Apply protection_offset to effective temperature
5. Compare effective temp to thresholds
6. Generate appropriate warning
```

### Warning Severity Levels
- **'warning'**: Blocking issue (too cold/hot for plant)
- **'info'**: Marginal conditions or protection mitigates issue

### Existing Warning Types
- `frost_risk` - Tender plant before/after frost dates
- `frost_risk_protected` - Frost risk mitigated by protection
- `soil_temp_low` - Soil too cold for germination/growth
- `soil_temp_marginal` - Soil close to minimum threshold
- `soil_temp_protected` - Protection makes cold soil viable

### NEW Warning Type
- `soil_temp_high` - Soil too hot for cool-weather crops

## Temperature Threshold Details

### Example Calculations
| Plant | soil_temp_min | Too Hot Threshold | Rationale |
|-------|--------------|-------------------|-----------|
| Lettuce | 40°F | 60°F | Bolts in warm weather |
| Spinach | 40°F | 60°F | Becomes bitter when hot |
| Radish | 40°F | 60°F | Becomes woody, pungent |
| Arugula | 40°F | 60°F | Bolts quickly in heat |
| Broccoli | 40°F | 60°F | Buttons (forms tiny heads) |
| Peas | 40°F | 60°F | Stops flowering, poor yield |

### Heat Protection Limitations
Unlike cold protection (row covers add warmth), heat protection is limited:
- **Shade cloth**: Can reduce air temp but not soil temp much
- **Mulch**: Helps but not included in protection_offset
- **Season extension structures**: Designed for cold, not heat
- **Conclusion**: Don't use protection_offset to mitigate "too hot" warnings

## Code Implementation Pattern

### Location in validate_planting_conditions()
Insert new check after line 297 (after soil temp validation), before line 301 (return statement)

### Code Structure
```python
# Check for "too hot" conditions (mirrors "too cold" logic)
heat_tolerance = plant.get('heat_tolerance', 'medium')
is_cool_weather_crop = heat_tolerance == 'low'

if is_cool_weather_crop and soil_temp_min:
    max_acceptable_temp = soil_temp_min + 20  # Too hot threshold

    # Use same temperature source as "too cold" check
    # (either avg_soil_temp from historical or current_soil_temp from live)

    if actual_temp > max_acceptable_temp:
        warnings.append({
            'type': 'soil_temp_high',
            'message': f"Too hot: {plant_name} prefers cool weather. Soil temperature {actual_temp:.0f}°F exceeds optimal range (max {max_acceptable_temp:.0f}°F). May bolt or perform poorly.",
            'severity': 'warning'
        })
```

## Integration Points

### Frontend Display
Warnings are returned in the API response and displayed in:
- `frontend/src/components/PlantingCalendar/AddCropModal/index.tsx` - Shows warnings when adding plantings
- `frontend/src/components/common/WarningDisplay.tsx` - Renders warning UI

No frontend changes needed - warning system is generic.

### API Endpoints
- `POST /api/validate-planting` - Main validation endpoint
- Returns: `{ valid: bool, warnings: [], suggestion: {} }`

## Plants Affected by "Too Hot" Warnings

### Confirmed Low Heat Tolerance
Based on plant_database.py analysis:
- Arugula (soil_temp_min: 40°F, heat_tolerance: low)
- Asian Greens (soil_temp_min: varies, heat_tolerance: low)
- Bok Choy (soil_temp_min: 50°F, heat_tolerance: low)
- Broccoli (soil_temp_min: 40°F, heat_tolerance: low)
- Brussels Sprouts (soil_temp_min: 40°F, heat_tolerance: low)
- Cabbage (soil_temp_min: 40°F, heat_tolerance: low)
- Cauliflower (soil_temp_min: 40°F, heat_tolerance: low)
- Celery (soil_temp_min: 60°F, heat_tolerance: low)
- Cilantro (soil_temp_min: 55°F, heat_tolerance: low)
- Endive (soil_temp_min: 40°F, heat_tolerance: low)
- Fennel (soil_temp_min: 50°F, heat_tolerance: low)
- Kohlrabi (soil_temp_min: 45°F, heat_tolerance: low)
- Lettuce (soil_temp_min: 40°F, heat_tolerance: low)
- Mizuna (soil_temp_min: 45°F, heat_tolerance: low)
- Mustard Greens (soil_temp_min: 40°F, heat_tolerance: low)
- Peas (soil_temp_min: 40°F, heat_tolerance: low)
- Radicchio (soil_temp_min: 45°F, heat_tolerance: low)
- Radish (soil_temp_min: 40°F, heat_tolerance: low)
- Shungiku (soil_temp_min: 40°F, heat_tolerance: low)
- Spinach (soil_temp_min: 40°F, heat_tolerance: low)
- Turnip (soil_temp_min: 40°F, heat_tolerance: low)

**Total**: 21 cool-weather crops will show "too hot" warnings when planted in hot conditions

## Design Decisions

### Why +20°F Threshold?
- Based on agricultural research: cool-weather crops perform poorly 10-20°F above minimum
- Lettuce: 40°F min → 60°F+ causes bolting
- Conservative threshold prevents false positives
- Matches existing +10°F "optimal" threshold pattern

### Why Only 'low' Heat Tolerance?
- 'medium' heat tolerance plants can handle fluctuations
- 'high'/'excellent' plants thrive in heat
- 'low' = definitively cool-weather crops that bolt/fail in heat

### Why Not Use Protection Offset?
- Protection structures (cold frames, row covers) INCREASE temperature
- No common protection method DECREASES soil temperature
- Shade cloth affects air temp more than soil temp
- Would give false sense of security

## Implementation Complete

### Code Changes Made
**File**: `backend/season_validator.py`

**Location 1: Future Date Validation** (lines 248-261)
- Added after existing "too cold" checks for future dates
- Uses `avg_soil_temp` from historical daily averages
- Checks if soil temperature exceeds `soil_temp_min + 20°F`
- Only applies to plants with `heat_tolerance == 'low'`

**Location 2: Current Date Validation** (lines 313-326)
- Added after existing "too cold" checks for current dates
- Uses `current_soil_temp` from live soil temperature API
- Same threshold logic as future dates
- Consistent warning message format

### Example Warning Messages

**Future Date (Historical Data)**:
```
"Too hot: Lettuce prefers cool weather. July 15 averages 68°F, exceeds optimal range (max 60°F). May bolt or perform poorly (10-yr avg)"
```

**Current Date (Live Data)**:
```
"Too hot: Radish prefers cool weather. Current soil temperature 65°F exceeds optimal range (max 60°F). May bolt or perform poorly"
```

### Pattern Verification
✅ Mirrors existing "too cold" logic structure
✅ Uses same data sources (historical vs current)
✅ Same warning severity system ('warning' for blocking)
✅ Same message formatting style
✅ Protection offset correctly NOT applied to heat check
✅ Proper indentation and code style

---
**Last Updated**: 2026-01-05 (Implementation Complete)
