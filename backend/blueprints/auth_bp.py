"""
Authentication Blueprint

Routes:
- POST /api/auth/register - Register new user
- POST /api/auth/login - Login existing user
- POST /api/auth/logout - Logout current user
- GET /api/auth/me - Get current user info
- GET /api/auth/check - Check authentication status
"""
from flask import Blueprint, request, jsonify, session
from flask_login import login_user, logout_user, login_required, current_user
from datetime import datetime

from models import db, User
from utils.validators import validate_email, validate_username
from utils.constants import MIN_PASSWORD_LENGTH

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user"""
    data = request.get_json()

    # Validate required fields
    if not data or not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Username, email, and password are required'}), 400

    # Validate username format
    if not validate_username(data.get('username', '')):
        return jsonify({'error': 'Username must be 3-30 characters (letters, numbers, underscore, hyphen only)'}), 400

    # Validate email format
    if not validate_email(data.get('email', '')):
        return jsonify({'error': 'Invalid email format'}), 400

    # Validate password strength
    if len(data.get('password', '')) < MIN_PASSWORD_LENGTH:
        return jsonify({'error': f'Password must be at least {MIN_PASSWORD_LENGTH} characters'}), 400

    # Check if username already exists
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400

    # Check if email already exists
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already exists'}), 400

    # Create new user
    user = User(
        username=data['username'],
        email=data['email'],
        is_admin=False  # New registrations are never admin by default
    )
    user.set_password(data['password'])

    try:
        db.session.add(user)
        db.session.commit()

        # Automatically log in the user after registration
        login_user(user, remember=True)
        session.permanent = True

        return jsonify({
            'message': 'Registration successful',
            'user': user.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """Login existing user"""
    data = request.get_json()

    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400

    # Find user by username
    user = User.query.filter_by(username=data['username']).first()

    if not user or not user.check_password(data['password']):
        return jsonify({'error': 'Invalid username or password'}), 401

    # Update last login time
    user.last_login = datetime.utcnow()
    db.session.commit()

    # Log in the user (always remember to persist session across page refreshes)
    login_user(user, remember=True)
    session.permanent = True

    return jsonify({
        'message': 'Login successful',
        'user': user.to_dict()
    }), 200


@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Logout current user"""
    # Don't require login - if already logged out, just return success
    if current_user.is_authenticated:
        logout_user()
    return jsonify({'message': 'Logout successful'}), 200


@auth_bp.route('/me', methods=['GET'])
@login_required
def get_current_user():
    """Get current logged-in user information"""
    return jsonify(current_user.to_dict()), 200


@auth_bp.route('/check', methods=['GET'])
def check_auth():
    """Check if user is authenticated (no @login_required to allow checking)"""
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'user': current_user.to_dict()
        }), 200
    else:
        return jsonify({
            'authenticated': False
        }), 200
