from datetime import datetime, timedelta
import json

from models import (
    db,
    GardenBed,
    GardenPlan,
    GardenPlanItem,
    IndoorSeedStart,
    PlantedItem,
    PlantingEvent,
    SeedInventory,
)


PLANT_ID = 'watermelon-1'


def _make_seed(user, variety):
    seed = SeedInventory(
        user_id=user.id,
        plant_id=PLANT_ID,
        variety=variety,
        quantity=1,
    )
    db.session.add(seed)
    db.session.flush()
    return seed


def _make_plan(user, name='2026 Garden Plan'):
    plan = GardenPlan(user_id=user.id, name=name, year=2026)
    db.session.add(plan)
    db.session.flush()
    return plan


def _make_plan_item(plan, bed, variety, seed_inventory_id=None, indoor_seed_start_id=None):
    item = GardenPlanItem(
        garden_plan_id=plan.id,
        seed_inventory_id=seed_inventory_id,
        plant_id=PLANT_ID,
        variety=variety,
        unit_type='plants',
        target_value=12,
        plant_equivalent=12,
        bed_assignments=json.dumps([{'bedId': bed.id, 'quantity': 12}]),
        allocation_mode='custom',
        status='auto',
        source='indoor-seed-start' if indoor_seed_start_id else None,
        indoor_seed_start_id=indoor_seed_start_id,
    )
    db.session.add(item)
    db.session.flush()
    return item


def _make_planted_item(user, bed, plan_item, variety, planted_date, x=0, y=0):
    item = PlantedItem(
        user_id=user.id,
        plant_id=PLANT_ID,
        variety=variety,
        garden_bed_id=bed.id,
        planted_date=planted_date,
        harvest_date=planted_date + timedelta(days=85),
        position_x=x,
        position_y=y,
        quantity=1,
        status='planned',
        source_plan_item_id=plan_item.id if plan_item else None,
    )
    db.session.add(item)
    db.session.flush()
    return item


def _make_placement_event(user, bed, variety, transplant_date, x=0, y=0):
    event = PlantingEvent(
        user_id=user.id,
        plant_id=PLANT_ID,
        variety=variety,
        garden_bed_id=bed.id,
        transplant_date=transplant_date,
        expected_harvest_date=transplant_date + timedelta(days=85),
        position_x=x,
        position_y=y,
        quantity=1,
        completed=False,
        quantity_completed=0,
    )
    db.session.add(event)
    db.session.flush()
    return event


