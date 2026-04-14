"""
Season and weather validation for planting decisions.
Checks if planting conditions are appropriate based on:
- Soil temperature vs plant requirements
- Season appropriateness
- Frost risk for tender plants
"""

import logging
from datetime import datetime, date, timedelta
from simulation_clock import get_now, get_today
from plant_database import get_plant_by_id
from soil_temperature import get_soil_temperature_with_adjustments
from historical_soil_temp import get_historical_soil_temp_for_date, get_historical_daily_soil_temps, get_month_name
from models import Property, db
from services.geocoding_service import geocoding_service

logger = logging.getLogger(__name__)


def get_season_from_date(date: datetime) -> str:
    """Get season name from date (Northern Hemisphere)."""
    month = date.month
    if month in [3, 4, 5]:
        return 'spring'
    elif month in [6, 7, 8]:
        return 'summer'
    elif month in [9, 10, 11]:
        return 'fall'
    else:
        return 'winter'


# Heat threshold map by plant heat_tolerance level (air temperature, °F)
HEAT_THRESHOLDS = {
    'low':       {'advisory': 80, 'warning': 85, 'critical': 90},
    'medium':    {'advisory': 85, 'warning': 90, 'critical': 95},
    'high':      {'advisory': 90, 'warning': 95, 'critical': 100},
    'excellent': {'advisory': 95, 'warning': 100, 'critical': 105},
}


def validate_heat_conditions(
    plant: dict,
    forecast_days: list,
    heat_protection_offset: float = 0
) -> list:
    """
    Validate air temperature heat conditions for a plant against forecast data.

    Args:
        plant: Plant data dict (must have 'name', optionally 'heat_tolerance')
        forecast_days: List of forecast dicts with 'highTemp' key
        heat_protection_offset: Temperature reduction from shade cloth (°F)

    Returns:
        List of warning dicts with type, message, severity
    """
    warnings = []
    if not forecast_days:
        return warnings

    plant_name = plant.get('name', 'Unknown')
    heat_tolerance = plant.get('heat_tolerance', 'medium')
    thresholds = HEAT_THRESHOLDS.get(heat_tolerance, HEAT_THRESHOLDS['medium'])

    # Find the hottest day in the forecast
    max_high = max((day.get('highTemp', 0) for day in forecast_days), default=0)
    if max_high == 0:
        return warnings

    # Apply shade cloth offset
    effective_temp = max_high - heat_protection_offset

    # Check against thresholds
    if effective_temp >= thresholds['critical']:
        severity = 'warning'
        warning_type = 'heat_risk'
        if heat_protection_offset > 0:
            warning_type = 'heat_risk_protected' if max_high >= thresholds['critical'] and effective_temp < thresholds['critical'] else 'heat_risk'
    elif effective_temp >= thresholds['warning']:
        severity = 'warning'
        warning_type = 'heat_risk'
    elif effective_temp >= thresholds['advisory']:
        severity = 'info'
        warning_type = 'heat_risk'
    else:
        # No heat risk - but check if shade cloth is what saved us
        if max_high >= thresholds['advisory'] and effective_temp < thresholds['advisory']:
            warnings.append({
                'type': 'heat_risk_protected',
                'message': f"Heat mitigated: {plant_name} ({heat_tolerance} heat tolerance) - forecast high {max_high:.0f}°F reduced to ~{effective_temp:.0f}°F with shade cloth",
                'severity': 'info'
            })
        return warnings

    # Determine if shade cloth is providing meaningful protection
    if heat_protection_offset > 0 and max_high >= thresholds['advisory'] and effective_temp < thresholds['warning']:
        # Shade cloth brought it below warning level
        warnings.append({
            'type': 'heat_risk_protected',
            'message': f"Heat partially mitigated: {plant_name} ({heat_tolerance} heat tolerance) - forecast high {max_high:.0f}°F reduced to ~{effective_temp:.0f}°F with shade cloth. Monitor closely.",
            'severity': 'info'
        })
    else:
        # Build message based on severity
        if severity == 'warning':
            temp_str = f"{effective_temp:.0f}°F" if heat_protection_offset > 0 else f"{max_high:.0f}°F"
            shade_note = f" (with shade cloth: {max_high:.0f}°F reduced to ~{effective_temp:.0f}°F)" if heat_protection_offset > 0 else ""
            tips = "Provide shade cloth, deep watering, and mulch."
            warnings.append({
                'type': warning_type,
                'message': f"Heat stress risk: {plant_name} ({heat_tolerance} heat tolerance) may struggle at {temp_str}{shade_note}. {tips}",
                'severity': severity
            })
        else:
            # Advisory level
            warnings.append({
                'type': warning_type,
                'message': f"Heat advisory: {plant_name} ({heat_tolerance} heat tolerance) - forecast high {max_high:.0f}°F approaching stress threshold ({thresholds['warning']}°F). Consider shade protection.",
                'severity': severity
            })

    return warnings


def get_frost_tolerance_label(tolerance: str) -> str:
    """Convert frost tolerance code to human-readable label."""
    labels = {
        'very-tender': 'very frost-tender',
        'tender': 'frost-tender',
        'half-hardy': 'half-hardy',
        'hardy': 'frost-hardy',
        'very-hardy': 'very frost-hardy'
    }
    return labels.get(tolerance, tolerance)


