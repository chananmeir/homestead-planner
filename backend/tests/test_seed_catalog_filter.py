"""
Tests for GET /api/seed-catalog crop filtering.

The plant_id query param is repeatable (?plant_id=a&plant_id=b) so the
catalog's crop filter can be a true multi-select; a single value must keep
working (backward compatibility), and non-global inventory rows must never
leak into the catalog regardless of filters.
"""
from models import db, SeedInventory


def _make_catalog_seed(plant_id, variety, **overrides):
    defaults = {
        'user_id': None,        # global catalog rows have no owner
        'is_global': True,
        'plant_id': plant_id,
        'variety': variety,
    }
    defaults.update(overrides)
    seed = SeedInventory(**defaults)
    db.session.add(seed)
    db.session.commit()
    return seed


def _seed_fixture(user_a):
    tomato = _make_catalog_seed('tomato-1', 'Brandywine')
    pepper = _make_catalog_seed('pepper-1', 'Pimento Sweet')
    carrot = _make_catalog_seed('carrot-1', 'Danvers')
    # A private inventory row that must never appear in the catalog.
    private = _make_catalog_seed('tomato-1', 'Secret Heirloom', user_id=user_a.id, is_global=False)
    return tomato, pepper, carrot, private


def _catalog_ids(client, query=''):
    response = client.get(f'/api/seed-catalog{query}')
    assert response.status_code == 200
    return {s['id'] for s in response.get_json()['seeds']}


def test_no_filter_returns_all_global_seeds_only(auth_client_a, user_a):
    tomato, pepper, carrot, private = _seed_fixture(user_a)
    ids = _catalog_ids(auth_client_a)
    assert {tomato.id, pepper.id, carrot.id} <= ids
    assert private.id not in ids


def test_single_plant_id_still_works(auth_client_a, user_a):
    tomato, pepper, carrot, _ = _seed_fixture(user_a)
    ids = _catalog_ids(auth_client_a, '?plant_id=tomato-1')
    assert tomato.id in ids
    assert pepper.id not in ids
    assert carrot.id not in ids


def test_repeated_plant_id_params_or_together(auth_client_a, user_a):
    tomato, pepper, carrot, private = _seed_fixture(user_a)
    ids = _catalog_ids(auth_client_a, '?plant_id=tomato-1&plant_id=pepper-1')
    assert tomato.id in ids
    assert pepper.id in ids
    assert carrot.id not in ids
    assert private.id not in ids  # multi-filter must not bypass is_global


def test_multi_plant_filter_pagination_total(auth_client_a, user_a):
    _seed_fixture(user_a)
    response = auth_client_a.get('/api/seed-catalog?plant_id=tomato-1&plant_id=pepper-1')
    body = response.get_json()
    assert body['pagination']['total'] == 2


def test_search_composes_with_multi_plant_filter(auth_client_a, user_a):
    tomato, pepper, _, _ = _seed_fixture(user_a)
    ids = _catalog_ids(auth_client_a, '?plant_id=tomato-1&plant_id=pepper-1&search=Pimento')
    assert ids == {pepper.id}


def test_empty_plant_id_values_are_ignored(auth_client_a, user_a):
    tomato, pepper, carrot, _ = _seed_fixture(user_a)
    # An empty param (e.g. from a cleared select) must not filter everything out.
    ids = _catalog_ids(auth_client_a, '?plant_id=')
    assert {tomato.id, pepper.id, carrot.id} <= ids
