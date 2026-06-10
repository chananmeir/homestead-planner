from datetime import datetime, timedelta

from models import db, GardenBed, GardenPlan, GardenPlanItem, IndoorSeedStart, PlantingEvent


PLANT_ID = 'tomato-1'


def _make_plan(user, name='Bulk Delete Plan'):
    plan = GardenPlan(user_id=user.id, name=name, year=2027)
    db.session.add(plan)
    db.session.flush()
    return plan


def _make_plan_item(plan, status='exported', source=None, indoor_seed_start_id=None):
    item = GardenPlanItem(
        garden_plan_id=plan.id,
        plant_id=PLANT_ID,
        target_value=4,
        plant_equivalent=4,
        status=status,
        source=source,
        indoor_seed_start_id=indoor_seed_start_id,
    )
    db.session.add(item)
    db.session.flush()
    return item


def _make_event(user, plan_item=None, transplant_date=None):
    if transplant_date is None:
        transplant_date = datetime(2027, 5, 15)
    export_key = None
    if plan_item is not None:
        export_key = "{}_{}_{}_0".format(
            user.id,
            plan_item.id,
            transplant_date.date().isoformat(),
        )
    event = PlantingEvent(
        user_id=user.id,
        plant_id=PLANT_ID,
        transplant_date=transplant_date,
        expected_harvest_date=transplant_date + timedelta(days=70),
        quantity=4,
        export_key=export_key,
    )
    db.session.add(event)
    db.session.flush()
    return event


def _make_seed_start(user, event):
    seed_start = IndoorSeedStart(
        user_id=user.id,
        plant_id=PLANT_ID,
        start_date=datetime(2027, 4, 1),
        expected_transplant_date=event.transplant_date,
        seeds_started=4,
        status='planned',
        planting_event_id=event.id,
    )
    db.session.add(seed_start)
    db.session.flush()
    return seed_start


def _make_bed(user):
    bed = GardenBed(
        user_id=user.id,
        name='Assigned Bed',
        width=4,
        length=8,
    )
    db.session.add(bed)
    db.session.flush()
    return bed


def test_bulk_delete_requires_typed_confirmation(auth_client_a, user_a):
    event = _make_event(user_a)
    db.session.commit()

    response = auth_client_a.post(
        '/api/planting-events/bulk-delete',
        json={'eventIds': [event.id]},
    )

    assert response.status_code == 400
    assert db.session.get(PlantingEvent, event.id) is not None


def test_bulk_delete_removes_events_related_seed_starts_and_resets_plan_item(auth_client_a, user_a):
    plan = _make_plan(user_a)
    plan_item = _make_plan_item(plan)
    event_one = _make_event(user_a, plan_item=plan_item, transplant_date=datetime(2027, 5, 15))
    event_two = _make_event(user_a, plan_item=plan_item, transplant_date=datetime(2027, 5, 29))
    seed_start = _make_seed_start(user_a, event_one)
    auto_item = _make_plan_item(
        plan,
        status='planned',
        source='indoor-seed-start',
        indoor_seed_start_id=seed_start.id,
    )
    db.session.commit()

    response = auth_client_a.post(
        '/api/planting-events/bulk-delete',
        json={
            'eventIds': [event_one.id, event_two.id],
            'confirmation': 'delete',
        },
    )

    assert response.status_code == 200, response.get_json()
    assert response.get_json() == {
        'deleted': 2,
        'deletedEventIds': [event_one.id, event_two.id],
        'deletedIndoorSeedStarts': 1,
        'deletedAutoPlanItems': 1,
        'planItemsReset': 1,
    }
    assert db.session.get(PlantingEvent, event_one.id) is None
    assert db.session.get(PlantingEvent, event_two.id) is None
    assert db.session.get(IndoorSeedStart, seed_start.id) is None
    assert db.session.get(GardenPlanItem, auto_item.id) is None
    assert db.session.get(GardenPlanItem, plan_item.id).status == 'planned'


