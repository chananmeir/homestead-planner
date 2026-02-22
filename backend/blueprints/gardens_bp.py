"""
Gardens Blueprint

Routes for garden beds, planted items, and planting events.
This blueprint handles all CRUD operations for garden-related entities.
"""
import json
import logging
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from sqlalchemy import or_, and_, cast

from models import db, GardenBed, PlantedItem, PlantingEvent, IndoorSeedStart, GardenPlanItem, GardenPlan, SeedInventory
from sqlalchemy import func as sa_func
from plant_database import get_plant_by_id
from blueprints.garden_planner_bp import _adjust_auto_plan_item
from garden_methods import GARDEN_METHODS
from conflict_checker import has_conflict, validate_planting_conflict, get_primary_planting_date, query_candidate_items
from services.space_calculator import calculate_space_requirement
from utils.helpers import parse_iso_date

# Validation constants
VALID_SUN_EXPOSURES = ['full', 'partial', 'shade']

# Create blueprint
gardens_bp = Blueprint('gardens', __name__, url_prefix='/api')


# ==================== GARDEN BEDS ROUTES ====================

@gardens_bp.route('/garden-beds', methods=['GET', 'POST'])
@login_required
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

        # Get soil type and mulch type
        soil_type = data.get('soilType', 'loamy')
        mulch_type = data.get('mulchType', 'none')

        # Get height (default to 12" for standard raised bed)
        height = data.get('height', 12.0)
        try:
            height = float(height)
        except (ValueError, TypeError):
            height = 12.0

        # Get grid size based on method
        grid_size = GARDEN_METHODS.get(planning_method, {}).get('gridSize', 12)

        # Auto-generate name if not provided
        name = data.get('name') or f"{width}' x {length}' Bed"

        # Handle season extension (protection structure)
        season_extension = data.get('seasonExtension')
        season_extension_json = None
        if season_extension:
            season_extension_json = json.dumps(season_extension)

        # Get zone (permaculture zone 0-5)
        zone = data.get('zone')

        try:
            bed = GardenBed(
                user_id=current_user.id,  # Set owner
                name=name,
                width=width,
                length=length,
                height=height,
                location=data.get('location', ''),
                sun_exposure=sun_exposure,
                soil_type=soil_type,
                mulch_type=mulch_type,
                planning_method=planning_method,
                grid_size=grid_size,
                season_extension=season_extension_json,
                zone=zone
            )
            db.session.add(bed)
            db.session.commit()
            return jsonify(bed.to_dict()), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Database error: {str(e)}'}), 500

    # GET: Filter by current user
    beds = GardenBed.query.filter_by(user_id=current_user.id).all()
    return jsonify([bed.to_dict() for bed in beds])


