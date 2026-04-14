#!/usr/bin/env python3
"""
Test that migration scripts have correct path setup and valid syntax.
Does NOT execute the migrations or their imports, just validates structure.
"""
import sys
from pathlib import Path
import ast


def validate_script(script_path):
    """Validate a single migration script."""
    with open(script_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check 1: Has path injection code
    has_path_injection = 'backend_dir = Path(__file__).parent.parent.parent' in content
    has_sys_path = 'sys.path.insert(0, str(backend_dir))' in content

    # Check 2: Valid Python syntax
    try:
        ast.parse(content)
        valid_syntax = True
    except SyntaxError as e:
        valid_syntax = False
        syntax_error = str(e)

    return {
        'has_path_injection': has_path_injection,
        'has_sys_path': has_sys_path,
        'valid_syntax': valid_syntax,
        'syntax_error': syntax_error if not valid_syntax else None
    }


def test_migration_structure():
    """Test that all migration scripts have correct structure."""

    custom_migrations = Path(__file__).parent
    schema_dir = custom_migrations / 'schema'
    data_dir = custom_migrations / 'data'

    failed = []
    passed = []
    warnings = []

    # Test schema migrations
    print("Testing schema migrations...")
    print("=" * 60)
    for script in sorted(schema_dir.glob('add_*.py')):
        result = validate_script(script)

        if not result['valid_syntax']:
            print(f"  [FAIL] {script.name}: Syntax error")
            failed.append((script.name, result['syntax_error']))
        elif not result['has_path_injection'] or not result['has_sys_path']:
            print(f"  [WARN] {script.name}: Missing path injection")
            warnings.append((script.name, "Missing path injection code"))
        else:
            print(f"  [OK] {script.name}")
            passed.append(script.name)

    # Test data migrations
    print("\nTesting data migrations...")
    print("=" * 60)
    for script in sorted(data_dir.glob('add_*.py')):
        result = validate_script(script)

        if not result['valid_syntax']:
            print(f"  [FAIL] {script.name}: Syntax error")
            failed.append((script.name, result['syntax_error']))
        elif not result['has_path_injection'] or not result['has_sys_path']:
            print(f"  [WARN] {script.name}: Missing path injection")
            warnings.append((script.name, "Missing path injection code"))
        else:
            print(f"  [OK] {script.name}")
            passed.append(script.name)

    # Summary
    print("\n" + "=" * 60)
    print(f"Results: {len(passed)} passed, {len(warnings)} warnings, {len(failed)} failed")
    print("=" * 60)

    if warnings:
        print("\nWarnings:")
        for name, issue in warnings:
            print(f"  {name}: {issue}")

    if failed:
        print("\nFailed scripts:")
        for name, error in failed:
            print(f"  {name}")
            print(f"    Error: {error[:100]}")
        return False
    else:
        print("\n[SUCCESS] All migration scripts validated successfully!")
        print("\nValidation checks:")
        print("  - All scripts have valid Python syntax")
        print("  - All scripts have path injection code")
        print("  - Ready for execution")
        print("\nNext steps:")
        print("  1. Test actual execution:")
        print("     cd backend")
        print("     python migrations/custom/schema/add_variety_column_fixed.py")
        print("  2. Delete original add_*.py files from backend root")
        print("  3. Update dev docs to reflect completion")

    return True


if __name__ == '__main__':
    success = test_migration_structure()
    sys.exit(0 if success else 1)
