"""Crop outcome feedback-loop services.

Turns recorded outcomes into opt-in per-variety learning suggestions.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Dict, Iterable, List, Optional, Tuple

from sqlalchemy import or_

from historical_soil_temp import (
    get_actual_daily_air_temps,
    get_actual_daily_soil_temps,
    get_historical_daily_soil_temps,
)
from models import (
    db,
    GardenPlanItem,
    HarvestRecord,
    PlantingOutcomeHistory,
    PlantedItem,
    Property,
    SeedInventory,
)
from plant_database import get_plant_by_id
from services.plant_outcome_service import PlantOutcomeError, mark_planted_item_outcome


class FeedbackLoopError(Exception):
    def __init__(self, message: str, status_code: int = 400, error_code: str | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code


# V1 verifies whether frost/cold exposure is plausible for the recorded failure,
# not whether the crop hit an absolute lethal temperature.
FROST_VERIFICATION_THRESHOLDS = {
    'very-tender': 32,
    'tender': 32,
    'half-hardy': 30,
    'semi-hardy': 30,
    'hardy': 28,
    'very-hardy': 24,
}

POSITIVE_SOW_DATE_WEIGHTS = {
    'excellent': 2.0,
    'good': 1.0,
}
NEGATIVE_SOW_DATE_WEIGHTS = {
    'poor': -1.0,
    'didnt_establish': -2.0,
    'failed': -2.0,
}


def _as_date(value) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


def _month_day_label(month_day: str) -> str:
    parsed = datetime.strptime(f"2001-{month_day}", "%Y-%m-%d")
    return f"{parsed.strftime('%b')} {parsed.day}"


def _validate_month_day(month_day: str) -> str:
    try:
        datetime.strptime(f"2001-{month_day}", "%Y-%m-%d")
    except (TypeError, ValueError):
        raise FeedbackLoopError("recommendationMonthDay must be MM-DD", error_code="invalid_month_day")
    return month_day


def _month_day_from_date(value: date) -> str:
    return f"{value.month:02d}-{value.day:02d}"


def _day_of_year_from_month_day(month_day: str) -> int:
    parsed = datetime.strptime(f"2001-{month_day}", "%Y-%m-%d").date()
    return parsed.timetuple().tm_yday


def _month_day_from_day_of_year(day_of_year: int) -> str:
    clamped = max(1, min(365, int(day_of_year)))
    resolved = date(2001, 1, 1) + timedelta(days=clamped - 1)
    return _month_day_from_date(resolved)


def _planting_date_for_item(item: PlantedItem) -> Optional[date]:
    return _as_date(item.transplant_date or item.planted_date)


def _history_query(user_id: int, plant_id: str, variety: Optional[str]):
    query = PlantingOutcomeHistory.query.filter(
        PlantingOutcomeHistory.user_id == user_id,
        PlantingOutcomeHistory.plant_id == plant_id,
    )
    if variety is None:
        return query.filter(PlantingOutcomeHistory.variety.is_(None))
    return query.filter(PlantingOutcomeHistory.variety == variety)


def _recompute_proven_sow_date(seed: SeedInventory, plant_id: str, variety: Optional[str]) -> Optional[str]:
    rows = _history_query(seed.user_id, plant_id, variety).all()
    weighted_total = 0.0
    weight_total = 0.0
    for row in rows:
        magnitude = abs(float(row.weight or 0))
        if magnitude <= 0:
            continue
        weighted_total += magnitude * int(row.target_day_of_year)
        weight_total += magnitude

    if weight_total <= 0:
        seed.proven_sow_month_day = None
        seed.proven_sow_notes = None
        seed.proven_sow_updated_at = datetime.utcnow()
        return None

    recommended_doy = int((weighted_total / weight_total) + 0.5)
    month_day = _month_day_from_day_of_year(recommended_doy)
    seed.proven_sow_month_day = month_day
    seed.proven_sow_updated_at = datetime.utcnow()
    seed.proven_sow_notes = (
        f"Computed from {len(rows)} planting outcome "
        f"{'record' if len(rows) == 1 else 'records'}; "
        f"weighted recommendation {_month_day_label(month_day)}."
    )
    return month_day


def _source_outcome_record_for_item(user_id: int, item_id: int) -> Optional[HarvestRecord]:
    return HarvestRecord.query.filter_by(
        user_id=user_id,
        source_key=f'outcome:planted_item:{item_id}',
    ).first()


def _upsert_sow_date_history(
    *,
    user_id: int,
    plant_id: str,
    variety: Optional[str],
    year: int,
    sow_date: date,
    target_month_day: str,
    harvest_date: Optional[datetime],
    yield_rating: str,
    weight: float,
    source_harvest_id: Optional[int],
) -> PlantingOutcomeHistory:
    target_month_day = _validate_month_day(target_month_day)
    history = None
    if source_harvest_id is not None:
        history = PlantingOutcomeHistory.query.filter_by(
            user_id=user_id,
            source_harvest_id=source_harvest_id,
        ).first()
    if history is None:
        query = _history_query(user_id, plant_id, variety).filter(
            PlantingOutcomeHistory.year == year,
            PlantingOutcomeHistory.sow_date == sow_date,
            PlantingOutcomeHistory.yield_rating == yield_rating,
        )
        history = query.first()

    if history is None:
        history = PlantingOutcomeHistory(
            user_id=user_id,
            plant_id=plant_id,
            variety=variety,
        )
        db.session.add(history)

    history.year = year
    history.sow_date = sow_date
    history.target_month_day = target_month_day
    history.target_day_of_year = _day_of_year_from_month_day(target_month_day)
    history.harvest_date = harvest_date
    history.yield_rating = yield_rating
    history.weight = float(weight)
    history.source_harvest_id = source_harvest_id
    history.updated_at = datetime.utcnow()
    return history


def _label_for_crop(plant_id: str, variety: Optional[str]) -> str:
    plant = get_plant_by_id(plant_id)
    label = plant.get("name") if plant else plant_id
    if variety:
        label = f"{label} ({variety})"
    return label


def _first_property_location(user_id: int) -> Tuple[Optional[Property], Optional[Dict]]:
    prop = Property.query.filter_by(user_id=user_id).order_by(Property.id.asc()).first()
    if prop is None or prop.latitude is None or prop.longitude is None:
        return prop, None
    return prop, {
        "latitude": prop.latitude,
        "longitude": prop.longitude,
        "zipCode": prop.zipcode,
        "zone": prop.zone,
        "label": f"ZIP {prop.zipcode}" if prop.zipcode else prop.address or "saved property location",
    }


def _candidate_seed_query(user_id: int, plant_id: str, variety: Optional[str], personal_only: bool):
    query = SeedInventory.query.filter(SeedInventory.plant_id == plant_id)
    if personal_only:
        query = query.filter(SeedInventory.user_id == user_id)
    else:
        query = query.filter(or_(SeedInventory.user_id == user_id, SeedInventory.is_global == True))
    if variety:
        query = query.filter(SeedInventory.variety == variety)
    return query.order_by(SeedInventory.user_id.is_(None), SeedInventory.id.asc())


def _source_seed_from_plan(user_id: int, source_plan_item_id: Optional[int]) -> Optional[SeedInventory]:
    if source_plan_item_id is None:
        return None
    plan_item = GardenPlanItem.query.get(source_plan_item_id)
    if (
        plan_item is None
        or plan_item.seed_inventory_id is None
        or plan_item.garden_plan is None
        or plan_item.garden_plan.user_id != user_id
    ):
        return None
    seed = SeedInventory.query.get(plan_item.seed_inventory_id)
    if seed is None or seed.plant_id != plan_item.plant_id:
        return None
    return seed


def _resolve_seed_for_context(user_id: int, plant_id: str, variety: Optional[str], source_plan_item_id: Optional[int]) -> Optional[SeedInventory]:
    seed = _source_seed_from_plan(user_id, source_plan_item_id)
    if seed is not None:
        return seed
    return _candidate_seed_query(user_id, plant_id, variety, personal_only=False).first()


def _resolve_writable_seed_for_context(
    user_id: int,
    plant_id: str,
    variety: Optional[str],
    source_plan_item_id: Optional[int],
) -> SeedInventory:
    seed = _source_seed_from_plan(user_id, source_plan_item_id)
    if seed is not None and seed.user_id == user_id:
        return seed

    personal = _candidate_seed_query(user_id, plant_id, variety, personal_only=True).first()
    if personal is not None:
        return personal

    plant = get_plant_by_id(plant_id)
    fallback_variety = variety or (plant.get("name") if plant else plant_id)
    seed = SeedInventory(
        user_id=user_id,
        plant_id=plant_id,
        variety=fallback_variety,
        quantity=0,
        notes="Created from crop feedback loop so learned variety adjustments can be stored.",
    )
    db.session.add(seed)
    db.session.flush()
    return seed


def _germination_floor(seed: Optional[SeedInventory], plant: Optional[Dict]) -> Optional[int]:
    if seed is not None:
        if seed.germination_temp_min is not None:
            return seed.germination_temp_min
        if seed.soil_temp_min is not None:
            return seed.soil_temp_min
    if plant is None:
        return None
    if plant.get("soil_temp_min") is not None:
        return plant.get("soil_temp_min")
    germ = plant.get("germinationTemp") or {}
    return germ.get("min")


def _frost_threshold(plant: Optional[Dict]) -> Tuple[str, int]:
    frost_tolerance = 'tender'
    if plant is not None:
        frost_tolerance = (
            plant.get('frostTolerance')
            or plant.get('frost_tolerance')
            or frost_tolerance
        )
    return frost_tolerance, FROST_VERIFICATION_THRESHOLDS.get(frost_tolerance, FROST_VERIFICATION_THRESHOLDS['tender'])


def _max_consecutive_below(temps: Iterable[float], floor_f: float) -> int:
    best = 0
    current = 0
    for temp in temps:
        if temp < floor_f:
            current += 1
            best = max(best, current)
        else:
            current = 0
    return best


def _mean(values: List[float]) -> Optional[float]:
    if not values:
        return None
    return round(sum(values) / len(values), 1)


def _cold_soil_alternative(
    item: PlantedItem,
    location: Dict,
    seed: Optional[SeedInventory],
    plant: Optional[Dict],
    planted_day: date,
) -> Optional[Dict]:
    if item.transplant_date is not None:
        return None

    floor_f = _germination_floor(seed, plant)
    if floor_f is None:
        return None

    actuals = get_actual_daily_soil_temps(
        location["latitude"],
        location["longitude"],
        planted_day,
        planted_day + timedelta(days=13),
    )
    if not actuals or len(actuals) < 7:
        return None

    temps = [entry["temperature"] for entry in actuals if entry.get("temperature") is not None]
    first_7 = temps[:7]
    first_10 = temps[:10]
    if len(first_7) < 7:
        return None

    first_7_mean = _mean(first_7)
    first_10_consecutive = _max_consecutive_below(first_10, floor_f)
    if not (
        (first_7_mean is not None and first_7_mean < floor_f)
        or first_10_consecutive >= 4
    ):
        return None

    return {
        "suggestedOutcome": "didnt_establish",
        "suggestedReason": "poor_germination",
        "rationale": (
            f"Soil averaged {first_7_mean}F vs {floor_f}F germination floor "
            "in the first week after sowing."
        ),
        "evidence": {
            "floorF": floor_f,
            "sownDate": planted_day.isoformat(),
            "first7MeanF": first_7_mean,
            "first7BelowFloorDays": sum(1 for temp in first_7 if temp < floor_f),
            "first7MinF": round(min(first_7), 1) if first_7 else None,
            "first10ConsecutiveBelowFloorDays": first_10_consecutive,
            "dataPoints": len(temps),
        },
    }


def _format_fahrenheit(value: Optional[float]) -> str:
    if value is None:
        return "unknown"
    return f"{value:g}F"


def _find_sustained_normals_crossing(
    latitude: float,
    longitude: float,
    floor_f: float,
    sustained_days: int = 5,
) -> Optional[str]:
    days: List[Tuple[str, Optional[float]]] = []
    for month in range(1, 13):
        daily = get_historical_daily_soil_temps(latitude, longitude, month)
        if not daily:
            continue
        for day in sorted(k for k in daily.keys() if isinstance(k, int)):
            try:
                datetime.strptime(f"2001-{month:02d}-{day:02d}", "%Y-%m-%d")
            except ValueError:
                continue
            days.append((f"{month:02d}-{day:02d}", daily.get(day)))

    for index in range(0, max(0, len(days) - sustained_days + 1)):
        window = days[index:index + sustained_days]
        if len(window) == sustained_days and all(temp is not None and temp >= floor_f for _, temp in window):
            return window[0][0]
    return None


def diagnose_sow_date_for_planted_item(user_id: int, item_id: int) -> Dict:
    item = PlantedItem.query.filter_by(id=item_id, user_id=user_id).first()
    if item is None:
        raise FeedbackLoopError("Planted item not found", status_code=404, error_code="not_found")
    if item.outcome != "didnt_establish":
        return {
            "status": "not_applicable",
            "reason": "Only did-not-establish outcomes can trigger sow-date diagnosis.",
        }

    _, location = _first_property_location(user_id)
    if location is None:
        return {
            "status": "needs_location",
            "errorCode": "location_required",
            "message": "Set your ZIP code before soil-temperature diagnosis can run.",
        }

    planted_day = _as_date(item.transplant_date or item.planted_date)
    if planted_day is None:
        return {
            "status": "unavailable",
            "errorCode": "missing_planted_date",
            "message": "This planted item does not have a planted date.",
        }

    plant = get_plant_by_id(item.plant_id)
    seed = _resolve_seed_for_context(user_id, item.plant_id, item.variety, item.source_plan_item_id)
    floor_f = _germination_floor(seed, plant)
    if floor_f is None:
        return {
            "status": "unavailable",
            "errorCode": "missing_germination_floor",
            "message": "No germination soil-temperature floor is available for this crop.",
        }

    actuals = get_actual_daily_soil_temps(
        location["latitude"],
        location["longitude"],
        planted_day,
        planted_day + timedelta(days=13),
    )
    if not actuals or len(actuals) < 7:
        return {
            "status": "unavailable",
            "errorCode": "insufficient_actuals",
            "message": "Not enough archive soil-temperature data is available for this sowing window.",
        }

    temps = [entry["temperature"] for entry in actuals if entry.get("temperature") is not None]
    first_7 = temps[:7]
    first_10 = temps[:10]
    first_7_mean = _mean(first_7)
    first_10_consecutive = _max_consecutive_below(first_10, floor_f)
    too_early = (
        (first_7_mean is not None and first_7_mean < floor_f)
        or first_10_consecutive >= 4
    )

    evidence = {
        "floorF": floor_f,
        "sownDate": planted_day.isoformat(),
        "first7MeanF": first_7_mean,
        "first7BelowFloorDays": sum(1 for temp in first_7 if temp < floor_f),
        "first7MinF": round(min(first_7), 1) if first_7 else None,
        "first10ConsecutiveBelowFloorDays": first_10_consecutive,
        "fullWindowMeanF": _mean(temps),
        "dataPoints": len(temps),
    }

    if not too_early:
        return {
            "status": "no_suggestion",
            "location": location,
            "plantId": item.plant_id,
            "variety": item.variety,
            "evidence": evidence,
            "message": "The early germination window was not clearly below the crop's soil-temperature floor.",
        }

    month_day = _find_sustained_normals_crossing(
        location["latitude"],
        location["longitude"],
        floor_f,
    )
    if month_day is None:
        return {
            "status": "unavailable",
            "location": location,
            "plantId": item.plant_id,
            "variety": item.variety,
            "evidence": evidence,
            "errorCode": "normals_unavailable",
            "message": "Could not calculate a reliable normal-year sow-date crossing.",
        }

    return {
        "status": "suggestion",
        "location": location,
        "plantId": item.plant_id,
        "plantName": plant.get("name") if plant else item.plant_id,
        "variety": item.variety,
        "evidence": evidence,
        "recommendation": {
            "monthDay": month_day,
            "label": _month_day_label(month_day),
            "basis": f"first sustained 5-day normal soil-temperature crossing at or above {floor_f}F",
        },
        "message": "This sowing likely started too cold for reliable germination.",
    }


def verify_failure_reason_for_planted_item(user_id: int, item_id: int) -> Dict:
    item = PlantedItem.query.filter_by(id=item_id, user_id=user_id).first()
    if item is None:
        raise FeedbackLoopError("Planted item not found", status_code=404, error_code="not_found")

    if item.outcome != "failed":
        return {
            "status": "not_applicable",
            "reason": item.outcome_reason,
            "message": "Only failed outcomes can trigger failure-reason verification.",
        }

    if item.outcome_reason != "weather_frost":
        return {
            "status": "not_applicable",
            "reason": item.outcome_reason,
            "message": "Only weather/frost failures can be checked against archived temperatures in v1.",
        }

    _, location = _first_property_location(user_id)
    if location is None:
        return {
            "status": "needs_location",
            "errorCode": "location_required",
            "reason": item.outcome_reason,
            "message": "Set your ZIP code before weather/frost verification can run.",
        }

    planted_day = _as_date(item.transplant_date or item.planted_date)
    if planted_day is None:
        return {
            "status": "unavailable",
            "errorCode": "missing_planted_date",
            "reason": item.outcome_reason,
            "message": "This planted item does not have a planted date.",
        }

    outcome_day = _as_date(item.outcome_date)
    if outcome_day is None:
        return {
            "status": "unavailable",
            "errorCode": "missing_outcome_date",
            "reason": item.outcome_reason,
            "message": "This planted item does not have an outcome date.",
        }
    if outcome_day < planted_day:
        return {
            "status": "unavailable",
            "errorCode": "invalid_window",
            "reason": item.outcome_reason,
            "message": "The outcome date is before the planting date.",
        }

    plant = get_plant_by_id(item.plant_id)
    plant_name = plant.get("name") if plant else item.plant_id
    frost_tolerance, threshold_f = _frost_threshold(plant)

    actuals = get_actual_daily_air_temps(
        location["latitude"],
        location["longitude"],
        planted_day,
        outcome_day,
    )
    temps = [
        entry
        for entry in (actuals or [])
        if entry.get("temperature") is not None and entry.get("date") is not None
    ]
    expected_points = (outcome_day - planted_day).days + 1
    minimum_points = max(1, int(expected_points * 0.8))
    if len(temps) < minimum_points:
        return {
            "status": "unavailable",
            "errorCode": "insufficient_actuals",
            "reason": item.outcome_reason,
            "location": location,
            "window": {
                "start": planted_day.isoformat(),
                "end": outcome_day.isoformat(),
            },
            "message": "Not enough archive air-temperature data is available for this growing window.",
        }

    coldest = min(temps, key=lambda entry: entry["temperature"])
    days_at_or_below = [
        entry for entry in temps
        if entry["temperature"] <= threshold_f
    ]
    verdict = "confirmed" if days_at_or_below else "unlikely"
    coldest_temp = round(float(coldest["temperature"]), 1)
    coldest_date = coldest["date"].isoformat()

    evidence = {
        "thresholdF": threshold_f,
        "frostTolerance": frost_tolerance,
        "windowMinAirF": coldest_temp,
        "daysAtOrBelowThreshold": len(days_at_or_below),
        "coldestDate": coldest_date,
        "dataPoints": len(temps),
    }

    alternative = None
    if verdict == "unlikely":
        alternative = _cold_soil_alternative(
            item,
            location,
            _resolve_seed_for_context(user_id, item.plant_id, item.variety, item.source_plan_item_id),
            plant,
            planted_day,
        )

    if verdict == "confirmed":
        message = (
            f"Weather/frost is plausible: the actual low reached "
            f"{_format_fahrenheit(coldest_temp)} on {coldest_date}, at or below "
            f"the {frost_tolerance} threshold of {threshold_f}F for {plant_name}."
        )
    else:
        message = (
            f"Weather/frost is unlikely: the lowest actual air temperature was "
            f"{_format_fahrenheit(coldest_temp)} on {coldest_date}, above "
            f"the {frost_tolerance} threshold of {threshold_f}F for {plant_name}."
        )

    result = {
        "status": "verdict",
        "reason": item.outcome_reason,
        "verdict": verdict,
        "plantId": item.plant_id,
        "plantName": plant_name,
        "variety": item.variety,
        "location": location,
        "window": {
            "start": planted_day.isoformat(),
            "end": outcome_day.isoformat(),
        },
        "evidence": evidence,
        "message": message,
    }
    if alternative is not None:
        result["alternative"] = alternative
    return result


def apply_failure_reason_correction(user_id: int, item_id: int) -> Dict:
    verification = verify_failure_reason_for_planted_item(user_id, item_id)
    alternative = verification.get("alternative") or {}
    if (
        verification.get("status") != "verdict"
        or verification.get("verdict") != "unlikely"
        or alternative.get("suggestedOutcome") != "didnt_establish"
        or alternative.get("suggestedReason") != "poor_germination"
    ):
        raise FeedbackLoopError(
            "Reason correction is only available when frost is unlikely and cold-soil germination is the better explanation.",
            status_code=409,
            error_code="correction_not_available",
        )

    item = PlantedItem.query.filter_by(id=item_id, user_id=user_id).first()
    if item is None:
        raise FeedbackLoopError("Planted item not found", status_code=404, error_code="not_found")
    if item.outcome != "failed" or item.outcome_reason != "weather_frost":
        raise FeedbackLoopError(
            "This item is no longer recorded as a weather/frost failure.",
            status_code=409,
            error_code="outcome_changed",
        )
    if item.outcome_date is None:
        raise FeedbackLoopError(
            "This planted item does not have an outcome date.",
            status_code=409,
            error_code="missing_outcome_date",
        )

    try:
        correction = mark_planted_item_outcome(
            item,
            outcome="didnt_establish",
            reason="poor_germination",
            outcome_date=item.outcome_date,
            notes=item.outcome_notes,
        )
    except PlantOutcomeError as exc:
        raise FeedbackLoopError(str(exc), status_code=exc.status_code)

    sow_date_diagnosis = diagnose_sow_date_for_planted_item(user_id, item_id)
    db.session.commit()

    return {
        "status": "applied",
        "message": "Reclassified as didn't establish / poor germination based on archived temperature evidence.",
        "plantedItem": correction["plantedItem"].to_dict(),
        "plantingEvent": correction["plantingEvent"].to_dict() if correction["plantingEvent"] else None,
        "harvestRecord": correction["harvestRecord"].to_dict() if correction["harvestRecord"] else None,
        "verification": verification,
        "sowDateDiagnosis": sow_date_diagnosis,
    }


def apply_sow_date_adjustment(user_id: int, item_id: int, recommendation_month_day: str) -> Dict:
    recommendation_month_day = _validate_month_day(recommendation_month_day)
    item = PlantedItem.query.filter_by(id=item_id, user_id=user_id).first()
    if item is None:
        raise FeedbackLoopError("Planted item not found", status_code=404, error_code="not_found")
    if item.outcome != "didnt_establish":
        raise FeedbackLoopError("Sow-date feedback only applies to did-not-establish outcomes", status_code=409)

    seed = _resolve_writable_seed_for_context(
        user_id,
        item.plant_id,
        item.variety,
        item.source_plan_item_id,
    )
    plant = get_plant_by_id(item.plant_id)
    label = plant.get("name") if plant else item.plant_id
    if item.variety:
        label = f"{label} ({item.variety})"

    seed.earliest_sow_month_day = recommendation_month_day
    seed.sow_adjustment_updated_at = datetime.utcnow()
    seed.sow_adjustment_notes = (
        f"Confirmed from did-not-establish feedback for {label}; "
        f"earliest sow moved to {_month_day_label(recommendation_month_day)}."
    )
    planted_day = _planting_date_for_item(item)
    if planted_day is not None:
        source_record = _source_outcome_record_for_item(user_id, item.id)
        _upsert_sow_date_history(
            user_id=user_id,
            plant_id=item.plant_id,
            variety=item.variety,
            year=planted_day.year,
            sow_date=planted_day,
            target_month_day=recommendation_month_day,
            harvest_date=item.outcome_date,
            yield_rating='didnt_establish',
            weight=NEGATIVE_SOW_DATE_WEIGHTS['didnt_establish'],
            source_harvest_id=source_record.id if source_record else None,
        )
        _recompute_proven_sow_date(seed, item.plant_id, item.variety)
    db.session.commit()
    return {
        "seedInventory": seed.to_dict(),
        "message": f"Saved earliest sow date for {label}: {_month_day_label(recommendation_month_day)}.",
    }


def confirm_good_sow_date_from_harvest(user_id: int, harvest_id: int) -> Dict:
    record = HarvestRecord.query.filter_by(id=harvest_id, user_id=user_id).first()
    if record is None:
        raise FeedbackLoopError("Harvest record not found", status_code=404, error_code="not_found")
    if record.yield_excluded or record.outcome:
        return {
            "status": "not_applicable",
            "reason": "Only normal harvest records can confirm planting dates.",
        }

    quality = (record.quality or '').strip().lower()
    weight = POSITIVE_SOW_DATE_WEIGHTS.get(quality)
    if weight is None:
        return {
            "status": "not_applicable",
            "quality": record.quality,
            "reason": "Only good or excellent harvests can confirm planting dates.",
        }

    if record.planted_item_id is None:
        return {
            "status": "unavailable",
            "errorCode": "missing_planted_item",
            "message": "This harvest is not linked to a planted item.",
        }

    item = PlantedItem.query.filter_by(id=record.planted_item_id, user_id=user_id).first()
    if item is None:
        return {
            "status": "unavailable",
            "errorCode": "missing_planted_item",
            "message": "This harvest's planted item was not found.",
        }

    planted_day = _planting_date_for_item(item)
    if planted_day is None:
        return {
            "status": "unavailable",
            "errorCode": "missing_planted_date",
            "message": "This planting does not have a sow/transplant date.",
        }

    month_day = _month_day_from_date(planted_day)
    plant = get_plant_by_id(item.plant_id)
    label = _label_for_crop(item.plant_id, item.variety)
    planting_label = "transplanted" if item.transplant_date is not None else "sown"

    return {
        "status": "suggestion",
        "harvestId": record.id,
        "plantedItemId": item.id,
        "plantId": item.plant_id,
        "plantName": plant.get("name") if plant else item.plant_id,
        "variety": item.variety,
        "quality": quality,
        "weight": weight,
        "evidence": {
            "plantingDate": planted_day.isoformat(),
            "plantingLabel": planting_label,
            "harvestDate": record.harvest_date.isoformat() if record.harvest_date else None,
            "quality": quality,
            "quantity": record.quantity,
            "unit": record.unit,
        },
        "recommendation": {
            "monthDay": month_day,
            "label": _month_day_label(month_day),
            "basis": f"{quality} harvest from {planting_label} date",
        },
        "message": f"{label} did well from {_month_day_label(month_day)}. Use that date for future plans?",
    }


def apply_sow_date_confirmation(user_id: int, harvest_id: int, recommendation_month_day: str) -> Dict:
    recommendation_month_day = _validate_month_day(recommendation_month_day)
    suggestion = confirm_good_sow_date_from_harvest(user_id, harvest_id)
    if suggestion.get("status") != "suggestion":
        raise FeedbackLoopError(
            suggestion.get("message") or suggestion.get("reason") or "This harvest cannot confirm a planting date",
            status_code=409,
            error_code=suggestion.get("errorCode"),
        )

    record = HarvestRecord.query.filter_by(id=harvest_id, user_id=user_id).first()
    item = PlantedItem.query.filter_by(id=record.planted_item_id, user_id=user_id).first()
    planted_day = _planting_date_for_item(item)
    quality = (record.quality or '').strip().lower()
    weight = POSITIVE_SOW_DATE_WEIGHTS[quality]

    seed = _resolve_writable_seed_for_context(
        user_id,
        item.plant_id,
        item.variety,
        item.source_plan_item_id,
    )
    history = _upsert_sow_date_history(
        user_id=user_id,
        plant_id=item.plant_id,
        variety=item.variety,
        year=planted_day.year,
        sow_date=planted_day,
        target_month_day=recommendation_month_day,
        harvest_date=record.harvest_date,
        yield_rating=quality,
        weight=weight,
        source_harvest_id=record.id,
    )
    proven_month_day = _recompute_proven_sow_date(seed, item.plant_id, item.variety)
    db.session.commit()

    label = _label_for_crop(item.plant_id, item.variety)
    return {
        "status": "applied",
        "seedInventory": seed.to_dict(),
        "outcomeHistory": history.to_dict(),
        "recommendation": {
            "monthDay": proven_month_day,
            "label": _month_day_label(proven_month_day) if proven_month_day else None,
        },
        "message": f"Saved proven planting date for {label}: {_month_day_label(proven_month_day)}.",
    }


def apply_days_to_maturity_adjustment(user_id: int, harvest_id: int, additional_days: int) -> Dict:
    if isinstance(additional_days, bool):
        raise FeedbackLoopError("additionalDays must be a positive integer")
    try:
        additional_days = int(additional_days)
    except (TypeError, ValueError):
        raise FeedbackLoopError("additionalDays must be a positive integer")
    if additional_days < 1 or additional_days > 60:
        raise FeedbackLoopError("additionalDays must be between 1 and 60")

    record = HarvestRecord.query.filter_by(id=harvest_id, user_id=user_id).first()
    if record is None:
        raise FeedbackLoopError("Harvest record not found", status_code=404, error_code="not_found")
    if record.yield_excluded or record.outcome:
        raise FeedbackLoopError("Days-to-maturity feedback only applies to normal harvests", status_code=409)

    item = None
    if record.planted_item_id is not None:
        item = PlantedItem.query.filter_by(id=record.planted_item_id, user_id=user_id).first()

    if item is not None:
        plant_id = item.plant_id
        variety = item.variety
        source_plan_item_id = item.source_plan_item_id
    else:
        plant_id = record.plant_id
        variety = None
        source_plan_item_id = None

    seed = _resolve_writable_seed_for_context(user_id, plant_id, variety, source_plan_item_id)
    plant = get_plant_by_id(plant_id)
    base_dtm = seed.days_to_maturity
    if base_dtm is None and plant and plant.get("daysToMaturity") is not None:
        base_dtm = plant.get("daysToMaturity")
    if base_dtm is None:
        raise FeedbackLoopError("No days-to-maturity baseline is available for this crop")

    seed.days_to_maturity = int(base_dtm) + additional_days
    note = (
        f"Picked-too-soon feedback on harvest #{record.id}: "
        f"days to maturity increased from {base_dtm} to {seed.days_to_maturity}."
    )
    seed.notes = f"{seed.notes}\n{note}".strip() if seed.notes else note
    db.session.commit()
    return {
        "seedInventory": seed.to_dict(),
        "previousDaysToMaturity": base_dtm,
        "daysToMaturity": seed.days_to_maturity,
        "message": f"Saved days-to-maturity override: {seed.days_to_maturity} days.",
    }
