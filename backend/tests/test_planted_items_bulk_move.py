from datetime import datetime, timedelta

from models import db, GardenBed, PlantedItem, PlantingEvent


def _make_bed(user, name='Bulk Move Bed'):
    bed = GardenBed(
        user_id=user.id,
        name=name,
        width=4.0,
        length=4.0,
        grid_size=12,
    )
    db.session.add(bed)
    db.session.commit()
    return bed


def _make_item_with_event(user, bed, x, y, plant_id='tomato-1', variety='Roma'):
    start = datetime(2026, 6, 1)
    end = start + timedelta(days=70)
    item = PlantedItem(
        user_id=user.id,
        garden_bed_id=bed.id,
        plant_id=plant_id,
        variety=variety,
        planted_date=start,
        harvest_date=end,
        position_x=x,
        position_y=y,
        quantity=1,
        status='planned',
    )
    db.session.add(item)
    db.session.flush()
    event = PlantingEvent(
        user_id=user.id,
        garden_bed_id=bed.id,
        plant_id=plant_id,
        variety=variety,
        direct_seed_date=start,
        expected_harvest_date=end,
        position_x=x,
        position_y=y,
        quantity=1,
        completed=False,
        quantity_completed=0,
    )
    db.session.add(event)
    db.session.commit()
    return item, event


def test_bulk_move_updates_items_and_linked_events(auth_client_a, user_a):
    bed = _make_bed(user_a)
    item_a, event_a = _make_item_with_event(user_a, bed, 0, 0)
    item_b, event_b = _make_item_with_event(user_a, bed, 1, 0)

    resp = auth_client_a.post('/api/planted-items/bulk-move', json={
        'moves': [
            {'id': item_a.id, 'position': {'x': 0, 'y': 2}},
            {'id': item_b.id, 'position': {'x': 1, 'y': 2}},
        ],
    })

    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()['moved'] == 2

    db.session.refresh(item_a)
    db.session.refresh(item_b)
    db.session.refresh(event_a)
    db.session.refresh(event_b)
    assert (item_a.position_x, item_a.position_y) == (0, 2)
    assert (item_b.position_x, item_b.position_y) == (1, 2)
    assert (event_a.position_x, event_a.position_y) == (0, 2)
    assert (event_b.position_x, event_b.position_y) == (1, 2)


def test_bulk_move_conflict_rolls_back_all_items(auth_client_a, user_a):
    bed = _make_bed(user_a)
    item_a, event_a = _make_item_with_event(user_a, bed, 0, 0)
    item_b, event_b = _make_item_with_event(user_a, bed, 1, 0)
    _make_item_with_event(user_a, bed, 0, 2, variety='Blocker')

    resp = auth_client_a.post('/api/planted-items/bulk-move', json={
        'moves': [
            {'id': item_a.id, 'position': {'x': 0, 'y': 2}},
            {'id': item_b.id, 'position': {'x': 1, 'y': 2}},
        ],
    })

    assert resp.status_code == 409, resp.get_json()

    db.session.refresh(item_a)
    db.session.refresh(item_b)
    db.session.refresh(event_a)
    db.session.refresh(event_b)
    assert (item_a.position_x, item_a.position_y) == (0, 0)
    assert (item_b.position_x, item_b.position_y) == (1, 0)
    assert (event_a.position_x, event_a.position_y) == (0, 0)
    assert (event_b.position_x, event_b.position_y) == (1, 0)


def test_bulk_move_rejects_out_of_bounds_target(auth_client_a, user_a):
    bed = _make_bed(user_a)
    item, _event = _make_item_with_event(user_a, bed, 0, 0)

    resp = auth_client_a.post('/api/planted-items/bulk-move', json={
        'moves': [
            {'id': item.id, 'position': {'x': 4, 'y': 0}},
        ],
    })

    assert resp.status_code == 400, resp.get_json()
    assert 'outside the garden bed' in resp.get_json()['error']

    db.session.refresh(item)
    assert (item.position_x, item.position_y) == (0, 0)
