"""
Crop Rotation Service Layer

Business logic for crop rotation planning and conflict detection.
Tracks plant family history in garden beds and warns about rotation violations.

Based on 3-year rotation principle: Don't plant same botanical family in same bed
for 3 consecutive years to prevent soil-borne disease buildup and pest accumulation.
"""
from datetime import datetime
from sqlalchemy import extract, or_
from models import PlantingEvent, GardenBed, db
from plant_database import get_plant_by_id
from simulation_clock import get_now


def get_bed_rotation_history(bed_id, user_id, years_back=3):
    """
    Query planting history for a specific bed over the past N years.

    Args:
        bed_id (int): Garden bed ID
        user_id (int): User ID
        years_back (int): Number of years to look back (default: 3)

    Returns:
        list[dict]: List of historical plantings with family information:
            [{
                'plant_id': str,
                'plant_name': str,
                'family': str or None,
                'year': int,
                'planted_date': datetime,
                'variety': str or None
            }, ...]
    """
    current_year = get_now().year
    start_year = current_year - years_back

    # Query PlantingEvent records for this bed in the time window
    # Check direct_seed_date OR transplant_date (whichever is earlier/present)
    events = PlantingEvent.query.filter(
        PlantingEvent.garden_bed_id == bed_id,
        PlantingEvent.user_id == user_id,
        PlantingEvent.event_type == 'planting',  # Only planting events, not mulch/etc
        or_(
            extract('year', PlantingEvent.direct_seed_date) >= start_year,
            extract('year', PlantingEvent.transplant_date) >= start_year
        )
    ).all()

    history = []
    for event in events:
        # Determine planting year (use whichever date exists)
        planting_date = event.direct_seed_date or event.transplant_date or event.seed_start_date
        if not planting_date:
            continue  # Skip events without any date

        planting_year = planting_date.year
        if planting_year >= current_year:
            continue  # Skip future plantings

        # Get plant information from database
        plant = get_plant_by_id(event.plant_id)
        if not plant:
            continue  # Skip if plant not found

        history.append({
            'plant_id': event.plant_id,
            'plant_name': plant.get('name', 'Unknown'),
            'family': plant.get('family'),  # May be None
            'year': planting_year,
            'planted_date': planting_date,
            'variety': event.variety
        })

    # Sort by year (most recent first)
    history.sort(key=lambda x: x['year'], reverse=True)

    return history


def check_rotation_conflict(plant_id, bed_id, user_id, planting_year, rotation_window=3):
    """
    Check if planting this crop in this bed would violate rotation guidelines.

    Args:
        plant_id (str): Plant identifier (e.g., 'tomato-1')
        bed_id (int): Garden bed ID
        user_id (int): User ID
        planting_year (int): Year of intended planting
        rotation_window (int): Years to avoid same family (default: 3)

    Returns:
        dict: Rotation conflict status:
            {
                'has_conflict': bool,
                'conflict_years': list[int],  # Years when same family was planted
                'last_planted': datetime or None,  # Most recent conflict date
                'family': str or None,
                'recommendation': str,  # User-friendly message
                'safe_year': int or None  # Year when rotation is safe again
            }
    """
    # Get plant family
    plant = get_plant_by_id(plant_id)
    if not plant:
        return {
            'has_conflict': False,
            'conflict_years': [],
            'last_planted': None,
            'family': None,
            'recommendation': 'Plant not found in database.',
            'safe_year': None
        }

    family = plant.get('family')
    if not family:
        return {
            'has_conflict': False,
            'conflict_years': [],
            'last_planted': None,
            'family': None,
            'recommendation': 'Family unknown - rotation cannot be checked.',
            'safe_year': None
        }

    # Get bed history
    history = get_bed_rotation_history(bed_id, user_id, years_back=rotation_window)

    # Check for family matches
    conflicts = []
    for entry in history:
        if entry['family'] == family and entry['year'] < planting_year:
            conflicts.append(entry)

    if not conflicts:
        return {
            'has_conflict': False,
            'conflict_years': [],
            'last_planted': None,
            'family': family,
            'recommendation': f'Safe to plant {plant.get("name")} ({family}) in this bed.',
            'safe_year': None
        }

    # Found conflicts - build detailed response
    conflict_years = sorted([c['year'] for c in conflicts], reverse=True)
    last_planted = conflicts[0]['planted_date']  # Most recent (history is sorted)
    last_year = conflicts[0]['year']
    safe_year = last_year + rotation_window + 1

    # Build recommendation message
    if len(conflict_years) == 1:
        recommendation = (
            f"Warning: This bed had {family} in {conflict_years[0]}. "
            f"Wait until {safe_year} or choose a different bed to follow {rotation_window}-year rotation."
        )
    else:
        years_str = ', '.join(map(str, conflict_years))
        recommendation = (
            f"Warning: This bed had {family} in multiple recent years ({years_str}). "
            f"Wait until {safe_year} or choose a different bed to follow {rotation_window}-year rotation."
        )

    return {
        'has_conflict': True,
        'conflict_years': conflict_years,
        'last_planted': last_planted,
        'family': family,
        'recommendation': recommendation,
        'safe_year': safe_year
    }