def test_indoor_seed_variety_update_syncs_linked_and_legacy_planned_placement(
    auth_client_a,
    user_a,
    full_db,
):
    bed = GardenBed(user_id=user_a.id, name='Permaculture Bed', width=4, length=8)
    other_bed = GardenBed(user_id=user_a.id, name='Other Bed', width=4, length=8)
    full_db.session.add_all([bed, other_bed])
    full_db.session.flush()

    old_seed = _make_seed(user_a, 'Dixie Queen')
    new_seed = _make_seed(user_a, 'Charleston Grey')
    transplant_date = datetime(2026, 5, 21)

    linked_event = PlantingEvent(
        user_id=user_a.id,
        plant_id=PLANT_ID,
        variety='Dixie Queen',
        garden_bed_id=other_bed.id,
        seed_start_date=datetime(2026, 4, 30),
        transplant_date=transplant_date,
        expected_harvest_date=transplant_date + timedelta(days=85),
        quantity=4,
        completed=False,
    )
    db.session.add(linked_event)
    db.session.flush()

    seed_start = IndoorSeedStart(
        user_id=user_a.id,
        plant_id=PLANT_ID,
        variety='Dixie Queen',
        seed_inventory_id=old_seed.id,
        start_date=datetime(2026, 4, 30),
        expected_transplant_date=transplant_date,
        seeds_started=12,
        status='seeded',
        destination_bed_ids=json.dumps([bed.id]),
        planting_event_id=linked_event.id,
    )
    db.session.add(seed_start)
    db.session.flush()

    linked_plan = _make_plan(user_a, 'Feed Family Plan')
    linked_plan_item = _make_plan_item(
        linked_plan,
        bed,
        'Dixie Queen',
        seed_inventory_id=old_seed.id,
        indoor_seed_start_id=seed_start.id,
    )

    legacy_plan = _make_plan(user_a, 'Designer Active Plan')
    legacy_plan_item = _make_plan_item(
        legacy_plan,
        bed,
        'Dixie Queen',
        seed_inventory_id=old_seed.id,
        indoor_seed_start_id=None,
    )
    legacy_placed = _make_planted_item(
        user_a,
        bed,
        legacy_plan_item,
        'Dixie Queen',
        transplant_date,
        x=2,
        y=4,
    )
    legacy_event = _make_placement_event(
        user_a,
        bed,
        'Dixie Queen',
        transplant_date,
        x=2,
        y=4,
    )

    unrelated_plan_item = _make_plan_item(
        legacy_plan,
        other_bed,
        'Dixie Queen',
        seed_inventory_id=old_seed.id,
        indoor_seed_start_id=None,
    )
    unrelated_placed = _make_planted_item(
        user_a,
        other_bed,
        unrelated_plan_item,
        'Dixie Queen',
        transplant_date,
        x=2,
        y=4,
    )
    unrelated_event = _make_placement_event(
        user_a,
        other_bed,
        'Dixie Queen',
        transplant_date,
        x=2,
        y=4,
    )

    db.session.commit()

    response = auth_client_a.put(
        f'/api/indoor-seed-starts/{seed_start.id}',
        json={
            'status': 'seeded',
            'variety': 'Charleston Grey',
            'seedInventoryId': new_seed.id,
            'startDate': '2026-04-30',
            'seedsStarted': 12,
            'seedsGerminated': 0,
            'destinationBedIds': [bed.id],
        },
    )

    assert response.status_code == 200, response.get_json()
    db.session.expire_all()

    assert db.session.get(IndoorSeedStart, seed_start.id).variety == 'Charleston Grey'
    assert db.session.get(PlantingEvent, linked_event.id).variety == 'Charleston Grey'

    refreshed_linked_plan_item = db.session.get(GardenPlanItem, linked_plan_item.id)
    assert refreshed_linked_plan_item.variety == 'Charleston Grey'
    assert refreshed_linked_plan_item.seed_inventory_id == new_seed.id

    refreshed_legacy_plan_item = db.session.get(GardenPlanItem, legacy_plan_item.id)
    assert refreshed_legacy_plan_item.variety == 'Charleston Grey'
    assert refreshed_legacy_plan_item.seed_inventory_id == new_seed.id
    assert refreshed_legacy_plan_item.source == 'indoor-seed-start'
    assert refreshed_legacy_plan_item.indoor_seed_start_id == seed_start.id

    assert db.session.get(PlantedItem, legacy_placed.id).variety == 'Charleston Grey'
    assert db.session.get(PlantingEvent, legacy_event.id).variety == 'Charleston Grey'

    assert db.session.get(PlantedItem, unrelated_placed.id).variety == 'Dixie Queen'
    assert db.session.get(PlantingEvent, unrelated_event.id).variety == 'Dixie Queen'


def test_designer_sync_links_plan_item_to_source_indoor_seed_start(
    auth_client_a,
    user_a,
    full_db,
):
    bed = GardenBed(user_id=user_a.id, name='Permaculture Bed', width=4, length=8)
    full_db.session.add(bed)
    full_db.session.flush()

    seed = _make_seed(user_a, 'Charleston Grey')
    seed_start = IndoorSeedStart(
        user_id=user_a.id,
        plant_id=PLANT_ID,
        variety='Charleston Grey',
        seed_inventory_id=seed.id,
        start_date=datetime(2026, 4, 30),
        expected_transplant_date=datetime(2026, 5, 21),
        seeds_started=12,
        status='seeded',
        destination_bed_ids=json.dumps([bed.id]),
    )
    db.session.add(seed_start)
    plan = _make_plan(user_a)
    db.session.commit()

    response = auth_client_a.post(
        f'/api/garden-plans/{plan.id}/designer-sync',
        json={
            'action': 'add',
            'plantId': PLANT_ID,
            'variety': 'Charleston Grey',
            'bedId': bed.id,
            'quantity': 12,
            'indoorSeedStartId': seed_start.id,
        },
    )

    assert response.status_code == 201, response.get_json()
    plan_item_id = response.get_json()['planItemId']

    plan_item = db.session.get(GardenPlanItem, plan_item_id)
    assert plan_item.source == 'indoor-seed-start'
    assert plan_item.indoor_seed_start_id == seed_start.id
    assert plan_item.seed_inventory_id == seed.id
