"""
Tests for the seed inventory CSV import service.

Covers:
- Plant name -> ID resolution (case-insensitive, canonical preference)
- CSV parsing (valid 24-column, missing required columns, blank values -> None)
- Duplicate detection (skip vs import)
- Date format handling
- Roundtrip: export format re-imports cleanly
- _safe_int / _safe_float NULL semantics
"""

import pytest
from models import db, SeedInventory
from services.seed_import_service import (
    resolve_plant_name_to_id,
    parse_seed_inventory_csv,
    import_seeds_to_database,
    _safe_int,
    _safe_float,
)


# ==================== _safe_int / _safe_float ====================

class TestSafeConversions:
    def test_safe_int_empty_string_returns_none(self):
        assert _safe_int('') is None

    def test_safe_int_none_returns_none(self):
        assert _safe_int(None) is None

    def test_safe_int_zero_returns_zero(self):
        assert _safe_int('0') == 0

    def test_safe_int_positive(self):
        assert _safe_int('42') == 42

    def test_safe_int_float_string(self):
        assert _safe_int('50.0') == 50

    def test_safe_int_invalid_returns_none(self):
        assert _safe_int('abc') is None

    def test_safe_float_empty_string_returns_none(self):
        assert _safe_float('') is None

    def test_safe_float_none_returns_none(self):
        assert _safe_float(None) is None

    def test_safe_float_zero_returns_zero(self):
        assert _safe_float('0') == 0.0

    def test_safe_float_positive(self):
        assert _safe_float('3.14') == 3.14

    def test_safe_float_invalid_returns_none(self):
        assert _safe_float('xyz') is None


# ==================== resolve_plant_name_to_id ====================

class TestResolvePlantName:
    def test_known_plant_name(self):
        plant_id, error = resolve_plant_name_to_id('Tomato')
        assert plant_id is not None
        assert error is None

    def test_case_insensitive(self):
        plant_id, error = resolve_plant_name_to_id('tomato')
        assert plant_id is not None
        assert error is None

    def test_case_insensitive_upper(self):
        plant_id, error = resolve_plant_name_to_id('TOMATO')
        assert plant_id is not None
        assert error is None

    def test_direct_id_fallback(self):
        plant_id, error = resolve_plant_name_to_id('tomato-1')
        assert plant_id == 'tomato-1'
        assert error is None

    def test_unknown_plant_returns_error(self):
        plant_id, error = resolve_plant_name_to_id('XyzNonExistentPlant')
        assert plant_id is None
        assert error is not None
        assert 'Unknown plant' in error

    def test_empty_name_returns_error(self):
        plant_id, error = resolve_plant_name_to_id('')
        assert plant_id is None
        assert error is not None

    def test_whitespace_name_returns_error(self):
        plant_id, error = resolve_plant_name_to_id('   ')
        assert plant_id is None
        assert error is not None

    def test_lettuce_resolves(self):
        plant_id, error = resolve_plant_name_to_id('Lettuce')
        assert plant_id is not None
        assert error is None


# ==================== parse_seed_inventory_csv ====================

VALID_CSV = """Plant,Variety,Brand,Quantity,Location,Purchase Date,Expiration Date,Germination Rate (%),Price,Days to Maturity,Germination Days,Germination Temp Min (°F),Germination Temp Max (°F),Soil Temp Min (°F),Plant Spacing (in),Row Spacing (in),Planting Depth (in),Heat Tolerance,Cold Tolerance,Bolt Resistance,Ideal Seasons,Flavor Profile,Storage Rating,Notes
Tomato,Cherokee Purple,Baker Creek,5,Shed,2025-03-15,,85,3.50,80,10,65,85,60,24,36,0.25,medium,tender,,spring,Rich and smoky,fair,Great heirloom
Lettuce,Buttercrunch,,2,,,,,,,45,,,,6,12,,,,high,spring,,good,"""

MINIMAL_CSV = """Plant,Variety
Tomato,Roma
Lettuce,Iceberg
"""

