"""
Quick script to add the season column to planting_event table
"""
import sqlite3
import os

db_path = './instance/homestead.db'

if not os.path.exists(db_path):
    print(f"Error: Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check if season column already exists
cursor.execute("PRAGMA table_info(planting_event)")
columns = [col[1] for col in cursor.fetchall()]

if 'season' in columns:
    print("✓ Season column already exists - no action needed")
else:
    # Add the season column
    cursor.execute("ALTER TABLE planting_event ADD COLUMN season VARCHAR(20) DEFAULT 'spring'")
    conn.commit()
    print("✓ Season column added successfully!")

conn.close()
print("\nDatabase is now ready. You can restart your Flask server.")
