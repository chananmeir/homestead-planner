"""
Tests for the ZIP-level cache and provider-error surfacing in
GeocodingService.

Covers:
- repeated lookups for the same ZIP only invoke the provider once
- normalization (whitespace, non-ZIP inputs)
- positive vs negative cache TTL paths
- provider-error sentinel returned from validate_zipcode
- cache invalidation across TTL expiry
- known-ZIP fallback short-circuits provider entirely

These tests stub out the provider lookup so they do not consume external
quota and can run offline.
"""

import os
import sys
import time
import pytest
from unittest.mock import patch

# Ensure backend/ is importable when this test file is run directly.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.geocoding_service import (  # noqa: E402
    GeocodingService,
    ZIP_STATUS_OK,
    ZIP_STATUS_NOT_FOUND,
    ZIP_STATUS_PROVIDER_ERROR,
    ZIP_STATUS_INVALID_INPUT,
)


def _fresh_service(api_key: str = 'fake-key', provider: str = 'geocodio') -> GeocodingService:
    """Return a freshly-constructed service with a configured fake API key."""
    with patch.dict(os.environ, {
        'GEOCODING_API_KEY': api_key,
        'GEOCODING_PROVIDER': provider,
    }):
        svc = GeocodingService()
    # Defensive: ensure cache is empty for a deterministic baseline.
    svc._zip_cache_clear()
    return svc


class TestZipNormalization:
    def test_strips_whitespace_and_accepts_5_digits(self):
        svc = _fresh_service()
        assert svc._normalize_zipcode('  53703 ') == '53703'

    def test_rejects_non_string(self):
        svc = _fresh_service()
        assert svc._normalize_zipcode(53703) is None
        assert svc._normalize_zipcode(None) is None

    def test_rejects_zip_plus_4(self):
        svc = _fresh_service()
        assert svc._normalize_zipcode('53703-1234') is None

    def test_rejects_short_or_long(self):
        svc = _fresh_service()
        assert svc._normalize_zipcode('5370') is None
        assert svc._normalize_zipcode('537034') is None

    def test_rejects_alphanumeric(self):
        svc = _fresh_service()
        assert svc._normalize_zipcode('53A03') is None
        assert svc._normalize_zipcode('Madison, WI') is None


class TestZipCacheBehavior:
    def test_known_zip_fallback_does_not_call_provider(self):
        """A ZIP in KNOWN_US_ZIPCODE_COORDS must short-circuit provider."""
        svc = _fresh_service()
        with patch.object(svc, '_provider_lookup_with_status') as mock_provider:
            result, status = svc.validate_zipcode('53703')
            assert status == ZIP_STATUS_OK
            assert result is not None
            assert result['latitude'] == pytest.approx(43.0731)
            mock_provider.assert_not_called()

    def test_repeated_lookup_calls_provider_once(self):
        """The headline regression: same ZIP, many calls, one provider hit."""
        svc = _fresh_service()
        provider_payload = (
            {
                'latitude': 41.5,
                'longitude': -87.5,
                'formatted_address': 'Anytown, IL 60601-fake',
                'accuracy': 1.0,
                'accuracy_type': 'rooftop',
                'confidence': 1.0,
            },
            ZIP_STATUS_OK,
        )

        # Use a ZIP NOT in the known-ZIP fallback table to force provider path.
        unknown_zip = '47712'  # Evansville, IN — not in fallback table

        with patch.object(
            svc, '_provider_lookup_with_status', return_value=provider_payload
        ) as mock_provider:
            for _ in range(10):
                result, status = svc.validate_zipcode(unknown_zip)
                assert status == ZIP_STATUS_OK
                assert result['latitude'] == 41.5
            assert mock_provider.call_count == 1

    def test_cache_keyed_on_normalized_zip(self):
        """Whitespace variants must hit the same cache entry."""
        svc = _fresh_service()
        provider_payload = (
            {
                'latitude': 30.0,
                'longitude': -90.0,
                'formatted_address': 'Some City',
                'accuracy': 1.0,
                'accuracy_type': 'rooftop',
                'confidence': 1.0,
            },
            ZIP_STATUS_OK,
        )
        with patch.object(
            svc, '_provider_lookup_with_status', return_value=provider_payload
        ) as mock_provider:
            svc.validate_zipcode('47712')
            svc.validate_zipcode('  47712 ')
            svc.validate_zipcode('47712\n')
            assert mock_provider.call_count == 1

    def test_validate_address_uses_zip_cache(self):
        """validate_address(zip) must transparently use the ZIP cache."""
        svc = _fresh_service()
        provider_payload = (
            {
                'latitude': 30.0,
                'longitude': -90.0,
                'formatted_address': 'Some City',
                'accuracy': 1.0,
                'accuracy_type': 'rooftop',
                'confidence': 1.0,
            },
            ZIP_STATUS_OK,
        )
        with patch.object(
            svc, '_provider_lookup_with_status', return_value=provider_payload
        ) as mock_provider:
            for _ in range(5):
                result = svc.validate_address('47712')
                assert result['latitude'] == 30.0
            assert mock_provider.call_count == 1

    def test_non_zip_address_bypasses_cache(self):
        """Full street addresses must not be cached (no shared key)."""
        svc = _fresh_service()
        provider_payload = (
            {
                'latitude': 43.0,
                'longitude': -89.0,
                'formatted_address': '123 Main St, Madison WI',
                'accuracy': 1.0,
                'accuracy_type': 'rooftop',
                'confidence': 1.0,
            },
            ZIP_STATUS_OK,
        )
        with patch.object(
            svc, '_provider_lookup_with_status', return_value=provider_payload
        ) as mock_provider:
            svc.validate_address('123 Main St, Madison WI')
            svc.validate_address('123 Main St, Madison WI')
            assert mock_provider.call_count == 2


