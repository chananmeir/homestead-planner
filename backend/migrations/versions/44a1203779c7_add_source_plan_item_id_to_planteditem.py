"""Add source_plan_item_id to PlantedItem

Revision ID: 44a1203779c7
Revises: ff76eff9eab7
Create Date: 2026-02-01 19:30:01.044203

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '44a1203779c7'
down_revision = 'ff76eff9eab7'
branch_labels = None
depends_on = None


def upgrade():
    # Add source_plan_item_id FK to planted_item for progress tracking
    with op.batch_alter_table('planted_item', schema=None) as batch_op:
        batch_op.add_column(sa.Column('source_plan_item_id', sa.Integer(), nullable=True))
        batch_op.create_index(batch_op.f('ix_planted_item_source_plan_item_id'), ['source_plan_item_id'], unique=False)
        batch_op.create_foreign_key('fk_planted_item_source_plan_item', 'garden_plan_item', ['source_plan_item_id'], ['id'], ondelete='SET NULL')


def downgrade():
    with op.batch_alter_table('planted_item', schema=None) as batch_op:
        batch_op.drop_constraint('fk_planted_item_source_plan_item', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_planted_item_source_plan_item_id'))
        batch_op.drop_column('source_plan_item_id')
