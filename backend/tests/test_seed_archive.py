"""Tests for archived seed inventory visibility."""

from models import db, SeedInventory


def _make_seed(user_id, variety, **overrides):
    defaults = {
        'user_id': user_id,
        'plant_id': 'tomato-1',
        'variety': variety,
        'quantity': 1,
        'is_global': False,
    }
    defaults.update(overrides)
    seed = SeedInventory(**defaults)
    db.session.add(seed)
    db.session.commit()
    return seed


def _ids(response):
    assert response.status_code == 200
    return {seed['id'] for seed in response.get_json()}


def test_my_seeds_hides_archived_by_default(auth_client_a, user_a):
    active = _make_seed(user_a.id, 'Roma')
    archived = _make_seed(user_a.id, 'Retired Roma', is_archived=True)

    default_ids = _ids(auth_client_a.get('/api/my-seeds'))
    assert active.id in default_ids
    assert archived.id not in default_ids

    included = auth_client_a.get('/api/my-seeds?includeArchived=true')
    included_body = included.get_json()
    assert {active.id, archived.id} <= {seed['id'] for seed in included_body}
    archived_body = next(seed for seed in included_body if seed['id'] == archived.id)
    assert archived_body['isArchived'] is True


def test_my_seeds_with_global_still_hides_archived_personal_by_default(auth_client_a, user_a):
    catalog = _make_seed(None, 'Catalog Roma', is_global=True)
    archived = _make_seed(user_a.id, 'Retired Roma', is_archived=True)

    default_ids = _ids(auth_client_a.get('/api/my-seeds?includeGlobal=true'))
    assert catalog.id in default_ids
    assert archived.id not in default_ids

    included_ids = _ids(auth_client_a.get('/api/my-seeds?includeGlobal=true&includeArchived=true'))
    assert {catalog.id, archived.id} <= included_ids


def test_archive_toggle_updates_seed_and_default_lists(auth_client_a, user_a):
    seed = _make_seed(user_a.id, 'Roma')

    response = auth_client_a.put(f'/api/seeds/{seed.id}', json={'isArchived': True})
    assert response.status_code == 200
    assert response.get_json()['isArchived'] is True

    assert seed.id not in _ids(auth_client_a.get('/api/my-seeds'))
    assert seed.id in _ids(auth_client_a.get('/api/my-seeds?includeArchived=true'))

    response = auth_client_a.put(f'/api/seeds/{seed.id}', json={'isArchived': False})
    assert response.status_code == 200
    assert response.get_json()['isArchived'] is False
    assert seed.id in _ids(auth_client_a.get('/api/my-seeds'))


def test_global_catalog_seed_cannot_be_archived(admin_client):
    catalog = _make_seed(None, 'Catalog Roma', is_global=True)

    response = admin_client.put(f'/api/seeds/{catalog.id}', json={'isArchived': True})

    assert response.status_code == 400
    assert response.get_json()['error'] == 'Global catalog varieties cannot be archived'