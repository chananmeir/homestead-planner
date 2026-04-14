"""Add actual_germination_date to indoor_seed_start

Revision ID: 3b3c91600150
Revises: a1b2c3d4e5f6
Create Date: 2026-03-12 09:39:08.353915

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3b3c91600150'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('indoor_seed_start', schema=None) as batch_op:
        batch_op.add_column(sa.Column('actual_germination_date', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('indoor_seed_start', schema=None) as batch_op:
        batch_op.drop_column('actual_germination_date')
