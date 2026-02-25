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
"""
from flask import Blueprint, request, jsonify, send_file
from flask_login import login_required, current_user
from datetime import datetime, timedelta, date
from models import db, GardenBed, PlantedItem, PlantingEvent, IndoorSeedStart, Property, Settings, SeedInventory
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
    calculate_crop_readiness
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

# Default coordinates (New York City)
DEFAULT_LATITUDE = 40.7128
DEFAULT_LONGITUDE = -74.0060


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

        # Get soil temperature using intelligent multi-tier approach
        # This tries Open-Meteo first, then falls back to WeatherAPI, then mock
        result = get_soil_temperature_with_adjustments(lat, lon, soil_type, sun_exposure, mulch_type)

        # Calculate crop readiness for all plants
        final_soil_temp = result['final_soil_temp']
        crop_readiness = calculate_crop_readiness(final_soil_temp, PLANT_DATABASE)

        # Build comprehensive response
        response = {
            'final_soil_temp': final_soil_temp,
            'base_temp': result['base_temp'],
            'adjustments': result['adjustments'],
            'method': result['method'],
            'source': result['source'],
            'using_mock_data': result['using_mock_data'],
            'crop_readiness': crop_readiness,
            # For backward compatibility (deprecated fields)
            'estimated_soil_temp': final_soil_temp,  # Alias for final_soil_temp
            'soil_adjustments': result['adjustments']  # Alias for adjustments
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
        # Get location - use property location or defaults
        latitude = request.args.get('latitude')
        longitude = request.args.get('longitude')

        if latitude and longitude:
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
            germination_days = plant.get('germination_days', 7)
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

            # Set initial status based on whether start date is in the future
            initial_status = 'planned' if start_date.date() > datetime.utcnow().date() else 'seeded'

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
                    germination_days = plant.get('germination_days', 7)
                    weeks_indoors = plant.get('weeksIndoors', 4)
                    seed_start.expected_germination_date = new_start_date + timedelta(days=germination_days)
                    seed_start.expected_transplant_date = new_start_date + timedelta(weeks=weeks_indoors)

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

            if 'notes' in data:
                seed_start.notes = data['notes']

            db.session.commit()
            return jsonify(seed_start.to_dict())
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 400

    # GET request
    return jsonify(seed_start.to_dict())


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
        germination_days = plant.get('germination_days', 7)
        expected_germination_date = indoor_start_date + timedelta(days=germination_days)
        expected_transplant_date = indoor_start_date + timedelta(weeks=weeks_indoors)

        # Calculate quantity to start (accounting for germination rate)
        desired_plants = data.get('desiredQuantity', 1)
        expected_rate = data.get('expectedGerminationRate', 85.0)
        seeds_to_start = calculate_seed_quantity(desired_plants, expected_rate)

        # Create indoor seed start
        initial_status = 'planned' if indoor_start_date.date() > datetime.utcnow().date() else 'seeded'
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
                # Note: transplant_date should already be set from planting event creation
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
