# Homestead Planner - Project Architecture

**Last Updated**: 2025-11-11

## Overview

Homestead Planner is a full-stack web application for planning and managing garden and homestead activities. The application uses a Flask backend with SQLAlchemy for data persistence and a React/TypeScript frontend with Tailwind CSS for the user interface.

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Port 3000)                │
│                  React + TypeScript + Tailwind          │
├─────────────────────────────────────────────────────────┤
│  Components:                                            │
│  - GardenPlanner      - PlantingCalendar               │
│  - CompostTracker     - WinterGarden                    │
│  - WeatherAlerts                                        │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP/REST API
                         │
┌────────────────────────▼────────────────────────────────┐
│                    Backend (Port 5000)                  │
│                    Flask + SQLAlchemy                   │
├─────────────────────────────────────────────────────────┤
│  Routes (app.py):                                       │
│  - /api/garden-beds     - /api/planted-items           │
│  - /api/planting-events - /api/livestock               │
│  - /api/structures      - /api/plants                  │
│                                                         │
│  Business Logic:                                        │
│  - garden_methods.py    - plant_database.py            │
│  - structures_database.py                               │
└────────────────────────┬────────────────────────────────┘
                         │
                         │
┌────────────────────────▼────────────────────────────────┐
│                   Database (SQLite)                     │
│                  backend/instance/*.db                  │
├─────────────────────────────────────────────────────────┤
│  Models:                                                │
│  - GardenBed          - PlantedItem                     │
│  - PlantingEvent      - WinterPlan                      │
│  - Livestock          - Structure                       │
│  - PropertyStructure  - SeedInventory                   │
│  - HarvestRecord      - CompostBin                      │
└─────────────────────────────────────────────────────────┘
```

## Backend Architecture

### Technology Stack
- **Framework**: Flask 2.x
- **ORM**: SQLAlchemy with Flask-SQLAlchemy
- **Migrations**: Flask-Migrate (Alembic)
- **Database**: SQLite (stored in `backend/instance/`)
- **Python Version**: 3.x

### Core Files

#### `app.py` (Main Application)
The central Flask application containing:
- Application initialization and configuration
- Database initialization
- RESTful API route definitions
- CORS configuration
- Error handlers

**Key Responsibilities**:
- Route handlers for CRUD operations
- Request validation
- Response formatting (JSON)
- Database session management

#### `models.py` (Database Models)
SQLAlchemy ORM models defining the database schema:

**Core Models**:
- `GardenBed` - Garden bed/plot definitions
  - Relationships: One-to-many with PlantedItem
  - Fields: name, width, length, location, sun_exposure, planning_method

- `PlantedItem` - Plants placed in garden beds
  - Foreign Key: garden_bed_id
  - Fields: plant_id, position_x, position_y, quantity, status

- `PlantingEvent` - Planting schedule/calendar entries
  - Fields: plant_id, variety, seed_start_date, transplant_date, succession_planting

- `WinterPlan` - Winter gardening plans
  - Fields: technique, plant_list, protection_layers, harvest_window

- `Livestock` - Livestock tracking
  - Fields: name, species, breed, acquisition_date, health_records

- `Structure` - Garden structures catalog
  - Fields: name, type, dimensions, materials

- `PropertyStructure` - Actual structures on property
  - Fields: structure_id, x, y, rotation, scale

- `SeedInventory` - Seed storage tracking
  - Fields: plant_id, variety, quantity, purchase_date, viability

- `HarvestRecord` - Harvest tracking
  - Fields: plant_id, quantity, harvest_date, weight, notes

- `CompostBin` - Compost management
  - Fields: name, location, volume, material_ratio, temperature

#### `garden_methods.py`
Business logic for garden planning methods:
- Square foot gardening calculations
- Row planting layouts
- Intensive gardening spacing
- Raised bed planning
- Permaculture design helpers
- Container gardening logic

#### `plant_database.py`
Plant information and operations:
- Plant catalog data (varieties, growing info)
- Companion planting relationships
- Growing requirements (sun, water, spacing)
- Hardiness zone compatibility
- Planting date calculations

#### `structures_database.py`
Structure catalog and management:
- Structure types (greenhouse, shed, trellis, etc.)
- Dimensions and materials
- Cost estimates
- Building instructions/resources

### Database Migrations

**Location**: `backend/migrations/` (managed by Flask-Migrate)

**Process**:
1. Modify models in `models.py`
2. Generate migration: `flask db migrate -m "description"`
3. Review generated migration in `migrations/versions/`
4. Apply migration: `flask db upgrade`
5. Document in `MIGRATIONS.md`

**Important Notes**:
- Never modify the database schema directly
- Always test migrations on development database first
- Keep migration scripts for rollback capability
- Complex migrations may require custom scripts (see `add_variety_column.py`)

### API Endpoints

#### Garden Management
- `GET /api/garden-beds` - List all garden beds
- `POST /api/garden-beds` - Create new garden bed
- `GET /api/garden-beds/<id>` - Get specific garden bed
- `PUT /api/garden-beds/<id>` - Update garden bed
- `DELETE /api/garden-beds/<id>` - Delete garden bed

#### Planting
- `GET /api/planted-items` - List planted items
- `POST /api/planted-items` - Add planted item
- `PUT /api/planted-items/<id>` - Update planted item
- `DELETE /api/planted-items/<id>` - Remove planted item

#### Calendar/Schedule
- `GET /api/planting-events` - Get planting schedule
- `POST /api/planting-events` - Create planting event
- `PUT /api/planting-events/<id>` - Update event
- `DELETE /api/planting-events/<id>` - Remove event

#### Livestock
- `GET /api/livestock` - List livestock
- `POST /api/livestock` - Add livestock
- `PUT /api/livestock/<id>` - Update livestock
- `DELETE /api/livestock/<id>` - Remove livestock

#### Structures
- `GET /api/structures` - Get structure catalog
- `GET /api/property-structures` - Get placed structures
- `POST /api/property-structures` - Place structure
- `PUT /api/property-structures/<id>` - Update placement
- `DELETE /api/property-structures/<id>` - Remove structure

## Frontend Architecture

### Technology Stack
- **Framework**: React 18
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Build Tool**: Create React App
- **State Management**: React Hooks (useState, useEffect, useContext)

### Core Files

#### `App.tsx`
Main application component:
- Routing (if using React Router)
- Layout structure
- Global state management
- Theme provider (if applicable)

#### `types.ts`
TypeScript type definitions:
- API response types
- Component prop types
- Data models matching backend
- Utility types

#### `components/`
React components for different features:

**`GardenPlanner.tsx`**
- Visual garden bed layout
- Drag-and-drop plant placement
- Grid-based or free-form design
- Save/load garden designs

**`PlantingCalendar.tsx`**
- Calendar view of planting schedule
- Add/edit planting events
- Succession planting management
- First/last frost date calculations

**`CompostTracker.tsx`**
- Compost bin management
- Temperature tracking
- Material ratio (brown/green)
- Turning schedule

**`WinterGarden.tsx`**
- Winter growing techniques
- Cold frame/hoop house planning
- Winter-hardy plant selection
- Season extension strategies

**`WeatherAlerts.tsx`**
- Weather integration (if implemented)
- Frost warnings
- Watering recommendations
- Growing degree days

### Component Patterns

**Standard Component Structure**:
```typescript
import React, { useState, useEffect } from 'react';
import type { ComponentProps } from '../types';

const ComponentName: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  const [state, setState] = useState(initialValue);

  useEffect(() => {
    // Side effects, API calls
  }, [dependencies]);

  return (
    <div className="tailwind-classes">
      {/* Component JSX */}
    </div>
  );
};

