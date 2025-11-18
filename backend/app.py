from flask import Flask, render_template, request, jsonify, redirect, url_for, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from dotenv import load_dotenv
from models import db, GardenBed, PlantedItem, PlantingEvent, WinterPlan, CompostPile, CompostIngredient, Settings, Photo, HarvestRecord, SeedInventory, Property, PlacedStructure, Chicken, EggProduction, Duck, DuckEggProduction, Beehive, HiveInspection, HoneyHarvest, Livestock, HealthRecord
from plant_database import PLANT_DATABASE, COMPOST_MATERIALS, get_plant_by_id, get_winter_hardy_plants
from structures_database import STRUCTURES_DATABASE, STRUCTURE_CATEGORIES, get_structure_by_id
from garden_methods import GARDEN_METHODS, BED_TEMPLATES, PLANT_GUILDS, get_sfg_quantity, get_row_spacing, get_intensive_spacing, get_migardener_spacing, calculate_plants_per_bed, get_methods_list, get_template_by_id, get_guild_by_id
from collision_validator import validate_structure_placement
from conflict_checker import has_conflict
from services.geocoding_service import geocoding_service
from services.csv_import_service import parse_variety_csv, import_varieties_to_database, validate_csv_format
from soil_temperature import calculate_soil_temp, get_mock_air_temp, calculate_crop_readiness, get_soil_temperature_with_adjustments
from weather_service import get_current_temperature
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from werkzeug.utils import secure_filename
import logging
from PIL import Image
from reportlab.lib.pagesizes import letter

# Validation constants
VALID_SUN_EXPOSURES = ['full', 'partial', 'shade']
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
import os
import io

# Load environment variables from .env file
load_dotenv()

# Default coordinates for soil temperature (New York City)
DEFAULT_LATITUDE = 40.7128
DEFAULT_LONGITUDE = -74.0060

# Helper function to parse ISO date strings with 'Z' suffix
def parse_iso_date(date_string):
    """Parse ISO date string, handling the 'Z' UTC suffix that JavaScript uses"""
    if not date_string:
        return None
    # Replace 'Z' with '+00:00' for Python's fromisoformat
    if date_string.endswith('Z'):
        date_string = date_string[:-1] + '+00:00'
    return datetime.fromisoformat(date_string)

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///homestead.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'your-secret-key-change-in-production'
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# Create upload folder if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

db.init_app(app)
migrate = Migrate(app, db)

# Configure CORS to allow requests from the React frontend
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000", "http://localhost:3001"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Create database tables
with app.app_context():
    db.create_all()
    # Set default frost dates if not set
    if not Settings.get_setting('last_frost_date'):
        Settings.set_setting('last_frost_date', '2024-04-15')
    if not Settings.get_setting('first_frost_date'):
        Settings.set_setting('first_frost_date', '2024-10-15')

@app.route('/')
def index():
    """Main dashboard"""
    return render_template('index.html')

# ==================== GARDEN PLANNER ROUTES ====================

@app.route('/garden-planner')
def garden_planner():
    """Garden planner page"""
    beds = GardenBed.query.all()
    return render_template('garden_planner.html', beds=beds, plants=PLANT_DATABASE)

@app.route('/visual-designer')
def visual_designer():
    """Visual garden designer page"""
    beds = GardenBed.query.all()
    return render_template('visual_designer.html', beds=beds, plants=PLANT_DATABASE)

@app.route('/api/garden-beds', methods=['GET', 'POST'])
def garden_beds():
    """Get all garden beds or create new one"""
    if request.method == 'POST':
        data = request.json

        # Validation
        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        width = data.get('width')
        length = data.get('length')

        # Validate dimensions
        if width is None or length is None:
            return jsonify({'error': 'Width and length are required'}), 400

        try:
            width = float(width)
            length = float(length)
        except (ValueError, TypeError):
            return jsonify({'error': 'Width and length must be valid numbers'}), 400

        if width <= 0:
            return jsonify({'error': 'Width must be greater than 0'}), 400

        if length <= 0:
            return jsonify({'error': 'Length must be greater than 0'}), 400

        if width > 100:
            return jsonify({'error': 'Width seems unreasonably large (max 100 feet)'}), 400

        if length > 100:
            return jsonify({'error': 'Length seems unreasonably large (max 100 feet)'}), 400

        # Validate planning method
        planning_method = data.get('planningMethod', 'square-foot')
        if planning_method not in GARDEN_METHODS:
            return jsonify({
                'error': f'Invalid planning method. Must be one of: {", ".join(GARDEN_METHODS.keys())}'
            }), 400

        # Validate sun exposure
        sun_exposure = data.get('sunExposure', 'full')
        if sun_exposure not in VALID_SUN_EXPOSURES:
            return jsonify({
                'error': f'Invalid sun exposure. Must be one of: {", ".join(VALID_SUN_EXPOSURES)}'
            }), 400

        # Get grid size based on method
        grid_size = GARDEN_METHODS.get(planning_method, {}).get('gridSize', 12)

        # Auto-generate name if not provided
        name = data.get('name') or f"{width}' x {length}' Bed"

        try:
            bed = GardenBed(
                name=name,
                width=width,
                length=length,
                location=data.get('location', ''),
                sun_exposure=sun_exposure,
                planning_method=planning_method,
                grid_size=grid_size
            )
            db.session.add(bed)
            db.session.commit()
            return jsonify(bed.to_dict()), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Database error: {str(e)}'}), 500

    beds = GardenBed.query.all()
    return jsonify([bed.to_dict() for bed in beds])

@app.route('/api/garden-beds/<int:bed_id>', methods=['GET', 'PUT', 'DELETE'])
def garden_bed(bed_id):
    """Get, update, or delete a specific garden bed"""
    bed = GardenBed.query.get_or_404(bed_id)

    if request.method == 'DELETE':
        db.session.delete(bed)
        db.session.commit()
        return '', 204

    if request.method == 'PUT':
        data = request.json
        bed.name = data.get('name', bed.name)
        bed.width = data.get('width', bed.width)
        bed.length = data.get('length', bed.length)
        bed.location = data.get('location', bed.location)
        bed.sun_exposure = data.get('sunExposure', bed.sun_exposure)
        bed.planning_method = data.get('planningMethod', bed.planning_method)
        bed.grid_size = data.get('gridSize', bed.grid_size)
        db.session.commit()

    return jsonify(bed.to_dict())

# ==================== GARDEN PLANNING METHODS ROUTES ====================

@app.route('/api/garden-methods')
def get_garden_methods():
    """Get all available garden planning methods"""
    return jsonify({
        'methods': get_methods_list(),
        'details': GARDEN_METHODS
    })

@app.route('/api/garden-methods/<method_id>')
def get_garden_method(method_id):
    """Get details for a specific garden planning method"""
    method = GARDEN_METHODS.get(method_id)
    if not method:
        return jsonify({'error': 'Method not found'}), 404
    return jsonify(method)

