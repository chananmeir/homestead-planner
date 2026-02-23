"""
Unit tests for event_details JSON validation.

Pure function tests — no Flask app, no database needed.
"""
import pytest

from services.event_details_validator import validate_event_details


# ===================================================================
# Mulch details validation
# ===================================================================


class TestValidateMulchDetails:
    """Tests for mulch event_details validation."""

    def test_valid_minimal(self):
        details = {'mulch_type': 'straw', 'coverage': 'full'}
        valid, errors = validate_event_details('mulch', details)
        assert valid is True
        assert errors == []

    def test_valid_all_fields(self):
        details = {
            'mulch_type': 'wood-chips',
            'depth_inches': 3.5,
            'coverage': 'partial',
        }
        valid, errors = validate_event_details('mulch', details)
        assert valid is True
        assert errors == []

    def test_valid_depth_zero(self):
        details = {'mulch_type': 'straw', 'depth_inches': 0, 'coverage': 'full'}
        valid, errors = validate_event_details('mulch', details)
        assert valid is True
        assert errors == []

    @pytest.mark.parametrize('mulch_type', [
        'straw', 'wood-chips', 'leaves', 'grass',
        'compost', 'black-plastic', 'clear-plastic', 'none',
    ])
    def test_valid_all_mulch_types(self, mulch_type):
        details = {'mulch_type': mulch_type, 'coverage': 'full'}
        valid, errors = validate_event_details('mulch', details)
        assert valid is True

    def test_valid_unknown_keys_accepted(self):
        details = {
            'mulch_type': 'straw',
            'coverage': 'full',
            'future_field': 'anything',
        }
        valid, errors = validate_event_details('mulch', details)
        assert valid is True
        assert errors == []

    def test_missing_mulch_type(self):
        details = {'coverage': 'full'}
        valid, errors = validate_event_details('mulch', details)
        assert valid is False
        assert any('mulch_type' in e for e in errors)

    def test_invalid_mulch_type_enum(self):
        details = {'mulch_type': 'rocks', 'coverage': 'full'}
        valid, errors = validate_event_details('mulch', details)
        assert valid is False
        assert any("Invalid mulch_type" in e for e in errors)

    def test_mulch_type_wrong_type(self):
        details = {'mulch_type': 42, 'coverage': 'full'}
        valid, errors = validate_event_details('mulch', details)
        assert valid is False
        assert any('must be a string' in e for e in errors)

    def test_missing_coverage(self):
        details = {'mulch_type': 'straw'}
        valid, errors = validate_event_details('mulch', details)
        assert valid is False
        assert any('coverage' in e for e in errors)

    def test_invalid_coverage_enum(self):
        details = {'mulch_type': 'straw', 'coverage': 'half'}
        valid, errors = validate_event_details('mulch', details)
        assert valid is False
        assert any("Invalid coverage" in e for e in errors)

    def test_negative_depth(self):
        details = {'mulch_type': 'straw', 'depth_inches': -1, 'coverage': 'full'}
        valid, errors = validate_event_details('mulch', details)
        assert valid is False
        assert any('depth_inches' in e and '>= 0' in e for e in errors)

    def test_depth_wrong_type(self):
        details = {'mulch_type': 'straw', 'depth_inches': 'three', 'coverage': 'full'}
        valid, errors = validate_event_details('mulch', details)
        assert valid is False
        assert any('depth_inches' in e and 'number' in e for e in errors)

    def test_multiple_errors(self):
        details = {'depth_inches': -5}  # missing mulch_type AND coverage, bad depth
        valid, errors = validate_event_details('mulch', details)
        assert valid is False
        assert len(errors) >= 3  # mulch_type, coverage, depth


# ===================================================================
# Maple-tapping details validation
# ===================================================================