class TestProviderErrorSurfacing:
    def test_provider_error_returns_distinct_status(self):
        svc = _fresh_service()
        with patch.object(
            svc,
            '_provider_lookup_with_status',
            return_value=(None, ZIP_STATUS_PROVIDER_ERROR),
        ):
            result, status = svc.validate_zipcode('47712')
            assert result is None
            assert status == ZIP_STATUS_PROVIDER_ERROR

    def test_provider_error_cached_short_term(self):
        """Provider error caches briefly so transient outages aren't pummeled."""
        svc = _fresh_service()
        with patch.object(
            svc,
            '_provider_lookup_with_status',
            return_value=(None, ZIP_STATUS_PROVIDER_ERROR),
        ) as mock_provider:
            svc.validate_zipcode('47712')
            svc.validate_zipcode('47712')
            svc.validate_zipcode('47712')
            assert mock_provider.call_count == 1

    def test_not_found_returns_distinct_status(self):
        svc = _fresh_service()
        with patch.object(
            svc,
            '_provider_lookup_with_status',
            return_value=(None, ZIP_STATUS_NOT_FOUND),
        ):
            result, status = svc.validate_zipcode('47712')
            assert result is None
            assert status == ZIP_STATUS_NOT_FOUND

    def test_no_api_key_treats_unknown_zip_as_provider_error(self, caplog):
        """When provider is unconfigured, unknown ZIP must surface as provider
        error (not a misleading 'not found'). Also confirms missing-API-key
        startup is logged at ERROR level (deployment misconfig must be loud)."""
        import logging as _logging
        with caplog.at_level(_logging.ERROR, logger='services.geocoding_service'):
            with patch.dict(os.environ, {}, clear=False):
                os.environ.pop('GEOCODING_API_KEY', None)
                svc = GeocodingService()
        # Confirm the missing-key warning was emitted via logger.error,
        # not print(). This makes the misconfig visible in real log feeds.
        missing_key_logs = [
            rec for rec in caplog.records
            if 'GEOCODING_API_KEY' in rec.getMessage()
            and rec.levelno >= _logging.ERROR
        ]
        assert missing_key_logs, (
            "Expected an ERROR-level log entry mentioning GEOCODING_API_KEY "
            "when the env var is missing"
        )
        svc._zip_cache_clear()
        # Use a ZIP that is NOT in the known-ZIP fallback table.
        result, status = svc.validate_zipcode('47712')
        assert result is None
        assert status == ZIP_STATUS_PROVIDER_ERROR

    def test_invalid_input_surfaces_invalid_input(self):
        """Non-ZIP input to validate_zipcode must be reported as
        ZIP_STATUS_INVALID_INPUT (distinct from PROVIDER_ERROR) so blueprints
        can return HTTP 400 'bad ZIP' instead of HTTP 503 'provider down'.

        Common malformed inputs we explicitly test:
        - 'abc'        — alphabetic
        - '123'        — too short
        - '53703-1234' — ZIP+4 (we don't accept the 9-digit form)
        """
        svc = _fresh_service()
        for bad_input in ('not-a-zip', 'abc', '123', '53703-1234'):
            result, status = svc.validate_zipcode(bad_input)
            assert result is None, f"input {bad_input!r} should return no result"
            assert status == ZIP_STATUS_INVALID_INPUT, (
                f"input {bad_input!r} should surface INVALID_INPUT, "
                f"got {status!r}"
            )

    def test_invalid_input_does_not_consume_provider_quota(self):
        """Bad-shape input must short-circuit before any provider call."""
        svc = _fresh_service()
        with patch.object(svc, '_provider_lookup_with_status') as mock_provider:
            for bad_input in ('abc', '53703-1234', '12'):
                _, status = svc.validate_zipcode(bad_input)
                assert status == ZIP_STATUS_INVALID_INPUT
            mock_provider.assert_not_called()


