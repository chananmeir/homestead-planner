"""Add latitude and longitude to Property model

Revision ID: add_property_coordinates
Create Date: 2025-11-11

"""
# Path setup for running from migrations/custom/ directory
import sys
from pathlib import Path
backend_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(backend_dir))
from alembic import op
import sqlalchemy as sa


def upgrade():
    # Add latitude and longitude columns to property table
    op.add_column('property', sa.Column('latitude', sa.Float(), nullable=True))
    op.add_column('property', sa.Column('longitude', sa.Float(), nullable=True))


def downgrade():
    # Remove latitude and longitude columns
    op.drop_column('property', 'longitude')
    op.drop_column('property', 'latitude')
