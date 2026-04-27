"""
Geocoding service for address validation and coordinate lookup.
Supports Geocodio and Google Maps Geocoding APIs.
"""

import logging
import requests
import os
import time
import threading
from typing import Optional, Dict, Any, Tuple

logger = logging.getLogger(__name__)


# Cache TTLs (seconds). ZIP -> lat/lon is stable, so positive cache lives a long
# time. Negative cache (genuinely not found) is shorter so user typo recovery
# isn't punished. Provider-error cache is short so transient outages clear fast.
_ZIP_CACHE_TTL_SUCCESS = 60 * 60 * 24 * 7   # 7 days
_ZIP_CACHE_TTL_NOT_FOUND = 60 * 30          # 30 minutes
_ZIP_CACHE_TTL_PROVIDER_ERROR = 60          # 1 minute


# Sentinels used inside the ZIP cache to distinguish lookup outcomes.
class _ZipLookupOutcome:
    NOT_FOUND = 'not_found'
    PROVIDER_ERROR = 'provider_error'


# Public lookup-status strings returned by validate_zipcode().
# 'ok' is the success case; the others let callers tell apart "bad ZIP" vs
# "external provider unavailable / quota exhausted" vs "input wasn't even a
# 5-digit ZIP". Keeping INVALID_INPUT separate from PROVIDER_ERROR matters
# because callers map them to very different HTTP statuses (400 vs 503): a
# user typo should not look like a transient outage in monitoring/alerts.
ZIP_STATUS_OK = 'ok'
ZIP_STATUS_NOT_FOUND = 'not_found'
ZIP_STATUS_PROVIDER_ERROR = 'provider_error'
ZIP_STATUS_INVALID_INPUT = 'invalid_input'


KNOWN_US_ZIPCODE_COORDS = {
    # California
    '90210': (34.0901, -118.4065, 'Beverly Hills, CA'),
    '94102': (37.7749, -122.4194, 'San Francisco, CA'),
    '90001': (33.9731, -118.2479, 'Los Angeles, CA'),
    '92101': (32.7157, -117.1611, 'San Diego, CA'),

    # Wisconsin
    '53209': (43.0731, -87.9647, 'Milwaukee, WI'),
    '53703': (43.0731, -89.4012, 'Madison, WI'),

    # New York / Northeast
    '10001': (40.7506, -73.9971, 'New York, NY'),
    '14201': (42.8864, -78.8784, 'Buffalo, NY'),
    '02101': (42.3601, -71.0589, 'Boston, MA'),

    # Midwest / Great Plains
    '55401': (44.9778, -93.2650, 'Minneapolis, MN'),
    '60601': (41.8781, -87.6298, 'Chicago, IL'),
    '75201': (32.7767, -96.7970, 'Dallas, TX'),
    '77001': (29.7604, -95.3698, 'Houston, TX'),
    '78701': (30.2672, -97.7431, 'Austin, TX'),
    '80201': (39.7392, -104.9903, 'Denver, CO'),

    # Florida
    '33101': (25.7617, -80.1918, 'Miami, FL'),
    '32801': (28.5383, -81.3792, 'Orlando, FL'),

    # Mid-Atlantic / Pacific Northwest
    '20001': (38.9072, -77.0369, 'Washington, DC'),
    '98101': (47.6062, -122.3321, 'Seattle, WA'),
}


