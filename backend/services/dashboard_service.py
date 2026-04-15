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
        results.append({
            'plantingEventId': e.id,
            'plantName': _plant_name(e.plant_id),
            'variety': e.variety,
            'bedId': e.garden_bed_id,
            'bedName': bed_lookup.get(e.garden_bed_id),
            'quantity': e.quantity,
            'daysPastExpected': max(0, days_past),
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
    """
    _, end_of_day = _day_bounds(target_date)

    events = (
        PlantingEvent.query
        .filter(
            PlantingEvent.user_id == user_id,
            PlantingEvent.event_type == 'planting',
            PlantingEvent.seed_start_date.isnot(None),
            PlantingEvent.seed_start_date <= end_of_day,
        )
        .order_by(PlantingEvent.seed_start_date.asc())
        .limit(SIGNAL_CAP * 3)
        .all()
    )

    results = []
    for e in events:
        if e.is_complete:
            continue
        seed_start = _as_date(e.seed_start_date)
        if seed_start is None:
            continue
        results.append({
            'plantingEventId': e.id,
            'plantName': _plant_name(e.plant_id),
            'variety': e.variety,
            'seedStartDate': seed_start.isoformat(),
            'quantity': e.quantity,
        })
        if len(results) >= SIGNAL_CAP:
            break
    return results


def _build_transplants_due(user_id, target_date):
    """PlantingEvents with transplant_date <= target_date, not complete."""
    _, end_of_day = _day_bounds(target_date)

    events = (
        PlantingEvent.query
        .filter(
            PlantingEvent.user_id == user_id,
            PlantingEvent.event_type == 'planting',
            PlantingEvent.transplant_date.isnot(None),
            PlantingEvent.transplant_date <= end_of_day,
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

    results = []
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
        results.append({
            'plantingEventId': e.id,
            'plantName': _plant_name(e.plant_id),
            'variety': e.variety,
            'transplantDate': transplant.isoformat(),
            'quantity': e.quantity,
            'bedId': e.garden_bed_id,
            'bedName': bed_lookup.get(e.garden_bed_id),
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
        'atRisk': bool(at_risk),
        'forecastLowF': low,
        'windowHours': FROST_RISK_WINDOW_HOURS,
        'source': 'weather-forecast',
    }


def _build_rain_alert(user_id, target_date):
    """Rain alert using same weather source, summed across the next 48h."""
    default = {
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
    signals = {
        'harvestReady': _build_harvest_ready(user_id, target_date),
        'indoorStartsDue': _build_indoor_starts_due(user_id, target_date),
        'transplantsDue': _build_transplants_due(user_id, target_date),
        'frostRisk': _build_frost_risk(user_id, target_date),
        'rainAlert': _build_rain_alert(user_id, target_date),
        'compostOverdue': _build_compost_overdue(user_id, target_date),
        'seedLowStock': _build_seed_low_stock(user_id, target_date),
        'seedExpiring': _build_seed_expiring(user_id, target_date),
        'livestockActionsDue': _build_livestock_actions(user_id, target_date),
    }
    return {
        'date': target_date.isoformat(),
        'signals': signals,
        'meta': {
            'generatedAt': datetime.utcnow().isoformat() + 'Z',
            'userTimezone': 'UTC',  # No per-user timezone field in schema
        },
    }
