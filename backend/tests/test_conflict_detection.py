"""
Tests for conflict detection module (conflict_checker.py).

Covers spatial overlap, temporal overlap, sun exposure compatibility,
date helpers, the composite has_conflict() function, planted_item_to_event
conversion, query_candidate_items DB queries, and the full
validate_planting_conflict pipeline.

Maps to manual test cases CONF-01 through CONF-08 from TEST_GAP_REPORT.md.
"""

import sys
import os
import math
from datetime import datetime, timedelta

import pytest

# Ensure backend/ is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from conflict_checker import (
    check_spatial_overlap,
    check_temporal_overlap,
    check_sun_exposure_compatibility,
    get_in_ground_date,
    get_primary_planting_date,
    has_conflict,
    planted_item_to_event,
    query_candidate_items,
    validate_planting_conflict,
)


# =====================================================================
# Helpers
# =====================================================================

def _make_event(**kwargs):
    """Create a lightweight object mimicking PlantingEvent attributes."""
    defaults = {
        'id': None,
        'position_x': None,
        'position_y': None,
        'garden_bed_id': None,
        'plant_id': None,
        'variety': None,
        'transplant_date': None,
        'direct_seed_date': None,
        'seed_start_date': None,
        'expected_harvest_date': None,
    }
    defaults.update(kwargs)
    return type('MockEvent', (), defaults)()


def _make_bed(**kwargs):
    """Create a lightweight object mimicking GardenBed attributes."""
    defaults = {
        'id': 1,
        'grid_size': 12,
        'sun_exposure': None,
        'planning_method': 'square-foot',
    }
    defaults.update(kwargs)
    return type('MockBed', (), defaults)()


# =====================================================================
# Class 1: TestCheckSpatialOverlap  (pure function — no DB)
# =====================================================================

class TestCheckSpatialOverlap:
    """Tests for check_spatial_overlap() — Chebyshev distance on grid."""

    def test_same_cell_conflict(self):
        """CONF-01: Two plants in the same cell always conflict (spacing >= grid)."""
        assert check_spatial_overlap((0, 0), (0, 0), 12, 12, 12) is True

    def test_adjacent_cell_within_spacing(self):
        """CONF-02: Adjacent cells conflict when spacing > grid_size."""
        # 24" spacing / 12" grid = 2 cells required distance
        # Chebyshev distance (0,0)→(0,1) = 1 < 2 → conflict
        assert check_spatial_overlap((0, 0), (0, 1), 24, 24, 12) is True

    def test_sufficient_distance_no_conflict(self):
        """CONF-03: Plants far apart do not conflict."""
        # 12" spacing / 12" grid = 1 cell required
        # Chebyshev distance (0,0)→(3,3) = 3 >= 1 → no conflict
        assert check_spatial_overlap((0, 0), (3, 3), 12, 12, 12) is False

    def test_diagonal_adjacency_large_spacing(self):
        """Diagonal neighbor conflicts when spacing demands 2+ cells."""
        # Chebyshev distance (0,0)→(1,1) = 1 < ceil(24/12)=2 → conflict
        assert check_spatial_overlap((0, 0), (1, 1), 24, 24, 12) is True

    def test_diagonal_far_enough(self):
        """Diagonal 2 cells away is fine with single-cell spacing."""
        # Chebyshev (0,0)→(2,2) = 2, required = ceil(12/12)=1 → no conflict
        assert check_spatial_overlap((0, 0), (2, 2), 12, 12, 12) is False

    def test_asymmetric_spacing_uses_max(self):
        """Uses the larger plant's spacing (conservative approach)."""
        # Plant A: 24" → 2 cells, Plant B: 6" → 1 cell, required = max(2,1) = 2
        # Distance (0,0)→(1,0) = 1 < 2 → conflict
        assert check_spatial_overlap((0, 0), (1, 0), 24, 6, 12) is True

    def test_adjacent_single_cell_spacing_no_conflict(self):
        """Adjacent cells with single-cell spacing: distance=1 < 1 is False."""
        # 12" spacing / 12" grid = 1 cell required
        # Distance = 1, 1 < 1 is False → no conflict
        assert check_spatial_overlap((0, 0), (0, 1), 12, 12, 12) is False

    def test_large_grid_reduces_conflicts(self):
        """Larger grid cells reduce cell-distance conflicts."""
        # 12" spacing / 24" grid = ceil(0.5) = 1 cell required
        # Distance (0,0)→(0,1) = 1, 1 < 1 → False → no conflict
        assert check_spatial_overlap((0, 0), (0, 1), 12, 12, 24) is False

    def test_zero_spacing_no_conflict(self):
        """Zero spacing never causes conflict (required distance = 0)."""
        # ceil(0/12) = 0 for both, max = 0, any distance >= 0 → no conflict
        assert check_spatial_overlap((0, 0), (0, 1), 0, 0, 12) is False

    def test_same_cell_small_spacing(self):
        """Same cell conflicts even with small spacing (distance 0 < ceil(6/12)=1)."""
        assert check_spatial_overlap((0, 0), (0, 0), 6, 6, 12) is True

    def test_large_plant_small_plant_two_cells_apart(self):
        """36" plant vs 12" plant, 2 cells apart: ceil(36/12)=3, distance 2 < 3 → conflict."""
        assert check_spatial_overlap((0, 0), (2, 0), 36, 12, 12) is True

    def test_exact_boundary_no_conflict(self):
        """Exact boundary: distance == required → NOT a conflict (strict <)."""
        # 24" spacing → required=2, distance (0,0)→(2,0) = 2, 2 < 2 → False
        assert check_spatial_overlap((0, 0), (2, 0), 24, 12, 12) is False


