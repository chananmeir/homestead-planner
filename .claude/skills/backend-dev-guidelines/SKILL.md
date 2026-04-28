# Backend Development Guidelines

## Overview

This skill provides best practices and patterns for developing the Flask/Python backend of Homestead Planner.

## When to Use This Skill

- Working on Flask routes and endpoints
- Creating or modifying SQLAlchemy models
- Writing database migrations
- Implementing business logic in Python
- Working with files in `backend/` directory

## Core Principles

### 1. Follow Flask Best Practices

- Keep route handlers focused and minimal
- Extract business logic into separate functions/modules
- Use blueprints for large feature sets
- Return consistent JSON responses
- Handle errors gracefully

### 2. SQLAlchemy Model Patterns

All models should follow these conventions:
- Use SQLAlchemy ORM, never raw SQL
- Define `to_dict()` method for JSON serialization
- Use camelCase for JSON keys, snake_case for Python
- Include proper relationships and foreign keys
- Add timestamps (created_at, updated_at) where appropriate

### 3. Database Migrations

**CRITICAL**: Never modify the database directly!

- Always use Flask-Migrate for schema changes
- Test migrations locally before committing
- Document complex migrations in MIGRATIONS.md
- Use standalone scripts for data migrations

## Project Structure

```
backend/
├── app.py                    # Flask app and routes
├── models.py                 # SQLAlchemy models
├── garden_methods.py         # Garden planning logic
├── plant_database.py         # Plant data operations
├── structures_database.py    # Structure operations
├── instance/                 # SQLite database
└── migrations/               # Alembic migrations
```

## Common Patterns

### Model Definition Pattern

```python
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class ModelName(db.Model):
    # Primary key
    id = db.Column(db.Integer, primary_key=True)

    # Fields with proper types
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Foreign keys
    parent_id = db.Column(db.Integer, db.ForeignKey('parent.id'))

    # Relationships
    children = db.relationship('Child', backref='parent',
                              lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        """Convert model to JSON-serializable dict"""
        return {
            'id': self.id,
            'name': self.name,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'children': [child.to_dict() for child in self.children]
        }
```

### Route Handler Pattern

```python
@app.route('/api/resource', methods=['GET'])
def get_resources():
    """Get all resources"""
    try:
        resources = Resource.query.all()
        return jsonify([r.to_dict() for r in resources]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/resource/<int:id>', methods=['GET'])
def get_resource(id):
    """Get specific resource by ID"""
    try:
        resource = Resource.query.get_or_404(id)
        return jsonify(resource.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/resource', methods=['POST'])
def create_resource():
    """Create new resource"""
    try:
        data = request.get_json()

        # Validate required fields
        if not data.get('name'):
            return jsonify({'error': 'Name is required'}), 400

        # Create model instance
        resource = Resource(
            name=data.get('name'),
            description=data.get('description')
        )

        # Save to database
        db.session.add(resource)
        db.session.commit()

        return jsonify(resource.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/resource/<int:id>', methods=['PUT'])
def update_resource(id):
    """Update existing resource"""
    try:
        resource = Resource.query.get_or_404(id)
        data = request.get_json()

        # Update fields
        if 'name' in data:
            resource.name = data['name']
        if 'description' in data:
            resource.description = data['description']

        db.session.commit()
        return jsonify(resource.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/resource/<int:id>', methods=['DELETE'])
def delete_resource(id):
    """Delete resource"""
    try:
        resource = Resource.query.get_or_404(id)
        db.session.delete(resource)
        db.session.commit()
        return jsonify({'message': 'Resource deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
```

### Error Handling Pattern

```python
try:
    # Operation that might fail
    result = risky_operation()
    db.session.commit()
    return jsonify(result), 200
except ValueError as e:
    # Handle specific exceptions
    db.session.rollback()
    return jsonify({'error': f'Invalid input: {str(e)}'}), 400
except SQLAlchemyError as e:
    # Handle database errors
    db.session.rollback()
    return jsonify({'error': f'Database error: {str(e)}'}), 500
except Exception as e:
    # Handle unexpected errors
    db.session.rollback()
    return jsonify({'error': 'Internal server error'}), 500
```

## Database Migration Workflow

### Creating a Migration

```bash
# 1. Modify model in models.py
# 2. Generate migration
cd backend
flask db migrate -m "Add variety column to planting_event"

# 3. Review the generated migration file
# Check: migrations/versions/xxxxx_add_variety_column.py

# 4. Apply migration
flask db upgrade

# 5. Test that it works
# 6. Document in MIGRATIONS.md if complex
```

### Complex Migration Script Example

For data migrations or complex schema changes:

```python
# add_variety_column.py
from app import app, db
from models import PlantingEvent

def migrate():
    """Add variety column with migration logic"""
    with app.app_context():
        try:
            # Check if column exists
            inspector = db.inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('planting_event')]

            if 'variety' not in columns:
                # Add column
                db.engine.execute('ALTER TABLE planting_event ADD COLUMN variety VARCHAR(100)')
                print("✓ Added variety column")
            else:
                print("✓ Variety column already exists")

            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"✗ Error: {e}")

if __name__ == '__main__':
    migrate()
```

## Date Handling

### ISO Date Parsing

The frontend sends ISO 8601 dates with 'Z' suffix. Handle them properly:

