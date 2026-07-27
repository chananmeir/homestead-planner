"""Add good-yield sow date learning history

Revision ID: 6e4f5a7b8c9d
Revises: 5d2e3f4a6b7c
Create Date: 2026-06-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6e4f5a7b8c9d'
down_revision = '5d2e3f4a6b7c'
branch_labels = None
depends_on = None


def _column_names(table_name):
    inspector = sa.inspect(op.get_bind())
    return {column['name'] for column in inspector.get_columns(table_name)}


def _table_names():
    inspector = sa.inspect(op.get_bind())
    return set(inspector.get_table_names())


def _add_column_if_missing(table_name, column):
    if column.name not in _column_names(table_name):
        with op.batch_alter_table(table_name, schema=None) as batch_op:
            batch_op.add_column(column)


def _drop_column_if_exists(table_name, column_name):
    if column_name in _column_names(table_name):
        with op.batch_alter_table(table_name, schema=None) as batch_op:
            batch_op.drop_column(column_name)


def upgrade():
    _add_column_if_missing('seed_inventory', sa.Column('proven_sow_month_day', sa.String(length=5), nullable=True))
    _add_column_if_missing('seed_inventory', sa.Column('proven_sow_notes', sa.Text(), nullable=True))
    _add_column_if_missing('seed_inventory', sa.Column('proven_sow_updated_at', sa.DateTime(), nullable=True))

    if 'planting_outcome_history' not in _table_names():
        op.create_table(
            'planting_outcome_history',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('plant_id', sa.String(length=50), nullable=False),
            sa.Column('variety', sa.String(length=100), nullable=True),
            sa.Column('year', sa.Integer(), nullable=False),
            sa.Column('sow_date', sa.Date(), nullable=False),
            sa.Column('target_month_day', sa.String(length=5), nullable=False),
            sa.Column('target_day_of_year', sa.Integer(), nullable=False),
            sa.Column('harvest_date', sa.DateTime(), nullable=True),
            sa.Column('yield_rating', sa.String(length=30), nullable=False),
            sa.Column('weight', sa.Float(), nullable=False),
            sa.Column('source_harvest_id', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['source_harvest_id'], ['harvest_record.id']),
            sa.ForeignKeyConstraint(['user_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('user_id', 'source_harvest_id', name='uq_outcome_history_user_harvest'),
        )
        op.create_index('ix_planting_outcome_history_user_id', 'planting_outcome_history', ['user_id'], unique=False)
        op.create_index('ix_planting_outcome_history_plant_id', 'planting_outcome_history', ['plant_id'], unique=False)
        op.create_index('ix_planting_outcome_history_variety', 'planting_outcome_history', ['variety'], unique=False)
        op.create_index('ix_planting_outcome_history_year', 'planting_outcome_history', ['year'], unique=False)
        op.create_index('ix_planting_outcome_history_source_harvest_id', 'planting_outcome_history', ['source_harvest_id'], unique=False)


def downgrade():
    if 'planting_outcome_history' in _table_names():
        op.drop_table('planting_outcome_history')

    _drop_column_if_exists('seed_inventory', 'proven_sow_updated_at')
    _drop_column_if_exists('seed_inventory', 'proven_sow_notes')
    _drop_column_if_exists('seed_inventory', 'proven_sow_month_day')
