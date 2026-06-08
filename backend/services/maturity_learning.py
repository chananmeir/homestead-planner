"""
Maturity-learning service.

Learns a recency-weighted "days to maturity" (DTM) per
(user_id, plant_id, variety, sun_exposure, covered) from bed-linked harvests
that carry a maturity signal, and resolves an effective DTM for predictions.

Key points:
- The harvest *date* alone is not the signal: pulling a crop early means the true
  DTM is *longer* than observed. ``maturity_feedback`` supplies the direction of
  correction via MATURITY_MULTIPLIERS.
- Learned values are materialized into VarietyMaturityModel and only recomputed on
  the (rare) harvest write. ``resolve_dtm`` is the hot read path used by predictions
  and the "Harvest ready" badge.
- NULL semantics: an exact row always has a concrete ``sun_exposure`` (coalesced to
  'unknown' when the bed has none) and a concrete boolean ``covered``. The single row
  with ``sun_exposure IS NULL AND covered IS NULL`` is the variety-wide aggregate
  fallback that spans every sample for the variety.
- NULL-vs-falsy: ``days_in_ground == 0`` and a learned/override DTM of ``0`` are valid;
  everything uses ``is not None`` checks.
"""
import json

from simulation_clock import get_utc_now
from models import db, HarvestRecord, VarietyMaturityModel
from plant_database import get_plant_by_id

# Direction-of-correction multipliers applied to observed days-in-ground.
# too_early => crop needed longer (DTM larger); too_late => DTM smaller.
MATURITY_MULTIPLIERS = {
    'on_time': 1.0,
    'too_early': 1.15,
    'too_late': 0.90,
}
HALF_LIFE_YEARS = 2.0
DTM_FALLBACK = 60

# Sentinel used so an exact row never collides with the aggregate (NULL) row when a
# bed has no sun_exposure recorded.
_UNKNOWN_SUN = 'unknown'


def naive(dt):
    """Drop tzinfo so naive (planted_date) and possibly-aware (parsed harvest_date)
    datetimes can be subtracted. The codebase stores both kinds."""
    if dt is not None and dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


def bed_is_covered(bed):
    """True if a GardenBed has a meaningful season-extension (row cover / tunnel / etc.).

    Derived from GardenBed.season_extension (JSON). A missing/empty structure, or one
    whose type is 'none', counts as uncovered. JSON parsing is guarded so a malformed
    value never breaks capture or prediction.
    """
    if bed is None or not bed.season_extension:
        return False
    try:
        parsed = json.loads(bed.season_extension)
    except (json.JSONDecodeError, TypeError):
        return False
    if isinstance(parsed, dict):
        return bool(parsed) and parsed.get('type') not in (None, '', 'none')
    return bool(parsed)


def bed_sun_exposure(bed):
    """Bed sun-exposure coalesced to 'unknown' so exact buckets never collide with the
    variety-wide aggregate (NULL) row."""
    return (bed.sun_exposure if bed is not None else None) or _UNKNOWN_SUN


def per_harvest_estimate(days_in_ground, feedback):
    """Corrected DTM estimate for a single harvest, or None if not usable."""
    if days_in_ground is None:
        return None
    multiplier = MATURITY_MULTIPLIERS.get(feedback)
    if multiplier is None:
        return None
    return days_in_ground * multiplier


def _exact_sun(sun_exposure):
    return sun_exposure if sun_exposure else _UNKNOWN_SUN


