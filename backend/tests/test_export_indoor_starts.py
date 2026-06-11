"""
Tests for export_to_calendar(create_indoor_starts=True) — the Tier 2 opt-in
auto-create of IndoorSeedStart tracking rows during plan export.

Proposal/decision trail:
  dev/active/production-readiness-audit/indoor-start-export-bridge-proposal.md

Uses real plant IDs so get_plant_by_id() lookups succeed:
  tomato-1   → weeksIndoors > 0 (transplant crop, qualifies)
  carrot-1   → weeksIndoors == 0 (direct-seed, must NOT get a tray)
"""

import json
from datetime import date, datetime, timedelta

from models import IndoorSeedStart, PlantingEvent, GardenPlanItem
from services.garden_planner_service import export_to_calendar


def _make_item(db_session, plan, **kwargs):
    defaults = dict(
        garden_plan_id=plan.id,
        plant_id='tomato-1',
        target_value=10,
        plant_equivalent=10,
        first_plant_date=date.today() + timedelta(days=60),
        succession_count=1,
        succession_interval_days=14,
    )
    defaults.update(kwargs)
    item = GardenPlanItem(**defaults)
    db_session.add(item)
    db_session.flush()
    return item


def _starts(user_id):
    return IndoorSeedStart.query.filter_by(user_id=user_id).all()


class TestExportAutoCreateIndoorStarts:

    def test_default_export_creates_no_starts(self, db_session, sample_user, sample_plan):
        """Without the flag, export behavior is unchanged: events only."""
        _make_item(db_session, sample_plan)

        result = export_to_calendar(sample_plan.id, sample_user.id)

        assert result['eventsCreated'] == 1
        assert 'indoorStarts' not in result
        assert _starts(sample_user.id) == []

    def test_transplant_crop_gets_linked_start(self, db_session, sample_user, sample_plan):
        """Opt-in: each exported transplant event gets a linked, provenance-marked tray."""
        item = _make_item(db_session, sample_plan, target_value=12)

        result = export_to_calendar(sample_plan.id, sample_user.id, create_indoor_starts=True)

        assert result['indoorStarts'] == {
            'created': 1, 'rescheduled': 0, 'alreadyTracked': 0,
            'notApplicable': 0, 'failed': 0,
        }
        starts = _starts(sample_user.id)
        assert len(starts) == 1
        start = starts[0]
        event = PlantingEvent.query.filter_by(user_id=sample_user.id).one()
        assert start.planting_event_id == event.id
        assert start.source == 'export'
        assert start.status == 'planned'
        # Future planting → start date matches the event's computed seed_start_date
        assert start.start_date == event.seed_start_date
        # Quantity: seeds for 12 desired plants at 85% germination + 15% buffer
        assert start.seeds_started >= 12
        # Destination bed carried from the event (legacy path has no bed → None)
        assert start.destination_bed_ids is None

    def test_direct_seed_crop_not_applicable(self, db_session, sample_user, sample_plan):
        """Direct-seed crops (weeksIndoors == 0) never get trays."""
        _make_item(db_session, sample_plan, plant_id='carrot-1')

        result = export_to_calendar(sample_plan.id, sample_user.id, create_indoor_starts=True)

        assert result['indoorStarts']['created'] == 0
        assert result['indoorStarts']['notApplicable'] == 1
        assert _starts(sample_user.id) == []

    def test_succession_series_one_tray_per_event(self, db_session, sample_user, sample_plan):
        """4 successions → 4 events → 4 trays, each linked to its own event."""
        _make_item(db_session, sample_plan, target_value=20, succession_count=4)

        result = export_to_calendar(sample_plan.id, sample_user.id, create_indoor_starts=True)

        assert result['indoorStarts']['created'] == 4
        starts = _starts(sample_user.id)
        assert len(starts) == 4
        linked_event_ids = {s.planting_event_id for s in starts}
        event_ids = {e.id for e in PlantingEvent.query.filter_by(user_id=sample_user.id)}
        assert linked_event_ids == event_ids

    def test_reexport_is_idempotent(self, db_session, sample_user, sample_plan):
        """Re-export with the flag must not duplicate trays."""
        _make_item(db_session, sample_plan)

        export_to_calendar(sample_plan.id, sample_user.id, create_indoor_starts=True)
        result2 = export_to_calendar(sample_plan.id, sample_user.id, create_indoor_starts=True)

        assert result2['indoorStarts']['created'] == 0
        assert result2['indoorStarts']['alreadyTracked'] == 1
        assert len(_starts(sample_user.id)) == 1

    def test_bed_allocated_path_carries_destination_bed(
        self, db_session, sample_user, sample_plan, sample_bed
    ):
        """Bed-allocated export → tray's destination_bed_ids = [bedId]."""
        _make_item(
            db_session, sample_plan,
            bed_assignments=json.dumps([{'bedId': sample_bed.id, 'quantity': 10}]),
        )

        result = export_to_calendar(sample_plan.id, sample_user.id, create_indoor_starts=True)

        assert result['indoorStarts']['created'] == 1
        start = _starts(sample_user.id)[0]
        assert json.loads(start.destination_bed_ids) == [sample_bed.id]

    def test_past_due_start_rescheduled_to_today(self, db_session, sample_user, sample_plan):
        """Planting date so soon the indoor start would be in the past →
        clamp to today (A1 reschedule_today convention), counted separately."""
        # tomato-1 needs ~6 weeks indoors; planting in 7 days puts the
        # computed start date well in the past.
        _make_item(db_session, sample_plan, first_plant_date=date.today() + timedelta(days=7))

        result = export_to_calendar(sample_plan.id, sample_user.id, create_indoor_starts=True)

        assert result['indoorStarts']['created'] == 1
        assert result['indoorStarts']['rescheduled'] == 1
        start = _starts(sample_user.id)[0]
        assert start.start_date.date() == date.today()
        # Event slid forward to stay coherent with the clamped start
        event = PlantingEvent.query.filter_by(user_id=sample_user.id).one()
        assert event.transplant_date == start.expected_transplant_date

    def test_on_time_export_preserves_event_harvest_date(
        self, db_session, sample_user, sample_plan
    ):
        """Auto-create must NOT clobber the export's expected_harvest_date for
        on-time rows (sync_linked_event='if_rescheduled')."""
        _make_item(db_session, sample_plan)

        export_to_calendar(sample_plan.id, sample_user.id, create_indoor_starts=True)

        event = PlantingEvent.query.filter_by(user_id=sample_user.id).one()
        # tomato-1 DTM resolution in export: plant default. Harvest must equal
        # plant_date + DTM exactly as the export set it.
        from plant_database import get_plant_by_id
        dtm = get_plant_by_id('tomato-1')['daysToMaturity']
        plant_date = event.transplant_date
        assert event.expected_harvest_date == plant_date + timedelta(days=dtm)

    def test_seed_inventory_link_carried_from_plan_item(
        self, db_session, sample_user, sample_plan
    ):
        """Tray links the plan item's seed packet so seeds-available accounting works."""
        from models import SeedInventory
        seed = SeedInventory(
            user_id=sample_user.id, plant_id='tomato-1', variety='Brandywine',
            quantity=2, seeds_per_packet=30,
        )
        db_session.add(seed)
        db_session.flush()
        _make_item(db_session, sample_plan, seed_inventory_id=seed.id, variety='Brandywine')

        export_to_calendar(sample_plan.id, sample_user.id, create_indoor_starts=True)

        start = _starts(sample_user.id)[0]
        assert start.seed_inventory_id == seed.id
        assert start.variety == 'Brandywine'
