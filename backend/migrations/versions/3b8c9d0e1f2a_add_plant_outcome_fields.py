"""Add plant outcome fields

Revision ID: 3b8c9d0e1f2a
Revises: 2ab7c8d9e0f1
Create Date: 2026-06-19 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3b8c9d0e1f2a'
down_revision = '2ab7c8d9e0f1'
branch_labels = None
depends_on = None


def upgrade():
    _add_column_if_missing('planted_item', sa.Column('outcome', sa.String(length=30), nullable=True))
    _add_column_if_missing('planted_item', sa.Column('outcome_reason', sa.String(length=50), nullable=True))
    _add_column_if_missing('planted_item', sa.Column('outcome_date', sa.DateTime(), nullable=True))
    _add_column_if_missing('planted_item', sa.Column('outcome_notes', sa.Text(), nullable=True))
    _create_index_if_missing('ix_planted_item_outcome', 'planted_item', ['outcome'])

    _add_column_if_missing('planting_event', sa.Column('outcome', sa.String(length=30), nullable=True))
    _add_column_if_missing('planting_event', sa.Column('outcome_reason', sa.String(length=50), nullable=True))
    _add_column_if_missing('planting_event', sa.Column('outcome_date', sa.DateTime(), nullable=True))
    _add_column_if_missing('planting_event', sa.Column('outcome_notes', sa.Text(), nullable=True))
    _create_index_if_missing('ix_planting_event_outcome', 'planting_event', ['outcome'])

    _add_column_if_missing('harvest_record', sa.Column('outcome', sa.String(length=30), nullable=True))
    _add_column_if_missing('harvest_record', sa.Column('outcome_reason', sa.String(length=50), nullable=True))
    _add_column_if_missing(
        'harvest_record',
        sa.Column('yield_excluded', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    _create_index_if_missing('ix_harvest_record_outcome', 'harvest_record', ['outcome'])


def _column_names(table_name):
    inspector = sa.inspect(op.get_bind())
    return {column['name'] for column in inspector.get_columns(table_name)}


def _index_names(table_name):
    inspector = sa.inspect(op.get_bind())
    return {index['name'] for index in inspector.get_indexes(table_name)}


def _add_column_if_missing(table_name, column):
    if column.name not in _column_names(table_name):
        op.add_column(table_name, column)


def _create_index_if_missing(index_name, table_name, columns):
    if index_name not in _index_names(table_name):
        op.create_index(index_name, table_name, columns, unique=False)


def downgrade():
    _drop_index_if_exists('ix_harvest_record_outcome', 'harvest_record')
    _drop_column_if_exists('harvest_record', 'yield_excluded')
    _drop_column_if_exists('harvest_record', 'outcome_reason')
    _drop_column_if_exists('harvest_record', 'outcome')

    _drop_index_if_exists('ix_planting_event_outcome', 'planting_event')
    _drop_column_if_exists('planting_event', 'outcome_notes')
    _drop_column_if_exists('planting_event', 'outcome_date')
    _drop_column_if_exists('planting_event', 'outcome_reason')
    _drop_column_if_exists('planting_event', 'outcome')

    _drop_index_if_exists('ix_planted_item_outcome', 'planted_item')
    _drop_column_if_exists('planted_item', 'outcome_notes')
    _drop_column_if_exists('planted_item', 'outcome_date')
    _drop_column_if_exists('planted_item', 'outcome_reason')
    _drop_column_if_exists('planted_item', 'outcome')


def _drop_column_if_exists(table_name, column_name):
    if column_name in _column_names(table_name):
        op.drop_column(table_name, column_name)


def _drop_index_if_exists(index_name, table_name):
    if index_name in _index_names(table_name):
        op.drop_index(index_name, table_name=table_name)
