from flask import Flask, render_template, request, jsonify, redirect, url_for, send_file
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from models import db, GardenBed, PlantedItem, PlantingEvent, WinterPlan, CompostPile, CompostIngredient, Settings, Photo, HarvestRecord, SeedInventory, Property, PlacedStructure, Chicken, EggProduction, Duck, DuckEggProduction, Beehive, HiveInspection, HoneyHarvest, Livestock, HealthRecord
from plant_database import PLANT_DATABASE, COMPOST_MATERIALS, get_plant_by_id, get_winter_hardy_plants
from structures_database import STRUCTURES_DATABASE, STRUCTURE_CATEGORIES, get_structure_by_id
from garden_methods import GARDEN_METHODS, BED_TEMPLATES, PLANT_GUILDS, get_sfg_quantity, get_row_spacing, get_intensive_spacing, calculate_plants_per_bed, get_methods_list, get_template_by_id, get_guild_by_id
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from werkzeug.utils import secure_filename
from PIL import Image
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
import os
import io

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
        planning_method = data.get('planningMethod', 'square-foot')

        # Get grid size based on method
        grid_size = GARDEN_METHODS.get(planning_method, {}).get('gridSize', 12)

        bed = GardenBed(
            name=data['name'],
            width=data['width'],
            length=data['length'],
            location=data.get('location', ''),
            sun_exposure=data.get('sunExposure', 'full'),
            planning_method=planning_method,
            grid_size=grid_size
        )
        db.session.add(bed)
        db.session.commit()
        return jsonify(bed.to_dict()), 201

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
    data = request.json
    position = data.get('position', {})
    item = PlantedItem(
        plant_id=data['plantId'],
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
        data = request.json
        event = PlantingEvent(
            plant_id=data['plantId'],
            garden_bed_id=data.get('gardenBedId'),
            seed_start_date=parse_iso_date(data.get('seedStartDate')),
            transplant_date=parse_iso_date(data.get('transplantDate')),
            direct_seed_date=parse_iso_date(data.get('directSeedDate')),
            expected_harvest_date=parse_iso_date(data['expectedHarvestDate']),
            succession_planting=data.get('successionPlanting', False),
            succession_interval=data.get('successionInterval'),
            notes=data.get('notes', '')
        )
        db.session.add(event)
        db.session.commit()
        return jsonify(event.to_dict()), 201

    events = PlantingEvent.query.all()
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

@app.route('/api/photos/<int:photo_id>', methods=['DELETE'])
def delete_photo(photo_id):
    """Delete a photo"""
    photo = Photo.query.get_or_404(photo_id)
    # Delete file from filesystem
    filepath = os.path.join('static/uploads', photo.filename)
    if os.path.exists(filepath):
        os.remove(filepath)
    db.session.delete(photo)
    db.session.commit()
    return '', 204

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

@app.route('/api/harvests/<int:record_id>', methods=['DELETE'])
def delete_harvest(record_id):
    """Delete a harvest record"""
    record = HarvestRecord.query.get_or_404(record_id)
    db.session.delete(record)
    db.session.commit()
    return '', 204

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
            notes=data.get('notes', '')
        )
        db.session.add(seed)
        db.session.commit()
        return jsonify(seed.to_dict()), 201

    seeds = SeedInventory.query.all()
    return jsonify([seed.to_dict() for seed in seeds])

@app.route('/api/seeds/<int:seed_id>', methods=['PUT', 'DELETE'])
def seed_item(seed_id):
    """Update or delete seed inventory"""
    seed = SeedInventory.query.get_or_404(seed_id)

    if request.method == 'DELETE':
        db.session.delete(seed)
        db.session.commit()
        return '', 204

    data = request.json
    seed.quantity = data.get('quantity', seed.quantity)
    seed.germination_rate = data.get('germinationRate', seed.germination_rate)
    seed.notes = data.get('notes', seed.notes)
    db.session.commit()
    return jsonify(seed.to_dict())

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
        prop.zone = data.get('zone', prop.zone)
        prop.soil_type = data.get('soilType', prop.soil_type)
        prop.slope = data.get('slope', prop.slope)
        prop.notes = data.get('notes', prop.notes)
        db.session.commit()

    return jsonify(prop.to_dict())

@app.route('/api/placed-structures', methods=['POST'])
def add_placed_structure():
    """Place a structure on the property"""
    data = request.json
    position = data.get('position', {})

    structure = PlacedStructure(
        property_id=data['propertyId'],
        structure_id=data['structureId'],
        name=data.get('name', ''),
        position_x=position.get('x', 0),
        position_y=position.get('y', 0),
        rotation=data.get('rotation', 0),
        notes=data.get('notes', ''),
        cost=data.get('cost')
    )
    db.session.add(structure)
    db.session.commit()
    return jsonify(structure.to_dict()), 201

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
        structure.name = data.get('name', structure.name)
        position = data.get('position', {})
        structure.position_x = position.get('x', structure.position_x)
        structure.position_y = position.get('y', structure.position_y)
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


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5000)
