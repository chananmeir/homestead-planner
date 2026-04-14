"""
Database utilities for migration scripts.

Provides consistent database path resolution across all migration scripts.
This eliminates hardcoded paths and prevents silent failures when the database
filename differs from expectations.

Usage:
    from db_utils import find_database_path, print_database_not_found_error

    def my_migration():
        db_path = find_database_path()

        if not db_path:
            print_database_not_found_error()
            return False

        print(f"Using database: {db_path}")
        # ... rest of migration logic ...
"""

import os
from typing import Optional, List


def find_database_path(additional_paths: Optional[List[str]] = None) -> Optional[str]:
    """
    Find the database file by checking multiple possible locations.

    Checks in order of preference:
    1. instance/homestead_planner.db
    2. instance/homestead.db
    3. instance/garden.db
    4. homestead.db (root directory)
    5. Any additional paths provided

    Args:
        additional_paths: Optional list of additional paths to check

    Returns:
        str: Path to the first non-empty database found
        None: If no database found in any location

    Example:
        >>> db_path = find_database_path()
        >>> if not db_path:
        >>>     print("Database not found!")
        >>>     return False
        >>> print(f"Using database: {db_path}")
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Standard locations in order of preference
    possible_paths = [
        os.path.join(script_dir, 'instance', 'homestead_planner.db'),
        os.path.join(script_dir, 'instance', 'homestead.db'),
        os.path.join(script_dir, 'instance', 'garden.db'),
        os.path.join(script_dir, 'homestead.db'),
    ]

    # Add any additional paths provided
    if additional_paths:
        possible_paths.extend([
            os.path.join(script_dir, path) for path in additional_paths
        ])

    # Find first existing database
    for path in possible_paths:
        if os.path.exists(path):
            # Check that it's not an empty file (0 bytes)
            # Empty files indicate placeholder/unused databases
            if os.path.getsize(path) > 0:
                return path

    return None


def print_database_not_found_error(checked_paths: Optional[List[str]] = None):
    """
    Print a standardized error message when database is not found.

    Args:
        checked_paths: Optional list of paths that were checked
    """
    print("[ERROR] Database not found!")
    if checked_paths:
        print("        Checked these locations:")
        for path in checked_paths:
            exists_marker = "EXISTS (empty)" if os.path.exists(path) else "MISSING"
            print(f"        - {path} [{exists_marker}]")
    print("        Make sure you're running this from the backend directory")
    print("        and that the database has been initialized.")


def get_all_possible_paths() -> List[str]:
    """
    Get a list of all standard database paths that are checked.

    Returns:
        List of absolute paths that find_database_path() will check

    Useful for error reporting or debugging.
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return [
        os.path.join(script_dir, 'instance', 'homestead_planner.db'),
        os.path.join(script_dir, 'instance', 'homestead.db'),
        os.path.join(script_dir, 'instance', 'garden.db'),
        os.path.join(script_dir, 'homestead.db'),
    ]


# Example usage
if __name__ == '__main__':
    print("=" * 60)
    print("Database Path Utility - Test Run")
    print("=" * 60)
    print()

    print("Searching for database...")
    db_path = find_database_path()

    if db_path:
        size_mb = os.path.getsize(db_path) / (1024 * 1024)
        print(f"[SUCCESS] Found database: {db_path}")
        print(f"          Size: {size_mb:.2f} MB")
    else:
        print_database_not_found_error(get_all_possible_paths())

    print()
    print("=" * 60)
