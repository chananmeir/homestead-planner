"""
Conflict detection module for planting events.

This module provides spatial and temporal conflict detection for planting events
in garden beds. It uses grid-based positioning and checks for overlapping space
and time ranges.

Phase 2: Space Awareness - Timeline Planting Feature
"""
import math
from datetime import datetime
from typing import List, Dict, Optional, Any
from plant_database import get_plant_by_id


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

    # Ranges overlap if: start_a <= end_b AND start_b <= end_a
    return event_a_start <= event_b_end and event_b_start <= event_a_end


def get_primary_planting_date(event: Any) -> Optional[datetime]:
    """
    Get the primary planting date from an event.

    Priority: transplant_date > direct_seed_date > seed_start_date

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
    Complete conflict check with spatial and temporal validation.

    This function checks if a new planting event conflicts with any existing
    events in the same garden bed. A conflict occurs when:
    1. Both events have position data
    2. They are in the same garden bed
    3. They overlap spatially (too close together)
    4. They overlap temporally (time ranges intersect)

    Args:
        new_event: PlantingEvent object or dict to check
        existing_events: List of existing PlantingEvent objects or dicts
        garden_bed: GardenBed object or dict with grid_size

    Returns:
        Dict with:
            - has_conflict (bool): Whether any conflicts exist
            - conflicts (list): Details of conflicting events
            - type (str): 'spatial', 'temporal', or 'both' (if conflicts exist)
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

    # Get date range for new event
    if hasattr(new_event, 'expected_harvest_date'):
        new_start = get_primary_planting_date(new_event)
        new_end = new_event.expected_harvest_date
    else:
        new_start = get_primary_planting_date(new_event)
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

        # Check spatial overlap
        spatial_conflict = check_spatial_overlap(
            (new_x, new_y),
            (exist_x, exist_y),
            new_plant_spacing,
            exist_plant_spacing,
            grid_size
        )

        if spatial_conflict:
            # Get existing event dates
            if hasattr(existing, 'expected_harvest_date'):
                exist_start = get_primary_planting_date(existing)
                exist_end = existing.expected_harvest_date
            else:
                exist_start = get_primary_planting_date(existing)
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

    return {
        'has_conflict': len(conflicts) > 0,
        'conflicts': conflicts
    }
