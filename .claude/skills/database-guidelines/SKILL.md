# Database Guidelines

## Overview

This skill provides guidelines for database operations, migrations, and schema management in Homestead Planner.

## When to Use This Skill

- Creating or modifying database models
- Writing database migrations
- Performing data migrations
- Querying the database
- Managing database relationships
- Working with database-related files

## Core Principles

### 1. Never Modify Database Directly

**CRITICAL**: Always use migrations to change the schema.

❌ **NEVER DO THIS**:
```bash
sqlite3 instance/homestead.db
> ALTER TABLE planting_event ADD COLUMN variety VARCHAR(100);
```

✅ **ALWAYS DO THIS**:
```bash
# 1. Modify model
# 2. Create migration
flask db migrate -m "Add variety column"
# 3. Review migration
# 4. Apply migration
flask db upgrade
```

### 2. Relationships Matter

- Define relationships properly
- Use `backref` or `back_populates`
- Set cascade behavior appropriately
- Consider lazy loading strategy

### 3. Data Integrity

- Use constraints (NOT NULL, UNIQUE, CHECK)
- Validate data before saving
- Handle foreign key relationships
- Use transactions for multi-step operations

## Current Database Schema

### Core Models

#### GardenBed
```python
class GardenBed(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    width = db.Column(db.Float, nullable=False)
    length = db.Column(db.Float, nullable=False)
    location = db.Column(db.String(200))
    sun_exposure = db.Column(db.String(20))
    planning_method = db.Column(db.String(50), default='square-foot')
    grid_size = db.Column(db.Integer, default=12)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    planted_items = db.relationship('PlantedItem', backref='garden_bed',
                                   lazy=True, cascade='all, delete-orphan')
```

**Relationships**:
- One-to-many with PlantedItem

**Constraints**:
- `name` is required
- `width` and `length` are required

#### PlantedItem
```python
class PlantedItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    plant_id = db.Column(db.String(50), nullable=False)
    garden_bed_id = db.Column(db.Integer, db.ForeignKey('garden_bed.id'), nullable=False)
    planted_date = db.Column(db.DateTime, default=datetime.utcnow)
    transplant_date = db.Column(db.DateTime)
    harvest_date = db.Column(db.DateTime)
    position_x = db.Column(db.Integer, default=0)
    position_y = db.Column(db.Integer, default=0)
    quantity = db.Column(db.Integer, default=1)
    status = db.Column(db.String(20), default='planned')
    notes = db.Column(db.Text)
```

**Relationships**:
- Many-to-one with GardenBed (via garden_bed_id)

**Constraints**:
- `plant_id` is required
- `garden_bed_id` is required (foreign key)

#### PlantingEvent
```python
class PlantingEvent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    plant_id = db.Column(db.String(50), nullable=False)
    variety = db.Column(db.String(100))  # Added recently
    garden_bed_id = db.Column(db.Integer)
    seed_start_date = db.Column(db.DateTime)
    transplant_date = db.Column(db.DateTime)
    direct_seed_date = db.Column(db.DateTime)
    expected_harvest_date = db.Column(db.DateTime)
    succession_planting = db.Column(db.Boolean, default=False)
    succession_interval = db.Column(db.Integer)
    completed = db.Column(db.Boolean, default=False)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
```

**Recent Changes**:
- `variety` column added to support specific plant varieties

#### Livestock
```python
class Livestock(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    species = db.Column(db.String(50), nullable=False)
    breed = db.Column(db.String(100))
    acquisition_date = db.Column(db.DateTime)
    health_records = db.Column(db.Text)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
```

**Recent Changes**:
- Enhanced to support multiple animals

#### Other Models
- `WinterPlan` - Winter gardening plans
- `Structure` - Garden structure catalog
- `PropertyStructure` - Placed structures
- `SeedInventory` - Seed storage tracking
- `HarvestRecord` - Harvest logs
- `CompostBin` - Compost management

## Migration Workflow

### Standard Migration Process

```bash
# 1. Modify model in models.py
# Example: Add new field
class PlantingEvent(db.Model):
    # ... existing fields ...
    variety = db.Column(db.String(100))  # NEW FIELD

# 2. Generate migration
cd backend
flask db migrate -m "Add variety column to planting_event"

# 3. Review generated migration file
# Location: backend/migrations/versions/xxxxx_add_variety_column.py

# 4. Test the migration
flask db upgrade

# 5. Verify in database
python
>>> from app import app, db
>>> from models import PlantingEvent
>>> with app.app_context():
...     events = PlantingEvent.query.all()
...     print(events[0].__dict__)

# 6. Test rollback (optional)
flask db downgrade
flask db upgrade

# 7. Document if complex
# Add entry to backend/MIGRATIONS.md
```

### What Gets Generated

When you run `flask db migrate`, Alembic generates:

