"""
Tests for PlantingEvent trellis position CHECK constraints.

Verifies that the 4 database-level CHECK constraints on trellis fields
reject invalid data and accept valid data.

Constraints:
  ck_pe_trellis_start_nonneg    — start >= 0
  ck_pe_trellis_end_gt_start    — end > start
  ck_pe_linear_feet_nonneg      — linear_feet_allocated >= 0
  ck_pe_trellis_fields_together — start and end both NULL or both non-NULL
"""

import pytest
from sqlalchemy.exc import IntegrityError
from models import PlantingEvent


# ── helpers ──────────────────────────────────────────────────────────

def _make_event(db_session, sample_user, sample_trellis, **overrides):
    """Create a PlantingEvent with trellis defaults, applying overrides."""
    defaults = dict(
        user_id=sample_user.id,
        event_type='planting',
        plant_id='grape-1',
        trellis_structure_id=sample_trellis.id,
        trellis_position_start_inches=0.0,
        trellis_position_end_inches=24.0,
        linear_feet_allocated=2.0,
    )
    defaults.update(overrides)
    ev = PlantingEvent(**defaults)
    db_session.add(ev)
    return ev


# ── positive tests (should commit successfully) ─────────────────────

class TestValidTrellisData:

    def test_all_trellis_fields_null(self, db_session, sample_user, sample_trellis):
        """NULL trellis fields pass all constraints (non-trellis event)."""
        ev = PlantingEvent(
            user_id=sample_user.id,
            event_type='planting',
            plant_id='tomato-1',
            trellis_structure_id=None,
            trellis_position_start_inches=None,
            trellis_position_end_inches=None,
            linear_feet_allocated=None,
        )
        db_session.add(ev)
        db_session.flush()
        assert ev.id is not None

    def test_valid_trellis_positions(self, db_session, sample_user, sample_trellis):
        """Standard valid trellis allocation."""
        _make_event(db_session, sample_user, sample_trellis,
                    trellis_position_start_inches=6.0,
                    trellis_position_end_inches=30.0,
                    linear_feet_allocated=2.0)
        db_session.flush()  # should not raise

    def test_start_at_zero(self, db_session, sample_user, sample_trellis):
        """Start position of 0 is valid (beginning of trellis)."""
        _make_event(db_session, sample_user, sample_trellis,
                    trellis_position_start_inches=0.0,
                    trellis_position_end_inches=12.0)
        db_session.flush()

    def test_linear_feet_zero(self, db_session, sample_user, sample_trellis):
        """linear_feet_allocated = 0 is valid (placeholder/reserved)."""
        _make_event(db_session, sample_user, sample_trellis,
                    linear_feet_allocated=0.0)
        db_session.flush()


# ── negative tests (should raise IntegrityError) ────────────────────

class TestInvalidTrellisData:

    def test_negative_start(self, db_session, sample_user, sample_trellis):
        """Negative start position violates ck_pe_trellis_start_nonneg."""
        _make_event(db_session, sample_user, sample_trellis,
                    trellis_position_start_inches=-1.0,
                    trellis_position_end_inches=10.0)
        with pytest.raises(IntegrityError):
            db_session.flush()

    def test_end_equals_start(self, db_session, sample_user, sample_trellis):
        """End == start violates ck_pe_trellis_end_gt_start (need end > start)."""
        _make_event(db_session, sample_user, sample_trellis,
                    trellis_position_start_inches=10.0,
                    trellis_position_end_inches=10.0)
        with pytest.raises(IntegrityError):
            db_session.flush()

    def test_end_less_than_start(self, db_session, sample_user, sample_trellis):
        """End < start violates ck_pe_trellis_end_gt_start."""
        _make_event(db_session, sample_user, sample_trellis,
                    trellis_position_start_inches=20.0,
                    trellis_position_end_inches=10.0)
        with pytest.raises(IntegrityError):
            db_session.flush()

    def test_negative_linear_feet(self, db_session, sample_user, sample_trellis):
        """Negative linear_feet_allocated violates ck_pe_linear_feet_nonneg."""
        _make_event(db_session, sample_user, sample_trellis,
                    linear_feet_allocated=-1.0)
        with pytest.raises(IntegrityError):
            db_session.flush()

    def test_start_without_end(self, db_session, sample_user, sample_trellis):
        """Start set but end NULL violates ck_pe_trellis_fields_together."""
        _make_event(db_session, sample_user, sample_trellis,
                    trellis_position_start_inches=5.0,
                    trellis_position_end_inches=None)
        with pytest.raises(IntegrityError):
            db_session.flush()

    def test_end_without_start(self, db_session, sample_user, sample_trellis):
        """End set but start NULL violates ck_pe_trellis_fields_together."""
        _make_event(db_session, sample_user, sample_trellis,
                    trellis_position_start_inches=None,
                    trellis_position_end_inches=24.0)
        with pytest.raises(IntegrityError):
            db_session.flush()
