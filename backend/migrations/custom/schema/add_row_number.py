"""
Add row_number column to planting_event table for MIGardener physical row tracking
"""
# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
import sqlite3

def add_row_number_column():
    conn = sqlite3.connect(os.path.join(backend_dir, 'instance', 'homestead.db'))
    cursor = conn.cursor()

    try:
        # Add row_number column
        cursor.execute('''
            ALTER TABLE planting_event
            ADD COLUMN row_number INTEGER
        ''')

        conn.commit()
        print("Successfully added row_number column to planting_event table")

    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Column row_number already exists")
        else:
            print(f"Error: {e}")
            raise
    finally:
        conn.close()

if __name__ == '__main__':
    add_row_number_column()
