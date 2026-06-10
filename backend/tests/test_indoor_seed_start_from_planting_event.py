"""
Regression tests for Phase B smoke findings #7 and #8 (shared root cause).

Note (Phase B smoke #6): these tests use `overdueMode='import_anyway'` because
the shared fixture transplant_date (2026-05-15) minus weeks_indoors=6 yields
2026-04-03 — past the current simulated date (2026-04-22). With the new
default overdueMode='skip' policy (#6), omitting the mode would correctly
skip the row and return 200 with no indoorSeedStart payload. These tests
care about destination_bed_ids persistence, not overdue handling, so they
explicitly opt in to import_anyway to exercise the create path.

When importing an indoor seed start from an existing GardenPlanItem/PlantingEvent,
destination_bed_ids was never persisted on the IndoorSeedStart row. That left the
UI's destinationBedDetails array empty (both the "Destination: ..." row and the
"Transplant Now" button are gated on non-empty destinationBedDetails), so both
UI affordances silently disappeared for single-planting crops like tomato that
couldn't hit the ±30-day GardenPlanItem date-window fallback.

Fix: POST /api/indoor-seed-starts/from-planting-event now:
  1. Accepts an optional `destinationBedIds` (list[int]) payload field, validates
     it (positive integers, belonging to current user), and persists it on
     IndoorSeedStart.destination_bed_ids (JSON-encoded list, mirrors sibling
     POST /api/indoor-seed-starts pattern).
  2. If `destinationBedIds` is omitted and the linked PlantingEvent has
     garden_bed_id set, auto-populates destination_bed_ids = [event.garden_bed_id].
  3. If neither is available, leaves destination_bed_ids NULL so the existing
     three-tier resolver in IndoorSeedStart.get_current_garden_plan_count() can
     still fall through.
"""
import json
from datetime import datetime, timedelta

import pytest

from models import db, GardenBed, IndoorSeedStart, PlantingEvent


PLANT_ID = 'tomato-1'  # has weeksIndoors=6 per plant_database


@pytest.fixture
def bed_a(full_db, user_a):
    bed = GardenBed(user_id=user_a.id, name='Tomato Bed', width=4.0, length=8.0)
    full_db.session.add(bed)
    full_db.session.commit()
    return bed


@pytest.fixture
def bed_a2(full_db, user_a):
    bed = GardenBed(user_id=user_a.id, name='Tomato Bed 2', width=4.0, length=8.0)
    full_db.session.add(bed)
    full_db.session.commit()
    return bed


@pytest.fixture
def bed_b_other_user(full_db, user_b):
    """A bed owned by user_b — should be rejected when user_a tries to use it."""
    bed = GardenBed(user_id=user_b.id, name="Bob's Bed", width=4.0, length=8.0)
    full_db.session.add(bed)
    full_db.session.commit()
    return bed


def _make_event(
    user,
    garden_bed_id=None,
    transplant_date=datetime(2026, 5, 15),
    plant_id=PLANT_ID,
    variety=None,
):
    event = PlantingEvent(
        user_id=user.id,
        plant_id=plant_id,
        variety=variety,
        quantity=4,
        transplant_date=transplant_date,
        expected_harvest_date=transplant_date + timedelta(days=70),
        garden_bed_id=garden_bed_id,
    )
    db.session.add(event)
    db.session.commit()
    return event


def _make_seed_start(user, event):
    seed_start = IndoorSeedStart(
        user_id=user.id,
        plant_id=PLANT_ID,
        variety=None,
        start_date=datetime(2026, 4, 1),
        expected_transplant_date=event.transplant_date,
        seeds_started=4,
        status='planned',
        planting_event_id=event.id,
    )
    db.session.add(seed_start)
    db.session.commit()
    return seed_start


