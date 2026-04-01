"""
Soil Temperature Calculation Module

Provides functions to calculate soil temperature using:
1. MEASURED baseline from Open-Meteo API (primary)
2. AIR TEMPERATURE estimation from WeatherAPI (fallback)

Both methods apply local adjustments for soil type, sun exposure, and mulch
to account for microclimate conditions specific to the user's garden beds.

This hybrid approach provides the most accurate soil temperature estimates
for garden planning and planting decisions.
"""

import logging
from datetime import datetime
from openmeteo_service import get_soil_temperature_openmeteo, inches_to_openmeteo_depth
from weather_service import get_current_temperature
from mulch_calculator import get_mulch_adjustment

# Setup logging
logger = logging.getLogger(__name__)

# Adjustment factors in degrees Fahrenheit

# Soil type affects how quickly soil warms/cools
SOIL_TYPE_ADJUSTMENTS = {
    'sandy': 2.0,    # Warms faster (lower water retention)
    'loamy': 0.0,    # Baseline (ideal garden soil)
    'clay': -2.0     # Warms slower (higher water retention)
}

# Sun exposure affects direct solar heating of soil surface
SUN_EXPOSURE_ADJUSTMENTS = {
    'full-sun': 3.0,         # 6+ hours direct sunlight
    'full': 3.0,             # Alias for full-sun
    'partial-shade': 1.0,    # 3-6 hours sunlight
    'partial': 1.0,          # Alias for partial-shade
    'full-shade': -2.0,      # <3 hours sunlight
    'shade': -2.0            # Alias for full-shade
}

# Frost kill temperature thresholds by frost tolerance level (°F)
# Mirrors WeatherAlertBanner.tsx riskThresholds; includes semi-hardy from plant_database
FROST_KILL_THRESHOLDS = {
    'very-tender': 32,
    'tender': 28,
    'half-hardy': 24,
    'semi-hardy': 24,
    'hardy': 15,
    'very-hardy': -10,
}

# Default mock air temperature for testing
DEFAULT_MOCK_AIR_TEMP = 65.0


def calculate_soil_temp(air_temp, soil_type, sun_exposure, mulch_type='none', current_date=None):
    """
    Calculate estimated soil temperature based on air temperature and conditions.

    Formula: Soil Temp = Air Temp + Soil Type Adj + Sun Exposure Adj + Mulch Adj (seasonal)

    Args:
        air_temp (float): Current air temperature in Fahrenheit
        soil_type (str): Type of soil - 'sandy', 'loamy', or 'clay'
        sun_exposure (str): Sun exposure - 'full-sun', 'partial-shade', or 'full-shade'
        mulch_type (str): Type of mulch - 'none', 'straw', 'wood-chips', etc.
        current_date (datetime): Current date for seasonal mulch adjustments (defaults to now)

    Returns:
        dict: {
            'estimated_soil_temp': float,
            'adjustments': {
                'soil_type': float,
                'sun_exposure': float,
                'mulch': float,
                'mulch_description': str
            }
        }

    Raises:
        ValueError: If invalid soil_type or sun_exposure provided
    """
    # Validate inputs
    if soil_type not in SOIL_TYPE_ADJUSTMENTS:
        raise ValueError(
            f"Invalid soil_type: {soil_type}. "
            f"Must be one of: {', '.join(SOIL_TYPE_ADJUSTMENTS.keys())}"
        )

    if sun_exposure not in SUN_EXPOSURE_ADJUSTMENTS:
        raise ValueError(
            f"Invalid sun_exposure: {sun_exposure}. "
            f"Must be one of: {', '.join(SUN_EXPOSURE_ADJUSTMENTS.keys())}"
        )

    # Get adjustment values
    soil_adj = SOIL_TYPE_ADJUSTMENTS[soil_type]
    sun_adj = SUN_EXPOSURE_ADJUSTMENTS[sun_exposure]

    # Get seasonal mulch adjustment using new calculator
    if current_date is None:
        current_date = datetime.now()

    # Calculate baseline before mulch
    baseline_with_soil_sun = air_temp + soil_adj + sun_adj

    # Get mulch adjustment (seasonal and type-specific)
    mulch_adj, mulch_desc = get_mulch_adjustment(mulch_type, current_date, baseline_with_soil_sun)

    # Calculate final estimated soil temperature
    estimated_temp = baseline_with_soil_sun + mulch_adj

    return {
        'estimated_soil_temp': round(estimated_temp, 1),
        'adjustments': {
            'soil_type': soil_adj,
            'sun_exposure': sun_adj,
            'mulch': mulch_adj,
            'mulch_description': mulch_desc
        }
    }


