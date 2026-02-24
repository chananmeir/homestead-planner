"""
Conflict detection module for planting events.

This module provides spatial and temporal conflict detection for planting events
in garden beds. It uses grid-based positioning and checks for overlapping space
and time ranges.

Phase 2: Space Awareness - Timeline Planting Feature
"""
import math
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Tuple
from plant_database import get_plant_by_id
from migardener_spacing import get_migardener_spacing


def check_spatial_overlap(
    event_a_pos: tuple,
    event_b_pos: tuple,
    plant_a_spacing: float,
    plant_b_spacing: float,
    bed_grid_size: int
) -> bool:
    """
    Check if two plantings occupy overlapping space using Chebyshev distance.

    Chebyshev distance (also known as chessboard distance) is the maximum of
    absolute differences in coordinates. This is appropriate for square grids
    where diagonal movement has the same cost as cardinal movement.

    Args:
        event_a_pos: Tuple of (x, y) grid coordinates for event A
        event_b_pos: Tuple of (x, y) grid coordinates for event B
        plant_a_spacing: Spacing requirement in inches for plant A
        plant_b_spacing: Spacing requirement in inches for plant B
        bed_grid_size: Size of grid cells in inches (e.g., 12 for 1-foot squares)

    Returns:
        True if plantings overlap spatially, False otherwise
    """
    # Calculate how many grid cells each plant occupies
    cells_a = math.ceil(plant_a_spacing / bed_grid_size)
    cells_b = math.ceil(plant_b_spacing / bed_grid_size)

    # Chebyshev distance: max of absolute differences
    distance = max(
        abs(event_a_pos[0] - event_b_pos[0]),
        abs(event_a_pos[1] - event_b_pos[1])
    )

    # Required spacing is the larger of the two plants
    # (conservative approach - ensures both have enough space)
    required_distance = max(cells_a, cells_b)

    # Conflict if distance is less than required
    return distance < required_distance


def check_temporal_overlap(
    event_a_start: datetime,
    event_a_end: datetime,
    event_b_start: datetime,
    event_b_end: datetime
) -> bool:
    """
    Check if two planting events occupy the same timeframe.

    Two date ranges overlap if:
    - The start of A is before or at the end of B, AND
    - The start of B is before or at the end of A

    Args:
        event_a_start: Start date of event A (transplant or direct seed date)
        event_a_end: End date of event A (harvest date)
        event_b_start: Start date of event B
        event_b_end: End date of event B

    Returns:
        True if time ranges overlap, False otherwise
    """
    if not all([event_a_start, event_a_end, event_b_start, event_b_end]):
        # Can't determine overlap without all dates
        return False

    # Convert to comparable format if needed
    if isinstance(event_a_start, str):
        event_a_start = datetime.fromisoformat(event_a_start.replace('Z', '+00:00'))
    if isinstance(event_a_end, str):
        event_a_end = datetime.fromisoformat(event_a_end.replace('Z', '+00:00'))
    if isinstance(event_b_start, str):
        event_b_start = datetime.fromisoformat(event_b_start.replace('Z', '+00:00'))
    if isinstance(event_b_end, str):
        event_b_end = datetime.fromisoformat(event_b_end.replace('Z', '+00:00'))

    # Ranges overlap if: start_a < end_b AND start_b < end_a
    # Uses strict inequality so that sequential plantings (harvest day == plant day)
    # are NOT treated as conflicts — the old plant is removed and space is free.
    return event_a_start < event_b_end and event_b_start < event_a_end


