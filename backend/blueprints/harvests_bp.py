"""
Harvest Tracking Blueprint

Routes:
- GET/POST /api/harvests - List and create harvest records
- PUT/DELETE /api/harvests/<id> - Update or delete record
- GET /api/harvests/stats - Get harvest statistics
"""
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from datetime import datetime
from utils.helpers import parse_iso_date

from models import db, HarvestRecord, PlantedItem, PlantingEvent, IndoorSeedStart

harvests_bp = Blueprint('harvests', __name__, url_prefix='/api/harvests')


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
                planted_item.status = 'harvested'
                planted_item.harvest_date = record.harvest_date
                # Also sync to linked PlantingEvent if one exists
                linked_event = PlantingEvent.query.filter_by(
                    garden_bed_id=planted_item.garden_bed_id,
                    plant_id=planted_item.plant_id,
                    position_x=planted_item.position_x,
                    position_y=planted_item.position_y,
                    user_id=current_user.id
                ).first()
                if linked_event:
                    linked_event.completed = True
                    linked_event.quantity_completed = linked_event.quantity
                    # Sync linked IndoorSeedStart
                    seed_start = IndoorSeedStart.query.filter_by(
                        planting_event_id=linked_event.id,
                        user_id=current_user.id
                    ).first()
                    if seed_start and seed_start.status != 'transplanted':
                        seed_start.status = 'transplanted'
                        seed_start.actual_transplant_date = (
                            linked_event.transplant_date or linked_event.direct_seed_date or datetime.now()
                        )

        db.session.commit()
        return jsonify(record.to_dict()), 201

    records = HarvestRecord.query.filter_by(user_id=current_user.id).all()
    return jsonify([record.to_dict() for record in records])


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
