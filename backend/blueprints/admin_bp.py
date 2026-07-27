"""
Admin User Management Blueprint

Routes:
- GET /api/admin/users - List all users with filtering
- POST /api/admin/users - Create new user
- GET/PUT/DELETE /api/admin/users/<id> - Manage specific user
- POST /api/admin/users/<id>/reset-password - Reset user password
- GET/POST /api/admin/backups - List or create backup archives
- GET /api/admin/backups/<id>/download - Download backup archive
- DELETE /api/admin/backups/<id> - Delete backup archive
"""
import logging

from flask import Blueprint, request, jsonify, send_file
from flask_login import login_required, current_user
from sqlalchemy import or_
from datetime import datetime, timedelta

from models import db, User
from services.backup_service import (
    BackupError,
    create_backup,
    delete_backup,
    list_backups,
    resolve_backup_path,
)
from utils.decorators import admin_required
from utils.validators import validate_email, validate_username
from utils.constants import MIN_PASSWORD_LENGTH

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')
logger = logging.getLogger(__name__)


@admin_bp.route('/users', methods=['GET'])
@login_required
@admin_required
def list_users():
    """Get all users with optional filtering and statistics (admin only)"""
    # Get query parameters
    search = request.args.get('search', '').strip()
    filter_type = request.args.get('filter', 'all')  # all, admins, regular, recent
    sort_by = request.args.get('sort', 'created_desc')  # created_asc, created_desc, username_asc, username_desc, last_login

    # Base query
    query = User.query

    # Apply search filter (username or email)
    if search:
        query = query.filter(
            or_(
                User.username.ilike(f'%{search}%'),
                User.email.ilike(f'%{search}%')
            )
        )

    # Apply filter type
    if filter_type == 'admins':
        query = query.filter_by(is_admin=True)
    elif filter_type == 'regular':
        query = query.filter_by(is_admin=False)
    elif filter_type == 'recent':
        # Users created in last 30 days
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        query = query.filter(User.created_at >= thirty_days_ago)

    # Apply sorting
    if sort_by == 'created_asc':
        query = query.order_by(User.created_at.asc())
    elif sort_by == 'created_desc':
        query = query.order_by(User.created_at.desc())
    elif sort_by == 'username_asc':
        query = query.order_by(User.username.asc())
    elif sort_by == 'username_desc':
        query = query.order_by(User.username.desc())
    elif sort_by == 'last_login':
        query = query.order_by(User.last_login.desc().nullslast())

    users = query.all()

    # Calculate statistics
    total_users = User.query.count()
    admin_users = User.query.filter_by(is_admin=True).count()

    # Active users (logged in within last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    active_users = User.query.filter(User.last_login >= thirty_days_ago).count()

    # Recent registrations (last 7 days)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    recent_registrations = User.query.filter(User.created_at >= seven_days_ago).count()

    return jsonify({
        'users': [user.to_dict() for user in users],
        'statistics': {
            'totalUsers': total_users,
            'adminUsers': admin_users,
            'activeUsers': active_users,
            'recentRegistrations': recent_registrations
        }
    }), 200


