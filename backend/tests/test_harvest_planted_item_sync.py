"""
Tests for POST /api/harvests auto-sync behavior when plantedItemId is supplied.

Closes a coverage gap on harvests_bp.py:38-65 — the conditional block that
syncs harvested status to PlantedItem, linked PlantingEvent, and linked
IndoorSeedStart. Previously only exercised via e2e collect-seeds flow; no
unit-level tests covered the harvest endpoint itself.

Uses the full_app/auth_client_a fixtures from conftest.py.
"""

from datetime import datetime

from models import GardenBed, PlantedItem, PlantingEvent, IndoorSeedStart, HarvestRecord


def _create_bed(session, user, name='Test Bed'):
    bed = GardenBed(user_id=user.id, name=name, width=4.0, length=8.0)
    session.add(bed)
    session.commit()
    return bed


def _create_planted_item(session, user, bed, **overrides):
    defaults = dict(
        user_id=user.id,
        garden_bed_id=bed.id,
        plant_id='tomato-1',
        status='growing',
        position_x=2,
        position_y=3,
        quantity=1,
    )
    defaults.update(overrides)
    item = PlantedItem(**defaults)
    session.add(item)
    session.commit()
    return item


def _create_event(session, user, bed, **overrides):
    defaults = dict(
        user_id=user.id,
        garden_bed_id=bed.id,
        plant_id='tomato-1',
        event_type='planting',
        quantity=10,
        completed=False,
        quantity_completed=None,
        position_x=2,
        position_y=3,
    )
    defaults.update(overrides)
    event = PlantingEvent(**defaults)
    session.add(event)
    session.commit()
    return event


def _create_indoor_start(session, user, planting_event_id, **overrides):
    defaults = dict(
        user_id=user.id,
        plant_id='tomato-1',
        start_date=datetime(2026, 3, 1),
        seeds_started=10,
        status='seeded',
        planting_event_id=planting_event_id,
    )
    defaults.update(overrides)
    start = IndoorSeedStart(**defaults)
    session.add(start)
    session.commit()
    return start


