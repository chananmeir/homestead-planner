"""
Nutritional Service - Calculate nutritional output from gardens, livestock, and trees

This service calculates the total nutritional output (calories, protein, vitamins, minerals)
from all food sources on the homestead.

Key calculations:
- Garden: PlantingEvents × yields × nutritional data
- Livestock: Animal counts × production rates × nutritional data (Phase 3)
- Trees: Tree counts × yields × nutritional data (Phase 3)
"""
import sqlite3
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import os
from services.breed_service import BreedService
from simulation_clock import get_now, get_utc_now

# Path to database
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'instance', 'homestead.db')

# Constants
LBS_TO_GRAMS = 453.592


class NutritionalService:
    """Service for calculating nutritional output from all food sources"""

    def __init__(self, db_path: str = None):
        """Initialize service with optional custom database path"""
        self.db_path = db_path or DB_PATH

    def get_connection(self):
        """Get database connection"""
        return sqlite3.connect(self.db_path)

    # Alias map for known plant ID variants
    # Maps alternative IDs to canonical source_id in nutritional_data table
    PLANT_ALIASES = {
        # Chia variants
        'chia': 'chia-1',
        'chia-white': 'chia-1',
        'white-chia': 'chia-1',
        # Bean variants (generic 'bean' maps to bush bean)
        'bean': 'bean-bush',
        'green-bean': 'bean-bush',
        # Pumpkin maps to winter squash (similar nutrition profile)
        'pumpkin': 'squash-winter',
        # Pepper variants
        'pepper': 'pepper-bell',
        'bell-pepper': 'pepper-bell',
        # Squash variants
        'squash': 'squash-summer',
        'yellow-squash': 'squash-summer',
        # Lettuce variants
        'lettuce-leaf': 'lettuce',
        'lettuce-romaine': 'lettuce',
        'lettuce-head': 'lettuce',
        # Melon variants
        'cantaloupe': 'melon-cantaloupe',
        'melon': 'melon-cantaloupe',
    }

    def get_nutritional_data(self, plant_id: str, user_id: Optional[int] = None, source_type: str = 'plant') -> Optional[Dict]:
        """
        Get nutritional data for a plant or livestock product.

        Lookup order:
        1. Exact match on plant_id
        2. Strip numeric suffix (e.g., 'tomato-1' → 'tomato')
        3. Consult alias map for known variants

        Args:
            plant_id: Plant/product identifier (e.g., 'tomato', 'tomato-1', 'chicken-egg', 'goat-milk')
            user_id: User ID for user-specific overrides (optional)
            source_type: Type of source ('plant', 'livestock', 'tree')

        Returns:
            Dictionary of nutritional data with '_matched_key' field showing which ID matched,
            or None if not found
        """
        conn = self.get_connection()
        cursor = conn.cursor()

        try:
            # Build list of IDs to try in order
            ids_to_try = []

            # 1. Exact match first
            ids_to_try.append(('exact', plant_id))

            # 2. Strip numeric suffix (e.g., 'bok-choy-1' → 'bok-choy')
            stripped_id = self._extract_base_plant_id(plant_id)
            if stripped_id != plant_id:
                ids_to_try.append(('stripped', stripped_id))

            # 3. Check alias map (try both original and stripped)
            for check_id in [plant_id, stripped_id]:
                if check_id in self.PLANT_ALIASES:
                    aliased_id = self.PLANT_ALIASES[check_id]
                    ids_to_try.append(('alias', aliased_id))

            # Try each ID in order
            for match_type, try_id in ids_to_try:
                # Try user-specific data first
                if user_id:
                    cursor.execute("""
                        SELECT * FROM nutritional_data
                        WHERE source_type = ? AND source_id = ? AND user_id = ?
                    """, (source_type, try_id, user_id))
                    row = cursor.fetchone()

                    if row:
                        result = self._row_to_dict(cursor, row)
                        result['_matched_key'] = try_id
                        result['_match_type'] = match_type
                        return result

                # Fall back to global data
                cursor.execute("""
                    SELECT * FROM nutritional_data
                    WHERE source_type = ? AND source_id = ? AND user_id IS NULL
                """, (source_type, try_id))
                row = cursor.fetchone()

                if row:
                    result = self._row_to_dict(cursor, row)
                    result['_matched_key'] = try_id
                    result['_match_type'] = match_type
                    return result

            return None

        finally:
            conn.close()

    def _extract_base_plant_id(self, plant_id: str) -> str:
        """
        Extract base plant ID from variety-suffixed plant ID

        Examples:
            'tomato-1' -> 'tomato'
            'lettuce-3' -> 'lettuce'
            'pepper-bell-2' -> 'pepper-bell'
            'tomato' -> 'tomato'

        Args:
            plant_id: Full plant ID with optional variety suffix

        Returns:
            Base plant ID without variety suffix
        """
        # If the plant_id ends with '-{digit(s)}', remove it
        import re
        match = re.match(r'^(.+)-(\d+)$', plant_id)
        if match:
            return match.group(1)
        return plant_id

    def _row_to_dict(self, cursor, row) -> Dict:
        """Convert database row to dictionary"""
        columns = [description[0] for description in cursor.description]
        return dict(zip(columns, row))

    def estimate_plant_yield(self, plant_id: str, planting_event: Dict, nutrition_data: Dict) -> float:
        """
        Estimate yield in pounds for a planting event

        Args:
            plant_id: Plant identifier
            planting_event: PlantingEvent data dictionary
            nutrition_data: Nutritional data dictionary with yield estimates

        Returns:
            Estimated yield in pounds
        """
        planting_method = planting_event.get('planting_method', 'individual_plants')

        # Individual plants method (SFG, Row, Intensive)
        if planting_method == 'individual_plants':
            quantity = planting_event.get('quantity', 0)
            yield_per_plant = nutrition_data.get('average_yield_lbs_per_plant', 0)

            if quantity and yield_per_plant:
                return quantity * yield_per_plant

        # Seed density method (MIGardener)
        elif planting_method == 'seed_density':
            planting_style = planting_event.get('planting_style')

            # Row-based planting
            if planting_style == 'row_based':
                ui_segment_length = planting_event.get('ui_segment_length_inches', 0)
                yield_per_sqft = nutrition_data.get('average_yield_lbs_per_sqft', 0)

                if ui_segment_length and yield_per_sqft:
                    # Convert segment length to square feet (approximate)
                    # Assume 12" wide bed for MIGardener rows
                    sqft = (ui_segment_length * 12) / 144
                    return sqft * yield_per_sqft

            # Broadcast planting
            elif planting_style == 'broadcast':
                grid_cell_area = planting_event.get('grid_cell_area_inches', 0)
                yield_per_sqft = nutrition_data.get('average_yield_lbs_per_sqft', 0)

                if grid_cell_area and yield_per_sqft:
                    sqft = grid_cell_area / 144
                    return sqft * yield_per_sqft

            # Plant spacing (use individual plant yield)
            elif planting_style == 'plant_spacing':
                expected_final_count = planting_event.get('expected_final_count', 0)
                yield_per_plant = nutrition_data.get('average_yield_lbs_per_plant', 0)

                if expected_final_count and yield_per_plant:
                    return expected_final_count * yield_per_plant

        return 0.0

    def calculate_nutrition_from_yield(self, yield_lbs: float, nutrition_data: Dict) -> Dict:
        """
        Calculate nutritional values from yield in pounds

        Nutritional data is stored per 100g, so we need to:
        1. Convert pounds to grams
        2. Calculate nutrition proportionally

        Args:
            yield_lbs: Yield in pounds
            nutrition_data: Nutritional data per 100g

        Returns:
            Dictionary of total nutritional values
        """
        total_grams = yield_lbs * LBS_TO_GRAMS
        multiplier = total_grams / 100.0  # Nutrition is per 100g

        return {
            'calories': (nutrition_data.get('calories') or 0) * multiplier,
            'protein_g': (nutrition_data.get('protein_g') or 0) * multiplier,
            'carbs_g': (nutrition_data.get('carbs_g') or 0) * multiplier,
            'fat_g': (nutrition_data.get('fat_g') or 0) * multiplier,
            'fiber_g': (nutrition_data.get('fiber_g') or 0) * multiplier,
            'vitamin_a_iu': (nutrition_data.get('vitamin_a_iu') or 0) * multiplier,
            'vitamin_c_mg': (nutrition_data.get('vitamin_c_mg') or 0) * multiplier,
            'vitamin_k_mcg': (nutrition_data.get('vitamin_k_mcg') or 0) * multiplier,
            'vitamin_e_mg': (nutrition_data.get('vitamin_e_mg') or 0) * multiplier,
            'folate_mcg': (nutrition_data.get('folate_mcg') or 0) * multiplier,
            'calcium_mg': (nutrition_data.get('calcium_mg') or 0) * multiplier,
            'iron_mg': (nutrition_data.get('iron_mg') or 0) * multiplier,
            'magnesium_mg': (nutrition_data.get('magnesium_mg') or 0) * multiplier,
            'potassium_mg': (nutrition_data.get('potassium_mg') or 0) * multiplier,
            'zinc_mg': (nutrition_data.get('zinc_mg') or 0) * multiplier,
        }

    def calculate_garden_nutrition(self, user_id: int, year: Optional[int] = None) -> Dict:
        """
        Calculate total nutritional output from garden for a user

        Args:
            user_id: User ID
            year: Optional year filter (defaults to current year)

        Returns:
            Dictionary with total nutrition and breakdown by plant
        """
        conn = self.get_connection()
        cursor = conn.cursor()

        try:
            # Get all planting events for user (exclude abandoned: completed with 0 quantity)
            if year:
                cursor.execute("""
                    SELECT * FROM planting_event
                    WHERE user_id = ? AND event_type = 'planting'
                    AND NOT (completed = 1 AND quantity_completed = 0)
                    AND (strftime('%Y', direct_seed_date) = ? OR strftime('%Y', transplant_date) = ?)
                """, (user_id, str(year), str(year)))
            else:
                cursor.execute("""
                    SELECT * FROM planting_event
                    WHERE user_id = ? AND event_type = 'planting'
                    AND NOT (completed = 1 AND quantity_completed = 0)
                """, (user_id,))

            planting_events = [self._row_to_dict(cursor, row) for row in cursor.fetchall()]

            # Initialize totals
            totals = {
                'calories': 0,
                'protein_g': 0,
                'carbs_g': 0,
                'fat_g': 0,
                'fiber_g': 0,
                'vitamin_a_iu': 0,
                'vitamin_c_mg': 0,
                'vitamin_k_mcg': 0,
                'vitamin_e_mg': 0,
                'folate_mcg': 0,
                'calcium_mg': 0,
                'iron_mg': 0,
                'magnesium_mg': 0,
                'potassium_mg': 0,
                'zinc_mg': 0,
            }

            by_plant = {}
            succession_groups = {}

            # Process each planting event
            for event in planting_events:
                plant_id = event.get('plant_id')
                if not plant_id:
                    continue

                # Get nutritional data
                nutrition_data = self.get_nutritional_data(plant_id, user_id)
                if not nutrition_data:
                    continue  # Skip if no nutrition data available

                # Estimate yield
                yield_lbs = self.estimate_plant_yield(plant_id, event, nutrition_data)

                if yield_lbs <= 0:
                    continue

                # Calculate nutrition from yield
                nutrition = self.calculate_nutrition_from_yield(yield_lbs, nutrition_data)

                # Track succession plantings
                succession_group_id = event.get('succession_group_id')
                if succession_group_id:
                    if succession_group_id not in succession_groups:
                        succession_groups[succession_group_id] = []
                    succession_groups[succession_group_id].append({
                        'plant_id': plant_id,
                        'yield_lbs': yield_lbs,
                        'nutrition': nutrition
                    })
                else:
                    # Add to totals (non-succession or first in succession)
                    for key in totals:
                        totals[key] += nutrition[key]

                    # Track by plant
                    if plant_id not in by_plant:
                        by_plant[plant_id] = {
                            'name': nutrition_data.get('name', plant_id),
                            'total_yield_lbs': 0,
                            **{k: 0 for k in totals.keys()}
                        }

                    by_plant[plant_id]['total_yield_lbs'] += yield_lbs
                    for key in totals:
                        by_plant[plant_id][key] += nutrition[key]

            # Process succession groups (sum all plantings in each group)
            for group_id, plantings in succession_groups.items():
                for planting in plantings:
                    plant_id = planting['plant_id']
                    yield_lbs = planting['yield_lbs']
                    nutrition = planting['nutrition']

                    # Add to totals
                    for key in totals:
                        totals[key] += nutrition[key]

                    # Track by plant
                    nutrition_data = self.get_nutritional_data(plant_id, user_id)
                    if plant_id not in by_plant:
                        by_plant[plant_id] = {
                            'name': nutrition_data.get('name', plant_id) if nutrition_data else plant_id,
                            'total_yield_lbs': 0,
                            **{k: 0 for k in totals.keys()}
                        }

                    by_plant[plant_id]['total_yield_lbs'] += yield_lbs
                    for key in totals:
                        by_plant[plant_id][key] += nutrition[key]

            return {
                'totals': totals,
                'by_plant': by_plant,
                'year': year or get_now().year
            }

        finally:
            conn.close()

    def calculate_livestock_nutrition(self, user_id: int, year: Optional[int] = None) -> Dict:
        """
        Calculate total nutritional output from livestock

        Uses breed-specific and age-based production rates:
        - Chickens: Breed-specific egg rates (100-320 eggs/year) with age adjustments
        - Ducks: Breed-specific egg rates (120-300 eggs/year) with age adjustments
        - Beehives: 60 lbs honey/year (static)
        - Goats: Breed-specific milk rates (600-2200 lbs/year) with age adjustments
        - Dairy cows: 6,000 lbs milk/year (static, to be enhanced later)

        Args:
            user_id: User ID
            year: Optional year filter

        Returns:
            Dictionary with total nutrition and breakdown by animal type
        """
        conn = self.get_connection()
        cursor = conn.cursor()

        try:
            # Initialize breed service
            breed_service = BreedService()

            # Initialize totals
            totals = {
                'calories': 0,
                'protein_g': 0,
                'carbs_g': 0,
                'fat_g': 0,
                'fiber_g': 0,
                'vitamin_a_iu': 0,
                'vitamin_c_mg': 0,
                'vitamin_k_mcg': 0,
                'vitamin_e_mg': 0,
                'folate_mcg': 0,
                'calcium_mg': 0,
                'iron_mg': 0,
                'magnesium_mg': 0,
                'potassium_mg': 0,
                'zinc_mg': 0,
            }

            by_animal_type = {}
            production_summary = []

            # Chickens - breed and age-aware egg production
            cursor.execute("""
                SELECT breed, quantity, hatch_date, sex, purpose
                FROM chicken
                WHERE user_id = ? AND status = 'active'
            """, (user_id,))

            chickens = cursor.fetchall()
            if chickens:
                total_chicken_count = 0
                total_eggs = 0

                for chicken in chickens:
                    breed, quantity, hatch_date, sex, purpose = chicken

                    # Calculate age in weeks
                    age_weeks = self._calculate_age_weeks(hatch_date) if hatch_date else None

                    # Normalize breed name (convert "Rhode Island Red" to "rhode-island-red")
                    normalized_breed = breed_service.normalize_breed_name(breed) if breed else None

                    # Get breed-specific, age-adjusted production
                    annual_eggs, metadata = breed_service.calculate_age_adjusted_production(
                        species='chickens',
                        breed=normalized_breed,
                        age_weeks=age_weeks,
                        age_months=None,
                        quantity=quantity or 1,
                        sex=sex,
                        purpose=purpose
                    )

                    total_eggs += annual_eggs
                    total_chicken_count += (quantity or 1)

                # Convert eggs to nutrition
                egg_data = self.get_nutritional_data('chicken-egg', user_id, source_type='livestock')
                if egg_data and total_eggs > 0:
                    total_lbs = total_eggs * 0.11  # Average egg is 0.11 lbs
                    nutrition = self.calculate_nutrition_from_yield(total_lbs, egg_data)

                    for key in totals:
                        totals[key] += nutrition[key]

                    by_animal_type['chickens'] = {
                        'count': total_chicken_count,
                        'production': f"{total_eggs:,.0f} eggs/year",
                        'yield_lbs': total_lbs,
                        **nutrition
                    }
                    production_summary.append(f"{total_chicken_count} chickens → {total_eggs:,.0f} eggs/year (breed-adjusted)")

            # Ducks - breed and age-aware egg production
            cursor.execute("""
                SELECT breed, quantity, hatch_date, sex, purpose
                FROM duck
                WHERE user_id = ? AND status = 'active'
            """, (user_id,))

            ducks = cursor.fetchall()
            if ducks:
                total_duck_count = 0
                total_eggs = 0

                for duck in ducks:
                    breed, quantity, hatch_date, sex, purpose = duck

                    # Calculate age in weeks
                    age_weeks = self._calculate_age_weeks(hatch_date) if hatch_date else None

                    # Normalize breed name
                    normalized_breed = breed_service.normalize_breed_name(breed) if breed else None

                    # Get breed-specific, age-adjusted production
                    annual_eggs, metadata = breed_service.calculate_age_adjusted_production(
                        species='ducks',
                        breed=normalized_breed,
                        age_weeks=age_weeks,
                        age_months=None,
                        quantity=quantity or 1,
                        sex=sex,
                        purpose=purpose
                    )

                    total_eggs += annual_eggs
                    total_duck_count += (quantity or 1)

                # Convert eggs to nutrition
                egg_data = self.get_nutritional_data('duck-egg', user_id, source_type='livestock')
                if egg_data and total_eggs > 0:
                    total_lbs = total_eggs * 0.15  # Duck eggs are larger
                    nutrition = self.calculate_nutrition_from_yield(total_lbs, egg_data)

                    for key in totals:
                        totals[key] += nutrition[key]

                    by_animal_type['ducks'] = {
                        'count': total_duck_count,
                        'production': f"{total_eggs:,.0f} eggs/year",
                        'yield_lbs': total_lbs,
                        **nutrition
                    }
                    production_summary.append(f"{total_duck_count} ducks → {total_eggs:,.0f} eggs/year (breed-adjusted)")

            # Beehives - honey production (static rate)
            cursor.execute("""
                SELECT COUNT(*)
                FROM beehive
                WHERE user_id = ? AND status = 'active'
            """, (user_id,))

            beehive_count = cursor.fetchone()[0]
            if beehive_count > 0:
                honey_data = self.get_nutritional_data('honey', user_id, source_type='livestock')
                if honey_data:
                    honey_lbs_per_year = beehive_count * 60  # 60 lbs/hive/year
                    nutrition = self.calculate_nutrition_from_yield(honey_lbs_per_year, honey_data)

                    for key in totals:
                        totals[key] += nutrition[key]

                    by_animal_type['bees'] = {
                        'count': beehive_count,
                        'production': f"{honey_lbs_per_year} lbs honey/year",
                        'yield_lbs': honey_lbs_per_year,
                        **nutrition
                    }
                    production_summary.append(f"{beehive_count} beehives → {honey_lbs_per_year} lbs honey/year")

            # Goats - breed and age-aware milk production
            cursor.execute("""
                SELECT breed, birth_date, sex, purpose
                FROM livestock
                WHERE user_id = ? AND species IN ('goat', 'goats') AND status = 'active'
            """, (user_id,))

            goats = cursor.fetchall()
            if goats:
                total_goat_count = len(goats)
                total_milk_lbs = 0

                for goat in goats:
                    breed, birth_date, sex, purpose = goat

                    # Calculate age in months
                    age_months = self._calculate_age_months(birth_date) if birth_date else None

                    # Normalize breed name
                    normalized_breed = breed_service.normalize_breed_name(breed) if breed else None

                    # Get breed-specific, age-adjusted production
                    annual_milk, metadata = breed_service.calculate_age_adjusted_production(
                        species='goats',
                        breed=normalized_breed,
                        age_weeks=None,
                        age_months=age_months,
                        quantity=1,  # Each goat record is one animal
                        sex=sex,
                        purpose=purpose
                    )

                    total_milk_lbs += annual_milk

                # Convert milk to nutrition
                milk_data = self.get_nutritional_data('goat-milk', user_id, source_type='livestock')
                if milk_data and total_milk_lbs > 0:
                    nutrition = self.calculate_nutrition_from_yield(total_milk_lbs, milk_data)

                    for key in totals:
                        totals[key] += nutrition[key]

                    by_animal_type['goats'] = {
                        'count': total_goat_count,
                        'production': f"{total_milk_lbs:,.0f} lbs milk/year",
                        'yield_lbs': total_milk_lbs,
                        **nutrition
                    }
                    production_summary.append(f"{total_goat_count} goats → {total_milk_lbs:,.0f} lbs milk/year (breed-adjusted)")

            # Cows - milk production (static rate, to be enhanced with breed data later)
            cursor.execute("""
                SELECT COUNT(*)
                FROM livestock
                WHERE user_id = ? AND species IN ('cow', 'cows', 'cattle') AND status = 'active'
            """, (user_id,))

            cow_count = cursor.fetchone()[0]
            if cow_count > 0:
                milk_data = self.get_nutritional_data('cow-milk-whole', user_id, source_type='livestock')
                if milk_data:
                    # Assume all are dairy cows (static rate for now)
                    milk_lbs_per_year = cow_count * 6000  # 6,000 lbs/cow/year
                    nutrition = self.calculate_nutrition_from_yield(milk_lbs_per_year, milk_data)

                    for key in totals:
                        totals[key] += nutrition[key]

                    by_animal_type['cows'] = {
                        'count': cow_count,
                        'production': f"{milk_lbs_per_year:,} lbs milk/year",
                        'yield_lbs': milk_lbs_per_year,
                        **nutrition
                    }
                    production_summary.append(f"{cow_count} dairy cows → {milk_lbs_per_year:,} lbs milk/year")

            return {
                'totals': totals,
                'by_animal_type': by_animal_type,
                'production_summary': production_summary,
                'year': year or get_now().year
            }

        finally:
            conn.close()

    def _calculate_age_weeks(self, hatch_date) -> Optional[int]:
        """
        Calculate age in weeks from hatch date.

        Args:
            hatch_date: DateTime object or string representing hatch date

        Returns:
            Age in weeks, or None if hatch_date is None
        """
        if not hatch_date:
            return None

        # Handle both datetime objects and strings
        if isinstance(hatch_date, str):
            try:
                hatch_date = datetime.fromisoformat(hatch_date.replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                return None

        delta = get_utc_now() - hatch_date
        return int(delta.days / 7)

    def _calculate_age_months(self, birth_date) -> Optional[int]:
        """
        Calculate age in months from birth date.

        Args:
            birth_date: DateTime object or string representing birth date

        Returns:
            Age in months, or None if birth_date is None
        """
        if not birth_date:
            return None

        # Handle both datetime objects and strings
        if isinstance(birth_date, str):
            try:
                birth_date = datetime.fromisoformat(birth_date.replace('Z', '+00:00'))
            except (ValueError, AttributeError):
                return None

        delta = get_utc_now() - birth_date
        return int(delta.days / 30)

    def calculate_tree_nutrition(self, user_id: int, year: Optional[int] = None) -> Dict:
        """
        Calculate total nutritional output from fruit/nut trees

        Yield estimates based on tree maturity:
        - Trees produce 0-3 years: 0% yield
        - Trees 4-7 years: 25% yield
        - Trees 8-15 years: 75% yield
        - Trees 16+ years: 100% yield

        Args:
            user_id: User ID
            year: Optional year filter

        Returns:
            Dictionary with total nutrition and breakdown by tree type
        """
        conn = self.get_connection()
        cursor = conn.cursor()

        try:
            # Get all placed structures (trees) for user
            cursor.execute("""
                SELECT * FROM placed_structure
                WHERE user_id = ? AND structure_id LIKE 'tree-%'
            """, (user_id,))

            trees = [self._row_to_dict(cursor, row) for row in cursor.fetchall()]

            # Initialize totals
            totals = {
                'calories': 0,
                'protein_g': 0,
                'carbs_g': 0,
                'fat_g': 0,
                'fiber_g': 0,
                'vitamin_a_iu': 0,
                'vitamin_c_mg': 0,
                'vitamin_k_mcg': 0,
                'vitamin_e_mg': 0,
                'folate_mcg': 0,
                'calcium_mg': 0,
                'iron_mg': 0,
                'magnesium_mg': 0,
                'potassium_mg': 0,
                'zinc_mg': 0,
            }

            by_tree_type = {}
            tree_summary = []

            for tree in trees:
                structure_id = tree.get('structure_id', '')

                # Extract tree type from structure_id (e.g., 'tree-apple' -> 'apple')
                tree_type = structure_id.replace('tree-', '') if structure_id.startswith('tree-') else structure_id

                # Get nutritional data for this tree type
                tree_data = self.get_nutritional_data(tree_type, user_id)

                if not tree_data or not tree_data.get('average_yield_lbs_per_tree_year'):
                    continue

                # Calculate maturity-adjusted yield
                # For now, assume all trees are mature (100% yield)
                # TODO: Add planted_date to placed_structure table to calculate age
                maturity_factor = 1.0
                base_yield = tree_data.get('average_yield_lbs_per_tree_year', 0)
                actual_yield = base_yield * maturity_factor

                # Calculate nutrition from yield
                nutrition = self.calculate_nutrition_from_yield(actual_yield, tree_data)

                for key in totals:
                    totals[key] += nutrition[key]

                # Track by tree type
                if tree_type not in by_tree_type:
                    by_tree_type[tree_type] = {
                        'name': tree_data.get('name', tree_type),
                        'count': 0,
                        'total_yield_lbs': 0,
                        **{k: 0 for k in totals.keys()}
                    }

                by_tree_type[tree_type]['count'] += 1
                by_tree_type[tree_type]['total_yield_lbs'] += actual_yield
                for key in totals:
                    by_tree_type[tree_type][key] += nutrition[key]

            # Generate summary
            for tree_type, data in by_tree_type.items():
                tree_summary.append(
                    f"{data['count']} {tree_type} trees → {data['total_yield_lbs']:.0f} lbs/year"
                )

            return {
                'totals': totals,
                'by_tree_type': by_tree_type,
                'tree_summary': tree_summary,
                'year': year or get_now().year
            }

        finally:
            conn.close()

    def estimate_nutrition_from_items(
        self,
        items: List[Dict],
        user_id: Optional[int] = None,
        year: Optional[int] = None
    ) -> Dict:
        """
        Estimate nutrition from a list of plan items (unified calculation).

        This is the single source of truth for nutrition estimation, used by:
        - GardenPlanner.tsx wizard (POST /api/nutrition/estimate)
        - PlanNutritionCard (GET /api/garden-plans/<id>/nutrition)

        Args:
            items: List of dictionaries with:
                - plant_id: str (e.g., 'tomato', 'tomato-1')
                - quantity: int (number of plants or plant equivalents)
                - succession_count: int (number of succession plantings, default 1)
                - variety: Optional[str] (variety name for display)
            user_id: User ID for user-specific nutrition overrides
            year: Year for the estimate (default: current year)

        Returns:
            Dictionary with camelCase keys matching frontend contract:
                - totals: { calories, proteinG, carbsG, fatG, ... }
                - byPlant: { plant_id: { name, variety, plantEquivalent, ... } }
                - missingNutritionData: [plant_id, ...] - plants without nutrition data
                - year: int
        """
        # Initialize totals
        totals = {
            'calories': 0,
            'proteinG': 0,
            'carbsG': 0,
            'fatG': 0,
            'fiberG': 0,
            'vitaminAIu': 0,
            'vitaminCMg': 0,
            'vitaminKMcg': 0,
            'vitaminEMg': 0,
            'folateMcg': 0,
            'calciumMg': 0,
            'ironMg': 0,
            'magnesiumMg': 0,
            'potassiumMg': 0,
            'zincMg': 0,
        }

        by_plant = {}
        missing_data = []

        for item in items:
            plant_id = item.get('plant_id') or item.get('plantId')
            if not plant_id:
                continue

            quantity = item.get('quantity', 0)
            if not quantity:
                continue

            succession_count = item.get('succession_count') or item.get('successionCount') or 1
            variety = item.get('variety')

            # Get nutrition data for this plant
            nutrition_data = self.get_nutritional_data(plant_id, user_id)

            if not nutrition_data:
                if plant_id not in missing_data:
                    missing_data.append(plant_id)
                continue

            # Get yield per plant
            yield_per_plant = nutrition_data.get('average_yield_lbs_per_plant', 0)
            if not yield_per_plant:
                if plant_id not in missing_data:
                    missing_data.append(plant_id)
                continue

            # Calculate yield: quantity × yield_per_plant × succession_count
            total_yield = quantity * yield_per_plant * succession_count

            # Calculate nutrition from yield
            # Convert lbs → grams → nutrition (nutrition_data is per 100g)
            yield_grams = total_yield * LBS_TO_GRAMS
            multiplier = yield_grams / 100

            # Calculate per-plant nutrition values
            plant_nutrition = {
                'calories': (nutrition_data.get('calories') or 0) * multiplier,
                'proteinG': (nutrition_data.get('protein_g') or 0) * multiplier,
                'carbsG': (nutrition_data.get('carbs_g') or 0) * multiplier,
                'fatG': (nutrition_data.get('fat_g') or 0) * multiplier,
                'fiberG': (nutrition_data.get('fiber_g') or 0) * multiplier,
                'vitaminAIu': (nutrition_data.get('vitamin_a_iu') or 0) * multiplier,
                'vitaminCMg': (nutrition_data.get('vitamin_c_mg') or 0) * multiplier,
                'vitaminKMcg': (nutrition_data.get('vitamin_k_mcg') or 0) * multiplier,
                'vitaminEMg': (nutrition_data.get('vitamin_e_mg') or 0) * multiplier,
                'folateMcg': (nutrition_data.get('folate_mcg') or 0) * multiplier,
                'calciumMg': (nutrition_data.get('calcium_mg') or 0) * multiplier,
                'ironMg': (nutrition_data.get('iron_mg') or 0) * multiplier,
                'magnesiumMg': (nutrition_data.get('magnesium_mg') or 0) * multiplier,
                'potassiumMg': (nutrition_data.get('potassium_mg') or 0) * multiplier,
                'zincMg': (nutrition_data.get('zinc_mg') or 0) * multiplier,
            }

            # Add to totals
            for key in totals:
                totals[key] += plant_nutrition[key]

            # Aggregate per-plant breakdown (handle duplicates)
            if plant_id in by_plant:
                existing = by_plant[plant_id]
                # Sum: plantEquivalent, totalYieldLbs, nutrition values
                existing['plantEquivalent'] += quantity
                existing['totalYieldLbs'] += total_yield
                for key in plant_nutrition:
                    existing[key] += plant_nutrition[key]
                # Max: successionCount (not additive)
                existing['successionCount'] = max(existing['successionCount'], succession_count)
                # Concatenate unique varieties
                if variety and variety not in (existing.get('variety') or ''):
                    existing['variety'] = f"{existing['variety']}, {variety}" if existing.get('variety') else variety
            else:
                by_plant[plant_id] = {
                    'name': nutrition_data.get('name', plant_id),
                    'variety': variety,
                    'plantEquivalent': quantity,
                    'successionCount': succession_count,
                    'totalYieldLbs': total_yield,
                    **plant_nutrition
                }

        return {
            'totals': totals,
            'byPlant': by_plant,
            'missingNutritionData': missing_data,
            'year': year or get_now().year
        }

    def calculate_total_nutrition(self, user_id: int, year: Optional[int] = None) -> Dict:
        """
        Calculate total nutritional output from all sources (garden, livestock, trees)

        Args:
            user_id: User ID
            year: Optional year filter

        Returns:
            Dictionary with totals and breakdown by source
        """
        # Calculate from all sources
        garden_nutrition = self.calculate_garden_nutrition(user_id, year)
        livestock_nutrition = self.calculate_livestock_nutrition(user_id, year)
        tree_nutrition = self.calculate_tree_nutrition(user_id, year)

        # Aggregate totals
        totals = {
            'calories': 0,
            'protein_g': 0,
            'carbs_g': 0,
            'fat_g': 0,
            'fiber_g': 0,
            'vitamin_a_iu': 0,
            'vitamin_c_mg': 0,
            'vitamin_k_mcg': 0,
            'vitamin_e_mg': 0,
            'folate_mcg': 0,
            'calcium_mg': 0,
            'iron_mg': 0,
            'magnesium_mg': 0,
            'potassium_mg': 0,
            'zinc_mg': 0,
        }

        # Sum from all sources
        for source_data in [garden_nutrition, livestock_nutrition, tree_nutrition]:
            for key in totals:
                totals[key] += source_data['totals'].get(key, 0)

        return {
            'totals': totals,
            'by_source': {
                'garden': garden_nutrition['totals'],
                'livestock': livestock_nutrition['totals'],
                'trees': tree_nutrition['totals']
            },
            'year': year or get_now().year
        }


# Convenience functions for direct use
def get_garden_nutrition(user_id: int, year: Optional[int] = None) -> Dict:
    """Get garden nutritional output for a user"""
    service = NutritionalService()
    return service.calculate_garden_nutrition(user_id, year)


def get_total_nutrition(user_id: int, year: Optional[int] = None) -> Dict:
    """Get total nutritional output from all sources"""
    service = NutritionalService()
    return service.calculate_total_nutrition(user_id, year)


def get_nutritional_data(plant_id: str, user_id: Optional[int] = None) -> Optional[Dict]:
    """Get nutritional data for a plant"""
    service = NutritionalService()
    return service.get_nutritional_data(plant_id, user_id)
