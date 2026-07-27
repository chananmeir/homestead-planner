"""
User settings API.

Routes:
- GET /api/settings - Return typed, user-visible settings
- PATCH /api/settings - Update a partial typed settings payload
"""
import logging

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from services.settings_service import get_settings_payload, update_settings


settings_bp = Blueprint('settings', __name__, url_prefix='/api/settings')
logger = logging.getLogger(__name__)


@settings_bp.route('', methods=['GET'])
@login_required
def get_settings():
    """Return the current user's public settings."""
    return jsonify(get_settings_payload(current_user.id)), 200


@settings_bp.route('', methods=['PATCH'])
@login_required
def patch_settings():
    """Validate and persist a partial settings update."""
    data = request.get_json()
    try:
        payload = update_settings(current_user.id, data)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception:
        logger.exception('Failed to update settings for user_id=%s', current_user.id)
        return jsonify({'error': 'Failed to update settings'}), 500
    return jsonify(payload), 200
