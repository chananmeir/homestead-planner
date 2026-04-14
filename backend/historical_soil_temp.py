"""
Historical Soil Temperature Module

Fetches historical soil temperature data from Open-Meteo Archive API
to provide monthly averages for planting validation.
"""

import logging
import time
import requests
from datetime import datetime, date
from simulation_clock import get_now
from typing import Optional, Dict

logger = logging.getLogger(__name__)

# Open-Meteo Archive API endpoint
ARCHIVE_API_URL = "https://archive-api.open-meteo.com/v1/archive"

# Cache for historical monthly data
# Format: {(lat, lon, month): {'average': float, 'min': float, 'max': float, 'timestamp': datetime}}
_historical_cache = {}

# Cache for daily historical averages
# Format: {(lat, lon, month): {1: float, 2: float, ..., 31: float, 'timestamp': datetime}}
_daily_cache = {}

# Cache expiration (30 days - historical data doesn't change often)
CACHE_EXPIRY_DAYS = 30

# Rate limiting for API requests
_last_request_time = 0
_MIN_REQUEST_GAP = 0.3  # seconds between requests


def _fetch_with_retry(params, max_retries=3, timeout=15):
    """
    Fetch from Open-Meteo Archive API with retry on 429 rate limit errors.
    Uses exponential backoff: 1s, 2s, 4s.
    """
    global _last_request_time

    for attempt in range(max_retries + 1):
        # Throttle: ensure minimum gap between requests
        elapsed = time.time() - _last_request_time
        if elapsed < _MIN_REQUEST_GAP:
            time.sleep(_MIN_REQUEST_GAP - elapsed)

        _last_request_time = time.time()

        try:
            response = requests.get(ARCHIVE_API_URL, params=params, timeout=timeout)
            if response.status_code == 429:
                if attempt < max_retries:
                    wait_time = 2 ** attempt  # 1, 2, 4 seconds
                    logger.info(f"Rate limited by Open-Meteo (429), retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                    time.sleep(wait_time)
                    continue
            response.raise_for_status()
            return response
        except requests.exceptions.RequestException:
            if attempt < max_retries:
                wait_time = 2 ** attempt
                logger.info(f"API request failed, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
                continue
            raise


def get_historical_monthly_soil_temp(
    latitude: float,
    longitude: float,
    month: int,
    years_back: int = 10
) -> Optional[Dict]:
    """
    Get historical average soil temperature for a specific month and location.

    Uses Open-Meteo Archive API to fetch soil temperature data for the past
    N years and calculates monthly averages.

    Args:
        latitude: Location latitude
        longitude: Location longitude
        month: Month number (1-12)
        years_back: Number of years of history to average (default: 10)

    Returns:
        Dictionary with average, min, max temperatures, or None if fetch fails
        {
            'average': float,  # Average soil temp for this month (°F)
            'min': float,      # Lowest recorded (°F)
            'max': float,      # Highest recorded (°F)
            'years_analyzed': int,
            'data_points': int
        }
    """
    from collections import defaultdict

    # Round coordinates for cache key (0.1 degree precision)
    cache_lat = round(latitude, 1)
    cache_lon = round(longitude, 1)
    cache_key = (cache_lat, cache_lon, month)

    # Check cache first
    if cache_key in _historical_cache:
        cached = _historical_cache[cache_key]
        cache_age = (datetime.now() - cached['timestamp']).days
        if cache_age < CACHE_EXPIRY_DAYS:
            return cached['data']

    # Calculate date range for query
    current_year = get_now().year
    start_year = current_year - years_back

    # Fetch full year range - cache ALL months from one API call
    start_date = f"{start_year}-01-01"
    end_date = f"{current_year - 1}-12-31"

    try:
        params = {
            'latitude': latitude,
            'longitude': longitude,
            'start_date': start_date,
            'end_date': end_date,
            'daily': 'soil_temperature_0_to_7cm_mean',
            'temperature_unit': 'fahrenheit',
            'timezone': 'auto'
        }

        response = _fetch_with_retry(params)
        data = response.json()

        if 'daily' not in data or 'soil_temperature_0_to_7cm_mean' not in data['daily']:
            logger.warning(f"No soil temperature data in response for {latitude}, {longitude}")
            return None

        dates = data['daily']['time']
        temps = data['daily']['soil_temperature_0_to_7cm_mean']

        # Group temperatures by month and cache ALL months from this response
        all_months = defaultdict(list)
        for i, date_str in enumerate(dates):
            if temps[i] is not None:
                dt = datetime.strptime(date_str, '%Y-%m-%d')
                all_months[dt.month].append(temps[i])

        now = datetime.now()
        for m, m_temps in all_months.items():
            m_key = (cache_lat, cache_lon, m)
            m_result = {
                'average': round(sum(m_temps) / len(m_temps), 1),
                'min': round(min(m_temps), 1),
                'max': round(max(m_temps), 1),
                'years_analyzed': years_back,
                'data_points': len(m_temps)
            }
            _historical_cache[m_key] = {
                'data': m_result,
                'timestamp': now
            }

        if cache_key in _historical_cache:
            return _historical_cache[cache_key]['data']

        logger.warning(f"No temperature data found for month {month}")
        return None

    except requests.exceptions.RequestException as e:
        logger.warning(f"Historical soil temp API error: {e}")
        return None
    except (KeyError, ValueError) as e:
        logger.warning(f"Historical soil temp parsing error: {e}")
        return None


def get_historical_daily_soil_temps(
    latitude: float,
    longitude: float,
    month: int,
    years_back: int = 10
) -> Optional[Dict[int, float]]:
    """
    Get daily historical average soil temperatures for a specific month.

    Returns a dictionary mapping day-of-month (1-31) to average temperature
    calculated from the past N years of data.

    Args:
        latitude: Location latitude
        longitude: Location longitude
        month: Month number (1-12)
        years_back: Number of years of history to average (default: 10)

    Returns:
        Dictionary mapping day to average temperature in °F, or None if fetch fails
        Example: {1: 68.1, 2: 68.5, ..., 30: 75.2}
    """
    from collections import defaultdict

    # Round coordinates for cache key (0.1 degree precision)
    cache_lat = round(latitude, 1)
    cache_lon = round(longitude, 1)
    cache_key = (cache_lat, cache_lon, month)

    # Check cache first
    if cache_key in _daily_cache:
        cached = _daily_cache[cache_key]
        cache_age = (datetime.now() - cached['timestamp']).days
        if cache_age < CACHE_EXPIRY_DAYS:
            return cached['data']

    # Fetch full year range and cache ALL months from one API call
    current_year = get_now().year
    start_year = current_year - years_back
    start_date = f"{start_year}-01-01"
    end_date = f"{current_year - 1}-12-31"

    try:
        params = {
            'latitude': latitude,
            'longitude': longitude,
            'start_date': start_date,
            'end_date': end_date,
            'daily': 'soil_temperature_0_to_7cm_mean',
            'temperature_unit': 'fahrenheit',
            'timezone': 'auto'
        }

        response = _fetch_with_retry(params)
        data = response.json()

        if 'daily' not in data or 'soil_temperature_0_to_7cm_mean' not in data['daily']:
            logger.warning(f"No soil temperature data in response for {latitude}, {longitude}")
            return None

        dates = data['daily']['time']
        temps = data['daily']['soil_temperature_0_to_7cm_mean']

        # Group temperatures by month AND day-of-month, cache all months
        all_months = defaultdict(lambda: defaultdict(list))
        for i, date_str in enumerate(dates):
            if temps[i] is not None:
                dt = datetime.strptime(date_str, '%Y-%m-%d')
                all_months[dt.month][dt.day].append(temps[i])

        now = datetime.now()
        for m, daily_data in all_months.items():
            m_key = (cache_lat, cache_lon, m)
            m_result = {
                day: round(sum(t_list) / len(t_list), 1)
                for day, t_list in daily_data.items()
            }
            _daily_cache[m_key] = {'data': m_result, 'timestamp': now}

        if cache_key in _daily_cache:
            return _daily_cache[cache_key]['data']

        logger.warning(f"No temperature data found for month {month}")
        return None

    except requests.exceptions.RequestException as e:
        logger.warning(f"Historical daily soil temp API error: {e}")
        return None
    except (KeyError, ValueError) as e:
        logger.warning(f"Historical daily soil temp parsing error: {e}")
        return None


def get_historical_soil_temp_for_date(
    latitude: float,
    longitude: float,
    target_date: date
) -> Optional[Dict]:
    """
    Get historical soil temperature data for a specific date's month.

    Convenience wrapper around get_historical_monthly_soil_temp.

    Args:
        latitude: Location latitude
        longitude: Location longitude
        target_date: The date to get historical data for

    Returns:
        Dictionary with historical temperature statistics, or None
    """
    return get_historical_monthly_soil_temp(latitude, longitude, target_date.month)


def clear_historical_cache():
    """Clear the historical data cache (both monthly and daily)."""
    global _historical_cache, _daily_cache, _daily_air_temp_cache
    _historical_cache = {}
    _daily_cache = {}
    _daily_air_temp_cache = {}


# Cache for daily historical air temperatures
# Format: {(lat, lon, month): {1: float, 2: float, ..., 31: float, 'timestamp': datetime}}
_daily_air_temp_cache = {}


def get_historical_daily_air_temps(
    latitude: float,
    longitude: float,
    month: int,
    years_back: int = 10
) -> Optional[Dict[int, float]]:
    """
    Get daily historical average MINIMUM air temperatures for a specific month.

    This is used to check if seedlings will survive cold snaps. Unlike soil temperature,
    air temperature can drop much lower and is what actually affects above-ground plant parts.

    Returns a dictionary mapping day-of-month (1-31) to average MINIMUM temperature
    calculated from the past N years of data.

    Args:
        latitude: Location latitude
        longitude: Location longitude
        month: Month number (1-12)
        years_back: Number of years of history to average (default: 10)

    Returns:
        Dictionary mapping day to average minimum temperature in °F, or None if fetch fails
        Example: {1: 15.2, 2: 14.8, ..., 28: 18.5}
    """
    from collections import defaultdict

    # Round coordinates for cache key (0.1 degree precision)
    cache_lat = round(latitude, 1)
    cache_lon = round(longitude, 1)
    cache_key = (cache_lat, cache_lon, month)

    # Check cache first
    if cache_key in _daily_air_temp_cache:
        cached = _daily_air_temp_cache[cache_key]
        cache_age = (datetime.now() - cached['timestamp']).days
        if cache_age < CACHE_EXPIRY_DAYS:
            return cached['data']

    # Fetch full year range and cache ALL months from one API call
    current_year = get_now().year
    start_year = current_year - years_back
    start_date = f"{start_year}-01-01"
    end_date = f"{current_year - 1}-12-31"

    try:
        params = {
            'latitude': latitude,
            'longitude': longitude,
            'start_date': start_date,
            'end_date': end_date,
            'daily': 'temperature_2m_min',  # Minimum air temperature at 2 meters
            'temperature_unit': 'fahrenheit',
            'timezone': 'auto'
        }

        response = _fetch_with_retry(params)
        data = response.json()

        if 'daily' not in data or 'temperature_2m_min' not in data['daily']:
            logger.warning(f"No air temperature data in response for {latitude}, {longitude}")
            return None

        dates = data['daily']['time']
        temps = data['daily']['temperature_2m_min']

        # Group temperatures by month AND day-of-month, cache all months
        all_months = defaultdict(lambda: defaultdict(list))
        for i, date_str in enumerate(dates):
            if temps[i] is not None:
                dt = datetime.strptime(date_str, '%Y-%m-%d')
                all_months[dt.month][dt.day].append(temps[i])

        now = datetime.now()
        for m, daily_data in all_months.items():
            m_key = (cache_lat, cache_lon, m)
            m_result = {
                day: round(sum(t_list) / len(t_list), 1)
                for day, t_list in daily_data.items()
            }
            _daily_air_temp_cache[m_key] = {'data': m_result, 'timestamp': now}

        logger.info(f"Fetched and cached historical air temps for {len(all_months)} months")

        if cache_key in _daily_air_temp_cache:
            return _daily_air_temp_cache[cache_key]['data']

        logger.warning(f"No air temperature data found for month {month}")
        return None

    except requests.exceptions.RequestException as e:
        logger.warning(f"Historical daily air temp API error: {e}")
        return None
    except (KeyError, ValueError) as e:
        logger.warning(f"Historical daily air temp parsing error: {e}")
        return None


def get_month_name(month: int) -> str:
    """Get month name from number."""
    months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ]
    return months[month - 1] if 1 <= month <= 12 else 'Unknown'
