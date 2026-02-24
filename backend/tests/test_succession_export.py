"""
Integration tests for export_to_calendar() in garden_planner_service.py.

Covers the three export code paths (legacy, bed-allocated, trellis),
idempotent re-export, DTM/harvest-date computation, and edge cases.

Uses real plant IDs from plant_database.py so get_plant_by_id() lookups
succeed without mocking.
"""

import json
from datetime import date, datetime, timedelta

import pytest
from models import db, GardenPlanItem, PlantingEvent, SeedInventory
from services.garden_planner_service import export_to_calendar


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_item(db_session, plan, **kwargs):
    """Create a GardenPlanItem with sensible defaults."""
    defaults = dict(
        garden_plan_id=plan.id,
        plant_id='tomato-1',
        target_value=10,
        plant_equivalent=10,
        first_plant_date=date(2026, 5, 1),
        succession_count=1,
        succession_interval_days=14,
    )
    defaults.update(kwargs)
    item = GardenPlanItem(**defaults)
    db_session.add(item)
    db_session.flush()
    return item


def _get_events(user_id):
    """Query all PlantingEvents for a user, ordered by direct_seed_date."""
    return (
        PlantingEvent.query
        .filter_by(user_id=user_id)
        .order_by(PlantingEvent.direct_seed_date, PlantingEvent.id)
        .all()
    )


# ===================================================================
# LEGACY EXPORT PATH (no bed_assignments, no trellis)
# ===================================================================

class TestLegacyExportPath:
    """Tests for the legacy code path: no bed assignments, no trellis."""

    def test_single_item_no_succession(self, db_session, sample_user, sample_plan):
        """Single plan item, succession_count=1 → 1 PlantingEvent."""
        _make_item(db_session, sample_plan, target_value=10, succession_count=1)

        result = export_to_calendar(sample_plan.id, sample_user.id)

        assert result['success'] is True
        assert result['eventsCreated'] == 1
        assert result['eventsUpdated'] == 0

        events = _get_events(sample_user.id)
        assert len(events) == 1
        ev = events[0]
        assert ev.plant_id == 'tomato-1'
        assert ev.quantity == 10
        assert ev.direct_seed_date == datetime(2026, 5, 1)
        assert ev.garden_bed_id is None
        assert ev.succession_planting is False
        assert ev.succession_group_id is None

    def test_four_successions_even_split(self, db_session, sample_user, sample_plan):
        """20 plants / 4 successions → 4 events with qty 5 each."""
        _make_item(
            db_session, sample_plan,
            target_value=20, succession_count=4, succession_interval_days=14,
        )

        result = export_to_calendar(sample_plan.id, sample_user.id)

        assert result['eventsCreated'] == 4
        events = _get_events(sample_user.id)
        assert len(events) == 4

        # All events share the same succession_group_id
        group_ids = {e.succession_group_id for e in events}
        assert len(group_ids) == 1
        assert None not in group_ids

        # Quantities all equal
        assert [e.quantity for e in events] == [5, 5, 5, 5]

        # Dates offset by 14 days
        base = datetime(2026, 5, 1)
        for i, ev in enumerate(events):
            assert ev.direct_seed_date == base + timedelta(days=14 * i)
            assert ev.succession_planting is True
            assert ev.succession_interval == 14

    def test_four_successions_remainder(self, db_session, sample_user, sample_plan):
        """21 plants / 4 successions → [6, 5, 5, 5] (remainder=1)."""
        _make_item(
            db_session, sample_plan,
            target_value=21, succession_count=4, succession_interval_days=14,
        )

        result = export_to_calendar(sample_plan.id, sample_user.id)
        events = _get_events(sample_user.id)
        assert [e.quantity for e in events] == [6, 5, 5, 5]

    def test_eight_successions_large_remainder(self, db_session, sample_user, sample_plan):
        """50 plants / 8 successions → [7,7,6,6,6,6,6,6] (remainder=2)."""
        _make_item(
            db_session, sample_plan,
            target_value=50, succession_count=8, succession_interval_days=7,
        )

        result = export_to_calendar(sample_plan.id, sample_user.id)
        events = _get_events(sample_user.id)
        assert len(events) == 8
        assert [e.quantity for e in events] == [7, 7, 6, 6, 6, 6, 6, 6]

    def test_single_succession_no_group_id(self, db_session, sample_user, sample_plan):
        """succession_count=1 → succession_group_id is None."""
        _make_item(db_session, sample_plan, target_value=5, succession_count=1)

        export_to_calendar(sample_plan.id, sample_user.id)
        events = _get_events(sample_user.id)
        assert len(events) == 1
        assert events[0].succession_group_id is None
        assert events[0].succession_planting is False

    def test_item_without_first_plant_date_skipped(self, db_session, sample_user, sample_plan):
        """Item with no first_plant_date → no events created."""
        _make_item(db_session, sample_plan, first_plant_date=None)

        result = export_to_calendar(sample_plan.id, sample_user.id)
        assert result['success'] is True
        assert result['eventsCreated'] == 0
        assert _get_events(sample_user.id) == []

    def test_expected_harvest_date_from_plant_dtm(self, db_session, sample_user, sample_plan):
        """Harvest date = seed_date + daysToMaturity (tomato-1 → 70 days)."""
        _make_item(
            db_session, sample_plan,
            plant_id='tomato-1', target_value=5, succession_count=1,
            first_plant_date=date(2026, 5, 1),
        )

        export_to_calendar(sample_plan.id, sample_user.id)
        ev = _get_events(sample_user.id)[0]
        expected = datetime(2026, 7, 10)  # May 1 + 70 days
        assert ev.expected_harvest_date == expected

    def test_export_key_format_legacy(self, db_session, sample_user, sample_plan):
        """Export key format: {item.id}_{date}_{i}."""
        item = _make_item(
            db_session, sample_plan,
            target_value=10, succession_count=2, succession_interval_days=14,
            first_plant_date=date(2026, 5, 1),
        )

        export_to_calendar(sample_plan.id, sample_user.id)
        events = _get_events(sample_user.id)
        assert events[0].export_key == f"{item.id}_2026-05-01_0"
        assert events[1].export_key == f"{item.id}_2026-05-15_1"


