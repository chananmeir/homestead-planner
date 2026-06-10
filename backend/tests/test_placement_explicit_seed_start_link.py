"""
Regression tests for AUDIT-013 Option α:
POST /api/planted-items now accepts an explicit `sourceIndoorSeedStartId`
that routes linkage through `_link_existing_indoor_seed_start` rather than
the heuristic `_find_existing_indoor_seed_start`.

User flow this enables: banner "Pick cell in <bed>" mode → clicking a cell
makes one atomic POST that creates the PlantedItem, creates the
PlantingEvent, and advances the specified IndoorSeedStart to
status='transplanted' — all in a single round trip.

Fix lives in backend/blueprints/gardens_bp.py::add_planted_item:
  - new validation block for sourceIndoorSeedStartId
  - linkage routing: explicit FK wins; heuristic fallback preserved
"""
from datetime import datetime

import pytest

from models import db, GardenBed, IndoorSeedStart, PlantedItem, PlantingEvent
from tests.conftest import login_as


PLANT_ID = 'tomato-1'  # has weeksIndoors=6 in plant_database -> transplant default


@pytest.fixture
def bed_a(full_db, user_a):
    bed = GardenBed(user_id=user_a.id, name='Test Bed A', width=4.0, length=8.0)
    full_db.session.add(bed)
    full_db.session.commit()
    return bed


def _make_seed_start(user, plant_id=PLANT_ID, variety=None,
                     expected_transplant=datetime(2026, 5, 1),
                     start_date=datetime(2026, 3, 20),
                     status='growing', cancelled_at=None):
    ss = IndoorSeedStart(
        user_id=user.id,
        plant_id=plant_id,
        variety=variety,
        start_date=start_date,
        expected_transplant_date=expected_transplant,
        seeds_started=5,
        status=status,
        cancelled_at=cancelled_at,
    )
    db.session.add(ss)
    db.session.commit()
    return ss


