from datetime import date, datetime, timedelta

import pytest

from models import GardenBed, HarvestRecord, PlantingOutcomeHistory, PlantedItem, Property, SeedInventory
from services.feedback_loop_service import (
    FeedbackLoopError,
    apply_days_to_maturity_adjustment,
    apply_failure_reason_correction,
    apply_sow_date_confirmation,
    apply_sow_date_adjustment,
    confirm_good_sow_date_from_harvest,
    diagnose_sow_date_for_planted_item,
    verify_failure_reason_for_planted_item,
)
from services.garden_planner_service import calculate_plant_quantities
from simulation_clock import set_simulated_date
import historical_soil_temp


def _create_bed(session, user):
    bed = GardenBed(user_id=user.id, name='Feedback Bed', width=4.0, length=8.0)
    session.add(bed)
    session.flush()
    return bed


def _create_property(session, user):
    prop = Property(
        user_id=user.id,
        name='Home',
        width=1.0,
        length=1.0,
        zipcode='53209',
        latitude=43.11,
        longitude=-87.95,
        zone='5b',
    )
    session.add(prop)
    session.flush()
    return prop


def _create_carrot_item(session, user, bed, **overrides):
    defaults = {
        'user_id': user.id,
        'garden_bed_id': bed.id,
        'plant_id': 'carrot-1',
        'variety': 'Royal Chantenay',
        'planted_date': datetime(2026, 4, 3),
        'position_x': 0,
        'position_y': 0,
        'quantity': 1,
        'status': 'didnt_establish',
        'outcome': 'didnt_establish',
        'outcome_reason': 'poor_germination',
        'outcome_date': datetime(2026, 4, 20),
    }
    defaults.update(overrides)
    item = PlantedItem(**defaults)
    session.add(item)
    session.flush()
    return item


def _create_seed(session, user, **overrides):
    defaults = {
        'user_id': user.id,
        'plant_id': 'carrot-1',
        'variety': 'Royal Chantenay',
        'quantity': 1,
        'seeds_per_packet': 100,
        'germination_temp_min': 45,
        'days_to_maturity': 70,
    }
    defaults.update(overrides)
    seed = SeedInventory(**defaults)
    session.add(seed)
    session.flush()
    return seed


def test_sow_date_diagnosis_requires_saved_location(db_session, sample_user):
    bed = _create_bed(db_session, sample_user)
    item = _create_carrot_item(db_session, sample_user, bed)

    result = diagnose_sow_date_for_planted_item(sample_user.id, item.id)

    assert result['status'] == 'needs_location'
    assert result['errorCode'] == 'location_required'


def test_reason_verification_requires_saved_location(db_session, sample_user):
    bed = _create_bed(db_session, sample_user)
    item = _create_carrot_item(
        db_session,
        sample_user,
        bed,
        plant_id='beet-1',
        variety='Zwaan Sugar Beet',
        status='failed',
        outcome='failed',
        outcome_reason='weather_frost',
        outcome_date=datetime(2026, 4, 20),
    )

    result = verify_failure_reason_for_planted_item(sample_user.id, item.id)

    assert result['status'] == 'needs_location'
    assert result['errorCode'] == 'location_required'


def test_reason_verification_confirms_weather_frost_when_actual_low_crosses_threshold(
    db_session,
    sample_user,
    monkeypatch,
):
    bed = _create_bed(db_session, sample_user)
    _create_property(db_session, sample_user)
    item = _create_carrot_item(
        db_session,
        sample_user,
        bed,
        plant_id='beet-1',
        variety='Zwaan Sugar Beet',
        planted_date=datetime(2026, 3, 28),
        status='failed',
        outcome='failed',
        outcome_reason='weather_frost',
        outcome_date=datetime(2026, 4, 6),
    )

    def fake_air_actuals(latitude, longitude, start_date, end_date):
        temps = [34, 31, 30, 27, 33, 34, 35, 36, 37, 38]
        return [
            {'date': start_date + timedelta(days=index), 'temperature': temp}
            for index, temp in enumerate(temps)
        ]

    monkeypatch.setattr('services.feedback_loop_service.get_actual_daily_air_temps', fake_air_actuals)

    result = verify_failure_reason_for_planted_item(sample_user.id, item.id)

    assert result['status'] == 'verdict'
    assert result['verdict'] == 'confirmed'
    assert result['reason'] == 'weather_frost'
    assert result['evidence']['thresholdF'] == 28
    assert result['evidence']['windowMinAirF'] == 27.0
    assert result['evidence']['daysAtOrBelowThreshold'] == 1


