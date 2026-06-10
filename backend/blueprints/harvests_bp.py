"""
Harvest Tracking Blueprint

Routes:
- GET/POST /api/harvests - List and create harvest records
- POST /api/harvests/bulk - Create multiple harvest records sharing a harvest_group_id
- PUT/DELETE /api/harvests/<id> - Update or delete record
- GET /api/harvests/stats - Get harvest statistics
"""
import uuid
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from datetime import datetime
from utils.helpers import parse_iso_date

from models import db, HarvestRecord, PlantedItem, PlantingEvent, IndoorSeedStart

harvests_bp = Blueprint('harvests', __name__, url_prefix='/api/harvests')


def _sync_planted_item_to_harvested(planted_item, harvest_date):
    """Apply the cross-model harvest sync for a single PlantedItem.

    Caller must ensure planted_item.user_id == current_user.id. Mirrors the
    sync block that has lived in the single-item POST since Feb 2026 and lets
    the bulk endpoint reuse the same behavior.
    """
    planted_item.status = 'harvested'
    planted_item.harvest_date = harvest_date
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
        data = request.json
        raw = data.get('harvestDate')
        record = HarvestRecord(
            user_id=current_user.id,
            plant_id=data['plantId'],
            planted_item_id=data.get('plantedItemId'),
            harvest_date=parse_iso_date(raw) if raw else datetime.now(),
            quantity=data['quantity'],
            unit=data.get('unit', 'lbs'),
            quality=data.get('quality', 'good'),
            notes=data.get('notes', '')
        )
        db.session.add(record)

        # Sync harvest status to linked PlantedItem and PlantingEvent
        if record.planted_item_id:
            planted_item = PlantedItem.query.get(record.planted_item_id)
            if planted_item and planted_item.user_id == current_user.id:
                _sync_planted_item_to_harvested(planted_item, record.harvest_date)

        db.session.commit()
        return jsonify(record.to_dict()), 201

    records = HarvestRecord.query.filter_by(user_id=current_user.id).all()
    return jsonify([record.to_dict() for record in records])


@harvests_bp.route('/bulk', methods=['POST'])
@login_required
def api_harvests_bulk():
    """Create multiple harvest records sharing a harvest_group_id.

    Splits totalQuantity evenly across the supplied plantedItemIds. Every
    PlantedItem must belong to the current user; if any are missing or
    foreign, the request is rejected. Each created record triggers the
    same cross-model sync as the single-item endpoint.
    """
    data = request.json or {}
    planted_item_ids = data.get('plantedItemIds') or []
    if not isinstance(planted_item_ids, list) or len(planted_item_ids) == 0:
        return jsonify({'error': 'plantedItemIds must be a non-empty list'}), 400

    total_quantity = data.get('totalQuantity')
    if total_quantity is None or total_quantity <= 0:
        return jsonify({'error': 'totalQuantity must be greater than 0'}), 400

    raw_date = data.get('harvestDate')
    harvest_date = parse_iso_date(raw_date) if raw_date else datetime.now()

    items = PlantedItem.query.filter(
        PlantedItem.id.in_(planted_item_ids),
        PlantedItem.user_id == current_user.id,
    ).all()
    if len(items) != len(set(planted_item_ids)):
        return jsonify({'error': 'One or more plantedItemIds are invalid or not owned by user'}), 403

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
            harvest_date=harvest_date,
            quantity=per_item_qty,
            unit=unit,
            quality=quality,
            notes=notes,
            harvest_group_id=group_id,
        )
        db.session.add(record)
        _sync_planted_item_to_harvested(item, harvest_date)
        created.append(record)

    db.session.commit()
    return jsonify({
        'harvestGroupId': group_id,
        'records': [r.to_dict() for r in created],
    }), 201


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
    records = HarvestRecord.query.filter_by(user_id=current_user.id).all()
    stats = {}
    for record in records:
        if record.plant_id not in stats:
            stats[record.plant_id] = {'total': 0, 'count': 0, 'unit': record.unit}
        stats[record.plant_id]['total'] += record.quantity
        stats[record.plant_id]['count'] += 1
    return jsonify(stats)
