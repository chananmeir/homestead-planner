"""
Regression tests for the cascade deletion behavior of
DELETE /api/indoor-seed-starts/<id> (Option B — conservative).

When a user deletes an Indoor Seed Starting entry, the handler must:
- Delete the linked PlantingEvent (matched directly by
  IndoorSeedStart.planting_event_id).
- Delete any PlantedItem whose source_plan_item_id points at the linked
  GardenPlanItem (NOT by bed/plant/position — that would risk killing
  unrelated successions sharing the same slot).
- Always delete the seed start itself (and any linked plan items).
- Leave unrelated data alone.

See plan: snuggly-marinating-canyon.md.
"""
from datetime import datetime, date

import pytest

from models import (
    db,
    GardenBed,
    GardenPlan,
    GardenPlanItem,
    IndoorSeedStart,
    PlantedItem,
    PlantingEvent,
)
from tests.conftest import login_as


@pytest.fixture
def seed_start_context(full_db, user_a):
    """Set up common fixtures: bed, plan, plan item, seed start, planting event."""
    bed = GardenBed(user_id=user_a.id, name='Test Bed A', width=4.0, length=8.0)
    full_db.session.add(bed)
    full_db.session.flush()

    plan = GardenPlan(user_id=user_a.id, name='2026 Plan', year=2026)
    full_db.session.add(plan)
    full_db.session.flush()

    ctx = {'user': user_a, 'bed': bed, 'plan': plan}
    return ctx


def _make_seed_start(user, plant_id='tomato-1', planting_event_id=None):
    ss = IndoorSeedStart(
        user_id=user.id,
        plant_id=plant_id,
        start_date=datetime(2026, 3, 1),
        seeds_started=3,
        planting_event_id=planting_event_id,
    )
    db.session.add(ss)
    db.session.flush()
    return ss


def _make_plan_item(plan, user, plant_id='tomato-1', indoor_seed_start_id=None):
    pi = GardenPlanItem(
        garden_plan_id=plan.id,
        user_id=user.id,
        plant_id=plant_id,
        target_value=1.0,
        plant_equivalent=1,
        indoor_seed_start_id=indoor_seed_start_id,
        source='indoor-seed-start' if indoor_seed_start_id else None,
    )
    db.session.add(pi)
    db.session.flush()
    return pi


def _make_planting_event(user, bed, plant_id='tomato-1'):
    ev = PlantingEvent(
        user_id=user.id,
        event_type='planting',
        plant_id=plant_id,
        garden_bed_id=bed.id,
        quantity=3,
        transplant_date=datetime(2026, 5, 1),
    )
    db.session.add(ev)
    db.session.flush()
    return ev


def _make_planted_item(
    user, bed, plant_id='tomato-1', source_plan_item_id=None, pos=(0, 0)
):
    p = PlantedItem(
        user_id=user.id,
        plant_id=plant_id,
        garden_bed_id=bed.id,
        position_x=pos[0],
        position_y=pos[1],
        quantity=1,
        source_plan_item_id=source_plan_item_id,
    )
    db.session.add(p)
    db.session.flush()
    return p


# Note: GardenPlanItem lacks a user_id column in our lookup query — it was
# added for user_id filtering via the join on garden_plan.user_id upstream.
# We still add user_id on the item here if the column exists (FK forward-
# compat). If GardenPlanItem.user_id is not a real column, strip it from
# the factory. Let's verify via introspection at test-collect time.
_HAS_USER_ID_ON_PLAN_ITEM = 'user_id' in GardenPlanItem.__table__.columns


def _make_plan_item_safe(plan, user, plant_id='tomato-1', indoor_seed_start_id=None):
    kwargs = dict(
        garden_plan_id=plan.id,
        plant_id=plant_id,
        target_value=1.0,
        plant_equivalent=1,
        indoor_seed_start_id=indoor_seed_start_id,
        source='indoor-seed-start' if indoor_seed_start_id else None,
    )
    if _HAS_USER_ID_ON_PLAN_ITEM:
        kwargs['user_id'] = user.id
    pi = GardenPlanItem(**kwargs)
    db.session.add(pi)
    db.session.flush()
    return pi


