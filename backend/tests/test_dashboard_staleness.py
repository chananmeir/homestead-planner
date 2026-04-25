"""
Tests for Slice A of the stale-needs-attention fix.

Contract under test (services/dashboard_service.py):

- Reminders older than a type-specific threshold (measured as
  target_date - trigger_date) age out of signals.* into the new missed.*
  block, for `indoorStartsDue`, `transplantsDue`, `directSeedDue`.
- Germination checks (`germinationCheck` + `indoorGerminationCheck`) drop
  silently when the expected germination date is more than
  STALE_GERMINATION_CHECK_DAYS past target_date. No missed bucket.
- Harvest rows (`harvestReady`) NEVER drop. They gain an `isStale: bool` flag
  when daysPastExpected > HARVEST_DEMOTION_DAYS.
- Snooze filtering runs across BOTH signals.* and missed.* — a dismissed item
  does not resurface by aging out.
- Thresholds used by this suite:
    STALE_INDOOR_START_DAYS = 14
    STALE_TRANSPLANT_DAYS = 10
    STALE_DIRECT_SEED_DAYS = 14
    STALE_GERMINATION_CHECK_DAYS = 14
    HARVEST_DEMOTION_DAYS = 14

Plan: dev/active/production-readiness-audit/dashboard-stale-needs-attention-plan.md §3 Slice A.
"""
from datetime import datetime, date, timedelta

import pytest

from models import (
    db,
    PlantingEvent,
    GardenBed,
    IndoorSeedStart,
    DashboardSnooze,
)


TODAY = date(2026, 4, 24)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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


def _make_iss(user_id, **kwargs):
    defaults = {
        'plant_id': 'pepper-1',
        'variety': 'Shishito',
        'start_date': datetime.combine(TODAY, datetime.min.time()),
        'seeds_started': 8,
        'status': 'planned',
    }
    defaults.update(kwargs)
    iss = IndoorSeedStart(user_id=user_id, **defaults)
    db.session.add(iss)
    db.session.commit()
    return iss


def _get(client, params=''):
    url = '/api/dashboard/today'
    if params:
        url += '?' + params
    return client.get(url)


def _body(client):
    resp = _get(client, f'date={TODAY.isoformat()}')
    assert resp.status_code == 200, resp.data
    return resp.get_json()


# ---------------------------------------------------------------------------
# Response shape — verify missed block exists and has the right keys
# ---------------------------------------------------------------------------

class TestResponseShape:

    def test_missed_block_present_and_empty_by_default(self, auth_client_a):
        body = _body(auth_client_a)
        assert 'missed' in body
        assert body['missed']['indoorStartsDue'] == []
        assert body['missed']['transplantsDue'] == []
        assert body['missed']['directSeedDue'] == []

    def test_signals_block_unchanged_shape(self, auth_client_a):
        body = _body(auth_client_a)
        # Every legacy key still present — frontend still consumes signals.*
        for key in (
            'harvestReady', 'indoorStartsDue', 'transplantsDue', 'directSeedDue',
            'germinationCheck', 'indoorGerminationCheck', 'compostOverdue',
            'seedLowStock', 'seedExpiring', 'livestockActionsDue',
        ):
            assert key in body['signals']


# ---------------------------------------------------------------------------
# Indoor starts (PlantingEvent path)
# ---------------------------------------------------------------------------

