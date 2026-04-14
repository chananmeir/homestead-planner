"""
Maple Tapping Season Calculator

Determines optimal tapping dates based on weather patterns.
Ideal conditions: Freezing nights (below 32°F) and thawing days (above 32°F)
"""

from datetime import datetime, timedelta
from simulation_clock import get_now, get_today
import requests

def calculate_tapping_season(latitude, longitude, year=None):
    """
    Calculate estimated tapping season start/end dates based on weather forecast.

    Ideal tapping conditions:
    - Nighttime lows below 32°F (0°C)
    - Daytime highs above 32°F (0°C)
    - This freeze-thaw cycle creates pressure that drives sap flow

    Args:
        latitude: Property latitude
        longitude: Property longitude
        year: Year to calculate for (defaults to current year)

    Returns:
        dict: {
            'in_season': bool - Whether conditions are currently ideal,
            'season_start': Date when conditions become favorable (estimate),
            'season_end': Date when conditions end (estimate),
            'forecast_days': List of dates with ideal conditions in forecast,
            'confidence': 'high|medium|low' based on forecast availability,
            'message': Human-readable recommendation
        }
    """
    if year is None:
        year = get_now().year

    today = get_today()

    # Typical tapping season: Late February - Early April (varies by latitude)
    # Use rule of thumb based on latitude
    if latitude >= 45:  # Northern regions (VT, NH, ME, Northern NY)
        est_start = datetime(year, 2, 20).date()
        est_end = datetime(year, 4, 15).date()
    elif latitude >= 42:  # Mid-latitude (MA, CT, Southern NY, MI)
        est_start = datetime(year, 2, 10).date()
        est_end = datetime(year, 4, 10).date()
    elif latitude >= 40:  # Southern range (PA, OH, IN)
        est_start = datetime(year, 2, 1).date()
        est_end = datetime(year, 4, 1).date()
    else:  # Very southern
        est_start = datetime(year, 1, 20).date()
        est_end = datetime(year, 3, 25).date()

    # Check if we're in the general season window
    in_season_window = est_start <= today <= est_end

    # Try to get actual forecast data
    forecast_days = []
    in_season = False
    confidence = 'low'
    message = ''

    try:
        # Use Open-Meteo API for 7-day forecast
        # Free, no API key required, reliable
        url = 'https://api.open-meteo.com/v1/forecast'
        params = {
            'latitude': latitude,
            'longitude': longitude,
            'daily': 'temperature_2m_max,temperature_2m_min',
            'temperature_unit': 'fahrenheit',
            'timezone': 'auto',
            'forecast_days': 7
        }

        response = requests.get(url, params=params, timeout=5)
        response.raise_for_status()
        data = response.json()

        # Check each day for freeze-thaw conditions
        for i, date_str in enumerate(data['daily']['time']):
            day_max = data['daily']['temperature_2m_max'][i]
            day_min = data['daily']['temperature_2m_min'][i]

            # Ideal: freezing nights (below 32°F) and thawing days (above 32°F)
            if day_min < 32 and day_max > 32:
                forecast_days.append({
                    'date': date_str,
                    'max_temp': round(day_max, 1),
                    'min_temp': round(day_min, 1),
                    'ideal': True
                })

        # Determine if we're currently in ideal conditions
        if forecast_days:
            # Check if today or tomorrow has ideal conditions
            today_str = today.isoformat()
            tomorrow_str = (today + timedelta(days=1)).isoformat()

            for day in forecast_days:
                if day['date'] in [today_str, tomorrow_str]:
                    in_season = True
                    break

        confidence = 'high'

        # Build message
        if not in_season_window:
            if today < est_start:
                days_until = (est_start - today).days
                message = f"Tapping season typically starts around {est_start.strftime('%B %d')} ({days_until} days). Watch for freeze-thaw cycles!"
            else:
                message = "Tapping season has ended for this year. Maple sap flow stops when temperatures stay consistently above freezing."
        elif in_season and forecast_days:
            message = f"🍁 Ideal tapping conditions now! {len(forecast_days)} day(s) of freeze-thaw cycles detected in forecast."
        elif forecast_days:
            next_ideal = forecast_days[0]['date']
            message = f"Freeze-thaw conditions expected starting {next_ideal}. Good time to prepare taps!"
        else:
            message = f"We're in tapping season ({est_start.strftime('%b %d')} - {est_end.strftime('%b %d')}), but no freeze-thaw cycles in the forecast. Wait for temperatures to fluctuate around freezing."

    except Exception as e:
        # Fallback to rough estimates if API fails
        confidence = 'low'
        if not in_season_window:
            if today < est_start:
                days_until = (est_start - today).days
                message = f"Tapping season typically starts around {est_start.strftime('%B %d')} ({days_until} days from now)."
            else:
                message = "Tapping season has ended for this year."
        else:
            message = f"We're in the typical tapping season ({est_start.strftime('%b %d')} - {est_end.strftime('%b %d')}). Watch for freeze-thaw cycles (nights below 32°F, days above 32°F)."

    return {
        'in_season': in_season,
        'in_season_window': in_season_window,
        'season_start': est_start.isoformat(),
        'season_end': est_end.isoformat(),
        'forecast_days': forecast_days,
        'confidence': confidence,
        'message': message,
        'notes': 'Best sap flow occurs during freeze-thaw cycles. Sugar maples produce the sweetest sap (2-2.5% sugar).'
    }