# ===================================================================
# BED-ALLOCATED EXPORT PATH
# ===================================================================

class TestBedAllocatedExportPath:
    """Tests for the bed_assignments code path."""

    def test_single_bed_single_succession(self, db_session, sample_user, sample_plan, sample_bed):
        """One bed, succession_count=1 → 1 event with garden_bed_id set."""
        _make_item(
            db_session, sample_plan,
            target_value=10, succession_count=1,
            bed_assignments=json.dumps([{"bedId": sample_bed.id, "quantity": 10}]),
        )

        result = export_to_calendar(sample_plan.id, sample_user.id)
        assert result['eventsCreated'] == 1

        events = _get_events(sample_user.id)
        assert len(events) == 1
        assert events[0].garden_bed_id == sample_bed.id
        assert events[0].quantity == 10

    def test_two_beds_even_allocation(self, db_session, sample_user, sample_plan, sample_bed, second_bed):
        """Two beds, each with 15 plants, succession_count=1 → 2 events."""
        _make_item(
            db_session, sample_plan,
            target_value=30, succession_count=1,
            bed_assignments=json.dumps([
                {"bedId": sample_bed.id, "quantity": 15},
                {"bedId": second_bed.id, "quantity": 15},
            ]),
        )

        result = export_to_calendar(sample_plan.id, sample_user.id)
        assert result['eventsCreated'] == 2

        events = _get_events(sample_user.id)
        bed_ids = {e.garden_bed_id for e in events}
        assert bed_ids == {sample_bed.id, second_bed.id}
        assert all(e.quantity == 15 for e in events)

    def test_two_beds_with_four_successions(self, db_session, sample_user, sample_plan, sample_bed, second_bed):
        """2 beds * 4 successions = 8 events total."""
        _make_item(
            db_session, sample_plan,
            target_value=40, succession_count=4, succession_interval_days=14,
            bed_assignments=json.dumps([
                {"bedId": sample_bed.id, "quantity": 20},
                {"bedId": second_bed.id, "quantity": 20},
            ]),
        )

        result = export_to_calendar(sample_plan.id, sample_user.id)
        assert result['eventsCreated'] == 8

        events = _get_events(sample_user.id)
        bed_a_events = [e for e in events if e.garden_bed_id == sample_bed.id]
        bed_b_events = [e for e in events if e.garden_bed_id == second_bed.id]
        assert len(bed_a_events) == 4
        assert len(bed_b_events) == 4
        # 20 / 4 = 5 each, no remainder
        assert all(e.quantity == 5 for e in bed_a_events)
        assert all(e.quantity == 5 for e in bed_b_events)

    def test_remainder_distribution_per_bed(self, db_session, sample_user, sample_plan, sample_bed):
        """bed_qty=7, succession_count=3 → [3, 2, 2]."""
        _make_item(
            db_session, sample_plan,
            target_value=7, succession_count=3, succession_interval_days=14,
            bed_assignments=json.dumps([{"bedId": sample_bed.id, "quantity": 7}]),
        )

        result = export_to_calendar(sample_plan.id, sample_user.id)
        events = _get_events(sample_user.id)
        assert [e.quantity for e in events] == [3, 2, 2]

    def test_legacy_beds_allocated_fallback(self, db_session, sample_user, sample_plan, sample_bed, second_bed):
        """Only beds_allocated set (no bed_assignments) → auto-computes per-bed quantities."""
        _make_item(
            db_session, sample_plan,
            target_value=15, succession_count=1,
            beds_allocated=json.dumps([sample_bed.id, second_bed.id]),
        )

        result = export_to_calendar(sample_plan.id, sample_user.id)
        assert result['eventsCreated'] == 2

        events = _get_events(sample_user.id)
        # 15 / 2 beds = base 7, remainder 1 → first bed gets 8, second gets 7
        qtys = sorted([e.quantity for e in events], reverse=True)
        assert qtys == [8, 7]

    def test_export_key_includes_bed_id(self, db_session, sample_user, sample_plan, sample_bed):
        """Export key format for bed path: {item.id}_{bed_id}_{date}_{i}."""
        item = _make_item(
            db_session, sample_plan,
            target_value=5, succession_count=1,
            first_plant_date=date(2026, 5, 1),
            bed_assignments=json.dumps([{"bedId": sample_bed.id, "quantity": 5}]),
        )

        export_to_calendar(sample_plan.id, sample_user.id)
        ev = _get_events(sample_user.id)[0]
        assert ev.export_key == f"{item.id}_{sample_bed.id}_2026-05-01_0"

    def test_mixed_beds_custom_quantities(self, db_session, sample_user, sample_plan, sample_bed, second_bed):
        """Custom allocation: bed1=30, bed2=10, succession_count=1."""
        _make_item(
            db_session, sample_plan,
            target_value=40, succession_count=1,
            bed_assignments=json.dumps([
                {"bedId": sample_bed.id, "quantity": 30},
                {"bedId": second_bed.id, "quantity": 10},
            ]),
        )

        result = export_to_calendar(sample_plan.id, sample_user.id)
        events = _get_events(sample_user.id)
        qty_by_bed = {e.garden_bed_id: e.quantity for e in events}
        assert qty_by_bed[sample_bed.id] == 30
        assert qty_by_bed[second_bed.id] == 10


