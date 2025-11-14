"""
CSV Variety Import Service

Handles parsing and importing plant variety data from CSV files into the SeedInventory database.
Supports multiple crop types with intelligent plant ID mapping and data transformation.
"""

import csv
import io
import logging
from typing import List, Dict, Tuple, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


# Plant type mapping: CSV type → database plant_id
# Note: Keys are case-insensitive (normalized to lowercase in map_variety_to_plant_id)
LETTUCE_TYPE_MAPPING = {
    'looseleaf': 'lettuce-looseleaf-1',
    'romaine': 'lettuce-romaine-1',
    'romaine mini': 'lettuce-romaine-1',  # Map mini romaine to regular romaine
    'butterhead': 'lettuce-butterhead-1',
    'crisphead': 'lettuce-crisphead-1',
    'summer crisp': 'lettuce-summercrisp-1',
    # Fallback
    'mixed': 'lettuce-1',
}

CARROT_TYPE_MAPPING = {
    'nantes': 'carrot-1',
    'imperator': 'carrot-1',
    'chantenay': 'carrot-1',
    'danvers': 'carrot-1',
    'ball': 'carrot-1',
    'paris market': 'carrot-1',
    # Fallback
    'mixed': 'carrot-1',
}

TOMATO_TYPE_MAPPING = {
    'beefsteak': 'tomato-1',
    'slicing': 'tomato-1',
    'heirloom': 'tomato-1',
    'roma': 'tomato-1',
    'paste': 'tomato-1',
    'cherry': 'tomato-cherry-1',
    'grape': 'tomato-cherry-1',
    'currant': 'tomato-cherry-1',
    # Fallback
    'mixed': 'tomato-1',
}

PEPPER_TYPE_MAPPING = {
    'bell': 'pepper-bell-1',
    'sweet': 'pepper-bell-1',
    'pimento': 'pepper-bell-1',
    'hot': 'pepper-hot-1',
    'jalapeño': 'pepper-hot-1',
    'jalapeno': 'pepper-hot-1',  # Handle accent variation
    'cayenne': 'pepper-hot-1',
    'habanero': 'pepper-hot-1',
    'serrano': 'pepper-hot-1',
    # Fallback
    'mixed': 'pepper-bell-1',
}

BEAN_TYPE_MAPPING = {
    'bush': 'bean-bush-1',
    'dwarf': 'bean-bush-1',
    'pole': 'bean-pole-1',
    'climbing': 'bean-pole-1',
    'runner': 'bean-pole-1',
    # Fallback
    'mixed': 'bean-bush-1',
}

SQUASH_TYPE_MAPPING = {
    'summer': 'squash-summer-1',
    'zucchini': 'squash-summer-1',
    'yellow': 'squash-summer-1',
    'pattypan': 'squash-summer-1',
    'winter': 'squash-winter-1',
    'butternut': 'squash-winter-1',
    'acorn': 'squash-winter-1',
    'hubbard': 'squash-winter-1',
    'delicata': 'squash-winter-1',
    # Fallback
    'mixed': 'squash-summer-1',
}

CUCUMBER_TYPE_MAPPING = {
    'slicing': 'cucumber-1',
    'pickling': 'cucumber-1',
    'burpless': 'cucumber-1',
    'lemon': 'cucumber-1',
    'english': 'cucumber-1',
    # Fallback
    'mixed': 'cucumber-1',
}

PEA_TYPE_MAPPING = {
    'shelling': 'pea-1',
    'english': 'pea-1',
    'garden': 'pea-1',
    'snap': 'pea-1',
    'snow': 'pea-1',
    # Fallback
    'mixed': 'pea-1',
}

BEET_TYPE_MAPPING = {
    'red': 'beet-1',
    'golden': 'beet-1',
    'chioggia': 'beet-1',
    # Fallback
    'mixed': 'beet-1',
}

RADISH_TYPE_MAPPING = {
    'round': 'radish-1',
    'french breakfast': 'radish-1',
    'daikon': 'radish-1',
    'watermelon': 'radish-1',
    # Fallback
    'mixed': 'radish-1',
}

BROCCOLI_TYPE_MAPPING = {
    'calabrese': 'broccoli-1',
    'sprouting': 'broccoli-1',
    'romanesco': 'broccoli-1',
    # Fallback
    'mixed': 'broccoli-1',
}

CAULIFLOWER_TYPE_MAPPING = {
    'white': 'cauliflower-1',
    'purple': 'cauliflower-1',
    'orange': 'cauliflower-1',
    'romanesco': 'cauliflower-1',
    # Fallback
    'mixed': 'cauliflower-1',
}

CABBAGE_TYPE_MAPPING = {
    'green': 'cabbage-1',
    'red': 'cabbage-1',
    'savoy': 'cabbage-1',
    'napa': 'cabbage-1',
    # Fallback
    'mixed': 'cabbage-1',
}

KALE_TYPE_MAPPING = {
    'lacinato': 'kale-1',
    'dinosaur': 'kale-1',
    'curly': 'kale-1',
    'russian': 'kale-1',
    # Fallback
    'mixed': 'kale-1',
}


