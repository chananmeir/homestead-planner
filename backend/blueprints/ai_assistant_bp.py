"""
Garden Assistant Blueprint

Routes:
- GET  /api/ai-assistant/status - Whether the assistant is configured
- POST /api/ai-assistant/chat    - Stream a chat completion (Server-Sent Events)
"""

import json
import logging

from flask import Blueprint, Response, jsonify, request, stream_with_context
from flask_login import current_user, login_required

from services.ai_assistant_service import (
    build_chat_messages,
    build_garden_context,
    get_assistant_config,
    stream_chat_completion,
)

assistant_bp = Blueprint('assistant', __name__, url_prefix='/api/ai-assistant')
logger = logging.getLogger(__name__)


@assistant_bp.route('/status', methods=['GET'])
@login_required
def assistant_status():
    """Report whether the LLM is configured (no secrets exposed)."""
    config = get_assistant_config()
    return jsonify({
        'enabled': config['configured'],
        'model': config['model'] if config['configured'] else None,
    }), 200


def _sse(event_type, data):
    """Format a Server-Sent Events frame."""
    payload = json.dumps({'type': event_type, **data})
    return f"data: {payload}\n\n"


@assistant_bp.route('/chat', methods=['POST'])
@login_required
def assistant_chat():
    """Stream an assistant response as Server-Sent Events.

    Request body:
        {
            "message": "string (required)",
            "history": [{"role": "user"|"assistant", "content": "string"}],
            "planId": number|null,
            "date": "YYYY-MM-DD"|null
        }

    Response: text/event-stream of frames:
        data: {"type": "context", "summary": "As-of date: ..."}
        data: {"type": "token", "delta": "..."}
        data: {"type": "done"}
        data: {"type": "error", "error": "..."}
    """
    body = request.get_json(silent=True) or {}
    message = (body.get('message') or '').strip()
    if not message:
        return jsonify({'error': 'message is required'}), 400

    history = body.get('history') or []
    if not isinstance(history, list):
        return jsonify({'error': 'history must be a list'}), 400

    plan_id = body.get('planId')
    date_str = body.get('date')

    config = get_assistant_config()
    if not config['configured']:
        return jsonify({
            'error': 'Garden Assistant is not configured. Set LLM_API_KEY (and optionally LLM_BASE_URL, LLM_MODEL) on the backend.'
        }), 503

    def generate():
        try:
            context_text = build_garden_context(
                user_id=current_user.id,
                plan_id=plan_id,
                date_str=date_str,
            )
            yield _sse('context', {'summary': context_text})

            messages = build_chat_messages(message, history, context_text)

            try:
                produced_any = False
                for token in stream_chat_completion(messages, config):
                    produced_any = True
                    yield _sse('token', {'delta': token})
                if not produced_any:
                    yield _sse('error', {'error': 'The model returned an empty response.'})
                else:
                    yield _sse('done', {})
            except Exception as inner:
                logger.exception('LLM streaming failed: %s', inner)
                yield _sse('error', {'error': f'Failed to reach the model: {inner}'})

        except Exception as outer:
            logger.exception('Garden assistant request failed: %s', outer)
            yield _sse('error', {'error': 'Failed to build garden context.'})

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',  # Disable proxy buffering (nginx)
            'Connection': 'keep-alive',
        },
    )
