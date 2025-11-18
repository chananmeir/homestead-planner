# Soil Temperature Estimation Feature - Implementation Plan

**Status**: In Progress
**Created**: 2025-11-12
**Last Updated**: 2025-11-12

## Overview

Implement a soil temperature estimation feature integrated into the Planting Calendar that helps users determine when soil is ready for planting based on weather data and soil characteristics.

## Feature Requirements

### Core Functionality
1. **Weather API Integration**: Use WeatherAPI.com for current and historical temperature data
2. **Soil Temperature Calculation**: Estimate soil temperature based on:
   - Air temperature (from weather API)
   - Soil type (sandy, loamy, clay)
   - Sun exposure (full sun, partial shade, full shade)
   - Mulch presence (yes/no)
3. **Planting Readiness**: Display color-coded indicators showing whether soil is ready for each crop
4. **Integration**: Add to existing Planting Calendar component (not a separate tab)

### User Decisions (From Previous Conversation)
- Test calendar fixes first: DONE (succession planting now working)
- Integration approach: Add to Planting Calendar (not separate component)
- API provider: WeatherAPI.com (user needs to obtain free tier API key)

## Technical Architecture

### Backend Changes

#### 1. New Module: `backend/soil_temperature.py`
Create calculation engine with:
- `calculate_soil_temp(air_temp, soil_type, sun_exposure, has_mulch)` - Core calculation function
- Adjustment factors for each parameter
- Mock data function for testing without API key

#### 2. New API Endpoint: `/api/soil-temperature`
- **Route**: `GET /api/soil-temperature`
- **Query Parameters**:
  - `latitude` (optional): Property latitude
  - `longitude` (optional): Property longitude
  - `soil_type`: sandy/loamy/clay
  - `sun_exposure`: full-sun/partial-shade/full-shade
  - `has_mulch`: true/false
- **Response**:
  ```json
  {
    "air_temp": 65,
    "estimated_soil_temp": 70,
    "soil_adjustments": {
      "soil_type": 2,
      "sun_exposure": 3,
      "mulch": 0
    },
    "crop_readiness": {
      "tomato-1": {"ready": false, "status": "too_cold", "needed_temp": 60, "current_temp": 70},
      "lettuce-1": {"ready": true, "status": "ready", "needed_temp": 40, "current_temp": 70}
    },
    "using_mock_data": true
  }
  ```

#### 3. Settings Model Updates
Add storage for:
- `weather_api_key`: WeatherAPI.com API key
- `default_soil_type`: User's default soil type
- `default_sun_exposure`: User's default sun exposure

#### 4. Plant Database Updates
Add `soil_temp_min` field to each plant in `PLANT_DATABASE`:
- Tomatoes: 60°F
- Peppers: 65°F
- Lettuce: 40°F
- Spinach: 35°F
- etc. (based on germination temperature minimums)

### Frontend Changes

#### 1. New Component: `frontend/src/components/PlantingCalendar/SoilTemperatureCard/`
Structure:
```
SoilTemperatureCard/
├── index.tsx              # Main component
├── SoilConfigForm.tsx     # Soil type/exposure/mulch form
├── ReadinessIndicator.tsx # Color-coded readiness display
└── types.ts               # TypeScript types
```

Features:
- Soil configuration form (type, exposure, mulch)
- Current estimated soil temperature display
- Crop readiness grid with color-coded indicators:
  - **Green**: Ready to plant (soil temp ≥ plant minimum + 5°F)
  - **Yellow**: Marginal (soil temp within 5°F of minimum)
  - **Red**: Too cold (soil temp < minimum - 5°F)
- Show only crops in active planting events
- Warning banner if using mock data (no API key)

#### 2. Integration into PlantingCalendar
Add SoilTemperatureCard component:
- Position: Below header, above calendar/list view
- Collapsible card to save space
- Persistent state (expanded/collapsed) in localStorage

## Phased Implementation

### Phase 1: Foundation with Mock Data (NO API KEY REQUIRED)
**Goal**: Build working feature using mock data so user can test UI/UX

**Backend Tasks**:
- [x] Create `backend/soil_temperature.py`
  - [x] Implement `calculate_soil_temp()` function
  - [x] Define adjustment factor constants
  - [x] Create `get_mock_air_temp()` function
- [x] Create `/api/soil-temperature` endpoint in `app.py`
  - [x] Accept query parameters
  - [x] Return mock air temp with calculations
  - [x] Include `using_mock_data: true` flag
- [x] Add `soil_temp_min` to plants in `plant_database.py`

**Frontend Tasks**:
- [x] Create `SoilTemperatureCard` component directory
- [x] Build main card UI with configuration form
- [x] Implement readiness indicator logic
- [x] Integrate into PlantingCalendar component
- [x] Add mock data warning banner

