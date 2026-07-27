"""
Tests for POST /api/harvests auto-sync behavior when plantedItemId is supplied.

Closes a coverage gap on harvests_bp.py: harvest creation for planted items,
including repeat harvests and the finalHarvest path that soft-clears bed cells.

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
    """POST /api/harvests with plantedItemId records yield; finalHarvest closes the planting."""

    def test_normal_harvest_keeps_planted_item_active(self, full_app, full_db, user_a, auth_client_a):
        """Plain harvest does not release bed occupancy."""
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
            assert refreshed.status == 'growing'
            assert refreshed.cleared_at is None

    def test_final_harvest_sets_planted_item_to_harvested_and_cleared(self, full_app, full_db, user_a, auth_client_a):
        """Final harvest marks the planted item harvested and soft-clears it from the bed."""
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
                'finalHarvest': True,
            })
            assert resp.status_code == 201
            assert resp.get_json()['plantedItem']['clearedAt'] is not None

            refreshed = PlantedItem.query.get(item_id)
            assert refreshed.status == 'harvested'
            assert refreshed.harvest_date is not None
            assert refreshed.cleared_at is not None

    def test_completes_linked_planting_event(self, full_app, full_db, user_a, auth_client_a):
        """Final harvest completes and clears matching PlantingEvent."""
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
                'finalHarvest': True,
            })
            assert resp.status_code == 201

            refreshed_event = PlantingEvent.query.get(event_id)
            assert refreshed_event.completed is True
            assert refreshed_event.harvest_completed is True
            assert refreshed_event.actual_harvest_date is not None
            assert refreshed_event.quantity_completed == 4
            assert refreshed_event.cleared_at is not None

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
                'finalHarvest': True,
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
                'finalHarvest': True,
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
        """User A's harvest must reject user B's PlantedItem and create no record."""
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
            assert resp.status_code == 403

            refreshed = PlantedItem.query.get(item_b_id)
            assert refreshed.user_id == user_b.id
            assert refreshed.status == 'growing'
            assert refreshed.harvest_date is None
            assert HarvestRecord.query.count() == 0

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
                'idempotencyKey': 'first-pick',
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
            assert record.source_key == 'client:first-pick'

    def test_replaying_same_planted_item_with_idempotency_key_returns_existing_record(self, full_app, full_db, user_a, auth_client_a):
        """Double-submit with a plantedItemId and idempotency key must not create a duplicate HarvestRecord."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_planted_item(full_db.session, user_a, bed)
            payload = {
                'plantId': 'tomato-1',
                'plantedItemId': item.id,
                'harvestDate': '2026-05-04T00:00:00Z',
                'quantity': 2.5,
                'unit': 'lbs',
                'quality': 'excellent',
                'idempotencyKey': 'same-pick',
            }

            first = auth_client_a.post('/api/harvests', json=payload)
            second = auth_client_a.post('/api/harvests', json=payload)

            assert first.status_code == 201
            assert second.status_code == 200
            assert first.get_json()['id'] == second.get_json()['id']
            assert HarvestRecord.query.filter_by(user_id=user_a.id).count() == 1

    def test_planted_item_harvest_without_idempotency_key_allows_separate_records(
        self, full_app, full_db, user_a, auth_client_a
    ):
        """Multiple harvests can be recorded against the same active planted item."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_planted_item(full_db.session, user_a, bed)
            payload = {
                'plantId': 'tomato-1',
                'plantedItemId': item.id,
                'harvestDate': '2026-05-04T00:00:00Z',
                'quantity': 2.5,
                'unit': 'lbs',
                'quality': 'excellent',
            }

            first = auth_client_a.post('/api/harvests', json=payload)
            second = auth_client_a.post('/api/harvests', json=payload)

            assert first.status_code == 201
            assert second.status_code == 201
            assert first.get_json()['id'] != second.get_json()['id']
            assert HarvestRecord.query.filter_by(user_id=user_a.id).count() == 2
            refreshed = PlantedItem.query.get(item.id)
            assert refreshed.status == 'growing'
            assert refreshed.cleared_at is None

    def test_manual_harvest_replay_with_idempotency_key_returns_existing_record(
        self, full_app, full_db, user_a, auth_client_a
    ):
        """Manual harvests can opt into idempotency with a client key."""
        with full_app.app_context():
            payload = {
                'plantId': 'tomato-1',
                'harvestDate': '2026-05-04T00:00:00Z',
                'quantity': 2.5,
                'unit': 'lbs',
                'idempotencyKey': 'manual-harvest-1',
            }

            first = auth_client_a.post('/api/harvests', json=payload)
            second = auth_client_a.post('/api/harvests', json=payload)

            assert first.status_code == 201
            assert second.status_code == 200
            assert first.get_json()['id'] == second.get_json()['id']
            assert HarvestRecord.query.filter_by(user_id=user_a.id).count() == 1
            assert HarvestRecord.query.first().source_key == 'client:manual-harvest-1'

    def test_manual_harvest_without_idempotency_key_allows_separate_records(
        self, full_app, full_db, user_a, auth_client_a
    ):
        """Manual harvests without a source or idempotency key remain repeatable."""
        with full_app.app_context():
            payload = {
                'plantId': 'tomato-1',
                'harvestDate': '2026-05-04T00:00:00Z',
                'quantity': 2.5,
                'unit': 'lbs',
            }

            first = auth_client_a.post('/api/harvests', json=payload)
            second = auth_client_a.post('/api/harvests', json=payload)

            assert first.status_code == 201
            assert second.status_code == 201
            assert first.get_json()['id'] != second.get_json()['id']
            assert HarvestRecord.query.filter_by(user_id=user_a.id).count() == 2

    def test_planting_event_id_replay_returns_existing_record(self, full_app, full_db, user_a, auth_client_a):
        """Harvests sourced from a plantingEventId are idempotent by event."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            event = _create_event(full_db.session, user_a, bed)
            payload = {
                'plantId': 'tomato-1',
                'plantingEventId': event.id,
                'harvestDate': '2026-05-04T00:00:00Z',
                'quantity': 2.5,
                'unit': 'lbs',
            }

            first = auth_client_a.post('/api/harvests', json=payload)
            second = auth_client_a.post('/api/harvests', json=payload)

            assert first.status_code == 201
            assert second.status_code == 200
            assert first.get_json()['id'] == second.get_json()['id']
            assert HarvestRecord.query.filter_by(user_id=user_a.id).count() == 1
            refreshed_event = PlantingEvent.query.get(event.id)
            assert refreshed_event.harvest_completed is True
            assert refreshed_event.actual_harvest_date is not None


