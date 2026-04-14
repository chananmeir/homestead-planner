"""Add export_key to planting_event

Revision ID: de0b8c7ef792
Revises: 649b4fcf7611
Create Date: 2026-02-18 11:57:17.265951

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'de0b8c7ef792'
down_revision = '649b4fcf7611'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('planting_event', schema=None) as batch_op:
        batch_op.add_column(sa.Column('export_key', sa.String(length=100), nullable=True))
        batch_op.create_index(batch_op.f('ix_planting_event_export_key'), ['export_key'], unique=False)


def downgrade():
    with op.batch_alter_table('planting_event', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_planting_event_export_key'))
        batch_op.drop_column('export_key')