class TestIndoorStartsStaleness:

    def test_fresh_item_stays_in_signals(self, auth_client_a, user_a):
        # 5 days past — well under 14-day threshold
        _make_event(
            user_a.id,
            seed_start_date=datetime.combine(TODAY - timedelta(days=5), datetime.min.time()),
        )
        body = _body(auth_client_a)
        assert len(body['signals']['indoorStartsDue']) == 1
        assert body['missed']['indoorStartsDue'] == []

    def test_just_at_threshold_stays_in_signals(self, auth_client_a, user_a):
        # Exactly 14 days past — threshold is > 14, so still in signals
        _make_event(
            user_a.id,
            seed_start_date=datetime.combine(TODAY - timedelta(days=14), datetime.min.time()),
        )
        body = _body(auth_client_a)
        assert len(body['signals']['indoorStartsDue']) == 1
        assert body['missed']['indoorStartsDue'] == []

    def test_past_threshold_moves_to_missed(self, auth_client_a, user_a):
        # 15 days past — just over threshold
        _make_event(
            user_a.id,
            variety='Jalapeno',
            seed_start_date=datetime.combine(TODAY - timedelta(days=15), datetime.min.time()),
        )
        body = _body(auth_client_a)
        assert body['signals']['indoorStartsDue'] == []
        assert len(body['missed']['indoorStartsDue']) == 1
        assert body['missed']['indoorStartsDue'][0]['variety'] == 'Jalapeno'

    def test_far_past_moves_to_missed(self, auth_client_a, user_a):
        # 60 days past (Feb 1 → Apr 24 is ~82 days; reported symptom)
        _make_event(
            user_a.id,
            variety='Feb1Pepper',
            seed_start_date=datetime(2026, 2, 1),
        )
        body = _body(auth_client_a)
        assert body['signals']['indoorStartsDue'] == []
        assert len(body['missed']['indoorStartsDue']) == 1

    def test_completed_item_absent_from_both(self, auth_client_a, user_a):
        _make_event(
            user_a.id,
            seed_start_date=datetime.combine(TODAY - timedelta(days=30), datetime.min.time()),
            quantity=4,
            quantity_completed=4,
            completed=True,
        )
        body = _body(auth_client_a)
        assert body['signals']['indoorStartsDue'] == []
        assert body['missed']['indoorStartsDue'] == []

    def test_does_not_mutate_planting_event(self, auth_client_a, user_a):
        """Staleness is display-layer only — PlantingEvent.completed / quantity_completed
        must remain untouched."""
        e = _make_event(
            user_a.id,
            seed_start_date=datetime.combine(TODAY - timedelta(days=45), datetime.min.time()),
            quantity=4,
        )
        _body(auth_client_a)
        db.session.refresh(e)
        assert e.completed is False
        assert e.quantity_completed is None


# ---------------------------------------------------------------------------
# Indoor starts (IndoorSeedStart path) — also must not mutate status
# ---------------------------------------------------------------------------

class TestIndoorStartsIssStaleness:

    def test_fresh_iss_stays_in_signals(self, auth_client_a, user_a):
        _make_iss(
            user_a.id,
            start_date=datetime.combine(TODAY - timedelta(days=3), datetime.min.time()),
        )
        body = _body(auth_client_a)
        assert len(body['signals']['indoorStartsDue']) == 1
        assert body['missed']['indoorStartsDue'] == []

    def test_stale_iss_moves_to_missed_and_status_unchanged(self, auth_client_a, user_a):
        s = _make_iss(
            user_a.id,
            start_date=datetime.combine(TODAY - timedelta(days=30), datetime.min.time()),
            status='planned',
        )
        body = _body(auth_client_a)
        assert body['signals']['indoorStartsDue'] == []
        assert len(body['missed']['indoorStartsDue']) == 1
        # Critical invariant: status still 'planned' — we never silently flipped it.
        db.session.refresh(s)
        assert s.status == 'planned'


# ---------------------------------------------------------------------------
# Transplants
# ---------------------------------------------------------------------------