def test_reason_verification_unlikely_frost_surfaces_cold_soil_alternative(
    db_session,
    sample_user,
    monkeypatch,
):
    bed = _create_bed(db_session, sample_user)
    _create_property(db_session, sample_user)
    _create_seed(
        db_session,
        sample_user,
        plant_id='beet-1',
        variety='Zwaan Sugar Beet',
        germination_temp_min=50,
    )
    item = _create_carrot_item(
        db_session,
        sample_user,
        bed,
        plant_id='beet-1',
        variety='Zwaan Sugar Beet',
        planted_date=datetime(2026, 3, 28),
        status='failed',
        outcome='failed',
        outcome_reason='weather_frost',
        outcome_date=datetime(2026, 4, 6),
    )

    def fake_air_actuals(latitude, longitude, start_date, end_date):
        temps = [36, 34, 31, 29, 34, 35, 38, 41, 42, 45]
        return [
            {'date': start_date + timedelta(days=index), 'temperature': temp}
            for index, temp in enumerate(temps)
        ]

    def fake_soil_actuals(latitude, longitude, start_date, end_date):
        temps = [39, 40, 42, 41, 43, 44, 45, 46, 47, 48, 49, 51, 52, 53]
        return [
            {'date': start_date + timedelta(days=index), 'temperature': temp}
            for index, temp in enumerate(temps)
        ]

    monkeypatch.setattr('services.feedback_loop_service.get_actual_daily_air_temps', fake_air_actuals)
    monkeypatch.setattr('services.feedback_loop_service.get_actual_daily_soil_temps', fake_soil_actuals)

    result = verify_failure_reason_for_planted_item(sample_user.id, item.id)

    assert result['status'] == 'verdict'
    assert result['verdict'] == 'unlikely'
    assert result['evidence']['thresholdF'] == 28
    assert result['evidence']['windowMinAirF'] == 29.0
    assert result['alternative']['suggestedOutcome'] == 'didnt_establish'
    assert result['alternative']['suggestedReason'] == 'poor_germination'
    assert result['alternative']['evidence']['floorF'] == 50


def test_apply_failure_reason_correction_reclassifies_to_poor_germination(
    db_session,
    sample_user,
    monkeypatch,
):
    bed = _create_bed(db_session, sample_user)
    _create_property(db_session, sample_user)
    _create_seed(
        db_session,
        sample_user,
        plant_id='beet-1',
        variety='Zwaan Sugar Beet',
        germination_temp_min=50,
    )
    item = _create_carrot_item(
        db_session,
        sample_user,
        bed,
        plant_id='beet-1',
        variety='Zwaan Sugar Beet',
        planted_date=datetime(2026, 3, 28),
        status='failed',
        outcome='failed',
        outcome_reason='weather_frost',
        outcome_date=datetime(2026, 4, 6),
        outcome_notes='looked burned after cold snap',
    )

    def fake_air_actuals(latitude, longitude, start_date, end_date):
        temps = [36, 34, 31, 29, 34, 35, 38, 41, 42, 45]
        return [
            {'date': start_date + timedelta(days=index), 'temperature': temp}
            for index, temp in enumerate(temps)
        ]

    def fake_soil_actuals(latitude, longitude, start_date, end_date):
        temps = [39, 40, 42, 41, 43, 44, 45, 46, 47, 48, 49, 51, 52, 53]
        return [
            {'date': start_date + timedelta(days=index), 'temperature': temp}
            for index, temp in enumerate(temps)
        ]

    def fake_normals(latitude, longitude, month):
        if month < 4:
            return {day: 41.0 for day in range(1, 32)}
        if month == 4:
            return {day: 46.0 if day < 12 else 50.0 for day in range(1, 31)}
        return {day: 55.0 for day in range(1, 32)}

    monkeypatch.setattr('services.feedback_loop_service.get_actual_daily_air_temps', fake_air_actuals)
    monkeypatch.setattr('services.feedback_loop_service.get_actual_daily_soil_temps', fake_soil_actuals)
    monkeypatch.setattr('services.feedback_loop_service.get_historical_daily_soil_temps', fake_normals)

    result = apply_failure_reason_correction(sample_user.id, item.id)
    db_session.refresh(item)

    record = HarvestRecord.query.filter_by(
        user_id=sample_user.id,
        source_key=f'outcome:planted_item:{item.id}',
    ).first()

    assert result['status'] == 'applied'
    assert result['plantedItem']['outcome'] == 'didnt_establish'
    assert result['plantedItem']['outcomeReason'] == 'poor_germination'
    assert result['sowDateDiagnosis']['status'] == 'suggestion'
    assert result['sowDateDiagnosis']['recommendation']['monthDay'] == '04-12'
    assert item.outcome == 'didnt_establish'
    assert item.outcome_reason == 'poor_germination'
    assert item.status == 'didnt_establish'
    assert record is not None
    assert record.outcome == 'didnt_establish'
    assert record.outcome_reason == 'poor_germination'


