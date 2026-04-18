"""
Unit tests for frost_date_lookup.py ZIP -> zone derivation.

Focuses on the lat/lon fallback path added to `_get_zone_from_zipcode` to fix
the Zone 5b fallback bug: when phzmapi.org returns None for a ZIP (e.g. because
the ZIP isn't in its dataset, the service is rate-limited, or offline), the
function must geocode the ZIP and use the `get_hardiness_zone` regional
heuristic instead of silently failing and letting callers default to Zone 5b.
"""

import sys
import os
from unittest.mock import patch

import pytest

# Ensure backend/ is on sys.path so module imports work when running pytest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import frost_date_lookup
from frost_date_lookup import _get_zone_from_zipcode
from services.geocoding_service import geocoding_service


@pytest.fixture(autouse=True)
def _clear_zone_cache():
    """Clear the module-level ZIP->zone cache before each test so cached
    results from other tests don't leak across cases."""
    frost_date_lookup._zipcode_zone_cache.clear()
    yield
    frost_date_lookup._zipcode_zone_cache.clear()


ATLANTA_ADDRESS = {
    'latitude': 33.749,
    'longitude': -84.388,
    'formatted_address': 'Atlanta, GA 30301',
    'accuracy': 0.9,
    'accuracy_type': 'zipcode_fallback',
    'confidence': 0.8,
}


class TestZipcodeZoneLookupFallback:
    """Regression tests for the Atlanta Zone 8a bug (phzmapi miss -> Zone 5b default)."""

    def test_uses_latlon_fallback_when_phzmapi_returns_none(self):
        """When phzmapi.org returns None, the function should geocode the ZIP
        and resolve the zone via get_hardiness_zone (which has a lat/lon
        regional heuristic)."""
        with patch.object(
            geocoding_service, '_lookup_zone_via_api', return_value=None,
        ) as mock_api, patch.object(
            geocoding_service, 'validate_address', return_value=ATLANTA_ADDRESS,
        ) as mock_validate, patch.object(
            geocoding_service, 'get_hardiness_zone', return_value='8a',
        ) as mock_zone:
            zone = _get_zone_from_zipcode('30301')

            assert zone == '8a', (
                f"Expected Atlanta to resolve to zone 8a via fallback, got {zone!r}"
            )
            mock_api.assert_called_once_with('30301')
            mock_validate.assert_called_once_with('30301')
            mock_zone.assert_called_once_with(
                ATLANTA_ADDRESS['latitude'],
                ATLANTA_ADDRESS['longitude'],
                ATLANTA_ADDRESS['formatted_address'],
            )

    def test_caches_zone_from_latlon_fallback(self):
        """After a successful fallback lookup, the zone should be cached and
        subsequent calls must NOT re-invoke phzmapi or geocoding."""
        with patch.object(
            geocoding_service, '_lookup_zone_via_api', return_value=None,
        ) as mock_api, patch.object(
            geocoding_service, 'validate_address', return_value=ATLANTA_ADDRESS,
        ) as mock_validate, patch.object(
            geocoding_service, 'get_hardiness_zone', return_value='8a',
        ) as mock_zone:
            first = _get_zone_from_zipcode('30301')
            second = _get_zone_from_zipcode('30301')

            assert first == '8a'
            assert second == '8a'
            # Each external call should have happened exactly once (first call only).
            assert mock_api.call_count == 1
            assert mock_validate.call_count == 1
            assert mock_zone.call_count == 1

    def test_returns_none_when_both_phzmapi_and_latlon_fail(self):
        """If phzmapi returns None AND validate_address returns None (no
        coordinates to hand to the regional heuristic), the function must
        return None so callers can fall back to the hardcoded default."""
        with patch.object(
            geocoding_service, '_lookup_zone_via_api', return_value=None,
        ), patch.object(
            geocoding_service, 'validate_address', return_value=None,
        ):
            zone = _get_zone_from_zipcode('00000')
            assert zone is None

    def test_returns_none_when_hardiness_zone_also_returns_none(self):
        """Covers the case where validate_address succeeds but
        get_hardiness_zone ALSO returns None (e.g., extreme coordinates
        outside any region). Must still return None, not leak a bogus zone."""
        with patch.object(
            geocoding_service, '_lookup_zone_via_api', return_value=None,
        ), patch.object(
            geocoding_service, 'validate_address', return_value=ATLANTA_ADDRESS,
        ), patch.object(
            geocoding_service, 'get_hardiness_zone', return_value=None,
        ):
            assert _get_zone_from_zipcode('30301') is None

    def test_none_result_is_not_cached(self):
        """Failed lookups should not be cached, so transient failures (network
        hiccup, rate-limit) don't lock in a bad result for 24 hours."""
        with patch.object(
            geocoding_service, '_lookup_zone_via_api', return_value=None,
        ) as mock_api, patch.object(
            geocoding_service, 'validate_address', return_value=None,
        ) as mock_validate:
            assert _get_zone_from_zipcode('00000') is None
            assert _get_zone_from_zipcode('00000') is None

            # Both external calls should be invoked twice (no cached None).
            assert mock_api.call_count == 2
            assert mock_validate.call_count == 2

    def test_phzmapi_success_skips_latlon_fallback(self):
        """When phzmapi.org returns a valid zone, we must NOT fall through to
        the (more expensive + less accurate) lat/lon heuristic."""
        with patch.object(
            geocoding_service, '_lookup_zone_via_api', return_value='8a',
        ) as mock_api, patch.object(
            geocoding_service, 'validate_address',
        ) as mock_validate, patch.object(
            geocoding_service, 'get_hardiness_zone',
        ) as mock_zone:
            zone = _get_zone_from_zipcode('30301')

            assert zone == '8a'
            mock_api.assert_called_once_with('30301')
            mock_validate.assert_not_called()
            mock_zone.assert_not_called()

    def test_exception_in_phzmapi_still_triggers_latlon_fallback(self):
        """If phzmapi raises an unexpected exception, we should still attempt
        the lat/lon fallback rather than giving up and defaulting to 5b."""
        with patch.object(
            geocoding_service, '_lookup_zone_via_api',
            side_effect=RuntimeError('boom'),
        ), patch.object(
            geocoding_service, 'validate_address', return_value=ATLANTA_ADDRESS,
        ), patch.object(
            geocoding_service, 'get_hardiness_zone', return_value='8a',
        ):
            zone = _get_zone_from_zipcode('30301')
            assert zone == '8a'

    def test_empty_zipcode_returns_none_without_lookups(self):
        """Empty ZIP should short-circuit to None with no external calls."""
        with patch.object(
            geocoding_service, '_lookup_zone_via_api',
        ) as mock_api, patch.object(
            geocoding_service, 'validate_address',
        ) as mock_validate:
            assert _get_zone_from_zipcode('') is None
            assert _get_zone_from_zipcode(None) is None
            mock_api.assert_not_called()
            mock_validate.assert_not_called()

    def test_exception_in_latlon_fallback_returns_none_gracefully(self):
        """If validate_address itself throws (network error, bad response),
        we must swallow it and return None, not crash the caller."""
        with patch.object(
            geocoding_service, '_lookup_zone_via_api', return_value=None,
        ), patch.object(
            geocoding_service, 'validate_address',
            side_effect=RuntimeError('geocoding broke'),
        ):
            zone = _get_zone_from_zipcode('30301')
            assert zone is None