MISSING_PLANT_COL = """Variety,Brand
Cherokee Purple,Baker Creek
"""

MISSING_VARIETY_COL = """Plant,Brand
Tomato,Baker Creek
"""


class TestParseCSV:
    def test_valid_full_csv(self):
        rows, errors = parse_seed_inventory_csv(VALID_CSV)
        assert len(rows) == 2
        assert len(errors) == 0
        assert rows[0]['variety'] == 'Cherokee Purple'
        assert rows[0]['quantity'] == 5
        assert rows[0]['days_to_maturity'] == 80
        assert rows[0]['price'] == 3.50
        assert rows[0]['notes'] == 'Great heirloom'

    def test_minimal_csv(self):
        rows, errors = parse_seed_inventory_csv(MINIMAL_CSV)
        assert len(rows) == 2
        assert len(errors) == 0
        assert rows[0]['variety'] == 'Roma'
        assert rows[1]['variety'] == 'Iceberg'

    def test_missing_plant_column(self):
        rows, errors = parse_seed_inventory_csv(MISSING_PLANT_COL)
        assert len(rows) == 0
        assert len(errors) > 0
        assert any("Missing required column: 'Plant'" in e for e in errors)

    def test_missing_variety_column(self):
        rows, errors = parse_seed_inventory_csv(MISSING_VARIETY_COL)
        assert len(rows) == 0
        assert len(errors) > 0
        assert any("Missing required column: 'Variety'" in e for e in errors)

    def test_blank_values_become_none(self):
        rows, errors = parse_seed_inventory_csv(VALID_CSV)
        # Second row (Lettuce) has many blank fields
        lettuce = rows[1]
        assert lettuce['brand'] == ''
        assert lettuce['germination_rate'] is None
        assert lettuce['price'] is None
        assert lettuce['days_to_maturity'] is None  # empty in CSV, not 45

    def test_zero_preserved_not_none(self):
        csv = """Plant,Variety,Quantity,Days to Maturity
Tomato,Test,0,0
"""
        rows, errors = parse_seed_inventory_csv(csv)
        assert len(rows) == 1
        assert rows[0]['quantity'] == 0
        assert rows[0]['days_to_maturity'] == 0

    def test_unknown_plant_produces_error(self):
        csv = """Plant,Variety
XyzNonExistent,SomeVariety
"""
        rows, errors = parse_seed_inventory_csv(csv)
        assert len(rows) == 0
        assert len(errors) == 1
        assert 'Unknown plant' in errors[0]

    def test_empty_csv(self):
        rows, errors = parse_seed_inventory_csv('')
        assert len(rows) == 0
        assert len(errors) > 0

    def test_header_alias_without_degree_symbol(self):
        csv = """Plant,Variety,Germination Temp Min (F),Germination Temp Max (F)
Tomato,Test,65,85
"""
        rows, errors = parse_seed_inventory_csv(csv)
        assert len(rows) == 1
        assert rows[0]['germination_temp_min'] == 65
        assert rows[0]['germination_temp_max'] == 85

    def test_skip_empty_rows(self):
        csv = """Plant,Variety
Tomato,Roma
,,
Lettuce,Iceberg
"""
        rows, errors = parse_seed_inventory_csv(csv)
        assert len(rows) == 2

    def test_missing_variety_in_row(self):
        csv = """Plant,Variety
Tomato,
"""
        rows, errors = parse_seed_inventory_csv(csv)
        assert len(rows) == 0
        assert len(errors) == 1
        assert 'Missing variety' in errors[0]


# ==================== import_seeds_to_database ====================

