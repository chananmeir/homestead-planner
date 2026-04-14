"""
USDA Hardiness Zone to Average Frost Date Lookup

Provides average last spring frost and first fall frost dates
for each USDA hardiness zone. These are approximate averages based
on NOAA/USDA data and should be used as fallbacks when the user
has not set explicit frost dates on their property.

Zone format: "1a" through "13b" (or just the number like "5" or "5b")
"""
from datetime import date, datetime, timedelta
from typing import Optional


# Average last spring frost and first fall frost by USDA zone.
# Month/day tuples: (month, day)
# Sources: NOAA 30-year normals, USDA Plant Hardiness Zone Map
ZONE_FROST_DATES = {
    # Zone 1: extreme cold (interior Alaska)
    '1a': {'last_frost': (6, 15), 'first_frost': (8, 15)},
    '1b': {'last_frost': (6, 10), 'first_frost': (8, 20)},
    # Zone 2
    '2a': {'last_frost': (6, 1), 'first_frost': (8, 31)},
    '2b': {'last_frost': (5, 25), 'first_frost': (9, 5)},
    # Zone 3
    '3a': {'last_frost': (5, 20), 'first_frost': (9, 10)},
    '3b': {'last_frost': (5, 15), 'first_frost': (9, 15)},
    # Zone 4
    '4a': {'last_frost': (5, 10), 'first_frost': (9, 20)},
    '4b': {'last_frost': (5, 5), 'first_frost': (9, 25)},
    # Zone 5
    '5a': {'last_frost': (4, 20), 'first_frost': (10, 10)},
    '5b': {'last_frost': (4, 15), 'first_frost': (10, 15)},
    # Zone 6
    '6a': {'last_frost': (4, 10), 'first_frost': (10, 20)},
    '6b': {'last_frost': (4, 1), 'first_frost': (10, 25)},
    # Zone 7
    '7a': {'last_frost': (3, 25), 'first_frost': (11, 1)},
    '7b': {'last_frost': (3, 20), 'first_frost': (11, 5)},
    # Zone 8
    '8a': {'last_frost': (3, 15), 'first_frost': (11, 10)},
    '8b': {'last_frost': (3, 10), 'first_frost': (11, 15)},
    # Zone 9
    '9a': {'last_frost': (2, 28), 'first_frost': (11, 25)},
    '9b': {'last_frost': (2, 15), 'first_frost': (12, 5)},
    # Zone 10 (southern Florida, coastal CA)
    '10a': {'last_frost': (2, 1), 'first_frost': (12, 15)},
    '10b': {'last_frost': (1, 15), 'first_frost': (12, 25)},
    # Zone 11+ (tropical, essentially frost-free)
    '11a': {'last_frost': (1, 1), 'first_frost': (12, 31)},
    '11b': {'last_frost': (1, 1), 'first_frost': (12, 31)},
    '12a': {'last_frost': (1, 1), 'first_frost': (12, 31)},
    '12b': {'last_frost': (1, 1), 'first_frost': (12, 31)},
    '13a': {'last_frost': (1, 1), 'first_frost': (12, 31)},
    '13b': {'last_frost': (1, 1), 'first_frost': (12, 31)},
}


# Module-level cache: zipcode -> {'zone': str, 'cached_at': datetime}
_zipcode_zone_cache = {}
_CACHE_EXPIRY = timedelta(hours=24)


def _get_zone_from_zipcode(zipcode: str) -> Optional[str]:
    """Derive USDA zone from a ZIP code using the geocoding service API lookup.

    Results are cached for 24 hours to avoid repeated external API calls.
    Returns None on failure (not cached, so retries work next time).
    """
    if not zipcode:
        return None

    # Check cache
    cached = _zipcode_zone_cache.get(zipcode)
    if cached and (datetime.utcnow() - cached['cached_at']) < _CACHE_EXPIRY:
        return cached['zone']

    try:
        from services.geocoding_service import geocoding_service
        zone = geocoding_service._lookup_zone_via_api(zipcode)
        if zone:
            _zipcode_zone_cache[zipcode] = {
                'zone': zone,
                'cached_at': datetime.utcnow(),
            }
            return zone
    except Exception as e:
        import logging
        logging.warning(f"Failed to derive zone from zipcode {zipcode}: {e}")

    return None


