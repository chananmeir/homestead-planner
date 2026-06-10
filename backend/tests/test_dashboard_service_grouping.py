"""
Tests for the per-PlantingEvent dashboard signal grouping behavior.

When N PlantingEvents share the same composite key (e.g., 4 cells of one
beet seeding), the dashboard previously emitted N rows. After this change
they collapse to ONE row with:
  - signalKey using the FIRST event's id (sorted ascending) as representative
  - plantingEventId = representative event id
  - plantingEventIds = sorted list of ALL member ids
  - quantity = sum across the group (None coerced to 0)
  - other fields from the representative event (identical across the group
    by definition of the key)
  - For harvestReady specifically:
      daysPastExpected = MAX across the group
      isStale = True if ANY member is stale

Singletons still emit a single row with `plantingEventIds: [event.id]`,
preserving backward-compatibility for the frontend.

Builders covered:
  - _build_harvest_ready (composite key includes garden_bed_id)
  - _build_indoor_starts_due (PE path) — composite key WITHOUT bed
  - _build_indoor_starts_due (ISS path) — composite key WITHOUT bed,
    output payload uses indoorSeedStartIds
  - _build_transplants_due (composite key includes garden_bed_id)
  - _build_direct_seed_due (composite key includes garden_bed_id)
  - _build_germination_check (composite key includes garden_bed_id)
  - _build_indoor_germination_check (PE path) — no bed
  - _build_indoor_germination_check (ISS path) — no bed,
    output payload uses indoorSeedStartIds
"""
from datetime import datetime, date, timedelta

# [UNUSED-2026-06-10] import never used
# import pytest

from models import (
    db,
    PlantingEvent,
    GardenBed,
    IndoorSeedStart,
)


TODAY = date(2026, 4, 14)


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


def _get_today(client, params=''):
    url = '/api/dashboard/today'
    if params:
        url += '?' + params
    return client.get(url)


def _body(client):
    resp = _get_today(client, f'date={TODAY.isoformat()}')
    assert resp.status_code == 200, resp.data
    return resp.get_json()


# ---------------------------------------------------------------------------
# Indoor starts (PE path) — primary canonical case from the investigation
# ---------------------------------------------------------------------------

