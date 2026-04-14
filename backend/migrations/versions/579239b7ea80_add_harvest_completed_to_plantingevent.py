"""Add harvest_completed to PlantingEvent

Revision ID: 579239b7ea80
Revises: 631fced45d74
Create Date: 2026-03-27 08:43:24.650999

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '579239b7ea80'
down_revision = '631fced45d74'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('planting_event', schema=None) as batch_op:
        batch_op.add_column(sa.Column('harvest_completed', sa.Boolean(), nullable=True))


def downgrade():
    with op.batch_alter_table('planting_event', schema=None) as batch_op:
        batch_op.drop_column('harvest_completed')