class TestFromPlantingEventIdentityInvariant:
    def test_matching_linked_event_variety_is_persisted(
        self, auth_client_a, user_a, bed_a
    ):
        event = _make_event(user_a, garden_bed_id=bed_a.id, variety='Brandywine')

        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'variety': 'Brandywine',
            'transplantDate': '2026-05-15T00:00:00Z',
            'desiredQuantity': 4,
            'overdueMode': 'import_anyway',
        })

        assert resp.status_code == 201, resp.get_json()
        seed_start_id = resp.get_json()['indoorSeedStart']['id']
        seed_start = IndoorSeedStart.query.get(seed_start_id)
        assert seed_start.plant_id == PLANT_ID
        assert seed_start.variety == 'Brandywine'

    def test_mismatched_linked_event_variety_is_rejected(
        self, auth_client_a, user_a, bed_a
    ):
        event = _make_event(user_a, garden_bed_id=bed_a.id, variety='Waltham')

        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'variety': 'De Cicco',
            'transplantDate': '2026-05-15T00:00:00Z',
            'desiredQuantity': 4,
            'overdueMode': 'import_anyway',
        })

        assert resp.status_code == 400, resp.get_json()
        body = resp.get_json()
        assert 'variety must match' in body['error']
        assert body['details']['variety'] == 'De Cicco'
        assert body['details']['linkedVariety'] == 'Waltham'
        assert IndoorSeedStart.query.filter_by(user_id=user_a.id).count() == 0

        db.session.expire_all()
        unchanged_event = PlantingEvent.query.get(event.id)
        assert unchanged_event.variety == 'Waltham'
        assert unchanged_event.seed_start_date is None

    def test_missing_variety_is_rejected_when_linked_event_has_variety(
        self, auth_client_a, user_a, bed_a
    ):
        event = _make_event(user_a, garden_bed_id=bed_a.id, variety='Waltham')

        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'transplantDate': '2026-05-15T00:00:00Z',
            'desiredQuantity': 4,
            'overdueMode': 'import_anyway',
        })

        assert resp.status_code == 400, resp.get_json()
        assert 'variety must match' in resp.get_json()['error']
        assert IndoorSeedStart.query.filter_by(user_id=user_a.id).count() == 0

    def test_mismatched_linked_event_plant_id_is_rejected(
        self, auth_client_a, user_a, bed_a
    ):
        event = _make_event(
            user_a,
            garden_bed_id=bed_a.id,
            plant_id='broccoli-1',
            variety='Waltham',
        )

        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'variety': 'Waltham',
            'transplantDate': '2026-05-15T00:00:00Z',
            'desiredQuantity': 4,
            'overdueMode': 'import_anyway',
        })

        assert resp.status_code == 400, resp.get_json()
        body = resp.get_json()
        assert 'plantId must match' in body['error']
        assert body['details']['plantId'] == PLANT_ID
        assert body['details']['linkedPlantId'] == 'broccoli-1'
        assert IndoorSeedStart.query.filter_by(user_id=user_a.id).count() == 0