def validate_planting_conditions(
    plant_id: str,
    planting_date: datetime,
    latitude: float = None,
    longitude: float = None,
    last_frost_date: datetime = None,
    first_frost_date: datetime = None,
    soil_type: str = 'loamy',
    sun_exposure: str = 'full',
    protection_offset: int = 0,
    protection_type: str = None,
    planting_method: str = 'seed'
) -> list:
    """
    Validate planting conditions and return warnings.

    Args:
        plant_id: ID of the plant to validate
        planting_date: When the user wants to plant
        latitude: Property latitude for weather data
        longitude: Property longitude for weather data
        last_frost_date: Last spring frost date
        first_frost_date: First fall frost date
        soil_type: Property soil type for temperature adjustments
        sun_exposure: Garden bed sun exposure
        protection_offset: Temperature offset from season extension (°F)
        protection_type: Type of protection structure (for display)
        planting_method: 'seed' for direct seeding, 'transplant' for transplants

    Returns:
        List of warning dictionaries with type, message, severity
    """
    warnings = []

    # Get plant data
    plant = get_plant_by_id(plant_id)
    if not plant:
        return warnings

    plant_name = plant.get('name', plant_id)

    # Note: We no longer check ideal_seasons - soil temperature is a better indicator
    # of planting readiness than arbitrary season labels

    # 1. Check frost risk for tender plants
    frost_tolerance = plant.get('frostTolerance', 'half-hardy')
    is_tender = frost_tolerance in ['very-tender', 'tender']

    if is_tender and last_frost_date and first_frost_date:
        planting_month_day = (planting_date.month, planting_date.day)
        last_frost_month_day = (last_frost_date.month, last_frost_date.day)
        first_frost_month_day = (first_frost_date.month, first_frost_date.day)

        # Check if planting before last spring frost
        if planting_month_day < last_frost_month_day:
            tolerance_label = get_frost_tolerance_label(frost_tolerance)

            # If we have protection, adjust the warning
            if protection_offset >= 15:
                # Significant protection - change to info level
                protection_label = protection_type or 'protection'
                warnings.append({
                    'type': 'frost_risk_protected',
                    'message': f"Frost risk mitigated: {plant_name} is {tolerance_label} (last frost {last_frost_date.strftime('%B %d')}), but {protection_label} provides +{protection_offset}°F protection",
                    'severity': 'info'
                })
            elif protection_offset > 0:
                # Partial protection - still warning but mention protection
                protection_label = protection_type or 'protection'
                warnings.append({
                    'type': 'frost_risk',
                    'message': f"Frost risk: {plant_name} is {tolerance_label} (last frost {last_frost_date.strftime('%B %d')}). {protection_label} adds +{protection_offset}°F but may not be sufficient",
                    'severity': 'warning'
                })
            else:
                # No protection
                warnings.append({
                    'type': 'frost_risk',
                    'message': f"Frost risk: {plant_name} is {tolerance_label} and your last frost is {last_frost_date.strftime('%B %d')}",
                    'severity': 'warning'
                })

        # Check if planting after first fall frost
        elif planting_month_day > first_frost_month_day:
            tolerance_label = get_frost_tolerance_label(frost_tolerance)

            # If we have protection, adjust the warning
            if protection_offset >= 15:
                protection_label = protection_type or 'protection'
                warnings.append({
                    'type': 'frost_risk_protected',
                    'message': f"Frost risk mitigated: {plant_name} is {tolerance_label} (first frost {first_frost_date.strftime('%B %d')}), but {protection_label} provides +{protection_offset}°F protection",
                    'severity': 'info'
                })
            elif protection_offset > 0:
                protection_label = protection_type or 'protection'
                warnings.append({
                    'type': 'frost_risk',
                    'message': f"Frost risk: {plant_name} is {tolerance_label} (first frost {first_frost_date.strftime('%B %d')}). {protection_label} adds +{protection_offset}°F but may not be sufficient",
                    'severity': 'warning'
                })
            else:
                warnings.append({
                    'type': 'frost_risk',
                    'message': f"Frost risk: {plant_name} is {tolerance_label} and your first frost is {first_frost_date.strftime('%B %d')}",
                    'severity': 'warning'
                })

    # 2. Check soil temperature (if we have coordinates)
    # Note: For transplants, soil temp requirements are less critical since plants are already established
    method_label = 'seeding' if planting_method == 'seed' else 'transplanting'
    if latitude and longitude:
        # For direct seeding, use germination temp requirements
        # For transplants, use a lower threshold (established plants are hardier)
        if planting_method == 'seed':
            soil_temp_min = plant.get('soil_temp_min') or plant.get('germinationTemp', {}).get('min')
        else:
            # Transplants can handle cooler soil - use ~80% of seed requirement (min 40°F)
            # This keeps warm-season crops realistic (basil 70°F -> 56°F) while being lenient for cool-season
            plant_min = plant.get('soil_temp_min') or plant.get('germinationTemp', {}).get('min')
            soil_temp_min = max(40, plant_min * 0.8) if plant_min else 40

        if soil_temp_min:
            try:
                # Check if planting date is in the future (more than 1 day ahead)
                today = get_today()
                planting_day = planting_date.date() if hasattr(planting_date, 'date') else planting_date
                days_until_planting = (planting_day - today).days

                logger.info(f"Date check: today={today}, planting_day={planting_day}, days_until={days_until_planting}")

                if days_until_planting > 1:
                    # Future date: use historical daily averages for precision
                    logger.info(f"Future planting date detected: {planting_day} ({days_until_planting} days ahead)")

                    # Get daily averages for the planting month
                    daily_averages = get_historical_daily_soil_temps(
                        latitude=latitude,
                        longitude=longitude,
                        month=planting_day.month
                    )

                    if daily_averages:
                        # Get the specific day's historical average
                        day_of_month = planting_day.day
                        avg_soil_temp = daily_averages.get(day_of_month)

                        if avg_soil_temp is None:
                            # Fallback to monthly average if specific day not available
                            historical_data = get_historical_soil_temp_for_date(
                                latitude=latitude,
                                longitude=longitude,
                                target_date=planting_day
                            )
                            if historical_data:
                                avg_soil_temp = historical_data['average']
                            else:
                                avg_soil_temp = None

                        if avg_soil_temp is not None:
                            # Apply protection offset to effective temperature
                            effective_temp = avg_soil_temp + protection_offset
                            month_name = get_month_name(planting_day.month)

                            if effective_temp < soil_temp_min:
                                # Still too cold even with protection
                                if protection_offset > 0:
                                    protection_label = protection_type or 'protection'
                                    warnings.append({
                                        'type': 'soil_temp_low',
                                        'message': f"Soil typically too cold for {method_label}: {plant_name} needs {soil_temp_min}°F, {month_name} {day_of_month} averages {avg_soil_temp:.0f}°F (~{effective_temp:.0f}°F with {protection_label}) (10-yr avg)",
                                        'severity': 'warning'
                                    })
                                else:
                                    warnings.append({
                                        'type': 'soil_temp_low',
                                        'message': f"Soil typically too cold for {method_label}: {plant_name} needs {soil_temp_min}°F, {month_name} {day_of_month} averages {avg_soil_temp:.0f}°F historically (10-yr avg)",
                                        'severity': 'warning'
                                    })
                            elif avg_soil_temp < soil_temp_min and effective_temp >= soil_temp_min:
                                # Protection makes it viable, but check if it's still marginal (not optimal)
                                protection_label = protection_type or 'protection'

                                # If effective temp is below optimal (min + 10°F), mark as marginal
                                if effective_temp < soil_temp_min + 10:
                                    warning_type = 'soil_temp_marginal'
                                    message = f"Soil temp adequate for {method_label} with protection but marginal: {plant_name} needs {soil_temp_min}°F, {month_name} {day_of_month} averages {avg_soil_temp:.0f}°F but {protection_label} adds +{protection_offset}°F (~{effective_temp:.0f}°F)"
                                else:
                                    warning_type = 'soil_temp_protected'
                                    message = f"Soil temp optimal for {method_label} with protection: {plant_name} needs {soil_temp_min}°F, {month_name} {day_of_month} averages {avg_soil_temp:.0f}°F and {protection_label} adds +{protection_offset}°F (~{effective_temp:.0f}°F)"

                                warnings.append({
                                    'type': warning_type,
                                    'message': message,
                                    'severity': 'info'
                                })
                            elif effective_temp < soil_temp_min + 5:
                                # Marginal - average is close to minimum
                                warnings.append({
                                    'type': 'soil_temp_marginal',
                                    'message': f"Marginal soil temp for {method_label}: {plant_name} needs {soil_temp_min}°F, {month_name} {day_of_month} averages {avg_soil_temp:.0f}°F (10-yr avg)",
                                    'severity': 'info'
                                })

                            # Check for "too hot" conditions for cool-weather crops
                            heat_tolerance = plant.get('heat_tolerance', 'medium')
                            is_cool_weather_crop = heat_tolerance == 'low'

                            if is_cool_weather_crop:
                                max_acceptable_temp = soil_temp_min + 20  # Too hot threshold

                                if avg_soil_temp > max_acceptable_temp:
                                    # Protection doesn't help with heat - note this in message
                                    warnings.append({
                                        'type': 'soil_temp_high',
                                        'message': f"Too hot: {plant_name} prefers cool weather. {month_name} {day_of_month} averages {avg_soil_temp:.0f}°F, exceeds optimal range (max {max_acceptable_temp:.0f}°F). May bolt or perform poorly (10-yr avg)",
                                        'severity': 'warning'
                                    })
                    else:
                        logger.warning(f"Could not fetch historical soil temp for {planting_day}")
                else:
                    # Today or tomorrow: use current measured soil temperature
                    soil_temp_data = get_soil_temperature_with_adjustments(
                        latitude=latitude,
                        longitude=longitude,
                        soil_type=soil_type,
                        sun_exposure=sun_exposure,
                        mulch_type='none'
                    )

                    current_soil_temp = soil_temp_data.get('final_soil_temp')

                    if current_soil_temp:
                        # Apply protection offset
                        effective_temp = current_soil_temp + protection_offset

                        if effective_temp < soil_temp_min:
                            # Still too cold even with protection
                            if protection_offset > 0:
                                protection_label = protection_type or 'protection'
                                warnings.append({
                                    'type': 'soil_temp_low',
                                    'message': f"Soil too cold for {method_label}: {plant_name} needs {soil_temp_min}°F, current is {current_soil_temp:.0f}°F (~{effective_temp:.0f}°F with {protection_label})",
                                    'severity': 'warning'
                                })
                            else:
                                warnings.append({
                                    'type': 'soil_temp_low',
                                    'message': f"Soil too cold for {method_label}: {plant_name} needs {soil_temp_min}°F soil, current is {current_soil_temp:.0f}°F",
                                    'severity': 'warning'
                                })
                        elif current_soil_temp < soil_temp_min and effective_temp >= soil_temp_min:
                            # Protection makes it viable, but check if it's still marginal (not optimal)
                            protection_label = protection_type or 'protection'

                            # If effective temp is below optimal (min + 10°F), mark as marginal
                            if effective_temp < soil_temp_min + 10:
                                warning_type = 'soil_temp_marginal'
                                message = f"Soil temp adequate for {method_label} with protection but marginal: {plant_name} needs {soil_temp_min}°F, current is {current_soil_temp:.0f}°F but {protection_label} adds +{protection_offset}°F (~{effective_temp:.0f}°F)"
                            else:
                                warning_type = 'soil_temp_protected'
                                message = f"Soil temp optimal for {method_label} with protection: {plant_name} needs {soil_temp_min}°F, current is {current_soil_temp:.0f}°F and {protection_label} adds +{protection_offset}°F (~{effective_temp:.0f}°F)"

                            warnings.append({
                                'type': warning_type,
                                'message': message,
                                'severity': 'info'
                            })

                        # Check for "too hot" conditions for cool-weather crops
                        heat_tolerance = plant.get('heat_tolerance', 'medium')
                        is_cool_weather_crop = heat_tolerance == 'low'

                        if is_cool_weather_crop:
                            max_acceptable_temp = soil_temp_min + 20  # Too hot threshold

                            if current_soil_temp > max_acceptable_temp:
                                # Protection doesn't help with heat - note this in message
                                warnings.append({
                                    'type': 'soil_temp_high',
                                    'message': f"Too hot: {plant_name} prefers cool weather. Current soil temperature {current_soil_temp:.0f}°F exceeds optimal range (max {max_acceptable_temp:.0f}°F). May bolt or perform poorly",
                                    'severity': 'warning'
                                })
            except Exception as e:
                # Don't fail validation if weather service is unavailable
                logger.warning(f"Could not fetch soil temperature: {e}")

    return warnings


