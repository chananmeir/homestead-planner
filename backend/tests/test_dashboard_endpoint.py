"""
Tests for GET /api/dashboard/today.

Covers:
- Happy path: each signal category populated and returned correctly.
- Empty state: user with no data returns 200 with empty arrays.
- User isolation: another user's data must not leak in.
- Date param: future date shifts harvestReady results.
- Defensive: malformed event_details JSON must not 500 the endpoint.
- Invalid date input: returns 400.
"""
from datetime import datetime, date, timedelta

# [UNUSED-2026-06-10] import never used
# import pytest

from models import (
    db,
    PlantingEvent,
    PlantedItem,
    GardenBed,
    CompostPile,
    SeedInventory,
    Chicken,
    EggProduction,
    IndoorSeedStart,
    DashboardSnooze,
)
# [UNUSED-2026-06-10] import never used
# from tests.conftest import login_as


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

TODAY = date(2026, 4, 14)


def _make_bed(user_id, name='Bed A'):
    bed = GardenBed(user_id=user_id, name=name, width=4.0, length=8.0)
    db.session.add(bed)
    db.session.commit()
    return bed


def _make_event(user_id, **kwargs):
    defaults = {
        'event_type': 'planting',
        'plant_id': 'tomato-1',
        'variety': 'Roma',
        'quantity': 4,
    }
    defaults.update(kwargs)
    event = PlantingEvent(user_id=user_id, **defaults)
    db.session.add(event)
    db.session.commit()
    return event


def _get_today(client, params=''):
    url = '/api/dashboard/today'
    if params:
        url += '?' + params
    return client.get(url)


# ---------------------------------------------------------------------------
# Auth / empty state
# ---------------------------------------------------------------------------

class TestDashboardAuthAndShape:

    def test_requires_auth(self, client):
        resp = client.get('/api/dashboard/today')
        assert resp.status_code == 401

    def test_empty_state_returns_200_with_empty_arrays(self, auth_client_a):
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.status_code == 200
        body = resp.get_json()

        assert body['date'] == TODAY.isoformat()
        assert 'meta' in body
        assert 'generatedAt' in body['meta']

        signals = body['signals']
        # Empty arrays for list-type signals
        for key in ('harvestReady', 'indoorStartsDue', 'transplantsDue',
                    'directSeedDue', 'compostOverdue', 'seedLowStock',
                    'seedExpiring', 'livestockActionsDue'):
            assert signals[key] == [], f"{key} should be []"

        # Object-type signals have structural defaults
        assert signals['frostRisk']['atRisk'] is False
        assert signals['rainAlert']['expected'] is False

    def test_invalid_date_format_returns_400(self, auth_client_a):
        resp = _get_today(auth_client_a, 'date=not-a-date')
        assert resp.status_code == 400
        assert 'error' in resp.get_json()


# ---------------------------------------------------------------------------
# Individual signals
# ---------------------------------------------------------------------------

