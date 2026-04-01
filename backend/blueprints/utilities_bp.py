"""
Utilities Blueprint

Routes for calculations, exports, and utility functions.

Routes:
- POST /api/spacing-calculator - Calculate plant spacing and quantity
- GET /api/export-garden-plan/<int:bed_id> - Export garden plan as PDF
- GET /api/soil-temperature - Get soil temperature with adjustments
- GET /api/maple-tapping/season-estimate - Get maple tapping season estimate
- GET /api/indoor-seed-starts - Get all indoor seed starts
- POST /api/indoor-seed-starts - Create new indoor seed start
- GET /api/indoor-seed-starts/<int:id> - Get single indoor seed start
- PUT /api/indoor-seed-starts/<int:id> - Update indoor seed start
- DELETE /api/indoor-seed-starts/<int:id> - Delete indoor seed start
- POST /api/indoor-seed-starts/<int:id>/transplant - Create outdoor planting from indoor start
- POST /api/indoor-seed-starts/calculate-quantity - Calculate seed quantity needed
- POST /api/indoor-seed-starts/from-planting-event - Create indoor start from planting event
- POST /api/validate-planting - Validate planting conditions and return warnings/suggestions
- POST /api/validate-plants-batch - Batch validate multiple plants for Plant Palette icons
- POST /api/validate-planting-date - Forward-looking validation using historical data
- GET /api/germination-history - Aggregated germination history per plant
- GET /api/germination-history/<plant_id>/prediction - Germination days prediction for a plant
"""
from flask import Blueprint, request, jsonify, send_file
from flask_login import login_required, current_user
from datetime import datetime, timedelta, date
from models import db, GardenBed, PlantedItem, PlantingEvent, IndoorSeedStart, Property, PlacedStructure, Settings, SeedInventory
from plant_database import get_plant_by_id, PLANT_DATABASE
from garden_methods import (
    get_sfg_quantity,
    get_row_spacing,
    get_intensive_spacing,
    get_migardener_spacing,
    calculate_plants_per_bed
)
from soil_temperature import (
    get_soil_temperature_with_adjustments,
    get_soil_temperature_forecast_with_adjustments,
    get_soil_temperatures_all_depths_with_adjustments,
    get_soil_temperature_forecast_all_depths_with_adjustments,
    calculate_crop_readiness,
    calculate_crop_readiness_forecast
)
from maple_tapping_calculator import calculate_tapping_season
from services.geocoding_service import geocoding_service
from conflict_checker import validate_planting_conflict
from season_validator import validate_planting_for_property
from forward_planting_validator import validate_planting_date, check_future_cold_danger
from utils.helpers import parse_iso_date
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
import io
import math
import json
import logging

logger = logging.getLogger(__name__)

utilities_bp = Blueprint('utilities', __name__, url_prefix='/api')

# Default coordinates (Milwaukee, WI - 53209)
DEFAULT_LATITUDE = 43.1361
DEFAULT_LONGITUDE = -87.9456


def _get_predicted_germination_days(user_id, plant_id, location=None):
    """Return avg actual germination days from user history, or plant DB default."""
    query = IndoorSeedStart.query.filter(
        IndoorSeedStart.user_id == user_id,
        IndoorSeedStart.plant_id == plant_id,
        IndoorSeedStart.actual_germination_date.isnot(None),
        IndoorSeedStart.start_date.isnot(None)
    )
    if location:
        query = query.filter(IndoorSeedStart.location == location)
    records = query.all()
    actual_days = [r.actual_germination_days for r in records if r.actual_germination_days is not None]
    if actual_days:
        return round(sum(actual_days) / len(actual_days))
    plant = get_plant_by_id(plant_id)
    return plant.get('germination_days', 7) if plant else 7


# ==================== HELPER FUNCTIONS ====================


def get_mulch_type_on_date(garden_bed_id, user_id, query_date):
    """
    Get the effective mulch type for a garden bed on a specific date.

    This implements temporal mulch tracking by querying the most recent
    mulch event as of the query date.

    Args:
        garden_bed_id (int): Garden bed ID
        user_id (int): User ID (for permission check)
        query_date (datetime): Date to query mulch state for

    Returns:
        str: Mulch type ('none', 'straw', 'wood-chips', etc.)
    """
    # Find most recent mulch event as of query_date
    recent_event = PlantingEvent.query.filter(
        PlantingEvent.garden_bed_id == garden_bed_id,
        PlantingEvent.event_type == 'mulch',
        PlantingEvent.user_id == user_id,
        PlantingEvent.expected_harvest_date <= query_date
    ).order_by(
        PlantingEvent.expected_harvest_date.desc()
    ).first()

    if recent_event and recent_event.event_details:
        import json
        try:
            details = json.loads(recent_event.event_details)
            return details.get('mulch_type', 'none')
        except (ValueError, KeyError):
            pass

    # Default to no mulch
    return 'none'


def calculate_seed_quantity(desired_plants: int, germination_rate: float) -> int:
    """
    Calculate how many seeds to start accounting for germination failure.
    Adds safety buffer of 15% beyond germination rate.

    Example: Want 10 plants, 80% germination
    - Minimum: 10 / 0.80 = 12.5 → 13 seeds
    - With buffer: 13 * 1.15 = 14.95 → 15 seeds
    """
    if germination_rate <= 0 or germination_rate > 100:
        germination_rate = 85.0  # Default fallback

    # Convert percentage to decimal
    rate = germination_rate / 100.0

    # Calculate minimum needed
    minimum_seeds = math.ceil(desired_plants / rate)

    # Add 15% safety buffer
    with_buffer = minimum_seeds * 1.15

    return math.ceil(with_buffer)


# ==================== SPACING CALCULATOR ====================

@utilities_bp.route('/spacing-calculator', methods=['POST'])
def calculate_spacing():
    """Calculate plant spacing and quantity for a bed"""
    data = request.json
    plant_id = data.get('plantId')
    bed_width = data.get('bedWidth')
    bed_length = data.get('bedLength')
    method = data.get('method', 'square-foot')

    if method == 'square-foot':
        quantity = get_sfg_quantity(plant_id)
        squares = bed_width * bed_length
        total = squares * quantity
        return jsonify({
            'method': 'square-foot',
            'perSquare': quantity,
            'totalSquares': squares,
            'totalPlants': total,
            'gridSize': 12
        })

    elif method == 'row':
        spacing = get_row_spacing(plant_id)
        bed_width_inches = bed_width * 12
        bed_length_inches = bed_length * 12
        num_rows = int(bed_width_inches / spacing['rowSpacing'])
        plants_per_row = int(bed_length_inches / spacing['plantSpacing'])
        total = num_rows * plants_per_row
        return jsonify({
            'method': 'row',
            'rowSpacing': spacing['rowSpacing'],
            'plantSpacing': spacing['plantSpacing'],
            'numRows': num_rows,
            'plantsPerRow': plants_per_row,
            'totalPlants': total
        })

    elif method == 'intensive':
        spacing_inches = get_intensive_spacing(plant_id)
        total = calculate_plants_per_bed(bed_width, bed_length, plant_id, 'intensive')
        return jsonify({
            'method': 'intensive',
            'spacing': spacing_inches,
            'totalPlants': total,
            'pattern': 'hexagonal'
        })

    elif method == 'migardener':
        spacing = get_migardener_spacing(plant_id)
        bed_width_inches = bed_width * 12
        bed_length_inches = bed_length * 12
        num_rows = int(bed_width_inches / spacing['rowSpacing'])
        plants_per_row = int(bed_length_inches / spacing['plantSpacing'])
        total = num_rows * plants_per_row
        plants_per_sqft = total / (bed_width * bed_length)
        return jsonify({
            'method': 'migardener',
            'rowSpacing': spacing['rowSpacing'],
            'plantSpacing': spacing['plantSpacing'],
            'numRows': num_rows,
            'plantsPerRow': plants_per_row,
            'totalPlants': total,
            'plantsPerSqFt': round(plants_per_sqft, 1)
        })

    return jsonify({'error': 'Invalid method'}), 400


