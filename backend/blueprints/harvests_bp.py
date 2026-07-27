"""
Harvest Tracking Blueprint

Routes:
- GET/POST /api/harvests - List and create harvest records
- POST /api/harvests/bulk - Create multiple harvest records sharing a harvest_group_id
- PUT/DELETE /api/harvests/<id> - Update or delete record
- GET /api/harvests/stats - Get harvest statistics
"""
import hashlib
import uuid
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from datetime import datetime
from sqlalchemy.exc import IntegrityError
from utils.helpers import parse_iso_date

from plant_database import get_plant_by_id
from models import db, HarvestRecord, PlantedItem, PlantingEvent, IndoorSeedStart, GardenBed

harvests_bp = Blueprint('harvests', __name__, url_prefix='/api/harvests')


def _parse_int_list(raw_value):
    if not raw_value:
        return []
    ids = []
    seen = set()
    for part in str(raw_value).split(','):
        try:
            value = int(part.strip())
        except (TypeError, ValueError):
            continue
        if value <= 0 or value in seen:
            continue
        seen.add(value)
        ids.append(value)
    return ids


def _plant_label(plant_id):
    plant = get_plant_by_id(plant_id) if plant_id else None
    return plant.get('name') if plant else plant_id


def _client_idempotency_source_key(data):
    raw_key = (
        data.get('idempotencyKey')
        or data.get('idempotency_key')
        or data.get('clientRequestId')
    )
    if raw_key is None:
        return None

    key = str(raw_key).strip()
    if not key:
        return None
    if len(key) > 100:
        raise ValueError('idempotencyKey must be 100 characters or fewer')
    return f'client:{key}'


def _bulk_client_item_source_key(data, planted_item_id):
    client_key = _client_idempotency_source_key(data)
    if not client_key:
        return None
    digest = hashlib.sha1(client_key.encode('utf-8')).hexdigest()
    return f'client_item:{digest}:{planted_item_id}'


def _source_key_for_planted_item(planted_item_id):
    return f'planted_item:{planted_item_id}'


def _source_key_for_planting_event(planting_event_id):
    return f'planting_event:{planting_event_id}'


def _existing_harvest_by_source_key(source_key):
    if not source_key:
        return None
    return HarvestRecord.query.filter_by(
        user_id=current_user.id,
        source_key=source_key,
    ).first()


def _get_owned_planted_item(planted_item_id):
    if planted_item_id is None:
        return None
    return PlantedItem.query.filter_by(
        id=planted_item_id,
        user_id=current_user.id,
    ).first()


def _get_owned_planting_event(planting_event_id):
    if planting_event_id is None:
        return None
    return PlantingEvent.query.filter_by(
        id=planting_event_id,
        user_id=current_user.id,
    ).first()


def _matching_planted_items_for_event(event):
    if (
        event.garden_bed_id is None
        or not event.plant_id
        or event.position_x is None
        or event.position_y is None
    ):
        return []

    return PlantedItem.query.filter(
        PlantedItem.user_id == current_user.id,
        PlantedItem.garden_bed_id == event.garden_bed_id,
        PlantedItem.plant_id == event.plant_id,
        PlantedItem.position_x == event.position_x,
        PlantedItem.position_y == event.position_y,
        PlantedItem.cancelled_at.is_(None),
        PlantedItem.cleared_at.is_(None),
        PlantedItem.outcome.is_(None),
        PlantedItem.status != 'harvested',
    ).all()


def _ready_harvest_task_from_event(event):
    if (event.event_type or 'planting') != 'planting' or not event.plant_id:
        return None
    if event.cleared_at is not None:
        return None

    bed = None
    if event.garden_bed_id is not None:
        bed = GardenBed.query.filter_by(
            id=event.garden_bed_id,
            user_id=current_user.id,
        ).first()

    planted_items = _matching_planted_items_for_event(event)
    planted_item_ids = [item.id for item in planted_items]
    existing_record_ids = []
    if planted_item_ids:
        existing_record_ids = [
            record.id
            for record in HarvestRecord.query.filter(
                HarvestRecord.user_id == current_user.id,
                HarvestRecord.planted_item_id.in_(planted_item_ids),
            ).all()
        ]

    return {
        'plantingEventId': event.id,
        'plantId': event.plant_id,
        'plantName': _plant_label(event.plant_id),
        'variety': event.variety,
        'bedId': bed.id if bed else event.garden_bed_id,
        'bedName': bed.name if bed else None,
        'expectedHarvestDate': event.expected_harvest_date.isoformat() if event.expected_harvest_date else None,
        'quantity': event.quantity,
        'position': (
            {'x': event.position_x, 'y': event.position_y}
            if event.position_x is not None and event.position_y is not None
            else None
        ),
        'harvestCompleted': bool(event.harvest_completed),
        'existingHarvestRecordIds': existing_record_ids,
        'plantedItems': [
            {
                'id': item.id,
                'quantity': item.quantity,
                'status': item.status,
                'position': {'x': item.position_x, 'y': item.position_y},
            }
            for item in planted_items
        ],
    }


