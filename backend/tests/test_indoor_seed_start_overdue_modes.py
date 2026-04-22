"""
Regression tests for Phase B smoke #6 (indoor seed start import backdating).

Approved policy = Option 2 + Option 4:
  - Default backend behavior when no overdueMode is supplied: skip rows whose
    computed start_date is before today (simulation-aware). Response body
    clearly explains what was skipped.
  - Explicit overdueMode: 'skip' | 'import_anyway' | 'reschedule_today'
    lets the frontend prompt the user and carry the answer through.
  - dryRun=true lets the frontend preview what would happen (including the
    skipped-vs-created split) WITHOUT persisting.

These tests pin the simulation clock with set_simulated_date() so
get_utc_now() inside the endpoint sees a known "today", then craft
transplantDate values that fall clearly before / after that today minus
weeks_indoors to exercise each branch without relying on wall-clock time.
"""
import json
from datetime import date, datetime, timedelta

import pytest

from models import db, GardenBed, IndoorSeedStart, PlantingEvent
from simulation_clock import set_simulated_date


PLANT_ID = 'tomato-1'  # weeksIndoors = 6 per plant_database
WEEKS_INDOORS = 6


@pytest.fixture
def frozen_today():
    """Pin the simulation clock to a known date so is_past_due is deterministic.

    Chosen date is arbitrary but well inside a normal growing season so that
    'overdue' and 'not overdue' transplant windows are easy to construct.
    """
    today = date(2026, 5, 1)
    set_simulated_date(today)
    yield today
    set_simulated_date(None)


@pytest.fixture
def bed_a(full_db, user_a):
    bed = GardenBed(user_id=user_a.id, name='Overdue Test Bed', width=4.0, length=8.0)
    full_db.session.add(bed)
    full_db.session.commit()
    return bed


def _overdue_transplant_iso(today: date) -> str:
    """Transplant date that yields start_date BEFORE today.

    start_date = transplant_date - weeks_indoors. To make start_date exactly
    7 days before today, transplant = today - 7d + 6wks = today + 5wks.
    Wait — that would put start_date at today - 7d, which IS before today.
    """
    # start_date should land 7 days before `today`.
    transplant = today + timedelta(weeks=WEEKS_INDOORS) - timedelta(days=7)
    return datetime.combine(transplant, datetime.min.time()).isoformat() + 'Z'


def _future_transplant_iso(today: date) -> str:
    """Transplant date that yields start_date AFTER today (not overdue)."""
    # start_date should land 7 days after `today`.
    transplant = today + timedelta(weeks=WEEKS_INDOORS) + timedelta(days=7)
    return datetime.combine(transplant, datetime.min.time()).isoformat() + 'Z'


def _make_event(user, garden_bed_id, transplant_iso):
    # PlantingEvent dates are DateTime columns; reuse the same value as the
    # payload so the linked-event update path is exercised realistically.
    transplant_dt = datetime.fromisoformat(transplant_iso.replace('Z', '+00:00')).replace(tzinfo=None)
    event = PlantingEvent(
        user_id=user.id,
        plant_id=PLANT_ID,
        variety=None,
        quantity=4,
        transplant_date=transplant_dt,
        expected_harvest_date=transplant_dt + timedelta(days=70),
        garden_bed_id=garden_bed_id,
    )
    db.session.add(event)
    db.session.commit()
    return event


