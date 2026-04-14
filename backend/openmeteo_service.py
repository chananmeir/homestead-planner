"""
Open-Meteo API Service for Soil Temperature Data

This module fetches actual measured soil temperature data from the Open-Meteo API.
Open-Meteo provides modeled soil temperature at multiple depths based on meteorological
data and land surface models.

API: https://api.open-meteo.com/v1/forecast
Documentation: https://open-meteo.com/en/docs

Free Tier Limits:
- 10,000 calls/day
- No API key required
- Non-commercial use only
"""

import openmeteo_requests
import requests_cache
from retry_requests import retry
from datetime import datetime, timedelta
from simulation_clock import get_now
import logging
import math
import os
import tempfile
import numpy as np

# Setup logging
logger = logging.getLogger(__name__)


# Setup the Open-Meteo API client with caching and retries
cache_dir = os.path.join(tempfile.gettempdir(), 'openmeteo_cache')
cache_session = requests_cache.CachedSession(cache_dir, expire_after=900)  # 15 minutes
retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
openmeteo = openmeteo_requests.Client(session=retry_session)


def get_soil_temperature_openmeteo(latitude, longitude, depth_cm=6):
    """
    Get actual measured soil temperature from Open-Meteo API.

    This function fetches real soil temperature measurements at the specified depth
    from Open-Meteo's land surface model. The data is cached for 15 minutes to
    reduce API calls and stay within rate limits.

    Args:
        latitude (float): Latitude of the location (-90 to 90)
        longitude (float): Longitude of the location (-180 to 180)
        depth_cm (int): Soil depth in centimeters. Options: 0, 6, 18, 54
                       Default is 6cm (≈2.4 inches, ideal for seed planting)

    Returns:
        tuple: (temperature_fahrenheit, using_mock_data)
            - temperature_fahrenheit (float): Soil temperature in °F
            - using_mock_data (bool): False if real data, True if fallback

    Raises:
        Exception: If API call fails, returns mock data (50°F) instead of raising

    Example:
        >>> temp, is_mock = get_soil_temperature_openmeteo(40.7128, -74.0060)
        >>> print(f"Soil temp: {temp}°F (mock: {is_mock})")
        Soil temp: 52.3°F (mock: False)
    """

    # Validate depth parameter
    valid_depths = [0, 6, 18, 54]
    if depth_cm not in valid_depths:
        logger.warning(f"Invalid depth {depth_cm}cm, using 6cm. Valid: {valid_depths}")
        depth_cm = 6

    # Setup API request
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": f"soil_temperature_{depth_cm}cm",
        "temperature_unit": "fahrenheit",
        "forecast_days": 1,  # Only need current conditions
        "timezone": "auto"  # Use location's timezone
    }

    try:
        # Make API request
        responses = openmeteo.weather_api(url, params=params)

        # Get first (and only) location response
        response = responses[0]

        # Extract hourly soil temperature data
        hourly = response.Hourly()
        soil_temperatures = hourly.Variables(0).ValuesAsNumpy()

        # Get the most recent hour's temperature
        # Index 0 is the current hour
        current_soil_temp = float(soil_temperatures[0])

        logger.info(f"Open-Meteo: Got soil temp {current_soil_temp}°F at {depth_cm}cm depth for ({latitude}, {longitude})")

        return current_soil_temp, False  # False = not using mock data

    except Exception as e:
        # Log error and return mock data as fallback
        logger.error(f"Open-Meteo API error: {e}")
        logger.warning("Falling back to mock soil temperature (50°F)")
        return 50.0, True  # True = using mock data