class TestValidateMapleTappingDetails:
    """Tests for maple-tapping event_details validation."""

    def test_valid_minimal(self):
        details = {'tree_type': 'sugar', 'tap_count': 2}
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is True
        assert errors == []

    def test_valid_all_fields(self):
        details = {
            'tree_type': 'red',
            'tap_count': 3,
            'tree_structure_id': 42,
            'collection_dates': [
                {'date': '2026-02-15', 'sapAmount': 2.5, 'notes': 'good flow'},
            ],
            'syrup_yield': {
                'gallons': 0.5,
                'grade': 'Amber',
                'boilDate': '2026-03-01',
                'notes': 'first batch',
            },
            'tree_health': {
                'tapHealing': 'good',
                'observations': 'healthy bark',
                'diameter': 18.5,
            },
        }
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is True
        assert errors == []

    @pytest.mark.parametrize('tree_type', ['sugar', 'red', 'black', 'boxelder'])
    def test_valid_all_tree_types(self, tree_type):
        details = {'tree_type': tree_type, 'tap_count': 1}
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is True

    def test_valid_high_tap_count(self):
        details = {'tree_type': 'sugar', 'tap_count': 100}
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is True

    def test_valid_unknown_keys_accepted(self):
        details = {
            'tree_type': 'sugar',
            'tap_count': 1,
            'new_future_field': 'value',
        }
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is True

    def test_missing_tree_type(self):
        details = {'tap_count': 2}
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is False
        assert any('tree_type' in e for e in errors)

    def test_invalid_tree_type_enum(self):
        details = {'tree_type': 'oak', 'tap_count': 1}
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is False
        assert any("Invalid tree_type" in e for e in errors)

    def test_tree_type_wrong_type(self):
        details = {'tree_type': 123, 'tap_count': 1}
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is False
        assert any('must be a string' in e for e in errors)

    def test_missing_tap_count(self):
        details = {'tree_type': 'sugar'}
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is False
        assert any('tap_count' in e for e in errors)

    def test_zero_tap_count(self):
        details = {'tree_type': 'sugar', 'tap_count': 0}
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is False
        assert any('tap_count' in e and '>= 1' in e for e in errors)

    def test_negative_tap_count(self):
        details = {'tree_type': 'sugar', 'tap_count': -3}
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is False
        assert any('tap_count' in e and '>= 1' in e for e in errors)

    def test_tap_count_wrong_type(self):
        details = {'tree_type': 'sugar', 'tap_count': 'two'}
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is False
        assert any('tap_count' in e and 'integer' in e for e in errors)

    def test_tap_count_bool_rejected(self):
        """bool is subclass of int — must be explicitly rejected."""
        details = {'tree_type': 'sugar', 'tap_count': True}
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is False
        assert any('tap_count' in e for e in errors)

    def test_tree_structure_id_wrong_type(self):
        details = {'tree_type': 'sugar', 'tap_count': 1, 'tree_structure_id': 'abc'}
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is False
        assert any('tree_structure_id' in e for e in errors)

    def test_collection_dates_not_list(self):
        details = {'tree_type': 'sugar', 'tap_count': 1, 'collection_dates': 'not-a-list'}
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is False
        assert any('collection_dates' in e and 'list' in e for e in errors)

    def test_collection_dates_entry_missing_date(self):
        details = {
            'tree_type': 'sugar',
            'tap_count': 1,
            'collection_dates': [{'sapAmount': 2.0}],
        }
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is False
        assert any('date' in e for e in errors)

    def test_collection_dates_entry_missing_sap_amount(self):
        details = {
            'tree_type': 'sugar',
            'tap_count': 1,
            'collection_dates': [{'date': '2026-02-15'}],
        }
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is False
        assert any('sapAmount' in e for e in errors)

    def test_collection_dates_sap_amount_not_number(self):
        details = {
            'tree_type': 'sugar',
            'tap_count': 1,
            'collection_dates': [{'date': '2026-02-15', 'sapAmount': 'lots'}],
        }
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is False
        assert any('sapAmount' in e and 'number' in e for e in errors)

    def test_syrup_yield_not_dict(self):
        details = {'tree_type': 'sugar', 'tap_count': 1, 'syrup_yield': 'two gallons'}
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is False
        assert any('syrup_yield' in e and 'dict' in e for e in errors)

    def test_invalid_syrup_grade(self):
        details = {
            'tree_type': 'sugar',
            'tap_count': 1,
            'syrup_yield': {'grade': 'Premium'},
        }
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is False
        assert any('grade' in e for e in errors)

    def test_syrup_gallons_not_number(self):
        details = {
            'tree_type': 'sugar',
            'tap_count': 1,
            'syrup_yield': {'gallons': 'half'},
        }
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is False
        assert any('gallons' in e and 'number' in e for e in errors)

    def test_tree_health_not_dict(self):
        details = {'tree_type': 'sugar', 'tap_count': 1, 'tree_health': 'good'}
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is False
        assert any('tree_health' in e and 'dict' in e for e in errors)

    def test_invalid_tap_healing(self):
        details = {
            'tree_type': 'sugar',
            'tap_count': 1,
            'tree_health': {'tapHealing': 'excellent'},
        }
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is False
        assert any('tapHealing' in e for e in errors)

    def test_diameter_not_number(self):
        details = {
            'tree_type': 'sugar',
            'tap_count': 1,
            'tree_health': {'diameter': 'big'},
        }
        valid, errors = validate_event_details('maple-tapping', details)
        assert valid is False
        assert any('diameter' in e and 'number' in e for e in errors)


# ===================================================================
# Dispatch / top-level validation
# ===================================================================


class TestValidateEventDetailsDispatch:
    """Tests for the top-level dispatch logic."""

    def test_planting_null_details(self):
        valid, errors = validate_event_details('planting', None)
        assert valid is True
        assert errors == []

    def test_planting_with_non_null_details(self):
        """Planting events with details should still pass (warning logged)."""
        valid, errors = validate_event_details('planting', {'extra': 'data'})
        assert valid is True
        assert errors == []

    def test_unknown_event_type(self):
        """Unknown event types accepted for forward compatibility."""
        valid, errors = validate_event_details('fertilizing', {'amount': 5})
        assert valid is True
        assert errors == []

    def test_mulch_null_details_rejected(self):
        valid, errors = validate_event_details('mulch', None)
        assert valid is False
        assert any('required' in e for e in errors)

    def test_mulch_details_not_dict(self):
        valid, errors = validate_event_details('mulch', ['not', 'a', 'dict'])
        assert valid is False
        assert any('must be a dict' in e for e in errors)

    def test_maple_tapping_details_is_list(self):
        valid, errors = validate_event_details('maple-tapping', [1, 2, 3])
        assert valid is False
        assert any('must be a dict' in e for e in errors)