class TestTransplantsStaleness:

    def test_fresh_transplant_stays_in_signals(self, auth_client_a, user_a):
        bed = _make_bed(user_a.id)
        _make_event(
            user_a.id,
            garden_bed_id=bed.id,
            transplant_date=datetime.combine(TODAY - timedelta(days=3), datetime.min.time()),
            seed_start_date=None,  # direct transplant, guard won't suppress
        )
        body = _body(auth_client_a)
        assert len(body['signals']['transplantsDue']) == 1
        assert body['missed']['transplantsDue'] == []

    def test_just_at_threshold_stays_in_signals(self, auth_client_a, user_a):
        bed = _make_bed(user_a.id)
        _make_event(
            user_a.id,
            garden_bed_id=bed.id,
            transplant_date=datetime.combine(TODAY - timedelta(days=10), datetime.min.time()),
            seed_start_date=None,
        )
        body = _body(auth_client_a)
        assert len(body['signals']['transplantsDue']) == 1
        assert body['missed']['transplantsDue'] == []

    def test_past_threshold_moves_to_missed(self, auth_client_a, user_a):
        bed = _make_bed(user_a.id)
        _make_event(
            user_a.id,
            variety='Cherokee',
            garden_bed_id=bed.id,
            transplant_date=datetime.combine(TODAY - timedelta(days=11), datetime.min.time()),
            seed_start_date=None,
        )
        body = _body(auth_client_a)
        assert body['signals']['transplantsDue'] == []
        assert len(body['missed']['transplantsDue']) == 1
        assert body['missed']['transplantsDue'][0]['variety'] == 'Cherokee'

    def test_completed_absent_from_both(self, auth_client_a, user_a):
        _make_event(
            user_a.id,
            transplant_date=datetime.combine(TODAY - timedelta(days=30), datetime.min.time()),
            seed_start_date=None,
            quantity=4,
            quantity_completed=4,
            completed=True,
        )
        body = _body(auth_client_a)
        assert body['signals']['transplantsDue'] == []
        assert body['missed']['transplantsDue'] == []


# ---------------------------------------------------------------------------
# Direct seed
# ---------------------------------------------------------------------------

class TestDirectSeedStaleness:

    def test_fresh_stays_in_signals(self, auth_client_a, user_a):
        _make_event(
            user_a.id,
            plant_id='carrot-1',
            variety='Nantes',
            direct_seed_date=datetime.combine(TODAY - timedelta(days=7), datetime.min.time()),
        )
        body = _body(auth_client_a)
        assert len(body['signals']['directSeedDue']) == 1
        assert body['missed']['directSeedDue'] == []

    def test_just_at_threshold_stays_in_signals(self, auth_client_a, user_a):
        _make_event(
            user_a.id,
            plant_id='carrot-1',
            direct_seed_date=datetime.combine(TODAY - timedelta(days=14), datetime.min.time()),
        )
        body = _body(auth_client_a)
        assert len(body['signals']['directSeedDue']) == 1
        assert body['missed']['directSeedDue'] == []

    def test_past_threshold_moves_to_missed(self, auth_client_a, user_a):
        _make_event(
            user_a.id,
            plant_id='carrot-1',
            variety='Danvers',
            direct_seed_date=datetime.combine(TODAY - timedelta(days=15), datetime.min.time()),
        )
        body = _body(auth_client_a)
        assert body['signals']['directSeedDue'] == []
        assert len(body['missed']['directSeedDue']) == 1
        assert body['missed']['directSeedDue'][0]['variety'] == 'Danvers'


# ---------------------------------------------------------------------------
# Germination checks (silent drop, no missed bucket)
# ---------------------------------------------------------------------------

class TestGerminationCheckSilentDrop:

    def test_fresh_germ_check_present(self, auth_client_a, user_a):
        # direct_seed_date: enough days back that expected_germ has passed
        # but not past the drop threshold.
        # Default germ_days for lettuce-1 looked up via plant_database; use
        # 10-day fallback as the conservative estimate.
        _make_event(
            user_a.id,
            plant_id='lettuce-1',
            direct_seed_date=datetime.combine(TODAY - timedelta(days=12), datetime.min.time()),
        )
        body = _body(auth_client_a)
        # Expected germ was ~2 days ago (12 - 10) — well within window
        assert len(body['signals']['germinationCheck']) == 1

    def test_stale_germ_check_dropped_silently(self, auth_client_a, user_a):
        # direct_seed_date 60 days back — expected_germ ~50d ago, way past
        # STALE_GERMINATION_CHECK_DAYS = 14
        _make_event(
            user_a.id,
            plant_id='lettuce-1',
            direct_seed_date=datetime.combine(TODAY - timedelta(days=60), datetime.min.time()),
        )
        body = _body(auth_client_a)
        assert body['signals']['germinationCheck'] == []
        # No missed bucket for germ checks
        assert 'germinationCheck' not in body['missed']


