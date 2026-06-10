"""
Regression tests for Phase B retest finding #12 and the related grouping-key bug.

Finding #12 (import source ambiguity):
    GET /api/planting-events/needs-indoor-starts was returning rows with no
    plan attribution. Users with multiple plans could not tell which plan a
    row came from. This suite asserts the new per-row ``planId``/``planName``
    fields, resolved via ``PlantingEvent.export_key`` (format
    ``"{user_id}_{plan_item_id}_..."`` — see services/garden_planner_service.py).

Grouping-key bug (discovered during finding #12 investigation):
    The previous group key ``(plant_id, variety, transplant_date)`` silently
    merged rows from different plans that happened to share the same crop,
    variety, and transplant date. The fix adds ``plan_id`` to the key so
    cross-plan rows produce separate output rows. This suite asserts that
    two plans scheduling the same crop+variety+date no longer collapse.

Events with ``export_key = NULL`` (manual events or legacy pre-Feb-2026
entries) are surfaced with ``planId = null`` / ``planName = null`` rather
than hidden — the frontend renders those as "Unknown plan".
"""
from datetime import datetime, timedelta

import pytest

from models import db, GardenBed, GardenPlan, GardenPlanItem, PlantingEvent


PLANT_ID = 'tomato-1'  # weeksIndoors=6 per plant_database


def _make_plan(user, name, year=2027):
    plan = GardenPlan(user_id=user.id, name=name, year=year)
    db.session.add(plan)
    db.session.flush()
    return plan


def _make_plan_item(plan, plant_id=PLANT_ID, variety=None, quantity=4):
    """Minimal GardenPlanItem for plan-attribution lookup."""
    item = GardenPlanItem(
        garden_plan_id=plan.id,
        plant_id=plant_id,
        variety=variety,
        target_value=quantity,
        plant_equivalent=quantity,
    )
    db.session.add(item)
    db.session.flush()
    return item


def _make_event(
    user,
    plan_item=None,
    plant_id=PLANT_ID,
    variety=None,
    transplant_date=None,
    garden_bed_id=None,
    quantity=4,
):
    """Create a PlantingEvent, optionally attributed to a plan item via export_key.

    Uses a far-future transplant date by default so the endpoint's default
    ``include_past=false`` filter does not drop the row.
    """
    if transplant_date is None:
        transplant_date = datetime(2027, 5, 15)
    export_key = None
    if plan_item is not None:
        export_key = "{}_{}_{}_{}".format(
            user.id, plan_item.id, transplant_date.date().isoformat(), 0
        )
    event = PlantingEvent(
        user_id=user.id,
        plant_id=plant_id,
        variety=variety,
        quantity=quantity,
        transplant_date=transplant_date,
        expected_harvest_date=transplant_date + timedelta(days=70),
        garden_bed_id=garden_bed_id,
        export_key=export_key,
    )
    db.session.add(event)
    db.session.commit()
    return event


def _get_rows(client):
    resp = client.get('/api/planting-events/needs-indoor-starts')
    assert resp.status_code == 200, resp.get_json()
    return resp.get_json()['events']


# ---------------------------------------------------------------------------
# Test 1: Two plans, same crop+variety+transplant_date → TWO rows
# ---------------------------------------------------------------------------

def test_two_plans_same_crop_variety_date_no_longer_merge(auth_client_a, user_a):
    """The grouping-key bug: before this fix, events from two plans that
    shared (plant_id, variety, transplant_date) would collapse into one row
    with a cross-plan plantingEventIds array. Now they must produce two
    separate rows with distinct planId/planName."""
    plan_a = _make_plan(user_a, 'Plan Alpha')
    plan_b = _make_plan(user_a, 'Plan Beta')
    item_a = _make_plan_item(plan_a)
    item_b = _make_plan_item(plan_b)

    shared_date = datetime(2027, 5, 15)
    ev_a = _make_event(user_a, plan_item=item_a, transplant_date=shared_date)
    ev_b = _make_event(user_a, plan_item=item_b, transplant_date=shared_date)

    rows = _get_rows(auth_client_a)

    # Must be two rows, not one merged row
    assert len(rows) == 2, (
        "Expected 2 separate rows (one per plan); got {}. Rows: {}".format(len(rows), rows)
    )

    plan_ids = sorted(r['planId'] for r in rows)
    assert plan_ids == sorted([plan_a.id, plan_b.id])

    by_plan = {r['planId']: r for r in rows}
    assert by_plan[plan_a.id]['planName'] == 'Plan Alpha'
    assert by_plan[plan_b.id]['planName'] == 'Plan Beta'

    # Each row's plantingEventIds should contain only its own plan's event
    assert by_plan[plan_a.id]['plantingEventIds'] == [ev_a.id]
    assert by_plan[plan_b.id]['plantingEventIds'] == [ev_b.id]