# =====================================================================
# Class 2: TestCheckTemporalOverlap  (pure function — no DB)
# =====================================================================

class TestCheckTemporalOverlap:
    """Tests for check_temporal_overlap() — date range intersection."""

    def test_overlapping_ranges(self):
        """CONF-04: Overlapping date ranges detected."""
        a_start = datetime(2026, 4, 1)
        a_end = datetime(2026, 7, 1)
        b_start = datetime(2026, 6, 1)
        b_end = datetime(2026, 9, 1)
        assert check_temporal_overlap(a_start, a_end, b_start, b_end) is True

    def test_sequential_no_overlap(self):
        """CONF-05: Back-to-back ranges with gap → no conflict."""
        a_start = datetime(2026, 4, 1)
        a_end = datetime(2026, 6, 1)
        b_start = datetime(2026, 7, 1)
        b_end = datetime(2026, 9, 1)
        assert check_temporal_overlap(a_start, a_end, b_start, b_end) is False

    def test_same_day_sequential_not_conflict(self):
        """Harvest day == plant day → strict < means NO conflict."""
        a_start = datetime(2026, 4, 1)
        a_end = datetime(2026, 6, 15)
        b_start = datetime(2026, 6, 15)
        b_end = datetime(2026, 9, 1)
        # a_start(Apr 1) < b_end(Sep 1) → True
        # b_start(Jun 15) < a_end(Jun 15) → False (strict <)
        assert check_temporal_overlap(a_start, a_end, b_start, b_end) is False

    def test_contained_range(self):
        """Inner range fully contained within outer → conflict."""
        outer_start = datetime(2026, 4, 1)
        outer_end = datetime(2026, 8, 1)
        inner_start = datetime(2026, 5, 1)
        inner_end = datetime(2026, 6, 1)
        assert check_temporal_overlap(outer_start, outer_end, inner_start, inner_end) is True

    def test_identical_dates(self):
        """Identical start and end dates → conflict."""
        d1 = datetime(2026, 5, 1)
        d2 = datetime(2026, 7, 1)
        assert check_temporal_overlap(d1, d2, d1, d2) is True

    def test_missing_start_date(self):
        """Missing start_a → returns False (can't determine overlap)."""
        assert check_temporal_overlap(
            None, datetime(2026, 7, 1),
            datetime(2026, 6, 1), datetime(2026, 9, 1)
        ) is False

    def test_missing_end_date(self):
        """Missing end_b → returns False."""
        assert check_temporal_overlap(
            datetime(2026, 4, 1), datetime(2026, 7, 1),
            datetime(2026, 6, 1), None
        ) is False

    def test_all_dates_none(self):
        """All dates None → returns False."""
        assert check_temporal_overlap(None, None, None, None) is False

    def test_iso_string_with_z_suffix(self):
        """String dates with Z suffix are parsed correctly."""
        assert check_temporal_overlap(
            '2026-04-01T00:00:00Z', '2026-07-01T00:00:00Z',
            '2026-06-01T00:00:00Z', '2026-09-01T00:00:00Z'
        ) is True

    def test_year_long_overlap(self):
        """Year-long range overlaps any sub-range."""
        assert check_temporal_overlap(
            datetime(2026, 1, 1), datetime(2026, 12, 31),
            datetime(2026, 6, 1), datetime(2026, 7, 1)
        ) is True


# =====================================================================
# Class 3: TestCheckSunExposureCompatibility (uses plant_database — no DB)
# =====================================================================

