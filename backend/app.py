from dotenv import load_dotenv
import os
import sys

# Fix Windows encoding issues for Unicode characters (emojis, etc.)
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Load environment variables from .env file FIRST, before other imports
# This ensures API keys are available when services initialize
load_dotenv()

from flask import Flask, jsonify
from flask_migrate import Migrate
from flask_cors import CORS
from flask_login import LoginManager, current_user
from models import db, User, Settings
from functools import wraps
from datetime import datetime, timedelta
from utils.helpers import parse_iso_date

# Validation constants
VALID_SUN_EXPOSURES = ['full', 'partial', 'shade']

# Authentication validation patterns
import re
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
USERNAME_REGEX = re.compile(r'^[a-zA-Z0-9_-]{3,30}$')

# Blueprint URL prefix for testing (set to '' for production)
# Use '/_bp' for parallel testing (blueprints at /_bp/api/*, old routes at /api/*)
# Use '' for production (blueprints at /api/*, no wrapper prefix)
BLUEPRINT_PREFIX = os.environ.get('BLUEPRINT_PREFIX', '')  # PRODUCTION: Blueprints handle real URLs
MIN_PASSWORD_LENGTH = 8

# Default coordinates for soil temperature (New York City)
DEFAULT_LATITUDE = 40.7128
DEFAULT_LONGITUDE = -74.0060

def get_mulch_type_on_date(garden_bed_id, user_id, query_date):
    """
    Get the effective mulch type for a garden bed on a specific date.

    This implements temporal mulch tracking by querying the most recent
    mulch event as of the query date.

    Args:
        garden_bed_id (int): Garden bed ID
        user_id (int): User ID (for permission check)
        query_date (datetime): Date to query mulch state for

    Returns:
        str: Mulch type ('none', 'straw', 'wood-chips', etc.)
    """
    # Import here to avoid circular import at module level
    # (PlantingEvent uses db which is initialized after app)
    from models import PlantingEvent, GardenBed

    # Find most recent mulch event as of query_date
    recent_event = PlantingEvent.query.filter(
        PlantingEvent.garden_bed_id == garden_bed_id,
        PlantingEvent.event_type == 'mulch',
        PlantingEvent.user_id == user_id,
        PlantingEvent.expected_harvest_date <= query_date
    ).order_by(
        PlantingEvent.expected_harvest_date.desc()
    ).first()

    if recent_event and recent_event.event_details:
        # Parse event details JSON to get mulch type
        import json
        try:
            details = json.loads(recent_event.event_details)
            return details.get('mulch_type', 'none')
        except (json.JSONDecodeError, AttributeError):
            pass  # Fall through to static fallback

    # Fallback to static bed property
    bed = GardenBed.query.get(garden_bed_id)
    return bed.mulch_type if bed else 'none'

app = Flask(__name__)
# Database: Use instance folder for SQLite (where your actual data lives)
# sqlite:/// (3 slashes) = relative path from app root
# Using os.path.join ensures correct path regardless of working directory
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL') or \
    'sqlite:///' + os.path.join(basedir, 'instance', 'homestead.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Security: Use environment variable for SECRET_KEY, fallback to secure random key
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or os.urandom(24).hex()

# Session security configuration
app.config['SESSION_COOKIE_HTTPONLY'] = True  # Protect against XSS
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # Protect against CSRF
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)  # Session expires after 7 days

app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# Create upload folder if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

db.init_app(app)
migrate = Migrate(app, db)

# Configure CORS to allow requests from the React frontend
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000", "http://localhost:3001"],
        "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True  # Required for session cookies to work cross-origin
    }
})

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)

# For API routes, return JSON error instead of redirecting to login page
@login_manager.unauthorized_handler
def unauthorized():
    """Handle unauthorized access - return JSON instead of redirect"""
    return jsonify({'error': 'Authentication required'}), 401

@login_manager.user_loader
def load_user(user_id):
    """Load user by ID for Flask-Login"""
    return User.query.get(int(user_id))

# Register blueprints with wrapper prefix for parallel testing
from blueprints import register_blueprints
register_blueprints(app, wrapper_prefix=BLUEPRINT_PREFIX)
print(f"[OK] Registered blueprints at {BLUEPRINT_PREFIX or '(no prefix)'}/* for testing")

# Admin required decorator
def admin_required(f):
    """Decorator to require admin privileges for a route"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'error': 'Authentication required'}), 401
        if not current_user.is_admin:
            return jsonify({'error': 'Admin privileges required'}), 403
        return f(*args, **kwargs)
    return decorated_function

# Create database tables
with app.app_context():
    db.create_all()
    # Default frost dates are now per-user (Settings requires user_id).
    # Seeding is skipped at startup; defaults are applied on first user login.

# ==================== ALL ROUTES NOW HANDLED BY BLUEPRINTS ====================
#
# All application routes have been refactored into modular blueprints.
# See backend/blueprints/ directory for the organized route handlers.
#
# Blueprint Organization:
# - auth_bp.py          : Authentication endpoints
# - admin_bp.py         : User management
# - data_bp.py          : Reference data (plants, guilds, structures)
# - seeds_bp.py         : Seed inventory & catalog
# - properties_bp.py    : Properties & structures
# - gardens_bp.py       : Garden beds, planted items, planting events
# - livestock_bp.py     : Livestock management
# - utilities_bp.py     : Calculations, exports, indoor starts
# - weather_bp.py       : Weather data
# - photos_bp.py        : Photo uploads
# - compost_bp.py       : Compost tracking
# - harvests_bp.py      : Harvest records
# - pages_bp.py         : HTML page rendering
#
# For implementation details, see:
# - BLUEPRINT_INTEGRATION_SUCCESS.md
# - BLUEPRINT_MIGRATION_GUIDE.md
# - REFACTORING_SUMMARY.md
#
# ==================== END OF BLUEPRINT DOCUMENTATION ====================

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5000)
