"""
Services Module

Business logic layer that can safely import models.
Use this layer for operations that require database access.
"""

# Existing services
from .space_calculator import calculate_space_requirement
from .csv_import_service import parse_variety_csv, import_varieties_to_database, validate_csv_format
from .geocoding_service import geocoding_service

# New service modules (Phase 2 refactor)
from . import garden_bed_service
from . import planting_service
from . import conflict_service

__all__ = [
    # Space calculation
    'calculate_space_requirement',
    # CSV import
    'parse_variety_csv',
    'import_varieties_to_database',
    'validate_csv_format',
    # Geocoding
    'geocoding_service',
    # Garden beds
    'garden_bed_service',
    # Planting operations
    'planting_service',
    # Conflict detection
    'conflict_service',
]
