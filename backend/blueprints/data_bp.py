"""
Reference Data Blueprint

Provides static reference data (plants, garden methods, templates, structures)

Routes:
- GET /api/plants - Get all plants (excluding fruit/nut trees - see Property Designer)
- GET /api/guilds - Get all plant guilds
- GET /api/guilds/<id> - Get specific guild
- GET /api/plant-guilds - Get all plant guilds (alias)
- GET /api/bed-templates - Get all bed templates (used by legacy visual_designer.html)
- GET /api/bed-templates/<id> - Get a specific bed template
- GET /api/structures - Get all structures and user's garden beds

(Removed Jun 2026 — no callers anywhere incl. backend/templates:
/plants/<id>, /plant-guilds/<id>, /garden-methods[/<id>].)
"""
from flask import Blueprint, jsonify
from flask_login import login_required, current_user

from plant_database import PLANT_DATABASE
from structures_database import STRUCTURES_DATABASE, STRUCTURE_CATEGORIES
from garden_methods import PLANT_GUILDS, BED_TEMPLATES, get_guild_by_id, get_template_by_id
from models import GardenBed

data_bp = Blueprint('data', __name__, url_prefix='/api')

# Snake_case keys in PLANT_DATABASE that need camelCase conversion for API responses
_SNAKE_TO_CAMEL = {
    'days_to_seed': 'daysToSeed',
    'soil_temp_min': 'soilTempMin',
    'germination_days': 'germinationDays',
    'ideal_seasons': 'idealSeasons',
    'heat_tolerance': 'heatTolerance',
}


def _normalize_plant_keys(plant_dict):
    """Convert snake_case plant fields to camelCase for API response."""
    result = {}
    for key, value in plant_dict.items():
        result[_SNAKE_TO_CAMEL.get(key, key)] = value
    return result


# ==================== PLANT DATA ====================

@data_bp.route('/plants')
def get_plants():
    """Get all plants (excluding fruit/nut trees which are now in Property Designer)"""
    # Filter out fruit and nut category plants - they belong in Property Designer now
    garden_plants = [plant for plant in PLANT_DATABASE if plant.get('category') not in ['fruit', 'nut']]
    return jsonify([_normalize_plant_keys(p) for p in garden_plants])


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


# ==================== BED TEMPLATES ====================
# Kept: the legacy server-rendered visual_designer.html template-picker calls
# the detail route ($.get('/api/bed-templates/' + templateId)).

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