class TestZipcodeZoneLookupIntegration:
    """Integration test exercising the real regional heuristic (no mocks on
    get_hardiness_zone) to confirm the end-to-end fallback path produces a
    Southern-zone result for a Southern ZIP, never Zone 5b or lower.
    """

    def test_atlanta_zip_resolves_to_southern_zone_via_real_regional_heuristic(self):
        """With phzmapi mocked out but get_hardiness_zone real, Atlanta
        coordinates must resolve to a zone at least as warm as 7a.

        The critical property is: we're NOT falling back to the hardcoded
        Zone 5b default. Whatever the regional heuristic returns (7a, 7b,
        8a, depending on which region bucket -84.388 lng falls in) is a
        success — the regression would be a null return.
        """
        with patch.object(
            geocoding_service, '_lookup_zone_via_api', return_value=None,
        ), patch.object(
            geocoding_service, 'validate_address', return_value=ATLANTA_ADDRESS,
        ):
            zone = _get_zone_from_zipcode('30301')

            assert zone is not None, (
                "Fallback must produce a zone, not None (would default to Zone 5b)"
            )
            # Parse numeric portion: '7b' -> 7, '8a' -> 8
            numeric = int(''.join(c for c in zone if c.isdigit()))
            assert numeric >= 7, (
                f"Atlanta should resolve to zone 7+ but got {zone!r} (Zone 5b bug)"
            )
