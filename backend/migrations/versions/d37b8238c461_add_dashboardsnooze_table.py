"""Add DashboardSnooze table

Revision ID: d37b8238c461
Revises: 256f54bf5501
Create Date: 2026-04-16 12:53:40.743256

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd37b8238c461'
down_revision = '256f54bf5501'
branch_labels = None
depends_on = None


def upgrade():
    # Create the dashboard_snooze table (IF NOT EXISTS because app.py db.create_all() may
    # have already created it when the Flask app was loaded during this migration run)
    op.execute("""
        CREATE TABLE IF NOT EXISTS dashboard_snooze (
            id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            signal_key VARCHAR(200) NOT NULL,
            snooze_until DATE NOT NULL,
            created_at DATETIME,
            PRIMARY KEY (id),
            CONSTRAINT _user_signal_snooze_uc UNIQUE (user_id, signal_key),
            FOREIGN KEY(user_id) REFERENCES users (id)
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_dashboard_snooze_user_id
        ON dashboard_snooze (user_id)
    """)

    # Drop the stale nutritional_data table (model removed, table was created outside migrations)
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if 'nutritional_data' in inspector.get_table_names():
        with op.batch_alter_table('nutritional_data', schema=None) as batch_op:
            existing_indexes = [idx['name'] for idx in inspector.get_indexes('nutritional_data')]
            if 'idx_nutritional_data_source' in existing_indexes:
                batch_op.drop_index('idx_nutritional_data_source')
            if 'idx_nutritional_data_user' in existing_indexes:
                batch_op.drop_index('idx_nutritional_data_user')
        op.drop_table('nutritional_data')


def downgrade():
    # Drop dashboard_snooze
    op.execute('DROP INDEX IF EXISTS ix_dashboard_snooze_user_id')
    op.execute('DROP TABLE IF EXISTS dashboard_snooze')

    # Restore the nutritional_data table
    op.create_table(
        'nutritional_data',
        sa.Column('id', sa.INTEGER(), nullable=True),
        sa.Column('source_type', sa.VARCHAR(length=50), nullable=False),
        sa.Column('source_id', sa.VARCHAR(length=100), nullable=False),
        sa.Column('name', sa.VARCHAR(length=200), nullable=False),
        sa.Column('usda_fdc_id', sa.INTEGER(), nullable=True),
        sa.Column('calories', sa.FLOAT(), nullable=True),
        sa.Column('protein_g', sa.FLOAT(), nullable=True),
        sa.Column('carbs_g', sa.FLOAT(), nullable=True),
        sa.Column('fat_g', sa.FLOAT(), nullable=True),
        sa.Column('fiber_g', sa.FLOAT(), nullable=True),
        sa.Column('vitamin_a_iu', sa.FLOAT(), nullable=True),
        sa.Column('vitamin_c_mg', sa.FLOAT(), nullable=True),
        sa.Column('vitamin_k_mcg', sa.FLOAT(), nullable=True),
        sa.Column('vitamin_e_mg', sa.FLOAT(), nullable=True),
        sa.Column('folate_mcg', sa.FLOAT(), nullable=True),
        sa.Column('calcium_mg', sa.FLOAT(), nullable=True),
        sa.Column('iron_mg', sa.FLOAT(), nullable=True),
        sa.Column('magnesium_mg', sa.FLOAT(), nullable=True),
        sa.Column('potassium_mg', sa.FLOAT(), nullable=True),
        sa.Column('zinc_mg', sa.FLOAT(), nullable=True),
        sa.Column('average_yield_lbs_per_plant', sa.FLOAT(), nullable=True),
        sa.Column('average_yield_lbs_per_sqft', sa.FLOAT(), nullable=True),
        sa.Column('average_yield_lbs_per_tree_year', sa.FLOAT(), nullable=True),
        sa.Column('data_source', sa.VARCHAR(length=100), nullable=True),
        sa.Column('notes', sa.TEXT(), nullable=True),
        sa.Column('last_updated', sa.TIMESTAMP(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('user_id', sa.INTEGER(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('source_type', 'source_id', 'user_id'),
    )
    with op.batch_alter_table('nutritional_data', schema=None) as batch_op:
        batch_op.create_index('idx_nutritional_data_user', ['user_id'], unique=False)
        batch_op.create_index('idx_nutritional_data_source', ['source_type', 'source_id'], unique=False)
