"""Tests for the Garden Assistant blueprint."""

import json

import pytest

from blueprints import ai_assistant_bp
from services import ai_assistant_service


def _parse_sse_frames(raw_text):
    """Parse a Server-Sent Events body into a list of payload dicts."""
    frames = []
    for block in raw_text.split('\n\n'):
        lines = [ln for ln in block.split('\n') if ln.startswith('data:')]
        if not lines:
            continue
        payload = '\n'.join(ln[len('data:'):].strip() for ln in lines)
        if not payload:
            continue
        try:
            frames.append(json.loads(payload))
        except json.JSONDecodeError:
            pass
    return frames


@pytest.fixture(autouse=True)
def _unconfigured_by_default(monkeypatch):
    """Make these tests independent of the ambient environment.

    ``app.py`` calls ``load_dotenv()`` at import time, so as soon as ANY test in
    the run imports it (e.g. test_app_startup_hardening), the developer's real
    ``backend/.env`` — including ``LLM_API_KEY`` — is loaded into ``os.environ``
    for the remainder of the process.

    Tests asserting the "assistant is not configured" path would then pass or
    fail purely according to which files ran before them: green in isolation,
    red in the full suite. Establishing the default state explicitly here makes
    them hermetic; the ``configured`` fixture opts back in where needed.
    """
    monkeypatch.delenv('LLM_API_KEY', raising=False)


@pytest.fixture
def mock_stream(monkeypatch):
    """Replace stream_chat_completion in the blueprint namespace (where it's used)."""
    def fake_stream(messages, config):
        for token in ['Hello', ', ', 'gardener!']:
            yield token

    # The blueprint imports the function directly, so patch the reference it
    # actually uses, not just the service module.
    monkeypatch.setattr(ai_assistant_bp, 'stream_chat_completion', fake_stream)
    return fake_stream


@pytest.fixture
def configured(monkeypatch):
    """Pretend the LLM is configured via env vars."""
    monkeypatch.setenv('LLM_API_KEY', 'test-key')
    monkeypatch.setenv('LLM_MODEL', 'gpt-test-model')
    monkeypatch.setenv('LLM_BASE_URL', 'https://example.test/v1')


# ---------------------------------------------------------------------------
# /status
# ---------------------------------------------------------------------------

def test_status_requires_auth(client):
    """Unauthenticated requests are rejected."""
    resp = client.get('/api/ai-assistant/status')
    assert resp.status_code == 401


def test_status_when_not_configured(auth_client_a):
    """When no LLM_API_KEY is set, status reports enabled=False."""
    resp = auth_client_a.get('/api/ai-assistant/status')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['enabled'] is False
    assert data['model'] is None


def test_status_when_configured(auth_client_a, configured):
    """When env vars are set, status reports the configured model."""
    resp = auth_client_a.get('/api/ai-assistant/status')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['enabled'] is True
    assert data['model'] == 'gpt-test-model'


def test_status_treats_template_placeholders_as_unconfigured(auth_client_a, monkeypatch):
    """The YOUR_..._HERE placeholders from the .env template must not enable the assistant."""
    monkeypatch.setenv('LLM_API_KEY', 'YOUR_API_KEY_HERE')
    monkeypatch.setenv('LLM_BASE_URL', 'YOUR_BASE_URL_HERE')
    monkeypatch.setenv('LLM_MODEL', 'YOUR_MODEL_NAME_HERE')
    resp = auth_client_a.get('/api/ai-assistant/status')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['enabled'] is False
    assert data['model'] is None


# ---------------------------------------------------------------------------
# /chat
# ---------------------------------------------------------------------------

def test_chat_requires_auth(client):
    resp = client.post('/api/ai-assistant/chat', json={'message': 'hi'})
    assert resp.status_code == 401


def test_chat_requires_message(auth_client_a, configured, mock_stream):
    resp = auth_client_a.post('/api/ai-assistant/chat', json={'message': ''})
    assert resp.status_code == 400


def test_chat_rejects_bad_history(auth_client_a, configured, mock_stream):
    resp = auth_client_a.post(
        '/api/ai-assistant/chat',
        json={'message': 'hi', 'history': 'not-a-list'},
    )
    assert resp.status_code == 400


def test_chat_returns_503_when_not_configured(auth_client_a, mock_stream):
    """Without LLM_API_KEY the chat endpoint refuses to call the model."""
    resp = auth_client_a.post('/api/ai-assistant/chat', json={'message': 'hi'})
    assert resp.status_code == 503
    assert 'not configured' in resp.get_json()['error'].lower()


def test_chat_streams_tokens(auth_client_a, configured, mock_stream):
    """Happy path: a context frame, token frames, then a done frame."""
    resp = auth_client_a.post(
        '/api/ai-assistant/chat',
        json={'message': 'What should I plant?', 'history': []},
    )
    assert resp.status_code == 200
    assert resp.mimetype == 'text/event-stream'

    frames = _parse_sse_frames(resp.get_data(as_text=True))

    types = [f.get('type') for f in frames]
    assert types[0] == 'context'
    assert 'Beds:' in frames[0]['summary']

    token_frames = [f for f in frames if f.get('type') == 'token']
    assert [f['delta'] for f in token_frames] == ['Hello', ', ', 'gardener!']

    assert types[-1] == 'done'


def test_chat_passes_history_and_context_into_messages(auth_client_a, configured, mock_stream, monkeypatch):
    """The message builder receives the user's history and the garden context."""
    captured = {}

    def capture(user_message, history, context_text):
        captured['messages'] = build_real_messages(user_message, history, context_text)
        captured['context'] = context_text
        # Return what the real builder would so the rest of the pipeline runs.
        return captured['messages']

    # Keep a handle to the real builder so we can still produce a valid return.
    build_real_messages = ai_assistant_bp.build_chat_messages
    monkeypatch.setattr(ai_assistant_bp, 'build_chat_messages', capture)

    resp = auth_client_a.post('/api/ai-assistant/chat', json={
        'message': 'next step?',
        'history': [{'role': 'assistant', 'content': 'plant tomatoes'}],
    })
    # Drain the SSE stream so the generator (and our patched builder) runs.
    resp.get_data()

    roles = [m['role'] for m in captured['messages']]
    assert roles[0] == 'system'
    assert roles[-1] == 'user'
    assert captured['messages'][-1]['content'] == 'next step?'
    # History was forwarded (system + assistant history + user = at least 3).
    assert len(captured['messages']) >= 3
    assert 'Beds:' in captured['context']