def _sync_planted_item_to_harvested(planted_item, harvest_date, clear_from_bed=False):
    """Apply the cross-model harvest sync for a single PlantedItem.

    Caller must ensure planted_item.user_id == current_user.id. Mirrors the
    sync block that has lived in the single-item POST since Feb 2026 and lets
    the bulk endpoint reuse the same behavior.
    """
    planted_item.status = 'harvested'
    planted_item.harvest_date = harvest_date
    if clear_from_bed and planted_item.cleared_at is None:
        planted_item.cleared_at = harvest_date or datetime.now()
    linked_event = PlantingEvent.query.filter_by(
        garden_bed_id=planted_item.garden_bed_id,
        plant_id=planted_item.plant_id,
        position_x=planted_item.position_x,
        position_y=planted_item.position_y,
        user_id=current_user.id
    ).first()
    if linked_event:
        linked_event.completed = True
        linked_event.harvest_completed = True
        linked_event.actual_harvest_date = harvest_date
        linked_event.quantity_completed = linked_event.quantity
        if clear_from_bed and linked_event.cleared_at is None:
            linked_event.cleared_at = harvest_date or datetime.now()
        seed_start = IndoorSeedStart.query.filter_by(
            planting_event_id=linked_event.id,
            user_id=current_user.id
        ).first()
        if seed_start and seed_start.status != 'transplanted':
            seed_start.status = 'transplanted'
            seed_start.actual_transplant_date = (
                linked_event.transplant_date or linked_event.direct_seed_date or datetime.now()
            )


@harvests_bp.route('', methods=['GET', 'POST'])
@login_required
def api_harvests():
    """Get all harvest records or create new one"""
    if request.method == 'POST':
        data = request.json or {}
        raw = data.get('harvestDate')
        planted_item_id = data.get('plantedItemId')
        planting_event_id = data.get('plantingEventId')
        final_harvest = bool(data.get('finalHarvest') or data.get('final_harvest'))

        planted_item = None
        planting_event = None
        if planted_item_id is not None:
            planted_item = _get_owned_planted_item(planted_item_id)
            if planted_item is None:
                return jsonify({'error': 'plantedItemId is invalid or not owned by user'}), 403
            if planted_item.cancelled_at is not None or planted_item.outcome is not None:
                return jsonify({'error': 'Cannot harvest a cancelled or terminal-outcome planted item'}), 409
            if planted_item.cleared_at is not None:
                return jsonify({'error': 'Cannot harvest a planted item that has already been cleared'}), 409
            try:
                source_key = _client_idempotency_source_key(data)
            except ValueError as exc:
                return jsonify({'error': str(exc)}), 400
        elif planting_event_id is not None:
            planting_event = _get_owned_planting_event(planting_event_id)
            if planting_event is None:
                return jsonify({'error': 'plantingEventId is invalid or not owned by user'}), 403
            source_key = _source_key_for_planting_event(planting_event.id)
        else:
            try:
                source_key = _client_idempotency_source_key(data)
            except ValueError as exc:
                return jsonify({'error': str(exc)}), 400

        existing = _existing_harvest_by_source_key(source_key)
        if existing is not None:
            if planted_item is not None and final_harvest:
                _sync_planted_item_to_harvested(
                    planted_item,
                    existing.harvest_date,
                    clear_from_bed=True,
                )
                db.session.commit()
            payload = existing.to_dict()
            payload['harvestRecord'] = existing.to_dict()
            if planted_item is not None:
                payload['plantedItem'] = planted_item.to_dict()
            return jsonify(payload), 200

        record = HarvestRecord(
            user_id=current_user.id,
            plant_id=data['plantId'],
            planted_item_id=planted_item.id if planted_item else None,
            source_key=source_key,
            harvest_date=parse_iso_date(raw) if raw else datetime.now(),
            quantity=data['quantity'],
            unit=data.get('unit', 'lbs'),
            quality=data.get('quality', 'good'),
            notes=data.get('notes', '')
        )
        db.session.add(record)

        # A normal harvest records yield only. Final harvest closes the
        # planting, preserves the HarvestRecord link, and frees bed occupancy.
        if planted_item is not None and final_harvest:
            _sync_planted_item_to_harvested(
                planted_item,
                record.harvest_date,
                clear_from_bed=True,
            )
        if planting_event is not None:
            planting_event.completed = True
            planting_event.harvest_completed = True
            planting_event.actual_harvest_date = record.harvest_date
            if planting_event.quantity is not None:
                planting_event.quantity_completed = planting_event.quantity

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            existing = _existing_harvest_by_source_key(source_key)
            if existing is not None:
                payload = existing.to_dict()
                payload['harvestRecord'] = existing.to_dict()
                if planted_item is not None:
                    payload['plantedItem'] = planted_item.to_dict()
                return jsonify(payload), 200
            raise
        payload = record.to_dict()
        payload['harvestRecord'] = record.to_dict()
        if planted_item is not None:
            payload['plantedItem'] = planted_item.to_dict()
        return jsonify(payload), 201

    records = HarvestRecord.query.filter_by(user_id=current_user.id).all()
    return jsonify([record.to_dict() for record in records])