def get_mock_air_temp():
    """
    Get mock air temperature for testing when weather API is unavailable.

    Returns a reasonable spring/fall temperature suitable for planting season.

    Returns:
        float: Mock air temperature in Fahrenheit
    """
    return DEFAULT_MOCK_AIR_TEMP


def determine_crop_readiness(estimated_soil_temp, min_soil_temp):
    """
    Determine if soil is ready for planting a specific crop.

    Uses 5°F safety margins to account for temperature fluctuations.

    Args:
        estimated_soil_temp (float): Current estimated soil temperature
        min_soil_temp (float): Minimum soil temperature for crop

    Returns:
        str: One of 'ready', 'marginal', or 'too_cold'
    """
    # Safety margin for temperature fluctuations
    SAFETY_MARGIN = 5.0

    if estimated_soil_temp >= min_soil_temp + SAFETY_MARGIN:
        return 'ready'
    elif estimated_soil_temp >= min_soil_temp - SAFETY_MARGIN:
        return 'marginal'
    else:
        return 'too_cold'


def calculate_crop_readiness(estimated_soil_temp, plants, temps_by_depth=None):
    """
    Calculate planting readiness for all crops with soil temperature requirements.

    When temps_by_depth is provided, uses the appropriate depth per plant based on
    its plantingDepth field. Otherwise falls back to the single estimated_soil_temp.

    Args:
        estimated_soil_temp (float): Current estimated soil temperature (default/6cm)
        plants (list): List of plant dictionaries with 'id' and 'soil_temp_min' fields
        temps_by_depth (dict, optional): {depth_cm: final_soil_temp} for depth-aware readiness

    Returns:
        dict: Mapping of plant_id to readiness info
    """
    crop_readiness = {}

    for plant in plants:
        # Only process plants with soil temperature requirements
        if 'soil_temp_min' not in plant or plant['soil_temp_min'] is None:
            continue

        plant_id = plant['id']
        min_temp = plant['soil_temp_min']

        # Pick the right depth temperature for this plant
        if temps_by_depth:
            depth_cm = inches_to_openmeteo_depth(plant.get('plantingDepth'))
            current_temp = temps_by_depth.get(depth_cm, estimated_soil_temp)
        else:
            depth_cm = 6
            current_temp = estimated_soil_temp

        DEPTH_LABELS = {0: 'Surface (0cm)', 6: 'Seed depth (6cm)', 18: 'Deep (18cm)'}

        crop_readiness[plant_id] = {
            'status': determine_crop_readiness(current_temp, min_temp),
            'min_temp': min_temp,
            'current_temp': current_temp,
            'name': plant.get('name', plant_id),
            'depth_cm': depth_cm,
            'depth_label': DEPTH_LABELS.get(depth_cm, f'{depth_cm}cm'),
        }

    return crop_readiness


def get_soil_temperature_forecast_with_adjustments(latitude, longitude, soil_type, sun_exposure, mulch_type='none', forecast_days=16):
    """
    Get multi-day soil temperature forecast with local adjustments applied.

    Args:
        latitude, longitude: Location coordinates
        soil_type, sun_exposure, mulch_type: Local condition parameters
        forecast_days: Number of forecast days (1-16)

    Returns:
        dict: {
            'forecast': [{'date': str, 'soil_temp': float, 'min_soil_temp': float, 'max_soil_temp': float}, ...],
            'method': 'measured' | 'mock',
            'using_mock_data': bool
        }
    """
    from openmeteo_service import get_soil_temperature_forecast

    daily_temps, using_mock = get_soil_temperature_forecast(
        latitude, longitude, forecast_days=forecast_days, depth_cm=6
    )

    forecast = []
    for day in daily_temps:
        day_date = datetime.strptime(day['date'], '%Y-%m-%d')

        # Apply adjustments to mean temp for the primary readiness value
        mean_result = calculate_soil_temp(day['mean_temp'], soil_type, sun_exposure, mulch_type, day_date)
        min_result = calculate_soil_temp(day['min_temp'], soil_type, sun_exposure, mulch_type, day_date)
        max_result = calculate_soil_temp(day['max_temp'], soil_type, sun_exposure, mulch_type, day_date)

        forecast.append({
            'date': day['date'],
            'soil_temp': mean_result['estimated_soil_temp'],
            'min_soil_temp': min_result['estimated_soil_temp'],
            'max_soil_temp': max_result['estimated_soil_temp'],
        })

    return {
        'forecast': forecast,
        'method': 'mock' if using_mock else 'measured',
        'using_mock_data': using_mock
    }