class GeocodingService:
    """Wrapper for geocoding APIs (Geocodio or Google Maps)"""

    def __init__(self):
        self.api_key = os.environ.get('GEOCODING_API_KEY')
        self.provider = os.environ.get('GEOCODING_PROVIDER', 'geocodio')  # or 'google'

        # Process-level ZIP cache.
        # Layout: {normalized_zip: (outcome_or_dict, expires_at_monotonic)}
        # outcome_or_dict is either a result dict (success) or one of the
        # _ZipLookupOutcome sentinels.
        self._zip_cache: Dict[str, Tuple[Any, float]] = {}
        self._zip_cache_lock = threading.Lock()

        if not self.api_key:
            # Use logger.error so deployment misconfiguration is visible in
            # real log aggregation. print() goes to stdout and is easily lost
            # behind a process manager's default log handling. A missing key
            # is a permanent condition (won't clear on retry), so this should
            # be loud at startup.
            logger.error(
                "GEOCODING_API_KEY not set in environment variables — "
                "ZIP geocoding will fall back to KNOWN_US_ZIPCODE_COORDS "
                "only and return PROVIDER_ERROR for unknown ZIPs."
            )

    # ---------------- ZIP cache helpers ----------------

    @staticmethod
    def _normalize_zipcode(value: Any) -> Optional[str]:
        """
        Return a clean 5-digit ZIP string, or None if `value` is not a US ZIP.

        Strips whitespace and rejects anything that isn't exactly 5 digits
        after stripping. Used so the cache is keyed on the canonical form
        rather than the raw user/request input.
        """
        if not isinstance(value, str):
            return None
        cleaned = value.strip()
        if len(cleaned) == 5 and cleaned.isdigit():
            return cleaned
        return None

    def _zip_cache_get(self, zipcode: str) -> Optional[Tuple[Any, float]]:
        """Return (entry, expires_at) if cached & unexpired, else None."""
        with self._zip_cache_lock:
            entry = self._zip_cache.get(zipcode)
            if entry is None:
                return None
            value, expires_at = entry
            if time.monotonic() >= expires_at:
                # Expired; drop it now so the cache stays small.
                self._zip_cache.pop(zipcode, None)
                return None
            return entry

    def _zip_cache_set(self, zipcode: str, value: Any, ttl_seconds: float) -> None:
        with self._zip_cache_lock:
            self._zip_cache[zipcode] = (value, time.monotonic() + ttl_seconds)

    def _zip_cache_clear(self) -> None:
        """Test/admin hook. Drops all cached ZIP lookups."""
        with self._zip_cache_lock:
            self._zip_cache.clear()

    def _lookup_zipcode_cached(
        self, zipcode: str
    ) -> Tuple[Optional[Dict[str, Any]], str]:
        """
        Resolve a normalized 5-digit ZIP through the in-process cache, falling
        through to the in-code fallback table and then the external provider.

        Returns:
            (result_or_none, status) where status is one of
            ZIP_STATUS_OK / ZIP_STATUS_NOT_FOUND / ZIP_STATUS_PROVIDER_ERROR.
        """
        # Cache hit?
        cached = self._zip_cache_get(zipcode)
        if cached is not None:
            value, _expires = cached
            if value == _ZipLookupOutcome.NOT_FOUND:
                return None, ZIP_STATUS_NOT_FOUND
            if value == _ZipLookupOutcome.PROVIDER_ERROR:
                return None, ZIP_STATUS_PROVIDER_ERROR
            # Success entry — return a shallow copy so callers can mutate freely.
            return dict(value), ZIP_STATUS_OK

        # Cache miss. First try the local well-known-ZIP fallback (no quota cost).
        fallback = self._zipcode_fallback(zipcode)
        if fallback:
            self._zip_cache_set(zipcode, fallback, _ZIP_CACHE_TTL_SUCCESS)
            return dict(fallback), ZIP_STATUS_OK

        # No fallback hit. Need the external provider.
        if not self.api_key:
            # No provider configured -> truly not resolvable, but treat as
            # provider-error rather than not-found so quota monitoring isn't
            # confused with bad-ZIP reports. Cache short-term.
            self._zip_cache_set(
                zipcode, _ZipLookupOutcome.PROVIDER_ERROR, _ZIP_CACHE_TTL_PROVIDER_ERROR
            )
            return None, ZIP_STATUS_PROVIDER_ERROR

        result, status = self._provider_lookup_with_status(zipcode)

        if status == ZIP_STATUS_OK and result is not None:
            self._zip_cache_set(zipcode, result, _ZIP_CACHE_TTL_SUCCESS)
            return dict(result), ZIP_STATUS_OK
        if status == ZIP_STATUS_PROVIDER_ERROR:
            self._zip_cache_set(
                zipcode, _ZipLookupOutcome.PROVIDER_ERROR, _ZIP_CACHE_TTL_PROVIDER_ERROR
            )
            return None, ZIP_STATUS_PROVIDER_ERROR

        # NOT_FOUND
        self._zip_cache_set(
            zipcode, _ZipLookupOutcome.NOT_FOUND, _ZIP_CACHE_TTL_NOT_FOUND
        )
        return None, ZIP_STATUS_NOT_FOUND

    def _provider_lookup_with_status(
        self, address: str
    ) -> Tuple[Optional[Dict[str, Any]], str]:
        """
        Dispatch to the configured provider and return (result, status).

        status is ZIP_STATUS_OK if a result was returned, ZIP_STATUS_NOT_FOUND
        if the provider responded but no match, and ZIP_STATUS_PROVIDER_ERROR
        if the provider call itself failed (timeout, non-200, quota, parse).
        """
        if self.provider == 'geocodio':
            return self._geocodio_lookup_with_status(address)
        if self.provider == 'google':
            return self._google_lookup_with_status(address)
        # Unknown provider configuration
        return None, ZIP_STATUS_PROVIDER_ERROR

    # ---------------- Public API ----------------

    def validate_address(self, address: str) -> Optional[Dict[str, Any]]:
        """
        Validate address and return coordinates + metadata.

        For 5-digit ZIP-shaped inputs, results are served from a process-level
        TTL cache so repeated calls for the same ZIP within a session do not
        consume external provider quota.

        Args:
            address: Full address string to validate

        Returns:
            Dict with latitude, longitude, formatted_address, accuracy
            Returns None if address not found or provider error.
        """
        # ZIP-shaped input goes through the cache.
        zipcode = self._normalize_zipcode(address)
        if zipcode is not None:
            result, _status = self._lookup_zipcode_cached(zipcode)
            return result

        # Non-ZIP (full street address) — no shared cache key, go straight to
        # provider. These calls are typically one-off (manual address entry).
        if not self.api_key:
            return None

        result, _status = self._provider_lookup_with_status(address)
        return result

    def validate_zipcode(
        self, zipcode: str
    ) -> Tuple[Optional[Dict[str, Any]], str]:
        """
        ZIP-only variant of validate_address that surfaces a status code so
        callers can distinguish "ZIP not found" from "provider unavailable /
        quota exhausted" from "input wasn't a valid ZIP shape".

        Args:
            zipcode: A string expected to contain a 5-digit US ZIP code.

        Returns:
            (result_or_none, status). status is one of:
                ZIP_STATUS_OK            - result is a populated dict
                ZIP_STATUS_NOT_FOUND     - provider returned no match
                ZIP_STATUS_PROVIDER_ERROR - provider call failed / quota /
                                            misconfiguration
                ZIP_STATUS_INVALID_INPUT - input did not normalize to 5 digits
                                           (e.g. 'abc', '123', '53703-1234');
                                           caller should map to HTTP 400, not
                                           503 — a typo is not an outage.
        """
        normalized = self._normalize_zipcode(zipcode)
        if normalized is None:
            # Bad input shape — not a transient provider problem. Distinct
            # status so callers map this to 400 (not 503) and ops alerts
            # don't fire on every malformed user submission.
            return None, ZIP_STATUS_INVALID_INPUT
        return self._lookup_zipcode_cached(normalized)

    def _zipcode_fallback(self, zipcode: str) -> Optional[Dict[str, Any]]:
        """
        Fallback zipcode lookup for common US zipcodes (no API key needed)
        This provides approximate coordinates for major city zipcodes
        """
        if zipcode in KNOWN_US_ZIPCODE_COORDS:
            lat, lng, city = KNOWN_US_ZIPCODE_COORDS[zipcode]
            return {
                'latitude': lat,
                'longitude': lng,
                'formatted_address': city,
                'accuracy': 0.8,
                'accuracy_type': 'zipcode_fallback',
                'confidence': 0.7
            }

        return None

    def _geocodio_lookup_with_status(
        self, address: str
    ) -> Tuple[Optional[Dict[str, Any]], str]:
        """
        Geocodio call returning (result, status). status is OK / NOT_FOUND /
        PROVIDER_ERROR. Provider-error covers timeouts, non-200 responses
        (including quota exhaustion 403/422), and unparseable payloads.

        API Docs: https://www.geocod.io/docs/
        """
        url = "https://api.geocod.io/v1.7/geocode"
        params = {
            'q': address,
            'api_key': self.api_key,
            'fields': 'census2020',
        }

        try:
            response = requests.get(url, params=params, timeout=10)
        except requests.exceptions.RequestException as e:
            logger.warning("Geocodio API error: %s", e)
            return None, ZIP_STATUS_PROVIDER_ERROR

        if response.status_code != 200:
            # 403/422 typically mean quota / auth problems. Treat all
            # non-200s as provider errors so quota issues do not masquerade
            # as ZIP-not-found.
            logger.warning(
                "Geocodio returned %s for query %r: %s",
                response.status_code, address, response.text[:200],
            )
            return None, ZIP_STATUS_PROVIDER_ERROR

        try:
            data = response.json()
            results = data.get('results') or []
            if not results:
                return None, ZIP_STATUS_NOT_FOUND
            result = results[0]
            return ({
                'latitude': result['location']['lat'],
                'longitude': result['location']['lng'],
                'formatted_address': result['formatted_address'],
                'accuracy': result['accuracy'],
                'accuracy_type': result.get('accuracy_type', 'unknown'),
                'confidence': result.get('accuracy', 0),
            }, ZIP_STATUS_OK)
        except (KeyError, IndexError, ValueError) as e:
            logger.warning("Geocodio response parsing error: %s", e)
            return None, ZIP_STATUS_PROVIDER_ERROR

    def _google_lookup_with_status(
        self, address: str
    ) -> Tuple[Optional[Dict[str, Any]], str]:
        """
        Google geocoding call returning (result, status).

        API Docs: https://developers.google.com/maps/documentation/geocoding
        """
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {
            'address': address,
            'key': self.api_key,
        }

        try:
            response = requests.get(url, params=params, timeout=10)
        except requests.exceptions.RequestException as e:
            logger.warning("Google Geocoding API error: %s", e)
            return None, ZIP_STATUS_PROVIDER_ERROR

        if response.status_code != 200:
            logger.warning(
                "Google geocoding returned %s for query %r: %s",
                response.status_code, address, response.text[:200],
            )
            return None, ZIP_STATUS_PROVIDER_ERROR

        try:
            data = response.json()
        except ValueError as e:
            logger.warning("Google response parsing error: %s", e)
            return None, ZIP_STATUS_PROVIDER_ERROR

        status = data.get('status')
        if status in ('OVER_QUERY_LIMIT', 'REQUEST_DENIED', 'UNKNOWN_ERROR', 'INVALID_REQUEST'):
            logger.warning(
                "Google geocoding provider error status=%s for query %r",
                status, address,
            )
            return None, ZIP_STATUS_PROVIDER_ERROR

        if status != 'OK' or not data.get('results'):
            return None, ZIP_STATUS_NOT_FOUND

        try:
            result = data['results'][0]
            location = result['geometry']['location']
            location_type = result['geometry'].get('location_type', 'APPROXIMATE')
            return ({
                'latitude': location['lat'],
                'longitude': location['lng'],
                'formatted_address': result['formatted_address'],
                'accuracy': location_type,
                'accuracy_type': location_type,
                'confidence': 1.0 if location_type == 'ROOFTOP' else 0.8,
            }, ZIP_STATUS_OK)
        except (KeyError, IndexError) as e:
            logger.warning("Google response parsing error: %s", e)
            return None, ZIP_STATUS_PROVIDER_ERROR

    # Backwards-compatible thin wrappers (still used by tests / non-ZIP paths).
    def _geocodio_lookup(self, address: str) -> Optional[Dict[str, Any]]:
        result, _status = self._geocodio_lookup_with_status(address)
        return result

    def _google_lookup(self, address: str) -> Optional[Dict[str, Any]]:
        result, _status = self._google_lookup_with_status(address)
        return result

    def _extract_zipcode(self, formatted_address: str) -> Optional[str]:
        """
        Extract 5-digit ZIP code from formatted address string.

        Handles various address formats:
        - "City, STATE 12345"
        - "12345"
        - "Street Address, City, STATE 12345-1234" (extracts 5-digit portion)

        Args:
            formatted_address: Formatted address string to parse

        Returns:
            5-digit ZIP code string or None if not found
        """
        import re
        match = re.search(r'\b(\d{5})\b', formatted_address)
        return match.group(1) if match else None

    def _lookup_zone_via_api(self, zipcode: str) -> Optional[str]:
        """
        Query phzmapi.org API for USDA zone by ZIP code.

        Uses the free phzmapi.org API which is based on USDA 2023 official
        Plant Hardiness Zone Map data from PRISM Climate Group.

        API: https://phzmapi.org/{ZIPCODE}.json
        Response format: {"zone":"8a","temperature_range":"10 to 15","coordinates":{...}}

        Args:
            zipcode: 5-digit ZIP code string

        Returns:
            Zone string (e.g., "8a") or None on failure
        """
        try:
            url = f"https://phzmapi.org/{zipcode}.json"
            response = requests.get(url, timeout=10)

            if response.status_code == 200:
                data = response.json()
                zone = data.get('zone')
                if zone:
                    return zone
            else:
                logger.warning(
                    f"phzmapi.org returned {response.status_code} for ZIP {zipcode}: "
                    f"{response.text[:200]}"
                )

        except (requests.exceptions.RequestException, ValueError, KeyError):
            # Log error but don't raise - fallback tiers will handle
            logger.exception(f"phzmapi.org lookup failed for ZIP {zipcode}")

        return None

    def get_hardiness_zone(self, latitude: float, longitude: float,
                          formatted_address: Optional[str] = None) -> Optional[str]:
        """
        Get USDA hardiness zone using multi-tier lookup.

        Tier 1: phzmapi.org API (if ZIP available) - Most accurate, uses official USDA data
        Tier 2: Regional lookup (longitude-aware) - Good fallback using regional climate patterns
        Tier 3: Latitude-only lookup - Last resort with warning

        Args:
            latitude: Geographic latitude
            longitude: Geographic longitude
            formatted_address: Optional formatted address for ZIP extraction

        Returns:
            USDA zone string (e.g., "7a", "8b") or None
        """
        # Tier 1: Try API lookup if we have an address
        if formatted_address:
            zipcode = self._extract_zipcode(formatted_address)
            if zipcode:
                zone = self._lookup_zone_via_api(zipcode)
                if zone:
                    return zone

        # Tier 2: Enhanced regional lookup
        zone = self._lookup_zone_from_coords(latitude, longitude)
        if zone:
            return zone

        # Tier 3: Should never reach here, but log if it does
        print(f"WARNING: All zone lookup methods failed for ({latitude}, {longitude})")
        return None

    def _lookup_zone_from_coords(self, lat: float, lng: float) -> Optional[str]:
        """
        Enhanced zone lookup using both latitude AND longitude.

        Divides US into 5 regions based on longitude, then applies
        region-specific latitude thresholds accounting for climate patterns:

        - Pacific West (lng < -115): Maritime climate, warmer zones
        - Mountain West (-115 to -100): High elevation, colder zones
        - Great Plains (-100 to -90): Continental extremes
        - Midwest (-90 to -80): Colder continental
        - East Coast (lng > -80): Variable Atlantic influence

        This is a simplified approximation. Tier 1 API lookup is more accurate.
        For production accuracy, use phzmapi.org API or USDA GeoJSON data.

        Args:
            lat: Geographic latitude
            lng: Geographic longitude

        Returns:
            USDA zone string (e.g., "7a", "8b") or None
        """
        # Determine region based on longitude
        if lng < -115:
            region = 'PACIFIC_WEST'
        elif lng < -100:
            region = 'MOUNTAIN_WEST'
        elif lng < -90:
            region = 'GREAT_PLAINS'
        elif lng < -80:
            region = 'MIDWEST'
        else:
            region = 'EAST_COAST'

        # Apply region-specific latitude adjustments
        # Pacific West: Warmer due to maritime climate (+1 to +2 zones)
        if region == 'PACIFIC_WEST':
            if lat >= 48.5: return "8a"    # Seattle area
            elif lat >= 47: return "9a"
            elif lat >= 45: return "9b"
            elif lat >= 42: return "9b"
            elif lat >= 39: return "10a"
            elif lat >= 36: return "10b"
            elif lat >= 33: return "11a"
            else: return "11b"

        # Mountain West: Colder due to elevation (-1 zone)
        elif region == 'MOUNTAIN_WEST':
            if lat >= 48.5: return "3a"
            elif lat >= 47: return "4a"
            elif lat >= 45: return "4b"
            elif lat >= 43: return "5a"
            elif lat >= 41: return "5b"
            elif lat >= 39: return "6a"    # Denver area
            elif lat >= 37: return "6b"
            elif lat >= 35: return "7a"
            else: return "7b"

        # Great Plains: Moderate continental
        elif region == 'GREAT_PLAINS':
            if lat >= 48.5: return "3a"
            elif lat >= 47: return "4a"
            elif lat >= 45: return "4b"
            elif lat >= 43: return "5a"
            elif lat >= 41: return "5b"
            elif lat >= 39: return "6a"
            elif lat >= 37: return "7a"
            elif lat >= 35: return "7b"
            else: return "8a"

        # Midwest: Colder continental (-0.5 zone)
        elif region == 'MIDWEST':
            if lat >= 48.5: return "3a"
            elif lat >= 47: return "3b"
            elif lat >= 45: return "4a"
            elif lat >= 43: return "5a"    # Minneapolis area
            elif lat >= 41: return "5b"
            elif lat >= 39: return "6a"
            elif lat >= 37: return "6b"
            elif lat >= 35: return "7a"
            else: return "7b"

        # East Coast: Variable Atlantic influence
        else:  # EAST_COAST
            if lat >= 48.5: return "4a"
            elif lat >= 47: return "4b"
            elif lat >= 45: return "5a"
            elif lat >= 43: return "5b"
            elif lat >= 41: return "6a"
            elif lat >= 39: return "6b"
            elif lat >= 37: return "7a"    # DC area
            elif lat >= 35: return "8a"
            elif lat >= 33: return "8b"
            elif lat >= 31: return "9a"
            elif lat >= 29: return "9b"
            elif lat >= 27: return "10a"
            else: return "10b"


# Create singleton instance
geocoding_service = GeocodingService()
