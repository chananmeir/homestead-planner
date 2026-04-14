"""
Forward-Looking Planting Validator

Validates planting dates by checking historical weather data for the entire
growing period (germination through harvest) to prevent planting when future
cold snaps will kill seedlings.

Example:
- User wants to plant peas on Jan 9 (soil is 40°F today - warm enough to germinate)
- Peas germinate in 7-10 days (around Jan 16-19)
- Historical data shows Feb 21 drops to -15°F
- System warns: "Don't plant yet! Cold snap in 6 weeks will kill your seedlings"
"""

import logging
from datetime import date, timedelta
from typing import Optional, Dict, List, Tuple
from historical_soil_temp import get_historical_daily_soil_temps, get_historical_daily_air_temps, get_month_name

logger = logging.getLogger(__name__)


# Plant hardiness thresholds (minimum temperature seedlings/plants can survive)
# This is DIFFERENT from minimum germination temp
# Format: plant_id -> (lethal_temp_f, description)
PLANT_HARDINESS = {
    # Hardy crops (can survive hard freezes once established)
    'pea-1': (15, 'Established peas can survive to 15°F, but seedlings die below 20°F'),
    'spinach-1': (10, 'Very cold hardy, survives to 10°F'),
    'kale-1': (5, 'Extremely hardy, survives to 5°F'),
    'broccoli-1': (20, 'Cold hardy, survives to 20°F'),
    'cabbage-1': (20, 'Cold hardy, survives to 20°F'),
    'lettuce-1': (20, 'Hardy, but tender seedlings die below 20°F'),
    'onion-1': (15, 'Hardy bulb, survives to 15°F'),
    'garlic-1': (0, 'Extremely hardy, survives sub-zero temps'),

    # Semi-hardy crops (can handle light frost only)
    'carrot-1': (25, 'Semi-hardy, dies below 25°F'),
    'beet-1': (25, 'Semi-hardy, dies below 25°F'),
    'radish-1': (25, 'Semi-hardy, dies below 25°F'),
    'turnip-1': (25, 'Semi-hardy, dies below 25°F'),
    'cauliflower-1': (25, 'Semi-hardy, dies below 25°F'),

    # Tender crops (killed by any frost)
    'tomato-1': (32, 'Frost-tender, dies at 32°F'),
    'pepper-bell-1': (32, 'Frost-tender, dies at 32°F'),
    'cucumber-1': (32, 'Frost-tender, dies at 32°F'),
    'squash-summer-1': (32, 'Frost-tender, dies at 32°F'),
    'squash-winter-1': (32, 'Frost-tender, dies at 32°F'),
    'bean-bush-1': (32, 'Frost-tender, dies at 32°F'),
    'corn-1': (32, 'Frost-tender, dies at 32°F'),
    'melon-1': (32, 'Frost-tender, dies at 32°F'),
    'basil-1': (32, 'Extremely frost-sensitive, dies at 32°F'),
}


# Germination time estimates (days from planting to emergence)
# Format: plant_id -> (min_days, max_days, temp_dependent)
GERMINATION_TIMES = {
    'pea-1': (7, 14, True),  # Slower in cold soil
    'lettuce-1': (4, 10, True),
    'spinach-1': (7, 21, True),  # Very slow in cold
    'radish-1': (4, 6, False),  # Fast germinator
    'carrot-1': (14, 21, True),  # Slow germinator
    'beet-1': (7, 14, True),
    'onion-1': (7, 14, True),
    'broccoli-1': (5, 10, True),
    'cabbage-1': (5, 10, True),
    'kale-1': (5, 10, True),
    'tomato-1': (5, 10, False),
    'pepper-bell-1': (7, 14, False),
    'cucumber-1': (3, 7, False),
    'bean-bush-1': (7, 10, False),
    'corn-1': (7, 10, False),
}


def get_plant_hardiness_temp(plant_id: str) -> Optional[int]:
    """
    Get the lethal temperature threshold for a plant.

    Returns the minimum temperature (°F) that will kill the plant once germinated.
    Different from minimum germination temp - this is survival threshold.
    """
    # Remove variety suffix if present (e.g., 'pea-1' or 'pea-12345')
    base_id = '-'.join(plant_id.split('-')[:2])

    if base_id in PLANT_HARDINESS:
        return PLANT_HARDINESS[base_id][0]

    # Default: assume frost-tender if not specified
    return 32


