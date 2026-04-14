"""
Simulation-aware weather routing.

When simulation is active and the date is in the past,
routes weather requests to Open-Meteo Archive API for historical data.
When simulation is off, delegates to existing weather_service functions.
"""
import logging
import requests
from datetime import timedelta

from simulation_clock import is_simulating, get_today
from weather_service import get_current_weather, get_forecast, _map_weather_code, _calculate_gdd

logger = logging.getLogger(__name__)

ARCHIVE_API_URL = "https://archive-api.open-meteo.com/v1/archive"


def get_weather_for_simulation(lat, lon):
    """Get current weather — routes to archive if simulating a past date."""
    if not is_simulating():
        return get_current_weather(lat, lon)

    sim_date = get_today()

    try:
        params = {
            'latitude': lat,
            'longitude': lon,
            'start_date': sim_date.isoformat(),
            'end_date': sim_date.isoformat(),
            'daily': ['weather_code', 'temperature_2m_max', 'temperature_2m_min',
                      'precipitation_sum', 'wind_speed_10m_max'],
            'temperature_unit': 'fahrenheit',
            'wind_speed_unit': 'mph',
            'precipitation_unit': 'inch',
            'timezone': 'auto'
        }
        response = requests.get(ARCHIVE_API_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        daily = data.get('daily', {})

        if not daily.get('time'):
            logger.warning("Archive API returned no data for %s", sim_date)
            return get_current_weather(lat, lon)

        high = daily['temperature_2m_max'][0]
        low = daily['temperature_2m_min'][0]
        weather_code = daily.get('weather_code', [0])[0]
        conditions, icon = _map_weather_code(int(weather_code) if weather_code is not None else 0)

        return {
            'temperature': round((high + low) / 2, 1),
            'feelsLike': round((high + low) / 2, 1),
            'humidity': 50,  # Archive daily doesn't always include humidity
            'windSpeed': round(daily.get('wind_speed_10m_max', [0])[0] or 0, 1),
            'windDirection': 'N',  # Archive doesn't provide direction
            'conditions': conditions,
            'icon': icon,
            'uv': 0,
            'isDay': True,
            'isMock': False,
            'isHistorical': True,
            'simulatedDate': sim_date.isoformat(),
            'precipitation': round(daily.get('precipitation_sum', [0])[0] or 0, 2)
        }
    except Exception as e:
        logger.warning("Archive weather fetch failed for %s: %s", sim_date, e)
        return get_current_weather(lat, lon)


def get_forecast_for_simulation(lat, lon, days=7):
    """Get forecast — routes to archive for simulated date range."""
    if not is_simulating():
        return get_forecast(lat, lon, days)

    sim_date = get_today()
    end_date = sim_date + timedelta(days=days - 1)

    try:
        params = {
            'latitude': lat,
            'longitude': lon,
            'start_date': sim_date.isoformat(),
            'end_date': end_date.isoformat(),
            'daily': ['weather_code', 'temperature_2m_max', 'temperature_2m_min',
                      'precipitation_sum', 'wind_speed_10m_max'],
            'temperature_unit': 'fahrenheit',
            'wind_speed_unit': 'mph',
            'precipitation_unit': 'inch',
            'timezone': 'auto'
        }
        response = requests.get(ARCHIVE_API_URL, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
        daily = data.get('daily', {})

        if not daily.get('time'):
            logger.warning("Archive forecast returned no data for %s to %s", sim_date, end_date)
            return get_forecast(lat, lon, days)

        forecast = []
        for i in range(len(daily['time'])):
            high = daily['temperature_2m_max'][i] or 50
            low = daily['temperature_2m_min'][i] or 30
            weather_code = daily.get('weather_code', [0] * len(daily['time']))[i]
            conditions, _ = _map_weather_code(int(weather_code) if weather_code is not None else 0)

            forecast.append({
                'date': daily['time'][i],
                'highTemp': round(high, 1),
                'lowTemp': round(low, 1),
                'precipitation': round((daily.get('precipitation_sum', [0] * len(daily['time']))[i]) or 0, 2),
                'humidity': 50,
                'windSpeed': round((daily.get('wind_speed_10m_max', [0] * len(daily['time']))[i]) or 0, 1),
                'conditions': conditions,
                'growingDegreeDays': _calculate_gdd(high, low)
            })

        return {
            'forecast': forecast,
            'isMock': False,
            'isHistorical': True,
            'simulatedDate': sim_date.isoformat()
        }
    except Exception as e:
        logger.warning("Archive forecast fetch failed for %s: %s", sim_date, e)
        return get_forecast(lat, lon, days)