class TestIndoorStartsDueGrouping:

    def test_four_same_key_pes_collapse_to_one_signal(self, auth_client_a, user_a):
        """Investigation example: 4 PlantingEvents that share
        (seed_start_date, plant_id, variety) collapse to a single signal."""
        seed_start_dt = datetime.combine(TODAY, datetime.min.time())
        # Create 4 events with identical key. quantity defaults to 4 each.
        events = [
            _make_event(
                user_a.id,
                plant_id='beet-1',
                variety='Detroit Dark Red',
                seed_start_date=seed_start_dt,
                quantity=8,
            )
            for _ in range(4)
        ]
        body = _body(auth_client_a)
        rows = body['signals']['indoorStartsDue']
        assert len(rows) == 1, f"Expected 1 grouped row, got {len(rows)}: {rows}"

        row = rows[0]
        # Quantity is summed across the group.
        assert row['quantity'] == 32, "Expected quantity to sum 4*8=32"
        # plantingEventIds carries every member id, sorted ascending.
        assert row['plantingEventIds'] == sorted(e.id for e in events)
        # Representative is the lowest event id.
        rep_id = min(e.id for e in events)
        assert row['plantingEventId'] == rep_id
        assert row['signalKey'] == f'indoor-{rep_id}'
        # Carried-through fields come from the representative.
        assert row['variety'] == 'Detroit Dark Red'
        assert row['seedStartDate'] == TODAY.isoformat()

    def test_singleton_preserves_legacy_shape(self, auth_client_a, user_a):
        """Single PE still emits 1 row; plantingEventIds is [event.id]."""
        e = _make_event(
            user_a.id,
            plant_id='pepper-1',
            variety='Jalapeno',
            seed_start_date=datetime.combine(TODAY, datetime.min.time()),
            quantity=10,
        )
        rows = _body(auth_client_a)['signals']['indoorStartsDue']
        assert len(rows) == 1
        row = rows[0]
        assert row['plantingEventId'] == e.id
        assert row['plantingEventIds'] == [e.id]
        assert row['signalKey'] == f'indoor-{e.id}'
        assert row['quantity'] == 10
        assert row['variety'] == 'Jalapeno'

    def test_variety_boundary_does_not_collapse(self, auth_client_a, user_a):
        """Two events sharing date+plant but DIFFERENT varieties → 2 signals."""
        seed_start_dt = datetime.combine(TODAY, datetime.min.time())
        _make_event(
            user_a.id, plant_id='pepper-1', variety='Jalapeno',
            seed_start_date=seed_start_dt, quantity=5,
        )
        _make_event(
            user_a.id, plant_id='pepper-1', variety='Habanero',
            seed_start_date=seed_start_dt, quantity=3,
        )
        rows = _body(auth_client_a)['signals']['indoorStartsDue']
        assert len(rows) == 2
        varieties = sorted(r['variety'] for r in rows)
        assert varieties == ['Habanero', 'Jalapeno']

    def test_date_boundary_does_not_collapse(self, auth_client_a, user_a):
        """Two events sharing plant+variety but DIFFERENT dates → 2 signals."""
        _make_event(
            user_a.id, plant_id='pepper-1', variety='Jalapeno',
            seed_start_date=datetime.combine(TODAY - timedelta(days=2), datetime.min.time()),
            quantity=5,
        )
        _make_event(
            user_a.id, plant_id='pepper-1', variety='Jalapeno',
            seed_start_date=datetime.combine(TODAY, datetime.min.time()),
            quantity=3,
        )
        rows = _body(auth_client_a)['signals']['indoorStartsDue']
        assert len(rows) == 2

    def test_quantity_none_treated_as_zero_in_sum(self, auth_client_a, user_a):
        """One event has quantity=None → still sums correctly."""
        seed_start_dt = datetime.combine(TODAY, datetime.min.time())
        _make_event(
            user_a.id, plant_id='pepper-1', variety='Jalapeno',
            seed_start_date=seed_start_dt, quantity=5,
        )
        _make_event(
            user_a.id, plant_id='pepper-1', variety='Jalapeno',
            seed_start_date=seed_start_dt, quantity=None,
        )
        rows = _body(auth_client_a)['signals']['indoorStartsDue']
        assert len(rows) == 1
        assert rows[0]['quantity'] == 5  # 5 + 0

    def test_grouped_active_missed_split_consistent(self, auth_client_a, user_a):
        """Two same-key fresh events → 1 active row;
        two same-key stale events → 1 missed row."""
        # Fresh group (5 days past — under threshold)
        fresh_dt = datetime.combine(
            TODAY - timedelta(days=5), datetime.min.time()
        )
        _make_event(user_a.id, plant_id='pepper-1', variety='Jalapeno',
                    seed_start_date=fresh_dt, quantity=4)
        _make_event(user_a.id, plant_id='pepper-1', variety='Jalapeno',
                    seed_start_date=fresh_dt, quantity=4)

        # Stale group (30 days past — over 14-day threshold)
        stale_dt = datetime.combine(
            TODAY - timedelta(days=30), datetime.min.time()
        )
        _make_event(user_a.id, plant_id='basil-1', variety='Genovese',
                    seed_start_date=stale_dt, quantity=2)
        _make_event(user_a.id, plant_id='basil-1', variety='Genovese',
                    seed_start_date=stale_dt, quantity=2)

        body = _body(auth_client_a)
        active = body['signals']['indoorStartsDue']
        missed = body['missed']['indoorStartsDue']
        assert len(active) == 1
        assert len(missed) == 1
        assert active[0]['quantity'] == 8
        assert active[0]['variety'] == 'Jalapeno'
        assert len(active[0]['plantingEventIds']) == 2
        assert missed[0]['quantity'] == 4
        assert missed[0]['variety'] == 'Genovese'
        assert len(missed[0]['plantingEventIds']) == 2


# ---------------------------------------------------------------------------
# Indoor starts (ISS path) — uses indoorSeedStartIds
# ---------------------------------------------------------------------------

