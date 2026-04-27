"""
Regression tests for Phase B finding #9:
Placing a plant in the Garden Designer must NOT duplicate an existing
IndoorSeedStart. If a matching IndoorSeedStart already exists (e.g. imported
by the user, or auto-created by an earlier flow), placement should:
  1. Leave the IndoorSeedStart row count unchanged.
  2. Advance that existing row's status to 'transplanted'.
  3. Link the existing row to the new PlantingEvent via planting_event_id.

Bug symptom: a new Indoor Start card appeared after the user dragged lettuce
onto a designer cell, even though a matching imported start already existed.
Fix lives in backend/blueprints/gardens_bp.py:
  - _find_existing_indoor_seed_start (new helper)
  - _link_existing_indoor_seed_start (new helper)
  - Call sites in POST /api/planted-items and POST /api/planted-items/batch
"""
import json
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


def _make_existing_seed_start(user, plant_id=PLANT_ID, variety=None,
                              expected_transplant=datetime(2026, 5, 1),
                              start_date=datetime(2026, 3, 20),
                              status='growing'):
    ss = IndoorSeedStart(
        user_id=user.id,
        plant_id=plant_id,
        variety=variety,
        start_date=start_date,
        expected_transplant_date=expected_transplant,
        seeds_started=5,
        status=status,
    )
    db.session.add(ss)
    db.session.commit()
    return ss


