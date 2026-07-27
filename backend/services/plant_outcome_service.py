"""Plant outcome state transitions.

Outcome records are terminal lifecycle states that are distinct from
soft-cancel. Failed/did-not-establish outcomes also create a zero-yield
HarvestRecord flagged with yield_excluded so history is visible without
inflating yield totals.
"""

from sqlalchemy import or_

from models import db, HarvestRecord, PlantedItem, PlantingEvent


TERMINAL_OUTCOMES = {'failed', 'didnt_establish', 'not_planted'}
YIELD_EXCLUDED_OUTCOMES = {'failed', 'didnt_establish'}
OUTCOME_REASONS = {
    'failed': {'pest', 'disease', 'weather_frost', 'drought_neglect', 'animal_damage', 'other'},
    'didnt_establish': {'poor_germination', 'damping_off', 'other'},
    'not_planted': {'surplus_no_space', 'changed_plan', 'other'},
}
OUTCOME_LABELS = {
    'failed': 'Failed',
    'didnt_establish': "Didn't establish",
    'not_planted': 'Not planted',
}
REASON_LABELS = {
    'pest': 'Pest pressure',
    'disease': 'Disease',
    'weather_frost': 'Weather/frost',
    'drought_neglect': 'Drought or neglect',
    'animal_damage': 'Animal damage',
    'poor_germination': 'Poor germination',
    'damping_off': 'Damping off',
    'surplus_no_space': 'Surplus or no space',
    'changed_plan': 'Changed plan',
    'other': 'Other',
}


class PlantOutcomeError(ValueError):
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.status_code = status_code


def validate_outcome(outcome, reason=None):
    outcome = (outcome or '').strip()
    if outcome not in TERMINAL_OUTCOMES:
        raise PlantOutcomeError('outcome must be failed, didnt_establish, or not_planted')

    reason = (reason or 'other').strip()
    if reason not in OUTCOME_REASONS[outcome]:
        valid = ', '.join(sorted(OUTCOME_REASONS[outcome]))
        raise PlantOutcomeError(f'outcomeReason must be one of: {valid}')

    return outcome, reason


def _source_key_for_planted_item_outcome(item_id):
    return f'outcome:planted_item:{item_id}'


def _source_key_for_planting_event_outcome(event_id):
    return f'outcome:planting_event:{event_id}'


def _apply_variety_match(query, model, variety):
    if variety is None:
        return query.filter(model.variety.is_(None))
    return query.filter(model.variety == variety)


def matching_planting_event_for_item(item, include_cancelled=False):
    query = PlantingEvent.query.filter(
        PlantingEvent.user_id == item.user_id,
        PlantingEvent.garden_bed_id == item.garden_bed_id,
        PlantingEvent.plant_id == item.plant_id,
        PlantingEvent.position_x == item.position_x,
        PlantingEvent.position_y == item.position_y,
        or_(PlantingEvent.event_type.is_(None), PlantingEvent.event_type == 'planting'),
    )
    if not include_cancelled:
        query = query.filter(PlantingEvent.cancelled_at.is_(None))
    query = _apply_variety_match(query, PlantingEvent, item.variety)

    events = query.all()
    if not events:
        return None

    item_date = item.transplant_date or item.planted_date

    def event_sort_key(event):
        event_date = (
            event.transplant_date
            or event.direct_seed_date
            or event.seed_start_date
            or event.created_at
        )
        if item_date is not None and event_date is not None:
            try:
                date_distance = abs((event_date - item_date).total_seconds())
            except TypeError:
                date_distance = float('inf')
        else:
            date_distance = float('inf')
        return date_distance, -(event.id or 0)

    return sorted(events, key=event_sort_key)[0]


