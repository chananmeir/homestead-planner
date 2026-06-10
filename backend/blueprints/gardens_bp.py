"""
Gardens Blueprint

Routes for garden beds, planted items, and planting events.
This blueprint handles all CRUD operations for garden-related entities.
"""
import json
import logging
import math
import os
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from sqlalchemy import or_, and_, cast

from models import (
    db, GardenBed, PlantedItem, PlantingEvent, IndoorSeedStart, GardenPlanItem,
    GardenPlan, SeedInventory, Photo, HarvestRecord, PlacedStructure,
    TrellisStructure,
)
from sqlalchemy import func as sa_func
from plant_database import get_plant_by_id
from blueprints.garden_planner_bp import _adjust_auto_plan_item
from garden_methods import GARDEN_METHODS
from conflict_checker import has_conflict, validate_planting_conflict, get_primary_planting_date, query_candidate_items
from services.space_calculator import calculate_space_requirement
from services.garden_planner_service import _calculate_seeds_needed
from simulation_clock import get_now, get_utc_now
from utils.constants import VALID_SUN_EXPOSURES


def _sync_indoor_start_on_completion(event):
    """Sync linked IndoorSeedStart to 'transplanted' when PlantingEvent is completed.

    When a PlantingEvent is marked complete via any path (batch placement, PUT,
    bulk update, harvest), the linked IndoorSeedStart should reflect that the
    transplant happened.  Without this, the indoor-starts page shows the entry
    as overdue even though the calendar event is done.
    """
    if not event.completed:
        return
    seed_start = IndoorSeedStart.query.filter_by(
        planting_event_id=event.id,
        user_id=event.user_id
    ).first()
    if seed_start and seed_start.status != 'transplanted':
        seed_start.status = 'transplanted'
        seed_start.actual_transplant_date = (
            event.transplant_date or event.direct_seed_date or datetime.utcnow()
        )
from utils.helpers import parse_iso_date


def _parse_plan_item_id_from_export_key(export_key):
    """Parse GardenPlanItem.id out of a PlantingEvent.export_key string.

    Export keys are built in ``services/garden_planner_service.py`` with the
    shape ``"{user_id}_{item.id}_..."`` across every export path (legacy,
    bed-allocated, trellis). The second underscore-delimited component is
    always the plan-item id.

    Returns the integer plan-item id, or ``None`` if the key is missing or
    malformed (e.g., events created outside ``export_to_calendar()``).
    """
    if not export_key:
        return None
    parts = export_key.split('_')
    if len(parts) < 2:
        return None
    try:
        return int(parts[1])
    except (ValueError, TypeError):
        return None


def _delete_planting_events(events, user_id):
    """Hard-delete planting events and records that directly hang from them."""
    event_ids = [event.id for event in events]
    if not event_ids:
        return {
            'deleted': 0,
            'deletedEventIds': [],
            'deletedIndoorSeedStarts': 0,
            'deletedAutoPlanItems': 0,
            'planItemsReset': 0,
        }

    plan_item_ids_affected = set()
    for event in events:
        plan_item_id = _parse_plan_item_id_from_export_key(event.export_key)
        if plan_item_id is not None:
            plan_item_ids_affected.add(plan_item_id)

    seed_starts = IndoorSeedStart.query.filter(
        IndoorSeedStart.planting_event_id.in_(event_ids),
        IndoorSeedStart.user_id == user_id
    ).all()
    seed_start_ids = [seed_start.id for seed_start in seed_starts]

    deleted_auto_plan_items = 0
    if seed_start_ids:
        auto_plan_items = (
            GardenPlanItem.query
            .join(GardenPlan, GardenPlanItem.garden_plan_id == GardenPlan.id)
            .filter(
                GardenPlanItem.indoor_seed_start_id.in_(seed_start_ids),
                GardenPlanItem.source == 'indoor-seed-start',
                GardenPlan.user_id == user_id,
            )
            .all()
        )
        deleted_auto_plan_items = len(auto_plan_items)
        for item in auto_plan_items:
            db.session.delete(item)

    for seed_start in seed_starts:
        db.session.delete(seed_start)

    for event in events:
        db.session.delete(event)

    db.session.flush()

    plan_items_reset = 0
    for plan_item_id in plan_item_ids_affected:
        remaining = PlantingEvent.query.filter(
            PlantingEvent.export_key.like(f"{user_id}_{plan_item_id}_%"),
            PlantingEvent.user_id == user_id
        ).count()
        if remaining == 0:
            plan_item = (
                GardenPlanItem.query
                .join(GardenPlan, GardenPlanItem.garden_plan_id == GardenPlan.id)
                .filter(
                    GardenPlanItem.id == plan_item_id,
                    GardenPlan.user_id == user_id,
                )
                .first()
            )
            if plan_item and plan_item.status == 'exported':
                plan_item.status = 'planned'
                plan_items_reset += 1

    return {
        'deleted': len(event_ids),
        'deletedEventIds': event_ids,
        'deletedIndoorSeedStarts': len(seed_starts),
        'deletedAutoPlanItems': deleted_auto_plan_items,
        'planItemsReset': plan_items_reset,
    }


def _delete_indoor_seed_starts(seed_starts, user_id):
    """Hard-delete indoor seed starts and records directly created from them."""
    seed_start_ids = [seed_start.id for seed_start in seed_starts]
    if not seed_start_ids:
        return {
            'deletedSeedStarts': 0,
            'deletedSeedStartIds': [],
            'deletedPlantedItems': 0,
            'deletedPlantingEvents': 0,
            'deletedLinkedEventIds': [],
            'deletedPlanItems': 0,
        }

    linked_plan_items = (
        GardenPlanItem.query
        .join(GardenPlan, GardenPlanItem.garden_plan_id == GardenPlan.id)
        .filter(
            GardenPlanItem.indoor_seed_start_id.in_(seed_start_ids),
            GardenPlan.user_id == user_id,
        )
        .all()
    )
    plan_item_ids = [item.id for item in linked_plan_items]

    deleted_planted_items = 0
    if plan_item_ids:
        planted_items = PlantedItem.query.filter(
            PlantedItem.source_plan_item_id.in_(plan_item_ids),
            PlantedItem.user_id == user_id,
        ).all()
        deleted_planted_items = len(planted_items)
        for planted_item in planted_items:
            db.session.delete(planted_item)

    linked_event_ids = [
        seed_start.planting_event_id
        for seed_start in seed_starts
        if seed_start.planting_event_id is not None
    ]
    linked_events = []
    if linked_event_ids:
        linked_events = PlantingEvent.query.filter(
            PlantingEvent.id.in_(linked_event_ids),
            PlantingEvent.user_id == user_id,
        ).all()
        for event in linked_events:
            db.session.delete(event)

    for item in linked_plan_items:
        db.session.delete(item)

    for seed_start in seed_starts:
        db.session.delete(seed_start)

    return {
        'deletedSeedStarts': len(seed_start_ids),
        'deletedSeedStartIds': seed_start_ids,
        'deletedPlantedItems': deleted_planted_items,
        'deletedPlantingEvents': len(linked_events),
        'deletedLinkedEventIds': [event.id for event in linked_events],
        'deletedPlanItems': len(linked_plan_items),
    }


def _event_has_existing_bed_assignment(event, user_id):
    if event.garden_bed_id is None:
        return False
    return GardenBed.query.filter_by(
        id=event.garden_bed_id,
        user_id=user_id
    ).first() is not None


def _event_has_planned_placement(event, user_id):
    return (
        event is not None
        and _event_has_existing_bed_assignment(event, user_id)
        and event.position_x is not None
        and event.position_y is not None
    )


def _get_seed_start_linked_event(seed_start, user_id):
    if seed_start.planting_event_id is None:
        return None
    return PlantingEvent.query.filter_by(
        id=seed_start.planting_event_id,
        user_id=user_id
    ).first()


def _find_existing_indoor_seed_start(user_id, planting_event, window_days=14):
    """Find an existing IndoorSeedStart that matches this placement.

    Returns an active (non-cancelled, non-transplanted) IndoorSeedStart for the
    same user + plant + variety whose expected_transplant_date is within
    +/- window_days of the new PlantingEvent's transplant_date. Prefers
    candidates that are NOT yet linked to a PlantingEvent, then the closest
    date match.

    Used by placement paths so that dragging a plant onto the designer
    advances an existing imported/manual indoor start instead of duplicating it.
    """
    transplant_date = planting_event.transplant_date
    if not transplant_date:
        return None

    date_min = transplant_date - timedelta(days=window_days)
    date_max = transplant_date + timedelta(days=window_days)

    if planting_event.variety is None:
        variety_filter = IndoorSeedStart.variety.is_(None)
    else:
        variety_filter = IndoorSeedStart.variety == planting_event.variety

    candidates = IndoorSeedStart.query.filter(
        IndoorSeedStart.user_id == user_id,
        IndoorSeedStart.plant_id == planting_event.plant_id,
        variety_filter,
        IndoorSeedStart.cancelled_at.is_(None),
        IndoorSeedStart.status != 'transplanted',
        IndoorSeedStart.expected_transplant_date.isnot(None),
        IndoorSeedStart.expected_transplant_date.between(date_min, date_max),
    ).all()

    candidates = [
        candidate for candidate in candidates
        if not _event_has_planned_placement(
            _get_seed_start_linked_event(candidate, user_id),
            user_id
        )
    ]

    if not candidates:
        return None

    # Prefer unlinked candidates (no planting_event_id yet); among those,
    # prefer the one whose expected_transplant_date is closest to ours.
    def _sort_key(ss):
        already_linked = 1 if ss.planting_event_id is not None else 0
        delta = abs((ss.expected_transplant_date - transplant_date).days)
        return (already_linked, delta, ss.id)

    candidates.sort(key=_sort_key)
    return candidates[0]


def _link_existing_indoor_seed_start(seed_start, planting_event):
    """Link an existing IndoorSeedStart to the newly-placed PlantingEvent and
    advance its status to 'transplanted'.

    Mirrors the bookkeeping done by the /transplant endpoint, but without
    creating a new PlantingEvent — the designer placement already created one.
    """
    seed_start.planting_event_id = planting_event.id
    seed_start.status = 'transplanted'
    if seed_start.actual_transplant_date is None:
        seed_start.actual_transplant_date = (
            planting_event.transplant_date
            or planting_event.direct_seed_date
            or datetime.utcnow()
        )
    # Propagate seed_start_date onto the PlantingEvent so the timeline
    # reflects the real indoor-start date (mirrors the auto-create path).
    if seed_start.start_date and not planting_event.seed_start_date:
        planting_event.seed_start_date = seed_start.start_date

    logging.info(
        f"[LINK-SEED-START] Linked existing IndoorSeedStart #{seed_start.id} "
        f"to PlantingEvent #{planting_event.id} "
        f"({planting_event.plant_id}, variety={planting_event.variety}); "
        f"status -> transplanted"
    )


def _link_planned_indoor_seed_start(seed_start, planting_event):
    """Record the bed-cell placement without marking the start transplanted."""
    seed_start.planting_event_id = planting_event.id
    if seed_start.start_date and not planting_event.seed_start_date:
        planting_event.seed_start_date = seed_start.start_date

    logging.info(
        f"[PLAN-SEED-START] Linked IndoorSeedStart #{seed_start.id} "
        f"to planned PlantingEvent #{planting_event.id} "
        f"({planting_event.plant_id}, variety={planting_event.variety}); "
        f"status preserved as {seed_start.status}"
    )


def _resolve_source_indoor_seed_start(data, user_id):
    """Validate optional sourceIndoorSeedStartId/action from designer placement.

    action='transplant' preserves the existing behavior: link the seed start to
    the new placement and mark it transplanted. action='plan' records the
    chosen future garden cell while preserving the seed start's current status.
    """
    source_indoor_seed_start_id = data.get('sourceIndoorSeedStartId')
    source_indoor_seed_start_action = data.get('sourceIndoorSeedStartAction', 'transplant')

    if source_indoor_seed_start_action not in ('transplant', 'plan'):
        return None, None, (
            jsonify({'error': 'sourceIndoorSeedStartAction must be "transplant" or "plan"'}),
            400,
        )

    if source_indoor_seed_start_id is None:
        return None, source_indoor_seed_start_action, None

    if (
        isinstance(source_indoor_seed_start_id, bool)
        or not isinstance(source_indoor_seed_start_id, int)
        or source_indoor_seed_start_id <= 0
    ):
        return None, None, (
            jsonify({'error': 'sourceIndoorSeedStartId must be a positive integer'}),
            400,
        )

    seed_start = IndoorSeedStart.query.get(source_indoor_seed_start_id)
    if not seed_start or seed_start.user_id != user_id:
        return None, None, (jsonify({'error': 'Indoor seed start not found'}), 404)

    if seed_start.status in ('transplanted', 'failed'):
        return None, None, (
            jsonify({
                'error': (
                    f"Indoor seed start is already in status "
                    f"'{seed_start.status}' and cannot be relinked."
                )
            }),
            400,
        )

    if seed_start.cancelled_at is not None:
        return None, None, (
            jsonify({'error': 'Indoor seed start has been cancelled and cannot be relinked.'}),
            400,
        )

    linked_event = _get_seed_start_linked_event(seed_start, user_id)
    if _event_has_planned_placement(linked_event, user_id):
        return None, None, (
            jsonify({
                'error': 'Indoor seed start already has a planned garden placement.'
            }),
            409,
        )

    return seed_start, source_indoor_seed_start_action, None


def _auto_create_indoor_seed_start(user_id, planting_event, plant, quantity):
    """Auto-create an IndoorSeedStart when placing a transplant-method plant.

    Only creates if:
    - The plant has weeksIndoors > 0 (can be started indoors)
    - The planting event has a transplant_date set
    - No existing IndoorSeedStart is already linked to this planting event

    Args:
        user_id: The current user's ID
        planting_event: The PlantingEvent being created (must already be in session)
        plant: The plant dict from plant_database
        quantity: Number of plants being placed

    Returns:
        The created IndoorSeedStart, or None if not applicable
    """
    if not plant:
        return None

    weeks_indoors = plant.get('weeksIndoors', 0)
    if not weeks_indoors or weeks_indoors <= 0:
        return None

    transplant_date = planting_event.transplant_date
    if not transplant_date:
        return None

    # Calculate indoor start date
    indoor_start_date = transplant_date - timedelta(weeks=weeks_indoors)

    # Clamp seed start date to today if it would be in the past
    today = get_now()
    today_date = today.date() if hasattr(today, 'date') else today
    original_start_date = indoor_start_date
    if hasattr(indoor_start_date, 'date'):
        start_date_only = indoor_start_date.date()
    else:
        start_date_only = indoor_start_date

    if start_date_only < today_date:
        indoor_start_date = datetime.combine(today_date, datetime.min.time())
        was_clamped = True
    else:
        was_clamped = False

    # Calculate expected dates
    germination_days = plant.get('germination_days', 7)
    expected_germination_date = indoor_start_date + timedelta(days=germination_days)
    expected_transplant_date = indoor_start_date + timedelta(weeks=weeks_indoors)

    # Calculate seeds to start (accounting for germination rate)
    expected_rate = 85.0  # Default germination rate
    rate = expected_rate / 100.0
    seeds_to_start = max(quantity, math.ceil(math.ceil(quantity / rate) * 1.15))

    seed_start = IndoorSeedStart(
        user_id=user_id,
        plant_id=planting_event.plant_id,
        variety=planting_event.variety,
        start_date=indoor_start_date,
        expected_germination_date=expected_germination_date,
        expected_transplant_date=expected_transplant_date,
        seeds_started=seeds_to_start,
        expected_germination_rate=expected_rate,
        location='windowsill',
        # Capture the placement bed as a manual destination override.
        # Without this the indoor-start card shows "Planned bed: not assigned"
        # because get_current_garden_plan_count() intentionally excludes the
        # self-linked planting_event from bed resolution, and there is no
        # GardenPlanItem in this auto-create path (placement bypassed the
        # season planner). See models.py::get_current_garden_plan_count.
        destination_bed_ids=(
            json.dumps([planting_event.garden_bed_id])
            if planting_event.garden_bed_id
            else None
        ),
        light_hours=12,
        temperature=70,
        notes=(
            f'Auto-created: start indoors today (ideally needed {original_start_date.strftime("%Y-%m-%d")}) for transplant on {transplant_date.strftime("%Y-%m-%d")}'
            if was_clamped
            else f'Auto-created: start indoors for transplant on {transplant_date.strftime("%Y-%m-%d")}'
        ),
        status='planned'
    )

    db.session.add(seed_start)
    db.session.flush()  # Get seed_start.id

    # Link to planting event
    seed_start.planting_event_id = planting_event.id

    # Set seed_start_date on the planting event
    planting_event.seed_start_date = indoor_start_date

    logging.info(
        f"[AUTO-SEED-START] Created IndoorSeedStart #{seed_start.id} for "
        f"{planting_event.plant_id} (variety={planting_event.variety}): "
        f"start indoors {indoor_start_date.strftime('%Y-%m-%d')}, "
        f"transplant {transplant_date.strftime('%Y-%m-%d')}, "
        f"{seeds_to_start} seeds for {quantity} plants"
    )

    return seed_start


# Validation constants (VALID_SUN_EXPOSURES imported from utils.constants)
BED_DELETE_CONFIRMATION = 'delete'

