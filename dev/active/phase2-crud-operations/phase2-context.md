# Phase 2 CRUD Operations Context

**Last Updated**: 2025-11-11

## Key Files

### Components to Create
- `frontend/src/components/SeedInventory/AddSeedModal.tsx`
- `frontend/src/components/SeedInventory/EditSeedModal.tsx`
- `frontend/src/components/Livestock/AnimalFormModal.tsx`
- `frontend/src/components/HarvestTracker/LogHarvestModal.tsx`

### Components to Modify
- `frontend/src/components/SeedInventory.tsx`
- `frontend/src/components/Livestock.tsx`
- `frontend/src/components/HarvestTracker.tsx`

### Common Components Used
- All from `frontend/src/components/common/`
- Modal, Button, ConfirmDialog
- ToastProvider, useToast
- FormInput, FormSelect, FormTextarea, FormDatePicker, FormNumber

## Data Structures

### Seed
```typescript
{
  id: number;
  plantId: string; // Required, from plants API
  variety: string;
  brand?: string;
  quantity: number; // Required, > 0
  purchaseDate?: string;
  expirationDate?: string;
  germinationRate?: number; // 0-100
  location?: string;
  price?: number;
  notes?: string;
}
```

### Animal (Chickens/Ducks/Other)
```typescript
{
  id: number;
  name: string;
  breed?: string;
  quantity?: number;
  hatchDate?: string;
  purpose?: string;
  sex?: string;
  status?: string;
  coopLocation?: string;
  notes?: string;
}
```

### Beehive
```typescript
{
  id: number;
  name: string;
  type?: string;
  installDate?: string;
  queenMarked?: boolean;
  queenColor?: string;
  status?: string;
  location?: string;
  notes?: string;
}
```

### Harvest
```typescript
{
  id: number;
  plantId: string; // Required
  harvestDate: string; // Required
  quantity: number; // Required
  unit: string; // lbs, oz, count, bunches
  quality: string; // excellent, good, fair, poor
  notes?: string;
}
```

## API Base URL
`http://localhost:5000`

## Important Decisions

### Seed Inventory
- Use dropdown for plant selection (fetch from /api/plants)
- Validation: plantId required, quantity > 0
- Edit modal pre-populates with existing data
- Delete requires confirmation

### Livestock
- Single dynamic form handles all categories
- Conditional rendering based on category type
- Category determines which fields to show
- Each category has separate API endpoint

### Harvest Tracker
- No edit functionality (backend doesn't support PUT)
- Only Create and Delete
- Default date to today
- Quality uses dropdown or radio buttons

## Error Handling
- Network errors: Show error toast
- Validation errors: Show on form field
- Success: Show success toast
- All API calls use try-catch
- Loading states during async operations