def test_bulk_delete_is_all_or_nothing_when_an_event_is_not_owned(auth_client_a, user_a, user_b):
    owned_event = _make_event(user_a)
    other_event = _make_event(user_b)
    db.session.commit()

    response = auth_client_a.post(
        '/api/planting-events/bulk-delete',
        json={
            'eventIds': [owned_event.id, other_event.id],
            'confirmation': 'delete',
        },
    )

    assert response.status_code == 404
    assert db.session.get(PlantingEvent, owned_event.id) is not None
    assert db.session.get(PlantingEvent, other_event.id) is not None


def test_unassigned_planned_cleanup_deletes_unassigned_events_and_seed_starts(auth_client_a, user_a):
    plan = _make_plan(user_a)
    standalone_event = _make_event(user_a)
    linked_event = _make_event(user_a, transplant_date=datetime(2027, 6, 1))
    seed_start = _make_seed_start(user_a, linked_event)
    auto_item = _make_plan_item(
        plan,
        status='planned',
        source='indoor-seed-start',
        indoor_seed_start_id=seed_start.id,
    )
    db.session.commit()

    response = auth_client_a.post(
        '/api/planned-items/unassigned/bulk-delete',
        json={
            'eventIds': [standalone_event.id],
            'seedStartIds': [seed_start.id],
            'confirmation': 'delete',
        },
    )

    assert response.status_code == 200, response.get_json()
    body = response.get_json()
    assert body['deletedPlantingEvents'] == 2
    assert body['deletedIndoorSeedStarts'] == 1
    assert body['deletedSeedStartIds'] == [seed_start.id]
    assert sorted(body['deletedEventIds']) == sorted([standalone_event.id, linked_event.id])
    assert db.session.get(PlantingEvent, standalone_event.id) is None
    assert db.session.get(PlantingEvent, linked_event.id) is None
    assert db.session.get(IndoorSeedStart, seed_start.id) is None
    assert db.session.get(GardenPlanItem, auto_item.id) is None


def test_unassigned_planned_cleanup_rejects_assigned_items_without_deleting(auth_client_a, user_a):
    bed = _make_bed(user_a)
    assigned_event = _make_event(user_a)
    assigned_event.garden_bed_id = bed.id
    unassigned_event = _make_event(user_a, transplant_date=datetime(2027, 6, 1))
    db.session.commit()

    response = auth_client_a.post(
        '/api/planned-items/unassigned/bulk-delete',
        json={
            'eventIds': [assigned_event.id, unassigned_event.id],
            'seedStartIds': [],
            'confirmation': 'delete',
        },
    )

    assert response.status_code == 400
    assert db.session.get(PlantingEvent, assigned_event.id) is not None
    assert db.session.get(PlantingEvent, unassigned_event.id) is not None


def test_unassigned_planned_cleanup_rejects_seed_start_with_existing_linked_bed(auth_client_a, user_a):
    bed = _make_bed(user_a)
    linked_event = _make_event(user_a)
    linked_event.garden_bed_id = bed.id
    seed_start = _make_seed_start(user_a, linked_event)
    db.session.commit()

    response = auth_client_a.post(
        '/api/planned-items/unassigned/bulk-delete',
        json={
            'eventIds': [],
            'seedStartIds': [seed_start.id],
            'confirmation': 'delete',
        },
    )

    assert response.status_code == 400
    assert db.session.get(PlantingEvent, linked_event.id) is not None
    assert db.session.get(IndoorSeedStart, seed_start.id) is not None


def test_unassigned_planned_cleanup_allows_seed_start_with_stale_linked_bed(auth_client_a, user_a):
    linked_event = _make_event(user_a)
    linked_event.garden_bed_id = 999999
    seed_start = _make_seed_start(user_a, linked_event)
    db.session.commit()

    response = auth_client_a.post(
        '/api/planned-items/unassigned/bulk-delete',
        json={
            'eventIds': [],
            'seedStartIds': [seed_start.id],
            'confirmation': 'delete',
        },
    )

    assert response.status_code == 200, response.get_json()
    assert db.session.get(PlantingEvent, linked_event.id) is None
    assert db.session.get(IndoorSeedStart, seed_start.id) is None
