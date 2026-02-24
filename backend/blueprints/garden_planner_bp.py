"""
Garden Planner Blueprint

Routes:
- GET/POST /api/garden-plans - List and create garden plans
- GET /api/garden-plans/<id> - Get specific plan with items
- PUT /api/garden-plans/<id> - Update plan
- DELETE /api/garden-plans/<id> - Delete plan
- POST /api/garden-plans/calculate - Calculate quantities from seed selection
- POST /api/garden-plans/<id>/optimize - Re-optimize existing plan
- GET /api/garden-plans/<id>/feasibility - Check space availability
- POST /api/garden-plans/<id>/export-to-calendar - Create PlantingEvents
- GET /api/garden-plans/<id>/shopping-list - Generate seed shopping list
- POST /api/rotation/check - Check crop rotation conflict for plant+bed
- POST /api/rotation/suggest-beds - Get safe beds for a plant
- GET /api/rotation/bed-history/<bed_id> - Get rotation history for bed
"""
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from datetime import datetime
import logging
import json

from models import db, GardenPlan, GardenPlanItem, SeedInventory
from services.garden_planner_service import (
    calculate_plant_quantities,
    calculate_shopping_list,
    export_to_calendar,
    validate_space_feasibility
)
from services.rotation_checker import (
    check_rotation_conflict,
    suggest_safe_beds,
    get_bed_rotation_history
)

garden_planner_bp = Blueprint('garden_planner', __name__, url_prefix='/api')


# ==================== CRUD OPERATIONS ====================

@garden_planner_bp.route('/garden-plans', methods=['GET', 'POST'])
@login_required
def api_garden_plans():
    """Get all garden plans or create new plan"""
    if request.method == 'POST':
        data = request.json

        # Validate required fields
        if not data.get('name') or not data.get('year'):
            return jsonify({'error': 'Name and year are required'}), 400

        # Create new plan
        plan = GardenPlan(
            user_id=current_user.id,
            name=data['name'],
            season=data.get('season'),
            year=data['year'],
            strategy=data.get('strategy', 'balanced'),
            succession_preference=data.get('successionPreference', 'moderate'),
            target_total_plants=data.get('targetTotalPlants'),
            target_diversity=data.get('targetDiversity'),
            notes=data.get('notes', '')
        )

        try:
            db.session.add(plan)
            db.session.flush()  # Get the plan ID

            # Add plan items if provided
            if data.get('items'):
                for item_data in data['items']:
                    item = GardenPlanItem(
                        garden_plan_id=plan.id,
                        seed_inventory_id=item_data.get('seedInventoryId'),
                        plant_id=item_data['plantId'],
                        variety=item_data.get('variety'),
                        unit_type=item_data.get('unitType', 'plants'),
                        target_value=item_data['targetValue'],
                        plant_equivalent=item_data['plantEquivalent'],
                        seeds_required=item_data.get('seedsRequired'),
                        seed_packets_required=item_data.get('seedPacketsRequired'),
                        succession_enabled=item_data.get('successionEnabled', False),
                        succession_count=item_data.get('successionCount', 1),
                        succession_interval_days=item_data.get('successionIntervalDays'),
                        first_plant_date=datetime.fromisoformat(item_data['firstPlantDate']).date() if item_data.get('firstPlantDate') else None,
                        last_plant_date=datetime.fromisoformat(item_data['lastPlantDate']).date() if item_data.get('lastPlantDate') else None,
                        harvest_window_start=datetime.fromisoformat(item_data['harvestWindowStart']).date() if item_data.get('harvestWindowStart') else None,
                        harvest_window_end=datetime.fromisoformat(item_data['harvestWindowEnd']).date() if item_data.get('harvestWindowEnd') else None,
                        beds_allocated=json.dumps(item_data.get('bedsAllocated', [])),
                        space_required_cells=item_data.get('spaceRequiredCells'),
                        status=item_data.get('status', 'planned')
                    )
                    db.session.add(item)

            db.session.commit()
            return jsonify(plan.to_dict()), 201

        except Exception as e:
            db.session.rollback()
            logging.error(f"Error creating garden plan: {e}")
            return jsonify({'error': 'Failed to create garden plan'}), 500

    # GET: Return user's plans
    plans = GardenPlan.query.filter_by(user_id=current_user.id).order_by(GardenPlan.created_at.desc()).all()
    return jsonify([plan.to_dict() for plan in plans])


