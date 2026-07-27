"""
Ownership lookups for cross-user foreign-key validation.

These helpers answer "may the current user reference this row?" for foreign
keys that arrive in a request body. They deliberately return the row or
``None`` and contain no Flask response logic, because the blueprints genuinely
disagree on the right failure code (403 in gardens/livestock/photos, 404 in
utilities/garden_planner, 400 where the caller's contract is an error string).
Callers emit their own response so each blueprint stays internally consistent.

This mirrors the shape of the existing file-local helpers
``_get_owned_planted_item`` / ``_get_owned_planting_event`` in
``blueprints/harvests_bp.py``.
"""
from flask_login import current_user
from sqlalchemy import or_

from models import SeedInventory, GardenBed


def _resolve_user_id(user_id):
    return user_id if user_id is not None else current_user.id


def get_usable_seed(seed_id, user_id=None):
    """Return the seed only if the user is allowed to reference it.

    A seed is usable when it is either the user's own packet OR part of the
    shared global catalog. Global rows (``user_id`` NULL / ``is_global`` True)
    are visible to everyone by design — this is the same rule
    ``seeds_bp._visible_seed_filter`` applies to seed listings.

    That carve-out is the reason this lives in one place: inlining the
    ``or_(...)`` at each of its call sites is where a future "closed the leak,
    broke the shared catalog" regression would come from.

    Returns None if ``seed_id`` is None, unknown, or owned by another user.
    """
    if seed_id is None:
        return None

    return SeedInventory.query.filter(
        SeedInventory.id == seed_id,
        or_(
            SeedInventory.is_global == True,  # noqa: E712 - SQL, not Python
            SeedInventory.user_id == _resolve_user_id(user_id),
        ),
    ).first()


def get_owned_bed(bed_id, user_id=None):
    """Return the garden bed only if it belongs to the user.

    Unlike seeds there is no shared-bed concept — a bed is either yours or
    off-limits.
    """
    if bed_id is None:
        return None

    return GardenBed.query.filter_by(
        id=bed_id, user_id=_resolve_user_id(user_id)
    ).first()


def owns_all_beds(bed_ids, user_id=None):
    """True when every id in ``bed_ids`` is a bed owned by the user.

    Used for batch fields such as ``destinationBedIds`` and plan-item bed
    assignments. An empty/None collection is vacuously True.
    """
    if not bed_ids:
        return True

    unique_ids = {int(bid) for bid in bed_ids}
    owned = GardenBed.query.filter(
        GardenBed.id.in_(unique_ids),
        GardenBed.user_id == _resolve_user_id(user_id),
    ).count()
    return owned == len(unique_ids)
