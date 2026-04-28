# Frontend Development Guidelines

## Overview

This skill provides best practices and patterns for developing the React/TypeScript frontend of Homestead Planner.

## When to Use This Skill

- Creating or modifying React components
- Working with TypeScript types
- Styling with Tailwind CSS
- Making API calls to the backend
- Working with files in `frontend/src/`

## Core Principles

### 1. Modern React Patterns

- Use functional components with hooks
- Prefer TypeScript for type safety
- Keep components focused and single-purpose
- Use proper state management patterns
- Handle loading and error states

### 2. TypeScript Best Practices

- Define types for all props and state
- Use interfaces for object shapes
- Avoid `any` type unless absolutely necessary
- Export types for reuse
- Keep types in `types.ts` or co-located `.types.ts` files

### 3. Tailwind CSS Styling

- Use utility classes, not custom CSS
- Follow responsive design patterns
- Use consistent spacing scale
- Leverage Tailwind's design tokens

## Project Structure

```
frontend/src/
├── App.tsx                   # Main application
├── App.css                   # Global styles
├── index.tsx                 # Entry point
├── types.ts                  # Global type definitions
├── components/               # React components
│   ├── GardenPlanner.tsx
│   ├── PlantingCalendar.tsx
│   ├── CompostTracker.tsx
│   ├── WinterGarden.tsx
│   └── WeatherAlerts.tsx
└── data/                     # Static data files
```

## Component Patterns

### Functional Component with TypeScript

```typescript
import React, { useState, useEffect } from 'react';

// Define props interface
interface ComponentNameProps {
  title: string;
  onSave?: (data: any) => void;
  initialData?: DataType;
}

const ComponentName: React.FC<ComponentNameProps> = ({
  title,
  onSave,
  initialData
}) => {
  // State with proper typing
  const [data, setData] = useState<DataType | null>(initialData || null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Effects
  useEffect(() => {
    // Fetch data or side effects
    fetchData();
  }, []); // Dependency array

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5000/api/endpoint');
      if (!response.ok) throw new Error('Failed to fetch');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!data) return;
    try {
      await saveData(data);
      onSave?.(data); // Optional callback
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  // Render loading state
  if (loading) {
    return <div className="flex items-center justify-center p-8">
      <div className="text-gray-600">Loading...</div>
    </div>;
  }

  // Render error state
  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-4">
      <p className="text-red-800">{error}</p>
      <button
        onClick={fetchData}
        className="mt-2 text-red-600 hover:text-red-800 underline"
      >
        Try Again
      </button>
    </div>;
  }

  // Render main content
  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      {/* Component content */}
    </div>
  );
};

export default ComponentName;
```

### Custom Hook Pattern

Extract reusable logic into custom hooks:

```typescript
// useApi.ts
import { useState, useEffect } from 'react';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useApi<T>(url: string): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [url]);

  return { data, loading, error, refetch: fetchData };
}

// Usage in component
const MyComponent: React.FC = () => {
  const { data, loading, error, refetch } = useApi<GardenBed[]>(
    'http://localhost:5000/api/garden-beds'
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return <div>{/* Render data */}</div>;
};
```

## TypeScript Type Definitions

### Basic Types

```typescript
// types.ts

// Garden Bed
export interface GardenBed {
  id: number;
  name: string;
  width: number;
  length: number;
  location?: string;
  sunExposure: 'full' | 'partial' | 'shade';
  planningMethod: 'square-foot' | 'row' | 'intensive' | 'raised-bed' | 'permaculture' | 'container';
  gridSize: number;
  plants?: PlantedItem[];
}

// Planted Item
export interface PlantedItem {
  id: number;
  plantId: string;
  plantedDate?: string;
  transplantDate?: string;
  harvestDate?: string;
  position: { x: number; y: number };
  quantity: number;
  status: 'planned' | 'seeded' | 'transplanted' | 'growing' | 'harvested';
  notes?: string;
}

// Planting Event
export interface PlantingEvent {
  id: number;
  plantId: string;
  variety?: string;
  gardenBedId?: number;
  seedStartDate?: string;
  transplantDate?: string;
  directSeedDate?: string;
  expectedHarvestDate?: string;
  successionPlanting: boolean;
  successionInterval?: number;
  completed: boolean;
  notes?: string;
}

// Livestock
export interface Livestock {
  id: number;
  name: string;
  species: string;
  breed?: string;
  acquisitionDate?: string;
  healthRecords?: string;
  notes?: string;
}

// Component Props Types
export interface GardenPlannerProps {
  initialBed?: GardenBed;
  onSave?: (bed: GardenBed) => void;
}

export interface PlantingCalendarProps {
  events: PlantingEvent[];
  onEventCreate?: (event: PlantingEvent) => void;
  onEventUpdate?: (id: number, event: Partial<PlantingEvent>) => void;
}
```