def test_apply_failure_reason_correction_rejects_confirmed_frost(
    db_session,
    sample_user,
    monkeypatch,
):
    bed = _create_bed(db_session, sample_user)
    _create_property(db_session, sample_user)
    item = _create_carrot_item(
        db_session,
        sample_user,
        bed,
        plant_id='beet-1',
        variety='Zwaan Sugar Beet',
        planted_date=datetime(2026, 3, 28),
        status='failed',
        outcome='failed',
        outcome_reason='weather_frost',
        outcome_date=datetime(2026, 4, 6),
    )

    def fake_air_actuals(latitude, longitude, start_date, end_date):
        temps = [34, 31, 28, 27, 33, 34, 35, 36, 37, 38]
        return [
            {'date': start_date + timedelta(days=index), 'temperature': temp}
            for index, temp in enumerate(temps)
        ]

    monkeypatch.setattr('services.feedback_loop_service.get_actual_daily_air_temps', fake_air_actuals)

    with pytest.raises(FeedbackLoopError) as exc:
        apply_failure_reason_correction(sample_user.id, item.id)

    assert exc.value.error_code == 'correction_not_available'
    assert item.outcome == 'failed'
    assert item.outcome_reason == 'weather_frost'


def test_reason_verification_non_weather_reason_is_not_applicable(db_session, sample_user):
    bed = _create_bed(db_session, sample_user)
    item = _create_carrot_item(
        db_session,
        sample_user,
        bed,
        status='failed',
        outcome='failed',
        outcome_reason='pest',
    )

    result = verify_failure_reason_for_planted_item(sample_user.id, item.id)

    assert result['status'] == 'not_applicable'
    assert result['reason'] == 'pest'


def test_reason_verification_route_uses_authenticated_user(
    full_app,
    full_db,
    user_a,
    auth_client_a,
    monkeypatch,
):
    with full_app.app_context():
        bed = _create_bed(full_db.session, user_a)
        item = _create_carrot_item(
            full_db.session,
            user_a,
            bed,
            status='failed',
            outcome='failed',
            outcome_reason='weather_frost',
        )

        def fake_verifier(user_id, item_id):
            assert user_id == user_a.id
            assert item_id == item.id
            return {
                'status': 'not_applicable',
                'reason': 'weather_frost',
                'message': 'checked',
            }

        monkeypatch.setattr('blueprints.feedback_bp.verify_failure_reason_for_planted_item', fake_verifier)

        response = auth_client_a.post(f'/api/feedback/planted-items/{item.id}/reason-verification')

    assert response.status_code == 200
    assert response.get_json()['message'] == 'checked'