def recompute_key(user_id, plant_id, variety, sun_exposure, covered, now=None):
    """
    Recompute (EWMA) the learned DTM for one key and upsert/delete its
    VarietyMaturityModel row. The caller is responsible for committing.

    ``sun_exposure is None and covered is None`` selects the variety-wide aggregate
    row (spans all samples for the variety); any other key is an exact bucket.
    """
    if now is None:
        now = get_utc_now()

    is_aggregate = sun_exposure is None and covered is None

    q = HarvestRecord.query.filter_by(user_id=user_id, plant_id=plant_id)
    q = q.filter(HarvestRecord.variety_snapshot == variety)
    if not is_aggregate:
        q = q.filter(
            HarvestRecord.sun_exposure_snapshot == sun_exposure,
            HarvestRecord.covered_snapshot == covered,
        )
    q = q.filter(
        HarvestRecord.maturity_feedback.isnot(None),
        HarvestRecord.days_in_ground.isnot(None),
    )

    total_w = 0.0
    total_wv = 0.0
    count = 0
    for r in q.all():
        est = per_harvest_estimate(r.days_in_ground, r.maturity_feedback)
        if est is None:
            continue
        if r.harvest_date is not None:
            years_ago = max(0.0, (naive(now) - naive(r.harvest_date)).days / 365.25)
        else:
            years_ago = 0.0
        w = 0.5 ** (years_ago / HALF_LIFE_YEARS)
        total_w += w
        total_wv += w * est
        count += 1

    existing = VarietyMaturityModel.query.filter_by(
        user_id=user_id, plant_id=plant_id, variety=variety,
        sun_exposure=sun_exposure, covered=covered,
    ).first()

    if count == 0 or total_w == 0:
        if existing is not None:
            db.session.delete(existing)
        return

    learned = int(round(total_wv / total_w))
    if existing is None:
        db.session.add(VarietyMaturityModel(
            user_id=user_id, plant_id=plant_id, variety=variety,
            sun_exposure=sun_exposure, covered=covered,
            learned_dtm=learned, sample_count=count, last_recomputed=now,
        ))
    else:
        existing.learned_dtm = learned
        existing.sample_count = count
        existing.last_recomputed = now


def refresh_from_harvest(record, now=None):
    """Recompute both the exact key and the variety-wide aggregate for a record."""
    if record is None or record.user_id is None or record.plant_id is None:
        return
    variety = record.variety_snapshot
    sun = record.sun_exposure_snapshot
    covered = record.covered_snapshot
    # Exact bucket (only meaningful if the record actually carries a learning signal).
    if sun is not None or covered is not None:
        recompute_key(record.user_id, record.plant_id, variety, sun, covered, now=now)
    # Variety-wide aggregate fallback.
    recompute_key(record.user_id, record.plant_id, variety, None, None, now=now)


def resolve_dtm_optional(user_id, plant_id, variety, sun_exposure, covered, seed_inventory=None):
    """
    Effective DTM or None. Precedence (each tier uses ``is not None`` so a legitimate
    value of 0 is respected):

      1. manual SeedInventory.days_to_maturity override
      2. exact (variety + sun_exposure + covered) learned row
      3. variety-wide aggregate learned row (sun/covered NULL)
      4. plant-database default
      5. None  (no known DTM — caller decides whether to apply a fallback)

    Returning None when nothing is known preserves existing "no estimate" behavior at
    call sites that intentionally leave harvest_date unset for DTM-less plants.
    """
    # 1. Manual override
    if seed_inventory is not None and getattr(seed_inventory, 'days_to_maturity', None) is not None:
        return seed_inventory.days_to_maturity

    # 2. Exact learned bucket
    exact = VarietyMaturityModel.query.filter_by(
        user_id=user_id, plant_id=plant_id, variety=variety,
        sun_exposure=_exact_sun(sun_exposure), covered=bool(covered),
    ).first()
    if exact is not None and exact.learned_dtm is not None:
        return exact.learned_dtm

    # 3. Variety-wide aggregate
    agg = VarietyMaturityModel.query.filter_by(
        user_id=user_id, plant_id=plant_id, variety=variety,
        sun_exposure=None, covered=None,
    ).first()
    if agg is not None and agg.learned_dtm is not None:
        return agg.learned_dtm

    # 4. Plant-database default
    plant = get_plant_by_id(plant_id)
    if plant is not None:
        default_dtm = plant.get('daysToMaturity')
        if default_dtm is not None:
            return default_dtm

    # 5. Unknown
    return None


def resolve_dtm(user_id, plant_id, variety, sun_exposure, covered, seed_inventory=None):
    """Like resolve_dtm_optional but always returns an int, applying DTM_FALLBACK when
    no DTM is known. Use at sites that already substituted a hard fallback."""
    dtm = resolve_dtm_optional(
        user_id, plant_id, variety, sun_exposure, covered, seed_inventory=seed_inventory
    )
    return dtm if dtm is not None else DTM_FALLBACK
