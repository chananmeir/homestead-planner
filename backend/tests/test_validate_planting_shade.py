from unittest.mock import patch

import blueprints.utilities_bp as utilities_module
from models import GardenBed


def _bed(db, user, name, sun_exposure):
    bed = GardenBed(
        user_id=user.id,
        name=name,
        width=4.0,
        length=8.0,
        sun_exposure=sun_exposure,
    )
    db.session.add(bed)
    db.session.commit()
    return bed


def _recording_validator(calls):
    def fake_validate_planting_for_property(**kwargs):
        calls.append(kwargs)
        return {'valid': True, 'warnings': [], 'suggestion': None}

    return fake_validate_planting_for_property


def test_validate_planting_uses_selected_bed_sun_exposure(auth_client_a, full_db, user_a):
    bed = _bed(full_db, user_a, 'Partial Shade Bed', 'partial')
    calls = []

    with patch.object(
        utilities_module,
        'validate_planting_for_property',
        side_effect=_recording_validator(calls),
    ):
        response = auth_client_a.post('/api/validate-planting', json={
            'plantId': 'lettuce-1',
            'plantingDate': '2026-05-01',
            'bedId': bed.id,
            'plantingMethod': 'seed',
        })

    assert response.status_code == 200
    assert len(calls) == 1
    assert calls[0]['sun_exposure'] == 'partial'


def test_validate_plants_batch_uses_selected_bed_sun_exposure(auth_client_a, full_db, user_a):
    bed = _bed(full_db, user_a, 'Full Shade Bed', 'shade')
    calls = []

    with patch.object(
        utilities_module,
        'validate_planting_for_property',
        side_effect=_recording_validator(calls),
    ):
        response = auth_client_a.post('/api/validate-plants-batch', json={
            'plantIds': ['lettuce-1'],
            'plantingDate': '2026-05-01',
            'bedId': bed.id,
        })

    assert response.status_code == 200
    assert [call['sun_exposure'] for call in calls] == ['shade', 'shade']


def test_validate_plants_batch_ignores_bed_from_another_user(
    auth_client_a,
    full_db,
    user_b,
):
    other_bed = _bed(full_db, user_b, 'Other User Shade Bed', 'shade')
    calls = []

    with patch.object(
        utilities_module,
        'validate_planting_for_property',
        side_effect=_recording_validator(calls),
    ):
        response = auth_client_a.post('/api/validate-plants-batch', json={
            'plantIds': ['lettuce-1'],
            'plantingDate': '2026-05-01',
            'bedId': other_bed.id,
        })

    assert response.status_code == 200
    assert [call['sun_exposure'] for call in calls] == ['full-sun', 'full-sun']


def test_validate_plants_batch_warns_for_full_sun_plant_in_shade_bed(
    auth_client_a,
    full_db,
    user_a,
):
    bed = _bed(full_db, user_a, 'Full Shade Bed', 'shade')

    with patch.object(
        utilities_module,
        'validate_planting_for_property',
        side_effect=_recording_validator([]),
    ):
        response = auth_client_a.post('/api/validate-plants-batch', json={
            'plantIds': ['corn-1'],
            'plantingDate': '2026-07-15',
            'bedId': bed.id,
        })

    assert response.status_code == 200
    payload = response.get_json()

    for method in ('seed', 'transplant'):
        warnings = payload['results']['corn-1'][method]['warnings']
        sun_warnings = [
            warning for warning in warnings
            if warning['type'] == 'sun_exposure_mismatch'
        ]
        assert len(sun_warnings) == 1
        assert sun_warnings[0]['severity'] == 'warning'
        assert 'requires full sun' in sun_warnings[0]['message']


def test_validate_plants_batch_skips_sun_warning_for_compatible_full_sun_bed(
    auth_client_a,
    full_db,
    user_a,
):
    bed = _bed(full_db, user_a, 'Full Sun Bed', 'full')

    with patch.object(
        utilities_module,
        'validate_planting_for_property',
        side_effect=_recording_validator([]),
    ):
        response = auth_client_a.post('/api/validate-plants-batch', json={
            'plantIds': ['corn-1'],
            'plantingDate': '2026-07-15',
            'bedId': bed.id,
        })

    assert response.status_code == 200
    payload = response.get_json()

    for method in ('seed', 'transplant'):
        warning_types = [
            warning['type']
            for warning in payload['results']['corn-1'][method]['warnings']
        ]
        assert 'sun_exposure_mismatch' not in warning_types