# ==================== PDF EXPORT ====================

@utilities_bp.route('/export-garden-plan/<int:bed_id>')
@login_required
def export_garden_plan(bed_id):
    """Export garden plan as PDF"""
    bed = GardenBed.query.get_or_404(bed_id)
    if bed.user_id != current_user.id:
        return jsonify({'error': 'Not found'}), 404

    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    # Title
    p.setFont("Helvetica-Bold", 24)
    p.drawString(1*inch, height - 1*inch, f"Garden Plan: {bed.name}")

    # Bed info
    p.setFont("Helvetica", 12)
    y = height - 1.5*inch
    p.drawString(1*inch, y, f"Size: {bed.width}' x {bed.length}'")
    p.drawString(1*inch, y - 0.3*inch, f"Location: {bed.location}")
    p.drawString(1*inch, y - 0.6*inch, f"Sun Exposure: {bed.sun_exposure}")

    # Plants list
    y -= 1.2*inch
    p.setFont("Helvetica-Bold", 14)
    p.drawString(1*inch, y, "Plants:")

    y -= 0.4*inch
    p.setFont("Helvetica", 10)
    for item in bed.planted_items:
        plant = get_plant_by_id(item.plant_id)
        if plant:
            p.drawString(1.2*inch, y, f"• {plant['name']} - Position: ({item.position_x}, {item.position_y}) - Status: {item.status}")
            y -= 0.3*inch
            if y < 1*inch:  # New page if needed
                p.showPage()
                y = height - 1*inch
                p.setFont("Helvetica", 10)

    # Footer
    p.setFont("Helvetica", 8)
    p.drawString(1*inch, 0.5*inch, f"Generated by Homestead Tracker - {datetime.now().strftime('%Y-%m-%d')}")

    p.save()
    buffer.seek(0)
    return send_file(buffer, as_attachment=True, download_name=f"{bed.name}_plan.pdf", mimetype='application/pdf')


# ==================== SOIL TEMPERATURE ====================

