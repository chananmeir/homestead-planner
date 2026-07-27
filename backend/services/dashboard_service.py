"""
Dashboard aggregation service.

Composes "Needs Attention" signals for the Homestead Dashboard from existing
models/services. Does NOT duplicate business logic — it queries existing data
in a user-scoped, batched manner.

All internal field names are snake_case. The blueprint route is responsible
for converting the returned dict to the camelCase API shape (already done by
the per-signal builders here, which return camelCase dicts).
"""
import logging
from collections import defaultdict
from datetime import datetime, date, timedelta, time

from sqlalchemy import and_, or_

from models import (
    PlantingEvent,
    PlantedItem,
    GardenBed,
    CompostPile,
    SeedInventory,
    Property,
    Chicken,
    EggProduction,
    IndoorSeedStart,
)
from plant_database import get_plant_by_id
from services.settings_service import get_flat_settings
from simulation_clock import get_today

logger = logging.getLogger(__name__)

# Configuration constants
SIGNAL_CAP = 20  # Maximum rows per signal category (performance guard)
LOW_STOCK_SEED_PACKETS = 2  # Below this many packets => "low stock"
SEED_EXPIRY_WINDOW_DAYS = 30  # Seeds expiring within this many days => alert
COMPOST_DEFAULT_TURN_DAYS = 7  # No turn_frequency_days column exists; use default
FROST_RISK_TEMP_F = 33.0  # Low-temp threshold for frost risk
FROST_RISK_WINDOW_HOURS = 24
RAIN_ALERT_INCHES = 0.5  # At least this much precipitation => alert
RAIN_WINDOW_HOURS = 48

# Staleness thresholds (days). Reminders whose trigger date is older than
# (target_date - threshold) are aged out of the primary "Needs Attention" feed.
# See dev/active/production-readiness-audit/dashboard-stale-needs-attention-plan.md.
STALE_INDOOR_START_DAYS = 14      # seed_start_date age threshold
STALE_TRANSPLANT_DAYS = 10        # transplant_date age threshold
STALE_DIRECT_SEED_DAYS = 14       # direct_seed_date age threshold
STALE_GERMINATION_CHECK_DAYS = 14 # expected_germination_date age threshold
HARVEST_DEMOTION_DAYS = 14        # daysPastExpected threshold for isStale flag (never drops)
STALE_PLACE_PLANTED_DAYS = 14     # planned PlantedItem planted_date age threshold


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------

