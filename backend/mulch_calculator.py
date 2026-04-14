"""
Mulch Temperature Calculator
Calculates soil temperature adjustments based on mulch type and season
Based on research showing mulch has varying effects throughout the year
"""

from datetime import datetime
from typing import Optional, Tuple, Dict

def get_mulch_adjustment(
    mulch_type: str,
    current_date: datetime,
    soil_temp_baseline: float
) -> Tuple[float, str]:
    """
    Calculate temperature adjustment based on mulch type and season.

    Args:
        mulch_type: Type of mulch (none, straw, wood-chips, leaves, grass, compost, black-plastic, clear-plastic)
        current_date: Current date for seasonal calculations
        soil_temp_baseline: Baseline soil temperature before mulch adjustment

    Returns:
        Tuple of (adjustment_in_fahrenheit, description)

    Seasons defined as:
    - Spring: March-May (warming season - mulch delays)
    - Summer: June-August (hot season - mulch cools)
    - Fall: September-November (cooling season - mulch moderates)
    - Winter: December-February (cold season - mulch insulates)
    """

    # Determine season based on month
    month = current_date.month
    if month in [3, 4, 5]:
        season = 'spring'
    elif month in [6, 7, 8]:
        season = 'summer'
    elif month in [9, 10, 11]:
        season = 'fall'
    else:  # 12, 1, 2
        season = 'winter'

    # Mulch adjustment table (in Fahrenheit)
    # Format: {mulch_type: {season: (adjustment, description)}}
    adjustments = {
        'none': {
            'spring': (0, 'Bare soil, warms with air temperature'),
            'summer': (0, 'Bare soil, heats quickly in sun'),
            'fall': (0, 'Bare soil, cools with air temperature'),
            'winter': (0, 'Bare soil, no insulation'),
        },
        'straw': {
            'spring': (-6, 'Straw delays soil warming by 1-2 weeks'),
            'summer': (-10, 'Straw keeps soil cool, prevents overheating'),
            'fall': (-4, 'Straw moderates temperature swings'),
            'winter': (-2, 'Straw provides moderate insulation'),
        },
        'wood-chips': {
            'spring': (-4, 'Wood chips slow spring warming'),
            'summer': (-6, 'Wood chips provide cooling'),
            'fall': (-3, 'Wood chips moderate fall temperatures'),
            'winter': (-2, 'Wood chips provide light insulation'),
        },
        'leaves': {
            'spring': (-4, 'Leaves delay warming, may mat down'),
            'summer': (-6, 'Leaves cool soil, decompose slowly'),
            'fall': (-3, 'Leaves moderate temperature'),
            'winter': (-2, 'Leaves insulate when dry'),
        },
        'grass': {
            'spring': (-3, 'Grass clippings delay warming slightly'),
            'summer': (-5, 'Grass clippings cool soil, add nitrogen'),
            'fall': (-2, 'Grass clippings moderate temperature'),
            'winter': (-1, 'Grass clippings provide minimal insulation'),
        },
        'compost': {
            'spring': (-2, 'Compost has mild cooling effect'),
            'summer': (-2, 'Dark compost absorbs heat but adds moisture'),
            'fall': (-1, 'Compost moderates slightly'),
            'winter': (-1, 'Compost provides slight insulation'),
        },
        'black-plastic': {
            'spring': (8, 'Black plastic warms soil significantly'),
            'summer': (3, 'Black plastic can overheat soil'),
            'fall': (5, 'Black plastic extends season'),
            'winter': (2, 'Black plastic provides minimal winter benefit'),
        },
        'clear-plastic': {
            'spring': (15, 'Clear plastic creates greenhouse effect'),
            'summer': (8, 'Clear plastic can severely overheat soil'),
            'fall': (10, 'Clear plastic extends season significantly'),
            'winter': (5, 'Clear plastic provides moderate protection'),
        },
    }

    # Get adjustment for this mulch type and season
    mulch_type = mulch_type.lower()
    if mulch_type not in adjustments:
        # Default to 'none' if unknown mulch type
        mulch_type = 'none'

    adjustment, description = adjustments[mulch_type][season]

    # Additional context based on baseline temperature and season
    adjusted_temp = soil_temp_baseline + adjustment

    # Add warnings for extreme conditions
    if season == 'summer' and adjusted_temp > 85:
        description += ' (Watch for heat stress)'
    elif season == 'spring' and adjusted_temp < 50 and mulch_type in ['straw', 'wood-chips', 'leaves']:
        description += ' (Consider removing mulch to speed warming)'

    return (adjustment, description)


def get_mulch_recommendations(
    current_date: datetime,
    soil_temp_baseline: float,
    target_temp_for_planting: Optional[float] = None
) -> Dict:
    """
    Get mulch recommendations for current conditions.

    Args:
        current_date: Current date
        soil_temp_baseline: Current soil temperature without mulch
        target_temp_for_planting: Optional target temperature for planting (e.g., 50°F for tomatoes)

    Returns:
        Dictionary with recommendations for each mulch type
    """

    recommendations = {}

    for mulch_type in ['none', 'straw', 'wood-chips', 'leaves', 'grass', 'compost', 'black-plastic', 'clear-plastic']:
        adjustment, description = get_mulch_adjustment(mulch_type, current_date, soil_temp_baseline)
        adjusted_temp = soil_temp_baseline + adjustment

        recommendation = {
            'mulchType': mulch_type,
            'adjustment': adjustment,
            'adjustedTemp': round(adjusted_temp, 1),
            'description': description,
        }

        # Add planting readiness if target temp provided
        if target_temp_for_planting:
            if adjusted_temp >= target_temp_for_planting:
                recommendation['plantingReady'] = True
                recommendation['plantingStatus'] = f'Ready to plant ({adjusted_temp:.1f}F >= {target_temp_for_planting}F)'
            else:
                recommendation['plantingReady'] = False
                days_estimate = int((target_temp_for_planting - adjusted_temp) * 2)  # Rough estimate: 2 days per degree
                recommendation['plantingStatus'] = f'Wait ~{days_estimate} days ({adjusted_temp:.1f}F < {target_temp_for_planting}F)'

        recommendations[mulch_type] = recommendation

    return recommendations


if __name__ == '__main__':
    # Example usage
    test_date = datetime(2026, 4, 15)  # Mid-April
    baseline_temp = 55.0  # degrees F

    print("=== Mulch Temperature Adjustments ===")
    print(f"Date: {test_date.strftime('%B %d, %Y')}")
    print(f"Baseline soil temp: {baseline_temp}F")
    print()

    for mulch in ['none', 'straw', 'wood-chips', 'compost', 'black-plastic']:
        adj, desc = get_mulch_adjustment(mulch, test_date, baseline_temp)
        adjusted = baseline_temp + adj
        print(f"{mulch:15s}: {adj:+.0f}F -> {adjusted:.1f}F - {desc}")

    print("\n=== Planting Recommendations (Target: 50F for tomatoes) ===")
    recs = get_mulch_recommendations(test_date, baseline_temp, 50.0)
    for mulch, rec in recs.items():
        if mulch in ['none', 'straw', 'black-plastic']:  # Show subset for example
            print(f"{mulch:15s}: {rec['plantingStatus']}")
