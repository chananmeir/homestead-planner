"""
Seed Inventory & Catalog Blueprint

Routes:
- GET/POST /api/seeds - List and create seeds
- GET /api/seeds/varieties/<plant_id> - Get varieties by plant
- PUT/DELETE /api/seeds/<id> - Update or delete seed
- GET /api/seed-catalog - Get seed catalog with pagination
- GET /api/seed-catalog/available-crops - Get available crops
- GET /api/my-seeds - Get user's personal seeds
- POST /api/my-seeds/from-catalog - Clone catalog seed to personal inventory
- POST /api/my-seeds/<id>/sync-from-catalog - Sync with catalog data
- POST /api/varieties/import - Import varieties from CSV (admin only)
"""
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from sqlalchemy import or_, func
from datetime import datetime
from utils.helpers import parse_iso_date
import logging

from models import db, SeedInventory
from utils.decorators import admin_required
from services.csv_import_service import (
    parse_variety_csv,
    import_varieties_to_database,
    validate_csv_format
)
from services.seed_import_service import (
    parse_seed_inventory_csv,
    import_seeds_to_database,
)
from plant_database import PLANT_DATABASE
from utils.plant_id_resolver import validate_and_resolve_plant_id, is_deprecated_plant_id

seeds_bp = Blueprint('seeds', __name__, url_prefix='/api')


# ==================== VALIDATION HELPERS ====================

def validate_plant_id(plant_id):
    """
    Validate that plant_id exists in PLANT_DATABASE.

    Args:
        plant_id: The plant_id to validate

    Returns:
        bool: True if plant_id exists, False otherwise
    """
    valid_ids = {plant['id'] for plant in PLANT_DATABASE}
    return plant_id in valid_ids


# ==================== SEED INVENTORY ====================

@seeds_bp.route('/seeds', methods=['GET', 'POST'])
@login_required
def api_seeds():
    """Get all seed inventory or add new seed"""
    if request.method == 'POST':
        data = request.json

        # Check if trying to create a global seed (admin only)
        is_global = data.get('isGlobal', False)
        if is_global and not current_user.is_admin:
            return jsonify({'error': 'Only admins can create global seeds'}), 403

        # Validate and resolve plant_id (handles aliases like 'chia-white' -> 'chia-1')
        plant_id = data.get('plantId')
        if not plant_id:
            return jsonify({'error': 'plantId is required'}), 400

        is_valid, canonical_id, error_msg = validate_and_resolve_plant_id(plant_id)
        if not is_valid:
            return jsonify({
                'error': error_msg,
                'details': 'Plant does not exist in database. Check backend/plant_database.py for valid IDs.'
            }), 400

        # Use canonical ID (alias resolution applied)
        if canonical_id != plant_id:
            logging.info(f"Resolved deprecated plant_id '{plant_id}' -> '{canonical_id}'")

        seed = SeedInventory(
            user_id=None if is_global else current_user.id,
            plant_id=canonical_id,  # Use resolved canonical ID
            variety=data['variety'],
            brand=data.get('brand', ''),
            quantity=data.get('quantity', 0),
            purchase_date=parse_iso_date(data['purchaseDate']) if data.get('purchaseDate') else None,
            expiration_date=parse_iso_date(data['expirationDate']) if data.get('expirationDate') else None,
            germination_rate=data.get('germinationRate'),
            location=data.get('location', ''),
            price=data.get('price'),
            notes=data.get('notes', ''),
            is_global=is_global,
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

    # GET: Return global seeds + user's personal seeds
    seeds = SeedInventory.query.filter(
        or_(
            SeedInventory.is_global == True,
            SeedInventory.user_id == current_user.id
        )
    ).all()
    return jsonify([seed.to_dict() for seed in seeds])


@seeds_bp.route('/seeds/varieties/<plant_id>', methods=['GET'])
@login_required
def get_varieties_by_plant(plant_id):
    """Get all varieties for a specific plant from seed inventory"""
    try:
        catalog_only = request.args.get('catalogOnly', 'false').lower() == 'true'

        if catalog_only:
            # Return only global catalog varieties
            seeds = SeedInventory.query.filter_by(
                plant_id=plant_id,
                is_global=True
            ).all()
        else:
            # Return global + user's personal seeds
            seeds = SeedInventory.query.filter(
                SeedInventory.plant_id == plant_id,
                or_(
                    SeedInventory.is_global == True,
                    SeedInventory.user_id == current_user.id
                )
            ).all()

        # Return just variety names (unique, sorted, non-empty)
        varieties = list(set([seed.variety for seed in seeds if seed.variety]))
        return jsonify(sorted(varieties))
    except Exception as e:
        logging.error(f"Failed to fetch varieties for {plant_id}: {str(e)}")
        return jsonify({'error': 'Failed to fetch varieties'}), 500


@seeds_bp.route('/seeds/<int:seed_id>', methods=['PUT', 'DELETE'])
@login_required
def seed_item(seed_id):
    """Update or delete seed inventory"""
    seed = SeedInventory.query.get_or_404(seed_id)

    # Verify ownership (or admin for global seeds)
    if seed.is_global:
        # Global seeds can only be edited/deleted by admins
        if not current_user.is_admin:
            return jsonify({'error': 'Cannot modify global catalog varieties'}), 403
    else:
        # Personal seeds can only be edited/deleted by owner
        if seed.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

    if request.method == 'DELETE':
        db.session.delete(seed)
        db.session.commit()
        return '', 204

    # PUT request - update seed
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


# ==================== SEED CATALOG ====================

@seeds_bp.route('/seed-catalog', methods=['GET'])
@login_required
def get_seed_catalog():
    """Get global seed catalog varieties (is_global=True only)"""
    # Pagination parameters
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 100, type=int)
    limit = min(limit, 500)  # Cap at 500 to prevent abuse

    # Filter parameters
    plant_id = request.args.get('plant_id', type=str)
    search = request.args.get('search', type=str)

    # Base query
    query = SeedInventory.query.filter_by(is_global=True)

    # Apply filters
    if plant_id:
        query = query.filter_by(plant_id=plant_id)

    if search:
        search_pattern = f'%{search}%'
        # NOTE: Exclude notes from catalog search - it contains metadata (rotation groups, CSV import info)
        # not user-facing notes. Only search plant_id, variety, and brand.
        query = query.filter(
            db.or_(
                SeedInventory.plant_id.ilike(search_pattern),
                SeedInventory.variety.ilike(search_pattern),
                SeedInventory.brand.ilike(search_pattern)
            )
        )

    # Get total count before pagination
    total = query.count()

    # Apply pagination
    catalog_seeds = query.order_by(SeedInventory.plant_id, SeedInventory.variety)\
                        .limit(limit)\
                        .offset((page - 1) * limit)\
                        .all()

    return jsonify({
        'seeds': [seed.to_dict() for seed in catalog_seeds],
        'pagination': {
            'page': page,
            'limit': limit,
            'total': total,
            'pages': (total + limit - 1) // limit  # Ceiling division
        }
    })


