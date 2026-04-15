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

import pytest

from models import (
    db,
    PlantingEvent,
    GardenBed,
    CompostPile,
    SeedInventory,
    Chicken,
    EggProduction,
)
from tests.conftest import login_as


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
                    'compostOverdue', 'seedLowStock', 'seedExpiring',
                    'livestockActionsDue'):
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

    def test_excludes_completed_events(self, auth_client_a, user_a):
        _make_event(
            user_a.id,
            expected_harvest_date=datetime(2026, 4, 10),
            quantity=4,
            quantity_completed=4,
            completed=True,
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.get_json()['signals']['harvestReady'] == []

    def test_excludes_future_harvests_by_default(self, auth_client_a, user_a):
        _make_event(
            user_a.id,
            expected_harvest_date=datetime(2026, 5, 1),  # after TODAY
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.get_json()['signals']['harvestReady'] == []

    def test_future_date_param_shifts_results(self, auth_client_a, user_a):
        """Passing a future date should include events that weren't due yet."""
        _make_event(
            user_a.id,
            expected_harvest_date=datetime(2026, 5, 1),
            quantity=3,
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
        signals = resp.get_json()['signals']

        # Transplant row suppressed by the new guard
        assert signals['transplantsDue'] == [], (
            "Transplant-due row should be suppressed when the scheduled indoor "
            "seed-start was missed (seed_start_date <= today, incomplete)"
        )
        # Companion signal still surfaces the missed indoor start — this is the
        # critical part of the contract: the user still sees an actionable row.
        indoor = signals['indoorStartsDue']
        assert len(indoor) == 1
        assert indoor[0]['variety'] == 'Brandywine'
        assert indoor[0]['seedStartDate'] == '2026-03-15'

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
        )
        resp = _get_today(auth_client_a, f'date={TODAY.isoformat()}')
        assert resp.status_code == 200
        # And the event still shows up (confirming we didn't silently drop it)
        assert len(resp.get_json()['signals']['harvestReady']) == 1
