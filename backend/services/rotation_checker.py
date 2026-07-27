"""
Crop Rotation Service Layer

Business logic for crop rotation planning and conflict detection.
Tracks plant family history in garden beds and warns about rotation violations.

Uses family/category-specific policy rules so cover crops and low-risk companion
crops do not trigger the same warning as high-risk production families.
"""
from sqlalchemy import extract, or_
from models import PlantingEvent, GardenBed
from plant_database import get_plant_by_id
from services.rotation_policy import get_rotation_policy, score_rotation_risk
from simulation_clock import get_now


SEVERITY_RANK = {
    'ok': 0,
    'info': 1,
    'caution': 2,
    'warning': 3,
    'high': 4,
}


def _planting_history_date(event):
    return event.direct_seed_date or event.transplant_date or event.seed_start_date


def _serialize_history_dates(entries):
    serialized = []
    for entry in entries:
        item = dict(entry)
        planted_date = item.get('planted_date')
        if hasattr(planted_date, 'isoformat'):
            item['planted_date'] = planted_date.isoformat()
        serialized.append(item)
    return serialized


def get_bed_rotation_history(bed_id, user_id, years_back=3, reference_year=None):
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
    current_year = reference_year or get_now().year
    start_year = current_year - years_back

    # Query PlantingEvent records for this bed in the time window
    # Check direct_seed_date OR transplant_date (whichever is earlier/present)
    events = PlantingEvent.query.filter(
        PlantingEvent.garden_bed_id == bed_id,
        PlantingEvent.user_id == user_id,
        PlantingEvent.event_type == 'planting',  # Only planting events, not mulch/etc
        PlantingEvent.cancelled_at.is_(None),
        or_(
            extract('year', PlantingEvent.direct_seed_date) >= start_year,
            extract('year', PlantingEvent.transplant_date) >= start_year,
            extract('year', PlantingEvent.seed_start_date) >= start_year
        )
    ).all()

    history = []
    for event in events:
        # Determine planting year (use whichever date exists)
        planting_date = _planting_history_date(event)
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
            'category': plant.get('category'),
            'year': planting_year,
            'planted_date': planting_date,
            'variety': event.variety,
            'quantity': event.quantity,
            'space_required': event.space_required,
        })

    # Sort by year (most recent first)
    history.sort(key=lambda x: x['year'], reverse=True)

    return history


def _build_recommendation(plant, family, risk):
    severity = risk['severity']
    window = risk['rotation_window']
    conflicts = risk['conflicts']

    if severity == 'ok':
        if 'target_cover_crop' in risk['reason_codes']:
            return (
                f"{plant.get('name')} is a cover crop, so it does not trigger "
                "normal crop-family rotation warnings."
            )
        if risk['ignored_history']:
            return (
                f"Safe to plant {plant.get('name')} ({family}) in this bed. "
                "Recent cover-crop history was ignored for family-rotation risk."
            )
        return f"Safe to plant {plant.get('name')} ({family}) in this bed."

    years = sorted({c['year'] for c in conflicts}, reverse=True)
    years_str = ', '.join(map(str, years))
    exposure = conflicts[0].get('exposure', 'unknown_exposure').replace('_', ' ')

    if severity == 'high':
        prefix = 'High rotation risk'
    elif severity == 'warning':
        prefix = 'Rotation warning'
    elif severity == 'caution':
        prefix = 'Rotation caution'
    else:
        prefix = 'Rotation note'

    return (
        f"{prefix}: this bed had {family} in {years_str}. "
        f"Risk is {risk['risk_score']}/100 ({exposure}); "
        f"use a different bed or wait for the {window}-year rotation window when practical."
    )


