"""
Geocoding service for address validation and coordinate lookup.
Supports Geocodio and Google Maps Geocoding APIs.
"""

import requests
import os
from typing import Optional, Dict, Any


class GeocodingService:
    """Wrapper for geocoding APIs (Geocodio or Google Maps)"""

    def __init__(self):
        self.api_key = os.environ.get('GEOCODING_API_KEY')
        self.provider = os.environ.get('GEOCODING_PROVIDER', 'geocodio')  # or 'google'

        if not self.api_key:
            print("WARNING: GEOCODING_API_KEY not set in environment variables")

    def validate_address(self, address: str) -> Optional[Dict[str, Any]]:
        """
        Validate address and return coordinates + metadata

        Args:
            address: Full address string to validate

        Returns:
            Dict with latitude, longitude, formatted_address, accuracy
            Returns None if address not found or API error
        """
        # Try zipcode fallback first for common zipcodes (no API key needed)
        if address and len(address) == 5 and address.isdigit():
            fallback = self._zipcode_fallback(address)
            if fallback:
                return fallback

        if not self.api_key:
            return None

        if self.provider == 'geocodio':
            return self._geocodio_lookup(address)
        elif self.provider == 'google':
            return self._google_lookup(address)
        return None

    def _zipcode_fallback(self, zipcode: str) -> Optional[Dict[str, Any]]:
        """
        Fallback zipcode lookup for common US zipcodes (no API key needed)
        This provides approximate coordinates for major city zipcodes
        """
        # Common zipcode coordinates (major cities and regions)
        zipcode_coords = {
            # California
            '90210': (34.0901, -118.4065, 'Beverly Hills, CA'),  # Beverly Hills
            '94102': (37.7749, -122.4194, 'San Francisco, CA'),
            '90001': (33.9731, -118.2479, 'Los Angeles, CA'),
            '92101': (32.7157, -117.1611, 'San Diego, CA'),

            # Wisconsin
            '53209': (43.0731, -87.9647, 'Milwaukee, WI'),
            '53703': (43.0731, -89.4012, 'Madison, WI'),

            # New York
            '10001': (40.7506, -73.9971, 'New York, NY'),
            '14201': (42.8864, -78.8784, 'Buffalo, NY'),

            # Texas
            '75201': (32.7767, -96.7970, 'Dallas, TX'),
            '77001': (29.7604, -95.3698, 'Houston, TX'),
            '78701': (30.2672, -97.7431, 'Austin, TX'),

            # Florida
            '33101': (25.7617, -80.1918, 'Miami, FL'),
            '32801': (28.5383, -81.3792, 'Orlando, FL'),

            # Illinois
            '60601': (41.8781, -87.6298, 'Chicago, IL'),

            # Washington
            '98101': (47.6062, -122.3321, 'Seattle, WA'),

            # Colorado
            '80201': (39.7392, -104.9903, 'Denver, CO'),

            # Add more as needed
        }

        if zipcode in zipcode_coords:
            lat, lng, city = zipcode_coords[zipcode]
            return {
                'latitude': lat,
                'longitude': lng,
                'formatted_address': city,
                'accuracy': 0.8,
                'accuracy_type': 'zipcode_fallback',
                'confidence': 0.7
            }

        return None

    def _geocodio_lookup(self, address: str) -> Optional[Dict[str, Any]]:
        """
        Use Geocodio API (2,500 free/day, US/Canada only)

        API Docs: https://www.geocod.io/docs/
        """
        url = "https://api.geocod.io/v1.7/geocode"
        params = {
            'q': address,
            'api_key': self.api_key,
            'fields': 'census2020'  # Can get additional census data if needed
        }

        try:
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get('results') and len(data['results']) > 0:
                    result = data['results'][0]
                    return {
                        'latitude': result['location']['lat'],
                        'longitude': result['location']['lng'],
                        'formatted_address': result['formatted_address'],
                        'accuracy': result['accuracy'],
                        'accuracy_type': result.get('accuracy_type', 'unknown'),
                        'confidence': result.get('accuracy', 0)
                    }
        except requests.exceptions.RequestException as e:
            print(f"Geocodio API error: {e}")
            return None
        except (KeyError, IndexError) as e:
            print(f"Geocodio response parsing error: {e}")
            return None

        return None

    def _google_lookup(self, address: str) -> Optional[Dict[str, Any]]:
        """
        Use Google Geocoding API (10,000 free/month)

        API Docs: https://developers.google.com/maps/documentation/geocoding
        """
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {
            'address': address,
            'key': self.api_key
        }

        try:
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'OK' and data.get('results'):
                    result = data['results'][0]
                    location = result['geometry']['location']
                    return {
                        'latitude': location['lat'],
                        'longitude': location['lng'],
                        'formatted_address': result['formatted_address'],
                        'accuracy': result['geometry'].get('location_type', 'APPROXIMATE'),
                        'accuracy_type': result['geometry'].get('location_type', 'APPROXIMATE'),
                        'confidence': 1.0 if result['geometry'].get('location_type') == 'ROOFTOP' else 0.8
                    }
        except requests.exceptions.RequestException as e:
            print(f"Google Geocoding API error: {e}")
            return None
        except (KeyError, IndexError) as e:
            print(f"Google response parsing error: {e}")
            return None

        return None

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
            response = requests.get(url, timeout=5)

            if response.status_code == 200:
                data = response.json()
                zone = data.get('zone')
                if zone:
                    return zone

        except (requests.exceptions.RequestException, ValueError, KeyError) as e:
            # Log error but don't raise - fallback tiers will handle
            print(f"Zone API lookup failed for ZIP {zipcode}: {e}")

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