### Form Data Types

```typescript
// For form inputs
export type GardenBedFormData = Omit<GardenBed, 'id' | 'plants'>;

export interface PlantingEventFormData {
  plantId: string;
  variety?: string;
  gardenBedId?: number;
  seedStartDate?: Date;
  transplantDate?: Date;
  directSeedDate?: Date;
  notes?: string;
}
```

## API Integration Patterns

### GET Request

```typescript
const fetchGardenBeds = async (): Promise<GardenBed[]> => {
  try {
    const response = await fetch('http://localhost:5000/api/garden-beds');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching garden beds:', error);
    throw error;
  }
};
```

### POST Request

```typescript
const createGardenBed = async (bedData: GardenBedFormData): Promise<GardenBed> => {
  try {
    const response = await fetch('http://localhost:5000/api/garden-beds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bedData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create garden bed');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating garden bed:', error);
    throw error;
  }
};
```

### PUT Request

```typescript
const updateGardenBed = async (
  id: number,
  updates: Partial<GardenBed>
): Promise<GardenBed> => {
  try {
    const response = await fetch(`http://localhost:5000/api/garden-beds/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update garden bed');
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating garden bed:', error);
    throw error;
  }
};
```

### DELETE Request

```typescript
const deleteGardenBed = async (id: number): Promise<void> => {
  try {
    const response = await fetch(`http://localhost:5000/api/garden-beds/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete garden bed');
    }
  } catch (error) {
    console.error('Error deleting garden bed:', error);
    throw error;
  }
};
```

## Tailwind CSS Patterns

### Layout Components

```typescript
// Container with padding
<div className="container mx-auto px-4 py-8">
  {/* Content */}
</div>

// Grid layout
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => (
    <div key={item.id} className="border rounded-lg p-4">
      {/* Card content */}
    </div>
  ))}
</div>

// Flex layout
<div className="flex items-center justify-between">
  <h2 className="text-xl font-semibold">Title</h2>
  <button className="px-4 py-2 bg-blue-500 text-white rounded">
    Action
  </button>
</div>
```

### Form Styling

```typescript
<form className="space-y-4">
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Garden Bed Name
    </label>
    <input
      type="text"
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      value={name}
      onChange={(e) => setName(e.target.value)}
    />
  </div>

  <div className="grid grid-cols-2 gap-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Width (ft)
      </label>
      <input
        type="number"
        className="w-full px-3 py-2 border border-gray-300 rounded-md"
        value={width}
        onChange={(e) => setWidth(Number(e.target.value))}
      />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Length (ft)
      </label>
      <input
        type="number"
        className="w-full px-3 py-2 border border-gray-300 rounded-md"
        value={length}
        onChange={(e) => setLength(Number(e.target.value))}
      />
    </div>
  </div>

  <button
    type="submit"
    className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
  >
    Save Garden Bed
  </button>
</form>
```

### Button Variants

```typescript
// Primary button
<button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
  Primary Action
</button>

// Secondary button
<button className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
  Secondary Action
</button>

// Danger button
<button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
  Delete
</button>

// Disabled button
<button
  disabled
  className="px-4 py-2 bg-gray-300 text-gray-500 rounded cursor-not-allowed"
>
  Disabled
</button>
```

### Status Badges

```typescript
const statusStyles = {
  planned: 'bg-gray-100 text-gray-800',
  seeded: 'bg-yellow-100 text-yellow-800',
  transplanted: 'bg-blue-100 text-blue-800',
  growing: 'bg-green-100 text-green-800',
  harvested: 'bg-purple-100 text-purple-800',
};

<span className={`px-2 py-1 text-xs font-medium rounded ${statusStyles[status]}`}>
  {status}
</span>
```

## State Management

### Local State with useState

```typescript
const [formData, setFormData] = useState<GardenBedFormData>({
  name: '',
  width: 4,
  length: 8,
  sunExposure: 'full',
  planningMethod: 'square-foot',
  gridSize: 12,
});

// Update single field
const handleNameChange = (name: string) => {
  setFormData(prev => ({ ...prev, name }));
};

// Update multiple fields
const handleUpdate = (updates: Partial<GardenBedFormData>) => {
  setFormData(prev => ({ ...prev, ...updates }));
};
```

### Context API for Global State

```typescript
// GardenContext.tsx
import React, { createContext, useContext, useState } from 'react';

interface GardenContextType {
  beds: GardenBed[];
  addBed: (bed: GardenBed) => void;
  updateBed: (id: number, updates: Partial<GardenBed>) => void;
  deleteBed: (id: number) => void;
}

const GardenContext = createContext<GardenContextType | undefined>(undefined);

export const GardenProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [beds, setBeds] = useState<GardenBed[]>([]);

  const addBed = (bed: GardenBed) => {
    setBeds(prev => [...prev, bed]);
  };

  const updateBed = (id: number, updates: Partial<GardenBed>) => {
    setBeds(prev =>
      prev.map(bed => (bed.id === id ? { ...bed, ...updates } : bed))
    );
  };

  const deleteBed = (id: number) => {
    setBeds(prev => prev.filter(bed => bed.id !== id));
  };

  return (
    <GardenContext.Provider value={{ beds, addBed, updateBed, deleteBed }}>
      {children}
    </GardenContext.Provider>
  );
};

export const useGarden = () => {
  const context = useContext(GardenContext);
  if (!context) {
    throw new Error('useGarden must be used within GardenProvider');
  }
  return context;
};

// Usage
const MyComponent = () => {
  const { beds, addBed } = useGarden();
  // Use the context...
};
```

## Form Handling

### Controlled Form Pattern

```typescript
const GardenBedForm: React.FC<{ onSubmit: (data: GardenBedFormData) => void }> = ({
  onSubmit,
}) => {
  const [formData, setFormData] = useState<GardenBedFormData>({
    name: '',
    width: 4,
    length: 8,
    sunExposure: 'full',
    planningMethod: 'square-foot',
    gridSize: 12,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (formData.width <= 0) {
      newErrors.width = 'Width must be positive';
    }

    if (formData.length <= 0) {
      newErrors.length = 'Length must be positive';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className={`w-full px-3 py-2 border rounded-md ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {errors.name && (
          <p className="text-red-500 text-sm mt-1">{errors.name}</p>
        )}
      </div>

      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Save
      </button>
    </form>
  );
};
```

## Date Handling

```typescript
// Format date for display
const formatDate = (dateString?: string): string => {
  if (!dateString) return 'Not set';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Format date for input[type="date"]
const formatDateForInput = (dateString?: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
};

// Parse date from input
const parseDateFromInput = (value: string): string => {
  return new Date(value).toISOString();
};

// Usage
<input
  type="date"
  value={formatDateForInput(plantingEvent.seedStartDate)}
  onChange={(e) => {
    const isoDate = parseDateFromInput(e.target.value);
    updateEvent({ seedStartDate: isoDate });
  }}
/>
```

## Common Pitfalls

### ❌ Don't Do This

```typescript
// Missing type annotations
const [data, setData] = useState(null);

// Using any
const handleData = (data: any) => { };

// Not handling loading/error states
const data = await fetch(url);
return <div>{data}</div>;

// Inline styles instead of Tailwind
<div style={{ marginTop: '20px', color: 'blue' }}>

// Not memoizing expensive operations
const expensiveValue = calculateExpensiveValue(data);

// Mutating state directly
formData.name = 'new name';
```

### ✅ Do This Instead

```typescript
// Proper type annotations
const [data, setData] = useState<DataType | null>(null);

// Specific types
const handleData = (data: DataType) => { };

// Handle all states
if (loading) return <Loading />;
if (error) return <Error message={error} />;
return <div>{data}</div>;

// Tailwind classes
<div className="mt-5 text-blue-600">

// Memoize when needed
const expensiveValue = useMemo(
  () => calculateExpensiveValue(data),
  [data]
);

// Update state immutably
setFormData({ ...formData, name: 'new name' });
```

## Checklist for New Components

Before considering a component complete:

- [ ] TypeScript types defined for props and state
- [ ] Loading state handled
- [ ] Error state handled
- [ ] Empty state handled (if applicable)
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Accessibility (labels, ARIA attributes)
- [ ] Tailwind classes used consistently
- [ ] No console errors or warnings
- [ ] API integration working
- [ ] Form validation (if applicable)
- [ ] User feedback for actions (success/error messages)

## Quick Reference

### Common Commands
```bash
# Start dev server
cd frontend
npm start

# Build for production
npm run build

# Run tests
npm test

# Install package
npm install package-name
```

### File Locations
- Components: `frontend/src/components/`
- Types: `frontend/src/types.ts`
- Main app: `frontend/src/App.tsx`
- Styles: `frontend/src/App.css`, `frontend/src/index.css`

---

For more details, see:
- `CLAUDE.md` - Project guidelines
- `dev/PROJECT_ARCHITECTURE.md` - System architecture
- `frontend/README.md` - Frontend-specific docs
