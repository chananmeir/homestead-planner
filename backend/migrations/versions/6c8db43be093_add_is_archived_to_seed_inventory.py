"""Add is_archived to seed_inventory

Revision ID: 6c8db43be093
Revises: 6e4f5a7b8c9d
Create Date: 2026-07-10 15:00:20.194110

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6c8db43be093'
down_revision = '6e4f5a7b8c9d'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('seed_inventory', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_archived', sa.Boolean(), nullable=False, server_default=sa.text('0')))
        batch_op.create_index(batch_op.f('ix_seed_inventory_is_archived'), ['is_archived'], unique=False)


def downgrade():
    with op.batch_alter_table('seed_inventory', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_seed_inventory_is_archived'))
        batch_op.drop_column('is_archived')