# ===================================================================
# TRELLIS EXPORT PATH
# ===================================================================

class TestTrellisExportPath:
    """Tests for the trellis code path (trellis_linear plants with trellis_assignments)."""

    # pole-beans-1: trellis_linear, linearFeetPerPlant=0.5, daysToMaturity=65

    def test_single_trellis_no_succession(self, db_session, sample_user, sample_plan, sample_trellis):
        """Single trellis, succession_count=1, qty=6 → 1 event with trellis fields."""
        _make_item(
            db_session, sample_plan,
            plant_id='pole-beans-1', target_value=6, succession_count=1,
            trellis_assignments=json.dumps([sample_trellis.id]),
        )

        result = export_to_calendar(sample_plan.id, sample_user.id)
        assert result['eventsCreated'] == 1

        ev = _get_events(sample_user.id)[0]
        assert ev.trellis_structure_id == sample_trellis.id
        assert ev.plant_id == 'pole-beans-1'
        assert ev.quantity == 6
        assert ev.garden_bed_id is None
        # 6 plants * 0.5 ft/plant = 3.0 linear feet
        assert ev.linear_feet_allocated == 3.0
        # Position: 0 to 36 inches (3.0 ft * 12)
        assert ev.trellis_position_start_inches == 0.0
        assert ev.trellis_position_end_inches == 36.0

    def test_single_trellis_three_successions(self, db_session, sample_user, sample_plan, sample_trellis):
        """9 plants / 3 successions on one trellis → 3 events, qty=3 each."""
        _make_item(
            db_session, sample_plan,
            plant_id='pole-beans-1', target_value=9, succession_count=3,
            succession_interval_days=21,
            trellis_assignments=json.dumps([sample_trellis.id]),
        )

        result = export_to_calendar(sample_plan.id, sample_user.id)
        assert result['eventsCreated'] == 3

        events = _get_events(sample_user.id)
        assert len(events) == 3
        assert all(e.quantity == 3 for e in events)
        assert all(e.trellis_structure_id == sample_trellis.id for e in events)

        # Dates offset by 21 days
        base = datetime(2026, 5, 1)
        for i, ev in enumerate(events):
            assert ev.direct_seed_date == base + timedelta(days=21 * i)

    def test_two_trellises_remainder(self, db_session, sample_user, sample_plan, sample_trellis, second_trellis):
        """7 plants / 2 trellises → [4, 3], each with succession_count=1."""
        _make_item(
            db_session, sample_plan,
            plant_id='pole-beans-1', target_value=7, succession_count=1,
            trellis_assignments=json.dumps([sample_trellis.id, second_trellis.id]),
        )

        result = export_to_calendar(sample_plan.id, sample_user.id)
        assert result['eventsCreated'] == 2

        events = _get_events(sample_user.id)
        qty_by_trellis = {e.trellis_structure_id: e.quantity for e in events}
        assert qty_by_trellis[sample_trellis.id] == 4
        assert qty_by_trellis[second_trellis.id] == 3

    def test_trellis_positions_sequential(self, db_session, sample_user, sample_plan, sample_trellis):
        """Position start/end advances sequentially across succession events."""
        _make_item(
            db_session, sample_plan,
            plant_id='pole-beans-1', target_value=4, succession_count=2,
            succession_interval_days=14,
            trellis_assignments=json.dumps([sample_trellis.id]),
        )

        result = export_to_calendar(sample_plan.id, sample_user.id)
        events = _get_events(sample_user.id)
        assert len(events) == 2

        # 4 plants / 2 successions = 2 each, 2 * 0.5 ft = 1.0 ft = 12 inches each
        assert events[0].trellis_position_start_inches == 0.0
        assert events[0].trellis_position_end_inches == 12.0
        assert events[1].trellis_position_start_inches == 12.0
        assert events[1].trellis_position_end_inches == 24.0

    def test_non_trellis_plant_ignores_trellis_assignments(
        self, db_session, sample_user, sample_plan, sample_trellis
    ):
        """Non-trellis plant (tomato-1) with trellis_assignments → falls to legacy path."""
        _make_item(
            db_session, sample_plan,
            plant_id='tomato-1', target_value=5, succession_count=1,
            trellis_assignments=json.dumps([sample_trellis.id]),
        )

        result = export_to_calendar(sample_plan.id, sample_user.id)
        assert result['eventsCreated'] == 1

        ev = _get_events(sample_user.id)[0]
        # Should NOT be on trellis — tomato-1 is not trellis_linear
        assert ev.trellis_structure_id is None
        assert ev.garden_bed_id is None
        assert ev.quantity == 5

    def test_trellis_export_key_format(self, db_session, sample_user, sample_plan, sample_trellis):
        """Export key format: {item.id}_trellis_{trellis_id}_{date}_{i}."""
        item = _make_item(
            db_session, sample_plan,
            plant_id='pole-beans-1', target_value=4, succession_count=1,
            first_plant_date=date(2026, 5, 1),
            trellis_assignments=json.dumps([sample_trellis.id]),
        )

        export_to_calendar(sample_plan.id, sample_user.id)
        ev = _get_events(sample_user.id)[0]
        assert ev.export_key == f"{item.id}_trellis_{sample_trellis.id}_2026-05-01_0"


