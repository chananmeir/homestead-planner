"""
AST-Based Plant Database Updater

Provides robust programmatic modification of plant_database.py using
Python's Abstract Syntax Tree (AST) module instead of fragile regex patterns.

This approach:
- Parses Python code correctly regardless of formatting
- Validates syntax before writing
- Creates automatic backups
- Reports which plants weren't found
- Works with any valid Python dictionary structure
"""

import ast
import astor  # For pretty-printing AST back to Python code
from pathlib import Path
from typing import Dict, Any, List, Optional


class PlantDatabaseUpdater:
    """
    Robust plant database modifier using AST parsing.

    Parses plant_database.py as Python code, modifies dictionaries
    programmatically, and regenerates clean Python source.

    Example:
        updater = PlantDatabaseUpdater()
        updater.load()
        updater.add_or_update_fields('spinach-1', {
            'new_field': 'value',
            'germination_days': 7
        })
        updater.validate_syntax()
        updater.save(backup=True)
    """

    def __init__(self, db_path: Optional[Path] = None):
        """
        Initialize updater.

        Args:
            db_path: Path to plant_database.py file.
                    If None, uses default location relative to this file.
        """
        if db_path is None:
            db_path = Path(__file__).parent.parent / 'plant_database.py'
        self.db_path = db_path
        self.tree = None
        self.plant_list_node = None

    def load(self):
        """
        Parse plant_database.py into AST.

        Raises:
            FileNotFoundError: If database file doesn't exist
            SyntaxError: If file contains invalid Python syntax
        """
        if not self.db_path.exists():
            raise FileNotFoundError(f"Database file not found: {self.db_path}")

        with open(self.db_path, 'r', encoding='utf-8') as f:
            source = f.read()

        self.tree = ast.parse(source)
        self._find_plant_database()

    def _find_plant_database(self):
        """
        Locate PLANT_DATABASE list in AST.

        Raises:
            ValueError: If PLANT_DATABASE list not found
        """
        for node in ast.walk(self.tree):
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id == 'PLANT_DATABASE':
                        if isinstance(node.value, ast.List):
                            self.plant_list_node = node.value
                            return
        raise ValueError("PLANT_DATABASE list not found in file")

    def find_plant_by_id(self, plant_id: str) -> Optional[ast.Dict]:
        """
        Find a plant dictionary by its 'id' field.

        Args:
            plant_id: Plant ID to search for (e.g., 'spinach-1')

        Returns:
            ast.Dict node if found, None otherwise

        Raises:
            RuntimeError: If load() hasn't been called first
        """
        if not self.plant_list_node:
            raise RuntimeError("Must call load() before finding plants")

        for plant_dict in self.plant_list_node.elts:
            if not isinstance(plant_dict, ast.Dict):
                continue

            # Find 'id' key in this dict
            for key, value in zip(plant_dict.keys, plant_dict.values):
                if isinstance(key, ast.Constant) and key.value == 'id':
                    if isinstance(value, ast.Constant) and value.value == plant_id:
                        return plant_dict

        return None

    def add_or_update_fields(self, plant_id: str, fields: Dict[str, Any]) -> bool:
        """
        Add or update fields in a plant dictionary.

        If a field already exists, its value is updated.
        If a field doesn't exist, it's appended to the end of the dictionary.

        Args:
            plant_id: Plant ID to modify
            fields: Dictionary of field_name -> value to add/update

        Returns:
            True if plant was found and modified, False if plant not found

        Example:
            updater.add_or_update_fields('spinach-1', {
                'germination_days': 7,
                'ideal_seasons': ['spring', 'fall', 'winter'],
                'heat_tolerance': 'low'
            })
        """
        plant_dict = self.find_plant_by_id(plant_id)
        if not plant_dict:
            return False

        for field_name, field_value in fields.items():
            self._set_dict_field(plant_dict, field_name, field_value)

        return True

    def _set_dict_field(self, dict_node: ast.Dict, key: str, value: Any):
        """
        Set or update a field in an ast.Dict node.

        If key exists, updates value. Otherwise appends to end.

        Args:
            dict_node: AST Dict node to modify
            key: Dictionary key name
            value: Value to set (any Python type supported by _python_to_ast)
        """
        # Check if key already exists
        for i, k in enumerate(dict_node.keys):
            if isinstance(k, ast.Constant) and k.value == key:
                # Update existing value
                dict_node.values[i] = self._python_to_ast(value)
                return

        # Add new key-value pair
        dict_node.keys.append(ast.Constant(value=key))
        dict_node.values.append(self._python_to_ast(value))

    def _python_to_ast(self, value: Any) -> ast.expr:
        """
        Convert Python value to AST node.

        Handles: int, float, str, bool, None, list, dict

        Args:
            value: Python value to convert

        Returns:
            AST expression node representing the value

        Raises:
            TypeError: If value type is not supported
        """
        if isinstance(value, (int, float, str, bool, type(None))):
            return ast.Constant(value=value)
        elif isinstance(value, list):
            return ast.List(elts=[self._python_to_ast(v) for v in value], ctx=ast.Load())
        elif isinstance(value, dict):
            keys = [ast.Constant(value=k) for k in value.keys()]
            values = [self._python_to_ast(v) for v in value.values()]
            return ast.Dict(keys=keys, values=values)
        else:
            raise TypeError(f"Unsupported type for AST conversion: {type(value).__name__}")

    def save(self, backup: bool = True):
        """
        Write modified AST back to file.

        Args:
            backup: If True, creates .backup file before overwriting

        Raises:
            RuntimeError: If load() hasn't been called first
        """
        if not self.tree:
            raise RuntimeError("Must call load() before saving")

        if backup:
            backup_path = self.db_path.with_suffix('.py.backup')
            import shutil
            shutil.copy2(self.db_path, backup_path)
            print(f"Created backup: {backup_path}")

        # Convert AST back to Python code
        code = astor.to_source(self.tree)

        # Write to file
        with open(self.db_path, 'w', encoding='utf-8') as f:
            f.write(code)

    def validate_syntax(self) -> bool:
        """
        Validate that the modified AST produces valid Python.

        Returns:
            True if valid

        Raises:
            SyntaxError: If the generated code contains syntax errors
            RuntimeError: If load() hasn't been called first
        """
        if not self.tree:
            raise RuntimeError("Must call load() before validating")

        code = astor.to_source(self.tree)
        compile(code, '<string>', 'exec')
        return True

    def get_stats(self) -> Dict[str, int]:
        """
        Get statistics about the plant database.

        Returns:
            Dictionary with statistics (e.g., total_plants count)

        Raises:
            RuntimeError: If load() hasn't been called first
        """
        if not self.plant_list_node:
            raise RuntimeError("Must call load() before getting stats")

        total_plants = len([e for e in self.plant_list_node.elts if isinstance(e, ast.Dict)])

        return {
            'total_plants': total_plants,
        }


# Example usage
if __name__ == '__main__':
    print("PlantDatabaseUpdater - Example Usage")
    print("=" * 60)

    # Load database
    updater = PlantDatabaseUpdater()
    updater.load()

    # Show stats
    stats = updater.get_stats()
    print(f"Total plants in database: {stats['total_plants']}")

    # Find a specific plant
    spinach = updater.find_plant_by_id('spinach-1')
    if spinach:
        print("\n✓ Found spinach-1 in database")
    else:
        print("\n✗ spinach-1 not found")

    print("\nTo modify plants, use:")
    print("  updater.add_or_update_fields('plant-id', {field: value})")
    print("  updater.validate_syntax()")
    print("  updater.save(backup=True)")
