"""
Three-User Data Isolation Tests

The existing two-user suite (``test_auth_isolation.py``) proves "A creates a
thing, B can't see it". That is necessary but not sufficient: with only two
users, several distinct bugs are indistinguishable from correct behaviour —

  * "leaks to everyone"                  looks like "leaks to B"
  * "returns the first row regardless of owner"  passes whenever A happens to
    be first
  * "returns everything EXCEPT mine"     passes every single A->B assertion

A third user makes the assertion a real partition: each of A/B/C must see
*exactly* its own row and neither of the other two. That is what this file
tests, across all six ordered pairs so no direction goes unchecked.

Companion file: ``test_cross_user_fk_injection.py`` covers the write direction
(user B referencing user A's record IDs in a request body).
"""

import pytest

from models import db, GardenBed
from blueprints import simulation_enabled, SIMULATION_ENV_VAR
from tests import factories


# All six ordered (creator, observer) pairs. Both directions of every pair are
# listed deliberately — an endpoint that filters correctly one way can still
# leak the other way (e.g. a join that only constrains one side).
OBSERVER_PAIRS = [
    ('A', 'B'), ('A', 'C'),
    ('B', 'A'), ('B', 'C'),
    ('C', 'A'), ('C', 'B'),
]

# resource key -> (factory, list endpoint)
RESOURCES = {
    'bed':          (factories.create_bed,               '/api/garden-beds'),
    'plan':         (factories.create_plan,              '/api/garden-plans'),
    'seed':         (factories.create_seed,              '/api/my-seeds'),
    'property':     (factories.create_property,          '/api/properties'),
    'trellis':      (factories.create_trellis,           '/api/trellis-structures'),
    'livestock':    (factories.create_livestock,         '/api/livestock'),
    'chicken':      (factories.create_chicken,           '/api/chickens'),
    'duck':         (factories.create_duck,              '/api/ducks'),
    'beehive':      (factories.create_beehive,           '/api/beehives'),
    'harvest':      (factories.create_harvest,           '/api/harvests'),
    'compost':      (factories.create_compost,           '/api/compost-piles'),
    'indoor_start': (factories.create_indoor_seed_start, '/api/indoor-seed-starts'),
    'photo':        (factories.create_photo,             '/api/photos'),
}


def _items(resp):
    """Normalize a list response to a plain list of dicts.

    Some endpoints return a bare array, others wrap it. Normalizing here keeps
    the parametrized tests free of per-endpoint special cases.
    """
    body = resp.get_json()
    if isinstance(body, list):
        return body
    if isinstance(body, dict):
        for key in ('items', 'data', 'results', 'seedStarts', 'photos'):
            if isinstance(body.get(key), list):
                return body[key]
        # Single-key dict wrapping a list
        list_values = [v for v in body.values() if isinstance(v, list)]
        if len(list_values) == 1:
            return list_values[0]
    raise AssertionError(f'Unrecognized list response shape: {body!r}')


# =====================================================================
# 1. Read isolation — every resource, every direction
# =====================================================================

class TestThreeWayReadIsolation:
    """A resource created by one user must be invisible to BOTH others."""

    @pytest.mark.parametrize('resource', sorted(RESOURCES))
    @pytest.mark.parametrize('creator,observer', OBSERVER_PAIRS,
                             ids=lambda p: ''.join(p))
    def test_resource_invisible_to_other_user(self, trio, resource, creator, observer):
        factory, list_url = RESOURCES[resource]
        factory(trio[creator]['user'].id)

        resp = trio[observer]['client'].get(list_url)

        assert resp.status_code == 200
        assert _items(resp) == [], (
            f"{observer} can see {creator}'s {resource} via {list_url}"
        )

    @pytest.mark.parametrize('resource', sorted(RESOURCES))
    def test_creator_sees_exactly_their_own(self, trio, resource):
        """The flip side: isolation must not be achieved by hiding everything."""
        factory, list_url = RESOURCES[resource]
        factory(trio['A']['user'].id)
        factory(trio['B']['user'].id)
        factory(trio['C']['user'].id)

        for letter in ('A', 'B', 'C'):
            resp = trio[letter]['client'].get(list_url)
            assert resp.status_code == 200
            assert len(_items(resp)) == 1, (
                f'{letter} should see exactly 1 {resource}, saw '
                f'{len(_items(resp))}'
            )


# =====================================================================
# 2. Three-way partition — assertions a two-user suite cannot make
# =====================================================================