@harvests_bp.route('/bulk', methods=['POST'])
@login_required
def api_harvests_bulk():
    """Create multiple harvest records sharing a harvest_group_id.

    Splits totalQuantity evenly across the supplied plantedItemIds. Every
    PlantedItem must belong to the current user; if any are missing or
    foreign, the request is rejected. Normal harvest records yield only;
    finalHarvest=True closes the supplied planted items and frees their cells.
    """
    data = request.json or {}
    planted_item_ids = data.get('plantedItemIds') or []
    if not isinstance(planted_item_ids, list) or len(planted_item_ids) == 0:
        return jsonify({'error': 'plantedItemIds must be a non-empty list'}), 400
    if len(set(planted_item_ids)) != len(planted_item_ids):
        return jsonify({'error': 'plantedItemIds must not contain duplicates'}), 400

    total_quantity = data.get('totalQuantity')
    if total_quantity is None or total_quantity <= 0:
        return jsonify({'error': 'totalQuantity must be greater than 0'}), 400

    raw_date = data.get('harvestDate')
    harvest_date = parse_iso_date(raw_date) if raw_date else datetime.now()
    final_harvest = bool(data.get('finalHarvest') or data.get('final_harvest'))

    items = PlantedItem.query.filter(
        PlantedItem.id.in_(planted_item_ids),
        PlantedItem.user_id == current_user.id,
    ).all()
    if len(items) != len(set(planted_item_ids)):
        return jsonify({'error': 'One or more plantedItemIds are invalid or not owned by user'}), 403
    if any(item.cancelled_at is not None or item.outcome is not None for item in items):
        return jsonify({'error': 'Cannot harvest cancelled or terminal-outcome planted items'}), 409
    if any(item.cleared_at is not None for item in items):
        return jsonify({'error': 'Cannot harvest planted items that have already been cleared'}), 409

    try:
        source_keys_by_item_id = {
            item.id: _bulk_client_item_source_key(data, item.id)
            for item in items
        }
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    source_keys = [key for key in source_keys_by_item_id.values() if key]
    existing_records = []
    if source_keys:
        existing_records = HarvestRecord.query.filter(
            HarvestRecord.user_id == current_user.id,
            HarvestRecord.source_key.in_(source_keys),
        ).all()
    if existing_records:
        existing_by_item_id = {
            record.planted_item_id: record
            for record in existing_records
        }
        if len(existing_by_item_id) == len(items):
            group_ids = {record.harvest_group_id for record in existing_records}
            if len(group_ids) == 1 and next(iter(group_ids)) is not None:
                group_id = next(iter(group_ids))
                ordered_records = [
                    existing_by_item_id[item.id]
                    for item in items
                ]
                if final_harvest:
                    for item in items:
                        record = existing_by_item_id[item.id]
                        _sync_planted_item_to_harvested(
                            item,
                            record.harvest_date,
                            clear_from_bed=True,
                        )
                    db.session.commit()
                return jsonify({
                    'harvestGroupId': group_id,
                    'records': [r.to_dict() for r in ordered_records],
                    'plantedItems': [item.to_dict() for item in items],
                }), 200
        return jsonify({
            'error': 'One or more plantedItemIds already have harvest records for this request',
        }), 409

    # Resolve plant id from the first item if not supplied (all items in a
    # bulk harvest are expected to share the same plantId, but we don't
    # enforce it server-side — mixed-plant bulks are still valid as long as
    # the caller passes plantId explicitly per record's intended grouping).
    plant_id = data.get('plantId') or items[0].plant_id
    unit = data.get('unit', 'lbs')
    quality = data.get('quality', 'good')
    notes = data.get('notes') or ''
    group_id = str(uuid.uuid4())
    per_item_qty = float(total_quantity) / len(items)

    created = []
    for item in items:
        record = HarvestRecord(
            user_id=current_user.id,
            plant_id=plant_id,
            planted_item_id=item.id,
            source_key=source_keys_by_item_id[item.id],
            harvest_date=harvest_date,
            quantity=per_item_qty,
            unit=unit,
            quality=quality,
            notes=notes,
            harvest_group_id=group_id,
        )
        db.session.add(record)
        if final_harvest:
            _sync_planted_item_to_harvested(
                item,
                harvest_date,
                clear_from_bed=True,
            )
        created.append(record)

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        existing_records = []
        if source_keys:
            existing_records = HarvestRecord.query.filter(
                HarvestRecord.user_id == current_user.id,
                HarvestRecord.source_key.in_(source_keys),
            ).all()
        if len(existing_records) == len(items):
            group_ids = {record.harvest_group_id for record in existing_records}
            if len(group_ids) == 1 and next(iter(group_ids)) is not None:
                group_id = next(iter(group_ids))
                existing_by_item_id = {
                    record.planted_item_id: record
                    for record in existing_records
                }
                return jsonify({
                    'harvestGroupId': group_id,
                    'records': [existing_by_item_id[item.id].to_dict() for item in items],
                    'plantedItems': [item.to_dict() for item in items],
                }), 200
        raise
    return jsonify({
        'harvestGroupId': group_id,
        'records': [r.to_dict() for r in created],
        'plantedItems': [item.to_dict() for item in items],
    }), 201


