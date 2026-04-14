"""
Nutrition Blueprint

Routes for nutritional tracking and calculations.
Provides endpoints for calculating nutritional output from gardens, livestock, and trees.
"""
from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
from datetime import datetime
import sqlite3
import math

from services.nutritional_service import NutritionalService
from services.usda_api_service import USDAAPIService
from models import db

# Create blueprint
nutrition_bp = Blueprint('nutrition', __name__, url_prefix='/api/nutrition')

# Initialize services
nutritional_service = NutritionalService()
usda_service = USDAAPIService()


# ==================== DASHBOARD & SUMMARY ROUTES ====================

@nutrition_bp.route('/dashboard', methods=['GET'])
@login_required
def get_nutrition_dashboard():
    """
    Get complete nutritional summary across all sources

    Query params:
        year: Optional year filter (default: current year)

    Returns:
        {
            totals: { calories, protein_g, carbs_g, ... },
            by_source: { garden, livestock, trees },
            year: 2026
        }
    """
    year = request.args.get('year', type=int)

    try:
        result = nutritional_service.calculate_total_nutrition(current_user.id, year)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': f'Failed to calculate nutrition: {str(e)}'}), 500


@nutrition_bp.route('/estimate', methods=['POST'])
@login_required
def estimate_nutrition():
    """
    Estimate nutrition from a list of plan items (unified calculation).

    This is the single source of truth for nutrition estimation, used by:
    - GardenPlanner.tsx wizard (before plan is saved)
    - Can also be used for ad-hoc nutrition calculations

    Request body:
        {
            "items": [
                {"plantId": "tomato", "quantity": 20, "successionCount": 4, "variety": "Roma"},
                {"plantId": "lettuce", "quantity": 40, "successionCount": 4}
            ],
            "year": 2026  // optional
        }

    Returns:
        {
            "totals": { "calories": X, "proteinG": X, "carbsG": X, ... },
            "byPlant": {
                "tomato": {
                    "name": "Tomato",
                    "variety": "Roma",
                    "plantEquivalent": 20,
                    "successionCount": 4,
                    "totalYieldLbs": 800,
                    "calories": X,
                    "proteinG": X,
                    ...
                }
            },
            "missingNutritionData": ["bok-choy-1"],
            "year": 2026
        }
    """
    data = request.get_json(silent=True)

    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    items = data.get('items')
    if items is None:
        return jsonify({'error': 'items array is required'}), 400

    if not isinstance(items, list):
        return jsonify({'error': 'items must be an array'}), 400

    if len(items) == 0:
        return jsonify({'error': 'items array cannot be empty'}), 400

    # Validate and coerce each item
    validated_items = []
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            return jsonify({'error': f'items[{i}] must be an object'}), 400

        plant_id = item.get('plantId') or item.get('plant_id')
        if not plant_id or not isinstance(plant_id, str):
            return jsonify({'error': f'items[{i}].plantId must be a non-empty string'}), 400

        # Coerce quantity to number, support string input
        raw_quantity = item.get('quantity', 0)
        try:
            quantity = int(raw_quantity) if raw_quantity else 0
        except (ValueError, TypeError):
            try:
                quantity = int(float(raw_quantity))
            except (ValueError, TypeError):
                return jsonify({'error': f'items[{i}].quantity must be a valid number'}), 400

        if math.isnan(quantity) or math.isinf(quantity):
            return jsonify({'error': f'items[{i}].quantity must be a finite number'}), 400

        # Coerce successionCount to number, support string input
        raw_succession = item.get('successionCount') or item.get('succession_count') or 1
        try:
            succession_count = int(raw_succession) if raw_succession else 1
        except (ValueError, TypeError):
            try:
                succession_count = int(float(raw_succession))
            except (ValueError, TypeError):
                return jsonify({'error': f'items[{i}].successionCount must be a valid number'}), 400

        if math.isnan(succession_count) or math.isinf(succession_count):
            return jsonify({'error': f'items[{i}].successionCount must be a finite number'}), 400

        # Ensure minimum values
        quantity = max(0, quantity)
        succession_count = max(1, succession_count)

        validated_items.append({
            'plant_id': plant_id,
            'quantity': quantity,
            'succession_count': succession_count,
            'variety': item.get('variety')
        })

    year = data.get('year')
    if year is not None:
        try:
            year = int(year)
        except (ValueError, TypeError):
            return jsonify({'error': 'year must be a valid integer'}), 400

    try:
        result = nutritional_service.estimate_nutrition_from_items(
            items=validated_items,
            user_id=current_user.id,
            year=year
        )
        return jsonify(result), 200
    except Exception as e:
        current_app.logger.exception('Failed to estimate nutrition')
        return jsonify({'error': 'Failed to estimate nutrition'}), 500