@admin_bp.route('/users', methods=['POST'])
@login_required
@admin_required
def create_user():
    """Create a new user (admin only)"""
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
        is_admin=data.get('isAdmin', False)  # Default to false if not provided
    )
    user.set_password(data['password'])

    try:
        db.session.add(user)
        db.session.commit()

        return jsonify({
            'message': 'User created successfully',
            'user': user.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create user: {str(e)}'}), 500


@admin_bp.route('/users/<int:user_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
@admin_required
def manage_user(user_id):
    """Get, update, or delete a specific user (admin only)"""
    user = User.query.get_or_404(user_id)

    if request.method == 'DELETE':
        # Security: Prevent admin from deleting themselves
        if user.id == current_user.id:
            return jsonify({'error': 'Cannot delete your own account'}), 403

        # Security: Prevent deleting the last admin
        if user.is_admin:
            admin_count = User.query.filter_by(is_admin=True).count()
            if admin_count <= 1:
                return jsonify({'error': 'Cannot delete the last admin user'}), 403

        try:
            # Cascade delete is handled automatically by SQLAlchemy relationships
            db.session.delete(user)
            db.session.commit()
            return '', 204
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Failed to delete user: {str(e)}'}), 500

    if request.method == 'PUT':
        data = request.get_json()

        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        # Update email if provided
        if 'email' in data:
            # Validate email format
            if not validate_email(data['email']):
                return jsonify({'error': 'Invalid email format'}), 400

            # Check if email is already in use by another user
            existing_user = User.query.filter(
                User.email == data['email'],
                User.id != user_id
            ).first()

            if existing_user:
                return jsonify({'error': 'Email already in use by another user'}), 400

            user.email = data['email']

        # Update admin status if provided
        if 'isAdmin' in data:
            new_admin_status = data['isAdmin']

            # Security: Prevent admin from removing their own admin status
            if user.id == current_user.id and not new_admin_status:
                return jsonify({'error': 'Cannot remove your own admin privileges'}), 403

            # Security: Prevent demoting the last admin
            if user.is_admin and not new_admin_status:
                admin_count = User.query.filter_by(is_admin=True).count()
                if admin_count <= 1:
                    return jsonify({'error': 'Cannot remove the last admin user'}), 403

            user.is_admin = new_admin_status

        try:
            db.session.commit()
            return jsonify({
                'message': 'User updated successfully',
                'user': user.to_dict()
            }), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Failed to update user: {str(e)}'}), 500

    # GET
    return jsonify(user.to_dict()), 200


@admin_bp.route('/users/<int:user_id>/reset-password', methods=['POST'])
@login_required
@admin_required
def reset_user_password(user_id):
    """Reset a user's password (admin only)"""
    user = User.query.get_or_404(user_id)

    data = request.get_json()

    if not data or not data.get('newPassword'):
        return jsonify({'error': 'New password is required'}), 400

    new_password = data['newPassword']

    # Validate password strength
    if len(new_password) < MIN_PASSWORD_LENGTH:
        return jsonify({'error': f'Password must be at least {MIN_PASSWORD_LENGTH} characters'}), 400

    # Security: Block admin from resetting their own password via this route
    # (They should use a regular change password flow instead)
    if user.id == current_user.id:
        return jsonify({'error': 'Use the change password feature for your own account'}), 403

    try:
        user.set_password(new_password)
        db.session.commit()

        return jsonify({
            'message': 'Password reset successfully'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to reset password: {str(e)}'}), 500


@admin_bp.route('/backups', methods=['GET', 'POST'])
@login_required
@admin_required
def manage_backups():
    """List existing backups or create a new backup archive (admin only)."""
    if request.method == 'GET':
        return jsonify({'backups': list_backups()}), 200

    try:
        backup = create_backup()
        return jsonify({
            'message': 'Backup created successfully',
            'backup': backup,
        }), 201
    except BackupError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.exception('Failed to create backup')
        return jsonify({'error': f'Failed to create backup: {str(e)}'}), 500


@admin_bp.route('/backups/<path:backup_id>/download', methods=['GET'])
@login_required
@admin_required
def download_backup(backup_id):
    """Download a backup archive (admin only)."""
    try:
        backup_path = resolve_backup_path(backup_id)
    except BackupError as e:
        status = 404 if str(e) == 'Backup not found' else 400
        return jsonify({'error': str(e)}), status

    return send_file(
        backup_path,
        mimetype='application/zip',
        as_attachment=True,
        download_name=backup_path.name,
        max_age=0,
    )


@admin_bp.route('/backups/<path:backup_id>', methods=['DELETE'])
@login_required
@admin_required
def remove_backup(backup_id):
    """Delete a backup archive (admin only)."""
    try:
        delete_backup(backup_id)
        return '', 204
    except BackupError as e:
        status = 404 if str(e) == 'Backup not found' else 400
        return jsonify({'error': str(e)}), status
    except Exception as e:
        logger.exception('Failed to delete backup')
        return jsonify({'error': f'Failed to delete backup: {str(e)}'}), 500
