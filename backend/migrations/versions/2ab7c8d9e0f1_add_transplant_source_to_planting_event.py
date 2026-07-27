"""Add transplant_source to planting_event

Revision ID: 2ab7c8d9e0f1
Revises: 9f4e72a1c6d0
Create Date: 2026-06-19 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2ab7c8d9e0f1'
down_revision = '9f4e72a1c6d0'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('planting_event', schema=None) as batch_op:
        batch_op.add_column(sa.Column('transplant_source', sa.String(length=20), nullable=True))


def downgrade():
    with op.batch_alter_table('planting_event', schema=None) as batch_op:
        batch_op.drop_column('transplant_source')