def check_sun_exposure_compatibility(
    plant_id: str,
    bed_sun_exposure: Optional[str]
) -> Dict[str, Any]:
    """
    Check if a plant's sun requirements are compatible with a bed's sun exposure.

    Compatibility rules:
    - 'full' requirement: only 'full' beds work well
    - 'partial' requirement: 'full' or 'partial' beds work
    - 'shade' requirement: any exposure works (shade-tolerant plants adapt)

    Args:
        plant_id: Plant ID to check
        bed_sun_exposure: Bed's sun exposure ('full', 'partial', 'shade', or None)

    Returns:
        Dict with:
            - compatible (bool): Whether plant and bed are compatible
            - plant_requirement (str): Plant's sun requirement
            - bed_exposure (str): Bed's sun exposure
            - severity (str): 'error' for incompatible, 'warning' for suboptimal, None if compatible
            - message (str): Human-readable explanation
    """
    plant = get_plant_by_id(plant_id)
    if not plant:
        return {
            'compatible': True,
            'plant_requirement': None,
            'bed_exposure': bed_sun_exposure,
            'severity': None,
            'message': None
        }

    plant_requirement = plant.get('sunRequirement', 'full')

    # If bed has no sun exposure set, can't validate (assume compatible)
    if not bed_sun_exposure:
        return {
            'compatible': True,
            'plant_requirement': plant_requirement,
            'bed_exposure': None,
            'severity': None,
            'message': None
        }

    # Define compatibility matrix
    # Format: plant_requirement -> list of acceptable bed exposures
    compatibility_map = {
        'full': ['full'],              # Full-sun plants need full sun
        'partial': ['full', 'partial'], # Partial-sun plants work in full or partial
        'shade': ['full', 'partial', 'shade']  # Shade plants adapt to any light
    }

    acceptable_exposures = compatibility_map.get(plant_requirement, ['full'])
    compatible = bed_sun_exposure in acceptable_exposures

    # Generate helpful message
    plant_name = plant.get('name', 'This plant')
    if compatible:
        message = None
        severity = None
    else:
        if plant_requirement == 'full' and bed_sun_exposure in ['partial', 'shade']:
            severity = 'error'
            message = f"{plant_name} requires full sun (6+ hours) but this bed has {bed_sun_exposure} sun. Growth will be poor and yields reduced."
        elif plant_requirement == 'partial' and bed_sun_exposure == 'shade':
            severity = 'warning'
            message = f"{plant_name} prefers partial sun but this bed has {bed_sun_exposure}. May grow slowly with reduced yields."
        else:
            severity = 'warning'
            message = f"{plant_name} prefers {plant_requirement} sun but bed has {bed_sun_exposure} sun."

    return {
        'compatible': compatible,
        'plant_requirement': plant_requirement,
        'bed_exposure': bed_sun_exposure,
        'severity': severity,
        'message': message
    }


def get_in_ground_date(event: Any) -> Optional[datetime]:
    """
    Get the date when a plant starts occupying garden bed space.

    Only returns transplant_date or direct_seed_date — NOT seed_start_date,
    because seed_start_date is when seeds start INDOORS and the plant does not
    occupy bed space yet.  Returning seed_start_date here would cause false-
    positive spatial conflicts.

    Priority: transplant_date > direct_seed_date

    Args:
        event: PlantingEvent object or dict

    Returns:
        In-ground start date or None
    """
    if hasattr(event, 'transplant_date'):
        return event.transplant_date or event.direct_seed_date
    else:
        return event.get('transplantDate') or event.get('directSeedDate')


def get_primary_planting_date(event: Any) -> Optional[datetime]:
    """
    Get the primary planting date from an event (including indoor starts).

    Priority: transplant_date > direct_seed_date > seed_start_date

    NOTE: For spatial conflict checking, use get_in_ground_date() instead.
    This function is kept for backward compatibility with non-conflict uses.

    Args:
        event: PlantingEvent object or dict

    Returns:
        Primary planting date or None
    """
    if hasattr(event, 'transplant_date'):
        return event.transplant_date or event.direct_seed_date or event.seed_start_date
    else:
        return event.get('transplantDate') or event.get('directSeedDate') or event.get('seedStartDate')