export default ComponentName;
```

**API Integration Pattern**:
```typescript
const fetchData = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/endpoint');
    if (!response.ok) throw new Error('Failed to fetch');
    const data = await response.json();
    setData(data);
  } catch (error) {
    console.error('Error:', error);
    setError(error.message);
  }
};
```

## Data Flow

### Create Operation Example
```
User Action (Frontend)
  └──> Component handles event
       └──> API call to backend
            └──> Flask route handler
                 └──> Validate request
                      └──> Create model instance
                           └──> db.session.add()
                                └──> db.session.commit()
                                     └──> Return JSON response
                                          └──> Update frontend state
                                               └──> Re-render UI
```

### Read Operation Example
```
Component Mount (useEffect)
  └──> API call to backend
       └──> Flask route handler
            └──> Query database
                 └──> model.query.all() or filter()
                      └──> [model.to_dict() for model in results]
                           └──> Return JSON response
                                └──> Set component state
                                     └──> Render data
```

## Recent Features & Changes

### Multi-Animal Livestock Support
- **Date**: Recent
- **What**: Enhanced livestock tracking to support multiple animals
- **Files**: `models.py` (Livestock model), relevant frontend components
- **Impact**: Can now track multiple animals with detailed records

### Variety Column Addition
- **Date**: Recent
- **What**: Added variety field to PlantingEvent model
- **Migration**: `add_variety_column.py`
- **Why**: Support tracking specific plant varieties (e.g., "Brandywine" tomato)
- **Files**: `models.py`, migration script

### ISO Date Parsing Fix
- **Date**: Recent
- **What**: Fixed handling of JavaScript 'Z' suffix in ISO dates
- **Why**: Frontend was sending dates with 'Z', backend needed to handle properly
- **Files**: Date parsing logic in `app.py` or relevant handlers

## Development Workflow

### Standard Development Flow
1. **Plan** - Use planning mode, create dev docs
2. **Backend First** - Modify models, create migrations, update routes
3. **Test Backend** - Use Postman/curl to test API endpoints
4. **Frontend** - Create/update components, integrate with API
5. **Test Integration** - Test full user flow
6. **Review** - Code review, fix issues
7. **Document** - Update relevant documentation

### Adding a New Feature
1. Create dev docs in `dev/active/feature-name/`
2. Update models if needed (backend)
3. Create migration (backend)
4. Add API routes (backend)
5. Create/update components (frontend)
6. Add TypeScript types (frontend)
7. Test integration
8. Update documentation
9. Move dev docs to `dev/completed/`

## Testing Strategy

### Backend Testing
- Unit tests for models
- Integration tests for API routes
- Database migration testing
- Edge case and error handling tests

### Frontend Testing
- Component unit tests (Jest + React Testing Library)
- Integration tests for user flows
- Manual browser testing
- Responsive design testing

## Security Considerations

- Input validation on all API endpoints
- SQL injection prevention (SQLAlchemy ORM)
- CORS configuration for production
- Environment variables for sensitive config
- User authentication (if implemented)

## Performance Considerations

- Database query optimization (eager loading, indexes)
- Frontend code splitting
- Image optimization
- Caching strategies
- Pagination for large datasets

## Future Architecture Considerations

- User authentication and authorization
- Multi-user support
- Real-time updates (WebSockets)
- File upload for photos
- Weather API integration
- Mobile app considerations
- Export/import functionality

---

**For Detailed Implementation**: See individual component documentation and code comments.
