"""
Calendar Feed Blueprint

iCalendar (.ics) subscription feed of the user's planting events, so phone /
Google / Apple calendars can subscribe and surface garden tasks natively
(borrowing the phone's reminders instead of building a notification channel).

Calendar clients fetch subscription URLs without cookies, so the feed is
authenticated by a per-user secret token (a Google-style "secret address")
stored in the Settings key-value table. Regenerating the token revokes any
previously shared URL. The token route is public but unguessable
(secrets.token_urlsafe(32) → 43 URL-safe chars).

Routes:
- GET  /api/calendar/feed-info               (login) → the user's feed URL (token auto-created)
- POST /api/calendar/feed-token/regenerate   (login) → new token; old URL stops working
- GET  /api/calendar/feed/<token>.ics        (token) → the iCalendar payload
"""
import secrets
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify, Response
from flask_login import login_required, current_user

from models import Settings, PlantingEvent, GardenBed, IndoorSeedStart
from plant_database import get_plant_by_id

calendar_feed_bp = Blueprint('calendar_feed', __name__, url_prefix='/api/calendar')

ICS_TOKEN_KEY = 'ics_feed_token'

# Phase date fields → (uid suffix, emoji, action label). Mirrors the calendar
# grid's marker model: one VEVENT per phase date of each planting event.
_PLANTING_PHASES = [
    ('seed_start_date', 'seed-start', '\U0001F331', 'Start seeds indoors'),
    ('transplant_date', 'transplant', '\U0001F33F', 'Transplant'),
    ('direct_seed_date', 'direct-seed', '\U0001F955', 'Direct seed'),
    ('expected_harvest_date', 'harvest', '\U0001F9FA', 'Harvest ready'),
]

# Non-planting event types use expected_harvest_date as their action date.
_NON_PLANTING_LABELS = {
    'mulch': ('\U0001F6E1️', 'Apply mulch'),
    'fertilizing': ('\U0001F33E', 'Fertilize'),
    'irrigation': ('\U0001F4A7', 'Irrigation'),
    'maple-tapping': ('\U0001F341', 'Maple tapping'),
}


def _escape_text(value):
    """RFC 5545 TEXT escaping for SUMMARY/DESCRIPTION/LOCATION values."""
    if value is None:
        return ''
    return (
        str(value)
        .replace('\\', '\\\\')
        .replace(';', '\\;')
        .replace(',', '\\,')
        .replace('\r\n', '\\n')
        .replace('\n', '\\n')
    )


def _fold(line):
    """RFC 5545 line folding: max 75 octets per line, continuations indented
    with a single space. Splits on UTF-8 character boundaries."""
    encoded = line.encode('utf-8')
    if len(encoded) <= 75:
        return line
    parts = []
    limit = 75
    while encoded:
        cut = min(limit, len(encoded))
        # Back up so we never split inside a multi-byte UTF-8 sequence.
        while cut < len(encoded) and (encoded[cut] & 0xC0) == 0x80:
            cut -= 1
        parts.append(encoded[:cut].decode('utf-8'))
        encoded = encoded[cut:]
        limit = 74  # continuation lines lose one octet to the leading space
    return '\r\n '.join(parts)


def _ics_date(value):
    """YYYYMMDD for all-day DTSTART/DTEND (accepts date or datetime)."""
    return value.strftime('%Y%m%d')


def _vevent(uid, day, summary, description='', location='', dtstamp=''):
    """One all-day VEVENT. DTEND is the exclusive next day per RFC 5545."""
    lines = [
        'BEGIN:VEVENT',
        f'UID:{uid}',
        f'DTSTAMP:{dtstamp}',
        f'DTSTART;VALUE=DATE:{_ics_date(day)}',
        f'DTEND;VALUE=DATE:{_ics_date(day + timedelta(days=1))}',
        f'SUMMARY:{_escape_text(summary)}',
    ]
    if location:
        lines.append(f'LOCATION:{_escape_text(location)}')
    if description:
        lines.append(f'DESCRIPTION:{_escape_text(description)}')
    lines.append('END:VEVENT')
    return lines


