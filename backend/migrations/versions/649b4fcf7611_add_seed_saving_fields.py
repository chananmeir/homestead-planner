"""Add seed saving fields

Revision ID: 649b4fcf7611
Revises: 454d42db4ccb
Create Date: 2026-02-11 14:21:42.191600

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '649b4fcf7611'
down_revision = '454d42db4ccb'
branch_labels = None
depends_on = None


def upgrade():
    # PlantedItem: seed saving fields
    with op.batch_alter_table('planted_item', schema=None) as batch_op:
        batch_op.add_column(sa.Column('save_for_seed', sa.Boolean(), nullable=False, server_default=sa.text('0')))
        batch_op.add_column(sa.Column('seed_maturity_date', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('seeds_collected', sa.Boolean(), nullable=False, server_default=sa.text('0')))
        batch_op.add_column(sa.Column('seeds_collected_date', sa.DateTime(), nullable=True))

    # SeedInventory: homegrown seed provenance
    with op.batch_alter_table('seed_inventory', schema=None) as batch_op:
        batch_op.add_column(sa.Column('source_planted_item_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('is_homegrown', sa.Boolean(), nullable=False, server_default=sa.text('0')))
        batch_op.create_index('ix_seed_inventory_source_planted_item_id', ['source_planted_item_id'], unique=False)
        batch_op.create_foreign_key('fk_seed_inventory_source_planted_item', 'planted_item', ['source_planted_item_id'], ['id'], ondelete='SET NULL')


def downgrade():
    with op.batch_alter_table('seed_inventory', schema=None) as batch_op:
        batch_op.drop_constraint('fk_seed_inventory_source_planted_item', type_='foreignkey')
        batch_op.drop_index('ix_seed_inventory_source_planted_item_id')
        batch_op.drop_column('is_homegrown')
        batch_op.drop_column('source_planted_item_id')

    with op.batch_alter_table('planted_item', schema=None) as batch_op:
        batch_op.drop_column('seeds_collected_date')
        batch_op.drop_column('seeds_collected')
        batch_op.drop_column('seed_maturity_date')
        batch_op.drop_column('save_for_seed')