# Create blueprint
gardens_bp = Blueprint('gardens', __name__, url_prefix='/api')


def _delete_photo_file(photo):
    """Best-effort removal for files attached to photo rows being deleted."""
    if not photo.filename:
        return

    filepath = os.path.join('static', 'uploads', photo.filename)
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
    except OSError as exc:
        logging.warning(f"Failed to delete photo file for photo {photo.id}: {exc}")


def _parse_json_list(raw_value):
    if not raw_value:
        return []
    try:
        parsed = json.loads(raw_value)
    except (json.JSONDecodeError, TypeError):
        return []
    return parsed if isinstance(parsed, list) else []


def _same_id(left, right):
    try:
        return int(left) == int(right)
    except (TypeError, ValueError):
        return False


def _safe_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _remove_bed_assignment(raw_assignments, bed_id):
    assignments = _parse_json_list(raw_assignments)
    if not assignments:
        return [], 0, False

    remaining = []
    removed_quantity = 0
    changed = False

    for assignment in assignments:
        if not isinstance(assignment, dict):
            remaining.append(assignment)
            continue

        assignment_bed_id = assignment.get('bedId')
        if assignment_bed_id is None:
            assignment_bed_id = assignment.get('bed_id')

        if _same_id(assignment_bed_id, bed_id):
            removed_quantity += _safe_int(assignment.get('quantity'), 0)
            changed = True
        else:
            remaining.append(assignment)

    return remaining, removed_quantity, changed


def _remove_id_from_json_list(raw_ids, id_to_remove):
    ids = _parse_json_list(raw_ids)
    if not ids:
        return [], False

    remaining = [value for value in ids if not _same_id(value, id_to_remove)]
    return remaining, len(remaining) != len(ids)


def _detach_deleted_bed_from_indoor_starts(bed_id, user_id, deleted_start_ids):
    query = IndoorSeedStart.query.filter(
        IndoorSeedStart.user_id == user_id,
        IndoorSeedStart.destination_bed_ids.isnot(None)
    )
    if deleted_start_ids:
        query = query.filter(IndoorSeedStart.id.notin_(deleted_start_ids))

    updated = 0
    for seed_start in query.all():
        remaining, changed = _remove_id_from_json_list(seed_start.destination_bed_ids, bed_id)
        if changed:
            seed_start.destination_bed_ids = json.dumps(remaining) if remaining else None
            updated += 1

    return updated


def _detach_deleted_bed_from_plan_items(bed_id, user_id, trellis_ids):
    plan_ids = [
        row.id for row in GardenPlan.query.with_entities(GardenPlan.id).filter_by(user_id=user_id).all()
    ]
    if not plan_ids:
        return {
            'planItemsUpdated': 0,
            'planItemsDeleted': 0,
            'planBedAssignmentsRemoved': 0,
            'planTrellisAssignmentsRemoved': 0,
        }

    updated = 0
    deleted = 0
    bed_assignments_removed = 0
    trellis_assignments_removed = 0

    plan_items = GardenPlanItem.query.filter(GardenPlanItem.garden_plan_id.in_(plan_ids)).all()
    for plan_item in plan_items:
        touched = False
        should_delete = False

        remaining_assignments, _removed_qty, assignments_changed = _remove_bed_assignment(
            plan_item.bed_assignments,
            bed_id
        )
        if assignments_changed:
            touched = True
            bed_assignments_removed += 1
            if remaining_assignments:
                remaining_total = sum(
                    _safe_int(entry.get('quantity'), 0)
                    for entry in remaining_assignments
                    if isinstance(entry, dict)
                )
                plan_item.bed_assignments = json.dumps(remaining_assignments)
                remaining_bed_ids = []
                for entry in remaining_assignments:
                    if not isinstance(entry, dict):
                        continue
                    entry_bed_id = entry.get('bedId')
                    if entry_bed_id is None:
                        entry_bed_id = entry.get('bed_id')
                    if entry_bed_id is not None:
                        remaining_bed_ids.append(entry_bed_id)
                plan_item.beds_allocated = json.dumps(remaining_bed_ids)
                plan_item.plant_equivalent = max(0, remaining_total)
                plan_item.target_value = float(plan_item.plant_equivalent)
                plan_item.seeds_required = _calculate_seeds_needed(
                    plan_item.plant_equivalent,
                    0.85,
                    0.90
                )
            else:
                should_delete = True

        if not should_delete and plan_item.beds_allocated:
            remaining_beds, beds_changed = _remove_id_from_json_list(plan_item.beds_allocated, bed_id)
            if beds_changed:
                touched = True
                plan_item.beds_allocated = json.dumps(remaining_beds) if remaining_beds else None
                if not remaining_beds and not plan_item.bed_assignments:
                    should_delete = True

        if not should_delete and trellis_ids and plan_item.trellis_assignments:
            remaining_trellises = _parse_json_list(plan_item.trellis_assignments)
            original_count = len(remaining_trellises)
            for trellis_id in trellis_ids:
                remaining_trellises = [
                    value for value in remaining_trellises
                    if not _same_id(value, trellis_id)
                ]
            if len(remaining_trellises) != original_count:
                touched = True
                trellis_assignments_removed += 1
                plan_item.trellis_assignments = (
                    json.dumps(remaining_trellises) if remaining_trellises else None
                )

        if should_delete:
            db.session.delete(plan_item)
            deleted += 1
        elif touched:
            updated += 1

    return {
        'planItemsUpdated': updated,
        'planItemsDeleted': deleted,
        'planBedAssignmentsRemoved': bed_assignments_removed,
        'planTrellisAssignmentsRemoved': trellis_assignments_removed,
    }


def _clear_bed_owned_data_for_delete(bed, user_id):
    bed_id = bed.id
    planted_item_ids = [
        row.id for row in PlantedItem.query.with_entities(PlantedItem.id).filter_by(
            garden_bed_id=bed_id,
            user_id=user_id
        ).all()
    ]
    trellis_ids = [
        row.id for row in TrellisStructure.query.with_entities(TrellisStructure.id).filter_by(
            garden_bed_id=bed_id,
            user_id=user_id
        ).all()
    ]

    event_conditions = [PlantingEvent.garden_bed_id == bed_id]
    if trellis_ids:
        event_conditions.append(PlantingEvent.trellis_structure_id.in_(trellis_ids))

    planting_events = PlantingEvent.query.filter(
        PlantingEvent.user_id == user_id,
        or_(*event_conditions)
    ).all()
    planting_event_ids = [event.id for event in planting_events]

    photo_conditions = [Photo.garden_bed_id == bed_id]
    if planted_item_ids:
        photo_conditions.append(Photo.planted_item_id.in_(planted_item_ids))
    photos = Photo.query.filter(
        Photo.user_id == user_id,
        or_(*photo_conditions)
    ).all()
    for photo in photos:
        _delete_photo_file(photo)
        db.session.delete(photo)

    harvest_count = 0
    seed_inventory_refs_cleared = 0
    if planted_item_ids:
        harvest_count = HarvestRecord.query.filter(
            HarvestRecord.user_id == user_id,
            HarvestRecord.planted_item_id.in_(planted_item_ids)
        ).delete(synchronize_session=False)
        seed_inventory_refs_cleared = SeedInventory.query.filter(
            SeedInventory.user_id == user_id,
            SeedInventory.source_planted_item_id.in_(planted_item_ids)
        ).update(
            {SeedInventory.source_planted_item_id: None},
            synchronize_session=False
        )

    deleted_seed_start_ids = []
    if planting_event_ids:
        deleted_seed_start_ids = [
            row.id for row in IndoorSeedStart.query.with_entities(IndoorSeedStart.id).filter(
                IndoorSeedStart.user_id == user_id,
                IndoorSeedStart.planting_event_id.in_(planting_event_ids)
            ).all()
        ]
        if deleted_seed_start_ids:
            plan_ids = [
                row.id for row in GardenPlan.query.with_entities(GardenPlan.id).filter_by(user_id=user_id).all()
            ]
            if plan_ids:
                GardenPlanItem.query.filter(
                    GardenPlanItem.garden_plan_id.in_(plan_ids),
                    GardenPlanItem.indoor_seed_start_id.in_(deleted_seed_start_ids)
                ).update(
                    {GardenPlanItem.indoor_seed_start_id: None},
                    synchronize_session=False
                )
            IndoorSeedStart.query.filter(
                IndoorSeedStart.id.in_(deleted_seed_start_ids),
                IndoorSeedStart.user_id == user_id
            ).delete(synchronize_session=False)

    indoor_destination_refs_updated = _detach_deleted_bed_from_indoor_starts(
        bed_id,
        user_id,
        deleted_seed_start_ids
    )

    planting_event_count = 0
    if planting_event_ids:
        planting_event_count = PlantingEvent.query.filter(
            PlantingEvent.id.in_(planting_event_ids),
            PlantingEvent.user_id == user_id
        ).delete(synchronize_session=False)

    planted_item_count = PlantedItem.query.filter_by(
        garden_bed_id=bed_id,
        user_id=user_id
    ).delete(synchronize_session=False)
    placed_structure_count = PlacedStructure.query.filter_by(
        garden_bed_id=bed_id,
        user_id=user_id
    ).delete(synchronize_session=False)

    plan_counts = _detach_deleted_bed_from_plan_items(bed_id, user_id, trellis_ids)

    trellis_count = 0
    if trellis_ids:
        trellis_count = TrellisStructure.query.filter(
            TrellisStructure.id.in_(trellis_ids),
            TrellisStructure.user_id == user_id
        ).delete(synchronize_session=False)

    return {
        'plantedItemsDeleted': planted_item_count,
        'plantingEventsDeleted': planting_event_count,
        'indoorSeedStartsDeleted': len(deleted_seed_start_ids),
        'indoorSeedStartDestinationsUpdated': indoor_destination_refs_updated,
        'harvestRecordsDeleted': harvest_count,
        'photosDeleted': len(photos),
        'placedStructuresDeleted': placed_structure_count,
        'trellisesDeleted': trellis_count,
        'seedInventoryLinksCleared': seed_inventory_refs_cleared,
        **plan_counts,
    }


# ==================== GARDEN BEDS ROUTES ====================

@gardens_bp.route('/garden-beds', methods=['GET', 'POST'])
@login_required
def garden_beds():
    """Get all garden beds or create new one"""
    if request.method == 'POST':
        data = request.json

        # Validation
        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        width = data.get('width')
        length = data.get('length')

        # Validate dimensions
        if width is None or length is None:
            return jsonify({'error': 'Width and length are required'}), 400

        try:
            width = float(width)
            length = float(length)
        except (ValueError, TypeError):
            return jsonify({'error': 'Width and length must be valid numbers'}), 400

        if width <= 0:
            return jsonify({'error': 'Width must be greater than 0'}), 400

        if length <= 0:
            return jsonify({'error': 'Length must be greater than 0'}), 400

        if width > 100:
            return jsonify({'error': 'Width seems unreasonably large (max 100 feet)'}), 400

        if length > 100:
            return jsonify({'error': 'Length seems unreasonably large (max 100 feet)'}), 400

        # Validate planning method
        planning_method = data.get('planningMethod', 'square-foot')
        if planning_method not in GARDEN_METHODS:
            return jsonify({
                'error': f'Invalid planning method. Must be one of: {", ".join(GARDEN_METHODS.keys())}'
            }), 400

        # Validate sun exposure
        sun_exposure = data.get('sunExposure', 'full')
        if sun_exposure not in VALID_SUN_EXPOSURES:
            return jsonify({
                'error': f'Invalid sun exposure. Must be one of: {", ".join(VALID_SUN_EXPOSURES)}'
            }), 400

        # Get soil type and mulch type
        soil_type = data.get('soilType', 'loamy')
        mulch_type = data.get('mulchType', 'none')

        # Get height (default to 12" for standard raised bed)
        height = data.get('height', 12.0)
        try:
            height = float(height)
        except (ValueError, TypeError):
            height = 12.0

        # Get grid size based on method
        grid_size = GARDEN_METHODS.get(planning_method, {}).get('gridSize', 12)

        # Auto-generate name if not provided
        name = data.get('name') or f"{width}' x {length}' Bed"

        # Handle season extension (protection structure)
        season_extension = data.get('seasonExtension')
        season_extension_json = None
        if season_extension:
            season_extension_json = json.dumps(season_extension)

        # Get zone (permaculture zone 0-5)
        zone = data.get('zone')

        try:
            bed = GardenBed(
                user_id=current_user.id,  # Set owner
                name=name,
                width=width,
                length=length,
                height=height,
                location=data.get('location', ''),
                sun_exposure=sun_exposure,
                soil_type=soil_type,
                mulch_type=mulch_type,
                planning_method=planning_method,
                grid_size=grid_size,
                season_extension=season_extension_json,
                zone=zone
            )
            db.session.add(bed)
            db.session.commit()
            return jsonify(bed.to_dict()), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Database error: {str(e)}'}), 500

    # GET: Filter by current user
    beds = GardenBed.query.filter_by(user_id=current_user.id).all()
    return jsonify([bed.to_dict() for bed in beds])


