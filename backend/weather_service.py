"""
Weather Service Module

Provides weather data integration using Open-Meteo API.
Includes caching to avoid rate limits and fallback to mock data on errors.
Open-Meteo is free, requires no API key, and provides up to 16 days forecast.
"""

import os
import logging
import requests
from datetime import datetime, timedelta, date
from simulation_clock import get_today
from typing import Optional, Tuple
import random
import openmeteo_requests
import requests_cache
from retry_requests import retry

logger = logging.getLogger(__name__)

# Setup the Open-Meteo API client with caching and retries
import tempfile
cache_dir = os.path.join(tempfile.gettempdir(), 'openmeteo_weather_cache')
cache_session = requests_cache.CachedSession(cache_dir, expire_after=900)  # 15 minutes
retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
openmeteo = openmeteo_requests.Client(session=retry_session)


# Simple in-memory cache for weather data
_weather_cache = {
    'temperature': None,
    'location': None,
    'timestamp': None
}

# Separate cache for forecast data
_forecast_cache = {
    'data': None,
    'location': None,
    'timestamp': None,
    'days': None
}

# Cache expiration time (15 minutes)
CACHE_EXPIRY_MINUTES = 15

# Default location for testing (New York City)
DEFAULT_LAT = 40.7128
DEFAULT_LON = -74.0060

# Open-Meteo API endpoint
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def _is_cache_valid(lat: float, lon: float) -> bool:
    """
    Check if cached weather data is still valid.

    Args:
        lat: Latitude to check against cache
        lon: Longitude to check against cache

    Returns:
        True if cache is valid and matches location, False otherwise
    """
    if not all([_weather_cache['temperature'],
                _weather_cache['location'],
                _weather_cache['timestamp']]):
        return False

    # Check if location matches
    cached_lat, cached_lon = _weather_cache['location']
    if abs(cached_lat - lat) > 0.01 or abs(cached_lon - lon) > 0.01:
        return False

    # Check if cache is still fresh (within expiry time)
    time_since_cache = datetime.now() - _weather_cache['timestamp']
    if time_since_cache > timedelta(minutes=CACHE_EXPIRY_MINUTES):
        return False

    return True


def _update_cache(lat: float, lon: float, temperature: float):
    """
    Update the weather cache with new data.

    Args:
        lat: Latitude
        lon: Longitude
        temperature: Temperature in Fahrenheit
    """
    _weather_cache['temperature'] = temperature
    _weather_cache['location'] = (lat, lon)
    _weather_cache['timestamp'] = datetime.now()


def get_current_temperature(lat: Optional[float] = None,
                           lon: Optional[float] = None,
                           api_key: Optional[str] = None) -> Tuple[float, bool]:
    """
    Get current air temperature from WeatherAPI.com.

    Uses caching to avoid excessive API calls (rate limit: 1M/month = ~23/min).
    Falls back to mock data if API fails or credentials missing.

    Args:
        lat: Latitude (optional, defaults to NYC)
        lon: Longitude (optional, defaults to NYC)
        api_key: WeatherAPI.com API key (optional, loads from env if not provided)

    Returns:
        Tuple of (temperature in Fahrenheit, using_mock_data boolean)
    """
    # Use default location if not provided
    if lat is None:
        lat = DEFAULT_LAT
    if lon is None:
        lon = DEFAULT_LON

    # Load API key from environment if not provided
    if api_key is None:
        api_key = os.getenv('WEATHER_API_KEY')

    # If no API key, return mock data
    if not api_key:
        return 65.0, True

    # Check cache first
    if _is_cache_valid(lat, lon):
        return _weather_cache['temperature'], False

    # Make API request
    try:
        params = {
            'key': api_key,
            'q': f"{lat},{lon}",
            'aqi': 'no'
        }

        response = requests.get(WEATHER_API_URL, params=params, timeout=5)
        response.raise_for_status()

        data = response.json()

        # Extract temperature in Fahrenheit
        temperature = data['current']['temp_f']

        # Update cache
        _update_cache(lat, lon, temperature)

        return temperature, False

    except requests.exceptions.RequestException as e:
        # Network error, timeout, or API error - fall back to mock data
        logger.warning(f"Weather API error: {e}. Using mock data.")
        return 65.0, True
    except (KeyError, ValueError) as e:
        # JSON parsing error - fall back to mock data
        logger.warning(f"Weather API response parsing error: {e}. Using mock data.")
        return 65.0, True


def clear_cache():
    """
    Clear the weather cache.
    Useful for testing or forcing fresh API calls.
    """
    _weather_cache['temperature'] = None
    _weather_cache['location'] = None
    _weather_cache['timestamp'] = None