# Crop type to mapping dictionary
CROP_TYPE_MAPPINGS = {
    'lettuce': LETTUCE_TYPE_MAPPING,
    'carrot': CARROT_TYPE_MAPPING,
    'tomato': TOMATO_TYPE_MAPPING,
    'pepper': PEPPER_TYPE_MAPPING,
    'bean': BEAN_TYPE_MAPPING,
    'squash': SQUASH_TYPE_MAPPING,
    'cucumber': CUCUMBER_TYPE_MAPPING,
    'pea': PEA_TYPE_MAPPING,
    'beet': BEET_TYPE_MAPPING,
    'radish': RADISH_TYPE_MAPPING,
    'broccoli': BROCCOLI_TYPE_MAPPING,
    'cauliflower': CAULIFLOWER_TYPE_MAPPING,
    'cabbage': CABBAGE_TYPE_MAPPING,
    'kale': KALE_TYPE_MAPPING,
}


def parse_dtm_range(dtm_string: str) -> Tuple[int, str]:
    """
    Parse days-to-maturity string and return (midpoint, formatted_range).

    Args:
        dtm_string: String like "46-50" or "45"

    Returns:
        Tuple of (midpoint_days, formatted_range_string)
        Example: ("46-50") → (48, "46-50 days")

    Raises:
        ValueError: If format is invalid
    """
    dtm_string = dtm_string.strip()

    # Handle single number
    if dtm_string.isdigit():
        days = int(dtm_string)
        return (days, f"{days} days")

    # Handle range like "46-50"
    if '-' in dtm_string:
        parts = dtm_string.split('-')
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            min_days = int(parts[0])
            max_days = int(parts[1])
            midpoint = (min_days + max_days) // 2
            return (midpoint, f"{dtm_string} days")

    raise ValueError(f"Invalid DTM format: {dtm_string}")


def map_variety_to_plant_id(crop_type: str, variety_type: str) -> str:
    """
    Map a variety type to the appropriate plant database ID.

    Args:
        crop_type: Type of crop ('lettuce', 'tomato', etc.)
        variety_type: Specific variety type ('Romaine', 'Cherry', etc.)

    Returns:
        Plant ID string (e.g., 'lettuce-romaine-1')

    Raises:
        ValueError: If crop type or variety type is not recognized
    """
    crop_type = crop_type.lower().strip()
    variety_type_lower = variety_type.strip().lower()  # Normalize to lowercase for case-insensitive matching

    if crop_type not in CROP_TYPE_MAPPINGS:
        raise ValueError(f"Unknown crop type: {crop_type}. Supported: {list(CROP_TYPE_MAPPINGS.keys())}")

    mapping = CROP_TYPE_MAPPINGS[crop_type]

    if variety_type_lower not in mapping:
        logger.warning(f"Unknown variety type '{variety_type}' for crop '{crop_type}', using fallback")
        # Try to find a fallback/generic entry
        if 'mixed' in mapping:
            return mapping['mixed']
        # Otherwise return the first entry as fallback
        return list(mapping.values())[0]

    return mapping[variety_type_lower]


def parse_variety_csv(file_content: str, crop_type: str) -> Tuple[List[Dict], List[str]]:
    """
    Parse CSV file content and extract variety data.

    Expected CSV columns:
    - Variety (required): Name of the variety
    - Type (required): Sub-type for plant ID mapping
    - Days to Maturity (required): Number or range (e.g., "46-50")
    - Soil Temp Sowing F (optional): Temperature range
    - Notes (optional): Additional information

    Args:
        file_content: CSV file content as string
        crop_type: Type of crop being imported ('lettuce', 'tomato', etc.)

    Returns:
        Tuple of (varieties_list, errors_list)
        - varieties_list: List of dictionaries with parsed variety data
        - errors_list: List of error messages (empty if no errors)
    """
    varieties = []
    errors = []

    try:
        # Parse CSV
        csv_file = io.StringIO(file_content)
        reader = csv.DictReader(csv_file)

        # Validate required columns
        required_columns = ['Variety', 'Type', 'Days to Maturity']
        if reader.fieldnames is None:
            errors.append("CSV file appears to be empty or malformed")
            return (varieties, errors)

        missing_columns = [col for col in required_columns if col not in reader.fieldnames]
        if missing_columns:
            errors.append(f"Missing required columns: {', '.join(missing_columns)}")
            return (varieties, errors)

        # Parse each row
        row_num = 1  # Start at 1 (header is row 0)
        for row in reader:
            row_num += 1

            try:
                # Required fields
                variety_name = row['Variety'].strip()
                variety_type = row['Type'].strip()
                dtm_string = row['Days to Maturity'].strip()

                if not variety_name:
                    errors.append(f"Row {row_num}: Variety name is required")
                    continue

                if not variety_type:
                    errors.append(f"Row {row_num}: Type is required")
                    continue

                if not dtm_string:
                    errors.append(f"Row {row_num}: Days to Maturity is required")
                    continue

                # Parse DTM
                try:
                    dtm_midpoint, dtm_range = parse_dtm_range(dtm_string)
                except ValueError as e:
                    errors.append(f"Row {row_num}: {str(e)}")
                    continue

                # Map to plant ID
                try:
                    plant_id = map_variety_to_plant_id(crop_type, variety_type)
                except ValueError as e:
                    errors.append(f"Row {row_num}: {str(e)}")
                    continue

                # Optional fields
                soil_temp = row.get('Soil Temp Sowing F', '').strip()
                notes = row.get('Notes', '').strip()

                # Build notes field
                notes_parts = []
                if variety_type:
                    notes_parts.append(f"Type: {variety_type}")
                if dtm_range:
                    notes_parts.append(f"DTM: {dtm_range}")
                if soil_temp:
                    notes_parts.append(f"Soil Temp: {soil_temp}°F")
                if notes:
                    notes_parts.append(notes)

                combined_notes = " | ".join(notes_parts)

                # Create variety dict
                variety_data = {
                    'variety': variety_name,
                    'plant_id': plant_id,
                    'days_to_maturity': dtm_midpoint,
                    'notes': combined_notes,
                    'brand': None,  # Will be filled by user
                    'quantity': 0,  # Default to 0
                    'location': '',  # User will specify
                }

                varieties.append(variety_data)
                logger.info(f"Parsed variety: {variety_name} → {plant_id}")

            except Exception as e:
                errors.append(f"Row {row_num}: Unexpected error - {str(e)}")
                logger.error(f"Error parsing row {row_num}: {e}")

    except csv.Error as e:
        errors.append(f"CSV parsing error: {str(e)}")
        logger.error(f"CSV parsing error: {e}")
    except Exception as e:
        errors.append(f"Unexpected error: {str(e)}")
        logger.error(f"Unexpected error during CSV parsing: {e}")

    return (varieties, errors)


