"""Add trellis_assignments to garden_plan_item

Revision ID: 454d42db4ccb
Revises: 44a1203779c7
Create Date: 2026-02-09 06:38:44.821148

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '454d42db4ccb'
down_revision = '44a1203779c7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('garden_plan_item', schema=None) as batch_op:
        batch_op.add_column(sa.Column('trellis_assignments', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('garden_plan_item', schema=None) as batch_op:
        batch_op.drop_column('trellis_assignments')
