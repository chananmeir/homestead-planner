"""
USDA FoodData Central API Service

Integrates with USDA FoodData Central API to fetch nutritional data for foods.
API Documentation: https://fdc.nal.usda.gov/api-guide.html

Rate Limits:
- 1,000 requests per hour (using 900/hour safety buffer)
- Data is cached in nutritional_data table to minimize API calls

API Key Setup:
1. Sign up at https://fdc.nal.usda.gov/api-key-signup.html
2. Add USDA_API_KEY to .env file
"""
import os
import requests
import sqlite3
from typing import Dict, List, Optional
from datetime import datetime
import time

# USDA API Configuration
USDA_API_BASE_URL = "https://api.nal.usda.gov/fdc/v1"
USDA_API_KEY = os.getenv('USDA_API_KEY')

# Rate limiting
REQUESTS_PER_HOUR = 900  # Safety buffer (actual limit is 1,000)
RATE_LIMIT_WINDOW = 3600  # 1 hour in seconds

# Path to database
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'instance', 'homestead.db')


class USDAAPIService:
    """Service for interacting with USDA FoodData Central API"""

    def __init__(self, api_key: str = None):
        """Initialize USDA API service"""
        self.api_key = api_key or USDA_API_KEY
        self.request_times: List[float] = []

    def _check_rate_limit(self):
        """Check if we're within rate limit"""
        current_time = time.time()

        # Remove requests older than 1 hour
        self.request_times = [t for t in self.request_times if current_time - t < RATE_LIMIT_WINDOW]

        if len(self.request_times) >= REQUESTS_PER_HOUR:
            raise Exception(f"Rate limit exceeded: {REQUESTS_PER_HOUR} requests per hour")

        # Record this request
        self.request_times.append(current_time)

    def _make_request(self, endpoint: str, params: Dict = None) -> Dict:
        """Make HTTP request to USDA API"""
        if not self.api_key:
            raise ValueError("USDA_API_KEY not set. Please add it to your .env file.")

        self._check_rate_limit()

        url = f"{USDA_API_BASE_URL}/{endpoint}"
        params = params or {}
        params['api_key'] = self.api_key

        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            if response.status_code == 403:
                raise ValueError("Invalid USDA API key. Please check your .env file.")
            elif response.status_code == 429:
                raise Exception("USDA API rate limit exceeded. Please try again later.")
            else:
                raise Exception(f"USDA API error: {str(e)}")
        except requests.exceptions.RequestException as e:
            raise Exception(f"Network error calling USDA API: {str(e)}")

    def search_foods(self, query: str, page_size: int = 10, page_number: int = 1,
                     data_type: str = None) -> Dict:
        """
        Search for foods in USDA database

        Args:
            query: Search term (e.g., "tomato", "broccoli raw")
            page_size: Number of results per page (max 200)
            page_number: Page number (1-indexed)
            data_type: Filter by data type ('Foundation', 'SR Legacy', 'Branded', 'Survey')

        Returns:
            {
                'totalHits': int,
                'currentPage': int,
                'totalPages': int,
                'foods': [
                    {
                        'fdcId': int,
                        'description': str,
                        'dataType': str,
                        'brandOwner': str (optional),
                        ...
                    }
                ]
            }
        """
        params = {
            'query': query,
            'pageSize': min(page_size, 200),
            'pageNumber': page_number
        }

        if data_type:
            params['dataType'] = [data_type]

        result = self._make_request('foods/search', params)

        # Simplify response
        return {
            'totalHits': result.get('totalHits', 0),
            'currentPage': result.get('currentPage', 1),
            'totalPages': result.get('totalPages', 1),
            'foods': result.get('foods', [])
        }

    def get_food_details(self, fdc_id: int, format: str = 'abridged') -> Dict:
        """
        Get detailed nutritional data for a specific food

        Args:
            fdc_id: USDA FoodData Central ID
            format: 'abridged' (default) or 'full'

        Returns:
            {
                'fdcId': int,
                'description': str,
                'dataType': str,
                'foodNutrients': [
                    {
                        'nutrientId': int,
                        'nutrientName': str,
                        'nutrientNumber': str,
                        'unitName': str,
                        'value': float
                    }
                ],
                ...
            }
        """
        params = {'format': format}
        return self._make_request(f'food/{fdc_id}', params)

    def map_usda_to_nutritional_data(self, fdc_id: int, source_id: str,
                                      yield_lbs_per_plant: float = None,
                                      yield_lbs_per_sqft: float = None) -> Dict:
        """
        Fetch USDA data and map to our nutritional_data schema

        Args:
            fdc_id: USDA FoodData Central ID
            source_id: Our plant ID (e.g., 'tomato', 'broccoli')
            yield_lbs_per_plant: Average yield in lbs per plant (optional)
            yield_lbs_per_sqft: Average yield in lbs per sqft (optional)

        Returns:
            Dictionary matching nutritional_data table schema
        """
        # Get food details from USDA
        food = self.get_food_details(fdc_id)

        # Build nutrient lookup
        nutrients = {}
        for nutrient in food.get('foodNutrients', []):
            nutrient_name = nutrient.get('nutrientName', '').lower()
            nutrient_number = nutrient.get('nutrientNumber', '')
            value = nutrient.get('value', 0)

            nutrients[nutrient_number] = value
            nutrients[nutrient_name] = value

        # Map USDA nutrients to our schema
        # Nutrient numbers from USDA (standard identifiers)
        nutritional_data = {
            'source_type': 'plant',
            'source_id': source_id,
            'name': food.get('description', ''),
            'usda_fdc_id': fdc_id,

            # Macronutrients (per 100g)
            'calories': nutrients.get('208', None),  # Energy (kcal)
            'protein_g': nutrients.get('203', None),  # Protein
            'carbs_g': nutrients.get('205', None),  # Carbohydrate
            'fat_g': nutrients.get('204', None),  # Total lipid (fat)
            'fiber_g': nutrients.get('291', None),  # Fiber, total dietary

            # Vitamins (per 100g)
            'vitamin_a_iu': nutrients.get('318', None),  # Vitamin A, IU
            'vitamin_c_mg': nutrients.get('401', None),  # Vitamin C
            'vitamin_k_mcg': nutrients.get('430', None),  # Vitamin K
            'vitamin_e_mg': nutrients.get('323', None),  # Vitamin E
            'folate_mcg': nutrients.get('417', None),  # Folate, total

            # Minerals (per 100g)
            'calcium_mg': nutrients.get('301', None),  # Calcium
            'iron_mg': nutrients.get('303', None),  # Iron
            'magnesium_mg': nutrients.get('304', None),  # Magnesium
            'potassium_mg': nutrients.get('306', None),  # Potassium
            'zinc_mg': nutrients.get('309', None),  # Zinc

            # Yield data (user-provided or None)
            'average_yield_lbs_per_plant': yield_lbs_per_plant,
            'average_yield_lbs_per_sqft': yield_lbs_per_sqft,
            'average_yield_lbs_per_tree_year': None,

            'data_source': f'USDA FoodData Central (FDC ID: {fdc_id})',
            'notes': f"Data type: {food.get('dataType', 'Unknown')}",
            'last_updated': datetime.utcnow().isoformat()
        }

        return nutritional_data

    def cache_nutritional_data(self, nutritional_data: Dict, user_id: int = None) -> int:
        """
        Cache nutritional data in database

        Args:
            nutritional_data: Dictionary matching nutritional_data table schema
            user_id: User ID (None for global data)

        Returns:
            ID of created/updated entry
        """
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        try:
            # Check if entry exists
            cursor.execute("""
                SELECT id FROM nutritional_data
                WHERE source_type = ? AND source_id = ? AND (
                    (user_id IS NULL AND ? IS NULL) OR user_id = ?
                )
            """, (
                nutritional_data['source_type'],
                nutritional_data['source_id'],
                user_id,
                user_id
            ))

            existing = cursor.fetchone()

            if existing:
                # Update existing
                entry_id = existing[0]
                cursor.execute("""
                    UPDATE nutritional_data SET
                        name = ?, usda_fdc_id = ?,
                        calories = ?, protein_g = ?, carbs_g = ?, fat_g = ?, fiber_g = ?,
                        vitamin_a_iu = ?, vitamin_c_mg = ?, vitamin_k_mcg = ?,
                        vitamin_e_mg = ?, folate_mcg = ?,
                        calcium_mg = ?, iron_mg = ?, magnesium_mg = ?,
                        potassium_mg = ?, zinc_mg = ?,
                        average_yield_lbs_per_plant = ?,
                        average_yield_lbs_per_sqft = ?,
                        average_yield_lbs_per_tree_year = ?,
                        data_source = ?, notes = ?, last_updated = ?
                    WHERE id = ?
                """, (
                    nutritional_data['name'],
                    nutritional_data['usda_fdc_id'],
                    nutritional_data['calories'],
                    nutritional_data['protein_g'],
                    nutritional_data['carbs_g'],
                    nutritional_data['fat_g'],
                    nutritional_data['fiber_g'],
                    nutritional_data['vitamin_a_iu'],
                    nutritional_data['vitamin_c_mg'],
                    nutritional_data['vitamin_k_mcg'],
                    nutritional_data['vitamin_e_mg'],
                    nutritional_data['folate_mcg'],
                    nutritional_data['calcium_mg'],
                    nutritional_data['iron_mg'],
                    nutritional_data['magnesium_mg'],
                    nutritional_data['potassium_mg'],
                    nutritional_data['zinc_mg'],
                    nutritional_data['average_yield_lbs_per_plant'],
                    nutritional_data['average_yield_lbs_per_sqft'],
                    nutritional_data['average_yield_lbs_per_tree_year'],
                    nutritional_data['data_source'],
                    nutritional_data['notes'],
                    nutritional_data['last_updated'],
                    entry_id
                ))
            else:
                # Create new
                cursor.execute("""
                    INSERT INTO nutritional_data (
                        source_type, source_id, name, usda_fdc_id,
                        calories, protein_g, carbs_g, fat_g, fiber_g,
                        vitamin_a_iu, vitamin_c_mg, vitamin_k_mcg,
                        vitamin_e_mg, folate_mcg,
                        calcium_mg, iron_mg, magnesium_mg,
                        potassium_mg, zinc_mg,
                        average_yield_lbs_per_plant,
                        average_yield_lbs_per_sqft,
                        average_yield_lbs_per_tree_year,
                        data_source, notes, last_updated, user_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    nutritional_data['source_type'],
                    nutritional_data['source_id'],
                    nutritional_data['name'],
                    nutritional_data['usda_fdc_id'],
                    nutritional_data['calories'],
                    nutritional_data['protein_g'],
                    nutritional_data['carbs_g'],
                    nutritional_data['fat_g'],
                    nutritional_data['fiber_g'],
                    nutritional_data['vitamin_a_iu'],
                    nutritional_data['vitamin_c_mg'],
                    nutritional_data['vitamin_k_mcg'],
                    nutritional_data['vitamin_e_mg'],
                    nutritional_data['folate_mcg'],
                    nutritional_data['calcium_mg'],
                    nutritional_data['iron_mg'],
                    nutritional_data['magnesium_mg'],
                    nutritional_data['potassium_mg'],
                    nutritional_data['zinc_mg'],
                    nutritional_data['average_yield_lbs_per_plant'],
                    nutritional_data['average_yield_lbs_per_sqft'],
                    nutritional_data['average_yield_lbs_per_tree_year'],
                    nutritional_data['data_source'],
                    nutritional_data['notes'],
                    nutritional_data['last_updated'],
                    user_id
                ))
                entry_id = cursor.lastrowid

            conn.commit()
            return entry_id

        finally:
            conn.close()

    def import_from_usda(self, fdc_id: int, source_id: str,
                        yield_lbs_per_plant: float = None,
                        yield_lbs_per_sqft: float = None,
                        user_id: int = None) -> Dict:
        """
        Complete workflow: Fetch from USDA, map, and cache

        Args:
            fdc_id: USDA FoodData Central ID
            source_id: Our plant ID (e.g., 'tomato')
            yield_lbs_per_plant: Average yield per plant
            yield_lbs_per_sqft: Average yield per sqft
            user_id: User ID (None for global data)

        Returns:
            Cached nutritional data with ID
        """
        # Fetch and map
        nutritional_data = self.map_usda_to_nutritional_data(
            fdc_id, source_id, yield_lbs_per_plant, yield_lbs_per_sqft
        )

        # Cache in database
        entry_id = self.cache_nutritional_data(nutritional_data, user_id)

        # Add ID to returned data
        nutritional_data['id'] = entry_id
        nutritional_data['user_id'] = user_id

        return nutritional_data


# Convenience functions
def search_usda_foods(query: str, page_size: int = 10) -> Dict:
    """Search USDA database for foods"""
    service = USDAAPIService()
    return service.search_foods(query, page_size)


def import_usda_food(fdc_id: int, source_id: str, yield_lbs_per_plant: float = None,
                    yield_lbs_per_sqft: float = None, user_id: int = None) -> Dict:
    """Import food from USDA and cache in database"""
    service = USDAAPIService()
    return service.import_from_usda(fdc_id, source_id, yield_lbs_per_plant,
                                   yield_lbs_per_sqft, user_id)
