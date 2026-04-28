"""
Dashboard API Blueprint

Composes daily "Needs Attention" signals for the Homestead Dashboard.

Routes:
- GET /api/dashboard/today - Returns the day's homestead attention signals.
- POST /api/dashboard/snooze - Snooze a dashboard signal for N days.
- DELETE /api/dashboard/snooze - Remove a snooze row (undo dismiss).
"""
import logging
from datetime import date, timedelta

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from models import DashboardSnooze, db
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


@dashboard_bp.route('/snooze', methods=['POST'])
@login_required
def snooze_signal():
    """Snooze a dashboard signal for N days."""
    data = request.json
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    signal_key = data.get('signalKey')
    forever = data.get('forever', False)

    if not signal_key:
        return jsonify({'error': 'signalKey is required'}), 400

    if forever:
        snooze_until = date(9999, 12, 31)
    else:
        days = data.get('days', 3)
        if not isinstance(days, int) or days < 1 or days > 30:
            return jsonify({'error': 'days must be an integer between 1 and 30'}), 400

        target_date = resolve_target_date(request.args.get('date'))
        snooze_until = target_date + timedelta(days=days)

    # Upsert: update if exists, create if not
    existing = DashboardSnooze.query.filter_by(
        user_id=current_user.id,
        signal_key=signal_key,
    ).first()

    if existing:
        existing.snooze_until = snooze_until
    else:
        snooze = DashboardSnooze(
            user_id=current_user.id,
            signal_key=signal_key,
            snooze_until=snooze_until,
        )
        db.session.add(snooze)

    db.session.commit()
    return jsonify({
        'signalKey': signal_key,
        'snoozeUntil': snooze_until.isoformat(),
        'forever': bool(forever),
    }), 200


@dashboard_bp.route('/snooze', methods=['DELETE'])
@login_required
def unsnooze_signal():
    """Remove a dashboard snooze row (undo dismiss).

    Idempotent: returns 200 with deleted=False if no row existed.
    Scoped by user_id to prevent cross-user deletion.
    """
    data = request.json
    if not data:
        return jsonify({'error': 'Request body required'}), 400

    signal_key = data.get('signalKey')
    if not signal_key:
        return jsonify({'error': 'signalKey is required'}), 400

    existing = DashboardSnooze.query.filter_by(
        user_id=current_user.id,
        signal_key=signal_key,
    ).first()

    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({'signalKey': signal_key, 'deleted': True}), 200

    return jsonify({'signalKey': signal_key, 'deleted': False}), 200
