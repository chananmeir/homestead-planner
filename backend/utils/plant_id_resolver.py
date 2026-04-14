"""
Plant ID Alias Resolver (Backend)

Maps deprecated/variety-specific plant IDs to canonical plant IDs.
Keep in sync with frontend/src/utils/plantIdResolver.ts

Usage:
    from utils.plant_id_resolver import resolve_alias, validate_and_resolve_plant_id

    # Resolve alias
    canonical_id = resolve_alias('chia-white')  # returns 'chia-1'

    # Validate and get canonical ID
    valid, canonical_id, error = validate_and_resolve_plant_id('chia-white')
"""

from plant_database import PLANT_DATABASE

# Alias map: deprecated plant_id -> canonical plant_id
# Keep in sync with:
# - frontend/src/utils/plantIdResolver.ts::PLANT_ID_ALIASES
# - backend/migrations/custom/data/repair_plant_ids.py::PLANT_ID_ALIASES
PLANT_ID_ALIASES = {
    'chia-white': 'chia-1',
    # Add more aliases as needed:
    # 'old-plant-id': 'new-canonical-id',
}

# Cache for valid plant IDs
_valid_plant_ids = None


def _get_valid_plant_ids():
    """Get set of valid plant IDs from PLANT_DATABASE (cached)."""
    global _valid_plant_ids
    if _valid_plant_ids is None:
        _valid_plant_ids = {plant['id'] for plant in PLANT_DATABASE}
    return _valid_plant_ids


def resolve_alias(plant_id: str) -> str:
    """
    Resolve a plant_id alias to its canonical ID.
    Returns the original ID if no alias exists.

    Args:
        plant_id: The plant ID (may be deprecated/aliased)

    Returns:
        The canonical plant ID
    """
    return PLANT_ID_ALIASES.get(plant_id, plant_id)


def is_deprecated_plant_id(plant_id: str) -> bool:
    """Check if a plant ID is deprecated (has an alias)."""
    return plant_id in PLANT_ID_ALIASES


def validate_plant_id(plant_id: str) -> bool:
    """
    Validate that plant_id exists in PLANT_DATABASE.
    Does NOT resolve aliases - use validate_and_resolve_plant_id for that.

    Args:
        plant_id: The plant_id to validate

    Returns:
        bool: True if plant_id exists, False otherwise
    """
    return plant_id in _get_valid_plant_ids()


def validate_and_resolve_plant_id(plant_id: str) -> tuple:
    """
    Validate and resolve a plant_id, applying alias resolution.

    Args:
        plant_id: The plant ID to validate (may be deprecated/aliased)

    Returns:
        tuple: (is_valid, canonical_id, error_message)
            - is_valid: True if valid (directly or via alias)
            - canonical_id: The canonical plant ID to use
            - error_message: Error message if invalid, None otherwise
    """
    if not plant_id:
        return (False, None, "plant_id is required")

    # Try direct lookup first
    if validate_plant_id(plant_id):
        return (True, plant_id, None)

    # Try alias resolution
    canonical_id = resolve_alias(plant_id)
    if canonical_id != plant_id and validate_plant_id(canonical_id):
        # Alias resolved successfully
        return (True, canonical_id, None)

    # Invalid plant_id
    return (False, None, f"Invalid plant_id: '{plant_id}' not found in plant database")


def get_all_valid_plant_ids() -> set:
    """Get all valid canonical plant IDs."""
    return _get_valid_plant_ids().copy()


def get_aliases_for_canonical_id(canonical_id: str) -> list:
    """Get all deprecated IDs that map to a canonical ID."""
    return [old_id for old_id, new_id in PLANT_ID_ALIASES.items() if new_id == canonical_id]