@garden_planner_bp.route('/garden-plans/<int:plan_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_garden_plan_detail(plan_id):
    """Get, update, or delete specific garden plan"""
    plan = GardenPlan.query.get(plan_id)

    if not plan or plan.user_id != current_user.id:
        return jsonify({'error': 'Plan not found'}), 404

    if request.method == 'DELETE':
        try:
            db.session.delete(plan)
            db.session.commit()
            return jsonify({'success': True}), 200
        except Exception as e:
            db.session.rollback()
            logging.error(f"Error deleting garden plan: {e}")
            return jsonify({'error': 'Failed to delete garden plan'}), 500

    if request.method == 'PUT':
        data = request.json

        # Update plan fields
        if 'name' in data:
            plan.name = data['name']
        if 'season' in data:
            plan.season = data['season']
        if 'year' in data:
            plan.year = data['year']
        if 'strategy' in data:
            plan.strategy = data['strategy']
        if 'successionPreference' in data:
            plan.succession_preference = data['successionPreference']
        if 'targetTotalPlants' in data:
            plan.target_total_plants = data['targetTotalPlants']
        if 'targetDiversity' in data:
            plan.target_diversity = data['targetDiversity']
        if 'notes' in data:
            plan.notes = data['notes']

        plan.updated_at = datetime.utcnow()

        # Update items if provided
        if 'items' in data:
            # Delete existing items
            GardenPlanItem.query.filter_by(garden_plan_id=plan.id).delete()

            # Add new items
            for item_data in data['items']:
                item = GardenPlanItem(
                    garden_plan_id=plan.id,
                    seed_inventory_id=item_data.get('seedInventoryId'),
                    plant_id=item_data['plantId'],
                    variety=item_data.get('variety'),
                    unit_type=item_data.get('unitType', 'plants'),
                    target_value=item_data['targetValue'],
                    plant_equivalent=item_data['plantEquivalent'],
                    seeds_required=item_data.get('seedsRequired'),
                    seed_packets_required=item_data.get('seedPacketsRequired'),
                    succession_enabled=item_data.get('successionEnabled', False),
                    succession_count=item_data.get('successionCount', 1),
                    succession_interval_days=item_data.get('successionIntervalDays'),
                    first_plant_date=datetime.fromisoformat(item_data['firstPlantDate']).date() if item_data.get('firstPlantDate') else None,
                    last_plant_date=datetime.fromisoformat(item_data['lastPlantDate']).date() if item_data.get('lastPlantDate') else None,
                    harvest_window_start=datetime.fromisoformat(item_data['harvestWindowStart']).date() if item_data.get('harvestWindowStart') else None,
                    harvest_window_end=datetime.fromisoformat(item_data['harvestWindowEnd']).date() if item_data.get('harvestWindowEnd') else None,
                    beds_allocated=json.dumps(item_data.get('bedsAllocated', [])),
                    space_required_cells=item_data.get('spaceRequiredCells'),
                    status=item_data.get('status', 'planned')
                )
                db.session.add(item)

        try:
            db.session.commit()
            return jsonify(plan.to_dict()), 200
        except Exception as e:
            db.session.rollback()
            logging.error(f"Error updating garden plan: {e}")
            return jsonify({'error': 'Failed to update garden plan'}), 500

    # GET
    return jsonify(plan.to_dict())


# ==================== PLANNING OPERATIONS ====================

@garden_planner_bp.route('/garden-plans/calculate', methods=['POST'])
@login_required
def api_calculate_plan():
    """Calculate plant quantities from seed selection"""
    data = request.json

    # Validate required fields
    if not data.get('seedSelections'):
        return jsonify({'error': 'Seed selections are required'}), 400

    # Convert JSON string keys to integers for proper lookup
    # JSON serialization converts numeric keys to strings, but we need integers
    # to match seed_inventory_id from the database
    manual_quantities_raw = data.get('manualQuantities', {})
    manual_quantities = {}
    if manual_quantities_raw:
        for k, v in manual_quantities_raw.items():
            try:
                manual_quantities[int(k)] = v
            except (ValueError, TypeError):
                logging.warning(f"Invalid manual quantity key: {k}")

    per_seed_succession_raw = data.get('perSeedSuccession', {})
    per_seed_succession = {}
    if per_seed_succession_raw:
        for k, v in per_seed_succession_raw.items():
            try:
                per_seed_succession[int(k)] = v
            except (ValueError, TypeError):
                logging.warning(f"Invalid succession key: {k}")

    # DEBUG: Log what we received and converted
    logging.info("=== GARDEN PLANNER CALCULATE REQUEST ===")
    logging.info(f"Manual Quantities (raw): {manual_quantities_raw}")
    logging.info(f"Manual Quantities (converted): {manual_quantities}")
    logging.info(f"Per-Seed Succession (raw): {per_seed_succession_raw}")
    logging.info(f"Per-Seed Succession (converted): {per_seed_succession}")
    logging.info(f"Global Succession: {data.get('successionPreference', 'moderate')}")
    logging.info(f"Seed Selections: {len(data.get('seedSelections', []))} seeds")

    try:
        result = calculate_plant_quantities(
            seed_selections=data['seedSelections'],
            strategy=data.get('strategy', 'balanced'),
            succession_preference=data.get('successionPreference', 'moderate'),
            user_id=current_user.id,
            manual_quantities=manual_quantities,
            per_seed_succession=per_seed_succession
        )

        # DEBUG: Log what we calculated
        logging.info(f"Result items: {len(result.get('items', []))}")
        for item in result.get('items', []):
            logging.info(f"  Plant {item.get('plantId')}: {item.get('targetValue')} plants, {item.get('successionCount')} successions")
        logging.info("========================================")

        return jsonify(result), 200

    except Exception as e:
        import traceback
        logging.error(f"Error calculating plan: {e}")
        logging.error(traceback.format_exc())
        return jsonify({'error': f'Failed to calculate plan: {str(e)}'}), 500


@garden_planner_bp.route('/garden-plans/<int:plan_id>/optimize', methods=['POST'])
@login_required
def api_optimize_plan(plan_id):
    """Re-optimize existing plan with updated parameters"""
    plan = GardenPlan.query.get(plan_id)

    if not plan or plan.user_id != current_user.id:
        return jsonify({'error': 'Plan not found'}), 404

    data = request.json

    try:
        # Get seed selections from plan items
        seed_selections = []
        for item in plan.items:
            if item.seed_inventory_id:
                seed = SeedInventory.query.get(item.seed_inventory_id)
                if seed:
                    seed_dict = seed.to_dict()
                    seed_selections.append(seed_dict)

        if not seed_selections:
            return jsonify({'error': 'No seed selections found in plan'}), 400

        # Recalculate with new parameters
        result = calculate_plant_quantities(
            seed_selections=seed_selections,
            strategy=data.get('strategy', plan.strategy),
            succession_preference=data.get('successionPreference', plan.succession_preference),
            user_id=current_user.id
        )

        # Update plan
        if 'strategy' in data:
            plan.strategy = data['strategy']
        if 'successionPreference' in data:
            plan.succession_preference = data['successionPreference']

        plan.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify(result), 200

    except Exception as e:
        logging.error(f"Error optimizing plan: {e}")
        return jsonify({'error': 'Failed to optimize plan'}), 500


@garden_planner_bp.route('/garden-plans/<int:plan_id>/feasibility', methods=['GET'])
@login_required
def api_check_feasibility(plan_id):
    """Check if plan fits within available garden space"""
    plan = GardenPlan.query.get(plan_id)

    if not plan or plan.user_id != current_user.id:
        return jsonify({'error': 'Plan not found'}), 404

    try:
        result = validate_space_feasibility(plan_id)
        return jsonify(result), 200

    except Exception as e:
        logging.error(f"Error checking feasibility: {e}")
        return jsonify({'error': 'Failed to check feasibility'}), 500


# ==================== EXPORT OPERATIONS ====================

@garden_planner_bp.route('/garden-plans/<int:plan_id>/export-to-calendar', methods=['POST'])
@login_required
def api_export_to_calendar(plan_id):
    """Export garden plan to planting calendar"""
    plan = GardenPlan.query.get(plan_id)

    if not plan or plan.user_id != current_user.id:
        return jsonify({'error': 'Plan not found'}), 404

    try:
        result = export_to_calendar(plan_id, current_user.id)
        return jsonify(result), 200

    except Exception as e:
        logging.error(f"Error exporting to calendar: {e}")
        return jsonify({'error': 'Failed to export to calendar'}), 500


@garden_planner_bp.route('/garden-plans/<int:plan_id>/shopping-list', methods=['GET'])
@login_required
def api_shopping_list(plan_id):
    """Generate seed shopping list for plan"""
    plan = GardenPlan.query.get(plan_id)

    if not plan or plan.user_id != current_user.id:
        return jsonify({'error': 'Plan not found'}), 404

    try:
        shopping_list = calculate_shopping_list(plan_id)
        return jsonify(shopping_list), 200

    except Exception as e:
        logging.error(f"Error generating shopping list: {e}")
        return jsonify({'error': 'Failed to generate shopping list'}), 500


# ==================== CROP ROTATION OPERATIONS ====================

@garden_planner_bp.route('/rotation/check', methods=['POST'])
@login_required
def api_check_rotation():
    """
    Check crop rotation conflict for a specific plant and bed.

    Request body:
        {
            "plantId": "tomato-1",
            "bedId": 1,
            "year": 2026
        }

    Returns:
        {
            "has_conflict": bool,
            "conflict_years": [2024, 2023],
            "last_planted": "2024-05-15T00:00:00",
            "family": "Solanaceae",
            "recommendation": "Warning message...",
            "safe_year": 2027
        }
    """
    data = request.json

    # Validate required fields
    if not data.get('plantId') or not data.get('bedId'):
        return jsonify({'error': 'plantId and bedId are required'}), 400

    plant_id = data['plantId']
    bed_id = data['bedId']
    year = data.get('year', datetime.now().year)

    try:
        result = check_rotation_conflict(
            plant_id=plant_id,
            bed_id=bed_id,
            user_id=current_user.id,
            planting_year=year,
            rotation_window=3
        )

        # Convert datetime to ISO string for JSON serialization
        if result.get('last_planted'):
            result['last_planted'] = result['last_planted'].isoformat()

        return jsonify(result), 200

    except Exception as e:
        logging.error(f"Error checking rotation: {e}")
        return jsonify({'error': 'Failed to check rotation'}), 500


@garden_planner_bp.route('/rotation/suggest-beds', methods=['POST'])
@login_required
def api_suggest_beds():
    """
    Suggest safe beds for planting a specific crop.

    Request body:
        {
            "plantId": "tomato-1",
            "year": 2026
        }

    Returns:
        [
            {
                "bed_id": 1,
                "bed_name": "Bed A",
                "rotation_safe": true,
                "conflict_info": null
            },
            {
                "bed_id": 2,
                "bed_name": "Bed B",
                "rotation_safe": false,
                "conflict_info": {
                    "has_conflict": true,
                    "family": "Solanaceae",
                    "recommendation": "..."
                }
            }
        ]
    """
    data = request.json

    # Validate required fields
    if not data.get('plantId'):
        return jsonify({'error': 'plantId is required'}), 400

    plant_id = data['plantId']
    year = data.get('year', datetime.now().year)

    try:
        suggestions = suggest_safe_beds(
            plant_id=plant_id,
            user_id=current_user.id,
            planting_year=year,
            rotation_window=3
        )

        # Convert datetime objects to ISO strings in conflict_info
        for suggestion in suggestions:
            if suggestion.get('conflict_info') and suggestion['conflict_info'].get('last_planted'):
                suggestion['conflict_info']['last_planted'] = suggestion['conflict_info']['last_planted'].isoformat()

        return jsonify(suggestions), 200

    except Exception as e:
        logging.error(f"Error suggesting beds: {e}")
        return jsonify({'error': 'Failed to suggest beds'}), 500


@garden_planner_bp.route('/rotation/bed-history/<int:bed_id>', methods=['GET'])
@login_required
def api_bed_history(bed_id):
    """
    Get planting history for a specific bed.

    Query params:
        ?years=3 (optional, default 3)

    Returns:
        [
            {
                "plant_id": "tomato-1",
                "plant_name": "Tomato",
                "family": "Solanaceae",
                "year": 2024,
                "planted_date": "2024-05-15T00:00:00",
                "variety": "Brandywine"
            },
            ...
        ]
    """
    years_back = request.args.get('years', 3, type=int)

    try:
        history = get_bed_rotation_history(
            bed_id=bed_id,
            user_id=current_user.id,
            years_back=years_back
        )

        # Convert datetime objects to ISO strings
        for entry in history:
            if entry.get('planted_date'):
                entry['planted_date'] = entry['planted_date'].isoformat()

        return jsonify(history), 200

    except Exception as e:
        logging.error(f"Error getting bed history: {e}")
        return jsonify({'error': 'Failed to get bed history'}), 500
