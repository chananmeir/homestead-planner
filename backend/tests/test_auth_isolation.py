"""
Auth + User Isolation Integration Tests

Verifies:
1. Protected endpoints return 401 without auth
2. User A's data is invisible to User B
3. User A can't modify User B's resources
4. Admin endpoints require admin role
5. Auth flow (register/login/logout) works correctly

Security gaps documented with @pytest.mark.xfail:
- /health-records GET has no user_id filter (returns ALL users' records)
- /export-garden-plan/<id> missing @login_required
"""

import pytest
from models import (
    db, GardenBed, GardenPlan, SeedInventory, Property,
    TrellisStructure, Livestock, Chicken, Beehive, HealthRecord,
    CompostPile, HarvestRecord, PlantingEvent,
)
from tests.conftest import login_as


# =====================================================================
# Helper — create resources owned by a specific user
# =====================================================================

def _create_bed(user_id):
    bed = GardenBed(user_id=user_id, name='Test Bed', width=4.0, length=8.0)
    db.session.add(bed)
    db.session.commit()
    return bed


def _create_plan(user_id):
    plan = GardenPlan(user_id=user_id, name='Test Plan', year=2026)
    db.session.add(plan)
    db.session.commit()
    return plan


def _create_seed(user_id):
    seed = SeedInventory(
        user_id=user_id, plant_id='tomato-1', variety='Roma',
        quantity=10,
    )
    db.session.add(seed)
    db.session.commit()
    return seed


def _create_property(user_id):
    prop = Property(
        user_id=user_id, name='Test Property', width=100.0, length=200.0,
    )
    db.session.add(prop)
    db.session.commit()
    return prop


def _create_trellis(user_id):
    trellis = TrellisStructure(
        user_id=user_id, name='Test Trellis',
        start_x=0.0, start_y=0.0, end_x=10.0, end_y=0.0,
        total_length_feet=10.0, total_length_inches=120.0,
    )
    db.session.add(trellis)
    db.session.commit()
    return trellis


def _create_livestock(user_id):
    animal = Livestock(
        user_id=user_id, name='Daisy', species='goat', breed='Nubian',
    )
    db.session.add(animal)
    db.session.commit()
    return animal


def _create_chicken(user_id):
    chicken = Chicken(
        user_id=user_id, name='Henrietta', breed='Rhode Island Red',
        quantity=1,
    )
    db.session.add(chicken)
    db.session.commit()
    return chicken


def _create_beehive(user_id):
    hive = Beehive(
        user_id=user_id, name='Hive Alpha', type='Langstroth',
    )
    db.session.add(hive)
    db.session.commit()
    return hive


def _create_harvest(user_id):
    record = HarvestRecord(
        user_id=user_id, plant_id='tomato-1',
        quantity=5.0, unit='lbs',
    )
    db.session.add(record)
    db.session.commit()
    return record


def _create_compost(user_id):
    pile = CompostPile(
        user_id=user_id, name='Pile 1',
    )
    db.session.add(pile)
    db.session.commit()
    return pile


def _create_planting_event(user_id, bed_id):
    event = PlantingEvent(
        user_id=user_id,
        garden_bed_id=bed_id,
        plant_id='tomato-1',
        event_type='planting',
        quantity=4,
    )
    db.session.add(event)
    db.session.commit()
    return event


def _create_health_record(livestock_id):
    record = HealthRecord(
        livestock_id=livestock_id,
        type='vaccination',
        treatment='CDT vaccine',
    )
    db.session.add(record)
    db.session.commit()
    return record


# =====================================================================
# 1. TestAuthFlow — register / login / check / logout
# =====================================================================