def calculate_crop_readiness_forecast(forecast_temps, plants, mode='seed', forecast_by_depth=None,
                                      air_temp_forecast=None, protection_offset=0):
    """
    Calculate per-crop readiness across a forecast window.

    Supports two modes:
    - 'seed': Uses soil_temp_min (germination temp) across germination_days window
    - 'transplant': Uses transplant_soil_temp_min across germination_days window (root establishment proxy)

    The overall status is the WORST status across the window — a crop is only
    "ready" if ALL days in the window are suitable. Exception: hardy/very-hardy
    transplants use majority-status (5/7 threshold) instead of worst-case.

    When air_temp_forecast is provided, also checks for frost risk by comparing
    forecast daily lows against the plant's frost kill threshold.

    Args:
        forecast_temps: list of {'date': str, 'soil_temp': float} dicts (default/6cm)
        plants: PLANT_DATABASE list of plant dicts
        mode: 'seed' or 'transplant'
        forecast_by_depth: dict {depth_cm: [daily_temps]} for depth-aware readiness (optional)
        air_temp_forecast: list of {'date': str, 'lowTemp': float} dicts for frost risk (optional)
        protection_offset: float, °F protection boost from season extension structures (default 0)

    Returns:
        tuple: (result_dict, direct_sow_only_dict)
        - result_dict: {plant_id: {status, min_temp, name, germination_days, daily_readiness,
          depth_cm, depth_label, frost_risk, frost_risk_days, frost_tolerance}}
        - direct_sow_only_dict: {plant_id: {name, soil_temp_min}} for transplant-excluded crops
    """
    STATUS_RANK = {'too_cold': 0, 'marginal': 1, 'ready': 2}
    DEPTH_LABELS = {0: 'Surface (0cm)', 6: 'Seed depth (6cm)', 18: 'Deep (18cm)'}
    result = {}
    direct_sow_only = {}

    for plant in plants:
        plant_id = plant['id']

        if mode == 'transplant':
            min_temp = plant.get('transplant_soil_temp_min')
            if min_temp is None:
                # Collect direct-sow-only plants instead of silently skipping
                if plant.get('soil_temp_min') is not None:
                    direct_sow_only[plant_id] = {
                        'name': plant.get('name', plant_id),
                        'soil_temp_min': plant['soil_temp_min'],
                    }
                continue
            # Transplant establishment window: use germination_days as proxy for root establishment
            window_days = plant.get('germination_days') or 7
        else:
            min_temp = plant.get('soil_temp_min')
            if min_temp is None:
                continue
            window_days = plant.get('germination_days') or 7

        # Pick the right depth forecast for this plant
        depth_cm = inches_to_openmeteo_depth(plant.get('plantingDepth'))
        if mode == 'transplant':
            depth_cm = max(6, depth_cm)  # Transplant roots establish at minimum 6cm depth
        if forecast_by_depth and depth_cm in forecast_by_depth:
            plant_forecast = forecast_by_depth[depth_cm]
        else:
            plant_forecast = forecast_temps

        # Cap to available forecast data
        window = min(window_days, len(plant_forecast))

        daily = []
        worst_status = 'ready'
        for i in range(window):
            day = plant_forecast[i]
            status = determine_crop_readiness(day['soil_temp'], min_temp)
            daily.append({
                'date': day['date'],
                'soilTemp': day['soil_temp'],
                'status': status,
            })
            if STATUS_RANK.get(status, 2) < STATUS_RANK.get(worst_status, 2):
                worst_status = status

        # Issue #4: Less conservative algorithm for hardy/very-hardy transplants
        # Use majority-status instead of worst-case
        frost_tolerance = plant.get('frostTolerance', 'tender')
        if mode == 'transplant' and frost_tolerance in ('hardy', 'very-hardy') and len(daily) > 0:
            status_counts = {'ready': 0, 'marginal': 0, 'too_cold': 0}
            for d in daily:
                status_counts[d['status']] = status_counts.get(d['status'], 0) + 1
            total = len(daily)
            ready_ratio = status_counts['ready'] / total
            ok_ratio = (status_counts['ready'] + status_counts['marginal']) / total
            if ready_ratio >= 5 / 7:  # ~71% ready days
                worst_status = 'ready'
            elif ok_ratio >= 5 / 7:  # ~71% ready+marginal days
                worst_status = 'marginal'

        # Issue #2: Frost risk assessment (air temperature vs plant's frost kill threshold)
        frost_risk = False
        frost_risk_days = []
        if air_temp_forecast is not None:
            kill_temp = FROST_KILL_THRESHOLDS.get(frost_tolerance, 28)
            for i in range(min(window, len(air_temp_forecast))):
                air_day = air_temp_forecast[i]
                air_low = air_day.get('lowTemp')
                if air_low is not None:
                    effective_low = air_low + protection_offset
                    if effective_low <= kill_temp:
                        frost_risk = True
                        frost_risk_days.append({
                            'date': air_day.get('date', ''),
                            'forecastLow': air_low,
                            'effectiveLow': effective_low,
                            'killTemp': kill_temp,
                        })

            # Downgrade status when frost event falls within the readiness window
            if frost_risk and worst_status == 'ready':
                worst_status = 'marginal'

        result[plant_id] = {
            'status': worst_status,
            'min_temp': min_temp,
            'name': plant.get('name', plant_id),
            'germination_days': window_days,
            'daily_readiness': daily,
            'depth_cm': depth_cm,
            'depth_label': DEPTH_LABELS.get(depth_cm, f'{depth_cm}cm'),
            'frost_risk': frost_risk,
            'frost_risk_days': frost_risk_days,
            'frost_tolerance': frost_tolerance,
        }

    return result, direct_sow_only