class TestExplicitIndoorSeedStartLinkage:
    def test_explicit_fk_links_specified_seed_start(
        self, auth_client_a, user_a, bed_a
    ):
        """POSTing with sourceIndoorSeedStartId links to that exact record,
        advances its status to 'transplanted', and wires planting_event_id."""
        ss = _make_seed_start(user_a)

        resp = auth_client_a.post('/api/planted-items', json={
            'plantId': PLANT_ID,
            'gardenBedId': bed_a.id,
            'plantedDate': '2026-05-01',
            'position': {'x': 0, 'y': 0},
            'quantity': 1,
            'sourceIndoorSeedStartId': ss.id,
        })
        assert resp.status_code == 201, resp.get_json()
        payload = resp.get_json()

        # Exactly one IndoorSeedStart exists — the pre-existing one, reused.
        count = IndoorSeedStart.query.filter_by(user_id=user_a.id).count()
        assert count == 1

        db.session.expire_all()
        ss_refreshed = IndoorSeedStart.query.get(ss.id)
        assert ss_refreshed.status == 'transplanted'
        assert ss_refreshed.planting_event_id is not None

        # PlantingEvent created by the placement should be the one linked.
        ev = PlantingEvent.query.get(ss_refreshed.planting_event_id)
        assert ev is not None
        assert ev.plant_id == PLANT_ID
        assert ev.garden_bed_id == bed_a.id

        # Response surfaces linkage signals.
        assert payload.get('indoorSeedStartLinked') is True
        assert payload.get('indoorSeedStartCreated') in (False, None)
        assert payload.get('indoorSeedStartId') == ss.id

    def test_explicit_plan_action_records_planned_placement_without_transplant(
        self, auth_client_a, user_a, bed_a
    ):
        """Plan Placement chooses a future bed cell without recording an actual
        transplant. The IndoorSeedStart stays planned/growing, but links to
        the newly positioned PlantingEvent so the placement is tracked."""
        original_event = PlantingEvent(
            user_id=user_a.id,
            plant_id=PLANT_ID,
            garden_bed_id=bed_a.id,
            seed_start_date=datetime(2026, 3, 20),
            transplant_date=datetime(2026, 5, 1),
            expected_harvest_date=datetime(2026, 8, 1),
            quantity=5,
            completed=False,
            quantity_completed=0,
        )
        db.session.add(original_event)
        db.session.flush()
        ss = _make_seed_start(
            user_a,
            status='planned',
            expected_transplant=datetime(2026, 5, 1),
        )
        ss.planting_event_id = original_event.id
        db.session.commit()

        resp = auth_client_a.post('/api/planted-items', json={
            'plantId': PLANT_ID,
            'gardenBedId': bed_a.id,
            'plantedDate': '2026-05-01',
            'position': {'x': 0, 'y': 0},
            'quantity': 1,
            'status': 'planned',
            'sourceIndoorSeedStartId': ss.id,
            'sourceIndoorSeedStartAction': 'plan',
        })
        assert resp.status_code == 201, resp.get_json()
        payload = resp.get_json()

        db.session.expire_all()
        ss_refreshed = IndoorSeedStart.query.get(ss.id)
        assert ss_refreshed.status == 'planned'
        assert ss_refreshed.planting_event_id != original_event.id
        assert ss_refreshed.planting_event_id is not None
        assert ss_refreshed.actual_transplant_date is None
        assert ss_refreshed.to_dict()['hasPlannedPlacement'] is True

        planned_event = PlantingEvent.query.get(ss_refreshed.planting_event_id)
        assert planned_event.garden_bed_id == bed_a.id
        assert planned_event.position_x == 0
        assert planned_event.position_y == 0
        assert planned_event.seed_start_date == ss_refreshed.start_date

        assert payload.get('indoorSeedStartId') == ss.id
        assert payload.get('indoorSeedStartLinked') is False
        assert payload.get('indoorSeedStartCreated') is False
        assert payload.get('indoorSeedStartPlacementPlanned') is True

    def test_explicit_plan_action_rejects_duplicate_planned_placement(
        self, auth_client_a, user_a, bed_a
    ):
        """Once a planned placement is linked, repeating Plan Placement for
        the same IndoorSeedStart must not create another PlantedItem."""
        ss = _make_seed_start(
            user_a,
            status='growing',
            expected_transplant=datetime(2026, 5, 1),
        )

        first = auth_client_a.post('/api/planted-items', json={
            'plantId': PLANT_ID,
            'gardenBedId': bed_a.id,
            'plantedDate': '2026-05-01',
            'position': {'x': 0, 'y': 0},
            'quantity': 1,
            'status': 'planned',
            'sourceIndoorSeedStartId': ss.id,
            'sourceIndoorSeedStartAction': 'plan',
        })
        assert first.status_code == 201, first.get_json()
        assert PlantedItem.query.filter_by(user_id=user_a.id).count() == 1

        second = auth_client_a.post('/api/planted-items', json={
            'plantId': PLANT_ID,
            'gardenBedId': bed_a.id,
            'plantedDate': '2026-05-01',
            'position': {'x': 1, 'y': 0},
            'quantity': 1,
            'status': 'planned',
            'sourceIndoorSeedStartId': ss.id,
            'sourceIndoorSeedStartAction': 'plan',
        })

        assert second.status_code == 409, second.get_json()
        assert 'already has a planned garden placement' in second.get_json()['error']
        assert PlantedItem.query.filter_by(user_id=user_a.id).count() == 1

    def test_batch_plan_action_does_not_heuristically_transplant_seed_start(
        self, auth_client_a, user_a, bed_a
    ):
        """The multi-cell Garden Designer path must also keep Plan Placement
        from advancing the selected IndoorSeedStart."""
        ss = _make_seed_start(
            user_a,
            status='planned',
            expected_transplant=datetime(2026, 5, 1),
        )

        resp = auth_client_a.post('/api/planted-items/batch', json={
            'plantId': PLANT_ID,
            'gardenBedId': bed_a.id,
            'plantedDate': '2026-05-01',
            'plantingMethod': 'transplant',
            'status': 'planned',
            'positions': [
                {'x': 0, 'y': 0, 'quantity': 1},
                {'x': 1, 'y': 0, 'quantity': 1},
            ],
            'sourceIndoorSeedStartId': ss.id,
            'sourceIndoorSeedStartAction': 'plan',
        })
        assert resp.status_code == 201, resp.get_json()
        payload = resp.get_json()

        db.session.expire_all()
        ss_refreshed = IndoorSeedStart.query.get(ss.id)
        assert ss_refreshed.status == 'planned'
        assert ss_refreshed.planting_event_id is not None
        assert ss_refreshed.actual_transplant_date is None
        assert ss_refreshed.to_dict()['hasPlannedPlacement'] is True
        linked_event = PlantingEvent.query.get(ss_refreshed.planting_event_id)
        assert linked_event.garden_bed_id == bed_a.id
        assert (linked_event.position_x, linked_event.position_y) in ((0, 0), (1, 0))
        assert IndoorSeedStart.query.filter_by(user_id=user_a.id).count() == 1
        assert payload.get('indoorSeedStartPlacementPlanned') is True
        assert payload.get('indoorSeedStartId') == ss.id

    def test_invalid_source_seed_start_action_rejected(
        self, auth_client_a, user_a, bed_a
    ):
        ss = _make_seed_start(user_a)

        resp = auth_client_a.post('/api/planted-items', json={
            'plantId': PLANT_ID,
            'gardenBedId': bed_a.id,
            'plantedDate': '2026-05-01',
            'position': {'x': 0, 'y': 0},
            'quantity': 1,
            'sourceIndoorSeedStartId': ss.id,
            'sourceIndoorSeedStartAction': 'later',
        })
        assert resp.status_code == 400, resp.get_json()
        assert 'sourceIndoorSeedStartAction' in resp.get_json().get('error', '')

    def test_missing_field_falls_through_to_heuristic(
        self, auth_client_a, user_a, bed_a
    ):
        """When sourceIndoorSeedStartId is omitted, the existing heuristic
        path (date-window + plant/variety match) still works — Path B
        (drag-from-palette without explicit FK) is untouched."""
        ss = _make_seed_start(
            user_a, expected_transplant=datetime(2026, 5, 1)
        )

        resp = auth_client_a.post('/api/planted-items', json={
            'plantId': PLANT_ID,
            'gardenBedId': bed_a.id,
            'plantedDate': '2026-05-01',
            'position': {'x': 0, 'y': 0},
            'quantity': 1,
            # sourceIndoorSeedStartId intentionally omitted.
        })
        assert resp.status_code == 201, resp.get_json()

        db.session.expire_all()
        ss_refreshed = IndoorSeedStart.query.get(ss.id)
        assert ss_refreshed.status == 'transplanted'
        assert ss_refreshed.planting_event_id is not None

    @pytest.mark.parametrize('bad_value', [0, -1, 'abc', 1.5, [], {}, True])
    def test_malformed_ids_rejected_with_400(
        self, auth_client_a, user_a, bed_a, bad_value
    ):
        """Non-positive-int values for sourceIndoorSeedStartId → 400."""
        resp = auth_client_a.post('/api/planted-items', json={
            'plantId': PLANT_ID,
            'gardenBedId': bed_a.id,
            'plantedDate': '2026-05-01',
            'position': {'x': 0, 'y': 0},
            'quantity': 1,
            'sourceIndoorSeedStartId': bad_value,
        })
        assert resp.status_code == 400, (
            f'Expected 400 for sourceIndoorSeedStartId={bad_value!r}, '
            f'got {resp.status_code}: {resp.get_json()}'
        )
        body = resp.get_json()
        assert 'positive integer' in body.get('error', '')

    def test_nonexistent_id_returns_404(
        self, auth_client_a, user_a, bed_a
    ):
        """A sourceIndoorSeedStartId not in the DB → 404."""
        resp = auth_client_a.post('/api/planted-items', json={
            'plantId': PLANT_ID,
            'gardenBedId': bed_a.id,
            'plantedDate': '2026-05-01',
            'position': {'x': 0, 'y': 0},
            'quantity': 1,
            'sourceIndoorSeedStartId': 99999,
        })
        assert resp.status_code == 404, resp.get_json()
        assert 'not found' in resp.get_json().get('error', '').lower()

    def test_cross_user_id_returns_404(
        self, full_app, user_a, user_b
    ):
        """User A's POST referring to user B's IndoorSeedStart → 404
        (no data leakage, no "unauthorized" distinction)."""
        # User B's seed start.
        ss_b = _make_seed_start(user_b)

        # User A's bed.
        bed_a_obj = GardenBed(
            user_id=user_a.id, name='A bed', width=4.0, length=4.0
        )
        db.session.add(bed_a_obj)
        db.session.commit()

        client_a = full_app.test_client()
        login_as(client_a, user_a)
        resp = client_a.post('/api/planted-items', json={
            'plantId': PLANT_ID,
            'gardenBedId': bed_a_obj.id,
            'plantedDate': '2026-05-01',
            'position': {'x': 0, 'y': 0},
            'quantity': 1,
            'sourceIndoorSeedStartId': ss_b.id,
        })
        assert resp.status_code == 404, resp.get_json()

        # B's start is untouched.
        db.session.expire_all()
        ss_b_refreshed = IndoorSeedStart.query.get(ss_b.id)
        assert ss_b_refreshed.status == 'growing'
        assert ss_b_refreshed.planting_event_id is None

    @pytest.mark.parametrize('stale_status', ['transplanted', 'failed'])
    def test_stale_status_rejected_with_400(
        self, auth_client_a, user_a, bed_a, stale_status
    ):
        """An IndoorSeedStart in a terminal/stale status cannot be relinked."""
        ss = _make_seed_start(user_a, status=stale_status)

        resp = auth_client_a.post('/api/planted-items', json={
            'plantId': PLANT_ID,
            'gardenBedId': bed_a.id,
            'plantedDate': '2026-05-01',
            'position': {'x': 0, 'y': 0},
            'quantity': 1,
            'sourceIndoorSeedStartId': ss.id,
        })
        assert resp.status_code == 400, resp.get_json()
        err_msg = resp.get_json().get('error', '')
        assert stale_status in err_msg or 'cannot be relinked' in err_msg

        # Record is untouched.
        db.session.expire_all()
        ss_refreshed = IndoorSeedStart.query.get(ss.id)
        assert ss_refreshed.status == stale_status
        assert ss_refreshed.planting_event_id is None

    def test_cancelled_seed_start_rejected_with_400(
        self, auth_client_a, user_a, bed_a
    ):
        """A soft-cancelled IndoorSeedStart cannot be relinked."""
        ss = _make_seed_start(
            user_a, cancelled_at=datetime(2026, 4, 1)
        )

        resp = auth_client_a.post('/api/planted-items', json={
            'plantId': PLANT_ID,
            'gardenBedId': bed_a.id,
            'plantedDate': '2026-05-01',
            'position': {'x': 0, 'y': 0},
            'quantity': 1,
            'sourceIndoorSeedStartId': ss.id,
        })
        assert resp.status_code == 400, resp.get_json()
        assert 'cancelled' in resp.get_json().get('error', '').lower()

    def test_explicit_fk_wins_over_heuristic(
        self, auth_client_a, user_a, bed_a
    ):
        """When two IndoorSeedStarts could plausibly match the heuristic,
        passing sourceIndoorSeedStartId must select the exact one specified
        rather than letting the heuristic pick."""
        # Two candidates for the same plant + no variety:
        # - ss_close: expected_transplant right on the target date (heuristic
        #   would prefer this one since it's unlinked + closest).
        # - ss_target: expected_transplant offset by ~5 days (still within
        #   the +/- 14d window, but a less-good heuristic match). This is
        #   the one the caller is explicitly choosing.
        ss_close = _make_seed_start(
            user_a, expected_transplant=datetime(2026, 5, 1)
        )
        ss_target = _make_seed_start(
            user_a, expected_transplant=datetime(2026, 5, 6)
        )

        resp = auth_client_a.post('/api/planted-items', json={
            'plantId': PLANT_ID,
            'gardenBedId': bed_a.id,
            'plantedDate': '2026-05-01',
            'position': {'x': 0, 'y': 0},
            'quantity': 1,
            'sourceIndoorSeedStartId': ss_target.id,
        })
        assert resp.status_code == 201, resp.get_json()
        payload = resp.get_json()

        db.session.expire_all()
        # The explicitly-specified record was advanced.
        target_refreshed = IndoorSeedStart.query.get(ss_target.id)
        assert target_refreshed.status == 'transplanted'
        assert target_refreshed.planting_event_id is not None
        # The heuristic's preferred candidate was left alone.
        close_refreshed = IndoorSeedStart.query.get(ss_close.id)
        assert close_refreshed.status == 'growing'
        assert close_refreshed.planting_event_id is None
        # Response identifies the linked id correctly.
        assert payload.get('indoorSeedStartId') == ss_target.id
        assert payload.get('indoorSeedStartLinked') is True