def get_soil_temperature_forecast(latitude, longitude, forecast_days=16, depth_cm=6):
    """
    Get multi-day soil temperature forecast from Open-Meteo.

    Fetches hourly soil temperature data and aggregates to daily min/mean/max.

    Args:
        latitude (float): Latitude of the location
        longitude (float): Longitude of the location
        forecast_days (int): Number of forecast days (1-16, default 16)
        depth_cm (int): Soil depth in centimeters (default 6)

    Returns:
        tuple: (daily_temps, using_mock_data)
            - daily_temps (list[dict]): One entry per day with keys:
                date (str), min_temp (float), max_temp (float), mean_temp (float)
            - using_mock_data (bool): True if fallback to mock data
    """
    valid_depths = [0, 6, 18, 54]
    if depth_cm not in valid_depths:
        depth_cm = 6
    forecast_days = max(1, min(forecast_days, 16))

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": f"soil_temperature_{depth_cm}cm",
        "temperature_unit": "fahrenheit",
        "forecast_days": forecast_days,
        "timezone": "auto"
    }

    try:
        responses = openmeteo.weather_api(url, params=params)
        response = responses[0]

        hourly = response.Hourly()
        temps = hourly.Variables(0).ValuesAsNumpy()

        # Get the start time and interval
        start_time = datetime.utcfromtimestamp(hourly.Time())
        interval = hourly.Interval()  # seconds between data points

        # Group hourly temps into days (24 hours each)
        daily_temps = []
        for day_idx in range(forecast_days):
            start_hr = day_idx * 24
            end_hr = min(start_hr + 24, len(temps))
            if start_hr >= len(temps):
                break

            day_temps = temps[start_hr:end_hr]
            # Filter out NaN values (future hours may not have data yet)
            valid_temps = day_temps[~np.isnan(day_temps)]
            if len(valid_temps) == 0:
                continue  # Skip days with no valid data

            day_date = (start_time + timedelta(days=day_idx)).strftime('%Y-%m-%d')

            daily_temps.append({
                'date': day_date,
                'min_temp': round(float(valid_temps.min()), 1),
                'max_temp': round(float(valid_temps.max()), 1),
                'mean_temp': round(float(valid_temps.mean()), 1),
            })

        logger.info(f"Open-Meteo: Got {len(daily_temps)}-day soil temp forecast for ({latitude}, {longitude})")
        return daily_temps, False

    except Exception as e:
        logger.error(f"Open-Meteo forecast API error: {e}")
        # Return mock data
        today = get_now()
        mock_temps = []
        for i in range(forecast_days):
            mock_temps.append({
                'date': (today + timedelta(days=i)).strftime('%Y-%m-%d'),
                'min_temp': 50.0,
                'max_temp': 50.0,
                'mean_temp': 50.0,
            })
        return mock_temps, True


def get_soil_temperature_with_meta(latitude, longitude, depth_cm=6):
    """
    Get soil temperature with additional metadata about the measurement.

    This is a wrapper around get_soil_temperature_openmeteo() that returns
    more detailed information about the data source and measurement.

    Args:
        latitude (float): Latitude of the location
        longitude (float): Longitude of the location
        depth_cm (int): Soil depth in centimeters (default: 6)

    Returns:
        dict: Dictionary containing:
            - temperature: Soil temperature in °F
            - depth_cm: Measurement depth
            - source: Data source name
            - using_mock: Boolean indicating if fallback data was used
            - timestamp: ISO format timestamp of measurement
    """

    temp, using_mock = get_soil_temperature_openmeteo(latitude, longitude, depth_cm)

    return {
        'temperature': temp,
        'depth_cm': depth_cm,
        'source': 'Mock Data' if using_mock else 'Open-Meteo',
        'using_mock': using_mock,
        'timestamp': datetime.now().isoformat(),
        'location': {
            'latitude': latitude,
            'longitude': longitude
        }
    }


# Depths used for multi-depth queries (covers surface-sown to deep-planted crops)
MULTI_DEPTH_CMS = [0, 6, 18]


def inches_to_openmeteo_depth(planting_depth_inches):
    """
    Map a plant's planting depth (inches) to the nearest Open-Meteo depth (cm).

    Mapping:
        0–0.5"  → 0cm  (surface-sown: lettuce, basil, dill)
        0.5–3"  → 6cm  (most seeds: tomato, pepper, beans)
        3"+     → 18cm (deep: potato, garlic)

    Args:
        planting_depth_inches (float or None): Planting depth in inches

    Returns:
        int: Open-Meteo depth in cm (0, 6, or 18)
    """
    if planting_depth_inches is None:
        return 6  # Default to seed depth
    if planting_depth_inches <= 0.5:
        return 0
    if planting_depth_inches <= 3.0:
        return 6
    return 18


