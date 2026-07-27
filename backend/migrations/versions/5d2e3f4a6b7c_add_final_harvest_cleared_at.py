"""Add cleared_at soft-clear fields for final harvest

Revision ID: 5d2e3f4a6b7c
Revises: 4c1d2e3f4a5b
Create Date: 2026-06-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5d2e3f4a6b7c'
down_revision = '4c1d2e3f4a5b'
branch_labels = None
depends_on = None


def _column_names(table_name):
    inspector = sa.inspect(op.get_bind())
    return {column['name'] for column in inspector.get_columns(table_name)}


def _index_names(table_name):
    inspector = sa.inspect(op.get_bind())
    return {index['name'] for index in inspector.get_indexes(table_name)}


def _add_column_if_missing(table_name, column):
    if column.name not in _column_names(table_name):
        with op.batch_alter_table(table_name, schema=None) as batch_op:
            batch_op.add_column(column)


def _create_index_if_missing(index_name, table_name, columns):
    if index_name not in _index_names(table_name):
        op.create_index(index_name, table_name, columns, unique=False)


def _drop_column_if_exists(table_name, column_name):
    if column_name in _column_names(table_name):
        with op.batch_alter_table(table_name, schema=None) as batch_op:
            batch_op.drop_column(column_name)


def _drop_index_if_exists(index_name, table_name):
    if index_name in _index_names(table_name):
        op.drop_index(index_name, table_name=table_name)


def upgrade():
    _add_column_if_missing('planted_item', sa.Column('cleared_at', sa.DateTime(), nullable=True))
    _create_index_if_missing('ix_planted_item_cleared_at', 'planted_item', ['cleared_at'])

    _add_column_if_missing('planting_event', sa.Column('cleared_at', sa.DateTime(), nullable=True))
    _create_index_if_missing('ix_planting_event_cleared_at', 'planting_event', ['cleared_at'])


def downgrade():
    _drop_index_if_exists('ix_planting_event_cleared_at', 'planting_event')
    _drop_column_if_exists('planting_event', 'cleared_at')

    _drop_index_if_exists('ix_planted_item_cleared_at', 'planted_item')
    _drop_column_if_exists('planted_item', 'cleared_at')