class TestDryRun:
    def test_dry_run_overdue_reports_would_skip_and_persists_nothing(
        self, auth_client_a, user_a, bed_a, frozen_today
    ):
        transplant_iso = _overdue_transplant_iso(frozen_today)
        event = _make_event(user_a, bed_a.id, transplant_iso)

        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'transplantDate': transplant_iso,
            'desiredQuantity': 4,
            'dryRun': True,
            # overdueMode omitted -> defaults to 'skip'
        })
        assert resp.status_code == 200, resp.get_json()
        body = resp.get_json()
        assert body['dryRun'] is True
        assert body['wouldSkip'] is True
        assert body['skippedReason'] is not None
        assert body['calculation']['isPastDue'] is True
        assert body['calculation']['overdueMode'] == 'skip'
        assert body['calculation']['rescheduled'] is False

        # No row created, no payload
        assert 'indoorSeedStart' not in body
        assert IndoorSeedStart.query.filter_by(user_id=user_a.id).count() == 0

    def test_dry_run_future_shows_would_create(
        self, auth_client_a, user_a, bed_a, frozen_today
    ):
        transplant_iso = _future_transplant_iso(frozen_today)
        event = _make_event(user_a, bed_a.id, transplant_iso)

        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'transplantDate': transplant_iso,
            'desiredQuantity': 4,
            'dryRun': True,
        })
        assert resp.status_code == 200
        body = resp.get_json()
        assert body['dryRun'] is True
        assert body['wouldSkip'] is False
        assert body['skippedReason'] is None
        assert body['calculation']['isPastDue'] is False

        # Still no row — dry run NEVER persists.
        assert IndoorSeedStart.query.filter_by(user_id=user_a.id).count() == 0


class TestOverdueModeSkipDefault:
    def test_default_mode_skips_overdue_rows(
        self, auth_client_a, user_a, bed_a, frozen_today
    ):
        """omit overdueMode on an overdue row -> 200 with skipped=True, no row."""
        transplant_iso = _overdue_transplant_iso(frozen_today)
        event = _make_event(user_a, bed_a.id, transplant_iso)

        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'transplantDate': transplant_iso,
            'desiredQuantity': 4,
        })
        assert resp.status_code == 200, resp.get_json()
        body = resp.get_json()
        assert body['skipped'] is True
        assert 'in the past' in body['skippedReason']
        assert 'skip' in body['skippedReason']
        assert body['calculation']['overdueMode'] == 'skip'

        # No row created.
        assert IndoorSeedStart.query.filter_by(user_id=user_a.id).count() == 0

    def test_explicit_skip_mode_matches_default(
        self, auth_client_a, user_a, bed_a, frozen_today
    ):
        transplant_iso = _overdue_transplant_iso(frozen_today)
        event = _make_event(user_a, bed_a.id, transplant_iso)

        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'transplantDate': transplant_iso,
            'desiredQuantity': 4,
            'overdueMode': 'skip',
        })
        assert resp.status_code == 200
        body = resp.get_json()
        assert body['skipped'] is True
        assert IndoorSeedStart.query.filter_by(user_id=user_a.id).count() == 0

    def test_skip_mode_does_not_affect_non_overdue_rows(
        self, auth_client_a, user_a, bed_a, frozen_today
    ):
        """Non-overdue row with overdueMode='skip' still creates normally."""
        transplant_iso = _future_transplant_iso(frozen_today)
        event = _make_event(user_a, bed_a.id, transplant_iso)

        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'transplantDate': transplant_iso,
            'desiredQuantity': 4,
            'overdueMode': 'skip',
        })
        assert resp.status_code == 201, resp.get_json()
        body = resp.get_json()
        assert 'indoorSeedStart' in body
        assert body['calculation']['isPastDue'] is False
        assert IndoorSeedStart.query.filter_by(user_id=user_a.id).count() == 1


class TestOverdueModeImportAnyway:
    def test_import_anyway_creates_backdated_row(
        self, auth_client_a, user_a, bed_a, frozen_today
    ):
        transplant_iso = _overdue_transplant_iso(frozen_today)
        event = _make_event(user_a, bed_a.id, transplant_iso)

        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'transplantDate': transplant_iso,
            'desiredQuantity': 4,
            'overdueMode': 'import_anyway',
        })
        assert resp.status_code == 201, resp.get_json()
        body = resp.get_json()
        assert 'indoorSeedStart' in body
        assert body['calculation']['isPastDue'] is True
        assert body['calculation']['rescheduled'] is False
        assert 'warning' in body and 'in the past' in body['warning']

        # Persisted start_date is BEFORE today (intentional backdate).
        ss = IndoorSeedStart.query.get(body['indoorSeedStart']['id'])
        assert ss.start_date.date() < frozen_today


