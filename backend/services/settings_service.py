"""
Typed user preferences backed by the Settings key-value table.

Only keys declared in SETTINGS_SCHEMA are exposed through the public settings
API. Internal keys, such as calendar feed tokens, stay managed by their owning
features and are never returned by this service.
"""
from collections import OrderedDict

from models import Settings, db


SETTINGS_SCHEMA = OrderedDict([
    ('dashboard', OrderedDict([
        ('snoozeDefaultDays', {
            'key': 'dashboard.snoozeDefaultDays',
            'type': 'int',
            'label': 'Default snooze',
            'defaultValue': 3,
            'min': 1,
            'max': 30,
            'unit': 'days',
        }),
        ('seedLowStockPackets', {
            'key': 'dashboard.seedLowStockPackets',
            'type': 'int',
            'label': 'Low seed stock',
            'defaultValue': 2,
            'min': 0,
            'max': 20,
            'unit': 'packets',
        }),
        ('seedExpiryWindowDays', {
            'key': 'dashboard.seedExpiryWindowDays',
            'type': 'int',
            'label': 'Seed expiry window',
            'defaultValue': 30,
            'min': 1,
            'max': 365,
            'unit': 'days',
        }),
    ])),
    ('compost', OrderedDict([
        ('turnReminderDays', {
            'key': 'compost.turnReminderDays',
            'type': 'int',
            'label': 'Compost turn reminder',
            'defaultValue': 7,
            'min': 1,
            'max': 60,
            'unit': 'days',
        }),
    ])),
])


def get_settings_payload(user_id):
    """Return the full typed settings payload for one user."""
    flat_values = get_flat_settings(user_id)
    return {
        'values': _unflatten_values(flat_values),
        'schema': _public_schema(),
    }


def update_settings(user_id, payload):
    """Validate and persist a partial nested settings payload."""
    if not isinstance(payload, dict):
        raise ValueError('Request body must be a JSON object')

    values = payload.get('values', payload)
    if not isinstance(values, dict):
        raise ValueError('values must be an object')

    updates = {}
    for section_name, section_values in values.items():
        if section_name not in SETTINGS_SCHEMA:
            raise ValueError(f'Unknown settings section: {section_name}')
        if not isinstance(section_values, dict):
            raise ValueError(f'{section_name} must be an object')

        for field_name, raw_value in section_values.items():
            if field_name not in SETTINGS_SCHEMA[section_name]:
                raise ValueError(f'Unknown setting: {section_name}.{field_name}')
            definition = SETTINGS_SCHEMA[section_name][field_name]
            updates[definition['key']] = _coerce_value(raw_value, definition)

    for key, value in updates.items():
        _set_raw_setting(user_id, key, str(value))

    db.session.commit()
    return get_settings_payload(user_id)


def get_flat_settings(user_id):
    """Return all public settings as a flat key -> typed value mapping."""
    rows = Settings.query.filter(
        Settings.user_id == user_id,
        Settings.key.in_(_all_storage_keys()),
    ).all()
    stored = {row.key: row.value for row in rows}

    values = {}
    for _, _, definition in _iter_definitions():
        key = definition['key']
        raw_value = stored.get(key)
        if raw_value is None:
            values[key] = definition['defaultValue']
        else:
            try:
                values[key] = _coerce_value(raw_value, definition)
            except ValueError:
                values[key] = definition['defaultValue']
    return values


def get_setting_value(user_id, storage_key):
    """Return one typed setting by storage key, falling back to its default."""
    for _, _, definition in _iter_definitions():
        if definition['key'] == storage_key:
            raw_value = Settings.get_setting(storage_key, default=None, user_id=user_id)
            if raw_value is None:
                return definition['defaultValue']
            try:
                return _coerce_value(raw_value, definition)
            except ValueError:
                return definition['defaultValue']
    raise KeyError(storage_key)


def _set_raw_setting(user_id, key, value):
    setting = Settings.query.filter_by(user_id=user_id, key=key).first()
    if setting:
        setting.value = value
    else:
        db.session.add(Settings(user_id=user_id, key=key, value=value))


def _public_schema():
    schema = OrderedDict()
    for section_name, section in SETTINGS_SCHEMA.items():
        schema[section_name] = OrderedDict()
        for field_name, definition in section.items():
            schema[section_name][field_name] = {
                'type': definition['type'],
                'label': definition['label'],
                'defaultValue': definition['defaultValue'],
                'min': definition.get('min'),
                'max': definition.get('max'),
                'unit': definition.get('unit'),
            }
    return schema


def _unflatten_values(flat_values):
    values = OrderedDict()
    for section_name, field_name, definition in _iter_definitions():
        values.setdefault(section_name, OrderedDict())
        values[section_name][field_name] = flat_values[definition['key']]
    return values


def _all_storage_keys():
    return [definition['key'] for _, _, definition in _iter_definitions()]


def _iter_definitions():
    for section_name, section in SETTINGS_SCHEMA.items():
        for field_name, definition in section.items():
            yield section_name, field_name, definition


def _coerce_value(value, definition):
    value_type = definition['type']
    if value_type == 'int':
        if isinstance(value, bool):
            raise ValueError(f"{definition['label']} must be an integer")
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            raise ValueError(f"{definition['label']} must be an integer")
        if str(value).strip() != str(parsed) and not isinstance(value, int):
            raise ValueError(f"{definition['label']} must be an integer")
        minimum = definition.get('min')
        maximum = definition.get('max')
        if minimum is not None and parsed < minimum:
            raise ValueError(f"{definition['label']} must be at least {minimum}")
        if maximum is not None and parsed > maximum:
            raise ValueError(f"{definition['label']} must be at most {maximum}")
        return parsed

    raise ValueError(f"Unsupported setting type: {value_type}")