class TestSeedStartDeleteCascade:
    """Covers the cascade deletion contract of DELETE /api/indoor-seed-starts/<id>."""

    def test_a_linked_seed_start_with_planted_item_cascades_both(
        self, client, user_a, seed_start_context
    ):
        """(A) Linked seed-start + PlantedItem → both deleted, plan item removed."""
        ctx = seed_start_context
        event = _make_planting_event(user_a, ctx['bed'])
        seed_start = _make_seed_start(user_a, planting_event_id=event.id)
        plan_item = _make_plan_item_safe(
            ctx['plan'], user_a, indoor_seed_start_id=seed_start.id
        )
        placed = _make_planted_item(
            user_a, ctx['bed'], source_plan_item_id=plan_item.id
        )
        db.session.commit()

        ss_id = seed_start.id
        pi_id = plan_item.id
        ev_id = event.id
        pl_id = placed.id

        login_as(client, user_a)
        resp = client.delete(f'/api/indoor-seed-starts/{ss_id}')

        assert resp.status_code == 200, resp.get_json()
        body = resp.get_json()
        assert body['deletedPlantedItems'] == 1
        assert body['deletedPlantingEvent'] is True

        assert IndoorSeedStart.query.get(ss_id) is None
        assert GardenPlanItem.query.get(pi_id) is None
        assert PlantingEvent.query.get(ev_id) is None
        assert PlantedItem.query.get(pl_id) is None

    def test_b_linked_event_no_placement(self, client, user_a, seed_start_context):
        """(B) Linked PlantingEvent but no PlantedItem yet → event deleted, no error."""
        ctx = seed_start_context
        event = _make_planting_event(user_a, ctx['bed'])
        seed_start = _make_seed_start(user_a, planting_event_id=event.id)
        _make_plan_item_safe(
            ctx['plan'], user_a, indoor_seed_start_id=seed_start.id
        )
        db.session.commit()

        ss_id = seed_start.id
        ev_id = event.id

        login_as(client, user_a)
        resp = client.delete(f'/api/indoor-seed-starts/{ss_id}')

        assert resp.status_code == 200
        body = resp.get_json()
        assert body['deletedPlantedItems'] == 0
        assert body['deletedPlantingEvent'] is True
        assert PlantingEvent.query.get(ev_id) is None

    def test_c_manually_created_seed_start(self, client, user_a, seed_start_context):
        """(C) Manually-created seed-start (no plan item, no event) → clean delete."""
        seed_start = _make_seed_start(user_a, planting_event_id=None)
        db.session.commit()

        ss_id = seed_start.id

        login_as(client, user_a)
        resp = client.delete(f'/api/indoor-seed-starts/{ss_id}')

        assert resp.status_code == 200
        body = resp.get_json()
        assert body['deletedPlantedItems'] == 0
        assert body['deletedPlantingEvent'] is False
        assert IndoorSeedStart.query.get(ss_id) is None

    def test_d_succession_deletes_all_linked_placements(
        self, client, user_a, seed_start_context
    ):
        """(D) Two PlantedItems linked via source_plan_item_id → both deleted."""
        ctx = seed_start_context
        event = _make_planting_event(user_a, ctx['bed'])
        seed_start = _make_seed_start(user_a, planting_event_id=event.id)
        plan_item = _make_plan_item_safe(
            ctx['plan'], user_a, indoor_seed_start_id=seed_start.id
        )
        p1 = _make_planted_item(
            user_a, ctx['bed'], source_plan_item_id=plan_item.id, pos=(0, 0)
        )
        p2 = _make_planted_item(
            user_a, ctx['bed'], source_plan_item_id=plan_item.id, pos=(1, 1)
        )
        db.session.commit()

        ss_id = seed_start.id
        p1_id, p2_id = p1.id, p2.id

        login_as(client, user_a)
        resp = client.delete(f'/api/indoor-seed-starts/{ss_id}')

        assert resp.status_code == 200
        body = resp.get_json()
        assert body['deletedPlantedItems'] == 2
        assert PlantedItem.query.get(p1_id) is None
        assert PlantedItem.query.get(p2_id) is None

    def test_e_unrelated_plantings_are_preserved(
        self, client, user_a, seed_start_context
    ):
        """(E) Unrelated PlantedItem at the same bed/plant/position — NOT linked
        via source_plan_item_id — must be PRESERVED. This is the critical
        assertion for Option B's conservative matcher.
        """
        ctx = seed_start_context
        event = _make_planting_event(user_a, ctx['bed'])
        seed_start = _make_seed_start(user_a, planting_event_id=event.id)
        plan_item = _make_plan_item_safe(
            ctx['plan'], user_a, indoor_seed_start_id=seed_start.id
        )
        # Linked placement (will be deleted)
        linked = _make_planted_item(
            user_a, ctx['bed'], source_plan_item_id=plan_item.id, pos=(0, 0)
        )
        # Unrelated placement at SAME bed/plant/position, no source_plan_item_id
        unrelated = _make_planted_item(
            user_a, ctx['bed'], source_plan_item_id=None, pos=(0, 0)
        )
        db.session.commit()

        ss_id = seed_start.id
        linked_id = linked.id
        unrelated_id = unrelated.id

        login_as(client, user_a)
        resp = client.delete(f'/api/indoor-seed-starts/{ss_id}')

        assert resp.status_code == 200
        body = resp.get_json()
        assert body['deletedPlantedItems'] == 1
        assert PlantedItem.query.get(linked_id) is None
        # Unrelated placement at same slot MUST survive
        assert PlantedItem.query.get(unrelated_id) is not None