def test_same_plan_same_crop_date_different_beds_no_longer_merge(auth_client_a, user_a):
    """Plan-only Indoor Starts rows must stay separable by destination bed.

    The frontend planned-bed filter depends on each emitted row carrying the
    bed-specific event ids and bed name. If the backend merges same crop/date
    rows across beds, filtering would hide or show the wrong plan-only seedings.
    """
    plan = _make_plan(user_a, 'Plan Alpha')
    item = _make_plan_item(plan)
    bed_a = GardenBed(user_id=user_a.id, name='North Bed', width=4.0, length=8.0)
    bed_b = GardenBed(user_id=user_a.id, name='South Bed', width=4.0, length=8.0)
    db.session.add_all([bed_a, bed_b])
    db.session.flush()

    shared_date = datetime(2027, 5, 15)
    ev_a = _make_event(
        user_a,
        plan_item=item,
        transplant_date=shared_date,
        garden_bed_id=bed_a.id,
    )
    ev_b = _make_event(
        user_a,
        plan_item=item,
        transplant_date=shared_date,
        garden_bed_id=bed_b.id,
    )

    rows = _get_rows(auth_client_a)

    assert len(rows) == 2
    by_bed = {r['gardenBedId']: r for r in rows}
    assert by_bed[bed_a.id]['gardenBedName'] == 'North Bed'
    assert by_bed[bed_b.id]['gardenBedName'] == 'South Bed'
    assert by_bed[bed_a.id]['plantingEventIds'] == [ev_a.id]
    assert by_bed[bed_b.id]['plantingEventIds'] == [ev_b.id]


# ---------------------------------------------------------------------------
# Test 2: Two plans with different crops → each row attributed correctly
# ---------------------------------------------------------------------------

def test_two_plans_different_crops_each_attributed(auth_client_a, user_a):
    plan_a = _make_plan(user_a, 'Plan Alpha')
    plan_b = _make_plan(user_a, 'Plan Beta')

    item_a = _make_plan_item(plan_a, plant_id='tomato-1')
    item_b = _make_plan_item(plan_b, plant_id='pepper-1')

    _make_event(user_a, plan_item=item_a, plant_id='tomato-1')
    _make_event(user_a, plan_item=item_b, plant_id='pepper-1')

    rows = _get_rows(auth_client_a)

    assert len(rows) == 2
    by_plant = {r['plantId']: r for r in rows}

    assert by_plant['tomato-1']['planId'] == plan_a.id
    assert by_plant['tomato-1']['planName'] == 'Plan Alpha'
    assert by_plant['pepper-1']['planId'] == plan_b.id
    assert by_plant['pepper-1']['planName'] == 'Plan Beta'


# ---------------------------------------------------------------------------
# Test 3: Event with export_key=NULL → planId/planName null (not hidden)
# ---------------------------------------------------------------------------

def test_event_with_null_export_key_surfaces_as_unknown_plan(auth_client_a, user_a):
    """Manual / legacy events (no export_key) must still appear in the
    response so users can still start them indoors; they just show up as
    unattributed (planId/planName = null)."""
    _make_event(user_a, plan_item=None)  # no export_key

    rows = _get_rows(auth_client_a)

    assert len(rows) == 1
    assert rows[0]['planId'] is None
    assert rows[0]['planName'] is None


# ---------------------------------------------------------------------------
# Test 4: Mixed — attributed + unattributed events coexist
# ---------------------------------------------------------------------------

def test_mixed_attributed_and_unattributed_events_coexist(auth_client_a, user_a):
    plan = _make_plan(user_a, 'Plan Gamma')
    item = _make_plan_item(plan)

    # Attributed event
    _make_event(
        user_a, plan_item=item, transplant_date=datetime(2027, 5, 15)
    )
    # Unattributed event (different date so it gets its own group anyway)
    _make_event(
        user_a, plan_item=None, transplant_date=datetime(2027, 6, 15)
    )

    rows = _get_rows(auth_client_a)

    assert len(rows) == 2
    by_plan_id = {r['planId']: r for r in rows}

    # One row has full attribution...
    assert plan.id in by_plan_id
    assert by_plan_id[plan.id]['planName'] == 'Plan Gamma'
    # ...and the other has null attribution
    assert None in by_plan_id
    assert by_plan_id[None]['planName'] is None


