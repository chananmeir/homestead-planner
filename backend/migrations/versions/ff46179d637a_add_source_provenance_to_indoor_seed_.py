"""Add source provenance to indoor_seed_start

Revision ID: ff46179d637a
Revises: a7f3c9d21e04
Create Date: 2026-06-11 18:23:47.223285

NULL = manually created (UI / banner / import flows); 'export' = auto-created
by export-to-calendar's createIndoorStarts option (Tier 2 bridge).

NOTE: autogenerate also proposed dropping variety_maturity_model and the
harvest_record maturity-learning snapshot columns — those live only in
migration a7f3c9d21e04 (no ORM models by design, see docs/system-deep-dive.md
§5.1) and must NOT be dropped. This file was hand-trimmed to the source
column only.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ff46179d637a'
down_revision = 'a7f3c9d21e04'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('indoor_seed_start', schema=None) as batch_op:
        batch_op.add_column(sa.Column('source', sa.String(length=20), nullable=True))


def downgrade():
    with op.batch_alter_table('indoor_seed_start', schema=None) as batch_op:
        batch_op.drop_column('source')