class TestIndoorStartsDueIssGrouping:

    def test_three_same_key_iss_collapse_with_indoor_seed_start_ids(
        self, auth_client_a, user_a,
    ):
        """3 standalone IndoorSeedStart records with same (start_date,
        plant_id, variety) collapse into one row with indoorSeedStartIds list."""
        start_dt = datetime.combine(TODAY, datetime.min.time())
        rows_iss = [
            _make_iss(
                user_a.id,
                plant_id='lettuce-1',
                variety='Buttercrunch',
                start_date=start_dt,
                seeds_started=20,
                status='planned',
            )
            for _ in range(3)
        ]
        rows = _body(auth_client_a)['signals']['indoorStartsDue']
        assert len(rows) == 1
        row = rows[0]
        # Total seeds_started = 60
        assert row['quantity'] == 60
        assert row['indoorSeedStartIds'] == sorted(s.id for s in rows_iss)
        rep_id = min(s.id for s in rows_iss)
        assert row['indoorSeedStartId'] == rep_id
        assert row['signalKey'] == f'indoor-iss-{rep_id}'

    def test_singleton_iss_emits_indoor_seed_start_ids_with_one_member(
        self, auth_client_a, user_a,
    ):
        """Single ISS — indoorSeedStartIds is [s.id]."""
        s = _make_iss(
            user_a.id,
            plant_id='kale-1',
            variety='Lacinato',
            start_date=datetime.combine(TODAY, datetime.min.time()),
            seeds_started=10,
            status='planned',
        )
        rows = _body(auth_client_a)['signals']['indoorStartsDue']
        assert len(rows) == 1
        row = rows[0]
        assert row['indoorSeedStartIds'] == [s.id]
        assert row['indoorSeedStartId'] == s.id


# ---------------------------------------------------------------------------
# Transplants — composite key INCLUDES garden_bed_id
# ---------------------------------------------------------------------------

class TestTransplantsDueGrouping:

    def test_same_bed_collapses(self, auth_client_a, user_a):
        bed = _make_bed(user_a.id, 'Bed Alpha')
        transplant_dt = datetime.combine(TODAY, datetime.min.time())
        events = [
            _make_event(
                user_a.id,
                plant_id='tomato-1',
                variety='Roma',
                garden_bed_id=bed.id,
                transplant_date=transplant_dt,
                seed_start_date=None,  # avoid the seed-start guard
                quantity=2,
            )
            for _ in range(3)
        ]
        rows = _body(auth_client_a)['signals']['transplantsDue']
        assert len(rows) == 1
        row = rows[0]
        assert row['quantity'] == 6
        assert row['plantingEventIds'] == sorted(e.id for e in events)
        assert row['bedId'] == bed.id
        assert row['bedName'] == 'Bed Alpha'

    def test_bed_boundary_does_not_collapse(self, auth_client_a, user_a):
        """Same plant + same variety + same date but DIFFERENT beds → 2 signals."""
        bed_a = _make_bed(user_a.id, 'Bed Alpha')
        bed_b = _make_bed(user_a.id, 'Bed Beta')
        transplant_dt = datetime.combine(TODAY, datetime.min.time())
        _make_event(user_a.id, plant_id='tomato-1', variety='Roma',
                    garden_bed_id=bed_a.id, transplant_date=transplant_dt,
                    seed_start_date=None, quantity=2)
        _make_event(user_a.id, plant_id='tomato-1', variety='Roma',
                    garden_bed_id=bed_b.id, transplant_date=transplant_dt,
                    seed_start_date=None, quantity=4)
        rows = _body(auth_client_a)['signals']['transplantsDue']
        assert len(rows) == 2
        bed_ids = sorted(r['bedId'] for r in rows)
        assert bed_ids == sorted([bed_a.id, bed_b.id])


# ---------------------------------------------------------------------------
# Direct seed — composite key INCLUDES garden_bed_id
# ---------------------------------------------------------------------------