class TestImportToDatabase:
    def test_basic_import(self, db_session, sample_user):
        seeds = [
            {
                'plant_id': 'tomato-1',
                'variety': 'Cherokee Purple',
                'brand': 'Baker Creek',
                'quantity': 5,
                'location': 'Shed',
                'purchase_date': '2025-03-15',
                'expiration_date': None,
                'germination_rate': 85.0,
                'price': 3.50,
                'days_to_maturity': 80,
                'germination_days': 10,
                'germination_temp_min': 65,
                'germination_temp_max': 85,
                'soil_temp_min': 60,
                'plant_spacing': 24,
                'row_spacing': 36,
                'planting_depth': 0.25,
                'heat_tolerance': 'medium',
                'cold_tolerance': 'tender',
                'bolt_resistance': None,
                'ideal_seasons': 'spring',
                'flavor_profile': 'Rich and smoky',
                'storage_rating': 'fair',
                'notes': 'Great heirloom',
            }
        ]
        imported, skipped, warnings = import_seeds_to_database(
            db, seeds, sample_user.id, skip_duplicates=True
        )
        assert imported == 1
        assert skipped == 0

        # Verify in DB
        saved = SeedInventory.query.filter_by(user_id=sample_user.id).first()
        assert saved is not None
        assert saved.variety == 'Cherokee Purple'
        assert saved.days_to_maturity == 80
        assert saved.price == 3.50

    def test_skip_duplicates(self, db_session, sample_user):
        # Pre-create a seed
        existing = SeedInventory(
            user_id=sample_user.id,
            plant_id='tomato-1',
            variety='Roma',
            brand='',
            quantity=1,
            is_global=False,
        )
        db_session.add(existing)
        db_session.flush()

        seeds = [
            {
                'plant_id': 'tomato-1',
                'variety': 'Roma',
                'brand': '',
                'quantity': 5,
                'location': '',
                'purchase_date': None,
                'expiration_date': None,
                'germination_rate': None,
                'price': None,
                'days_to_maturity': None,
                'germination_days': None,
                'germination_temp_min': None,
                'germination_temp_max': None,
                'soil_temp_min': None,
                'plant_spacing': None,
                'row_spacing': None,
                'planting_depth': None,
                'heat_tolerance': None,
                'cold_tolerance': None,
                'bolt_resistance': None,
                'ideal_seasons': None,
                'flavor_profile': None,
                'storage_rating': None,
                'notes': None,
            }
        ]
        imported, skipped, warnings = import_seeds_to_database(
            db, seeds, sample_user.id, skip_duplicates=True
        )
        assert imported == 0
        assert skipped == 1

    def test_allow_duplicates_when_flag_false(self, db_session, sample_user):
        existing = SeedInventory(
            user_id=sample_user.id,
            plant_id='tomato-1',
            variety='Roma',
            brand='',
            quantity=1,
            is_global=False,
        )
        db_session.add(existing)
        db_session.flush()

        seeds = [
            {
                'plant_id': 'tomato-1',
                'variety': 'Roma',
                'brand': '',
                'quantity': 10,
                'location': '',
                'purchase_date': None,
                'expiration_date': None,
                'germination_rate': None,
                'price': None,
                'days_to_maturity': None,
                'germination_days': None,
                'germination_temp_min': None,
                'germination_temp_max': None,
                'soil_temp_min': None,
                'plant_spacing': None,
                'row_spacing': None,
                'planting_depth': None,
                'heat_tolerance': None,
                'cold_tolerance': None,
                'bolt_resistance': None,
                'ideal_seasons': None,
                'flavor_profile': None,
                'storage_rating': None,
                'notes': None,
            }
        ]
        imported, skipped, warnings = import_seeds_to_database(
            db, seeds, sample_user.id, skip_duplicates=False
        )
        assert imported == 1
        assert skipped == 0

    def test_date_parsing_with_z_suffix(self, db_session, sample_user):
        seeds = [
            {
                'plant_id': 'tomato-1',
                'variety': 'Test Z Date',
                'brand': '',
                'quantity': 1,
                'location': '',
                'purchase_date': '2025-06-15T00:00:00Z',
                'expiration_date': None,
                'germination_rate': None,
                'price': None,
                'days_to_maturity': None,
                'germination_days': None,
                'germination_temp_min': None,
                'germination_temp_max': None,
                'soil_temp_min': None,
                'plant_spacing': None,
                'row_spacing': None,
                'planting_depth': None,
                'heat_tolerance': None,
                'cold_tolerance': None,
                'bolt_resistance': None,
                'ideal_seasons': None,
                'flavor_profile': None,
                'storage_rating': None,
                'notes': None,
            }
        ]
        imported, skipped, warnings = import_seeds_to_database(
            db, seeds, sample_user.id
        )
        assert imported == 1
        saved = SeedInventory.query.filter_by(user_id=sample_user.id).first()
        assert saved.purchase_date is not None

    def test_invalid_date_produces_warning(self, db_session, sample_user):
        seeds = [
            {
                'plant_id': 'tomato-1',
                'variety': 'Bad Date',
                'brand': '',
                'quantity': 1,
                'location': '',
                'purchase_date': 'not-a-date',
                'expiration_date': None,
                'germination_rate': None,
                'price': None,
                'days_to_maturity': None,
                'germination_days': None,
                'germination_temp_min': None,
                'germination_temp_max': None,
                'soil_temp_min': None,
                'plant_spacing': None,
                'row_spacing': None,
                'planting_depth': None,
                'heat_tolerance': None,
                'cold_tolerance': None,
                'bolt_resistance': None,
                'ideal_seasons': None,
                'flavor_profile': None,
                'storage_rating': None,
                'notes': None,
            }
        ]
        imported, skipped, warnings = import_seeds_to_database(
            db, seeds, sample_user.id
        )
        assert imported == 1
        assert len(warnings) == 1
        assert 'Invalid purchase date' in warnings[0]

    def test_null_quantity_defaults_to_zero(self, db_session, sample_user):
        seeds = [
            {
                'plant_id': 'tomato-1',
                'variety': 'No Qty',
                'brand': '',
                'quantity': None,
                'location': '',
                'purchase_date': None,
                'expiration_date': None,
                'germination_rate': None,
                'price': None,
                'days_to_maturity': None,
                'germination_days': None,
                'germination_temp_min': None,
                'germination_temp_max': None,
                'soil_temp_min': None,
                'plant_spacing': None,
                'row_spacing': None,
                'planting_depth': None,
                'heat_tolerance': None,
                'cold_tolerance': None,
                'bolt_resistance': None,
                'ideal_seasons': None,
                'flavor_profile': None,
                'storage_rating': None,
                'notes': None,
            }
        ]
        imported, _, _ = import_seeds_to_database(db, seeds, sample_user.id)
        assert imported == 1
        saved = SeedInventory.query.filter_by(user_id=sample_user.id).first()
        assert saved.quantity == 0