def has_conflict(
    new_event: Any,
    existing_events: List[Any],
    garden_bed: Any
) -> Dict[str, Any]:
    """
    Complete conflict check with spatial, temporal, and sun exposure validation.

    This function checks if a new planting event conflicts with any existing
    events in the same garden bed. A conflict occurs when:
    1. Both events have position data
    2. They are in the same garden bed
    3. They overlap spatially (too close together)
    4. They overlap temporally (time ranges intersect)

    Also checks sun exposure compatibility between plant and bed.

    Args:
        new_event: PlantingEvent object or dict to check
        existing_events: List of existing PlantingEvent objects or dicts
        garden_bed: GardenBed object or dict with grid_size and sun_exposure

    Returns:
        Dict with:
            - has_conflict (bool): Whether any spatial/temporal conflicts exist
            - conflicts (list): Details of conflicting events
            - sun_exposure_warning (dict): Sun exposure compatibility info (if applicable)
    """
    # Extract position from new event
    if hasattr(new_event, 'position_x'):
        new_x = new_event.position_x
        new_y = new_event.position_y
        new_bed_id = new_event.garden_bed_id
        new_id = getattr(new_event, 'id', None)
    else:
        new_x = new_event.get('positionX')
        new_y = new_event.get('positionY')
        new_bed_id = new_event.get('gardenBedId')
        new_id = new_event.get('id')

    # If no position data, no conflict possible
    if new_x is None or new_y is None:
        return {
            'has_conflict': False,
            'conflicts': [],
            'type': None
        }

    # Get grid size from bed
    if hasattr(garden_bed, 'grid_size'):
        grid_size = garden_bed.grid_size
    else:
        grid_size = garden_bed.get('gridSize', 12)

    # Get plant data for new event
    if hasattr(new_event, 'plant_id'):
        new_plant_id = new_event.plant_id
    else:
        new_plant_id = new_event.get('plantId')

    new_plant = get_plant_by_id(new_plant_id)
    if not new_plant:
        # Can't check conflicts without plant data
        return {
            'has_conflict': False,
            'conflicts': [],
            'type': None
        }

    new_plant_spacing = new_plant.get('spacing', 12)  # Default 12" if not specified

    # Use method-specific spacing for MIGardener beds
    if hasattr(garden_bed, 'planning_method'):
        bed_planning_method = garden_bed.planning_method
    else:
        bed_planning_method = garden_bed.get('planningMethod')

    if bed_planning_method == 'migardener':
        mg = get_migardener_spacing(new_plant_id, new_plant_spacing, new_plant.get('rowSpacing'))
        new_plant_spacing = mg['plant_spacing']

    # SFG: each cell is an independent growing unit.
    # Spacing determines density within a cell, not multi-cell exclusion.
    if bed_planning_method == 'square-foot':
        new_plant_spacing = min(new_plant_spacing, grid_size)

    # Get date range for new event (use in-ground date, not indoor seed start)
    if hasattr(new_event, 'expected_harvest_date'):
        new_start = get_in_ground_date(new_event)
        new_end = new_event.expected_harvest_date
    else:
        new_start = get_in_ground_date(new_event)
        new_end = new_event.get('expectedHarvestDate')
        if isinstance(new_end, str):
            new_end = datetime.fromisoformat(new_end.replace('Z', '+00:00'))

    conflicts = []

    for existing in existing_events:
        # Extract existing event data
        if hasattr(existing, 'position_x'):
            exist_x = existing.position_x
            exist_y = existing.position_y
            exist_bed_id = existing.garden_bed_id
            exist_id = existing.id
            exist_plant_id = existing.plant_id
        else:
            exist_x = existing.get('positionX')
            exist_y = existing.get('positionY')
            exist_bed_id = existing.get('gardenBedId')
            exist_id = existing.get('id')
            exist_plant_id = existing.get('plantId')

        # Skip if no position data
        if exist_x is None or exist_y is None:
            continue

        # Skip if different bed
        if exist_bed_id != new_bed_id:
            continue

        # Skip if same event (when editing)
        if new_id and exist_id == new_id:
            continue

        # Get existing plant data
        exist_plant = get_plant_by_id(exist_plant_id)
        if not exist_plant:
            continue

        exist_plant_spacing = exist_plant.get('spacing', 12)

        # Use method-specific spacing for MIGardener beds
        if bed_planning_method == 'migardener':
            mg = get_migardener_spacing(exist_plant_id, exist_plant_spacing, exist_plant.get('rowSpacing'))
            exist_plant_spacing = mg['plant_spacing']

        # SFG: cap spacing to grid size (same-position conflicts only)
        if bed_planning_method == 'square-foot':
            exist_plant_spacing = min(exist_plant_spacing, grid_size)

        # Check spatial overlap
        spatial_conflict = check_spatial_overlap(
            (new_x, new_y),
            (exist_x, exist_y),
            new_plant_spacing,
            exist_plant_spacing,
            grid_size
        )

        if spatial_conflict:
            # Get existing event dates (use in-ground date, not indoor seed start)
            if hasattr(existing, 'expected_harvest_date'):
                exist_start = get_in_ground_date(existing)
                exist_end = existing.expected_harvest_date
            else:
                exist_start = get_in_ground_date(existing)
                exist_end = existing.get('expectedHarvestDate')
                if isinstance(exist_end, str):
                    exist_end = datetime.fromisoformat(exist_end.replace('Z', '+00:00'))

            # Check temporal overlap
            temporal_conflict = check_temporal_overlap(
                new_start,
                new_end,
                exist_start,
                exist_end
            )

            if temporal_conflict:
                # Format dates for display
                if hasattr(existing, 'variety'):
                    variety = existing.variety
                else:
                    variety = existing.get('variety')

                start_str = exist_start.strftime('%Y-%m-%d') if exist_start else 'Unknown'
                end_str = exist_end.strftime('%Y-%m-%d') if exist_end else 'Unknown'

                conflicts.append({
                    'eventId': exist_id,
                    'plantName': exist_plant.get('name', 'Unknown'),
                    'variety': variety,
                    'dates': f"{start_str} to {end_str}",
                    'position': {'x': exist_x, 'y': exist_y},
                    'type': 'both'  # Both spatial and temporal
                })

    # Check sun exposure compatibility
    bed_sun_exposure = None
    if hasattr(garden_bed, 'sun_exposure'):
        bed_sun_exposure = garden_bed.sun_exposure
    elif isinstance(garden_bed, dict):
        bed_sun_exposure = garden_bed.get('sunExposure')

    sun_check = check_sun_exposure_compatibility(new_plant_id, bed_sun_exposure)

    result = {
        'has_conflict': len(conflicts) > 0,
        'conflicts': conflicts
    }

    # Add sun exposure warning if incompatible
    if not sun_check['compatible']:
        result['sun_exposure_warning'] = sun_check

    return result