def test_apply_reason_correction_route_uses_authenticated_user(
    full_app,
    full_db,
    user_a,
    auth_client_a,
    monkeypatch,
):
    with full_app.app_context():
        bed = _create_bed(full_db.session, user_a)
        item = _create_carrot_item(
            full_db.session,
            user_a,
            bed,
            status='failed',
            outcome='failed',
            outcome_reason='weather_frost',
        )

        def fake_apply(user_id, item_id):
            assert user_id == user_a.id
            assert item_id == item.id
            return {
                'status': 'applied',
                'message': 'corrected',
            }

        monkeypatch.setattr('blueprints.feedback_bp.apply_failure_reason_correction', fake_apply)

        response = auth_client_a.post(f'/api/feedback/planted-items/{item.id}/apply-reason-correction')

    assert response.status_code == 200
    assert response.get_json()['message'] == 'corrected'


def test_actual_daily_air_temps_parses_archive_minimums(monkeypatch):
    historical_soil_temp._actual_daily_air_cache.clear()

    class FakeResponse:
        def json(self):
            return {
                'daily': {
                    'time': ['2026-04-01', '2026-04-02', '2026-04-03'],
                    'temperature_2m_min': [31.24, None, 28.86],
                }
            }

    captured = {}

    def fake_fetch(params):
        captured.update(params)
        return FakeResponse()

    monkeypatch.setattr(historical_soil_temp, '_fetch_with_retry', fake_fetch)

    result = historical_soil_temp.get_actual_daily_air_temps(
        43.11,
        -87.95,
        date(2026, 4, 1),
        date(2026, 4, 3),
    )

    assert captured['daily'] == 'temperature_2m_min'
    assert result == [
        {'date': date(2026, 4, 1), 'temperature': 31.2},
        {'date': date(2026, 4, 3), 'temperature': 28.9},
    ]
    cache_key = (
        round(43.11, 1),
        round(-87.95, 1),
        date(2026, 4, 1).isoformat(),
        date(2026, 4, 3).isoformat(),
    )
    assert cache_key not in historical_soil_temp._actual_daily_air_cache


def test_actual_daily_air_temps_evicts_partial_cached_window(monkeypatch):
    historical_soil_temp._actual_daily_air_cache.clear()
    start = date(2026, 4, 1)
    end = date(2026, 4, 3)
    cache_key = (round(43.11, 1), round(-87.95, 1), start.isoformat(), end.isoformat())
    historical_soil_temp._actual_daily_air_cache[cache_key] = {
        'data': [{'date': start, 'temperature': 31.0}],
        'timestamp': datetime.now(),
    }

    class FakeResponse:
        def json(self):
            return {
                'daily': {
                    'time': ['2026-04-01', '2026-04-02', '2026-04-03'],
                    'temperature_2m_min': [31.0, 29.5, 34.0],
                }
            }

    calls = {'count': 0}

    def fake_fetch(params):
        calls['count'] += 1
        return FakeResponse()

    monkeypatch.setattr(historical_soil_temp, '_fetch_with_retry', fake_fetch)

    result = historical_soil_temp.get_actual_daily_air_temps(43.11, -87.95, start, end)

    assert calls['count'] == 1
    assert result == [
        {'date': date(2026, 4, 1), 'temperature': 31.0},
        {'date': date(2026, 4, 2), 'temperature': 29.5},
        {'date': date(2026, 4, 3), 'temperature': 34.0},
    ]
    assert historical_soil_temp._actual_daily_air_cache[cache_key]['data'] == result


def test_actual_daily_soil_temps_does_not_cache_partial_response(monkeypatch):
    historical_soil_temp._actual_daily_cache.clear()
    start = date(2026, 4, 1)
    end = date(2026, 4, 3)
    cache_key = (round(43.11, 1), round(-87.95, 1), start.isoformat(), end.isoformat())

    class FakeResponse:
        def json(self):
            return {
                'daily': {
                    'time': ['2026-04-01', '2026-04-03'],
                    'soil_temperature_0_to_7cm_mean': [41.2, 43.7],
                }
            }

    monkeypatch.setattr(historical_soil_temp, '_fetch_with_retry', lambda params: FakeResponse())

    result = historical_soil_temp.get_actual_daily_soil_temps(43.11, -87.95, start, end)

    assert result == [
        {'date': date(2026, 4, 1), 'temperature': 41.2},
        {'date': date(2026, 4, 3), 'temperature': 43.7},
    ]
    assert cache_key not in historical_soil_temp._actual_daily_cache


