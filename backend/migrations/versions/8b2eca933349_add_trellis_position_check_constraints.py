"""Add trellis position CHECK constraints

Revision ID: 8b2eca933349
Revises: de0b8c7ef792
Create Date: 2026-02-23 12:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '8b2eca933349'
down_revision = 'de0b8c7ef792'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('planting_event', schema=None) as batch_op:
        batch_op.create_check_constraint(
            'ck_pe_trellis_start_nonneg',
            'trellis_position_start_inches >= 0',
        )
        batch_op.create_check_constraint(
            'ck_pe_trellis_end_gt_start',
            'trellis_position_end_inches > trellis_position_start_inches',
        )
        batch_op.create_check_constraint(
            'ck_pe_linear_feet_nonneg',
            'linear_feet_allocated >= 0',
        )
        batch_op.create_check_constraint(
            'ck_pe_trellis_fields_together',
            '(trellis_position_start_inches IS NULL) = (trellis_position_end_inches IS NULL)',
        )


def downgrade():
    with op.batch_alter_table('planting_event', schema=None) as batch_op:
        batch_op.drop_constraint('ck_pe_trellis_fields_together', type_='check')
        batch_op.drop_constraint('ck_pe_linear_feet_nonneg', type_='check')
        batch_op.drop_constraint('ck_pe_trellis_end_gt_start', type_='check')
        batch_op.drop_constraint('ck_pe_trellis_start_nonneg', type_='check')
