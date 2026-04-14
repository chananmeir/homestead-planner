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

# Sun exposure validation
VALID_SUN_EXPOSURES = ['full', 'partial', 'shade']

# Default coordinates for soil temperature (Milwaukee, WI - 53209)
DEFAULT_LATITUDE = 43.1361
DEFAULT_LONGITUDE = -87.9456
