"""
Pages Blueprint

Routes for HTML page rendering (server-side templates).

These are the legacy pre-React server-rendered pages, reachable by direct
navigation to the backend port. All data-bearing routes require login and
only expose the current user's records (Jun 2026 security fix — they
previously dumped every user's data with unauthenticated .all() queries).
"""
from flask import Blueprint, render_template
from flask_login import login_required, current_user
from models import GardenBed, PlantingEvent, CompostPile, Photo, HarvestRecord, SeedInventory, Property, Chicken, Beehive, Livestock
from plant_database import PLANT_DATABASE, COMPOST_MATERIALS
from structures_database import STRUCTURES_DATABASE, STRUCTURE_CATEGORIES
from frost_date_lookup import get_frost_dates_for_user

pages_bp = Blueprint('pages', __name__)


@pages_bp.route('/')
def index():
    """Main dashboard"""
    return render_template('index.html')


@pages_bp.route('/garden-planner')
@login_required
def garden_planner():
    """Garden planner page"""
    beds = GardenBed.query.filter_by(user_id=current_user.id).all()
    return render_template('garden_planner.html', beds=beds, plants=PLANT_DATABASE)


@pages_bp.route('/visual-designer')
@login_required
def visual_designer():
    """Visual garden designer page"""
    beds = GardenBed.query.filter_by(user_id=current_user.id).all()
    return render_template('visual_designer.html', beds=beds, plants=PLANT_DATABASE)


@pages_bp.route('/planting-calendar')
@login_required
def planting_calendar():
    """Planting calendar page"""
    events = (PlantingEvent.query
              .filter_by(user_id=current_user.id)
              .order_by(PlantingEvent.seed_start_date)
              .all())
    frost = get_frost_dates_for_user(current_user.id)
    last_frost = frost['last_frost'].isoformat()
    first_frost = frost['first_frost'].isoformat()
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
@login_required
def compost_tracker():
    """Compost tracker page"""
    piles = CompostPile.query.filter_by(user_id=current_user.id).all()
    return render_template('compost_tracker.html',
                         piles=piles,
                         materials=COMPOST_MATERIALS)


@pages_bp.route('/photos')
@login_required
def photos():
    """Photo gallery page"""
    photos = (Photo.query
              .filter_by(user_id=current_user.id)
              .order_by(Photo.uploaded_at.desc())
              .all())
    return render_template('photos.html', photos=photos)


@pages_bp.route('/harvest-tracker')
@login_required
def harvest_tracker():
    """Harvest tracker page"""
    records = (HarvestRecord.query
               .filter_by(user_id=current_user.id)
               .order_by(HarvestRecord.harvest_date.desc())
               .all())
    return render_template('harvest_tracker.html', records=records, plants=PLANT_DATABASE)


@pages_bp.route('/seed-inventory')
@login_required
def seed_inventory():
    """Seed inventory page"""
    seeds = (SeedInventory.query
             .filter_by(user_id=current_user.id)
             .order_by(SeedInventory.variety)
             .all())
    return render_template('seed_inventory.html', seeds=seeds, plants=PLANT_DATABASE)


@pages_bp.route('/property-designer')
@login_required
def property_designer():
    """Property designer page - master homestead layout"""
    properties = Property.query.filter_by(user_id=current_user.id).all()
    return render_template('property_designer.html',
                         properties=properties,
                         structures=STRUCTURES_DATABASE,
                         categories=STRUCTURE_CATEGORIES)


@pages_bp.route('/livestock')
@login_required
def livestock():
    """Livestock management page"""
    chickens = Chicken.query.filter_by(user_id=current_user.id).all()
    beehives = Beehive.query.filter_by(user_id=current_user.id).all()
    livestock = Livestock.query.filter_by(user_id=current_user.id).all()
    return render_template('livestock.html',
                         chickens=chickens,
                         beehives=beehives,
                         livestock=livestock)