def import_varieties_to_database(db, varieties: List[Dict], is_global: bool = False) -> Tuple[int, List[str]]:
    """
    Import parsed varieties into the SeedInventory database.

    Args:
        db: Flask SQLAlchemy database instance
        varieties: List of variety dictionaries from parse_variety_csv()
        is_global: Boolean flag to mark varieties as global/shared (default: False)

    Returns:
        Tuple of (imported_count, errors_list)
    """
    from models import SeedInventory

    imported_count = 0
    errors = []

    try:
        for variety_data in varieties:
            try:
                # Check for duplicate (must include is_global to distinguish global vs personal varieties)
                existing = SeedInventory.query.filter_by(
                    plant_id=variety_data['plant_id'],
                    variety=variety_data['variety'],
                    is_global=is_global
                ).first()

                if existing:
                    logger.warning(f"Skipping duplicate variety: {variety_data['variety']} ({variety_data['plant_id']})")
                    continue

                # Create new seed inventory entry
                # Validate DTM before inserting (must be positive integer or None)
                dtm = variety_data.get('days_to_maturity')
                validated_dtm = dtm if dtm and isinstance(dtm, int) and 0 < dtm < 365 else None

                seed = SeedInventory(
                    plant_id=variety_data['plant_id'],
                    variety=variety_data['variety'],
                    brand=variety_data['brand'],
                    quantity=variety_data['quantity'],
                    purchase_date=None,
                    expiration_date=None,
                    germination_rate=None,
                    location=variety_data['location'],
                    price=None,
                    notes=variety_data['notes'],
                    is_global=is_global,
                    # Populate variety-specific DTM override from CSV
                    days_to_maturity=validated_dtm
                )

                db.session.add(seed)
                imported_count += 1
                logger.info(f"Imported variety: {variety_data['variety']}")

            except Exception as e:
                errors.append(f"Failed to import {variety_data.get('variety', 'unknown')}: {str(e)}")
                logger.error(f"Error importing variety: {e}")

        # Commit all changes
        db.session.commit()
        logger.info(f"Successfully imported {imported_count} varieties")

    except Exception as e:
        db.session.rollback()
        error_msg = f"Database error during import: {str(e)}"
        errors.append(error_msg)
        logger.error(error_msg)
        imported_count = 0

    return (imported_count, errors)


def validate_csv_format(file_content: str) -> Tuple[bool, List[str]]:
    """
    Validate CSV format without importing data.

    Args:
        file_content: CSV file content as string

    Returns:
        Tuple of (is_valid, errors_list)
    """
    errors = []

    try:
        csv_file = io.StringIO(file_content)
        reader = csv.DictReader(csv_file)

        if reader.fieldnames is None:
            errors.append("CSV file is empty or has no header row")
            return (False, errors)

        required_columns = ['Variety', 'Type', 'Days to Maturity']
        missing_columns = [col for col in required_columns if col not in reader.fieldnames]

        if missing_columns:
            errors.append(f"Missing required columns: {', '.join(missing_columns)}")

        # Check if file has at least one data row
        rows = list(reader)
        if len(rows) == 0:
            errors.append("CSV file has no data rows")

        is_valid = len(errors) == 0
        return (is_valid, errors)

    except csv.Error as e:
        errors.append(f"Invalid CSV format: {str(e)}")
        return (False, errors)
    except Exception as e:
        errors.append(f"Validation error: {str(e)}")
        return (False, errors)
