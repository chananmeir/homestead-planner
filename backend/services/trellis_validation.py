"""
Trellis segment validation utilities.

Validates that trellis position allocations are within bounds and
do not overlap with existing allocations.
"""
import logging

logger = logging.getLogger(__name__)


def validate_trellis_segment(trellis, start_inches, end_inches):
    """Validate that a trellis segment range is valid.

    Args:
        trellis: TrellisStructure model instance
        start_inches: Proposed start position in inches
        end_inches: Proposed end position in inches

    Returns:
        (True, None) if valid, (False, error_string) if invalid
    """
    if start_inches < 0:
        return False, f"Start position cannot be negative (got {start_inches})"

    if end_inches <= start_inches:
        return False, f"End position ({end_inches}) must be greater than start ({start_inches})"

    if end_inches > trellis.total_length_inches:
        return False, (
            f"Segment end ({end_inches}\") exceeds trellis length "
            f"({trellis.total_length_inches}\")"
        )

    return True, None


def check_trellis_overlaps(trellis_id, user_id, start_inches, end_inches,
                           exclude_event_id=None):
    """Check if a proposed trellis segment overlaps existing allocations.

    Only considers events that have non-null position_start AND position_end.

    Args:
        trellis_id: ID of the trellis structure
        user_id: Current user's ID (always filter by user)
        start_inches: Proposed start position in inches
        end_inches: Proposed end position in inches
        exclude_event_id: Optional event ID to exclude (for updates)

    Returns:
        List of overlapping PlantingEvent IDs (empty = no overlaps)
    """
    from models import PlantingEvent

    query = PlantingEvent.query.filter(
        PlantingEvent.trellis_structure_id == trellis_id,
        PlantingEvent.user_id == user_id,
        PlantingEvent.trellis_position_start_inches.isnot(None),
        PlantingEvent.trellis_position_end_inches.isnot(None),
        # Overlap condition: new_start < existing_end AND new_end > existing_start
        PlantingEvent.trellis_position_start_inches < end_inches,
        PlantingEvent.trellis_position_end_inches > start_inches,
    )

    if exclude_event_id is not None:
        query = query.filter(PlantingEvent.id != exclude_event_id)

    overlapping = query.all()
    return [e.id for e in overlapping]
