"""
Custom decorators for route protection
"""
from functools import wraps
from flask import jsonify
from flask_login import current_user


def admin_required(f):
    """
    Decorator to require admin privileges for a route

    Usage:
        @app.route('/admin/users')
        @admin_required
        def admin_users():
            ...

    Returns:
        401 if not authenticated
        403 if not admin
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'error': 'Authentication required'}), 401
        if not current_user.is_admin:
            return jsonify({'error': 'Admin privileges required'}), 403
        return f(*args, **kwargs)
    return decorated_function