def calculate_optimal_planting_dates(
    plant_name: str,
    soil_temp_min: float,
    latitude: float,
    longitude: float,
    current_date: datetime,
    protection_offset: float = 0,
    plant_id: str = None,
    planting_method: str = 'seed',
    last_frost_date: date = None,
    frost_tolerance: str = None
) -> dict:
    """
    Calculate optimal planting date range based on soil temperature.

    Args:
        plant_name: Name of plant
        soil_temp_min: Minimum soil temperature requirement (F)
        latitude: Location latitude
        longitude: Location longitude
        current_date: User's selected planting date
        protection_offset: Temperature boost from season extension (F)
        plant_id: Plant ID for looking up transplant timing (optional)
        planting_method: 'seed' for direct seeding, 'transplant' for indoor starts

    Returns:
        {
            'earliest_safe_date': '2025-04-15',  # First day >= min temp (or indoor start date for transplants)
            'optimal_start': '2025-04-22',        # First day >= min + 10°F (or indoor start date for transplants)
            'optimal_end': '2025-05-30',          # Last day >= min + 10°F (before too hot) (or indoor start date for transplants)
            'optimal_range': 'April 22 - May 30, 2025',
            'reason': 'Kale grows best when soil is 50-60°F'
        }
    """
    OPTIMAL_OFFSET = 10.0  # Degrees above minimum for optimal conditions
    MAX_TEMP_OFFSET = 20.0  # Too hot threshold

    # Get historical daily temps for next 3 months
    optimal_start = None
    optimal_end = None
    earliest_safe = None
    optimal_start_date = None
    optimal_end_date = None

    # Search forward from current date
    search_date = current_date if isinstance(current_date, date) else current_date.date()

    for days_ahead in range(180):  # Search up to 6 months ahead
        check_date = search_date + timedelta(days=days_ahead)
        month = check_date.month
        day = check_date.day

        # Get historical daily average for this day
        daily_temps = get_historical_daily_soil_temps(latitude, longitude, month)
        if not daily_temps or day not in daily_temps:
            continue

        avg_temp = daily_temps[day] + protection_offset

        # Find earliest safe date (>= min)
        if earliest_safe is None and avg_temp >= soil_temp_min:
            earliest_safe = check_date.strftime('%Y-%m-%d')

        # Find optimal window (>= min + 10°F, <= min + 20°F)
        if avg_temp >= soil_temp_min + OPTIMAL_OFFSET:
            if optimal_start is None:
                optimal_start = check_date.strftime('%Y-%m-%d')
                optimal_start_date = check_date

        # Track end of optimal window
        if optimal_start and avg_temp >= soil_temp_min + OPTIMAL_OFFSET and avg_temp <= soil_temp_min + MAX_TEMP_OFFSET:
            optimal_end = check_date.strftime('%Y-%m-%d')
            optimal_end_date = check_date
        elif optimal_start and avg_temp > soil_temp_min + MAX_TEMP_OFFSET:
            # Too hot, stop searching
            break

    # FROST CLAMPING: For frost-tender plants, don't suggest dates before last frost
    frost_clamped = False
    if last_frost_date and frost_tolerance in ('very-tender', 'tender'):
        frost_date_str = last_frost_date.strftime('%Y-%m-%d')

        if earliest_safe and earliest_safe < frost_date_str:
            earliest_safe = frost_date_str
            frost_clamped = True

        if optimal_start and optimal_start < frost_date_str:
            optimal_start = frost_date_str
            optimal_start_date = last_frost_date if isinstance(last_frost_date, date) else last_frost_date
            frost_clamped = True

    # Format optimal range string
    if optimal_start and optimal_end:
        start_obj = datetime.strptime(optimal_start, '%Y-%m-%d')
        end_obj = datetime.strptime(optimal_end, '%Y-%m-%d')
        optimal_range = f"{start_obj.strftime('%B %d')} - {end_obj.strftime('%B %d, %Y')}"
    elif earliest_safe:
        # No optimal window found, but we have earliest safe date
        # Show a single date instead of range
        safe_obj = datetime.strptime(earliest_safe, '%Y-%m-%d')
        optimal_range = f"{safe_obj.strftime('%B %d, %Y')} (earliest safe date)"
    else:
        optimal_range = None

    # Generate reason message
    method_label = 'seeds' if planting_method in ('seed', 'direct') else 'transplants'
    if frost_clamped:
        reason = f"{plant_name} is frost-tender — wait until after last frost ({last_frost_date.strftime('%B %d')})"
    elif optimal_start:
        optimal_temp = soil_temp_min + OPTIMAL_OFFSET
        reason = f"{plant_name} {method_label} grow best when soil is {optimal_temp:.0f}°F or warmer"
    elif earliest_safe:
        reason = f"{plant_name} {method_label} can be planted when soil reaches {soil_temp_min:.0f}°F"
    else:
        reason = f"No suitable planting window found within 6 months for {plant_name}"

    # TRANSPLANT ADJUSTMENT: If planting method is transplant, adjust dates backwards
    # to show when to START SEEDS INDOORS, not when to transplant outdoors
    # Note: Frontend may send 'direct' or 'seed' for direct seeding
    if planting_method == 'transplant' and plant_id:
        plant = get_plant_by_id(plant_id)
        if plant:
            transplant_weeks_before = plant.get('transplantWeeksBefore', 0)
            if transplant_weeks_before > 0:
                # Adjust all dates backwards by transplant_weeks_before
                if earliest_safe:
                    earliest_safe_dt = datetime.strptime(earliest_safe, '%Y-%m-%d')
                    earliest_safe_dt = earliest_safe_dt - timedelta(weeks=transplant_weeks_before)
                    earliest_safe = earliest_safe_dt.strftime('%Y-%m-%d')

                if optimal_start:
                    optimal_start_dt = datetime.strptime(optimal_start, '%Y-%m-%d')
                    optimal_start_dt = optimal_start_dt - timedelta(weeks=transplant_weeks_before)
                    optimal_start = optimal_start_dt.strftime('%Y-%m-%d')

                if optimal_end:
                    optimal_end_dt = datetime.strptime(optimal_end, '%Y-%m-%d')
                    optimal_end_dt = optimal_end_dt - timedelta(weeks=transplant_weeks_before)
                    optimal_end = optimal_end_dt.strftime('%Y-%m-%d')

                # Regenerate optimal_range with adjusted dates
                if optimal_start and optimal_end:
                    start_obj = datetime.strptime(optimal_start, '%Y-%m-%d')
                    end_obj = datetime.strptime(optimal_end, '%Y-%m-%d')
                    optimal_range = f"{start_obj.strftime('%B %d')} - {end_obj.strftime('%B %d, %Y')}"
                elif earliest_safe:
                    safe_obj = datetime.strptime(earliest_safe, '%Y-%m-%d')
                    optimal_range = f"{safe_obj.strftime('%B %d, %Y')} (earliest safe date)"

                # Update reason message for transplants
                if optimal_start:
                    reason = f"Start {plant_name} seeds indoors {transplant_weeks_before} weeks before outdoor transplant"
                elif earliest_safe:
                    reason = f"Start {plant_name} seeds indoors {transplant_weeks_before} weeks before transplanting"

    return {
        'earliest_safe_date': earliest_safe,
        'optimal_start': optimal_start or earliest_safe,  # Use earliest_safe as fallback
        'optimal_end': optimal_end,
        'optimal_range': optimal_range,
        'reason': reason
    }


