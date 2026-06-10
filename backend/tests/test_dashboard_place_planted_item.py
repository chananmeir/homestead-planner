"""Tests for the place_planted_item dashboard signal.

Surfaces past-due `planned` PlantedItems (drag-and-dropped placements whose
planted_date has arrived without the user confirming the seeding). Mirrors the
direct-seed / transplant signal pattern in `dashboard_service.py`.
"""
# [UNUSED-2026-06-10] timedelta unused.
# from datetime import datetime, timedelta
from datetime import datetime

from models import db, GardenBed, PlantedItem
from services.dashboard_service import _build_place_planted_item


PLANT_ID = 'lettuce-1'


def _bed(user, name='Bed One'):
    bed = GardenBed(user_id=user.id, name=name, width=4.0, length=8.0)
    db.session.add(bed)
    db.session.commit()
    return bed


def _item(user, bed, planted_date, status='planned', cancelled_at=None, **overrides):
    defaults = {
        'plant_id': PLANT_ID,
        'garden_bed_id': bed.id,
        'planted_date': planted_date,
        'position_x': 0,
        'position_y': 0,
        'quantity': 4,
        'status': status,
        'cancelled_at': cancelled_at,
    }
    defaults.update(overrides)
    item = PlantedItem(user_id=user.id, **defaults)
    db.session.add(item)
    db.session.commit()
    return item


def test_planned_item_with_today_planted_date_appears_in_active(auth_client_a, user_a):
    today = datetime(2026, 5, 13).date()
    bed = _bed(user_a)
    item = _item(user_a, bed, planted_date=datetime(2026, 5, 13))

    result = _build_place_planted_item(user_a.id, today)

    assert len(result['active']) == 1
    row = result['active'][0]
    assert row['plantedItemId'] == item.id
    assert row['signalKey'] == f'place-planted-{item.id}'
    assert row['bedId'] == bed.id
    assert row['bedName'] == 'Bed One'
    assert row['plantedDate'] == '2026-05-13'
    assert result['missed'] == []


def test_planned_item_overdue_within_14d_stays_active(auth_client_a, user_a):
    today = datetime(2026, 5, 13).date()
    bed = _bed(user_a)
    item = _item(user_a, bed, planted_date=datetime(2026, 5, 1))  # 12 days overdue

    result = _build_place_planted_item(user_a.id, today)

    assert len(result['active']) == 1
    assert result['active'][0]['plantedItemId'] == item.id
    assert result['missed'] == []


def test_planned_item_overdue_past_14d_moves_to_missed(auth_client_a, user_a):
    today = datetime(2026, 5, 13).date()
    bed = _bed(user_a)
    item = _item(user_a, bed, planted_date=datetime(2026, 4, 15))  # 28 days overdue

    result = _build_place_planted_item(user_a.id, today)

    assert result['active'] == []
    assert len(result['missed']) == 1
    assert result['missed'][0]['plantedItemId'] == item.id


def test_future_planted_date_not_surfaced(auth_client_a, user_a):
    today = datetime(2026, 5, 13).date()
    bed = _bed(user_a)
    _item(user_a, bed, planted_date=datetime(2026, 7, 1))  # future

    result = _build_place_planted_item(user_a.id, today)

    assert result == {'active': [], 'missed': []}


def test_non_planned_status_not_surfaced(auth_client_a, user_a):
    """Items already progressed past `planned` are handled by other signals."""
    today = datetime(2026, 5, 13).date()
    bed = _bed(user_a)
    for status in ('seeded', 'transplanted', 'growing', 'harvested', 'saving-seed'):
        _item(user_a, bed, planted_date=datetime(2026, 5, 1), status=status)

    result = _build_place_planted_item(user_a.id, today)

    assert result == {'active': [], 'missed': []}


def test_cancelled_item_not_surfaced(auth_client_a, user_a):
    today = datetime(2026, 5, 13).date()
    bed = _bed(user_a)
    _item(
        user_a, bed,
        planted_date=datetime(2026, 5, 1),
        cancelled_at=datetime(2026, 5, 2),
    )

    result = _build_place_planted_item(user_a.id, today)

    assert result == {'active': [], 'missed': []}


def test_user_scoping(auth_client_a, user_a, user_b):
    today = datetime(2026, 5, 13).date()
    bed_a = _bed(user_a, 'Alice Bed')
    bed_b = _bed(user_b, 'Bob Bed')
    item_a = _item(user_a, bed_a, planted_date=datetime(2026, 5, 13))
    _item(user_b, bed_b, planted_date=datetime(2026, 5, 13))

    result = _build_place_planted_item(user_a.id, today)

    assert len(result['active']) == 1
    assert result['active'][0]['plantedItemId'] == item_a.id


def test_dashboard_endpoint_includes_place_planted_item(auth_client_a, user_a):
    """Smoke test that the new signal appears in the dashboard payload."""
    bed = _bed(user_a)
    _item(user_a, bed, planted_date=datetime(2026, 5, 13))

    response = auth_client_a.get('/api/dashboard/today?date=2026-05-13')

    assert response.status_code == 200
    payload = response.get_json()
    assert 'placePlantedItem' in payload['signals']
    assert len(payload['signals']['placePlantedItem']) == 1
    assert payload['signals']['placePlantedItem'][0]['plantName'] == 'Lettuce'
    assert 'placePlantedItem' in payload['missed']