class TestHarvestPlantedItemSync:
    """POST /api/harvests with plantedItemId triggers cross-model sync."""

    def test_sets_planted_item_to_harvested(self, full_app, full_db, user_a, auth_client_a):
        """PlantedItem.status flips to 'harvested' and harvest_date is set."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_planted_item(full_db.session, user_a, bed)
            item_id = item.id

            resp = auth_client_a.post('/api/harvests', json={
                'plantId': 'tomato-1',
                'plantedItemId': item_id,
                'harvestDate': '2026-05-04T00:00:00Z',
                'quantity': 3.5,
                'unit': 'lbs',
                'quality': 'good',
            })
            assert resp.status_code == 201

            refreshed = PlantedItem.query.get(item_id)
            assert refreshed.status == 'harvested'
            assert refreshed.harvest_date is not None

    def test_completes_linked_planting_event(self, full_app, full_db, user_a, auth_client_a):
        """Matching PlantingEvent (same bed, plant, position) gets completed=True."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_planted_item(full_db.session, user_a, bed,
                                        position_x=5, position_y=2)
            event = _create_event(full_db.session, user_a, bed,
                                  position_x=5, position_y=2, quantity=4)
            item_id, event_id = item.id, event.id

            resp = auth_client_a.post('/api/harvests', json={
                'plantId': 'tomato-1',
                'plantedItemId': item_id,
                'harvestDate': '2026-05-04T00:00:00Z',
                'quantity': 2,
                'unit': 'count',
            })
            assert resp.status_code == 201

            refreshed_event = PlantingEvent.query.get(event_id)
            assert refreshed_event.completed is True
            assert refreshed_event.harvest_completed is True
            assert refreshed_event.actual_harvest_date is not None
            assert refreshed_event.quantity_completed == 4

    def test_transplants_linked_indoor_seed_start(self, full_app, full_db, user_a, auth_client_a):
        """Linked IndoorSeedStart flips to 'transplanted' if not already."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_planted_item(full_db.session, user_a, bed,
                                        position_x=1, position_y=1)
            event = _create_event(full_db.session, user_a, bed,
                                  position_x=1, position_y=1,
                                  transplant_date=datetime(2026, 4, 1))
            seed_start = _create_indoor_start(full_db.session, user_a, event.id)
            seed_start_id = seed_start.id

            resp = auth_client_a.post('/api/harvests', json={
                'plantId': 'tomato-1',
                'plantedItemId': item.id,
                'harvestDate': '2026-05-04T00:00:00Z',
                'quantity': 1,
                'unit': 'count',
            })
            assert resp.status_code == 201

            refreshed = IndoorSeedStart.query.get(seed_start_id)
            assert refreshed.status == 'transplanted'
            assert refreshed.actual_transplant_date is not None

    def test_indoor_start_already_transplanted_unchanged(self, full_app, full_db, user_a, auth_client_a):
        """If IndoorSeedStart is already 'transplanted', actual_transplant_date is preserved."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_planted_item(full_db.session, user_a, bed)
            event = _create_event(full_db.session, user_a, bed)
            existing_date = datetime(2026, 4, 1)
            seed_start = _create_indoor_start(
                full_db.session, user_a, event.id,
                status='transplanted', actual_transplant_date=existing_date,
            )
            seed_start_id = seed_start.id

            auth_client_a.post('/api/harvests', json={
                'plantId': 'tomato-1',
                'plantedItemId': item.id,
                'harvestDate': '2026-05-04T00:00:00Z',
                'quantity': 1,
                'unit': 'count',
            })

            refreshed = IndoorSeedStart.query.get(seed_start_id)
            assert refreshed.status == 'transplanted'
            assert refreshed.actual_transplant_date == existing_date

    def test_no_planted_item_id_skips_sync(self, full_app, full_db, user_a, auth_client_a):
        """Without plantedItemId, the auto-sync block is skipped — PlantedItem stays growing."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_planted_item(full_db.session, user_a, bed)
            item_id = item.id

            resp = auth_client_a.post('/api/harvests', json={
                'plantId': 'tomato-1',
                'harvestDate': '2026-05-04T00:00:00Z',
                'quantity': 3.5,
                'unit': 'lbs',
            })
            assert resp.status_code == 201

            refreshed = PlantedItem.query.get(item_id)
            assert refreshed.status == 'growing'
            assert refreshed.harvest_date is None

    def test_other_users_planted_item_not_synced(self, full_app, full_db, user_a, user_b, auth_client_a):
        """User A's harvest must not mutate user B's PlantedItem even if id is supplied."""
        with full_app.app_context():
            bed_b = _create_bed(full_db.session, user_b, name='Bob Bed')
            item_b = _create_planted_item(full_db.session, user_b, bed_b)
            item_b_id = item_b.id

            resp = auth_client_a.post('/api/harvests', json={
                'plantId': 'tomato-1',
                'plantedItemId': item_b_id,
                'harvestDate': '2026-05-04T00:00:00Z',
                'quantity': 1,
                'unit': 'count',
            })
            assert resp.status_code == 201

            refreshed = PlantedItem.query.get(item_b_id)
            assert refreshed.user_id == user_b.id
            assert refreshed.status == 'growing'
            assert refreshed.harvest_date is None

    def test_creates_harvest_record(self, full_app, full_db, user_a, auth_client_a):
        """A HarvestRecord row is created with the supplied fields."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_planted_item(full_db.session, user_a, bed)

            resp = auth_client_a.post('/api/harvests', json={
                'plantId': 'tomato-1',
                'plantedItemId': item.id,
                'harvestDate': '2026-05-04T00:00:00Z',
                'quantity': 2.5,
                'unit': 'lbs',
                'quality': 'excellent',
                'notes': 'first pick of the season',
            })
            assert resp.status_code == 201
            data = resp.get_json()

            record = HarvestRecord.query.get(data['id'])
            assert record is not None
            assert record.user_id == user_a.id
            assert record.plant_id == 'tomato-1'
            assert record.planted_item_id == item.id
            assert record.quantity == 2.5
            assert record.unit == 'lbs'
            assert record.quality == 'excellent'
            assert record.notes == 'first pick of the season'
