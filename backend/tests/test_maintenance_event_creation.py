"""HTTP tests for creating non-planting maintenance calendar events."""

import json

from models import GardenBed, PlantingEvent


def _create_bed(session, user, name='Kitchen Bed'):
    bed = GardenBed(
        user_id=user.id,
        name=name,
        width=4.0,
        length=8.0,
    )
    session.add(bed)
    session.commit()
    return bed


def test_create_fertilizing_event_persists_typed_details(full_app, full_db, user_a, auth_client_a):
    with full_app.app_context():
        bed = _create_bed(full_db.session, user_a)

        response = auth_client_a.post('/api/planting-events', json={
            'eventType': 'fertilizing',
            'gardenBedId': bed.id,
            'applicationDate': '2026-05-15',
            'fertilizerType': 'fish-emulsion',
            'amount': 2,
            'amountUnit': 'tbsp',
            'applicationMethod': 'soil-drench',
            'npk': '5-1-1',
            'notes': 'Weekly feeding',
        })

        assert response.status_code == 201
        body = response.get_json()
        assert body['eventType'] == 'fertilizing'
        assert body['plantId'] == 'fertilizing-event'
        assert body['gardenBedId'] == bed.id
        assert body['expectedHarvestDate'].startswith('2026-05-15')
        assert body['notes'] == 'Weekly feeding'

        details = json.loads(body['eventDetails'])
        assert details == {
            'fertilizer_type': 'fish-emulsion',
            'amount': 2,
            'amount_unit': 'tbsp',
            'application_method': 'soil-drench',
            'npk': '5-1-1',
        }

        event = PlantingEvent.query.get(body['id'])
        assert event is not None
        assert event.event_type == 'fertilizing'


def test_create_fertilizing_event_rejects_invalid_details(
    full_app, full_db, user_a, auth_client_a
):
    with full_app.app_context():
        bed = _create_bed(full_db.session, user_a)

        response = auth_client_a.post('/api/planting-events', json={
            'eventType': 'fertilizing',
            'gardenBedId': bed.id,
            'applicationDate': '2026-05-15',
            'fertilizerType': 'compost',
            'amount': 0,
            'amountUnit': 'lb',
            'applicationMethod': 'top-dress',
        })

        assert response.status_code == 400
        body = response.get_json()
        assert body['error'] == 'Invalid fertilizing event details'
        assert any('amount' in err for err in body['details'])


def test_create_irrigation_event_persists_typed_details(full_app, full_db, user_a, auth_client_a):
    with full_app.app_context():
        bed = _create_bed(full_db.session, user_a)

        response = auth_client_a.post('/api/planting-events', json={
            'eventType': 'irrigation',
            'gardenBedId': bed.id,
            'applicationDate': '2026-06-01',
            'method': 'soaker-hose',
            'durationMinutes': 45,
            'amountGallons': 12.5,
            'zone': 'Valve 2',
            'notes': 'Deep soak after transplanting',
        })

        assert response.status_code == 201
        body = response.get_json()
        assert body['eventType'] == 'irrigation'
        assert body['plantId'] == 'irrigation-event'
        assert body['expectedHarvestDate'].startswith('2026-06-01')

        details = json.loads(body['eventDetails'])
        assert details == {
            'method': 'soaker-hose',
            'duration_minutes': 45,
            'amount_gallons': 12.5,
            'zone': 'Valve 2',
        }


def test_create_irrigation_event_rejects_invalid_details(full_app, full_db, user_a, auth_client_a):
    with full_app.app_context():
        bed = _create_bed(full_db.session, user_a)

        response = auth_client_a.post('/api/planting-events', json={
            'eventType': 'irrigation',
            'gardenBedId': bed.id,
            'applicationDate': '2026-06-01',
            'method': 'drip',
            'durationMinutes': 0,
        })

        assert response.status_code == 400
        body = response.get_json()
        assert body['error'] == 'Invalid irrigation event details'
        assert any('duration_minutes' in err for err in body['details'])


def test_create_custom_event_requires_explicit_custom_details(
    full_app, full_db, user_a, auth_client_a
):
    with full_app.app_context():
        bed = _create_bed(full_db.session, user_a)

        response = auth_client_a.post('/api/planting-events', json={
            'eventType': 'custom',
            'gardenBedId': bed.id,
            'eventDate': '2026-07-01',
            'eventDetails': {'label': 'Soil test', 'ph': 6.8},
        })

        assert response.status_code == 201
        body = response.get_json()
        assert body['eventType'] == 'custom'
        assert json.loads(body['eventDetails']) == {'label': 'Soil test', 'ph': 6.8}


def test_unknown_event_type_is_rejected(auth_client_a):
    response = auth_client_a.post('/api/planting-events', json={
        'eventType': 'soil-test',
        'eventDetails': {'ph': 6.8},
    })

    assert response.status_code == 400
    assert response.get_json()['error'] == 'Unsupported event type: soil-test'