def suggest_safe_beds(plant_id, user_id, planting_year, rotation_window=3):
    """
    Suggest beds that are safe for planting this crop based on rotation.

    Args:
        plant_id (str): Plant identifier
        user_id (int): User ID
        planting_year (int): Year of intended planting
        rotation_window (int): Years to avoid same family (default: 3)

    Returns:
        list[dict]: Beds sorted by rotation safety (safe first):
            [{
                'bed_id': int,
                'bed_name': str,
                'rotation_safe': bool,
                'conflict_info': dict or None  # Full conflict details if unsafe
            }, ...]
    """
    # Get all user's beds
    beds = GardenBed.query.filter_by(user_id=user_id).all()

    suggestions = []
    for bed in beds:
        # Check rotation for this bed
        conflict = check_rotation_conflict(
            plant_id=plant_id,
            bed_id=bed.id,
            user_id=user_id,
            planting_year=planting_year,
            rotation_window=rotation_window
        )

        suggestions.append({
            'bed_id': bed.id,
            'bed_name': bed.name,
            'rotation_safe': not conflict['has_conflict'],
            'conflict_info': conflict if conflict['has_conflict'] else None
        })

    # Sort: safe beds first, then alphabetically by name
    suggestions.sort(key=lambda x: (not x['rotation_safe'], x['bed_name']))

    return suggestions


def get_rotation_status_for_plan_item(plan_item, user_id, planting_year, rotation_window=3):
    """
    Check rotation status for a garden planner plan item.

    Useful for integrating rotation checking into the garden planner calculation service.

    Args:
        plan_item (dict): Plan item from garden planner with:
            - plantId (str)
            - bedsAllocated (list[int]) - optional bed assignments
        user_id (int): User ID
        planting_year (int): Year of intended planting
        rotation_window (int): Years to avoid same family (default: 3)

    Returns:
        dict: Rotation status:
            {
                'has_warnings': bool,
                'warnings': list[dict]  # Per-bed warnings
            }
    """
    plant_id = plan_item.get('plantId')
    beds_allocated = plan_item.get('bedsAllocated', [])

    if not plant_id or not beds_allocated:
        return {'has_warnings': False, 'warnings': []}

    warnings = []
    for bed_id in beds_allocated:
        conflict = check_rotation_conflict(
            plant_id=plant_id,
            bed_id=bed_id,
            user_id=user_id,
            planting_year=planting_year,
            rotation_window=rotation_window
        )

        if conflict['has_conflict']:
            # Get bed name for better UX
            bed = GardenBed.query.get(bed_id)
            bed_name = bed.name if bed else f'Bed {bed_id}'

            warnings.append({
                'bed_id': bed_id,
                'bed_name': bed_name,
                'message': conflict['recommendation'],
                'family': conflict['family'],
                'conflict_years': conflict['conflict_years'],
                'safe_year': conflict['safe_year']
            })

    return {
        'has_warnings': len(warnings) > 0,
        'warnings': warnings
    }
