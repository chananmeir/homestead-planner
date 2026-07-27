"""Crop rotation policy rules and risk scoring.

The rotation checker owns database history queries. This module owns the
agronomic policy layer: family/category windows, severity, and messages.
"""
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple


@dataclass(frozen=True)
class RotationPolicy:
    window_years: int
    base_risk: int
    label: str


DEFAULT_POLICY = RotationPolicy(
    window_years=2,
    base_risk=45,
    label='standard rotation risk',
)

FAMILY_POLICIES: Dict[str, RotationPolicy] = {
    'Solanaceae': RotationPolicy(3, 85, 'high disease pressure'),
    'Brassicaceae': RotationPolicy(3, 78, 'high pest and disease pressure'),
    'Cucurbitaceae': RotationPolicy(3, 72, 'moderate-high disease pressure'),
    'Alliaceae': RotationPolicy(3, 60, 'moderate disease pressure'),
    'Apiaceae': RotationPolicy(2, 48, 'moderate rotation risk'),
    'Fabaceae': RotationPolicy(2, 40, 'lower rotation risk'),
    'Asteraceae': RotationPolicy(2, 38, 'lower rotation risk'),
    'Amaranthaceae': RotationPolicy(2, 38, 'lower rotation risk'),
    'Poaceae': RotationPolicy(1, 25, 'low rotation risk'),
    'Lamiaceae': RotationPolicy(1, 15, 'very low rotation risk'),
}

LOW_RISK_CATEGORIES = {'herb', 'flower'}


def get_rotation_policy(plant: Optional[dict], override_window: Optional[int] = None) -> RotationPolicy:
    """Return the rotation policy for a plant, optionally overriding the window."""
    if not plant:
        return DEFAULT_POLICY

    category = plant.get('category')
    if category == 'cover-crop':
        policy = RotationPolicy(0, 0, 'cover crop')
    elif category in LOW_RISK_CATEGORIES:
        family_policy = FAMILY_POLICIES.get(plant.get('family'), DEFAULT_POLICY)
        policy = RotationPolicy(
            min(family_policy.window_years, 1),
            min(family_policy.base_risk, 20),
            'low-risk companion crop',
        )
    else:
        policy = FAMILY_POLICIES.get(plant.get('family'), DEFAULT_POLICY)

    if override_window is not None:
        window = max(0, min(int(override_window), 6))
        return RotationPolicy(window, policy.base_risk, policy.label)
    return policy


def exposure_weight(entry: dict) -> Tuple[float, str]:
    """Estimate how strongly a historical crop occupied the bed."""
    if entry.get('category') == 'cover-crop':
        return 0.0, 'cover_crop'
    if entry.get('category') in LOW_RISK_CATEGORIES:
        return 0.25, 'low_exposure'

    space_required = entry.get('space_required')
    quantity = entry.get('quantity')

    if space_required is not None:
        try:
            cells = float(space_required)
            if cells <= 2:
                return 0.35, 'low_exposure'
            if cells <= 6:
                return 0.65, 'medium_exposure'
            return 1.0, 'high_exposure'
        except (TypeError, ValueError):
            pass

    if quantity is not None:
        try:
            count = float(quantity)
            if count <= 2:
                return 0.35, 'low_exposure'
            if count <= 6:
                return 0.65, 'medium_exposure'
            return 1.0, 'high_exposure'
        except (TypeError, ValueError):
            pass

    return 1.0, 'unknown_exposure'


def severity_from_score(score: int) -> str:
    if score >= 80:
        return 'high'
    if score >= 55:
        return 'warning'
    if score >= 30:
        return 'caution'
    if score > 0:
        return 'info'
    return 'ok'


def score_rotation_risk(
    plant: dict,
    history: Iterable[dict],
    planting_year: int,
    override_window: Optional[int] = None,
) -> dict:
    """Score rotation risk for planting a crop against bed history."""
    family = plant.get('family')
    category = plant.get('category')
    policy = get_rotation_policy(plant, override_window=override_window)
    reason_codes: List[str] = []

    if category == 'cover-crop':
        return {
            'severity': 'ok',
            'risk_score': 0,
            'rotation_window': 0,
            'reason_codes': ['target_cover_crop'],
            'conflicts': [],
            'ignored_history': [],
        }

    conflicts = []
    ignored_history = []
    mixed_families = set()

    for entry in history:
        entry_family = entry.get('family')
        if entry_family:
            mixed_families.add(entry_family)

        years_since = planting_year - int(entry.get('year', planting_year))
        if years_since <= 0 or years_since > policy.window_years:
            continue

        if entry.get('category') == 'cover-crop':
            ignored = dict(entry)
            ignored['ignore_reason'] = 'cover_crop'
            ignored_history.append(ignored)
            continue

        if entry_family != family:
            continue

        weight, exposure = exposure_weight(entry)
        recency_weight = 1.0 if years_since == 1 else 0.75 if years_since == 2 else 0.5
        risk = int(round(policy.base_risk * weight * recency_weight))
        conflict = dict(entry)
        conflict.update({
            'years_since': years_since,
            'exposure': exposure,
            'risk_score': risk,
        })
        conflicts.append(conflict)

    if ignored_history:
        reason_codes.append('cover_crop_history_ignored')
    if len(mixed_families) > 1:
        reason_codes.append('mixed_bed_history')

    if not conflicts:
        return {
            'severity': 'ok',
            'risk_score': 0,
            'rotation_window': policy.window_years,
            'reason_codes': reason_codes or ['no_recent_family_history'],
            'conflicts': [],
            'ignored_history': ignored_history,
        }

    max_score = max(c['risk_score'] for c in conflicts)
    distinct_years = {c['year'] for c in conflicts}
    repeated_penalty = max(0, len(distinct_years) - 1) * 10
    risk_score = min(100, max_score + repeated_penalty)

    if any(c['exposure'] == 'low_exposure' for c in conflicts):
        reason_codes.append('low_exposure_history')
    if len(distinct_years) > 1:
        reason_codes.append('repeated_family_history')
    reason_codes.append('same_family_recent')
    if policy.base_risk < 50:
        reason_codes.append('lower_risk_family')

    return {
        'severity': severity_from_score(risk_score),
        'risk_score': risk_score,
        'rotation_window': policy.window_years,
        'reason_codes': reason_codes,
        'conflicts': sorted(conflicts, key=lambda c: c['year'], reverse=True),
        'ignored_history': ignored_history,
    }
