from datetime import datetime, timedelta

from models import db, GardenBed, PlantedItem, PlantingEvent


def _create_bed(user_id, width=4.0, length=4.0, method='square-foot'):
    bed = GardenBed(
        user_id=user_id,
        name='Guild Test Bed',
        width=width,
        length=length,
        planning_method=method,
        grid_size=12,
    )
    db.session.add(bed)
    db.session.commit()
    return bed


def test_validate_guild_returns_backend_layout(auth_client_a, user_a):
    bed = _create_bed(user_a.id)

    response = auth_client_a.post(
        '/api/guilds/tomato-basil-marigold/validate-placement',
        json={
            'gardenBedId': bed.id,
            'origin': {'x': 0, 'y': 0},
            'plantedDate': '2026-06-14',
        },
    )

    assert response.status_code == 200, response.data
    body = response.get_json()
    assert body['canInsert'] is True
    assert body['errors'] == []
    assert body['totalQuantity'] == 16
    assert len(body['placements']) == 10
    assert len({
        (placement['position']['x'], placement['position']['y'])
        for placement in body['placements']
    }) == len(body['placements'])
    assert any(
        placement['plantId'] == 'marigold-1' and placement['quantity'] == 4
        for placement in body['placements']
    )


def test_validate_guild_detects_out_of_bounds(auth_client_a, user_a):
    bed = _create_bed(user_a.id, width=2.0, length=2.0)

    response = auth_client_a.post(
        '/api/guilds/tomato-basil-marigold/validate-placement',
        json={
            'gardenBedId': bed.id,
            'origin': {'x': 0, 'y': 0},
            'plantedDate': '2026-06-14',
        },
    )

    assert response.status_code == 200, response.data
    body = response.get_json()
    assert body['canInsert'] is False
    assert any(error['code'] == 'guild_out_of_bounds' for error in body['errors'])


def test_validate_guild_rejects_invalid_date(auth_client_a, user_a):
    bed = _create_bed(user_a.id)

    response = auth_client_a.post(
        '/api/guilds/tomato-basil-marigold/validate-placement',
        json={
            'gardenBedId': bed.id,
            'origin': {'x': 0, 'y': 0},
            'plantedDate': 'not-a-date',
        },
    )

    assert response.status_code == 400
    assert response.get_json()['error'] == 'Invalid plantedDate'


def test_insert_guild_creates_items_and_events_atomically(auth_client_a, user_a):
    bed = _create_bed(user_a.id)

    response = auth_client_a.post(
        f'/api/garden-beds/{bed.id}/guilds/tomato-basil-marigold',
        json={
            'origin': {'x': 0, 'y': 0},
            'plantedDate': '2026-06-14',
        },
    )

    assert response.status_code == 201, response.data
    body = response.get_json()
    assert body['created'] == 10
    assert body['totalQuantity'] == 16
    assert len(body['items']) == 10
    assert PlantedItem.query.filter_by(garden_bed_id=bed.id).count() == 10
    assert PlantingEvent.query.filter_by(garden_bed_id=bed.id).count() == 10
    assert sum(
        item.quantity for item in PlantedItem.query.filter_by(garden_bed_id=bed.id).all()
    ) == 16


def test_insert_guild_conflict_rejects_and_rolls_back(auth_client_a, user_a):
    bed = _create_bed(user_a.id)
    existing = PlantedItem(
        user_id=user_a.id,
        plant_id='tomato-1',
        garden_bed_id=bed.id,
        planted_date=datetime(2026, 6, 1),
        harvest_date=datetime(2026, 6, 1) + timedelta(days=80),
        position_x=0,
        position_y=0,
        quantity=1,
        status='transplanted',
    )
    db.session.add(existing)
    db.session.commit()

    response = auth_client_a.post(
        f'/api/garden-beds/{bed.id}/guilds/tomato-basil-marigold',
        json={
            'origin': {'x': 0, 'y': 0},
            'plantedDate': '2026-06-14',
        },
    )

    assert response.status_code == 409, response.data
    body = response.get_json()
    assert body['error'] == 'Guild placement is not valid'
    assert any(
        error['code'] == 'planting_conflict'
        for error in body['validation']['errors']
    )
    assert PlantedItem.query.filter_by(garden_bed_id=bed.id).count() == 1
    assert PlantingEvent.query.filter_by(garden_bed_id=bed.id).count() == 0


def test_insert_guild_does_not_expose_other_users_bed(auth_client_b, user_a):
    bed = _create_bed(user_a.id)

    response = auth_client_b.post(
        f'/api/garden-beds/{bed.id}/guilds/tomato-basil-marigold',
        json={
            'origin': {'x': 0, 'y': 0},
            'plantedDate': '2026-06-14',
        },
    )

    assert response.status_code == 404
    assert response.get_json()['error'] == 'Garden bed not found'
