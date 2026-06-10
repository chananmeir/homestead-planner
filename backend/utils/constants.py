"""
Shared constants for the application
"""
import re

# File upload configuration
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# Validation patterns
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
USERNAME_REGEX = re.compile(r'^[a-zA-Z0-9_-]{3,30}$')
MIN_PASSWORD_LENGTH = 8