def test_sow_date_diagnosis_suggests_normal_crossing_for_cold_window(
    db_session,
    sample_user,
    monkeypatch,
):
    bed = _create_bed(db_session, sample_user)
    _create_property(db_session, sample_user)
    _create_seed(db_session, sample_user)
    item = _create_carrot_item(db_session, sample_user, bed)

    def fake_actuals(latitude, longitude, start_date, end_date):
        temps = [35.2, 43.0, 44.0, 44.2, 44.0, 46.0, 46.0, 47.0, 48.0, 49.0, 50.0, 51.0, 52.0, 53.0]
        return [
            {'date': start_date + timedelta(days=index), 'temperature': temp}
            for index, temp in enumerate(temps)
        ]

    def fake_normals(latitude, longitude, month):
        if month < 4:
            return {day: 40.0 for day in range(1, 32)}
        if month == 4:
            return {day: 44.0 if day < 10 else 45.0 for day in range(1, 31)}
        return {day: 50.0 for day in range(1, 32)}

    monkeypatch.setattr('services.feedback_loop_service.get_actual_daily_soil_temps', fake_actuals)
    monkeypatch.setattr('services.feedback_loop_service.get_historical_daily_soil_temps', fake_normals)

    result = diagnose_sow_date_for_planted_item(sample_user.id, item.id)

    assert result['status'] == 'suggestion'
    assert result['recommendation']['monthDay'] == '04-10'
    assert result['recommendation']['label'] == 'Apr 10'
    assert result['location']['zipCode'] == '53209'
    assert result['evidence']['floorF'] == 45
    assert result['evidence']['first7MeanF'] == 43.2
    assert result['evidence']['first7BelowFloorDays'] == 5


def test_apply_sow_date_adjustment_updates_seed_override(db_session, sample_user):
    bed = _create_bed(db_session, sample_user)
    seed = _create_seed(db_session, sample_user)
    item = _create_carrot_item(db_session, sample_user, bed)

    result = apply_sow_date_adjustment(sample_user.id, item.id, '04-10')

    assert result['seedInventory']['id'] == seed.id
    assert seed.earliest_sow_month_day == '04-10'
    assert seed.sow_adjustment_updated_at is not None
    assert 'Apr 10' in seed.sow_adjustment_notes


def test_days_to_maturity_adjustment_bumps_personal_seed(db_session, sample_user):
    bed = _create_bed(db_session, sample_user)
    seed = _create_seed(db_session, sample_user, days_to_maturity=70)
    item = _create_carrot_item(
        db_session,
        sample_user,
        bed,
        status='harvested',
        outcome=None,
        outcome_reason=None,
        outcome_date=None,
    )
    record = HarvestRecord(
        user_id=sample_user.id,
        plant_id='carrot-1',
        planted_item_id=item.id,
        harvest_date=datetime(2026, 6, 1),
        quantity=1,
        unit='count',
        quality='poor',
        yield_excluded=False,
    )
    db_session.add(record)
    db_session.flush()

    result = apply_days_to_maturity_adjustment(sample_user.id, record.id, 7)

    assert result['previousDaysToMaturity'] == 70
    assert result['daysToMaturity'] == 77
    assert seed.days_to_maturity == 77


def test_days_to_maturity_adjustment_rejects_outcome_harvest(db_session, sample_user):
    record = HarvestRecord(
        user_id=sample_user.id,
        plant_id='carrot-1',
        harvest_date=datetime(2026, 6, 1),
        quantity=0,
        unit='count',
        quality='poor',
        outcome='didnt_establish',
        yield_excluded=True,
    )
    db_session.add(record)
    db_session.flush()

    with pytest.raises(FeedbackLoopError) as excinfo:
        apply_days_to_maturity_adjustment(sample_user.id, record.id, 7)

    assert excinfo.value.status_code == 409


