"""
Migration: Add variety support to PlantedItem and PlantingEvent models
Date: 2025-11-11
Description: Adds 'variety' column to store specific plant varieties
"""
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, db

def migrate():
    """Add variety columns to tables"""
    with app.app_context():
        with db.engine.connect() as conn:
            # Add variety column to planted_item
            try:
                conn.execute(db.text('ALTER TABLE planted_item ADD COLUMN variety VARCHAR(100)'))
                conn.commit()
                print('✓ Added variety column to planted_item')
            except Exception as e:
                if 'duplicate column' in str(e).lower() or 'already exists' in str(e).lower():
                    print('✓ variety column already exists in planted_item')
                else:
                    print(f'✗ Error adding variety to planted_item: {e}')

            # Add variety column to planting_event
            try:
                conn.execute(db.text('ALTER TABLE planting_event ADD COLUMN variety VARCHAR(100)'))
                conn.commit()
                print('✓ Added variety column to planting_event')
            except Exception as e:
                if 'duplicate column' in str(e).lower() or 'already exists' in str(e).lower():
                    print('✓ variety column already exists in planting_event')
                else:
                    print(f'✗ Error adding variety to planting_event: {e}')

        print('\nMigration completed successfully!')

if __name__ == '__main__':
    migrate()
