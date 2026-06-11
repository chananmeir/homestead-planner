# Database Migrations Guide

This app uses two migration channels, chosen by the **kind of change** you are making:

1. **Flask-Migrate (Alembic)** — **REQUIRED for ALL schema changes**. Any `ADD`, `ALTER`, or `DROP` on columns, tables, constraints, or indexes — including renames and type changes — MUST be authored as an Alembic revision under `migrations/versions/` and applied with `flask db upgrade`. This is the only supported path for schema work.
2. **Custom Data-Only Scripts** (`migrations/custom/data/`) — **Permitted for data-only migrations**: backfills, one-time data transformations, plant/seed data loads, and similar non-structural changes. These scripts MUST NOT alter schema.

See also:
- `migrations/custom/README.md` — custom-script documentation
- `MIGRATION_GUIDE.md` — plant database (`plant_database.py`) update guide (AST-based edits to a Python module, not DB schema)

## Policy: Schema Changes Go Through Flask-Migrate

Schema changes (adding a column, changing nullability, adding an index, etc.) MUST use Flask-Migrate:

```bash
cd backend
flask db migrate -m "Add <field> to <table>"
# Review the generated file under migrations/versions/ before applying
flask db upgrade
```

This is mandated by `CLAUDE.md` Critical Constraint #1 ("NEVER Modify Database Schema Directly"). Bypassing it breaks deployments, corrupts migration history, and hides changes from code review.

## `migrations/custom/schema/` is DEPRECATED

The `migrations/custom/schema/` directory contains historical scripts (e.g., `add_position_fields.py`, `add_seeds_per_packet.py`) that were applied before the Flask-Migrate policy was enforced. Those files remain on disk for historical traceability of what was applied to existing databases, but:

- **Do NOT add new scripts there.**
- **Do NOT run those scripts as part of new setup or deployment.** Fresh databases are built entirely from Alembic revisions under `migrations/versions/`.
- If equivalent schema state is needed on a new database, author an Alembic revision instead.

## Custom Data-Only Scripts (still allowed)

`migrations/custom/data/` remains the home for **data-only** one-offs such as plant/seed data loads and backfills. These do not alter schema.

```bash
cd backend
python migrations/custom/data/add_spinach.py
```

If a proposed "data" script needs to `ALTER` a table or add a column to make its writes work, it is a schema change in disguise — stop and author an Alembic revision instead.

### Recent Migrations

**2026-06-11**: Added `source` provenance field to `indoor_seed_start`
- **Migration**: `ff46179d637a_add_source_provenance_to_indoor_seed_.py` (Flask-Migrate)
- **Purpose**: Distinguish auto-created tracking rows from manual ones. `NULL` = manually created (UI / banner / import flows); `'export'` = auto-created by export-to-calendar's `createIndoorStarts` option (Tier 2 bridge). Enables later evaluation of whether auto-created trays actually get used.
- **Columns added**: `indoor_seed_start.source` (String(20), nullable)
- **Hand-trimmed**: autogenerate also proposed dropping `variety_maturity_model` and the `harvest_record` maturity-learning snapshot columns (they have no ORM models by design — created directly by migration `a7f3c9d21e04`). Those drops were removed; only the `source` column remains. Any future autogenerate against this database will re-propose the same bogus drops — always trim them.

**2026-04-21**: Added `cancelled_at` soft-delete field to `planting_event` and `indoor_seed_start`
- **Migration**: `faa8053ea705_add_cancelled_at_soft_delete_to_.py` (Flask-Migrate)
- **Purpose**: Soft-delete / "cancel task" support for Needs Attention dashboard signals (indoor-start and direct-seed). When a user cancels a task the timestamp is set; cancelled records are filtered from dashboard, Indoor Seed Starting, planting calendar, and plan counts. NULL = active.
- **Columns added**:
  - `planting_event.cancelled_at` (DateTime, nullable, indexed)
  - `indoor_seed_start.cancelled_at` (DateTime, nullable, indexed)
- **Index rationale**: `WHERE cancelled_at IS NULL` is on the hot path for almost every read query across the dashboard, calendar, and indoor seed starting views
- **Undo support**: Timestamp-based soft delete so cancellation can be reversed without recreating FK relationships

**2026-04-16**: Added `DashboardSnooze` table
- **Migration**: `d37b8238c461_add_dashboardsnooze_table.py` (Flask-Migrate)
- **Purpose**: Tracks user-snoozed dashboard signals so they are hidden until `snooze_until` date
- **Columns**:
  - `id` (Integer, PK)
  - `user_id` (Integer, FK → users.id, NOT NULL, indexed)
  - `signal_key` (String(200), NOT NULL) — identifies the specific dashboard signal
  - `snooze_until` (Date, NOT NULL) — signal hidden until this date
  - `created_at` (DateTime, nullable, default=utcnow)
- **Constraints**: `UNIQUE(user_id, signal_key)` → one snooze record per user per signal (upsert pattern)
- **Cascade**: `User.dashboard_snoozes` relationship uses `cascade='all, delete-orphan'`
- **Note**: Migration uses `CREATE TABLE IF NOT EXISTS` to handle `db.create_all()` running during Flask app init

**2026-04-11**: Added `last_frost_date` and `first_frost_date` to `property` table
- **Migration**: `256f54bf5501_add_last_frost_date_and_first_frost_.py` (Flask-Migrate)
- **Purpose**: Allow per-property frost date overrides instead of hardcoded Zone 5b defaults
- **Columns**: `last_frost_date` (Date, nullable), `first_frost_date` (Date, nullable)
- **Nullable**: Yes - NULL means "derive from property zone or use default"
- **New module**: `frost_date_lookup.py` provides zone-to-frost-date lookup table
- **New endpoint**: `GET /api/frost-dates` returns frost dates with priority: property explicit > zone lookup > default
- **Impact**: Frost dates now respect user's property zone setting; Florida properties see Florida frost dates