@seeds_bp.route('/seed-catalog/available-crops', methods=['GET'])
@login_required
def get_available_crops():
    """Get all unique plant_ids available in the global seed catalog"""
    # Query distinct plant_ids and count varieties for each
    crop_counts = db.session.query(
        SeedInventory.plant_id,
        func.count(SeedInventory.id).label('variety_count')
    ).filter_by(
        is_global=True
    ).group_by(
        SeedInventory.plant_id
    ).order_by(
        SeedInventory.plant_id
    ).all()

    return jsonify([{
        'plant_id': plant_id,
        'variety_count': count
    } for plant_id, count in crop_counts])


# ==================== PERSONAL SEED INVENTORY ====================

@seeds_bp.route('/my-seeds', methods=['GET'])
@login_required
def get_my_seeds():
    """Get current user's personal seed inventory (optionally include global catalog)"""
    # Check if we should include global catalog seeds (for variety dropdowns)
    include_global = request.args.get('includeGlobal', 'false').lower() == 'true'

    if include_global:
        # Include both personal seeds and global catalog (for Garden Designer)
        my_seeds = SeedInventory.query.filter(
            or_(
                SeedInventory.is_global == True,
                SeedInventory.user_id == current_user.id
            )
        ).all()
    else:
        # Only personal seeds (for Seed Inventory page)
        my_seeds = SeedInventory.query.filter_by(
            user_id=current_user.id,
            is_global=False
        ).all()

    return jsonify([seed.to_dict() for seed in my_seeds])


