"""Add completion consistency check to planting_event

Revision ID: a1b2c3d4e5f6
Revises: 8b2eca933349
Create Date: 2026-02-28 12:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '8b2eca933349'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('planting_event', schema=None) as batch_op:
        batch_op.create_check_constraint(
            'ck_pe_qty_completed_le_qty',
            'quantity_completed IS NULL OR quantity IS NULL OR quantity_completed <= quantity',
        )


def downgrade():
    with op.batch_alter_table('planting_event', schema=None) as batch_op:
        batch_op.drop_constraint('ck_pe_qty_completed_le_qty', type_='check')
