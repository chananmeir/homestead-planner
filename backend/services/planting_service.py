"""
Planting Service Layer

Business logic for planting operations (PlantedItems and PlantingEvents).
This service provides a single source of truth for planting logic,
preventing duplication across multiple endpoints.
"""
from datetime import datetime, timedelta
from models import db, PlantedItem, PlantingEvent, GardenBed
from plant_database import get_plant_by_id
from utils.helpers import parse_iso_date
from conflict_checker import validate_planting_conflict
from simulation_clock import get_now


def create_single_planting(user_id, data):
    """
    Create a single planting (both PlantedItem and PlantingEvent).

    This is the single source of truth for planting creation, used by:
    - POST /api/planted-items
    - POST /api/planted-items/batch

    Args:
        user_id (int): User ID (owner)
        data (dict): Planting data containing:
            - plantId (str): Required plant identifier
            - gardenBedId (int): Required garden bed ID
            - variety (str): Optional variety name
            - plantedDate (str): ISO date string
            - quantity (int): Number of plants (default 1)
            - status (str): 'planned', 'active', etc.
            - notes (str): Optional notes
            - position (dict): {x, y} coordinates
            - plantingMethod (str): 'direct' or 'transplant'

    Returns:
        tuple: (success: bool, result: dict or PlantedItem)
            On success: (True, PlantedItem object)
            On error: (False, {'error': 'message'})
    """
    try:
        # Validation
        if not data:
            return False, {'error': 'Request body is required'}

        if 'plantId' not in data:
            return False, {'error': 'plantId is required'}

        if 'gardenBedId' not in data:
            return False, {'error': 'gardenBedId is required'}

        # Verify garden bed exists and user owns it
        bed = GardenBed.query.get(data['gardenBedId'])
        if not bed:
            return False, {'error': f'Garden bed with ID {data["gardenBedId"]} not found'}

        if bed.user_id != user_id:
            return False, {'error': 'Unauthorized'}

        # Parse data
        position = data.get('position', {})
        planted_date = parse_iso_date(data.get('plantedDate')) or get_now()

        # Get plant data to determine planting method and calculate dates
        plant = get_plant_by_id(data['plantId'])

        # Auto-detect planting method based on plant characteristics
        weeks_indoors = plant.get('weeksIndoors', 0) if plant else 0
        default_method = 'transplant' if weeks_indoors > 0 else 'direct'
        planting_method = data.get('plantingMethod', default_method)

        # Create PlantedItem
        item = PlantedItem(
            user_id=user_id,
            plant_id=data['plantId'],
            variety=data.get('variety'),
            garden_bed_id=data['gardenBedId'],
            planted_date=planted_date,
            quantity=data.get('quantity', 1),
            status=data.get('status', 'planned'),
            notes=data.get('notes', ''),
            position_x=position.get('x', 0),
            position_y=position.get('y', 0)
        )
        db.session.add(item)

        # Create corresponding PlantingEvent for timeline/date filtering
        expected_harvest = planted_date
        if plant and plant.get('daysToMaturity') is not None:
            expected_harvest = planted_date + timedelta(days=plant['daysToMaturity'])

        planting_event = PlantingEvent(
            user_id=user_id,
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

        # Server-side conflict enforcement
        start_date = planting_event.transplant_date or planting_event.direct_seed_date or planting_event.seed_start_date

        if start_date and planting_event.expected_harvest_date and planting_event.garden_bed_id:
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
                'conflict_override': data.get('conflictOverride', False)
            }, user_id)

            if not is_valid:
                db.session.rollback()
                return False, error_response

        db.session.add(planting_event)
        db.session.commit()

        return True, item

    except KeyError as e:
        db.session.rollback()
        return False, {'error': f'Missing required field: {str(e)}'}
    except Exception as e:
        db.session.rollback()
        # Safe error message handling
        try:
            error_msg = str(e)
        except UnicodeEncodeError:
            error_msg = repr(e)
        return False, {'error': f'Database error: {error_msg}'}


