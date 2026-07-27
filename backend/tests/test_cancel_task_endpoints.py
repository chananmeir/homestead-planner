from datetime import datetime, timedelta

from models import db, GardenBed, IndoorSeedStart, PlantedItem, PlantingEvent


PLANT_ID = 'tomato-1'


def _make_bed(user, name='Test Bed'):
    bed = GardenBed(user_id=user.id, name=name, width=4.0, length=8.0)
    db.session.add(bed)
    db.session.commit()
    return bed


def _make_planted_item(user, bed=None, **overrides):
    if bed is None:
        bed = _make_bed(user)
    defaults = {
        'plant_id': PLANT_ID,
        'garden_bed_id': bed.id,
        'planted_date': datetime(2026, 4, 10),
        'position_x': 0,
        'position_y': 0,
        'quantity': 1,
        'status': 'planned',
    }
    defaults.update(overrides)
    item = PlantedItem(user_id=user.id, **defaults)
    db.session.add(item)
    db.session.commit()
    return item


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


def test_mark_failed_rejects_transplanted_seed_start(auth_client_a, user_a):
    seed_start = _make_seed_start(user_a, status='transplanted')

    response = auth_client_a.post(
        f'/api/indoor-seed-starts/{seed_start.id}/mark-failed',
        json={'cascade': 'abandon'},
    )

    assert response.status_code == 400
    assert response.get_json()['error'] == 'Seed start is already transplanted'
    db.session.refresh(seed_start)
    assert seed_start.status == 'transplanted'


def test_cancel_and_uncancel_planted_item(auth_client_a, user_a):
    item = _make_planted_item(user_a)
    bed_id = item.garden_bed_id
    event = _make_event(
        user_a,
        garden_bed_id=bed_id,
        position_x=item.position_x,
        position_y=item.position_y,
        direct_seed_date=item.planted_date,
        quantity=item.quantity,
        quantity_completed=item.quantity,
        completed=True,
    )

    response = auth_client_a.post(f'/api/planted-items/{item.id}/cancel')

    assert response.status_code == 200, response.get_json()
    assert response.get_json()['cancelledAt'] is not None
    db.session.refresh(item)
    db.session.refresh(event)
    assert item.cancelled_at is not None
    assert event.cancelled_at == item.cancelled_at

    # Cancelled item must be filtered from bed.to_dict()
    bed_response = auth_client_a.get('/api/garden-beds')
    assert bed_response.status_code == 200
    beds = bed_response.get_json()
    target_bed = next((b for b in beds if b['id'] == bed_id), None)
    assert target_bed is not None
    assert [pi['id'] for pi in target_bed.get('plantedItems', [])] == []

    response = auth_client_a.post(f'/api/planted-items/{item.id}/uncancel')

    assert response.status_code == 200, response.get_json()
    assert response.get_json()['cancelledAt'] is None
    db.session.refresh(item)
    db.session.refresh(event)
    assert item.cancelled_at is None
    assert event.cancelled_at is None

    # Uncancelled item reappears in bed.to_dict()
    bed_response = auth_client_a.get('/api/garden-beds')
    target_bed = next((b for b in bed_response.get_json() if b['id'] == bed_id), None)
    assert [pi['id'] for pi in target_bed['plantedItems']] == [item.id]


def test_cancel_planted_item_is_idempotent(auth_client_a, user_a):
    item = _make_planted_item(user_a)

    first = auth_client_a.post(f'/api/planted-items/{item.id}/cancel')
    assert first.status_code == 200
    first_ts = first.get_json()['cancelledAt']

    # Second call should not change the timestamp
    second = auth_client_a.post(f'/api/planted-items/{item.id}/cancel')
    assert second.status_code == 200
    assert second.get_json()['cancelledAt'] == first_ts


def test_cancel_planted_item_repairs_open_matching_event(auth_client_a, user_a):
    item = _make_planted_item(user_a)
    item.cancelled_at = datetime(2026, 5, 24, 11, 30, 45)
    event = _make_event(
        user_a,
        garden_bed_id=item.garden_bed_id,
        position_x=item.position_x,
        position_y=item.position_y,
        direct_seed_date=item.planted_date,
        quantity=item.quantity,
        quantity_completed=item.quantity,
        completed=True,
    )
    db.session.commit()

    response = auth_client_a.post(f'/api/planted-items/{item.id}/cancel')

    assert response.status_code == 200
    db.session.refresh(item)
    db.session.refresh(event)
    assert response.get_json()['cancelledAt'] == item.cancelled_at.isoformat()
    assert event.cancelled_at == item.cancelled_at


def test_cancel_planted_item_is_user_scoped(auth_client_a, user_b):
    item = _make_planted_item(user_b)

    response = auth_client_a.post(f'/api/planted-items/{item.id}/cancel')

    assert response.status_code == 404
    db.session.refresh(item)
    assert item.cancelled_at is None


def test_cancel_planted_item_hidden_from_garden_snapshot(auth_client_a, user_a):
    """Cancelled items must not appear in the date-aware garden snapshot."""
    item = _make_planted_item(
        user_a,
        planted_date=datetime(2026, 4, 1),
        harvest_date=datetime(2026, 8, 1),
        status='growing',
    )

    # Before cancel: item appears in snapshot
    response = auth_client_a.get('/api/garden-planner/garden-snapshot?date=2026-06-01')
    assert response.status_code == 200
    summary = response.get_json()['summary']
    assert summary['totalPlants'] == item.quantity

    # Cancel and re-query
    auth_client_a.post(f'/api/planted-items/{item.id}/cancel')
    response = auth_client_a.get('/api/garden-planner/garden-snapshot?date=2026-06-01')
    assert response.status_code == 200
    assert response.get_json()['summary']['totalPlants'] == 0


def test_cancelled_events_returned_with_include_cancelled_param(auth_client_a, user_a):
    """GET /api/planting-events hides skipped events by default but returns
    them (with cancelledAt set) when includeCancelled=true — the calendar's
    "Show skipped" toggle contract."""
    active = _make_event(user_a)
    skipped = _make_event(user_a)

    cancel_response = auth_client_a.post(f'/api/planting-events/{skipped.id}/cancel')
    assert cancel_response.status_code == 200

    # Default: skipped event hidden
    default_response = auth_client_a.get('/api/planting-events')
    assert default_response.status_code == 200
    default_ids = {e['id'] for e in default_response.get_json()}
    assert active.id in default_ids
    assert skipped.id not in default_ids

    # Opt-in: skipped event included, flagged via cancelledAt
    include_response = auth_client_a.get('/api/planting-events?includeCancelled=true')
    assert include_response.status_code == 200
    events_by_id = {e['id']: e for e in include_response.get_json()}
    assert active.id in events_by_id
    assert skipped.id in events_by_id
    assert events_by_id[skipped.id]['cancelledAt'] is not None
    assert events_by_id[active.id]['cancelledAt'] is None
