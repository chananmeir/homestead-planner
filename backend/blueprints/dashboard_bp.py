"""
Dashboard API Blueprint

Composes daily "Needs Attention" signals for the Homestead Dashboard.

Routes:
- GET /api/dashboard/today - Returns the day's homestead attention signals.
- POST /api/dashboard/snooze - Snooze a dashboard signal (N days or permanently).
- DELETE /api/dashboard/snooze - Remove a snooze (used by the Undo button).
"""
import logging
from datetime import date, timedelta

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from models import DashboardSnooze, db
from services.dashboard_service import build_dashboard_today, resolve_target_date

# Sentinel date used when the caller dismisses a signal permanently. The
# dashboard staleness filter (`snooze_until >= target_date`) treats any date
# this far in the future as effectively forever. Matches the convention used
# in test_dashboard_staleness.py fixtures.
SNOOZE_FOREVER_DATE = date(9999, 12, 31)

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
    """Snooze a dashboard signal.

    Body:
      signalKey (str, required): the signal to snooze.
      forever (bool, optional, default False): if truthy, hide the signal
        permanently (stored as SNOOZE_FOREVER_DATE). When set, `days` is
        ignored.
      days (int, optional, default 3): days to snooze when not forever.
        Must be in [1, 30].
    """
    data = request.json
    if not isinstance(data, dict):
        return jsonify({'error': 'Request body must be a JSON object'}), 400

    signal_key = data.get('signalKey')
    if not signal_key:
        return jsonify({'error': 'signalKey is required'}), 400

    forever = bool(data.get('forever', False))
    if forever:
        snooze_until = SNOOZE_FOREVER_DATE
    else:
        days = data.get('days', 3)
        if not isinstance(days, int) or days < 1 or days > 30:
            return jsonify({'error': 'days must be an integer between 1 and 30'}), 400
        try:
            target_date = resolve_target_date(request.args.get('date'))
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
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
    return jsonify({'signalKey': signal_key, 'snoozeUntil': snooze_until.isoformat()}), 200


@dashboard_bp.route('/snooze', methods=['DELETE'])
@login_required
def unsnooze_signal():
    """Remove the snooze for a given signalKey.

    Idempotent: returns 200 whether or not a matching record existed. The
    Undo button on the dashboard relies on this — the click fires inside a
    5-second window and the user should always see the row return.

    Body:
      signalKey (str, required): the snooze to remove.
    """
    data = request.json
    if not isinstance(data, dict):
        return jsonify({'error': 'Request body must be a JSON object'}), 400

    signal_key = data.get('signalKey')
    if not signal_key:
        return jsonify({'error': 'signalKey is required'}), 400

    existing = DashboardSnooze.query.filter_by(
        user_id=current_user.id,
        signal_key=signal_key,
    ).first()

    deleted = existing is not None
    if existing:
        db.session.delete(existing)
        db.session.commit()

    return jsonify({'signalKey': signal_key, 'deleted': deleted}), 200