@app.route('/api/bed-templates')
def get_bed_templates():
    """Get all bed templates"""
    return jsonify(BED_TEMPLATES)

@app.route('/api/bed-templates/<template_id>')
def get_bed_template(template_id):
    """Get a specific bed template"""
    template = get_template_by_id(template_id)
    if not template:
        return jsonify({'error': 'Template not found'}), 404
    return jsonify(template)

@app.route('/api/plant-guilds')
def get_plant_guilds():
    """Get all plant guilds"""
    return jsonify(PLANT_GUILDS)

@app.route('/api/plant-guilds/<guild_id>')
def get_plant_guild(guild_id):
    """Get a specific plant guild"""
    guild = get_guild_by_id(guild_id)
    if not guild:
        return jsonify({'error': 'Guild not found'}), 404
    return jsonify(guild)

@app.route('/api/spacing-calculator', methods=['POST'])
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

@app.route('/api/apply-template', methods=['POST'])
def apply_template():
    """Apply a bed template to create a new bed with pre-populated plants"""
    data = request.json
    template_id = data.get('templateId')
    custom_name = data.get('name')

    template = get_template_by_id(template_id)
    if not template:
        return jsonify({'error': 'Template not found'}), 404

    # Create the bed
    bed = GardenBed(
        name=custom_name or template['name'],
        width=template['bedSize']['width'],
        length=template['bedSize']['length'],
        planning_method=template['method'],
        grid_size=GARDEN_METHODS[template['method']]['gridSize']
    )
    db.session.add(bed)
    db.session.flush()  # Get the bed ID

    # Add the plants from template
    if 'plants' in template:
        for plant_data in template['plants']:
            item = PlantedItem(
                garden_bed_id=bed.id,
                plant_id=plant_data['plantId'],
                position_row=plant_data['position']['row'],
                position_col=plant_data['position']['col'],
                quantity=plant_data['quantity'],
                planted_date=datetime.utcnow()
            )
            db.session.add(item)

    db.session.commit()
    return jsonify(bed.to_dict()), 201