class TestCacheTtl:
    def test_cache_entry_expires(self):
        """Forcing the cache TTL to expire causes a fresh provider call."""
        svc = _fresh_service()
        provider_payload = (
            {
                'latitude': 1.0,
                'longitude': 2.0,
                'formatted_address': 'X',
                'accuracy': 1.0,
                'accuracy_type': 'rooftop',
                'confidence': 1.0,
            },
            ZIP_STATUS_OK,
        )
        with patch.object(
            svc, '_provider_lookup_with_status', return_value=provider_payload
        ) as mock_provider:
            svc.validate_zipcode('47712')
            assert mock_provider.call_count == 1

            # Manually expire the entry by rewriting expiry to "right now - 1".
            with svc._zip_cache_lock:
                value, _expires_at = svc._zip_cache['47712']
                svc._zip_cache['47712'] = (value, time.monotonic() - 1)

            svc.validate_zipcode('47712')
            assert mock_provider.call_count == 2

    def test_clear_cache_method(self):
        svc = _fresh_service()
        provider_payload = (
            {
                'latitude': 1.0,
                'longitude': 2.0,
                'formatted_address': 'X',
                'accuracy': 1.0,
                'accuracy_type': 'rooftop',
                'confidence': 1.0,
            },
            ZIP_STATUS_OK,
        )
        with patch.object(
            svc, '_provider_lookup_with_status', return_value=provider_payload
        ) as mock_provider:
            svc.validate_zipcode('47712')
            assert mock_provider.call_count == 1
            svc._zip_cache_clear()
            svc.validate_zipcode('47712')
            assert mock_provider.call_count == 2


class TestProviderLookupStatusMapping:
    def test_geocodio_non_200_returns_provider_error(self):
        svc = _fresh_service(provider='geocodio')

        class FakeResponse:
            status_code = 403
            text = 'Quota exceeded'

        import requests as _requests
        with patch.object(_requests, 'get', return_value=FakeResponse()):
            result, status = svc._geocodio_lookup_with_status('47712')
            assert result is None
            assert status == ZIP_STATUS_PROVIDER_ERROR

    def test_geocodio_empty_results_returns_not_found(self):
        svc = _fresh_service(provider='geocodio')

        class FakeResponse:
            status_code = 200

            def json(self):
                return {'results': []}

        import requests as _requests
        with patch.object(_requests, 'get', return_value=FakeResponse()):
            result, status = svc._geocodio_lookup_with_status('00000')
            assert result is None
            assert status == ZIP_STATUS_NOT_FOUND

    def test_geocodio_request_exception_returns_provider_error(self):
        import requests as _requests
        svc = _fresh_service(provider='geocodio')
        with patch.object(
            _requests,
            'get',
            side_effect=_requests.exceptions.Timeout('boom'),
        ):
            result, status = svc._geocodio_lookup_with_status('47712')
            assert result is None
            assert status == ZIP_STATUS_PROVIDER_ERROR

    def test_google_over_query_limit_returns_provider_error(self):
        svc = _fresh_service(provider='google')

        class FakeResponse:
            status_code = 200

            def json(self):
                return {'status': 'OVER_QUERY_LIMIT'}

        import requests as _requests
        with patch.object(_requests, 'get', return_value=FakeResponse()):
            result, status = svc._google_lookup_with_status('47712')
            assert result is None
            assert status == ZIP_STATUS_PROVIDER_ERROR


class TestBlueprintInvalidZipMapping:
    """End-to-end check that malformed ZIP input from a real HTTP request
    surfaces as HTTP 400 (not 503) at the weather blueprint, which is the
    visible regression code-review caught.

    Uses the `auth_client_a` fixture from conftest.py so the route's
    @login_required decorator is satisfied.
    """

    def test_weather_current_with_malformed_zip_returns_400(self, auth_client_a):
        # 'abc' cannot normalize to 5 digits — must be invalid_zipcode_format,
        # NOT geocoding_provider_unavailable.
        resp = auth_client_a.get('/api/weather/current?zipcode=abc')
        assert resp.status_code == 400, (
            f"Malformed ZIP should return 400, got {resp.status_code}"
        )
        body = resp.get_json()
        assert body.get('errorCode') == 'invalid_zipcode_format', (
            f"Expected errorCode=invalid_zipcode_format, got {body!r}"
        )

    def test_weather_current_with_zip_plus_4_returns_400(self, auth_client_a):
        # ZIP+4 ('53703-1234') is also invalid input shape — must NOT 503.
        resp = auth_client_a.get('/api/weather/current?zipcode=53703-1234')
        assert resp.status_code == 400, (
            f"ZIP+4 should return 400, got {resp.status_code}"
        )
        body = resp.get_json()
        assert body.get('errorCode') == 'invalid_zipcode_format'

    def test_weather_current_with_short_zip_returns_400(self, auth_client_a):
        # Three-digit input ('123') is invalid; must surface as 400.
        resp = auth_client_a.get('/api/weather/current?zipcode=123')
        assert resp.status_code == 400
        body = resp.get_json()
        assert body.get('errorCode') == 'invalid_zipcode_format'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