def _as_date(value):
    """Coerce a datetime/date/None to a date."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


def _day_bounds(target_date):
    """Return (start_of_day, end_of_day) datetimes for a given date."""
    start = datetime.combine(target_date, time.min)
    end = datetime.combine(target_date, time.max)
    return start, end


def resolve_target_date(date_str):
    """
    Resolve the target "today" for the dashboard.

    Precedence:
      1. Explicit ISO YYYY-MM-DD query param (`date_str`)
      2. Simulation clock (if active)
      3. Real date.today()

    Returns a `datetime.date`. Raises ValueError on invalid input.
    """
    if date_str:
        # Strict YYYY-MM-DD parsing. We deliberately do NOT use parse_iso_date()
        # here because the dashboard date is a calendar day, not a datetime.
        try:
            return date.fromisoformat(date_str)
        except (ValueError, TypeError):
            raise ValueError(f"Invalid date format '{date_str}'. Use YYYY-MM-DD.")
    return get_today()


# ---------------------------------------------------------------------------
# Plant name resolution
# ---------------------------------------------------------------------------

def _plant_name(plant_id):
    """Look up the plant name from plant_database, fallback to the ID."""
    if not plant_id:
        return 'Unknown'
    plant = get_plant_by_id(plant_id)
    if plant:
        return plant.get('name') or plant_id
    return plant_id


def _has_recorded_planting(event):
    """Return True when the planting phase records real planted quantity."""
    if event.quantity_completed is not None:
        return event.quantity_completed > 0
    return bool(event.completed)


def _recorded_planting_quantity(event):
    if event.quantity_completed is not None:
        return max(0, event.quantity_completed)
    if event.completed:
        return event.quantity or 0
    return 0


def _is_harvest_recorded(event):
    return bool(event.harvest_completed) or event.actual_harvest_date is not None


def _harvested_item_match_key(record):
    if isinstance(record, PlantingEvent):
        start_date = _as_date(record.transplant_date or record.direct_seed_date)
    else:
        start_date = _as_date(record.transplant_date or record.planted_date)
    if (
        record.garden_bed_id is None
        or record.position_x is None
        or record.position_y is None
        or start_date is None
    ):
        return None
    return (
        record.garden_bed_id,
        record.plant_id,
        record.variety or None,
        record.position_x,
        record.position_y,
        start_date,
    )


def _harvested_planted_item_keys(user_id, events):
    candidate_keys = {_harvested_item_match_key(event) for event in events}
    candidate_keys.discard(None)
    if not candidate_keys:
        return set()

    bed_ids = {key[0] for key in candidate_keys}
    plant_ids = {key[1] for key in candidate_keys}
    items = PlantedItem.query.filter(
        PlantedItem.user_id == user_id,
        PlantedItem.cancelled_at.is_(None),
        PlantedItem.garden_bed_id.in_(bed_ids),
        PlantedItem.plant_id.in_(plant_ids),
        or_(
            PlantedItem.status == 'harvested',
            PlantedItem.harvest_date.isnot(None),
        ),
    ).all()

    return {
        key
        for key in (_harvested_item_match_key(item) for item in items)
        if key in candidate_keys
    }


def _cancelled_planted_item_keys(user_id, events):
    candidate_keys = {_harvested_item_match_key(event) for event in events}
    candidate_keys.discard(None)
    if not candidate_keys:
        return set()

    bed_ids = {key[0] for key in candidate_keys}
    plant_ids = {key[1] for key in candidate_keys}
    items = PlantedItem.query.filter(
        PlantedItem.user_id == user_id,
        PlantedItem.cancelled_at.isnot(None),
        PlantedItem.garden_bed_id.in_(bed_ids),
        PlantedItem.plant_id.in_(plant_ids),
    ).all()

    return {
        key
        for key in (_harvested_item_match_key(item) for item in items)
        if key in candidate_keys
    }


def _outcome_planted_item_keys(user_id, events):
    candidate_keys = {_harvested_item_match_key(event) for event in events}
    candidate_keys.discard(None)
    if not candidate_keys:
        return set()

    bed_ids = {key[0] for key in candidate_keys}
    plant_ids = {key[1] for key in candidate_keys}
    items = PlantedItem.query.filter(
        PlantedItem.user_id == user_id,
        PlantedItem.cancelled_at.is_(None),
        PlantedItem.cleared_at.is_(None),
        PlantedItem.outcome.isnot(None),
        PlantedItem.garden_bed_id.in_(bed_ids),
        PlantedItem.plant_id.in_(plant_ids),
    ).all()

    return {
        key
        for key in (_harvested_item_match_key(item) for item in items)
        if key in candidate_keys
    }


# ---------------------------------------------------------------------------
# Signal builders
# ---------------------------------------------------------------------------

def _build_harvest_ready(user_id, target_date):
    """
    PlantingEvents whose planting phase has recorded planted quantity, whose
    expected_harvest_date <= target_date, and whose harvest phase is still open.

    Groups events sharing
    (expected_harvest_date, plant_id, variety, garden_bed_id) into one
    signal row. `daysPastExpected` is the MAX across the group;
    `isStale` is True if any event in the group is stale.
    """
    _, end_of_day = _day_bounds(target_date)
    recorded_planting_filter = or_(
        PlantingEvent.quantity_completed > 0,
        and_(
            PlantingEvent.quantity_completed.is_(None),
            PlantingEvent.completed.is_(True),
        ),
    )
    pending_harvest_filter = and_(
        PlantingEvent.actual_harvest_date.is_(None),
        or_(
            PlantingEvent.harvest_completed.is_(False),
            PlantingEvent.harvest_completed.is_(None),
        ),
    )

    # Eager-load the garden bed to avoid N+1
    events = (
        PlantingEvent.query
        .outerjoin(GardenBed, PlantingEvent.garden_bed_id == GardenBed.id)
        .filter(
            PlantingEvent.user_id == user_id,
            PlantingEvent.event_type == 'planting',
            PlantingEvent.expected_harvest_date.isnot(None),
            PlantingEvent.expected_harvest_date <= end_of_day,
            PlantingEvent.cancelled_at.is_(None),
            PlantingEvent.cleared_at.is_(None),
            PlantingEvent.outcome.is_(None),
            recorded_planting_filter,
            pending_harvest_filter,
        )
        .order_by(PlantingEvent.expected_harvest_date.asc())
        .limit(SIGNAL_CAP * 20)  # over-fetch before harvested-item filtering/grouping
        .all()
    )

    # Pre-load bed names in one query
    bed_ids = {e.garden_bed_id for e in events if e.garden_bed_id is not None}
    bed_lookup = {}
    if bed_ids:
        for bed in GardenBed.query.filter(GardenBed.id.in_(bed_ids)).all():
            bed_lookup[bed.id] = bed.name

    harvested_item_keys = _harvested_planted_item_keys(user_id, events)
    cancelled_item_keys = _cancelled_planted_item_keys(user_id, events)
    outcome_item_keys = _outcome_planted_item_keys(user_id, events)

    # Group qualifying events by composite key.
    # Variety normalization: empty string → None for key consistency.
    groups = defaultdict(list)
    for e in events:
        if not _has_recorded_planting(e) or _is_harvest_recorded(e):
            continue
        item_key = _harvested_item_match_key(e)
        if item_key in cancelled_item_keys:
            continue
        if item_key in outcome_item_keys:
            continue
        if item_key in harvested_item_keys:
            continue
        harvest_date = _as_date(e.expected_harvest_date)
        if harvest_date is None:
            continue
        variety_key = e.variety if e.variety else None
        key = (harvest_date, e.plant_id, variety_key, e.garden_bed_id)
        groups[key].append(e)

    results = []
    # Order groups by their first event's harvest_date (stable ordering)
    # then by the min event id within the group for determinism.
    sorted_keys = sorted(
        groups.keys(),
        key=lambda k: (k[0], min(ev.id for ev in groups[k])),
    )
    for key in sorted_keys:
        members = sorted(groups[key], key=lambda ev: ev.id)
        rep = members[0]
        harvest_date = _as_date(rep.expected_harvest_date)
        # Per-event days_past_clamped, then aggregate
        per_event_days_past = [
            max(0, (target_date - _as_date(m.expected_harvest_date)).days)
            for m in members
        ]
        max_days_past = max(per_event_days_past)
        any_stale = any(d > HARVEST_DEMOTION_DAYS for d in per_event_days_past)
        total_quantity = sum(_recorded_planting_quantity(m) for m in members)
        results.append({
            'signalKey': f'harvest-{rep.id}',
            'plantingEventId': rep.id,
            'plantingEventIds': [m.id for m in members],
            'plantName': _plant_name(rep.plant_id),
            'variety': rep.variety,
            'bedId': rep.garden_bed_id,
            'bedName': bed_lookup.get(rep.garden_bed_id),
            'quantity': total_quantity,
            'daysPastExpected': max_days_past,
            # Harvest rows NEVER drop (integrity-sensitive — would fabricate yield).
            # Frontend uses isStale to demote tone after HARVEST_DEMOTION_DAYS.
            'isStale': any_stale,
        })
        if len(results) >= SIGNAL_CAP:
            break
    return results


def _build_indoor_starts_due(user_id, target_date):
    """
    PlantingEvents with seed_start_date <= target_date, not complete,
    planting event type.

    We infer "indoor start" by presence of a seed_start_date AND a future
    transplant_date (or no transplant_date at all). This uses the existing
    PlantingEvent seed_start_date field that the indoor-seed-starts feature
    sets.

    Returns a dict with two lists:
      {'active': [...], 'missed': [...]}
    Items whose seed_start_date is older than STALE_INDOOR_START_DAYS move
    into `missed`. Neither list mutates any underlying model.

    Grouping: events sharing (seed_start_date, plant_id, variety) collapse
    to a single row (no bed key — indoor starts are pre-placement).
    `quantity` is summed; `plantingEventIds` lists all member ids.
    """
    _, end_of_day = _day_bounds(target_date)

    events = (
        PlantingEvent.query
        .filter(
            PlantingEvent.user_id == user_id,
            PlantingEvent.event_type == 'planting',
            PlantingEvent.seed_start_date.isnot(None),
            PlantingEvent.seed_start_date <= end_of_day,
            PlantingEvent.cancelled_at.is_(None),
        )
        .order_by(PlantingEvent.seed_start_date.asc())
        .limit(SIGNAL_CAP * 3)
        .all()
    )

    # A linked IndoorSeedStart can advance through the indoor lifecycle while
    # the outdoor PlantingEvent stays incomplete until transplant. Do not keep
    # showing "Indoor start due" once the linked start has moved past planned.
    linked_start_statuses = defaultdict(list)
    event_ids = [e.id for e in events]
    if event_ids:
        linked_starts = (
            IndoorSeedStart.query
            .filter(
                IndoorSeedStart.user_id == user_id,
                IndoorSeedStart.planting_event_id.in_(event_ids),
                IndoorSeedStart.cancelled_at.is_(None),
            )
            .all()
        )
        for start in linked_starts:
            linked_start_statuses[start.planting_event_id].append(start.status)

    started_event_ids = {
        event_id
        for event_id, statuses in linked_start_statuses.items()
        if any(status != 'planned' for status in statuses)
    }

    # ---- PE path: group qualifying events ----
    pe_groups = defaultdict(list)
    linked_event_ids = set()
    for e in events:
        if e.is_complete:
            continue
        if e.id in started_event_ids:
            continue
        seed_start = _as_date(e.seed_start_date)
        if seed_start is None:
            continue
        variety_key = e.variety if e.variety else None
        key = (seed_start, e.plant_id, variety_key)
        pe_groups[key].append(e)
        linked_event_ids.add(e.id)

    active = []
    missed = []

    # Order groups by seed_start_date then min event id (deterministic).
    sorted_keys = sorted(
        pe_groups.keys(),
        key=lambda k: (k[0], min(ev.id for ev in pe_groups[k])),
    )
    for key in sorted_keys:
        members = sorted(pe_groups[key], key=lambda ev: ev.id)
        rep = members[0]
        seed_start = _as_date(rep.seed_start_date)
        total_quantity = sum((m.quantity or 0) for m in members)
        row = {
            'signalKey': f'indoor-{rep.id}',
            'plantingEventId': rep.id,
            'plantingEventIds': [m.id for m in members],
            'indoorSeedStartId': None,
            'plantName': _plant_name(rep.plant_id),
            'variety': rep.variety,
            'seedStartDate': seed_start.isoformat(),
            'quantity': total_quantity,
        }
        # All members in a group share seed_start_date by definition,
        # so days_past is identical across the group.
        days_past = (target_date - seed_start).days
        if days_past > STALE_INDOOR_START_DAYS:
            if len(missed) < SIGNAL_CAP:
                missed.append(row)
        else:
            if len(active) < SIGNAL_CAP:
                active.append(row)
        if len(active) >= SIGNAL_CAP and len(missed) >= SIGNAL_CAP:
            break

    # Also surface standalone IndoorSeedStart records that the user created
    # directly in Grow → Indoor Starts. These may not have a corresponding
    # PlantingEvent (e.g., manually created, or plan item without an outdoor
    # export). We include any IndoorSeedStart whose status is still 'planned'
    # (the seed has not actually been seeded yet) and whose start_date has
    # arrived. Dedup against rows already surfaced via their planting_event_id.
    if len(active) < SIGNAL_CAP or len(missed) < SIGNAL_CAP:
        _, end_of_day = _day_bounds(target_date)
        seed_starts = (
            IndoorSeedStart.query
            .filter(
                IndoorSeedStart.user_id == user_id,
                IndoorSeedStart.status == 'planned',
                IndoorSeedStart.start_date.isnot(None),
                IndoorSeedStart.start_date <= end_of_day,
                IndoorSeedStart.cancelled_at.is_(None),
            )
            .order_by(IndoorSeedStart.start_date.asc())
            .limit(SIGNAL_CAP * 3)
            .all()
        )

        # ---- ISS path: group qualifying records ----
        iss_groups = defaultdict(list)
        for s in seed_starts:
            if s.planting_event_id is not None and (
                s.planting_event_id in linked_event_ids
                or s.planting_event_id in started_event_ids
            ):
                continue  # already handled via the linked PlantingEvent/start
            start_date = _as_date(s.start_date)
            if start_date is None:
                continue
            variety_key = s.variety if s.variety else None
            key = (start_date, s.plant_id, variety_key)
            iss_groups[key].append(s)

        sorted_iss_keys = sorted(
            iss_groups.keys(),
            key=lambda k: (k[0], min(rec.id for rec in iss_groups[k])),
        )
        for key in sorted_iss_keys:
            members = sorted(iss_groups[key], key=lambda rec: rec.id)
            rep = members[0]
            start_date = _as_date(rep.start_date)
            total_quantity = sum((m.seeds_started or 0) for m in members)
            # Carry through any linked PlantingEvent id from any member.
            linked_pe_id = next(
                (m.planting_event_id for m in members if m.planting_event_id is not None),
                None,
            )
            row = {
                'signalKey': f'indoor-iss-{rep.id}',
                'plantingEventId': linked_pe_id,
                'indoorSeedStartId': rep.id,
                'indoorSeedStartIds': [m.id for m in members],
                'plantName': _plant_name(rep.plant_id),
                'variety': rep.variety,
                'seedStartDate': start_date.isoformat(),
                'quantity': total_quantity,
            }
            days_past = (target_date - start_date).days
            if days_past > STALE_INDOOR_START_DAYS:
                if len(missed) < SIGNAL_CAP:
                    missed.append(row)
            else:
                if len(active) < SIGNAL_CAP:
                    active.append(row)
            if len(active) >= SIGNAL_CAP and len(missed) >= SIGNAL_CAP:
                break

    return {'active': active, 'missed': missed}


def _build_transplants_due(user_id, target_date):
    """PlantingEvents with transplant_date <= target_date, not complete.

    Returns a dict {'active': [...], 'missed': [...]}. Items older than
    STALE_TRANSPLANT_DAYS move into `missed`. Model state is not mutated.

    Grouping: events sharing
    (transplant_date, plant_id, variety, garden_bed_id) collapse to a
    single row. `quantity` is summed; `plantingEventIds` lists members.
    """
    _, end_of_day = _day_bounds(target_date)

    events = (
        PlantingEvent.query
        .filter(
            PlantingEvent.user_id == user_id,
            PlantingEvent.event_type == 'planting',
            PlantingEvent.transplant_date.isnot(None),
            PlantingEvent.transplant_date <= end_of_day,
            PlantingEvent.cancelled_at.is_(None),
        )
        .order_by(PlantingEvent.transplant_date.asc())
        .limit(SIGNAL_CAP * 3)
        .all()
    )

    event_ids = [e.id for e in events]
    seed_starts_by_event = defaultdict(list)
    if event_ids:
        seed_starts = (
            IndoorSeedStart.query
            .filter(
                IndoorSeedStart.user_id == user_id,
                IndoorSeedStart.planting_event_id.in_(event_ids),
            )
            .order_by(IndoorSeedStart.id.asc())
            .all()
        )
        for seed_start in seed_starts:
            seed_starts_by_event[seed_start.planting_event_id].append(seed_start)

    bed_ids = {e.garden_bed_id for e in events if e.garden_bed_id is not None}
    bed_lookup = {}
    if bed_ids:
        for bed in GardenBed.query.filter(GardenBed.id.in_(bed_ids)).all():
            bed_lookup[bed.id] = bed.name

    # Group qualifying events by composite key.
    groups = defaultdict(list)
    for e in events:
        if e.is_complete:
            continue
        # If this event has a scheduled indoor seed-start that has already
        # passed and the event is still incomplete, decide whether to
        # suppress based on the linked IndoorSeedStart's status (if any):
        #   - no ISS linked -> use the original proxy (assume PE-only flow,
        #     in which case the seed-start truly was never performed since
        #     no tracking record exists)
        #   - ISS linked, status='planned' -> seed-start was scheduled but
        #     never started; suppress
        #   - ISS linked, any advanced status ('seeded', 'germinating',
        #     'growing', 'ready', 'transplanted') -> seed-start was
        #     started; do NOT suppress (the linked PlantingEvent stays
        #     is_complete=False for the entire ISS lifecycle by design —
        #     see dashboard-missing-transplant-due-investigation.md).
        # The companion "indoor start due" builder still surfaces the
        # missed start as the actionable item when the guard fires.
        seed_start = _as_date(e.seed_start_date)
        if seed_start is not None and seed_start <= target_date:
            linked_starts = seed_starts_by_event.get(e.id, [])
            if not linked_starts or all(start.status == 'planned' for start in linked_starts):
                continue
        transplant = _as_date(e.transplant_date)
        if transplant is None:
            continue
        variety_key = e.variety if e.variety else None
        key = (transplant, e.plant_id, variety_key, e.garden_bed_id)
        groups[key].append(e)

    active = []
    missed = []
    sorted_keys = sorted(
        groups.keys(),
        key=lambda k: (k[0], min(ev.id for ev in groups[k])),
    )
    for key in sorted_keys:
        members = sorted(groups[key], key=lambda ev: ev.id)
        rep = members[0]
        transplant = _as_date(rep.transplant_date)
        total_quantity = sum((m.quantity or 0) for m in members)
        indoor_seed_start_ids = []
        seen_seed_start_ids = set()
        for member in members:
            for seed_start in seed_starts_by_event.get(member.id, []):
                if seed_start.id in seen_seed_start_ids:
                    continue
                seen_seed_start_ids.add(seed_start.id)
                indoor_seed_start_ids.append(seed_start.id)
        row = {
            'signalKey': f'transplant-{rep.id}',
            'plantingEventId': rep.id,
            'plantingEventIds': [m.id for m in members],
            'indoorSeedStartId': (
                indoor_seed_start_ids[0] if indoor_seed_start_ids else None
            ),
            'indoorSeedStartIds': indoor_seed_start_ids,
            'transplantSource': (
                rep.transplant_source
                or ('seed_start' if indoor_seed_start_ids else None)
            ),
            'plantName': _plant_name(rep.plant_id),
            'variety': rep.variety,
            'transplantDate': transplant.isoformat(),
            'quantity': total_quantity,
            'bedId': rep.garden_bed_id,
            'bedName': bed_lookup.get(rep.garden_bed_id),
        }
        # All members share transplant_date by key definition.
        days_past = (target_date - transplant).days
        if days_past > STALE_TRANSPLANT_DAYS:
            if len(missed) < SIGNAL_CAP:
                missed.append(row)
        else:
            if len(active) < SIGNAL_CAP:
                active.append(row)
        if len(active) >= SIGNAL_CAP and len(missed) >= SIGNAL_CAP:
            break
    return {'active': active, 'missed': missed}


def _build_direct_seed_due(user_id, target_date):
    """PlantingEvents with direct_seed_date <= target_date, not complete.

    Returns a dict {'active': [...], 'missed': [...]}. Items older than
    STALE_DIRECT_SEED_DAYS move into `missed`. Model state is not mutated.

    Grouping: events sharing
    (direct_seed_date, plant_id, variety, garden_bed_id) collapse to a
    single row. `quantity` is summed; `plantingEventIds` lists members.
    """
    _, end_of_day = _day_bounds(target_date)

    events = (
        PlantingEvent.query
        .filter(
            PlantingEvent.user_id == user_id,
            PlantingEvent.event_type == 'planting',
            PlantingEvent.direct_seed_date.isnot(None),
            PlantingEvent.direct_seed_date <= end_of_day,
            PlantingEvent.cancelled_at.is_(None),
        )
        .order_by(PlantingEvent.direct_seed_date.asc())
        .limit(SIGNAL_CAP * 3)
        .all()
    )

    bed_ids = {e.garden_bed_id for e in events if e.garden_bed_id is not None}
    bed_lookup = {}
    if bed_ids:
        for bed in GardenBed.query.filter(GardenBed.id.in_(bed_ids)).all():
            bed_lookup[bed.id] = bed.name

    # Group qualifying events by composite key.
    groups = defaultdict(list)
    for e in events:
        if e.is_complete:
            continue
        direct_seed = _as_date(e.direct_seed_date)
        if direct_seed is None:
            continue
        variety_key = e.variety if e.variety else None
        key = (direct_seed, e.plant_id, variety_key, e.garden_bed_id)
        groups[key].append(e)

    active = []
    missed = []
    sorted_keys = sorted(
        groups.keys(),
        key=lambda k: (k[0], min(ev.id for ev in groups[k])),
    )
    for key in sorted_keys:
        members = sorted(groups[key], key=lambda ev: ev.id)
        rep = members[0]
        direct_seed = _as_date(rep.direct_seed_date)
        total_quantity = sum((m.quantity or 0) for m in members)
        row = {
            'signalKey': f'direct-seed-{rep.id}',
            'plantingEventId': rep.id,
            'plantingEventIds': [m.id for m in members],
            'plantName': _plant_name(rep.plant_id),
            'variety': rep.variety,
            'directSeedDate': direct_seed.isoformat(),
            'quantity': total_quantity,
            'bedId': rep.garden_bed_id,
            'bedName': bed_lookup.get(rep.garden_bed_id),
        }
        days_past = (target_date - direct_seed).days
        if days_past > STALE_DIRECT_SEED_DAYS:
            if len(missed) < SIGNAL_CAP:
                missed.append(row)
        else:
            if len(active) < SIGNAL_CAP:
                active.append(row)
        if len(active) >= SIGNAL_CAP and len(missed) >= SIGNAL_CAP:
            break
    return {'active': active, 'missed': missed}


def _build_place_planted_item(user_id, target_date):
    """PlantedItems still in `planned` status whose planted_date <= target_date.

    These are drag-and-dropped placements whose due date has arrived (or
    passed) without the user confirming they actually planted them. The
    dashboard prompts the user to either confirm ("I planted it") or record
    a not-planted outcome.

    Returns a dict {'active': [...], 'missed': [...]}. Items older than
    STALE_PLACE_PLANTED_DAYS move into `missed`. Model state is not mutated.
    """
    _, end_of_day = _day_bounds(target_date)

    items = (
        PlantedItem.query
        .filter(
            PlantedItem.user_id == user_id,
            PlantedItem.cancelled_at.is_(None),
            PlantedItem.cleared_at.is_(None),
            PlantedItem.outcome.is_(None),
            PlantedItem.status == 'planned',
            PlantedItem.planted_date.isnot(None),
            PlantedItem.planted_date <= end_of_day,
        )
        .order_by(PlantedItem.planted_date.asc())
        .limit(SIGNAL_CAP * 3)
        .all()
    )

    bed_ids = {i.garden_bed_id for i in items if i.garden_bed_id is not None}
    bed_lookup = {}
    if bed_ids:
        for bed in GardenBed.query.filter(GardenBed.id.in_(bed_ids)).all():
            bed_lookup[bed.id] = bed.name

    active = []
    missed = []
    for item in items:
        planted = _as_date(item.planted_date)
        if planted is None:
            continue
        row = {
            'signalKey': f'place-planted-{item.id}',
            'plantedItemId': item.id,
            'plantName': _plant_name(item.plant_id),
            'variety': item.variety,
            'plantedDate': planted.isoformat(),
            'quantity': item.quantity or 1,
            'bedId': item.garden_bed_id,
            'bedName': bed_lookup.get(item.garden_bed_id),
            'positionX': item.position_x,
            'positionY': item.position_y,
        }
        days_past = (target_date - planted).days
        if days_past > STALE_PLACE_PLANTED_DAYS:
            if len(missed) < SIGNAL_CAP:
                missed.append(row)
        else:
            if len(active) < SIGNAL_CAP:
                active.append(row)
        if len(active) >= SIGNAL_CAP and len(missed) >= SIGNAL_CAP:
            break
    return {'active': active, 'missed': missed}


def _build_germination_check(user_id, target_date):
    """PlantingEvents where direct_seed_date + germination_days <= target_date, not complete.

    Returns a dict {'active': [...], 'missed': [...]}. Items older than
    STALE_GERMINATION_CHECK_DAYS move into `missed`. Model state is not mutated.

    Grouping: events sharing
    (direct_seed_date, plant_id, variety, garden_bed_id) collapse to a
    single row. `quantity` is summed; `plantingEventIds` lists members.
    All members in a group share the same plant_id (and thus the same
    germination_days), so expected_germ is identical across the group.
    """
    # Query all direct-seeded, incomplete planting events (no date filter in SQL —
    # we need the plant's germination_days to compute the threshold, done in Python)
    events = (
        PlantingEvent.query
        .filter(
            PlantingEvent.user_id == user_id,
            PlantingEvent.event_type == 'planting',
            PlantingEvent.direct_seed_date.isnot(None),
            PlantingEvent.cancelled_at.is_(None),
        )
        .order_by(PlantingEvent.direct_seed_date.asc())
        .limit(SIGNAL_CAP * 3)
        .all()
    )

    bed_ids = {e.garden_bed_id for e in events if e.garden_bed_id is not None}
    bed_lookup = {}
    if bed_ids:
        for bed in GardenBed.query.filter(GardenBed.id.in_(bed_ids)).all():
            bed_lookup[bed.id] = bed.name

    DEFAULT_GERMINATION_DAYS = 10

    # Group qualifying events by composite key (after applying all guards).
    groups = defaultdict(list)
    for e in events:
        if e.is_complete:
            continue
        seed_date = _as_date(e.direct_seed_date)
        if seed_date is None:
            continue
        plant = get_plant_by_id(e.plant_id)
        germ_days = DEFAULT_GERMINATION_DAYS
        if plant:
            germ_days = plant.get('germination_days') or DEFAULT_GERMINATION_DAYS
        expected_germ = seed_date + timedelta(days=germ_days)
        if expected_germ > target_date:
            continue  # Not yet time to check
        variety_key = e.variety if e.variety else None
        key = (seed_date, e.plant_id, variety_key, e.garden_bed_id)
        groups[key].append(e)

    active = []
    missed = []
    sorted_keys = sorted(
        groups.keys(),
        key=lambda k: (k[0], min(ev.id for ev in groups[k])),
    )
    for key in sorted_keys:
        members = sorted(groups[key], key=lambda ev: ev.id)
        rep = members[0]
        seed_date = _as_date(rep.direct_seed_date)
        plant = get_plant_by_id(rep.plant_id)
        germ_days = DEFAULT_GERMINATION_DAYS
        if plant:
            germ_days = plant.get('germination_days') or DEFAULT_GERMINATION_DAYS
        expected_germ = seed_date + timedelta(days=germ_days)
        total_quantity = sum((m.quantity or 0) for m in members)
        row = {
            'signalKey': f'germination-{rep.id}',
            'plantingEventId': rep.id,
            'plantingEventIds': [m.id for m in members],
            'plantName': _plant_name(rep.plant_id),
            'variety': rep.variety,
            'directSeedDate': seed_date.isoformat(),
            'expectedGerminationDate': expected_germ.isoformat(),
            'germinationDays': germ_days,
            'quantity': total_quantity,
            'bedId': rep.garden_bed_id,
            'bedName': bed_lookup.get(rep.garden_bed_id),
        }
        days_past = (target_date - expected_germ).days
        if days_past > STALE_GERMINATION_CHECK_DAYS:
            if len(missed) < SIGNAL_CAP:
                missed.append(row)
        else:
            if len(active) < SIGNAL_CAP:
                active.append(row)
        if len(active) >= SIGNAL_CAP and len(missed) >= SIGNAL_CAP:
            break
    return {'active': active, 'missed': missed}


def _build_indoor_germination_check(user_id, target_date):
    """
    Indoor seed starts whose expected germination date has passed but have
    not been marked germinated yet.

    Two data paths, deduped:
      a) IndoorSeedStart records (primary; richer data).
         Status must still be 'planned' or 'seeded' (i.e., NOT in
         germinating/growing/ready/transplanted) AND actual_germination_date
         is NULL.
         If expected_germination_date is set, compare it to end_of_day(target).
         Otherwise fall back to start_date + plant.germination_days.
      b) PlantingEvent records (fallback for events without a linked ISS).
         Filter by seed_start_date set, not is_complete, and
         seed_start_date + plant.germination_days <= target_date.
         Suppress events whose id is in the linked_event_ids set from path (a).
         Also suppress events whose transplant_date <= target_date (the
         "transplant due" signal will surface them — analogous to the
         suppression in _build_transplants_due).

    Grouping: each path groups by (seed_start_date, plant_id, variety).
    Output payload includes `indoorSeedStartIds` (ISS path) or
    `plantingEventIds` (PE path).

    Sibling of _build_germination_check (which stays direct-seed-only).
    """
    _, end_of_day = _day_bounds(target_date)
    DEFAULT_GERMINATION_DAYS = 10

    results = []
    linked_event_ids = set()

    # ---- Path (a): IndoorSeedStart records ----
    iss_records = (
        IndoorSeedStart.query
        .filter(
            IndoorSeedStart.user_id == user_id,
            IndoorSeedStart.actual_germination_date.is_(None),
            IndoorSeedStart.status.notin_(
                ('germinating', 'growing', 'ready', 'transplanted')
            ),
            IndoorSeedStart.cancelled_at.is_(None),
        )
        .order_by(IndoorSeedStart.start_date.asc())
        .limit(SIGNAL_CAP * 3)
        .all()
    )

    # Pre-compute per-record fields, drop stale (and accumulate linked_event_ids
    # for downstream PE dedup), then group qualifying records.
    iss_groups = defaultdict(list)
    for s in iss_records:
        start_date = _as_date(s.start_date)
        if start_date is None:
            continue
        expected_germ = _as_date(s.expected_germination_date)

        if expected_germ is not None:
            if expected_germ > target_date:
                continue
            germ_days_used = None
            if start_date is not None:
                germ_days_used = (expected_germ - start_date).days
            if germ_days_used is None or germ_days_used < 0:
                # Fall back to plant default if start_date missing or weird
                plant_for_default = get_plant_by_id(s.plant_id)
                germ_days_used = DEFAULT_GERMINATION_DAYS
                if plant_for_default:
                    plant_germ = plant_for_default.get('germination_days')
                    germ_days_used = plant_germ if plant_germ is not None else DEFAULT_GERMINATION_DAYS
        else:
            # Compute fallback from start_date + plant.germination_days
            if start_date is None:
                continue
            plant = get_plant_by_id(s.plant_id)
            germ_days_used = DEFAULT_GERMINATION_DAYS
            if plant:
                plant_germ = plant.get('germination_days')
                germ_days_used = plant_germ if plant_germ is not None else DEFAULT_GERMINATION_DAYS
            expected_germ = start_date + timedelta(days=germ_days_used)
            if expected_germ > target_date:
                continue

        # Silent drop for stale indoor germination checks (plan §2.2).
        # We still record the linked PE id so the PE path doesn't resurface it.
        if (target_date - expected_germ).days > STALE_GERMINATION_CHECK_DAYS:
            if s.planting_event_id is not None:
                linked_event_ids.add(s.planting_event_id)
            continue

        # Always track linked PE id (for dedup with PE path) regardless of grouping.
        if s.planting_event_id is not None:
            linked_event_ids.add(s.planting_event_id)

        variety_key = s.variety if s.variety else None
        key = (start_date, s.plant_id, variety_key)
        # Stash the per-record computed values alongside the record.
        iss_groups[key].append((s, expected_germ, germ_days_used))

    sorted_iss_keys = sorted(
        iss_groups.keys(),
        key=lambda k: (k[0], min(rec.id for rec, _, _ in iss_groups[k])),
    )
    for key in sorted_iss_keys:
        members = sorted(iss_groups[key], key=lambda tup: tup[0].id)
        rep_record, rep_expected_germ, rep_germ_days = members[0]
        start_date = _as_date(rep_record.start_date)
        total_quantity = sum((m[0].seeds_started or 0) for m in members)
        # Carry through any linked PE id from any member (representative-style).
        linked_pe_id = next(
            (m[0].planting_event_id for m in members if m[0].planting_event_id is not None),
            None,
        )
        results.append({
            'signalKey': f'indoor-germ-iss-{rep_record.id}',
            'plantingEventId': linked_pe_id,
            'indoorSeedStartId': rep_record.id,
            'indoorSeedStartIds': [m[0].id for m in members],
            'plantName': _plant_name(rep_record.plant_id),
            'variety': rep_record.variety,
            'seedStartDate': start_date.isoformat(),
            'expectedGerminationDate': rep_expected_germ.isoformat(),
            'germinationDays': rep_germ_days,
            'quantity': total_quantity,
        })
        if len(results) >= SIGNAL_CAP:
            break

    # ---- Path (b): PlantingEvent fallback ----
    if len(results) < SIGNAL_CAP:
        events = (
            PlantingEvent.query
            .filter(
                PlantingEvent.user_id == user_id,
                PlantingEvent.event_type == 'planting',
                PlantingEvent.seed_start_date.isnot(None),
                PlantingEvent.cancelled_at.is_(None),
            )
            .order_by(PlantingEvent.seed_start_date.asc())
            .limit(SIGNAL_CAP * 3)
            .all()
        )

        # Group qualifying events by composite key.
        pe_groups = defaultdict(list)
        for e in events:
            if e.id in linked_event_ids:
                continue  # already surfaced via ISS path
            if e.is_complete:
                continue
            seed_start = _as_date(e.seed_start_date)
            if seed_start is None:
                continue
            # Suppress when transplant has come due — the "transplants due"
            # signal will own the actionable item from this point forward.
            transplant = _as_date(e.transplant_date)
            if transplant is not None and transplant <= target_date:
                continue
            plant = get_plant_by_id(e.plant_id)
            germ_days = DEFAULT_GERMINATION_DAYS
            if plant:
                plant_germ = plant.get('germination_days')
                germ_days = plant_germ if plant_germ is not None else DEFAULT_GERMINATION_DAYS
            expected_germ = seed_start + timedelta(days=germ_days)
            if expected_germ > target_date:
                continue
            # Silent drop for stale indoor germination checks (plan §2.2).
            if (target_date - expected_germ).days > STALE_GERMINATION_CHECK_DAYS:
                continue
            variety_key = e.variety if e.variety else None
            key = (seed_start, e.plant_id, variety_key)
            pe_groups[key].append((e, expected_germ, germ_days))

        sorted_pe_keys = sorted(
            pe_groups.keys(),
            key=lambda k: (k[0], min(ev.id for ev, _, _ in pe_groups[k])),
        )
        for key in sorted_pe_keys:
            members = sorted(pe_groups[key], key=lambda tup: tup[0].id)
            rep_event, rep_expected_germ, rep_germ_days = members[0]
            seed_start = _as_date(rep_event.seed_start_date)
            total_quantity = sum((m[0].quantity or 0) for m in members)
            results.append({
                'signalKey': f'indoor-germ-pe-{rep_event.id}',
                'plantingEventId': rep_event.id,
                'plantingEventIds': [m[0].id for m in members],
                'indoorSeedStartId': None,
                'plantName': _plant_name(rep_event.plant_id),
                'variety': rep_event.variety,
                'seedStartDate': seed_start.isoformat(),
                'expectedGerminationDate': rep_expected_germ.isoformat(),
                'germinationDays': rep_germ_days,
                'quantity': total_quantity,
            })
            if len(results) >= SIGNAL_CAP:
                break

    return results


def _build_frost_risk(user_id, target_date):
    """
    Frost risk signal. Uses the same weather forecast source as the
    WeatherSummaryTile (simulation_weather.get_forecast_for_simulation).

    Returns None-like default if no location available or forecast fails.
    """
    default = {
        'signalKey': 'frost-risk',
        'atRisk': False,
        'forecastLowF': None,
        'windowHours': FROST_RISK_WINDOW_HOURS,
        'source': 'weather-forecast',
    }

    prop = Property.query.filter_by(user_id=user_id).first()
    if not prop or not prop.latitude or not prop.longitude:
        return default

    try:
        from simulation_weather import get_forecast_for_simulation
        forecast = get_forecast_for_simulation(prop.latitude, prop.longitude, days=2)
    except Exception as e:
        logger.warning("Frost-risk forecast failed: %s", e)
        return default

    days = (forecast or {}).get('forecast') or []
    if not days:
        return default

    # Look at the next 24h (today's entry)
    first = days[0]
    low = first.get('lowTemp')
    at_risk = low is not None and low <= FROST_RISK_TEMP_F

    return {
        'signalKey': 'frost-risk',
        'atRisk': bool(at_risk),
        'forecastLowF': low,
        'windowHours': FROST_RISK_WINDOW_HOURS,
        'source': 'weather-forecast',
    }


def _build_rain_alert(user_id, target_date):
    """Rain alert using same weather source, summed across the next 48h."""
    default = {
        'signalKey': 'rain-alert',
        'expected': False,
        'inchesExpected': 0.0,
        'windowHours': RAIN_WINDOW_HOURS,
    }

    prop = Property.query.filter_by(user_id=user_id).first()
    if not prop or not prop.latitude or not prop.longitude:
        return default

    try:
        from simulation_weather import get_forecast_for_simulation
        forecast = get_forecast_for_simulation(prop.latitude, prop.longitude, days=2)
    except Exception as e:
        logger.warning("Rain-alert forecast failed: %s", e)
        return default

    days = (forecast or {}).get('forecast') or []
    if not days:
        return default

    total = 0.0
    for d in days[:2]:
        precip = d.get('precipitation')
        if precip is not None:
            total += float(precip)

    return {
        'signalKey': 'rain-alert',
        'expected': total >= RAIN_ALERT_INCHES,
        'inchesExpected': round(total, 2),
        'windowHours': RAIN_WINDOW_HOURS,
    }


def _build_compost_overdue(user_id, target_date, turn_reminder_days=COMPOST_DEFAULT_TURN_DAYS):
    """
    CompostPiles whose last_turned is older than turn_reminder_days.
    (No turn_frequency_days column exists in the schema.)
    """
    piles = (
        CompostPile.query
        .filter(CompostPile.user_id == user_id)
        .filter(CompostPile.status != 'ready')
        .limit(SIGNAL_CAP * 3)
        .all()
    )

    results = []
    target_dt = datetime.combine(target_date, time.min)
    for pile in piles:
        if pile.last_turned is None:
            # No turn recorded yet — only flag if pile has been building for
            # more than the threshold
            start = pile.start_date
            if start is None:
                continue
            days_since = (target_dt - start).days
        else:
            days_since = (target_dt - pile.last_turned).days

        if days_since is None or days_since < turn_reminder_days:
            continue

        results.append({
            'signalKey': f'compost-{pile.id}',
            'pileId': pile.id,
            'pileName': pile.name,
            'daysSinceLastTurn': days_since,
            'turnFrequencyDays': turn_reminder_days,
        })
        if len(results) >= SIGNAL_CAP:
            break
    return results


def _build_seed_low_stock(user_id, target_date, low_stock_packets=LOW_STOCK_SEED_PACKETS):
    """
    SeedInventory entries with quantity (packets) below low_stock_packets.
    We compare packet quantity rather than total seeds because the schema
    tracks packets as the primary unit.
    """
    seeds = (
        SeedInventory.query
        .filter(SeedInventory.user_id == user_id)
        .filter(SeedInventory.quantity.isnot(None))
        .filter(SeedInventory.quantity < low_stock_packets)
        .order_by(SeedInventory.quantity.asc())
        .limit(SIGNAL_CAP)
        .all()
    )

    return [
        {
            'signalKey': f'seed-low-{s.id}',
            'seedId': s.id,
            'plantName': _plant_name(s.plant_id),
            'variety': s.variety,
            'quantityRemaining': s.quantity,
        }
        for s in seeds
    ]


def _build_seed_expiring(user_id, target_date, expiry_window_days=SEED_EXPIRY_WINDOW_DAYS):
    """SeedInventory entries expiring within expiry_window_days."""
    start_dt = datetime.combine(target_date, time.min)
    end_dt = datetime.combine(target_date + timedelta(days=expiry_window_days), time.max)

    seeds = (
        SeedInventory.query
        .filter(SeedInventory.user_id == user_id)
        .filter(SeedInventory.expiration_date.isnot(None))
        .filter(SeedInventory.expiration_date >= start_dt)
        .filter(SeedInventory.expiration_date <= end_dt)
        .order_by(SeedInventory.expiration_date.asc())
        .limit(SIGNAL_CAP)
        .all()
    )

    results = []
    for s in seeds:
        exp_date = _as_date(s.expiration_date)
        if exp_date is None:
            continue
        days_until = (exp_date - target_date).days
        results.append({
            'signalKey': f'seed-exp-{s.id}',
            'seedId': s.id,
            'plantName': _plant_name(s.plant_id),
            'variety': s.variety,
            'expiresOn': exp_date.isoformat(),
            'daysUntilExpiry': days_until,
        })
    return results


def _build_livestock_actions(user_id, target_date):
    """
    Today-scoped livestock actions. Currently: egg collection not yet logged
    for any active chicken flock.
    """
    start_dt, end_dt = _day_bounds(target_date)

    chickens = (
        Chicken.query
        .filter(Chicken.user_id == user_id)
        .filter(Chicken.status == 'active')
        .all()
    )
    if not chickens:
        return []

    chicken_ids = [c.id for c in chickens]
    # Does any EggProduction record exist for these chickens on target_date?
    logged = (
        EggProduction.query
        .filter(EggProduction.chicken_id.in_(chicken_ids))
        .filter(EggProduction.date >= start_dt)
        .filter(EggProduction.date <= end_dt)
        .first()
    )
    if logged:
        return []

    return [{
        'signalKey': 'livestock-egg-collection',
        'type': 'egg-collection',
        'label': 'Egg collection not yet logged today',
        'animal': 'Chickens',
    }]


# ---------------------------------------------------------------------------
# Public entrypoint
# ---------------------------------------------------------------------------

def build_dashboard_today(user_id, target_date):
    """
    Compose all "needs attention" signals for a given user and date.

    Returns a dict already in camelCase, ready to be jsonified by the route.
    """
    # Builders that can age out return {'active': [...], 'missed': [...]}.
    # Unpack and distribute between the `signals` block (active) and the
    # top-level `missed` block (aged out). Model state is never mutated.
    settings = get_flat_settings(user_id)
    indoor_starts = _build_indoor_starts_due(user_id, target_date)
    transplants = _build_transplants_due(user_id, target_date)
    direct_seeds = _build_direct_seed_due(user_id, target_date)
    place_planted = _build_place_planted_item(user_id, target_date)
    germination_checks = _build_germination_check(user_id, target_date)

    signals = {
        'harvestReady': _build_harvest_ready(user_id, target_date),
        'indoorStartsDue': indoor_starts['active'],
        'transplantsDue': transplants['active'],
        'directSeedDue': direct_seeds['active'],
        'placePlantedItem': place_planted['active'],
        'germinationCheck': germination_checks['active'],
        'indoorGerminationCheck': _build_indoor_germination_check(user_id, target_date),
        'frostRisk': _build_frost_risk(user_id, target_date),
        'rainAlert': _build_rain_alert(user_id, target_date),
        'compostOverdue': _build_compost_overdue(
            user_id,
            target_date,
            settings['compost.turnReminderDays'],
        ),
        'seedLowStock': _build_seed_low_stock(
            user_id,
            target_date,
            settings['dashboard.seedLowStockPackets'],
        ),
        'seedExpiring': _build_seed_expiring(
            user_id,
            target_date,
            settings['dashboard.seedExpiryWindowDays'],
        ),
        'livestockActionsDue': _build_livestock_actions(user_id, target_date),
    }

    missed = {
        'indoorStartsDue': indoor_starts['missed'],
        'transplantsDue': transplants['missed'],
        'directSeedDue': direct_seeds['missed'],
        'placePlantedItem': place_planted['missed'],
        'germinationCheck': germination_checks['missed'],
    }

    # Filter out snoozed signals — runs across BOTH signals.* and missed.*
    # so a dismissed item does not resurface when it ages into the missed
    # bucket (plan §5 snooze interaction risk).
    from models import DashboardSnooze
    snoozed = DashboardSnooze.query.filter(
        DashboardSnooze.user_id == user_id,
        DashboardSnooze.snooze_until >= target_date,
    ).all()
    snoozed_keys = {s.signal_key for s in snoozed}

    if snoozed_keys:
        # Filter array signals
        for key in ['harvestReady', 'indoorStartsDue', 'transplantsDue', 'directSeedDue',
                     'placePlantedItem', 'germinationCheck', 'indoorGerminationCheck',
                     'compostOverdue', 'seedLowStock', 'seedExpiring', 'livestockActionsDue']:
            if key in signals and isinstance(signals[key], list):
                signals[key] = [r for r in signals[key] if r.get('signalKey') not in snoozed_keys]

        # Filter missed buckets using the same snoozed_keys set
        for key in ['indoorStartsDue', 'transplantsDue', 'directSeedDue',
                    'placePlantedItem', 'germinationCheck']:
            if key in missed and isinstance(missed[key], list):
                missed[key] = [r for r in missed[key] if r.get('signalKey') not in snoozed_keys]

        # Filter scalar signals (frost/rain)
        if signals.get('frostRisk', {}).get('signalKey') in snoozed_keys:
            signals['frostRisk']['atRisk'] = False
        if signals.get('rainAlert', {}).get('signalKey') in snoozed_keys:
            signals['rainAlert']['expected'] = False

    return {
        'date': target_date.isoformat(),
        'signals': signals,
        'missed': missed,
        'meta': {
            'generatedAt': datetime.utcnow().isoformat() + 'Z',
            'userTimezone': 'UTC',  # No per-user timezone field in schema
        },
    }