@gardens_bp.route('/garden-beds/<int:bed_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def garden_bed(bed_id):
    """Get, update, or delete a specific garden bed"""
    bed = GardenBed.query.get_or_404(bed_id)

    # Verify ownership
    if bed.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    if request.method == 'DELETE':
        data = request.get_json(silent=True) or {}
        confirmation = data.get('confirmation')
        if not isinstance(confirmation, str) or confirmation.strip() != BED_DELETE_CONFIRMATION:
            return jsonify({
                'error': 'Permanent bed deletion requires confirmation',
                'requiredConfirmation': BED_DELETE_CONFIRMATION
            }), 400

        try:
            counts = _clear_bed_owned_data_for_delete(bed, current_user.id)
            bed_name = bed.name
            db.session.delete(bed)
            db.session.commit()
            return jsonify({
                'message': f'Permanently deleted bed "{bed_name}" and attached records',
                'deletedBedId': bed_id,
                'counts': counts
            }), 200
        except Exception as e:
            db.session.rollback()
            logging.exception(f"Failed to permanently delete garden bed {bed_id}: {e}")
            return jsonify({'error': 'Failed to delete garden bed'}), 500

    if request.method == 'PUT':
        data = request.json
        bed.name = data.get('name', bed.name)
        bed.width = data.get('width', bed.width)
        bed.length = data.get('length', bed.length)
        bed.height = data.get('height', bed.height)
        bed.location = data.get('location', bed.location)
        bed.sun_exposure = data.get('sunExposure', bed.sun_exposure)
        bed.soil_type = data.get('soilType', bed.soil_type)
        bed.mulch_type = data.get('mulchType', bed.mulch_type)
        bed.planning_method = data.get('planningMethod', bed.planning_method)

        # Update zone if provided
        if 'zone' in data:
            bed.zone = data.get('zone')

        # Auto-set grid size based on planning method (same as CREATE)
        bed.grid_size = GARDEN_METHODS.get(bed.planning_method, {}).get('gridSize', 12)

        # Handle season extension update
        if 'seasonExtension' in data:
            season_ext = data.get('seasonExtension')
            bed.season_extension = json.dumps(season_ext) if season_ext else None

        db.session.commit()

    return jsonify(bed.to_dict())


# ==================== PLANTED ITEMS ROUTES ====================


def _group_quantity_value(item):
    if item.quantity is None:
        return 1
    return max(0, int(item.quantity))


def _apply_variety_match(query, model, variety):
    if variety is None:
        return query.filter(model.variety.is_(None))
    return query.filter(model.variety == variety)


def _matching_planting_event_for_item(item):
    query = PlantingEvent.query.filter(
        PlantingEvent.user_id == item.user_id,
        PlantingEvent.garden_bed_id == item.garden_bed_id,
        PlantingEvent.plant_id == item.plant_id,
        PlantingEvent.position_x == item.position_x,
        PlantingEvent.position_y == item.position_y,
        PlantingEvent.cancelled_at.is_(None),
        or_(PlantingEvent.event_type.is_(None), PlantingEvent.event_type == 'planting'),
    )
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


def _reduce_matching_planting_event(item, removed_quantity, new_item_quantity, cancelled_at):
    event = _matching_planting_event_for_item(item)
    if event is None:
        return None

    if event.quantity is None:
        if new_item_quantity <= 0:
            event.cancelled_at = cancelled_at
        else:
            event.quantity = new_item_quantity
        return event

    new_event_quantity = max(0, int(event.quantity) - removed_quantity)
    if new_event_quantity <= 0:
        event.quantity = 0
        event.cancelled_at = cancelled_at
        if event.quantity_completed is not None:
            event.quantity_completed = 0
        return event

    event.quantity = new_event_quantity
    if event.quantity_completed is not None:
        event.quantity_completed = min(event.quantity_completed, new_event_quantity)
        event.completed = event.quantity_completed >= new_event_quantity
    elif event.completed:
        event.quantity_completed = new_event_quantity

    return event


@gardens_bp.route('/garden-beds/<int:bed_id>/planted-item-groups/quantity', methods=['PATCH'])
@login_required
def update_planted_item_group_quantity(bed_id):
    """Downward-correct the displayed count for a plant+variety group in one bed."""
    data = request.get_json(silent=True) or {}
    plant_id = data.get('plantId')
    if not isinstance(plant_id, str) or not plant_id.strip():
        return jsonify({'error': 'plantId is required'}), 400

    if 'quantity' not in data:
        return jsonify({'error': 'quantity is required'}), 400

    raw_quantity = data.get('quantity')
    if isinstance(raw_quantity, bool):
        return jsonify({'error': 'quantity must be a non-negative integer'}), 400
    try:
        new_quantity = int(raw_quantity)
    except (TypeError, ValueError):
        return jsonify({'error': 'quantity must be a non-negative integer'}), 400
    if new_quantity < 0:
        return jsonify({'error': 'quantity must be a non-negative integer'}), 400

    bed = GardenBed.query.filter_by(id=bed_id, user_id=current_user.id).first_or_404()
    variety = data.get('variety') if 'variety' in data else None

    items_query = PlantedItem.query.filter(
        PlantedItem.user_id == current_user.id,
        PlantedItem.garden_bed_id == bed.id,
        PlantedItem.plant_id == plant_id,
        PlantedItem.cancelled_at.is_(None),
    )
    items_query = _apply_variety_match(items_query, PlantedItem, variety)
    items = items_query.order_by(
        PlantedItem.planted_date.desc(),
        PlantedItem.id.desc(),
    ).all()

    current_quantity = sum(_group_quantity_value(item) for item in items)
    if current_quantity == 0:
        return jsonify({'error': 'No active planted items found for this plant group'}), 404
    if new_quantity > current_quantity:
        return jsonify({
            'error': 'Increasing planted group quantity is not supported yet',
            'currentQuantity': current_quantity,
        }), 400
    if new_quantity == current_quantity:
        return jsonify({
            'bedId': bed.id,
            'plantId': plant_id,
            'variety': variety,
            'previousQuantity': current_quantity,
            'quantity': current_quantity,
            'removedQuantity': 0,
            'cancelledItemIds': [],
            'updatedItems': [item.to_dict() for item in items],
        }), 200

    to_remove = current_quantity - new_quantity
    remaining_to_remove = to_remove
    cancelled_at = get_utc_now()
    cancelled_item_ids = []
    changed_items = []
    changed_event_ids = []

    for item in items:
        if remaining_to_remove <= 0:
            break

        item_quantity = _group_quantity_value(item)
        if item_quantity <= 0:
            continue

        remove_from_item = min(item_quantity, remaining_to_remove)
        new_item_quantity = item_quantity - remove_from_item

        changed_event = _reduce_matching_planting_event(
            item,
            remove_from_item,
            new_item_quantity,
            cancelled_at,
        )
        if changed_event is not None and changed_event.id is not None:
            changed_event_ids.append(changed_event.id)

        if new_item_quantity <= 0:
            item.cancelled_at = cancelled_at
            cancelled_item_ids.append(item.id)
        else:
            item.quantity = new_item_quantity

        changed_items.append(item)
        remaining_to_remove -= remove_from_item

    db.session.commit()

    active_items = [
        item.to_dict()
        for item in PlantedItem.query.filter(
            PlantedItem.user_id == current_user.id,
            PlantedItem.garden_bed_id == bed.id,
            PlantedItem.plant_id == plant_id,
            PlantedItem.cancelled_at.is_(None),
        )
        .filter(PlantedItem.id.in_([item.id for item in items]))
        .all()
    ]

    return jsonify({
        'bedId': bed.id,
        'plantId': plant_id,
        'variety': variety,
        'previousQuantity': current_quantity,
        'quantity': new_quantity,
        'removedQuantity': to_remove,
        'cancelledItemIds': cancelled_item_ids,
        'changedItemIds': [item.id for item in changed_items],
        'changedEventIds': sorted(set(changed_event_ids)),
        'updatedItems': active_items,
    }), 200


@gardens_bp.route('/planted-items', methods=['POST'])
@login_required
def add_planted_item():
    """Add a plant to a garden bed"""
    try:
        data = request.json

        # Validation
        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        if 'plantId' not in data:
            return jsonify({'error': 'plantId is required'}), 400

        if 'gardenBedId' not in data:
            return jsonify({'error': 'gardenBedId is required'}), 400

        # Verify garden bed exists and user owns it
        bed = GardenBed.query.get(data['gardenBedId'])
        if not bed:
            return jsonify({'error': f'Garden bed with ID {data["gardenBedId"]} not found'}), 404

        if bed.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        position = data.get('position', {})
        planted_date = parse_iso_date(data.get('plantedDate')) or get_now()

        # Get plant data to determine planting method and calculate dates
        plant = get_plant_by_id(data['plantId'])

        # Auto-detect planting method based on plant characteristics
        # If plant can be started indoors (weeksIndoors > 0), default to 'transplant'
        # Otherwise, default to 'direct'
        weeks_indoors = plant.get('weeksIndoors', 0) if plant else 0
        default_method = 'transplant' if weeks_indoors > 0 else 'direct'
        planting_method = data.get('plantingMethod', default_method)

        # Validate sourcePlanItemId ownership if provided
        source_plan_item_id = data.get('sourcePlanItemId')
        if source_plan_item_id is not None:
            plan_item = GardenPlanItem.query.get(source_plan_item_id)
            if not plan_item:
                return jsonify({'error': f'GardenPlanItem {source_plan_item_id} not found'}), 400
            plan = GardenPlan.query.get(plan_item.garden_plan_id)
            if not plan or plan.user_id != current_user.id:
                return jsonify({'error': 'Unauthorized: plan item belongs to another user'}), 400

        explicit_seed_start, source_seed_start_action, seed_start_error = (
            _resolve_source_indoor_seed_start(data, current_user.id)
        )
        if seed_start_error is not None:
            return seed_start_error

        # Compute expected harvest date for both PlantedItem and PlantingEvent
        expected_harvest = planted_date
        if plant and plant.get('daysToMaturity') is not None:
            expected_harvest = planted_date + timedelta(days=plant['daysToMaturity'])

        item = PlantedItem(
            user_id=current_user.id,  # Set owner
            plant_id=data['plantId'],
            variety=data.get('variety'),  # Optional variety field
            garden_bed_id=data['gardenBedId'],
            planted_date=planted_date,
            harvest_date=expected_harvest if expected_harvest != planted_date else None,
            quantity=data.get('quantity', 1),
            status=data.get('status', 'transplanted' if planting_method == 'transplant' else 'seeded'),
            notes=data.get('notes', ''),
            position_x=position.get('x', 0),
            position_y=position.get('y', 0),
            source_plan_item_id=source_plan_item_id
        )
        db.session.add(item)

        # Compute completion based on whether the planted_date has arrived.
        # Past or today → event already happened → completed=True.
        # Future → event is scheduled → completed=False, quantity_completed=0.
        # Without this, future-dated drops are incorrectly reported as done in
        # the calendar/dashboard despite the user setting status='planned'.
        today_now = get_now()
        today_date_only = today_now.date() if hasattr(today_now, 'date') else today_now
        planted_date_only = planted_date.date() if hasattr(planted_date, 'date') else planted_date
        is_completed = planted_date_only <= today_date_only

        # Set date fields based on planting method
        planting_event = PlantingEvent(
            user_id=current_user.id,
            plant_id=data['plantId'],
            variety=data.get('variety'),
            garden_bed_id=data['gardenBedId'],
            direct_seed_date=planted_date if planting_method == 'direct' else None,
            transplant_date=planted_date if planting_method == 'transplant' else None,
            expected_harvest_date=expected_harvest,
            position_x=position.get('x', 0),
            position_y=position.get('y', 0),
            notes=data.get('notes', ''),
            completed=is_completed,
            quantity_completed=data.get('quantity', 1) if is_completed else 0
        )

        # Server-side conflict enforcement for auto-created planting event
        # Use only in-ground dates for spatial conflict checking
        # seed_start_date is indoor-only and doesn't occupy bed space
        start_date = planting_event.transplant_date or planting_event.direct_seed_date

        if start_date and planting_event.expected_harvest_date and planting_event.garden_bed_id:
            # Prevent autoflush — the PlantedItem already in session would
            # revive orphaned PlantingEvents during the EXISTS subquery.
            with db.session.no_autoflush:
                is_valid, error_response = validate_planting_conflict({
                    'garden_bed_id': planting_event.garden_bed_id,
                    'position_x': planting_event.position_x,
                    'position_y': planting_event.position_y,
                    'plant_id': planting_event.plant_id,
                    'transplant_date': planting_event.transplant_date,
                    'direct_seed_date': planting_event.direct_seed_date,
                    'seed_start_date': planting_event.seed_start_date,
                    'start_date': start_date,
                    'end_date': planting_event.expected_harvest_date,
                    'conflict_override': False  # PlantedItems don't have override flag currently
                }, current_user.id)

            if not is_valid:
                db.session.rollback()  # Rollback PlantedItem too
                return jsonify(error_response), 409

        db.session.add(planting_event)
        db.session.flush()  # Get planting_event.id for linking

        # Auto-create indoor seed start for transplant-method plants.
        # Priority order:
        #   1. Explicit sourceIndoorSeedStartId (AUDIT-013 Option α): link to
        #      the exact record the caller specified, bypassing heuristics.
        #   2. Heuristic match by plant+variety+transplant-date window.
        #   3. Auto-create a new IndoorSeedStart.
        indoor_seed_start = None
        indoor_seed_start_linked = False
        indoor_seed_start_planned = False
        if explicit_seed_start is not None:
            indoor_seed_start = explicit_seed_start
            if source_seed_start_action == 'transplant':
                _link_existing_indoor_seed_start(explicit_seed_start, planting_event)
                indoor_seed_start_linked = True
            else:
                _link_planned_indoor_seed_start(explicit_seed_start, planting_event)
                indoor_seed_start_planned = True
        elif planting_method == 'transplant':
            existing_seed_start = _find_existing_indoor_seed_start(
                current_user.id, planting_event
            )
            if existing_seed_start is not None:
                _link_existing_indoor_seed_start(existing_seed_start, planting_event)
                indoor_seed_start = existing_seed_start
                indoor_seed_start_linked = True
            else:
                indoor_seed_start = _auto_create_indoor_seed_start(
                    current_user.id, planting_event, plant, data.get('quantity', 1)
                )

        # Mark original exported PlantingEvents as completed when placing from a plan.
        # Mirrors the batch path logic (lines 708-720) so that the calendar grouped
        # marker clears after single-position placement too.
        if source_plan_item_id:
            export_key_prefix = f"{current_user.id}_{source_plan_item_id}_{data['gardenBedId']}_"
            original_events = PlantingEvent.query.filter(
                PlantingEvent.user_id == current_user.id,
                PlantingEvent.export_key.like(f"{export_key_prefix}%"),
                PlantingEvent.completed == False  # noqa: E712
            ).all()
            for evt in original_events:
                evt.completed = True
                evt.quantity_completed = evt.quantity or data.get('quantity', 1)
                _sync_indoor_start_on_completion(evt)

        db.session.commit()

        response_data = item.to_dict()
        if indoor_seed_start:
            response_data['indoorSeedStartCreated'] = not indoor_seed_start_linked
            response_data['indoorSeedStartLinked'] = indoor_seed_start_linked
            response_data['indoorSeedStartId'] = indoor_seed_start.id
            if indoor_seed_start_planned:
                response_data['indoorSeedStartCreated'] = False
                response_data['indoorSeedStartPlacementPlanned'] = True
        return jsonify(response_data), 201
    except KeyError as e:
        db.session.rollback()
        return jsonify({'error': f'Missing required field: {str(e)}'}), 400
    except Exception as e:
        db.session.rollback()
        # Safe error message handling (avoid Unicode encoding issues on Windows)
        try:
            error_msg = str(e)
        except UnicodeEncodeError:
            error_msg = repr(e)  # Fallback to repr if str() fails
        return jsonify({'error': f'Database error: {error_msg}'}), 500


@gardens_bp.route('/planted-items/batch', methods=['POST'])
@login_required
def batch_add_planted_items():
    """
    Create multiple planted items in a single transaction.

    Request body:
    {
        "gardenBedId": 1,
        "plantId": "kale",
        "variety": "Lacinato",
        "plantedDate": "2025-01-15",
        "plantingMethod": "direct",
        "status": "planned",
        "notes": "Auto-placed succession",
        "positions": [
            {"x": 0, "y": 0, "quantity": 1},
            {"x": 1, "y": 0, "quantity": 1},
            {"x": 2, "y": 0, "quantity": 1}
        ]
    }

    Returns: {"created": 3, "items": [...]}
    """
    try:
        data = request.json

        # Extract succession group ID if provided
        succession_group_id = data.get('successionGroupId')

        # Extract seed density data if provided (for MIGardener method)
        seed_density_data = data.get('seedDensityData', {})
        seed_planting_method = seed_density_data.get('plantingMethod', 'individual_plants')

        # Validation
        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        required_fields = ['plantId', 'gardenBedId', 'positions']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400

        if not isinstance(data['positions'], list) or len(data['positions']) == 0:
            return jsonify({'error': 'positions must be a non-empty array'}), 400

        # Verify garden bed exists and user owns it
        bed = GardenBed.query.get(data['gardenBedId'])
        if not bed:
            return jsonify({'error': f'Garden bed with ID {data["gardenBedId"]} not found'}), 404

        if bed.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Validate sourcePlanItemId ownership if provided
        source_plan_item_id = data.get('sourcePlanItemId')
        if source_plan_item_id is not None:
            plan_item = GardenPlanItem.query.get(source_plan_item_id)
            if not plan_item:
                return jsonify({'error': f'GardenPlanItem {source_plan_item_id} not found'}), 400
            plan = GardenPlan.query.get(plan_item.garden_plan_id)
            if not plan or plan.user_id != current_user.id:
                return jsonify({'error': 'Unauthorized: plan item belongs to another user'}), 400

        explicit_seed_start, source_seed_start_action, seed_start_error = (
            _resolve_source_indoor_seed_start(data, current_user.id)
        )
        if seed_start_error is not None:
            return seed_start_error

        # Get plant data
        plant = get_plant_by_id(data['plantId'])
        if not plant:
            return jsonify({'error': f'Plant with ID {data["plantId"]} not found'}), 404

        planted_date = parse_iso_date(data.get('plantedDate')) or get_now()

        # Auto-detect planting method
        weeks_indoors = plant.get('weeksIndoors', 0) if plant else 0
        default_method = 'transplant' if weeks_indoors > 0 else 'direct'
        planting_method = data.get('plantingMethod', default_method)

        # Compute "today" once per request so per-position completion checks
        # are consistent across all positions in the batch.
        batch_today_now = get_now()
        batch_today_date_only = (
            batch_today_now.date() if hasattr(batch_today_now, 'date') else batch_today_now
        )

        # Create all items in transaction
        created_items = []
        created_events = []  # Track PlantingEvents for indoor seed start auto-creation

        for i, pos in enumerate(data['positions']):
            if 'x' not in pos or 'y' not in pos:
                return jsonify({'error': 'Each position must have x and y coordinates'}), 400

            # Per-position date support (for date-staggered planting)
            pos_planted_date = planted_date
            if pos.get('plantedDate'):
                pos_planted_date = parse_iso_date(pos['plantedDate']) or planted_date

            # Per-position harvest date
            pos_expected_harvest = pos_planted_date
            if plant and plant.get('daysToMaturity') is not None:
                pos_expected_harvest = pos_planted_date + timedelta(days=plant['daysToMaturity'])

            # Create PlantedItem
            item = PlantedItem(
                user_id=current_user.id,
                plant_id=data['plantId'],
                variety=data.get('variety'),
                garden_bed_id=data['gardenBedId'],
                planted_date=pos_planted_date,
                harvest_date=pos_expected_harvest if pos_expected_harvest != pos_planted_date else None,
                quantity=pos.get('quantity', 1),
                status=data.get('status', 'transplanted' if planting_method == 'transplant' else 'seeded'),
                notes=data.get('notes', ''),
                position_x=pos['x'],
                position_y=pos['y'],
                source_plan_item_id=source_plan_item_id
            )
            # Don't add item to session yet — autoflush during validation
            # would make orphaned PlantingEvents appear to have matching
            # PlantedItems, causing false 409 conflicts (asparagus bug).

            # Compute completion per-position so a batch with mixed
            # past/future dates handles each correctly. Past or today →
            # completed; future → scheduled (completed=False).
            pos_planted_date_only = (
                pos_planted_date.date() if hasattr(pos_planted_date, 'date') else pos_planted_date
            )
            pos_is_completed = pos_planted_date_only <= batch_today_date_only

            # Create corresponding PlantingEvent
            planting_event = PlantingEvent(
                user_id=current_user.id,
                plant_id=data['plantId'],
                variety=data.get('variety'),
                garden_bed_id=data['gardenBedId'],
                direct_seed_date=pos_planted_date if planting_method == 'direct' else None,
                transplant_date=pos_planted_date if planting_method == 'transplant' else None,
                expected_harvest_date=pos_expected_harvest,
                position_x=pos['x'],
                position_y=pos['y'],
                notes=data.get('notes', ''),
                succession_planting=bool(succession_group_id),
                succession_group_id=succession_group_id,
                # Seed density fields (for MIGardener method)
                planting_method=seed_planting_method,
                quantity=pos.get('quantity') if seed_planting_method == 'individual_plants' else seed_density_data.get('expectedFinalCount'),
                spacing=seed_density_data.get('spacing'),
                seed_count=seed_density_data.get('seedCount'),
                expected_germination_rate=seed_density_data.get('expectedGerminationRate'),
                expected_survival_rate=seed_density_data.get('expectedSurvivalRate'),
                expected_final_count=seed_density_data.get('expectedFinalCount'),
                harvest_method=seed_density_data.get('harvestMethod'),
                # Planting style (row-based vs broadcast)
                planting_style=seed_density_data.get('plantingStyle'),
                # Row-based seed density fields (only used for row-based)
                seed_density=seed_density_data.get('seedDensity'),
                ui_segment_length_inches=seed_density_data.get('uiSegmentLengthInches'),
                row_group_id=seed_density_data.get('rowGroupId'),
                row_segment_index=seed_density_data.get('rowSegmentIndex'),
                total_row_segments=seed_density_data.get('totalRowSegments'),
                # Broadcast seed density fields (only used for broadcast)
                seed_density_per_sq_ft=seed_density_data.get('seedDensityPerSqFt'),
                grid_cell_area_inches=seed_density_data.get('gridCellAreaInches'),
                # Plant-spacing seed density fields (only used for plant-spacing)
                seeds_per_spot=seed_density_data.get('seedsPerSpot'),
                plants_kept_per_spot=seed_density_data.get('plantsKeptPerSpot'),
                # MIGardener physical row number
                row_number=data.get('rowNumber'),
                completed=pos_is_completed,
                quantity_completed=pos.get('quantity', 1) if pos_is_completed else 0
            )

            # Server-side conflict enforcement for batch operation
            # Use only in-ground dates for spatial conflict checking
            # seed_start_date is indoor-only and doesn't occupy bed space
            start_date = planting_event.transplant_date or planting_event.direct_seed_date

            # Get conflict_override from request data
            conflict_override = data.get('conflictOverride', False)

            if start_date and planting_event.expected_harvest_date and planting_event.garden_bed_id:
                # Prevent autoflush during validation — previous iterations'
                # PlantedItems in the session would get flushed to DB, "reviving"
                # orphaned PlantingEvents and causing false 409 conflicts.
                with db.session.no_autoflush:
                    is_valid, error_response = validate_planting_conflict({
                        'garden_bed_id': planting_event.garden_bed_id,
                        'position_x': planting_event.position_x,
                        'position_y': planting_event.position_y,
                        'plant_id': planting_event.plant_id,
                        'transplant_date': planting_event.transplant_date,
                        'direct_seed_date': planting_event.direct_seed_date,
                        'seed_start_date': planting_event.seed_start_date,
                        'start_date': start_date,
                        'end_date': planting_event.expected_harvest_date,
                        'conflict_override': conflict_override  # Use value from request
                    }, current_user.id)

                if not is_valid:
                    db.session.rollback()  # Rollback entire batch
                    conflict_details = error_response.get('message', 'Conflict detected')
                    return jsonify({
                        **error_response,
                        'failed_at_index': i,  # Which item in batch failed
                        'failed_position': {'x': pos['x'], 'y': pos['y']},
                        'message': f"Batch creation failed at position ({pos['x']}, {pos['y']}). {conflict_details}"
                    }), 409

            db.session.add(item)
            db.session.add(planting_event)
            created_items.append(item)
            created_events.append((planting_event, item.quantity or 1))

        # Auto-create indoor seed starts for transplant-method batch placements.
        # Group by transplant_date to create one IndoorSeedStart per date
        # (all positions in a batch share the same plant+variety).
        indoor_seed_starts_created = 0
        indoor_seed_starts_linked = 0
        indoor_seed_starts_planned = 0
        if planting_method == 'transplant' and plant and plant.get('weeksIndoors', 0) > 0:
            # Group created events by transplant_date
            date_groups = {}
            for evt, qty in created_events:
                transplant_dt = evt.transplant_date
                if transplant_dt:
                    date_key = transplant_dt.date().isoformat()
                    if date_key not in date_groups:
                        date_groups[date_key] = {'events': [], 'total_qty': 0}
                    date_groups[date_key]['events'].append(evt)
                    date_groups[date_key]['total_qty'] += qty

            # Flush to get planting event IDs before creating IndoorSeedStarts
            db.session.flush()

            # Track IndoorSeedStart ids already reused inside this request so
            # multiple date-groups don't all latch onto the same existing record.
            reused_seed_start_ids = set()

            if explicit_seed_start is not None and source_seed_start_action == 'plan':
                indoor_seed_starts_planned = 1
                if created_events:
                    _link_planned_indoor_seed_start(
                        explicit_seed_start,
                        created_events[0][0]
                    )
                date_groups = {}

            for date_key, group in date_groups.items():
                # Use the first event in the group as representative (linked to the IndoorSeedStart)
                representative_event = group['events'][0]
                total_qty = group['total_qty']

                # Prefer linking an existing IndoorSeedStart over creating a new one.
                if (
                    explicit_seed_start is not None
                    and source_seed_start_action == 'transplant'
                    and explicit_seed_start.id not in reused_seed_start_ids
                ):
                    existing_seed_start = explicit_seed_start
                else:
                    existing_seed_start = _find_existing_indoor_seed_start(
                        current_user.id, representative_event
                    )
                if existing_seed_start is not None and existing_seed_start.id in reused_seed_start_ids:
                    existing_seed_start = None  # already consumed by another group

                if existing_seed_start is not None:
                    _link_existing_indoor_seed_start(existing_seed_start, representative_event)
                    reused_seed_start_ids.add(existing_seed_start.id)
                    indoor_seed_starts_linked += 1
                    for evt in group['events'][1:]:
                        evt.seed_start_date = representative_event.seed_start_date
                else:
                    seed_start = _auto_create_indoor_seed_start(
                        current_user.id, representative_event, plant, total_qty
                    )
                    if seed_start:
                        indoor_seed_starts_created += 1
                        # Set seed_start_date on all events in this date group
                        for evt in group['events'][1:]:
                            evt.seed_start_date = representative_event.seed_start_date

        # Mark original exported PlantingEvents as completed when placing from a plan.
        # The export creates events with export_key like "{userId}_{planItemId}_{bedId}_{date}_{idx}".
        # Without this, the original stays incomplete while new duplicates are created,
        # causing the calendar grouped marker to show as incomplete.
        source_plan_item_id = data.get('sourcePlanItemId')
        if source_plan_item_id:
            export_key_prefix = f"{current_user.id}_{source_plan_item_id}_{data['gardenBedId']}_"
            original_events = PlantingEvent.query.filter(
                PlantingEvent.user_id == current_user.id,
                PlantingEvent.export_key.like(f"{export_key_prefix}%"),
                PlantingEvent.completed == False  # noqa: E712
            ).all()
            total_placed = sum(pos.get('quantity', 1) for pos in data['positions'])
            for evt in original_events:
                evt.completed = True
                evt.quantity_completed = evt.quantity or total_placed
                _sync_indoor_start_on_completion(evt)

        # Commit transaction (all-or-nothing)
        db.session.commit()

        response_data = {
            'created': len(created_items),
            'items': [item.to_dict() for item in created_items]
        }
        if indoor_seed_starts_created > 0:
            response_data['indoorSeedStartsCreated'] = indoor_seed_starts_created
        if indoor_seed_starts_linked > 0:
            response_data['indoorSeedStartsLinked'] = indoor_seed_starts_linked
        if indoor_seed_starts_planned > 0:
            response_data['indoorSeedStartPlacementPlanned'] = True
            response_data['indoorSeedStartId'] = explicit_seed_start.id
        return jsonify(response_data), 201

    except KeyError as e:
        db.session.rollback()
        return jsonify({'error': f'Missing required field: {str(e)}'}), 400
    except Exception as e:
        db.session.rollback()
        # Safe error message handling (avoid Unicode encoding issues on Windows)
        try:
            error_msg = str(e)
        except UnicodeEncodeError:
            error_msg = repr(e)  # Fallback to repr if str() fails
        return jsonify({'error': f'Database error: {error_msg}'}), 500


@gardens_bp.route('/planted-items/bulk-move', methods=['POST'])
@login_required
def bulk_move_planted_items():
    """Move multiple planted items within one bed atomically.

    Used by Garden Designer's future-row move workflow. The endpoint validates
    every requested target before mutating rows so a conflict cannot leave a
    partially moved row.
    """
    data = request.get_json(silent=True) or {}
    raw_moves = data.get('moves')
    if not isinstance(raw_moves, list) or len(raw_moves) == 0:
        return jsonify({'error': 'moves must be a non-empty list'}), 400

    move_by_id = {}
    target_positions = set()
    for raw in raw_moves:
        if not isinstance(raw, dict):
            return jsonify({'error': 'Each move must be an object'}), 400
        raw_id = raw.get('id')
        if isinstance(raw_id, bool):
            return jsonify({'error': 'Move id must be a positive integer'}), 400
        try:
            item_id = int(raw_id)
        except (TypeError, ValueError):
            return jsonify({'error': 'Move id must be a positive integer'}), 400
        if item_id <= 0:
            return jsonify({'error': 'Move id must be a positive integer'}), 400
        if item_id in move_by_id:
            return jsonify({'error': 'Duplicate move id'}), 400

        position = raw.get('position')
        if not isinstance(position, dict):
            return jsonify({'error': 'Each move requires a position'}), 400
        try:
            x = int(position.get('x'))
            y = int(position.get('y'))
        except (TypeError, ValueError):
            return jsonify({'error': 'Position x and y must be integers'}), 400
        if x < 0 or y < 0:
            return jsonify({'error': 'Position x and y must be non-negative'}), 400

        target_key = (x, y)
        if target_key in target_positions:
            return jsonify({'error': 'Multiple items cannot move to the same position'}), 400
        target_positions.add(target_key)
        move_by_id[item_id] = {'x': x, 'y': y}

    item_ids = list(move_by_id.keys())
    items = PlantedItem.query.filter(
        PlantedItem.user_id == current_user.id,
        PlantedItem.id.in_(item_ids)
    ).all()
    if len(items) != len(item_ids):
        return jsonify({'error': 'One or more planted items were not found'}), 404

    bed_ids = {item.garden_bed_id for item in items}
    if len(bed_ids) != 1:
        return jsonify({'error': 'Bulk move supports one garden bed at a time'}), 400
    bed_id = next(iter(bed_ids))
    bed = GardenBed.query.filter_by(id=bed_id, user_id=current_user.id).first()
    if not bed:
        return jsonify({'error': 'Garden bed not found'}), 404

    grid_size = bed.grid_size or 12
    grid_width = math.floor((bed.width * 12) / grid_size)
    grid_height = math.floor((bed.length * 12) / grid_size)
    for item in items:
        pos = move_by_id[item.id]
        if pos['x'] >= grid_width or pos['y'] >= grid_height:
            return jsonify({
                'error': 'Target position is outside the garden bed',
                'failedItemId': item.id,
                'failedPosition': {'x': pos['x'], 'y': pos['y']},
                'message': (
                    f"Position ({pos['x']}, {pos['y']}) is outside this bed "
                    f"(max: {grid_width - 1}, {grid_height - 1})"
                )
            }), 400

    events_by_item_id = {}
    for item in items:
        events_by_item_id[item.id] = PlantingEvent.query.filter_by(
            garden_bed_id=item.garden_bed_id,
            plant_id=item.plant_id,
            position_x=item.position_x,
            position_y=item.position_y,
            user_id=current_user.id
        ).first()

    conflict_override = bool(data.get('conflictOverride', False))
    if not conflict_override:
        moving_ids = set(item_ids)
        candidate_events = [
            candidate for candidate in query_candidate_items(bed_id, current_user.id)
            if candidate.id not in moving_ids
        ]

        for item in items:
            event = events_by_item_id.get(item.id)
            if not event:
                continue
            start_date = event.transplant_date or event.direct_seed_date
            if not start_date or not event.expected_harvest_date:
                continue

            pos = move_by_id[item.id]
            temp_event = type('TempEvent', (), {
                'position_x': pos['x'],
                'position_y': pos['y'],
                'garden_bed_id': bed_id,
                'plant_id': event.plant_id,
                'transplant_date': event.transplant_date,
                'direct_seed_date': event.direct_seed_date,
                'seed_start_date': event.seed_start_date,
                'expected_harvest_date': event.expected_harvest_date,
                'id': item.id,
            })()

            result = has_conflict(temp_event, candidate_events, bed)
            if result.get('has_conflict'):
                return jsonify({
                    'error': 'Planting conflict detected',
                    'conflicts': result.get('conflicts', []),
                    'failedItemId': item.id,
                    'failedPosition': {'x': pos['x'], 'y': pos['y']},
                    'message': (
                        f"Bulk move blocked at position ({pos['x']}, {pos['y']}). "
                        f"This overlaps with {len(result.get('conflicts', []))} existing planting(s)."
                    )
                }), 409

    for item in items:
        pos = move_by_id[item.id]
        item.position_x = pos['x']
        item.position_y = pos['y']
        event = events_by_item_id.get(item.id)
        if event:
            event.position_x = pos['x']
            event.position_y = pos['y']

    db.session.commit()
    moved_items = sorted(items, key=lambda item: item.id)
    return jsonify({
        'moved': len(moved_items),
        'items': [item.to_dict() for item in moved_items],
    }), 200


@gardens_bp.route('/garden-beds/<int:bed_id>/planted-items/date/<date_str>', methods=['DELETE'])
@login_required
def clear_bed_by_date(bed_id, date_str):
    """Remove planted items from a garden bed for a specific date (preserves historical plantings from other dates)"""
    bed = GardenBed.query.get_or_404(bed_id)

    # Verify ownership
    if bed.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    # Parse the date
    try:
        target_date = parse_iso_date(date_str) if 'T' in date_str or 'Z' in date_str else datetime.strptime(date_str, '%Y-%m-%d')
        # Use end of day to include events planted on that day
        if 'T' not in date_str:
            end_of_day = target_date.replace(hour=23, minute=59, second=59)
        else:
            end_of_day = target_date
    except (ValueError, TypeError) as e:
        return jsonify({'error': f'Invalid date format: {str(e)}'}), 400

    # Query PlantingEvents active on the target date using the same logic as the planting events endpoint
    # An event is active if: planted before/on target_date AND (not harvested OR harvested after/on target_date)
    query = PlantingEvent.query.filter_by(
        garden_bed_id=bed_id,
        user_id=current_user.id
    ).filter(
        # Must have started by target_date (any plant date <= target_date)
        or_(
            and_(PlantingEvent.seed_start_date.isnot(None), PlantingEvent.seed_start_date <= end_of_day),
            and_(PlantingEvent.transplant_date.isnot(None), PlantingEvent.transplant_date <= end_of_day),
            and_(PlantingEvent.direct_seed_date.isnot(None), PlantingEvent.direct_seed_date <= end_of_day)
        )
    ).filter(
        # Must NOT be harvested yet, OR harvested after/on target_date (use actual_harvest_date for tracking mode)
        or_(
            PlantingEvent.actual_harvest_date.is_(None),
            PlantingEvent.actual_harvest_date >= target_date
        )
    )

    # Get the events to delete
    events_to_delete = query.all()
    count = len(events_to_delete)

    # BUGFIX: Delete related indoor seed starts FIRST (before deleting PlantingEvents)
    event_ids = [e.id for e in events_to_delete]
    if event_ids:
        IndoorSeedStart.query.filter(
            IndoorSeedStart.planting_event_id.in_(event_ids),
            IndoorSeedStart.user_id == current_user.id
        ).delete(synchronize_session=False)

    # Collect unique positions to delete corresponding PlantedItems
    positions_to_delete = set()
    for event in events_to_delete:
        if event.position_x is not None and event.position_y is not None:
            positions_to_delete.add((event.position_x, event.position_y))

    # Pre-aggregate plan item quantities from PlantedItems that will be deleted
    # Gather affected items before deletion
    affected_plan_item_totals = {}
    if positions_to_delete:
        for pos_x, pos_y in positions_to_delete:
            items_at_pos = PlantedItem.query.filter_by(
                garden_bed_id=bed_id,
                position_x=pos_x,
                position_y=pos_y,
                user_id=current_user.id
            ).filter(PlantedItem.source_plan_item_id.isnot(None)).all()
            for pi in items_at_pos:
                key = pi.source_plan_item_id
                affected_plan_item_totals[key] = affected_plan_item_totals.get(key, 0) + (pi.quantity or 1)

    # Delete the PlantingEvents
    query.delete(synchronize_session=False)

    # Delete PlantedItems at those positions
    for pos_x, pos_y in positions_to_delete:
        PlantedItem.query.filter_by(
            garden_bed_id=bed_id,
            position_x=pos_x,
            position_y=pos_y,
            user_id=current_user.id
        ).delete(synchronize_session=False)

    # Commit deletions first so they persist even if plan adjustment fails
    db.session.commit()

    # Decrement linked plan items (best-effort, non-blocking)
    for plan_item_id, total_qty in affected_plan_item_totals.items():
        try:
            plan_item = GardenPlanItem.query.get(plan_item_id)
            if plan_item:
                _adjust_auto_plan_item(plan_item, bed_id, -int(total_qty))
        except Exception as e:
            logging.warning(f"Failed to adjust plan item {plan_item_id} after clearing by date: {e}")

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logging.warning(f"Failed to commit plan item adjustments: {e}")

    return jsonify({
        'message': f'Cleared {count} planting(s) and related indoor starts from {date_str}',
        'count': count,
        'date': date_str
    }), 200


@gardens_bp.route('/garden-beds/<int:bed_id>/planted-items/plant/<plant_id>', methods=['DELETE'])
@login_required
def remove_all_by_plant(bed_id, plant_id):
    """Remove all planted items of a specific plant type (and optionally variety) from a garden bed"""
    bed = GardenBed.query.get_or_404(bed_id)

    # Verify ownership
    if bed.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    variety = request.args.get('variety')

    # Build filter for matching PlantedItems
    item_filter = PlantedItem.query.filter_by(
        garden_bed_id=bed_id, plant_id=plant_id, user_id=current_user.id
    )
    if variety:
        item_filter = item_filter.filter_by(variety=variety)

    matching_items = item_filter.all()
    count = len(matching_items)

    if count == 0:
        return jsonify({'message': 'No matching plants found', 'count': 0}), 200

    # Pre-aggregate plan item quantities for decrement after deletion
    agg_filter = db.session.query(
        PlantedItem.source_plan_item_id,
        sa_func.coalesce(sa_func.sum(PlantedItem.quantity), 0)
    ).filter_by(
        garden_bed_id=bed_id, plant_id=plant_id, user_id=current_user.id
    ).filter(
        PlantedItem.source_plan_item_id.isnot(None)
    )
    if variety:
        agg_filter = agg_filter.filter_by(variety=variety)
    affected = agg_filter.group_by(PlantedItem.source_plan_item_id).all()

    # Collect positions to delete matching PlantingEvents
    positions = [(item.position_x, item.position_y) for item in matching_items]

    # Delete IndoorSeedStarts linked to matching PlantingEvents
    for pos_x, pos_y in positions:
        events = PlantingEvent.query.filter_by(
            garden_bed_id=bed_id,
            plant_id=plant_id,
            position_x=pos_x,
            position_y=pos_y,
            user_id=current_user.id
        ).all()
        event_ids = [e.id for e in events]
        if event_ids:
            IndoorSeedStart.query.filter(
                IndoorSeedStart.planting_event_id.in_(event_ids),
                IndoorSeedStart.user_id == current_user.id
            ).delete(synchronize_session=False)

    # Delete matching PlantingEvents
    for pos_x, pos_y in positions:
        pe_filter = PlantingEvent.query.filter_by(
            garden_bed_id=bed_id,
            plant_id=plant_id,
            position_x=pos_x,
            position_y=pos_y,
            user_id=current_user.id
        )
        if variety:
            pe_filter = pe_filter.filter_by(variety=variety)
        pe_filter.delete(synchronize_session=False)

    # Delete matching PlantedItems
    delete_filter = PlantedItem.query.filter_by(
        garden_bed_id=bed_id, plant_id=plant_id, user_id=current_user.id
    )
    if variety:
        delete_filter = delete_filter.filter_by(variety=variety)
    delete_filter.delete(synchronize_session=False)

    # Commit deletions first so they persist even if plan adjustment fails
    db.session.commit()

    # Decrement linked plan items (best-effort, non-blocking)
    for plan_item_id, total_qty in affected:
        try:
            plan_item = GardenPlanItem.query.get(plan_item_id)
            if plan_item:
                _adjust_auto_plan_item(plan_item, bed_id, -int(total_qty))
        except Exception as e:
            logging.warning(f"Failed to adjust plan item {plan_item_id} after removing plants: {e}")

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logging.warning(f"Failed to commit plan item adjustments: {e}")

    label = f'{plant_id}'
    if variety:
        label = f'{variety} {plant_id}'
    return jsonify({
        'message': f'Removed {count} {label} plant(s) from bed',
        'count': count
    }), 200


@gardens_bp.route('/garden-beds/<int:bed_id>/planted-items', methods=['DELETE'])
@login_required
def clear_bed(bed_id):
    """Remove ALL planted items from a garden bed (deletes all historical data)"""
    bed = GardenBed.query.get_or_404(bed_id)

    # Verify ownership
    if bed.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    count = len(bed.planted_items)

    # Pre-aggregate plan item quantities for decrement after deletion
    affected = db.session.query(
        PlantedItem.source_plan_item_id,
        sa_func.coalesce(sa_func.sum(PlantedItem.quantity), 0)
    ).filter_by(
        garden_bed_id=bed_id, user_id=current_user.id
    ).filter(
        PlantedItem.source_plan_item_id.isnot(None)
    ).group_by(PlantedItem.source_plan_item_id).all()

    # BUGFIX: Delete related indoor seed starts FIRST (before deleting PlantingEvents)
    # Get all PlantingEvents for this bed to find their IDs
    planting_events = PlantingEvent.query.filter_by(
        garden_bed_id=bed_id,
        user_id=current_user.id
    ).all()

    # Delete IndoorSeedStarts linked to these events
    event_ids = [e.id for e in planting_events]
    if event_ids:
        IndoorSeedStart.query.filter(
            IndoorSeedStart.planting_event_id.in_(event_ids),
            IndoorSeedStart.user_id == current_user.id
        ).delete(synchronize_session=False)

    # Delete all PlantingEvents for this bed
    PlantingEvent.query.filter_by(garden_bed_id=bed_id, user_id=current_user.id).delete()

    # Delete all planted items for this bed
    PlantedItem.query.filter_by(garden_bed_id=bed_id, user_id=current_user.id).delete()

    # Commit deletions first so they persist even if plan adjustment fails
    db.session.commit()

    # Decrement linked plan items (best-effort, non-blocking)
    for plan_item_id, total_qty in affected:
        try:
            plan_item = GardenPlanItem.query.get(plan_item_id)
            if plan_item:
                _adjust_auto_plan_item(plan_item, bed_id, -int(total_qty))
        except Exception as e:
            logging.warning(f"Failed to adjust plan item {plan_item_id} after clearing bed: {e}")

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logging.warning(f"Failed to commit plan item adjustments: {e}")

    return jsonify({'message': f'Cleared {count} plants and related indoor starts from bed', 'count': count}), 200


@gardens_bp.route('/planted-items/<int:item_id>', methods=['PUT', 'PATCH', 'DELETE'])
@login_required
def planted_item(item_id):
    """Update or delete a planted item"""
    item = PlantedItem.query.get_or_404(item_id)

    # Verify ownership
    if item.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    if request.method == 'DELETE':
        # BUGFIX: Delete related indoor seed starts FIRST (before deleting PlantingEvents)
        # Filter by plant_id to avoid deleting events for other plants at the same position
        # (succession planting can leave multiple PlantingEvents at the same cell)
        events = PlantingEvent.query.filter_by(
            garden_bed_id=item.garden_bed_id,
            plant_id=item.plant_id,
            position_x=item.position_x,
            position_y=item.position_y,
            user_id=current_user.id
        ).all()
        event_ids = [e.id for e in events]
        if event_ids:
            IndoorSeedStart.query.filter(
                IndoorSeedStart.planting_event_id.in_(event_ids),
                IndoorSeedStart.user_id == current_user.id
            ).delete(synchronize_session=False)
        # Delete matching PlantingEvent(s) for this item
        for e in events:
            db.session.delete(e)

        # Capture values before deleting the item
        source_plan_item_id = item.source_plan_item_id
        item_quantity = item.quantity or 1
        item_bed_id = item.garden_bed_id

        db.session.delete(item)
        db.session.commit()

        # Decrement linked plan item quantity
        if source_plan_item_id is not None:
            plan_item = GardenPlanItem.query.get(source_plan_item_id)
            if plan_item:
                _adjust_auto_plan_item(plan_item, item_bed_id, -item_quantity)
                db.session.commit()

        return '', 204

    data = request.json

    # Find PlantingEvent BEFORE updating position (we need old position to find it)
    # Filter by plant_id to avoid picking up a stale event from a previous crop
    # at the same position (succession planting leaves old PlantingEvents behind)
    planting_event = PlantingEvent.query.filter_by(
        garden_bed_id=item.garden_bed_id,
        plant_id=item.plant_id,
        position_x=item.position_x,
        position_y=item.position_y,
        user_id=current_user.id
    ).first()

    # Server-side conflict enforcement for position/bed moves (Bug Fix #2)
    if ('position' in data or 'gardenBedId' in data) and planting_event:
        # Calculate new position/bed
        new_position_x = data.get('position', {}).get('x', item.position_x) if 'position' in data else item.position_x
        new_position_y = data.get('position', {}).get('y', item.position_y) if 'position' in data else item.position_y
        new_garden_bed_id = data.get('gardenBedId', item.garden_bed_id) if 'gardenBedId' in data else item.garden_bed_id

        # Only validate if position or garden bed is actually changing
        position_changed = (new_position_x != item.position_x or new_position_y != item.position_y)
        bed_changed = (new_garden_bed_id != item.garden_bed_id)

        if position_changed or bed_changed:
            # Use only in-ground dates for spatial conflict checking
            # seed_start_date is indoor-only and doesn't occupy bed space
            start_date = planting_event.transplant_date or planting_event.direct_seed_date

            if start_date and planting_event.expected_harvest_date:
                is_valid, error_response = validate_planting_conflict({
                    'garden_bed_id': new_garden_bed_id,
                    'position_x': new_position_x,
                    'position_y': new_position_y,
                    'plant_id': planting_event.plant_id,
                    'transplant_date': planting_event.transplant_date,
                    'direct_seed_date': planting_event.direct_seed_date,
                    'seed_start_date': planting_event.seed_start_date,
                    'start_date': start_date,
                    'end_date': planting_event.expected_harvest_date,
                    'conflict_override': False
                }, current_user.id, exclude_item_id=item.id)  # CRITICAL: Exclude self!

                if not is_valid:
                    db.session.rollback()
                    return jsonify(error_response), 409

    # Update position and bed if provided (for drag-to-move functionality)
    if 'position' in data:
        new_position = data['position']
        item.position_x = new_position.get('x', item.position_x)
        item.position_y = new_position.get('y', item.position_y)
        if planting_event:
            planting_event.position_x = item.position_x
            planting_event.position_y = item.position_y

    if 'gardenBedId' in data:
        # Verify new bed exists and user owns it
        new_bed = GardenBed.query.get(data['gardenBedId'])
        if not new_bed:
            return jsonify({'error': 'New garden bed not found'}), 404
        if new_bed.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        item.garden_bed_id = data['gardenBedId']
        if planting_event:
            planting_event.garden_bed_id = str(data['gardenBedId'])

    # Update other fields
    old_status = item.status
    item.status = data.get('status', item.status)
    item.notes = data.get('notes', item.notes)

    # Cross-model sync: PlantedItem 'harvested' → PlantingEvent completed
    if item.status == 'harvested' and old_status != 'harvested' and planting_event:
        planting_event.completed = True
        planting_event.harvest_completed = True
        if planting_event.quantity is not None:
            planting_event.quantity_completed = planting_event.quantity
        _sync_indoor_start_on_completion(planting_event)
    if 'variety' in data:
        item.variety = data.get('variety')  # Allow updating variety
    if 'plantedDate' in data and data['plantedDate']:
        item.planted_date = parse_iso_date(data['plantedDate'])
    if 'transplantDate' in data and data['transplantDate']:
        item.transplant_date = parse_iso_date(data['transplantDate'])
    if 'harvestDate' in data and data['harvestDate']:
        item.harvest_date = parse_iso_date(data['harvestDate'])

    # Handle seed saving toggle
    if 'saveForSeed' in data:
        save_for_seed = data['saveForSeed']
        item.save_for_seed = save_for_seed

        if save_for_seed:
            item.status = 'saving-seed'
            # Auto-calculate seed maturity date from base_date + daysToSeed
            plant = get_plant_by_id(item.plant_id)
            days_to_seed = plant.get('days_to_seed') if plant else None
            if days_to_seed is not None:
                # Use actual harvest_date first, then transplant_date + DTM, then planted_date + DTM
                base_date = item.harvest_date
                if base_date is None and plant:
                    dtm = plant.get('daysToMaturity', 0)
                    if dtm:
                        in_ground_date = item.transplant_date or item.planted_date
                        if in_ground_date:
                            base_date = in_ground_date + timedelta(days=dtm)
                if base_date is not None:
                    item.seed_maturity_date = base_date + timedelta(days=days_to_seed)
            # If no days_to_seed, leave seed_maturity_date null (frontend prompts for manual entry)
        else:
            # Toggle off: reset seed saving fields, restore status based on lifecycle
            item.seed_maturity_date = None
            item.seeds_collected = False
            item.seeds_collected_date = None
            if item.status == 'saving-seed':
                if item.harvest_date:
                    item.status = 'harvested'
                elif item.transplant_date:
                    item.status = 'transplanted'
                elif item.planted_date:
                    item.status = 'growing'
                else:
                    item.status = 'planned'

    # Handle manual seed maturity date override
    if 'seedMaturityDate' in data:
        if data['seedMaturityDate']:
            item.seed_maturity_date = parse_iso_date(data['seedMaturityDate'])
        else:
            item.seed_maturity_date = None

    # Update PlantingEvent dates if exists
    if planting_event:
        if 'transplantDate' in data and data['transplantDate']:
            planting_event.transplant_date = item.transplant_date
        if 'harvestDate' in data and data['harvestDate']:
            planting_event.actual_harvest_date = item.harvest_date  # Use actual_harvest_date for filtering
            planting_event.harvest_completed = True

        # Sync seed maturity / harvest date to PlantingEvent for conflict detection
        if item.save_for_seed and item.seed_maturity_date:
            planting_event.expected_harvest_date = item.seed_maturity_date
        elif not item.save_for_seed and 'saveForSeed' in data:
            # Seed saving toggled off — restore expected_harvest_date from DTM
            plant = get_plant_by_id(item.plant_id)
            dtm = plant.get('daysToMaturity', 0) if plant else 0
            in_ground_date = item.transplant_date or item.planted_date
            if dtm and in_ground_date:
                planting_event.expected_harvest_date = in_ground_date + timedelta(days=dtm)
            else:
                planting_event.expected_harvest_date = None

    db.session.commit()
    return jsonify(item.to_dict())


@gardens_bp.route('/planted-items/<int:item_id>/collect-seeds', methods=['POST'])
@login_required
def collect_seeds(item_id):
    """Collect seeds from a plant that was saved for seed.

    Creates a SeedInventory record with homegrown provenance.
    Request body: { quantity, seedsPerPacket, notes, germinationRate, variety }
    Returns: { plantedItem, seedInventory }
    """
    item = PlantedItem.query.get_or_404(item_id)

    # Verify ownership
    if item.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    # Validate state
    if not item.save_for_seed:
        return jsonify({'error': 'This plant is not marked for seed saving'}), 400

    data = request.json or {}

    # Mark seeds as collected
    item.seeds_collected = True
    item.seeds_collected_date = datetime.utcnow()
    item.status = 'harvested'
    if not item.harvest_date:
        item.harvest_date = datetime.utcnow()

    # Create SeedInventory record
    seed_record = SeedInventory(
        user_id=current_user.id,
        plant_id=item.plant_id,
        variety=data.get('variety', item.variety or 'Homegrown'),
        brand='Homegrown',
        quantity=data.get('quantity', 1),
        seeds_per_packet=data.get('seedsPerPacket', 50),
        germination_rate=data.get('germinationRate'),
        notes=data.get('notes', ''),
        source_planted_item_id=item.id,
        is_homegrown=True,
        purchase_date=datetime.utcnow()
    )
    db.session.add(seed_record)

    try:
        db.session.commit()
        return jsonify({
            'plantedItem': item.to_dict(),
            'seedInventory': seed_record.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to collect seeds: {str(e)}'}), 500


# ==================== PLANTING EVENTS ROUTES ====================

@gardens_bp.route('/planting-events', methods=['GET', 'POST'])
@login_required
def planting_events():
    """Get all planting events or create new one"""
    if request.method == 'POST':
        try:
            data = request.json
            event_type = data.get('eventType', 'planting')

            # PLANTING EVENT - existing logic for plant-based events
            if event_type == 'planting':
                # Validate required fields for planting
                if not data.get('plantId'):
                    return jsonify({'error': 'plantId required for planting events'}), 400

                # Calculate space_required if not provided by client
                space_required = data.get('spaceRequired')
                if space_required is None and data.get('gardenBedId'):
                    bed = GardenBed.query.get(data['gardenBedId'])
                    if bed:
                        space_required = calculate_space_requirement(
                            data['plantId'],
                            bed.grid_size,
                            bed.planning_method
                        )

                # NEW: Extract seed density data if provided
                seed_density_data = data.get('seedDensityData', {})
                planting_method = seed_density_data.get('plantingMethod', 'individual_plants')

                event = PlantingEvent(
                    user_id=current_user.id,
                    event_type='planting',
                    plant_id=data['plantId'],
                    variety=data.get('variety', ''),
                    garden_bed_id=data.get('gardenBedId'),
                    seed_start_date=parse_iso_date(data.get('seedStartDate')),
                    transplant_date=parse_iso_date(data.get('transplantDate')),
                    direct_seed_date=parse_iso_date(data.get('directSeedDate')),
                    expected_harvest_date=parse_iso_date(data['expectedHarvestDate']),
                    succession_planting=data.get('successionPlanting', False),
                    succession_interval=data.get('successionInterval'),
                    succession_group_id=data.get('successionGroupId'),
                    position_x=data.get('positionX'),
                    position_y=data.get('positionY'),
                    space_required=space_required,
                    conflict_override=data.get('conflictOverride', False),
                    notes=data.get('notes', ''),
                    # NEW: Seed density fields
                    planting_method=planting_method,
                    quantity=data.get('quantity') if planting_method == 'individual_plants' else seed_density_data.get('expectedFinalCount'),
                    spacing=seed_density_data.get('spacing'),
                    seed_count=seed_density_data.get('seedCount'),
                    seed_density=seed_density_data.get('seedDensity'),
                    ui_segment_length_inches=seed_density_data.get('uiSegmentLengthInches'),
                    expected_germination_rate=seed_density_data.get('expectedGerminationRate'),
                    expected_survival_rate=seed_density_data.get('expectedSurvivalRate'),
                    expected_final_count=seed_density_data.get('expectedFinalCount'),
                    harvest_method=seed_density_data.get('harvestMethod'),
                    # Row continuity fields
                    row_group_id=seed_density_data.get('rowGroupId'),
                    row_segment_index=seed_density_data.get('rowSegmentIndex'),
                    total_row_segments=seed_density_data.get('totalRowSegments')
                )

                # Trellis allocation logic (for trellis_linear style crops)
                trellis_structure_id = data.get('trellisStructureId')
                if trellis_structure_id:
                    from models import TrellisStructure

                    # Fetch trellis and validate ownership
                    trellis = TrellisStructure.query.get(trellis_structure_id)
                    if not trellis:
                        return jsonify({'error': 'Trellis structure not found'}), 404
                    if trellis.user_id != current_user.id:
                        return jsonify({'error': 'Unauthorized access to trellis'}), 403

                    # Get linear feet requirement from plant data
                    plant = get_plant_by_id(data['plantId'])
                    linear_feet_per_plant = plant.get('migardener', {}).get('linearFeetPerPlant', 5.0) if plant else 5.0

                    # Get all existing allocations on this trellis that have positions, ordered by position
                    existing_allocations = PlantingEvent.query.filter(
                        PlantingEvent.trellis_structure_id == trellis_structure_id,
                        PlantingEvent.user_id == current_user.id,
                        PlantingEvent.trellis_position_start_inches.isnot(None),
                        PlantingEvent.trellis_position_end_inches.isnot(None),
                    ).order_by(PlantingEvent.trellis_position_start_inches).all()

                    # Find first available gap (greedy algorithm)
                    total_length_inches = trellis.total_length_inches
                    required_inches = linear_feet_per_plant * 12

                    # Start from beginning and find first gap that fits
                    position_start_inches = 0
                    for allocation in existing_allocations:
                        gap_size = allocation.trellis_position_start_inches - position_start_inches
                        if gap_size >= required_inches:
                            # Found a gap that fits
                            break
                        # Move past this allocation
                        position_start_inches = allocation.trellis_position_end_inches

                    # Check if we have space at the found position
                    position_end_inches = position_start_inches + required_inches
                    if position_end_inches > total_length_inches:
                        return jsonify({
                            'error': f'Trellis at capacity. Available: {(total_length_inches - position_start_inches) / 12:.1f}ft, Required: {linear_feet_per_plant}ft'
                        }), 400

                    # Validate segment range and check for overlaps (safety net)
                    from services.trellis_validation import validate_trellis_segment, check_trellis_overlaps

                    valid, error_msg = validate_trellis_segment(trellis, position_start_inches, position_end_inches)
                    if not valid:
                        return jsonify({'error': f'Invalid trellis segment: {error_msg}'}), 400

                    overlapping_ids = check_trellis_overlaps(
                        trellis_structure_id, current_user.id,
                        position_start_inches, position_end_inches
                    )
                    if overlapping_ids:
                        return jsonify({
                            'error': 'Trellis segment overlaps existing allocation(s)',
                            'details': {'overlapping_event_ids': overlapping_ids}
                        }), 409

                    # Allocate space on trellis
                    event.trellis_structure_id = trellis_structure_id
                    event.trellis_position_start_inches = position_start_inches
                    event.trellis_position_end_inches = position_end_inches
                    event.linear_feet_allocated = linear_feet_per_plant

                # Server-side conflict enforcement for planting events
                start_date = event.transplant_date or event.direct_seed_date or event.seed_start_date

                if start_date and event.expected_harvest_date and event.garden_bed_id:
                    is_valid, error_response = validate_planting_conflict({
                        'garden_bed_id': event.garden_bed_id,
                        'position_x': event.position_x,
                        'position_y': event.position_y,
                        'plant_id': event.plant_id,
                        'transplant_date': event.transplant_date,
                        'direct_seed_date': event.direct_seed_date,
                        'seed_start_date': event.seed_start_date,
                        'start_date': start_date,
                        'end_date': event.expected_harvest_date,
                        'conflict_override': event.conflict_override
                    }, current_user.id)

                    if not is_valid:
                        return jsonify(error_response), 409

            # MULCH EVENT - garden maintenance event for mulch application
            elif event_type == 'mulch':
                # Validate required fields for mulch event
                if not data.get('gardenBedId'):
                    return jsonify({'error': 'gardenBedId required for mulch events'}), 400
                if not data.get('applicationDate'):
                    return jsonify({'error': 'applicationDate required for mulch events'}), 400

                # Build event details JSON
                mulch_details = {
                    'mulch_type': data.get('mulchType', 'straw'),
                    'depth_inches': data.get('depthInches'),
                    'coverage': data.get('coverage', 'full')
                }

                from services.event_details_validator import validate_event_details
                valid, errors = validate_event_details('mulch', mulch_details)
                if not valid:
                    return jsonify({'error': 'Invalid mulch event details', 'details': errors}), 400

                event = PlantingEvent(
                    user_id=current_user.id,
                    event_type='mulch',
                    plant_id='mulch-event',  # Placeholder since plant_id has NOT NULL constraint
                    garden_bed_id=data['gardenBedId'],
                    expected_harvest_date=parse_iso_date(data['applicationDate']),  # Date mulch applied
                    event_details=json.dumps(mulch_details),
                    notes=data.get('notes', '')
                )

            # MAPLE TAPPING EVENT - homestead event for tracking maple syrup production
            elif event_type == 'maple-tapping':
                # Validate required fields
                if not data.get('tappingDate'):
                    return jsonify({'error': 'tappingDate required for maple tapping events'}), 400

                # Build event details JSON
                tapping_details = {
                    'tree_structure_id': data.get('treeStructureId'),
                    'tree_type': data.get('treeType', 'sugar'),
                    'tap_count': data.get('tapCount', 1),
                    'collection_dates': data.get('collectionDates', []),
                    'syrup_yield': data.get('syrupYield'),
                    'tree_health': data.get('treeHealth'),
                }

                from services.event_details_validator import validate_event_details
                valid, errors = validate_event_details('maple-tapping', tapping_details)
                if not valid:
                    return jsonify({'error': 'Invalid maple-tapping event details', 'details': errors}), 400

                event = PlantingEvent(
                    user_id=current_user.id,
                    event_type='maple-tapping',
                    plant_id='maple-tapping-event',  # Placeholder
                    garden_bed_id=None,              # Not in a garden bed
                    expected_harvest_date=parse_iso_date(data['tappingDate']),  # Date tapped
                    event_details=json.dumps(tapping_details),
                    notes=data.get('notes', '')
                )

            # FUTURE: Other event types (fertilizing, irrigation, etc.)
            else:
                return jsonify({'error': f'Unsupported event type: {event_type}'}), 400

            db.session.add(event)
            db.session.commit()
            return jsonify(event.to_dict()), 201

        except KeyError as e:
            db.session.rollback()
            return jsonify({'error': f'Missing required field: {str(e)}'}), 400
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Failed to create event: {str(e)}'}), 500

    # GET with optional date-range filtering for timeline view
    # Filter by current user
    query = PlantingEvent.query.filter_by(user_id=current_user.id)
    query = query.filter(PlantingEvent.cancelled_at.is_(None))

    # Exclude abandoned events (completed with 0 quantity — never planted)
    query = query.filter(
        ~and_(PlantingEvent.completed == True, PlantingEvent.quantity_completed == 0)
    )

    # Filter by date range if provided
    # Lifecycle filtering: show events that are ACTIVE during the date range
    # An event is active if: plant_date <= end_date AND harvest_date >= start_date
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    # Planning mode: use expected_harvest_date for space availability calculations
    # Tracking mode (default): use actual_harvest_date for actual garden state
    planning_mode = request.args.get('planning_mode', 'false').lower() == 'true'

    if start_date and end_date:
        # Parse dates - handle both ISO format (with T/Z) and simple date strings
        try:
            start_dt = parse_iso_date(start_date) if 'T' in start_date or 'Z' in start_date else datetime.strptime(start_date, '%Y-%m-%d')
            end_dt = parse_iso_date(end_date) if 'T' in end_date or 'Z' in end_date else datetime.strptime(end_date, '%Y-%m-%d')
            # Use end of day for end_date to include events planted on that day
            if 'T' not in end_date:
                end_dt = end_dt.replace(hour=23, minute=59, second=59)
        except (ValueError, TypeError) as e:
            return jsonify({'error': f'Invalid date format: {str(e)}'}), 400

        # Filter by when plant is physically IN THE GROUND (not seed start date)
        # seed_start_date = when seeds start INDOORS (not in garden yet)
        # transplant_date = when seedlings move TO garden
        # direct_seed_date = when seeds planted directly IN garden
        query = query.filter(
            # Plant must be in the ground by end_date
            or_(
                and_(PlantingEvent.transplant_date.isnot(None), PlantingEvent.transplant_date <= end_dt),
                and_(PlantingEvent.direct_seed_date.isnot(None), PlantingEvent.direct_seed_date <= end_dt)
            )
        )

        # Apply harvest date filter based on mode.
        # Planning mode uses expected_harvest_date for projected space availability.
        # Tracking mode only uses actual_harvest_date so overdue crops stay visible
        # until the user logs harvest/removal.
        if planning_mode:
            query = query.filter(
                or_(
                    PlantingEvent.expected_harvest_date.is_(None),
                    PlantingEvent.expected_harvest_date >= start_dt
                )
            )
        else:
            query = query.filter(
                or_(
                    PlantingEvent.actual_harvest_date.is_(None),
                    PlantingEvent.actual_harvest_date >= start_dt
                )
            )
    elif start_date:
        # Only start date - show events that haven't been harvested or were harvested after this date
        # Planning mode: use expected_harvest_date for space availability
        # Tracking mode: use actual_harvest_date for actual garden state
        try:
            start_dt = parse_iso_date(start_date) if 'T' in start_date or 'Z' in start_date else datetime.strptime(start_date, '%Y-%m-%d')
        except (ValueError, TypeError) as e:
            return jsonify({'error': f'Invalid date format: {str(e)}'}), 400

        if planning_mode:
            query = query.filter(
                or_(
                    PlantingEvent.expected_harvest_date.is_(None),
                    PlantingEvent.expected_harvest_date >= start_dt
                )
            )
        else:
            # Tracking mode: use only actual_harvest_date. Expected harvest
            # creates readiness signals, not physical removal from the garden.
            query = query.filter(
                or_(
                    PlantingEvent.actual_harvest_date.is_(None),
                    PlantingEvent.actual_harvest_date >= start_dt
                )
            )
    elif end_date:
        # Only end date - show events physically in the ground on or before this date
        try:
            end_dt = parse_iso_date(end_date) if 'T' in end_date or 'Z' in end_date else datetime.strptime(end_date, '%Y-%m-%d')
        except (ValueError, TypeError) as e:
            return jsonify({'error': f'Invalid date format: {str(e)}'}), 400
        # Only check transplant_date and direct_seed_date (not seed_start_date)
        # seed_start_date is when seeds start indoors, not when plant is in garden
        query = query.filter(
            or_(
                and_(PlantingEvent.transplant_date.isnot(None), PlantingEvent.transplant_date <= end_dt),
                and_(PlantingEvent.direct_seed_date.isnot(None), PlantingEvent.direct_seed_date <= end_dt)
            )
        )

    events = query.all()

    # Batch-lookup IndoorSeedStart statuses for seed-start phase completion
    from models import IndoorSeedStart
    event_ids = [e.id for e in events]
    seed_starts = IndoorSeedStart.query.filter(
        IndoorSeedStart.planting_event_id.in_(event_ids),
        IndoorSeedStart.user_id == current_user.id
    ).all() if event_ids else []
    seed_start_map = {ss.planting_event_id: ss.status for ss in seed_starts}

    result = []
    for event in events:
        event_dict = event.to_dict()
        event_dict['indoorSeedStartStatus'] = seed_start_map.get(event.id)
        result.append(event_dict)
    return jsonify(result)


@gardens_bp.route('/planting-events/<int:event_id>/cancel', methods=['POST'])
@login_required
def cancel_planting_event(event_id):
    """Soft-cancel a planting event so schedule/dashboard reads hide it."""
    event = PlantingEvent.query.filter_by(
        id=event_id,
        user_id=current_user.id,
    ).first_or_404()

    if event.cancelled_at is None:
        event.cancelled_at = get_utc_now()
        db.session.commit()

    return jsonify({
        'id': event.id,
        'cancelledAt': event.cancelled_at.isoformat() if event.cancelled_at else None,
    }), 200


@gardens_bp.route('/planting-events/<int:event_id>/uncancel', methods=['POST'])
@login_required
def uncancel_planting_event(event_id):
    """Restore a soft-cancelled planting event."""
    event = PlantingEvent.query.filter_by(
        id=event_id,
        user_id=current_user.id,
    ).first_or_404()

    if event.cancelled_at is not None:
        event.cancelled_at = None
        db.session.commit()

    return jsonify({
        'id': event.id,
        'cancelledAt': None,
    }), 200


@gardens_bp.route('/planted-items/<int:item_id>/cancel', methods=['POST'])
@login_required
def cancel_planted_item(item_id):
    """Soft-cancel a placed planting so bed/snapshot reads hide it.

    Used when the user opts out of a placed plant at or after its
    planted_date (e.g., "I'm not actually planting that lettuce").
    The PlantedItem stays in the database for history but is filtered
    out of forward-looking views.
    """
    item = PlantedItem.query.filter_by(
        id=item_id,
        user_id=current_user.id,
    ).first_or_404()

    if item.cancelled_at is None:
        item.cancelled_at = get_utc_now()
        db.session.commit()

    return jsonify({
        'id': item.id,
        'cancelledAt': item.cancelled_at.isoformat() if item.cancelled_at else None,
    }), 200


@gardens_bp.route('/planted-items/<int:item_id>/uncancel', methods=['POST'])
@login_required
def uncancel_planted_item(item_id):
    """Restore a soft-cancelled planted item."""
    item = PlantedItem.query.filter_by(
        id=item_id,
        user_id=current_user.id,
    ).first_or_404()

    if item.cancelled_at is not None:
        item.cancelled_at = None
        db.session.commit()

    return jsonify({
        'id': item.id,
        'cancelledAt': None,
    }), 200


@gardens_bp.route('/planting-events/orphaned', methods=['GET', 'DELETE'])
@login_required
def orphaned_planting_events():
    """Preview or delete orphaned PlantingEvents.

    Orphaned events have position data but no matching PlantedItem,
    causing ghost conflicts that block new placements while being
    invisible on the grid.

    GET: Preview orphaned events (returns list with count)
    DELETE: Remove orphaned events and return count deleted
    """
    user_id = current_user.id

    # Find PlantingEvents with positions that have NO matching PlantedItem
    orphaned_query = PlantingEvent.query.filter(
        and_(
            PlantingEvent.user_id == user_id,
            PlantingEvent.event_type == 'planting',
            PlantingEvent.position_x.isnot(None),
            PlantingEvent.position_y.isnot(None)
        )
    ).filter(
        ~db.session.query(PlantedItem).filter(
            PlantedItem.garden_bed_id == cast(PlantingEvent.garden_bed_id, db.Integer),
            PlantedItem.plant_id == PlantingEvent.plant_id,
            PlantedItem.position_x == PlantingEvent.position_x,
            PlantedItem.position_y == PlantingEvent.position_y,
            PlantedItem.user_id == PlantingEvent.user_id
        ).exists()
    )

    if request.method == 'GET':
        orphans = orphaned_query.all()
        return jsonify({
            'count': len(orphans),
            'orphans': [e.to_dict() for e in orphans]
        }), 200

    # DELETE
    orphans = orphaned_query.all()
    count = len(orphans)

    # Delete linked IndoorSeedStarts first
    orphan_ids = [e.id for e in orphans]
    if orphan_ids:
        IndoorSeedStart.query.filter(
            IndoorSeedStart.planting_event_id.in_(orphan_ids),
            IndoorSeedStart.user_id == user_id
        ).delete(synchronize_session=False)

    for orphan in orphans:
        db.session.delete(orphan)

    db.session.commit()
    return jsonify({
        'message': f'Deleted {count} orphaned planting event(s)',
        'count': count
    }), 200


@gardens_bp.route('/planting-events/<int:event_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def planting_event(event_id):
    """Get, update, or delete a planting event"""
    event = PlantingEvent.query.get_or_404(event_id)

    # Verify ownership
    if event.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    if request.method == 'GET':
        return jsonify(event.to_dict())

    if request.method == 'DELETE':
        scope = request.args.get('scope', 'single')

        # Determine which events to delete
        if scope == 'series' and event.succession_group_id:
            events_to_delete = PlantingEvent.query.filter_by(
                succession_group_id=event.succession_group_id,
                user_id=current_user.id
            ).all()
        else:
            events_to_delete = [event]

        delete_result = _delete_planting_events(events_to_delete, current_user.id)
        db.session.commit()
        return jsonify({
            'deleted': delete_result['deleted'],
            'planItemsReset': delete_result['planItemsReset'],
        }), 200

    data = request.json
    event.completed = data.get('completed', event.completed)
    event.notes = data.get('notes', event.notes)

    # Bidirectional sync: completed boolean → quantity_completed
    if 'completed' in data and 'quantityCompleted' not in data:
        if data['completed'] and event.quantity is not None:
            event.quantity_completed = event.quantity
        elif not data['completed'] and event.quantity is not None:
            event.quantity_completed = 0

    # Handle quantity completed update (for partial completion tracking)
    if 'quantityCompleted' in data:
        event.quantity_completed = data.get('quantityCompleted')
        # Auto-update completed flag based on quantity
        if event.quantity and event.quantity_completed is not None:
            event.completed = (event.quantity_completed >= event.quantity)

    # Handle harvest phase completion (independent of planting completion)
    if 'harvestCompleted' in data:
        event.harvest_completed = data['harvestCompleted']

    # Handle actual harvest date update
    if 'actualHarvestDate' in data:
        if data['actualHarvestDate']:
            event.actual_harvest_date = parse_iso_date(data['actualHarvestDate'])
        else:
            event.actual_harvest_date = None

    # Handle expected harvest date update (for auto-adjustment)
    if 'expectedHarvestDate' in data:
        if data['expectedHarvestDate']:
            event.expected_harvest_date = parse_iso_date(data['expectedHarvestDate'])
        else:
            event.expected_harvest_date = None

    # Handle transplant date update
    if 'transplantDate' in data:
        if data['transplantDate']:
            event.transplant_date = parse_iso_date(data['transplantDate'])
        else:
            event.transplant_date = None

    # Handle direct seed date update
    if 'directSeedDate' in data:
        if data['directSeedDate']:
            event.direct_seed_date = parse_iso_date(data['directSeedDate'])
        else:
            event.direct_seed_date = None

    # Handle seed start date update
    if 'seedStartDate' in data:
        if data['seedStartDate']:
            event.seed_start_date = parse_iso_date(data['seedStartDate'])
        else:
            event.seed_start_date = None

    # Handle garden bed reassignment
    if 'gardenBedId' in data:
        new_bed_id = data['gardenBedId']
        old_bed_id = event.garden_bed_id
        if new_bed_id is not None:
            bed = GardenBed.query.get(new_bed_id)
            if not bed or bed.user_id != current_user.id:
                return jsonify({'error': 'Garden bed not found'}), 404
        event.garden_bed_id = new_bed_id

        # Propagate bed change to succession siblings + GardenPlanItem
        if old_bed_id != new_bed_id:
            # Move succession siblings to the new bed too
            moved_events = [event]
            if event.succession_group_id:
                siblings = PlantingEvent.query.filter(
                    PlantingEvent.succession_group_id == event.succession_group_id,
                    PlantingEvent.user_id == current_user.id,
                    PlantingEvent.id != event.id
                ).all()
                for sib in siblings:
                    sib.garden_bed_id = new_bed_id
                    moved_events.append(sib)

            # Compute total quantity being moved
            total_qty = sum(e.quantity or 0 for e in moved_events)

            # Propagate to GardenPlanItem via export_key
            if event.export_key:
                try:
                    plan_item_id = int(event.export_key.split('_')[1])
                    plan_item = GardenPlanItem.query.get(plan_item_id)
                    if plan_item and plan_item.bed_assignments:
                        assignments = json.loads(plan_item.bed_assignments)

                        # Reduce quantity on old bed
                        if old_bed_id is not None:
                            for a in assignments:
                                if a.get('bedId') == old_bed_id:
                                    a['quantity'] = max(0, a.get('quantity', 0) - total_qty)
                                    break
                            assignments = [a for a in assignments if a.get('quantity', 0) > 0]

                        # Add quantity to new bed
                        if new_bed_id is not None:
                            found = False
                            for a in assignments:
                                if a.get('bedId') == new_bed_id:
                                    a['quantity'] = a.get('quantity', 0) + total_qty
                                    found = True
                                    break
                            if not found:
                                assignments.append({'bedId': new_bed_id, 'quantity': total_qty})

                        plan_item.bed_assignments = json.dumps(assignments)
                        # Update legacy beds_allocated
                        plan_item.beds_allocated = json.dumps(list(set(
                            a['bedId'] for a in assignments if a.get('bedId') is not None
                        )))
                except (ValueError, IndexError, json.JSONDecodeError) as e:
                    logging.warning(f"Could not propagate bed change to plan item from export_key {event.export_key}: {e}")

            # Update export_keys to reflect new bed (prevents duplicates on re-export)
            for ev in moved_events:
                if ev.export_key:
                    parts = ev.export_key.split('_')
                    # Bed-allocated format: {user}_{item}_{bed}_{date}_{i} — parts[2] is bed_id
                    if len(parts) == 5 and parts[2].isdigit():
                        parts[2] = str(new_bed_id) if new_bed_id is not None else '0'
                        ev.export_key = '_'.join(parts)

    # Sync linked IndoorSeedStart if event just became completed
    if event.completed:
        _sync_indoor_start_on_completion(event)

    db.session.commit()
    return jsonify(event.to_dict())


@gardens_bp.route('/planting-events/bulk-delete', methods=['POST'])
@login_required
def bulk_delete_planting_events():
    """Hard-delete selected planting events after typed confirmation."""
    data = request.get_json(silent=True) or {}
    if data.get('confirmation') != 'delete':
        return jsonify({'error': 'Typed confirmation must be exactly "delete"'}), 400

    raw_event_ids = data.get('eventIds')
    if not isinstance(raw_event_ids, list) or not raw_event_ids:
        return jsonify({'error': 'eventIds must be a non-empty list'}), 400

    event_ids = []
    for raw_id in raw_event_ids:
        if isinstance(raw_id, bool):
            return jsonify({'error': 'eventIds must contain positive integers'}), 400
        try:
            event_id = int(raw_id)
        except (TypeError, ValueError):
            return jsonify({'error': 'eventIds must contain positive integers'}), 400
        if event_id <= 0:
            return jsonify({'error': 'eventIds must contain positive integers'}), 400
        event_ids.append(event_id)

    unique_event_ids = list(dict.fromkeys(event_ids))
    events = PlantingEvent.query.filter(
        PlantingEvent.id.in_(unique_event_ids),
        PlantingEvent.user_id == current_user.id,
    ).all()

    if len(events) != len(unique_event_ids):
        return jsonify({'error': 'One or more planting events were not found'}), 404

    events_by_id = {event.id: event for event in events}
    ordered_events = [events_by_id[event_id] for event_id in unique_event_ids]
    delete_result = _delete_planting_events(ordered_events, current_user.id)

    db.session.commit()
    return jsonify(delete_result), 200


@gardens_bp.route('/planned-items/unassigned/bulk-delete', methods=['POST'])
@login_required
def bulk_delete_unassigned_planned_items():
    """Hard-delete unassigned planned calendar events and seed starts."""
    data = request.get_json(silent=True) or {}
    if data.get('confirmation') != 'delete':
        return jsonify({'error': 'Typed confirmation must be exactly "delete"'}), 400

    raw_event_ids = data.get('eventIds') or []
    raw_seed_start_ids = data.get('seedStartIds') or []
    if not isinstance(raw_event_ids, list) or not isinstance(raw_seed_start_ids, list):
        return jsonify({'error': 'eventIds and seedStartIds must be lists'}), 400

    def _parse_positive_ids(raw_ids, field_name):
        parsed_ids = []
        for raw_id in raw_ids:
            if isinstance(raw_id, bool):
                raise ValueError(field_name)
            try:
                parsed_id = int(raw_id)
            except (TypeError, ValueError):
                raise ValueError(field_name)
            if parsed_id <= 0:
                raise ValueError(field_name)
            parsed_ids.append(parsed_id)
        return list(dict.fromkeys(parsed_ids))

    try:
        event_ids = _parse_positive_ids(raw_event_ids, 'eventIds')
        seed_start_ids = _parse_positive_ids(raw_seed_start_ids, 'seedStartIds')
    except ValueError as exc:
        return jsonify({'error': f'{exc.args[0]} must contain positive integers'}), 400

    if not event_ids and not seed_start_ids:
        return jsonify({'error': 'No planned items were provided'}), 400

    events = []
    if event_ids:
        events = PlantingEvent.query.filter(
            PlantingEvent.id.in_(event_ids),
            PlantingEvent.user_id == current_user.id,
        ).all()
        if len(events) != len(event_ids):
            return jsonify({'error': 'One or more planting events were not found'}), 404
        for event in events:
            if _event_has_existing_bed_assignment(event, current_user.id):
                return jsonify({'error': 'Only unassigned planting events can be deleted here'}), 400
            if event.cancelled_at is not None or event.completed:
                return jsonify({'error': 'Only active planned planting events can be deleted here'}), 400
            if event.quantity_completed is not None and event.quantity_completed > 0:
                return jsonify({'error': 'Only unstarted planting events can be deleted here'}), 400

    seed_starts = []
    if seed_start_ids:
        seed_starts = IndoorSeedStart.query.filter(
            IndoorSeedStart.id.in_(seed_start_ids),
            IndoorSeedStart.user_id == current_user.id,
        ).all()
        if len(seed_starts) != len(seed_start_ids):
            return jsonify({'error': 'One or more indoor seed starts were not found'}), 404

        linked_event_ids = [
            seed_start.planting_event_id
            for seed_start in seed_starts
            if seed_start.planting_event_id is not None
        ]
        linked_events_by_id = {}
        if linked_event_ids:
            linked_events = PlantingEvent.query.filter(
                PlantingEvent.id.in_(linked_event_ids),
                PlantingEvent.user_id == current_user.id,
            ).all()
            linked_events_by_id = {event.id: event for event in linked_events}

        for seed_start in seed_starts:
            if seed_start.status != 'planned':
                return jsonify({'error': 'Only planned indoor seed starts can be deleted here'}), 400
            linked_event = linked_events_by_id.get(seed_start.planting_event_id)
            if linked_event is not None and _event_has_existing_bed_assignment(linked_event, current_user.id):
                return jsonify({'error': 'Only unassigned indoor seed starts can be deleted here'}), 400
            sync = seed_start.get_current_garden_plan_count()
            if sync.get('destinationBedDetails'):
                return jsonify({'error': 'Only unassigned indoor seed starts can be deleted here'}), 400

    seed_start_linked_event_ids = {
        seed_start.planting_event_id
        for seed_start in seed_starts
        if seed_start.planting_event_id is not None
    }
    standalone_events = [
        event for event in events
        if event.id not in seed_start_linked_event_ids
    ]

    event_result = _delete_planting_events(standalone_events, current_user.id)
    seed_start_result = _delete_indoor_seed_starts(seed_starts, current_user.id)
    db.session.commit()

    deleted_event_ids = (
        event_result['deletedEventIds'] + seed_start_result['deletedLinkedEventIds']
    )
    return jsonify({
        'deletedEventIds': deleted_event_ids,
        'deletedSeedStartIds': seed_start_result['deletedSeedStartIds'],
        'deletedPlantingEvents': event_result['deleted'] + seed_start_result['deletedPlantingEvents'],
        'deletedIndoorSeedStarts': seed_start_result['deletedSeedStarts'],
        'deletedPlantedItems': seed_start_result['deletedPlantedItems'],
        'deletedPlanItems': seed_start_result['deletedPlanItems'],
        'deletedAutoPlanItems': event_result['deletedAutoPlanItems'],
        'planItemsReset': event_result['planItemsReset'],
    }), 200


@gardens_bp.route('/planting-events/<int:event_id>/switch-to-direct-seed', methods=['PATCH'])
@login_required
def switch_to_direct_seed(event_id):
    """Switch an indoor start planting event to direct seed."""
    event = PlantingEvent.query.get_or_404(event_id)

    if event.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    if not event.seed_start_date:
        return jsonify({'error': 'Event is not an indoor start'}), 400

    # Calculate indoor head start BEFORE clearing dates
    if event.transplant_date and event.seed_start_date:
        indoor_days = (event.transplant_date - event.seed_start_date).days
    else:
        # Fallback to plant DB weeksIndoors
        plant_lookup = get_plant_by_id(event.plant_id) if event.plant_id else None
        indoor_days = (plant_lookup.get('weeksIndoors', 0) * 7) if plant_lookup else 0

    # Use transplant date as the new direct seed date
    event.direct_seed_date = event.transplant_date
    event.seed_start_date = None
    event.transplant_date = None

    # Recalculate expected harvest date: direct_seed_date + DTM + indoor head start
    if event.direct_seed_date:
        dtm = None
        # Check seed inventory for variety-specific DTM override
        if event.plant_id and event.variety:
            seed = SeedInventory.query.filter_by(
                user_id=current_user.id,
                plant_id=event.plant_id,
                variety=event.variety
            ).first()
            if seed and seed.days_to_maturity is not None:
                dtm = seed.days_to_maturity
        # Fall back to plant database DTM
        if dtm is None and event.plant_id:
            plant = get_plant_by_id(event.plant_id)
            if plant and plant.get('daysToMaturity') is not None:
                dtm = plant['daysToMaturity']
        # Final fallback
        if dtm is None:
            dtm = 60
        event.expected_harvest_date = event.direct_seed_date + timedelta(days=dtm + indoor_days)

    # Delete linked IndoorSeedStart record
    IndoorSeedStart.query.filter_by(
        planting_event_id=event_id,
        user_id=current_user.id
    ).delete(synchronize_session=False)

    db.session.commit()
    return jsonify(event.to_dict())


@gardens_bp.route('/planting-events/bulk-switch-to-direct-seed', methods=['PATCH'])
@login_required
def bulk_switch_to_direct_seed():
    """Switch multiple indoor start planting events to direct seed at once."""
    data = request.get_json()
    event_ids = data.get('eventIds', [])
    if not event_ids:
        return jsonify({'error': 'No event IDs provided'}), 400

    events = PlantingEvent.query.filter(
        PlantingEvent.id.in_(event_ids),
        PlantingEvent.user_id == current_user.id
    ).all()

    if not events:
        return jsonify({'error': 'No matching events found'}), 404

    switched = []
    skipped = []

    for event in events:
        if not event.seed_start_date:
            skipped.append({'id': event.id, 'reason': 'Not an indoor start'})
            continue

        # Calculate indoor head start BEFORE clearing dates
        if event.transplant_date and event.seed_start_date:
            indoor_days = (event.transplant_date - event.seed_start_date).days
        else:
            plant_lookup = get_plant_by_id(event.plant_id) if event.plant_id else None
            indoor_days = (plant_lookup.get('weeksIndoors', 0) * 7) if plant_lookup else 0

        # Use transplant date as the new direct seed date
        event.direct_seed_date = event.transplant_date
        event.seed_start_date = None
        event.transplant_date = None

        # Recalculate expected harvest date
        if event.direct_seed_date:
            dtm = None
            if event.plant_id and event.variety:
                seed = SeedInventory.query.filter_by(
                    user_id=current_user.id,
                    plant_id=event.plant_id,
                    variety=event.variety
                ).first()
                if seed and seed.days_to_maturity is not None:
                    dtm = seed.days_to_maturity
            if dtm is None and event.plant_id:
                plant = get_plant_by_id(event.plant_id)
                if plant and plant.get('daysToMaturity') is not None:
                    dtm = plant['daysToMaturity']
            if dtm is None:
                dtm = 60
            event.expected_harvest_date = event.direct_seed_date + timedelta(days=dtm + indoor_days)

        # Delete linked IndoorSeedStart record
        IndoorSeedStart.query.filter_by(
            planting_event_id=event.id,
            user_id=current_user.id
        ).delete(synchronize_session=False)

        switched.append(event.id)

    db.session.commit()
    return jsonify({'switched': switched, 'skipped': skipped})


@gardens_bp.route('/planting-events/<int:event_id>/harvest', methods=['PATCH'])
@login_required
def mark_event_harvested(event_id):
    """Mark a planting event as harvested with actual date."""
    event = PlantingEvent.query.get_or_404(event_id)

    # Verify ownership
    if event.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()
    harvest_date = data.get('harvestDate') if data else None

    if harvest_date:
        event.actual_harvest_date = parse_iso_date(harvest_date)
    else:
        # Default to today if no date provided
        event.actual_harvest_date = get_now()

    # Harvesting implies completion
    event.completed = True
    event.harvest_completed = True
    if event.quantity is not None:
        event.quantity_completed = event.quantity
    _sync_indoor_start_on_completion(event)

    db.session.commit()
    return jsonify(event.to_dict())


@gardens_bp.route('/planting-events/<int:event_id>/variety', methods=['PATCH'])
@login_required
def update_event_variety(event_id):
    """Update variety on a planting event and propagate to succession siblings, plan item, and placed plants."""
    event = PlantingEvent.query.get_or_404(event_id)
    if event.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()
    new_variety = data.get('variety') or None

    updated_event_ids = []
    updated_plan_item_id = None
    updated_planted_ids = []

    # 1. Update this event + succession siblings
    if event.succession_group_id:
        siblings = PlantingEvent.query.filter_by(
            succession_group_id=event.succession_group_id,
            user_id=current_user.id
        ).all()
        for sib in siblings:
            sib.variety = new_variety
            updated_event_ids.append(sib.id)
    else:
        event.variety = new_variety
        updated_event_ids.append(event.id)

    # 2. Propagate to GardenPlanItem via export_key
    # Export key format: {user_id}_{item_id}_{bed_id}_{date}_{i} (bed path)
    #                  or {user_id}_{item_id}_trellis_{trellis_id}_{date}_{i}
    #                  or {user_id}_{item_id}_{date}_{i} (legacy path)
    # Plan item ID is always at index [1].
    plan_item = None
    if event.export_key:
        try:
            plan_item_id = int(event.export_key.split('_')[1])
            plan_item = GardenPlanItem.query.get(plan_item_id)
            if plan_item:
                plan_item.variety = new_variety
                updated_plan_item_id = plan_item.id
        except (ValueError, IndexError):
            logging.warning(f"Could not parse plan item ID from export_key: {event.export_key}")

    # 3. Propagate to PlantedItems via source_plan_item_id
    if plan_item:
        placed = PlantedItem.query.filter_by(
            source_plan_item_id=plan_item.id,
            user_id=current_user.id
        ).all()
        for item in placed:
            item.variety = new_variety
            updated_planted_ids.append(item.id)

    # 4. Propagate to linked IndoorSeedStart records
    for eid in updated_event_ids:
        seed_start = IndoorSeedStart.query.filter_by(
            planting_event_id=eid,
            user_id=current_user.id
        ).first()
        if seed_start:
            seed_start.variety = new_variety

    db.session.commit()
    return jsonify({
        'updated': {
            'plantingEvents': updated_event_ids,
            'gardenPlanItemId': updated_plan_item_id,
            'plantedItems': updated_planted_ids,
        }
    })


@gardens_bp.route('/planting-events/bulk-update', methods=['PATCH'])
@login_required
def bulk_update_events():
    """
    Bulk update completion status for multiple events.
    Supports: mark all complete, mark partial completion, adjust quantities
    """
    data = request.get_json()
    event_ids = data.get('eventIds', [])
    updates = data.get('updates', {})  # {completed, quantityCompleted, quantity}

    if not event_ids:
        return jsonify({'error': 'No event IDs provided'}), 400

    # Get all events and verify ownership
    events = PlantingEvent.query.filter(PlantingEvent.id.in_(event_ids)).all()

    for event in events:
        # Verify ownership
        if event.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Apply updates
        if 'completed' in updates:
            event.completed = updates['completed']
            # Bidirectional sync: completed boolean → quantity_completed
            if 'quantityCompleted' not in updates:
                if updates['completed'] and event.quantity is not None:
                    event.quantity_completed = event.quantity
                elif not updates['completed'] and event.quantity is not None:
                    event.quantity_completed = 0
        if 'quantityCompleted' in updates:
            event.quantity_completed = updates['quantityCompleted']
            # Auto-update completed flag based on quantity
            if event.quantity and event.quantity_completed is not None:
                event.completed = (event.quantity_completed >= event.quantity)
        if 'quantity' in updates:  # Adjust target quantity
            event.quantity = updates['quantity']

        # Sync linked IndoorSeedStart if event is now completed
        _sync_indoor_start_on_completion(event)

    db.session.commit()

    return jsonify({
        'message': f'Updated {len(events)} events',
        'updatedIds': [e.id for e in events]
    }), 200


@gardens_bp.route('/planting-events/check-conflict', methods=['POST'])
@login_required
def check_planting_conflict_route():
    """Check if planting position conflicts with existing plantings"""
    try:
        data = request.json

        # Validate required fields
        required_fields = ['gardenBedId', 'positionX', 'positionY', 'startDate', 'endDate', 'plantId']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        # Get garden bed and verify ownership
        garden_bed = GardenBed.query.get(data['gardenBedId'])
        if not garden_bed:
            return jsonify({'error': 'Garden bed not found'}), 404

        if garden_bed.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403

        # Parse dates
        start_date = parse_iso_date(data['startDate'])
        end_date = parse_iso_date(data['endDate'])

        if not start_date or not end_date:
            return jsonify({'error': 'Invalid date format'}), 400

        # Query PlantedItems directly — ground truth, no orphan issues
        exclude_item_id = data.get('excludeItemId')
        candidate_events = query_candidate_items(
            data['gardenBedId'], current_user.id, exclude_item_id
        )

        # Create temporary event object for conflict checking
        temp_event = type('TempEvent', (), {
            'position_x': data['positionX'],
            'position_y': data['positionY'],
            'garden_bed_id': data['gardenBedId'],
            'plant_id': data['plantId'],
            'transplant_date': parse_iso_date(data.get('transplantDate')) if data.get('transplantDate') else None,
            'direct_seed_date': parse_iso_date(data.get('directSeedDate')) if data.get('directSeedDate') else None,
            'seed_start_date': parse_iso_date(data.get('seedStartDate')) if data.get('seedStartDate') else None,
            'expected_harvest_date': end_date,
            'id': exclude_item_id
        })()

        # Check for conflicts
        result = has_conflict(temp_event, candidate_events, garden_bed)

        return jsonify({
            'hasConflict': result['has_conflict'],
            'conflicts': result['conflicts']
        }), 200

    except KeyError as e:
        return jsonify({'error': f'Missing required field: {str(e)}'}), 400
    except Exception as e:
        # Log error in production
        import os
        if os.getenv('FLASK_ENV') == 'development':
            import traceback
            traceback.print_exc()
        return jsonify({'error': f'Failed to check conflict: {str(e)}'}), 500


@gardens_bp.route('/planting-events/needs-indoor-starts', methods=['GET'])
@login_required
def get_planting_events_needing_indoor_starts():
    """
    Get all planting events that:
    - Have a transplant_date set
    - Plant has weeksIndoors > 0 (can be started indoors)
    - Don't already have a linked indoor seed start
    - Transplant date is in the future (optional filter)

    Query params:
    - include_past: true/false (default: false) - include events with past transplant dates
    - planId: optional int - when present, scope response to rows attributable
      to that plan PLUS rows with null/unresolvable export_key (rendered as
      "Unknown plan"). Rows attributable to other plans are dropped. Omitting
      the param preserves cross-plan behavior (backward compat).
    """
    try:
        include_past = request.args.get('include_past', 'false').lower() == 'true'

        # AUDIT-011: optional planId filter. Validate before any data work so a
        # malformed or cross-user value short-circuits with a clear error.
        plan_id_raw = request.args.get('planId')
        plan_id_filter = None
        if plan_id_raw is not None and plan_id_raw != '':
            try:
                parsed_plan_id = int(plan_id_raw)
            except (ValueError, TypeError):
                return jsonify({'error': 'planId must be a positive integer'}), 400
            if parsed_plan_id <= 0:
                return jsonify({'error': 'planId must be a positive integer'}), 400
            owned = GardenPlan.query.filter_by(
                id=parsed_plan_id, user_id=current_user.id
            ).first()
            if owned is None:
                return jsonify({'error': 'Plan not found'}), 404
            plan_id_filter = parsed_plan_id

        # Query planting events with transplant dates (exclude cancelled)
        query = PlantingEvent.query.filter_by(user_id=current_user.id).filter(
            PlantingEvent.transplant_date.isnot(None),
            PlantingEvent.cancelled_at.is_(None)
        )

        # Filter by future dates unless include_past is true
        if not include_past:
            query = query.filter(PlantingEvent.transplant_date >= get_utc_now())

        events = query.order_by(PlantingEvent.transplant_date).all()

        # Build plan-attribution map: plan_item_id -> (plan_id, plan_name).
        #
        # PlantingEvent has no direct FK to GardenPlan. Attribution is derived
        # from PlantingEvent.export_key, which encodes GardenPlanItem.id as the
        # second underscore-delimited component. Format (see
        # services/garden_planner_service.py lines 770, 867, 928):
        #     "{user_id}_{item.id}_..."
        # A batch lookup keeps the endpoint efficient without requiring a new
        # index on GardenPlanItem.export_key (flagged as a future follow-up).
        plan_item_ids = set()
        event_to_plan_item = {}
        for event in events:
            parsed_item_id = _parse_plan_item_id_from_export_key(event.export_key)
            event_to_plan_item[event.id] = parsed_item_id
            if parsed_item_id is not None:
                plan_item_ids.add(parsed_item_id)

        plan_item_to_plan = {}
        if plan_item_ids:
            plan_rows = (
                db.session.query(
                    GardenPlanItem.id,
                    GardenPlan.id,
                    GardenPlan.name,
                )
                .join(GardenPlan, GardenPlanItem.garden_plan_id == GardenPlan.id)
                .filter(
                    GardenPlanItem.id.in_(plan_item_ids),
                    GardenPlan.user_id == current_user.id,
                )
                .all()
            )
            plan_item_to_plan = {row[0]: (row[1], row[2]) for row in plan_rows}

        # AUDIT-011 Option A (null-handling option ii): when a planId filter is
        # set, drop events attributable to a DIFFERENT known plan. Keep events
        # that match the requested plan AND events whose plan_id can't be
        # resolved (null/missing export_key, or an export_key that doesn't
        # resolve to a plan owned by this user). Unresolvable rows render as
        # "Unknown plan" in the modal — preserves manually-placed and legacy
        # events under scoped mode.
        if plan_id_filter is not None:
            scoped_events = []
            for event in events:
                parsed_item_id = event_to_plan_item.get(event.id)
                plan_info = (
                    plan_item_to_plan.get(parsed_item_id)
                    if parsed_item_id is not None else None
                )
                event_plan_id = plan_info[0] if plan_info else None
                if event_plan_id is None or event_plan_id == plan_id_filter:
                    scoped_events.append(event)
            events = scoped_events

        # Group events by (plant_id, variety, transplant_date, plan_id, bed_id)
        # and sum quantities. plan_id is included in the key so two plans with
        # the same crop+variety+date do NOT silently merge into one row
        # (previous behavior mixed their plantingEventIds and hid the cross-plan
        # span from the user). bed_id stays in the key so Indoor Seed Starts can
        # filter planned rows by destination bed without cross-bed merging.
        grouped = {}
        for event in events:
            # Get plant data
            plant = get_plant_by_id(event.plant_id)
            if not plant:
                continue

            weeks_indoors = plant.get('weeksIndoors', 0)

            # Skip plants that can't be started indoors
            if weeks_indoors == 0:
                continue

            parsed_item_id = event_to_plan_item.get(event.id)
            plan_info = plan_item_to_plan.get(parsed_item_id) if parsed_item_id is not None else None
            event_plan_id = plan_info[0] if plan_info else None
            event_plan_name = plan_info[1] if plan_info else None

            # Group by plant, variety, transplant date, plan id, and bed id
            transplant_date_str = event.transplant_date.date().isoformat()
            group_key = (
                event.plant_id,
                event.variety or '',
                transplant_date_str,
                event_plan_id,
                event.garden_bed_id,
            )

            if group_key not in grouped:
                grouped[group_key] = {
                    'plantingEventIds': [],
                    'plantId': event.plant_id,
                    'plant': plant,
                    'variety': event.variety,
                    'transplantDate': event.transplant_date,
                    'gardenBedId': event.garden_bed_id,
                    'totalQuantity': 0,
                    'notes': event.notes,
                    'planId': event_plan_id,
                    'planName': event_plan_name,
                }

            grouped[group_key]['plantingEventIds'].append(event.id)
            grouped[group_key]['totalQuantity'] += (event.quantity or event.space_required or 1)

        # Filter out groups that already have indoor starts
        # Check if ANY event in the group has an indoor start linked
        filtered_groups = {}
        for group_key, group_data in grouped.items():
            # Check if any event in this group already has an indoor start
            has_indoor_start = IndoorSeedStart.query.filter(
                IndoorSeedStart.user_id == current_user.id,
                IndoorSeedStart.planting_event_id.in_(group_data['plantingEventIds']),
                IndoorSeedStart.cancelled_at.is_(None)
            ).first()

            if not has_indoor_start:
                filtered_groups[group_key] = group_data

        grouped = filtered_groups

        # Collect unique bed IDs and fetch names
        bed_ids = {g['gardenBedId'] for g in grouped.values() if g['gardenBedId']}
        bed_names = {}
        if bed_ids:
            beds = GardenBed.query.filter(
                GardenBed.id.in_(bed_ids),
                GardenBed.user_id == current_user.id
            ).all()
            bed_names = {b.id: b.name for b in beds}

        # Convert grouped data to results
        results = []
        for group_key, group_data in grouped.items():
            plant = group_data['plant']
            transplant_date = group_data['transplantDate']
            weeks_indoors = plant.get('weeksIndoors', 0)
            germination_days = plant.get('germination_days', 7)

            # Calculate suggested indoor start date
            indoor_start_date = transplant_date - timedelta(weeks=weeks_indoors)
            expected_germination_date = indoor_start_date + timedelta(days=germination_days)

            # Determine timing status
            days_until_start = (indoor_start_date.date() - get_utc_now().date()).days
            timing_status = 'good'  # green
            if days_until_start < 0:
                timing_status = 'past'  # red - should have started already
            elif days_until_start < 7:
                timing_status = 'urgent'  # yellow - start soon

            results.append({
                'plantingEventId': group_data['plantingEventIds'][0],  # Primary event ID
                'plantingEventIds': group_data['plantingEventIds'],  # All event IDs in group
                'plantId': group_data['plantId'],
                'plantName': plant['name'],
                'plantIcon': plant.get('icon', '🌱'),
                'variety': group_data['variety'],
                'gardenBedId': group_data['gardenBedId'],
                'gardenBedName': bed_names.get(group_data['gardenBedId']),
                'transplantDate': transplant_date.isoformat(),
                'weeksIndoors': weeks_indoors,
                'germinationDays': germination_days,
                'suggestedIndoorStartDate': indoor_start_date.isoformat(),
                'expectedGerminationDate': expected_germination_date.isoformat(),
                'daysUntilStart': days_until_start,
                'timingStatus': timing_status,
                'canStartIndoors': True,
                'notes': group_data['notes'],
                'spaceRequired': group_data['totalQuantity'],  # Sum of all plants in group
                'planId': group_data['planId'],
                'planName': group_data['planName'],
            })

        return jsonify({
            'events': results,
            'count': len(results)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 400


@gardens_bp.route('/planting-events/audit-conflicts', methods=['GET'])
@login_required
def audit_conflicts():
    """
    Find all existing conflicts in user's gardens.

    Scans all positioned planting events and identifies pairs with
    overlapping space and time. Used for cleaning up pre-enforcement data.

    Returns:
        JSON with total_conflicts count and list of conflict details
    """
    user_id = current_user.id

    # Query PlantedItems directly — ground truth, no orphan issues
    # Group by garden bed for efficient checking
    beds = GardenBed.query.filter_by(user_id=user_id).all()
    beds_map = {}
    for bed in beds:
        events = query_candidate_items(bed.id, user_id)
        if events:
            beds_map[bed.id] = {'bed': bed, 'events': events}

    # Find conflicts within each bed
    conflicts_found = []
    checked_pairs = set()  # Avoid duplicate pair checking (A-B = B-A)

    for bed_id, bed_data in beds_map.items():
        bed = bed_data['bed']
        bed_events = bed_data['events']

        for i, event_a in enumerate(bed_events):
            for event_b in bed_events[i+1:]:  # Only check each pair once
                pair_key = tuple(sorted([event_a.id, event_b.id]))
                if pair_key in checked_pairs:
                    continue
                checked_pairs.add(pair_key)

                # Check if these two events conflict
                result = has_conflict(event_a, [event_b], bed)

                if result['has_conflict']:
                    plant_a = get_plant_by_id(event_a.plant_id)
                    plant_b = get_plant_by_id(event_b.plant_id)

                    start_a = get_primary_planting_date(event_a)
                    start_b = get_primary_planting_date(event_b)

                    conflicts_found.append({
                        'gardenBedId': bed_id,
                        'gardenBedName': bed.name if bed else f'Bed {bed_id}',
                        'position': {
                            'x': event_a.position_x,
                            'y': event_a.position_y
                        },
                        'eventA': {
                            'id': event_a.id,
                            'plantName': plant_a.get('name', 'Unknown') if plant_a else 'Unknown',
                            'variety': event_a.variety,
                            'startDate': start_a.isoformat() if start_a else None,
                            'endDate': event_a.expected_harvest_date.isoformat() if event_a.expected_harvest_date else None
                        },
                        'eventB': {
                            'id': event_b.id,
                            'plantName': plant_b.get('name', 'Unknown') if plant_b else 'Unknown',
                            'variety': event_b.variety,
                            'startDate': start_b.isoformat() if start_b else None,
                            'endDate': event_b.expected_harvest_date.isoformat() if event_b.expected_harvest_date else None
                        }
                    })

    return jsonify({
        'total_conflicts': len(conflicts_found),
        'conflicts': conflicts_found
    }), 200