def build_ics_for_user(user_id):
    """Serialize the user's active (non-cancelled) planting events as a
    VCALENDAR string. UIDs are stable per event+phase so subscribed clients
    update events in place instead of duplicating them."""
    events = PlantingEvent.query.filter(
        PlantingEvent.user_id == user_id,
        PlantingEvent.cancelled_at.is_(None),
    ).all()
    bed_names = {b.id: b.name for b in GardenBed.query.filter_by(user_id=user_id).all()}
    # Seed-start phase completion lives on the linked IndoorSeedStart.
    started_event_ids = {
        s.planting_event_id
        for s in IndoorSeedStart.query.filter(
            IndoorSeedStart.user_id == user_id,
            IndoorSeedStart.planting_event_id.isnot(None),
            IndoorSeedStart.status != 'planned',
            IndoorSeedStart.cancelled_at.is_(None),
        )
    }

    lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Homestead Planner//Calendar Feed//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Homestead Planner',
        'X-WR-CALDESC:Garden tasks from Homestead Planner',
    ]

    for event in events:
        # Stable per-event DTSTAMP (creation time) keeps the payload from
        # churning on every fetch; UID identity drives client-side updates.
        stamp_source = event.created_at or datetime.utcnow()
        dtstamp = stamp_source.strftime('%Y%m%dT%H%M%SZ')
        bed_label = bed_names.get(event.garden_bed_id, '')

        event_type = event.event_type or 'planting'
        if event_type != 'planting':
            if not event.expected_harvest_date:
                continue
            emoji, action = _NON_PLANTING_LABELS.get(event_type, ('\U0001F4CB', event_type))
            done = '✓ ' if event.completed else ''
            summary = f'{done}{emoji} {action}'
            description = event.notes or ''
            lines.extend(_vevent(
                uid=f'pe-{event.id}-{event_type}@homestead-planner',
                day=event.expected_harvest_date,
                summary=summary,
                description=description,
                location=bed_label,
                dtstamp=dtstamp,
            ))
            continue

        plant = get_plant_by_id(event.plant_id)
        plant_name = plant['name'] if plant else (event.plant_id or 'Plant')
        variety = f' ({event.variety})' if event.variety else ''
        qty = f'{event.quantity}× ' if event.quantity else ''

        for field, phase, emoji, action in _PLANTING_PHASES:
            day = getattr(event, field)
            if not day:
                continue

            if phase == 'harvest':
                phase_done = bool(event.harvest_completed)
            elif phase == 'seed-start':
                phase_done = event.id in started_event_ids
            else:
                phase_done = bool(event.is_complete)
            done = '✓ ' if phase_done else ''

            summary = f'{done}{emoji} {action}: {qty}{plant_name}{variety}'
            description_parts = []
            if bed_label:
                description_parts.append(f'Bed: {bed_label}')
            if event.quantity:
                description_parts.append(f'Quantity: {event.quantity}')
            if event.notes:
                description_parts.append(f'Notes: {event.notes}')
            description = '\n'.join(description_parts)

            lines.extend(_vevent(
                uid=f'pe-{event.id}-{phase}@homestead-planner',
                day=day,
                summary=summary,
                description=description,
                location=bed_label,
                dtstamp=dtstamp,
            ))

    lines.append('END:VCALENDAR')
    return '\r\n'.join(_fold(line) for line in lines) + '\r\n'


def _get_or_create_token(user_id):
    token = Settings.get_setting(ICS_TOKEN_KEY, user_id=user_id)
    if not token:
        token = secrets.token_urlsafe(32)
        Settings.set_setting(ICS_TOKEN_KEY, token, user_id=user_id)
    return token


def _feed_payload(token):
    feed_path = f'/api/calendar/feed/{token}.ics'
    return {
        'feedPath': feed_path,
        'feedUrl': request.host_url.rstrip('/') + feed_path,
    }


@calendar_feed_bp.route('/feed-info', methods=['GET'])
@login_required
def feed_info():
    """Return (creating on first use) the current user's secret feed URL."""
    token = _get_or_create_token(current_user.id)
    return jsonify(_feed_payload(token))


@calendar_feed_bp.route('/feed-token/regenerate', methods=['POST'])
@login_required
def regenerate_feed_token():
    """Issue a fresh secret token; any previously shared feed URL stops working."""
    token = secrets.token_urlsafe(32)
    Settings.set_setting(ICS_TOKEN_KEY, token, user_id=current_user.id)
    return jsonify(_feed_payload(token))


@calendar_feed_bp.route('/feed/<token>.ics', methods=['GET'])
def calendar_feed(token):
    """The token-authenticated ICS payload (no session needed — calendar
    clients fetch without cookies). Unknown tokens 404 without detail."""
    setting = Settings.query.filter_by(key=ICS_TOKEN_KEY, value=token).first()
    if not setting:
        return jsonify({'error': 'Not found'}), 404

    ics = build_ics_for_user(setting.user_id)
    return Response(
        ics,
        content_type='text/calendar; charset=utf-8',
        headers={
            'Content-Disposition': 'inline; filename="homestead-planner.ics"',
            'Cache-Control': 'no-cache',
        },
    )
