# Phase 2 CRUD Operations Implementation Plan

**Created**: 2025-11-11
**Last Updated**: 2025-11-11
**Status**: In Progress

## Overview

Implement full CRUD (Create, Read, Update, Delete) functionality for three features using the foundation components built in Phase 1.

## Implementation Priority

### 2A. Seed Inventory CRUD (Highest Priority)
- Simple data model
- Clear use case
- Full backend API support available
- Components: AddSeedModal, EditSeedModal
- Update SeedInventory.tsx with CRUD controls

### 2B. Livestock Management CRUD
- Dynamic form based on animal category
- Components: AnimalFormModal (handles all categories)
- Update Livestock.tsx with category-specific CRUD

### 2C. Harvest Tracker CRUD
- Components: LogHarvestModal
- Update HarvestTracker.tsx with logging and delete
- Note: No edit functionality (backend limitation - no PUT endpoint)

## Technical Strategy

### Foundation Components Available
- Modal, Button, ConfirmDialog, Toast (with useToast)
- FormInput, FormSelect, FormTextarea, FormDatePicker, FormNumber
- All in `frontend/src/components/common/`
- ToastProvider already wrapping App

### Component Pattern
```tsx
- Modal for all forms (Add/Edit)
- Form components for inputs
- useToast for success/error messages
- ConfirmDialog for delete confirmations
- Loading states on buttons
- Validation before submit
- Refresh parent data on success
```

## API Endpoints

### Seed Inventory
- GET `/api/seeds` - List all
- POST `/api/seeds` - Create
- PUT `/api/seeds/<id>` - Update
- DELETE `/api/seeds/<id>` - Delete
- GET `/api/plants` - For dropdown

### Livestock
- Chickens: POST/PUT/DELETE `/api/chickens/<id>`
- Ducks: POST/PUT/DELETE `/api/ducks/<id>`
- Beehives: POST/PUT/DELETE `/api/beehives/<id>`
- Other: POST/PUT/DELETE `/api/livestock/<id>`

### Harvests
- POST `/api/harvests` - Create
- DELETE `/api/harvests/<id>` - Delete
- No PUT (cannot edit)

## Success Criteria
- All forms validate properly
- Success/error toasts work
- Delete confirmations present
- Data refreshes after mutations
- TypeScript compiles without errors
- Consistent UX across all features
