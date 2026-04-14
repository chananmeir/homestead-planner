"""Add bed_assignments and allocation_mode to GardenPlanItem

Revision ID: ff76eff9eab7
Revises:
Create Date: 2026-01-30 05:07:48.800357

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ff76eff9eab7'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add bed_assignments and allocation_mode columns to garden_plan_item
    with op.batch_alter_table('garden_plan_item', schema=None) as batch_op:
        batch_op.add_column(sa.Column('bed_assignments', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('allocation_mode', sa.String(length=20), nullable=True))


def downgrade():
    with op.batch_alter_table('garden_plan_item', schema=None) as batch_op:
        batch_op.drop_column('allocation_mode')
        batch_op.drop_column('bed_assignments')