@nutrition_bp.route('/garden', methods=['GET'])
@login_required
def get_garden_nutrition():
    """
    Get nutritional output from garden only

    Query params:
        year: Optional year filter (default: current year)

    Returns:
        {
            totals: { calories, protein_g, carbs_g, ... },
            by_plant: { tomato: {...}, lettuce: {...} },
            year: 2026
        }
    """
    year = request.args.get('year', type=int)

    try:
        result = nutritional_service.calculate_garden_nutrition(current_user.id, year)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': f'Failed to calculate garden nutrition: {str(e)}'}), 500


@nutrition_bp.route('/livestock', methods=['GET'])
@login_required
def get_livestock_nutrition():
    """
    Get nutritional output from livestock only

    Query params:
        year: Optional year filter (default: current year)

    Returns:
        {
            totals: { calories, protein_g, carbs_g, ... },
            by_animal_type: { chickens: {...}, goats: {...} },
            production_summary: [...],
            year: 2026
        }
    """
    year = request.args.get('year', type=int)

    try:
        result = nutritional_service.calculate_livestock_nutrition(current_user.id, year)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': f'Failed to calculate livestock nutrition: {str(e)}'}), 500


@nutrition_bp.route('/trees', methods=['GET'])
@login_required
def get_tree_nutrition():
    """
    Get nutritional output from fruit/nut trees only

    Query params:
        year: Optional year filter (default: current year)

    Returns:
        {
            totals: { calories, protein_g, carbs_g, ... },
            by_tree_type: { apple: {...}, peach: {...} },
            tree_summary: [...],
            year: 2026
        }
    """
    year = request.args.get('year', type=int)

    try:
        result = nutritional_service.calculate_tree_nutrition(current_user.id, year)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': f'Failed to calculate tree nutrition: {str(e)}'}), 500


# ==================== NUTRITIONAL DATA CRUD ROUTES ====================

@nutrition_bp.route('/data', methods=['GET'])
@login_required
def get_nutritional_data_list():
    """
    Get list of nutritional data entries

    Query params:
        source_type: Filter by source type (plant, egg, milk, meat, honey)
        source_id: Filter by source ID
        user_only: If true, return only user-specific data (default: false)

    Returns:
        Array of nutritional data entries
    """
    source_type = request.args.get('source_type')
    source_id = request.args.get('source_id')
    user_only = request.args.get('user_only', 'false').lower() == 'true'

    try:
        conn = nutritional_service.get_connection()
        cursor = conn.cursor()

        # Build query
        query = "SELECT * FROM nutritional_data WHERE 1=1"
        params = []

        if source_type:
            query += " AND source_type = ?"
            params.append(source_type)

        if source_id:
            query += " AND source_id = ?"
            params.append(source_id)

        if user_only:
            query += " AND user_id = ?"
            params.append(current_user.id)
        else:
            # Include both global and user-specific data
            query += " AND (user_id IS NULL OR user_id = ?)"
            params.append(current_user.id)

        query += " ORDER BY name"

        cursor.execute(query, params)
        rows = cursor.fetchall()

        # Convert to dictionaries
        result = []
        for row in rows:
            result.append(nutritional_service._row_to_dict(cursor, row))

        conn.close()

        return jsonify(result), 200

    except Exception as e:
        return jsonify({'error': f'Failed to fetch nutritional data: {str(e)}'}), 500