def get_germination_days(plant_id: str, soil_temp: float) -> int:
    """
    Estimate germination time in days based on plant and soil temperature.

    Args:
        plant_id: Plant identifier
        soil_temp: Current soil temperature in °F

    Returns:
        Estimated days to germination
    """
    base_id = '-'.join(plant_id.split('-')[:2])

    if base_id not in GERMINATION_TIMES:
        return 10  # Default assumption

    min_days, max_days, temp_dependent = GERMINATION_TIMES[base_id]

    if not temp_dependent:
        return min_days  # Use minimum for plants that germinate consistently

    # Temperature-dependent: slower in cold, faster in warm
    # Optimal germination around 70°F, slower below 50°F
    if soil_temp >= 70:
        return min_days
    elif soil_temp >= 60:
        return min_days + ((max_days - min_days) // 3)
    elif soil_temp >= 50:
        return min_days + (2 * (max_days - min_days) // 3)
    else:
        return max_days  # Very slow in cold soil


def check_future_cold_danger(
    plant_id: str,
    planting_date: date,
    latitude: float,
    longitude: float,
    current_soil_temp: float,
    days_to_maturity: int
) -> Tuple[bool, Optional[str], Optional[Dict]]:
    """
    Check if planting on this date will result in seedlings being killed by future cold.

    Uses historical temperature data to look forward through the growing season
    and identify dates when temperatures historically drop below the plant's
    hardiness threshold.

    Args:
        plant_id: Plant identifier
        planting_date: Date user wants to plant
        latitude: Location latitude
        longitude: Location longitude
        current_soil_temp: Current soil temperature in °F
        days_to_maturity: Days from planting to harvest

    Returns:
        Tuple of (is_safe, warning_message, danger_details)
        - is_safe: True if no dangerous cold periods found
        - warning_message: Human-readable warning or None
        - danger_details: Dict with 'dates' and 'temps' or None
    """
    # Get plant's lethal temperature threshold
    lethal_temp = get_plant_hardiness_temp(plant_id)

    # Calculate germination date
    germination_days = get_germination_days(plant_id, current_soil_temp)
    germination_date = planting_date + timedelta(days=germination_days)

    # Calculate end of growing season
    # For perennials/long-maturing crops (>120 days), only check first 120 days
    # These are typically perennials that will overwinter or biennials
    checking_period = min(days_to_maturity, 120)
    harvest_date = planting_date + timedelta(days=checking_period)

    logger.info(f"Checking cold danger for {plant_id}: DTM={days_to_maturity} days, checking period={checking_period} days")

    # Check historical temperatures for each month in the growing period
    dangerous_periods = []

    current_check_date = germination_date
    while current_check_date <= harvest_date:
        month = current_check_date.month
        day = current_check_date.day

        # Fetch historical daily AIR temps for this month (not soil - seedlings are exposed to air!)
        daily_temps = get_historical_daily_air_temps(latitude, longitude, month)

        if daily_temps and day in daily_temps:
            historical_temp = daily_temps[day]

            # Check if historical temp is below lethal threshold
            if historical_temp < lethal_temp:
                dangerous_periods.append({
                    'date': current_check_date.strftime('%Y-%m-%d'),
                    'month_name': get_month_name(month),
                    'day': day,
                    'historical_temp': historical_temp,
                    'lethal_temp': lethal_temp,
                    'margin': round(lethal_temp - historical_temp, 1)
                })

        current_check_date += timedelta(days=1)

    # Analyze results
    if not dangerous_periods:
        return (True, None, None)

    # Find the coldest danger point
    worst_period = max(dangerous_periods, key=lambda x: x['margin'])

    # Build warning message
    worst_date = worst_period['month_name'] + ' ' + str(worst_period['day'])

    # Determine if dangerous cold is seasonal decline (fall) vs temporary snap (spring)
    # If the earliest dangerous date is in the last 40% of the growing period,
    # the cold is end-of-season decline — "waiting" won't help, it gets worse.
    first_dangerous_date = min(dangerous_periods, key=lambda x: x['date'])['date']
    first_danger = date.fromisoformat(first_dangerous_date)
    last_dangerous_date = max(dangerous_periods, key=lambda x: x['date'])['date']
    last_danger = date.fromisoformat(last_dangerous_date)

    days_into_season = (first_danger - planting_date).days
    is_fall_decline = days_into_season > (checking_period * 0.6)

    # Build warning - add note if checking period was capped for perennials
    if days_to_maturity > 120:
        period_note = " (checking establishment period only for long-season/perennial crop)"
    else:
        period_note = ""

    if is_fall_decline:
        # Fall/end-of-season: waiting makes it worse
        warning = (
            f"⚠️ Historical data shows dangerous cold ahead{period_note}! "
            f"{worst_date} typically reaches {worst_period['historical_temp']:.1f}°F, "
            f"which is {worst_period['margin']:.1f}°F below this plant's survival threshold ({lethal_temp}°F). "
            f"This crop may not mature before seasonal cold arrives. "
            f"Consider planting earlier so harvest completes before {worst_date}, "
            f"choosing a faster-maturing variety, or using season extension (row covers, cold frames)."
        )
    else:
        # Spring/temporary cold snap: waiting can help
        days_to_wait = (last_danger - planting_date).days + 7  # Add 7-day buffer
        warning = (
            f"⚠️ Historical data shows dangerous cold ahead{period_note}! "
            f"{worst_date} typically reaches {worst_period['historical_temp']:.1f}°F, "
            f"which is {worst_period['margin']:.1f}°F below this plant's survival threshold ({lethal_temp}°F). "
            f"Seedlings that germinate around {germination_date.strftime('%b %d')} "
            f"will likely be killed by this cold snap. "
            f"Consider waiting {days_to_wait} more days or using season extension (row covers, cold frames)."
        )

    danger_details = {
        'germination_date': germination_date.isoformat(),
        'dangerous_periods': dangerous_periods,
        'worst_period': worst_period,
        'lethal_threshold': lethal_temp,
        'checking_period_days': checking_period,
        'full_dtm': days_to_maturity,
        'is_fall_decline': is_fall_decline
    }

    return (False, warning, danger_details)


def validate_planting_date(
    plant_id: str,
    plant_name: str,
    planting_date: date,
    latitude: float,
    longitude: float,
    current_soil_temp: float,
    min_soil_temp: float,
    days_to_maturity: int
) -> Dict:
    """
    Comprehensive planting date validation.

    Checks:
    1. Current soil temperature vs minimum germination temp
    2. Historical future cold snaps that could kill seedlings

    Args:
        plant_id: Plant identifier
        plant_name: Human-readable plant name
        planting_date: Date user wants to plant
        latitude: Location latitude
        longitude: Location longitude
        current_soil_temp: Current soil temperature in °F
        min_soil_temp: Minimum soil temp for germination
        days_to_maturity: Days from planting to harvest

    Returns:
        Dictionary with validation results:
        {
            'safe_to_plant': bool,
            'warnings': List[str],
            'current_temp_ok': bool,
            'future_cold_danger': bool,
            'details': Dict
        }
    """
    warnings = []

    # Check 1: Current soil temperature
    current_temp_ok = current_soil_temp >= min_soil_temp
    if not current_temp_ok:
        warnings.append(
            f"Soil too cold for germination. Current: {current_soil_temp}°F, "
            f"Minimum needed: {min_soil_temp}°F"
        )

    # Check 2: Future cold danger (using historical data)
    future_safe, cold_warning, cold_details = check_future_cold_danger(
        plant_id,
        planting_date,
        latitude,
        longitude,
        current_soil_temp,
        days_to_maturity
    )

    if cold_warning:
        warnings.append(cold_warning)

    # Determine overall safety
    safe_to_plant = current_temp_ok and future_safe

    return {
        'safe_to_plant': safe_to_plant,
        'plant_name': plant_name,
        'planting_date': planting_date.isoformat(),
        'warnings': warnings,
        'current_temp_ok': current_temp_ok,
        'future_cold_danger': not future_safe,
        'current_soil_temp': current_soil_temp,
        'min_soil_temp': min_soil_temp,
        'details': cold_details
    }
