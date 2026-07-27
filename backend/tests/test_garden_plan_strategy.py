from models import db, GardenBed


def _seed_selection(seed_id=1):
    return {
        'id': seed_id,
        'plantId': 'tomato-1',
        'variety': 'Roma',
        'quantity': 1,
        'seedsPerPacket': 50,
    }


def _create_bed(user_id):
    bed = GardenBed(
        user_id=user_id,
        name='Strategy Bed',
        width=4.0,
        length=4.0,
        planning_method='square-foot',
        grid_size=12,
    )
    db.session.add(bed)
    db.session.commit()
    return bed


def _target_for_strategy(client, strategy):
    response = client.post('/api/garden-plans/calculate', json={
        'seedSelections': [_seed_selection()],
        'strategy': strategy,
        'successionPreference': '4',
    })
    assert response.status_code == 200, response.data
    return response.get_json()['items'][0]['targetValue']


def test_calculate_rejects_unknown_strategy(auth_client_a):
    response = auth_client_a.post('/api/garden-plans/calculate', json={
        'seedSelections': [_seed_selection()],
        'strategy': 'feed_the_chickens',
    })

    assert response.status_code == 400
    assert response.get_json()['error'].startswith('strategy must be one of:')


def test_planning_strategies_affect_calculated_default_quantities(auth_client_a, user_a):
    _create_bed(user_a.id)

    balanced = _target_for_strategy(auth_client_a, 'balanced')
    maximize = _target_for_strategy(auth_client_a, 'maximize_harvest')
    use_all = _target_for_strategy(auth_client_a, 'use_all_seeds')

    assert balanced == 12
    assert maximize == 16
    assert use_all == 16


def test_create_plan_allows_internal_manual_strategy(auth_client_a):
    response = auth_client_a.post('/api/garden-plans', json={
        'name': 'Manual Active Plan',
        'year': 2026,
        'strategy': 'manual',
        'items': [],
    })

    assert response.status_code == 201, response.data
    assert response.get_json()['strategy'] == 'manual'


def test_create_plan_rejects_unknown_strategy(auth_client_a):
    response = auth_client_a.post('/api/garden-plans', json={
        'name': 'Bad Strategy Plan',
        'year': 2026,
        'strategy': 'feed_the_chickens',
        'items': [],
    })

    assert response.status_code == 400
    assert response.get_json()['error'].startswith('strategy must be one of:')