class TestCheckSunExposureCompatibility:
    """Tests for check_sun_exposure_compatibility()."""

    def test_full_sun_plant_in_full_bed(self):
        """Full-sun plant in full-sun bed → compatible."""
        result = check_sun_exposure_compatibility('tomato-1', 'full')
        assert result['compatible'] is True
        assert result['severity'] is None

    def test_full_sun_plant_in_partial_bed(self):
        """Full-sun plant in partial-sun bed → incompatible, error."""
        result = check_sun_exposure_compatibility('tomato-1', 'partial')
        assert result['compatible'] is False
        assert result['severity'] == 'error'

    def test_full_sun_plant_in_shade_bed(self):
        """Full-sun plant in shade bed → incompatible, error."""
        result = check_sun_exposure_compatibility('tomato-1', 'shade')
        assert result['compatible'] is False
        assert result['severity'] == 'error'

    def test_partial_sun_plant_in_full_bed(self):
        """Partial-sun plant in full bed → compatible."""
        # lettuce-1 has sunRequirement='partial'
        result = check_sun_exposure_compatibility('lettuce-1', 'full')
        assert result['compatible'] is True

    def test_partial_sun_plant_in_partial_bed(self):
        """Partial-sun plant in partial bed → compatible."""
        result = check_sun_exposure_compatibility('lettuce-1', 'partial')
        assert result['compatible'] is True

    def test_partial_sun_plant_in_shade_bed(self):
        """Partial-sun plant in shade bed → incompatible, warning."""
        result = check_sun_exposure_compatibility('lettuce-1', 'shade')
        assert result['compatible'] is False
        assert result['severity'] == 'warning'

    def test_no_bed_exposure_set(self):
        """No bed sun exposure → compatible (can't validate)."""
        result = check_sun_exposure_compatibility('tomato-1', None)
        assert result['compatible'] is True
        assert result['severity'] is None

    def test_unknown_plant_id(self):
        """Unknown plant ID → compatible (unknown = OK)."""
        result = check_sun_exposure_compatibility('nonexistent-99', 'full')
        assert result['compatible'] is True
        assert result['plant_requirement'] is None


# =====================================================================
# Class 4: TestGetInGroundDate  (pure function with mock objects)
# =====================================================================

class TestGetInGroundDate:
    """Tests for get_in_ground_date() and get_primary_planting_date()."""

    def test_transplant_date_preferred(self):
        """Transplant date returned when both dates present."""
        event = _make_event(
            transplant_date=datetime(2026, 6, 15),
            direct_seed_date=datetime(2026, 5, 1),
        )
        assert get_in_ground_date(event) == datetime(2026, 6, 15)

    def test_direct_seed_fallback(self):
        """Direct seed date returned when no transplant."""
        event = _make_event(
            transplant_date=None,
            direct_seed_date=datetime(2026, 5, 1),
        )
        assert get_in_ground_date(event) == datetime(2026, 5, 1)

    def test_no_dates_returns_none(self):
        """No dates → returns None."""
        event = _make_event(transplant_date=None, direct_seed_date=None)
        assert get_in_ground_date(event) is None

    def test_dict_interface_camelcase(self):
        """Dict with camelCase keys works too."""
        event = {'transplantDate': datetime(2026, 6, 15), 'directSeedDate': datetime(2026, 5, 1)}
        assert get_in_ground_date(event) == datetime(2026, 6, 15)

    def test_primary_planting_date_includes_seed_start(self):
        """get_primary_planting_date includes seed_start_date."""
        event = _make_event(
            transplant_date=None,
            direct_seed_date=None,
            seed_start_date=datetime(2026, 3, 1),
        )
        assert get_primary_planting_date(event) == datetime(2026, 3, 1)

    def test_in_ground_excludes_seed_start(self):
        """get_in_ground_date does NOT return seed_start_date."""
        event = _make_event(
            transplant_date=None,
            direct_seed_date=None,
            seed_start_date=datetime(2026, 3, 1),
        )
        assert get_in_ground_date(event) is None


# =====================================================================
# Class 5: TestHasConflict  (composite check — uses plant_database)
# =====================================================================

