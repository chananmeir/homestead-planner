"""Add feedback-loop location and sow-date override fields

Revision ID: 4c1d2e3f4a5b
Revises: 3b8c9d0e1f2a
Create Date: 2026-06-22 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4c1d2e3f4a5b'
down_revision = '3b8c9d0e1f2a'
branch_labels = None
depends_on = None


def _column_names(table_name):
    inspector = sa.inspect(op.get_bind())
    return {column['name'] for column in inspector.get_columns(table_name)}


def upgrade():
    if 'zipcode' not in _column_names('property'):
        with op.batch_alter_table('property', schema=None) as batch_op:
            batch_op.add_column(sa.Column('zipcode', sa.String(length=10), nullable=True))

    seed_columns = _column_names('seed_inventory')
    columns_to_add = []
    if 'earliest_sow_month_day' not in seed_columns:
        columns_to_add.append(sa.Column('earliest_sow_month_day', sa.String(length=5), nullable=True))
    if 'sow_adjustment_notes' not in seed_columns:
        columns_to_add.append(sa.Column('sow_adjustment_notes', sa.Text(), nullable=True))
    if 'sow_adjustment_updated_at' not in seed_columns:
        columns_to_add.append(sa.Column('sow_adjustment_updated_at', sa.DateTime(), nullable=True))

    if columns_to_add:
        with op.batch_alter_table('seed_inventory', schema=None) as batch_op:
            for column in columns_to_add:
                batch_op.add_column(column)


def downgrade():
    seed_columns = _column_names('seed_inventory')
    columns_to_drop = [
        column_name for column_name in (
            'sow_adjustment_updated_at',
            'sow_adjustment_notes',
            'earliest_sow_month_day',
        )
        if column_name in seed_columns
    ]
    if columns_to_drop:
        with op.batch_alter_table('seed_inventory', schema=None) as batch_op:
            for column_name in columns_to_drop:
                batch_op.drop_column(column_name)

    if 'zipcode' in _column_names('property'):
        with op.batch_alter_table('property', schema=None) as batch_op:
            batch_op.drop_column('zipcode')