def calculate_cooler_planting_dates(
    plant_name: str,
    soil_temp_min: float,
    latitude: float,
    longitude: float,
    current_date: datetime,
    protection_offset: float = 0,
    plant_id: str = None,
    planting_method: str = 'seed',
    last_frost_date: date = None,
    frost_tolerance: str = None
) -> dict:
    """
    Calculate cooler planting dates for heat-sensitive crops (searches earlier spring and later fall).

    Args:
        plant_name: Name of plant
        soil_temp_min: Minimum soil temperature requirement (F)
        latitude: Location latitude
        longitude: Location longitude
        current_date: User's selected planting date (too hot)
        protection_offset: Temperature boost from season extension (F)
        plant_id: Plant ID for looking up transplant timing (optional)
        planting_method: 'seed' for direct seeding, 'transplant' for indoor starts

    Returns:
        {
            'earliest_safe_date': '2025-03-15',
            'optimal_start': '2025-03-22',
            'optimal_end': '2025-04-30',
            'optimal_range': 'March 22 - April 30, 2025 or September 1 - October 15, 2025',
            'reason': 'Lettuce grows best when soil is 50-60°F'
        }
    """
    from datetime import timedelta, date

    OPTIMAL_OFFSET = 10.0  # Degrees above minimum for optimal conditions
    MAX_TEMP_OFFSET = 20.0  # Too hot threshold

    search_date = current_date if isinstance(current_date, date) else current_date.date()

    # Find spring window (search backwards from current date)
    spring_optimal_start = None
    spring_optimal_end = None
    spring_earliest_safe = None

    for days_back in range(180, 0, -1):  # Search up to 6 months back
        check_date = search_date - timedelta(days=days_back)
        month = check_date.month
        day = check_date.day

        # Get historical daily average for this day
        daily_temps = get_historical_daily_soil_temps(latitude, longitude, month)
        if not daily_temps or day not in daily_temps:
            continue

        avg_temp = daily_temps[day] + protection_offset

        # Find earliest safe date (>= min)
        if avg_temp >= soil_temp_min and spring_earliest_safe is None:
            spring_earliest_safe = check_date

        # Find optimal window (>= min + 10°F, <= min + 20°F)
        if avg_temp >= soil_temp_min + OPTIMAL_OFFSET and avg_temp <= soil_temp_min + MAX_TEMP_OFFSET:
            if spring_optimal_start is None:
                spring_optimal_start = check_date
            spring_optimal_end = check_date  # Keep updating as we search forward

    # Find fall window (search forward from current date)
    fall_optimal_start = None
    fall_optimal_end = None
    fall_earliest_safe = None
    found_hot_period = False

    for days_ahead in range(180):  # Search up to 6 months ahead
        check_date = search_date + timedelta(days=days_ahead)
        month = check_date.month
        day = check_date.day

        daily_temps = get_historical_daily_soil_temps(latitude, longitude, month)
        if not daily_temps or day not in daily_temps:
            continue

        avg_temp = daily_temps[day] + protection_offset

        # Skip until we get past the hot period
        if avg_temp > soil_temp_min + MAX_TEMP_OFFSET:
            found_hot_period = True
            continue

        # Once we're past the hot period and temps cool down
        if found_hot_period and avg_temp <= soil_temp_min + MAX_TEMP_OFFSET:
            if avg_temp >= soil_temp_min and fall_earliest_safe is None:
                fall_earliest_safe = check_date

            if avg_temp >= soil_temp_min + OPTIMAL_OFFSET and avg_temp <= soil_temp_min + MAX_TEMP_OFFSET:
                if fall_optimal_start is None:
                    fall_optimal_start = check_date
                fall_optimal_end = check_date

    # FROST CLAMPING: For frost-tender plants, clamp spring dates to after last frost
    frost_clamped = False
    if last_frost_date and frost_tolerance in ('very-tender', 'tender'):
        frost_dt = last_frost_date if isinstance(last_frost_date, date) else last_frost_date

        if spring_earliest_safe and spring_earliest_safe < frost_dt:
            spring_earliest_safe = frost_dt
            frost_clamped = True

        if spring_optimal_start and spring_optimal_start < frost_dt:
            spring_optimal_start = frost_dt
            frost_clamped = True

        # If spring optimal end is before frost date, the spring window is invalid
        if spring_optimal_end and spring_optimal_end < frost_dt:
            spring_optimal_start = None
            spring_optimal_end = None
            spring_earliest_safe = frost_dt if spring_earliest_safe else None

    # Format optimal range string
    ranges = []
    if spring_optimal_start and spring_optimal_end:
        ranges.append(f"{spring_optimal_start.strftime('%B %d')} - {spring_optimal_end.strftime('%B %d, %Y')}")
    elif spring_earliest_safe:
        ranges.append(f"{spring_earliest_safe.strftime('%B %d, %Y')} (earliest spring)")

    if fall_optimal_start and fall_optimal_end:
        ranges.append(f"{fall_optimal_start.strftime('%B %d')} - {fall_optimal_end.strftime('%B %d, %Y')}")
    elif fall_earliest_safe:
        ranges.append(f"{fall_earliest_safe.strftime('%B %d, %Y')} (earliest fall)")

    optimal_range = " or ".join(ranges) if ranges else None

    # Choose the earliest date overall
    all_dates = [d for d in [spring_optimal_start, spring_earliest_safe, fall_optimal_start, fall_earliest_safe] if d]
    earliest_safe = min(all_dates).strftime('%Y-%m-%d') if all_dates else None
    optimal_start = (spring_optimal_start or fall_optimal_start).strftime('%Y-%m-%d') if (spring_optimal_start or fall_optimal_start) else None
    optimal_end = (fall_optimal_end or spring_optimal_end).strftime('%Y-%m-%d') if (fall_optimal_end or spring_optimal_end) else None

    # Generate reason message
    method_label = 'seeds' if planting_method in ('seed', 'direct') else 'transplants'
    if frost_clamped:
        reason = f"{plant_name} is frost-tender — wait until after last frost ({last_frost_date.strftime('%B %d')})"
    elif optimal_start:
        optimal_temp = soil_temp_min + OPTIMAL_OFFSET
        max_temp = soil_temp_min + MAX_TEMP_OFFSET
        reason = f"{plant_name} {method_label} grow best when soil is {optimal_temp:.0f}-{max_temp:.0f}°F (cool weather crop)"
    elif earliest_safe:
        reason = f"{plant_name} {method_label} need cooler weather (below {soil_temp_min + MAX_TEMP_OFFSET:.0f}°F)"
    else:
        reason = f"No suitable cool-weather window found for {plant_name}"

    return {
        'earliest_safe_date': earliest_safe,
        'optimal_start': optimal_start,
        'optimal_end': optimal_end,
        'optimal_range': optimal_range,
        'reason': reason
    }


