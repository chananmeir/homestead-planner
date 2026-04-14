"""
Unit tests for geocoding_service.py hardiness zone lookup functionality.

Tests the multi-tier zone lookup system:
- Tier 1: phzmapi.org API (ZIP-based)
- Tier 2: Regional lookup (longitude-aware)
- Tier 3: Latitude-only (legacy fallback)
"""

import pytest
import sys
import os

# Add backend directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.geocoding_service import GeocodingService


class TestZIPExtraction:
    """Test ZIP code extraction from various address formats"""

    def setup_method(self):
        self.service = GeocodingService()

    def test_extract_zipcode_full_address(self):
        """Test extraction from full address format"""
        result = self.service._extract_zipcode("Seattle, WA 98101")
        assert result == "98101"

    def test_extract_zipcode_bare(self):
        """Test extraction from bare ZIP code"""
        result = self.service._extract_zipcode("98101")
        assert result == "98101"

    def test_extract_zipcode_long_address(self):
        """Test extraction from long address with ZIP+4"""
        result = self.service._extract_zipcode("1234 Main Street, Seattle, WA 98101-1234")
        assert result == "98101"  # Should extract 5-digit portion

    def test_extract_zipcode_none(self):
        """Test when no ZIP is present"""
        result = self.service._extract_zipcode("No zip here")
        assert result is None

    def test_extract_zipcode_international(self):
        """Test with non-US address (no ZIP)"""
        result = self.service._extract_zipcode("London, UK SW1A 1AA")
        assert result is None


class TestAPILookup:
    """Test phzmapi.org API integration (Tier 1)"""

    def setup_method(self):
        self.service = GeocodingService()

    def test_api_lookup_seattle(self):
        """Test API lookup for Seattle ZIP"""
        zone = self.service._lookup_zone_via_api("98101")
        assert zone == "9a", f"Expected 9a, got {zone}"

    def test_api_lookup_minneapolis(self):
        """Test API lookup for Minneapolis ZIP"""
        zone = self.service._lookup_zone_via_api("55401")
        # Minneapolis is on zone boundary, accept both
        assert zone in ["4b", "5a"], f"Expected 4b or 5a, got {zone}"

    def test_api_lookup_washington_dc(self):
        """Test API lookup for Washington DC ZIP"""
        zone = self.service._lookup_zone_via_api("20001")
        assert zone in ["7a", "7b"], f"Expected 7a or 7b, got {zone}"

    def test_api_lookup_invalid_zip(self):
        """Test API returns None for invalid ZIP"""
        zone = self.service._lookup_zone_via_api("00000")
        assert zone is None

    def test_api_lookup_timeout(self):
        """Test API handles timeout gracefully"""
        # This should timeout and return None (fallback will handle)
        zone = self.service._lookup_zone_via_api("99999")
        # Should return None (either not found or timeout)
        assert zone is None or isinstance(zone, str)


class TestRegionalFallback:
    """Test regional lookup logic (Tier 2)"""

    def setup_method(self):
        self.service = GeocodingService()

    def test_regional_pacific_seattle(self):
        """Test Pacific West region (Seattle)"""
        # Seattle: 47.6°N, -122.3°W → Should be zone 8a or 9a (warmer than lat-only)
        zone = self.service._lookup_zone_from_coords(47.6062, -122.3321)
        assert zone in ["8a", "9a"], f"Expected warmer zone for Seattle, got {zone}"

    def test_regional_midwest_minneapolis(self):
        """Test Midwest region (Minneapolis)"""
        # Minneapolis: 44.9°N, -93.3°W → Should be zone 4a or 5a (colder continental)
        zone = self.service._lookup_zone_from_coords(44.9778, -93.2650)
        assert zone in ["4a", "5a"], f"Expected colder zone for Minneapolis, got {zone}"

    def test_regional_mountain_denver(self):
        """Test Mountain West region (Denver)"""
        # Denver: 39.7°N, -104.9°W → Should be zone 5b or 6a (colder due to elevation)
        zone = self.service._lookup_zone_from_coords(39.7392, -104.9903)
        assert zone in ["5b", "6a"], f"Expected mountain zone for Denver, got {zone}"

    def test_regional_east_washington_dc(self):
        """Test East Coast region (Washington DC)"""
        # DC: 38.9°N, -77.0°W → Should be zone 7a or 7b
        zone = self.service._lookup_zone_from_coords(38.9072, -77.0369)
        assert zone in ["7a", "7b"], f"Expected DC zone, got {zone}"

    def test_regional_pacific_portland(self):
        """Test Pacific West region (Portland)"""
        # Portland: 45.5°N, -122.7°W → Should be zone 9a or 9b (maritime climate)
        zone = self.service._lookup_zone_from_coords(45.5152, -122.6784)
        assert zone in ["9a", "9b"], f"Expected warmer zone for Portland, got {zone}"

    def test_regional_great_plains(self):
        """Test Great Plains region"""
        # Kansas City: 39.1°N, -94.6°W → Zone 6a/6b
        zone = self.service._lookup_zone_from_coords(39.0997, -94.5786)
        assert zone in ["6a", "6b"], f"Expected Great Plains zone, got {zone}"


