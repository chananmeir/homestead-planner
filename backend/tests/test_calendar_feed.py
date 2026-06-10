"""
Tests for the iCalendar subscription feed (calendar_feed_bp).

Covers: token lifecycle (create / idempotent / regenerate-revokes), the
token-authenticated .ics payload (phase VEVENTs, stable UIDs, all-day DTEND,
RFC 5545 escaping), cancelled-event exclusion, and cross-user isolation.
"""
from datetime import datetime, timedelta

from models import db, GardenBed, PlantingEvent

PLANT_ID = 'tomato-1'


def _make_event(user, **overrides):
    start = datetime(2026, 5, 10)
    defaults = {
        'event_type': 'planting',
        'plant_id': PLANT_ID,
        'quantity': 4,
        'transplant_date': start,
        'expected_harvest_date': start + timedelta(days=75),
    }
    defaults.update(overrides)
    event = PlantingEvent(user_id=user.id, **defaults)
    db.session.add(event)
    db.session.commit()
    return event


def _get_feed(client, feed_path):
    response = client.get(feed_path)
    return response


def test_feed_info_creates_and_reuses_token(auth_client_a):
    first = auth_client_a.get('/api/calendar/feed-info')
    assert first.status_code == 200
    body = first.get_json()
    assert body['feedPath'].startswith('/api/calendar/feed/')
    assert body['feedPath'].endswith('.ics')
    assert body['feedUrl'].endswith(body['feedPath'])

    # Second call must return the SAME secret (stable subscription URL).
    second = auth_client_a.get('/api/calendar/feed-info')
    assert second.get_json()['feedPath'] == body['feedPath']


def test_feed_info_requires_login(client):
    response = client.get('/api/calendar/feed-info')
    assert response.status_code == 401


def test_regenerate_revokes_old_token(auth_client_a, user_a):
    _make_event(user_a)
    old_path = auth_client_a.get('/api/calendar/feed-info').get_json()['feedPath']
    assert _get_feed(auth_client_a, old_path).status_code == 200

    new_path = auth_client_a.post('/api/calendar/feed-token/regenerate').get_json()['feedPath']
    assert new_path != old_path

    # Old URL is dead; new URL works (and needs no session).
    assert _get_feed(auth_client_a, old_path).status_code == 404
    assert _get_feed(auth_client_a, new_path).status_code == 200


def test_unknown_token_404(client):
    assert client.get('/api/calendar/feed/not-a-real-token.ics').status_code == 404


def test_feed_serializes_phases_with_stable_uids(auth_client_a, user_a):
    bed = GardenBed(user_id=user_a.id, name='North Bed', width=4.0, length=8.0)
    db.session.add(bed)
    db.session.commit()
    event = _make_event(
        user_a,
        garden_bed_id=bed.id,
        seed_start_date=datetime(2026, 3, 29),
        variety='Brandywine',
    )

    feed_path = auth_client_a.get('/api/calendar/feed-info').get_json()['feedPath']
    response = _get_feed(auth_client_a, feed_path)
    assert response.status_code == 200
    assert response.headers['Content-Type'].startswith('text/calendar')
    ics = response.get_data(as_text=True)

    assert 'BEGIN:VCALENDAR' in ics and 'END:VCALENDAR' in ics
    # One VEVENT per phase date: seed-start, transplant, harvest (no direct seed).
    assert ics.count('BEGIN:VEVENT') == 3
    assert f'UID:pe-{event.id}-seed-start@homestead-planner' in ics
    assert f'UID:pe-{event.id}-transplant@homestead-planner' in ics
    assert f'UID:pe-{event.id}-harvest@homestead-planner' in ics
    # All-day events with exclusive DTEND (next day).
    assert 'DTSTART;VALUE=DATE:20260510' in ics
    assert 'DTEND;VALUE=DATE:20260511' in ics
    # Summary carries action, quantity, plant, and variety; location carries the bed.
    assert 'Transplant: 4' in ics and 'Tomato' in ics and 'Brandywine' in ics
    assert 'LOCATION:North Bed' in ics


def test_feed_excludes_cancelled_and_other_users(auth_client_a, user_a, user_b):
    visible = _make_event(user_a)
    cancelled = _make_event(user_a, cancelled_at=datetime(2026, 5, 12))
    foreign = _make_event(user_b)

    feed_path = auth_client_a.get('/api/calendar/feed-info').get_json()['feedPath']
    ics = _get_feed(auth_client_a, feed_path).get_data(as_text=True)

    assert f'UID:pe-{visible.id}-transplant' in ics
    assert f'pe-{cancelled.id}-' not in ics
    assert f'pe-{foreign.id}-' not in ics


def test_feed_escapes_rfc5545_text(auth_client_a, user_a):
    _make_event(user_a, notes='Row 1, beds; line1\nline2')

    feed_path = auth_client_a.get('/api/calendar/feed-info').get_json()['feedPath']
    ics = _get_feed(auth_client_a, feed_path).get_data(as_text=True)

    # Commas/semicolons escaped, newline becomes literal \n sequence.
    assert 'Row 1\\, beds\\;' in ics
    assert 'line1\\nline2' in ics