def get_current_weather(lat: Optional[float] = None,
                        lon: Optional[float] = None,
                        api_key: Optional[str] = None) -> dict:
    """
    Get comprehensive current weather data from Open-Meteo API.

    Args:
        lat: Latitude (optional, defaults to NYC)
        lon: Longitude (optional, defaults to NYC)
        api_key: Not used (kept for backwards compatibility)

    Returns:
        Dictionary with weather data including temp, conditions, humidity, wind
    """
    # Use default location if not provided
    if lat is None:
        lat = DEFAULT_LAT
    if lon is None:
        lon = DEFAULT_LON

    # Make API request to Open-Meteo
    try:
        params = {
            'latitude': lat,
            'longitude': lon,
            'current': ['temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
                       'weather_code', 'wind_speed_10m', 'wind_direction_10m'],
            'temperature_unit': 'fahrenheit',
            'wind_speed_unit': 'mph',
            'timezone': 'auto'
        }

        responses = openmeteo.weather_api(OPEN_METEO_URL, params=params)
        response = responses[0]

        # Get current weather data
        current = response.Current()
        temperature = current.Variables(0).Value()
        humidity = current.Variables(1).Value()
        feels_like = current.Variables(2).Value()
        weather_code = current.Variables(3).Value()
        wind_speed = current.Variables(4).Value()
        wind_direction = current.Variables(5).Value()

        # Map WMO weather codes to conditions and icons
        conditions, icon = _map_weather_code(int(weather_code))

        # Map wind direction from degrees to cardinal direction
        wind_dir = _degrees_to_direction(wind_direction)

        return {
            'temperature': round(temperature, 1),
            'feelsLike': round(feels_like, 1),
            'humidity': int(humidity),
            'windSpeed': round(wind_speed, 1),
            'windDirection': wind_dir,
            'conditions': conditions,
            'icon': icon,
            'uv': 0,  # Open-Meteo doesn't provide UV in current weather
            'isDay': True,  # Could be determined from sunrise/sunset
            'isMock': False
        }

    except Exception as e:
        logger.warning(f"Open-Meteo API error: {e}. Using mock data.")
        return {
            'temperature': 65.0,
            'feelsLike': 63.0,
            'humidity': 55,
            'windSpeed': 8.0,
            'windDirection': 'NW',
            'conditions': 'Partly Cloudy',
            'icon': '🌤️',
            'uv': 3,
            'isDay': True,
            'isMock': True
        }


def _map_weather_code(code: int) -> tuple:
    """
    Map WMO weather codes to human-readable conditions and emoji icons.
    https://open-meteo.com/en/docs
    """
    weather_map = {
        0: ("Clear sky", "☀️"),
        1: ("Mainly clear", "🌤️"),
        2: ("Partly cloudy", "⛅"),
        3: ("Overcast", "☁️"),
        45: ("Foggy", "🌫️"),
        48: ("Depositing rime fog", "🌫️"),
        51: ("Light drizzle", "🌦️"),
        53: ("Moderate drizzle", "🌦️"),
        55: ("Dense drizzle", "🌧️"),
        61: ("Slight rain", "🌧️"),
        63: ("Moderate rain", "🌧️"),
        65: ("Heavy rain", "🌧️"),
        71: ("Slight snow", "🌨️"),
        73: ("Moderate snow", "🌨️"),
        75: ("Heavy snow", "❄️"),
        77: ("Snow grains", "❄️"),
        80: ("Slight rain showers", "🌦️"),
        81: ("Moderate rain showers", "🌧️"),
        85: ("Slight snow showers", "🌨️"),
        86: ("Heavy snow showers", "❄️"),
        95: ("Thunderstorm", "⛈️"),
        96: ("Thunderstorm with slight hail", "⛈️"),
        99: ("Thunderstorm with heavy hail", "⛈️"),
    }
    return weather_map.get(code, ("Unknown", "🌤️"))


def _degrees_to_direction(degrees: float) -> str:
    """Convert wind direction in degrees to cardinal direction."""
    directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
    index = int((degrees + 11.25) / 22.5) % 16
    return directions[index]


def _is_forecast_cache_valid(lat: float, lon: float, days: int) -> bool:
    """Check if forecast cache is valid."""
    if not all([_forecast_cache['data'],
                _forecast_cache['location'],
                _forecast_cache['timestamp'],
                _forecast_cache['days']]):
        return False

    cached_lat, cached_lon = _forecast_cache['location']
    if abs(cached_lat - lat) > 0.01 or abs(cached_lon - lon) > 0.01:
        return False

    # Check if cached days is sufficient for requested days
    if _forecast_cache['days'] < days:
        return False

    time_since_cache = datetime.now() - _forecast_cache['timestamp']
    if time_since_cache > timedelta(minutes=CACHE_EXPIRY_MINUTES):
        return False

    return True