def test_good_harvest_confirmation_suggests_actual_planting_date(db_session, sample_user):
    bed = _create_bed(db_session, sample_user)
    _create_seed(db_session, sample_user)
    item = _create_carrot_item(
        db_session,
        sample_user,
        bed,
        planted_date=datetime(2026, 3, 15),
        status='harvested',
        outcome=None,
        outcome_reason=None,
        outcome_date=None,
    )
    record = HarvestRecord(
        user_id=sample_user.id,
        plant_id='carrot-1',
        planted_item_id=item.id,
        harvest_date=datetime(2026, 6, 1),
        quantity=12,
        unit='count',
        quality='excellent',
        yield_excluded=False,
    )
    db_session.add(record)
    db_session.flush()

    result = confirm_good_sow_date_from_harvest(sample_user.id, record.id)

    assert result['status'] == 'suggestion'
    assert result['recommendation']['monthDay'] == '03-15'
    assert result['recommendation']['label'] == 'Mar 15'
    assert result['evidence']['plantingDate'] == '2026-03-15'
    assert result['weight'] == 2.0


def test_good_harvest_confirmation_ignores_fair_harvest(db_session, sample_user):
    bed = _create_bed(db_session, sample_user)
    item = _create_carrot_item(
        db_session,
        sample_user,
        bed,
        status='harvested',
        outcome=None,
        outcome_reason=None,
        outcome_date=None,
    )
    record = HarvestRecord(
        user_id=sample_user.id,
        plant_id='carrot-1',
        planted_item_id=item.id,
        harvest_date=datetime(2026, 6, 1),
        quantity=6,
        unit='count',
        quality='fair',
        yield_excluded=False,
    )
    db_session.add(record)
    db_session.flush()

    result = confirm_good_sow_date_from_harvest(sample_user.id, record.id)

    assert result['status'] == 'not_applicable'


def test_apply_sow_date_confirmation_records_history_and_seed_proven_date(db_session, sample_user):
    bed = _create_bed(db_session, sample_user)
    seed = _create_seed(db_session, sample_user)
    item = _create_carrot_item(
        db_session,
        sample_user,
        bed,
        planted_date=datetime(2026, 3, 15),
        status='harvested',
        outcome=None,
        outcome_reason=None,
        outcome_date=None,
    )
    record = HarvestRecord(
        user_id=sample_user.id,
        plant_id='carrot-1',
        planted_item_id=item.id,
        harvest_date=datetime(2026, 6, 1),
        quantity=12,
        unit='count',
        quality='excellent',
        yield_excluded=False,
    )
    db_session.add(record)
    db_session.flush()

    result = apply_sow_date_confirmation(sample_user.id, record.id, '03-15')

    history = PlantingOutcomeHistory.query.one()
    assert result['status'] == 'applied'
    assert result['seedInventory']['id'] == seed.id
    assert result['seedInventory']['provenSowMonthDay'] == '03-15'
    assert seed.proven_sow_month_day == '03-15'
    assert seed.proven_sow_updated_at is not None
    assert history.source_harvest_id == record.id
    assert history.target_month_day == '03-15'
    assert history.weight == 2.0


def test_sow_date_history_weighted_average_moves_after_negative_feedback(db_session, sample_user):
    bed = _create_bed(db_session, sample_user)
    seed = _create_seed(db_session, sample_user)
    good_item = _create_carrot_item(
        db_session,
        sample_user,
        bed,
        planted_date=datetime(2026, 3, 15),
        status='harvested',
        outcome=None,
        outcome_reason=None,
        outcome_date=None,
    )
    good_record = HarvestRecord(
        user_id=sample_user.id,
        plant_id='carrot-1',
        planted_item_id=good_item.id,
        harvest_date=datetime(2026, 6, 1),
        quantity=12,
        unit='count',
        quality='excellent',
        yield_excluded=False,
    )
    db_session.add(good_record)
    db_session.flush()

    apply_sow_date_confirmation(sample_user.id, good_record.id, '03-15')

    bad_item = _create_carrot_item(
        db_session,
        sample_user,
        bed,
        planted_date=datetime(2027, 3, 15),
        outcome_date=datetime(2027, 4, 3),
    )
    bad_record = HarvestRecord(
        user_id=sample_user.id,
        plant_id='carrot-1',
        planted_item_id=bad_item.id,
        source_key=f'outcome:planted_item:{bad_item.id}',
        harvest_date=datetime(2027, 4, 3),
        quantity=0,
        unit='count',
        quality='poor',
        outcome='didnt_establish',
        yield_excluded=True,
    )
    db_session.add(bad_record)
    db_session.flush()

    apply_sow_date_adjustment(sample_user.id, bad_item.id, '03-22')

    assert PlantingOutcomeHistory.query.count() == 2
    assert seed.proven_sow_month_day == '03-19'


