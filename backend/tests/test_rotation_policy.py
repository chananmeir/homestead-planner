"""Tests for policy-based crop rotation scoring."""

from datetime import date, datetime

from models import PlantingEvent
from services.rotation_checker import check_rotation_conflict, suggest_safe_beds
from simulation_clock import set_simulated_date


def _create_event(session, user, bed, plant_id, year=2025, quantity=8, space_required=8):
    event = PlantingEvent(
        user_id=user.id,
        garden_bed_id=bed.id,
        event_type='planting',
        plant_id=plant_id,
        direct_seed_date=datetime(year, 5, 15),
        expected_harvest_date=datetime(year, 8, 1),
        quantity=quantity,
        space_required=space_required,
    )
    session.add(event)
    session.commit()
    return event


def test_high_risk_family_still_returns_hard_conflict(db_session, sample_user, sample_bed):
    set_simulated_date(date(2026, 1, 1))
    try:
        _create_event(db_session, sample_user, sample_bed, 'tomato-1', quantity=8, space_required=8)

        result = check_rotation_conflict(
            plant_id='pepper-1',
            bed_id=sample_bed.id,
            user_id=sample_user.id,
            planting_year=2026,
        )

        assert result['has_conflict'] is True
        assert result['has_rotation_concern'] is True
        assert result['severity'] == 'high'
        assert result['risk_score'] >= 80
        assert result['rotation_window'] == 3
        assert result['conflict_years'] == [2025]
        assert 'same_family_recent' in result['reason_codes']
    finally:
        set_simulated_date(None)


def test_cover_crop_history_is_ignored_for_family_conflict(db_session, sample_user, sample_bed):
    set_simulated_date(date(2026, 1, 1))
    try:
        _create_event(db_session, sample_user, sample_bed, 'clover-1', quantity=40, space_required=16)

        result = check_rotation_conflict(
            plant_id='bean-1',
            bed_id=sample_bed.id,
            user_id=sample_user.id,
            planting_year=2026,
        )

        assert result['has_conflict'] is False
        assert result['has_rotation_concern'] is False
        assert result['severity'] == 'ok'
        assert result['risk_score'] == 0
        assert 'cover_crop_history_ignored' in result['reason_codes']
        assert result['ignored_history'][0]['plant_id'] == 'clover-1'
    finally:
        set_simulated_date(None)


def test_low_exposure_lower_risk_family_is_advisory_not_conflict(
    db_session, sample_user, sample_bed
):
    set_simulated_date(date(2026, 1, 1))
    try:
        _create_event(db_session, sample_user, sample_bed, 'bean-1', quantity=1, space_required=1)

        result = check_rotation_conflict(
            plant_id='pea-1',
            bed_id=sample_bed.id,
            user_id=sample_user.id,
            planting_year=2026,
        )

        assert result['has_conflict'] is False
        assert result['has_rotation_concern'] is True
        assert result['severity'] == 'info'
        assert result['risk_score'] < 30
        assert 'low_exposure_history' in result['reason_codes']
        assert 'lower_risk_family' in result['reason_codes']
    finally:
        set_simulated_date(None)


def test_suggest_beds_sorts_lower_risk_beds_first(
    db_session, sample_user, sample_bed, second_bed
):
    set_simulated_date(date(2026, 1, 1))
    try:
        _create_event(db_session, sample_user, sample_bed, 'tomato-1', quantity=8, space_required=8)

        suggestions = suggest_safe_beds(
            plant_id='pepper-1',
            user_id=sample_user.id,
            planting_year=2026,
        )

        assert suggestions[0]['bed_id'] == second_bed.id
        assert suggestions[0]['rotation_safe'] is True
        assert suggestions[-1]['bed_id'] == sample_bed.id
        assert suggestions[-1]['severity'] == 'high'
    finally:
        set_simulated_date(None)
