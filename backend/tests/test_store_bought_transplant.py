from datetime import datetime

from models import db, GardenBed, IndoorSeedStart, PlantedItem, PlantingEvent


def _make_bed(user, name='Store Bought Bed'):
    bed = GardenBed(user_id=user.id, name=name, width=4.0, length=8.0)
    db.session.add(bed)
    db.session.commit()
    return bed


def _make_transplant_event(user, bed, **overrides):
    defaults = {
        'event_type': 'planting',
        'plant_id': 'tomato-1',
        'variety': 'Roma',
        'garden_bed_id': bed.id,
        'transplant_date': datetime(2026, 4, 14),
        'expected_harvest_date': datetime(2026, 7, 1),
        'quantity': 4,
        'position_x': 1,
        'position_y': 2,
    }
    defaults.update(overrides)
    event = PlantingEvent(user_id=user.id, **defaults)
    db.session.add(event)
    db.session.commit()
    return event


def test_store_bought_transplant_creates_item_and_completes_event(auth_client_a, user_a):
    bed = _make_bed(user_a)
    event = _make_transplant_event(user_a, bed)

    response = auth_client_a.post(
        f'/api/planting-events/{event.id}/store-bought-transplant',
        json={
            'quantity': 5,
            'transplantDate': '2026-04-15',
            'gardenBedId': bed.id,
            'position': {'x': 3, 'y': 4},
        },
    )

    assert response.status_code == 201, response.get_json()
    body = response.get_json()
    assert body['created'] is True
    assert body['plantingEvent']['transplantSource'] == 'store_bought'
    assert body['plantedItem']['status'] == 'transplanted'

    db.session.refresh(event)
    assert event.transplant_source == 'store_bought'
    assert event.completed is True
    assert event.quantity == 5
    assert event.quantity_completed == 5
    assert event.transplant_date == datetime(2026, 4, 15)
    assert (event.position_x, event.position_y) == (3, 4)

    items = PlantedItem.query.filter_by(user_id=user_a.id).all()
    assert len(items) == 1
    item = items[0]
    assert item.plant_id == 'tomato-1'
    assert item.variety == 'Roma'
    assert item.garden_bed_id == bed.id
    assert item.quantity == 5
    assert item.status == 'transplanted'
    assert item.transplant_date == datetime(2026, 4, 15)
    assert (item.position_x, item.position_y) == (3, 4)

    event_response = auth_client_a.get(f'/api/planting-events/{event.id}')
    assert event_response.status_code == 200
    assert event_response.get_json()['transplantSource'] == 'store_bought'

    dashboard_response = auth_client_a.get('/api/dashboard/today?date=2026-04-16')
    assert dashboard_response.status_code == 200
    assert dashboard_response.get_json()['signals']['transplantsDue'] == []


def test_store_bought_transplant_retry_does_not_duplicate_item(auth_client_a, user_a):
    bed = _make_bed(user_a)
    event = _make_transplant_event(user_a, bed)
    url = f'/api/planting-events/{event.id}/store-bought-transplant'

    first = auth_client_a.post(url, json={'gardenBedId': bed.id})
    second = auth_client_a.post(url, json={'gardenBedId': bed.id})

    assert first.status_code == 201, first.get_json()
    assert second.status_code == 200, second.get_json()
    assert second.get_json()['created'] is False
    assert PlantedItem.query.filter_by(user_id=user_a.id).count() == 1


def test_store_bought_transplant_rejects_linked_seed_start(auth_client_a, user_a):
    bed = _make_bed(user_a)
    event = _make_transplant_event(user_a, bed)
    seed_start = IndoorSeedStart(
        user_id=user_a.id,
        plant_id='tomato-1',
        variety='Roma',
        start_date=datetime(2026, 3, 1),
        expected_transplant_date=datetime(2026, 4, 14),
        seeds_started=4,
        status='growing',
        planting_event_id=event.id,
    )
    db.session.add(seed_start)
    db.session.commit()

    response = auth_client_a.post(
        f'/api/planting-events/{event.id}/store-bought-transplant',
        json={'gardenBedId': bed.id},
    )

    assert response.status_code == 409
    assert response.get_json()['error'] == 'This transplant is linked to an indoor seed start'
    db.session.refresh(event)
    assert event.transplant_source is None
    assert event.completed is False
    assert PlantedItem.query.filter_by(user_id=user_a.id).count() == 0