# ==================== Roundtrip test ====================

class TestRoundtrip:
    def test_export_format_reimports(self):
        """The exact CSV format produced by MySeedInventory's export should parse cleanly."""
        exported_csv = """Plant,Variety,Brand,Quantity,Location,Purchase Date,Expiration Date,Germination Rate (%),Price,Days to Maturity,Germination Days,Germination Temp Min (°F),Germination Temp Max (°F),Soil Temp Min (°F),Plant Spacing (in),Row Spacing (in),Planting Depth (in),Heat Tolerance,Cold Tolerance,Bolt Resistance,Ideal Seasons,Flavor Profile,Storage Rating,Notes
Tomato,Cherokee Purple,Baker Creek,5,Shed,2025-03-15,,85,3.5,80,10,65,85,60,24,36,0.25,medium,tender,,spring,"Rich, smoky",fair,Great heirloom
Pepper,Jalapeno,,3,,,,,,65,,,,8,12,0.5,,,,spring,,,Hot variety"""
        rows, errors = parse_seed_inventory_csv(exported_csv)
        assert len(errors) == 0
        assert len(rows) == 2
        assert rows[0]['variety'] == 'Cherokee Purple'
        assert rows[0]['days_to_maturity'] == 80
        assert rows[0]['flavor_profile'] == 'Rich, smoky'
        assert rows[1]['variety'] == 'Jalapeno'
        assert rows[1]['days_to_maturity'] == 65
