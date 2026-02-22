"""
Reference Data Blueprint

Provides static reference data (plants, garden methods, templates, structures)

Routes:
- GET /api/plants - Get all plants (excluding fruit/nut trees - see Property Designer)
- GET /api/plants/<id> - Get specific plant
- GET /api/guilds - Get all plant guilds
- GET /api/guilds/<id> - Get specific guild
- GET /api/plant-guilds - Get all plant guilds (alias)
- GET /api/plant-guilds/<id> - Get specific guild (alias)
- GET /api/garden-methods - Get all garden planning methods
- GET /api/garden-methods/<id> - Get specific method
- GET /api/bed-templates - Get all bed templates
- GET /api/bed-templates/<id> - Get specific template
- GET /api/structures - Get all structures and user's garden beds
"""
from flask import Blueprint, jsonify
from flask_login import login_required, current_user

from plant_database import PLANT_DATABASE, get_plant_by_id
from structures_database import STRUCTURES_DATABASE, STRUCTURE_CATEGORIES, get_structure_by_id
from garden_methods import (
    GARDEN_METHODS,
    BED_TEMPLATES,
    PLANT_GUILDS,
    get_methods_list,
    get_template_by_id,
    get_guild_by_id
)
from models import GardenBed

data_bp = Blueprint('data', __name__, url_prefix='/api')


# ==================== PLANT DATA ====================

@data_bp.route('/plants')
def get_plants():
    """Get all plants (excluding fruit/nut trees which are now in Property Designer)"""
    # Filter out fruit and nut category plants - they belong in Property Designer now
    garden_plants = [plant for plant in PLANT_DATABASE if plant.get('category') not in ['fruit', 'nut']]
    return jsonify(garden_plants)


@data_bp.route('/plants/<plant_id>')
def get_plant(plant_id):
    """Get specific plant"""
    plant = get_plant_by_id(plant_id)
    if plant:
        return jsonify(plant)
    return jsonify({'error': 'Plant not found'}), 404


# ==================== GUILD DATA ====================

@data_bp.route('/guilds')
def get_guilds():
    """Get all plant guilds (companion planting templates)"""
    return jsonify(PLANT_GUILDS)


@data_bp.route('/guilds/<guild_id>')
def get_guild(guild_id):
    """Get specific plant guild"""
    guild = get_guild_by_id(guild_id)
    if guild:
        return jsonify(guild)
    return jsonify({'error': 'Guild not found'}), 404


@data_bp.route('/plant-guilds')
def get_plant_guilds():
    """Get all plant guilds (alias for /guilds)"""
    return jsonify(PLANT_GUILDS)


@data_bp.route('/plant-guilds/<guild_id>')
def get_plant_guild(guild_id):
    """Get a specific plant guild (alias for /guilds/<id>)"""
    guild = get_guild_by_id(guild_id)
    if not guild:
        return jsonify({'error': 'Guild not found'}), 404
    return jsonify(guild)


# ==================== GARDEN METHODS ====================

@data_bp.route('/garden-methods')
def get_garden_methods():
    """Get all available garden planning methods"""
    return jsonify({
        'methods': get_methods_list(),
        'details': GARDEN_METHODS
    })


@data_bp.route('/garden-methods/<method_id>')
def get_garden_method(method_id):
    """Get details for a specific garden planning method"""
    method = GARDEN_METHODS.get(method_id)
    if not method:
        return jsonify({'error': 'Method not found'}), 404
    return jsonify(method)


# ==================== BED TEMPLATES ====================

@data_bp.route('/bed-templates')
def get_bed_templates():
    """Get all bed templates"""
    return jsonify(BED_TEMPLATES)


@data_bp.route('/bed-templates/<template_id>')
def get_bed_template(template_id):
    """Get a specific bed template"""
    template = get_template_by_id(template_id)
    if not template:
        return jsonify({'error': 'Template not found'}), 404
    return jsonify(template)


# ==================== STRUCTURES ====================

@data_bp.route('/structures')
@login_required
def get_structures():
    """Get all available structure types including user's garden beds"""
    # Start with static structures
    all_structures = STRUCTURES_DATABASE.copy()

    # Add user's garden beds as placeable structures
    beds = GardenBed.query.filter_by(user_id=current_user.id).all()
    for bed in beds:
        # Build description based on bed properties
        desc_parts = []
        if bed.planning_method:
            desc_parts.append(bed.planning_method.replace('-', ' ').title())
        if bed.sun_exposure:
            desc_parts.append(f"{bed.sun_exposure} sun")
        if bed.location:
            desc_parts.append(bed.location)

        bed_structure = {
            'id': f'garden-bed-{bed.id}',
            'name': bed.name or f'{bed.width}x{bed.length} ft bed',  # Fallback if name is empty
            'category': 'my-garden-beds',
            'width': bed.width,
            'length': bed.length,
            'icon': '🌱',
            'description': ' - '.join(desc_parts) if desc_parts else f'{bed.width}x{bed.length} ft bed',
            'gardenBedId': bed.id
        }
        all_structures.append(bed_structure)

    # Add the new category for garden beds
    categories = STRUCTURE_CATEGORIES.copy()
    categories['my-garden-beds'] = {
        'name': 'My Garden Beds',
        'color': '#22c55e',
        'icon': '🌱'
    }

    return jsonify({
        'structures': all_structures,
        'categories': categories
    })