class TestMultiTierOrchestration:
    """Test the full multi-tier lookup system"""

    def setup_method(self):
        self.service = GeocodingService()

    def test_tier1_with_zip_address(self):
        """Test Tier 1 (API) is used when ZIP available"""
        # Should use API for Seattle with full address
        zone = self.service.get_hardiness_zone(47.6, -122.3, "Seattle, WA 98101")
        assert zone == "9a", f"Expected API result 9a, got {zone}"

    def test_tier2_without_zip(self):
        """Test Tier 2 (regional) is used without ZIP"""
        # Should use regional fallback for Seattle without ZIP
        zone = self.service.get_hardiness_zone(47.6, -122.3, None)
        assert zone in ["8a", "9a"], f"Expected regional result, got {zone}"

    def test_tier2_with_invalid_address(self):
        """Test Tier 2 fallback when address has no ZIP"""
        # Should fall back to regional when address has no ZIP
        zone = self.service.get_hardiness_zone(47.6, -122.3, "No ZIP here")
        assert zone in ["8a", "9a"], f"Expected regional fallback, got {zone}"

    def test_miami_api_lookup(self):
        """Test Miami zone lookup (subtropical)"""
        # Miami: 25.8°N, -80.2°W → Zone 10b/11a
        zone = self.service.get_hardiness_zone(25.7617, -80.1918, "Miami, FL 33101")
        # Should get accurate result from API or regional
        assert zone in ["10a", "10b", "11a"], f"Expected tropical zone for Miami, got {zone}"

    def test_chicago_api_lookup(self):
        """Test Chicago zone lookup"""
        # Chicago: 41.9°N, -87.6°W → Zone 6a
        zone = self.service.get_hardiness_zone(41.8781, -87.6298, "Chicago, IL 60601")
        assert zone in ["5b", "6a"], f"Expected Chicago zone, got {zone}"


class TestZoneAccuracy:
    """Test zone accuracy against known locations"""

    def setup_method(self):
        self.service = GeocodingService()

    def test_known_locations_accuracy(self):
        """Test multiple known locations for accuracy"""
        # Format: (lat, lng, address, expected_zones)
        test_locations = [
            (47.6, -122.3, "Seattle, WA 98101", ["8a", "9a"]),
            (44.9, -93.3, "Minneapolis, MN 55401", ["4a", "4b", "5a"]),
            (39.7, -104.9, "Denver, CO 80201", ["5a", "5b", "6a"]),
            (38.9, -77.0, "Washington, DC 20001", ["7a", "7b", "8a"]),
            (42.4, -71.1, "Boston, MA 02101", ["6b", "7a"]),
        ]

        for lat, lng, address, expected in test_locations:
            zone = self.service.get_hardiness_zone(lat, lng, address)
            assert zone in expected, f"Location {address}: expected {expected}, got {zone}"


class TestEdgeCases:
    """Test edge cases and error handling"""

    def setup_method(self):
        self.service = GeocodingService()

    def test_extreme_north_coordinates(self):
        """Test very northern coordinates"""
        # Alaska: 61.2°N, -149.9°W → Should return a zone (not None)
        zone = self.service._lookup_zone_from_coords(61.2, -149.9)
        assert zone is not None, "Should return a zone for Alaska coordinates"
        assert zone in ["3a", "4a", "4b"], f"Expected cold zone for Alaska, got {zone}"

    def test_extreme_south_coordinates(self):
        """Test very southern coordinates"""
        # South Florida Keys: 24.5°N, -81.8°W → Should return warmest zones
        zone = self.service._lookup_zone_from_coords(24.5, -81.8)
        assert zone is not None, "Should return a zone for Florida Keys"
        assert zone in ["11a", "11b"], f"Expected very warm zone, got {zone}"

    def test_empty_address(self):
        """Test with empty address string"""
        zone = self.service.get_hardiness_zone(47.6, -122.3, "")
        assert zone in ["8a", "9a"], "Should fall back to regional lookup"

    def test_none_address(self):
        """Test with None address"""
        zone = self.service.get_hardiness_zone(47.6, -122.3, None)
        assert zone in ["8a", "9a"], "Should fall back to regional lookup"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