def check_rotation_conflict(plant_id, bed_id, user_id, planting_year, rotation_window=None):
    """
    Check if planting this crop in this bed would violate rotation guidelines.

    Args:
        plant_id (str): Plant identifier (e.g., 'tomato-1')
        bed_id (int): Garden bed ID
        user_id (int): User ID
        planting_year (int): Year of intended planting
        rotation_window (int): Optional override. When omitted, family/category policy is used.

    Returns:
        dict: Rotation conflict status:
            {
                'has_conflict': bool,
                'conflict_years': list[int],  # Years when same family was planted
            'last_planted': datetime or None,  # Most recent conflict date
            'family': str or None,
            'recommendation': str,  # User-friendly message
            'safe_year': int or None,  # Year when rotation is safe again
            'severity': str,
            'risk_score': int,
            'reason_codes': list[str],
            'history': list[dict]
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
            'safe_year': None,
            'severity': 'ok',
            'risk_score': 0,
            'rotation_window': 0,
            'reason_codes': ['plant_not_found'],
            'history': []
        }

    family = plant.get('family')
    if not family:
        return {
            'has_conflict': False,
            'conflict_years': [],
            'last_planted': None,
            'family': None,
            'recommendation': 'Family unknown - rotation cannot be checked.',
            'safe_year': None,
            'severity': 'info',
            'risk_score': 0,
            'rotation_window': 0,
            'reason_codes': ['family_unknown'],
            'history': []
        }

    policy = get_rotation_policy(plant, override_window=rotation_window)
    years_back = max(policy.window_years, 1)
    history = get_bed_rotation_history(
        bed_id,
        user_id,
        years_back=years_back,
        reference_year=planting_year,
    )

    risk = score_rotation_risk(
        plant=plant,
        history=history,
        planting_year=planting_year,
        override_window=rotation_window,
    )
    conflicts = risk['conflicts']
    conflict_years = sorted({c['year'] for c in conflicts}, reverse=True)
    last_planted = conflicts[0]['planted_date'] if conflicts else None
    last_year = conflicts[0]['year'] if conflicts else None
    safe_year = last_year + risk['rotation_window'] + 1 if last_year and risk['rotation_window'] else None
    severity = risk['severity']
    has_conflict = severity in {'warning', 'high'}
    has_concern = severity in {'info', 'caution', 'warning', 'high'}
    recommendation = _build_recommendation(plant, family, risk)

    return {
        'has_conflict': has_conflict,
        'has_rotation_concern': has_concern,
        'conflict_years': conflict_years,
        'last_planted': last_planted,
        'family': family,
        'recommendation': recommendation,
        'safe_year': safe_year,
        'severity': severity,
        'risk_score': risk['risk_score'],
        'rotation_window': risk['rotation_window'],
        'reason_codes': risk['reason_codes'],
        'history': history,
        'conflicts': conflicts,
        'ignored_history': risk['ignored_history'],
    }


def suggest_safe_beds(plant_id, user_id, planting_year, rotation_window=None):
    """
    Suggest beds that are safe for planting this crop based on rotation.

    Args:
        plant_id (str): Plant identifier
        user_id (int): User ID
        planting_year (int): Year of intended planting
        rotation_window (int): Optional override. When omitted, family/category policy is used.

    Returns:
        list[dict]: Beds sorted by rotation safety (safe first):
            [{
                'bed_id': int,
                'bed_name': str,
            'rotation_safe': bool,
            'severity': str,
            'risk_score': int,
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
            'rotation_safe': conflict['severity'] in {'ok', 'info'},
            'severity': conflict['severity'],
            'risk_score': conflict['risk_score'],
            'conflict_info': conflict if conflict['has_rotation_concern'] else None
        })

    suggestions.sort(key=lambda x: (SEVERITY_RANK.get(x['severity'], 99), x['risk_score'], x['bed_name']))

    return suggestions


def get_rotation_status_for_plan_item(plan_item, user_id, planting_year, rotation_window=None):
    """
    Check rotation status for a garden planner plan item.

    Useful for integrating rotation checking into the garden planner calculation service.

    Args:
        plan_item (dict): Plan item from garden planner with:
            - plantId (str)
            - bedsAllocated (list[int]) - optional bed assignments
        user_id (int): User ID
        planting_year (int): Year of intended planting
        rotation_window (int): Optional override. When omitted, family/category policy is used.

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

        if conflict['has_rotation_concern']:
            # Get bed name for better UX
            bed = GardenBed.query.get(bed_id)
            bed_name = bed.name if bed else f'Bed {bed_id}'

            warnings.append({
                'bed_id': bed_id,
                'bed_name': bed_name,
                'message': conflict['recommendation'],
                'family': conflict['family'],
                'conflict_years': conflict['conflict_years'],
                'safe_year': conflict['safe_year'],
                'severity': conflict['severity'],
                'risk_score': conflict['risk_score'],
                'rotation_window': conflict['rotation_window'],
                'reason_codes': conflict['reason_codes'],
                'history': _serialize_history_dates(conflict['history']),
                'conflicts': _serialize_history_dates(conflict['conflicts']),
                'ignored_history': _serialize_history_dates(conflict['ignored_history']),
            })

    return {
        'has_warnings': len(warnings) > 0,
        'warnings': warnings
    }
