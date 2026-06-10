import json
from datetime import datetime

from models import (
    db,
    GardenBed,
    GardenPlan,
    GardenPlanItem,
    IndoorSeedStart,
    PlantedItem,
    PlantingEvent,
)


PLANT_ID = 'pepper-1'
VARIETY = 'Pimento Sweet'


def _make_bed(user, name='Garden Bed Five'):
    bed = GardenBed(user_id=user.id, name=name, width=4.0, length=8.0)
    db.session.add(bed)
    db.session.commit()
    return bed


def _make_item(user, bed, quantity, x, y, **overrides):
    defaults = {
        'plant_id': PLANT_ID,
        'variety': VARIETY,
        'garden_bed_id': bed.id,
        'planted_date': datetime(2026, 5, 15),
        'position_x': x,
        'position_y': y,
        'quantity': quantity,
        'status': 'transplanted',
    }
    defaults.update(overrides)
    item = PlantedItem(user_id=user.id, **defaults)
    db.session.add(item)
    db.session.commit()
    return item


def _make_event(user, bed, quantity, x, y):
    event = PlantingEvent(
        user_id=user.id,
        plant_id=PLANT_ID,
        variety=VARIETY,
        garden_bed_id=bed.id,
        transplant_date=datetime(2026, 5, 15),
        expected_harvest_date=datetime(2026, 8, 1),
        position_x=x,
        position_y=y,
        quantity=quantity,
        completed=True,
        quantity_completed=quantity,
    )
    db.session.add(event)
    db.session.commit()
    return event


def test_group_quantity_downward_correction_soft_cancels_surplus(
    auth_client_a, user_a
):
    bed = _make_bed(user_a)
    first_item = _make_item(user_a, bed, 4, 0, 6)
    second_item = _make_item(user_a, bed, 1, 2, 6)
    first_event = _make_event(user_a, bed, 4, 0, 6)
    second_event = _make_event(user_a, bed, 1, 2, 6)

    response = auth_client_a.patch(
        f'/api/garden-beds/{bed.id}/planted-item-groups/quantity',
        json={'plantId': PLANT_ID, 'variety': VARIETY, 'quantity': 3},
    )

    assert response.status_code == 200, response.get_json()
    body = response.get_json()
    assert body['previousQuantity'] == 5
    assert body['quantity'] == 3
    assert body['removedQuantity'] == 2
    assert second_item.id in body['cancelledItemIds']

    db.session.expire_all()
    first_item = db.session.get(PlantedItem, first_item.id)
    second_item = db.session.get(PlantedItem, second_item.id)
    first_event = db.session.get(PlantingEvent, first_event.id)
    second_event = db.session.get(PlantingEvent, second_event.id)

    assert first_item.quantity == 3
    assert first_item.cancelled_at is None
    assert second_item.cancelled_at is not None
    assert first_event.quantity == 3
    assert first_event.quantity_completed == 3
    assert first_event.cancelled_at is None
    assert second_event.cancelled_at is not None

    beds_response = auth_client_a.get('/api/garden-beds')
    assert beds_response.status_code == 200
    returned_bed = next(b for b in beds_response.get_json() if b['id'] == bed.id)
    returned_items = returned_bed['plantedItems']
    assert [item['id'] for item in returned_items] == [first_item.id]
    assert returned_items[0]['quantity'] == 3


def test_group_quantity_endpoint_rejects_increases(auth_client_a, user_a):
    bed = _make_bed(user_a)
    _make_item(user_a, bed, 3, 0, 6)

    response = auth_client_a.patch(
        f'/api/garden-beds/{bed.id}/planted-item-groups/quantity',
        json={'plantId': PLANT_ID, 'variety': VARIETY, 'quantity': 4},
    )

    assert response.status_code == 400
    assert 'Increasing' in response.get_json()['error']


def test_indoor_seed_start_remaining_to_plant_uses_active_placed_count(
    auth_client_a, user_a
):
    bed = _make_bed(user_a)
    seed_start = IndoorSeedStart(
        user_id=user_a.id,
        plant_id=PLANT_ID,
        variety=VARIETY,
        start_date=datetime(2026, 3, 1),
        expected_transplant_date=datetime(2026, 5, 15),
        seeds_started=20,
        seeds_germinated=15,
        status='growing',
        destination_bed_ids=json.dumps([bed.id]),
    )
    db.session.add(seed_start)
    db.session.commit()

    _make_item(user_a, bed, 3, 0, 6)
    _make_item(
        user_a,
        bed,
        2,
        2,
        6,
        cancelled_at=datetime(2026, 5, 20),
    )

    response = auth_client_a.get('/api/indoor-seed-starts')

    assert response.status_code == 200
    [payload] = response.get_json()
    assert payload['placedCount'] == 3
    assert payload['remainingToPlant'] == 12


def test_season_progress_ignores_cancelled_planted_items(auth_client_a, user_a):
    bed = _make_bed(user_a)
    plan = GardenPlan(user_id=user_a.id, name='2026 Plan', year=2026)
    db.session.add(plan)
    db.session.flush()
    plan_item = GardenPlanItem(
        garden_plan_id=plan.id,
        plant_id=PLANT_ID,
        variety=VARIETY,
        target_value=5,
        plant_equivalent=5,
        beds_allocated=json.dumps([bed.id]),
        bed_assignments=json.dumps([{'bedId': bed.id, 'quantity': 5}]),
    )
    db.session.add(plan_item)
    db.session.commit()

    _make_item(user_a, bed, 3, 0, 6, source_plan_item_id=plan_item.id)
    _make_item(
        user_a,
        bed,
        2,
        2,
        6,
        source_plan_item_id=plan_item.id,
        cancelled_at=datetime(2026, 5, 20),
    )

    response = auth_client_a.get('/api/garden-planner/season-progress?year=2026')

    assert response.status_code == 200, response.get_json()
    body = response.get_json()
    assert body['summary']['totalPlanned'] == 5
    assert body['summary']['totalAdded'] == 3
    assert body['summary']['totalRemaining'] == 2
    progress = body['byPlanItemId'][str(plan_item.id)]
    assert progress['placedSeason'] == 3
    assert progress['placedByBed'][str(bed.id)] == 3
