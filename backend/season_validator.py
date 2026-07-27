"""
Season and weather validation for planting decisions.
Checks if planting conditions are appropriate based on:
- Soil temperature vs plant requirements
- Season appropriateness
- Frost risk for tender plants
"""

import logging
from datetime import datetime, date, timedelta
from simulation_clock import get_today, is_simulating
from plant_database import get_plant_by_id
from soil_temperature import SUN_EXPOSURE_ADJUSTMENTS, get_soil_temperature_with_adjustments
from historical_soil_temp import get_historical_soil_temp_for_date, get_historical_daily_soil_temps, get_month_name
from models import Property
from services.geocoding_service import geocoding_service

logger = logging.getLogger(__name__)


def get_sun_exposure_offset(sun_exposure: str = None) -> float:
    """Return temperature adjustment relative to full sun."""
    exposure = str(sun_exposure or 'full-sun').strip().lower().replace('_', '-')
    if exposure not in SUN_EXPOSURE_ADJUSTMENTS:
        exposure = 'full-sun'

    full_sun_adjustment = SUN_EXPOSURE_ADJUSTMENTS['full-sun']
    return SUN_EXPOSURE_ADJUSTMENTS[exposure] - full_sun_adjustment


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
    sun_exposure: str = 'full-sun',
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

                # Use historical averages when planting is >1 day out, OR whenever
                # simulation mode is active. Live weather APIs (Open-Meteo current
                # soil temp) always return the real system clock's value, so they
                # must not be used when the user is simulating a different "today".
                # Mirrors the routing philosophy in simulation_weather.py.
                if days_until_planting > 1 or is_simulating():
                    # Future date (or simulated today): use historical daily averages
                    logger.info(f"Using historical averages for {planting_day} ({days_until_planting} days ahead, simulating={is_simulating()})")

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
                            # Historical averages are treated as full-sun baseline;
                            # adjust selected-bed shade relative to that baseline.
                            sun_offset = get_sun_exposure_offset(sun_exposure)
                            base_soil_temp = avg_soil_temp + sun_offset
                            effective_temp = base_soil_temp + protection_offset
                            month_name = get_month_name(planting_day.month)

                            if effective_temp < soil_temp_min:
                                # Still too cold even with protection
                                if protection_offset > 0:
                                    protection_label = protection_type or 'protection'
                                    warnings.append({
                                        'type': 'soil_temp_low',
                                        'message': f"Soil typically too cold for {method_label}: {plant_name} needs {soil_temp_min}°F, {month_name} {day_of_month} averages {base_soil_temp:.0f}°F (~{effective_temp:.0f}°F with {protection_label}) (10-yr avg)",
                                        'severity': 'warning'
                                    })
                                else:
                                    warnings.append({
                                        'type': 'soil_temp_low',
                                        'message': f"Soil typically too cold for {method_label}: {plant_name} needs {soil_temp_min}°F, {month_name} {day_of_month} averages {base_soil_temp:.0f}°F historically (10-yr avg)",
                                        'severity': 'warning'
                                    })
                            elif base_soil_temp < soil_temp_min and effective_temp >= soil_temp_min:
                                # Protection makes it viable, but check if it's still marginal (not optimal)
                                protection_label = protection_type or 'protection'

                                # If effective temp is below optimal (min + 10°F), mark as marginal
                                if effective_temp < soil_temp_min + 10:
                                    warning_type = 'soil_temp_marginal'
                                    message = f"Soil temp adequate for {method_label} with protection but marginal: {plant_name} needs {soil_temp_min}°F, {month_name} {day_of_month} averages {base_soil_temp:.0f}°F but {protection_label} adds +{protection_offset}°F (~{effective_temp:.0f}°F)"
                                else:
                                    warning_type = 'soil_temp_protected'
                                    message = f"Soil temp optimal for {method_label} with protection: {plant_name} needs {soil_temp_min}°F, {month_name} {day_of_month} averages {base_soil_temp:.0f}°F and {protection_label} adds +{protection_offset}°F (~{effective_temp:.0f}°F)"

                                warnings.append({
                                    'type': warning_type,
                                    'message': message,
                                    'severity': 'info'
                                })
                            elif effective_temp < soil_temp_min + 5:
                                # Marginal - average is close to minimum
                                warnings.append({
                                    'type': 'soil_temp_marginal',
                                    'message': f"Marginal soil temp for {method_label}: {plant_name} needs {soil_temp_min}°F, {month_name} {day_of_month} averages {base_soil_temp:.0f}°F (10-yr avg)",
                                    'severity': 'info'
                                })

                            # Check for "too hot" conditions for cool-weather crops
                            heat_tolerance = plant.get('heat_tolerance', 'medium')
                            is_cool_weather_crop = heat_tolerance == 'low'

                            if is_cool_weather_crop:
                                max_acceptable_temp = soil_temp_min + 20  # Too hot threshold

                                if base_soil_temp > max_acceptable_temp:
                                    # Protection doesn't help with heat - note this in message
                                    warnings.append({
                                        'type': 'soil_temp_high',
                                        'message': f"Too hot: {plant_name} prefers cool weather. {month_name} {day_of_month} averages {base_soil_temp:.0f}°F, exceeds optimal range (max {max_acceptable_temp:.0f}°F). May bolt or perform poorly (10-yr avg)",
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

        # Track end of optimal window
        if optimal_start and avg_temp >= soil_temp_min + OPTIMAL_OFFSET and avg_temp <= soil_temp_min + MAX_TEMP_OFFSET:
            optimal_end = check_date.strftime('%Y-%m-%d')
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

    # Search forward 365 days from search_date. All returned dates are >= search_date.
    # A cool-weather crop has two valid windows per year: the "spring" window that
    # exists BEFORE the annual hot period, and the "fall" window that exists AFTER
    # the hot period. We walk forward through the year and assign each hit to one
    # or the other depending on whether we've already passed through a hot stretch.
    spring_optimal_start = None
    spring_optimal_end = None
    spring_earliest_safe = None
    fall_optimal_start = None
    fall_optimal_end = None
    fall_earliest_safe = None
    found_hot_period = False

    # Cache daily_temps per (month) to avoid repeated lookups across the year
    month_temp_cache = {}

    for days_ahead in range(365):
        check_date = search_date + timedelta(days=days_ahead)
        month = check_date.month
        day = check_date.day

        if month not in month_temp_cache:
            month_temp_cache[month] = get_historical_daily_soil_temps(latitude, longitude, month)
        daily_temps = month_temp_cache[month]
        if not daily_temps or day not in daily_temps:
            continue

        avg_temp = daily_temps[day] + protection_offset

        # Detect the hot period: temps exceed the max acceptable threshold
        if avg_temp > soil_temp_min + MAX_TEMP_OFFSET:
            found_hot_period = True
            continue

        if not found_hot_period:
            # Pre-hot: assign to spring window
            if avg_temp >= soil_temp_min and spring_earliest_safe is None:
                spring_earliest_safe = check_date

            if avg_temp >= soil_temp_min + OPTIMAL_OFFSET and avg_temp <= soil_temp_min + MAX_TEMP_OFFSET:
                if spring_optimal_start is None:
                    spring_optimal_start = check_date
                spring_optimal_end = check_date  # Extend as long as consecutive days stay optimal
        else:
            # Post-hot: assign to fall window
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
    sun_exposure: str = 'full-sun',
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
        sun_exposure: Garden bed sun exposure
        planting_method: 'seed' for direct seeding, 'transplant' for transplants

    Returns:
        Dictionary with valid (bool) and warnings (list)
    """
    # Default coordinates (will be overridden by property or zipcode)
    latitude = None
    longitude = None
    soil_type = 'loamy'

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

    has_hot_warning = any(
        w.get('type') == 'soil_temp_high'
        for w in warnings
    )

    suggestion_offset = protection_offset + get_sun_exposure_offset(sun_exposure)

    # Always generate suggestions when location is available
    if latitude and longitude:
        # Get plant data to extract requirements
        plant = get_plant_by_id(plant_id)
        if plant:
            plant_name = plant.get('name', plant_id)

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
                        protection_offset=suggestion_offset,
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
                        protection_offset=suggestion_offset,
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