class TestReadyHarvestResolver:
    """GET /api/harvests/ready resolves dashboard event ids into log context."""

    def test_ready_endpoint_returns_event_bed_and_exact_planted_item(self, full_app, full_db, user_a, auth_client_a):
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a, name='North Bed')
            item = _create_planted_item(
                full_db.session,
                user_a,
                bed,
                variety='Roma',
                position_x=4,
                position_y=2,
                quantity=2,
            )
            event = _create_event(
                full_db.session,
                user_a,
                bed,
                variety='Roma',
                position_x=4,
                position_y=2,
                quantity=2,
                expected_harvest_date=datetime(2026, 7, 10),
            )

            resp = auth_client_a.get(f'/api/harvests/ready?plantingEventIds={event.id}')

            assert resp.status_code == 200
            body = resp.get_json()
            assert len(body['tasks']) == 1
            task = body['tasks'][0]
            assert task['plantingEventId'] == event.id
            assert task['plantId'] == 'tomato-1'
            assert task['plantName']
            assert task['variety'] == 'Roma'
            assert task['bedId'] == bed.id
            assert task['bedName'] == 'North Bed'
            assert task['quantity'] == 2
            assert task['expectedHarvestDate'].startswith('2026-07-10')
            assert task['plantedItems'] == [{
                'id': item.id,
                'quantity': 2,
                'status': 'growing',
                'position': {'x': 4, 'y': 2},
            }]

    def test_ready_endpoint_preserves_group_order(self, full_app, full_db, user_a, auth_client_a):
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            first = _create_event(full_db.session, user_a, bed, position_x=0, position_y=0)
            second = _create_event(full_db.session, user_a, bed, position_x=1, position_y=0)

            resp = auth_client_a.get(
                f'/api/harvests/ready?plantingEventIds={second.id},{first.id}'
            )

            assert resp.status_code == 200
            body = resp.get_json()
            assert [task['plantingEventId'] for task in body['tasks']] == [second.id, first.id]

    def test_ready_endpoint_does_not_match_broad_same_crop_items_without_position(self, full_app, full_db, user_a, auth_client_a):
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            _create_planted_item(full_db.session, user_a, bed, position_x=0, position_y=0)
            event = _create_event(
                full_db.session,
                user_a,
                bed,
                position_x=None,
                position_y=None,
            )

            resp = auth_client_a.get(f'/api/harvests/ready/{event.id}')

            assert resp.status_code == 200
            task = resp.get_json()
            assert task['plantingEventId'] == event.id
            assert task['plantedItems'] == []

    def test_ready_endpoint_filters_other_users_events(self, full_app, full_db, user_a, user_b, auth_client_a):
        with full_app.app_context():
            bed_b = _create_bed(full_db.session, user_b, name='Other Bed')
            event_b = _create_event(full_db.session, user_b, bed_b)

            resp = auth_client_a.get(f'/api/harvests/ready?plantingEventIds={event_b.id}')

            assert resp.status_code == 404
