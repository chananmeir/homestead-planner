"""
Indoor seed start creation service.

Single canonical creation path for IndoorSeedStart rows. Two callers:
- blueprints/utilities_bp.py::create_indoor_start_from_planting_event (the
  HTTP contract — validation/serialization live there, creation logic here)
- services/garden_planner_service.py::export_to_calendar (Tier 2 opt-in
  auto-create: createIndoorStarts on the export request)

Do NOT create IndoorSeedStart rows by direct insert elsewhere — route new
callers through create_indoor_start()/create_indoor_start_for_event() so
overdue handling, date math, and event sync stay consistent.
"""
import json
import logging
import math
from datetime import datetime, timedelta

from models import db, IndoorSeedStart
from plant_database import get_plant_by_id
from simulation_clock import get_utc_now

logger = logging.getLogger(__name__)

VALID_OVERDUE_MODES = {'skip', 'import_anyway', 'reschedule_today'}


def calculate_seed_quantity(desired_plants: int, germination_rate: float) -> int:
    """
    Calculate how many seeds to start accounting for germination failure.
    Adds safety buffer of 15% beyond germination rate.

    Example: Want 10 plants, 80% germination
    - Minimum: 10 / 0.80 = 12.5 → 13 seeds
    - With buffer: 13 * 1.15 = 14.95 → 15 seeds
    """
    if germination_rate <= 0 or germination_rate > 100:
        germination_rate = 85.0  # Default fallback

    # Convert percentage to decimal
    rate = germination_rate / 100.0

    # Calculate minimum needed
    minimum_seeds = math.ceil(desired_plants / rate)

    # Add 15% safety buffer
    with_buffer = minimum_seeds * 1.15

    return math.ceil(with_buffer)


def predict_germination_days(user_id, plant_id, location=None):
    """Return avg actual germination days from user history, or plant DB default."""
    query = IndoorSeedStart.query.filter(
        IndoorSeedStart.user_id == user_id,
        IndoorSeedStart.plant_id == plant_id,
        IndoorSeedStart.actual_germination_date.isnot(None),
        IndoorSeedStart.start_date.isnot(None)
    )
    if location:
        query = query.filter(IndoorSeedStart.location == location)
    records = query.all()
    actual_days = [r.actual_germination_days for r in records if r.actual_germination_days is not None]
    if actual_days:
        return round(sum(actual_days) / len(actual_days))
    plant = get_plant_by_id(plant_id)
    return plant.get('germination_days', 7) if plant else 7


