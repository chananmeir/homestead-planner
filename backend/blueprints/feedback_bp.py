"""Crop feedback-loop API."""

import logging

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from models import db
from services.feedback_loop_service import (
    FeedbackLoopError,
    apply_days_to_maturity_adjustment,
    apply_failure_reason_correction,
    apply_sow_date_confirmation,
    apply_sow_date_adjustment,
    confirm_good_sow_date_from_harvest,
    diagnose_sow_date_for_planted_item,
    verify_failure_reason_for_planted_item,
)


feedback_bp = Blueprint('feedback', __name__, url_prefix='/api/feedback')
logger = logging.getLogger(__name__)


def _feedback_error(exc: FeedbackLoopError):
    payload = {'error': str(exc)}
    if exc.error_code:
        payload['errorCode'] = exc.error_code
    return jsonify(payload), exc.status_code


@feedback_bp.route('/planted-items/<int:item_id>/sow-date-diagnosis', methods=['POST'])
@login_required
def sow_date_diagnosis(item_id):
    """Diagnose whether a did-not-establish planting was likely sown too cold."""
    try:
        result = diagnose_sow_date_for_planted_item(current_user.id, item_id)
        return jsonify(result), 200
    except FeedbackLoopError as exc:
        return _feedback_error(exc)
    except Exception:
        logger.exception('Failed to diagnose sow-date feedback for planted_item_id=%s', item_id)
        return jsonify({'error': 'Failed to diagnose sow-date feedback'}), 500


@feedback_bp.route('/planted-items/<int:item_id>/reason-verification', methods=['POST'])
@login_required
def failure_reason_verification(item_id):
    """Verify a recorded failure reason against archived weather evidence."""
    try:
        result = verify_failure_reason_for_planted_item(current_user.id, item_id)
        return jsonify(result), 200
    except FeedbackLoopError as exc:
        return _feedback_error(exc)
    except Exception:
        logger.exception('Failed to verify failure reason for planted_item_id=%s', item_id)
        return jsonify({'error': 'Failed to verify failure reason'}), 500


@feedback_bp.route('/planted-items/<int:item_id>/apply-reason-correction', methods=['POST'])
@login_required
def apply_failure_reason_correction_route(item_id):
    """Reclassify a verified frost mislabel to did-not-establish feedback."""
    try:
        result = apply_failure_reason_correction(current_user.id, item_id)
        return jsonify(result), 200
    except FeedbackLoopError as exc:
        db.session.rollback()
        return _feedback_error(exc)
    except Exception:
        db.session.rollback()
        logger.exception('Failed to apply reason correction for planted_item_id=%s', item_id)
        return jsonify({'error': 'Failed to apply reason correction'}), 500


@feedback_bp.route('/planted-items/<int:item_id>/sow-date-adjustment', methods=['POST'])
@login_required
def sow_date_adjustment(item_id):
    """Persist an opt-in earliest-sow adjustment for the item variety."""
    data = request.get_json() or {}
    try:
        result = apply_sow_date_adjustment(
            current_user.id,
            item_id,
            data.get('recommendationMonthDay'),
        )
        return jsonify(result), 200
    except FeedbackLoopError as exc:
        return _feedback_error(exc)
    except Exception:
        logger.exception('Failed to apply sow-date feedback for planted_item_id=%s', item_id)
        return jsonify({'error': 'Failed to apply sow-date feedback'}), 500


@feedback_bp.route('/harvests/<int:harvest_id>/dtm-adjustment', methods=['POST'])
@login_required
def days_to_maturity_adjustment(harvest_id):
    """Persist an opt-in days-to-maturity bump for a low/poor harvest."""
    data = request.get_json() or {}
    try:
        result = apply_days_to_maturity_adjustment(
            current_user.id,
            harvest_id,
            data.get('additionalDays'),
        )
        return jsonify(result), 200
    except FeedbackLoopError as exc:
        return _feedback_error(exc)
    except Exception:
        logger.exception('Failed to apply DTM feedback for harvest_id=%s', harvest_id)
        return jsonify({'error': 'Failed to apply days-to-maturity feedback'}), 500


@feedback_bp.route('/harvests/<int:harvest_id>/sow-date-confirmation', methods=['POST'])
@login_required
def sow_date_confirmation(harvest_id):
    """Suggest a proven planting date from a good/excellent harvest."""
    try:
        result = confirm_good_sow_date_from_harvest(current_user.id, harvest_id)
        return jsonify(result), 200
    except FeedbackLoopError as exc:
        return _feedback_error(exc)
    except Exception:
        logger.exception('Failed to confirm sow-date feedback for harvest_id=%s', harvest_id)
        return jsonify({'error': 'Failed to confirm sow-date feedback'}), 500


@feedback_bp.route('/harvests/<int:harvest_id>/apply-sow-date-confirmation', methods=['POST'])
@login_required
def apply_sow_date_confirmation_route(harvest_id):
    """Persist an opt-in proven planting date from a good/excellent harvest."""
    data = request.get_json() or {}
    try:
        result = apply_sow_date_confirmation(
            current_user.id,
            harvest_id,
            data.get('recommendationMonthDay'),
        )
        return jsonify(result), 200
    except FeedbackLoopError as exc:
        db.session.rollback()
        return _feedback_error(exc)
    except Exception:
        db.session.rollback()
        logger.exception('Failed to apply sow-date confirmation for harvest_id=%s', harvest_id)
        return jsonify({'error': 'Failed to apply sow-date confirmation'}), 500