class TestHasConflict:
    """Tests for has_conflict() — integrates spatial + temporal + sun."""

    def _tomato_event(self, x, y, bed_id, start, end, event_id=None):
        """Create a tomato event at given position and date range."""
        return _make_event(
            id=event_id,
            position_x=x, position_y=y,
            garden_bed_id=bed_id,
            plant_id='tomato-1',
            transplant_date=start,
            expected_harvest_date=end,
        )

    def test_same_cell_overlapping_dates(self):
        """CONF-06: Same cell + overlapping dates → conflict."""
        bed = _make_bed(id=1)
        new = self._tomato_event(0, 0, 1, datetime(2026, 6, 1), datetime(2026, 9, 1))
        existing = [self._tomato_event(0, 0, 1, datetime(2026, 4, 1), datetime(2026, 7, 1), event_id=10)]

        result = has_conflict(new, existing, bed)
        assert result['has_conflict'] is True
        assert len(result['conflicts']) == 1

    def test_same_cell_non_overlapping_dates(self):
        """Same cell, sequential dates → no conflict."""
        bed = _make_bed(id=1)
        new = self._tomato_event(0, 0, 1, datetime(2026, 7, 1), datetime(2026, 9, 1))
        existing = [self._tomato_event(0, 0, 1, datetime(2026, 4, 1), datetime(2026, 6, 30), event_id=10)]

        result = has_conflict(new, existing, bed)
        assert result['has_conflict'] is False

    def test_different_cells_overlapping_dates(self):
        """CONF-03: Different far-apart cells with overlapping dates → no conflict."""
        bed = _make_bed(id=1)
        new = self._tomato_event(0, 0, 1, datetime(2026, 4, 1), datetime(2026, 7, 1))
        existing = [self._tomato_event(3, 3, 1, datetime(2026, 4, 1), datetime(2026, 7, 1), event_id=10)]

        result = has_conflict(new, existing, bed)
        assert result['has_conflict'] is False

    def test_no_position_on_new_event(self):
        """New event without position → no conflict possible."""
        bed = _make_bed(id=1)
        new = _make_event(position_x=None, position_y=None, plant_id='tomato-1', garden_bed_id=1)
        existing = [self._tomato_event(0, 0, 1, datetime(2026, 4, 1), datetime(2026, 7, 1), event_id=10)]

        result = has_conflict(new, existing, bed)
        assert result['has_conflict'] is False

    def test_no_position_on_existing_event(self):
        """Existing event without position is skipped."""
        bed = _make_bed(id=1)
        new = self._tomato_event(0, 0, 1, datetime(2026, 4, 1), datetime(2026, 7, 1))
        existing = [_make_event(
            id=10, position_x=None, position_y=None,
            garden_bed_id=1, plant_id='tomato-1',
            transplant_date=datetime(2026, 4, 1),
            expected_harvest_date=datetime(2026, 7, 1),
        )]

        result = has_conflict(new, existing, bed)
        assert result['has_conflict'] is False

    def test_different_bed_ids_skipped(self):
        """Events in different beds are skipped."""
        bed = _make_bed(id=1)
        new = self._tomato_event(0, 0, 1, datetime(2026, 4, 1), datetime(2026, 7, 1))
        existing = [self._tomato_event(0, 0, 2, datetime(2026, 4, 1), datetime(2026, 7, 1), event_id=10)]

        result = has_conflict(new, existing, bed)
        assert result['has_conflict'] is False

    def test_self_exclusion_when_editing(self):
        """Same ID on new and existing → skipped (editing case)."""
        bed = _make_bed(id=1)
        new = self._tomato_event(0, 0, 1, datetime(2026, 4, 1), datetime(2026, 7, 1), event_id=10)
        existing = [self._tomato_event(0, 0, 1, datetime(2026, 4, 1), datetime(2026, 7, 1), event_id=10)]

        result = has_conflict(new, existing, bed)
        assert result['has_conflict'] is False

    def test_unknown_new_plant(self):
        """Unknown plant_id on new event → no conflict (can't evaluate)."""
        bed = _make_bed(id=1)
        new = _make_event(
            position_x=0, position_y=0, garden_bed_id=1,
            plant_id='fake-99',
            transplant_date=datetime(2026, 4, 1),
            expected_harvest_date=datetime(2026, 7, 1),
        )
        existing = [self._tomato_event(0, 0, 1, datetime(2026, 4, 1), datetime(2026, 7, 1), event_id=10)]

        result = has_conflict(new, existing, bed)
        assert result['has_conflict'] is False

    def test_unknown_existing_plant_skipped(self):
        """Unknown plant_id on existing event → that event is skipped."""
        bed = _make_bed(id=1)
        new = self._tomato_event(0, 0, 1, datetime(2026, 4, 1), datetime(2026, 7, 1))
        existing = [_make_event(
            id=10, position_x=0, position_y=0, garden_bed_id=1,
            plant_id='fake-99',
            transplant_date=datetime(2026, 4, 1),
            expected_harvest_date=datetime(2026, 7, 1),
        )]

        result = has_conflict(new, existing, bed)
        assert result['has_conflict'] is False

    def test_sfg_bed_caps_spacing_to_grid(self):
        """SFG bed: spacing capped to grid_size → only same-cell conflicts."""
        bed = _make_bed(id=1, planning_method='square-foot', grid_size=12)
        # pepper-1 has 18" spacing, but SFG caps to 12"
        new = _make_event(
            position_x=0, position_y=0, garden_bed_id=1,
            plant_id='pepper-1',
            transplant_date=datetime(2026, 5, 1),
            expected_harvest_date=datetime(2026, 8, 1),
        )
        # Adjacent cell — with capped spacing, should NOT conflict
        existing = [_make_event(
            id=10, position_x=0, position_y=1, garden_bed_id=1,
            plant_id='pepper-1',
            transplant_date=datetime(2026, 5, 1),
            expected_harvest_date=datetime(2026, 8, 1),
        )]
        result = has_conflict(new, existing, bed)
        assert result['has_conflict'] is False

        # Same cell — should conflict
        existing_same = [_make_event(
            id=11, position_x=0, position_y=0, garden_bed_id=1,
            plant_id='pepper-1',
            transplant_date=datetime(2026, 5, 1),
            expected_harvest_date=datetime(2026, 8, 1),
        )]
        result2 = has_conflict(new, existing_same, bed)
        assert result2['has_conflict'] is True

    def test_multiple_conflicts_returned(self):
        """Multiple events at same position → all reported as conflicts."""
        bed = _make_bed(id=1)
        new = self._tomato_event(0, 0, 1, datetime(2026, 4, 1), datetime(2026, 9, 1))
        existing = [
            self._tomato_event(0, 0, 1, datetime(2026, 4, 1), datetime(2026, 7, 1), event_id=10),
            self._tomato_event(0, 0, 1, datetime(2026, 5, 1), datetime(2026, 8, 1), event_id=11),
            self._tomato_event(0, 0, 1, datetime(2026, 6, 1), datetime(2026, 9, 1), event_id=12),
        ]

        result = has_conflict(new, existing, bed)
        assert result['has_conflict'] is True
        assert len(result['conflicts']) == 3

    def test_sun_exposure_warning_added(self):
        """Full-sun plant in shade bed → sun_exposure_warning present."""
        bed = _make_bed(id=1, sun_exposure='shade')
        new = self._tomato_event(0, 0, 1, datetime(2026, 4, 1), datetime(2026, 7, 1))
        # No spatial conflicts, but sun should warn
        result = has_conflict(new, [], bed)
        assert result['has_conflict'] is False
        assert 'sun_exposure_warning' in result
        assert result['sun_exposure_warning']['compatible'] is False

    def test_empty_existing_events(self):
        """No existing events → no conflict."""
        bed = _make_bed(id=1)
        new = self._tomato_event(0, 0, 1, datetime(2026, 4, 1), datetime(2026, 7, 1))
        result = has_conflict(new, [], bed)
        assert result['has_conflict'] is False
        assert result['conflicts'] == []