def planted_item_to_event(item):
    """
    Convert a PlantedItem into a lightweight object with the attributes
    that has_conflict() expects (matching PlantingEvent's interface).
    """
    plant = get_plant_by_id(item.plant_id)
    dtm = plant.get('daysToMaturity', 60) if plant else 60
    in_ground = item.transplant_date or item.planted_date

    # Determine end date: seed saving > explicit harvest > calculated harvest
    if item.save_for_seed and not item.seeds_collected and item.seed_maturity_date:
        end = item.seed_maturity_date
    elif item.harvest_date:
        end = item.harvest_date
    elif in_ground:
        end = in_ground + timedelta(days=dtm)
    else:
        end = None

    return type('PIEvent', (), {
        'id': item.id,
        'position_x': item.position_x,
        'position_y': item.position_y,
        'garden_bed_id': item.garden_bed_id,
        'plant_id': item.plant_id,
        'variety': item.variety,
        'transplant_date': item.transplant_date,
        'direct_seed_date': item.planted_date if not item.transplant_date else None,
        'seed_start_date': None,
        'expected_harvest_date': end,
    })()


def query_candidate_items(garden_bed_id, user_id, exclude_item_id=None):
    """
    Query PlantedItems in a garden bed and convert them to event-like objects
    for conflict checking. PlantedItems are the ground truth for what's
    physically in the garden — they can't be orphaned like PlantingEvents.
    """
    from models import PlantedItem
    query = PlantedItem.query.filter(
        PlantedItem.user_id == user_id,
        PlantedItem.garden_bed_id == garden_bed_id,
        PlantedItem.position_x.isnot(None),
        PlantedItem.position_y.isnot(None),
    )
    if exclude_item_id is not None:
        query = query.filter(PlantedItem.id != exclude_item_id)
    return [planted_item_to_event(pi) for pi in query.all()]