```python
# migrations/versions/xxxxx_add_variety_column.py
def upgrade():
    # ### commands auto generated by Alembic ###
    op.add_column('planting_event',
                  sa.Column('variety', sa.String(length=100), nullable=True))
    # ### end Alembic commands ###

def downgrade():
    # ### commands auto generated by Alembic ###
    op.drop_column('planting_event', 'variety')
    # ### end Alembic commands ###
```

### Complex Data Migration

For migrations requiring data transformation:

```python
# add_variety_column.py
from app import app, db
from models import PlantingEvent
from sqlalchemy import inspect

def migrate():
    """Add variety column with safe migration logic"""
    with app.app_context():
        try:
            # Check if column exists
            inspector = inspect(db.engine)
            columns = [col['name'] for col in
                      inspector.get_columns('planting_event')]

            if 'variety' not in columns:
                # Add column
                with db.engine.connect() as conn:
                    conn.execute(
                        'ALTER TABLE planting_event '
                        'ADD COLUMN variety VARCHAR(100)'
                    )
                    conn.commit()

                print("✓ Added variety column")

                # Migrate existing data if needed
                events = PlantingEvent.query.all()
                for event in events:
                    # Example: Extract variety from notes
                    if event.notes and 'variety:' in event.notes:
                        variety = extract_variety(event.notes)
                        event.variety = variety

                db.session.commit()
                print(f"✓ Migrated {len(events)} events")

            else:
                print("✓ Variety column already exists")

        except Exception as e:
            db.session.rollback()
            print(f"✗ Error: {e}")
            raise

def extract_variety(notes: str) -> str:
    """Extract variety from notes field"""
    # Implementation...
    pass

if __name__ == '__main__':
    migrate()
```

## Relationship Patterns

### One-to-Many

```python
# Parent model
class GardenBed(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))

    # One-to-many relationship
    planted_items = db.relationship('PlantedItem',
                                   backref='garden_bed',
                                   lazy=True,
                                   cascade='all, delete-orphan')

# Child model
class PlantedItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    garden_bed_id = db.Column(db.Integer,
                             db.ForeignKey('garden_bed.id'),
                             nullable=False)

# Usage
bed = GardenBed.query.get(1)
print(bed.planted_items)  # List of PlantedItem objects

item = PlantedItem.query.get(1)
print(item.garden_bed)  # GardenBed object
```

### Many-to-Many (Association Table)

```python
# Association table
plant_companions = db.Table('plant_companions',
    db.Column('plant_a_id', db.String(50), db.ForeignKey('plant.id')),
    db.Column('plant_b_id', db.String(50), db.ForeignKey('plant.id'))
)

# Models
class Plant(db.Model):
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(100))

    companions = db.relationship('Plant',
                                secondary=plant_companions,
                                primaryjoin=(id == plant_companions.c.plant_a_id),
                                secondaryjoin=(id == plant_companions.c.plant_b_id))

# Usage
tomato = Plant.query.get('tomato')
print(tomato.companions)  # List of companion plants
```

### Cascade Behavior

```python
# Delete children when parent is deleted
planted_items = db.relationship('PlantedItem',
                               cascade='all, delete-orphan')

# Keep children when parent is deleted (set FK to NULL)
planted_items = db.relationship('PlantedItem',
                               cascade='all')

# Prevent deletion if children exist
planted_items = db.relationship('PlantedItem',
                               cascade='save-update, merge')
```

## Query Patterns

### Basic Queries

```python
# Get all
all_beds = GardenBed.query.all()

# Get by ID
bed = GardenBed.query.get(1)
bed = GardenBed.query.get_or_404(1)  # Raises 404 if not found

# Filter
full_sun_beds = GardenBed.query.filter_by(sun_exposure='full').all()
large_beds = GardenBed.query.filter(GardenBed.width > 4).all()

# Multiple filters
beds = GardenBed.query.filter(
    GardenBed.sun_exposure == 'full',
    GardenBed.width > 4
).all()

# Order by
beds = GardenBed.query.order_by(GardenBed.name).all()
beds = GardenBed.query.order_by(GardenBed.created_at.desc()).all()

# Limit
recent_beds = GardenBed.query.order_by(
    GardenBed.created_at.desc()
).limit(10).all()

# Count
bed_count = GardenBed.query.count()
full_sun_count = GardenBed.query.filter_by(sun_exposure='full').count()
```

### Advanced Queries

