"""
Event details JSON validation for PlantingEvent.event_details.

Validates write-path data for non-planting event types (mulch, maple-tapping).
Read paths remain defensive (try-except + .get() defaults) and are unchanged.

Pattern matches trellis_validation.py — pure functions, no database access.
"""
import logging
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# --- Allowed enum values ---

VALID_MULCH_TYPES = frozenset({
    'straw', 'wood-chips', 'leaves', 'grass',
    'compost', 'black-plastic', 'clear-plastic', 'none',
})

VALID_COVERAGE_VALUES = frozenset({'full', 'partial'})

VALID_TREE_TYPES = frozenset({'sugar', 'red', 'black', 'boxelder'})

VALID_SYRUP_GRADES = frozenset({'Golden', 'Amber', 'Dark', 'VeryDark'})

VALID_TAP_HEALING = frozenset({'good', 'fair', 'poor'})


def validate_event_details(
    event_type: str,
    details: Optional[dict],
) -> Tuple[bool, List[str]]:
    """Validate event_details dict for a given event_type.

    Returns:
        (True, [])           if valid
        (False, [err, ...])  if invalid
    """
    if event_type == 'planting':
        if details is not None:
            logger.warning(
                "Planting event has non-null event_details; "
                "planting events typically leave this NULL."
            )
        return True, []

    if event_type == 'mulch':
        if details is None:
            return False, ['event_details is required for mulch events']
        if not isinstance(details, dict):
            return False, ['event_details must be a dict']
        return _validate_mulch(details)

    if event_type == 'maple-tapping':
        if details is None:
            return False, ['event_details is required for maple-tapping events']
        if not isinstance(details, dict):
            return False, ['event_details must be a dict']
        return _validate_maple_tapping(details)

    # Unknown event type — accept for forward compatibility, but log
    logger.warning("Unknown event_type '%s'; skipping event_details validation.", event_type)
    return True, []


# ---------------------------------------------------------------------------
# Mulch validation
# ---------------------------------------------------------------------------

def _validate_mulch(details: dict) -> Tuple[bool, List[str]]:
    errors: List[str] = []

    # mulch_type — required, string, enum
    if 'mulch_type' not in details:
        errors.append("Missing required field: mulch_type")
    else:
        mt = details['mulch_type']
        if not isinstance(mt, str):
            errors.append(f"mulch_type must be a string, got {type(mt).__name__}")
        elif mt not in VALID_MULCH_TYPES:
            errors.append(
                f"Invalid mulch_type '{mt}'; "
                f"allowed: {sorted(VALID_MULCH_TYPES)}"
            )

    # coverage — required, string, enum
    if 'coverage' not in details:
        errors.append("Missing required field: coverage")
    else:
        cov = details['coverage']
        if not isinstance(cov, str):
            errors.append(f"coverage must be a string, got {type(cov).__name__}")
        elif cov not in VALID_COVERAGE_VALUES:
            errors.append(
                f"Invalid coverage '{cov}'; "
                f"allowed: {sorted(VALID_COVERAGE_VALUES)}"
            )

    # depth_inches — optional, number >= 0
    if 'depth_inches' in details and details['depth_inches'] is not None:
        d = details['depth_inches']
        # bool is subclass of int — reject bools
        if isinstance(d, bool) or not isinstance(d, (int, float)):
            errors.append(
                f"depth_inches must be a number, got {type(d).__name__}"
            )
        elif d < 0:
            errors.append(f"depth_inches must be >= 0, got {d}")

    # Warn on unknown keys (don't reject — forward compat)
    known = {'mulch_type', 'depth_inches', 'coverage'}
    unknown = set(details.keys()) - known
    if unknown:
        logger.warning("Mulch event_details has unknown keys: %s", unknown)

    return (len(errors) == 0, errors)


# ---------------------------------------------------------------------------
# Maple-tapping validation
# ---------------------------------------------------------------------------

