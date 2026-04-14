"""Add destination_bed_ids to indoor_seed_start

Revision ID: e2c4d6d3bc2f
Revises: 3b3c91600150
Create Date: 2026-03-19 11:09:16.123241

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e2c4d6d3bc2f'
down_revision = '3b3c91600150'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('indoor_seed_start', schema=None) as batch_op:
        batch_op.add_column(sa.Column('destination_bed_ids', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('indoor_seed_start', schema=None) as batch_op:
        batch_op.drop_column('destination_bed_ids')
