"""
Simulation API Blueprint (Dev-Only)

Provides time-machine functionality for testing seasonal features.
No authentication required -- this is a local dev tool with no persistence.

Routes:
- GET  /api/simulation/status      - Get current simulation state
- POST /api/simulation/set-date    - Set simulated date (or disable)
- POST /api/simulation/advance     - Advance simulated date by N days
"""
from datetime import date
from flask import Blueprint, request, jsonify
from simulation_clock import (
    set_simulated_date, get_simulated_date, is_simulating,
    advance_days
)

simulation_bp = Blueprint('simulation', __name__, url_prefix='/api/simulation')


@simulation_bp.route('/status', methods=['GET'])
def simulation_status():
    """Get current simulation state."""
    sim_date = get_simulated_date()
    return jsonify({
        'active': is_simulating(),
        'simulatedDate': sim_date.isoformat() if sim_date else None,
        'realDate': date.today().isoformat()
    })


@simulation_bp.route('/set-date', methods=['POST'])
def simulation_set_date():
    """Set the simulated date, or pass null to disable."""
    data = request.get_json(force=True)
    date_str = data.get('date')

    if date_str is None:
        set_simulated_date(None)
        return jsonify({
            'active': False,
            'simulatedDate': None,
            'realDate': date.today().isoformat()
        })

    try:
        d = date.fromisoformat(date_str)
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    set_simulated_date(d)
    return jsonify({
        'active': True,
        'simulatedDate': d.isoformat(),
        'realDate': date.today().isoformat()
    })


@simulation_bp.route('/advance', methods=['POST'])
def simulation_advance():
    """Advance the simulated date by N days."""
    if not is_simulating():
        return jsonify({'error': 'Simulation is not active. Set a date first.'}), 400

    data = request.get_json(force=True)
    days = data.get('days', 1)

    if not isinstance(days, int) or days < 1 or days > 365:
        return jsonify({'error': 'days must be an integer between 1 and 365'}), 400

    new_date = advance_days(days)
    return jsonify({
        'active': True,
        'simulatedDate': new_date.isoformat(),
        'realDate': date.today().isoformat()
    })
