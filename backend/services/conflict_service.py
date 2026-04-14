"""
Conflict Service Layer

Business logic for conflict detection and validation.
Wraps the conflict_checker module with a clean service interface.
"""
from conflict_checker import has_conflict, validate_planting_conflict, get_primary_planting_date
from models import PlantingEvent, GardenBed


def check_planting_conflict(planting_data, user_id):
    """
    Check if a planting would conflict with existing plantings.

    Args:
        planting_data (dict): Planting data containing:
            - garden_bed_id (int): Garden bed ID
            - position_x (int): X coordinate
            - position_y (int): Y coordinate
            - plant_id (str): Plant identifier
            - start_date (datetime): Start date
            - end_date (datetime): End date
            - conflict_override (bool): Whether to allow conflicts
        user_id (int): User ID

    Returns:
        tuple: (is_valid: bool, error_response: dict or None)
            On success: (True, None)
            On conflict: (False, {'error': 'message', 'conflicts': [...]})
    """
    return validate_planting_conflict(planting_data, user_id)


def find_conflicts_in_bed(bed_id, user_id):
    """
    Find all conflicts in a specific garden bed.

    Args:
        bed_id (int): Garden bed ID
        user_id (int): User ID

    Returns:
        list[dict]: List of conflict objects with details
    """
    # Get all planting events in the bed
    events = PlantingEvent.query.filter_by(
        garden_bed_id=bed_id,
        user_id=user_id
    ).all()

    conflicts = []

    # Check each event against all others
    for i, event1 in enumerate(events):
        start_date1 = get_primary_planting_date(event1)
        if not start_date1 or not event1.expected_harvest_date:
            continue

        for event2 in events[i+1:]:
            start_date2 = get_primary_planting_date(event2)
            if not start_date2 or not event2.expected_harvest_date:
                continue

            # Check for conflict
            if has_conflict(
                event1.position_x, event1.position_y,
                start_date1, event1.expected_harvest_date,
                event2.position_x, event2.position_y,
                start_date2, event2.expected_harvest_date
            ):
                conflicts.append({
                    'event1_id': event1.id,
                    'event1_plant': event1.plant_id,
                    'event1_variety': event1.variety,
                    'event1_position': (event1.position_x, event1.position_y),
                    'event1_dates': (start_date1.isoformat(), event1.expected_harvest_date.isoformat()),
                    'event2_id': event2.id,
                    'event2_plant': event2.plant_id,
                    'event2_variety': event2.variety,
                    'event2_position': (event2.position_x, event2.position_y),
                    'event2_dates': (start_date2.isoformat(), event2.expected_harvest_date.isoformat())
                })

    return conflicts


def audit_all_conflicts(user_id):
    """
    Find all conflicts across all of a user's garden beds.

    Args:
        user_id (int): User ID

    Returns:
        dict: {bed_id: [conflicts], ...}
    """
    # Get all user's beds
    beds = GardenBed.query.filter_by(user_id=user_id).all()

    all_conflicts = {}

    for bed in beds:
        bed_conflicts = find_conflicts_in_bed(bed.id, user_id)
        if bed_conflicts:
            all_conflicts[bed.id] = {
                'bed_name': bed.name,
                'conflicts': bed_conflicts
            }

    return all_conflicts


def get_primary_date(planting_event):
    """
    Get the primary planting date for an event.

    Args:
        planting_event (PlantingEvent): Planting event object

    Returns:
        datetime: Primary planting date (transplant > direct > seed start)
    """
    return get_primary_planting_date(planting_event)
