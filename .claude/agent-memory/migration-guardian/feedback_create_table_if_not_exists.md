---
name: Use CREATE TABLE IF NOT EXISTS in upgrade() for new tables
description: app.py calls db.create_all() at module import time, which fires before Alembic DDL runs — new table migrations must use IF NOT EXISTS guards
type: feedback
---

Always use `op.execute('CREATE TABLE IF NOT EXISTS ...')` instead of `op.create_table()` when adding new tables, because `app.py` calls `db.create_all()` inside `with app.app_context()` at module load time (line 155). This fires before Alembic's `upgrade()` function body runs, so the table already exists when `op.create_table()` is called, causing `OperationalError: table X already exists`.

**Why:** `backend/app.py` line 155-156 does `db.create_all()` unconditionally. Every `flask db` command loads the app module, triggering `db.create_all()`. This is a project-wide pattern that cannot be easily changed without risk.

**How to apply:**
- `upgrade()`: Use `op.execute('CREATE TABLE IF NOT EXISTS ...')` and `op.execute('CREATE INDEX IF NOT EXISTS ...')`
- `downgrade()`: Use `op.execute('DROP TABLE IF EXISTS ...')` and `op.execute('DROP INDEX IF EXISTS ...')`
- Also check for stale tables with `sa.inspect(bind).get_table_names()` before dropping them (e.g. `nutritional_data` was in the DB but had no model and no prior migration)