@utilities_bp.route('/soil-temperature', methods=['GET'])
@login_required
def get_soil_temperature():
    """
    Get soil temperature using measured data + local adjustments.

    This endpoint uses a multi-tier approach:
    1. PRIMARY: Open-Meteo measured soil temperature at 6cm depth
    2. FALLBACK: WeatherAPI air temperature estimation
    3. LAST RESORT: Mock data

    Then applies user's local adjustments (soil type, sun exposure, mulch)
    to account for their specific garden bed conditions.

    Query Parameters:
        - garden_bed_id (optional): Garden bed ID to get soil/mulch settings from
        - soil_type (optional): 'sandy', 'loamy', or 'clay' (overrides bed setting)
        - sun_exposure (optional): 'full', 'partial', 'shade' (overrides bed setting)
        - mulch_type (optional): Mulch type (overrides bed setting)
        - has_mulch (deprecated): 'true' or 'false' (for backward compatibility)
        - latitude (optional): Location latitude (defaults to user's property)
        - longitude (optional): Location longitude (defaults to user's property)

    Returns:
        JSON with soil temperature and crop readiness data:
        {
            'final_soil_temp': Final temperature after adjustments (F),
            'base_temp': Initial measured/estimated temperature (F),
            'adjustments': Applied adjustments object,
            'method': 'measured' | 'estimated' | 'mock',
            'source': Data source description,
            'using_mock_data': Boolean,
            'crop_readiness': Crop readiness data
        }
    """
    try:
        # Get garden bed if specified
        garden_bed_id = request.args.get('garden_bed_id')
        garden_bed = None

        if garden_bed_id:
            garden_bed = GardenBed.query.filter_by(id=garden_bed_id, user_id=current_user.id).first()

        # Get query date for temporal mulch lookup (defaults to today)
        query_date_str = request.args.get('date')
        if query_date_str:
            # Parse the date parameter
            query_date = parse_iso_date(query_date_str) if 'T' in query_date_str or 'Z' in query_date_str else datetime.strptime(query_date_str, '%Y-%m-%d')
        else:
            query_date = datetime.now()

        # Get parameters from bed or query params (query params override bed)
        if garden_bed:
            soil_type = request.args.get('soil_type') or garden_bed.soil_type or 'loamy'
            sun_exposure = request.args.get('sun_exposure') or garden_bed.sun_exposure or 'full'

            # TEMPORAL MULCH LOOKUP: Query most recent mulch event as of query_date
            # If mulch_type explicitly provided in query params, use that (override)
            mulch_type = request.args.get('mulch_type')
            if not mulch_type:
                # Use temporal lookup to find effective mulch as of query_date
                mulch_type = get_mulch_type_on_date(garden_bed.id, current_user.id, query_date)
        else:
            soil_type = request.args.get('soil_type', 'loamy')
            sun_exposure = request.args.get('sun_exposure', 'full')
            mulch_type = request.args.get('mulch_type')

            # Backward compatibility: convert has_mulch to mulch_type
            if not mulch_type:
                has_mulch_str = request.args.get('has_mulch', 'false')
                mulch_type = 'straw' if has_mulch_str.lower() == 'true' else 'none'

        # Get location - prefer zipcode, then lat/lon, then user's property, then defaults
        zipcode = request.args.get('zipcode')
        latitude = request.args.get('latitude')
        longitude = request.args.get('longitude')

        # If zipcode provided, geocode it to get coordinates
        if zipcode and not (latitude and longitude):
            try:
                geo_result = geocoding_service.validate_address(zipcode)
                if geo_result:
                    lat = geo_result['latitude']
                    lon = geo_result['longitude']
                else:
                    return jsonify({'error': 'Could not geocode zipcode'}), 400
            except Exception as e:
                return jsonify({'error': f'Geocoding error: {str(e)}'}), 500
        elif latitude and longitude:
            lat = float(latitude)
            lon = float(longitude)
        elif current_user.properties and current_user.properties[0].latitude and current_user.properties[0].longitude:
            # Use user's first property location
            lat = current_user.properties[0].latitude
            lon = current_user.properties[0].longitude
        else:
            # Default to NYC if no location provided
            lat = float(DEFAULT_LATITUDE)
            lon = float(DEFAULT_LONGITUDE)

        # Get soil temperature at all depths (0cm, 6cm, 18cm) in a single API call
        multi_result = get_soil_temperatures_all_depths_with_adjustments(
            lat, lon, soil_type, sun_exposure, mulch_type
        )
        temps_by_depth = multi_result['temps_by_depth']

        # Calculate protection offset from bed's season extension (cold frame, row cover, etc.)
        protection_offset = 0
        protection_label = None
        if garden_bed and garden_bed.season_extension:
            try:
                season_ext = json.loads(garden_bed.season_extension)
                ext_type = season_ext.get('type')
                inner_type = season_ext.get('innerType')
                protection_offset, protection_label = calculate_protection_offset(
                    ext_type, inner_type
                )
            except (json.JSONDecodeError, TypeError):
                pass

        # Apply protection offset to all depth temperatures
        if protection_offset:
            for depth_info in temps_by_depth.values():
                depth_info['final_soil_temp'] += protection_offset

        # Primary display temp is 6cm (the general seed-depth reading)
        final_soil_temp = temps_by_depth[6]['final_soil_temp']
        base_temp = temps_by_depth[6]['base_temp']

        # Build depth-aware final temps dict for crop readiness
        depth_finals = {d: info['final_soil_temp'] for d, info in temps_by_depth.items()}

        # Calculate crop readiness using depth-appropriate temps per plant
        crop_readiness = calculate_crop_readiness(final_soil_temp, PLANT_DATABASE, temps_by_depth=depth_finals)

        # Fetch multi-day soil temperature forecast at all depths
        try:
            import math
            forecast_multi = get_soil_temperature_forecast_all_depths_with_adjustments(
                lat, lon, soil_type, sun_exposure, mulch_type, forecast_days=16
            )
            forecast_by_depth = forecast_multi['forecast_by_depth']

            # Apply protection offset to forecast temperatures
            if protection_offset:
                for depth_cm, daily_temps in forecast_by_depth.items():
                    for day in daily_temps:
                        day['soil_temp'] += protection_offset
                        day['min_soil_temp'] += protection_offset
                        day['max_soil_temp'] += protection_offset

            def safe_float(v):
                """Replace NaN/Inf with None for JSON safety."""
                if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                    return None
                return v

            # Primary forecast uses 6cm (the headline depth)
            soil_temp_forecast = [
                {'date': d['date'], 'soilTemp': safe_float(d['soil_temp']),
                 'minSoilTemp': safe_float(d['min_soil_temp']),
                 'maxSoilTemp': safe_float(d['max_soil_temp'])}
                for d in forecast_by_depth.get(6, [])
            ]

            # Build multi-depth forecast for frontend calendar warnings
            forecast_by_depth_response = {}
            for depth_cm, daily_temps in forecast_by_depth.items():
                forecast_by_depth_response[str(depth_cm)] = [
                    {'date': d['date'], 'soilTemp': safe_float(d['soil_temp']),
                     'minSoilTemp': safe_float(d['min_soil_temp']),
                     'maxSoilTemp': safe_float(d['max_soil_temp'])}
                    for d in daily_temps
                ]

            def sanitize_forecast(raw):
                """Sanitize NaN values in forecast readiness data and convert to camelCase."""
                sanitized = {}
                for plant_id, info in raw.items():
                    sanitized_daily = []
                    for day in info.get('daily_readiness', []):
                        sanitized_daily.append({
                            'date': day['date'],
                            'soilTemp': safe_float(day['soilTemp']),
                            'status': day['status'],
                        })
                    sanitized[plant_id] = {
                        **info,
                        'daily_readiness': sanitized_daily,
                    }
                    # Frost risk fields (camelCase for API response)
                    if 'frost_risk' in info:
                        sanitized[plant_id]['frostRisk'] = info['frost_risk']
                        sanitized[plant_id]['frostRiskDays'] = info.get('frost_risk_days', [])
                        sanitized[plant_id]['frostTolerance'] = info.get('frost_tolerance', 'tender')
                return sanitized

            # Fetch air temperature forecast for frost risk integration
            air_temp_forecast = None
            try:
                from weather_service import get_forecast
                weather_data = get_forecast(lat, lon, days=16)
                if not weather_data.get('isMock'):
                    air_temp_forecast = weather_data.get('forecast', [])
            except Exception as e:
                logger.warning(f"Air temp forecast for frost risk failed: {e}")

            # Calculate forecast readiness using depth-aware temps per plant
            raw_seed, _ = calculate_crop_readiness_forecast(
                forecast_by_depth.get(6, []), PLANT_DATABASE, mode='seed',
                forecast_by_depth=forecast_by_depth,
                air_temp_forecast=air_temp_forecast,
                protection_offset=protection_offset,
            )
            crop_readiness_forecast = sanitize_forecast(raw_seed)

            raw_transplant, direct_sow_only = calculate_crop_readiness_forecast(
                forecast_by_depth.get(6, []), PLANT_DATABASE, mode='transplant',
                forecast_by_depth=forecast_by_depth,
                air_temp_forecast=air_temp_forecast,
                protection_offset=protection_offset,
            )
            crop_readiness_transplant = sanitize_forecast(raw_transplant)
        except Exception as e:
            logger.warning(f"Soil temp forecast failed, skipping: {e}")
            soil_temp_forecast = None
            forecast_by_depth_response = None
            crop_readiness_forecast = None
            crop_readiness_transplant = None
            direct_sow_only = {}

        # Build temps_by_depth for response (string keys for JSON)
        temps_by_depth_response = {
            str(d): {'finalSoilTemp': info['final_soil_temp'], 'baseTemp': info['base_temp']}
            for d, info in temps_by_depth.items()
        }

        # Build comprehensive response
        response = {
            'final_soil_temp': final_soil_temp,
            'base_temp': base_temp,
            'adjustments': multi_result['adjustments'],
            'method': multi_result['method'],
            'source': multi_result['source'],
            'using_mock_data': multi_result['using_mock_data'],
            'crop_readiness': crop_readiness,
            # Multi-depth data
            'temps_by_depth': temps_by_depth_response,
            # Forecast data for germination window readiness
            'soil_temp_forecast': soil_temp_forecast,
            'forecast_by_depth': forecast_by_depth_response,
            'crop_readiness_forecast': crop_readiness_forecast,
            'crop_readiness_transplant': crop_readiness_transplant,
            'directSowOnly': direct_sow_only,
            # Protection offset from season extension (cold frame, greenhouse, etc.)
            'protection_offset': protection_offset,
            'protection_label': protection_label,
            # For backward compatibility (deprecated fields)
            'estimated_soil_temp': final_soil_temp,
            'soil_adjustments': multi_result['adjustments']
        }

        return jsonify(response), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500


# ==================== MAPLE TAPPING ====================

@utilities_bp.route('/maple-tapping/season-estimate', methods=['GET'])
@login_required
def get_maple_tapping_season():
    """
    Get maple tapping season estimate based on weather patterns.

    Determines if current conditions are ideal for tapping (freeze-thaw cycles)
    and provides recommendations for when to tap.

    Query Parameters:
        - latitude (optional): Location latitude (defaults to user's property)
        - longitude (optional): Location longitude (defaults to user's property)

    Returns:
        JSON with season information and recommendations
    """
    try:
        # Only show tapping data if user has tappable trees placed on their property
        TAPPABLE_PREFIXES = ('maple', 'sugar-maple', 'birch', 'walnut', 'boxelder', 'sycamore')
        has_tappable = PlacedStructure.query.filter(
            PlacedStructure.user_id == current_user.id
        ).all()
        has_tappable_trees = any(
            ps.structure_id and any(ps.structure_id.startswith(prefix) for prefix in TAPPABLE_PREFIXES)
            for ps in has_tappable
        )
        # Get location - prefer zipcode, then lat/lon, then property, then defaults
        zipcode = request.args.get('zipcode')
        latitude = request.args.get('latitude')
        longitude = request.args.get('longitude')

        if zipcode and not (latitude and longitude):
            try:
                geo_result = geocoding_service.validate_address(zipcode)
                if geo_result:
                    lat = geo_result['latitude']
                    lon = geo_result['longitude']
                else:
                    return jsonify({'error': 'Could not geocode zipcode'}), 400
            except Exception as e:
                return jsonify({'error': f'Geocoding error: {str(e)}'}), 500
        elif latitude and longitude:
            lat = float(latitude)
            lon = float(longitude)
        else:
            # Try to get from user's first property
            first_property = Property.query.filter_by(user_id=current_user.id).first()
            if first_property and first_property.latitude and first_property.longitude:
                lat = first_property.latitude
                lon = first_property.longitude
            else:
                # Default to NYC if no location
                lat = float(DEFAULT_LATITUDE)
                lon = float(DEFAULT_LONGITUDE)

        # Calculate tapping season
        season_data = calculate_tapping_season(lat, lon)

        # Flag if no tappable trees placed (informational, doesn't block data)
        if not has_tappable_trees:
            season_data['no_tappable_trees'] = True

        return jsonify(season_data), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500