# ---------------------------------------------------------------------------
# Test 5: Cross-user isolation — user A never sees user B's plans/events
# ---------------------------------------------------------------------------

def test_cross_user_isolation(auth_client_a, user_a, user_b):
    # User A's plan + event
    plan_a = _make_plan(user_a, "Alice's Plan")
    item_a = _make_plan_item(plan_a)
    ev_a = _make_event(user_a, plan_item=item_a)

    # User B's plan + event (must not leak into A's response)
    plan_b = _make_plan(user_b, "Bob's Plan")
    item_b = _make_plan_item(plan_b)
    _make_event(user_b, plan_item=item_b)

    rows = _get_rows(auth_client_a)

    assert len(rows) == 1
    assert rows[0]['plantingEventIds'] == [ev_a.id]
    assert rows[0]['planId'] == plan_a.id
    assert rows[0]['planName'] == "Alice's Plan"


# ---------------------------------------------------------------------------
# Test 6: Defensive — an export_key whose parsed plan_item_id belongs to a
# different user should NOT leak that other user's plan name.
# ---------------------------------------------------------------------------

def test_malicious_export_key_does_not_leak_cross_user_plan(
    auth_client_a, user_a, user_b
):
    """If somehow an event's export_key parses to a plan_item_id owned by
    another user (data corruption, test artifact, whatever), the plan
    attribution lookup must refuse to resolve it — the join filter restricts
    GardenPlan.user_id to the requesting user."""
    # User B owns the plan item
    plan_b = _make_plan(user_b, "Bob's Private Plan")
    item_b = _make_plan_item(plan_b)

    # User A has an event whose export_key references B's plan-item id
    forged_key = "{}_{}_2027-05-15_0".format(user_a.id, item_b.id)
    event = PlantingEvent(
        user_id=user_a.id,
        plant_id=PLANT_ID,
        quantity=4,
        transplant_date=datetime(2027, 5, 15),
        expected_harvest_date=datetime(2027, 5, 15) + timedelta(days=70),
        export_key=forged_key,
    )
    db.session.add(event)
    db.session.commit()

    rows = _get_rows(auth_client_a)

    assert len(rows) == 1
    # Attribution refuses to resolve — surfaces as unknown plan, not as B's plan
    assert rows[0]['planId'] is None
    assert rows[0]['planName'] is None


# ===========================================================================
# AUDIT-011 Option A: ?planId=<int> scopes response to active plan.
#
# Policy (user-greenlit, option ii on null export_key):
#   - Return rows attributable to the requested plan
#   - Plus rows whose export_key is null or doesn't resolve (labeled
#     "Unknown plan" by the frontend)
#   - Drop rows attributable to OTHER known plans
#   - Omitted/empty planId preserves cross-plan backward-compat behavior
# ===========================================================================


def _get_rows_for_plan(client, plan_id):
    resp = client.get(
        '/api/planting-events/needs-indoor-starts?planId={}'.format(plan_id)
    )
    assert resp.status_code == 200, resp.get_json()
    return resp.get_json()['events']


def test_plan_id_filter_returns_only_matching_plan_rows(auth_client_a, user_a):
    """?planId=<A.id> returns only A's rows, no B rows (different crops so
    they wouldn't group together anyway — isolates attribution logic)."""
    plan_a = _make_plan(user_a, 'Plan Alpha')
    plan_b = _make_plan(user_a, 'Plan Beta')
    item_a = _make_plan_item(plan_a, plant_id='tomato-1')
    item_b = _make_plan_item(plan_b, plant_id='pepper-1')

    _make_event(user_a, plan_item=item_a, plant_id='tomato-1')
    _make_event(user_a, plan_item=item_b, plant_id='pepper-1')

    rows = _get_rows_for_plan(auth_client_a, plan_a.id)

    assert len(rows) == 1
    assert rows[0]['plantId'] == 'tomato-1'
    assert rows[0]['planId'] == plan_a.id
    assert rows[0]['planName'] == 'Plan Alpha'