def create_indoor_start(
    user_id,
    *,
    plant,
    plant_id,
    variety=None,
    transplant_date,
    desired_quantity=1,
    expected_rate=85.0,
    overdue_mode='skip',
    location=None,
    light_hours=12,
    temperature=70,
    notes=None,
    seed_inventory_id=None,
    destination_bed_ids_json=None,
    linked_event=None,
    dry_run=False,
    source=None,
    sync_linked_event='always',
):
    """
    Core IndoorSeedStart creation. Flushes but does NOT commit — the caller
    owns the transaction boundary.

    location semantics (mirrors the original endpoint behavior exactly):
    the raw value (possibly None) filters the germination-history prediction;
    the stored row falls back to 'windowsill' when None.

    sync_linked_event: 'always' (endpoint behavior — overwrite the linked
    event's seed_start/transplant/expected_harvest dates) or 'if_rescheduled'
    (export auto-create — only touch the event when the start was clamped
    forward, so the export's seed-override-aware harvest date is preserved
    for on-time rows).

    Returns dict:
      skipped (bool) · skipped_reason (str|None) · calculation (dict) ·
      warning (str|None) · seed_start (IndoorSeedStart|None) ·
      rescheduled (bool)
    """
    if overdue_mode not in VALID_OVERDUE_MODES:
        raise ValueError(f'Invalid overdue_mode: {overdue_mode!r}')
    if sync_linked_event not in ('always', 'if_rescheduled'):
        raise ValueError(f'Invalid sync_linked_event: {sync_linked_event!r}')

    weeks_indoors = plant.get('weeksIndoors', 0)
    computed_start_date = transplant_date - timedelta(weeks=weeks_indoors)

    today_dt = get_utc_now()
    is_past_due = computed_start_date.date() < today_dt.date()

    # Resolve start date based on overdue mode.
    # rescheduled=True means we clamped a past-due row forward to today.
    rescheduled = False
    skipped_reason = None
    if is_past_due and overdue_mode == 'skip':
        skipped_reason = (
            f'Start date {computed_start_date.date().isoformat()} is '
            f'{(today_dt.date() - computed_start_date.date()).days} days in the past '
            f'— skipped (overdueMode=skip).'
        )
        indoor_start_date = computed_start_date  # preserve for preview payload
    elif is_past_due and overdue_mode == 'reschedule_today':
        # Clamp to today (preserve time-of-day so downstream math stays
        # consistent with a normal get_utc_now() start).
        indoor_start_date = datetime.combine(
            today_dt.date(),
            computed_start_date.time()
        )
        rescheduled = True
    else:
        # Not past-due, OR import_anyway: use the computed start date as-is.
        indoor_start_date = computed_start_date

    warning_message = None
    if is_past_due and overdue_mode == 'import_anyway':
        warning_message = (
            f'Note: Indoor start date ({indoor_start_date.date()}) is in the past. '
            f'You may be starting late.'
        )

    # Calculate expected dates. When rescheduled, germination/transplant
    # slide forward too so the downstream dates stay coherent.
    germination_days = predict_germination_days(user_id, plant_id, location)
    expected_germination_date = indoor_start_date + timedelta(days=germination_days)
    expected_transplant_date = indoor_start_date + timedelta(weeks=weeks_indoors)

    seeds_to_start = calculate_seed_quantity(desired_quantity, expected_rate)

    calculation_payload = {
        'transplantDate': transplant_date.isoformat(),
        'weeksIndoors': weeks_indoors,
        'computedStartDate': computed_start_date.isoformat(),
        'indoorStartDate': indoor_start_date.isoformat(),
        'expectedGerminationDate': expected_germination_date.isoformat(),
        'expectedTransplantDate': expected_transplant_date.isoformat(),
        'isPastDue': is_past_due,
        'overdueMode': overdue_mode,
        'rescheduled': rescheduled,
    }

    base_result = {
        'skipped': False,
        'skipped_reason': skipped_reason,
        'calculation': calculation_payload,
        'warning': warning_message,
        'seed_start': None,
        'rescheduled': rescheduled,
    }

    # Dry-run: report what would happen without persisting anything.
    if dry_run:
        return base_result

    # Past-due + overdueMode='skip' → do not create.
    if skipped_reason is not None:
        base_result['skipped'] = True
        return base_result

    if notes is None:
        notes = f'For transplanting on {transplant_date.strftime("%Y-%m-%d")}'

    # Always start as 'planned' — user explicitly updates status when they seed
    seed_start = IndoorSeedStart(
        user_id=user_id,
        plant_id=plant_id,
        variety=variety,
        seed_inventory_id=seed_inventory_id,
        start_date=indoor_start_date,
        expected_germination_date=expected_germination_date,
        expected_transplant_date=expected_transplant_date,
        seeds_started=seeds_to_start,
        expected_germination_rate=expected_rate,
        location=location if location is not None else 'windowsill',
        light_hours=light_hours,
        temperature=temperature,
        notes=notes,
        planting_event_id=linked_event.id if linked_event is not None else None,
        destination_bed_ids=destination_bed_ids_json,
        status='planned',
        source=source,
    )

    db.session.add(seed_start)
    db.session.flush()  # Get seed_start.id

    # Sync the linked PlantingEvent's dates to the (possibly rescheduled)
    # start. For on-time rows this is a no-op for seed_start/transplant dates,
    # but it DOES rewrite expected_harvest_date with the plant-default DTM —
    # which is why export auto-create passes 'if_rescheduled'.
    if linked_event is not None and (sync_linked_event == 'always' or rescheduled):
        linked_event.seed_start_date = indoor_start_date
        linked_event.transplant_date = expected_transplant_date
        days_to_maturity = plant.get('daysToMaturity', 70)
        linked_event.expected_harvest_date = expected_transplant_date + timedelta(days=days_to_maturity)

    base_result['seed_start'] = seed_start
    return base_result


def create_indoor_start_for_event(
    user_id,
    event,
    *,
    seed_inventory_id=None,
    overdue_mode='reschedule_today',
    source='export',
):
    """
    Export auto-create wrapper: create a tracking row for one exported
    PlantingEvent. Flushes but does not commit.

    Returns {'status': 'created'|'rescheduled'|'already_tracked'|'not_applicable'|'skipped',
             'seed_start': IndoorSeedStart|None}
    """
    if event.transplant_date is None or event.cancelled_at is not None:
        return {'status': 'not_applicable', 'seed_start': None}

    plant = get_plant_by_id(event.plant_id)
    if not plant or plant.get('weeksIndoors', 0) == 0:
        return {'status': 'not_applicable', 'seed_start': None}

    existing = IndoorSeedStart.query.filter(
        IndoorSeedStart.planting_event_id == event.id,
        IndoorSeedStart.user_id == user_id,
        IndoorSeedStart.cancelled_at.is_(None),
    ).first()
    if existing is not None:
        return {'status': 'already_tracked', 'seed_start': existing}

    destination_bed_ids_json = (
        json.dumps([event.garden_bed_id]) if event.garden_bed_id is not None else None
    )

    result = create_indoor_start(
        user_id,
        plant=plant,
        plant_id=event.plant_id,
        variety=event.variety,
        transplant_date=event.transplant_date,
        desired_quantity=event.quantity or 1,
        overdue_mode=overdue_mode,
        notes=(
            f'Auto-created by plan export. '
            f'Transplant on {event.transplant_date.strftime("%Y-%m-%d")}.'
        ),
        seed_inventory_id=seed_inventory_id,
        destination_bed_ids_json=destination_bed_ids_json,
        linked_event=event,
        source=source,
        sync_linked_event='if_rescheduled',
    )

    if result['skipped']:
        return {'status': 'skipped', 'seed_start': None}
    if result['rescheduled']:
        return {'status': 'rescheduled', 'seed_start': result['seed_start']}
    return {'status': 'created', 'seed_start': result['seed_start']}