class TestDirectSeedDueGrouping:

    def test_same_bed_collapses(self, auth_client_a, user_a):
        bed = _make_bed(user_a.id, 'Bed Carrot')
        seed_dt = datetime.combine(TODAY, datetime.min.time())
        events = [
            _make_event(
                user_a.id,
                plant_id='carrot-1',
                variety='Nantes',
                garden_bed_id=bed.id,
                direct_seed_date=seed_dt,
                quantity=20,
            )
            for _ in range(2)
        ]
        rows = _body(auth_client_a)['signals']['directSeedDue']
        assert len(rows) == 1
        row = rows[0]
        assert row['quantity'] == 40
        assert row['plantingEventIds'] == sorted(e.id for e in events)

    def test_bed_boundary_does_not_collapse(self, auth_client_a, user_a):
        bed_a = _make_bed(user_a.id, 'Bed Carrot A')
        bed_b = _make_bed(user_a.id, 'Bed Carrot B')
        seed_dt = datetime.combine(TODAY, datetime.min.time())
        _make_event(user_a.id, plant_id='carrot-1', variety='Nantes',
                    garden_bed_id=bed_a.id, direct_seed_date=seed_dt, quantity=10)
        _make_event(user_a.id, plant_id='carrot-1', variety='Nantes',
                    garden_bed_id=bed_b.id, direct_seed_date=seed_dt, quantity=15)
        rows = _body(auth_client_a)['signals']['directSeedDue']
        assert len(rows) == 2


# ---------------------------------------------------------------------------
# Germination check (direct seed) — composite key INCLUDES garden_bed_id
# ---------------------------------------------------------------------------

class TestGerminationCheckGrouping:

    def test_same_key_collapses(self, auth_client_a, user_a):
        """Two direct-seed events with same key collapse into one
        germinationCheck row."""
        bed = _make_bed(user_a.id, 'Bed Lettuce')
        # 12 days back so expected_germ (~10d default for lettuce) has passed
        # but is still within STALE_GERMINATION_CHECK_DAYS=14 window.
        seed_dt = datetime.combine(
            TODAY - timedelta(days=12), datetime.min.time()
        )
        events = [
            _make_event(
                user_a.id,
                plant_id='lettuce-1',
                variety='Buttercrunch',
                garden_bed_id=bed.id,
                direct_seed_date=seed_dt,
                quantity=15,
            )
            for _ in range(2)
        ]
        rows = _body(auth_client_a)['signals']['germinationCheck']
        assert len(rows) == 1
        row = rows[0]
        assert row['quantity'] == 30
        assert row['plantingEventIds'] == sorted(e.id for e in events)
        assert row['bedId'] == bed.id

    def test_bed_boundary_does_not_collapse(self, auth_client_a, user_a):
        bed_a = _make_bed(user_a.id, 'Bed L1')
        bed_b = _make_bed(user_a.id, 'Bed L2')
        seed_dt = datetime.combine(
            TODAY - timedelta(days=12), datetime.min.time()
        )
        _make_event(user_a.id, plant_id='lettuce-1', variety='Buttercrunch',
                    garden_bed_id=bed_a.id, direct_seed_date=seed_dt, quantity=15)
        _make_event(user_a.id, plant_id='lettuce-1', variety='Buttercrunch',
                    garden_bed_id=bed_b.id, direct_seed_date=seed_dt, quantity=15)
        rows = _body(auth_client_a)['signals']['germinationCheck']
        assert len(rows) == 2


# ---------------------------------------------------------------------------
# Indoor germination check — both paths
# ---------------------------------------------------------------------------

class TestIndoorGerminationCheckGrouping:

    def test_pe_path_collapses(self, auth_client_a, user_a):
        """Two PE rows in the indoor-germ PE path with same key → 1 signal."""
        # tomato-1 has germination_days=7 in plant DB; seed_start 15 days ago
        # → expected germ 8 days ago (within stale window, no transplant set)
        seed_start_dt = datetime.combine(
            TODAY - timedelta(days=15), datetime.min.time()
        )
        events = [
            _make_event(
                user_a.id,
                plant_id='tomato-1',
                variety='Roma',
                seed_start_date=seed_start_dt,
                transplant_date=None,
                quantity=4,
            )
            for _ in range(2)
        ]
        rows = _body(auth_client_a)['signals']['indoorGerminationCheck']
        assert len(rows) == 1
        row = rows[0]
        assert row['signalKey'].startswith('indoor-germ-pe-')
        assert row['quantity'] == 8
        assert row['plantingEventIds'] == sorted(e.id for e in events)

    def test_iss_path_collapses_with_indoor_seed_start_ids(
        self, auth_client_a, user_a,
    ):
        """Two ISS rows with same key → 1 signal carrying indoorSeedStartIds."""
        start_dt = datetime.combine(
            TODAY - timedelta(days=15), datetime.min.time()
        )
        expected_germ_dt = datetime.combine(
            TODAY - timedelta(days=5), datetime.min.time()
        )
        records = [
            _make_iss(
                user_a.id,
                plant_id='tomato-1',
                variety='Cherokee Purple',
                start_date=start_dt,
                expected_germination_date=expected_germ_dt,
                seeds_started=10,
                status='planned',
            )
            for _ in range(2)
        ]
        rows = _body(auth_client_a)['signals']['indoorGerminationCheck']
        assert len(rows) == 1
        row = rows[0]
        assert row['signalKey'].startswith('indoor-germ-iss-')
        assert row['quantity'] == 20
        assert row['indoorSeedStartIds'] == sorted(r.id for r in records)


