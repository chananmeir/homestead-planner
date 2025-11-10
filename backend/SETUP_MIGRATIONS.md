# Flask-Migrate Setup & Usage Guide

## What Is Flask-Migrate?

Flask-Migrate is a database migration tool that allows you to update your database schema **without losing any data**. This is critical for a production SaaS application with paying customers.

**Before:** Delete database → Lose all data 😱
**After:** Run migrations → Keep all data ✅

---

## First Time Setup (Do This Once)

After pulling the code with Flask-Migrate added:

### Step 1: Install Dependencies

```powershell
pip install -r requirements.txt
```

This installs Flask-Migrate 4.0.5.

### Step 2: Initialize Migrations

```powershell
flask db init
```

This creates a `migrations/` folder to track all schema changes.

### Step 3: Create Initial Migration

```powershell
flask db migrate -m "Initial migration with all current models"
```

This scans your models and creates a migration file.

### Step 4: Apply the Migration

```powershell
flask db upgrade
```

This applies the migration to your database.

### Step 5: Run the App

```powershell
python app.py
```

Your app now runs with migrations enabled!

---

## Daily Development Workflow

### When You Pull Updates

Every time you pull code that might have database changes:

```powershell
# 1. Pull latest code
git pull origin claude/homestead-tracking-app-011CUxQNUDYDBJb6ym2uB1FW

# 2. Install any new dependencies
pip install -r requirements.txt

# 3. Apply any new migrations (SAFE - preserves data!)
flask db upgrade

# 4. Run the app
python app.py
```

That's it! No more deleting databases.

---

## How Migrations Work (Example)

### Scenario: I Add a New Field to the Chicken Model

**Step 1: I modify `models.py`**
```python
class Chicken(db.Model):
    # ... existing fields ...
    vaccinated = db.Column(db.Boolean, default=False)  # NEW FIELD
```

**Step 2: I create a migration**
```bash
flask db migrate -m "Add vaccinated field to Chicken"
```

**Step 3: I commit and push**
```bash
git add .
git commit -m "Add vaccination tracking"
git push
```

**Step 4: You pull and apply**
```powershell
git pull
flask db upgrade
```

**Result:** The `vaccinated` column is added to your existing `chicken` table. All your existing chicken records are preserved with `vaccinated=False` as the default!

---

## Common Commands Reference

### Check Current Database Version
```powershell
flask db current
```
Shows which migration your database is at.

### View Migration History
```powershell
flask db history
```
Shows all migrations that have been applied.

### Rollback Last Migration
```powershell
flask db downgrade
```
Undoes the most recent migration (useful if something goes wrong).

### Rollback to Specific Version
```powershell
flask db downgrade <revision_id>
```
Goes back to a specific migration version.

### Create Empty Migration for Manual Changes
```powershell
flask db revision -m "Custom migration"
```
Creates a blank migration file you can edit manually.

---

## Production Deployment (When Your SaaS Goes Live)

### Pre-Launch Checklist

Before accepting paying customers:

- ✅ Flask-Migrate installed and tested
- ✅ All migrations work on staging environment
- ✅ Database backup system in place
- ✅ Migration rollback plan documented

### Production Update Workflow

When deploying updates to your live production server:

```bash
# 1. ALWAYS backup database first!
pg_dump homestead_production > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Pull latest code
git pull origin main

# 3. Install dependencies
pip install -r requirements.txt

# 4. Apply migrations (safe - preserves all customer data)
flask db upgrade

# 5. Restart your app
systemctl restart homestead  # or PM2, gunicorn, etc.

# 6. Verify app is working
curl https://yourdomain.com/health

# 7. If something went wrong, rollback:
flask db downgrade
git checkout <previous_commit>
systemctl restart homestead
```

---

## Real-World Scenarios

### Scenario 1: Adding the Planning Method Feature

**What Happened:**
- Added `planning_method` field to `GardenBed`
- Added `grid_size` field to `GardenBed`

**Old Way (Lost Data):**
```powershell
rm instance/homestead.db  # ← Deletes all beds, plants, users!
python app.py
```