def create_batch_plantings(user_id, data):
    """
    Create multiple plantings in a single transaction.

    Used by POST /api/planted-items/batch for succession planting
    and bulk placement operations.

    Args:
        user_id (int): User ID (owner)
        data (dict): Batch planting data containing:
            - plantId (str): Required plant identifier
            - gardenBedId (int): Required garden bed ID
            - variety (str): Optional variety name
            - plantedDate (str): ISO date string
            - status (str): 'planned', 'active', etc.
            - notes (str): Optional notes
            - plantingMethod (str): 'direct' or 'transplant'
            - positions (list): List of {x, y, quantity} dicts
            - successionGroupId (str): Optional succession group ID
            - seedDensityData (dict): Optional MIGardener method data

    Returns:
        tuple: (success: bool, result: dict)
            On success: (True, {'created': count, 'items': [...]})
            On error: (False, {'error': 'message'})
    """
    try:
        # Validation
        if not data:
            return False, {'error': 'Request body is required'}

        required_fields = ['plantId', 'gardenBedId', 'positions']
        for field in required_fields:
            if field not in data:
                return False, {'error': f'{field} is required'}

        if not isinstance(data['positions'], list) or len(data['positions']) == 0:
            return False, {'error': 'positions must be a non-empty array'}

        # Verify garden bed exists and user owns it
        bed = GardenBed.query.get(data['gardenBedId'])
        if not bed:
            return False, {'error': f'Garden bed with ID {data["gardenBedId"]} not found'}

        if bed.user_id != user_id:
            return False, {'error': 'Unauthorized'}

        # Get plant data
        plant = get_plant_by_id(data['plantId'])
        if not plant:
            return False, {'error': f'Plant with ID {data["plantId"]} not found'}

        # Parse common data
        planted_date = parse_iso_date(data.get('plantedDate')) or get_now()

        # Auto-detect planting method
        weeks_indoors = plant.get('weeksIndoors', 0) if plant else 0
        default_method = 'transplant' if weeks_indoors > 0 else 'direct'
        planting_method = data.get('plantingMethod', default_method)

        # Calculate expected harvest date
        expected_harvest = planted_date
        if plant and plant.get('daysToMaturity') is not None:
            expected_harvest = planted_date + timedelta(days=plant['daysToMaturity'])

        # Extract optional data
        succession_group_id = data.get('successionGroupId')
        seed_density_data = data.get('seedDensityData', {})
        seed_planting_method = seed_density_data.get('plantingMethod', 'individual_plants')

        # Create all items in transaction
        created_items = []

        for pos in data['positions']:
            if 'x' not in pos or 'y' not in pos:
                db.session.rollback()
                return False, {'error': 'Each position must have x and y coordinates'}

            # Create PlantedItem
            item = PlantedItem(
                user_id=user_id,
                plant_id=data['plantId'],
                variety=data.get('variety'),
                garden_bed_id=data['gardenBedId'],
                planted_date=planted_date,
                quantity=pos.get('quantity', 1),
                status=data.get('status', 'planned'),
                notes=data.get('notes', ''),
                position_x=pos['x'],
                position_y=pos['y']
            )
            db.session.add(item)

            # Create corresponding PlantingEvent
            planting_event = PlantingEvent(
                user_id=user_id,
                plant_id=data['plantId'],
                variety=data.get('variety'),
                garden_bed_id=data['gardenBedId'],
                direct_seed_date=planted_date if planting_method == 'direct' else None,
                transplant_date=planted_date if planting_method == 'transplant' else None,
                expected_harvest_date=expected_harvest,
                succession_group_id=succession_group_id,
                position_x=pos['x'],
                position_y=pos['y'],
                notes=data.get('notes', ''),
                # Seed density fields (if applicable)
                planting_method=seed_planting_method,
                quantity=pos.get('quantity', 1) if seed_planting_method == 'individual_plants' else seed_density_data.get('expectedFinalCount'),
                spacing=seed_density_data.get('spacing'),
                seed_count=seed_density_data.get('seedCount'),
                seed_density=seed_density_data.get('seedDensity'),
                ui_segment_length_inches=seed_density_data.get('uiSegmentLengthInches'),
                expected_germination_rate=seed_density_data.get('expectedGerminationRate'),
                expected_survival_rate=seed_density_data.get('expectedSurvivalRate'),
                expected_final_count=seed_density_data.get('expectedFinalCount'),
                harvest_method=seed_density_data.get('harvestMethod'),
                row_group_id=seed_density_data.get('rowGroupId'),
                row_segment_index=seed_density_data.get('rowSegmentIndex'),
                total_row_segments=seed_density_data.get('totalRowSegments')
            )

            # Conflict checking
            start_date = planting_event.transplant_date or planting_event.direct_seed_date or planting_event.seed_start_date
            conflict_override = data.get('conflictOverride', False)

            if start_date and planting_event.expected_harvest_date and planting_event.garden_bed_id:
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
                    'conflict_override': conflict_override
                }, user_id)

                if not is_valid:
                    db.session.rollback()
                    return False, error_response

            db.session.add(planting_event)
            created_items.append(item)

        db.session.commit()

        return True, {
            'created': len(created_items),
            'items': [item.to_dict() for item in created_items]
        }

    except Exception as e:
        db.session.rollback()
        try:
            error_msg = str(e)
        except UnicodeEncodeError:
            error_msg = repr(e)
        return False, {'error': f'Batch creation failed: {error_msg}'}


def get_user_planted_items(user_id, filters=None):
    """
    Get planted items for a user with optional filtering.

    Args:
        user_id (int): User ID
        filters (dict): Optional filters:
            - garden_bed_id (int): Filter by garden bed
            - status (str): Filter by status
            - plant_id (str): Filter by plant

    Returns:
        list[PlantedItem]: List of planted item objects
    """
    query = PlantedItem.query.filter_by(user_id=user_id)

    if filters:
        if 'garden_bed_id' in filters:
            query = query.filter_by(garden_bed_id=filters['garden_bed_id'])
        if 'status' in filters:
            query = query.filter_by(status=filters['status'])
        if 'plant_id' in filters:
            query = query.filter_by(plant_id=filters['plant_id'])

    return query.all()


def update_planted_item(item_id, user_id, data):
    """
    Update a planted item.

    Args:
        item_id (int): Planted item ID
        user_id (int): User ID (for permission check)
        data (dict): Updated data

    Returns:
        tuple: (success: bool, result: PlantedItem or error dict)
    """
    item = PlantedItem.query.filter_by(id=item_id, user_id=user_id).first()
    if not item:
        return False, {'error': 'Planted item not found'}

    try:
        # Update allowed fields
        updatable_fields = ['status', 'notes', 'quantity', 'position_x', 'position_y']
        for field in updatable_fields:
            if field in data:
                setattr(item, field, data[field])

        db.session.commit()
        return True, item
    except Exception as e:
        db.session.rollback()
        return False, {'error': str(e)}


def delete_planted_item(item_id, user_id):
    """
    Delete a planted item.

    Args:
        item_id (int): Planted item ID
        user_id (int): User ID (for permission check)

    Returns:
        tuple: (success: bool, result: dict)
    """
    item = PlantedItem.query.filter_by(id=item_id, user_id=user_id).first()
    if not item:
        return False, {'error': 'Planted item not found'}

    try:
        db.session.delete(item)
        db.session.commit()
        return True, {'message': 'Planted item deleted successfully'}
    except Exception as e:
        db.session.rollback()
        return False, {'error': str(e)}
