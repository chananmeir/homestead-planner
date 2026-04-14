# Too Hot Weather Warnings - Implementation Plan

## Objective
Add "too hot" warnings to the planting validation system that work the same way as the existing "too cold" warnings. This will prevent users from planting cool-weather crops (like radishes, lettuce, spinach) during summer when they'll bolt or perform poorly.

## Background
The season_validator.py currently implements comprehensive "too cold" soil temperature warnings using historical and current soil temperature data. Cool-weather crops (those with `heat_tolerance: 'low'`) perform poorly when soil temperatures exceed their optimal range, causing bolting, bitter flavors, and poor germination.

## Implementation Strategy

### 1. Pattern Matching with Existing System
The "too hot" warnings will mirror the "too cold" warnings exactly:
- Use the same historical and current soil temperature data sources
- Follow the same validation flow in `validate_planting_conditions()`
- Use the same warning message format and severity levels
- Apply the same date-based routing (future dates use historical data, today/tomorrow use current data)

### 2. Temperature Threshold Calculation
For plants with `heat_tolerance == 'low'`:
- **Too Hot Threshold**: `soil_temp_min + 20°F`
- **Rationale**: Cool-weather crops like lettuce need 40°F minimum, perform poorly above 60°F
- **Example**: Lettuce (soil_temp_min=40°F) → too hot at 60°F+

### 3. Affected Plants
Plants with `heat_tolerance: 'low'` include:
- **Leafy Greens**: Arugula, Lettuce, Spinach, Asian Greens, Bok Choy, Endive, Radicchio, Mizuna
- **Brassicas**: Broccoli, Brussels Sprouts, Cabbage, Cauliflower, Kohlrabi, Celery
- **Root Vegetables**: Radish, Turnip
- **Others**: Peas, Cilantro, Fennel

### 4. Protection Structure Handling
Unlike frost protection (row covers, cold frames), heat protection is limited:
- **Note in warning**: Protection offsets won't help with heat (can't cool soil)
- **Message format**: Make clear that season extension structures don't mitigate heat

## Implementation Details

### File to Modify
- `backend/season_validator.py` - Add check in `validate_planting_conditions()` function

### Code Location
- Insert after existing "too cold" check (after line ~300)
- Place before function return statement
- Use same try-except error handling pattern

### Warning Structure
```python
{
    'type': 'soil_temp_high',
    'message': 'Too hot: {plant_name} prefers cool weather. Soil temperature {actual_temp}°F exceeds optimal range (max {max_temp}°F). May bolt or perform poorly.',
    'severity': 'warning'
}
```

### Date-Based Logic
1. **Future dates (>1 day ahead)**: Use historical daily averages
2. **Today/tomorrow**: Use current measured soil temperature
3. Match existing pattern for consistency

## Testing Recommendations
1. **Cool-weather crop in summer**: Lettuce planted July 15 → expect warning
2. **Cool-weather crop in spring**: Lettuce planted April 15 → no warning
3. **Warm-weather crop in summer**: Tomato planted July 15 → no warning
4. **Borderline case**: Plant with soil_temp_min=50°F at 69°F → no warning (just under 70°F threshold)
5. **Protection offset**: Verify protection offset doesn't affect "too hot" check

## Success Criteria
- [ ] "Too hot" warnings appear for cool-weather crops planted in summer
- [ ] Warning message format matches "too cold" warnings
- [ ] No warnings for warm-weather crops
- [ ] No warnings for cool-weather crops planted in optimal seasons
- [ ] Protection offset acknowledged but doesn't affect calculation
- [ ] Build check passes with no errors

## Timeline
- Discovery & Planning: 5-10 minutes
- Implementation: 15-20 minutes
- Validation: 5-10 minutes
- Total: ~30-40 minutes

## Notes
- This is a straightforward pattern-matching implementation
- The existing infrastructure (historical soil temp API, validation flow) is already built
- Primary task is adding the symmetric "too hot" check

---
**Created**: 2026-01-05
**Status**: In Progress
