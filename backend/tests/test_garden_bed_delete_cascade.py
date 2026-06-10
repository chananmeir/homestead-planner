import json
from datetime import datetime

from models import (
    db,
    GardenBed,
    GardenPlan,
    GardenPlanItem,
    HarvestRecord,
    IndoorSeedStart,
    Photo,
    PlacedStructure,
    PlantingEvent,
    PlantedItem,
    Property,
    SeedInventory,
    TrellisStructure,
)


def _make_bed(user, name):
    bed = GardenBed(user_id=user.id, name=name, width=4.0, length=8.0)
    db.session.add(bed)
    db.session.flush()
    return bed


def test_delete_bed_requires_typed_confirmation(auth_client_a, user_a):
    bed = _make_bed(user_a, 'Extra Bed')
    bed_id = bed.id
    db.session.commit()

    response = auth_client_a.delete(f'/api/garden-beds/{bed_id}')

    assert response.status_code == 400
    assert response.get_json()['requiredConfirmation'] == 'delete'
    assert db.session.get(GardenBed, bed_id) is not None


def test_delete_bed_removes_attached_records_and_plan_references(auth_client_a, user_a):
    bed_to_delete = _make_bed(user_a, 'Mistake Bed')
    bed_to_keep = _make_bed(user_a, 'Keeper Bed')

    property_record = Property(
        user_id=user_a.id,
        name='Main Property',
        width=100.0,
        length=100.0,
    )
    db.session.add(property_record)
    db.session.flush()

    placed_structure = PlacedStructure(
        user_id=user_a.id,
        property_id=property_record.id,
        structure_id=f'garden-bed-{bed_to_delete.id}',
        garden_bed_id=bed_to_delete.id,
        name='Mistake Bed',
        position_x=10.0,
        position_y=10.0,
    )
    trellis = TrellisStructure(
        user_id=user_a.id,
        garden_bed_id=bed_to_delete.id,
        name='Mistake Bed Trellis',
        start_x=0.0,
        start_y=0.0,
        end_x=6.0,
        end_y=0.0,
        total_length_feet=6.0,
        total_length_inches=72.0,
    )
    db.session.add_all([placed_structure, trellis])
    db.session.flush()

    plan = GardenPlan(
        user_id=user_a.id,
        name='Overbuilt Plan',
        season='year-round',
        year=2026,
    )
    db.session.add(plan)
    db.session.flush()

    mixed_plan_item = GardenPlanItem(
        garden_plan_id=plan.id,
        plant_id='tomato-1',
        variety='Roma',
        target_value=8.0,
        plant_equivalent=8,
        seeds_required=13,
        bed_assignments=json.dumps([
            {'bedId': bed_to_delete.id, 'quantity': 5},
            {'bedId': bed_to_keep.id, 'quantity': 3},
        ]),
        beds_allocated=json.dumps([bed_to_delete.id, bed_to_keep.id]),
        trellis_assignments=json.dumps([trellis.id]),
    )
    delete_only_plan_item = GardenPlanItem(
        garden_plan_id=plan.id,
        plant_id='pepper-1',
        variety='Lunchbox',
        target_value=4.0,
        plant_equivalent=4,
        seeds_required=7,
        bed_assignments=json.dumps([
            {'bedId': bed_to_delete.id, 'quantity': 4},
        ]),
        beds_allocated=json.dumps([bed_to_delete.id]),
    )
    db.session.add_all([mixed_plan_item, delete_only_plan_item])

    planted_item = PlantedItem(
        user_id=user_a.id,
        plant_id='tomato-1',
        variety='Roma',
        garden_bed_id=bed_to_delete.id,
        position_x=1,
        position_y=1,
        quantity=5,
        source_plan_item_id=mixed_plan_item.id,
    )
    bed_event = PlantingEvent(
        user_id=user_a.id,
        plant_id='tomato-1',
        variety='Roma',
        garden_bed_id=bed_to_delete.id,
        quantity=5,
        transplant_date=datetime(2026, 5, 15),
    )
    trellis_event = PlantingEvent(
        user_id=user_a.id,
        plant_id='bean-1',
        variety='Pole',
        garden_bed_id=None,
        trellis_structure_id=trellis.id,
        quantity=2,
        direct_seed_date=datetime(2026, 5, 20),
    )
    db.session.add_all([planted_item, bed_event, trellis_event])
    db.session.flush()

    linked_seed_start = IndoorSeedStart(
        user_id=user_a.id,
        plant_id='tomato-1',
        variety='Roma',
        start_date=datetime(2026, 3, 1),
        expected_transplant_date=datetime(2026, 5, 15),
        seeds_started=6,
        planting_event_id=bed_event.id,
    )
    destination_seed_start = IndoorSeedStart(
        user_id=user_a.id,
        plant_id='pepper-1',
        variety='Lunchbox',
        start_date=datetime(2026, 3, 1),
        expected_transplant_date=datetime(2026, 5, 15),
        seeds_started=4,
        destination_bed_ids=json.dumps([bed_to_delete.id, bed_to_keep.id]),
    )
    only_deleted_bed_seed_start = IndoorSeedStart(
        user_id=user_a.id,
        plant_id='eggplant-1',
        variety='Black Beauty',
        start_date=datetime(2026, 3, 1),
        expected_transplant_date=datetime(2026, 5, 15),
        seeds_started=2,
        destination_bed_ids=json.dumps([bed_to_delete.id]),
    )
    db.session.add_all([
        linked_seed_start,
        destination_seed_start,
        only_deleted_bed_seed_start,
    ])
    db.session.flush()

    mixed_plan_item.indoor_seed_start_id = linked_seed_start.id
    harvest = HarvestRecord(
        user_id=user_a.id,
        plant_id='tomato-1',
        planted_item_id=planted_item.id,
        harvest_date=datetime(2026, 8, 1),
        quantity=2.5,
        unit='lbs',
    )
    photo = Photo(
        user_id=user_a.id,
        filename='missing-test-photo.jpg',
        filepath='/static/uploads/missing-test-photo.jpg',
        garden_bed_id=bed_to_delete.id,
        planted_item_id=planted_item.id,
        caption='Before cleanup',
        category='garden',
    )
    homegrown_seed = SeedInventory(
        user_id=user_a.id,
        plant_id='tomato-1',
        variety='Roma Saved',
        quantity=30,
        source_planted_item_id=planted_item.id,
        is_homegrown=True,
    )
    db.session.add_all([harvest, photo, homegrown_seed])
    db.session.flush()
    ids = {
        'bed_to_delete': bed_to_delete.id,
        'bed_to_keep': bed_to_keep.id,
        'planted_item': planted_item.id,
        'bed_event': bed_event.id,
        'trellis_event': trellis_event.id,
        'linked_seed_start': linked_seed_start.id,
        'destination_seed_start': destination_seed_start.id,
        'only_deleted_bed_seed_start': only_deleted_bed_seed_start.id,
        'harvest': harvest.id,
        'photo': photo.id,
        'placed_structure': placed_structure.id,
        'trellis': trellis.id,
        'mixed_plan_item': mixed_plan_item.id,
        'delete_only_plan_item': delete_only_plan_item.id,
        'homegrown_seed': homegrown_seed.id,
    }
    db.session.commit()

    response = auth_client_a.delete(
        f"/api/garden-beds/{ids['bed_to_delete']}",
        json={'confirmation': 'delete'},
    )

    assert response.status_code == 200
    counts = response.get_json()['counts']
    assert counts['plantedItemsDeleted'] == 1
    assert counts['plantingEventsDeleted'] == 2
    assert counts['indoorSeedStartsDeleted'] == 1
    assert counts['harvestRecordsDeleted'] == 1
    assert counts['photosDeleted'] == 1
    assert counts['placedStructuresDeleted'] == 1
    assert counts['trellisesDeleted'] == 1

    assert db.session.get(GardenBed, ids['bed_to_delete']) is None
    assert db.session.get(GardenBed, ids['bed_to_keep']) is not None
    assert db.session.get(PlantedItem, ids['planted_item']) is None
    assert db.session.get(PlantingEvent, ids['bed_event']) is None
    assert db.session.get(PlantingEvent, ids['trellis_event']) is None
    assert db.session.get(IndoorSeedStart, ids['linked_seed_start']) is None
    assert db.session.get(HarvestRecord, ids['harvest']) is None
    assert db.session.get(Photo, ids['photo']) is None
    assert db.session.get(PlacedStructure, ids['placed_structure']) is None
    assert db.session.get(TrellisStructure, ids['trellis']) is None

    updated_start = db.session.get(IndoorSeedStart, ids['destination_seed_start'])
    assert updated_start is not None
    assert json.loads(updated_start.destination_bed_ids) == [ids['bed_to_keep']]
    cleared_start = db.session.get(IndoorSeedStart, ids['only_deleted_bed_seed_start'])
    assert cleared_start is not None
    assert cleared_start.destination_bed_ids is None

    updated_plan_item = db.session.get(GardenPlanItem, ids['mixed_plan_item'])
    assert updated_plan_item is not None
    assert updated_plan_item.plant_equivalent == 3
    assert updated_plan_item.target_value == 3.0
    assert json.loads(updated_plan_item.bed_assignments) == [
        {'bedId': ids['bed_to_keep'], 'quantity': 3},
    ]
    assert json.loads(updated_plan_item.beds_allocated) == [ids['bed_to_keep']]
    assert updated_plan_item.trellis_assignments is None
    assert updated_plan_item.indoor_seed_start_id is None
    assert db.session.get(GardenPlanItem, ids['delete_only_plan_item']) is None

    saved_seed = db.session.get(SeedInventory, ids['homegrown_seed'])
    assert saved_seed is not None
    assert saved_seed.source_planted_item_id is None


def test_delete_bed_keeps_cross_user_guard_before_confirmation(auth_client_b, user_a):
    bed = _make_bed(user_a, 'Alice Bed')
    bed_id = bed.id
    db.session.commit()

    response = auth_client_b.delete(
        f'/api/garden-beds/{bed_id}',
        json={'confirmation': 'delete'},
    )

    assert response.status_code == 403
    assert db.session.get(GardenBed, bed_id) is not None