# ===================================================================
# IDEMPOTENT RE-EXPORT
# ===================================================================

class TestIdempotentReExport:
    """Tests for re-export behavior (export_key based upsert)."""

    def test_reexport_updates_not_duplicates(self, db_session, sample_user, sample_plan):
        """Export twice → events_updated > 0, no new events, total count unchanged."""
        _make_item(db_session, sample_plan, target_value=10, succession_count=2)

        r1 = export_to_calendar(sample_plan.id, sample_user.id)
        assert r1['eventsCreated'] == 2

        r2 = export_to_calendar(sample_plan.id, sample_user.id)
        assert r2['eventsCreated'] == 0
        assert r2['eventsUpdated'] == 2

        events = _get_events(sample_user.id)
        assert len(events) == 2

    def test_reexport_with_changed_quantity(self, db_session, sample_user, sample_plan):
        """Change target_value, re-export → existing events updated with new quantities."""
        item = _make_item(db_session, sample_plan, target_value=10, succession_count=2)

        export_to_calendar(sample_plan.id, sample_user.id)
        events_before = _get_events(sample_user.id)
        assert [e.quantity for e in events_before] == [5, 5]

        # Change quantity and re-export
        item.target_value = 20
        # Reset status so items are re-processed (status goes to 'exported')
        item.status = 'planned'
        db_session.flush()

        export_to_calendar(sample_plan.id, sample_user.id)
        events_after = _get_events(sample_user.id)
        assert len(events_after) == 2
        assert [e.quantity for e in events_after] == [10, 10]

    def test_export_keys_unique(self, db_session, sample_user, sample_plan):
        """Each event has a unique export_key."""
        _make_item(db_session, sample_plan, target_value=20, succession_count=4)

        export_to_calendar(sample_plan.id, sample_user.id)
        events = _get_events(sample_user.id)
        keys = [e.export_key for e in events]
        assert len(keys) == len(set(keys))

    def test_item_status_set_to_exported(self, db_session, sample_user, sample_plan):
        """After export, item.status == 'exported'."""
        item = _make_item(db_session, sample_plan, target_value=5, succession_count=1)
        assert item.status == 'planned'

        export_to_calendar(sample_plan.id, sample_user.id)
        # Refresh from DB
        db_session.refresh(item)
        assert item.status == 'exported'