def validate_planting_for_property(
    plant_id: str,
    planting_date: datetime,
    property_id: int = None,
    zipcode: str = None,
    last_frost_str: str = None,
    first_frost_str: str = None,
    protection_offset: int = 0,
    protection_type: str = None,
    planting_method: str = 'seed'
) -> dict:
    """
    Validate planting conditions using property data or zipcode.

    Args:
        plant_id: ID of the plant
        planting_date: When to plant
        property_id: ID of user's property (optional)
        zipcode: User's zipcode for location lookup (optional)
        last_frost_str: Last frost date string (YYYY-MM-DD)
        first_frost_str: First frost date string (YYYY-MM-DD)
        protection_offset: Temperature offset from season extension (°F)
        protection_type: Type of protection structure (for display)
        planting_method: 'seed' for direct seeding, 'transplant' for transplants

    Returns:
        Dictionary with valid (bool) and warnings (list)
    """
    # Default coordinates (will be overridden by property or zipcode)
    latitude = None
    longitude = None
    soil_type = 'loamy'
    sun_exposure = 'full-sun'  # Must match soil_temperature.py valid values

    # Priority 1: Load property data if available
    if property_id:
        property_data = Property.query.get(property_id)
        if property_data:
            if property_data.latitude:
                latitude = property_data.latitude
            if property_data.longitude:
                longitude = property_data.longitude
            if property_data.soil_type:
                soil_type = property_data.soil_type

    # Priority 2: Use zipcode if no property coordinates
    if zipcode and not (latitude and longitude):
        try:
            geo_result = geocoding_service.validate_address(zipcode)
            if geo_result:
                latitude = geo_result['latitude']
                longitude = geo_result['longitude']
        except Exception as e:
            logger.warning(f"Could not geocode zipcode {zipcode}: {e}")

    # Parse frost dates
    last_frost_date = None
    first_frost_date = None

    if last_frost_str:
        try:
            last_frost_date = datetime.strptime(last_frost_str, '%Y-%m-%d')
        except ValueError:
            pass

    if first_frost_str:
        try:
            first_frost_date = datetime.strptime(first_frost_str, '%Y-%m-%d')
        except ValueError:
            pass

    # Run validation
    warnings = validate_planting_conditions(
        plant_id=plant_id,
        planting_date=planting_date,
        latitude=latitude,
        longitude=longitude,
        last_frost_date=last_frost_date,
        first_frost_date=first_frost_date,
        soil_type=soil_type,
        sun_exposure=sun_exposure,
        protection_offset=protection_offset,
        protection_type=protection_type,
        planting_method=planting_method
    )

    # Only count 'warning' severity as invalid, not 'info' (marginal conditions)
    blocking_warnings = [w for w in warnings if w.get('severity') == 'warning']

    # Generate date suggestions to show optimal planting windows
    # Always generate suggestions when we have location data, not just when there are warnings
    # This shows users the best planting times even if current date is "acceptable"
    suggestion = None

    has_cold_warning = any(
        w.get('type') in ['soil_temp_marginal', 'soil_temp_low']
        for w in warnings
    )
    has_hot_warning = any(
        w.get('type') == 'soil_temp_high'
        for w in warnings
    )

    # Always generate suggestions when location is available
    if latitude and longitude:
        # Get plant data to extract requirements
        plant = get_plant_by_id(plant_id)
        if plant:
            plant_name = plant.get('name', plant_id)
            heat_tolerance = plant.get('heat_tolerance', 'medium')
            is_cool_weather_crop = heat_tolerance == 'low'

            # Get soil temp requirement based on planting method
            # Note: Frontend may send 'direct' or 'seed' for direct seeding
            if planting_method in ('seed', 'direct'):
                soil_temp_min = plant.get('soil_temp_min') or plant.get('germinationTemp', {}).get('min')
            else:
                plant_min = plant.get('soil_temp_min') or plant.get('germinationTemp', {}).get('min')
                soil_temp_min = max(40, plant_min * 0.8) if plant_min else 40

            if soil_temp_min:
                # Determine which calculation to use:
                # - If there's a "too hot" warning, use calculate_cooler_planting_dates (find cooler windows)
                # - Otherwise, use calculate_optimal_planting_dates (find when soil warms up)
                if has_hot_warning:
                    # Too hot now: find cooler planting dates (earlier spring or fall)
                    suggestion = calculate_cooler_planting_dates(
                        plant_name=plant_name,
                        soil_temp_min=soil_temp_min,
                        latitude=latitude,
                        longitude=longitude,
                        current_date=planting_date,
                        protection_offset=protection_offset,
                        plant_id=plant_id,
                        planting_method=planting_method,
                        last_frost_date=last_frost_date.date() if last_frost_date else None,
                        frost_tolerance=plant.get('frostTolerance')
                    )
                else:
                    # Not too hot: find optimal planting dates (when soil warms up enough)
                    suggestion = calculate_optimal_planting_dates(
                        plant_name=plant_name,
                        soil_temp_min=soil_temp_min,
                        latitude=latitude,
                        longitude=longitude,
                        current_date=planting_date,
                        protection_offset=protection_offset,
                        plant_id=plant_id,
                        planting_method=planting_method,
                        last_frost_date=last_frost_date.date() if last_frost_date else None,
                        frost_tolerance=plant.get('frostTolerance')
                    )

    return {
        'valid': len(blocking_warnings) == 0,
        'warnings': warnings,
        'suggestion': suggestion
    }


