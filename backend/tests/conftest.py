"""
Shared pytest fixtures for backend integration tests.

Provides a Flask app with in-memory SQLite, database session management,
and sample model instances for User, GardenBed, TrellisStructure, and GardenPlan.

NOTE: We intentionally do NOT import app.py because it runs db.create_all()
and Settings.set_setting() at module level, which crashes against an empty
in-memory database. Instead we create a minimal Flask app that initializes
the same `db` instance from models.py.
"""

import sys
import os

# Ensure backend/ is on sys.path so service/model imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from flask import Flask
from models import db as _db, User, GardenBed, GardenPlan, TrellisStructure
from werkzeug.security import generate_password_hash


@pytest.fixture(scope='session')
def app():
    """Create a minimal Flask app configured for testing with in-memory SQLite.

    Avoids importing app.py (which runs module-level db.create_all() and
    Settings.set_setting() against the real file database). The service
    functions under test only need `db` from models.py, which is the same
    SQLAlchemy instance regardless of which Flask app initializes it.
    """
    test_app = Flask(__name__)
    test_app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    test_app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    test_app.config['TESTING'] = True
    _db.init_app(test_app)
    yield test_app


@pytest.fixture(autouse=True)
def db_session(app):
    """
    Per-test database session.

    Drops then recreates all tables before each test to guarantee full
    isolation, even if a previous test's teardown was incomplete.
    """
    with app.app_context():
        _db.drop_all()
        _db.create_all()
        yield _db.session
        _db.session.remove()


@pytest.fixture
def sample_user(db_session):
    """Create a test user (needed for foreign key constraints)."""
    user = User(
        username='testuser',
        email='test@example.com',
        password_hash=generate_password_hash('testpass123'),
    )
    db_session.add(user)
    db_session.flush()
    return user


@pytest.fixture
def sample_bed(db_session, sample_user):
    """Create a test garden bed."""
    bed = GardenBed(
        user_id=sample_user.id,
        name='Test Bed A',
        width=4.0,
        length=8.0,
    )
    db_session.add(bed)
    db_session.flush()
    return bed


@pytest.fixture
def second_bed(db_session, sample_user):
    """Create a second test garden bed for multi-bed scenarios."""
    bed = GardenBed(
        user_id=sample_user.id,
        name='Test Bed B',
        width=4.0,
        length=4.0,
    )
    db_session.add(bed)
    db_session.flush()
    return bed


@pytest.fixture
def sample_trellis(db_session, sample_user):
    """Create a 10-foot test trellis structure."""
    trellis = TrellisStructure(
        user_id=sample_user.id,
        name='Test Trellis',
        start_x=0.0,
        start_y=0.0,
        end_x=10.0,
        end_y=0.0,
        total_length_feet=10.0,
        total_length_inches=120.0,
    )
    db_session.add(trellis)
    db_session.flush()
    return trellis


@pytest.fixture
def second_trellis(db_session, sample_user):
    """Create a second 8-foot trellis for multi-trellis scenarios."""
    trellis = TrellisStructure(
        user_id=sample_user.id,
        name='Test Trellis B',
        start_x=0.0,
        start_y=5.0,
        end_x=8.0,
        end_y=5.0,
        total_length_feet=8.0,
        total_length_inches=96.0,
    )
    db_session.add(trellis)
    db_session.flush()
    return trellis


@pytest.fixture
def sample_plan(db_session, sample_user):
    """Create a test garden plan."""
    plan = GardenPlan(
        user_id=sample_user.id,
        name='Test Plan 2026',
        year=2026,
    )
    db_session.add(plan)
    db_session.flush()
    return plan


# =====================================================================
# Auth / isolation fixtures — used by test_auth_isolation.py
# These intentionally create a SEPARATE Flask app with all blueprints
# registered and Flask-Login configured, so HTTP-level auth tests work.
# =====================================================================

from flask_login import LoginManager


@pytest.fixture(scope='session')
def full_app():
    """Flask app with ALL blueprints + LoginManager (for HTTP auth tests).

    Unlike the minimal ``app`` fixture above, this one mirrors production:
    it registers every blueprint via ``register_blueprints()`` and wires up
    Flask-Login so ``@login_required`` / ``@admin_required`` decorators work.
    """
    test_app = Flask(__name__)
    test_app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    test_app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    test_app.config['TESTING'] = True
    test_app.config['SECRET_KEY'] = 'test-secret-key-for-auth'

    _db.init_app(test_app)

    # Flask-Login setup (mirrors app.py lines 122-135)
    login_manager = LoginManager()
    login_manager.init_app(test_app)

    @login_manager.unauthorized_handler
    def unauthorized():
        from flask import jsonify as _jsonify
        return _jsonify({'error': 'Authentication required'}), 401

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    # Register all blueprints (no wrapper prefix)
    from blueprints import register_blueprints
    register_blueprints(test_app, wrapper_prefix='')

    yield test_app


@pytest.fixture
def full_db(full_app):
    """Per-test database reset for the full_app fixture.

    NOT autouse — only pulled in by tests that depend on ``client`` etc.
    """
    with full_app.app_context():
        _db.drop_all()
        _db.create_all()
        yield _db
        _db.session.remove()


@pytest.fixture
def client(full_db, full_app):
    """Unauthenticated test client."""
    return full_app.test_client()


@pytest.fixture
def user_a(full_db):
    """Test user A."""
    user = User(
        username='alice',
        email='alice@example.com',
        password_hash=generate_password_hash('password123'),
    )
    full_db.session.add(user)
    full_db.session.commit()
    return user


@pytest.fixture
def user_b(full_db):
    """Test user B."""
    user = User(
        username='bob',
        email='bob@example.com',
        password_hash=generate_password_hash('password123'),
    )
    full_db.session.add(user)
    full_db.session.commit()
    return user


@pytest.fixture
def admin_user(full_db):
    """Admin user."""
    user = User(
        username='admin',
        email='admin@example.com',
        password_hash=generate_password_hash('adminpass123'),
        is_admin=True,
    )
    full_db.session.add(user)
    full_db.session.commit()
    return user


def login_as(test_client, user):
    """Log in a user via POST /api/auth/login.

    Args:
        test_client: Flask test_client instance
        user: User model instance (must have username; password is 'password123'
              for regular users, 'adminpass123' for admin)
    """
    password = 'adminpass123' if user.is_admin else 'password123'
    resp = test_client.post('/api/auth/login', json={
        'username': user.username,
        'password': password,
    })
    assert resp.status_code == 200, f"Login failed for {user.username}: {resp.get_json()}"
    return resp


@pytest.fixture
def auth_client_a(full_app, user_a):
    """Test client logged in as user A."""
    c = full_app.test_client()
    login_as(c, user_a)
    return c


@pytest.fixture
def auth_client_b(full_app, user_b):
    """Test client logged in as user B."""
    c = full_app.test_client()
    login_as(c, user_b)
    return c


@pytest.fixture
def admin_client(full_app, admin_user):
    """Test client logged in as admin."""
    c = full_app.test_client()
    login_as(c, admin_user)
    return c