def get_soil_temperatures_multi_depth(latitude, longitude):
    """
    Get current soil temperature at 0cm, 6cm, and 18cm in a single API call.

    Returns:
        tuple: (temps_by_depth, using_mock_data)
            - temps_by_depth (dict): {0: float, 6: float, 18: float} in °F
            - using_mock_data (bool)
    """
    depth_fields = ",".join(f"soil_temperature_{d}cm" for d in MULTI_DEPTH_CMS)

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": depth_fields,
        "temperature_unit": "fahrenheit",
        "forecast_days": 1,
        "timezone": "auto"
    }

    try:
        responses = openmeteo.weather_api(url, params=params)
        response = responses[0]
        hourly = response.Hourly()

        temps_by_depth = {}
        for i, depth in enumerate(MULTI_DEPTH_CMS):
            temps = hourly.Variables(i).ValuesAsNumpy()
            temps_by_depth[depth] = float(temps[0])

        logger.info(f"Open-Meteo: Multi-depth temps for ({latitude}, {longitude}): {temps_by_depth}")
        return temps_by_depth, False

    except Exception as e:
        logger.error(f"Open-Meteo multi-depth API error: {e}")
        mock = {d: 50.0 for d in MULTI_DEPTH_CMS}
        return mock, True


def get_soil_temperature_forecast_multi_depth(latitude, longitude, forecast_days=16):
    """
    Get multi-day soil temperature forecast at 0cm, 6cm, and 18cm in a single API call.

    Returns:
        tuple: (forecast_by_depth, using_mock_data)
            - forecast_by_depth (dict): {0: [daily_temps], 6: [daily_temps], 18: [daily_temps]}
              where each daily_temps entry is {date, min_temp, max_temp, mean_temp}
            - using_mock_data (bool)
    """
    forecast_days = max(1, min(forecast_days, 16))
    depth_fields = ",".join(f"soil_temperature_{d}cm" for d in MULTI_DEPTH_CMS)

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": depth_fields,
        "temperature_unit": "fahrenheit",
        "forecast_days": forecast_days,
        "timezone": "auto"
    }

    try:
        responses = openmeteo.weather_api(url, params=params)
        response = responses[0]
        hourly = response.Hourly()
        start_time = datetime.utcfromtimestamp(hourly.Time())

        forecast_by_depth = {}
        for var_idx, depth in enumerate(MULTI_DEPTH_CMS):
            temps = hourly.Variables(var_idx).ValuesAsNumpy()
            daily_temps = []
            for day_idx in range(forecast_days):
                start_hr = day_idx * 24
                end_hr = min(start_hr + 24, len(temps))
                if start_hr >= len(temps):
                    break
                day_temps = temps[start_hr:end_hr]
                valid_temps = day_temps[~np.isnan(day_temps)]
                if len(valid_temps) == 0:
                    continue
                day_date = (start_time + timedelta(days=day_idx)).strftime('%Y-%m-%d')
                daily_temps.append({
                    'date': day_date,
                    'min_temp': round(float(valid_temps.min()), 1),
                    'max_temp': round(float(valid_temps.max()), 1),
                    'mean_temp': round(float(valid_temps.mean()), 1),
                })
            forecast_by_depth[depth] = daily_temps

        logger.info(f"Open-Meteo: Multi-depth {forecast_days}-day forecast for ({latitude}, {longitude})")
        return forecast_by_depth, False

    except Exception as e:
        logger.error(f"Open-Meteo multi-depth forecast error: {e}")
        today = get_now()
        mock_daily = [
            {'date': (today + timedelta(days=i)).strftime('%Y-%m-%d'),
             'min_temp': 50.0, 'max_temp': 50.0, 'mean_temp': 50.0}
            for i in range(forecast_days)
        ]
        return {d: list(mock_daily) for d in MULTI_DEPTH_CMS}, True


# Test function for development
if __name__ == "__main__":
    print("Testing Open-Meteo Soil Temperature API")
    print("=" * 60)

    # Test locations
    test_locations = [
        {"name": "New York City", "lat": 40.7128, "lon": -74.0060},
        {"name": "Los Angeles", "lat": 34.0522, "lon": -118.2437},
        {"name": "Chicago", "lat": 41.8781, "lon": -87.6298},
    ]

    for location in test_locations:
        print(f"\nTesting: {location['name']}")
        print(f"Coordinates: ({location['lat']}, {location['lon']})")

        # Test at 6cm depth (seed planting depth)
        result = get_soil_temperature_with_meta(location['lat'], location['lon'], depth_cm=6)

        print(f"Soil Temperature: {result['temperature']} degrees F")
        print(f"Depth: {result['depth_cm']}cm (approx {result['depth_cm'] * 0.39:.1f} inches)")
        print(f"Source: {result['source']}")
        print(f"Using Mock: {result['using_mock']}")
        print(f"Timestamp: {result['timestamp']}")

    print("\n" + "=" * 60)
    print("Test complete!")