def suggest_optimal_date_range(
    plant_id: str,
    start_date: datetime,
    latitude: float = None,
    longitude: float = None,
    last_frost_date: datetime = None,
    first_frost_date: datetime = None,
    soil_type: str = 'loamy',
    sun_exposure: str = 'full',
    protection_offset: int = 0,
    planting_method: str = 'seed',
    max_days_ahead: int = 120
) -> dict:
    """
    Suggest optimal planting date range based on plant requirements.

    Args:
        plant_id: ID of the plant to validate
        start_date: Date to start searching from (typically current planting date with warnings)
        latitude: Property latitude for weather data
        longitude: Property longitude for weather data
        last_frost_date: Last spring frost date
        first_frost_date: First fall frost date
        soil_type: Property soil type for temperature adjustments
        sun_exposure: Garden bed sun exposure
        protection_offset: Temperature offset from season extension (°F)
        planting_method: 'seed' for direct seeding, 'transplant' for transplants
        max_days_ahead: How many days into the future to search (default 120)

    Returns:
        Dictionary with:
        - earliest_safe_date: First date with no warnings (or None)
        - optimal_range: String describing optimal planting window (or None)
        - reason: Explanation of suggestion
    """
    from datetime import timedelta

    # Get plant data
    plant = get_plant_by_id(plant_id)
    if not plant:
        return {
            'earliest_safe_date': None,
            'optimal_range': None,
            'reason': 'Plant not found'
        }

    plant_name = plant.get('name', plant_id)

    # Get required soil temperature
    if planting_method == 'seed':
        soil_temp_min = plant.get('soil_temp_min') or plant.get('germinationTemp', {}).get('min')
    else:
        plant_min = plant.get('soil_temp_min') or plant.get('germinationTemp', {}).get('min')
        soil_temp_min = max(40, plant_min * 0.8) if plant_min else 40

    # Check if plant is frost-tender
    frost_tolerance = plant.get('frostTolerance', 'half-hardy')
    is_tender = frost_tolerance in ['very-tender', 'tender']

    # Search for earliest safe date
    earliest_safe_date = None
    optimal_start = None
    optimal_end = None
    reason_parts = []

    # Iterate through future dates to find when conditions are suitable
    for days_ahead in range(max_days_ahead):
        check_date = start_date + timedelta(days=days_ahead)

        # Validate this date
        warnings = validate_planting_conditions(
            plant_id=plant_id,
            planting_date=check_date,
            latitude=latitude,
            longitude=longitude,
            last_frost_date=last_frost_date,
            first_frost_date=first_frost_date,
            soil_type=soil_type,
            sun_exposure=sun_exposure,
            protection_offset=protection_offset,
            planting_method=planting_method
        )

        # Filter to only blocking warnings (severity == 'warning')
        blocking_warnings = [w for w in warnings if w.get('severity') == 'warning']

        # Found a safe date!
        if not blocking_warnings and earliest_safe_date is None:
            earliest_safe_date = check_date
            optimal_start = check_date

            # Define optimal range as ~2-3 weeks from earliest safe date
            optimal_end = check_date + timedelta(days=21)

            # Build reason based on what was blocking before
            if soil_temp_min and latitude and longitude:
                reason_parts.append(f"soil reaches {soil_temp_min}°F")
            if is_tender and last_frost_date:
                if check_date.month >= last_frost_date.month and check_date.day >= last_frost_date.day:
                    reason_parts.append(f"after last frost ({last_frost_date.strftime('%B %d')})")

            break

    # Format result
    if earliest_safe_date:
        reason = f"{plant_name} can typically be planted when " + " and ".join(reason_parts) if reason_parts else f"{plant_name} conditions are suitable"

        # Format optimal range string
        if optimal_start.year == optimal_end.year and optimal_start.month == optimal_end.month:
            # Same month
            optimal_range = f"{optimal_start.strftime('%B %d')}-{optimal_end.strftime('%d, %Y')}"
        elif optimal_start.year == optimal_end.year:
            # Same year, different month
            optimal_range = f"{optimal_start.strftime('%B %d')} - {optimal_end.strftime('%B %d, %Y')}"
        else:
            # Different years
            optimal_range = f"{optimal_start.strftime('%B %d, %Y')} - {optimal_end.strftime('%B %d, %Y')}"

        return {
            'earliest_safe_date': earliest_safe_date.strftime('%Y-%m-%d'),
            'optimal_range': optimal_range,
            'reason': reason
        }
    else:
        # No safe date found in search window
        reason = f"No suitable planting window found within {max_days_ahead} days"
        if not latitude or not longitude:
            reason += " (location data needed for accurate suggestions)"

        return {
            'earliest_safe_date': None,
            'optimal_range': None,
            'reason': reason
        }