@seeds_bp.route('/my-seeds/from-catalog', methods=['POST'])
@login_required
def add_seed_from_catalog():
    """Clone a catalog seed to user's personal inventory"""
    data = request.json
    catalog_seed_id = data.get('catalogSeedId')

    if not catalog_seed_id:
        return jsonify({'error': 'catalogSeedId is required'}), 400

    # Find catalog seed
    catalog_seed = SeedInventory.query.filter_by(
        id=catalog_seed_id,
        is_global=True
    ).first()

    if not catalog_seed:
        return jsonify({'error': 'Catalog seed not found'}), 404

    # Validate catalog seed's plant_id exists
    plant_id = catalog_seed.plant_id
    if not validate_plant_id(plant_id):
        return jsonify({
            'error': f'Catalog seed has invalid plant_id: {plant_id}',
            'details': 'Cannot clone seed with unknown plant. Contact admin to fix catalog data.'
        }), 400

    # Create personal copy
    personal_seed = SeedInventory(
        user_id=current_user.id,
        plant_id=plant_id,
        variety=catalog_seed.variety,
        brand=catalog_seed.brand,
        quantity=data.get('quantity', 1),
        purchase_date=parse_iso_date(data['purchaseDate']) if data.get('purchaseDate') else None,
        location=data.get('location', ''),
        notes=data.get('notes', ''),
        is_global=False,
        catalog_seed_id=catalog_seed_id,  # Track catalog origin
        # Copy all agronomic data from catalog
        days_to_maturity=catalog_seed.days_to_maturity,
        germination_days=catalog_seed.germination_days,
        plant_spacing=catalog_seed.plant_spacing,
        row_spacing=catalog_seed.row_spacing,
        planting_depth=catalog_seed.planting_depth,
        germination_temp_min=catalog_seed.germination_temp_min,
        germination_temp_max=catalog_seed.germination_temp_max,
        soil_temp_min=catalog_seed.soil_temp_min,
        heat_tolerance=catalog_seed.heat_tolerance,
        cold_tolerance=catalog_seed.cold_tolerance,
        bolt_resistance=catalog_seed.bolt_resistance,
        ideal_seasons=catalog_seed.ideal_seasons,
        flavor_profile=catalog_seed.flavor_profile,
        storage_rating=catalog_seed.storage_rating
    )

    try:
        db.session.add(personal_seed)
        db.session.commit()
        return jsonify(personal_seed.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to add seed to inventory'}), 500


@seeds_bp.route('/my-seeds/<int:seed_id>/sync-from-catalog', methods=['POST'])
@login_required
def sync_seed_from_catalog(seed_id):
    """Sync a personal seed's agronomic data from its catalog source"""
    # Find personal seed
    personal_seed = SeedInventory.query.filter_by(
        id=seed_id,
        user_id=current_user.id,
        is_global=False
    ).first()

    if not personal_seed:
        return jsonify({'error': 'Seed not found or access denied'}), 404

    # Check if seed has catalog reference
    if not personal_seed.catalog_seed_id:
        return jsonify({'error': 'This seed was not added from the catalog'}), 400

    # Find catalog seed
    catalog_seed = SeedInventory.query.filter_by(
        id=personal_seed.catalog_seed_id,
        is_global=True
    ).first()

    if not catalog_seed:
        return jsonify({'error': 'Original catalog seed no longer exists'}), 404

    # Sync all agronomic fields from catalog
    personal_seed.days_to_maturity = catalog_seed.days_to_maturity
    personal_seed.germination_days = catalog_seed.germination_days
    personal_seed.plant_spacing = catalog_seed.plant_spacing
    personal_seed.row_spacing = catalog_seed.row_spacing
    personal_seed.planting_depth = catalog_seed.planting_depth
    personal_seed.germination_temp_min = catalog_seed.germination_temp_min
    personal_seed.germination_temp_max = catalog_seed.germination_temp_max
    personal_seed.soil_temp_min = catalog_seed.soil_temp_min
    personal_seed.heat_tolerance = catalog_seed.heat_tolerance
    personal_seed.cold_tolerance = catalog_seed.cold_tolerance
    personal_seed.bolt_resistance = catalog_seed.bolt_resistance
    personal_seed.ideal_seasons = catalog_seed.ideal_seasons
    personal_seed.flavor_profile = catalog_seed.flavor_profile
    personal_seed.storage_rating = catalog_seed.storage_rating

    # Update sync timestamp
    personal_seed.last_synced_at = datetime.utcnow()

    try:
        db.session.commit()
        return jsonify({
            'message': 'Seed synced successfully from catalog',
            'seed': personal_seed.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to sync seed'}), 500


# ==================== SEED INVENTORY CSV IMPORT ====================

@seeds_bp.route('/seeds/import', methods=['POST'])
@login_required
def import_seed_inventory():
    """Import seeds from a CSV file (personal seed inventory format)"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        skip_duplicates = request.form.get('skipDuplicates', 'true').lower() == 'true'

        file_content = file.read().decode('utf-8')

        # Parse CSV
        parsed_rows, parse_errors = parse_seed_inventory_csv(file_content)

        if parse_errors and not parsed_rows:
            return jsonify({
                'error': 'CSV parsing failed',
                'details': parse_errors
            }), 400

        # Import to database
        imported_count, skipped_count, import_warnings = import_seeds_to_database(
            db, parsed_rows, current_user.id, skip_duplicates=skip_duplicates
        )

        all_warnings = parse_errors + import_warnings

        return jsonify({
            'imported': imported_count,
            'skipped': skipped_count,
            'totalRows': len(parsed_rows),
            'warnings': all_warnings,
        }), 200

    except Exception as e:
        logging.error(f"Seed inventory import failed: {str(e)}")
        return jsonify({
            'error': 'Import failed',
            'details': str(e)
        }), 500


# ==================== CSV IMPORT (ADMIN ONLY) ====================

@seeds_bp.route('/varieties/import', methods=['POST'])
@login_required
@admin_required
def import_varieties():
    """Import plant varieties from CSV file (admin only)"""
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
        imported_count, import_errors = import_varieties_to_database(
            db, varieties, is_global,
            user_id=None if is_global else current_user.id
        )

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
