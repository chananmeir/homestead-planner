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
from flask_login import LoginManager
from models import db, User
from datetime import timedelta


# Blueprint URL prefix for testing (set to '' for production)
# Use '/_bp' for parallel testing (blueprints at /_bp/api/*, old routes at /api/*)
# Use '' for production (blueprints at /api/*, no wrapper prefix)
BLUEPRINT_PREFIX = os.environ.get('BLUEPRINT_PREFIX', '')  # PRODUCTION: Blueprints handle real URLs


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


# Create database tables
with app.app_context():
    db.create_all()
    # Default frost dates are now per-user (Settings requires user_id).
    # Seeding is skipped at startup; defaults are applied on first user login.

    # Seed default admin user if none exists
    if not User.query.filter_by(is_admin=True).first():
        admin = User(username='admin', email='admin@homestead.local', is_admin=True)
        admin.set_password('admin123')
        db.session.add(admin)
        db.session.commit()
        print("[OK] Created default admin user (admin/admin123)")

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
    backend_host = os.environ.get('HOMESTEAD_BACKEND_HOST', '0.0.0.0')
    backend_port = int(os.environ.get('HOMESTEAD_BACKEND_PORT', '5000'))
    app.run(debug=True, host=backend_host, port=backend_port)
