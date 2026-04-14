"""
Dashboard API Blueprint

Composes daily "Needs Attention" signals for the Homestead Dashboard.

Routes:
- GET /api/dashboard/today - Returns the day's homestead attention signals.
"""
import logging

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from services.dashboard_service import build_dashboard_today, resolve_target_date

logger = logging.getLogger(__name__)

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')


@dashboard_bp.route('/today', methods=['GET'])
@login_required
def dashboard_today():
    """
    Aggregate today's homestead signals in a single round-trip.

    Query params:
      date (optional, YYYY-MM-DD): override "today". Falls back to the
        simulation clock, then real date.today().

    Response: camelCase JSON. See services.dashboard_service for shape.
    """
    date_str = request.args.get('date')
    try:
        target_date = resolve_target_date(date_str)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    try:
        payload = build_dashboard_today(current_user.id, target_date)
    except Exception:
        # Log full traceback server-side; do not leak internal details to the client.
        logger.exception("Failed to build dashboard signals for user_id=%s", current_user.id)
        return jsonify({'error': 'Failed to build dashboard signals'}), 500

    return jsonify(payload), 200