def matching_planted_items_for_event(event, include_outcomes=False):
    if (
        event.garden_bed_id is None
        or not event.plant_id
        or event.position_x is None
        or event.position_y is None
    ):
        return []

    query = PlantedItem.query.filter(
        PlantedItem.user_id == event.user_id,
        PlantedItem.garden_bed_id == event.garden_bed_id,
        PlantedItem.plant_id == event.plant_id,
        PlantedItem.position_x == event.position_x,
        PlantedItem.position_y == event.position_y,
        PlantedItem.cancelled_at.is_(None),
        PlantedItem.cleared_at.is_(None),
        PlantedItem.status != 'harvested',
    )
    if not include_outcomes:
        query = query.filter(PlantedItem.outcome.is_(None))
    query = _apply_variety_match(query, PlantedItem, event.variety)
    return query.all()


def _set_item_outcome_fields(item, outcome, reason, outcome_date, notes):
    item.outcome = outcome
    item.outcome_reason = reason
    item.outcome_date = outcome_date
    item.outcome_notes = notes
    item.status = outcome


def _set_event_outcome_fields(event, outcome, reason, outcome_date, notes):
    event.outcome = outcome
    event.outcome_reason = reason
    event.outcome_date = outcome_date
    event.outcome_notes = notes
    event.completed = True
    event.harvest_completed = True

    if outcome in {'not_planted', 'didnt_establish'}:
        event.quantity_completed = 0
    elif outcome == 'failed' and event.quantity is not None:
        event.quantity_completed = event.quantity


def _outcome_notes(outcome, reason, notes):
    label = OUTCOME_LABELS[outcome]
    reason_label = REASON_LABELS.get(reason, reason)
    suffix = f': {notes}' if notes else ''
    return f'{label} ({reason_label}){suffix}'


def _upsert_outcome_harvest_record(user_id, plant_id, source_key, outcome, reason, outcome_date, notes, planted_item_id=None):
    existing = HarvestRecord.query.filter_by(
        user_id=user_id,
        source_key=source_key,
    ).first()
    record = existing or HarvestRecord(
        user_id=user_id,
        plant_id=plant_id,
        source_key=source_key,
    )

    record.plant_id = plant_id
    record.planted_item_id = planted_item_id
    record.harvest_date = outcome_date
    record.quantity = 0
    record.unit = 'count'
    record.quality = 'poor'
    record.notes = _outcome_notes(outcome, reason, notes)
    record.outcome = outcome
    record.outcome_reason = reason
    record.yield_excluded = True

    if existing is None:
        db.session.add(record)
    return record


def mark_planted_item_outcome(item, outcome, reason, outcome_date, notes=None):
    outcome, reason = validate_outcome(outcome, reason)
    if item.cancelled_at is not None:
        raise PlantOutcomeError('Cannot record an outcome for a cancelled planted item', status_code=409)
    if item.cleared_at is not None:
        raise PlantOutcomeError('Cannot record an outcome for a cleared planted item', status_code=409)
    if item.status == 'harvested':
        raise PlantOutcomeError('Cannot record a failure outcome for a harvested planted item', status_code=409)

    _set_item_outcome_fields(item, outcome, reason, outcome_date, notes)

    event = matching_planting_event_for_item(item)
    if event is not None:
        _set_event_outcome_fields(event, outcome, reason, outcome_date, notes)

    record = None
    if outcome in YIELD_EXCLUDED_OUTCOMES:
        record = _upsert_outcome_harvest_record(
            user_id=item.user_id,
            plant_id=item.plant_id,
            planted_item_id=item.id,
            source_key=_source_key_for_planted_item_outcome(item.id),
            outcome=outcome,
            reason=reason,
            outcome_date=outcome_date,
            notes=notes,
        )

    return {
        'plantedItem': item,
        'plantingEvent': event,
        'harvestRecord': record,
    }