def get_soil_temperatures_all_depths_with_adjustments(latitude, longitude, soil_type, sun_exposure, mulch_type='none'):
    """
    Get soil temperatures at 0cm, 6cm, and 18cm with local adjustments applied.

    Uses a single Open-Meteo API call to fetch all three depths, then applies
    the same soil/sun/mulch adjustments to each depth.

    Returns:
        dict: {
            'temps_by_depth': {0: {'final_soil_temp': float, 'base_temp': float}, 6: {...}, 18: {...}},
            'method': str,
            'source': str,
            'using_mock_data': bool,
            'adjustments': dict
        }
    """
    from openmeteo_service import get_soil_temperatures_multi_depth

    current_date = datetime.now()

    try:
        raw_temps, using_mock = get_soil_temperatures_multi_depth(latitude, longitude)

        if not using_mock:
            temps_by_depth = {}
            for depth_cm, base_temp in raw_temps.items():
                result = calculate_soil_temp(base_temp, soil_type, sun_exposure, mulch_type, current_date)
                temps_by_depth[depth_cm] = {
                    'final_soil_temp': result['estimated_soil_temp'],
                    'base_temp': base_temp,
                }

            # Use 6cm adjustments as the canonical adjustments object
            adj_result = calculate_soil_temp(raw_temps[6], soil_type, sun_exposure, mulch_type, current_date)

            return {
                'temps_by_depth': temps_by_depth,
                'method': 'measured',
                'source': 'Open-Meteo (measured, multi-depth)',
                'using_mock_data': False,
                'adjustments': adj_result['adjustments'],
            }
    except Exception as e:
        logger.error(f"Multi-depth fetch failed: {e}")

    # Fallback: use single-depth function and replicate for all depths
    single = get_soil_temperature_with_adjustments(latitude, longitude, soil_type, sun_exposure, mulch_type)
    temps_by_depth = {}
    for depth in [0, 6, 18]:
        temps_by_depth[depth] = {
            'final_soil_temp': single['final_soil_temp'],
            'base_temp': single['base_temp'],
        }
    return {
        'temps_by_depth': temps_by_depth,
        'method': single['method'],
        'source': single['source'],
        'using_mock_data': single['using_mock_data'],
        'adjustments': single['adjustments'],
    }