# ===================================================================
# DTM AND HARVEST DATE
# ===================================================================

class TestDTMAndHarvestDate:
    """Tests for days-to-maturity resolution and expected_harvest_date."""

    def test_dtm_from_plant_database(self, db_session, sample_user, sample_plan):
        """No seed inventory → uses plant's daysToMaturity (lettuce-1 → 60)."""
        _make_item(
            db_session, sample_plan,
            plant_id='lettuce-1', target_value=5, succession_count=1,
            first_plant_date=date(2026, 4, 15),
        )

        export_to_calendar(sample_plan.id, sample_user.id)
        ev = _get_events(sample_user.id)[0]
        # April 15 + 60 days = June 14
        assert ev.expected_harvest_date == datetime(2026, 6, 14)

    def test_dtm_from_seed_inventory_override(self, db_session, sample_user, sample_plan):
        """Seed inventory has days_to_maturity=45 → overrides plant default (70)."""
        seed = SeedInventory(
            user_id=sample_user.id,
            plant_id='tomato-1',
            variety='Early Girl',
            days_to_maturity=45,
        )
        db_session.add(seed)
        db_session.flush()

        _make_item(
            db_session, sample_plan,
            plant_id='tomato-1', target_value=5, succession_count=1,
            first_plant_date=date(2026, 5, 1),
            seed_inventory_id=seed.id,
            variety='Early Girl',
        )

        export_to_calendar(sample_plan.id, sample_user.id)
        ev = _get_events(sample_user.id)[0]
        # May 1 + 45 days = June 15
        assert ev.expected_harvest_date == datetime(2026, 6, 15)

    def test_no_dtm_available(self, db_session, sample_user, sample_plan):
        """Plant with no daysToMaturity and no seed → expected_harvest_date is None."""
        # Use a plant_id that doesn't exist in PLANT_DATABASE → get_plant_by_id returns None
        _make_item(
            db_session, sample_plan,
            plant_id='nonexistent-plant-99', target_value=3, succession_count=1,
        )

        export_to_calendar(sample_plan.id, sample_user.id)
        ev = _get_events(sample_user.id)[0]
        assert ev.expected_harvest_date is None

    def test_seed_inventory_dtm_zero_is_not_skipped(self, db_session, sample_user, sample_plan):
        """Seed DTM of 0 should be used (not skipped due to falsy check)."""
        seed = SeedInventory(
            user_id=sample_user.id,
            plant_id='tomato-1',
            variety='Instant Tomato',
            days_to_maturity=0,
        )
        db_session.add(seed)
        db_session.flush()

        _make_item(
            db_session, sample_plan,
            plant_id='tomato-1', target_value=3, succession_count=1,
            first_plant_date=date(2026, 5, 1),
            seed_inventory_id=seed.id,
        )

        export_to_calendar(sample_plan.id, sample_user.id)
        ev = _get_events(sample_user.id)[0]
        # DTM=0 → harvest date = seed date itself
        assert ev.expected_harvest_date == datetime(2026, 5, 1)