@gardens_bp.route('/garden-beds/<int:bed_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def garden_bed(bed_id):
    """Get, update, or delete a specific garden bed"""
    bed = GardenBed.query.get_or_404(bed_id)

    # Verify ownership
    if bed.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    if request.method == 'DELETE':
        db.session.delete(bed)
        db.session.commit()
        return '', 204

    if request.method == 'PUT':
        data = request.json
        bed.name = data.get('name', bed.name)
        bed.width = data.get('width', bed.width)
        bed.length = data.get('length', bed.length)
        bed.height = data.get('height', bed.height)
        bed.location = data.get('location', bed.location)
        bed.sun_exposure = data.get('sunExposure', bed.sun_exposure)
        bed.soil_type = data.get('soilType', bed.soil_type)
        bed.mulch_type = data.get('mulchType', bed.mulch_type)
        bed.planning_method = data.get('planningMethod', bed.planning_method)

        # Update zone if provided
        if 'zone' in data:
            bed.zone = data.get('zone')

        # Auto-set grid size based on planning method (same as CREATE)
        bed.grid_size = GARDEN_METHODS.get(bed.planning_method, {}).get('gridSize', 12)

        # Handle season extension update
        if 'seasonExtension' in data:
            season_ext = data.get('seasonExtension')
            bed.season_extension = json.dumps(season_ext) if season_ext else None

        db.session.commit()

    return jsonify(bed.to_dict())


# ==================== PLANTED ITEMS ROUTES ====================

@gardens_bp.route('/planted-items', methods=['POST'])
@login_required
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

        # Verify garden bed exists and user owns it
        bed = GardenBed.query.get(data['gardenBedId'])
        if not bed:
            return jsonify({'error': f'Garden bed with ID {data["gardenBedId"]} not found'}), 404

        if bed.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        position = data.get('position', {})
        planted_date = parse_iso_date(data.get('plantedDate')) or datetime.now()

        # Get plant data to determine planting method and calculate dates
        plant = get_plant_by_id(data['plantId'])

        # Auto-detect planting method based on plant characteristics
        # If plant can be started indoors (weeksIndoors > 0), default to 'transplant'
        # Otherwise, default to 'direct'
        weeks_indoors = plant.get('weeksIndoors', 0) if plant else 0
        default_method = 'transplant' if weeks_indoors > 0 else 'direct'
        planting_method = data.get('plantingMethod', default_method)

        print(f"[DRAG-DROP FIX] Plant: {data['plantId']}, weeksIndoors: {weeks_indoors}, method: {planting_method}")

        # Validate sourcePlanItemId ownership if provided
        source_plan_item_id = data.get('sourcePlanItemId')
        if source_plan_item_id is not None:
            plan_item = GardenPlanItem.query.get(source_plan_item_id)
            if not plan_item:
                return jsonify({'error': f'GardenPlanItem {source_plan_item_id} not found'}), 400
            plan = GardenPlan.query.get(plan_item.garden_plan_id)
            if not plan or plan.user_id != current_user.id:
                return jsonify({'error': 'Unauthorized: plan item belongs to another user'}), 400

        # Compute expected harvest date for both PlantedItem and PlantingEvent
        expected_harvest = planted_date
        if plant and plant.get('daysToMaturity') is not None:
            expected_harvest = planted_date + timedelta(days=plant['daysToMaturity'])

        item = PlantedItem(
            user_id=current_user.id,  # Set owner
            plant_id=data['plantId'],
            variety=data.get('variety'),  # Optional variety field
            garden_bed_id=data['gardenBedId'],
            planted_date=planted_date,
            harvest_date=expected_harvest if expected_harvest != planted_date else None,
            quantity=data.get('quantity', 1),
            status=data.get('status', 'planned'),
            notes=data.get('notes', ''),
            position_x=position.get('x', 0),
            position_y=position.get('y', 0),
            source_plan_item_id=source_plan_item_id
        )
        db.session.add(item)

        # Set date fields based on planting method
        planting_event = PlantingEvent(
            user_id=current_user.id,
            plant_id=data['plantId'],
            variety=data.get('variety'),
            garden_bed_id=data['gardenBedId'],
            direct_seed_date=planted_date if planting_method == 'direct' else None,
            transplant_date=planted_date if planting_method == 'transplant' else None,
            expected_harvest_date=expected_harvest,
            position_x=position.get('x', 0),
            position_y=position.get('y', 0),
            notes=data.get('notes', '')
        )

        # Server-side conflict enforcement for auto-created planting event
        # Use only in-ground dates for spatial conflict checking
        # seed_start_date is indoor-only and doesn't occupy bed space
        start_date = planting_event.transplant_date or planting_event.direct_seed_date

        if start_date and planting_event.expected_harvest_date and planting_event.garden_bed_id:
            # Prevent autoflush — the PlantedItem already in session would
            # revive orphaned PlantingEvents during the EXISTS subquery.
            with db.session.no_autoflush:
                is_valid, error_response = validate_planting_conflict({
                    'garden_bed_id': planting_event.garden_bed_id,
                    'position_x': planting_event.position_x,
                    'position_y': planting_event.position_y,
                    'plant_id': planting_event.plant_id,
                    'transplant_date': planting_event.transplant_date,
                    'direct_seed_date': planting_event.direct_seed_date,
                    'seed_start_date': planting_event.seed_start_date,
                    'start_date': start_date,
                    'end_date': planting_event.expected_harvest_date,
                    'conflict_override': False  # PlantedItems don't have override flag currently
                }, current_user.id)

            if not is_valid:
                db.session.rollback()  # Rollback PlantedItem too
                return jsonify(error_response), 409

        db.session.add(planting_event)

        db.session.commit()
        return jsonify(item.to_dict()), 201
    except KeyError as e:
        db.session.rollback()
        return jsonify({'error': f'Missing required field: {str(e)}'}), 400
    except Exception as e:
        db.session.rollback()
        # Safe error message handling (avoid Unicode encoding issues on Windows)
        try:
            error_msg = str(e)
        except UnicodeEncodeError:
            error_msg = repr(e)  # Fallback to repr if str() fails
        return jsonify({'error': f'Database error: {error_msg}'}), 500


@gardens_bp.route('/planted-items/batch', methods=['POST'])
@login_required
def batch_add_planted_items():
    """
    Create multiple planted items in a single transaction.

    Request body:
    {
        "gardenBedId": 1,
        "plantId": "kale",
        "variety": "Lacinato",
        "plantedDate": "2025-01-15",
        "plantingMethod": "direct",
        "status": "planned",
        "notes": "Auto-placed succession",
        "positions": [
            {"x": 0, "y": 0, "quantity": 1},
            {"x": 1, "y": 0, "quantity": 1},
            {"x": 2, "y": 0, "quantity": 1}
        ]
    }

    Returns: {"created": 3, "items": [...]}
    """
    try:
        data = request.json

        # Extract succession group ID if provided
        succession_group_id = data.get('successionGroupId')

        # Extract seed density data if provided (for MIGardener method)
        seed_density_data = data.get('seedDensityData', {})
        seed_planting_method = seed_density_data.get('plantingMethod', 'individual_plants')

        # Validation
        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        required_fields = ['plantId', 'gardenBedId', 'positions']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400

        if not isinstance(data['positions'], list) or len(data['positions']) == 0:
            return jsonify({'error': 'positions must be a non-empty array'}), 400

        # Verify garden bed exists and user owns it
        bed = GardenBed.query.get(data['gardenBedId'])
        if not bed:
            return jsonify({'error': f'Garden bed with ID {data["gardenBedId"]} not found'}), 404

        if bed.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Validate sourcePlanItemId ownership if provided
        source_plan_item_id = data.get('sourcePlanItemId')
        if source_plan_item_id is not None:
            plan_item = GardenPlanItem.query.get(source_plan_item_id)
            if not plan_item:
                return jsonify({'error': f'GardenPlanItem {source_plan_item_id} not found'}), 400
            plan = GardenPlan.query.get(plan_item.garden_plan_id)
            if not plan or plan.user_id != current_user.id:
                return jsonify({'error': 'Unauthorized: plan item belongs to another user'}), 400

        # Get plant data
        plant = get_plant_by_id(data['plantId'])
        if not plant:
            return jsonify({'error': f'Plant with ID {data["plantId"]} not found'}), 404

        planted_date = parse_iso_date(data.get('plantedDate')) or datetime.now()

        # Auto-detect planting method
        weeks_indoors = plant.get('weeksIndoors', 0) if plant else 0
        default_method = 'transplant' if weeks_indoors > 0 else 'direct'
        planting_method = data.get('plantingMethod', default_method)

        # DEBUG: Log what dates are being used
        print(f"[DEBUG] PLANTING METHOD: {planting_method}, plantedDate from request: {data.get('plantedDate')}, parsed: {planted_date}")

        # Calculate expected harvest date
        expected_harvest = planted_date
        if plant and plant.get('daysToMaturity') is not None:
            expected_harvest = planted_date + timedelta(days=plant['daysToMaturity'])

        # Create all items in transaction
        created_items = []

        # DEBUG: Log incoming positions
        print(f"=== BACKEND BATCH DEBUG ===")
        print(f"Received {len(data['positions'])} positions:")
        for i, pos in enumerate(data['positions']):
            print(f"  Position {i}: x={pos.get('x')}, y={pos.get('y')}, quantity={pos.get('quantity')}")

        # DEBUG: Log existing PlantingEvents in this bed BEFORE creating new ones
        existing_events = PlantingEvent.query.filter_by(
            garden_bed_id=data['gardenBedId'],
            user_id=current_user.id
        ).all()
        print(f"[STATS] BEFORE batch create: {len(existing_events)} existing PlantingEvents in bed {data['gardenBedId']}")
        for evt in existing_events[:5]:  # Show first 5
            print(f"  - Event {evt.id}: plant={evt.plant_id}, variety={evt.variety}, pos=({evt.position_x},{evt.position_y}), transplant={evt.transplant_date}")

        for i, pos in enumerate(data['positions']):
            if 'x' not in pos or 'y' not in pos:
                return jsonify({'error': 'Each position must have x and y coordinates'}), 400

            # Per-position date support (for date-staggered planting)
            pos_planted_date = planted_date
            if pos.get('plantedDate'):
                pos_planted_date = parse_iso_date(pos['plantedDate']) or planted_date

            # Per-position harvest date
            pos_expected_harvest = pos_planted_date
            if plant and plant.get('daysToMaturity') is not None:
                pos_expected_harvest = pos_planted_date + timedelta(days=plant['daysToMaturity'])

            # Create PlantedItem
            print(f"Creating PlantedItem {i+1}/{len(data['positions'])} at ({pos['x']}, {pos['y']}) with quantity={pos.get('quantity', 1)}, date={pos_planted_date}")
            item = PlantedItem(
                user_id=current_user.id,
                plant_id=data['plantId'],
                variety=data.get('variety'),
                garden_bed_id=data['gardenBedId'],
                planted_date=pos_planted_date,
                harvest_date=pos_expected_harvest if pos_expected_harvest != pos_planted_date else None,
                quantity=pos.get('quantity', 1),
                status=data.get('status', 'planned'),
                notes=data.get('notes', ''),
                position_x=pos['x'],
                position_y=pos['y'],
                source_plan_item_id=source_plan_item_id
            )
            # Don't add item to session yet — autoflush during validation
            # would make orphaned PlantingEvents appear to have matching
            # PlantedItems, causing false 409 conflicts (asparagus bug).

            # Create corresponding PlantingEvent
            planting_event = PlantingEvent(
                user_id=current_user.id,
                plant_id=data['plantId'],
                variety=data.get('variety'),
                garden_bed_id=data['gardenBedId'],
                direct_seed_date=pos_planted_date if planting_method == 'direct' else None,
                transplant_date=pos_planted_date if planting_method == 'transplant' else None,
                expected_harvest_date=pos_expected_harvest,
                position_x=pos['x'],
                position_y=pos['y'],
                notes=data.get('notes', ''),
                succession_planting=bool(succession_group_id),
                succession_group_id=succession_group_id,
                # Seed density fields (for MIGardener method)
                planting_method=seed_planting_method,
                quantity=pos.get('quantity') if seed_planting_method == 'individual_plants' else seed_density_data.get('expectedFinalCount'),
                spacing=seed_density_data.get('spacing'),
                seed_count=seed_density_data.get('seedCount'),
                expected_germination_rate=seed_density_data.get('expectedGerminationRate'),
                expected_survival_rate=seed_density_data.get('expectedSurvivalRate'),
                expected_final_count=seed_density_data.get('expectedFinalCount'),
                harvest_method=seed_density_data.get('harvestMethod'),
                # Planting style (row-based vs broadcast)
                planting_style=seed_density_data.get('plantingStyle'),
                # Row-based seed density fields (only used for row-based)
                seed_density=seed_density_data.get('seedDensity'),
                ui_segment_length_inches=seed_density_data.get('uiSegmentLengthInches'),
                row_group_id=seed_density_data.get('rowGroupId'),
                row_segment_index=seed_density_data.get('rowSegmentIndex'),
                total_row_segments=seed_density_data.get('totalRowSegments'),
                # Broadcast seed density fields (only used for broadcast)
                seed_density_per_sq_ft=seed_density_data.get('seedDensityPerSqFt'),
                grid_cell_area_inches=seed_density_data.get('gridCellAreaInches'),
                # Plant-spacing seed density fields (only used for plant-spacing)
                seeds_per_spot=seed_density_data.get('seedsPerSpot'),
                plants_kept_per_spot=seed_density_data.get('plantsKeptPerSpot'),
                # MIGardener physical row number
                row_number=data.get('rowNumber')
            )

            # Server-side conflict enforcement for batch operation
            # Use only in-ground dates for spatial conflict checking
            # seed_start_date is indoor-only and doesn't occupy bed space
            start_date = planting_event.transplant_date or planting_event.direct_seed_date

            # Get conflict_override from request data
            conflict_override = data.get('conflictOverride', False)

            if start_date and planting_event.expected_harvest_date and planting_event.garden_bed_id:
                # Prevent autoflush during validation — previous iterations'
                # PlantedItems in the session would get flushed to DB, "reviving"
                # orphaned PlantingEvents and causing false 409 conflicts.
                with db.session.no_autoflush:
                    is_valid, error_response = validate_planting_conflict({
                        'garden_bed_id': planting_event.garden_bed_id,
                        'position_x': planting_event.position_x,
                        'position_y': planting_event.position_y,
                        'plant_id': planting_event.plant_id,
                        'transplant_date': planting_event.transplant_date,
                        'direct_seed_date': planting_event.direct_seed_date,
                        'seed_start_date': planting_event.seed_start_date,
                        'start_date': start_date,
                        'end_date': planting_event.expected_harvest_date,
                        'conflict_override': conflict_override  # Use value from request
                    }, current_user.id)

                if not is_valid:
                    db.session.rollback()  # Rollback entire batch
                    conflict_details = error_response.get('message', 'Conflict detected')
                    conflicts = error_response.get('conflicts', [])
                    print(f"[ERROR] CONFLICT at position ({pos['x']}, {pos['y']})")
                    print(f"   Details: {conflict_details}")
                    print(f"   Conflicts: {conflicts}")
                    print(f"   Full error response: {error_response}")
                    return jsonify({
                        **error_response,
                        'failed_at_index': i,  # Which item in batch failed
                        'failed_position': {'x': pos['x'], 'y': pos['y']},
                        'message': f"Batch creation failed at position ({pos['x']}, {pos['y']}). {conflict_details}"
                    }), 409

            db.session.add(item)
            db.session.add(planting_event)
            created_items.append(item)

        # Commit transaction (all-or-nothing)
        db.session.commit()

        # DEBUG: Check if existing events were modified
        existing_events_after = PlantingEvent.query.filter_by(
            garden_bed_id=data['gardenBedId'],
            user_id=current_user.id
        ).all()
        print(f"[STATS] AFTER batch create: {len(existing_events_after)} PlantingEvents in bed {data['gardenBedId']}")
        for evt in existing_events_after[:5]:  # Show first 5
            print(f"  - Event {evt.id}: plant={evt.plant_id}, variety={evt.variety}, pos=({evt.position_x},{evt.position_y}), transplant={evt.transplant_date}")

        print(f"[SUCCESS] Successfully created {len(created_items)} items")
        for item in created_items:
            print(f"  - Item {item.id} at ({item.position_x}, {item.position_y}) with quantity={item.quantity}")

        return jsonify({
            'created': len(created_items),
            'items': [item.to_dict() for item in created_items]
        }), 201

    except KeyError as e:
        db.session.rollback()
        return jsonify({'error': f'Missing required field: {str(e)}'}), 400
    except Exception as e:
        db.session.rollback()
        # Safe error message handling (avoid Unicode encoding issues on Windows)
        try:
            error_msg = str(e)
        except UnicodeEncodeError:
            error_msg = repr(e)  # Fallback to repr if str() fails
        return jsonify({'error': f'Database error: {error_msg}'}), 500


@gardens_bp.route('/garden-beds/<int:bed_id>/planted-items/date/<date_str>', methods=['DELETE'])
@login_required
def clear_bed_by_date(bed_id, date_str):
    """Remove planted items from a garden bed for a specific date (preserves historical plantings from other dates)"""
    bed = GardenBed.query.get_or_404(bed_id)

    # Verify ownership
    if bed.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    # Parse the date
    try:
        target_date = parse_iso_date(date_str) if 'T' in date_str or 'Z' in date_str else datetime.strptime(date_str, '%Y-%m-%d')
        # Use end of day to include events planted on that day
        if 'T' not in date_str:
            end_of_day = target_date.replace(hour=23, minute=59, second=59)
        else:
            end_of_day = target_date
    except (ValueError, TypeError) as e:
        return jsonify({'error': f'Invalid date format: {str(e)}'}), 400

    # Query PlantingEvents active on the target date using the same logic as the planting events endpoint
    # An event is active if: planted before/on target_date AND (not harvested OR harvested after/on target_date)
    query = PlantingEvent.query.filter_by(
        garden_bed_id=str(bed_id),
        user_id=current_user.id
    ).filter(
        # Must have started by target_date (any plant date <= target_date)
        or_(
            and_(PlantingEvent.seed_start_date.isnot(None), PlantingEvent.seed_start_date <= end_of_day),
            and_(PlantingEvent.transplant_date.isnot(None), PlantingEvent.transplant_date <= end_of_day),
            and_(PlantingEvent.direct_seed_date.isnot(None), PlantingEvent.direct_seed_date <= end_of_day)
        )
    ).filter(
        # Must NOT be harvested yet, OR harvested after/on target_date (use actual_harvest_date for tracking mode)
        or_(
            PlantingEvent.actual_harvest_date.is_(None),
            PlantingEvent.actual_harvest_date >= target_date
        )
    )

    # Get the events to delete
    events_to_delete = query.all()
    count = len(events_to_delete)

    # BUGFIX: Delete related indoor seed starts FIRST (before deleting PlantingEvents)
    event_ids = [e.id for e in events_to_delete]
    if event_ids:
        IndoorSeedStart.query.filter(
            IndoorSeedStart.planting_event_id.in_(event_ids),
            IndoorSeedStart.user_id == current_user.id
        ).delete(synchronize_session=False)

    # Collect unique positions to delete corresponding PlantedItems
    positions_to_delete = set()
    for event in events_to_delete:
        if event.position_x is not None and event.position_y is not None:
            positions_to_delete.add((event.position_x, event.position_y))

    # Pre-aggregate plan item quantities from PlantedItems that will be deleted
    # Gather affected items before deletion
    affected_plan_item_totals = {}
    if positions_to_delete:
        for pos_x, pos_y in positions_to_delete:
            items_at_pos = PlantedItem.query.filter_by(
                garden_bed_id=bed_id,
                position_x=pos_x,
                position_y=pos_y,
                user_id=current_user.id
            ).filter(PlantedItem.source_plan_item_id.isnot(None)).all()
            for pi in items_at_pos:
                key = pi.source_plan_item_id
                affected_plan_item_totals[key] = affected_plan_item_totals.get(key, 0) + (pi.quantity or 1)

    # Delete the PlantingEvents
    query.delete(synchronize_session=False)

    # Delete PlantedItems at those positions
    for pos_x, pos_y in positions_to_delete:
        PlantedItem.query.filter_by(
            garden_bed_id=bed_id,
            position_x=pos_x,
            position_y=pos_y,
            user_id=current_user.id
        ).delete(synchronize_session=False)

    # Commit deletions first so they persist even if plan adjustment fails
    db.session.commit()

    # Decrement linked plan items (best-effort, non-blocking)
    for plan_item_id, total_qty in affected_plan_item_totals.items():
        try:
            plan_item = GardenPlanItem.query.get(plan_item_id)
            if plan_item:
                _adjust_auto_plan_item(plan_item, bed_id, -int(total_qty))
        except Exception as e:
            logging.warning(f"Failed to adjust plan item {plan_item_id} after clearing by date: {e}")

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logging.warning(f"Failed to commit plan item adjustments: {e}")

    return jsonify({
        'message': f'Cleared {count} planting(s) and related indoor starts from {date_str}',
        'count': count,
        'date': date_str
    }), 200


@gardens_bp.route('/garden-beds/<int:bed_id>/planted-items/plant/<plant_id>', methods=['DELETE'])
@login_required
def remove_all_by_plant(bed_id, plant_id):
    """Remove all planted items of a specific plant type (and optionally variety) from a garden bed"""
    bed = GardenBed.query.get_or_404(bed_id)

    # Verify ownership
    if bed.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    variety = request.args.get('variety')

    # Build filter for matching PlantedItems
    item_filter = PlantedItem.query.filter_by(
        garden_bed_id=bed_id, plant_id=plant_id, user_id=current_user.id
    )
    if variety:
        item_filter = item_filter.filter_by(variety=variety)

    matching_items = item_filter.all()
    count = len(matching_items)

    if count == 0:
        return jsonify({'message': 'No matching plants found', 'count': 0}), 200

    # Pre-aggregate plan item quantities for decrement after deletion
    agg_filter = db.session.query(
        PlantedItem.source_plan_item_id,
        sa_func.coalesce(sa_func.sum(PlantedItem.quantity), 0)
    ).filter_by(
        garden_bed_id=bed_id, plant_id=plant_id, user_id=current_user.id
    ).filter(
        PlantedItem.source_plan_item_id.isnot(None)
    )
    if variety:
        agg_filter = agg_filter.filter_by(variety=variety)
    affected = agg_filter.group_by(PlantedItem.source_plan_item_id).all()

    # Collect positions to delete matching PlantingEvents
    positions = [(item.position_x, item.position_y) for item in matching_items]

    # Delete IndoorSeedStarts linked to matching PlantingEvents
    for pos_x, pos_y in positions:
        events = PlantingEvent.query.filter_by(
            garden_bed_id=str(bed_id),
            plant_id=plant_id,
            position_x=pos_x,
            position_y=pos_y,
            user_id=current_user.id
        ).all()
        event_ids = [e.id for e in events]
        if event_ids:
            IndoorSeedStart.query.filter(
                IndoorSeedStart.planting_event_id.in_(event_ids),
                IndoorSeedStart.user_id == current_user.id
            ).delete(synchronize_session=False)

    # Delete matching PlantingEvents
    for pos_x, pos_y in positions:
        pe_filter = PlantingEvent.query.filter_by(
            garden_bed_id=str(bed_id),
            plant_id=plant_id,
            position_x=pos_x,
            position_y=pos_y,
            user_id=current_user.id
        )
        if variety:
            pe_filter = pe_filter.filter_by(variety=variety)
        pe_filter.delete(synchronize_session=False)

    # Delete matching PlantedItems
    delete_filter = PlantedItem.query.filter_by(
        garden_bed_id=bed_id, plant_id=plant_id, user_id=current_user.id
    )
    if variety:
        delete_filter = delete_filter.filter_by(variety=variety)
    delete_filter.delete(synchronize_session=False)

    # Commit deletions first so they persist even if plan adjustment fails
    db.session.commit()

    # Decrement linked plan items (best-effort, non-blocking)
    for plan_item_id, total_qty in affected:
        try:
            plan_item = GardenPlanItem.query.get(plan_item_id)
            if plan_item:
                _adjust_auto_plan_item(plan_item, bed_id, -int(total_qty))
        except Exception as e:
            logging.warning(f"Failed to adjust plan item {plan_item_id} after removing plants: {e}")

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logging.warning(f"Failed to commit plan item adjustments: {e}")

    label = f'{plant_id}'
    if variety:
        label = f'{variety} {plant_id}'
    return jsonify({
        'message': f'Removed {count} {label} plant(s) from bed',
        'count': count
    }), 200


@gardens_bp.route('/garden-beds/<int:bed_id>/planted-items', methods=['DELETE'])
@login_required
def clear_bed(bed_id):
    """Remove ALL planted items from a garden bed (deletes all historical data)"""
    bed = GardenBed.query.get_or_404(bed_id)

    # Verify ownership
    if bed.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    count = len(bed.planted_items)

    # Pre-aggregate plan item quantities for decrement after deletion
    affected = db.session.query(
        PlantedItem.source_plan_item_id,
        sa_func.coalesce(sa_func.sum(PlantedItem.quantity), 0)
    ).filter_by(
        garden_bed_id=bed_id, user_id=current_user.id
    ).filter(
        PlantedItem.source_plan_item_id.isnot(None)
    ).group_by(PlantedItem.source_plan_item_id).all()

    # BUGFIX: Delete related indoor seed starts FIRST (before deleting PlantingEvents)
    # Get all PlantingEvents for this bed to find their IDs
    planting_events = PlantingEvent.query.filter_by(
        garden_bed_id=str(bed_id),
        user_id=current_user.id
    ).all()

    # Delete IndoorSeedStarts linked to these events
    event_ids = [e.id for e in planting_events]
    if event_ids:
        IndoorSeedStart.query.filter(
            IndoorSeedStart.planting_event_id.in_(event_ids),
            IndoorSeedStart.user_id == current_user.id
        ).delete(synchronize_session=False)

    # Delete all PlantingEvents for this bed
    PlantingEvent.query.filter_by(garden_bed_id=str(bed_id), user_id=current_user.id).delete()

    # Delete all planted items for this bed
    PlantedItem.query.filter_by(garden_bed_id=bed_id, user_id=current_user.id).delete()

    # Commit deletions first so they persist even if plan adjustment fails
    db.session.commit()

    # Decrement linked plan items (best-effort, non-blocking)
    for plan_item_id, total_qty in affected:
        try:
            plan_item = GardenPlanItem.query.get(plan_item_id)
            if plan_item:
                _adjust_auto_plan_item(plan_item, bed_id, -int(total_qty))
        except Exception as e:
            logging.warning(f"Failed to adjust plan item {plan_item_id} after clearing bed: {e}")

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logging.warning(f"Failed to commit plan item adjustments: {e}")

    return jsonify({'message': f'Cleared {count} plants and related indoor starts from bed', 'count': count}), 200


@gardens_bp.route('/planted-items/<int:item_id>', methods=['PUT', 'PATCH', 'DELETE'])
@login_required
def planted_item(item_id):
    """Update or delete a planted item"""
    item = PlantedItem.query.get_or_404(item_id)

    # Verify ownership
    if item.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    if request.method == 'DELETE':
        # BUGFIX: Delete related indoor seed starts FIRST (before deleting PlantingEvents)
        # Filter by plant_id to avoid deleting events for other plants at the same position
        # (succession planting can leave multiple PlantingEvents at the same cell)
        events = PlantingEvent.query.filter_by(
            garden_bed_id=str(item.garden_bed_id),
            plant_id=item.plant_id,
            position_x=item.position_x,
            position_y=item.position_y,
            user_id=current_user.id
        ).all()
        event_ids = [e.id for e in events]
        if event_ids:
            IndoorSeedStart.query.filter(
                IndoorSeedStart.planting_event_id.in_(event_ids),
                IndoorSeedStart.user_id == current_user.id
            ).delete(synchronize_session=False)
        # Delete matching PlantingEvent(s) for this item
        for e in events:
            db.session.delete(e)

        # Capture values before deleting the item
        source_plan_item_id = item.source_plan_item_id
        item_quantity = item.quantity or 1
        item_bed_id = item.garden_bed_id

        db.session.delete(item)
        db.session.commit()

        # Decrement linked plan item quantity
        if source_plan_item_id is not None:
            plan_item = GardenPlanItem.query.get(source_plan_item_id)
            if plan_item:
                _adjust_auto_plan_item(plan_item, item_bed_id, -item_quantity)
                db.session.commit()

        return '', 204

    data = request.json

    # Find PlantingEvent BEFORE updating position (we need old position to find it)
    # Filter by plant_id to avoid picking up a stale event from a previous crop
    # at the same position (succession planting leaves old PlantingEvents behind)
    planting_event = PlantingEvent.query.filter_by(
        garden_bed_id=str(item.garden_bed_id),
        plant_id=item.plant_id,
        position_x=item.position_x,
        position_y=item.position_y,
        user_id=current_user.id
    ).first()

    # Server-side conflict enforcement for position/bed moves (Bug Fix #2)
    if ('position' in data or 'gardenBedId' in data) and planting_event:
        # Calculate new position/bed
        new_position_x = data.get('position', {}).get('x', item.position_x) if 'position' in data else item.position_x
        new_position_y = data.get('position', {}).get('y', item.position_y) if 'position' in data else item.position_y
        new_garden_bed_id = data.get('gardenBedId', item.garden_bed_id) if 'gardenBedId' in data else item.garden_bed_id

        # Only validate if position or garden bed is actually changing
        position_changed = (new_position_x != item.position_x or new_position_y != item.position_y)
        bed_changed = (new_garden_bed_id != item.garden_bed_id)

        if position_changed or bed_changed:
            # Use only in-ground dates for spatial conflict checking
            # seed_start_date is indoor-only and doesn't occupy bed space
            start_date = planting_event.transplant_date or planting_event.direct_seed_date

            if start_date and planting_event.expected_harvest_date:
                is_valid, error_response = validate_planting_conflict({
                    'garden_bed_id': new_garden_bed_id,
                    'position_x': new_position_x,
                    'position_y': new_position_y,
                    'plant_id': planting_event.plant_id,
                    'transplant_date': planting_event.transplant_date,
                    'direct_seed_date': planting_event.direct_seed_date,
                    'seed_start_date': planting_event.seed_start_date,
                    'start_date': start_date,
                    'end_date': planting_event.expected_harvest_date,
                    'conflict_override': False
                }, current_user.id, exclude_item_id=item.id)  # CRITICAL: Exclude self!

                if not is_valid:
                    db.session.rollback()
                    return jsonify(error_response), 409

    # Update position and bed if provided (for drag-to-move functionality)
    if 'position' in data:
        new_position = data['position']
        item.position_x = new_position.get('x', item.position_x)
        item.position_y = new_position.get('y', item.position_y)
        if planting_event:
            planting_event.position_x = item.position_x
            planting_event.position_y = item.position_y

    if 'gardenBedId' in data:
        # Verify new bed exists and user owns it
        new_bed = GardenBed.query.get(data['gardenBedId'])
        if not new_bed:
            return jsonify({'error': 'New garden bed not found'}), 404
        if new_bed.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        item.garden_bed_id = data['gardenBedId']
        if planting_event:
            planting_event.garden_bed_id = str(data['gardenBedId'])

    # Update other fields
    item.status = data.get('status', item.status)
    item.notes = data.get('notes', item.notes)
    if 'variety' in data:
        item.variety = data.get('variety')  # Allow updating variety
    if 'plantedDate' in data and data['plantedDate']:
        item.planted_date = parse_iso_date(data['plantedDate'])
    if 'transplantDate' in data and data['transplantDate']:
        item.transplant_date = parse_iso_date(data['transplantDate'])
    if 'harvestDate' in data and data['harvestDate']:
        item.harvest_date = parse_iso_date(data['harvestDate'])

    # Handle seed saving toggle
    if 'saveForSeed' in data:
        save_for_seed = data['saveForSeed']
        item.save_for_seed = save_for_seed

        if save_for_seed:
            item.status = 'saving-seed'
            # Auto-calculate seed maturity date from base_date + daysToSeed
            plant = get_plant_by_id(item.plant_id)
            days_to_seed = plant.get('days_to_seed') if plant else None
            if days_to_seed is not None:
                # Use actual harvest_date first, then transplant_date + DTM, then planted_date + DTM
                base_date = item.harvest_date
                if base_date is None and plant:
                    dtm = plant.get('daysToMaturity', 0)
                    if dtm:
                        in_ground_date = item.transplant_date or item.planted_date
                        if in_ground_date:
                            base_date = in_ground_date + timedelta(days=dtm)
                if base_date is not None:
                    item.seed_maturity_date = base_date + timedelta(days=days_to_seed)
            # If no days_to_seed, leave seed_maturity_date null (frontend prompts for manual entry)
        else:
            # Toggle off: reset seed saving fields, restore status based on lifecycle
            item.seed_maturity_date = None
            item.seeds_collected = False
            item.seeds_collected_date = None
            if item.status == 'saving-seed':
                if item.harvest_date:
                    item.status = 'harvested'
                elif item.transplant_date:
                    item.status = 'transplanted'
                elif item.planted_date:
                    item.status = 'growing'
                else:
                    item.status = 'planned'

    # Handle manual seed maturity date override
    if 'seedMaturityDate' in data:
        if data['seedMaturityDate']:
            item.seed_maturity_date = parse_iso_date(data['seedMaturityDate'])
        else:
            item.seed_maturity_date = None

    # Update PlantingEvent dates if exists
    if planting_event:
        if 'transplantDate' in data and data['transplantDate']:
            planting_event.transplant_date = item.transplant_date
        if 'harvestDate' in data and data['harvestDate']:
            planting_event.actual_harvest_date = item.harvest_date  # Use actual_harvest_date for filtering

        # Sync seed maturity / harvest date to PlantingEvent for conflict detection
        if item.save_for_seed and item.seed_maturity_date:
            planting_event.expected_harvest_date = item.seed_maturity_date
        elif not item.save_for_seed and 'saveForSeed' in data:
            # Seed saving toggled off — restore expected_harvest_date from DTM
            plant = get_plant_by_id(item.plant_id)
            dtm = plant.get('daysToMaturity', 0) if plant else 0
            in_ground_date = item.transplant_date or item.planted_date
            if dtm and in_ground_date:
                planting_event.expected_harvest_date = in_ground_date + timedelta(days=dtm)
            else:
                planting_event.expected_harvest_date = None

    db.session.commit()
    return jsonify(item.to_dict())


@gardens_bp.route('/planted-items/<int:item_id>/collect-seeds', methods=['POST'])
@login_required
def collect_seeds(item_id):
    """Collect seeds from a plant that was saved for seed.

    Creates a SeedInventory record with homegrown provenance.
    Request body: { quantity, seedsPerPacket, notes, germinationRate, variety }
    Returns: { plantedItem, seedInventory }
    """
    item = PlantedItem.query.get_or_404(item_id)

    # Verify ownership
    if item.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    # Validate state
    if not item.save_for_seed:
        return jsonify({'error': 'This plant is not marked for seed saving'}), 400

    data = request.json or {}

    # Mark seeds as collected
    item.seeds_collected = True
    item.seeds_collected_date = datetime.utcnow()
    item.status = 'harvested'
    if not item.harvest_date:
        item.harvest_date = datetime.utcnow()

    # Create SeedInventory record
    seed_record = SeedInventory(
        user_id=current_user.id,
        plant_id=item.plant_id,
        variety=data.get('variety', item.variety or 'Homegrown'),
        brand='Homegrown',
        quantity=data.get('quantity', 1),
        seeds_per_packet=data.get('seedsPerPacket', 50),
        germination_rate=data.get('germinationRate'),
        notes=data.get('notes', ''),
        source_planted_item_id=item.id,
        is_homegrown=True,
        purchase_date=datetime.utcnow()
    )
    db.session.add(seed_record)

    try:
        db.session.commit()
        return jsonify({
            'plantedItem': item.to_dict(),
            'seedInventory': seed_record.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to collect seeds: {str(e)}'}), 500


# ==================== PLANTING EVENTS ROUTES ====================

@gardens_bp.route('/planting-events', methods=['GET', 'POST'])
@login_required
def planting_events():
    """Get all planting events or create new one"""
    if request.method == 'POST':
        try:
            data = request.json
            event_type = data.get('eventType', 'planting')

            # PLANTING EVENT - existing logic for plant-based events
            if event_type == 'planting':
                # Validate required fields for planting
                if not data.get('plantId'):
                    return jsonify({'error': 'plantId required for planting events'}), 400

                # Calculate space_required if not provided by client
                space_required = data.get('spaceRequired')
                if space_required is None and data.get('gardenBedId'):
                    bed = GardenBed.query.get(data['gardenBedId'])
                    if bed:
                        space_required = calculate_space_requirement(
                            data['plantId'],
                            bed.grid_size,
                            bed.planning_method
                        )

                # NEW: Extract seed density data if provided
                seed_density_data = data.get('seedDensityData', {})
                planting_method = seed_density_data.get('plantingMethod', 'individual_plants')

                event = PlantingEvent(
                    user_id=current_user.id,
                    event_type='planting',
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
                    space_required=space_required,
                    conflict_override=data.get('conflictOverride', False),
                    notes=data.get('notes', ''),
                    # NEW: Seed density fields
                    planting_method=planting_method,
                    quantity=data.get('quantity') if planting_method == 'individual_plants' else seed_density_data.get('expectedFinalCount'),
                    spacing=seed_density_data.get('spacing'),
                    seed_count=seed_density_data.get('seedCount'),
                    seed_density=seed_density_data.get('seedDensity'),
                    ui_segment_length_inches=seed_density_data.get('uiSegmentLengthInches'),
                    expected_germination_rate=seed_density_data.get('expectedGerminationRate'),
                    expected_survival_rate=seed_density_data.get('expectedSurvivalRate'),
                    expected_final_count=seed_density_data.get('expectedFinalCount'),
                    harvest_method=seed_density_data.get('harvestMethod'),
                    # Row continuity fields
                    row_group_id=seed_density_data.get('rowGroupId'),
                    row_segment_index=seed_density_data.get('rowSegmentIndex'),
                    total_row_segments=seed_density_data.get('totalRowSegments')
                )

                # Trellis allocation logic (for trellis_linear style crops)
                trellis_structure_id = data.get('trellisStructureId')
                if trellis_structure_id:
                    from models import TrellisStructure

                    # Fetch trellis and validate ownership
                    trellis = TrellisStructure.query.get(trellis_structure_id)
                    if not trellis:
                        return jsonify({'error': 'Trellis structure not found'}), 404
                    if trellis.user_id != current_user.id:
                        return jsonify({'error': 'Unauthorized access to trellis'}), 403

                    # Get linear feet requirement from plant data
                    plant = get_plant_by_id(data['plantId'])
                    linear_feet_per_plant = plant.get('migardener', {}).get('linearFeetPerPlant', 5.0) if plant else 5.0

                    # Get all existing allocations on this trellis, ordered by position
                    existing_allocations = PlantingEvent.query.filter_by(
                        trellis_structure_id=trellis_structure_id,
                        user_id=current_user.id
                    ).order_by(PlantingEvent.trellis_position_start_inches).all()

                    # Find first available gap (greedy algorithm)
                    total_length_inches = trellis.total_length_inches
                    required_inches = linear_feet_per_plant * 12

                    # Start from beginning and find first gap that fits
                    position_start_inches = 0
                    for allocation in existing_allocations:
                        gap_size = allocation.trellis_position_start_inches - position_start_inches
                        if gap_size >= required_inches:
                            # Found a gap that fits
                            break
                        # Move past this allocation
                        position_start_inches = allocation.trellis_position_end_inches

                    # Check if we have space at the found position
                    position_end_inches = position_start_inches + required_inches
                    if position_end_inches > total_length_inches:
                        return jsonify({
                            'error': f'Trellis at capacity. Available: {(total_length_inches - position_start_inches) / 12:.1f}ft, Required: {linear_feet_per_plant}ft'
                        }), 400

                    # Allocate space on trellis
                    event.trellis_structure_id = trellis_structure_id
                    event.trellis_position_start_inches = position_start_inches
                    event.trellis_position_end_inches = position_end_inches
                    event.linear_feet_allocated = linear_feet_per_plant

                # Server-side conflict enforcement for planting events
                start_date = event.transplant_date or event.direct_seed_date or event.seed_start_date

                if start_date and event.expected_harvest_date and event.garden_bed_id:
                    is_valid, error_response = validate_planting_conflict({
                        'garden_bed_id': event.garden_bed_id,
                        'position_x': event.position_x,
                        'position_y': event.position_y,
                        'plant_id': event.plant_id,
                        'transplant_date': event.transplant_date,
                        'direct_seed_date': event.direct_seed_date,
                        'seed_start_date': event.seed_start_date,
                        'start_date': start_date,
                        'end_date': event.expected_harvest_date,
                        'conflict_override': event.conflict_override
                    }, current_user.id)

                    if not is_valid:
                        return jsonify(error_response), 409

            # MULCH EVENT - garden maintenance event for mulch application
            elif event_type == 'mulch':
                # Validate required fields for mulch event
                if not data.get('gardenBedId'):
                    return jsonify({'error': 'gardenBedId required for mulch events'}), 400
                if not data.get('applicationDate'):
                    return jsonify({'error': 'applicationDate required for mulch events'}), 400

                # Build event details JSON
                mulch_details = {
                    'mulch_type': data.get('mulchType', 'straw'),
                    'depth_inches': data.get('depthInches'),
                    'coverage': data.get('coverage', 'full')
                }

                event = PlantingEvent(
                    user_id=current_user.id,
                    event_type='mulch',
                    plant_id='mulch-event',  # Placeholder since plant_id has NOT NULL constraint
                    garden_bed_id=data['gardenBedId'],
                    expected_harvest_date=parse_iso_date(data['applicationDate']),  # Date mulch applied
                    event_details=json.dumps(mulch_details),
                    notes=data.get('notes', '')
                )

            # MAPLE TAPPING EVENT - homestead event for tracking maple syrup production
            elif event_type == 'maple-tapping':
                # Validate required fields
                if not data.get('tappingDate'):
                    return jsonify({'error': 'tappingDate required for maple tapping events'}), 400

                # Build event details JSON
                tapping_details = {
                    'tree_structure_id': data.get('treeStructureId'),
                    'tree_type': data.get('treeType', 'sugar'),
                    'tap_count': data.get('tapCount', 1),
                    'collection_dates': data.get('collectionDates', []),
                    'syrup_yield': data.get('syrupYield'),
                    'tree_health': data.get('treeHealth'),
                }

                event = PlantingEvent(
                    user_id=current_user.id,
                    event_type='maple-tapping',
                    plant_id='maple-tapping-event',  # Placeholder
                    garden_bed_id=None,              # Not in a garden bed
                    expected_harvest_date=parse_iso_date(data['tappingDate']),  # Date tapped
                    event_details=json.dumps(tapping_details),
                    notes=data.get('notes', '')
                )

            # FUTURE: Other event types (fertilizing, irrigation, etc.)
            else:
                return jsonify({'error': f'Unsupported event type: {event_type}'}), 400

            db.session.add(event)
            db.session.commit()
            return jsonify(event.to_dict()), 201

        except KeyError as e:
            db.session.rollback()
            return jsonify({'error': f'Missing required field: {str(e)}'}), 400
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Failed to create event: {str(e)}'}), 500

    # GET with optional date-range filtering for timeline view
    # Filter by current user
    query = PlantingEvent.query.filter_by(user_id=current_user.id)

    # Filter by date range if provided
    # Lifecycle filtering: show events that are ACTIVE during the date range
    # An event is active if: plant_date <= end_date AND harvest_date >= start_date
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    # Planning mode: use expected_harvest_date for space availability calculations
    # Tracking mode (default): use actual_harvest_date for actual garden state
    planning_mode = request.args.get('planning_mode', 'false').lower() == 'true'

    if start_date and end_date:
        # Parse dates - handle both ISO format (with T/Z) and simple date strings
        try:
            start_dt = parse_iso_date(start_date) if 'T' in start_date or 'Z' in start_date else datetime.strptime(start_date, '%Y-%m-%d')
            end_dt = parse_iso_date(end_date) if 'T' in end_date or 'Z' in end_date else datetime.strptime(end_date, '%Y-%m-%d')
            # Use end of day for end_date to include events planted on that day
            if 'T' not in end_date:
                end_dt = end_dt.replace(hour=23, minute=59, second=59)
        except (ValueError, TypeError) as e:
            return jsonify({'error': f'Invalid date format: {str(e)}'}), 400

        # Filter by when plant is physically IN THE GROUND (not seed start date)
        # seed_start_date = when seeds start INDOORS (not in garden yet)
        # transplant_date = when seedlings move TO garden
        # direct_seed_date = when seeds planted directly IN garden
        query = query.filter(
            # Plant must be in the ground by end_date
            or_(
                and_(PlantingEvent.transplant_date.isnot(None), PlantingEvent.transplant_date <= end_dt),
                and_(PlantingEvent.direct_seed_date.isnot(None), PlantingEvent.direct_seed_date <= end_dt)
            )
        )

        # Apply harvest date filter based on mode
        # Planning mode: use expected_harvest_date for space availability
        # Tracking mode: use actual_harvest_date, falling back to expected_harvest_date
        if planning_mode:
            query = query.filter(
                or_(
                    PlantingEvent.expected_harvest_date.is_(None),
                    PlantingEvent.expected_harvest_date >= start_dt
                )
            )
        else:
            # Tracking mode: plant is visible if:
            # 1. Both harvest dates null (still growing, no harvest planned)
            # 2. OR actual harvest date is set and is >= start_date
            # 3. OR no actual harvest yet, but expected harvest is >= start_date
            query = query.filter(
                or_(
                    # Both null - still in ground with no harvest date
                    and_(PlantingEvent.actual_harvest_date.is_(None), PlantingEvent.expected_harvest_date.is_(None)),
                    # Actually harvested after the view date
                    and_(PlantingEvent.actual_harvest_date.isnot(None), PlantingEvent.actual_harvest_date >= start_dt),
                    # Not yet harvested, but expected to still be in ground
                    and_(PlantingEvent.actual_harvest_date.is_(None), PlantingEvent.expected_harvest_date.isnot(None), PlantingEvent.expected_harvest_date >= start_dt)
                )
            )
    elif start_date:
        # Only start date - show events that haven't been harvested or were harvested after this date
        # Planning mode: use expected_harvest_date for space availability
        # Tracking mode: use actual_harvest_date for actual garden state
        try:
            start_dt = parse_iso_date(start_date) if 'T' in start_date or 'Z' in start_date else datetime.strptime(start_date, '%Y-%m-%d')
        except (ValueError, TypeError) as e:
            return jsonify({'error': f'Invalid date format: {str(e)}'}), 400

        if planning_mode:
            query = query.filter(
                or_(
                    PlantingEvent.expected_harvest_date.is_(None),
                    PlantingEvent.expected_harvest_date >= start_dt
                )
            )
        else:
            # Tracking mode: use actual_harvest_date, falling back to expected_harvest_date
            query = query.filter(
                or_(
                    # Both null - still in ground with no harvest date
                    and_(PlantingEvent.actual_harvest_date.is_(None), PlantingEvent.expected_harvest_date.is_(None)),
                    # Actually harvested after the view date
                    and_(PlantingEvent.actual_harvest_date.isnot(None), PlantingEvent.actual_harvest_date >= start_dt),
                    # Not yet harvested, but expected to still be in ground
                    and_(PlantingEvent.actual_harvest_date.is_(None), PlantingEvent.expected_harvest_date.isnot(None), PlantingEvent.expected_harvest_date >= start_dt)
                )
            )
    elif end_date:
        # Only end date - show events physically in the ground on or before this date
        try:
            end_dt = parse_iso_date(end_date) if 'T' in end_date or 'Z' in end_date else datetime.strptime(end_date, '%Y-%m-%d')
        except (ValueError, TypeError) as e:
            return jsonify({'error': f'Invalid date format: {str(e)}'}), 400
        # Only check transplant_date and direct_seed_date (not seed_start_date)
        # seed_start_date is when seeds start indoors, not when plant is in garden
        query = query.filter(
            or_(
                and_(PlantingEvent.transplant_date.isnot(None), PlantingEvent.transplant_date <= end_dt),
                and_(PlantingEvent.direct_seed_date.isnot(None), PlantingEvent.direct_seed_date <= end_dt)
            )
        )

    events = query.all()
    return jsonify([event.to_dict() for event in events])


@gardens_bp.route('/planting-events/orphaned', methods=['GET', 'DELETE'])
@login_required
def orphaned_planting_events():
    """Preview or delete orphaned PlantingEvents.

    Orphaned events have position data but no matching PlantedItem,
    causing ghost conflicts that block new placements while being
    invisible on the grid.

    GET: Preview orphaned events (returns list with count)
    DELETE: Remove orphaned events and return count deleted
    """
    user_id = current_user.id

    # Find PlantingEvents with positions that have NO matching PlantedItem
    orphaned_query = PlantingEvent.query.filter(
        and_(
            PlantingEvent.user_id == user_id,
            PlantingEvent.event_type == 'planting',
            PlantingEvent.position_x.isnot(None),
            PlantingEvent.position_y.isnot(None)
        )
    ).filter(
        ~db.session.query(PlantedItem).filter(
            PlantedItem.garden_bed_id == cast(PlantingEvent.garden_bed_id, db.Integer),
            PlantedItem.plant_id == PlantingEvent.plant_id,
            PlantedItem.position_x == PlantingEvent.position_x,
            PlantedItem.position_y == PlantingEvent.position_y,
            PlantedItem.user_id == PlantingEvent.user_id
        ).exists()
    )

    if request.method == 'GET':
        orphans = orphaned_query.all()
        return jsonify({
            'count': len(orphans),
            'orphans': [e.to_dict() for e in orphans]
        }), 200

    # DELETE
    orphans = orphaned_query.all()
    count = len(orphans)

    # Delete linked IndoorSeedStarts first
    orphan_ids = [e.id for e in orphans]
    if orphan_ids:
        IndoorSeedStart.query.filter(
            IndoorSeedStart.planting_event_id.in_(orphan_ids),
            IndoorSeedStart.user_id == user_id
        ).delete(synchronize_session=False)

    for orphan in orphans:
        db.session.delete(orphan)

    db.session.commit()
    return jsonify({
        'message': f'Deleted {count} orphaned planting event(s)',
        'count': count
    }), 200


@gardens_bp.route('/planting-events/<int:event_id>', methods=['PUT', 'DELETE'])
@login_required
def planting_event(event_id):
    """Update or delete a planting event"""
    event = PlantingEvent.query.get_or_404(event_id)

    # Verify ownership
    if event.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    if request.method == 'DELETE':
        # BUGFIX: Delete related indoor seed start FIRST (before deleting PlantingEvent)
        IndoorSeedStart.query.filter_by(
            planting_event_id=event_id,
            user_id=current_user.id
        ).delete(synchronize_session=False)

        db.session.delete(event)
        db.session.commit()
        return '', 204

    data = request.json
    event.completed = data.get('completed', event.completed)
    event.notes = data.get('notes', event.notes)

    # Handle quantity completed update (for partial completion tracking)
    if 'quantityCompleted' in data:
        event.quantity_completed = data.get('quantityCompleted')
        # Auto-update completed flag based on quantity
        if event.quantity and event.quantity_completed is not None:
            event.completed = (event.quantity_completed >= event.quantity)

    # Handle actual harvest date update
    if 'actualHarvestDate' in data:
        if data['actualHarvestDate']:
            event.actual_harvest_date = parse_iso_date(data['actualHarvestDate'])
        else:
            event.actual_harvest_date = None

    # Handle expected harvest date update (for auto-adjustment)
    if 'expectedHarvestDate' in data:
        if data['expectedHarvestDate']:
            event.expected_harvest_date = parse_iso_date(data['expectedHarvestDate'])
        else:
            event.expected_harvest_date = None

    # Handle transplant date update
    if 'transplantDate' in data:
        if data['transplantDate']:
            event.transplant_date = parse_iso_date(data['transplantDate'])
        else:
            event.transplant_date = None

    # Handle direct seed date update
    if 'directSeedDate' in data:
        if data['directSeedDate']:
            event.direct_seed_date = parse_iso_date(data['directSeedDate'])
        else:
            event.direct_seed_date = None

    # Handle seed start date update
    if 'seedStartDate' in data:
        if data['seedStartDate']:
            event.seed_start_date = parse_iso_date(data['seedStartDate'])
        else:
            event.seed_start_date = None

    db.session.commit()
    return jsonify(event.to_dict())


@gardens_bp.route('/planting-events/<int:event_id>/harvest', methods=['PATCH'])
@login_required
def mark_event_harvested(event_id):
    """Mark a planting event as harvested with actual date."""
    event = PlantingEvent.query.get_or_404(event_id)

    # Verify ownership
    if event.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()
    harvest_date = data.get('harvestDate') if data else None

    if harvest_date:
        event.actual_harvest_date = parse_iso_date(harvest_date)
    else:
        # Default to today if no date provided
        event.actual_harvest_date = datetime.now()

    db.session.commit()
    return jsonify(event.to_dict())


@gardens_bp.route('/planting-events/bulk-update', methods=['PATCH'])
@login_required
def bulk_update_events():
    """
    Bulk update completion status for multiple events.
    Supports: mark all complete, mark partial completion, adjust quantities
    """
    data = request.get_json()
    event_ids = data.get('eventIds', [])
    updates = data.get('updates', {})  # {completed, quantityCompleted, quantity}

    if not event_ids:
        return jsonify({'error': 'No event IDs provided'}), 400

    # Get all events and verify ownership
    events = PlantingEvent.query.filter(PlantingEvent.id.in_(event_ids)).all()

    for event in events:
        # Verify ownership
        if event.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Apply updates
        if 'completed' in updates:
            event.completed = updates['completed']
        if 'quantityCompleted' in updates:
            event.quantity_completed = updates['quantityCompleted']
            # Auto-update completed flag based on quantity
            if event.quantity and event.quantity_completed is not None:
                event.completed = (event.quantity_completed >= event.quantity)
        if 'quantity' in updates:  # Adjust target quantity
            event.quantity = updates['quantity']

    db.session.commit()

    return jsonify({
        'message': f'Updated {len(events)} events',
        'updatedIds': [e.id for e in events]
    }), 200


@gardens_bp.route('/planting-events/check-conflict', methods=['POST'])
@login_required
def check_planting_conflict_route():
    """Check if planting position conflicts with existing plantings"""
    try:
        data = request.json

        # Validate required fields
        required_fields = ['gardenBedId', 'positionX', 'positionY', 'startDate', 'endDate', 'plantId']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        # Get garden bed and verify ownership
        garden_bed = GardenBed.query.get(data['gardenBedId'])
        if not garden_bed:
            return jsonify({'error': 'Garden bed not found'}), 404

        if garden_bed.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Parse dates
        start_date = parse_iso_date(data['startDate'])
        end_date = parse_iso_date(data['endDate'])

        if not start_date or not end_date:
            return jsonify({'error': 'Invalid date format'}), 400

        # Query PlantedItems directly — ground truth, no orphan issues
        exclude_item_id = data.get('excludeItemId')
        candidate_events = query_candidate_items(
            data['gardenBedId'], current_user.id, exclude_item_id
        )

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
            'id': exclude_item_id
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
        import os
        if os.getenv('FLASK_ENV') == 'development':
            import traceback
            traceback.print_exc()
        return jsonify({'error': f'Failed to check conflict: {str(e)}'}), 500


@gardens_bp.route('/planting-events/needs-indoor-starts', methods=['GET'])
@login_required
def get_planting_events_needing_indoor_starts():
    """
    Get all planting events that:
    - Have a transplant_date set
    - Plant has weeksIndoors > 0 (can be started indoors)
    - Don't already have a linked indoor seed start
    - Transplant date is in the future (optional filter)

    Query params:
    - include_past: true/false (default: false) - include events with past transplant dates
    """
    try:
        include_past = request.args.get('include_past', 'false').lower() == 'true'

        # Query planting events with transplant dates
        query = PlantingEvent.query.filter_by(user_id=current_user.id).filter(
            PlantingEvent.transplant_date.isnot(None)
        )

        # Filter by future dates unless include_past is true
        if not include_past:
            query = query.filter(PlantingEvent.transplant_date >= datetime.utcnow())

        events = query.order_by(PlantingEvent.transplant_date).all()

        # Group events by (plant_id, variety, transplant_date) and sum quantities
        grouped = {}
        for event in events:
            # Get plant data
            plant = get_plant_by_id(event.plant_id)
            if not plant:
                continue

            weeks_indoors = plant.get('weeksIndoors', 0)

            # Skip plants that can't be started indoors
            if weeks_indoors == 0:
                continue

            # Group by plant, variety, and transplant date
            transplant_date_str = event.transplant_date.date().isoformat()
            group_key = (event.plant_id, event.variety or '', transplant_date_str)

            if group_key not in grouped:
                grouped[group_key] = {
                    'plantingEventIds': [],
                    'plantId': event.plant_id,
                    'plant': plant,
                    'variety': event.variety,
                    'transplantDate': event.transplant_date,
                    'gardenBedId': event.garden_bed_id,
                    'totalQuantity': 0,
                    'notes': event.notes
                }

            grouped[group_key]['plantingEventIds'].append(event.id)
            grouped[group_key]['totalQuantity'] += (event.space_required or 1)

        # Filter out groups that already have indoor starts
        # Check if ANY event in the group has an indoor start linked
        filtered_groups = {}
        for group_key, group_data in grouped.items():
            # Check if any event in this group already has an indoor start
            has_indoor_start = IndoorSeedStart.query.filter(
                IndoorSeedStart.user_id == current_user.id,
                IndoorSeedStart.planting_event_id.in_(group_data['plantingEventIds'])
            ).first()

            if not has_indoor_start:
                filtered_groups[group_key] = group_data

        grouped = filtered_groups

        # Convert grouped data to results
        results = []
        for group_key, group_data in grouped.items():
            plant = group_data['plant']
            transplant_date = group_data['transplantDate']
            weeks_indoors = plant.get('weeksIndoors', 0)
            germination_days = plant.get('germination_days', 7)

            # Calculate suggested indoor start date
            indoor_start_date = transplant_date - timedelta(weeks=weeks_indoors)
            expected_germination_date = indoor_start_date + timedelta(days=germination_days)

            # Determine timing status
            days_until_start = (indoor_start_date.date() - datetime.utcnow().date()).days
            timing_status = 'good'  # green
            if days_until_start < 0:
                timing_status = 'past'  # red - should have started already
            elif days_until_start < 7:
                timing_status = 'urgent'  # yellow - start soon

            results.append({
                'plantingEventId': group_data['plantingEventIds'][0],  # Primary event ID
                'plantingEventIds': group_data['plantingEventIds'],  # All event IDs in group
                'plantId': group_data['plantId'],
                'plantName': plant['name'],
                'plantIcon': plant.get('icon', '🌱'),
                'variety': group_data['variety'],
                'gardenBedId': group_data['gardenBedId'],
                'transplantDate': transplant_date.isoformat(),
                'weeksIndoors': weeks_indoors,
                'germinationDays': germination_days,
                'suggestedIndoorStartDate': indoor_start_date.isoformat(),
                'expectedGerminationDate': expected_germination_date.isoformat(),
                'daysUntilStart': days_until_start,
                'timingStatus': timing_status,
                'canStartIndoors': True,
                'notes': group_data['notes'],
                'spaceRequired': group_data['totalQuantity']  # Sum of all plants in group
            })

        return jsonify({
            'events': results,
            'count': len(results)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 400


@gardens_bp.route('/planting-events/audit-conflicts', methods=['GET'])
@login_required
def audit_conflicts():
    """
    Find all existing conflicts in user's gardens.

    Scans all positioned planting events and identifies pairs with
    overlapping space and time. Used for cleaning up pre-enforcement data.

    Returns:
        JSON with total_conflicts count and list of conflict details
    """
    user_id = current_user.id

    # Query PlantedItems directly — ground truth, no orphan issues
    # Group by garden bed for efficient checking
    beds = GardenBed.query.filter_by(user_id=user_id).all()
    beds_map = {}
    for bed in beds:
        events = query_candidate_items(bed.id, user_id)
        if events:
            beds_map[bed.id] = {'bed': bed, 'events': events}

    # Find conflicts within each bed
    conflicts_found = []
    checked_pairs = set()  # Avoid duplicate pair checking (A-B = B-A)

    for bed_id, bed_data in beds_map.items():
        bed = bed_data['bed']
        bed_events = bed_data['events']

        for i, event_a in enumerate(bed_events):
            for event_b in bed_events[i+1:]:  # Only check each pair once
                pair_key = tuple(sorted([event_a.id, event_b.id]))
                if pair_key in checked_pairs:
                    continue
                checked_pairs.add(pair_key)

                # Check if these two events conflict
                result = has_conflict(event_a, [event_b], bed)

                if result['has_conflict']:
                    plant_a = get_plant_by_id(event_a.plant_id)
                    plant_b = get_plant_by_id(event_b.plant_id)

                    start_a = get_primary_planting_date(event_a)
                    start_b = get_primary_planting_date(event_b)

                    conflicts_found.append({
                        'gardenBedId': bed_id,
                        'gardenBedName': bed.name if bed else f'Bed {bed_id}',
                        'position': {
                            'x': event_a.position_x,
                            'y': event_a.position_y
                        },
                        'eventA': {
                            'id': event_a.id,
                            'plantName': plant_a.get('name', 'Unknown') if plant_a else 'Unknown',
                            'variety': event_a.variety,
                            'startDate': start_a.isoformat() if start_a else None,
                            'endDate': event_a.expected_harvest_date.isoformat() if event_a.expected_harvest_date else None
                        },
                        'eventB': {
                            'id': event_b.id,
                            'plantName': plant_b.get('name', 'Unknown') if plant_b else 'Unknown',
                            'variety': event_b.variety,
                            'startDate': start_b.isoformat() if start_b else None,
                            'endDate': event_b.expected_harvest_date.isoformat() if event_b.expected_harvest_date else None
                        }
                    })

    return jsonify({
        'total_conflicts': len(conflicts_found),
        'conflicts': conflicts_found
    }), 200