@harvests_bp.route('/ready', methods=['GET'])
@login_required
def ready_harvests():
    """Resolve dashboard harvest-ready PlantingEvents into loggable context."""
    event_ids = _parse_int_list(request.args.get('plantingEventIds') or request.args.get('eventIds'))
    if not event_ids:
        return jsonify({'error': 'plantingEventIds is required'}), 400

    events = PlantingEvent.query.filter(
        PlantingEvent.user_id == current_user.id,
        PlantingEvent.id.in_(event_ids),
        PlantingEvent.cancelled_at.is_(None),
        PlantingEvent.cleared_at.is_(None),
        PlantingEvent.outcome.is_(None),
    ).all()
    event_by_id = {event.id: event for event in events}
    tasks = []
    for event_id in event_ids:
        event = event_by_id.get(event_id)
        if not event:
            continue
        task = _ready_harvest_task_from_event(event)
        if task is not None:
            tasks.append(task)

    if not tasks:
        return jsonify({'error': 'No harvest-ready planting events found'}), 404

    return jsonify({'tasks': tasks})


@harvests_bp.route('/ready/<int:event_id>', methods=['GET'])
@login_required
def ready_harvest(event_id):
    """Resolve one dashboard harvest-ready PlantingEvent into loggable context."""
    event = PlantingEvent.query.filter(
        PlantingEvent.id == event_id,
        PlantingEvent.user_id == current_user.id,
        PlantingEvent.cancelled_at.is_(None),
        PlantingEvent.cleared_at.is_(None),
        PlantingEvent.outcome.is_(None),
    ).first()
    if event is None:
        return jsonify({'error': 'No harvest-ready planting event found'}), 404
    task = _ready_harvest_task_from_event(event)
    if task is None:
        return jsonify({'error': 'No harvest-ready planting event found'}), 404
    return jsonify(task)


@harvests_bp.route('/<int:record_id>', methods=['PUT', 'DELETE'])
@login_required
def harvest_record(record_id):
    """Update or delete a harvest record"""
    record = HarvestRecord.query.get_or_404(record_id)

    # Verify ownership
    if record.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    if request.method == 'DELETE':
        db.session.delete(record)
        db.session.commit()
        return '', 204

    # PUT method - update harvest
    data = request.json

    # Update fields if present in request
    if 'plantId' in data:
        record.plant_id = data['plantId']

    if 'harvestDate' in data:
        record.harvest_date = parse_iso_date(data['harvestDate'])

    if 'quantity' in data:
        record.quantity = data['quantity']

    if 'unit' in data:
        record.unit = data['unit']

    if 'quality' in data:
        record.quality = data['quality']

    if 'notes' in data:
        record.notes = data['notes']

    db.session.commit()
    return jsonify({'message': 'Harvest updated successfully', 'id': record.id})


@harvests_bp.route('/stats', methods=['GET'])
@login_required
def harvest_stats():
    """Get harvest statistics"""
    records = HarvestRecord.query.filter_by(
        user_id=current_user.id,
        yield_excluded=False,
    ).all()
    stats = {}
    for record in records:
        if record.plant_id not in stats:
            stats[record.plant_id] = {'total': 0, 'count': 0, 'unit': record.unit}
        stats[record.plant_id]['total'] += record.quantity
        stats[record.plant_id]['count'] += 1
    return jsonify(stats)
