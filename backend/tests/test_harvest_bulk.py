"""
Tests for POST /api/harvests/bulk — bulk harvest creation with shared harvest_group_id.

Covers:
- Splits totalQuantity evenly across N PlantedItems
- All N records share a single harvest_group_id UUID
- Plain harvest leaves PlantedItems active; finalHarvest soft-clears them
- Linked PlantingEvents and IndoorSeedStarts sync only on finalHarvest
- Rejects requests that include items belonging to another user
- Validates totalQuantity > 0 and non-empty plantedItemIds list
"""

from datetime import datetime

import pytest
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
        position_x=0,
        position_y=0,
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
        quantity=1,
        completed=False,
        quantity_completed=None,
        position_x=0,
        position_y=0,
    )
    defaults.update(overrides)
    event = PlantingEvent(**defaults)
    session.add(event)
    session.commit()
    return event


class TestBulkHarvest:
    """POST /api/harvests/bulk creates one record per item with shared group id."""

    def test_creates_n_records_with_shared_group_id(self, full_app, full_db, user_a, auth_client_a):
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            items = [
                _create_planted_item(full_db.session, user_a, bed, position_x=i, position_y=0)
                for i in range(3)
            ]
            ids = [i.id for i in items]

            resp = auth_client_a.post('/api/harvests/bulk', json={
                'plantedItemIds': ids,
                'plantId': 'tomato-1',
                'totalQuantity': 9.0,
                'unit': 'lbs',
                'quality': 'good',
                'harvestDate': '2026-05-04T00:00:00Z',
                'idempotencyKey': 'bulk-good-pick',
            })
            assert resp.status_code == 201
            body = resp.get_json()
            assert body['harvestGroupId']
            assert len(body['records']) == 3

            group_id = body['harvestGroupId']
            for r in body['records']:
                assert r['harvestGroupId'] == group_id
                assert r['plantId'] == 'tomato-1'
                assert r['quantity'] == pytest.approx(3.0)
                assert r['unit'] == 'lbs'

            # Confirm rows in DB
            db_records = HarvestRecord.query.filter_by(harvest_group_id=group_id).all()
            assert len(db_records) == 3
            assert {r.planted_item_id for r in db_records} == set(ids)
            assert all(r.source_key.startswith('client_item:') for r in db_records)

    def test_replaying_same_bulk_request_returns_existing_group(self, full_app, full_db, user_a, auth_client_a):
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            items = [
                _create_planted_item(full_db.session, user_a, bed, position_x=i, position_y=0)
                for i in range(2)
            ]
            payload = {
                'plantedItemIds': [i.id for i in items],
                'plantId': 'tomato-1',
                'totalQuantity': 6.0,
                'unit': 'lbs',
                'quality': 'good',
                'harvestDate': '2026-05-04T00:00:00Z',
                'idempotencyKey': 'bulk-replay',
            }

            first = auth_client_a.post('/api/harvests/bulk', json=payload)
            second = auth_client_a.post('/api/harvests/bulk', json=payload)

            assert first.status_code == 201
            assert second.status_code == 200
            assert second.get_json()['harvestGroupId'] == first.get_json()['harvestGroupId']
            assert [r['id'] for r in second.get_json()['records']] == [
                r['id'] for r in first.get_json()['records']
            ]
            assert HarvestRecord.query.filter_by(user_id=user_a.id).count() == 2

    def test_bulk_allows_new_harvest_after_prior_single_harvest(self, full_app, full_db, user_a, auth_client_a):
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item1 = _create_planted_item(full_db.session, user_a, bed, position_x=0, position_y=0)
            item2 = _create_planted_item(full_db.session, user_a, bed, position_x=1, position_y=0)

            single = auth_client_a.post('/api/harvests', json={
                'plantId': 'tomato-1',
                'plantedItemId': item1.id,
                'quantity': 2.0,
                'harvestDate': '2026-05-04T00:00:00Z',
            })
            assert single.status_code == 201

            bulk = auth_client_a.post('/api/harvests/bulk', json={
                'plantedItemIds': [item1.id, item2.id],
                'plantId': 'tomato-1',
                'totalQuantity': 6.0,
                'harvestDate': '2026-05-04T00:00:00Z',
                'idempotencyKey': 'bulk-after-single',
            })

            assert bulk.status_code == 201
            assert HarvestRecord.query.filter_by(user_id=user_a.id).count() == 3
            assert PlantedItem.query.get(item2.id).status == 'growing'

    def test_normal_bulk_harvest_keeps_planted_items_active(self, full_app, full_db, user_a, auth_client_a):
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            items = [
                _create_planted_item(full_db.session, user_a, bed, position_x=i, position_y=0)
                for i in range(4)
            ]
            ids = [i.id for i in items]

            resp = auth_client_a.post('/api/harvests/bulk', json={
                'plantedItemIds': ids,
                'plantId': 'tomato-1',
                'totalQuantity': 12.0,
                'harvestDate': '2026-05-04T00:00:00Z',
            })
            assert resp.status_code == 201

            for item_id in ids:
                refreshed = PlantedItem.query.get(item_id)
                assert refreshed.status == 'growing'
                assert refreshed.cleared_at is None

    def test_final_bulk_harvest_clears_planted_items(self, full_app, full_db, user_a, auth_client_a):
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            items = [
                _create_planted_item(full_db.session, user_a, bed, position_x=i, position_y=0)
                for i in range(4)
            ]
            ids = [i.id for i in items]

            resp = auth_client_a.post('/api/harvests/bulk', json={
                'plantedItemIds': ids,
                'plantId': 'tomato-1',
                'totalQuantity': 12.0,
                'harvestDate': '2026-05-04T00:00:00Z',
                'finalHarvest': True,
            })
            assert resp.status_code == 201
            assert all(item['clearedAt'] is not None for item in resp.get_json()['plantedItems'])

            for item_id in ids:
                refreshed = PlantedItem.query.get(item_id)
                assert refreshed.status == 'harvested'
                assert refreshed.harvest_date is not None
                assert refreshed.cleared_at is not None

    def test_linked_planting_events_complete(self, full_app, full_db, user_a, auth_client_a):
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item1 = _create_planted_item(full_db.session, user_a, bed, position_x=0, position_y=0)
            item2 = _create_planted_item(full_db.session, user_a, bed, position_x=1, position_y=0)
            event1 = _create_event(full_db.session, user_a, bed, position_x=0, position_y=0, quantity=2)
            event2 = _create_event(full_db.session, user_a, bed, position_x=1, position_y=0, quantity=3)

            resp = auth_client_a.post('/api/harvests/bulk', json={
                'plantedItemIds': [item1.id, item2.id],
                'plantId': 'tomato-1',
                'totalQuantity': 5.0,
                'harvestDate': '2026-05-04T00:00:00Z',
                'finalHarvest': True,
            })
            assert resp.status_code == 201

            for evt_id, expected_qty in [(event1.id, 2), (event2.id, 3)]:
                refreshed = PlantingEvent.query.get(evt_id)
                assert refreshed.completed is True
                assert refreshed.harvest_completed is True
                assert refreshed.actual_harvest_date is not None
                assert refreshed.quantity_completed == expected_qty
                assert refreshed.cleared_at is not None

    def test_linked_indoor_seed_starts_transplant(self, full_app, full_db, user_a, auth_client_a):
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_planted_item(full_db.session, user_a, bed)
            event = _create_event(full_db.session, user_a, bed,
                                  transplant_date=datetime(2026, 4, 1))
            seed_start = IndoorSeedStart(
                user_id=user_a.id,
                plant_id='tomato-1',
                start_date=datetime(2026, 3, 1),
                seeds_started=10,
                status='seeded',
                planting_event_id=event.id,
            )
            full_db.session.add(seed_start)
            full_db.session.commit()
            seed_start_id = seed_start.id

            resp = auth_client_a.post('/api/harvests/bulk', json={
                'plantedItemIds': [item.id],
                'plantId': 'tomato-1',
                'totalQuantity': 2.0,
                'harvestDate': '2026-05-04T00:00:00Z',
                'finalHarvest': True,
            })
            assert resp.status_code == 201

            refreshed = IndoorSeedStart.query.get(seed_start_id)
            assert refreshed.status == 'transplanted'

    def test_rejects_other_users_items(self, full_app, full_db, user_a, user_b, auth_client_a):
        with full_app.app_context():
            bed_a = _create_bed(full_db.session, user_a, name='A bed')
            bed_b = _create_bed(full_db.session, user_b, name='B bed')
            mine = _create_planted_item(full_db.session, user_a, bed_a)
            theirs = _create_planted_item(full_db.session, user_b, bed_b)

            resp = auth_client_a.post('/api/harvests/bulk', json={
                'plantedItemIds': [mine.id, theirs.id],
                'plantId': 'tomato-1',
                'totalQuantity': 4.0,
                'harvestDate': '2026-05-04T00:00:00Z',
            })
            assert resp.status_code == 403

            # Neither item should be modified
            assert PlantedItem.query.get(mine.id).status == 'growing'
            assert PlantedItem.query.get(theirs.id).status == 'growing'
            assert HarvestRecord.query.count() == 0

    def test_rejects_empty_list(self, full_app, full_db, user_a, auth_client_a):
        with full_app.app_context():
            resp = auth_client_a.post('/api/harvests/bulk', json={
                'plantedItemIds': [],
                'plantId': 'tomato-1',
                'totalQuantity': 1.0,
            })
            assert resp.status_code == 400

    def test_rejects_zero_quantity(self, full_app, full_db, user_a, auth_client_a):
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_planted_item(full_db.session, user_a, bed)

            resp = auth_client_a.post('/api/harvests/bulk', json={
                'plantedItemIds': [item.id],
                'plantId': 'tomato-1',
                'totalQuantity': 0,
            })
            assert resp.status_code == 400

    def test_single_item_quantity_split(self, full_app, full_db, user_a, auth_client_a):
        """totalQuantity divided by 1 should equal totalQuantity."""
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_planted_item(full_db.session, user_a, bed)

            resp = auth_client_a.post('/api/harvests/bulk', json={
                'plantedItemIds': [item.id],
                'plantId': 'tomato-1',
                'totalQuantity': 7.5,
                'harvestDate': '2026-05-04T00:00:00Z',
            })
            assert resp.status_code == 201
            body = resp.get_json()
            assert body['records'][0]['quantity'] == pytest.approx(7.5)
