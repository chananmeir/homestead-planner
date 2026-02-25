"""
Seed Inventory CSV Import Service

Parses the 24-column CSV export format from MySeedInventory and imports
rows as personal SeedInventory records.

Export columns (in order):
  Plant, Variety, Brand, Quantity, Location, Purchase Date, Expiration Date,
  Germination Rate (%), Price, Days to Maturity, Germination Days,
  Germination Temp Min (F), Germination Temp Max (F), Soil Temp Min (F),
  Plant Spacing (in), Row Spacing (in), Planting Depth (in),
  Heat Tolerance, Cold Tolerance, Bolt Resistance, Ideal Seasons,
  Flavor Profile, Storage Rating, Notes
"""

import csv
import io
import logging

from plant_database import PLANT_DATABASE
from utils.plant_id_resolver import validate_and_resolve_plant_id
from utils.helpers import parse_iso_date
from models import SeedInventory

logger = logging.getLogger(__name__)

# Column names expected in the CSV header (must match export format)
EXPECTED_COLUMNS = [
    'Plant', 'Variety', 'Brand', 'Quantity', 'Location',
    'Purchase Date', 'Expiration Date', 'Germination Rate (%)', 'Price',
    'Days to Maturity', 'Germination Days',
    'Germination Temp Min (°F)', 'Germination Temp Max (°F)', 'Soil Temp Min (°F)',
    'Plant Spacing (in)', 'Row Spacing (in)', 'Planting Depth (in)',
    'Heat Tolerance', 'Cold Tolerance', 'Bolt Resistance',
    'Ideal Seasons', 'Flavor Profile', 'Storage Rating', 'Notes'
]

# Also accept headers without the degree symbol (hand-typed CSVs)
HEADER_ALIASES = {
    'Germination Temp Min (F)': 'Germination Temp Min (°F)',
    'Germination Temp Max (F)': 'Germination Temp Max (°F)',
    'Soil Temp Min (F)': 'Soil Temp Min (°F)',
    'Germination Rate': 'Germination Rate (%)',
}


def _safe_int(value):
    """Convert string to int, returning None for empty/invalid values.
    Preserves NULL semantics: '' -> None, '0' -> 0."""
    if value is None:
        return None
    value = str(value).strip()
    if value == '':
        return None
    try:
        return int(float(value))  # handles "50.0" style strings
    except (ValueError, TypeError):
        return None


def _safe_float(value):
    """Convert string to float, returning None for empty/invalid values.
    Preserves NULL semantics: '' -> None, '0' -> 0.0."""
    if value is None:
        return None
    value = str(value).strip()
    if value == '':
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _build_plant_name_map():
    """Build a case-insensitive map from plant name -> plant id.
    For duplicate names, prefer canonical '-1' IDs."""
    name_map = {}
    for plant in PLANT_DATABASE:
        name_lower = plant['name'].lower().strip()
        existing = name_map.get(name_lower)
        if existing is None:
            name_map[name_lower] = plant['id']
        elif plant['id'].endswith('-1'):
            # Prefer canonical -1 IDs over others
            name_map[name_lower] = plant['id']
    return name_map


def resolve_plant_name_to_id(name):
    """Resolve a plant name (from CSV export) to a plant_id.

    Strategy:
    1. Case-insensitive lookup in PLANT_DATABASE by name
    2. Fall back to validate_and_resolve_plant_id() for direct-ID or alias input

    Returns:
        tuple: (plant_id, error_message)
            - plant_id: resolved ID or None
            - error_message: error string or None
    """
    if not name or not name.strip():
        return None, "Plant name is empty"

    name = name.strip()

    # 1. Try name lookup
    name_map = _build_plant_name_map()
    plant_id = name_map.get(name.lower())
    if plant_id:
        return plant_id, None

    # 2. Try direct ID / alias resolution (e.g., user typed 'tomato-1' instead of 'Tomato')
    is_valid, canonical_id, error_msg = validate_and_resolve_plant_id(name)
    if is_valid:
        return canonical_id, None

    return None, f"Unknown plant: '{name}'"


def _normalize_headers(headers):
    """Normalize CSV headers by applying aliases and stripping whitespace."""
    normalized = []
    for h in headers:
        h = h.strip()
        # Remove BOM if present
        if h.startswith('\ufeff'):
            h = h[1:]
        h = HEADER_ALIASES.get(h, h)
        normalized.append(h)
    return normalized


