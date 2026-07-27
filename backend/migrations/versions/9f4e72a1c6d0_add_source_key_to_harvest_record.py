"""Add source_key to harvest_record

Revision ID: 9f4e72a1c6d0
Revises: ff46179d637a
Create Date: 2026-06-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9f4e72a1c6d0'
down_revision = 'ff46179d637a'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('harvest_record', schema=None) as batch_op:
        batch_op.add_column(sa.Column('source_key', sa.String(length=120), nullable=True))

    bind = op.get_bind()
    rows = bind.execute(sa.text("""
        SELECT id, user_id, planted_item_id
        FROM harvest_record
        WHERE planted_item_id IS NOT NULL
    """)).mappings().all()

    counts = {}
    for row in rows:
        key = (row['user_id'], row['planted_item_id'])
        counts[key] = counts.get(key, 0) + 1

    for row in rows:
        key = (row['user_id'], row['planted_item_id'])
        if counts[key] != 1:
            continue
        bind.execute(
            sa.text("""
                UPDATE harvest_record
                SET source_key = :source_key
                WHERE id = :id
            """),
            {
                'source_key': f"planted_item:{row['planted_item_id']}",
                'id': row['id'],
            },
        )

    with op.batch_alter_table('harvest_record', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_harvest_record_source_key'), ['source_key'], unique=False)
        batch_op.create_unique_constraint(
            'uq_harvest_record_user_source_key',
            ['user_id', 'source_key'],
        )


def downgrade():
    with op.batch_alter_table('harvest_record', schema=None) as batch_op:
        batch_op.drop_constraint('uq_harvest_record_user_source_key', type_='unique')
        batch_op.drop_index(batch_op.f('ix_harvest_record_source_key'))
        batch_op.drop_column('source_key')