def test_planner_uses_learned_earliest_sow_date(db_session, sample_user):
    _create_bed(db_session, sample_user)
    set_simulated_date(date(2026, 1, 1))
    try:
        result = calculate_plant_quantities(
            seed_selections=[{
                'id': 10,
                'plantId': 'carrot-1',
                'variety': 'Royal Chantenay',
                'quantity': 1,
                'seedsPerPacket': 100,
                'germinationRate': 90,
                'earliestSowMonthDay': '04-20',
            }],
            succession_preference='0',
            user_id=sample_user.id,
        )
    finally:
        set_simulated_date(None)

    assert result['items'][0]['firstPlantDate'] == '2026-04-20'


def test_planner_uses_proven_sow_date_before_earliest_sow_date(db_session, sample_user):
    _create_bed(db_session, sample_user)
    set_simulated_date(date(2026, 1, 1))
    try:
        result = calculate_plant_quantities(
            seed_selections=[{
                'id': 10,
                'plantId': 'carrot-1',
                'variety': 'Royal Chantenay',
                'quantity': 1,
                'seedsPerPacket': 100,
                'germinationRate': 90,
                'earliestSowMonthDay': '04-20',
                'provenSowMonthDay': '03-15',
            }],
            succession_preference='0',
            user_id=sample_user.id,
        )
    finally:
        set_simulated_date(None)

    assert result['items'][0]['firstPlantDate'] == '2026-03-15'


def test_planner_clamps_proven_sow_date_to_soil_temperature_normals(db_session, sample_user, monkeypatch):
    _create_bed(db_session, sample_user)
    _create_property(db_session, sample_user)

    def fake_normals(latitude, longitude, month):
        if month < 3:
            return {day: 40.0 for day in range(1, 32)}
        if month == 3:
            return {day: 44.0 if day < 28 else 45.0 for day in range(1, 32)}
        return {day: 50.0 for day in range(1, 32)}

    monkeypatch.setattr('services.garden_planner_service.get_historical_daily_soil_temps', fake_normals)

    set_simulated_date(date(2026, 1, 1))
    try:
        result = calculate_plant_quantities(
            seed_selections=[{
                'id': 10,
                'plantId': 'carrot-1',
                'variety': 'Royal Chantenay',
                'quantity': 1,
                'seedsPerPacket': 100,
                'germinationRate': 90,
                'germinationTempMin': 45,
                'provenSowMonthDay': '03-15',
            }],
            succession_preference='0',
            user_id=sample_user.id,
        )
    finally:
        set_simulated_date(None)

    assert result['items'][0]['firstPlantDate'] == '2026-03-28'


def test_planner_keeps_proven_sow_date_when_soil_temperature_normals_unavailable(
    db_session,
    sample_user,
    monkeypatch,
):
    _create_bed(db_session, sample_user)
    _create_property(db_session, sample_user)

    monkeypatch.setattr(
        'services.garden_planner_service.get_historical_daily_soil_temps',
        lambda latitude, longitude, month: None,
    )

    set_simulated_date(date(2026, 1, 1))
    try:
        result = calculate_plant_quantities(
            seed_selections=[{
                'id': 10,
                'plantId': 'carrot-1',
                'variety': 'Royal Chantenay',
                'quantity': 1,
                'seedsPerPacket': 100,
                'germinationRate': 90,
                'germinationTempMin': 45,
                'provenSowMonthDay': '03-15',
            }],
            succession_preference='0',
            user_id=sample_user.id,
        )
    finally:
        set_simulated_date(None)

    assert result['items'][0]['firstPlantDate'] == '2026-03-15'
