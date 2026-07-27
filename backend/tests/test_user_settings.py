from datetime import date, datetime, timedelta

from models import CompostPile, SeedInventory, Settings, db


TODAY = date(2026, 4, 24)


def _dashboard_body(client):
    response = client.get(f'/api/dashboard/today?date={TODAY.isoformat()}')
    assert response.status_code == 200, response.data
    return response.get_json()


def test_settings_defaults_are_typed_and_do_not_expose_internal_keys(auth_client_a):
    response = auth_client_a.get('/api/settings')

    assert response.status_code == 200
    body = response.get_json()
    assert body['values']['dashboard']['snoozeDefaultDays'] == 3
    assert body['values']['dashboard']['seedLowStockPackets'] == 2
    assert body['values']['dashboard']['seedExpiryWindowDays'] == 30
    assert body['values']['compost']['turnReminderDays'] == 7
    assert 'schema' in body
    assert 'ics_feed_token' not in str(body)


def test_settings_patch_persists_only_whitelisted_keys(auth_client_a, user_a):
    response = auth_client_a.patch('/api/settings', json={
        'values': {
            'dashboard': {
                'snoozeDefaultDays': 5,
                'seedLowStockPackets': 4,
            },
            'compost': {
                'turnReminderDays': 3,
            },
        },
    })

    assert response.status_code == 200, response.data
    body = response.get_json()
    assert body['values']['dashboard']['snoozeDefaultDays'] == 5
    assert body['values']['dashboard']['seedLowStockPackets'] == 4
    assert body['values']['dashboard']['seedExpiryWindowDays'] == 30
    assert body['values']['compost']['turnReminderDays'] == 3

    rows = Settings.query.filter_by(user_id=user_a.id).all()
    assert {row.key for row in rows} == {
        'dashboard.snoozeDefaultDays',
        'dashboard.seedLowStockPackets',
        'compost.turnReminderDays',
    }


def test_settings_patch_rejects_unknown_and_out_of_range_values(auth_client_a):
    unknown = auth_client_a.patch('/api/settings', json={
        'values': {'dashboard': {'ics_feed_token': 'leak-me'}},
    })
    assert unknown.status_code == 400
    assert 'Unknown setting' in unknown.get_json()['error']

    out_of_range = auth_client_a.patch('/api/settings', json={
        'values': {'dashboard': {'snoozeDefaultDays': 31}},
    })
    assert out_of_range.status_code == 400
    assert 'at most 30' in out_of_range.get_json()['error']


def test_dashboard_uses_user_settings_for_seed_and_compost_thresholds(auth_client_a, user_a):
    seed = SeedInventory(
        user_id=user_a.id,
        plant_id='carrot-1',
        variety='Nantes',
        quantity=3,
        expiration_date=datetime.combine(TODAY + timedelta(days=45), datetime.min.time()),
    )
    pile = CompostPile(
        user_id=user_a.id,
        name='Main Pile',
        start_date=datetime.combine(TODAY - timedelta(days=20), datetime.min.time()),
        last_turned=datetime.combine(TODAY - timedelta(days=5), datetime.min.time()),
        status='cooking',
    )
    db.session.add_all([seed, pile])
    db.session.commit()

    body = _dashboard_body(auth_client_a)
    assert body['signals']['seedLowStock'] == []
    assert body['signals']['seedExpiring'] == []
    assert body['signals']['compostOverdue'] == []

    response = auth_client_a.patch('/api/settings', json={
        'values': {
            'dashboard': {
                'seedLowStockPackets': 4,
                'seedExpiryWindowDays': 60,
            },
            'compost': {
                'turnReminderDays': 3,
            },
        },
    })
    assert response.status_code == 200, response.data

    body = _dashboard_body(auth_client_a)
    assert len(body['signals']['seedLowStock']) == 1
    assert body['signals']['seedLowStock'][0]['seedId'] == seed.id
    assert len(body['signals']['seedExpiring']) == 1
    assert body['signals']['seedExpiring'][0]['seedId'] == seed.id
    assert len(body['signals']['compostOverdue']) == 1
    assert body['signals']['compostOverdue'][0]['pileId'] == pile.id
    assert body['signals']['compostOverdue'][0]['turnFrequencyDays'] == 3


def test_snooze_uses_user_default_when_days_omitted(auth_client_a):
    response = auth_client_a.patch('/api/settings', json={
        'values': {'dashboard': {'snoozeDefaultDays': 5}},
    })
    assert response.status_code == 200, response.data

    snooze = auth_client_a.post(
        f'/api/dashboard/snooze?date={TODAY.isoformat()}',
        json={'signalKey': 'seed-low-1'},
    )
    assert snooze.status_code == 200, snooze.data
    assert snooze.get_json()['snoozeUntil'] == (TODAY + timedelta(days=5)).isoformat()