```python
# Join relationships
beds_with_tomatoes = GardenBed.query.join(PlantedItem).filter(
    PlantedItem.plant_id == 'tomato'
).all()

# Eager loading (avoid N+1 queries)
from sqlalchemy.orm import joinedload

beds = GardenBed.query.options(
    joinedload(GardenBed.planted_items)
).all()

# Aggregate functions
from sqlalchemy import func

avg_width = db.session.query(func.avg(GardenBed.width)).scalar()
max_length = db.session.query(func.max(GardenBed.length)).scalar()

# Group by
from sqlalchemy import func

bed_counts = db.session.query(
    GardenBed.sun_exposure,
    func.count(GardenBed.id)
).group_by(GardenBed.sun_exposure).all()

# Date filtering
from datetime import datetime, timedelta

recent_events = PlantingEvent.query.filter(
    PlantingEvent.created_at > datetime.utcnow() - timedelta(days=30)
).all()

# NULL checks
no_variety = PlantingEvent.query.filter(
    PlantingEvent.variety.is_(None)
).all()

has_variety = PlantingEvent.query.filter(
    PlantingEvent.variety.isnot(None)
).all()
```

## Transaction Management

### Single Operation

```python
# Add
bed = GardenBed(name="New Bed", width=4, length=8)
db.session.add(bed)
db.session.commit()

# Update
bed = GardenBed.query.get(1)
bed.name = "Updated Name"
db.session.commit()

# Delete
bed = GardenBed.query.get(1)
db.session.delete(bed)
db.session.commit()
```

### Multiple Operations (Transaction)

```python
try:
    # Multiple operations
    bed = GardenBed(name="Bed 1", width=4, length=8)
    db.session.add(bed)
    db.session.flush()  # Get bed.id without committing

    item = PlantedItem(
        plant_id='tomato',
        garden_bed_id=bed.id,
        position_x=0,
        position_y=0
    )
    db.session.add(item)

    # Commit all or nothing
    db.session.commit()
except Exception as e:
    # Rollback on error
    db.session.rollback()
    raise
```

## Database Maintenance

### Backup

```bash
# Backup database
cd backend/instance
cp homestead.db homestead.db.backup.$(date +%Y%m%d)

# Or use SQLite command
sqlite3 homestead.db ".backup 'homestead.db.backup'"
```

### Reset Database (Development Only)

```bash
# WARNING: This deletes all data!
cd backend

# Remove database
rm instance/homestead.db

# Remove migrations
rm -rf migrations

# Reinitialize
flask db init
flask db migrate -m "Initial migration"
flask db upgrade
```

### Check Schema

```python
from sqlalchemy import inspect

def print_schema():
    inspector = inspect(db.engine)

    for table_name in inspector.get_table_names():
        print(f"\nTable: {table_name}")
        columns = inspector.get_columns(table_name)
        for col in columns:
            print(f"  {col['name']}: {col['type']}")

# Run in app context
with app.app_context():
    print_schema()
```

## Common Pitfalls

### ❌ Don't Do This

```python
# Modifying database directly
os.system('sqlite3 instance/homestead.db "ALTER TABLE ..."')

# Not committing
bed = GardenBed(name="Test")
db.session.add(bed)
# Missing: db.session.commit()

# Not rolling back on error
try:
    db.session.add(bed)
    db.session.commit()
except:
    pass  # Should rollback!

# N+1 query problem
beds = GardenBed.query.all()
for bed in beds:
    print(bed.planted_items)  # Separate query for each bed!

# Using raw SQL unnecessarily
db.engine.execute("SELECT * FROM garden_bed WHERE id = 1")
```

### ✅ Do This Instead

```python
# Use migrations
flask db migrate -m "description"
flask db upgrade

# Always commit
bed = GardenBed(name="Test")
db.session.add(bed)
db.session.commit()

# Rollback on error
try:
    db.session.add(bed)
    db.session.commit()
except:
    db.session.rollback()
    raise

# Eager load to avoid N+1
beds = GardenBed.query.options(
    joinedload(GardenBed.planted_items)
).all()

# Use ORM
bed = GardenBed.query.get(1)
```

## Checklist for Database Changes

Before making database changes:

- [ ] Plan the schema change carefully
- [ ] Consider impact on existing data
- [ ] Modify model in `models.py`
- [ ] Generate migration with `flask db migrate`
- [ ] Review generated migration file
- [ ] Test migration on development database
- [ ] Test rollback with `flask db downgrade`
- [ ] Document complex migrations in `MIGRATIONS.md`
- [ ] Update affected route handlers
- [ ] Update frontend types if needed
- [ ] Test API endpoints
- [ ] Backup production database before deploying

## Quick Reference

### Migration Commands
```bash
# Initialize migrations (first time only)
flask db init

# Create migration
flask db migrate -m "description"

# Apply migrations
flask db upgrade

# Rollback one migration
flask db downgrade

# Show current migration
flask db current

# Show migration history
flask db history
```

### Database Location
- Development: `backend/instance/homestead.db`
- Migrations: `backend/migrations/versions/`
- Models: `backend/models.py`

---

For more details, see:
- `CLAUDE.md` - Project guidelines
- `backend/MIGRATIONS.md` - Migration history
- `backend/SETUP_MIGRATIONS.md` - Setup guide
