"""
Pure helper functions used across the application.

IMPORTANT: This module must remain pure (no model imports).
Business logic that requires model access belongs in services/ instead.
"""
from datetime import datetime


def parse_iso_date(date_string):
    """
    Parse ISO date string, handling the 'Z' UTC suffix that JavaScript uses

    Args:
        date_string (str): ISO format date string (e.g., "2024-01-15" or "2024-01-15T10:30:00Z")

    Returns:
        datetime: Parsed datetime object, or None if invalid
    """
    if not date_string:
        return None

    # Replace 'Z' with '+00:00' for Python's fromisoformat
    if date_string.endswith('Z'):
        date_string = date_string[:-1] + '+00:00'

    return datetime.fromisoformat(date_string)


# NOTE: get_mulch_type_on_date() has been moved to services/garden_bed_service.py
# to maintain pure utils/ (no model imports)
