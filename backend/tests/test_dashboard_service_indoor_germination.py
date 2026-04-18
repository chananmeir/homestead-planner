"""
Tests for the `_build_indoor_germination_check` dashboard signal builder
and its wiring into `build_dashboard_today`.

This signal surfaces indoor seed starts whose expected germination date has
arrived but have not yet been marked as germinated. It has two data paths:

  (a) IndoorSeedStart records (primary source, richer data):
      - status NOT in ('germinating', 'growing', 'ready', 'transplanted')
      - actual_germination_date IS NULL
      - expected_germination_date <= target_date  (or fallback from
        start_date + plant.germination_days)

  (b) PlantingEvent records (fallback for events without a linked ISS):
      - seed_start_date set, not is_complete
      - seed_start_date + plant.germination_days <= target_date
      - dedup: skip if any ISS already references this event
      - suppress events whose transplant_date <= target_date (the
        "transplant due" signal will surface those instead)
"""
from datetime import datetime, date, timedelta

import pytest

from models import (
    db,
    PlantingEvent,
    IndoorSeedStart,
    DashboardSnooze,
)
from services.dashboard_service import (
    _build_indoor_germination_check,
    build_dashboard_today,
)


# ---------------------------------------------------------------------------
# Test constants & helpers
# ---------------------------------------------------------------------------

TODAY = date(2026, 4, 14)


def _make_iss(user_id, **kwargs):
    """Create an IndoorSeedStart with sensible defaults for these tests."""
    defaults = {
        'plant_id': 'tomato-1',           # has germination_days=7 in plant DB
        'variety': 'Cherokee Purple',
        'start_date': datetime.combine(TODAY - timedelta(days=15), datetime.min.time()),
        'expected_germination_date': datetime.combine(
            TODAY - timedelta(days=5), datetime.min.time()
        ),
        'seeds_started': 10,
        'status': 'planned',
    }
    defaults.update(kwargs)
    iss = IndoorSeedStart(user_id=user_id, **defaults)
    db.session.add(iss)
    db.session.commit()
    return iss


def _make_event(user_id, **kwargs):
    """Create a PlantingEvent with sensible defaults for these tests."""
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


# ---------------------------------------------------------------------------
# Path (a): IndoorSeedStart-driven rows
# ---------------------------------------------------------------------------

class TestISSPath:
    """Tests for IndoorSeedStart records being surfaced by the signal."""

    def test_fires_when_expected_germ_passed_and_status_planned(
        self, sample_user
    ):
        """The canonical happy path: status=planned, no actual germination,
        expected germination <= today => row fires."""
        iss = _make_iss(
            sample_user.id,
            start_date=datetime.combine(
                TODAY - timedelta(days=15), datetime.min.time()
            ),
            expected_germination_date=datetime.combine(
                TODAY - timedelta(days=5), datetime.min.time()
            ),
            status='planned',
            seeds_started=10,
            plant_id='tomato-1',
        )

        rows = _build_indoor_germination_check(sample_user.id, TODAY)

        assert len(rows) == 1
        row = rows[0]
        assert row['signalKey'].startswith('indoor-germ-iss-')
        assert row['signalKey'] == f'indoor-germ-iss-{iss.id}'
        assert row['indoorSeedStartId'] == iss.id
        assert row['plantingEventId'] is None
        assert row['expectedGerminationDate'] == (
            TODAY - timedelta(days=5)
        ).isoformat()
        assert row['quantity'] == 10

    def test_does_not_fire_when_expected_germ_in_future(self, sample_user):
        """Expected germination has not arrived yet => no row."""
        _make_iss(
            sample_user.id,
            expected_germination_date=datetime.combine(
                TODAY + timedelta(days=5), datetime.min.time()
            ),
            status='planned',
        )

        rows = _build_indoor_germination_check(sample_user.id, TODAY)
        assert rows == []

    def test_does_not_fire_when_actual_germination_set(self, sample_user):
        """If the user already marked it as germinated => no row."""
        _make_iss(
            sample_user.id,
            expected_germination_date=datetime.combine(
                TODAY - timedelta(days=5), datetime.min.time()
            ),
            actual_germination_date=datetime.combine(
                TODAY - timedelta(days=3), datetime.min.time()
            ),
            status='planned',
        )

        rows = _build_indoor_germination_check(sample_user.id, TODAY)
        assert rows == []

    @pytest.mark.parametrize(
        'status',
        ['germinating', 'growing', 'ready', 'transplanted'],
    )
    def test_does_not_fire_for_post_germination_statuses(
        self, sample_user, status
    ):
        """Once status moves past 'planned'/'seeded', the signal goes silent."""
        _make_iss(
            sample_user.id,
            expected_germination_date=datetime.combine(
                TODAY - timedelta(days=5), datetime.min.time()
            ),
            status=status,
        )

        rows = _build_indoor_germination_check(sample_user.id, TODAY)
        assert rows == [], (
            f"Status {status!r} should suppress the indoor germination signal"
        )

    def test_falls_back_to_start_date_plus_germination_days_when_expected_null(
        self, sample_user
    ):
        """When expected_germination_date is NULL, the builder must compute
        it from start_date + plant.germination_days. Use tomato-1 which has
        germination_days=7 in plant_database.py."""
        # start_date 20 days ago + 7 germ days => expected 13 days ago,
        # which is <= today => should fire.
        start_dt = datetime.combine(
            TODAY - timedelta(days=20), datetime.min.time()
        )
        iss = _make_iss(
            sample_user.id,
            plant_id='tomato-1',           # germination_days=7
            start_date=start_dt,
            expected_germination_date=None,
            status='planned',
        )

        rows = _build_indoor_germination_check(sample_user.id, TODAY)

        assert len(rows) == 1
        row = rows[0]
        assert row['indoorSeedStartId'] == iss.id
        # 20 days ago + 7 germ_days = 13 days ago
        expected = (TODAY - timedelta(days=13)).isoformat()
        assert row['expectedGerminationDate'] == expected
        assert row['germinationDays'] == 7