@app.route('/api/planted-items', methods=['POST'])
def add_planted_item():
    """Add a plant to a garden bed"""
    try:
        data = request.json

        # Validation
        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        if 'plantId' not in data:
            return jsonify({'error': 'plantId is required'}), 400

        if 'gardenBedId' not in data:
            return jsonify({'error': 'gardenBedId is required'}), 400

        # Verify garden bed exists
        bed = GardenBed.query.get(data['gardenBedId'])
        if not bed:
            return jsonify({'error': f'Garden bed with ID {data["gardenBedId"]} not found'}), 404

        position = data.get('position', {})
        item = PlantedItem(
            plant_id=data['plantId'],
            variety=data.get('variety'),  # Optional variety field
            garden_bed_id=data['gardenBedId'],
            planted_date=parse_iso_date(data.get('plantedDate')) or datetime.now(),
            quantity=data.get('quantity', 1),
            status=data.get('status', 'planned'),
            notes=data.get('notes', ''),
            position_x=position.get('x', 0),
            position_y=position.get('y', 0)
        )
        db.session.add(item)
        db.session.commit()
        return jsonify(item.to_dict()), 201
    except KeyError as e:
        db.session.rollback()
        return jsonify({'error': f'Missing required field: {str(e)}'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Database error: {str(e)}'}), 500

@app.route('/api/garden-beds/<int:bed_id>/planted-items', methods=['DELETE'])
def clear_bed(bed_id):
    """Remove all planted items from a garden bed"""
    bed = GardenBed.query.get_or_404(bed_id)
    count = len(bed.planted_items)

    # Delete all planted items for this bed
    PlantedItem.query.filter_by(garden_bed_id=bed_id).delete()
    db.session.commit()

    return jsonify({'message': f'Cleared {count} plants from bed', 'count': count}), 200

@app.route('/api/planted-items/<int:item_id>', methods=['PUT', 'DELETE'])
def planted_item(item_id):
    """Update or delete a planted item"""
    item = PlantedItem.query.get_or_404(item_id)

    if request.method == 'DELETE':
        db.session.delete(item)
        db.session.commit()
        return '', 204

    data = request.json
    item.status = data.get('status', item.status)
    item.notes = data.get('notes', item.notes)
    if 'variety' in data:
        item.variety = data.get('variety')  # Allow updating variety
    if 'harvestDate' in data and data['harvestDate']:
        item.harvest_date = parse_iso_date(data['harvestDate'])
    db.session.commit()
    return jsonify(item.to_dict())

# ==================== PLANTING CALENDAR ROUTES ====================

@app.route('/planting-calendar')
def planting_calendar():
    """Planting calendar page"""
    events = PlantingEvent.query.order_by(PlantingEvent.seed_start_date).all()
    last_frost = Settings.get_setting('last_frost_date', '2024-04-15')
    first_frost = Settings.get_setting('first_frost_date', '2024-10-15')
    return render_template('planting_calendar.html',
                         events=events,
                         plants=PLANT_DATABASE,
                         last_frost_date=last_frost,
                         first_frost_date=first_frost)

@app.route('/api/planting-events', methods=['GET', 'POST'])
def planting_events():
    """Get all planting events or create new one"""
    if request.method == 'POST':
        try:
            data = request.json
            event = PlantingEvent(
                plant_id=data['plantId'],
                variety=data.get('variety', ''),
                garden_bed_id=data.get('gardenBedId'),
                seed_start_date=parse_iso_date(data.get('seedStartDate')),
                transplant_date=parse_iso_date(data.get('transplantDate')),
                direct_seed_date=parse_iso_date(data.get('directSeedDate')),
                expected_harvest_date=parse_iso_date(data['expectedHarvestDate']),
                succession_planting=data.get('successionPlanting', False),
                succession_interval=data.get('successionInterval'),
                succession_group_id=data.get('successionGroupId'),
                position_x=data.get('positionX'),
                position_y=data.get('positionY'),
                space_required=data.get('spaceRequired'),
                conflict_override=data.get('conflictOverride', False),
                notes=data.get('notes', '')
            )
            db.session.add(event)
            db.session.commit()
            return jsonify(event.to_dict()), 201
        except KeyError as e:
            db.session.rollback()
            return jsonify({'error': f'Missing required field: {str(e)}'}), 400
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Failed to create planting event: {str(e)}'}), 500

    # GET with optional date-range filtering for timeline view
    query = PlantingEvent.query

    # Filter by date range if provided
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if start_date:
        start_dt = parse_iso_date(start_date)
        # Include events where ANY non-null date falls after start
        query = query.filter(
            db.or_(
                db.and_(PlantingEvent.seed_start_date.isnot(None), PlantingEvent.seed_start_date >= start_dt),
                db.and_(PlantingEvent.transplant_date.isnot(None), PlantingEvent.transplant_date >= start_dt),
                db.and_(PlantingEvent.direct_seed_date.isnot(None), PlantingEvent.direct_seed_date >= start_dt),
                db.and_(PlantingEvent.expected_harvest_date.isnot(None), PlantingEvent.expected_harvest_date >= start_dt)
            )
        )

    if end_date:
        end_dt = parse_iso_date(end_date)
        # Include events where ANY non-null date falls before end
        query = query.filter(
            db.or_(
                db.and_(PlantingEvent.seed_start_date.isnot(None), PlantingEvent.seed_start_date <= end_dt),
                db.and_(PlantingEvent.transplant_date.isnot(None), PlantingEvent.transplant_date <= end_dt),
                db.and_(PlantingEvent.direct_seed_date.isnot(None), PlantingEvent.direct_seed_date <= end_dt),
                db.and_(PlantingEvent.expected_harvest_date.isnot(None), PlantingEvent.expected_harvest_date <= end_dt)
            )
        )

    events = query.all()
    return jsonify([event.to_dict() for event in events])

@app.route('/api/planting-events/<int:event_id>', methods=['PUT', 'DELETE'])
def planting_event(event_id):
    """Update or delete a planting event"""
    event = PlantingEvent.query.get_or_404(event_id)

    if request.method == 'DELETE':
        db.session.delete(event)
        db.session.commit()
        return '', 204

    data = request.json
    event.completed = data.get('completed', event.completed)
    event.notes = data.get('notes', event.notes)
    db.session.commit()
    return jsonify(event.to_dict())

@app.route('/api/planting-events/check-conflict', methods=['POST'])
def check_planting_conflict():
    """Check if planting position conflicts with existing plantings"""
    try:
        data = request.json

        # Validate required fields
        required_fields = ['gardenBedId', 'positionX', 'positionY', 'startDate', 'endDate', 'plantId']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        # Get garden bed
        garden_bed = GardenBed.query.get(data['gardenBedId'])
        if not garden_bed:
            return jsonify({'error': 'Garden bed not found'}), 404

        # Parse dates
        start_date = parse_iso_date(data['startDate'])
        end_date = parse_iso_date(data['endDate'])

        if not start_date or not end_date:
            return jsonify({'error': 'Invalid date format'}), 400

        # Query potentially conflicting events
        # Optimize by filtering in SQL first
        query = PlantingEvent.query.filter(
            PlantingEvent.garden_bed_id == data['gardenBedId'],
            PlantingEvent.position_x.isnot(None),
            PlantingEvent.position_y.isnot(None),
            PlantingEvent.expected_harvest_date >= start_date
        ).filter(
            db.or_(
                PlantingEvent.transplant_date <= end_date,
                PlantingEvent.direct_seed_date <= end_date,
                db.and_(
                    PlantingEvent.transplant_date.is_(None),
                    PlantingEvent.direct_seed_date.is_(None),
                    PlantingEvent.seed_start_date <= end_date
                )
            )
        )

        # Exclude the event being edited if specified
        if 'excludeEventId' in data:
            query = query.filter(PlantingEvent.id != data['excludeEventId'])

        candidate_events = query.all()

        # Create temporary event object for conflict checking
        temp_event = type('TempEvent', (), {
            'position_x': data['positionX'],
            'position_y': data['positionY'],
            'garden_bed_id': data['gardenBedId'],
            'plant_id': data['plantId'],
            'transplant_date': parse_iso_date(data.get('transplantDate')) if data.get('transplantDate') else None,
            'direct_seed_date': parse_iso_date(data.get('directSeedDate')) if data.get('directSeedDate') else None,
            'seed_start_date': parse_iso_date(data.get('seedStartDate')) if data.get('seedStartDate') else None,
            'expected_harvest_date': end_date,
            'id': data.get('excludeEventId')
        })()

        # Check for conflicts
        result = has_conflict(temp_event, candidate_events, garden_bed)

        return jsonify({
            'hasConflict': result['has_conflict'],
            'conflicts': result['conflicts']
        }), 200

    except KeyError as e:
        return jsonify({'error': f'Missing required field: {str(e)}'}), 400
    except Exception as e:
        # Log error in production
        if os.getenv('FLASK_ENV') == 'development':
            import traceback
            traceback.print_exc()
        return jsonify({'error': f'Failed to check conflict: {str(e)}'}), 500

@app.route('/api/frost-dates', methods=['GET', 'POST'])
def frost_dates():
    """Get or update frost dates"""
    if request.method == 'POST':
        data = request.json
        Settings.set_setting('last_frost_date', data['lastFrostDate'])
        Settings.set_setting('first_frost_date', data['firstFrostDate'])
        return jsonify({'success': True})

    return jsonify({
        'lastFrostDate': Settings.get_setting('last_frost_date', '2024-04-15'),
        'firstFrostDate': Settings.get_setting('first_frost_date', '2024-10-15')
    })

# ==================== WINTER GARDEN ROUTES ====================

@app.route('/winter-garden')
def winter_garden():
    """Winter garden planning page"""
    plans = WinterPlan.query.all()
    winter_plants = get_winter_hardy_plants()
    return render_template('winter_garden.html', plans=plans, plants=winter_plants)

@app.route('/api/winter-plans', methods=['GET', 'POST'])
def winter_plans():
    """Get all winter plans or create new one"""
    if request.method == 'POST':
        data = request.json
        plan = WinterPlan(
            garden_bed_id=data['gardenBedId'],
            technique=data['technique'],
            protection_layers=data.get('protectionLayers', 1),
            harvest_window_start=datetime.fromisoformat(data['harvestWindow']['start']),
            harvest_window_end=datetime.fromisoformat(data['harvestWindow']['end']),
            notes=data.get('notes', '')
        )
        plan.set_plant_list(data.get('plantList', []))
        db.session.add(plan)
        db.session.commit()
        return jsonify(plan.to_dict()), 201

    plans = WinterPlan.query.all()
    return jsonify([plan.to_dict() for plan in plans])

@app.route('/api/winter-plans/<int:plan_id>', methods=['DELETE'])
def winter_plan(plan_id):
    """Delete a winter plan"""
    plan = WinterPlan.query.get_or_404(plan_id)
    db.session.delete(plan)
    db.session.commit()
    return '', 204

# ==================== WEATHER ROUTES ====================

@app.route('/weather')
def weather():
    """Weather and alerts page"""
    # Mock weather data for now
    return render_template('weather.html')

# ==================== COMPOST TRACKER ROUTES ====================

@app.route('/compost-tracker')
def compost_tracker():
    """Compost tracker page"""
    piles = CompostPile.query.all()
    return render_template('compost_tracker.html',
                         piles=piles,
                         materials=COMPOST_MATERIALS)

@app.route('/api/compost-piles', methods=['GET', 'POST'])
def compost_piles():
    """Get all compost piles or create new one"""
    if request.method == 'POST':
        data = request.json
        pile = CompostPile(
            name=data['name'],
            location=data['location'],
            width=data['size']['width'],
            length=data['size']['length'],
            height=data['size']['height'],
            estimated_ready_date=datetime.now() + timedelta(days=90)
        )
        db.session.add(pile)
        db.session.commit()
        return jsonify(pile.to_dict()), 201

    piles = CompostPile.query.all()
    return jsonify([pile.to_dict() for pile in piles])

@app.route('/api/compost-piles/<int:pile_id>', methods=['GET', 'PUT', 'DELETE'])
def compost_pile(pile_id):
    """Get, update, or delete a compost pile"""
    pile = CompostPile.query.get_or_404(pile_id)

    if request.method == 'DELETE':
        db.session.delete(pile)
        db.session.commit()
        return '', 204

    if request.method == 'PUT':
        data = request.json
        pile.status = data.get('status', pile.status)
        pile.moisture = data.get('moisture', pile.moisture)
        if data.get('lastTurned'):
            pile.last_turned = datetime.now()
        db.session.commit()

    return jsonify(pile.to_dict())

@app.route('/api/compost-piles/<int:pile_id>/ingredients', methods=['POST'])
def add_compost_ingredient(pile_id):
    """Add ingredient to compost pile"""
    pile = CompostPile.query.get_or_404(pile_id)
    data = request.json

    material = COMPOST_MATERIALS.get(data['material'])
    if not material:
        return jsonify({'error': 'Invalid material'}), 400

    ingredient = CompostIngredient(
        compost_pile_id=pile_id,
        name=data['material'],
        amount=data['amount'],
        type=material['type'],
        cn_ratio=material['cnRatio']
    )
    db.session.add(ingredient)

    # Recalculate C:N ratio
    total_carbon = 0
    total_nitrogen = 0
    for ing in pile.ingredients:
        carbon = (ing.cn_ratio * ing.amount) / 31
        nitrogen = ing.amount / 31
        total_carbon += carbon
        total_nitrogen += nitrogen

    # Add new ingredient
    carbon = (ingredient.cn_ratio * ingredient.amount) / 31
    nitrogen = ingredient.amount / 31
    total_carbon += carbon
    total_nitrogen += nitrogen

    pile.cn_ratio = total_carbon / total_nitrogen if total_nitrogen > 0 else 30

    db.session.commit()
    return jsonify(pile.to_dict())

# ==================== API ROUTES ====================

@app.route('/api/plants')
def get_plants():
    """Get all plants"""
    return jsonify(PLANT_DATABASE)

@app.route('/api/plants/<plant_id>')
def get_plant(plant_id):
    """Get specific plant"""
    plant = get_plant_by_id(plant_id)
    if plant:
        return jsonify(plant)
    return jsonify({'error': 'Plant not found'}), 404

# ==================== PHOTO UPLOAD ROUTES ====================

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/photos')
def photos():
    """Photo gallery page"""
    photos = Photo.query.order_by(Photo.uploaded_at.desc()).all()
    return render_template('photos.html', photos=photos)

@app.route('/api/photos', methods=['GET', 'POST'])
def api_photos():
    """Get all photos or upload new one"""
    if request.method == 'POST':
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            # Add timestamp to filename to avoid conflicts
            name, ext = os.path.splitext(filename)
            filename = f"{name}_{int(datetime.now().timestamp())}{ext}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)

            # Save and optimize image
            img = Image.open(file)
            # Resize if too large
            max_size = (1920, 1920)
            img.thumbnail(max_size, Image.Resampling.LANCZOS)
            img.save(filepath, optimize=True, quality=85)

            photo = Photo(
                filename=filename,
                filepath=f"/static/uploads/{filename}",
                caption=request.form.get('caption', ''),
                category=request.form.get('category', 'garden'),
                garden_bed_id=request.form.get('gardenBedId') or None
            )
            db.session.add(photo)
            db.session.commit()
            return jsonify(photo.to_dict()), 201

        return jsonify({'error': 'Invalid file type'}), 400

    photos = Photo.query.all()
    return jsonify([photo.to_dict() for photo in photos])

@app.route('/api/photos/<int:photo_id>', methods=['PUT', 'DELETE'])
def manage_photo(photo_id):
    """Update or delete a photo"""
    photo = Photo.query.get_or_404(photo_id)

    if request.method == 'DELETE':
        # Delete file from filesystem
        filepath = os.path.join('static/uploads', photo.filename)
        if os.path.exists(filepath):
            os.remove(filepath)
        db.session.delete(photo)
        db.session.commit()
        return '', 204

    # PUT method - update photo metadata
    data = request.json

    if 'caption' in data:
        photo.caption = data['caption']
    if 'category' in data:
        photo.category = data['category']
    if 'gardenBedId' in data:
        photo.garden_bed_id = data['gardenBedId'] if data['gardenBedId'] else None

    db.session.commit()

    return jsonify({
        'id': photo.id,
        'filename': photo.filename,
        'filepath': photo.filepath,
        'caption': photo.caption,
        'category': photo.category,
        'gardenBedId': photo.garden_bed_id,
        'uploadedAt': photo.uploaded_at.isoformat() if photo.uploaded_at else None
    })

# ==================== HARVEST TRACKER ROUTES ====================

@app.route('/harvest-tracker')
def harvest_tracker():
    """Harvest tracker page"""
    records = HarvestRecord.query.order_by(HarvestRecord.harvest_date.desc()).all()
    return render_template('harvest_tracker.html', records=records, plants=PLANT_DATABASE)

@app.route('/api/harvests', methods=['GET', 'POST'])
def api_harvests():
    """Get all harvest records or create new one"""
    if request.method == 'POST':
        data = request.json
        record = HarvestRecord(
            plant_id=data['plantId'],
            planted_item_id=data.get('plantedItemId'),
            harvest_date=datetime.fromisoformat(data.get('harvestDate', datetime.now().isoformat())),
            quantity=data['quantity'],
            unit=data.get('unit', 'lbs'),
            quality=data.get('quality', 'good'),
            notes=data.get('notes', '')
        )
        db.session.add(record)
        db.session.commit()
        return jsonify(record.to_dict()), 201

    records = HarvestRecord.query.all()
    return jsonify([record.to_dict() for record in records])

@app.route('/api/harvests/<int:record_id>', methods=['PUT', 'DELETE'])
def harvest_record(record_id):
    """Update or delete a harvest record"""
    record = HarvestRecord.query.get_or_404(record_id)

    if request.method == 'DELETE':
        db.session.delete(record)
        db.session.commit()
        return '', 204

    # PUT method - update harvest
    data = request.json

    # Update fields if present in request
    if 'plantId' in data:
        record.plant_id = data['plantId']

    if 'harvestDate' in data:
        record.harvest_date = datetime.fromisoformat(data['harvestDate'])

    if 'quantity' in data:
        record.quantity = data['quantity']

    if 'unit' in data:
        record.unit = data['unit']

    if 'quality' in data:
        record.quality = data['quality']

    if 'notes' in data:
        record.notes = data['notes']

    db.session.commit()
    return jsonify({'message': 'Harvest updated successfully', 'id': record.id})

@app.route('/api/harvests/stats')
def harvest_stats():
    """Get harvest statistics"""
    records = HarvestRecord.query.all()
    stats = {}
    for record in records:
        if record.plant_id not in stats:
            stats[record.plant_id] = {'total': 0, 'count': 0, 'unit': record.unit}
        stats[record.plant_id]['total'] += record.quantity
        stats[record.plant_id]['count'] += 1
    return jsonify(stats)

# ==================== SEED INVENTORY ROUTES ====================

@app.route('/seed-inventory')
def seed_inventory():
    """Seed inventory page"""
    seeds = SeedInventory.query.order_by(SeedInventory.variety).all()
    return render_template('seed_inventory.html', seeds=seeds, plants=PLANT_DATABASE)

@app.route('/api/seeds', methods=['GET', 'POST'])
def api_seeds():
    """Get all seed inventory or add new seed"""
    if request.method == 'POST':
        data = request.json
        seed = SeedInventory(
            plant_id=data['plantId'],
            variety=data['variety'],
            brand=data.get('brand', ''),
            quantity=data.get('quantity', 0),
            purchase_date=datetime.fromisoformat(data['purchaseDate']) if data.get('purchaseDate') else None,
            expiration_date=datetime.fromisoformat(data['expirationDate']) if data.get('expirationDate') else None,
            germination_rate=data.get('germinationRate'),
            location=data.get('location', ''),
            price=data.get('price'),
            notes=data.get('notes', ''),
            # Agronomic overrides
            days_to_maturity=data.get('daysToMaturity'),
            germination_days=data.get('germinationDays'),
            plant_spacing=data.get('plantSpacing'),
            row_spacing=data.get('rowSpacing'),
            planting_depth=data.get('plantingDepth'),
            germination_temp_min=data.get('germinationTempMin'),
            germination_temp_max=data.get('germinationTempMax'),
            soil_temp_min=data.get('soilTempMin'),
            heat_tolerance=data.get('heatTolerance'),
            cold_tolerance=data.get('coldTolerance'),
            bolt_resistance=data.get('boltResistance'),
            ideal_seasons=data.get('idealSeasons'),
            flavor_profile=data.get('flavorProfile'),
            storage_rating=data.get('storageRating')
        )
        try:
            db.session.add(seed)
            db.session.commit()
            return jsonify(seed.to_dict()), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': 'Failed to create seed'}), 500

    seeds = SeedInventory.query.all()
    return jsonify([seed.to_dict() for seed in seeds])

@app.route('/api/seeds/varieties/<plant_id>', methods=['GET'])
def get_varieties_by_plant(plant_id):
    """Get all varieties for a specific plant from seed inventory

    Returns:
        200: List of variety names (may be empty if no varieties exist)
        500: Database error
    """
    try:
        seeds = SeedInventory.query.filter_by(plant_id=plant_id).all()
        # Return just variety names (unique, sorted, non-empty)
        varieties = list(set([seed.variety for seed in seeds if seed.variety]))
        return jsonify(sorted(varieties))
    except Exception as e:
        logging.error(f"Failed to fetch varieties for {plant_id}: {str(e)}")
        return jsonify({'error': 'Failed to fetch varieties'}), 500

@app.route('/api/seeds/<int:seed_id>', methods=['PUT', 'DELETE'])
def seed_item(seed_id):
    """Update or delete seed inventory"""
    seed = SeedInventory.query.get_or_404(seed_id)

    if request.method == 'DELETE':
        # Protect global varieties from deletion
        if seed.is_global:
            return jsonify({'error': 'Cannot delete global catalog varieties'}), 403
        db.session.delete(seed)
        db.session.commit()
        return '', 204

    # PUT request - update seed
    # Protect global varieties from editing
    if seed.is_global:
        return jsonify({'error': 'Cannot edit global catalog varieties'}), 403

    data = request.json
    seed.quantity = data.get('quantity', seed.quantity)
    seed.germination_rate = data.get('germinationRate', seed.germination_rate)
    seed.notes = data.get('notes', seed.notes)

    # Update agronomic overrides using field mapping
    field_mapping = {
        'daysToMaturity': 'days_to_maturity',
        'germinationDays': 'germination_days',
        'plantSpacing': 'plant_spacing',
        'rowSpacing': 'row_spacing',
        'plantingDepth': 'planting_depth',
        'germinationTempMin': 'germination_temp_min',
        'germinationTempMax': 'germination_temp_max',
        'soilTempMin': 'soil_temp_min',
        'heatTolerance': 'heat_tolerance',
        'coldTolerance': 'cold_tolerance',
        'boltResistance': 'bolt_resistance',
        'idealSeasons': 'ideal_seasons',
        'flavorProfile': 'flavor_profile',
        'storageRating': 'storage_rating'
    }

    for frontend_field, backend_field in field_mapping.items():
        if frontend_field in data:
            setattr(seed, backend_field, data.get(frontend_field))

    try:
        db.session.commit()
        return jsonify(seed.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update seed'}), 500

@app.route('/api/varieties/import', methods=['POST'])
def import_varieties():
    """Import plant varieties from CSV file"""
    try:
        # Validate request has file
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Get crop type parameter
        crop_type = request.form.get('cropType', 'lettuce').lower()

        # Get is_global parameter (defaults to False for backward compatibility)
        is_global = request.form.get('isGlobal', 'false').lower() == 'true'

        # Read file content
        file_content = file.read().decode('utf-8')

        # Validate CSV format first
        is_valid, validation_errors = validate_csv_format(file_content)
        if not is_valid:
            return jsonify({
                'error': 'Invalid CSV format',
                'details': validation_errors
            }), 400

        # Parse CSV
        varieties, parse_errors = parse_variety_csv(file_content, crop_type)

        if parse_errors and not varieties:
            # If there are only errors and no successful parses
            return jsonify({
                'error': 'CSV parsing failed',
                'details': parse_errors
            }), 400

        # Import varieties to database
        imported_count, import_errors = import_varieties_to_database(db, varieties, is_global)

        # Build response
        response = {
            'success': True,
            'imported': imported_count,
            'total_rows': len(varieties),
            'crop_type': crop_type,
            'preview': [
                {
                    'variety': v['variety'],
                    'plant_id': v['plant_id'],
                    'days_to_maturity': v['days_to_maturity']
                }
                for v in varieties[:5]  # Show first 5 as preview
            ]
        }

        # Add any errors or warnings to response
        all_errors = parse_errors + import_errors
        if all_errors:
            response['warnings'] = all_errors

        return jsonify(response), 200

    except Exception as e:
        return jsonify({
            'error': 'Import failed',
            'details': str(e)
        }), 500

# ==================== PDF EXPORT ROUTE ====================

@app.route('/api/export-garden-plan/<int:bed_id>')
def export_garden_plan(bed_id):
    """Export garden plan as PDF"""
    bed = GardenBed.query.get_or_404(bed_id)

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

# ==================== PROPERTY DESIGNER ROUTES ====================

@app.route('/property-designer')
def property_designer():
    """Property designer page - master homestead layout"""
    properties = Property.query.all()
    return render_template('property_designer.html',
                         properties=properties,
                         structures=STRUCTURES_DATABASE,
                         categories=STRUCTURE_CATEGORIES)

@app.route('/api/properties', methods=['GET', 'POST'])
def properties():
    """Get all properties or create new one"""
    if request.method == 'POST':
        data = request.json
        prop = Property(
            name=data['name'],
            width=data['width'],
            length=data['length'],
            address=data.get('address', ''),
            latitude=data.get('latitude'),
            longitude=data.get('longitude'),
            zone=data.get('zone', ''),
            soil_type=data.get('soilType', ''),
            slope=data.get('slope', 'flat'),
            notes=data.get('notes', '')
        )
        db.session.add(prop)
        db.session.commit()
        return jsonify(prop.to_dict()), 201

    props = Property.query.all()
    return jsonify([p.to_dict() for p in props])

@app.route('/api/properties/<int:property_id>', methods=['GET', 'PUT', 'DELETE'])
def property_detail(property_id):
    """Get, update, or delete a specific property"""
    prop = Property.query.get_or_404(property_id)

    if request.method == 'DELETE':
        db.session.delete(prop)
        db.session.commit()
        return '', 204

    if request.method == 'PUT':
        data = request.json
        prop.name = data.get('name', prop.name)
        prop.width = data.get('width', prop.width)
        prop.length = data.get('length', prop.length)
        prop.address = data.get('address', prop.address)
        prop.latitude = data.get('latitude', prop.latitude)
        prop.longitude = data.get('longitude', prop.longitude)
        prop.zone = data.get('zone', prop.zone)
        prop.soil_type = data.get('soilType', prop.soil_type)
        prop.slope = data.get('slope', prop.slope)
        prop.notes = data.get('notes', prop.notes)
        db.session.commit()

    return jsonify(prop.to_dict())

@app.route('/api/properties/validate-address', methods=['POST'])
def validate_property_address():
    """Validate an address and return geocoded data + hardiness zone"""
    try:
        data = request.json
        address = data.get('address')

        if not address:
            return jsonify({'error': 'Address is required'}), 400

        # Validate address via geocoding API
        result = geocoding_service.validate_address(address)

        if not result:
            return jsonify({
                'valid': False,
                'error': 'Address not found or geocoding service unavailable. Please check the address and try again.'
            }), 404

        # Get hardiness zone from coordinates
        zone = geocoding_service.get_hardiness_zone(
            result['latitude'],
            result['longitude']
        )

        return jsonify({
            'valid': True,
            'latitude': result['latitude'],
            'longitude': result['longitude'],
            'formatted_address': result['formatted_address'],
            'zone': zone,
            'accuracy': result.get('accuracy'),
            'accuracy_type': result.get('accuracy_type'),
            'confidence': result.get('confidence')
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/placed-structures', methods=['POST'])
def add_placed_structure():
    """Place a structure on the property"""
    try:
        data = request.json
        position = data.get('position', {})

        # Prepare structure data for validation
        new_structure = {
            'structure_id': data['structureId'],
            'position_x': position.get('x', 0),
            'position_y': position.get('y', 0),
        }

        # Get existing structures on this property
        property_id = data['propertyId']
        property_obj = Property.query.get_or_404(property_id)
        existing_structures = PlacedStructure.query.filter_by(property_id=property_id).all()
        existing_structures_data = [
            {
                'id': s.id,
                'structure_id': s.structure_id,
                'name': s.name,
                'position_x': s.position_x,
                'position_y': s.position_y
            }
            for s in existing_structures
        ]

        # Create structures database lookup dict
        structures_db = {s['id']: s for s in STRUCTURES_DATABASE}

        # Validate placement (including property boundaries)
        validation_result = validate_structure_placement(
            new_structure,
            existing_structures_data,
            structures_db,
            property_obj.width,
            property_obj.length
        )

        if not validation_result['valid']:
            # Return conflicts as error
            conflicts = validation_result['conflicts']
            error_messages = [c['message'] for c in conflicts]
            return jsonify({
                'error': 'Cannot place structure: ' + '; '.join(error_messages),
                'conflicts': conflicts
            }), 400

        # Create and save structure
        structure = PlacedStructure(
            property_id=property_id,
            structure_id=data['structureId'],
            name=data.get('name', ''),
            position_x=position.get('x', 0),
            position_y=position.get('y', 0),
            rotation=data.get('rotation', 0),
            notes=data.get('notes', ''),
            built_date=parse_iso_date(data.get('builtDate')),
            cost=data.get('cost')
        )
        db.session.add(structure)
        db.session.commit()

        # Return with warnings if any
        response_data = structure.to_dict()
        if validation_result['warnings']:
            response_data['warnings'] = validation_result['warnings']

        return jsonify(response_data), 201
    except KeyError as e:
        db.session.rollback()
        return jsonify({'error': f'Missing required field: {str(e)}'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/placed-structures/<int:structure_id>', methods=['PUT', 'DELETE'])
def placed_structure(structure_id):
    """Update or delete a placed structure"""
    structure = PlacedStructure.query.get_or_404(structure_id)

    if request.method == 'DELETE':
        db.session.delete(structure)
        db.session.commit()
        return '', 204

    if request.method == 'PUT':
        data = request.json
        position = data.get('position', {})
        new_x = position.get('x', structure.position_x)
        new_y = position.get('y', structure.position_y)

        # If position is changing, validate new position
        if new_x != structure.position_x or new_y != structure.position_y:
            # Prepare structure data for validation (including its own ID)
            updated_structure = {
                'id': structure.id,
                'structure_id': structure.structure_id,
                'position_x': new_x,
                'position_y': new_y,
            }

            # Get all structures on this property
            property_obj = Property.query.get_or_404(structure.property_id)
            existing_structures = PlacedStructure.query.filter_by(property_id=structure.property_id).all()
            existing_structures_data = [
                {
                    'id': s.id,
                    'structure_id': s.structure_id,
                    'name': s.name,
                    'position_x': s.position_x,
                    'position_y': s.position_y
                }
                for s in existing_structures
            ]

            # Create structures database lookup dict
            structures_db = {s['id']: s for s in STRUCTURES_DATABASE}

            # Validate placement (including property boundaries)
            validation_result = validate_structure_placement(
                updated_structure,
                existing_structures_data,
                structures_db,
                property_obj.width,
                property_obj.length
            )

            if not validation_result['valid']:
                # Return conflicts as error
                conflicts = validation_result['conflicts']
                error_messages = [c['message'] for c in conflicts]
                return jsonify({
                    'error': 'Cannot move structure: ' + '; '.join(error_messages),
                    'conflicts': conflicts
                }), 400

        # Update structure
        structure.name = data.get('name', structure.name)
        structure.position_x = new_x
        structure.position_y = new_y
        structure.rotation = data.get('rotation', structure.rotation)
        structure.notes = data.get('notes', structure.notes)
        structure.cost = data.get('cost', structure.cost)
        db.session.commit()

    return jsonify(structure.to_dict())

@app.route('/api/structures')
def get_structures():
    """Get all available structure types"""
    return jsonify({
        'structures': STRUCTURES_DATABASE,
        'categories': STRUCTURE_CATEGORIES
    })



# ==================== LIVESTOCK TRACKING ROUTES ====================

@app.route('/livestock')
def livestock():
    """Livestock management page"""
    chickens = Chicken.query.all()
    beehives = Beehive.query.all()
    livestock = Livestock.query.all()
    return render_template('livestock.html',
                         chickens=chickens,
                         beehives=beehives,
                         livestock=livestock)

# Chicken routes
@app.route('/api/chickens', methods=['GET', 'POST'])
def chickens_api():
    """Get all chickens or create new flock"""
    if request.method == 'POST':
        data = request.json
        hatch_date = None
        if data.get('hatchDate'):
            hatch_date = datetime.fromisoformat(data['hatchDate'].replace('Z', '+00:00'))

        chicken = Chicken(
            name=data['name'],
            breed=data.get('breed'),
            quantity=data.get('quantity', 1),
            hatch_date=hatch_date,
            purpose=data.get('purpose'),
            sex=data.get('sex'),
            coop_location=data.get('coopLocation'),
            notes=data.get('notes')
        )
        db.session.add(chicken)
        db.session.commit()
        return jsonify(chicken.to_dict()), 201

    chickens = Chicken.query.filter_by(status='active').all()
    return jsonify([c.to_dict() for c in chickens])

@app.route('/api/chickens/<int:chicken_id>', methods=['GET', 'PUT', 'DELETE'])
def chicken_detail(chicken_id):
    """Get, update, or delete a specific chicken/flock"""
    chicken = Chicken.query.get_or_404(chicken_id)

    if request.method == 'DELETE':
        db.session.delete(chicken)
        db.session.commit()
        return '', 204

    if request.method == 'PUT':
        data = request.json
        chicken.name = data.get('name', chicken.name)
        chicken.breed = data.get('breed', chicken.breed)
        chicken.quantity = data.get('quantity', chicken.quantity)
        chicken.purpose = data.get('purpose', chicken.purpose)
        chicken.sex = data.get('sex', chicken.sex)
        chicken.status = data.get('status', chicken.status)
        chicken.coop_location = data.get('coopLocation', chicken.coop_location)
        chicken.notes = data.get('notes', chicken.notes)
        db.session.commit()

    return jsonify(chicken.to_dict())

# Egg production routes
@app.route('/api/egg-production', methods=['GET', 'POST'])
def egg_production():
    """Get all egg records or add new record"""
    if request.method == 'POST':
        data = request.json
        record = EggProduction(
            chicken_id=data['chickenId'],
            eggs_collected=data['eggsCollected'],
            eggs_sold=data.get('eggsSold', 0),
            eggs_eaten=data.get('eggsEaten', 0),
            eggs_incubated=data.get('eggsIncubated', 0),
            notes=data.get('notes')
        )
        db.session.add(record)
        db.session.commit()
        return jsonify(record.to_dict()), 201

    # Get recent records (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    records = EggProduction.query.filter(EggProduction.date >= thirty_days_ago).order_by(EggProduction.date.desc()).all()
    return jsonify([r.to_dict() for r in records])

# Duck routes
@app.route('/api/ducks', methods=['GET', 'POST'])
def ducks_api():
    """Get all ducks/waterfowl or create new flock"""
    if request.method == 'POST':
        data = request.json
        hatch_date = None
        if data.get('hatchDate'):
            hatch_date = datetime.fromisoformat(data['hatchDate'].replace('Z', '+00:00'))

        duck = Duck(
            name=data['name'],
            breed=data.get('breed'),
            quantity=data.get('quantity', 1),
            hatch_date=hatch_date,
            purpose=data.get('purpose'),
            sex=data.get('sex'),
            coop_location=data.get('coopLocation'),
            notes=data.get('notes')
        )
        db.session.add(duck)
        db.session.commit()
        return jsonify(duck.to_dict()), 201

    ducks = Duck.query.filter_by(status='active').all()
    return jsonify([d.to_dict() for d in ducks])

@app.route('/api/ducks/<int:duck_id>', methods=['GET', 'PUT', 'DELETE'])
def duck_detail(duck_id):
    """Get, update, or delete a specific duck flock"""
    duck = Duck.query.get_or_404(duck_id)

    if request.method == 'DELETE':
        db.session.delete(duck)
        db.session.commit()
        return '', 204

    if request.method == 'PUT':
        data = request.json
        duck.name = data.get('name', duck.name)
        duck.breed = data.get('breed', duck.breed)
        duck.quantity = data.get('quantity', duck.quantity)
        duck.purpose = data.get('purpose', duck.purpose)
        duck.sex = data.get('sex', duck.sex)
        duck.status = data.get('status', duck.status)
        duck.coop_location = data.get('coopLocation', duck.coop_location)
        duck.notes = data.get('notes', duck.notes)
        db.session.commit()

    return jsonify(duck.to_dict())

# Duck egg production routes
@app.route('/api/duck-egg-production', methods=['GET', 'POST'])
def duck_egg_production():
    """Get all duck egg records or add new record"""
    if request.method == 'POST':
        data = request.json
        record = DuckEggProduction(
            chicken_id=data['chickenId'],  # Using same field name for frontend compatibility
            eggs_collected=data['eggsCollected'],
            eggs_sold=data.get('eggsSold', 0),
            eggs_eaten=data.get('eggsEaten', 0),
            eggs_incubated=data.get('eggsIncubated', 0),
            notes=data.get('notes')
        )
        db.session.add(record)
        db.session.commit()
        return jsonify(record.to_dict()), 201

    # Get recent records (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    records = DuckEggProduction.query.filter(DuckEggProduction.date >= thirty_days_ago).order_by(DuckEggProduction.date.desc()).all()
    return jsonify([r.to_dict() for r in records])

# Beehive routes
@app.route('/api/beehives', methods=['GET', 'POST'])
def beehives_api():
    """Get all beehives or create new hive"""
    if request.method == 'POST':
        data = request.json
        install_date = None
        if data.get('installDate'):
            install_date = datetime.fromisoformat(data['installDate'].replace('Z', '+00:00'))

        hive = Beehive(
            name=data['name'],
            type=data.get('type'),
            install_date=install_date,
            queen_marked=data.get('queenMarked', False),
            queen_color=data.get('queenColor'),
            location=data.get('location'),
            notes=data.get('notes')
        )
        db.session.add(hive)
        db.session.commit()
        return jsonify(hive.to_dict()), 201

    hives = Beehive.query.filter_by(status='active').all()
    return jsonify([h.to_dict() for h in hives])

@app.route('/api/beehives/<int:hive_id>', methods=['GET', 'PUT', 'DELETE'])
def beehive_detail(hive_id):
    """Get, update, or delete a specific beehive"""
    hive = Beehive.query.get_or_404(hive_id)

    if request.method == 'DELETE':
        db.session.delete(hive)
        db.session.commit()
        return '', 204

    if request.method == 'PUT':
        data = request.json
        hive.name = data.get('name', hive.name)
        hive.type = data.get('type', hive.type)
        hive.queen_marked = data.get('queenMarked', hive.queen_marked)
        hive.queen_color = data.get('queenColor', hive.queen_color)
        hive.status = data.get('status', hive.status)
        hive.location = data.get('location', hive.location)
        hive.notes = data.get('notes', hive.notes)
        db.session.commit()

    return jsonify(hive.to_dict())

# Hive inspection routes
@app.route('/api/hive-inspections', methods=['GET', 'POST'])
def hive_inspections():
    """Get all inspections or add new inspection"""
    if request.method == 'POST':
        data = request.json
        inspection = HiveInspection(
            beehive_id=data['beehiveId'],
            queen_seen=data.get('queenSeen'),
            eggs_seen=data.get('eggsSeen'),
            brood_pattern=data.get('broodPattern'),
            temperament=data.get('temperament'),
            population=data.get('population'),
            honey_stores=data.get('honeyStores'),
            pests_diseases=data.get('pestsDiseases'),
            actions_taken=data.get('actionsTaken'),
            notes=data.get('notes')
        )
        db.session.add(inspection)
        db.session.commit()
        return jsonify(inspection.to_dict()), 201

    # Get recent inspections (last 60 days)
    sixty_days_ago = datetime.utcnow() - timedelta(days=60)
    inspections = HiveInspection.query.filter(HiveInspection.date >= sixty_days_ago).order_by(HiveInspection.date.desc()).all()
    return jsonify([i.to_dict() for i in inspections])

# Honey harvest routes
@app.route('/api/honey-harvests', methods=['GET', 'POST'])
def honey_harvests():
    """Get all honey harvests or add new harvest"""
    if request.method == 'POST':
        data = request.json
        harvest = HoneyHarvest(
            beehive_id=data['beehiveId'],
            frames_harvested=data.get('framesHarvested'),
            honey_weight=data.get('honeyWeight'),
            wax_weight=data.get('waxWeight'),
            notes=data.get('notes')
        )
        db.session.add(harvest)
        db.session.commit()
        return jsonify(harvest.to_dict()), 201

    harvests = HoneyHarvest.query.order_by(HoneyHarvest.date.desc()).all()
    return jsonify([h.to_dict() for h in harvests])

# General livestock routes
@app.route('/api/livestock', methods=['GET', 'POST'])
def livestock_api():
    """Get all livestock or create new animal"""
    if request.method == 'POST':
        data = request.json
        birth_date = None
        if data.get('birthDate'):
            birth_date = datetime.fromisoformat(data['birthDate'].replace('Z', '+00:00'))

        animal = Livestock(
            name=data.get('name'),
            species=data['species'],
            breed=data.get('breed'),
            tag_number=data.get('tagNumber'),
            birth_date=birth_date,
            sex=data.get('sex'),
            purpose=data.get('purpose'),
            sire=data.get('sire'),
            dam=data.get('dam'),
            location=data.get('location'),
            weight=data.get('weight'),
            notes=data.get('notes')
        )
        db.session.add(animal)
        db.session.commit()
        return jsonify(animal.to_dict()), 201

    animals = Livestock.query.filter_by(status='active').all()
    return jsonify([a.to_dict() for a in animals])

@app.route('/api/livestock/<int:animal_id>', methods=['GET', 'PUT', 'DELETE'])
def livestock_detail(animal_id):
    """Get, update, or delete a specific livestock animal"""
    animal = Livestock.query.get_or_404(animal_id)

    if request.method == 'DELETE':
        db.session.delete(animal)
        db.session.commit()
        return '', 204

    if request.method == 'PUT':
        data = request.json
        animal.name = data.get('name', animal.name)
        animal.species = data.get('species', animal.species)
        animal.breed = data.get('breed', animal.breed)
        animal.tag_number = data.get('tagNumber', animal.tag_number)
        animal.sex = data.get('sex', animal.sex)
        animal.purpose = data.get('purpose', animal.purpose)
        animal.status = data.get('status', animal.status)
        animal.location = data.get('location', animal.location)
        animal.weight = data.get('weight', animal.weight)
        animal.notes = data.get('notes', animal.notes)
        db.session.commit()

    return jsonify(animal.to_dict())

# Health record routes
@app.route('/api/health-records', methods=['GET', 'POST'])
def health_records():
    """Get all health records or add new record"""
    if request.method == 'POST':
        data = request.json
        next_due = None
        if data.get('nextDueDate'):
            next_due = datetime.fromisoformat(data['nextDueDate'].replace('Z', '+00:00'))

        record = HealthRecord(
            livestock_id=data['livestockId'],
            type=data['type'],
            treatment=data.get('treatment'),
            medication=data.get('medication'),
            dosage=data.get('dosage'),
            veterinarian=data.get('veterinarian'),
            cost=data.get('cost'),
            next_due_date=next_due,
            notes=data.get('notes')
        )
        db.session.add(record)
        db.session.commit()
        return jsonify(record.to_dict()), 201

    records = HealthRecord.query.order_by(HealthRecord.date.desc()).limit(50).all()
    return jsonify([r.to_dict() for r in records])

# ==================== SOIL TEMPERATURE ROUTES ====================

@app.route('/api/soil-temperature', methods=['GET'])
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
        - soil_type (required): 'sandy', 'loamy', or 'clay'
        - sun_exposure (required): 'full-sun', 'partial-shade', or 'full-shade'
        - has_mulch (required): 'true' or 'false'
        - latitude (optional): Location latitude (defaults to NYC: 40.7128)
        - longitude (optional): Location longitude (defaults to NYC: -74.0060)

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
        # Get query parameters
        soil_type = request.args.get('soil_type')
        sun_exposure = request.args.get('sun_exposure')
        has_mulch_str = request.args.get('has_mulch', 'false')

        # Validate required parameters
        if not soil_type:
            return jsonify({'error': 'soil_type parameter is required'}), 400
        if not sun_exposure:
            return jsonify({'error': 'sun_exposure parameter is required'}), 400

        # Convert has_mulch to boolean
        has_mulch = has_mulch_str.lower() == 'true'

        # Get location parameters (default to NYC if not provided)
        latitude = request.args.get('latitude', DEFAULT_LATITUDE)
        longitude = request.args.get('longitude', DEFAULT_LONGITUDE)

        # Convert to floats
        lat = float(latitude)
        lon = float(longitude)

        # Get soil temperature using intelligent multi-tier approach
        # This tries Open-Meteo first, then falls back to WeatherAPI, then mock
        result = get_soil_temperature_with_adjustments(lat, lon, soil_type, sun_exposure, has_mulch)

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


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5000)
