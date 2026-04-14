"""
Garden Bed Service Layer

Business logic for garden bed operations, including temporal mulch tracking.
This service can safely import models (unlike utils/).
"""
from datetime import datetime
import json
from models import db, GardenBed, PlantingEvent


def get_mulch_type_on_date(garden_bed_id, user_id, query_date):
    """
    Get the effective mulch type for a garden bed on a specific date.

    This implements temporal mulch tracking by querying the most recent
    mulch event as of the query date.

    Args:
        garden_bed_id (int): Garden bed ID
        user_id (int): User ID (for permission check)
        query_date (datetime): Date to query mulch state for

    Returns:
        str: Mulch type ('none', 'straw', 'wood-chips', etc.)
    """
    # Find most recent mulch event as of query_date
    recent_event = PlantingEvent.query.filter(
        PlantingEvent.garden_bed_id == garden_bed_id,
        PlantingEvent.event_type == 'mulch',
        PlantingEvent.user_id == user_id,
        PlantingEvent.expected_harvest_date <= query_date
    ).order_by(
        PlantingEvent.expected_harvest_date.desc()
    ).first()

    if recent_event and recent_event.event_details:
        # Parse event details JSON to get mulch type
        try:
            details = json.loads(recent_event.event_details)
            return details.get('mulch_type', 'none')
        except (json.JSONDecodeError, AttributeError):
            pass  # Fall through to static fallback

    # Fallback to static bed property
    bed = GardenBed.query.get(garden_bed_id)
    return bed.mulch_type if bed else 'none'


def get_garden_bed(bed_id, user_id):
    """
    Get a garden bed by ID, ensuring it belongs to the user.

    Args:
        bed_id (int): Garden bed ID
        user_id (int): User ID (for permission check)

    Returns:
        GardenBed: Garden bed object, or None if not found/unauthorized
    """
    return GardenBed.query.filter_by(id=bed_id, user_id=user_id).first()


def get_user_garden_beds(user_id):
    """
    Get all garden beds for a user.

    Args:
        user_id (int): User ID

    Returns:
        list[GardenBed]: List of garden bed objects
    """
    return GardenBed.query.filter_by(user_id=user_id).all()


def create_garden_bed(user_id, bed_data):
    """
    Create a new garden bed.

    Args:
        user_id (int): User ID
        bed_data (dict): Bed data (name, dimensions, etc.)

    Returns:
        tuple: (success: bool, result: GardenBed or error dict)
    """
    try:
        bed = GardenBed(
            user_id=user_id,
            name=bed_data.get('name'),
            width=bed_data.get('width'),
            height=bed_data.get('height'),
            x=bed_data.get('x', 0),
            y=bed_data.get('y', 0),
            mulch_type=bed_data.get('mulch_type', 'none'),
            sun_exposure=bed_data.get('sun_exposure', 'full')
        )
        db.session.add(bed)
        db.session.commit()
        return True, bed
    except Exception as e:
        db.session.rollback()
        return False, {'error': str(e)}


def update_garden_bed(bed_id, user_id, bed_data):
    """
    Update an existing garden bed.

    Args:
        bed_id (int): Garden bed ID
        user_id (int): User ID (for permission check)
        bed_data (dict): Updated bed data

    Returns:
        tuple: (success: bool, result: GardenBed or error dict)
    """
    bed = get_garden_bed(bed_id, user_id)
    if not bed:
        return False, {'error': 'Garden bed not found'}

    try:
        # Update fields
        for key, value in bed_data.items():
            if hasattr(bed, key):
                setattr(bed, key, value)

        db.session.commit()
        return True, bed
    except Exception as e:
        db.session.rollback()
        return False, {'error': str(e)}


def delete_garden_bed(bed_id, user_id):
    """
    Delete a garden bed.

    Args:
        bed_id (int): Garden bed ID
        user_id (int): User ID (for permission check)

    Returns:
        tuple: (success: bool, result: dict)
    """
    bed = get_garden_bed(bed_id, user_id)
    if not bed:
        return False, {'error': 'Garden bed not found'}

    try:
        db.session.delete(bed)
        db.session.commit()
        return True, {'message': 'Garden bed deleted successfully'}
    except Exception as e:
        db.session.rollback()
        return False, {'error': str(e)}