# =====================================================================
# Class 6: TestPlantedItemToEvent  (needs DB for PlantedItem model)
# =====================================================================

class TestPlantedItemToEvent:
    """Tests for planted_item_to_event() conversion."""

    def test_basic_conversion(self, db_session, sample_user, sample_bed):
        """All attributes mapped correctly from PlantedItem."""
        from models import PlantedItem

        item = PlantedItem(
            user_id=sample_user.id,
            plant_id='tomato-1',
            variety='Roma',
            garden_bed_id=sample_bed.id,
            position_x=2,
            position_y=3,
            planted_date=datetime(2026, 5, 1),
            transplant_date=datetime(2026, 5, 15),
            harvest_date=datetime(2026, 8, 1),
        )
        db_session.add(item)
        db_session.flush()

        event = planted_item_to_event(item)
        assert event.plant_id == 'tomato-1'
        assert event.variety == 'Roma'
        assert event.position_x == 2
        assert event.position_y == 3
        assert event.garden_bed_id == sample_bed.id
        assert event.transplant_date == datetime(2026, 5, 15)
        assert event.expected_harvest_date == datetime(2026, 8, 1)
        # direct_seed_date should be None when transplant_date is set
        assert event.direct_seed_date is None

    def test_seed_saving_extends_end_date(self, db_session, sample_user, sample_bed):
        """Seed saving with maturity date → end = seed_maturity_date."""
        from models import PlantedItem

        item = PlantedItem(
            user_id=sample_user.id,
            plant_id='tomato-1',
            garden_bed_id=sample_bed.id,
            position_x=0,
            position_y=0,
            planted_date=datetime(2026, 5, 1),
            transplant_date=datetime(2026, 5, 15),
            harvest_date=datetime(2026, 8, 1),
            save_for_seed=True,
            seeds_collected=False,
            seed_maturity_date=datetime(2026, 10, 1),
        )
        db_session.add(item)
        db_session.flush()

        event = planted_item_to_event(item)
        assert event.expected_harvest_date == datetime(2026, 10, 1)

    def test_no_harvest_uses_dtm(self, db_session, sample_user, sample_bed):
        """No harvest date → calculated from planted_date + DTM."""
        from models import PlantedItem

        item = PlantedItem(
            user_id=sample_user.id,
            plant_id='tomato-1',  # DTM=70
            garden_bed_id=sample_bed.id,
            position_x=0,
            position_y=0,
            planted_date=datetime(2026, 5, 1),
            harvest_date=None,
        )
        db_session.add(item)
        db_session.flush()

        event = planted_item_to_event(item)
        # in_ground = transplant_date(None) or planted_date(May 1) = May 1
        # DTM for tomato-1 = 70
        expected = datetime(2026, 5, 1) + timedelta(days=70)
        assert event.expected_harvest_date == expected

    def test_planted_date_only_uses_dtm_from_planted(self, db_session, sample_user, sample_bed):
        """Only planted_date set (no transplant, no harvest) → end = planted + DTM."""
        from models import PlantedItem

        planted = datetime(2026, 5, 1)
        item = PlantedItem(
            user_id=sample_user.id,
            plant_id='tomato-1',  # DTM = 70
            garden_bed_id=sample_bed.id,
            position_x=0,
            position_y=0,
            planted_date=planted,
            transplant_date=None,
            harvest_date=None,
        )
        db_session.add(item)
        db_session.flush()

        event = planted_item_to_event(item)
        # in_ground = transplant(None) or planted(May 1) = May 1
        assert event.expected_harvest_date == planted + timedelta(days=70)