class TestThreeWayPartition:

    def test_identically_named_beds_each_user_sees_only_own(self, trio):
        """Three beds, one name.

        Catches "filter by name", "return the first matching row", and
        "return everything except mine" — all of which can pass a two-user
        test by coincidence.
        """
        created = {}
        for letter in ('A', 'B', 'C'):
            resp = trio[letter]['client'].post('/api/garden-beds', json={
                'name': 'Shared Name', 'width': 4, 'length': 8,
            })
            assert resp.status_code == 201
            created[letter] = resp.get_json()['id']

        assert len({*created.values()}) == 3, 'expected three distinct beds'

        for letter in ('A', 'B', 'C'):
            beds = _items(trio[letter]['client'].get('/api/garden-beds'))
            assert len(beds) == 1, f'{letter} saw {len(beds)} beds, expected 1'
            assert beds[0]['id'] == created[letter], (
                f"{letter} was served another user's bed row"
            )

    def test_update_by_one_user_does_not_touch_the_others(self, trio):
        """B renames its bed; A's and C's must be untouched.

        Asserted through the API *and* by direct DB query, because the read
        path and the write path can be broken independently — an endpoint can
        filter its reads correctly while its writes hit the wrong row.
        """
        beds = {
            letter: factories.create_bed(trio[letter]['user'].id, name='Shared Name')
            for letter in ('A', 'B', 'C')
        }

        resp = trio['B']['client'].put(
            f"/api/garden-beds/{beds['B'].id}", json={'name': 'Renamed By B'}
        )
        assert resp.status_code == 200

        for letter in ('A', 'C'):
            api_beds = _items(trio[letter]['client'].get('/api/garden-beds'))
            assert [b['name'] for b in api_beds] == ['Shared Name']

            row = GardenBed.query.filter_by(user_id=trio[letter]['user'].id).one()
            assert row.name == 'Shared Name', (
                f"B's update mutated {letter}'s row in the database"
            )

    def test_delete_by_one_user_does_not_touch_the_others(self, trio):
        beds = {
            letter: factories.create_bed(trio[letter]['user'].id, name='Shared Name')
            for letter in ('A', 'B', 'C')
        }

        # Permanent bed deletion is confirmation-gated (BED_DELETE_CONFIRMATION).
        resp = trio['B']['client'].delete(
            f"/api/garden-beds/{beds['B'].id}", json={'confirmation': 'delete'}
        )
        assert resp.status_code in (200, 204)

        assert GardenBed.query.count() == 2
        for letter in ('A', 'C'):
            assert trio[letter]['client'].get(
                f"/api/garden-beds/{beds[letter].id}"
            ).status_code == 200

    def test_bulk_update_with_mixed_ids_leaves_foreign_rows_intact(self, trio):
        """Targets the one bulk endpoint that fetches without a user filter.

        ``gardens_bp`` bulk-update loads events by ID and only then checks
        ownership per-event inside the mutation loop. That should still refuse
        the batch without persisting anything — this asserts the *rows*, not
        just the status code.
        """
        events = {}
        for letter in ('A', 'B', 'C'):
            bed = factories.create_bed(trio[letter]['user'].id)
            events[letter] = factories.create_planting_event(
                trio[letter]['user'].id, bed.id
            )

        before = {
            letter: (events[letter].completed, events[letter].quantity_completed)
            for letter in ('A', 'C')
        }

        trio['B']['client'].patch('/api/planting-events/bulk-update', json={
            'eventIds': [events['B'].id, events['A'].id, events['C'].id],
            'updates': {'completed': True},
        })

        db.session.expire_all()
        for letter in ('A', 'C'):
            row = db.session.get(type(events[letter]), events[letter].id)
            assert (row.completed, row.quantity_completed) == before[letter], (
                f"B's bulk update mutated {letter}'s planting event"
            )

    def test_settings_are_per_user(self, trio):
        """Settings rows are user-scoped.

        Worth asserting explicitly because ``Settings.get_setting`` /
        ``set_setting`` both default ``user_id`` to ``None``, so a caller that
        forgets to pass it degrades silently to a global read/write.
        """
        resp = trio['A']['client'].patch(
            '/api/settings', json={'dashboard': {'snoozeDefaultDays': 21}}
        )
        assert resp.status_code == 200, resp.get_json()

        for letter in ('B', 'C'):
            body = trio[letter]['client'].get('/api/settings').get_json()
            assert body['values']['dashboard']['snoozeDefaultDays'] != 21, (
                f"A's setting leaked into {letter}'s settings"
            )


# =====================================================================
# 3. Negative control — the shared catalog must stay shared
# =====================================================================

