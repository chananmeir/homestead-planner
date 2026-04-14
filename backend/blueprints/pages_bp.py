"""
Pages Blueprint

Routes for HTML page rendering (server-side templates).
"""
from flask import Blueprint, render_template
from flask_login import current_user
from models import GardenBed, PlantingEvent, Settings, CompostPile, Photo, HarvestRecord, SeedInventory, Property, Chicken, Beehive, Livestock
from plant_database import PLANT_DATABASE, COMPOST_MATERIALS
from structures_database import STRUCTURES_DATABASE, STRUCTURE_CATEGORIES
from frost_date_lookup import get_frost_dates_for_user

pages_bp = Blueprint('pages', __name__)


@pages_bp.route('/')
def index():
    """Main dashboard"""
    return render_template('index.html')


@pages_bp.route('/garden-planner')
def garden_planner():
    """Garden planner page"""
    beds = GardenBed.query.all()
    return render_template('garden_planner.html', beds=beds, plants=PLANT_DATABASE)


@pages_bp.route('/visual-designer')
def visual_designer():
    """Visual garden designer page"""
    beds = GardenBed.query.all()
    return render_template('visual_designer.html', beds=beds, plants=PLANT_DATABASE)


@pages_bp.route('/planting-calendar')
def planting_calendar():
    """Planting calendar page"""
    events = PlantingEvent.query.order_by(PlantingEvent.seed_start_date).all()
    # Get frost dates from property/zone lookup if user is logged in, else use default
    if current_user and current_user.is_authenticated:
        frost = get_frost_dates_for_user(current_user.id)
        last_frost = frost['last_frost'].isoformat()
        first_frost = frost['first_frost'].isoformat()
    else:
        last_frost = '2024-04-15'
        first_frost = '2024-10-15'
    return render_template('planting_calendar.html',
                         events=events,
                         plants=PLANT_DATABASE,
                         last_frost_date=last_frost,
                         first_frost_date=first_frost)


@pages_bp.route('/weather')
def weather():
    """Weather and alerts page"""
    # Mock weather data for now
    return render_template('weather.html')


@pages_bp.route('/compost-tracker')
def compost_tracker():
    """Compost tracker page"""
    piles = CompostPile.query.all()
    return render_template('compost_tracker.html',
                         piles=piles,
                         materials=COMPOST_MATERIALS)


@pages_bp.route('/photos')
def photos():
    """Photo gallery page"""
    photos = Photo.query.order_by(Photo.uploaded_at.desc()).all()
    return render_template('photos.html', photos=photos)


@pages_bp.route('/harvest-tracker')
def harvest_tracker():
    """Harvest tracker page"""
    records = HarvestRecord.query.order_by(HarvestRecord.harvest_date.desc()).all()
    return render_template('harvest_tracker.html', records=records, plants=PLANT_DATABASE)


@pages_bp.route('/seed-inventory')
def seed_inventory():
    """Seed inventory page"""
    seeds = SeedInventory.query.order_by(SeedInventory.variety).all()
    return render_template('seed_inventory.html', seeds=seeds, plants=PLANT_DATABASE)


@pages_bp.route('/property-designer')
def property_designer():
    """Property designer page - master homestead layout"""
    properties = Property.query.all()
    return render_template('property_designer.html',
                         properties=properties,
                         structures=STRUCTURES_DATABASE,
                         categories=STRUCTURE_CATEGORIES)


@pages_bp.route('/livestock')
def livestock():
    """Livestock management page"""
    chickens = Chicken.query.all()
    beehives = Beehive.query.all()
    livestock = Livestock.query.all()
    return render_template('livestock.html',
                         chickens=chickens,
                         beehives=beehives,
                         livestock=livestock)