def get_soil_temperature_forecast_all_depths_with_adjustments(latitude, longitude, soil_type, sun_exposure, mulch_type='none', forecast_days=16):
    """
    Get multi-day soil temperature forecast at all depths with adjustments.

    Returns:
        dict: {
            'forecast_by_depth': {0: [daily_temps], 6: [daily_temps], 18: [daily_temps]},
            'method': str,
            'using_mock_data': bool
        }
        where each daily_temps entry has {date, soil_temp, min_soil_temp, max_soil_temp}
    """
    from openmeteo_service import get_soil_temperature_forecast_multi_depth

    try:
        raw_by_depth, using_mock = get_soil_temperature_forecast_multi_depth(
            latitude, longitude, forecast_days=forecast_days
        )

        forecast_by_depth = {}
        for depth_cm, daily_temps in raw_by_depth.items():
            adjusted = []
            for day in daily_temps:
                day_date = datetime.strptime(day['date'], '%Y-%m-%d')
                mean_result = calculate_soil_temp(day['mean_temp'], soil_type, sun_exposure, mulch_type, day_date)
                min_result = calculate_soil_temp(day['min_temp'], soil_type, sun_exposure, mulch_type, day_date)
                max_result = calculate_soil_temp(day['max_temp'], soil_type, sun_exposure, mulch_type, day_date)
                adjusted.append({
                    'date': day['date'],
                    'soil_temp': mean_result['estimated_soil_temp'],
                    'min_soil_temp': min_result['estimated_soil_temp'],
                    'max_soil_temp': max_result['estimated_soil_temp'],
                })
            forecast_by_depth[depth_cm] = adjusted

        return {
            'forecast_by_depth': forecast_by_depth,
            'method': 'mock' if using_mock else 'measured',
            'using_mock_data': using_mock,
        }
    except Exception as e:
        logger.error(f"Multi-depth forecast failed: {e}")
        # Fallback to single-depth and replicate
        single = get_soil_temperature_forecast_with_adjustments(
            latitude, longitude, soil_type, sun_exposure, mulch_type, forecast_days
        )
        return {
            'forecast_by_depth': {d: list(single['forecast']) for d in [0, 6, 18]},
            'method': single['method'],
            'using_mock_data': single['using_mock_data'],
        }


def get_soil_temperature_with_adjustments(latitude, longitude, soil_type, sun_exposure, mulch_type='none'):
    """
    Get the most accurate soil temperature possible using measured data + local adjustments.

    This function implements a multi-tier approach:
    1. PRIMARY: Try Open-Meteo for measured soil temperature at 6cm depth
    2. FALLBACK: Use WeatherAPI air temperature as estimation baseline
    3. LAST RESORT: Use mock data (50°F)

    Then applies user's local adjustments (soil type, sun exposure, mulch) to account
    for microclimate conditions in their specific garden beds.

    Args:
        latitude (float): Location latitude
        longitude (float): Location longitude
        soil_type (str): 'sandy', 'loamy', or 'clay'
        sun_exposure (str): 'full-sun', 'partial-shade', or 'full-shade'
        mulch_type (str): Type of mulch - 'none', 'straw', 'wood-chips', etc.

    Returns:
        dict: {
            'final_soil_temp': float - Final temperature after adjustments,
            'base_temp': float - Initial measured/estimated temperature,
            'adjustments': dict - Applied adjustments,
            'method': str - 'measured' (Open-Meteo), 'estimated' (air temp), or 'mock',
            'source': str - Data source name,
            'using_mock_data': bool - True if fallback to mock data
        }
    """
    current_date = datetime.now()

    # TIER 1: Try to get MEASURED soil temperature from Open-Meteo
    try:
        base_temp, using_openmeteo_mock = get_soil_temperature_openmeteo(latitude, longitude, depth_cm=6)

        if not using_openmeteo_mock:
            # SUCCESS: We have real measured soil temperature
            # Apply local adjustments for user's specific conditions
            result = calculate_soil_temp(base_temp, soil_type, sun_exposure, mulch_type, current_date)

            return {
                'final_soil_temp': result['estimated_soil_temp'],
                'base_temp': base_temp,
                'adjustments': result['adjustments'],
                'method': 'measured',
                'source': 'Open-Meteo (measured at 6cm)',
                'using_mock_data': False
            }
    except Exception as e:
        logger.error(f"Open-Meteo failed: {e}, trying air temperature fallback")

    # TIER 2: Fallback to AIR TEMPERATURE estimation
    try:
        air_temp, using_weather_mock = get_current_temperature(latitude, longitude)

        if not using_weather_mock:
            # Use air temperature as baseline (less accurate but better than nothing)
            result = calculate_soil_temp(air_temp, soil_type, sun_exposure, mulch_type, current_date)

            return {
                'final_soil_temp': result['estimated_soil_temp'],
                'base_temp': air_temp,
                'adjustments': result['adjustments'],
                'method': 'estimated',
                'source': 'WeatherAPI (air temp + adjustments)',
                'using_mock_data': False
            }
    except Exception as e:
        logger.error(f"WeatherAPI also failed: {e}, using mock data")

    # TIER 3: Last resort - MOCK DATA
    mock_temp = 50.0
    result = calculate_soil_temp(mock_temp, soil_type, sun_exposure, mulch_type, current_date)

    return {
        'final_soil_temp': result['estimated_soil_temp'],
        'base_temp': mock_temp,
        'adjustments': result['adjustments'],
        'method': 'mock',
        'source': 'Mock Data (default)',
        'using_mock_data': True
    }