class TestAuthFlow:
    """Verify the authentication lifecycle works end-to-end."""

    def test_register(self, client):
        resp = client.post('/api/auth/register', json={
            'username': 'newuser',
            'email': 'new@example.com',
            'password': 'securepass123',
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['user']['username'] == 'newuser'

    def test_login(self, client, user_a):
        resp = client.post('/api/auth/login', json={
            'username': 'alice',
            'password': 'password123',
        })
        assert resp.status_code == 200
        assert resp.get_json()['user']['username'] == 'alice'

    def test_login_wrong_password(self, client, user_a):
        resp = client.post('/api/auth/login', json={
            'username': 'alice',
            'password': 'wrongpassword',
        })
        assert resp.status_code == 401

    def test_auth_check_after_login(self, auth_client_a):
        resp = auth_client_a.get('/api/auth/check')
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['authenticated'] is True
        assert data['user']['username'] == 'alice'

    def test_logout_then_check(self, auth_client_a):
        # Logout
        resp = auth_client_a.post('/api/auth/logout')
        assert resp.status_code == 200

        # Check — should be unauthenticated now
        resp = auth_client_a.get('/api/auth/check')
        assert resp.status_code == 200
        assert resp.get_json()['authenticated'] is False


# =====================================================================
# 2. TestAuthRequired — protected endpoints return 401 without auth
# =====================================================================

class TestAuthRequired:
    """Verify that protected endpoints reject unauthenticated requests."""

    @pytest.mark.parametrize('method,url', [
        # gardens_bp
        ('GET', '/api/garden-beds'),
        ('GET', '/api/planting-events'),
        # garden_planner_bp
        ('GET', '/api/garden-plans'),
        # seeds_bp
        ('GET', '/api/seeds'),
        ('GET', '/api/my-seeds'),
        # properties_bp
        ('GET', '/api/properties'),
        # trellis_bp
        ('GET', '/api/trellis-structures'),
        # livestock_bp
        ('GET', '/api/livestock'),
        ('GET', '/api/chickens'),
        ('GET', '/api/beehives'),
        ('GET', '/api/health-records'),
        # harvests_bp
        ('GET', '/api/harvests'),
        # compost_bp
        ('GET', '/api/compost-piles'),
        # photos_bp
        ('GET', '/api/photos'),
        # utilities_bp
        ('GET', '/api/indoor-seed-starts'),
        # nutrition_bp
        ('GET', '/api/nutrition/dashboard'),
        # data_bp (structures includes user beds)
        ('GET', '/api/structures'),
    ], ids=lambda val: val if isinstance(val, str) else '')
    def test_protected_endpoint_returns_401(self, client, method, url):
        resp = getattr(client, method.lower())(url)
        assert resp.status_code == 401, (
            f"{method} {url} returned {resp.status_code}, expected 401"
        )

    @pytest.mark.parametrize('url', [
        '/api/auth/check',
        '/api/plants',
        '/api/garden-methods',
    ], ids=lambda val: val)
    def test_public_endpoint_not_401(self, client, url):
        resp = client.get(url)
        assert resp.status_code != 401, (
            f"GET {url} returned 401 but should be public"
        )

    @pytest.mark.xfail(
        reason="BUG: /export-garden-plan/<id> missing @login_required",
        strict=True,
    )
    def test_export_garden_plan_requires_auth(self, client, user_a):
        bed = _create_bed(user_a.id)
        resp = client.get(f'/api/export-garden-plan/{bed.id}')
        assert resp.status_code == 401


# =====================================================================
# 3. TestUserIsolation — User A's data is invisible to User B
# =====================================================================

class TestUserIsolation:
    """Verify that one user cannot see another user's data."""

    def test_beds_isolated(self, auth_client_a, auth_client_b, user_a):
        _create_bed(user_a.id)
        resp = auth_client_b.get('/api/garden-beds')
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_plans_isolated(self, auth_client_a, auth_client_b, user_a):
        _create_plan(user_a.id)
        resp = auth_client_b.get('/api/garden-plans')
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_seeds_isolated(self, auth_client_a, auth_client_b, user_a):
        _create_seed(user_a.id)
        # /api/seeds may include global catalog seeds, use /api/my-seeds
        resp = auth_client_b.get('/api/my-seeds')
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_properties_isolated(self, auth_client_a, auth_client_b, user_a):
        _create_property(user_a.id)
        resp = auth_client_b.get('/api/properties')
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_trellis_isolated(self, auth_client_a, auth_client_b, user_a):
        _create_trellis(user_a.id)
        resp = auth_client_b.get('/api/trellis-structures')
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_livestock_isolated(self, auth_client_a, auth_client_b, user_a):
        _create_livestock(user_a.id)
        resp = auth_client_b.get('/api/livestock')
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_chickens_isolated(self, auth_client_a, auth_client_b, user_a):
        _create_chicken(user_a.id)
        resp = auth_client_b.get('/api/chickens')
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_beehives_isolated(self, auth_client_a, auth_client_b, user_a):
        _create_beehive(user_a.id)
        resp = auth_client_b.get('/api/beehives')
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_harvests_isolated(self, auth_client_a, auth_client_b, user_a):
        _create_harvest(user_a.id)
        resp = auth_client_b.get('/api/harvests')
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_compost_isolated(self, auth_client_a, auth_client_b, user_a):
        _create_compost(user_a.id)
        resp = auth_client_b.get('/api/compost-piles')
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_planting_events_isolated(self, auth_client_a, auth_client_b, user_a):
        bed = _create_bed(user_a.id)
        _create_planting_event(user_a.id, bed.id)
        resp = auth_client_b.get('/api/planting-events')
        assert resp.status_code == 200
        assert resp.get_json() == []

    @pytest.mark.xfail(
        reason="BUG: /health-records GET has no user_id filter — returns ALL users' records",
        strict=True,
    )
    def test_health_records_isolated(self, auth_client_a, auth_client_b, user_a):
        animal = _create_livestock(user_a.id)
        _create_health_record(animal.id)
        resp = auth_client_b.get('/api/health-records')
        assert resp.status_code == 200
        assert resp.get_json() == []


# =====================================================================
# 4. TestOwnershipProtection — User B can't modify User A's resources
# =====================================================================

class TestOwnershipProtection:
    """Verify that one user cannot modify/delete another user's resources."""

    def test_cannot_update_other_users_bed(self, auth_client_b, user_a):
        bed = _create_bed(user_a.id)
        resp = auth_client_b.put(f'/api/garden-beds/{bed.id}', json={
            'name': 'Hacked Bed',
        })
        assert resp.status_code in (403, 404)

    def test_cannot_delete_other_users_bed(self, auth_client_b, user_a):
        bed = _create_bed(user_a.id)
        resp = auth_client_b.delete(f'/api/garden-beds/{bed.id}')
        assert resp.status_code in (403, 404)

    def test_cannot_delete_other_users_plan(self, auth_client_b, user_a):
        plan = _create_plan(user_a.id)
        resp = auth_client_b.delete(f'/api/garden-plans/{plan.id}')
        assert resp.status_code in (403, 404)

    def test_cannot_delete_other_users_seed(self, auth_client_b, user_a):
        seed = _create_seed(user_a.id)
        resp = auth_client_b.delete(f'/api/seeds/{seed.id}')
        assert resp.status_code in (403, 404)

    def test_cannot_delete_other_users_property(self, auth_client_b, user_a):
        prop = _create_property(user_a.id)
        resp = auth_client_b.delete(f'/api/properties/{prop.id}')
        assert resp.status_code in (403, 404)

    def test_cannot_delete_other_users_trellis(self, auth_client_b, user_a):
        trellis = _create_trellis(user_a.id)
        resp = auth_client_b.delete(f'/api/trellis-structures/{trellis.id}')
        assert resp.status_code in (403, 404)

    def test_cannot_update_other_users_livestock(self, auth_client_b, user_a):
        animal = _create_livestock(user_a.id)
        resp = auth_client_b.put(f'/api/livestock/{animal.id}', json={
            'name': 'Stolen Animal',
        })
        assert resp.status_code in (403, 404)

    def test_cannot_delete_other_users_planting_event(self, auth_client_b, user_a):
        bed = _create_bed(user_a.id)
        event = _create_planting_event(user_a.id, bed.id)
        resp = auth_client_b.delete(f'/api/planting-events/{event.id}')
        assert resp.status_code in (403, 404)


# =====================================================================
# 5. TestAdminAccess — admin endpoints require admin role
# =====================================================================

class TestAdminAccess:
    """Verify that admin endpoints enforce admin role."""

    def test_unauthenticated_admin_returns_401(self, client):
        resp = client.get('/api/admin/users')
        assert resp.status_code == 401

    def test_non_admin_returns_403(self, auth_client_a):
        resp = auth_client_a.get('/api/admin/users')
        assert resp.status_code == 403

    def test_admin_can_list_users(self, admin_client):
        resp = admin_client.get('/api/admin/users')
        assert resp.status_code == 200

    def test_non_admin_cannot_create_user(self, auth_client_a):
        resp = auth_client_a.post('/api/admin/users', json={
            'username': 'hacker',
            'email': 'hack@example.com',
            'password': 'password123',
        })
        assert resp.status_code == 403

    def test_admin_can_create_user(self, admin_client):
        resp = admin_client.post('/api/admin/users', json={
            'username': 'newadmin',
            'email': 'newadmin@example.com',
            'password': 'password123',
        })
        assert resp.status_code == 201