class TestIndoorGerminationCheckSilentDrop:

    def test_fresh_indoor_germ_present(self, auth_client_a, user_a):
        _make_event(
            user_a.id,
            plant_id='pepper-1',
            seed_start_date=datetime.combine(TODAY - timedelta(days=12), datetime.min.time()),
        )
        body = _body(auth_client_a)
        assert len(body['signals']['indoorGerminationCheck']) == 1

    def test_stale_indoor_germ_pe_dropped(self, auth_client_a, user_a):
        _make_event(
            user_a.id,
            plant_id='pepper-1',
            seed_start_date=datetime(2026, 2, 1),
        )
        body = _body(auth_client_a)
        assert body['signals']['indoorGerminationCheck'] == []

    def test_stale_indoor_germ_iss_dropped(self, auth_client_a, user_a):
        _make_iss(
            user_a.id,
            plant_id='pepper-1',
            start_date=datetime(2026, 2, 1),
            status='planned',
        )
        body = _body(auth_client_a)
        assert body['signals']['indoorGerminationCheck'] == []


# ---------------------------------------------------------------------------
# Harvest readiness — never drops, gains isStale flag
# ---------------------------------------------------------------------------

class TestHarvestReadyStaleFlag:

    def test_fresh_harvest_is_not_stale(self, auth_client_a, user_a):
        _make_event(
            user_a.id,
            plant_id='lettuce-1',
            variety='Buttercrunch',
            expected_harvest_date=datetime.combine(TODAY - timedelta(days=3), datetime.min.time()),
        )
        body = _body(auth_client_a)
        rows = body['signals']['harvestReady']
        assert len(rows) == 1
        assert rows[0]['isStale'] is False
        assert rows[0]['daysPastExpected'] == 3

    def test_at_threshold_is_not_stale(self, auth_client_a, user_a):
        _make_event(
            user_a.id,
            plant_id='lettuce-1',
            expected_harvest_date=datetime.combine(TODAY - timedelta(days=14), datetime.min.time()),
        )
        body = _body(auth_client_a)
        rows = body['signals']['harvestReady']
        assert len(rows) == 1
        assert rows[0]['isStale'] is False
        assert rows[0]['daysPastExpected'] == 14

    def test_past_threshold_is_stale_but_still_in_signals(self, auth_client_a, user_a):
        _make_event(
            user_a.id,
            plant_id='lettuce-1',
            variety='OldHarvest',
            expected_harvest_date=datetime.combine(TODAY - timedelta(days=30), datetime.min.time()),
        )
        body = _body(auth_client_a)
        rows = body['signals']['harvestReady']
        # NEVER drops — row must still be in primary feed
        assert len(rows) == 1
        assert rows[0]['isStale'] is True
        assert rows[0]['daysPastExpected'] == 30
        # Never leaks into missed bucket (harvests are integrity-sensitive)
        assert 'harvestReady' not in body['missed']

    def test_far_past_harvest_still_present(self, auth_client_a, user_a):
        """Reported symptom: Feb-1 harvest on Apr-24 dashboard — must NOT drop."""
        _make_event(
            user_a.id,
            plant_id='tomato-1',
            expected_harvest_date=datetime(2026, 2, 1),
        )
        body = _body(auth_client_a)
        rows = body['signals']['harvestReady']
        assert len(rows) == 1
        assert rows[0]['isStale'] is True


# ---------------------------------------------------------------------------
# Snooze interaction — must filter BOTH signals.* and missed.*
# ---------------------------------------------------------------------------