class TestGlobalCatalogNegativeControl:
    """Guards against over-restricting when fixing cross-user seed access.

    Global catalog seeds (``user_id`` NULL, ``is_global`` True) are shared by
    design. These tests must be green BEFORE and AFTER the seed-ownership
    fixes — that is precisely what makes them a control rather than a test.
    """

    @pytest.mark.parametrize('letter', ['A', 'B', 'C'])
    def test_global_seed_visible_to_everyone(self, trio, global_seed, letter):
        seeds = _items(trio[letter]['client'].get('/api/seeds'))
        assert global_seed.id in [s['id'] for s in seeds], (
            f'{letter} cannot see the shared catalog seed'
        )

    @pytest.mark.parametrize('letter', ['A', 'B', 'C'])
    def test_global_seed_attachable_to_own_plan_item(self, trio, global_seed, letter):
        plan = factories.create_plan(trio[letter]['user'].id)

        resp = trio[letter]['client'].post(
            f'/api/garden-plans/{plan.id}/items',
            json={
                'plantId': 'tomato-1',
                'seedInventoryId': global_seed.id,
                'targetValue': 10,
                'plantEquivalent': 10,
            },
        )

        assert resp.status_code == 201, (
            f'{letter} was blocked from using the shared catalog seed: '
            f'{resp.get_json()}'
        )

    @pytest.mark.parametrize('letter', ['A', 'B', 'C'])
    def test_global_seed_attachable_to_own_indoor_start(self, trio, global_seed, letter):
        resp = trio[letter]['client'].post('/api/indoor-seed-starts', json={
            'plantId': 'tomato-1',
            'seedInventoryId': global_seed.id,
            'startDate': '2026-02-25T00:00:00Z',
            'seedsStarted': 12,
        })

        assert resp.status_code == 201, (
            f'{letter} was blocked from starting the shared catalog seed: '
            f'{resp.get_json()}'
        )


# =====================================================================
# 4. Admin boundary
# =====================================================================

class TestAdminBoundary:
    """Admin manages users; it does not get a back door into garden data."""

    def test_admin_can_list_all_three_users(self, trio_admin):
        resp = trio_admin['ADMIN']['client'].get('/api/admin/users')
        assert resp.status_code == 200

        usernames = {u['username'] for u in _items(resp)}
        assert {'alice', 'bob', 'carol'} <= usernames

    def test_admin_garden_data_is_own_scope_only(self, trio_admin):
        for letter in ('A', 'B', 'C'):
            factories.create_bed(trio_admin[letter]['user'].id)

        resp = trio_admin['ADMIN']['client'].get('/api/garden-beds')

        assert resp.status_code == 200
        assert _items(resp) == [], 'admin sees other users\' beds in the normal list'

    def test_admin_cannot_read_a_users_bed_by_id(self, trio_admin):
        bed = factories.create_bed(trio_admin['A']['user'].id)

        resp = trio_admin['ADMIN']['client'].get(f'/api/garden-beds/{bed.id}')

        assert resp.status_code in (403, 404)

    @pytest.mark.parametrize('letter', ['A', 'B', 'C'])
    def test_regular_users_cannot_reach_admin_endpoints(self, trio, letter):
        assert trio[letter]['client'].get('/api/admin/users').status_code == 403


# =====================================================================
# 5. Time-machine endpoints must not be reachable by default
# =====================================================================

class TestSimulationEndpointsGated:
    """The simulation blueprint is a shared-state hazard, not just an auth gap.

    Its routes carry no ``@login_required`` AND they mutate a process-global
    clock that every user's date logic reads — so one anonymous request would
    change "today" for the whole installation. It must therefore be absent
    unless explicitly switched on.
    """

    @pytest.mark.parametrize('path,method', [
        ('/api/simulation/status', 'get'),
        ('/api/simulation/set-date', 'post'),
        ('/api/simulation/advance', 'post'),
    ])
    def test_not_registered_by_default(self, client, path, method):
        resp = getattr(client, method)(path, json={'date': '2026-07-01'})

        # 404 = route does not exist. Anything routable (200/401/403/500) means
        # the blueprint got registered without the opt-in.
        assert resp.status_code == 404, (
            f'{path} is reachable without {SIMULATION_ENV_VAR} being set'
        )

    def test_opt_in_flag_is_off_unless_explicitly_truthy(self, monkeypatch):
        for value in ('', 'false', '0', 'no', 'off', 'FALSE'):
            monkeypatch.setenv(SIMULATION_ENV_VAR, value)
            assert simulation_enabled() is False, f'{value!r} should not enable'

        for value in ('1', 'true', 'TRUE', 'yes', 'on'):
            monkeypatch.setenv(SIMULATION_ENV_VAR, value)
            assert simulation_enabled() is True, f'{value!r} should enable'

    def test_flag_absent_means_disabled(self, monkeypatch):
        monkeypatch.delenv(SIMULATION_ENV_VAR, raising=False)
        assert simulation_enabled() is False