# =====================================================================
# Class 7: TestValidatePlantingConflict  (full DB pipeline)
# =====================================================================

class TestValidatePlantingConflict:
    """Tests for validate_planting_conflict() — server-side enforcement."""

    def _place_item(self, db_session, user, bed, plant_id, x, y, planted, transplant=None, harvest=None):
        """Helper to create a PlantedItem in the database."""
        from models import PlantedItem
        item = PlantedItem(
            user_id=user.id,
            plant_id=plant_id,
            garden_bed_id=bed.id,
            position_x=x,
            position_y=y,
            planted_date=planted,
            transplant_date=transplant,
            harvest_date=harvest,
        )
        db_session.add(item)
        db_session.flush()
        return item

    def test_no_conflict_empty_bed(self, db_session, sample_user, sample_bed):
        """Empty bed → always valid."""
        valid, err = validate_planting_conflict({
            'garden_bed_id': sample_bed.id,
            'position_x': 0,
            'position_y': 0,
            'plant_id': 'tomato-1',
            'start_date': datetime(2026, 5, 1),
            'end_date': datetime(2026, 8, 1),
        }, sample_user.id)

        assert valid is True
        assert err is None

    def test_conflict_detected(self, db_session, sample_user, sample_bed):
        """CONF-01: Same cell + overlapping dates → conflict."""
        self._place_item(
            db_session, sample_user, sample_bed,
            'tomato-1', 0, 0,
            planted=datetime(2026, 4, 1),
            transplant=datetime(2026, 5, 1),
            harvest=datetime(2026, 8, 1),
        )

        valid, err = validate_planting_conflict({
            'garden_bed_id': sample_bed.id,
            'position_x': 0,
            'position_y': 0,
            'plant_id': 'tomato-1',
            'transplant_date': datetime(2026, 6, 1),
            'start_date': datetime(2026, 6, 1),
            'end_date': datetime(2026, 9, 1),
        }, sample_user.id)

        assert valid is False
        assert err is not None
        assert 'conflicts' in err

    def test_position_zero_zero_is_valid(self, db_session, sample_user, sample_bed):
        """Position (0,0) is a valid coordinate — not skipped as None."""
        self._place_item(
            db_session, sample_user, sample_bed,
            'tomato-1', 0, 0,
            planted=datetime(2026, 4, 1),
            transplant=datetime(2026, 5, 1),
            harvest=datetime(2026, 8, 1),
        )

        valid, err = validate_planting_conflict({
            'garden_bed_id': sample_bed.id,
            'position_x': 0,
            'position_y': 0,
            'plant_id': 'tomato-1',
            'transplant_date': datetime(2026, 6, 1),
            'start_date': datetime(2026, 6, 1),
            'end_date': datetime(2026, 9, 1),
        }, sample_user.id)

        # Should detect conflict — position 0,0 must NOT be treated as falsy
        assert valid is False

    def test_no_position_skips_validation(self, db_session, sample_user, sample_bed):
        """No position data → skip validation (timeline-only event)."""
        valid, err = validate_planting_conflict({
            'garden_bed_id': sample_bed.id,
            'position_x': None,
            'position_y': None,
            'plant_id': 'tomato-1',
            'start_date': datetime(2026, 5, 1),
            'end_date': datetime(2026, 8, 1),
        }, sample_user.id)

        assert valid is True
        assert err is None

    def test_conflict_override_skips(self, db_session, sample_user, sample_bed):
        """CONF-07: conflict_override=True → skip validation."""
        self._place_item(
            db_session, sample_user, sample_bed,
            'tomato-1', 0, 0,
            planted=datetime(2026, 4, 1),
            transplant=datetime(2026, 5, 1),
            harvest=datetime(2026, 8, 1),
        )

        valid, err = validate_planting_conflict({
            'garden_bed_id': sample_bed.id,
            'position_x': 0,
            'position_y': 0,
            'plant_id': 'tomato-1',
            'transplant_date': datetime(2026, 6, 1),
            'start_date': datetime(2026, 6, 1),
            'end_date': datetime(2026, 9, 1),
            'conflict_override': True,
        }, sample_user.id)

        assert valid is True
        assert err is None

    def test_missing_dates_skips(self, db_session, sample_user, sample_bed):
        """Missing start/end dates → skip validation."""
        valid, err = validate_planting_conflict({
            'garden_bed_id': sample_bed.id,
            'position_x': 0,
            'position_y': 0,
            'plant_id': 'tomato-1',
        }, sample_user.id)

        assert valid is True
        assert err is None

    def test_missing_bed_id_skips(self, db_session, sample_user, sample_bed):
        """Missing garden_bed_id → skip validation."""
        valid, err = validate_planting_conflict({
            'position_x': 0,
            'position_y': 0,
            'plant_id': 'tomato-1',
            'start_date': datetime(2026, 5, 1),
            'end_date': datetime(2026, 8, 1),
        }, sample_user.id)

        assert valid is True
        assert err is None

    def test_nonexistent_bed_error(self, db_session, sample_user):
        """Bad bed_id → error returned."""
        valid, err = validate_planting_conflict({
            'garden_bed_id': 99999,
            'position_x': 0,
            'position_y': 0,
            'plant_id': 'tomato-1',
            'start_date': datetime(2026, 5, 1),
            'end_date': datetime(2026, 8, 1),
        }, sample_user.id)

        assert valid is False
        assert 'Garden bed not found' in err['error']

    def test_exclude_self_when_editing(self, db_session, sample_user, sample_bed):
        """Excluding own item_id → no conflict with self."""
        item = self._place_item(
            db_session, sample_user, sample_bed,
            'tomato-1', 0, 0,
            planted=datetime(2026, 4, 1),
            transplant=datetime(2026, 5, 1),
            harvest=datetime(2026, 8, 1),
        )

        valid, err = validate_planting_conflict({
            'garden_bed_id': sample_bed.id,
            'position_x': 0,
            'position_y': 0,
            'plant_id': 'tomato-1',
            'transplant_date': datetime(2026, 5, 1),
            'start_date': datetime(2026, 5, 1),
            'end_date': datetime(2026, 8, 1),
        }, sample_user.id, exclude_item_id=item.id)

        assert valid is True
        assert err is None

    def test_sufficient_distance_no_conflict(self, db_session, sample_user, sample_bed):
        """CONF-03: Far apart cells → no conflict."""
        self._place_item(
            db_session, sample_user, sample_bed,
            'tomato-1', 0, 0,
            planted=datetime(2026, 4, 1),
            transplant=datetime(2026, 5, 1),
            harvest=datetime(2026, 8, 1),
        )

        valid, err = validate_planting_conflict({
            'garden_bed_id': sample_bed.id,
            'position_x': 5,
            'position_y': 5,
            'plant_id': 'tomato-1',
            'transplant_date': datetime(2026, 5, 1),
            'start_date': datetime(2026, 5, 1),
            'end_date': datetime(2026, 8, 1),
        }, sample_user.id)

        assert valid is True
        assert err is None

    def test_non_overlapping_dates_no_conflict(self, db_session, sample_user, sample_bed):
        """CONF-05: Same cell but sequential dates → no conflict."""
        self._place_item(
            db_session, sample_user, sample_bed,
            'tomato-1', 0, 0,
            planted=datetime(2026, 4, 1),
            transplant=datetime(2026, 5, 1),
            harvest=datetime(2026, 7, 1),
        )

        valid, err = validate_planting_conflict({
            'garden_bed_id': sample_bed.id,
            'position_x': 0,
            'position_y': 0,
            'plant_id': 'tomato-1',
            'transplant_date': datetime(2026, 8, 1),
            'start_date': datetime(2026, 8, 1),
            'end_date': datetime(2026, 10, 1),
        }, sample_user.id)

        assert valid is True
        assert err is None

    def test_multiple_conflicts_in_bed(self, db_session, sample_user, sample_bed):
        """Multiple items at same spot → conflict with details."""
        for i in range(2):
            self._place_item(
                db_session, sample_user, sample_bed,
                'tomato-1', 0, 0,
                planted=datetime(2026, 4, 1),
                transplant=datetime(2026, 5, 1),
                harvest=datetime(2026, 8, 1),
            )

        valid, err = validate_planting_conflict({
            'garden_bed_id': sample_bed.id,
            'position_x': 0,
            'position_y': 0,
            'plant_id': 'tomato-1',
            'transplant_date': datetime(2026, 6, 1),
            'start_date': datetime(2026, 6, 1),
            'end_date': datetime(2026, 9, 1),
        }, sample_user.id)

        assert valid is False
        assert len(err['conflicts']) == 2