# ==================== INDOOR SEED STARTS ====================

@utilities_bp.route('/indoor-seed-starts', methods=['GET', 'POST'])
@login_required
def indoor_seed_starts():
    """
    GET: Retrieve all indoor seed starts (with optional filtering)
    POST: Create new indoor seed start
    """
    if request.method == 'POST':
        try:
            data = request.json

            # Get plant data for calculations
            plant = get_plant_by_id(data['plantId'])
            if not plant:
                return jsonify({'error': 'Plant not found'}), 404

            # Calculate expected dates
            start_date = parse_iso_date(data['startDate'])
            germination_days = _get_predicted_germination_days(
                current_user.id, data['plantId'], data.get('location')
            )
            weeks_indoors = plant.get('weeksIndoors', 4)

            expected_germination_date = start_date + timedelta(days=germination_days)
            expected_transplant_date = start_date + timedelta(weeks=weeks_indoors)

            # Calculate quantity to start (accounting for germination rate)
            desired_plants = data.get('desiredPlants', 1)
            expected_rate = data.get('expectedGerminationRate', 85.0)  # Default 85%
            seeds_to_start = calculate_seed_quantity(desired_plants, expected_rate)

            # Allow user to override the calculated seed quantity
            if 'seedsStarted' in data and data['seedsStarted'] is not None:
                seeds_to_start = int(data['seedsStarted'])

            # Always start as 'planned' — user explicitly updates status when they seed
            initial_status = 'planned'

            seed_start = IndoorSeedStart(
                user_id=current_user.id,
                plant_id=data['plantId'],
                variety=data.get('variety'),
                seed_inventory_id=data.get('seedInventoryId'),
                start_date=start_date,
                expected_germination_date=expected_germination_date,
                expected_transplant_date=expected_transplant_date,
                seeds_started=seeds_to_start,
                expected_germination_rate=expected_rate,
                location=data.get('location', 'windowsill'),
                light_hours=data.get('lightHours', 12),
                temperature=data.get('temperature', 70),
                notes=data.get('notes', ''),
                status=initial_status
            )

            db.session.add(seed_start)
            db.session.flush()  # Get ID before creating planting event

            # Create corresponding PlantingEvent for timeline integration
            days_to_maturity = plant.get('daysToMaturity', 70)
            expected_harvest_date = expected_transplant_date + timedelta(days=days_to_maturity)

            planting_event = PlantingEvent(
                user_id=current_user.id,
                plant_id=data['plantId'],
                variety=data.get('variety'),
                quantity=desired_plants,
                seed_start_date=start_date,
                transplant_date=expected_transplant_date,
                expected_harvest_date=expected_harvest_date,
                notes=f"Created from indoor seed start #{seed_start.id}"
                # Leave garden_bed_id and position blank - user assigns later
            )

            db.session.add(planting_event)
            db.session.flush()

            # Link them together
            seed_start.planting_event_id = planting_event.id

            db.session.commit()

            # Check seed inventory availability and warn if insufficient
            inventory_warning = None
            if seed_start.seed_inventory_id:
                seed_inv = SeedInventory.query.get(seed_start.seed_inventory_id)
                if seed_inv:
                    total_seeds = (seed_inv.quantity or 0) * (seed_inv.seeds_per_packet or 50)
                    seeds_used = seed_inv.get_seeds_used()
                    available = total_seeds - seeds_used
                    if available < 0:
                        inventory_warning = f"Seed inventory exceeded: {abs(available)} more seeds used than available ({total_seeds} total)"

            response = {
                'indoorStart': seed_start.to_dict(),
                'plantingEvent': planting_event.to_dict()
            }
            if inventory_warning:
                response['inventoryWarning'] = inventory_warning

            return jsonify(response), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 400

    # GET request
    try:
        query = IndoorSeedStart.query.filter_by(user_id=current_user.id)

        # Filter by status
        status = request.args.get('status')
        if status and status != 'all':
            query = query.filter_by(status=status)

        # Filter by transplant readiness
        ready_only = request.args.get('ready_only')
        if ready_only == 'true':
            query = query.filter_by(transplant_ready=True)

        # Filter by date range
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        if start_date and end_date:
            start_dt = parse_iso_date(start_date)
            end_dt = parse_iso_date(end_date)
            query = query.filter(
                IndoorSeedStart.start_date >= start_dt,
                IndoorSeedStart.start_date <= end_dt
            )

        seed_starts = query.order_by(IndoorSeedStart.start_date.desc()).all()
        return jsonify([s.to_dict() for s in seed_starts])
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@utilities_bp.route('/indoor-seed-starts/<int:id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def indoor_seed_start_detail(id):
    """
    GET: Retrieve single indoor seed start
    PUT: Update indoor seed start (germination progress, conditions, etc.)
    DELETE: Delete indoor seed start
    """
    seed_start = IndoorSeedStart.query.filter_by(id=id, user_id=current_user.id).first_or_404()

    if request.method == 'DELETE':
        try:
            db.session.delete(seed_start)
            db.session.commit()
            return jsonify({'message': 'Deleted successfully'}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 400

    if request.method == 'PUT':
        try:
            data = request.json

            # Update fields
            if 'seedsStarted' in data:
                seed_start.seeds_started = data['seedsStarted']
                # Recalculate germination rate if we have germinated seeds
                if seed_start.seeds_germinated is not None:
                    seed_start.calculate_actual_germination_rate()

            if 'seedsGerminated' in data:
                seed_start.seeds_germinated = data['seedsGerminated']
                seed_start.calculate_actual_germination_rate()

            if 'startDate' in data:
                new_start_date = parse_iso_date(data['startDate'])
                seed_start.start_date = new_start_date
                # Recalculate expected dates from new start date
                plant = get_plant_by_id(seed_start.plant_id)
                if plant:
                    germination_days = _get_predicted_germination_days(
                        current_user.id, seed_start.plant_id, seed_start.location
                    )
                    weeks_indoors = plant.get('weeksIndoors', 4)
                    seed_start.expected_germination_date = new_start_date + timedelta(days=germination_days)
                    seed_start.expected_transplant_date = new_start_date + timedelta(weeks=weeks_indoors)

                    # Sync updated dates to linked PlantingEvent
                    if seed_start.planting_event_id:
                        linked_event = PlantingEvent.query.get(seed_start.planting_event_id)
                        if linked_event:
                            linked_event.seed_start_date = new_start_date
                            linked_event.transplant_date = seed_start.expected_transplant_date
                            days_to_maturity = plant.get('daysToMaturity', 70)
                            linked_event.expected_harvest_date = seed_start.expected_transplant_date + timedelta(days=days_to_maturity)

            if 'status' in data:
                seed_start.status = data['status']

            if 'transplantReady' in data:
                seed_start.transplant_ready = data['transplantReady']

            if 'hardeningOffStarted' in data:
                seed_start.hardening_off_started = parse_iso_date(data['hardeningOffStarted'])

            if 'actualTransplantDate' in data:
                seed_start.actual_transplant_date = parse_iso_date(data['actualTransplantDate'])

            if 'location' in data:
                seed_start.location = data['location']

            if 'lightHours' in data:
                seed_start.light_hours = data['lightHours']

            if 'temperature' in data:
                seed_start.temperature = data['temperature']

            if 'actualGerminationDate' in data:
                if data['actualGerminationDate'] is not None:
                    seed_start.actual_germination_date = parse_iso_date(data['actualGerminationDate'])
                else:
                    seed_start.actual_germination_date = None

            if 'variety' in data:
                seed_start.variety = data['variety'] or None

            if 'seedInventoryId' in data:
                seed_start.seed_inventory_id = data['seedInventoryId']

            if 'notes' in data:
                seed_start.notes = data['notes']

            if 'destinationBedIds' in data:
                val = data['destinationBedIds']
                if val is None or val == []:
                    seed_start.destination_bed_ids = None  # Clear override, revert to computed
                else:
                    seed_start.destination_bed_ids = json.dumps([int(bid) for bid in val])

            db.session.commit()
            return jsonify(seed_start.to_dict())
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 400

    # GET request
    return jsonify(seed_start.to_dict())


@utilities_bp.route('/indoor-seed-starts/<int:id>/mark-failed', methods=['POST'])
@login_required
def mark_indoor_seed_start_failed(id):
    """
    Mark an indoor seed start as failed with optional cascade to linked PlantingEvent.
    Request body: { "cascade": "direct-seed" | "abandon" }
    - direct-seed: Convert linked PlantingEvent from transplant to direct seed
    - abandon: Mark linked PlantingEvent as completed with quantity_completed=0
    If no cascade field, just marks the seed start as failed.
    """
    seed_start = IndoorSeedStart.query.filter_by(id=id, user_id=current_user.id).first_or_404()

    if seed_start.status in ('failed', 'transplanted'):
        return jsonify({'error': f'Seed start is already {seed_start.status}'}), 400

    data = request.json or {}
    cascade = data.get('cascade')

    if cascade and not seed_start.planting_event_id:
        return jsonify({'error': 'No linked planting event for cascade action'}), 400

    try:
        seed_start.status = 'failed'

        event_dict = None
        if seed_start.planting_event_id and cascade:
            event = PlantingEvent.query.get(seed_start.planting_event_id)
            if not event:
                return jsonify({'error': 'Linked planting event not found'}), 404

            # Skip cascade if event already completed
            if not event.completed:
                if cascade == 'direct-seed':
                    # Calculate indoor head start before clearing dates
                    if event.transplant_date and event.seed_start_date:
                        indoor_days = (event.transplant_date - event.seed_start_date).days
                    else:
                        plant_lookup = get_plant_by_id(event.plant_id) if event.plant_id else None
                        indoor_days = (plant_lookup.get('weeksIndoors', 0) * 7) if plant_lookup else 0

                    # Convert to direct seed
                    event.direct_seed_date = event.transplant_date
                    event.seed_start_date = None
                    event.transplant_date = None

                    # Recalculate expected harvest date
                    if event.direct_seed_date:
                        dtm = None
                        if event.plant_id and event.variety:
                            seed = SeedInventory.query.filter_by(
                                user_id=current_user.id,
                                plant_id=event.plant_id,
                                variety=event.variety
                            ).first()
                            if seed and seed.days_to_maturity is not None:
                                dtm = seed.days_to_maturity
                        if dtm is None and event.plant_id:
                            plant = get_plant_by_id(event.plant_id)
                            if plant and plant.get('daysToMaturity') is not None:
                                dtm = plant['daysToMaturity']
                        if dtm is None:
                            dtm = 60
                        event.expected_harvest_date = event.direct_seed_date + timedelta(days=dtm + indoor_days)

                elif cascade == 'abandon':
                    event.completed = True
                    event.quantity_completed = 0

                    # Free allocated space
                    event.position_x = None
                    event.position_y = None
                    event.space_required = None
                    event.garden_bed_id = None

                    # Free trellis allocation
                    if event.trellis_structure_id is not None:
                        event.trellis_structure_id = None
                        event.trellis_position_start_inches = None
                        event.trellis_position_end_inches = None
                        event.linear_feet_allocated = None

                else:
                    return jsonify({'error': f'Invalid cascade value: {cascade}'}), 400

            event_dict = event.to_dict()

        db.session.commit()

        result = {
            'seedStart': seed_start.to_dict(),
            'action': cascade or 'none',
        }
        if event_dict:
            result['plantingEvent'] = event_dict
        return jsonify(result)

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@utilities_bp.route('/indoor-seed-starts/<int:id>/transplant', methods=['POST'])
@login_required
def transplant_indoor_seed_start(id):
    """
    Create outdoor PlantingEvent from indoor seed start.
    Links the two records and marks indoor start as transplanted.
    """
    seed_start = IndoorSeedStart.query.filter_by(id=id, user_id=current_user.id).first_or_404()

    try:
        data = request.json
        transplant_date = parse_iso_date(data.get('transplantDate', datetime.utcnow().isoformat()))

        # Check if PlantingEvent already exists (from auto-creation)
        if seed_start.planting_event_id:
            # UPDATE existing PlantingEvent
            planting_event = PlantingEvent.query.get(seed_start.planting_event_id)
            if not planting_event:
                return jsonify({'error': 'Linked planting event not found'}), 404

            # Update with actual transplant details
            planting_event.transplant_date = transplant_date
            planting_event.garden_bed_id = data.get('gardenBedId')
            planting_event.position_x = data.get('positionX')
            planting_event.position_y = data.get('positionY')
            planting_event.space_required = data.get('spaceRequired')

            # Recalculate harvest date based on actual transplant
            plant = get_plant_by_id(seed_start.plant_id)
            if plant:
                days_to_maturity = plant.get('daysToMaturity', 70)
                planting_event.expected_harvest_date = transplant_date + timedelta(days=days_to_maturity)
            else:
                planting_event.expected_harvest_date = parse_iso_date(data['expectedHarvestDate'])

            if data.get('notes'):
                planting_event.notes = data['notes']

        else:
            # Fallback: Create new PlantingEvent (for old data without auto-creation)
            planting_event = PlantingEvent(
                user_id=current_user.id,
                plant_id=seed_start.plant_id,
                variety=seed_start.variety,
                garden_bed_id=data.get('gardenBedId'),
                seed_start_date=seed_start.start_date,  # Track original indoor start
                transplant_date=transplant_date,
                expected_harvest_date=parse_iso_date(data['expectedHarvestDate']),
                position_x=data.get('positionX'),
                position_y=data.get('positionY'),
                space_required=data.get('spaceRequired'),
                notes=data.get('notes', f'Started indoors on {seed_start.start_date.strftime("%Y-%m-%d")}')
            )

            db.session.add(planting_event)
            db.session.flush()  # Get planting_event.id
            seed_start.planting_event_id = planting_event.id

        # Update indoor start status
        seed_start.actual_transplant_date = transplant_date
        seed_start.status = 'transplanted'

        # Server-side conflict enforcement for transplant (Bug Fix #3)
        garden_bed_id = planting_event.garden_bed_id
        position_x = planting_event.position_x
        position_y = planting_event.position_y

        if garden_bed_id and position_x is not None and position_y is not None:
            # Validate the transplant position
            start_date = planting_event.transplant_date or planting_event.direct_seed_date or planting_event.seed_start_date

            if start_date and planting_event.expected_harvest_date:
                is_valid, error_response = validate_planting_conflict({
                    'garden_bed_id': garden_bed_id,
                    'position_x': position_x,
                    'position_y': position_y,
                    'plant_id': planting_event.plant_id,
                    'transplant_date': planting_event.transplant_date,
                    'direct_seed_date': planting_event.direct_seed_date,
                    'seed_start_date': planting_event.seed_start_date,
                    'start_date': start_date,
                    'end_date': planting_event.expected_harvest_date,
                    'conflict_override': False
                }, current_user.id, exclude_event_id=planting_event.id if hasattr(planting_event, 'id') else None)

                if not is_valid:
                    db.session.rollback()
                    return jsonify(error_response), 409

        db.session.commit()

        return jsonify({
            'seedStart': seed_start.to_dict(),
            'plantingEvent': planting_event.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400


@utilities_bp.route('/indoor-seed-starts/calculate-quantity', methods=['POST'])
@login_required
def calculate_indoor_quantity():
    """
    Calculate how many seeds to start based on desired plant count
    and expected germination rate.
    """
    try:
        data = request.json
        desired_plants = data.get('desiredPlants', 1)
        germination_rate = data.get('germinationRate', 85.0)

        quantity = calculate_seed_quantity(desired_plants, germination_rate)

        return jsonify({
            'desiredPlants': desired_plants,
            'germinationRate': germination_rate,
            'seedsToStart': quantity,
            'expectedSurvivors': int(quantity * (germination_rate / 100))
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@utilities_bp.route('/indoor-seed-starts/by-planting-event/<int:event_id>', methods=['GET'])
@login_required
def get_indoor_start_by_planting_event(event_id):
    """Look up an IndoorSeedStart by its linked planting_event_id."""
    seed_start = IndoorSeedStart.query.filter_by(
        planting_event_id=event_id,
        user_id=current_user.id
    ).first()

    if not seed_start:
        return jsonify({'error': 'No indoor seed start linked to this event'}), 404

    return jsonify(seed_start.to_dict())


@utilities_bp.route('/indoor-seed-starts/from-planting-event', methods=['POST'])
@login_required
def create_indoor_start_from_planting_event():
    """
    Create an indoor seed start based on a planting event's transplant date.
    Automatically calculates when to start seeds indoors based on plant's weeksIndoors.

    Body: {
        plantingEventId?: number,  // Optional: link to existing planting event
        plantId: string,
        variety?: string,
        transplantDate: string (ISO),
        desiredQuantity: number,
        location?: string,
        notes?: string
    }
    """
    try:
        data = request.json

        # Get plant data
        plant = get_plant_by_id(data['plantId'])
        if not plant:
            return jsonify({'error': 'Plant not found'}), 404

        # Check if plant can be started indoors
        weeks_indoors = plant.get('weeksIndoors', 0)
        if weeks_indoors == 0:
            return jsonify({
                'error': f"{plant['name']} is typically direct seeded (weeksIndoors = 0). Cannot create indoor start.",
                'canStartIndoors': False
            }), 400

        # Parse transplant date and calculate indoor start date
        transplant_date = parse_iso_date(data['transplantDate'])
        indoor_start_date = transplant_date - timedelta(weeks=weeks_indoors)

        # Note if start date is in the past (but still allow creation)
        is_past_due = indoor_start_date.date() < datetime.utcnow().date()
        warning_message = None
        if is_past_due:
            warning_message = f'Note: Calculated indoor start date ({indoor_start_date.date()}) is in the past. You may be starting late.'

        # Calculate expected dates
        germination_days = _get_predicted_germination_days(
            current_user.id, data['plantId'], data.get('location')
        )
        expected_germination_date = indoor_start_date + timedelta(days=germination_days)
        expected_transplant_date = indoor_start_date + timedelta(weeks=weeks_indoors)

        # Calculate quantity to start (accounting for germination rate)
        desired_plants = data.get('desiredQuantity', 1)
        expected_rate = data.get('expectedGerminationRate', 85.0)
        seeds_to_start = calculate_seed_quantity(desired_plants, expected_rate)

        # Always start as 'planned' — user explicitly updates status when they seed
        initial_status = 'planned'
        seed_start = IndoorSeedStart(
            user_id=current_user.id,
            plant_id=data['plantId'],
            variety=data.get('variety'),
            seed_inventory_id=data.get('seedInventoryId'),
            start_date=indoor_start_date,
            expected_germination_date=expected_germination_date,
            expected_transplant_date=expected_transplant_date,
            seeds_started=seeds_to_start,
            expected_germination_rate=expected_rate,
            location=data.get('location', 'windowsill'),
            light_hours=data.get('lightHours', 12),
            temperature=data.get('temperature', 70),
            notes=data.get('notes', f'For transplanting on {transplant_date.strftime("%Y-%m-%d")}'),
            planting_event_id=data.get('plantingEventId'),  # Link to planting event if provided
            status=initial_status
        )

        db.session.add(seed_start)
        db.session.flush()  # Get seed_start.id

        # If linking to existing PlantingEvent, update its seed_start_date
        planting_event_id = data.get('plantingEventId')
        if planting_event_id:
            planting_event = PlantingEvent.query.filter_by(
                id=planting_event_id,
                user_id=current_user.id
            ).first()
            if planting_event:
                planting_event.seed_start_date = indoor_start_date
                planting_event.transplant_date = expected_transplant_date
                # Recalculate harvest date from new transplant date
                days_to_maturity = plant.get('daysToMaturity', 70)
                planting_event.expected_harvest_date = expected_transplant_date + timedelta(days=days_to_maturity)
            else:
                return jsonify({'error': 'Planting event not found'}), 404

        db.session.commit()

        response_data = {
            'indoorSeedStart': seed_start.to_dict(),
            'calculation': {
                'transplantDate': transplant_date.isoformat(),
                'weeksIndoors': weeks_indoors,
                'indoorStartDate': indoor_start_date.isoformat(),
                'expectedGerminationDate': expected_germination_date.isoformat(),
                'expectedTransplantDate': expected_transplant_date.isoformat(),
                'isPastDue': is_past_due
            }
        }

        if warning_message:
            response_data['warning'] = warning_message

        return jsonify(response_data), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400


# ==================== PLANTING VALIDATION ROUTES ====================

def calculate_heat_protection_offset(season_ext: dict) -> tuple:
    """
    Calculate temperature reduction from shade cloth on a garden bed.

    Shade cloth reduces effective air temperature:
        effective_temp = air_temp - (shade_factor * 0.2)
        30% → ~6°F, 50% → ~10°F, 70% → ~14°F

    Args:
        season_ext: Parsed season extension JSON dict

    Returns:
        Tuple of (offset_degrees, human_readable_label or None)
    """
    shade_cloth = season_ext.get('shadeCloth')
    if not shade_cloth or not shade_cloth.get('installed'):
        return 0, None

    shade_factor = shade_cloth.get('shadeFactor', 0)
    if shade_factor <= 0:
        return 0, None

    offset = shade_factor * 0.2
    label = f"{shade_factor}% Shade Cloth"
    return round(offset), label


def calculate_protection_offset(protection_type: str, inner_type: str = None) -> tuple:
    """
    Calculate temperature offset from season extension protection.
    Supports outer structure with optional inner structure (e.g., cold frame in greenhouse).
    Inner structures add protection at 65% efficiency.

    Returns:
        Tuple of (offset_degrees, human_readable_type)
    """
    # Base temperature boost (°F)
    # Values based on extension service research and Coleman's data
    PROTECTION_TEMPS = {
        'row-cover': 4,      # Extension: 2-6°F, heavy up to 8°F
        'low-tunnel': 6,     # Hoops with row cover: 4-8°F
        'cold-frame': 10,    # Cold frame: 8-12°F on sunny days
        'high-tunnel': 8,    # Single plastic: few degrees more than cover
        'greenhouse': 10,    # Similar to cold frame
    }

    # Human-readable labels
    PROTECTION_LABELS = {
        'row-cover': 'Row Cover',
        'low-tunnel': 'Low Tunnel',
        'cold-frame': 'Cold Frame',
        'high-tunnel': 'High Tunnel',
        'greenhouse': 'Greenhouse',
    }

    if not protection_type or protection_type == 'none':
        return 0, None

    # Outer structure temperature
    outer_temp = PROTECTION_TEMPS.get(protection_type, 6)
    label = PROTECTION_LABELS.get(protection_type, protection_type)
    total_offset = outer_temp

    # Inner structure at 65% efficiency (e.g., cold frame inside greenhouse)
    if inner_type and inner_type != 'none' and inner_type in PROTECTION_TEMPS:
        inner_temp = PROTECTION_TEMPS[inner_type]
        total_offset += inner_temp * 0.65
        inner_label = PROTECTION_LABELS.get(inner_type, inner_type)
        label = f"{label} + {inner_label}"

    return round(total_offset), label


@utilities_bp.route('/validate-planting', methods=['POST'])
@login_required
def validate_planting():
    """Validate planting conditions and return warnings"""
    data = request.json

    plant_id = data.get('plantId')
    planting_date_str = data.get('plantingDate')
    property_id = data.get('propertyId')
    zipcode = data.get('zipcode')
    bed_id = data.get('bedId')  # Optional: to get protection from bed
    planting_method = data.get('plantingMethod', 'seed')  # 'seed' or 'transplant'

    if not plant_id or not planting_date_str:
        return jsonify({'error': 'plantId and plantingDate are required'}), 400

    # Parse planting date
    try:
        # Handle various date formats
        if 'T' in planting_date_str:
            planting_date = parse_iso_date(planting_date_str)
        else:
            planting_date = datetime.strptime(planting_date_str, '%Y-%m-%d')
    except (ValueError, TypeError) as e:
        return jsonify({'error': f'Invalid date format: {str(e)}'}), 400

    # Get frost dates from settings
    last_frost_str = Settings.get_setting('last_frost_date', '2024-04-15', user_id=current_user.id)
    first_frost_str = Settings.get_setting('first_frost_date', '2024-10-15', user_id=current_user.id)

    # Calculate protection offset from bed's season extension
    protection_offset = 0
    protection_type = None

    if bed_id:
        bed = GardenBed.query.get(bed_id)
        if bed and bed.season_extension:
            try:
                season_ext = json.loads(bed.season_extension)
                ext_type = season_ext.get('type')
                inner_type = season_ext.get('innerType')
                protection_offset, protection_type = calculate_protection_offset(
                    ext_type, inner_type
                )
            except (json.JSONDecodeError, TypeError):
                pass

    # Validate planting conditions
    # Note: validate_planting_for_property() now generates suggestions internally
    result = validate_planting_for_property(
        plant_id=plant_id,
        planting_date=planting_date,
        property_id=property_id,
        zipcode=zipcode,
        last_frost_str=last_frost_str,
        first_frost_str=first_frost_str,
        protection_offset=protection_offset,
        protection_type=protection_type,
        planting_method=planting_method
    )

    return jsonify(result)


@utilities_bp.route('/validate-plants-batch', methods=['POST'])
@login_required
def validate_plants_batch():
    """
    Validate multiple plants for a specific date in one request.
    This is optimized for the plant palette to show which plants can be seeded/transplanted.

    Request Body:
        {
            'plantIds': ['tomato-1', 'cucumber-1', ...],
            'plantingDate': '2026-02-03',
            'zipcode': '53209',
            'propertyId': 1,  # optional
            'bedId': 1        # optional - for season extension protection
        }

    Returns:
        {
            'results': {
                'tomato-1': {
                    'seed': {'valid': bool, 'warnings': [...]},
                    'transplant': {'valid': bool, 'warnings': [...]},
                    'indoor_start': {'valid': bool, 'weeks_until_transplant': int, ...}
                },
                ...
            },
            'date': '2026-02-03',
            'zipcode': '53209'
        }
    """
    data = request.json

    plant_ids = data.get('plantIds', [])
    planting_date_str = data.get('plantingDate')
    zipcode = data.get('zipcode')
    property_id = data.get('propertyId')
    bed_id = data.get('bedId')

    if not plant_ids or not planting_date_str:
        return jsonify({'error': 'plantIds and plantingDate are required'}), 400

    # Parse planting date safely (handles 'Z' suffix from JavaScript)
    try:
        if 'T' in planting_date_str:
            planting_date = parse_iso_date(planting_date_str)
        else:
            planting_date = datetime.strptime(planting_date_str, '%Y-%m-%d')
    except (ValueError, TypeError) as e:
        return jsonify({'error': f'Invalid date format: {str(e)}'}), 400

    # Get frost dates from settings
    last_frost_str = Settings.get_setting('last_frost_date', '2024-04-15', user_id=current_user.id)
    first_frost_str = Settings.get_setting('first_frost_date', '2024-10-15', user_id=current_user.id)

    # Calculate protection offset from bed's season extension
    protection_offset = 0
    protection_type = None

    if bed_id:
        bed = GardenBed.query.get(bed_id)
        if bed and bed.season_extension:
            try:
                season_ext = json.loads(bed.season_extension)
                ext_type = season_ext.get('type')
                inner_type = season_ext.get('innerType')
                protection_offset, protection_type = calculate_protection_offset(
                    ext_type, inner_type
                )
            except (json.JSONDecodeError, TypeError):
                pass

    # Resolve lat/lon once for forward-looking cold danger checks
    batch_lat = None
    batch_lon = None
    if zipcode:
        try:
            geo_result = geocoding_service.validate_address(zipcode)
            if geo_result:
                batch_lat = geo_result['latitude']
                batch_lon = geo_result['longitude']
        except Exception as e:
            logger.warning(f"Batch geocoding failed for zipcode {zipcode}: {e}")

    # Validate each plant for both seeding and transplanting
    results = {}

    for plant_id in plant_ids:
        plant_results = {
            'seed': {'valid': True, 'warnings': []},
            'transplant': {'valid': True, 'warnings': []},
            'indoor_start': {'valid': False, 'weeks_until_transplant': None}
        }

        # Validate for direct seeding
        seed_result = validate_planting_for_property(
            plant_id=plant_id,
            planting_date=planting_date,
            property_id=property_id,
            zipcode=zipcode,
            last_frost_str=last_frost_str,
            first_frost_str=first_frost_str,
            protection_offset=protection_offset,
            protection_type=protection_type,
            planting_method='seed'
        )
        plant_results['seed'] = seed_result

        # Validate for transplanting
        transplant_result = validate_planting_for_property(
            plant_id=plant_id,
            planting_date=planting_date,
            property_id=property_id,
            zipcode=zipcode,
            last_frost_str=last_frost_str,
            first_frost_str=first_frost_str,
            protection_offset=protection_offset,
            protection_type=protection_type,
            planting_method='transplant'
        )
        plant_results['transplant'] = transplant_result

        # Forward-looking cold danger check (historical cold snaps during growing period)
        if batch_lat is not None and batch_lon is not None:
            try:
                plant_data_cold = get_plant_by_id(plant_id)
                if plant_data_cold:
                    dtm_val = plant_data_cold.get('daysToMaturity')
                    if dtm_val is None:
                        dtm_val = plant_data_cold.get('days_to_maturity')
                    dtm = int(dtm_val) if dtm_val is not None else 60

                    soil_min_val = plant_data_cold.get('soilTempMin')
                    if soil_min_val is None:
                        soil_min_val = plant_data_cold.get('soil_temp_min')
                    soil_temp_min = float(soil_min_val) if soil_min_val is not None else 50

                    is_safe, cold_warning, cold_details = check_future_cold_danger(
                        plant_id=plant_id,
                        planting_date=planting_date.date() if hasattr(planting_date, 'date') else planting_date,
                        latitude=batch_lat,
                        longitude=batch_lon,
                        current_soil_temp=float(soil_temp_min),
                        days_to_maturity=int(dtm)
                    )

                    if not is_safe and cold_warning:
                        cold_warn_entry = {
                            'type': 'future_cold_danger',
                            'message': cold_warning,
                            'severity': 'warning'
                        }
                        # Append to seed warnings
                        if isinstance(plant_results['seed'].get('warnings'), list):
                            plant_results['seed']['warnings'].append(cold_warn_entry)
                        # Append to transplant warnings
                        if isinstance(plant_results['transplant'].get('warnings'), list):
                            plant_results['transplant']['warnings'].append(cold_warn_entry)
            except Exception as e:
                logger.warning(f"Forward cold check failed for {plant_id}: {e}")

        # Check if can start seeds indoors now for future transplanting
        plant_data = get_plant_by_id(plant_id)
        if plant_data and plant_data.get('weeksIndoors'):
            weeks_indoors = plant_data['weeksIndoors']
            transplant_weeks_before = plant_data.get('transplantWeeksBefore', 0)

            # Calculate when to transplant (weeks_before is relative to last frost)
            try:
                last_frost_date = datetime.strptime(last_frost_str, '%Y-%m-%d')
                transplant_target_date = last_frost_date + timedelta(weeks=transplant_weeks_before)

                # Calculate when to start seeds indoors
                indoor_start_date = transplant_target_date - timedelta(weeks=weeks_indoors)

                # Check if today is a good time to start seeds indoors
                days_until_start = (indoor_start_date.date() - planting_date.date()).days

                # If within 2 weeks of ideal indoor start time, mark as valid
                if -14 <= days_until_start <= 14:
                    plant_results['indoor_start']['valid'] = True
                    plant_results['indoor_start']['weeks_until_transplant'] = weeks_indoors
                    plant_results['indoor_start']['transplant_target_date'] = transplant_target_date.strftime('%Y-%m-%d')
            except (ValueError, TypeError):
                pass

        results[plant_id] = plant_results

    return jsonify({
        'results': results,
        'date': planting_date_str,
        'zipcode': zipcode
    })


@utilities_bp.route('/validate-planting-date', methods=['POST'])
@login_required
def validate_planting_date_api():
    """
    Validate a planting date using forward-looking historical data.

    Checks if planting on the given date will result in seedlings being killed
    by future cold snaps (based on historical temperature data).

    Request Body:
        {
            'plant_id': 'pea-1',
            'plant_name': 'Pea',
            'planting_date': '2026-01-09',
            'zipcode': '10001',
            'current_soil_temp': 40,
            'min_soil_temp': 40,
            'days_to_maturity': 60
        }

    Returns:
        {
            'safe_to_plant': bool,
            'plant_name': str,
            'planting_date': str,
            'warnings': List[str],
            'current_temp_ok': bool,
            'future_cold_danger': bool,
            'current_soil_temp': float,
            'min_soil_temp': float,
            'details': Dict or None
        }
    """
    try:
        data = request.get_json()

        # Validate required fields
        required_fields = ['plant_id', 'plant_name', 'planting_date', 'zipcode',
                          'current_soil_temp', 'min_soil_temp', 'days_to_maturity']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        # Parse planting date
        try:
            planting_date = date.fromisoformat(data['planting_date'])
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

        # Geocode zipcode
        try:
            geo_result = geocoding_service.validate_address(data['zipcode'])
            if not geo_result:
                return jsonify({'error': 'Could not geocode zipcode'}), 400

            latitude = geo_result['latitude']
            longitude = geo_result['longitude']
        except Exception as e:
            return jsonify({'error': f'Geocoding error: {str(e)}'}), 500

        # Run validation
        result = validate_planting_date(
            plant_id=data['plant_id'],
            plant_name=data['plant_name'],
            planting_date=planting_date,
            latitude=latitude,
            longitude=longitude,
            current_soil_temp=float(data['current_soil_temp']),
            min_soil_temp=float(data['min_soil_temp']),
            days_to_maturity=int(data['days_to_maturity'])
        )

        return jsonify(result), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error in validate planting date endpoint: {e}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500


@utilities_bp.route('/germination-history', methods=['GET'])
@login_required
def germination_history():
    """
    GET: Aggregated germination history per plant.
    Query params: plantId (optional), variety (optional), location (optional)
    """
    try:
        query = IndoorSeedStart.query.filter(
            IndoorSeedStart.user_id == current_user.id,
            IndoorSeedStart.actual_germination_date.isnot(None),
            IndoorSeedStart.start_date.isnot(None)
        )

        plant_id = request.args.get('plantId')
        if plant_id:
            query = query.filter(IndoorSeedStart.plant_id == plant_id)

        variety = request.args.get('variety')
        if variety:
            query = query.filter(IndoorSeedStart.variety == variety)

        location = request.args.get('location')
        if location:
            query = query.filter(IndoorSeedStart.location == location)

        records = query.order_by(IndoorSeedStart.start_date.desc()).all()

        # Group by plant_id
        grouped = {}
        for r in records:
            key = r.plant_id
            if key not in grouped:
                grouped[key] = []
            entry = {
                'id': r.id,
                'variety': r.variety,
                'startDate': r.start_date.isoformat() if r.start_date else None,
                'actualGerminationDate': r.actual_germination_date.isoformat() if r.actual_germination_date else None,
                'actualGerminationDays': r.actual_germination_days,
                'actualGerminationRate': r.actual_germination_rate,
                'location': r.location,
                'temperature': r.temperature,
                'seedsStarted': r.seeds_started,
                'seedsGerminated': r.seeds_germinated,
            }
            grouped[key].append(entry)

        result = []
        for pid, entries in grouped.items():
            days_list = [e['actualGerminationDays'] for e in entries if e['actualGerminationDays'] is not None]
            rates = [e['actualGerminationRate'] for e in entries if e['actualGerminationRate'] is not None]
            result.append({
                'plantId': pid,
                'avgGerminationDays': round(sum(days_list) / len(days_list)) if days_list else None,
                'avgGerminationRate': round(sum(rates) / len(rates), 1) if rates else None,
                'sampleCount': len(entries),
                'entries': entries,
            })

        return jsonify(result)
    except Exception as e:
        logger.error(f"Error in germination history: {e}")
        return jsonify({'error': str(e)}), 400


@utilities_bp.route('/germination-history/<plant_id>/prediction', methods=['GET'])
@login_required
def germination_prediction(plant_id):
    """
    GET: Lightweight prediction for a specific plant.
    Query params: location (optional)
    """
    try:
        location = request.args.get('location')
        predicted = _get_predicted_germination_days(current_user.id, plant_id, location)

        # Determine source
        query = IndoorSeedStart.query.filter(
            IndoorSeedStart.user_id == current_user.id,
            IndoorSeedStart.plant_id == plant_id,
            IndoorSeedStart.actual_germination_date.isnot(None),
            IndoorSeedStart.start_date.isnot(None)
        )
        if location:
            query = query.filter(IndoorSeedStart.location == location)
        sample_count = query.count()

        plant = get_plant_by_id(plant_id)
        default_days = plant.get('germination_days', 7) if plant else 7

        return jsonify({
            'predictedGerminationDays': predicted,
            'source': 'history' if sample_count > 0 else 'plantDatabase',
            'sampleCount': sample_count,
            'defaultGerminationDays': default_days,
        })
    except Exception as e:
        logger.error(f"Error in germination prediction: {e}")
        return jsonify({'error': str(e)}), 400