def _validate_bulk_planted_item_outcome_item(item):
    if item.cancelled_at is not None:
        raise PlantOutcomeError('Cannot record an outcome for a cancelled planted item', status_code=409)
    if item.cleared_at is not None:
        raise PlantOutcomeError('Cannot record an outcome for a cleared planted item', status_code=409)
    if item.status in TERMINAL_OUTCOMES or item.outcome is not None:
        raise PlantOutcomeError('Cannot record an outcome for an item that already has a terminal outcome', status_code=409)
    if item.status == 'harvested':
        raise PlantOutcomeError('Cannot record a failure outcome for a harvested planted item', status_code=409)
    if item.save_for_seed:
        raise PlantOutcomeError('Cannot record a failure outcome for an item saved for seed', status_code=409)
    if item.seeds_collected:
        raise PlantOutcomeError('Cannot record a failure outcome for an item with collected seeds', status_code=409)


def mark_planted_items_bulk_outcome(items, outcome, reason, outcome_date, notes=None):
    outcome, reason = validate_outcome(outcome, reason)
    if outcome not in YIELD_EXCLUDED_OUTCOMES:
        raise PlantOutcomeError('bulk outcome must be failed or didnt_establish')
    if not items:
        raise PlantOutcomeError('plantedItemIds must be a non-empty list')

    if all(item.outcome == outcome and item.outcome_reason == reason for item in items):
        source_keys_by_item_id = {
            item.id: _source_key_for_planted_item_outcome(item.id)
            for item in items
        }
        records = HarvestRecord.query.filter(
            HarvestRecord.user_id == items[0].user_id,
            HarvestRecord.source_key.in_(source_keys_by_item_id.values()),
        ).all()
        records_by_item_id = {
            record.planted_item_id: record
            for record in records
        }
        if set(records_by_item_id) == set(source_keys_by_item_id):
            return {
                'plantedItems': items,
                'plantingEvents': [],
                'harvestRecords': [
                    records_by_item_id[item.id]
                    for item in items
                ],
            }

    for item in items:
        _validate_bulk_planted_item_outcome_item(item)

    results = [
        mark_planted_item_outcome(
            item,
            outcome=outcome,
            reason=reason,
            outcome_date=outcome_date,
            notes=notes,
        )
        for item in items
    ]

    return {
        'plantedItems': [result['plantedItem'] for result in results],
        'plantingEvents': [
            result['plantingEvent']
            for result in results
            if result['plantingEvent'] is not None
        ],
        'harvestRecords': [
            result['harvestRecord']
            for result in results
            if result['harvestRecord'] is not None
        ],
    }


def mark_planting_event_outcome(event, outcome, reason, outcome_date, notes=None):
    outcome, reason = validate_outcome(outcome, reason)
    if (event.event_type or 'planting') != 'planting':
        raise PlantOutcomeError('Only planting events can receive plant outcomes')
    if event.cancelled_at is not None:
        raise PlantOutcomeError('Cannot record an outcome for a cancelled planting event', status_code=409)
    if not event.plant_id:
        raise PlantOutcomeError('Planting event has no plantId')

    _set_event_outcome_fields(event, outcome, reason, outcome_date, notes)

    records = []
    items = matching_planted_items_for_event(event, include_outcomes=True)
    for item in items:
        _set_item_outcome_fields(item, outcome, reason, outcome_date, notes)
        if outcome in YIELD_EXCLUDED_OUTCOMES:
            records.append(_upsert_outcome_harvest_record(
                user_id=item.user_id,
                plant_id=item.plant_id,
                planted_item_id=item.id,
                source_key=_source_key_for_planted_item_outcome(item.id),
                outcome=outcome,
                reason=reason,
                outcome_date=outcome_date,
                notes=notes,
            ))

    if outcome in YIELD_EXCLUDED_OUTCOMES and not records:
        records.append(_upsert_outcome_harvest_record(
            user_id=event.user_id,
            plant_id=event.plant_id,
            planted_item_id=None,
            source_key=_source_key_for_planting_event_outcome(event.id),
            outcome=outcome,
            reason=reason,
            outcome_date=outcome_date,
            notes=notes,
        ))

    return {
        'plantingEvent': event,
        'plantedItems': items,
        'harvestRecords': records,
    }