def validate_planting_conflict(
    event_data: Dict[str, Any],
    user_id: int,
    exclude_event_id: Optional[int] = None,
    exclude_item_id: Optional[int] = None
) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """
    Server-side enforcement of conflict rules.

    This function validates whether a planting event can be created without conflicts.
    It's called from POST endpoints to enforce spatial/temporal exclusivity server-side.

    Uses PlantedItems (ground truth) instead of PlantingEvents to avoid false positives
    from orphaned PlantingEvents.

    Args:
        event_data: Dict with garden_bed_id, position_x/y, dates, plant_id, conflict_override
        user_id: Current user ID for filtering existing events
        exclude_event_id: (Backward compat) PlantingEvent ID — converted to exclude_item_id
        exclude_item_id: PlantedItem ID to exclude (for editing existing items)

    Returns:
        (True, None) - Valid, proceed with creation
        (False, error_dict) - Invalid, return 409 Conflict with error details
    """
    from models import db, PlantingEvent, PlantedItem, GardenBed

    # 1. Skip validation if no position data (timeline-only events)
    # IMPORTANT: Check for None explicitly, not truthiness (0 is valid position!)
    if event_data.get('position_x') is None or event_data.get('position_y') is None:
        return (True, None)

    # 2. Skip validation if conflict_override=True (user explicitly approved)
    if event_data.get('conflict_override'):
        return (True, None)

    # 3. Skip validation if missing critical date data
    start_date = event_data.get('start_date')
    end_date = event_data.get('end_date')
    if not start_date or not end_date:
        return (True, None)

    # 4. Query existing items in same garden bed with positions
    garden_bed_id = event_data.get('garden_bed_id')
    if not garden_bed_id:
        return (True, None)

    # Get garden bed for grid size
    garden_bed = GardenBed.query.get(garden_bed_id)
    if not garden_bed:
        return (False, {
            'error': 'Garden bed not found',
            'message': f'Garden bed {garden_bed_id} does not exist'
        })

    # Backward compat: convert exclude_event_id → exclude_item_id
    if exclude_event_id and not exclude_item_id:
        evt = PlantingEvent.query.get(exclude_event_id)
        if evt:
            match = PlantedItem.query.filter_by(
                garden_bed_id=int(evt.garden_bed_id) if evt.garden_bed_id else None,
                plant_id=evt.plant_id,
                position_x=evt.position_x,
                position_y=evt.position_y,
                user_id=evt.user_id
            ).first()
            if match:
                exclude_item_id = match.id

    # Query PlantedItems directly — they are ground truth and can't be orphaned
    candidate_events = query_candidate_items(garden_bed_id, user_id, exclude_item_id)

    # DEBUG: Log candidate items found
    print(f"[CONFLICT CHECK] pos=({event_data.get('position_x')},{event_data.get('position_y')}), "
          f"plant={event_data.get('plant_id')}, candidates={len(candidate_events)}")
    for ce in candidate_events:
        ce_start = ce.transplant_date or ce.direct_seed_date
        print(f"  candidate item {ce.id}: plant={ce.plant_id}, pos=({ce.position_x},{ce.position_y}), "
              f"start={ce_start}, end={ce.expected_harvest_date}")

    # 5. Create temporary event object for conflict checking
    temp_event = type('TempEvent', (), {
        'position_x': event_data['position_x'],
        'position_y': event_data['position_y'],
        'garden_bed_id': garden_bed_id,
        'plant_id': event_data['plant_id'],
        'transplant_date': event_data.get('transplant_date'),
        'direct_seed_date': event_data.get('direct_seed_date'),
        'seed_start_date': event_data.get('seed_start_date'),
        'expected_harvest_date': end_date,
        'id': exclude_item_id
    })()

    # 6. Call existing has_conflict() function
    result = has_conflict(temp_event, candidate_events, garden_bed)

    # 7. Return validation result
    if result['has_conflict']:
        return (False, {
            'error': 'Planting conflict detected',
            'conflicts': result['conflicts'],
            'message': f"This position overlaps with {len(result['conflicts'])} existing planting(s). Set conflictOverride=true to force creation."
        })

    return (True, None)