class TestHarvestReady:

    def test_includes_overdue_harvests(self, auth_client_a, user_a):
        bed = _make_bed(user_a.id, 'Bed Alpha')
        _make_event(
            user_a.id,
            plant_id='lettuce-1',
            variety='Buttercrunch',
            garden_bed_id=bed.id,
            expected_harvest_date=datetime(2026, 4, 10),  # 4 days ago
            quantity=12,
            quantity_completed=12,
            completed=True,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.status_code == 200
        hr = resp.get_json()['signals']['harvestReady']
        assert len(hr) == 1
        row = hr[0]
        assert row['variety'] == 'Buttercrunch'
        assert row['bedName'] == 'Bed Alpha'
        assert row['bedId'] == bed.id
        assert row['daysPastExpected'] == 4
        assert row['quantity'] == 12

    def test_excludes_unplanted_scheduled_harvests(self, auth_client_a, user_a):
        _make_event(
            user_a.id,
            expected_harvest_date=datetime(2026, 4, 10),
            quantity=4,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.get_json()['signals']['harvestReady'] == []

    def test_excludes_harvest_completed_events(self, auth_client_a, user_a):
        _make_event(
            user_a.id,
            expected_harvest_date=datetime(2026, 4, 10),
            quantity=4,
            quantity_completed=4,
            completed=True,
            harvest_completed=True,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.get_json()['signals']['harvestReady'] == []

    def test_excludes_harvested_matching_planted_items(self, auth_client_a, user_a):
        bed = _make_bed(user_a.id, 'Bed Spinach')
        _make_event(
            user_a.id,
            plant_id='spinach-1',
            variety='Bloomsdale Long Standing',
            garden_bed_id=bed.id,
            direct_seed_date=datetime(2026, 3, 25),
            expected_harvest_date=datetime(2026, 5, 4),
            position_x=0,
            position_y=0,
            quantity=3,
            quantity_completed=3,
            completed=True,
        )
        planted_item = PlantedItem(
            user_id=user_a.id,
            plant_id='spinach-1',
            variety='Bloomsdale Long Standing',
            garden_bed_id=bed.id,
            planted_date=datetime(2026, 3, 25),
            harvest_date=datetime(2026, 5, 8),
            position_x=0,
            position_y=0,
            quantity=3,
            status='harvested',
        )
        db.session.add(planted_item)
        db.session.commit()

        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.get_json()['signals']['harvestReady'] == []

    def test_excludes_future_harvests_by_default(self, auth_client_a, user_a):
        _make_event(
            user_a.id,
            expected_harvest_date=datetime(2026, 5, 1),  # after TODAY
            quantity_completed=4,
            completed=True,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.get_json()['signals']['harvestReady'] == []

    def test_future_date_param_shifts_results(self, auth_client_a, user_a):
        """Passing a future date should include events that weren't due yet."""
        _make_event(
            user_a.id,
            expected_harvest_date=datetime(2026, 5, 1),
            quantity=3,
            quantity_completed=3,
            completed=True,
        )
        # Today: empty
        resp_today = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp_today.get_json()['signals']['harvestReady'] == []

        # Future date: should appear
        future = date(2026, 5, 2).isoformat()
        resp_future = _get_today(auth_client_a, f'date={future}')
        hr = resp_future.get_json()['signals']['harvestReady']
        assert len(hr) == 1
        assert hr[0]['quantity'] == 3


class TestIndoorStartsDue:

    def test_includes_seed_start_today(self, auth_client_a, user_a):
        _make_event(
            user_a.id,
            plant_id='pepper-1',
            variety='Jalapeno',
            seed_start_date=datetime(2026, 4, 14),
            quantity=10,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        rows = resp.get_json()['signals']['indoorStartsDue']
        assert len(rows) == 1
        assert rows[0]['variety'] == 'Jalapeno'
        assert rows[0]['seedStartDate'] == '2026-04-14'

    def test_excludes_completed(self, auth_client_a, user_a):
        _make_event(
            user_a.id,
            seed_start_date=datetime(2026, 4, 14),
            quantity=4,
            quantity_completed=4,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.get_json()['signals']['indoorStartsDue'] == []

    def test_linked_seeded_indoor_start_excludes_incomplete_event(
        self, auth_client_a, user_a,
    ):
        """A linked IndoorSeedStart can be seeded while its outdoor
        PlantingEvent stays incomplete until transplant. That must not keep
        the original seed-start task in Needs Attention."""
        event = _make_event(
            user_a.id,
            plant_id='pumpkin-1',
            variety='Cinderella',
            seed_start_date=datetime(2026, 4, 14),
            quantity=3,
            completed=False,
            quantity_completed=0,
        )
        _make_seed_start(
            user_a.id,
            plant_id='pumpkin-1',
            variety='Cinderella',
            start_date=datetime(2026, 4, 14),
            seeds_started=3,
            status='seeded',
            planting_event_id=event.id,
        )

        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        body = resp.get_json()

        assert body['signals']['indoorStartsDue'] == []
        assert body['missed']['indoorStartsDue'] == []

    def test_other_users_seeded_indoor_start_does_not_exclude_event(
        self, auth_client_a, user_a, user_b,
    ):
        """The linked-status lookup must stay user-scoped."""
        event = _make_event(
            user_a.id,
            plant_id='pumpkin-1',
            variety='Cinderella',
            seed_start_date=datetime(2026, 4, 14),
            quantity=3,
        )
        _make_seed_start(
            user_b.id,
            plant_id='pumpkin-1',
            variety='Cinderella',
            start_date=datetime(2026, 4, 14),
            seeds_started=3,
            status='seeded',
            planting_event_id=event.id,
        )

        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        rows = resp.get_json()['signals']['indoorStartsDue']

        assert len(rows) == 1
        assert rows[0]['plantingEventId'] == event.id


def _make_seed_start(user_id, **kwargs):
    defaults = {
        'plant_id': 'amaranth-1',
        'variety': None,
        'start_date': datetime(2026, 4, 14),
        'seeds_started': 3,
        'status': 'planned',
    }
    defaults.update(kwargs)
    ss = IndoorSeedStart(user_id=user_id, **defaults)
    db.session.add(ss)
    db.session.commit()
    return ss


class TestIndoorStartsDueFromSeedStartRecords:
    """Standalone IndoorSeedStart records should appear in indoorStartsDue
    when status='planned' and start_date has arrived, so users can act on
    indoor plantings they created in the Grow → Indoor Starts tab.
    """

    def test_standalone_seed_start_appears(self, auth_client_a, user_a):
        ss = _make_seed_start(user_a.id, plant_id='amaranth-1', seeds_started=3)
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        rows = resp.get_json()['signals']['indoorStartsDue']
        assert len(rows) == 1
        assert rows[0]['indoorSeedStartId'] == ss.id
        assert rows[0]['plantingEventId'] is None
        assert rows[0]['seedStartDate'] == '2026-04-14'
        assert rows[0]['quantity'] == 3

    def test_seed_start_linked_to_event_not_double_counted(self, auth_client_a, user_a):
        event = _make_event(
            user_a.id,
            plant_id='pepper-1',
            seed_start_date=datetime(2026, 4, 14),
            quantity=10,
        )
        _make_seed_start(
            user_a.id,
            plant_id='pepper-1',
            planting_event_id=event.id,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        rows = resp.get_json()['signals']['indoorStartsDue']
        assert len(rows) == 1  # deduped
        assert rows[0]['plantingEventId'] == event.id

    def test_seeded_status_is_excluded(self, auth_client_a, user_a):
        """Seed starts that have already been seeded are no longer 'due'."""
        _make_seed_start(user_a.id, status='seeded')
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.get_json()['signals']['indoorStartsDue'] == []

    def test_future_start_date_is_excluded(self, auth_client_a, user_a):
        _make_seed_start(user_a.id, start_date=datetime(2026, 5, 1))
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.get_json()['signals']['indoorStartsDue'] == []


class TestTransplantsDue:

    def test_includes_transplants_due(self, auth_client_a, user_a):
        bed = _make_bed(user_a.id, 'Bed Beta')
        _make_event(
            user_a.id,
            plant_id='tomato-1',
            variety='Cherokee Purple',
            garden_bed_id=bed.id,
            transplant_date=datetime(2026, 4, 14),
            quantity=4,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        rows = resp.get_json()['signals']['transplantsDue']
        assert len(rows) == 1
        row = rows[0]
        assert row['variety'] == 'Cherokee Purple'
        assert row['bedName'] == 'Bed Beta'
        assert row['bedId'] == bed.id
        assert row['transplantDate'] == '2026-04-14'


class TestTransplantsDueMissedSeedStartGuard:
    """
    Regression: when an event has a seed_start_date that already passed and is
    still incomplete, the indoor start never happened. Showing a
    "Transplant due" row in that state is misleading — the companion
    "Indoor start due" row is the correct actionable item.

    Guard lives in services/dashboard_service.py::_build_transplants_due
    (around line 223):
        seed_start = _as_date(e.seed_start_date)
        if seed_start is not None and seed_start <= target_date:
            continue
    """

    def test_guard_suppresses_transplant_row_when_seed_start_passed_and_incomplete(
        self, auth_client_a, user_a,
    ):
        """(A) seed_start past + transplant past + incomplete -> transplantsDue empty,
        but indoorStartsDue still surfaces the missed start."""
        bed = _make_bed(user_a.id, 'Bed Gamma')
        _make_event(
            user_a.id,
            plant_id='tomato-1',
            variety='Brandywine',
            garden_bed_id=bed.id,
            seed_start_date=datetime(2026, 3, 15),   # past
            transplant_date=datetime(2026, 4, 12),   # past
            quantity=4,
            # is_complete=False by default (completed=False, quantity_completed=None)
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        body = resp.get_json()
        signals = body['signals']

        # Transplant row suppressed by the seed-start guard
        assert signals['transplantsDue'] == [], (
            "Transplant-due row should be suppressed when the scheduled indoor "
            "seed-start was missed (seed_start_date <= today, incomplete)"
        )
        # seed_start_date 2026-03-15 vs TODAY 2026-04-14 = 30 days past, which
        # exceeds STALE_INDOOR_START_DAYS (14). The item ages out of the primary
        # feed and moves into missed.indoorStartsDue.
        assert signals['indoorStartsDue'] == []
        missed_indoor = body['missed']['indoorStartsDue']
        assert len(missed_indoor) == 1
        assert missed_indoor[0]['variety'] == 'Brandywine'
        assert missed_indoor[0]['seedStartDate'] == '2026-03-15'

    def test_direct_seed_path_still_included(self, auth_client_a, user_a):
        """(B) seed_start None + transplant past + incomplete -> row INCLUDED.
        Direct-seed or pre-purchased-seedling events must still surface."""
        bed = _make_bed(user_a.id, 'Bed Delta')
        _make_event(
            user_a.id,
            plant_id='tomato-1',
            variety='Roma',
            garden_bed_id=bed.id,
            seed_start_date=None,                    # no indoor start scheduled
            transplant_date=datetime(2026, 4, 12),   # past
            quantity=6,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        rows = resp.get_json()['signals']['transplantsDue']
        assert len(rows) == 1
        assert rows[0]['variety'] == 'Roma'
        assert rows[0]['bedName'] == 'Bed Delta'
        assert rows[0]['transplantDate'] == '2026-04-12'

    def test_complete_events_still_skipped(self, auth_client_a, user_a):
        """(C) seed_start past + transplant past + COMPLETE -> row absent.
        Sanity check: the existing is_complete skip still works with the new
        guard in place (order of checks shouldn't matter here)."""
        bed = _make_bed(user_a.id, 'Bed Epsilon')
        _make_event(
            user_a.id,
            plant_id='tomato-1',
            variety='San Marzano',
            garden_bed_id=bed.id,
            seed_start_date=datetime(2026, 3, 15),
            transplant_date=datetime(2026, 4, 12),
            quantity=4,
            quantity_completed=4,
            completed=True,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.get_json()['signals']['transplantsDue'] == []

    def test_future_seed_start_passes_guard(self, auth_client_a, user_a):
        """(D) seed_start FUTURE + transplant past + incomplete -> row INCLUDED.
        Defensive / unusual ordering: guard condition `seed_start <= target_date`
        is False, so the row should surface normally."""
        bed = _make_bed(user_a.id, 'Bed Zeta')
        _make_event(
            user_a.id,
            plant_id='tomato-1',
            variety='Black Krim',
            garden_bed_id=bed.id,
            seed_start_date=datetime(2026, 5, 1),    # future vs TODAY (2026-04-14)
            transplant_date=datetime(2026, 4, 12),   # past
            quantity=3,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        rows = resp.get_json()['signals']['transplantsDue']
        assert len(rows) == 1
        assert rows[0]['variety'] == 'Black Krim'
        assert rows[0]['transplantDate'] == '2026-04-12'

    # ------------------------------------------------------------------
    # ISS-status-aware guard tests
    # ------------------------------------------------------------------
    # The guard above uses `seed_start_date <= today AND not is_complete`
    # as a proxy for "indoor start was missed". That proxy fires for
    # SUCCESSFUL indoor-started crops too because the Indoor Starts PUT
    # endpoint advances IndoorSeedStart.status without touching
    # linked_event.completed. The fix queries the linked IndoorSeedStart
    # and only suppresses when no ISS exists OR the ISS is still in
    # 'planned' status. See:
    #   dev/active/production-readiness-audit/
    #     dashboard-missing-transplant-due-investigation.md
    #     dashboard-missing-transplant-due-decision.md

    def test_guard_does_not_fire_when_iss_status_advanced_seeded(
        self, auth_client_a, user_a,
    ):
        """ISS linked with status='seeded' -> transplant signal SHOULD appear.
        The seed-start phase has progressed, so the proxy is wrong here."""
        bed = _make_bed(user_a.id, 'Bed Eta')
        event = _make_event(
            user_a.id,
            plant_id='tomato-1',
            variety='Cherokee Purple',
            garden_bed_id=bed.id,
            seed_start_date=datetime(2026, 3, 15),   # past
            transplant_date=datetime(2026, 4, 12),   # past
            quantity=4,
        )
        _make_seed_start(
            user_a.id,
            plant_id='tomato-1',
            variety='Cherokee Purple',
            start_date=datetime(2026, 3, 15),
            seeds_started=4,
            status='seeded',
            planting_event_id=event.id,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        rows = resp.get_json()['signals']['transplantsDue']
        assert len(rows) == 1
        assert rows[0]['variety'] == 'Cherokee Purple'
        assert rows[0]['transplantDate'] == '2026-04-12'

    def test_guard_does_not_fire_when_iss_status_growing(
        self, auth_client_a, user_a,
    ):
        """ISS linked with status='growing' -> transplant signal SHOULD appear."""
        bed = _make_bed(user_a.id, 'Bed Theta')
        event = _make_event(
            user_a.id,
            plant_id='tomato-1',
            variety='Sun Gold',
            garden_bed_id=bed.id,
            seed_start_date=datetime(2026, 3, 15),
            transplant_date=datetime(2026, 4, 12),
            quantity=2,
        )
        _make_seed_start(
            user_a.id,
            plant_id='tomato-1',
            variety='Sun Gold',
            start_date=datetime(2026, 3, 15),
            seeds_started=2,
            status='growing',
            planting_event_id=event.id,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        rows = resp.get_json()['signals']['transplantsDue']
        assert len(rows) == 1
        assert rows[0]['variety'] == 'Sun Gold'

    def test_guard_does_not_fire_when_iss_status_ready(
        self, auth_client_a, user_a,
    ):
        """ISS linked with status='ready' -> transplant signal SHOULD appear.

        'ready' is the canonical pre-transplant terminus in the
        IndoorSeedStart.status enum (see models.py:
        'planned', 'seeded', 'germinating', 'growing', 'ready',
        'transplanted'). The fix logic suppresses ONLY for 'planned';
        any other status unblocks the transplant row. This test pins
        the production-realistic happy path."""
        bed = _make_bed(user_a.id, 'Bed Iota')
        event = _make_event(
            user_a.id,
            plant_id='tomato-1',
            variety='Green Zebra',
            garden_bed_id=bed.id,
            seed_start_date=datetime(2026, 3, 15),
            transplant_date=datetime(2026, 4, 12),
            quantity=3,
        )
        _make_seed_start(
            user_a.id,
            plant_id='tomato-1',
            variety='Green Zebra',
            start_date=datetime(2026, 3, 15),
            seeds_started=3,
            status='ready',
            planting_event_id=event.id,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        rows = resp.get_json()['signals']['transplantsDue']
        assert len(rows) == 1
        assert rows[0]['variety'] == 'Green Zebra'

    def test_guard_fires_when_iss_status_planned(
        self, auth_client_a, user_a,
    ):
        """ISS linked with status='planned' -> transplant signal SUPPRESSED.
        Original guard intent is preserved when the seed-start was
        scheduled but never actually performed."""
        bed = _make_bed(user_a.id, 'Bed Kappa')
        event = _make_event(
            user_a.id,
            plant_id='tomato-1',
            variety='Mortgage Lifter',
            garden_bed_id=bed.id,
            seed_start_date=datetime(2026, 3, 15),
            transplant_date=datetime(2026, 4, 12),
            quantity=4,
        )
        _make_seed_start(
            user_a.id,
            plant_id='tomato-1',
            variety='Mortgage Lifter',
            start_date=datetime(2026, 3, 15),
            seeds_started=4,
            status='planned',
            planting_event_id=event.id,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        signals = resp.get_json()['signals']
        assert signals['transplantsDue'] == [], (
            "Transplant-due row should be suppressed when the linked "
            "IndoorSeedStart is still in 'planned' status (seed-start was "
            "scheduled but never started)."
        )

    def test_guard_user_isolation_for_iss_lookup(
        self, auth_client_a, user_a, user_b,
    ):
        """User A's PE has passed seed_start; user B has an ISS with the
        same planting_event_id (cross-user) and status='growing'. The
        new query MUST filter by user_id, so user B's ISS should NOT
        unblock user A's guard."""
        bed = _make_bed(user_a.id, 'Bed Lambda')
        event_a = _make_event(
            user_a.id,
            plant_id='tomato-1',
            variety='Beefsteak',
            garden_bed_id=bed.id,
            seed_start_date=datetime(2026, 3, 15),
            transplant_date=datetime(2026, 4, 12),
            quantity=4,
        )
        # Cross-user ISS pointing at user A's event id (data leakage canary).
        _make_seed_start(
            user_b.id,
            plant_id='tomato-1',
            variety='Beefsteak',
            start_date=datetime(2026, 3, 15),
            seeds_started=4,
            status='growing',
            planting_event_id=event_a.id,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        signals = resp.get_json()['signals']
        assert signals['transplantsDue'] == [], (
            "User A's guard must not be unblocked by user B's "
            "IndoorSeedStart, even when planting_event_id matches."
        )

    def test_guard_fires_when_iss_linked_to_different_event(
        self, auth_client_a, user_a,
    ):
        """User A has TWO PEs. The 'growing' ISS is linked to PE #2, but
        we are evaluating PE #1. The query must use planting_event_id == e.id,
        so PE #1's guard should still fire (no ISS for PE #1)."""
        bed = _make_bed(user_a.id, 'Bed Mu')
        event_one = _make_event(
            user_a.id,
            plant_id='tomato-1',
            variety='Yellow Pear',
            garden_bed_id=bed.id,
            seed_start_date=datetime(2026, 3, 15),
            transplant_date=datetime(2026, 4, 12),
            quantity=2,
        )
        event_two = _make_event(
            user_a.id,
            plant_id='pepper-1',
            variety='Jalapeno',
            garden_bed_id=bed.id,
            seed_start_date=datetime(2026, 3, 15),
            transplant_date=datetime(2026, 6, 1),   # future, won't appear
            quantity=2,
        )
        # ISS only links to event_two; event_one has no ISS.
        _make_seed_start(
            user_a.id,
            plant_id='pepper-1',
            variety='Jalapeno',
            start_date=datetime(2026, 3, 15),
            seeds_started=2,
            status='growing',
            planting_event_id=event_two.id,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        rows = resp.get_json()['signals']['transplantsDue']
        # event_one (Yellow Pear) suppressed — no linked ISS, falls through
        # to original proxy. event_two (Jalapeno) has future transplant date
        # and is filtered out of the candidate list before the guard.
        assert rows == [], (
            "PE #1 must remain suppressed because its own planting_event_id "
            "has no ISS — PE #2's ISS is unrelated."
        )
        assert event_one.id != event_two.id  # sanity


class TestDirectSeedDue:

    def test_includes_direct_seed_due_today(self, auth_client_a, user_a):
        bed = _make_bed(user_a.id, 'Bed Herb')
        _make_event(
            user_a.id,
            plant_id='carrot-1',
            variety='Nantes',
            garden_bed_id=bed.id,
            direct_seed_date=datetime(2026, 4, 14),
            quantity=20,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        rows = resp.get_json()['signals']['directSeedDue']
        assert len(rows) == 1
        row = rows[0]
        assert row['plantName'] is not None
        assert row['variety'] == 'Nantes'
        assert row['bedName'] == 'Bed Herb'
        assert row['bedId'] == bed.id
        assert row['directSeedDate'] == '2026-04-14'
        assert row['quantity'] == 20

    def test_includes_past_direct_seed(self, auth_client_a, user_a):
        _make_event(
            user_a.id,
            plant_id='lettuce-1',
            variety='Buttercrunch',
            direct_seed_date=datetime(2026, 4, 10),  # 4 days ago
            quantity=30,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        rows = resp.get_json()['signals']['directSeedDue']
        assert len(rows) == 1
        assert rows[0]['variety'] == 'Buttercrunch'

    def test_excludes_completed_direct_seed(self, auth_client_a, user_a):
        _make_event(
            user_a.id,
            plant_id='carrot-1',
            variety='Nantes',
            direct_seed_date=datetime(2026, 4, 14),
            quantity=20,
            quantity_completed=20,
            completed=True,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.get_json()['signals']['directSeedDue'] == []

    def test_excludes_future_direct_seed(self, auth_client_a, user_a):
        _make_event(
            user_a.id,
            plant_id='carrot-1',
            direct_seed_date=datetime(2026, 5, 1),  # after TODAY
            quantity=10,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.get_json()['signals']['directSeedDue'] == []

    def test_user_isolation(self, auth_client_b, user_a):
        """User A's direct-seed events must not appear for user B."""
        _make_event(
            user_a.id,
            plant_id='carrot-1',
            variety='Danvers',
            direct_seed_date=datetime(2026, 4, 14),
            quantity=15,
        )
        resp = _get_today(auth_client_b, f'date={TODAY.isoformat()}')
        assert resp.get_json()['signals']['directSeedDue'] == []


class TestCompostOverdue:

    def test_includes_overdue_pile(self, auth_client_a, user_a):
        pile = CompostPile(
            user_id=user_a.id,
            name='Main',
            start_date=datetime(2026, 1, 1),
            last_turned=datetime(2026, 4, 1),  # 13 days ago vs TODAY
            status='cooking',
        )
        db.session.add(pile)
        db.session.commit()

        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        rows = resp.get_json()['signals']['compostOverdue']
        assert len(rows) == 1
        row = rows[0]
        assert row['pileName'] == 'Main'
        assert row['daysSinceLastTurn'] == 13
        assert row['turnFrequencyDays'] == 7

    def test_excludes_ready_pile(self, auth_client_a, user_a):
        pile = CompostPile(
            user_id=user_a.id,
            name='Done',
            last_turned=datetime(2026, 1, 1),
            status='ready',
        )
        db.session.add(pile)
        db.session.commit()

        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.get_json()['signals']['compostOverdue'] == []

    def test_excludes_recently_turned(self, auth_client_a, user_a):
        pile = CompostPile(
            user_id=user_a.id,
            name='Fresh',
            last_turned=datetime(2026, 4, 13),  # 1 day ago
            status='cooking',
        )
        db.session.add(pile)
        db.session.commit()

        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.get_json()['signals']['compostOverdue'] == []


class TestSeedLowStock:

    def test_flags_low_packet_count(self, auth_client_a, user_a):
        s = SeedInventory(
            user_id=user_a.id,
            plant_id='carrot-1',
            variety='Nantes',
            quantity=1,  # below threshold (< 2)
        )
        db.session.add(s)
        db.session.commit()

        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        rows = resp.get_json()['signals']['seedLowStock']
        assert len(rows) == 1
        assert rows[0]['variety'] == 'Nantes'
        assert rows[0]['quantityRemaining'] == 1

    def test_does_not_flag_adequate_stock(self, auth_client_a, user_a):
        s = SeedInventory(
            user_id=user_a.id,
            plant_id='carrot-1',
            variety='Nantes',
            quantity=5,
        )
        db.session.add(s)
        db.session.commit()

        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.get_json()['signals']['seedLowStock'] == []


class TestSeedExpiring:

    def test_flags_expiring_soon(self, auth_client_a, user_a):
        s = SeedInventory(
            user_id=user_a.id,
            plant_id='lettuce-1',
            variety='Romaine',
            quantity=5,
            expiration_date=datetime(2026, 5, 1),  # 17 days away
        )
        db.session.add(s)
        db.session.commit()

        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        rows = resp.get_json()['signals']['seedExpiring']
        assert len(rows) == 1
        assert rows[0]['variety'] == 'Romaine'
        assert rows[0]['daysUntilExpiry'] == 17
        assert rows[0]['expiresOn'] == '2026-05-01'

    def test_ignores_expiring_far_future(self, auth_client_a, user_a):
        s = SeedInventory(
            user_id=user_a.id,
            plant_id='lettuce-1',
            variety='Romaine',
            quantity=5,
            expiration_date=datetime(2027, 5, 1),
        )
        db.session.add(s)
        db.session.commit()

        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.get_json()['signals']['seedExpiring'] == []


class TestLivestockActions:

    def test_flags_egg_collection_not_logged(self, auth_client_a, user_a):
        c = Chicken(user_id=user_a.id, name='Flock A', quantity=3, status='active')
        db.session.add(c)
        db.session.commit()

        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        rows = resp.get_json()['signals']['livestockActionsDue']
        assert len(rows) == 1
        assert rows[0]['type'] == 'egg-collection'
        assert rows[0]['animal'] == 'Chickens'

    def test_no_flag_when_already_logged(self, auth_client_a, user_a):
        c = Chicken(user_id=user_a.id, name='Flock A', quantity=3, status='active')
        db.session.add(c)
        db.session.commit()
        rec = EggProduction(
            chicken_id=c.id,
            date=datetime(2026, 4, 14, 7, 0),
            eggs_collected=2,
        )
        db.session.add(rec)
        db.session.commit()

        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.get_json()['signals']['livestockActionsDue'] == []

    def test_no_flag_when_no_active_chickens(self, auth_client_a):
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.get_json()['signals']['livestockActionsDue'] == []


# ---------------------------------------------------------------------------
# User isolation
# ---------------------------------------------------------------------------

class TestUserIsolation:

    def test_user_b_does_not_see_user_a_data(self, auth_client_b, user_a):
        bed = _make_bed(user_a.id, 'A-bed')
        _make_event(
            user_a.id,
            garden_bed_id=bed.id,
            expected_harvest_date=datetime(2026, 4, 10),
        )
        s = SeedInventory(
            user_id=user_a.id, plant_id='carrot-1', variety='Nantes', quantity=1,
        )
        db.session.add(s)
        db.session.commit()

        resp = _get_today(auth_client_b, f'date={TODAY.isoformat()}')
        body = resp.get_json()
        assert body['signals']['harvestReady'] == []
        assert body['signals']['seedLowStock'] == []


# ---------------------------------------------------------------------------
# Defensive: malformed event_details JSON
# ---------------------------------------------------------------------------

class TestDefensive:

    def test_malformed_event_details_does_not_500(self, auth_client_a, user_a):
        """
        A PlantingEvent with malformed event_details JSON must not break the
        endpoint. Our builders don't touch event_details for planting signals,
        but this regression guards future edits.
        """
        bed = _make_bed(user_a.id)
        _make_event(
            user_a.id,
            garden_bed_id=bed.id,
            expected_harvest_date=datetime(2026, 4, 10),
            event_details='{this is not valid json',
            quantity_completed=4,
            completed=True,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.status_code == 200
        # And the event still shows up (confirming we didn't silently drop it)
        assert len(resp.get_json()['signals']['harvestReady']) == 1


# ---------------------------------------------------------------------------
# POST /api/dashboard/snooze
# ---------------------------------------------------------------------------

class TestSnoozeEndpoint:
    """Coverage for POST /api/dashboard/snooze.

    The endpoint accepts either a `days` window (1-30) or `forever: true` for
    a permanent dismiss. Earlier the endpoint ignored `forever` and treated
    permanent-dismiss requests as 3-day snoozes — see
    harvest-ready-signal-deep-dive.md §3.11.
    """

    def _post(self, client, body):
        return client.post('/api/dashboard/snooze', json=body)

    def test_forever_sets_sentinel_date(self, auth_client_a, user_a):
        resp = self._post(auth_client_a, {'signalKey': 'harvest-1', 'forever': True})
        assert resp.status_code == 200
        body = resp.get_json()
        assert body['signalKey'] == 'harvest-1'
        assert body['snoozeUntil'] == '9999-12-31'

        row = DashboardSnooze.query.filter_by(
            user_id=user_a.id, signal_key='harvest-1'
        ).first()
        assert row is not None
        assert row.snooze_until == date(9999, 12, 31)

    def test_forever_hides_harvest_signal_indefinitely(self, auth_client_a, user_a):
        """Regression: a forever-dismissed harvest must stay hidden even when
        queried with a target date far in the future. Before the fix, the
        endpoint silently set snooze_until = today + 3d, so the row resurfaced
        on day 4. After the fix, the year-9999 sentinel keeps it hidden."""
        bed = _make_bed(user_a.id, 'Bed Forever')
        event = _make_event(
            user_a.id,
            plant_id='radish-1',
            variety='Cherry Belle',
            garden_bed_id=bed.id,
            expected_harvest_date=datetime(2026, 4, 10),
            quantity=22,
            quantity_completed=22,
            completed=True,
        )
        # Dismiss permanently.
        signal_key = f'harvest-{event.id}'
        resp = self._post(auth_client_a, {'signalKey': signal_key, 'forever': True})
        assert resp.status_code == 200

        # Today: hidden.
        resp_today = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp_today.get_json()['signals']['harvestReady'] == []

        # 90 days later: still hidden (this is the regression — would have
        # resurfaced under the old default-3-days behavior).
        future = (TODAY + timedelta(days=90)).isoformat()
        resp_future = _get_today(auth_client_a, f'date={future}')
        assert resp_future.get_json()['signals']['harvestReady'] == []

    def test_forever_ignores_days_argument(self, auth_client_a, user_a):
        """When forever=true, an out-of-range days value must not 400 — the
        frontend currently sends `{signalKey, forever: true}` with no days,
        but defensive callers may also send invalid days."""
        resp = self._post(
            auth_client_a,
            {'signalKey': 'harvest-1', 'forever': True, 'days': 999},
        )
        assert resp.status_code == 200
        row = DashboardSnooze.query.filter_by(signal_key='harvest-1').first()
        assert row.snooze_until == date(9999, 12, 31)

    def test_default_days_is_3(self, auth_client_a, user_a):
        # Pin target date so we can assert the resulting snooze_until.
        resp = auth_client_a.post(
            f'/api/dashboard/snooze?date={TODAY.isoformat()}',
            json={'signalKey': 'harvest-1'},
        )
        assert resp.status_code == 200
        row = DashboardSnooze.query.filter_by(signal_key='harvest-1').first()
        assert row.snooze_until == TODAY + timedelta(days=3)

    def test_days_in_range_is_accepted(self, auth_client_a, user_a):
        resp = auth_client_a.post(
            f'/api/dashboard/snooze?date={TODAY.isoformat()}',
            json={'signalKey': 'harvest-1', 'days': 7},
        )
        assert resp.status_code == 200
        row = DashboardSnooze.query.filter_by(signal_key='harvest-1').first()
        assert row.snooze_until == TODAY + timedelta(days=7)

    def test_invalid_days_returns_400(self, auth_client_a, user_a):
        for bad in (0, -1, 31, 'three', None):
            resp = self._post(auth_client_a, {'signalKey': 'harvest-1', 'days': bad})
            assert resp.status_code == 400, f'days={bad!r} should be rejected'

    def test_missing_signal_key_returns_400(self, auth_client_a):
        resp = self._post(auth_client_a, {'forever': True})
        assert resp.status_code == 400

    def test_empty_body_returns_400(self, auth_client_a):
        resp = self._post(auth_client_a, {})
        assert resp.status_code == 400

    def test_non_dict_body_returns_400(self, auth_client_a):
        """A JSON array or scalar must 400, not 500 (data.get would crash)."""
        for body in ([1, 2, 3], 'string', 42):
            resp = self._post(auth_client_a, body)
            assert resp.status_code == 400, f'body={body!r} should be rejected'

    def test_invalid_date_query_param_returns_400(self, auth_client_a):
        """Invalid `?date=` must 400, not 500 (the GET endpoint already does
        this; POST was missing the try/except)."""
        resp = auth_client_a.post(
            '/api/dashboard/snooze?date=not-a-date',
            json={'signalKey': 'harvest-1', 'days': 3},
        )
        assert resp.status_code == 400

    def test_upsert_overwrites_existing_snooze(self, auth_client_a, user_a):
        """Two snoozes with the same signalKey collapse to one row — the most
        recent POST wins. Documents (rather than mandates) the current
        behavior: a later Skip-3d after a forever-dismiss will downgrade to
        3 days. If that becomes a problem the upsert can switch to
        max(existing, new), but for now the frontend doesn't hit that path."""
        self._post(auth_client_a, {'signalKey': 'harvest-1', 'forever': True})
        auth_client_a.post(
            f'/api/dashboard/snooze?date={TODAY.isoformat()}',
            json={'signalKey': 'harvest-1', 'days': 3},
        )
        rows = DashboardSnooze.query.filter_by(signal_key='harvest-1').all()
        assert len(rows) == 1
        assert rows[0].snooze_until == TODAY + timedelta(days=3)


class TestUnsnoozeEndpoint:
    """Coverage for DELETE /api/dashboard/snooze (the Undo path).

    Earlier the route was registered POST-only, so the frontend Undo button
    received 405 and the snooze record survived — the row visually returned
    for 5 seconds and then re-hid on the next refresh."""

    def _delete(self, client, body):
        return client.delete('/api/dashboard/snooze', json=body)

    def test_removes_existing_snooze(self, auth_client_a, user_a):
        db.session.add(DashboardSnooze(
            user_id=user_a.id,
            signal_key='harvest-1',
            snooze_until=date(9999, 12, 31),
        ))
        db.session.commit()

        resp = self._delete(auth_client_a, {'signalKey': 'harvest-1'})
        assert resp.status_code == 200
        body = resp.get_json()
        assert body['signalKey'] == 'harvest-1'
        assert body['deleted'] is True
        assert DashboardSnooze.query.filter_by(signal_key='harvest-1').first() is None

    def test_idempotent_when_no_snooze_exists(self, auth_client_a, user_a):
        """Undo should never error — clicking it twice is harmless."""
        resp = self._delete(auth_client_a, {'signalKey': 'harvest-999'})
        assert resp.status_code == 200
        assert resp.get_json()['deleted'] is False

    def test_missing_signal_key_returns_400(self, auth_client_a):
        resp = self._delete(auth_client_a, {})
        assert resp.status_code == 400

    def test_non_dict_body_returns_400(self, auth_client_a):
        for body in ([1, 2, 3], 'string', 42):
            resp = self._delete(auth_client_a, body)
            assert resp.status_code == 400, f'body={body!r} should be rejected'

    def test_user_isolation(self, auth_client_a, user_a, user_b):
        """User A's DELETE must not touch user B's snooze for the same key."""
        db.session.add(DashboardSnooze(
            user_id=user_b.id,
            signal_key='harvest-1',
            snooze_until=date(9999, 12, 31),
        ))
        db.session.commit()
        assert user_a.id != user_b.id

        resp = self._delete(auth_client_a, {'signalKey': 'harvest-1'})
        assert resp.status_code == 200
        assert resp.get_json()['deleted'] is False
        # User B's snooze is untouched.
        b_row = DashboardSnooze.query.filter_by(
            user_id=user_b.id, signal_key='harvest-1'
        ).first()
        assert b_row is not None

    def test_dismiss_then_undo_restores_harvest_signal(self, auth_client_a, user_a):
        """End-to-end regression: POST forever → row hidden; DELETE → row back.

        Pre-fix flow: DELETE returned 405, snooze persisted, row stayed hidden
        on next refresh despite the 5-second Undo toast. This test fails
        before the DELETE handler exists.
        """
        bed = _make_bed(user_a.id, 'Bed Undo')
        event = _make_event(
            user_a.id,
            plant_id='radish-1',
            variety='Cherry Belle',
            garden_bed_id=bed.id,
            expected_harvest_date=datetime(2026, 4, 10),
            quantity=22,
            quantity_completed=22,
            completed=True,
        )
        signal_key = f'harvest-{event.id}'

        # 1. Dismiss permanently.
        resp = auth_client_a.post(
            '/api/dashboard/snooze',
            json={'signalKey': signal_key, 'forever': True},
        )
        assert resp.status_code == 200
        assert _get_today(auth_client_a, f'date={TODAY.isoformat()}') \
            .get_json()['signals']['harvestReady'] == []

        # 2. Undo.
        resp = self._delete(auth_client_a, {'signalKey': signal_key})
        assert resp.status_code == 200
        assert resp.get_json()['deleted'] is True

        # 3. Row is back.
        hr = _get_today(auth_client_a, f'date={TODAY.isoformat()}') \
            .get_json()['signals']['harvestReady']
        assert len(hr) == 1
        assert hr[0]['variety'] == 'Cherry Belle'