# =====================================================================
# Class 8: TestQueryCandidateItems  (DB tests)
# =====================================================================

class TestQueryCandidateItems:
    """Tests for query_candidate_items() DB queries."""

    def _place_item(self, db_session, user, bed, x, y, plant_id='tomato-1'):
        """Helper to create a positioned PlantedItem."""
        from models import PlantedItem
        item = PlantedItem(
            user_id=user.id,
            plant_id=plant_id,
            garden_bed_id=bed.id,
            position_x=x,
            position_y=y,
            planted_date=datetime(2026, 5, 1),
        )
        db_session.add(item)
        db_session.flush()
        return item

    def test_returns_positioned_items_only(self, db_session, sample_user, sample_bed):
        """Items without position are excluded."""
        from models import PlantedItem
        from sqlalchemy import text

        # 2 with position
        self._place_item(db_session, sample_user, sample_bed, 0, 0)
        self._place_item(db_session, sample_user, sample_bed, 1, 1)
        # 1 without position — must use raw SQL because ORM default=0 overrides None
        item_no_pos = PlantedItem(
            user_id=sample_user.id,
            plant_id='tomato-1',
            garden_bed_id=sample_bed.id,
            position_x=0,
            position_y=0,
            planted_date=datetime(2026, 5, 1),
        )
        db_session.add(item_no_pos)
        db_session.flush()
        db_session.execute(
            text("UPDATE planted_item SET position_x = NULL, position_y = NULL WHERE id = :id"),
            {"id": item_no_pos.id}
        )
        db_session.flush()
        # Expire cached attributes so ORM re-reads from DB
        db_session.expire(item_no_pos)

        events = query_candidate_items(sample_bed.id, sample_user.id)
        assert len(events) == 2

    def test_filters_by_bed_id(self, db_session, sample_user, sample_bed, second_bed):
        """Only items in target bed returned."""
        self._place_item(db_session, sample_user, sample_bed, 0, 0)
        self._place_item(db_session, sample_user, second_bed, 0, 0)

        events = query_candidate_items(sample_bed.id, sample_user.id)
        assert len(events) == 1

    def test_filters_by_user_id(self, db_session, sample_user, sample_bed):
        """Only items from target user returned."""
        from models import User, PlantedItem
        from werkzeug.security import generate_password_hash

        other_user = User(
            username='otheruser',
            email='other@example.com',
            password_hash=generate_password_hash('pass'),
        )
        db_session.add(other_user)
        db_session.flush()

        self._place_item(db_session, sample_user, sample_bed, 0, 0)
        # Place an item as other_user in the same bed
        item2 = PlantedItem(
            user_id=other_user.id,
            plant_id='tomato-1',
            garden_bed_id=sample_bed.id,
            position_x=1,
            position_y=1,
            planted_date=datetime(2026, 5, 1),
        )
        db_session.add(item2)
        db_session.flush()

        events = query_candidate_items(sample_bed.id, sample_user.id)
        assert len(events) == 1

    def test_excludes_specified_item_id(self, db_session, sample_user, sample_bed):
        """exclude_item_id filters out that specific item."""
        item1 = self._place_item(db_session, sample_user, sample_bed, 0, 0)
        self._place_item(db_session, sample_user, sample_bed, 1, 1)

        events = query_candidate_items(sample_bed.id, sample_user.id, exclude_item_id=item1.id)
        assert len(events) == 1

    def test_empty_bed(self, db_session, sample_user, sample_bed):
        """Empty bed returns empty list."""
        events = query_candidate_items(sample_bed.id, sample_user.id)
        assert events == []
