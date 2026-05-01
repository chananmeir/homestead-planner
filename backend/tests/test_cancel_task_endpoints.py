from datetime import datetime, timedelta

from models import db, IndoorSeedStart, PlantingEvent


PLANT_ID = 'tomato-1'


def _make_event(user, **overrides):
    start = datetime(2026, 4, 10)
    defaults = {
        'event_type': 'planting',
        'plant_id': PLANT_ID,
        'quantity': 4,
        'direct_seed_date': start,
        'expected_harvest_date': start + timedelta(days=70),
    }
    defaults.update(overrides)
    event = PlantingEvent(user_id=user.id, **defaults)
    db.session.add(event)
    db.session.commit()
    return event


def _make_seed_start(user, **overrides):
    defaults = {
        'plant_id': PLANT_ID,
        'start_date': datetime(2026, 3, 1),
        'expected_transplant_date': datetime(2026, 5, 1),
        'seeds_started': 8,
        'status': 'planned',
    }
    defaults.update(overrides)
    seed_start = IndoorSeedStart(user_id=user.id, **defaults)
    db.session.add(seed_start)
    db.session.commit()
    return seed_start


def test_cancel_and_uncancel_planting_event(auth_client_a, user_a):
    event = _make_event(user_a)

    response = auth_client_a.post(f'/api/planting-events/{event.id}/cancel')

    assert response.status_code == 200, response.get_json()
    assert response.get_json()['cancelledAt'] is not None
    db.session.refresh(event)
    assert event.cancelled_at is not None

    list_response = auth_client_a.get('/api/planting-events')
    assert list_response.status_code == 200
    assert [row['id'] for row in list_response.get_json()] == []

    response = auth_client_a.post(f'/api/planting-events/{event.id}/uncancel')

    assert response.status_code == 200, response.get_json()
    assert response.get_json()['cancelledAt'] is None
    db.session.refresh(event)
    assert event.cancelled_at is None

    list_response = auth_client_a.get('/api/planting-events')
    assert [row['id'] for row in list_response.get_json()] == [event.id]


def test_cancel_planting_event_is_user_scoped(auth_client_a, user_b):
    event = _make_event(user_b)

    response = auth_client_a.post(f'/api/planting-events/{event.id}/cancel')

    assert response.status_code == 404
    db.session.refresh(event)
    assert event.cancelled_at is None


def test_cancel_and_uncancel_indoor_seed_start(auth_client_a, user_a):
    seed_start = _make_seed_start(user_a)

    response = auth_client_a.post(f'/api/indoor-seed-starts/{seed_start.id}/cancel')

    assert response.status_code == 200, response.get_json()
    assert response.get_json()['cancelledAt'] is not None
    db.session.refresh(seed_start)
    assert seed_start.cancelled_at is not None

    list_response = auth_client_a.get('/api/indoor-seed-starts')
    assert list_response.status_code == 200
    assert [row['id'] for row in list_response.get_json()] == []

    response = auth_client_a.post(f'/api/indoor-seed-starts/{seed_start.id}/uncancel')

    assert response.status_code == 200, response.get_json()
    assert response.get_json()['cancelledAt'] is None
    db.session.refresh(seed_start)
    assert seed_start.cancelled_at is None

    list_response = auth_client_a.get('/api/indoor-seed-starts')
    assert [row['id'] for row in list_response.get_json()] == [seed_start.id]


def test_cancel_indoor_seed_start_is_user_scoped(auth_client_a, user_b):
    seed_start = _make_seed_start(user_b)

    response = auth_client_a.post(f'/api/indoor-seed-starts/{seed_start.id}/cancel')

    assert response.status_code == 404
    db.session.refresh(seed_start)
    assert seed_start.cancelled_at is None