@nutrition_bp.route('/data', methods=['POST'])
@login_required
def create_or_update_nutritional_data():
    """
    Create or update nutritional data entry

    Body:
        {
            source_type: 'plant',
            source_id: 'tomato',
            name: 'Tomato (raw)',
            calories: 18,
            protein_g: 0.9,
            ...
        }

    Returns:
        Created/updated entry
    """
    data = request.json

    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    # Validate required fields
    if not data.get('source_type'):
        return jsonify({'error': 'source_type is required'}), 400

    if not data.get('source_id'):
        return jsonify({'error': 'source_id is required'}), 400

    if not data.get('name'):
        return jsonify({'error': 'name is required'}), 400

    try:
        conn = nutritional_service.get_connection()
        cursor = conn.cursor()

        # Check if entry exists (user-specific)
        cursor.execute("""
            SELECT id FROM nutritional_data
            WHERE source_type = ? AND source_id = ? AND user_id = ?
        """, (data['source_type'], data['source_id'], current_user.id))

        existing = cursor.fetchone()

        if existing:
            # Update existing entry
            cursor.execute("""
                UPDATE nutritional_data SET
                    name = ?,
                    usda_fdc_id = ?,
                    calories = ?,
                    protein_g = ?,
                    carbs_g = ?,
                    fat_g = ?,
                    fiber_g = ?,
                    vitamin_a_iu = ?,
                    vitamin_c_mg = ?,
                    vitamin_k_mcg = ?,
                    vitamin_e_mg = ?,
                    folate_mcg = ?,
                    calcium_mg = ?,
                    iron_mg = ?,
                    magnesium_mg = ?,
                    potassium_mg = ?,
                    zinc_mg = ?,
                    average_yield_lbs_per_plant = ?,
                    average_yield_lbs_per_sqft = ?,
                    average_yield_lbs_per_tree_year = ?,
                    data_source = ?,
                    notes = ?,
                    last_updated = ?
                WHERE id = ?
            """, (
                data.get('name'),
                data.get('usda_fdc_id'),
                data.get('calories'),
                data.get('protein_g'),
                data.get('carbs_g'),
                data.get('fat_g'),
                data.get('fiber_g'),
                data.get('vitamin_a_iu'),
                data.get('vitamin_c_mg'),
                data.get('vitamin_k_mcg'),
                data.get('vitamin_e_mg'),
                data.get('folate_mcg'),
                data.get('calcium_mg'),
                data.get('iron_mg'),
                data.get('magnesium_mg'),
                data.get('potassium_mg'),
                data.get('zinc_mg'),
                data.get('average_yield_lbs_per_plant'),
                data.get('average_yield_lbs_per_sqft'),
                data.get('average_yield_lbs_per_tree_year'),
                data.get('data_source'),
                data.get('notes'),
                datetime.utcnow().isoformat(),
                existing[0]
            ))
            entry_id = existing[0]
        else:
            # Create new entry
            cursor.execute("""
                INSERT INTO nutritional_data (
                    source_type, source_id, name, usda_fdc_id,
                    calories, protein_g, carbs_g, fat_g, fiber_g,
                    vitamin_a_iu, vitamin_c_mg, vitamin_k_mcg, vitamin_e_mg, folate_mcg,
                    calcium_mg, iron_mg, magnesium_mg, potassium_mg, zinc_mg,
                    average_yield_lbs_per_plant, average_yield_lbs_per_sqft, average_yield_lbs_per_tree_year,
                    data_source, notes, last_updated, user_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data['source_type'],
                data['source_id'],
                data['name'],
                data.get('usda_fdc_id'),
                data.get('calories'),
                data.get('protein_g'),
                data.get('carbs_g'),
                data.get('fat_g'),
                data.get('fiber_g'),
                data.get('vitamin_a_iu'),
                data.get('vitamin_c_mg'),
                data.get('vitamin_k_mcg'),
                data.get('vitamin_e_mg'),
                data.get('folate_mcg'),
                data.get('calcium_mg'),
                data.get('iron_mg'),
                data.get('magnesium_mg'),
                data.get('potassium_mg'),
                data.get('zinc_mg'),
                data.get('average_yield_lbs_per_plant'),
                data.get('average_yield_lbs_per_sqft'),
                data.get('average_yield_lbs_per_tree_year'),
                data.get('data_source'),
                data.get('notes'),
                datetime.utcnow().isoformat(),
                current_user.id
            ))
            entry_id = cursor.lastrowid

        conn.commit()

        # Fetch and return created/updated entry
        cursor.execute("SELECT * FROM nutritional_data WHERE id = ?", (entry_id,))
        row = cursor.fetchone()
        result = nutritional_service._row_to_dict(cursor, row)

        conn.close()

        return jsonify(result), 200

    except Exception as e:
        return jsonify({'error': f'Failed to save nutritional data: {str(e)}'}), 500


@nutrition_bp.route('/data/<int:data_id>', methods=['DELETE'])
@login_required
def delete_nutritional_data(data_id):
    """
    Delete a nutritional data entry (user-specific only)

    Args:
        data_id: Nutritional data entry ID

    Returns:
        Success message
    """
    try:
        conn = nutritional_service.get_connection()
        cursor = conn.cursor()

        # Verify ownership (can only delete user-specific data)
        cursor.execute("""
            SELECT id FROM nutritional_data
            WHERE id = ? AND user_id = ?
        """, (data_id, current_user.id))

        if not cursor.fetchone():
            return jsonify({'error': 'Nutritional data entry not found or not owned by user'}), 404

        # Delete entry
        cursor.execute("DELETE FROM nutritional_data WHERE id = ?", (data_id,))
        conn.commit()
        conn.close()

        return jsonify({'message': 'Nutritional data entry deleted successfully'}), 200

    except Exception as e:
        return jsonify({'error': f'Failed to delete nutritional data: {str(e)}'}), 500


# ==================== USDA API ROUTES (Phase 2) ====================

@nutrition_bp.route('/usda/search', methods=['GET'])
@login_required
def search_usda():
    """
    Search USDA FoodData Central

    Query params:
        query: Search term (required)
        page_size: Results per page (default 10, max 50)
        page_number: Page number (default 1)
        data_type: Filter by data type (Foundation, SR Legacy, Branded, Survey)

    Returns:
        {
            'totalHits': int,
            'currentPage': int,
            'totalPages': int,
            'foods': [...]
        }
    """
    query = request.args.get('query', '').strip()

    if not query:
        return jsonify({'error': 'Query parameter is required'}), 400

    page_size = request.args.get('page_size', type=int, default=10)
    page_number = request.args.get('page_number', type=int, default=1)
    data_type = request.args.get('data_type')

    # Validate page size
    if page_size < 1 or page_size > 50:
        return jsonify({'error': 'page_size must be between 1 and 50'}), 400

    try:
        results = usda_service.search_foods(
            query=query,
            page_size=page_size,
            page_number=page_number,
            data_type=data_type
        )
        return jsonify(results), 200

    except ValueError as e:
        # API key not configured or invalid
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        # Network error or rate limit
        return jsonify({'error': f'USDA API error: {str(e)}'}), 500


@nutrition_bp.route('/usda/import', methods=['POST'])
@login_required
def import_from_usda():
    """
    Import nutritional data from USDA FoodData Central

    Body:
        {
            fdc_id: 170457,
            source_id: 'tomato',
            yield_lbs_per_plant: 10.0 (optional),
            yield_lbs_per_sqft: 1.2 (optional),
            is_global: true (optional, admin only)
        }

    Returns:
        Imported nutritional data entry
    """
    data = request.json

    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    # Validate required fields
    if not data.get('fdc_id'):
        return jsonify({'error': 'fdc_id is required'}), 400

    if not data.get('source_id'):
        return jsonify({'error': 'source_id is required'}), 400

    # Determine user_id (None for global data, user ID for user-specific)
    is_global = data.get('is_global', False)

    if is_global and not current_user.is_admin:
        return jsonify({'error': 'Only admins can create global nutritional data'}), 403

    user_id = None if is_global else current_user.id

    try:
        # Import from USDA
        nutritional_data = usda_service.import_from_usda(
            fdc_id=data['fdc_id'],
            source_id=data['source_id'],
            yield_lbs_per_plant=data.get('yield_lbs_per_plant'),
            yield_lbs_per_sqft=data.get('yield_lbs_per_sqft'),
            user_id=user_id
        )

        return jsonify(nutritional_data), 200

    except ValueError as e:
        # API key not configured or invalid
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        # Network error, rate limit, or database error
        return jsonify({'error': f'Import failed: {str(e)}'}), 500
