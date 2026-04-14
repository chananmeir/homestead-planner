"""
Flask application configuration
"""
import os
from datetime import timedelta


class Config:
    """Base configuration class"""

    # Database
    SQLALCHEMY_DATABASE_URI = 'sqlite:///homestead.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Security: Use environment variable for SECRET_KEY, fallback to secure random key
    SECRET_KEY = os.environ.get('SECRET_KEY') or os.urandom(24).hex()

    # Session security configuration
    SESSION_COOKIE_HTTPONLY = True  # Protect against XSS
    SESSION_COOKIE_SAMESITE = 'Lax'  # Protect against CSRF
    SESSION_COOKIE_SECURE = False  # Set to True in production with HTTPS
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)  # Session expires after 7 days

    # File upload configuration
    UPLOAD_FOLDER = 'static/uploads'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size

    # CORS origins for frontend
    CORS_ORIGINS = ["http://localhost:3000", "http://localhost:3001"]


class DevelopmentConfig(Config):
    """Development-specific configuration"""
    DEBUG = True


class ProductionConfig(Config):
    """Production-specific configuration"""
    DEBUG = False
    SESSION_COOKIE_SECURE = True  # Require HTTPS in production


# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