class TestOverdueModeRescheduleToday:
    def test_reschedule_clamps_start_date_to_today(
        self, auth_client_a, user_a, bed_a, frozen_today
    ):
        transplant_iso = _overdue_transplant_iso(frozen_today)
        event = _make_event(user_a, bed_a.id, transplant_iso)

        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'transplantDate': transplant_iso,
            'desiredQuantity': 4,
            'overdueMode': 'reschedule_today',
        })
        assert resp.status_code == 201, resp.get_json()
        body = resp.get_json()
        calc = body['calculation']
        assert calc['isPastDue'] is True
        assert calc['rescheduled'] is True

        # start_date was clamped forward to today.
        ss = IndoorSeedStart.query.get(body['indoorSeedStart']['id'])
        assert ss.start_date.date() == frozen_today

        # expected_transplant_date slid forward too: should equal start + weeks_indoors.
        assert ss.expected_transplant_date.date() == (
            frozen_today + timedelta(weeks=WEEKS_INDOORS)
        )

        # Linked PlantingEvent was updated to reflect the rescheduled dates.
        db.session.expire_all()
        linked = PlantingEvent.query.get(event.id)
        assert linked.seed_start_date.date() == frozen_today
        assert linked.transplant_date.date() == (
            frozen_today + timedelta(weeks=WEEKS_INDOORS)
        )

    def test_reschedule_leaves_non_overdue_rows_unchanged(
        self, auth_client_a, user_a, bed_a, frozen_today
    ):
        """On a not-overdue row, reschedule_today is a no-op: start_date stays
        at the computed (transplant - weeks_indoors) value."""
        transplant_iso = _future_transplant_iso(frozen_today)
        event = _make_event(user_a, bed_a.id, transplant_iso)

        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'transplantDate': transplant_iso,
            'desiredQuantity': 4,
            'overdueMode': 'reschedule_today',
        })
        assert resp.status_code == 201, resp.get_json()
        body = resp.get_json()
        calc = body['calculation']
        assert calc['isPastDue'] is False
        assert calc['rescheduled'] is False

        # Expected start_date = today + 7 (from _future_transplant_iso math).
        ss = IndoorSeedStart.query.get(body['indoorSeedStart']['id'])
        assert ss.start_date.date() == frozen_today + timedelta(days=7)


class TestInvalidOverdueMode:
    def test_bogus_mode_returns_400(
        self, auth_client_a, user_a, bed_a, frozen_today
    ):
        transplant_iso = _overdue_transplant_iso(frozen_today)
        event = _make_event(user_a, bed_a.id, transplant_iso)

        resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
            'plantingEventId': event.id,
            'plantId': PLANT_ID,
            'transplantDate': transplant_iso,
            'desiredQuantity': 4,
            'overdueMode': 'burn_it_down',
        })
        assert resp.status_code == 400
        body = resp.get_json()
        assert 'Invalid overdueMode' in body['error']
        assert IndoorSeedStart.query.filter_by(user_id=user_a.id).count() == 0


class TestSimulationClockRespected:
    def test_row_not_overdue_under_simulated_past_today(
        self, auth_client_a, user_a, bed_a
    ):
        """Pin today to a very early simulation date so a transplant date that
        would be overdue under real-time is NOT overdue under simulation —
        proves get_utc_now() (simulation-aware) is what the endpoint uses,
        not datetime.utcnow()."""
        set_simulated_date(date(2020, 1, 1))
        try:
            # In real-time, a 2026-05-15 transplant would never be overdue,
            # but what we really care about: shift simulation so a past
            # real-world date becomes "the future" per the simulation clock.
            transplant = date(2020, 3, 1)  # start_date = 2020-01-19 — after sim today
            transplant_iso = (
                datetime.combine(transplant, datetime.min.time()).isoformat() + 'Z'
            )
            event = _make_event(user_a, bed_a.id, transplant_iso)

            resp = auth_client_a.post('/api/indoor-seed-starts/from-planting-event', json={
                'plantingEventId': event.id,
                'plantId': PLANT_ID,
                'transplantDate': transplant_iso,
                'desiredQuantity': 4,
                # default overdueMode -> skip; should NOT skip since sim today
                # is 2020-01-01 and start_date lands at 2020-01-19.
            })
            assert resp.status_code == 201, resp.get_json()
            body = resp.get_json()
            assert body['calculation']['isPastDue'] is False
        finally:
            set_simulated_date(None)