def _validate_maple_tapping(details: dict) -> Tuple[bool, List[str]]:
    errors: List[str] = []

    # tree_type — required, string, enum
    if 'tree_type' not in details:
        errors.append("Missing required field: tree_type")
    else:
        tt = details['tree_type']
        if not isinstance(tt, str):
            errors.append(f"tree_type must be a string, got {type(tt).__name__}")
        elif tt not in VALID_TREE_TYPES:
            errors.append(
                f"Invalid tree_type '{tt}'; "
                f"allowed: {sorted(VALID_TREE_TYPES)}"
            )

    # tap_count — required, int >= 1
    if 'tap_count' not in details:
        errors.append("Missing required field: tap_count")
    else:
        tc = details['tap_count']
        # bool is subclass of int — reject bools
        if isinstance(tc, bool) or not isinstance(tc, int):
            errors.append(f"tap_count must be an integer, got {type(tc).__name__}")
        elif tc < 1:
            errors.append(f"tap_count must be >= 1, got {tc}")

    # tree_structure_id — optional, int
    if 'tree_structure_id' in details and details['tree_structure_id'] is not None:
        tsid = details['tree_structure_id']
        if isinstance(tsid, bool) or not isinstance(tsid, int):
            errors.append(
                f"tree_structure_id must be an integer, got {type(tsid).__name__}"
            )

    # collection_dates — optional, list of {date, sapAmount, notes?}
    if 'collection_dates' in details and details['collection_dates'] is not None:
        cd = details['collection_dates']
        if not isinstance(cd, list):
            errors.append(
                f"collection_dates must be a list, got {type(cd).__name__}"
            )
        else:
            for i, entry in enumerate(cd):
                if not isinstance(entry, dict):
                    errors.append(f"collection_dates[{i}] must be a dict")
                    continue
                if 'date' not in entry:
                    errors.append(f"collection_dates[{i}] missing required field: date")
                if 'sapAmount' not in entry:
                    errors.append(f"collection_dates[{i}] missing required field: sapAmount")
                elif not isinstance(entry['sapAmount'], (int, float)) or isinstance(entry['sapAmount'], bool):
                    errors.append(
                        f"collection_dates[{i}].sapAmount must be a number, "
                        f"got {type(entry['sapAmount']).__name__}"
                    )

    # syrup_yield — optional, dict {gallons?, grade?, boilDate?, notes?}
    if 'syrup_yield' in details and details['syrup_yield'] is not None:
        sy = details['syrup_yield']
        if not isinstance(sy, dict):
            errors.append(
                f"syrup_yield must be a dict, got {type(sy).__name__}"
            )
        else:
            if 'gallons' in sy and sy['gallons'] is not None:
                g = sy['gallons']
                if isinstance(g, bool) or not isinstance(g, (int, float)):
                    errors.append(
                        f"syrup_yield.gallons must be a number, "
                        f"got {type(g).__name__}"
                    )
            if 'grade' in sy and sy['grade'] is not None:
                gr = sy['grade']
                if not isinstance(gr, str):
                    errors.append(
                        f"syrup_yield.grade must be a string, "
                        f"got {type(gr).__name__}"
                    )
                elif gr not in VALID_SYRUP_GRADES:
                    errors.append(
                        f"Invalid syrup_yield.grade '{gr}'; "
                        f"allowed: {sorted(VALID_SYRUP_GRADES)}"
                    )

    # tree_health — optional, dict {tapHealing?, observations?, diameter?}
    if 'tree_health' in details and details['tree_health'] is not None:
        th = details['tree_health']
        if not isinstance(th, dict):
            errors.append(
                f"tree_health must be a dict, got {type(th).__name__}"
            )
        else:
            if 'tapHealing' in th and th['tapHealing'] is not None:
                heal = th['tapHealing']
                if not isinstance(heal, str):
                    errors.append(
                        f"tree_health.tapHealing must be a string, "
                        f"got {type(heal).__name__}"
                    )
                elif heal not in VALID_TAP_HEALING:
                    errors.append(
                        f"Invalid tree_health.tapHealing '{heal}'; "
                        f"allowed: {sorted(VALID_TAP_HEALING)}"
                    )
            if 'diameter' in th and th['diameter'] is not None:
                diam = th['diameter']
                if isinstance(diam, bool) or not isinstance(diam, (int, float)):
                    errors.append(
                        f"tree_health.diameter must be a number, "
                        f"got {type(diam).__name__}"
                    )

    # Warn on unknown keys (don't reject — forward compat)
    known = {
        'tree_type', 'tap_count', 'tree_structure_id',
        'collection_dates', 'syrup_yield', 'tree_health',
    }
    unknown = set(details.keys()) - known
    if unknown:
        logger.warning("Maple-tapping event_details has unknown keys: %s", unknown)

    return (len(errors) == 0, errors)