def test_plan_id_filter_includes_null_export_key_rows(auth_client_a, user_a):
    """?planId=<A.id> includes A's rows AND null-export_key rows. B rows
    excluded. The null-export_key row must surface with planId=None so the
    frontend can render 'Unknown plan'."""
    plan_a = _make_plan(user_a, 'Plan Alpha')
    plan_b = _make_plan(user_a, 'Plan Beta')
    item_a = _make_plan_item(plan_a, plant_id='tomato-1')
    item_b = _make_plan_item(plan_b, plant_id='pepper-1')

    _make_event(
        user_a, plan_item=item_a, plant_id='tomato-1',
        transplant_date=datetime(2027, 5, 15),
    )
    _make_event(
        user_a, plan_item=item_b, plant_id='pepper-1',
        transplant_date=datetime(2027, 5, 20),
    )
    # Null export_key — should remain visible under scoped mode
    _make_event(
        user_a, plan_item=None, plant_id='eggplant-1',
        transplant_date=datetime(2027, 6, 1),
    )

    rows = _get_rows_for_plan(auth_client_a, plan_a.id)

    plant_ids = sorted(r['plantId'] for r in rows)
    assert plant_ids == ['eggplant-1', 'tomato-1'], (
        "Expected only plan-A row + null-export_key row; got {}".format(plant_ids)
    )
    by_plant = {r['plantId']: r for r in rows}
    assert by_plant['tomato-1']['planId'] == plan_a.id
    assert by_plant['eggplant-1']['planId'] is None
    assert by_plant['eggplant-1']['planName'] is None


def test_plan_id_filter_excludes_other_plans_even_when_group_key_would_merge(
    auth_client_a, user_a
):
    """Two plans sharing the same (plant_id, variety, transplant_date) would
    have collapsed under the old group key. With the plan_id-aware key they
    stay separate, and the planId filter must drop the non-matching plan's
    row entirely (not merge, not attribute to the requested plan)."""
    plan_a = _make_plan(user_a, 'Plan Alpha')
    plan_b = _make_plan(user_a, 'Plan Beta')
    item_a = _make_plan_item(plan_a)
    item_b = _make_plan_item(plan_b)

    shared_date = datetime(2027, 5, 15)
    ev_a = _make_event(user_a, plan_item=item_a, transplant_date=shared_date)
    _make_event(user_a, plan_item=item_b, transplant_date=shared_date)

    rows = _get_rows_for_plan(auth_client_a, plan_a.id)

    assert len(rows) == 1
    assert rows[0]['planId'] == plan_a.id
    assert rows[0]['planName'] == 'Plan Alpha'
    assert rows[0]['plantingEventIds'] == [ev_a.id]


def test_plan_id_filter_rejects_other_users_plan(
    auth_client_a, user_a, user_b
):
    """?planId=<user_b.plan.id> must NOT leak. Return 404, no events body."""
    plan_b = _make_plan(user_b, "Bob's Plan")
    # Give user A an event so a permissive backend would produce non-empty rows
    plan_a = _make_plan(user_a, "Alice's Plan")
    item_a = _make_plan_item(plan_a)
    _make_event(user_a, plan_item=item_a)

    resp = auth_client_a.get(
        '/api/planting-events/needs-indoor-starts?planId={}'.format(plan_b.id)
    )
    assert resp.status_code == 404, resp.get_json()
    body = resp.get_json()
    assert 'error' in body
    # Must not contain row data
    assert 'events' not in body


@pytest.mark.parametrize('bad_value', ['abc', '-1', '0', '1.5', ' '])
def test_plan_id_filter_rejects_malformed_value(auth_client_a, bad_value):
    """Non-integer, zero, or negative values reject with 400."""
    resp = auth_client_a.get(
        '/api/planting-events/needs-indoor-starts?planId={}'.format(bad_value)
    )
    assert resp.status_code == 400, (bad_value, resp.get_json())
    assert 'error' in resp.get_json()


def test_omitted_plan_id_preserves_cross_plan_behavior(auth_client_a, user_a):
    """No planId param at all → response returns rows from ALL of user A's
    plans (existing cross-plan baseline / backward-compat)."""
    plan_a = _make_plan(user_a, 'Plan Alpha')
    plan_b = _make_plan(user_a, 'Plan Beta')
    item_a = _make_plan_item(plan_a, plant_id='tomato-1')
    item_b = _make_plan_item(plan_b, plant_id='pepper-1')

    _make_event(user_a, plan_item=item_a, plant_id='tomato-1')
    _make_event(user_a, plan_item=item_b, plant_id='pepper-1')

    rows = _get_rows(auth_client_a)  # no planId

    plant_ids = sorted(r['plantId'] for r in rows)
    assert plant_ids == ['pepper-1', 'tomato-1']
    by_plant = {r['plantId']: r for r in rows}
    assert by_plant['tomato-1']['planId'] == plan_a.id
    assert by_plant['pepper-1']['planId'] == plan_b.id