**2026-01-24**: Deprecated `garden_plan` strategy fields (UI only)
- **Status**: Fields retained in database, removed from wizard UI
- **Affected Fields**:
  - `garden_plan.strategy` - Now uses hardcoded 'balanced' default in UI
  - `garden_plan.succession_preference` - Now uses hardcoded 'moderate' default in UI
- **Reason**: Step 2 "Configure Strategy" removed from Garden Season Planner wizard UI. Manual quantities in Step 1 now control all planning decisions. Fields retained for:
  1. Backward compatibility with existing saved plans
  2. Potential future "recalculate" or "optimize" features
  3. Historical data preservation
- **Migration**: None required (UI-only change, database schema unchanged)
- **Impact**: Existing saved plans load and display correctly. New plans use hardcoded defaults but still store them in the database for consistency.

**2026-01-22**: Added `seeds_per_packet` column to `seed_inventory` table
- Script: `migrations/custom/schema/add_seeds_per_packet.py`
- Purpose: Track number of seeds per packet for better inventory management
- Default value: 50 seeds per packet

---

## Flask-Migrate (Alembic) Workflow

This section covers **Flask-Migrate** (Alembic) for database schema changes without losing data.

## Initial Setup (One-time)

After pulling updates with Flask-Migrate added, run:

```bash
# Install new dependency
pip install -r requirements.txt

# Initialize migrations (creates migrations/ folder)
flask db init

# Create initial migration from current models
flask db migrate -m "Initial migration"

# Apply the migration
flask db upgrade
```

## Development Workflow

Whenever you modify models (add/remove/change fields):

```bash
# 1. Update models in models.py
# (fields already updated)

# 2. Generate migration automatically
flask db migrate -m "Add planning_method and grid_size to GardenBed"

# 3. Review the migration file in migrations/versions/
# (Check it looks correct)

# 4. Apply the migration
flask db upgrade
```

## Production Deployment Workflow

When deploying updates to production:

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
pip install -r requirements.txt

# 3. Apply pending migrations (SAFE - preserves data!)
flask db upgrade

# 4. Restart the app
# (depends on your hosting: systemctl restart, etc.)
```

## Common Commands

```bash
# Check current migration status
flask db current

# View migration history
flask db history

# Rollback last migration (if something went wrong)
flask db downgrade

# Rollback to specific migration
flask db downgrade <revision>

# Create empty migration for manual changes
flask db revision -m "Custom migration"
```

## Migration Files

Migrations are stored in `migrations/versions/`. Each file contains:
- `upgrade()` - Changes to apply
- `downgrade()` - How to revert changes

**NEVER delete migration files** - they track your database history!

## Example: Adding New Fields

When we added `planning_method` and `grid_size` to GardenBed:

1. **Updated models.py:**
```python
class GardenBed(db.Model):
    # ... existing fields ...
    planning_method = db.Column(db.String(50), default='square-foot')
    grid_size = db.Column(db.Integer, default=12)
```

2. **Generated migration:**
```bash
flask db migrate -m "Add garden planning method fields"
```

3. **Applied migration:**
```bash
flask db upgrade
```

This adds the new columns to existing tables WITHOUT dropping data!

## Handling Data Migrations

Sometimes you need to modify existing data:

```python
# In migration file (migrations/versions/xxx_description.py)
from alembic import op
import sqlalchemy as sa

def upgrade():
    # Add column
    op.add_column('garden_bed', sa.Column('planning_method', sa.String(50)))

    # Set default values for existing rows
    op.execute("UPDATE garden_bed SET planning_method = 'square-foot' WHERE planning_method IS NULL")

def downgrade():
    op.drop_column('garden_bed', 'planning_method')
```

## PostgreSQL Migration (for Production)

When moving from SQLite to PostgreSQL:

```bash
# 1. Update database URI in app.py
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://user:pass@localhost/homestead'

# 2. Run migrations on new database
flask db upgrade

# 3. Export/import data (use pg_dump or custom script)
```

## Troubleshooting

**"Target database is not up to date"**
```bash
flask db stamp head  # Mark database as current
```

**"Can't locate revision"**
```bash
flask db revision --rev-id <missing_id>  # Recreate missing migration
```

**"Column already exists"**
- Check if migration was partially applied
- Manually verify database schema
- Create custom migration to handle edge case

## Best Practices

1. **Always backup production database before migrations**
2. **Test migrations on staging environment first**
3. **Review auto-generated migrations** - Alembic might miss renames
4. **Commit migrations to git** - Part of your codebase
5. **Never edit applied migrations** - Create new ones instead
6. **Use meaningful migration messages** - Helps track history

## SaaS Production Checklist

Before going live:

- [ ] Flask-Migrate installed and initialized
- [ ] All migrations tested on staging
- [ ] Database backups automated
- [ ] Migration rollback plan documented
- [ ] Zero-downtime migration strategy (if needed)
- [ ] Environment variables for database URIs
- [ ] Monitoring for failed migrations

## Zero-Downtime Migrations

For large SaaS deployments:

1. **Adding columns**: Safe, no downtime needed
2. **Dropping columns**:
   - Deploy code that doesn't use column
   - Wait 24-48 hours
   - Run migration to drop column
3. **Renaming columns**:
   - Add new column
   - Dual-write to both columns
   - Migrate data
   - Switch reads to new column
   - Remove old column

## Current Schema Version

Run `flask db current` to see:
```
INFO  [alembic.runtime.migration] Context impl SQLiteImpl.
INFO  [alembic.runtime.migration] Will assume non-transactional DDL.
7bf5c60a1234 (head)
```

This is your current database version!