class TestFromPlantingEventDestinationBedIds:
    def test_explicit_destination_bed_ids_are_persisted(
        self, auth_client_a, user_a, bed_a, bed_a2
    ):
        """Client sends explicit destinationBedIds → stored on the new row."""
        event = _make_event(user_a, garden_bed_id=bed_a.id)

        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'transplantDate': '2026-05-15T00:00:00Z',
            'desiredQuantity': 4,
            # Override the linked event's bed with BOTH beds
            'destinationBedIds': [bed_a.id, bed_a2.id],
            'overdueMode': 'import_anyway',  # see module docstring
        })
        assert resp.status_code == 201, resp.get_json()
        payload = resp.get_json()
        ss_id = payload['indoorSeedStart']['id']

        ss = IndoorSeedStart.query.get(ss_id)
        assert ss.destination_bed_ids is not None
        stored = json.loads(ss.destination_bed_ids)
        assert stored == [bed_a.id, bed_a2.id]

        # Sanity: the three-tier resolver should now surface both beds as
        # destinationBedDetails (tier 1, manual override) — meaning the UI
        # can render both the "Destination" row and the "Transplant Now" button.
        assert payload['indoorSeedStart']['destinationBedDetails'], \
            "destinationBedDetails must be non-empty when destination_bed_ids is set"

    def test_omitted_destination_bed_ids_autofills_from_linked_event(
        self, auth_client_a, user_a, bed_a
    ):
        """No destinationBedIds but linked event has garden_bed_id → auto-fill."""
        event = _make_event(user_a, garden_bed_id=bed_a.id)

        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'transplantDate': '2026-05-15T00:00:00Z',
            'desiredQuantity': 4,
            # destinationBedIds deliberately omitted
            'overdueMode': 'import_anyway',  # see module docstring
        })
        assert resp.status_code == 201, resp.get_json()
        payload = resp.get_json()
        ss_id = payload['indoorSeedStart']['id']

        ss = IndoorSeedStart.query.get(ss_id)
        assert ss.destination_bed_ids is not None, \
            "Expected auto-fill from linked event.garden_bed_id"
        stored = json.loads(ss.destination_bed_ids)
        assert stored == [bed_a.id]

        # destinationBedDetails non-empty — UI gating now passes for tomato.
        details = payload['indoorSeedStart']['destinationBedDetails']
        assert len(details) == 1
        assert details[0]['id'] == bed_a.id

    def test_legacy_seed_start_resolves_destination_from_linked_event(
        self, user_a, bed_a
    ):
        """Older rows may lack destination_bed_ids but still link to a bedded event."""
        event = _make_event(user_a, garden_bed_id=bed_a.id)
        seed_start = _make_seed_start(user_a, event)
        seed_start.destination_bed_ids = None
        db.session.commit()

        payload = seed_start.to_dict()

        assert payload['destinationBedIds'] is None
        assert payload['destinationBedDetails'] == [
            {'id': bed_a.id, 'name': bed_a.name}
        ]

    def test_no_bed_anywhere_leaves_destination_null(
        self, auth_client_a, user_a
    ):
        """Linked event has no garden_bed_id and payload omits destinationBedIds
        → destination_bed_ids stays NULL, existing three-tier fallback still runs."""
        event = _make_event(user_a, garden_bed_id=None)

        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'transplantDate': '2026-05-15T00:00:00Z',
            'desiredQuantity': 4,
            'overdueMode': 'import_anyway',  # see module docstring
        })
        assert resp.status_code == 201, resp.get_json()
        payload = resp.get_json()
        ss_id = payload['indoorSeedStart']['id']

        ss = IndoorSeedStart.query.get(ss_id)
        assert ss.destination_bed_ids is None

    def test_cross_user_bed_id_rejected(
        self, auth_client_a, user_a, bed_a, bed_b_other_user
    ):
        """destinationBedIds containing a bed owned by another user → 400."""
        event = _make_event(user_a, garden_bed_id=bed_a.id)

        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'transplantDate': '2026-05-15T00:00:00Z',
            'desiredQuantity': 4,
            'destinationBedIds': [bed_a.id, bed_b_other_user.id],
            'overdueMode': 'import_anyway',  # see module docstring
        })
        assert resp.status_code == 400, resp.get_json()
        body = resp.get_json()
        assert 'error' in body
        assert 'do not belong to the current user' in body['error']

        # No IndoorSeedStart row created.
        assert IndoorSeedStart.query.filter_by(user_id=user_a.id).count() == 0

    def test_malformed_destination_bed_ids_rejected(
        self, auth_client_a, user_a, bed_a
    ):
        """destinationBedIds must be list of positive ints — reject anything else."""
        event = _make_event(user_a, garden_bed_id=bed_a.id)

        # Not a list
        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'transplantDate': '2026-05-15T00:00:00Z',
            'desiredQuantity': 4,
            'destinationBedIds': 'not-a-list',
        })
        assert resp.status_code == 400
        assert 'list of positive integer' in resp.get_json()['error']

        # List of strings
        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'transplantDate': '2026-05-15T00:00:00Z',
            'desiredQuantity': 4,
            'destinationBedIds': ['1', '2'],
        })
        assert resp.status_code == 400

        # Zero / negative ints
        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'transplantDate': '2026-05-15T00:00:00Z',
            'desiredQuantity': 4,
            'destinationBedIds': [0],
        })
        assert resp.status_code == 400

        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'transplantDate': '2026-05-15T00:00:00Z',
            'desiredQuantity': 4,
            'destinationBedIds': [-5],
        })
        assert resp.status_code == 400

        # No row created in any of the above.
        assert IndoorSeedStart.query.filter_by(user_id=user_a.id).count() == 0

    def test_empty_destination_bed_ids_list_leaves_null_but_autofill_still_runs(
        self, auth_client_a, user_a, bed_a
    ):
        """Explicit empty list + linked event has bed: empty list means
        'no manual override', so auto-fill from linked event kicks in.
        This matches the PUT endpoint semantics at line 999: [] clears override."""
        event = _make_event(user_a, garden_bed_id=bed_a.id)

        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'transplantDate': '2026-05-15T00:00:00Z',
            'desiredQuantity': 4,
            'destinationBedIds': [],
            'overdueMode': 'import_anyway',  # see module docstring
        })
        # Empty list is well-formed (not a validation error). No manual override
        # set, but auto-fill from linked event.garden_bed_id still applies.
        assert resp.status_code == 201, resp.get_json()
        ss_id = resp.get_json()['indoorSeedStart']['id']
        ss = IndoorSeedStart.query.get(ss_id)
        assert ss.destination_bed_ids == json.dumps([bed_a.id])