# ===================================================================
# EDGE CASES
# ===================================================================

class TestEdgeCases:
    """Edge cases and error handling."""

    def test_plan_with_no_items(self, db_session, sample_user, sample_plan):
        """Empty plan → success with 0 events."""
        result = export_to_calendar(sample_plan.id, sample_user.id)
        assert result['success'] is True
        assert result['eventsCreated'] == 0
        assert result['eventsUpdated'] == 0
        assert result['totalEvents'] == 0

    def test_plan_not_found(self, db_session, sample_user):
        """Non-existent plan_id → error."""
        result = export_to_calendar(99999, sample_user.id)
        assert result['success'] is False
        assert 'error' in result

    def test_wrong_user_id(self, db_session, sample_user, sample_plan):
        """Wrong user_id → error (security check)."""
        result = export_to_calendar(sample_plan.id, sample_user.id + 999)
        assert result['success'] is False
        assert 'error' in result

    def test_target_value_zero(self, db_session, sample_user, sample_plan):
        """target_value=0 → events created with quantity 0 (function doesn't skip)."""
        _make_item(db_session, sample_plan, target_value=0, succession_count=1)

        result = export_to_calendar(sample_plan.id, sample_user.id)
        # The function creates events even for qty 0 in legacy path
        events = _get_events(sample_user.id)
        assert result['success'] is True
        if events:
            assert events[0].quantity == 0

    def test_multiple_items_in_plan(self, db_session, sample_user, sample_plan):
        """Plan with 3 different items → events created for each."""
        _make_item(db_session, sample_plan, plant_id='tomato-1', target_value=5, succession_count=1)
        _make_item(db_session, sample_plan, plant_id='lettuce-1', target_value=8, succession_count=2)
        _make_item(db_session, sample_plan, plant_id='carrot-1', target_value=20, succession_count=4)

        result = export_to_calendar(sample_plan.id, sample_user.id)
        # 1 + 2 + 4 = 7 events
        assert result['eventsCreated'] == 7

        events = _get_events(sample_user.id)
        assert len(events) == 7

        # Verify plant_ids are correct
        plant_ids = [e.plant_id for e in events]
        assert plant_ids.count('tomato-1') == 1
        assert plant_ids.count('lettuce-1') == 2
        assert plant_ids.count('carrot-1') == 4

    def test_succession_dates_offset_correctly(self, db_session, sample_user, sample_plan):
        """Verify date offsets are exact: base + i * interval_days."""
        _make_item(
            db_session, sample_plan,
            target_value=12, succession_count=3, succession_interval_days=21,
            first_plant_date=date(2026, 6, 1),
        )

        export_to_calendar(sample_plan.id, sample_user.id)
        events = _get_events(sample_user.id)

        assert events[0].direct_seed_date == datetime(2026, 6, 1)
        assert events[1].direct_seed_date == datetime(2026, 6, 22)
        assert events[2].direct_seed_date == datetime(2026, 7, 13)

    def test_variety_field_propagated(self, db_session, sample_user, sample_plan):
        """Variety from plan item is propagated to PlantingEvent."""
        _make_item(
            db_session, sample_plan,
            plant_id='tomato-1', variety='Brandywine',
            target_value=4, succession_count=1,
        )

        export_to_calendar(sample_plan.id, sample_user.id)
        ev = _get_events(sample_user.id)[0]
        assert ev.variety == 'Brandywine'