**New Way (Keeps Data):**
```powershell
flask db upgrade  # ← Adds columns, keeps all existing data!
python app.py
```

### Scenario 2: Adding Livestock Tracking

**What Happened:**
- Created new `Chicken` table
- Created new `EggProduction` table
- Created new `Beehive` table
- etc.

**Migration Command:**
```powershell
flask db migrate -m "Add livestock tracking tables"
flask db upgrade
```

**Result:** New tables created, existing garden beds unchanged!

---

## Troubleshooting

### Error: "Target database is not up to date"

**Fix:**
```powershell
flask db stamp head
```
This marks your database as current.

### Error: "Can't locate revision identifier"

**Cause:** Migration files missing or out of sync.

**Fix:**
```powershell
# Delete migrations folder
rm -rf migrations

# Re-initialize
flask db init
flask db migrate -m "Recreate migrations"
flask db upgrade
```

### Error: "Column already exists"

**Cause:** Migration was partially applied.

**Fix:**
1. Check your database manually
2. Create a custom migration to handle the edge case
3. Or rollback and reapply:
```powershell
flask db downgrade
flask db upgrade
```

### Migration Creates Wrong Changes

**Cause:** Alembic auto-detection isn't perfect.

**Fix:** Edit the migration file before applying:

```python
# migrations/versions/xxx_description.py

def upgrade():
    # Review and modify this section
    op.add_column('garden_bed', sa.Column('planning_method', sa.String(50)))

def downgrade():
    # And this section
    op.drop_column('garden_bed', 'planning_method')
```

---

## Best Practices

### ✅ DO:
- Backup production database before migrations
- Test migrations on staging first
- Review auto-generated migrations before applying
- Commit migration files to git
- Use descriptive migration messages
- Keep migration files in version control

### ❌ DON'T:
- Delete migration files
- Edit migrations after they've been applied
- Skip testing migrations on staging
- Apply migrations directly to production without backup
- Delete the `migrations/` folder (unless recreating from scratch)

---

## Migration File Structure

Migrations are stored in `migrations/versions/`. Example:

```
migrations/
├── alembic.ini
├── env.py
├── script.py.mako
└── versions/
    ├── 001_initial_migration.py
    ├── 002_add_planning_methods.py
    └── 003_add_livestock.py
```

Each migration file contains:

```python
def upgrade():
    """Changes to apply when upgrading"""
    op.add_column('garden_bed', sa.Column('planning_method', sa.String(50)))

def downgrade():
    """Changes to revert when downgrading"""
    op.drop_column('garden_bed', 'planning_method')
```

---

## Moving from SQLite to PostgreSQL

When you're ready for production:

### Step 1: Update Database URI

**In `app.py`:**
```python
# Development (SQLite)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///homestead.db'

# Production (PostgreSQL)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL') or \
    'postgresql://user:password@localhost/homestead_production'
```

### Step 2: Run Migrations on New Database

```bash
# PostgreSQL will be empty
flask db upgrade  # Applies all migrations
```

### Step 3: Migrate Data (if needed)

If you have existing data in SQLite:

```python
# Custom migration script
# Read from SQLite, write to PostgreSQL
```

Or use a tool like `pgloader`:
```bash
pgloader sqlite:///homestead.db postgresql://localhost/homestead_production
```

---

## Quick Reference Card

| Task | Command |
|------|---------|
| Install | `pip install -r requirements.txt` |
| Initialize | `flask db init` |
| Create migration | `flask db migrate -m "message"` |
| Apply migrations | `flask db upgrade` |
| Rollback | `flask db downgrade` |
| Check version | `flask db current` |
| View history | `flask db history` |

---

## Support & Resources

- **Flask-Migrate Docs:** https://flask-migrate.readthedocs.io/
- **Alembic Docs:** https://alembic.sqlalchemy.org/
- **Full Guide:** See `MIGRATIONS.md` in project root

---

## Summary

**The Key Command to Remember:**

```powershell
flask db upgrade
```

This is how you update your database schema without losing data. Run it after every `git pull` that includes model changes.

**Your customers' data is safe!** 🎉