def _normalize_zone(zone_str: str) -> str:
    """
    Normalize a USDA zone string to the 'Na' or 'Nb' format.
    Handles inputs like '5', '5a', '5b', '5B', '5A', 'Zone 5a', etc.

    Returns the normalized zone string (e.g., '5a') or None if unparseable.
    """
    if not zone_str:
        return None

    # Strip common prefixes and whitespace
    cleaned = zone_str.strip().lower()
    cleaned = cleaned.replace('zone', '').replace('usda', '').strip()

    # Try to parse as number + optional letter
    import re
    match = re.match(r'^(\d{1,2})([ab])?$', cleaned)
    if not match:
        return None

    number = match.group(1)
    subletter = match.group(2) or 'a'  # Default to 'a' if no subletter

    return f'{number}{subletter}'


def get_frost_dates_for_zone(zone_str: str, year: int = None) -> dict:
    """
    Get average frost dates for a USDA hardiness zone.

    Args:
        zone_str: USDA zone string (e.g., '5', '5a', '5b', 'Zone 5a')
        year: The year for the returned dates. Defaults to current year.

    Returns:
        dict with 'last_frost' and 'first_frost' as date objects,
        or None if zone is not recognized.
    """
    if year is None:
        from simulation_clock import get_now
        year = get_now().year

    normalized = _normalize_zone(zone_str)
    if normalized is None or normalized not in ZONE_FROST_DATES:
        return None

    entry = ZONE_FROST_DATES[normalized]
    lf_month, lf_day = entry['last_frost']
    ff_month, ff_day = entry['first_frost']

    # Handle Feb 28 in non-leap years (zone 9a)
    import calendar
    if lf_month == 2 and lf_day > 28 and not calendar.isleap(year):
        lf_day = 28
    if ff_month == 2 and ff_day > 28 and not calendar.isleap(year):
        ff_day = 28

    return {
        'last_frost': date(year, lf_month, lf_day),
        'first_frost': date(year, ff_month, ff_day),
    }


def get_frost_dates_for_user(user_id: int, year: int = None, zipcode: str = None) -> dict:
    """
    Get frost dates for a user, checking their properties for zone/explicit dates.

    Priority:
    1. Explicit frost dates on the user's first property (if set)
    2. Zone-derived frost dates from the user's first property
    3. Zone derived from weather zipcode (if provided)
    4. Hardcoded Zone 5b default (April 15 / October 15)

    Args:
        user_id: The user's ID
        year: The year for the returned dates. Defaults to current year.
        zipcode: Optional weather ZIP code to derive zone from if no property zone is set.

    Returns:
        dict with:
            'last_frost': date object
            'first_frost': date object
            'source': 'property' | 'zone' | 'zipcode' | 'default'
            'zone': (only when source='zipcode') the derived zone string
    """
    from models import Property
    from simulation_clock import get_now

    if year is None:
        year = get_now().year

    # Default fallback (Zone 5b: Milwaukee)
    default_result = {
        'last_frost': date(year, 4, 15),
        'first_frost': date(year, 10, 15),
        'source': 'default',
    }

    # Find user's first property
    prop = Property.query.filter_by(user_id=user_id).first()

    if prop is not None:
        # Priority 1: Explicit frost dates on the property
        if prop.last_frost_date is not None or prop.first_frost_date is not None:
            result = {
                'last_frost': prop.last_frost_date if prop.last_frost_date is not None else default_result['last_frost'],
                'first_frost': prop.first_frost_date if prop.first_frost_date is not None else default_result['first_frost'],
                'source': 'property',
            }
            # Adjust year if the stored dates are from a different year
            if result['last_frost'].year != year:
                result['last_frost'] = result['last_frost'].replace(year=year)
            if result['first_frost'].year != year:
                result['first_frost'] = result['first_frost'].replace(year=year)
            return result

        # Priority 2: Derive from zone
        if prop.zone:
            zone_dates = get_frost_dates_for_zone(prop.zone, year)
            if zone_dates is not None:
                zone_dates['source'] = 'zone'
                return zone_dates

    # Priority 3: Derive zone from weather zipcode (reachable even without a property)
    if zipcode:
        derived_zone = _get_zone_from_zipcode(zipcode)
        if derived_zone:
            zone_dates = get_frost_dates_for_zone(derived_zone, year)
            if zone_dates is not None:
                zone_dates['source'] = 'zipcode'
                zone_dates['zone'] = derived_zone
                return zone_dates

    return default_result