class TestPlacementDoesNotDuplicateIndoorStart:
    def test_placement_links_existing_seed_start_instead_of_duplicating(
        self, auth_client_a, user_a, bed_a
    ):
        """User has an existing IndoorSeedStart for tomato; dragging tomato
        onto the bed should link+advance that start, not create a new one."""
        ss = _make_existing_seed_start(
            user_a,
            plant_id=PLANT_ID,
            expected_transplant=datetime(2026, 5, 1),
        )
        before_count = IndoorSeedStart.query.filter_by(user_id=user_a.id).count()
        assert before_count == 1

        resp = auth_client_a.post('/api/planted-items', json={
            'plantId': PLANT_ID,
            'gardenBedId': bed_a.id,
            'plantedDate': '2026-05-01',
            'position': {'x': 0, 'y': 0},
            'quantity': 1,
            # plantingMethod omitted on purpose -> backend auto-detects
            # 'transplant' because weeksIndoors>0 for tomato-1.
        })
        assert resp.status_code == 201, resp.get_json()
        payload = resp.get_json()

        # IndoorSeedStart count unchanged — no duplicate.
        after_count = IndoorSeedStart.query.filter_by(user_id=user_a.id).count()
        assert after_count == 1, (
            f"Expected 1 IndoorSeedStart, got {after_count}. "
            'A duplicate was created during placement (Phase B finding #9).'
        )

        # Existing start was advanced to transplanted and linked to the new event.
        db.session.expire_all()
        ss_refreshed = IndoorSeedStart.query.get(ss.id)
        assert ss_refreshed.status == 'transplanted'
        assert ss_refreshed.planting_event_id is not None

        # Response should reflect linking (not creation).
        assert payload.get('indoorSeedStartLinked') is True
        assert payload.get('indoorSeedStartCreated') in (False, None)
        assert payload.get('indoorSeedStartId') == ss.id

        # PlantingEvent exists and matches the linked id.
        ev = PlantingEvent.query.get(ss_refreshed.planting_event_id)
        assert ev is not None
        assert ev.plant_id == PLANT_ID
        assert ev.garden_bed_id == bed_a.id

    def test_placement_creates_new_when_no_matching_seed_start(
        self, auth_client_a, user_a, bed_a
    ):
        """If no existing IndoorSeedStart matches, placement should still
        auto-create one (existing behavior preserved)."""
        before = IndoorSeedStart.query.filter_by(user_id=user_a.id).count()
        assert before == 0

        resp = auth_client_a.post('/api/planted-items', json={
            'plantId': PLANT_ID,
            'gardenBedId': bed_a.id,
            'plantedDate': '2026-05-01',
            'position': {'x': 0, 'y': 0},
            'quantity': 1,
        })
        assert resp.status_code == 201, resp.get_json()

        after = IndoorSeedStart.query.filter_by(user_id=user_a.id).count()
        assert after == 1, 'Expected one auto-created IndoorSeedStart'

        payload = resp.get_json()
        assert payload.get('indoorSeedStartCreated') is True
        assert payload.get('indoorSeedStartLinked') in (False, None)

    def test_placement_matches_variety_exactly(
        self, auth_client_a, user_a, bed_a
    ):
        """Variety must match: an existing 'Roma' start should NOT be
        consumed by placing a 'Brandywine' — different varieties."""
        ss_roma = _make_existing_seed_start(
            user_a, variety='Roma', expected_transplant=datetime(2026, 5, 1)
        )
        before = IndoorSeedStart.query.filter_by(user_id=user_a.id).count()
        assert before == 1

        resp = auth_client_a.post('/api/planted-items', json={
            'plantId': PLANT_ID,
            'variety': 'Brandywine',
            'gardenBedId': bed_a.id,
            'plantedDate': '2026-05-01',
            'position': {'x': 0, 'y': 0},
            'quantity': 1,
        })
        assert resp.status_code == 201, resp.get_json()

        # A new start should have been created for Brandywine; the Roma
        # start is untouched.
        after = IndoorSeedStart.query.filter_by(user_id=user_a.id).count()
        assert after == 2, f'Expected 2 starts (Roma untouched + new Brandywine), got {after}'

        db.session.expire_all()
        roma_refreshed = IndoorSeedStart.query.get(ss_roma.id)
        assert roma_refreshed.status == 'growing'  # unchanged
        assert roma_refreshed.planting_event_id is None  # still unlinked

    def test_placement_skips_transplanted_seed_starts(
        self, auth_client_a, user_a, bed_a
    ):
        """An IndoorSeedStart already in 'transplanted' status must NOT be
        reused — it's already been consumed."""
        ss_done = _make_existing_seed_start(
            user_a, status='transplanted',
            expected_transplant=datetime(2026, 5, 1),
        )
        before = IndoorSeedStart.query.filter_by(user_id=user_a.id).count()
        assert before == 1

        resp = auth_client_a.post('/api/planted-items', json={
            'plantId': PLANT_ID,
            'gardenBedId': bed_a.id,
            'plantedDate': '2026-05-01',
            'position': {'x': 0, 'y': 0},
            'quantity': 1,
        })
        assert resp.status_code == 201, resp.get_json()

        # The already-transplanted start is left alone; a new one is created.
        after = IndoorSeedStart.query.filter_by(user_id=user_a.id).count()
        assert after == 2

        db.session.expire_all()
        assert IndoorSeedStart.query.get(ss_done.id).planting_event_id is None

    def test_auto_created_seed_start_captures_placement_bed(
        self, auth_client_a, user_a, bed_a
    ):
        """When placement auto-creates an IndoorSeedStart (no matching
        existing record), the new row must record the placement bed in
        destination_bed_ids so the Indoor Starts card shows the correct
        Planned bed instead of "not assigned".

        Regression for: indoor-start-auto-create-missing-planned-bed-finding.

        Why this matters: get_current_garden_plan_count() intentionally
        excludes the self-linked PlantingEvent from bed resolution (it's a
        placeholder, not a plan entry). With no other matching events and
        no GardenPlanItem (placement bypassed the season planner), bed
        resolution would return empty unless destination_bed_ids is set.
        """
        before = IndoorSeedStart.query.filter_by(user_id=user_a.id).count()
        assert before == 0

        resp = auth_client_a.post('/api/planted-items', json={
            'plantId': PLANT_ID,
            'gardenBedId': bed_a.id,
            'plantedDate': '2026-05-01',
            'position': {'x': 0, 'y': 0},
            'quantity': 1,
        })
        assert resp.status_code == 201, resp.get_json()
        payload = resp.get_json()
        assert payload.get('indoorSeedStartCreated') is True

        # Exactly one IndoorSeedStart was auto-created.
        ss = IndoorSeedStart.query.filter_by(user_id=user_a.id).one()

        # Raw column persists the placement bed.
        assert ss.destination_bed_ids is not None, (
            'destination_bed_ids must be set so Indoor Starts card can '
            'render Planned bed; got NULL.'
        )
        assert json.loads(ss.destination_bed_ids) == [bed_a.id]

        # to_dict() surfaces the bed downstream (frontend reads these keys).
        as_dict = ss.to_dict()
        assert as_dict['destinationBedIds'] == [bed_a.id]
        assert as_dict['hasManualDestination'] is True
        # destinationBeds is the human-readable name list used by the card.
        assert as_dict['destinationBeds'] == [bed_a.name]
        # destinationBedDetails is the resolved {id, name} list used by the UI.
        details = as_dict['destinationBedDetails']
        assert len(details) == 1
        assert details[0]['id'] == bed_a.id
        assert details[0]['name'] == bed_a.name

    def test_placement_respects_user_isolation(
        self, full_app, user_a, user_b, bed_a
    ):
        """A's IndoorSeedStart must not be consumed when B places a plant."""
        # Seed start belongs to user A.
        ss_a = _make_existing_seed_start(
            user_a, expected_transplant=datetime(2026, 5, 1)
        )
        # B has their own bed.
        bed_b = GardenBed(user_id=user_b.id, name='B bed', width=4.0, length=4.0)
        db.session.add(bed_b)
        db.session.commit()

        client_b = full_app.test_client()
        login_as(client_b, user_b)
        resp = client_b.post('/api/planted-items', json={
            'plantId': PLANT_ID,
            'gardenBedId': bed_b.id,
            'plantedDate': '2026-05-01',
            'position': {'x': 0, 'y': 0},
            'quantity': 1,
        })
        assert resp.status_code == 201, resp.get_json()

        db.session.expire_all()
        # A's start is still 'growing' and unlinked.
        ss_a_refreshed = IndoorSeedStart.query.get(ss_a.id)
        assert ss_a_refreshed.status == 'growing'
        assert ss_a_refreshed.planting_event_id is None
        # B got their own new start.
        b_starts = IndoorSeedStart.query.filter_by(user_id=user_b.id).count()
        assert b_starts == 1
