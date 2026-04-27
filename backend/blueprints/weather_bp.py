"""
Weather API Blueprint

Routes:
- GET /api/weather/current - Get current weather data
- GET /api/weather/forecast - Get multi-day weather forecast
"""
from flask import Blueprint, request, jsonify
from flask_login import login_required
from services.geocoding_service import (
    geocoding_service,
    ZIP_STATUS_OK,
    ZIP_STATUS_PROVIDER_ERROR,
    ZIP_STATUS_INVALID_INPUT,
)
from simulation_weather import get_weather_for_simulation, get_forecast_for_simulation

weather_bp = Blueprint('weather', __name__, url_prefix='/api/weather')


def _get_coordinates_from_request():
    """
    Helper to extract coordinates from request parameters.

    Returns:
        tuple: (lat, lon, zone, zipcode, error_response)
        If error_response is not None, return it immediately.
    """
    zipcode = request.args.get('zipcode')
    lat = request.args.get('lat', type=float)
    lon = request.args.get('lon', type=float)

    # If zipcode provided, geocode it first.
    # Uses validate_zipcode so we can tell apart "bad ZIP" (404) from
    # "geocoding provider unavailable / quota exhausted" (503), instead of
    # collapsing both into a generic 400.
    if zipcode and not (lat and lon):
        try:
            geo_result, status = geocoding_service.validate_zipcode(zipcode)
            if status == ZIP_STATUS_OK and geo_result:
                lat = geo_result['latitude']
                lon = geo_result['longitude']
                # Pass formatted address for ZIP extraction
                zone = geocoding_service.get_hardiness_zone(lat, lon, geo_result.get('formatted_address'))
            elif status == ZIP_STATUS_INVALID_INPUT:
                # Malformed ZIP (e.g. 'abc', '53703-1234'). This is a client
                # input error, not a provider outage — return 400, not 503.
                return None, None, None, zipcode, (jsonify({
                    'error': 'ZIP code must be 5 digits.',
                    'errorCode': 'invalid_zipcode_format',
                }), 400)
            elif status == ZIP_STATUS_PROVIDER_ERROR:
                return None, None, None, zipcode, (jsonify({
                    'error': 'Geocoding provider unavailable. Please try again shortly.',
                    'errorCode': 'geocoding_provider_unavailable',
                }), 503)
            else:
                return None, None, None, zipcode, (jsonify({
                    'error': 'Could not geocode zipcode',
                    'errorCode': 'zipcode_not_found',
                }), 400)
        except Exception as e:
            return None, None, None, zipcode, (jsonify({
                'error': f'Geocoding error: {str(e)}',
                'errorCode': 'geocoding_internal_error',
            }), 500)
    elif lat and lon:
        # Pass zipcode if available for ZIP extraction (otherwise fallback to regional)
        zone = geocoding_service.get_hardiness_zone(lat, lon, zipcode)
    else:
        # No location provided - return error
        return None, None, None, None, (jsonify({'error': 'Either zipcode or lat/lon coordinates required'}), 400)

    return lat, lon, zone, zipcode, None


@weather_bp.route('/current', methods=['GET'])
@login_required
def weather_current():
    """Get current weather data by zipcode or coordinates"""
    lat, lon, zone, zipcode, error = _get_coordinates_from_request()
    if error:
        return error

    # Get weather data
    weather = get_weather_for_simulation(lat, lon)

    return jsonify({
        'weather': weather,
        'location': {
            'latitude': lat,
            'longitude': lon,
            'zone': zone,
            'zipcode': zipcode
        }
    })


@weather_bp.route('/forecast', methods=['GET'])
@login_required
def weather_forecast():
    """Get multi-day weather forecast by zipcode or coordinates"""
    lat, lon, zone, zipcode, error = _get_coordinates_from_request()
    if error:
        return error

    days = request.args.get('days', default=7, type=int)
    # Clamp days to valid range (1-10)
    days = max(1, min(10, days))

    # Get forecast data
    forecast_data = get_forecast_for_simulation(lat, lon, days)

    return jsonify({
        'forecast': forecast_data['forecast'],
        'isMock': forecast_data['isMock'],
        'location': {
            'latitude': lat,
            'longitude': lon,
            'zone': zone,
            'zipcode': zipcode
        }
    })
