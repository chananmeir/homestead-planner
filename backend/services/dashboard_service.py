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
from datetime import datetime, date, timedelta, time

from models import (
    PlantingEvent,
    GardenBed,
    CompostPile,
    SeedInventory,
    Property,
    Chicken,
    EggProduction,
    IndoorSeedStart,
)
from plant_database import get_plant_by_id
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
STALE_GERMINATION_CHECK_DAYS = 14 # expected_germination_date age threshold (silent drop)
HARVEST_DEMOTION_DAYS = 14        # daysPastExpected threshold for isStale flag (never drops)


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


# ---------------------------------------------------------------------------
# Signal builders
# ---------------------------------------------------------------------------

def _build_harvest_ready(user_id, target_date):
    """
    PlantingEvents whose expected_harvest_date <= target_date, not complete,
    event_type == 'planting'.
    """
    _, end_of_day = _day_bounds(target_date)

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
        )
        .order_by(PlantingEvent.expected_harvest_date.asc())
        .limit(SIGNAL_CAP * 3)  # over-fetch; filter is_complete in Python
        .all()
    )

    # Pre-load bed names in one query
    bed_ids = {e.garden_bed_id for e in events if e.garden_bed_id is not None}
    bed_lookup = {}
    if bed_ids:
        for bed in GardenBed.query.filter(GardenBed.id.in_(bed_ids)).all():
            bed_lookup[bed.id] = bed.name

    results = []
    for e in events:
        if e.is_complete:
            continue
        harvest_date = _as_date(e.expected_harvest_date)
        if harvest_date is None:
            continue
        days_past = (target_date - harvest_date).days
        days_past_clamped = max(0, days_past)
        results.append({
            'signalKey': f'harvest-{e.id}',
            'plantingEventId': e.id,
            'plantName': _plant_name(e.plant_id),
            'variety': e.variety,
            'bedId': e.garden_bed_id,
            'bedName': bed_lookup.get(e.garden_bed_id),
            'quantity': e.quantity,
            'daysPastExpected': days_past_clamped,
            # Harvest rows NEVER drop (integrity-sensitive — would fabricate yield).
            # Frontend uses isStale to demote tone after HARVEST_DEMOTION_DAYS.
            'isStale': days_past_clamped > HARVEST_DEMOTION_DAYS,
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

    active = []
    missed = []
    linked_event_ids = set()
    for e in events:
        if e.is_complete:
            continue
        seed_start = _as_date(e.seed_start_date)
        if seed_start is None:
            continue
        row = {
            'signalKey': f'indoor-{e.id}',
            'plantingEventId': e.id,
            'indoorSeedStartId': None,
            'plantName': _plant_name(e.plant_id),
            'variety': e.variety,
            'seedStartDate': seed_start.isoformat(),
            'quantity': e.quantity,
        }
        days_past = (target_date - seed_start).days
        if days_past > STALE_INDOOR_START_DAYS:
            if len(missed) < SIGNAL_CAP:
                missed.append(row)
        else:
            if len(active) < SIGNAL_CAP:
                active.append(row)
        linked_event_ids.add(e.id)
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
        for s in seed_starts:
            if s.planting_event_id is not None and s.planting_event_id in linked_event_ids:
                continue  # already shown via the PlantingEvent path
            start_date = _as_date(s.start_date)
            if start_date is None:
                continue
            row = {
                'signalKey': f'indoor-iss-{s.id}',
                'plantingEventId': s.planting_event_id,
                'indoorSeedStartId': s.id,
                'plantName': _plant_name(s.plant_id),
                'variety': s.variety,
                'seedStartDate': start_date.isoformat(),
                'quantity': s.seeds_started,
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

    bed_ids = {e.garden_bed_id for e in events if e.garden_bed_id is not None}
    bed_lookup = {}
    if bed_ids:
        for bed in GardenBed.query.filter(GardenBed.id.in_(bed_ids)).all():
            bed_lookup[bed.id] = bed.name

    active = []
    missed = []
    for e in events:
        if e.is_complete:
            continue
        # If this event has a scheduled indoor seed-start that has already
        # passed and the event is still incomplete, the prerequisite start
        # never happened — suppress the transplant-due row. The companion
        # "indoor start due" builder will still surface the missed start as
        # the actionable item. See plan: snuggly-marinating-canyon.md.
        seed_start = _as_date(e.seed_start_date)
        if seed_start is not None and seed_start <= target_date:
            continue
        transplant = _as_date(e.transplant_date)
        if transplant is None:
            continue
        row = {
            'signalKey': f'transplant-{e.id}',
            'plantingEventId': e.id,
            'plantName': _plant_name(e.plant_id),
            'variety': e.variety,
            'transplantDate': transplant.isoformat(),
            'quantity': e.quantity,
            'bedId': e.garden_bed_id,
            'bedName': bed_lookup.get(e.garden_bed_id),
        }
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

    active = []
    missed = []
    for e in events:
        if e.is_complete:
            continue
        direct_seed = _as_date(e.direct_seed_date)
        if direct_seed is None:
            continue
        row = {
            'signalKey': f'direct-seed-{e.id}',
            'plantingEventId': e.id,
            'plantName': _plant_name(e.plant_id),
            'variety': e.variety,
            'directSeedDate': direct_seed.isoformat(),
            'quantity': e.quantity,
            'bedId': e.garden_bed_id,
            'bedName': bed_lookup.get(e.garden_bed_id),
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


def _build_germination_check(user_id, target_date):
    """PlantingEvents where direct_seed_date + germination_days <= target_date, not complete."""
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
    results = []
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
        # Silent drop for stale germination checks — if germination hasn't
        # been logged STALE_GERMINATION_CHECK_DAYS past the expected date,
        # the reminder has no actionable value left (germinated unlogged, or
        # failed). No `missed` bucket for germ checks per plan §2.2.
        if (target_date - expected_germ).days > STALE_GERMINATION_CHECK_DAYS:
            continue
        results.append({
            'signalKey': f'germination-{e.id}',
            'plantingEventId': e.id,
            'plantName': _plant_name(e.plant_id),
            'variety': e.variety,
            'directSeedDate': seed_date.isoformat(),
            'expectedGerminationDate': expected_germ.isoformat(),
            'germinationDays': germ_days,
            'quantity': e.quantity,
            'bedId': e.garden_bed_id,
            'bedName': bed_lookup.get(e.garden_bed_id),
        })
        if len(results) >= SIGNAL_CAP:
            break
    return results


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
        if (target_date - expected_germ).days > STALE_GERMINATION_CHECK_DAYS:
            if s.planting_event_id is not None:
                linked_event_ids.add(s.planting_event_id)
            continue

        results.append({
            'signalKey': f'indoor-germ-iss-{s.id}',
            'plantingEventId': s.planting_event_id,
            'indoorSeedStartId': s.id,
            'plantName': _plant_name(s.plant_id),
            'variety': s.variety,
            'seedStartDate': start_date.isoformat(),
            'expectedGerminationDate': expected_germ.isoformat(),
            'germinationDays': germ_days_used,
            'quantity': s.seeds_started,
        })
        if s.planting_event_id is not None:
            linked_event_ids.add(s.planting_event_id)
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
            results.append({
                'signalKey': f'indoor-germ-pe-{e.id}',
                'plantingEventId': e.id,
                'indoorSeedStartId': None,
                'plantName': _plant_name(e.plant_id),
                'variety': e.variety,
                'seedStartDate': seed_start.isoformat(),
                'expectedGerminationDate': expected_germ.isoformat(),
                'germinationDays': germ_days,
                'quantity': e.quantity,
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


def _build_compost_overdue(user_id, target_date):
    """
    CompostPiles whose last_turned is older than COMPOST_DEFAULT_TURN_DAYS.
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

        if days_since is None or days_since < COMPOST_DEFAULT_TURN_DAYS:
            continue

        results.append({
            'signalKey': f'compost-{pile.id}',
            'pileId': pile.id,
            'pileName': pile.name,
            'daysSinceLastTurn': days_since,
            'turnFrequencyDays': COMPOST_DEFAULT_TURN_DAYS,
        })
        if len(results) >= SIGNAL_CAP:
            break
    return results


def _build_seed_low_stock(user_id, target_date):
    """
    SeedInventory entries with quantity (packets) below LOW_STOCK_SEED_PACKETS.
    We compare packet quantity rather than total seeds because the schema
    tracks packets as the primary unit.
    """
    seeds = (
        SeedInventory.query
        .filter(SeedInventory.user_id == user_id)
        .filter(SeedInventory.quantity.isnot(None))
        .filter(SeedInventory.quantity < LOW_STOCK_SEED_PACKETS)
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


def _build_seed_expiring(user_id, target_date):
    """SeedInventory entries expiring within SEED_EXPIRY_WINDOW_DAYS."""
    start_dt = datetime.combine(target_date, time.min)
    end_dt = datetime.combine(target_date + timedelta(days=SEED_EXPIRY_WINDOW_DAYS), time.max)

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
    indoor_starts = _build_indoor_starts_due(user_id, target_date)
    transplants = _build_transplants_due(user_id, target_date)
    direct_seeds = _build_direct_seed_due(user_id, target_date)

    signals = {
        'harvestReady': _build_harvest_ready(user_id, target_date),
        'indoorStartsDue': indoor_starts['active'],
        'transplantsDue': transplants['active'],
        'directSeedDue': direct_seeds['active'],
        'germinationCheck': _build_germination_check(user_id, target_date),
        'indoorGerminationCheck': _build_indoor_germination_check(user_id, target_date),
        'frostRisk': _build_frost_risk(user_id, target_date),
        'rainAlert': _build_rain_alert(user_id, target_date),
        'compostOverdue': _build_compost_overdue(user_id, target_date),
        'seedLowStock': _build_seed_low_stock(user_id, target_date),
        'seedExpiring': _build_seed_expiring(user_id, target_date),
        'livestockActionsDue': _build_livestock_actions(user_id, target_date),
    }

    missed = {
        'indoorStartsDue': indoor_starts['missed'],
        'transplantsDue': transplants['missed'],
        'directSeedDue': direct_seeds['missed'],
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
                     'germinationCheck', 'indoorGerminationCheck', 'compostOverdue',
                     'seedLowStock', 'seedExpiring', 'livestockActionsDue']:
            if key in signals and isinstance(signals[key], list):
                signals[key] = [r for r in signals[key] if r.get('signalKey') not in snoozed_keys]

        # Filter missed buckets using the same snoozed_keys set
        for key in ['indoorStartsDue', 'transplantsDue', 'directSeedDue']:
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
