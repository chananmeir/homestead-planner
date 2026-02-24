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
- GET /api/garden-plans/<id>/beds/<bed_id>/items - Get plan items assigned to a bed
- GET /api/garden-planner/season-progress - Get planned vs placed progress for year
- GET /api/garden-planner/garden-snapshot - Point-in-time inventory of active plants
- POST /api/garden-plans/<id>/designer-sync - Ensure plan item exists for Designer placement
- POST /api/rotation/check - Check crop rotation conflict for plant+bed
- POST /api/rotation/suggest-beds - Get safe beds for a plant
- GET /api/rotation/bed-history/<bed_id> - Get rotation history for bed
"""
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from datetime import datetime
from utils.helpers import parse_iso_date
import logging
import json
import math

from models import db, GardenPlan, GardenPlanItem, SeedInventory, PlantedItem, GardenBed
from sqlalchemy import func, or_, and_
from plant_database import get_plant_by_id
from services.space_calculator import calculate_space_requirement
from services.garden_planner_service import (
    calculate_plant_quantities,
    calculate_shopping_list,
    export_to_calendar,
    preview_export_conflicts,
    validate_space_feasibility,
    normalize_succession_preference,
    _calculate_seeds_needed
)
from services.rotation_checker import (
    check_rotation_conflict,
    suggest_safe_beds,
    get_bed_rotation_history
)

garden_planner_bp = Blueprint('garden_planner', __name__, url_prefix='/api')


# ==================== VALIDATION HELPERS ====================

def validate_bed_assignments(bed_assignments_data, target_value, allocation_mode):
    """
    Validate bed assignments. Returns (is_valid, error_message, normalized_assignments).

    Args:
        bed_assignments_data: List of {"bedId": int, "quantity": int} dicts
        target_value: Total quantity to allocate
        allocation_mode: 'even' or 'custom'

    Returns:
        Tuple of (is_valid: bool, error_message: str | None, normalized_assignments: list | None)
    """
    if not bed_assignments_data:
        return True, None, []

    normalized = []
    for idx, assignment in enumerate(bed_assignments_data):
        # Require bedId
        bed_id = assignment.get('bedId')
        if bed_id is None:
            return False, f'Assignment {idx} missing bedId', None

        # Coerce quantity to int, handle string/None/missing
        raw_qty = assignment.get('quantity')
        try:
            qty = int(raw_qty) if raw_qty is not None else 0
        except (ValueError, TypeError):
            return False, f'Assignment {idx} has invalid quantity: {raw_qty}', None

        if qty < 0:
            return False, f'Assignment {idx} has negative quantity: {qty}', None

        normalized.append({'bedId': int(bed_id), 'quantity': qty})

    # For custom mode, sum must equal target
    if allocation_mode == 'custom':
        allocated_sum = sum(a['quantity'] for a in normalized)
        target = int(target_value)
        if allocated_sum != target:
            return False, f'Custom allocation sum ({allocated_sum}) does not equal target ({target})', None

    return True, None, normalized


def create_plan_item_from_data(item_data, garden_plan_id):
    """
    Create a GardenPlanItem from request data, handling bed assignments properly.

    Returns:
        Tuple of (item: GardenPlanItem | None, error_message: str | None)
    """
    # Get and validate bed assignments
    bed_assignments_data = item_data.get('bedAssignments', [])
    allocation_mode = item_data.get('allocationMode', 'even')
    target_value = item_data.get('targetValue', 0)

    is_valid, error, normalized_assignments = validate_bed_assignments(
        bed_assignments_data, target_value, allocation_mode
    )
    if not is_valid:
        return None, error

    # Handle trellis assignments
    trellis_assignments_data = item_data.get('trellisAssignments', [])
    trellis_assignments_json = json.dumps(trellis_assignments_data) if trellis_assignments_data else None

    # Derive beds_allocated from bed_assignments for backward compatibility
    if normalized_assignments:
        beds_allocated_list = [a['bedId'] for a in normalized_assignments]
    else:
        # Fall back to legacy bedsAllocated if no bedAssignments
        beds_allocated_list = item_data.get('bedsAllocated', [])

    item = GardenPlanItem(
        garden_plan_id=garden_plan_id,
        seed_inventory_id=item_data.get('seedInventoryId'),
        plant_id=item_data['plantId'],
        variety=item_data.get('variety'),
        unit_type=item_data.get('unitType', 'plants'),
        target_value=target_value,
        plant_equivalent=item_data['plantEquivalent'],
        seeds_required=item_data.get('seedsRequired'),
        seed_packets_required=item_data.get('seedPacketsRequired'),
        succession_enabled=item_data.get('successionEnabled', False),
        succession_count=item_data.get('successionCount', 1),
        succession_interval_days=item_data.get('successionIntervalDays'),
        first_plant_date=parse_iso_date(item_data['firstPlantDate']).date() if item_data.get('firstPlantDate') else None,
        last_plant_date=parse_iso_date(item_data['lastPlantDate']).date() if item_data.get('lastPlantDate') else None,
        harvest_window_start=parse_iso_date(item_data['harvestWindowStart']).date() if item_data.get('harvestWindowStart') else None,
        harvest_window_end=parse_iso_date(item_data['harvestWindowEnd']).date() if item_data.get('harvestWindowEnd') else None,
        beds_allocated=json.dumps(beds_allocated_list) if beds_allocated_list else None,
        bed_assignments=json.dumps(normalized_assignments) if normalized_assignments else None,
        allocation_mode=allocation_mode if normalized_assignments else None,
        space_required_cells=item_data.get('spaceRequiredCells'),
        trellis_assignments=trellis_assignments_json,
        status=item_data.get('status', 'planned')
    )

    return item, None


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
            succession_preference=normalize_succession_preference(data.get('successionPreference', '4')),
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
                    item, error = create_plan_item_from_data(item_data, plan.id)
                    if error:
                        db.session.rollback()
                        return jsonify({'error': error}), 400
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
            plan.succession_preference = normalize_succession_preference(data['successionPreference'])
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
                item, error = create_plan_item_from_data(item_data, plan.id)
                if error:
                    db.session.rollback()
                    return jsonify({'error': error}), 400
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
            succession_preference=normalize_succession_preference(data.get('successionPreference', '4')),
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

        # Recalculate fresh — do NOT carry forward old target_value as manual overrides,
        # because the whole point of recalculating is to get correct quantities.
        result = calculate_plant_quantities(
            seed_selections=seed_selections,
            strategy=data.get('strategy', plan.strategy),
            succession_preference=normalize_succession_preference(data.get('successionPreference', plan.succession_preference)),
            user_id=current_user.id
        )

        # Update plan metadata
        if 'strategy' in data:
            plan.strategy = data['strategy']
        if 'successionPreference' in data:
            plan.succession_preference = normalize_succession_preference(data['successionPreference'])

        # Build lookup: seed_inventory_id -> recalculated item
        result_by_seed = {}
        for calc_item in result.get('items', []):
            sid = calc_item.get('seedInventoryId')
            if sid is not None:
                result_by_seed[sid] = calc_item

        # Persist recalculated values back to GardenPlanItem rows
        for item in plan.items:
            calc = result_by_seed.get(item.seed_inventory_id)
            if not calc:
                continue

            new_target = calc['targetValue']

            succession_count = calc.get('successionCount', 1)
            space_per_plant = calculate_space_requirement(
                plant_id=item.plant_id,
                planning_method='square-foot'
            )
            plants_per_planting = new_target / succession_count if succession_count > 1 else new_target

            item.target_value = new_target
            item.plant_equivalent = new_target

            # Update bed_assignments JSON to match the new target quantity
            if item.bed_assignments:
                try:
                    assignments = json.loads(item.bed_assignments) if isinstance(item.bed_assignments, str) else item.bed_assignments
                    if assignments:
                        num_beds = len(assignments)
                        base_qty = int(new_target) // num_beds
                        remainder = int(new_target) % num_beds
                        for idx, assignment in enumerate(assignments):
                            assignment['quantity'] = base_qty + (1 if idx < remainder else 0)
                        item.bed_assignments = json.dumps(assignments)
                except (json.JSONDecodeError, TypeError, KeyError):
                    pass

            item.seeds_required = calc.get('seedsRequired')
            item.seed_packets_required = calc.get('seedPacketsRequired')
            item.succession_enabled = calc.get('successionEnabled', False)
            item.succession_count = succession_count
            item.succession_interval_days = calc.get('successionIntervalDays')
            item.space_required_cells = math.ceil(plants_per_planting * space_per_plant)
            if calc.get('firstPlantDate'):
                item.first_plant_date = datetime.strptime(calc['firstPlantDate'], '%Y-%m-%d').date()
            if calc.get('lastPlantDate'):
                item.last_plant_date = datetime.strptime(calc['lastPlantDate'], '%Y-%m-%d').date()
            if calc.get('harvestWindowStart'):
                item.harvest_window_start = datetime.strptime(calc['harvestWindowStart'], '%Y-%m-%d').date()
            if calc.get('harvestWindowEnd'):
                item.harvest_window_end = datetime.strptime(calc['harvestWindowEnd'], '%Y-%m-%d').date()

        plan.updated_at = datetime.utcnow()
        db.session.commit()

        # Return the updated plan (with persisted values) so frontend can refresh
        return jsonify(plan.to_dict()), 200

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
    """Export garden plan to planting calendar.

    Supports two-phase conflict checking:
    - First call (no body or conflictOverride=false): checks for temporal conflicts
      and returns 409 with conflict details if any found.
    - Second call with conflictOverride=true: proceeds with export regardless of conflicts.
    """
    plan = GardenPlan.query.get(plan_id)

    if not plan or plan.user_id != current_user.id:
        return jsonify({'error': 'Plan not found'}), 404

    try:
        body = request.get_json(silent=True) or {}
        conflict_override = body.get('conflictOverride', False)

        if not conflict_override:
            conflict_result = preview_export_conflicts(plan_id, current_user.id)
            if conflict_result.get('hasConflicts'):
                return jsonify(conflict_result), 409

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


@garden_planner_bp.route('/garden-plans/<int:plan_id>/nutrition', methods=['GET'])
@login_required
def api_plan_nutrition(plan_id):
    """
    Calculate expected nutritional output for a garden plan.

    Uses the unified estimate_nutrition_from_items() method for consistent
    calculation across all nutrition endpoints.

    Returns:
        {
            'totals': { calories, proteinG, carbsG, fatG, ... },
            'byPlant': {
                'tomato': {
                    name, variety, plantEquivalent, successionCount,
                    totalYieldLbs, calories, proteinG, ...
                }
            },
            'missingNutritionData': ['cucumber'],  # Plants without nutrition data
            'year': 2026
        }
    """
    plan = GardenPlan.query.get(plan_id)

    if not plan or plan.user_id != current_user.id:
        return jsonify({'error': 'Plan not found'}), 404

    try:
        from services.nutritional_service import NutritionalService
        nutrition_service = NutritionalService()

        # Convert plan items to format expected by estimate_nutrition_from_items
        items = []
        for item in plan.items:
            items.append({
                'plant_id': item.plant_id,
                'quantity': item.plant_equivalent,
                'succession_count': item.succession_count or 1,
                'variety': item.variety
            })

        # Use unified calculation method
        result = nutrition_service.estimate_nutrition_from_items(
            items=items,
            user_id=current_user.id,
            year=plan.year
        )

        return jsonify(result), 200

    except Exception as e:
        logging.error(f"Error calculating plan nutrition: {e}")
        return jsonify({'error': 'Failed to calculate nutrition'}), 500


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


# ==================== PLANNED PLANTS FOR BED ====================

def _parse_bed_assignments_for_bed(raw_assignments, target_bed_id):
    """
    Parse bed_assignments and return quantity for target_bed_id.

    Handles multiple formats tolerantly:
    - JSON string or already-parsed list/dict
    - Keys: 'bedId' or 'bed_id'
    - List of objects: [{"bedId": 1, "quantity": 10}, ...]
    - Dict-map format: {"1": 10, "2": 5}

    Returns:
        int: Quantity for target_bed_id, or 0 if not found/parseable
    """
    if raw_assignments is None:
        return 0

    assignments = raw_assignments

    # Parse JSON string if needed
    if isinstance(assignments, str):
        try:
            assignments = json.loads(assignments)
        except (json.JSONDecodeError, TypeError):
            return 0

    # Handle dict-map format: {"1": 10, "2": 5}
    if isinstance(assignments, dict):
        # Try string key first, then int key
        qty = assignments.get(str(target_bed_id))
        if qty is None:
            qty = assignments.get(target_bed_id)
        if qty is not None:
            try:
                return int(qty)
            except (ValueError, TypeError):
                return 0
        return 0

    # Handle list-of-objects format: [{"bedId": 1, "quantity": 10}, ...]
    if isinstance(assignments, list):
        for assignment in assignments:
            if not isinstance(assignment, dict):
                continue

            # Check both 'bedId' and 'bed_id' keys
            bed_id = assignment.get('bedId')
            if bed_id is None:
                bed_id = assignment.get('bed_id')

            if bed_id is None:
                continue

            # Compare as int
            try:
                if int(bed_id) == int(target_bed_id):
                    qty = assignment.get('quantity', 0)
                    return int(qty) if qty is not None else 0
            except (ValueError, TypeError):
                continue

    return 0


@garden_planner_bp.route('/garden-plans/<int:plan_id>/beds/<int:bed_id>/items', methods=['GET'])
@login_required
def api_get_planned_items_for_bed(plan_id, bed_id):
    """
    Get GardenPlanItems assigned to a specific bed within a plan.

    This is a read-only endpoint for Garden Designer's "Planned for this Bed" section.
    Only returns items with explicit per-bed quantity in bed_assignments.
    Does NOT guess/invent quantities from legacy data.

    Args:
        plan_id: ID of the garden plan
        bed_id: ID of the garden bed

    Returns:
        200: Array of planned items (may be empty)
        404: Plan not found or doesn't belong to user

    Response shape (camelCase):
        [
            {
                "planItemId": number,
                "seedId": number | null,
                "plantId": string,
                "plantName": string,      // Falls back to plantId if no better name
                "varietyName": string | null,
                "quantityForBed": number,
                "totalQuantity": number,
                "successionCount": number | null,
                "notes": string | null
            }
        ]
    """
    # Verify plan exists and belongs to user
    plan = GardenPlan.query.get(plan_id)
    if not plan or plan.user_id != current_user.id:
        return jsonify({'error': 'Plan not found'}), 404

    try:
        result = []

        for item in plan.items:
            # Get quantity for this specific bed from bed_assignments
            quantity_for_bed = _parse_bed_assignments_for_bed(item.bed_assignments, bed_id)

            # Skip items not explicitly assigned to this bed
            # (No legacy fallback - don't invent quantities)
            if quantity_for_bed <= 0:
                continue

            # Plant name: use plantId as the name
            # Frontend can enhance display using its own plant database
            plant_name = item.plant_id or 'Unknown'

            # Format name nicely if it's an ID like "tomato-1"
            if plant_name and '-' in plant_name:
                # "tomato-1" -> "Tomato"
                base_name = plant_name.rsplit('-', 1)[0]
                plant_name = base_name.replace('-', ' ').title()

            # Resolve days-to-maturity: seed override → plant database → None
            dtm = None
            if item.seed_inventory_id:
                seed = SeedInventory.query.get(item.seed_inventory_id)
                if seed and seed.days_to_maturity is not None:
                    dtm = seed.days_to_maturity
            if dtm is None:
                plant_data = get_plant_by_id(item.plant_id)
                if plant_data:
                    dtm = plant_data.get('daysToMaturity')

            result.append({
                'planItemId': item.id,
                'seedId': item.seed_inventory_id,
                'plantId': item.plant_id,
                'plantName': plant_name,
                'varietyName': item.variety,
                'quantityForBed': quantity_for_bed,
                'totalQuantity': item.plant_equivalent,
                'successionCount': item.succession_count if item.succession_enabled else None,
                'notes': None,  # GardenPlanItem doesn't have a notes field
                'firstPlantDate': item.first_plant_date.isoformat() if item.first_plant_date else None,
                'successionIntervalDays': item.succession_interval_days,
                'harvestWindowStart': item.harvest_window_start.isoformat() if item.harvest_window_start else None,
                'harvestWindowEnd': item.harvest_window_end.isoformat() if item.harvest_window_end else None,
                'daysToMaturity': dtm,
            })

        return jsonify(result), 200

    except Exception as e:
        logging.error(f"Error getting planned items for bed {bed_id} in plan {plan_id}: {e}")
        return jsonify({'error': 'Failed to get planned items', 'details': str(e)}), 500


@garden_planner_bp.route('/garden-planner/season-progress', methods=['GET'])
@login_required
def api_season_progress():
    """
    Get season plan progress with planted vs planned counts.

    Query params:
        year (optional): Filter by year. Defaults to current year.

    Returns:
        200: Progress data with summary, byPlant, and byBed aggregates
    """
    year = request.args.get('year', type=int, default=datetime.now().year)

    # Get all plans for user in this year
    plans = GardenPlan.query.filter_by(user_id=current_user.id, year=year).all()
    if not plans:
        return jsonify({
            'year': year,
            'summary': {'totalPlanned': 0, 'totalAdded': 0, 'totalRemaining': 0},
            'byPlant': {},
            'byBed': {}
        }), 200

    try:
        # Get all plan items
        plan_ids = [p.id for p in plans]
        plan_items = GardenPlanItem.query.filter(
            GardenPlanItem.garden_plan_id.in_(plan_ids)
        ).all()

        if not plan_items:
            return jsonify({
                'year': year,
                'summary': {'totalPlanned': 0, 'totalAdded': 0, 'totalRemaining': 0},
                'byPlant': {},
                'byBed': {}
            }), 200

        # Count placed items per plan_item_id (sum quantity, not just count rows)
        plan_item_ids = [pi.id for pi in plan_items]
        year_start = datetime(year, 1, 1)
        year_end = datetime(year + 1, 1, 1)

        # Date filter: planted this year OR planted_date is NULL (not yet recorded)
        date_filter = or_(
            and_(PlantedItem.planted_date >= year_start, PlantedItem.planted_date < year_end),
            PlantedItem.planted_date.is_(None)
        )

        placed_counts = db.session.query(
            PlantedItem.source_plan_item_id,
            func.coalesce(func.sum(PlantedItem.quantity), 0).label('total_placed')
        ).filter(
            PlantedItem.source_plan_item_id.in_(plan_item_ids),
            PlantedItem.user_id == current_user.id,
            date_filter
        ).group_by(PlantedItem.source_plan_item_id).all()

        placed_by_plan_item = {pc.source_plan_item_id: int(pc.total_placed) for pc in placed_counts}

        # Also get per-bed counts for placed items
        placed_by_plan_item_and_bed = {}
        placed_per_bed_counts = db.session.query(
            PlantedItem.source_plan_item_id,
            PlantedItem.garden_bed_id,
            func.coalesce(func.sum(PlantedItem.quantity), 0).label('total_placed')
        ).filter(
            PlantedItem.source_plan_item_id.in_(plan_item_ids),
            PlantedItem.user_id == current_user.id,
            date_filter
        ).group_by(PlantedItem.source_plan_item_id, PlantedItem.garden_bed_id).all()

        for pc in placed_per_bed_counts:
            key = (pc.source_plan_item_id, pc.garden_bed_id)
            placed_by_plan_item_and_bed[key] = int(pc.total_placed)

        # Precompute placed_by_bed_by_plan_item for O(1) lookups (avoid O(n²))
        # Structure: {planItemId: {bedIdStr: count}}
        placed_by_bed_by_plan_item = {}
        for pc in placed_per_bed_counts:
            plan_item_id = pc.source_plan_item_id
            bed_id_str = str(pc.garden_bed_id)
            if plan_item_id not in placed_by_bed_by_plan_item:
                placed_by_bed_by_plan_item[plan_item_id] = {}
            placed_by_bed_by_plan_item[plan_item_id][bed_id_str] = int(pc.total_placed)

        # --- Fallback: count PlantedItems not matched by the primary query ---
        # Catches two cases:
        #   1. source_plan_item_id IS NULL (placed from PlantPalette)
        #   2. source_plan_item_id references a deleted/stale plan item (plan was recalculated)
        # Match them to current plan items by (plant_id, variety, bed_id) via bed_assignments.
        plan_item_lookup = {}  # (plant_id, variety, bed_id) → plan_item_id (first match wins)
        for item in plan_items:
            if item.bed_assignments:
                try:
                    assignments = json.loads(item.bed_assignments)
                    for a in assignments:
                        bed_id = a.get('bedId')
                        if bed_id is not None:
                            key = (item.plant_id, item.variety or '', bed_id)
                            if key not in plan_item_lookup:
                                plan_item_lookup[key] = item.id
                except (json.JSONDecodeError, TypeError):
                    pass

        if plan_item_lookup:
            unlinked_counts = db.session.query(
                PlantedItem.plant_id,
                PlantedItem.variety,
                PlantedItem.garden_bed_id,
                func.coalesce(func.sum(PlantedItem.quantity), 0).label('total')
            ).filter(
                or_(
                    PlantedItem.source_plan_item_id.is_(None),
                    ~PlantedItem.source_plan_item_id.in_(plan_item_ids)
                ),
                PlantedItem.user_id == current_user.id,
                date_filter
            ).group_by(
                PlantedItem.plant_id, PlantedItem.variety, PlantedItem.garden_bed_id
            ).all()

            for uc in unlinked_counts:
                key = (uc.plant_id, uc.variety or '', uc.garden_bed_id)
                matched_plan_item_id = plan_item_lookup.get(key)
                if matched_plan_item_id:
                    count = int(uc.total)
                    # Add to season total
                    placed_by_plan_item[matched_plan_item_id] = \
                        placed_by_plan_item.get(matched_plan_item_id, 0) + count
                    # Add to per-bed total
                    if matched_plan_item_id not in placed_by_bed_by_plan_item:
                        placed_by_bed_by_plan_item[matched_plan_item_id] = {}
                    bed_str = str(uc.garden_bed_id)
                    placed_by_bed_by_plan_item[matched_plan_item_id][bed_str] = \
                        placed_by_bed_by_plan_item[matched_plan_item_id].get(bed_str, 0) + count
                    # Also update the tuple dict for by_bed aggregation
                    bed_key = (matched_plan_item_id, uc.garden_bed_id)
                    placed_by_plan_item_and_bed[bed_key] = \
                        placed_by_plan_item_and_bed.get(bed_key, 0) + count

        # Get bed names for display
        all_bed_ids = set()
        for item in plan_items:
            if item.bed_assignments:
                try:
                    assignments = json.loads(item.bed_assignments)
                    for a in assignments:
                        all_bed_ids.add(a.get('bedId'))
                except (json.JSONDecodeError, TypeError):
                    pass

        beds = GardenBed.query.filter(
            GardenBed.id.in_(all_bed_ids),
            GardenBed.user_id == current_user.id
        ).all() if all_bed_ids else []
        bed_names = {b.id: b.name for b in beds}

        # Aggregate by plant (keyed by plant_id::variety to avoid merging different varieties)
        by_plant = {}
        # Aggregate by bed (with plants aggregated by plant_id::variety within each bed)
        by_bed = {}
        # Temp dict for bed plant aggregation: {bed_key: {plant_variety_key: {...}}}
        bed_plants_agg = {}

        total_planned = 0
        total_added = 0

        for item in plan_items:
            # Derive planned total from bed_assignments (authoritative source),
            # falling back to plant_equivalent for items without assignments
            item_planned_from_beds = 0
            if item.bed_assignments:
                try:
                    _assignments = json.loads(item.bed_assignments)
                    for _a in _assignments:
                        if _a.get('bedId') is not None:
                            item_planned_from_beds += int(_a.get('quantity') or 0)
                except (json.JSONDecodeError, TypeError, ValueError):
                    pass
            planned = item_planned_from_beds or item.plant_equivalent or 0
            added = placed_by_plan_item.get(item.id, 0)
            remaining = max(0, planned - added)

            total_planned += planned
            total_added += added

            # Format plant name nicely
            plant_name = item.plant_id or 'Unknown'
            if plant_name and '-' in plant_name:
                base_name = plant_name.rsplit('-', 1)[0]
                plant_name = base_name.replace('-', ' ').title()

            # Aggregate by plant (keyed by plant_id::variety to avoid merging different varieties)
            plant_key = f"{item.plant_id}::{item.variety or ''}"
            if plant_key not in by_plant:
                by_plant[plant_key] = {
                    'plantId': item.plant_id,
                    'plantName': plant_name,
                    'variety': item.variety,
                    'planned': 0,
                    'added': 0,
                    'remaining': 0,
                    'planItemIds': []
                }
            by_plant[plant_key]['planned'] += planned
            by_plant[plant_key]['added'] += added
            by_plant[plant_key]['remaining'] += remaining
            by_plant[plant_key]['planItemIds'].append(item.id)

            # Aggregate by bed from bed_assignments
            if item.bed_assignments:
                try:
                    assignments = json.loads(item.bed_assignments)
                    for a in assignments:
                        bed_id = a.get('bedId')
                        bed_planned = a.get('quantity', 0)
                        bed_added = placed_by_plan_item_and_bed.get((item.id, bed_id), 0)
                        bed_remaining = max(0, bed_planned - bed_added)

                        bed_key = str(bed_id)
                        if bed_key not in by_bed:
                            by_bed[bed_key] = {
                                'bedId': bed_id,
                                'bedName': bed_names.get(bed_id, f'Bed {bed_id}'),
                                'planned': 0,
                                'added': 0,
                                'remaining': 0,
                                'plants': []  # Will be populated from bed_plants_agg
                            }
                            bed_plants_agg[bed_key] = {}

                        by_bed[bed_key]['planned'] += bed_planned
                        by_bed[bed_key]['added'] += bed_added
                        by_bed[bed_key]['remaining'] += bed_remaining

                        # Aggregate plant detail within bed by (plant_id, variety)
                        plant_variety_key = f"{item.plant_id}::{item.variety or ''}"
                        if plant_variety_key not in bed_plants_agg[bed_key]:
                            bed_plants_agg[bed_key][plant_variety_key] = {
                                'plantId': item.plant_id,
                                'plantName': plant_name,
                                'variety': item.variety,
                                'planned': 0,
                                'added': 0,
                                'remaining': 0
                            }
                        bed_plants_agg[bed_key][plant_variety_key]['planned'] += bed_planned
                        bed_plants_agg[bed_key][plant_variety_key]['added'] += bed_added
                        bed_plants_agg[bed_key][plant_variety_key]['remaining'] += bed_remaining
                except (json.JSONDecodeError, TypeError):
                    pass

        # Convert bed_plants_agg to lists in by_bed
        for bed_key, plants_dict in bed_plants_agg.items():
            by_bed[bed_key]['plants'] = list(plants_dict.values())

        # Build byPlanItemId for per-plan-item progress tracking (used by sidebar)
        by_plan_item_id = {}
        for item in plan_items:
            # Parse bed_assignments for planned per-bed (with guards)
            planned_by_bed = {}
            if item.bed_assignments:
                try:
                    assignments = json.loads(item.bed_assignments)
                    for a in assignments:
                        bed_id = a.get('bedId')
                        # Skip entries where bedId is null/undefined
                        if bed_id is None:
                            continue
                        # Coerce quantity safely to int
                        qty = int(a.get('quantity') or 0)
                        planned_by_bed[str(bed_id)] = qty
                except (json.JSONDecodeError, TypeError, ValueError):
                    pass

            # Get placed per-bed from precomputed dict (O(1) lookup)
            placed_by_bed = placed_by_bed_by_plan_item.get(item.id, {})

            # Use sum of bed_assignments as authoritative planned total
            # (consistent with per-bed display), falling back to plant_equivalent
            planned_season = sum(planned_by_bed.values()) or item.plant_equivalent or 0
            placed_season = placed_by_plan_item.get(item.id, 0)

            if placed_season > planned_season * 3 and planned_season > 0:
                logging.warning(
                    f"Season progress anomaly: plan_item {item.id} "
                    f"({item.plant_id}::{item.variety}) has "
                    f"placedSeason={placed_season} vs plannedSeason={planned_season}"
                )

            by_plan_item_id[str(item.id)] = {
                'planItemId': item.id,
                'plantId': item.plant_id,
                'variety': item.variety,
                'plannedSeason': planned_season,
                'placedSeason': placed_season,
                'plannedByBed': planned_by_bed,
                'placedByBed': placed_by_bed
            }

        return jsonify({
            'year': year,
            'summary': {
                'totalPlanned': total_planned,
                'totalAdded': total_added,
                'totalRemaining': max(0, total_planned - total_added)
            },
            'byPlant': by_plant,
            'byBed': by_bed,
            'byPlanItemId': by_plan_item_id
        }), 200

    except Exception as e:
        logging.error(f"Error getting season progress for year {year}: {e}")
        return jsonify({'error': 'Failed to get season progress', 'details': str(e)}), 500


# ==================== GARDEN SNAPSHOT ====================

@garden_planner_bp.route('/garden-planner/garden-snapshot', methods=['GET'])
@login_required
def api_garden_snapshot():
    """
    Get a point-in-time inventory of what's physically in the ground.

    Query params:
        date (required): YYYY-MM-DD target date

    Returns:
        {
            "date": "2026-06-15",
            "summary": { "totalPlants": 142, "uniqueVarieties": 24, "bedsWithPlants": 6 },
            "byPlant": {
                "tomato-1::Brandywine": {
                    "plantId": "tomato-1",
                    "plantName": "Tomato",
                    "variety": "Brandywine",
                    "totalQuantity": 12,
                    "beds": [{"bedId": 1, "bedName": "Raised Bed A", "quantity": 8}]
                }
            }
        }
    """
    date_str = request.args.get('date')
    if not date_str:
        return jsonify({'error': 'date parameter is required (YYYY-MM-DD)'}), 400

    try:
        target_date = parse_iso_date(date_str)
    except Exception:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    try:
        # Query PlantedItems active on the target date:
        # - planted_date <= target_date (already in the ground)
        # - For seed-saving plants: use seed_maturity_date as end date
        # - For normal plants: harvest_date IS NULL OR harvest_date >= target_date
        items = PlantedItem.query.filter(
            PlantedItem.user_id == current_user.id,
            PlantedItem.planted_date <= target_date,
            db.or_(
                # Non-seed-saving plants: use harvest_date
                db.and_(
                    PlantedItem.save_for_seed == False,
                    db.or_(
                        PlantedItem.harvest_date.is_(None),
                        PlantedItem.harvest_date >= target_date
                    )
                ),
                # Seed-saving plants: use seed_maturity_date
                db.and_(
                    PlantedItem.save_for_seed == True,
                    db.or_(
                        PlantedItem.seed_maturity_date.is_(None),
                        PlantedItem.seed_maturity_date >= target_date
                    )
                )
            )
        ).all()

        # Get all bed IDs referenced by these items
        bed_ids = set(item.garden_bed_id for item in items)
        beds = GardenBed.query.filter(
            GardenBed.id.in_(bed_ids),
            GardenBed.user_id == current_user.id
        ).all() if bed_ids else []
        bed_names = {b.id: b.name for b in beds}

        # Aggregate by plant_id::variety
        by_plant = {}
        beds_with_plants = set()

        for item in items:
            variety = item.variety or ''
            key = f"{item.plant_id}::{variety}"

            if key not in by_plant:
                # Resolve plant name from database
                plant_data = get_plant_by_id(item.plant_id)
                plant_name = plant_data['name'] if plant_data else item.plant_id
                by_plant[key] = {
                    'plantId': item.plant_id,
                    'plantName': plant_name,
                    'variety': item.variety,
                    'totalQuantity': 0,
                    'beds': {}
                }

            by_plant[key]['totalQuantity'] += item.quantity
            beds_with_plants.add(item.garden_bed_id)

            # Accumulate per-bed quantity
            bed_id = item.garden_bed_id
            if bed_id not in by_plant[key]['beds']:
                by_plant[key]['beds'][bed_id] = {
                    'bedId': bed_id,
                    'bedName': bed_names.get(bed_id, f'Bed {bed_id}'),
                    'quantity': 0
                }
            by_plant[key]['beds'][bed_id]['quantity'] += item.quantity

        # Convert beds dicts to lists
        for key in by_plant:
            by_plant[key]['beds'] = list(by_plant[key]['beds'].values())

        total_plants = sum(entry['totalQuantity'] for entry in by_plant.values())

        return jsonify({
            'date': date_str,
            'summary': {
                'totalPlants': total_plants,
                'uniqueVarieties': len(by_plant),
                'bedsWithPlants': len(beds_with_plants)
            },
            'byPlant': by_plant
        }), 200

    except Exception as e:
        logging.error(f"Error getting garden snapshot for {date_str}: {e}")
        return jsonify({'error': 'Failed to get garden snapshot', 'details': str(e)}), 500


# ==================== DESIGNER SYNC HELPERS ====================

def _find_auto_plan_item(plan_id, plant_id, variety):
    """Find an auto-status GardenPlanItem matching plant_id + variety in a plan."""
    items = GardenPlanItem.query.filter_by(
        garden_plan_id=plan_id,
        plant_id=plant_id,
        status='auto'
    ).all()
    for item in items:
        if (item.variety or None) == (variety or None):
            return item
    return None


def _adjust_auto_plan_item(plan_item, bed_id, quantity_delta):
    """
    Adjust an auto plan item's bed_assignments and plant_equivalent.

    Returns 'updated' if the item still exists, 'deleted' if plant_equivalent hit 0.
    """
    # Parse bed_assignments
    bed_assignments = []
    if plan_item.bed_assignments:
        try:
            bed_assignments = json.loads(plan_item.bed_assignments)
        except (json.JSONDecodeError, TypeError):
            bed_assignments = []

    # Find entry with matching bedId
    found = False
    for entry in bed_assignments:
        if entry.get('bedId') == bed_id:
            entry['quantity'] = (entry.get('quantity', 0) or 0) + quantity_delta
            if entry['quantity'] <= 0:
                bed_assignments.remove(entry)
            found = True
            break

    if not found and quantity_delta > 0:
        bed_assignments.append({'bedId': bed_id, 'quantity': quantity_delta})

    # Update totals
    plan_item.plant_equivalent = max(0, (plan_item.plant_equivalent or 0) + quantity_delta)
    plan_item.target_value = float(plan_item.plant_equivalent)

    # Recompute seeds_required using default rates for auto items
    plan_item.seeds_required = _calculate_seeds_needed(plan_item.plant_equivalent, 0.85, 0.90)

    # Save bed_assignments back
    plan_item.bed_assignments = json.dumps(bed_assignments) if bed_assignments else None

    # If plant_equivalent hit 0, delete the item
    if plan_item.plant_equivalent <= 0:
        db.session.delete(plan_item)
        return 'deleted'

    return 'updated'


# ==================== DESIGNER SYNC ====================

@garden_planner_bp.route('/garden-plans/<int:plan_id>/designer-sync', methods=['POST'])
@login_required
def api_designer_sync(plan_id):
    """
    Sync a Designer placement with the garden plan.

    Supports two actions:
    - 'add' (default): Ensure a plan item exists and increment quantity
    - 'remove': Decrement quantity on an auto plan item

    Request JSON:
        action (str, optional): 'add' (default) or 'remove'
        plantId (str): Plant database ID (e.g. 'tomato-1')
        variety (str, optional): Variety name
        bedId (int): Garden bed ID where plant is being placed
        quantity (int): Number of plants being placed/removed
        seedInventoryId (int, optional): Linked seed inventory item

    Returns:
        { planItemId: int, created: bool, planItem: dict }
    """
    try:
        # Validate plan ownership
        plan = GardenPlan.query.get_or_404(plan_id)
        if plan.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body required'}), 400

        action = data.get('action', 'add')
        plant_id = data.get('plantId')
        variety = data.get('variety')
        bed_id = data.get('bedId')
        quantity = data.get('quantity', 1)
        seed_inventory_id = data.get('seedInventoryId')

        if not plant_id:
            return jsonify({'error': 'plantId is required'}), 400
        if not bed_id:
            return jsonify({'error': 'bedId is required'}), 400

        # Validate bed ownership
        bed = GardenBed.query.get(bed_id)
        if not bed or bed.user_id != current_user.id:
            return jsonify({'error': 'Garden bed not found or unauthorized'}), 404

        # ---- ACTION: REMOVE ----
        if action == 'remove':
            auto_item = _find_auto_plan_item(plan_id, plant_id, variety)
            if not auto_item:
                return jsonify({'removed': False}), 200

            result = _adjust_auto_plan_item(auto_item, bed_id, -quantity)
            db.session.commit()

            return jsonify({
                'planItemId': auto_item.id if result == 'updated' else None,
                'removed': True,
                'deleted': result == 'deleted'
            }), 200

        # ---- ACTION: ADD (default) ----
        # Search ALL items matching plant_id + variety (not just auto)
        existing_items = GardenPlanItem.query.filter_by(
            garden_plan_id=plan_id,
            plant_id=plant_id
        ).all()

        # Find matching item (any status) for this plant+variety
        existing_match = None
        for item in existing_items:
            if (item.variety or None) == (variety or None):
                existing_match = item
                break  # Use first match (prefer exact variety match)

        # If a matching item exists, increment its quantity
        if existing_match:
            _adjust_auto_plan_item(existing_match, bed_id, +quantity)

            # Set seed_inventory_id if provided and currently null
            if seed_inventory_id is not None and existing_match.seed_inventory_id is None:
                existing_match.seed_inventory_id = seed_inventory_id

            db.session.commit()

            return jsonify({
                'planItemId': existing_match.id,
                'created': False,
                'planItem': existing_match.to_dict()
            }), 200

        # Nothing found - create new auto item
        new_item = GardenPlanItem(
            garden_plan_id=plan_id,
            plant_id=plant_id,
            variety=variety or None,
            unit_type='plants',
            target_value=float(quantity),
            plant_equivalent=quantity,
            seeds_required=_calculate_seeds_needed(quantity, 0.85, 0.90),
            bed_assignments=json.dumps([{'bedId': bed_id, 'quantity': quantity}]),
            allocation_mode='custom',
            status='auto',
            succession_enabled=False,
            succession_count=1,
        )

        if seed_inventory_id is not None:
            new_item.seed_inventory_id = seed_inventory_id

        db.session.add(new_item)
        db.session.commit()

        logging.info(f"Designer sync: created auto plan item {new_item.id} for {plant_id} in plan {plan_id}")

        return jsonify({
            'planItemId': new_item.id,
            'created': True,
            'planItem': new_item.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error in designer sync for plan {plan_id}: {e}")
        return jsonify({'error': 'Failed to sync with plan', 'details': str(e)}), 500