# ---------------------------------------------------------------------------
# Path (b): PlantingEvent-driven rows (fallback)
# ---------------------------------------------------------------------------

class TestPEPath:
    """Tests for PlantingEvent records being surfaced when no ISS link exists."""

    def test_fires_when_seed_start_plus_germ_days_passed(self, sample_user):
        """seed_start_date 15 days ago, tomato germ_days=7 => expected germ
        8 days ago, which is <= today => row fires."""
        event = _make_event(
            sample_user.id,
            plant_id='tomato-1',
            seed_start_date=datetime.combine(
                TODAY - timedelta(days=15), datetime.min.time()
            ),
            transplant_date=None,
            completed=False,
            quantity=4,
        )

        rows = _build_indoor_germination_check(sample_user.id, TODAY)

        assert len(rows) == 1
        row = rows[0]
        assert row['signalKey'].startswith('indoor-germ-pe-')
        assert row['signalKey'] == f'indoor-germ-pe-{event.id}'
        assert row['plantingEventId'] == event.id
        assert row['indoorSeedStartId'] is None

    def test_suppressed_when_transplant_date_passed(self, sample_user):
        """If transplant_date <= today, the 'transplant due' signal owns the
        row — this signal must stay quiet."""
        _make_event(
            sample_user.id,
            plant_id='tomato-1',
            seed_start_date=datetime.combine(
                TODAY - timedelta(days=15), datetime.min.time()
            ),
            transplant_date=datetime.combine(
                TODAY - timedelta(days=1), datetime.min.time()
            ),
            completed=False,
            quantity=4,
        )

        rows = _build_indoor_germination_check(sample_user.id, TODAY)
        assert rows == []

    def test_suppressed_when_event_is_complete(self, sample_user):
        """is_complete events are not actionable for germination check."""
        _make_event(
            sample_user.id,
            plant_id='tomato-1',
            seed_start_date=datetime.combine(
                TODAY - timedelta(days=15), datetime.min.time()
            ),
            transplant_date=None,
            quantity=4,
            quantity_completed=4,        # >= quantity => is_complete True
            completed=True,
        )

        rows = _build_indoor_germination_check(sample_user.id, TODAY)
        assert rows == []


# ---------------------------------------------------------------------------
# Dedup between paths
# ---------------------------------------------------------------------------

class TestDedup:
    """When an ISS row points at a PE, the PE must NOT also surface."""

    def test_iss_dedups_linked_planting_event(self, sample_user):
        # First create the planting event that would fire on its own.
        event = _make_event(
            sample_user.id,
            plant_id='tomato-1',
            seed_start_date=datetime.combine(
                TODAY - timedelta(days=15), datetime.min.time()
            ),
            transplant_date=None,
            completed=False,
            quantity=4,
        )
        # Then create the ISS that links to it AND would fire on its own.
        iss = _make_iss(
            sample_user.id,
            plant_id='tomato-1',
            expected_germination_date=datetime.combine(
                TODAY - timedelta(days=5), datetime.min.time()
            ),
            status='planned',
            planting_event_id=event.id,
        )

        rows = _build_indoor_germination_check(sample_user.id, TODAY)

        assert len(rows) == 1, (
            f"Expected exactly 1 deduped row, got {len(rows)}: {rows}"
        )
        assert rows[0]['signalKey'].startswith('indoor-germ-iss-')
        assert rows[0]['signalKey'] == f'indoor-germ-iss-{iss.id}'
        # Cross-checks: PE id is preserved on the ISS row (it's set on the
        # ISS), so plantingEventId here equals event.id, but signalKey
        # confirms which path produced the row.
        assert rows[0]['plantingEventId'] == event.id


# ---------------------------------------------------------------------------
# build_dashboard_today wiring + snooze filtering
# ---------------------------------------------------------------------------

class TestBuildDashboardWiring:

    def test_indoor_germination_key_present_in_signals(self, sample_user):
        """The new key must be present in build_dashboard_today's output and
        must be a list (even when empty)."""
        result = build_dashboard_today(sample_user.id, TODAY)

        assert 'signals' in result
        assert 'indoorGerminationCheck' in result['signals']
        assert isinstance(result['signals']['indoorGerminationCheck'], list)

    def test_snooze_filters_indoor_germination_row(self, sample_user):
        """Snoozing the row's signalKey through the dashboard's snooze list
        removes it from build_dashboard_today output."""
        iss = _make_iss(
            sample_user.id,
            expected_germination_date=datetime.combine(
                TODAY - timedelta(days=5), datetime.min.time()
            ),
            status='planned',
        )
        signal_key = f'indoor-germ-iss-{iss.id}'

        # First confirm it shows up before snoozing.
        before = build_dashboard_today(sample_user.id, TODAY)
        assert any(
            r['signalKey'] == signal_key
            for r in before['signals']['indoorGerminationCheck']
        ), 'precondition: row should be present before snooze'

        # Snooze through tomorrow.
        snooze = DashboardSnooze(
            user_id=sample_user.id,
            signal_key=signal_key,
            snooze_until=TODAY + timedelta(days=1),
        )
        db.session.add(snooze)
        db.session.commit()

        after = build_dashboard_today(sample_user.id, TODAY)
        keys = [r['signalKey'] for r in after['signals']['indoorGerminationCheck']]
        assert signal_key not in keys, (
            f'Snoozed signalKey {signal_key} should be filtered out, '
            f'but found in: {keys}'
        )