def parse_seed_inventory_csv(file_content):
    """Parse a seed inventory CSV file matching the 24-column export format.

    Args:
        file_content: String content of the CSV file

    Returns:
        tuple: (parsed_rows, errors)
            - parsed_rows: list of dicts with seed data
            - errors: list of error strings with row numbers
    """
    parsed_rows = []
    errors = []

    try:
        reader = csv.DictReader(io.StringIO(file_content))
        if reader.fieldnames is None:
            return [], ["CSV file is empty or has no headers"]

        # Normalize headers
        raw_headers = list(reader.fieldnames)
        normalized = _normalize_headers(raw_headers)

        # Rebuild reader with normalized headers
        reader = csv.DictReader(io.StringIO(file_content), fieldnames=normalized)
        next(reader)  # skip the original header row

        # Validate required columns exist
        header_set = set(normalized)
        if 'Plant' not in header_set:
            return [], ["Missing required column: 'Plant'"]
        if 'Variety' not in header_set:
            return [], ["Missing required column: 'Variety'"]

    except Exception as e:
        return [], [f"Failed to parse CSV: {str(e)}"]

    for row_num, row in enumerate(reader, start=2):  # row 1 is headers
        # Skip completely empty rows
        if all(not v or (isinstance(v, str) and not v.strip()) for v in row.values()):
            continue

        plant_name = (row.get('Plant') or '').strip()
        variety = (row.get('Variety') or '').strip()

        if not plant_name:
            errors.append(f"Row {row_num}: Missing plant name")
            continue

        if not variety:
            errors.append(f"Row {row_num}: Missing variety for '{plant_name}'")
            continue

        # Resolve plant name to ID
        plant_id, resolve_error = resolve_plant_name_to_id(plant_name)
        if not plant_id:
            errors.append(f"Row {row_num}: {resolve_error}")
            continue

        parsed_row = {
            'plant_id': plant_id,
            'variety': variety,
            'brand': (row.get('Brand') or '').strip(),
            'quantity': _safe_int(row.get('Quantity')),
            'location': (row.get('Location') or '').strip(),
            'purchase_date': (row.get('Purchase Date') or '').strip() or None,
            'expiration_date': (row.get('Expiration Date') or '').strip() or None,
            'germination_rate': _safe_float(row.get('Germination Rate (%)')),
            'price': _safe_float(row.get('Price')),
            'days_to_maturity': _safe_int(row.get('Days to Maturity')),
            'germination_days': _safe_int(row.get('Germination Days')),
            'germination_temp_min': _safe_int(row.get('Germination Temp Min (°F)')),
            'germination_temp_max': _safe_int(row.get('Germination Temp Max (°F)')),
            'soil_temp_min': _safe_int(row.get('Soil Temp Min (°F)')),
            'plant_spacing': _safe_int(row.get('Plant Spacing (in)')),
            'row_spacing': _safe_int(row.get('Row Spacing (in)')),
            'planting_depth': _safe_float(row.get('Planting Depth (in)')),
            'heat_tolerance': (row.get('Heat Tolerance') or '').strip() or None,
            'cold_tolerance': (row.get('Cold Tolerance') or '').strip() or None,
            'bolt_resistance': (row.get('Bolt Resistance') or '').strip() or None,
            'ideal_seasons': (row.get('Ideal Seasons') or '').strip() or None,
            'flavor_profile': (row.get('Flavor Profile') or '').strip() or None,
            'storage_rating': (row.get('Storage Rating') or '').strip() or None,
            'notes': (row.get('Notes') or '').strip() or None,
        }
        parsed_rows.append(parsed_row)

    return parsed_rows, errors


def import_seeds_to_database(db, seeds, user_id, skip_duplicates=True):
    """Import parsed seed rows into the SeedInventory table.

    Args:
        db: SQLAlchemy database instance
        seeds: list of parsed seed dicts from parse_seed_inventory_csv()
        user_id: ID of the user importing seeds
        skip_duplicates: if True, skip rows where plant_id+variety+brand already exists

    Returns:
        tuple: (imported_count, skipped_count, warnings)
    """
    imported_count = 0
    skipped_count = 0
    warnings = []

    # Build set of existing seeds for duplicate detection
    existing_seeds = set()
    if skip_duplicates:
        user_seeds = SeedInventory.query.filter_by(
            user_id=user_id,
            is_global=False
        ).all()
        for s in user_seeds:
            key = (s.plant_id, (s.variety or '').lower(), (s.brand or '').lower())
            existing_seeds.add(key)

    try:
        for i, seed_data in enumerate(seeds):
            # Duplicate detection key
            dup_key = (
                seed_data['plant_id'],
                (seed_data['variety'] or '').lower(),
                (seed_data['brand'] or '').lower()
            )

            if skip_duplicates and dup_key in existing_seeds:
                skipped_count += 1
                continue

            # Parse dates safely
            purchase_date = None
            if seed_data.get('purchase_date'):
                try:
                    purchase_date = parse_iso_date(seed_data['purchase_date'])
                except (ValueError, TypeError):
                    warnings.append(f"Seed '{seed_data['variety']}': Invalid purchase date '{seed_data['purchase_date']}', skipped date")

            expiration_date = None
            if seed_data.get('expiration_date'):
                try:
                    expiration_date = parse_iso_date(seed_data['expiration_date'])
                except (ValueError, TypeError):
                    warnings.append(f"Seed '{seed_data['variety']}': Invalid expiration date '{seed_data['expiration_date']}', skipped date")

            seed = SeedInventory(
                user_id=user_id,
                plant_id=seed_data['plant_id'],
                variety=seed_data['variety'],
                brand=seed_data['brand'] or '',
                quantity=seed_data['quantity'] if seed_data['quantity'] is not None else 0,
                location=seed_data['location'] or '',
                purchase_date=purchase_date,
                expiration_date=expiration_date,
                germination_rate=seed_data['germination_rate'],
                price=seed_data['price'],
                notes=seed_data['notes'] or '',
                is_global=False,
                # Agronomic overrides
                days_to_maturity=seed_data['days_to_maturity'],
                germination_days=seed_data['germination_days'],
                germination_temp_min=seed_data['germination_temp_min'],
                germination_temp_max=seed_data['germination_temp_max'],
                soil_temp_min=seed_data['soil_temp_min'],
                plant_spacing=seed_data['plant_spacing'],
                row_spacing=seed_data['row_spacing'],
                planting_depth=seed_data['planting_depth'],
                heat_tolerance=seed_data['heat_tolerance'],
                cold_tolerance=seed_data['cold_tolerance'],
                bolt_resistance=seed_data['bolt_resistance'],
                ideal_seasons=seed_data['ideal_seasons'],
                flavor_profile=seed_data['flavor_profile'],
                storage_rating=seed_data['storage_rating'],
            )
            db.session.add(seed)
            existing_seeds.add(dup_key)
            imported_count += 1

        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Seed import failed: {str(e)}")
        raise

    return imported_count, skipped_count, warnings
