from datetime import datetime

from models import GardenBed, HarvestRecord, PlantedItem, PlantingEvent


def _create_bed(session, user):
    bed = GardenBed(user_id=user.id, name='Outcome Bed', width=4.0, length=8.0)
    session.add(bed)
    session.commit()
    return bed


def _create_item(session, user, bed, **overrides):
    defaults = dict(
        user_id=user.id,
        garden_bed_id=bed.id,
        plant_id='tomato-1',
        variety='Roma',
        planted_date=datetime(2026, 5, 1),
        status='growing',
        position_x=1,
        position_y=2,
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
        variety='Roma',
        event_type='planting',
        direct_seed_date=datetime(2026, 5, 1),
        expected_harvest_date=datetime(2026, 8, 1),
        completed=True,
        harvest_completed=False,
        quantity=3,
        quantity_completed=3,
        position_x=1,
        position_y=2,
    )
    defaults.update(overrides)
    event = PlantingEvent(**defaults)
    session.add(event)
    session.commit()
    return event


class TestPlantOutcomeEndpoints:
    def test_planted_item_failure_creates_excluded_harvest_record(self, full_app, full_db, user_a, auth_client_a):
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_item(full_db.session, user_a, bed)
            event = _create_event(full_db.session, user_a, bed)

            resp = auth_client_a.post(f'/api/planted-items/{item.id}/outcome', json={
                'outcome': 'failed',
                'outcomeReason': 'pest',
                'outcomeDate': '2026-06-10T00:00:00Z',
                'outcomeNotes': 'cutworms',
            })

            assert resp.status_code == 200
            refreshed_item = PlantedItem.query.get(item.id)
            refreshed_event = PlantingEvent.query.get(event.id)
            record = HarvestRecord.query.one()

            assert refreshed_item.outcome == 'failed'
            assert refreshed_item.status == 'failed'
            assert refreshed_event.outcome == 'failed'
            assert refreshed_event.harvest_completed is True
            assert record.quantity == 0
            assert record.unit == 'count'
            assert record.outcome == 'failed'
            assert record.outcome_reason == 'pest'
            assert record.yield_excluded is True

            stats_resp = auth_client_a.get('/api/harvests/stats')
            assert stats_resp.status_code == 200
            assert stats_resp.get_json() == {}

    def test_not_planted_marks_history_without_harvest_record(self, full_app, full_db, user_a, auth_client_a):
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_item(full_db.session, user_a, bed, status='planned')
            event = _create_event(
                full_db.session,
                user_a,
                bed,
                completed=False,
                harvest_completed=False,
                quantity_completed=None,
            )

            resp = auth_client_a.post(f'/api/planted-items/{item.id}/outcome', json={
                'outcome': 'not_planted',
                'outcomeReason': 'changed_plan',
                'outcomeDate': '2026-05-05T00:00:00Z',
            })

            assert resp.status_code == 200
            refreshed_item = PlantedItem.query.get(item.id)
            refreshed_event = PlantingEvent.query.get(event.id)

            assert refreshed_item.cancelled_at is None
            assert refreshed_item.outcome == 'not_planted'
            assert refreshed_item.status == 'not_planted'
            assert refreshed_event.outcome == 'not_planted'
            assert refreshed_event.completed is True
            assert refreshed_event.harvest_completed is True
            assert refreshed_event.quantity_completed == 0
            assert HarvestRecord.query.count() == 0

    def test_planting_event_failure_without_item_creates_event_outcome_record(self, full_app, full_db, user_a, auth_client_a):
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            event = _create_event(full_db.session, user_a, bed, position_x=4, position_y=4)

            resp = auth_client_a.post(f'/api/planting-events/{event.id}/outcome', json={
                'outcome': 'failed',
                'outcomeReason': 'weather_frost',
                'outcomeDate': '2026-06-11T00:00:00Z',
            })

            assert resp.status_code == 200
            refreshed_event = PlantingEvent.query.get(event.id)
            record = HarvestRecord.query.one()

            assert refreshed_event.outcome == 'failed'
            assert refreshed_event.harvest_completed is True
            assert refreshed_event.quantity_completed == 3
            assert record.source_key == f'outcome:planting_event:{event.id}'
            assert record.planted_item_id is None
            assert record.yield_excluded is True

    def test_invalid_reason_is_rejected(self, full_app, full_db, user_a, auth_client_a):
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_item(full_db.session, user_a, bed)

            resp = auth_client_a.post(f'/api/planted-items/{item.id}/outcome', json={
                'outcome': 'failed',
                'outcomeReason': 'poor_germination',
            })

            assert resp.status_code == 400
            assert PlantedItem.query.get(item.id).outcome is None
            assert HarvestRecord.query.count() == 0

    def test_bulk_planted_item_outcome_marks_all_items_and_creates_excluded_records(
        self, full_app, full_db, user_a, auth_client_a
    ):
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item1 = _create_item(
                full_db.session,
                user_a,
                bed,
                plant_id='carrot-1',
                variety='Royal Chantenay',
                status='planned',
                position_x=0,
                position_y=1,
            )
            item2 = _create_item(
                full_db.session,
                user_a,
                bed,
                plant_id='carrot-1',
                variety='Royal Chantenay',
                status='planned',
                position_x=1,
                position_y=1,
            )

            resp = auth_client_a.post('/api/planted-items/bulk-outcome', json={
                'plantedItemIds': [item1.id, item2.id],
                'outcome': 'didnt_establish',
                'outcomeReason': 'poor_germination',
                'outcomeDate': '2026-06-10T00:00:00Z',
                'outcomeNotes': 'Whole row failed',
                'idempotencyKey': 'bulk-fail-carrot-row',
            })

            assert resp.status_code == 200
            data = resp.get_json()
            assert [item['id'] for item in data['plantedItems']] == [item1.id, item2.id]
            assert len(data['harvestRecords']) == 2

            refreshed_items = PlantedItem.query.order_by(PlantedItem.position_x).all()
            assert [item.outcome for item in refreshed_items] == ['didnt_establish', 'didnt_establish']
            assert [item.outcome_reason for item in refreshed_items] == ['poor_germination', 'poor_germination']

            records = HarvestRecord.query.order_by(HarvestRecord.planted_item_id).all()
            assert len(records) == 2
            assert {record.source_key for record in records} == {
                f'outcome:planted_item:{item1.id}',
                f'outcome:planted_item:{item2.id}',
            }
            assert all(record.quantity == 0 for record in records)
            assert all(record.yield_excluded is True for record in records)

    def test_bulk_planted_item_outcome_replay_returns_existing_records(
        self, full_app, full_db, user_a, auth_client_a
    ):
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            items = [
                _create_item(full_db.session, user_a, bed, plant_id='carrot-1', status='planned', position_x=idx)
                for idx in range(2)
            ]
            payload = {
                'plantedItemIds': [item.id for item in items],
                'outcome': 'didnt_establish',
                'outcomeReason': 'poor_germination',
                'outcomeDate': '2026-06-10T00:00:00Z',
            }

            first = auth_client_a.post('/api/planted-items/bulk-outcome', json=payload)
            second = auth_client_a.post('/api/planted-items/bulk-outcome', json=payload)

            assert first.status_code == 200
            assert second.status_code == 200
            assert HarvestRecord.query.count() == 2
            assert len(second.get_json()['harvestRecords']) == 2

    def test_bulk_planted_item_outcome_rejects_cross_user_ids(
        self, full_app, full_db, user_a, user_b, auth_client_a
    ):
        with full_app.app_context():
            bed_a = _create_bed(full_db.session, user_a)
            bed_b = _create_bed(full_db.session, user_b)
            mine = _create_item(full_db.session, user_a, bed_a, status='planned')
            theirs = _create_item(full_db.session, user_b, bed_b, status='planned')

            resp = auth_client_a.post('/api/planted-items/bulk-outcome', json={
                'plantedItemIds': [mine.id, theirs.id],
                'outcome': 'didnt_establish',
                'outcomeReason': 'poor_germination',
                'outcomeDate': '2026-06-10T00:00:00Z',
            })

            assert resp.status_code == 403
            assert PlantedItem.query.get(mine.id).outcome is None
            assert PlantedItem.query.get(theirs.id).outcome is None
            assert HarvestRecord.query.count() == 0

    def test_bulk_planted_item_outcome_rolls_back_when_any_item_is_ineligible(
        self, full_app, full_db, user_a, auth_client_a
    ):
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            eligible = _create_item(full_db.session, user_a, bed, status='planned', position_x=0)
            ineligible = _create_item(full_db.session, user_a, bed, status='harvested', position_x=1)

            resp = auth_client_a.post('/api/planted-items/bulk-outcome', json={
                'plantedItemIds': [eligible.id, ineligible.id],
                'outcome': 'didnt_establish',
                'outcomeReason': 'poor_germination',
                'outcomeDate': '2026-06-10T00:00:00Z',
            })

            assert resp.status_code == 409
            assert PlantedItem.query.get(eligible.id).outcome is None
            assert PlantedItem.query.get(ineligible.id).outcome is None
            assert HarvestRecord.query.count() == 0

    def test_bulk_planted_item_outcome_500_does_not_leak_driver_error(
        self, full_app, full_db, user_a, auth_client_a, monkeypatch
    ):
        import blueprints.gardens_bp as gardens_bp

        def fail_with_driver_detail(*_args, **_kwargs):
            raise RuntimeError('sqlite3.OperationalError: disk I/O error [SQL: INSERT INTO harvest_record]')

        monkeypatch.setattr(gardens_bp, 'mark_planted_items_bulk_outcome', fail_with_driver_detail)

        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_item(full_db.session, user_a, bed, status='planned')

            resp = auth_client_a.post('/api/planted-items/bulk-outcome', json={
                'plantedItemIds': [item.id],
                'outcome': 'didnt_establish',
                'outcomeReason': 'poor_germination',
                'outcomeDate': '2026-06-10T00:00:00Z',
            })

            assert resp.status_code == 500
            assert resp.get_json() == {'error': 'Failed to record bulk planted item outcome'}
            assert 'sqlite' not in resp.get_data(as_text=True).lower()
            assert PlantedItem.query.get(item.id).outcome is None
            assert HarvestRecord.query.count() == 0

    def test_bulk_clear_harvested_items_soft_clears_without_new_harvest_records(
        self, full_app, full_db, user_a, auth_client_a
    ):
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            harvest_date = datetime(2026, 7, 15)
            item1 = _create_item(
                full_db.session,
                user_a,
                bed,
                status='harvested',
                harvest_date=harvest_date,
                position_x=0,
                position_y=1,
            )
            item2 = _create_item(
                full_db.session,
                user_a,
                bed,
                status='harvested',
                harvest_date=harvest_date,
                position_x=1,
                position_y=1,
            )
            event1 = _create_event(
                full_db.session,
                user_a,
                bed,
                harvest_completed=True,
                actual_harvest_date=harvest_date,
                position_x=0,
                position_y=1,
            )
            event2 = _create_event(
                full_db.session,
                user_a,
                bed,
                harvest_completed=True,
                actual_harvest_date=harvest_date,
                position_x=1,
                position_y=1,
            )
            existing_record = HarvestRecord(
                user_id=user_a.id,
                plant_id='tomato-1',
                planted_item_id=item1.id,
                harvest_date=harvest_date,
                quantity=2,
                unit='lbs',
                quality='good',
                source_key='client:already-picked',
            )
            full_db.session.add(existing_record)
            full_db.session.commit()

            resp = auth_client_a.post('/api/planted-items/bulk-clear', json={
                'plantedItemIds': [item1.id, item2.id],
            })

            assert resp.status_code == 200
            data = resp.get_json()
            assert [item['id'] for item in data['plantedItems']] == [item1.id, item2.id]
            assert all(item['clearedAt'] is not None for item in data['plantedItems'])
            assert data['harvestRecords'] == []

            assert HarvestRecord.query.count() == 1
            assert HarvestRecord.query.first().source_key == 'client:already-picked'
            assert PlantedItem.query.get(item1.id).cleared_at is not None
            assert PlantedItem.query.get(item2.id).cleared_at is not None
            assert PlantingEvent.query.get(event1.id).cleared_at is not None
            assert PlantingEvent.query.get(event2.id).cleared_at is not None

    def test_bulk_clear_harvested_items_replay_is_idempotent(
        self, full_app, full_db, user_a, auth_client_a
    ):
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            item = _create_item(
                full_db.session,
                user_a,
                bed,
                status='harvested',
                harvest_date=datetime(2026, 7, 15),
            )
            payload = {'plantedItemIds': [item.id]}

            first = auth_client_a.post('/api/planted-items/bulk-clear', json=payload)
            second = auth_client_a.post('/api/planted-items/bulk-clear', json=payload)

            assert first.status_code == 200
            assert second.status_code == 200
            assert HarvestRecord.query.count() == 0
            assert second.get_json()['plantedItems'][0]['clearedAt'] is not None

    def test_bulk_clear_harvested_items_rejects_cross_user_ids(
        self, full_app, full_db, user_a, user_b, auth_client_a
    ):
        with full_app.app_context():
            bed_a = _create_bed(full_db.session, user_a)
            bed_b = _create_bed(full_db.session, user_b)
            mine = _create_item(full_db.session, user_a, bed_a, status='harvested')
            theirs = _create_item(full_db.session, user_b, bed_b, status='harvested')

            resp = auth_client_a.post('/api/planted-items/bulk-clear', json={
                'plantedItemIds': [mine.id, theirs.id],
            })

            assert resp.status_code == 403
            assert PlantedItem.query.get(mine.id).cleared_at is None
            assert PlantedItem.query.get(theirs.id).cleared_at is None
            assert HarvestRecord.query.count() == 0

    def test_bulk_clear_harvested_items_rejects_non_harvested_without_partial_clear(
        self, full_app, full_db, user_a, auth_client_a
    ):
        with full_app.app_context():
            bed = _create_bed(full_db.session, user_a)
            harvested = _create_item(full_db.session, user_a, bed, status='harvested', position_x=0)
            growing = _create_item(full_db.session, user_a, bed, status='growing', position_x=1)

            resp = auth_client_a.post('/api/planted-items/bulk-clear', json={
                'plantedItemIds': [harvested.id, growing.id],
            })

            assert resp.status_code == 409
            assert PlantedItem.query.get(harvested.id).cleared_at is None
            assert PlantedItem.query.get(growing.id).cleared_at is None
            assert HarvestRecord.query.count() == 0