```python
from datetime import datetime

def parse_iso_date(date_string):
    """Parse ISO date string from frontend"""
    if not date_string:
        return None

    # Handle JavaScript ISO format with 'Z'
    if date_string.endswith('Z'):
        date_string = date_string[:-1] + '+00:00'

    try:
        return datetime.fromisoformat(date_string)
    except ValueError:
        # Fallback to simpler parsing
        return datetime.strptime(date_string, '%Y-%m-%dT%H:%M:%S')

# In route handler
seed_start_date = parse_iso_date(data.get('seedStartDate'))
```

### Date Serialization

Always use ISO format for JSON responses:

```python
def to_dict(self):
    return {
        'date': self.date.isoformat() if self.date else None
    }
```

## Request Validation

### Input Validation Pattern

```python
def validate_garden_bed_data(data):
    """Validate garden bed input data"""
    errors = []

    if not data.get('name'):
        errors.append('Name is required')

    if not data.get('width') or data['width'] <= 0:
        errors.append('Width must be positive')

    if not data.get('length') or data['length'] <= 0:
        errors.append('Length must be positive')

    valid_exposures = ['full', 'partial', 'shade']
    if data.get('sunExposure') and data['sunExposure'] not in valid_exposures:
        errors.append(f'Sun exposure must be one of: {valid_exposures}')

    return errors

# In route handler
@app.route('/api/garden-beds', methods=['POST'])
def create_garden_bed():
    data = request.get_json()

    # Validate
    errors = validate_garden_bed_data(data)
    if errors:
        return jsonify({'errors': errors}), 400

    # Create resource...
```

## Testing

### Basic Test Structure

```python
import pytest
from app import app, db
from models import GardenBed

@pytest.fixture
def client():
    """Test client fixture"""
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'

    with app.test_client() as client:
        with app.app_context():
            db.create_all()
        yield client
        with app.app_context():
            db.drop_all()

def test_get_garden_beds(client):
    """Test GET /api/garden-beds"""
    response = client.get('/api/garden-beds')
    assert response.status_code == 200
    assert isinstance(response.json, list)

def test_create_garden_bed(client):
    """Test POST /api/garden-beds"""
    data = {
        'name': 'Test Bed',
        'width': 4,
        'length': 8,
        'sunExposure': 'full'
    }
    response = client.post('/api/garden-beds', json=data)
    assert response.status_code == 201
    assert response.json['name'] == 'Test Bed'
```

## Code Organization Tips

### When to Extract Logic

Extract to separate functions/modules when:
- Logic is reused in multiple routes
- Function exceeds ~30 lines
- Complex calculations or algorithms
- Domain-specific operations

Example:

```python
# garden_methods.py
def calculate_square_foot_plants(bed_width, bed_length, plant_spacing):
    """Calculate how many plants fit in square foot garden"""
    grid_size = 12  # inches
    plants_per_sqft = (grid_size / plant_spacing) ** 2
    total_sqft = (bed_width * bed_length)
    return int(total_sqft * plants_per_sqft)

# app.py
from garden_methods import calculate_square_foot_plants

@app.route('/api/calculate-capacity', methods=['POST'])
def calculate_capacity():
    data = request.get_json()
    capacity = calculate_square_foot_plants(
        data['width'],
        data['length'],
        data['spacing']
    )
    return jsonify({'capacity': capacity})
```

## Security Best Practices

1. **Input Validation**: Always validate and sanitize user input
2. **SQL Injection**: Use SQLAlchemy ORM, never string concatenation
3. **CORS**: Configure properly for production
4. **Environment Variables**: Never hardcode secrets
5. **Error Messages**: Don't expose sensitive info in errors

## Common Pitfalls

### ❌ Don't Do This

```python
# Direct SQL (SQL injection risk)
db.engine.execute(f"SELECT * FROM users WHERE name = '{name}'")

# Forgetting to commit
resource = Resource(name="test")
db.session.add(resource)
# Missing: db.session.commit()

# Not rolling back on error
try:
    db.session.add(resource)
    db.session.commit()
except:
    pass  # Should rollback!

# Inconsistent naming
def to_dict(self):
    return {'plant_id': self.plant_id}  # Should be 'plantId'
```

### ✅ Do This Instead

```python
# Use ORM
Resource.query.filter_by(name=name).all()

# Always commit
db.session.add(resource)
db.session.commit()

# Rollback on error
try:
    db.session.add(resource)
    db.session.commit()
except:
    db.session.rollback()
    raise

# Consistent naming
def to_dict(self):
    return {'plantId': self.plant_id}  # camelCase for JSON
```

## Checklist for New Features

Before considering a backend feature complete:

- [ ] Models defined with proper fields and relationships
- [ ] `to_dict()` method implemented with camelCase keys
- [ ] Route handlers follow RESTful conventions
- [ ] Input validation implemented
- [ ] Error handling with proper status codes
- [ ] Database migrations created and tested
- [ ] Rollback on database errors
- [ ] CRUD operations all work
- [ ] Documented in MIGRATIONS.md if needed
- [ ] Manual testing with curl/Postman
- [ ] No console errors or warnings

## Quick Reference

### Common Commands
```bash
# Activate virtual environment
cd backend
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux

# Run app
python app.py

# Create migration
flask db migrate -m "description"

# Apply migration
flask db upgrade

# Rollback migration
flask db downgrade
```

### File Locations
- Models: `backend/models.py`
- Routes: `backend/app.py`
- Business logic: `backend/garden_methods.py`, `backend/plant_database.py`
- Database: `backend/instance/`
- Migrations: `backend/migrations/versions/`

---

For more details, see:
- `CLAUDE.md` - Project guidelines
- `dev/PROJECT_ARCHITECTURE.md` - System architecture
- `backend/README.md` - Backend-specific docs