def _update_forecast_cache(lat: float, lon: float, data: dict, days: int):
    """Update forecast cache."""
    _forecast_cache['data'] = data
    _forecast_cache['location'] = (lat, lon)
    _forecast_cache['timestamp'] = datetime.now()
    _forecast_cache['days'] = days


def _calculate_gdd(high: float, low: float, base: float = 50) -> int:
    """Calculate Growing Degree Days."""
    avg_temp = (high + low) / 2
    return max(0, int(avg_temp - base))


def _generate_mock_forecast(days: int = 7) -> dict:
    """Generate mock forecast data."""
    forecast = []
    base_temp = 65.0

    for i in range(days):
        high = base_temp + random.uniform(5, 15)
        low = base_temp - random.uniform(10, 20)
        forecast.append({
            'date': (get_today() + timedelta(days=i)).isoformat(),
            'highTemp': round(high, 1),
            'lowTemp': round(low, 1),
            'precipitation': round(random.uniform(0, 0.5), 2),
            'humidity': random.randint(40, 80),
            'windSpeed': round(random.uniform(5, 15), 1),
            'conditions': random.choice(['Sunny', 'Partly Cloudy', 'Cloudy', 'Rain']),
            'growingDegreeDays': _calculate_gdd(high, low)
        })

    return {
        'forecast': forecast,
        'isMock': True
    }


def get_forecast(lat: Optional[float] = None,
                 lon: Optional[float] = None,
                 days: int = 7,
                 api_key: Optional[str] = None) -> dict:
    """
    Get multi-day weather forecast from Open-Meteo API.

    Args:
        lat: Latitude (optional, defaults to NYC)
        lon: Longitude (optional, defaults to NYC)
        days: Number of forecast days (1-16, default 7)
        api_key: Not used (kept for backwards compatibility)

    Returns:
        Dictionary with forecast array and isMock flag
    """
    # Use defaults if not provided
    if lat is None:
        lat = DEFAULT_LAT
    if lon is None:
        lon = DEFAULT_LON

    # Clamp days to valid range for Open-Meteo (1-16)
    days = max(1, min(16, days))

    # Check forecast cache
    if _is_forecast_cache_valid(lat, lon, days):
        # Return cached data, trimmed to requested days
        cached_data = _forecast_cache['data']
        return {
            'forecast': cached_data['forecast'][:days],
            'isMock': cached_data['isMock']
        }

    # Make API request to Open-Meteo forecast endpoint
    try:
        params = {
            'latitude': lat,
            'longitude': lon,
            'daily': ['weather_code', 'temperature_2m_max', 'temperature_2m_min',
                     'precipitation_sum', 'wind_speed_10m_max', 'relative_humidity_2m_mean'],
            'temperature_unit': 'fahrenheit',
            'wind_speed_unit': 'mph',
            'precipitation_unit': 'inch',
            'timezone': 'auto',
            'forecast_days': days
        }

        responses = openmeteo.weather_api(OPEN_METEO_URL, params=params)
        response = responses[0]

        # Get daily forecast data
        daily = response.Daily()
        forecast_days = []

        # Extract arrays
        weather_codes = daily.Variables(0).ValuesAsNumpy()
        temp_max = daily.Variables(1).ValuesAsNumpy()
        temp_min = daily.Variables(2).ValuesAsNumpy()
        precipitation = daily.Variables(3).ValuesAsNumpy()
        wind_speed = daily.Variables(4).ValuesAsNumpy()
        humidity = daily.Variables(5).ValuesAsNumpy()

        # Get dates
        daily_time = daily.Time()
        daily_time_end = daily.TimeEnd()
        dates = []
        current_time = daily_time
        while current_time < daily_time_end:
            # Use utcfromtimestamp to avoid timezone issues, then get date
            # Open-Meteo returns timestamps at midnight in the requested timezone
            dates.append(datetime.utcfromtimestamp(current_time).date().isoformat())
            current_time += 86400  # Add one day in seconds

        # Build forecast array
        for i in range(len(dates)):
            conditions, _ = _map_weather_code(int(weather_codes[i]))
            high_temp = float(temp_max[i])
            low_temp = float(temp_min[i])

            forecast_days.append({
                'date': dates[i],
                'highTemp': round(high_temp, 1),
                'lowTemp': round(low_temp, 1),
                'precipitation': round(float(precipitation[i]), 2),
                'humidity': int(humidity[i]),
                'windSpeed': round(float(wind_speed[i]), 1),
                'conditions': conditions,
                'growingDegreeDays': _calculate_gdd(high_temp, low_temp)
            })

        result = {
            'forecast': forecast_days,
            'isMock': False
        }

        # Update cache
        _update_forecast_cache(lat, lon, result, days)

        return result

    except Exception as e:
        logger.warning(f"Open-Meteo forecast API error: {e}. Using mock data.")
        return _generate_mock_forecast(days)
