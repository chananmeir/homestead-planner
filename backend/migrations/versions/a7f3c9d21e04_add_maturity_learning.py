"""Add maturity-learning: HarvestRecord snapshot columns + VarietyMaturityModel table

Revision ID: a7f3c9d21e04
Revises: faa8053ea705
Create Date: 2026-06-08 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a7f3c9d21e04'
down_revision = 'faa8053ea705'
branch_labels = None
depends_on = None


def upgrade():
    # Snapshot columns on harvest_record (all nullable; only populated for
    # bed-linked harvests that carry a maturity signal).
    with op.batch_alter_table('harvest_record', schema=None) as batch_op:
        batch_op.add_column(sa.Column('maturity_feedback', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('outcome_reason', sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column('days_in_ground', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('planted_date_snapshot', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('variety_snapshot', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('sun_exposure_snapshot', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('covered_snapshot', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('garden_bed_id_snapshot', sa.Integer(), nullable=True))

    # Materialized learned-DTM table. IF NOT EXISTS because app.py db.create_all()
    # may have already created it when the Flask app was loaded during this migration run.
    op.execute("""
        CREATE TABLE IF NOT EXISTS variety_maturity_model (
            id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            plant_id VARCHAR(50) NOT NULL,
            variety VARCHAR(100),
            sun_exposure VARCHAR(20),
            covered BOOLEAN,
            learned_dtm INTEGER NOT NULL,
            sample_count INTEGER NOT NULL,
            last_recomputed DATETIME,
            PRIMARY KEY (id),
            CONSTRAINT _variety_maturity_key_uc UNIQUE (user_id, plant_id, variety, sun_exposure, covered),
            FOREIGN KEY(user_id) REFERENCES users (id)
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_variety_maturity_model_user_id
        ON variety_maturity_model (user_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_variety_maturity_model_plant_id
        ON variety_maturity_model (plant_id)
    """)


def downgrade():
    op.execute('DROP INDEX IF EXISTS ix_variety_maturity_model_plant_id')
    op.execute('DROP INDEX IF EXISTS ix_variety_maturity_model_user_id')
    op.execute('DROP TABLE IF EXISTS variety_maturity_model')

    with op.batch_alter_table('harvest_record', schema=None) as batch_op:
        batch_op.drop_column('garden_bed_id_snapshot')
        batch_op.drop_column('covered_snapshot')
        batch_op.drop_column('sun_exposure_snapshot')
        batch_op.drop_column('variety_snapshot')
        batch_op.drop_column('planted_date_snapshot')
        batch_op.drop_column('days_in_ground')
        batch_op.drop_column('outcome_reason')
        batch_op.drop_column('maturity_feedback')
