"""Add last_frost_date and first_frost_date to Property

Revision ID: 256f54bf5501
Revises: b4d826b4780f
Create Date: 2026-04-11 07:25:31.156078

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '256f54bf5501'
down_revision = 'b4d826b4780f'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('property', schema=None) as batch_op:
        batch_op.add_column(sa.Column('last_frost_date', sa.Date(), nullable=True))
        batch_op.add_column(sa.Column('first_frost_date', sa.Date(), nullable=True))


def downgrade():
    with op.batch_alter_table('property', schema=None) as batch_op:
        batch_op.drop_column('first_frost_date')
        batch_op.drop_column('last_frost_date')