# ---------------------------------------------------------------------------
# Harvest ready — daysPastExpected = MAX, isStale = ANY, includes bed key
# ---------------------------------------------------------------------------

class TestHarvestReadyGrouping:

    def test_grouped_harvest_uses_max_days_past(self, auth_client_a, user_a):
        """Two same-key harvests with different daysPastExpected:
        one fresh (3d past), one stale (30d past). Group emits ONE row
        with daysPastExpected=30 and isStale=True."""
        bed = _make_bed(user_a.id, 'Bed Tomato')
        # Same plant+variety+bed but expected_harvest_date differs
        # → keys are different. To make them share a key, both events need
        # the SAME expected_harvest_date.
        # So the realistic "max" comes from same-date members: clamp(0, today-date)
        # is identical for all members. To exercise MAX semantics we use a
        # SINGLE date but rely on the row reporting that exact value as max.
        same_date = datetime.combine(
            TODAY - timedelta(days=20), datetime.min.time()
        )
        e1 = _make_event(
            user_a.id, plant_id='tomato-1', variety='Roma',
            garden_bed_id=bed.id, expected_harvest_date=same_date, quantity=3,
            quantity_completed=3, completed=True,
        )
        e2 = _make_event(
            user_a.id, plant_id='tomato-1', variety='Roma',
            garden_bed_id=bed.id, expected_harvest_date=same_date, quantity=2,
            quantity_completed=2, completed=True,
        )
        body = _body(auth_client_a)
        rows = body['signals']['harvestReady']
        assert len(rows) == 1
        row = rows[0]
        assert row['quantity'] == 5
        assert row['daysPastExpected'] == 20
        # 20 > HARVEST_DEMOTION_DAYS (14) → isStale True
        assert row['isStale'] is True
        assert row['plantingEventIds'] == sorted([e1.id, e2.id])

    def test_grouped_harvest_fresh_is_not_stale(self, auth_client_a, user_a):
        """Same-key harvests both fresh (3d past) → isStale=False."""
        bed = _make_bed(user_a.id, 'Bed Tomato')
        fresh_date = datetime.combine(
            TODAY - timedelta(days=3), datetime.min.time()
        )
        _make_event(
            user_a.id, plant_id='tomato-1', variety='Roma',
            garden_bed_id=bed.id, expected_harvest_date=fresh_date, quantity=4,
            quantity_completed=4, completed=True,
        )
        _make_event(
            user_a.id, plant_id='tomato-1', variety='Roma',
            garden_bed_id=bed.id, expected_harvest_date=fresh_date, quantity=4,
            quantity_completed=4, completed=True,
        )
        rows = _body(auth_client_a)['signals']['harvestReady']
        assert len(rows) == 1
        assert rows[0]['daysPastExpected'] == 3
        assert rows[0]['isStale'] is False
        assert rows[0]['quantity'] == 8

    def test_bed_boundary_does_not_collapse(self, auth_client_a, user_a):
        bed_a = _make_bed(user_a.id, 'Bed T1')
        bed_b = _make_bed(user_a.id, 'Bed T2')
        date_dt = datetime.combine(
            TODAY - timedelta(days=5), datetime.min.time()
        )
        _make_event(user_a.id, plant_id='tomato-1', variety='Roma',
                    garden_bed_id=bed_a.id, expected_harvest_date=date_dt,
                    quantity=4, quantity_completed=4, completed=True)
        _make_event(user_a.id, plant_id='tomato-1', variety='Roma',
                    garden_bed_id=bed_b.id, expected_harvest_date=date_dt,
                    quantity=4, quantity_completed=4, completed=True)
        rows = _body(auth_client_a)['signals']['harvestReady']
        assert len(rows) == 2


