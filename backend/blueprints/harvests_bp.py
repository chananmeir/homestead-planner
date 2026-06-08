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
from services.maturity_learning import (
    refresh_from_harvest, recompute_key, bed_is_covered, bed_sun_exposure, naive,
)

harvests_bp = Blueprint('harvests', __name__, url_prefix='/api/harvests')


def _compute_maturity_snapshot(planted_item, harvest_date):
    """Snapshot the maturity-learning signal off a PlantedItem + its bed at log time.

    Returns (days_in_ground, base_date, sun_exposure, covered, bed_id). Base date is
    ``transplant_date or planted_date`` (matches the frontend badge and DB DTM, which is
    measured from transplant). sun_exposure is coalesced to 'unknown' so an exact learned
    bucket never collides with the variety-wide aggregate (NULL) row.
    """
    base_date = planted_item.transplant_date or planted_item.planted_date
    days_in_ground = None
    if base_date is not None and harvest_date is not None:
        days_in_ground = (naive(harvest_date) - naive(base_date)).days
    bed = planted_item.garden_bed
    sun_exposure = bed_sun_exposure(bed)
    covered = bed_is_covered(bed)
    bed_id = bed.id if bed is not None else planted_item.garden_bed_id
    return days_in_ground, base_date, sun_exposure, covered, bed_id


def _apply_maturity_snapshot(record, planted_item, data):
    """Populate the maturity snapshot fields on a (bed-linked) harvest record."""
    harvest_date = record.harvest_date
    days_in_ground, base_date, sun_exposure, covered, bed_id = _compute_maturity_snapshot(
        planted_item, harvest_date
    )
    # 'on_time' is the implicit default for a normal harvest; the frontend sends an
    # explicit null when the reason is non-DTM (pest/disease/weather), in which case
    # the row records outcome_reason but does not move the learned DTM.
    record.maturity_feedback = data.get('maturityFeedback', 'on_time')
    record.outcome_reason = data.get('outcomeReason')
    record.days_in_ground = days_in_ground
    record.planted_date_snapshot = base_date
    record.variety_snapshot = planted_item.variety
    record.sun_exposure_snapshot = sun_exposure
    record.covered_snapshot = covered
    record.garden_bed_id_snapshot = bed_id


def _snapshot_key(record):
    """The (user, plant, variety, sun, covered) recompute key carried by a record."""
    return (
        record.user_id,
        record.plant_id,
        record.variety_snapshot,
        record.sun_exposure_snapshot,
        record.covered_snapshot,
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
                # Capture the maturity-learning snapshot off the planting + its bed.
                _apply_maturity_snapshot(record, planted_item, data)
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

        # Recompute learned DTM once the snapshot is persisted.
        if record.sun_exposure_snapshot is not None or record.covered_snapshot is not None:
            refresh_from_harvest(record)
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
        # Capture the snapshot key before deleting so we can recompute the buckets
        # the record contributed to (with the record now excluded).
        had_signal = record.sun_exposure_snapshot is not None or record.covered_snapshot is not None
        key = _snapshot_key(record)
        db.session.delete(record)
        db.session.commit()
        if had_signal:
            user_id, plant_id, variety, sun, covered = key
            recompute_key(user_id, plant_id, variety, sun, covered)
            recompute_key(user_id, plant_id, variety, None, None)
            db.session.commit()
        return '', 204

    # PUT method - update harvest
    data = request.json

    # Track whether the learning signal could have moved.
    old_feedback = record.maturity_feedback
    old_harvest_date = record.harvest_date

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

    if 'maturityFeedback' in data:
        record.maturity_feedback = data['maturityFeedback']

    if 'outcomeReason' in data:
        record.outcome_reason = data['outcomeReason']

    # If the harvest date moved on a bed-linked record, re-snapshot days_in_ground
    # off the (still-linked) planting so the learned value reflects the new date.
    feedback_changed = 'maturityFeedback' in data and data['maturityFeedback'] != old_feedback
    date_changed = record.harvest_date != old_harvest_date
    if date_changed and record.planted_item_id and record.planted_date_snapshot is not None:
        if record.harvest_date is not None:
            record.days_in_ground = (
                naive(record.harvest_date) - naive(record.planted_date_snapshot)
            ).days

    db.session.commit()

    # Recompute learned DTM when the signal could have changed.
    had_signal = record.sun_exposure_snapshot is not None or record.covered_snapshot is not None
    if had_signal and (feedback_changed or date_changed):
        refresh_from_harvest(record)
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
