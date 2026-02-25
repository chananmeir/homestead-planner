# Database Migrations Guide

This app uses multiple migration systems depending on the type of change:

1. **Flask-Migrate (Alembic)** - For model schema changes (recommended for production)
2. **Custom Scripts** - For plant data and specialized migrations (see `migrations/custom/`)
3. **AST Plant Database Updates** - For modifying `plant_database.py` (see `MIGRATION_GUIDE.md`)

## Custom Migration Scripts

For plant data additions and specialized schema changes that don't fit the Flask-Migrate workflow, see:
- `migrations/custom/README.md` - Custom migration documentation
- `MIGRATION_GUIDE.md` - Plant database update guide

Custom scripts are organized in:
- `migrations/custom/schema/` - Database schema changes
- `migrations/custom/data/` - Plant and seed data additions

Run custom scripts from the backend directory:
```bash
cd backend
python migrations/custom/schema/add_position_fields.py
python migrations/custom/schema/add_seeds_per_packet.py
python migrations/custom/data/add_spinach.py
```

### Recent Migrations

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