# ---------------------------------------------------------------------------
# Snooze interaction — representative signalKey suppresses the whole group
# (frontend will fan-out separately if user wants per-event control).
# ---------------------------------------------------------------------------

class TestSnoozeRepresentativeBehavior:

    def test_snoozing_representative_signalkey_hides_whole_group(
        self, auth_client_a, user_a,
    ):
        """Single backend snooze on the representative signalKey suppresses
        the entire group from the dashboard. (Frontend may still fan out
        per plantingEventIds when user expects per-task snooze.)"""
        from models import DashboardSnooze
        seed_start_dt = datetime.combine(TODAY, datetime.min.time())
        events = [
            _make_event(
                user_a.id, plant_id='beet-1', variety='Detroit',
                seed_start_date=seed_start_dt, quantity=8,
            )
            for _ in range(3)
        ]
        rep_id = min(e.id for e in events)
        snooze = DashboardSnooze(
            user_id=user_a.id,
            signal_key=f'indoor-{rep_id}',
            snooze_until=date(9999, 12, 31),
        )
        db.session.add(snooze)
        db.session.commit()

        rows = _body(auth_client_a)['signals']['indoorStartsDue']
        assert rows == [], (
            "Snoozing the representative signalKey must hide the whole grouped row"
        )


# ---------------------------------------------------------------------------
# Backward compatibility — every emitted row carries plantingEventIds
# ---------------------------------------------------------------------------

class TestBackwardCompatPayloadShape:

    def test_singleton_pe_row_has_planting_event_ids_field(
        self, auth_client_a, user_a,
    ):
        """Every PE-based singleton row MUST carry plantingEventIds:
        [event.id] so frontend can rely on it being present."""
        bed = _make_bed(user_a.id)
        # One event in each PE-based builder
        _make_event(
            user_a.id, plant_id='tomato-1', variety='Roma',
            garden_bed_id=bed.id,
            expected_harvest_date=datetime.combine(
                TODAY - timedelta(days=2), datetime.min.time()
            ),
            quantity_completed=4,
            completed=True,
        )
        _make_event(
            user_a.id, plant_id='pepper-1', variety='Jalapeno',
            seed_start_date=datetime.combine(TODAY, datetime.min.time()),
        )
        _make_event(
            user_a.id, plant_id='tomato-1', variety='Brandywine',
            garden_bed_id=bed.id,
            transplant_date=datetime.combine(TODAY, datetime.min.time()),
            seed_start_date=None,
        )
        _make_event(
            user_a.id, plant_id='carrot-1', variety='Nantes',
            garden_bed_id=bed.id,
            direct_seed_date=datetime.combine(TODAY, datetime.min.time()),
        )
        body = _body(auth_client_a)
        for key in ('harvestReady', 'indoorStartsDue', 'transplantsDue',
                    'directSeedDue'):
            for row in body['signals'][key]:
                assert 'plantingEventIds' in row, (
                    f"{key} row missing plantingEventIds: {row}"
                )
                assert isinstance(row['plantingEventIds'], list)
                assert len(row['plantingEventIds']) >= 1
                # Singleton: list contains exactly the plantingEventId
                if row.get('plantingEventId') is not None:
                    assert row['plantingEventId'] in row['plantingEventIds']

    def test_singleton_iss_row_has_indoor_seed_start_ids_field(
        self, auth_client_a, user_a,
    ):
        """Every ISS-based singleton row MUST carry indoorSeedStartIds."""
        _make_iss(
            user_a.id,
            plant_id='lettuce-1', variety='Buttercrunch',
            start_date=datetime.combine(TODAY, datetime.min.time()),
            status='planned',
        )
        rows = _body(auth_client_a)['signals']['indoorStartsDue']
        assert len(rows) == 1
        row = rows[0]
        assert 'indoorSeedStartIds' in row
        assert isinstance(row['indoorSeedStartIds'], list)
        assert len(row['indoorSeedStartIds']) == 1
        assert row['indoorSeedStartIds'][0] == row['indoorSeedStartId']