class TestSnoozeAcrossBuckets:

    def test_dismiss_before_stale_does_not_resurface_in_missed(
        self, auth_client_a, user_a,
    ):
        """A user dismisses an indoor-start reminder while it is still fresh.
        After it ages past the staleness threshold, it must NOT reappear in
        missed.indoorStartsDue."""
        e = _make_event(
            user_a.id,
            variety='SnoozedPepper',
            seed_start_date=datetime.combine(TODAY - timedelta(days=30), datetime.min.time()),
        )
        # Forever-dismiss the signalKey (matches how frontend dismisses)
        snooze = DashboardSnooze(
            user_id=user_a.id,
            signal_key=f'indoor-{e.id}',
            snooze_until=date(9999, 12, 31),
        )
        db.session.add(snooze)
        db.session.commit()

        body = _body(auth_client_a)
        assert body['signals']['indoorStartsDue'] == []
        assert body['missed']['indoorStartsDue'] == []

    def test_dismiss_stale_transplant_absent_from_missed(self, auth_client_a, user_a):
        bed = _make_bed(user_a.id)
        e = _make_event(
            user_a.id,
            garden_bed_id=bed.id,
            transplant_date=datetime.combine(TODAY - timedelta(days=25), datetime.min.time()),
            seed_start_date=None,
        )
        snooze = DashboardSnooze(
            user_id=user_a.id,
            signal_key=f'transplant-{e.id}',
            snooze_until=date(9999, 12, 31),
        )
        db.session.add(snooze)
        db.session.commit()

        body = _body(auth_client_a)
        assert body['signals']['transplantsDue'] == []
        assert body['missed']['transplantsDue'] == []

    def test_expired_3day_snooze_shows_in_missed_when_aged_out(
        self, auth_client_a, user_a,
    ):
        """User snoozes an indoor-start for 3 days while it is still fresh
        (say, 10 days past seed_start_date). The snooze window then expires
        AND the item has aged past the 14-day stale threshold by the time the
        user loads the dashboard again. Expected behavior: the snooze filter
        should NOT hide the row (snooze_until < target_date), and because the
        item is now >14d past, it should appear in `missed.indoorStartsDue`
        (not `signals.indoorStartsDue`).

        Explicitly covers the "Snoozed 3 days then aged out after snooze
        expires" boundary from the Slice C test plan.
        """
        e = _make_event(
            user_a.id,
            variety='ExpiredSnoozePepper',
            # 20 days past seed_start_date — well past the 14-day stale threshold
            seed_start_date=datetime.combine(TODAY - timedelta(days=20), datetime.min.time()),
        )
        # Snooze expired 5 days ago (snooze_until < TODAY). This is what a
        # 3-day snooze set when the item was 15 days ago would look like now.
        snooze = DashboardSnooze(
            user_id=user_a.id,
            signal_key=f'indoor-{e.id}',
            snooze_until=TODAY - timedelta(days=5),
        )
        db.session.add(snooze)
        db.session.commit()

        body = _body(auth_client_a)
        # Snooze has expired → filter does not hide it.
        # Item is past stale threshold → it goes into missed, not signals.
        assert body['signals']['indoorStartsDue'] == []
        assert len(body['missed']['indoorStartsDue']) == 1
        assert body['missed']['indoorStartsDue'][0]['variety'] == 'ExpiredSnoozePepper'

    def test_active_3day_snooze_still_hides_aged_out_item(
        self, auth_client_a, user_a,
    ):
        """Companion to the previous test: while the 3-day snooze is STILL
        active (snooze_until >= target_date), the aged-out item stays hidden
        from BOTH signals and missed — matches the "snooze filter runs across
        both buckets" invariant."""
        e = _make_event(
            user_a.id,
            variety='ActiveSnoozePepper',
            seed_start_date=datetime.combine(TODAY - timedelta(days=20), datetime.min.time()),
        )
        # Snooze still active — expires tomorrow
        snooze = DashboardSnooze(
            user_id=user_a.id,
            signal_key=f'indoor-{e.id}',
            snooze_until=TODAY + timedelta(days=1),
        )
        db.session.add(snooze)
        db.session.commit()

        body = _body(auth_client_a)
        assert body['signals']['indoorStartsDue'] == []
        assert body['missed']['indoorStartsDue'] == []


# ---------------------------------------------------------------------------
# User isolation — missed bucket must not leak across users
# ---------------------------------------------------------------------------

class TestMissedUserIsolation:

    def test_user_b_does_not_see_user_a_missed_items(
        self, auth_client_b, user_a,
    ):
        _make_event(
            user_a.id,
            seed_start_date=datetime.combine(TODAY - timedelta(days=30), datetime.min.time()),
        )
        resp = _get(auth_client_b, f'date={TODAY.isoformat()}')
        body = resp.get_json()
        assert body['missed']['indoorStartsDue'] == []
        assert body['signals']['indoorStartsDue'] == []
