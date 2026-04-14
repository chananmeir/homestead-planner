"""
Validation utilities
"""
from .constants import EMAIL_REGEX, USERNAME_REGEX, ALLOWED_EXTENSIONS


def allowed_file(filename):
    """
    Check if file extension is allowed for upload

    Args:
        filename (str): Name of the file

    Returns:
        bool: True if file extension is allowed
    """
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def validate_email(email):
    """
    Validate email format

    Args:
        email (str): Email address to validate

    Returns:
        bool: True if email format is valid
    """
    if not email:
        return False
    return EMAIL_REGEX.match(email) is not None


def validate_username(username):
    """
    Validate username format (3-30 characters, alphanumeric, underscore, hyphen)

    Args:
        username (str): Username to validate

    Returns:
        bool: True if username format is valid
    """
    if not username:
        return False
    return USERNAME_REGEX.match(username) is not None