**Deliverable**: Working soil temperature feature with mock data

### Phase 2: WeatherAPI Integration (REQUIRES API KEY)
**Goal**: Replace mock data with live weather API

**Prerequisites**:
- User obtains WeatherAPI.com API key (free tier: 1M calls/month)
- User adds key to `backend/.env` as `WEATHER_API_KEY=xxx`

**Backend Tasks**:
- [ ] Create `backend/weather_service.py`
  - [ ] Implement `get_current_temperature(lat, lon)` using WeatherAPI
  - [ ] Add error handling and fallback to mock data
  - [ ] Cache API responses (avoid rate limits)
- [ ] Update `/api/soil-temperature` endpoint
  - [ ] Check for API key in environment
  - [ ] Use weather_service if key exists, else mock data
  - [ ] Return `using_mock_data` based on actual data source
- [ ] Add Settings model fields for API key (optional alternative to .env)

**Frontend Tasks**:
- [ ] Update warning banner to check `using_mock_data` flag
- [ ] Add instructions for obtaining API key if missing

**Deliverable**: Live weather data integration

### Phase 3: User Testing & Refinement
**Goal**: Gather feedback and polish feature

**Tasks**:
- [ ] User testing with mock data
- [ ] User obtains API key and tests live data
- [ ] Refinements based on feedback
- [ ] Documentation updates

## Calculation Logic

### Soil Temperature Formula
```
Estimated Soil Temp = Air Temp + Soil Type Adjustment + Sun Exposure Adjustment + Mulch Adjustment
```

### Adjustment Factors

**Soil Type**:
- Sandy: +2°F (warms faster due to lower water retention)
- Loamy: 0°F (baseline, ideal soil)
- Clay: -2°F (warms slower due to higher water retention)

**Sun Exposure**:
- Full Sun: +3°F (6+ hours direct sunlight)
- Partial Shade: +1°F (3-6 hours sunlight)
- Full Shade: -2°F (<3 hours sunlight)

**Mulch**:
- With Mulch: -3°F (insulates soil, slows warming in spring)
- No Mulch: 0°F

### Example Calculation
```
Air Temp: 65°F
Sandy Soil: +2°F
Full Sun: +3°F
No Mulch: 0°F
-------------------
Estimated Soil Temp: 65 + 2 + 3 + 0 = 70°F
```

### Planting Readiness Rules
- **Ready** (Green): `soil_temp >= plant.soil_temp_min + 5°F`
- **Marginal** (Yellow): `plant.soil_temp_min - 5°F <= soil_temp < plant.soil_temp_min + 5°F`
- **Too Cold** (Red): `soil_temp < plant.soil_temp_min - 5°F`

5°F safety margin accounts for:
- Day-to-night temperature fluctuations
- Weather variability
- Conservative planting recommendations

## Data Sources

### WeatherAPI.com
- **Free Tier**: 1,000,000 calls/month
- **Endpoint**: `http://api.weatherapi.com/v1/current.json?key={API_KEY}&q={lat},{lon}`
- **Response**: Current temperature in °F
- **Signup**: https://www.weatherapi.com/signup.aspx

### Plant Minimum Soil Temperatures
Based on university extension guidelines:
- **Very Tender** (65°F+): Tomatoes, peppers, melons, squash
- **Tender** (60°F+): Beans, cucumbers
- **Hardy** (40-50°F): Lettuce, spinach, peas, brassicas
- **Very Hardy** (35°F+): Onions, garlic, leeks

## Testing Strategy

### Phase 1 Testing (Mock Data)
1. Verify UI renders correctly
2. Test all soil type/exposure/mulch combinations
3. Verify calculations are correct
4. Test readiness indicators with various crops
5. Verify integration with PlantingCalendar

### Phase 2 Testing (Live Data)
1. Verify API key loading from .env
2. Test API error handling (network failure, invalid key)
3. Verify fallback to mock data on error
4. Test caching to avoid rate limits
5. Compare live temps to mock temps for reasonableness

## Open Questions
- [ ] Should we store user's soil preferences in database vs localStorage?
  - **Decision**: Start with component state, add to Settings later if needed
- [ ] Should we allow manual temperature override?
  - **Decision**: Not in Phase 1, consider for Phase 3
- [ ] Should we show historical soil temp trends?
  - **Decision**: Future enhancement, not in scope

## Success Criteria
- [x] Phase 1: Working UI with mock data
- [ ] Phase 2: Live weather data integration
- [ ] Phase 3: User successfully uses feature to make planting decisions

## Notes
- Plant database already has `germinationTemp` field which we can use as basis for `soil_temp_min`
- PlantingCalendar component already uses `API_BASE_URL` from config.ts (good pattern to follow)
- Backend already uses Settings model for frost dates (can reuse for soil preferences)

**Last Updated**: 2025-11-12
